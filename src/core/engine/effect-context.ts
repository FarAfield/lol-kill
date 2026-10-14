// ============================================================
// 联盟杀 · EffectContext — ISkillContext 实现
//
// 提供效果执行时的受限读写接口，作为引擎与效果逻辑之间的安全边界。
// 所有写操作最终都通过事件系统执行——效果不能直接修改 Player/Card 属性。
// EffectContext 由 EventDispatcher 在执行 CompiledHandler 时创建，不再通过 event.data 暗线传递。
// ============================================================

import { DamageType, GamePhase, LogLevel } from '@core/contracts/enums'
import type { EventName } from '@core/contracts/event-name'
import type {
  ISkill,
  ISkillContext,
  ISkillRuntimeState,
  ICardView,
  CardViewQuery,
  IWhenBuilder,
  ResponseRequest,
  EffectResponse,
} from '@core/contracts/skill.interface'
import type { IModQuery } from '@core/contracts/mod.interface'
import type { IGameEvent } from '@core/contracts/event.interface'
import type { IGameState } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { GameEvent } from '@core/event/game-event'
import {
  handOptions,
  cardOptions,
  seatOrderFrom,
  settle,
  JUDGE_RESULT_CARD_KEY,
  judgeResultCardOf,
} from '@core/event'
import { whenOf } from '@core/event/when'
import { CardTag } from '@core/contracts/card-tag'
import { DamageResolver } from '@core/system/damage-resolver'
import { cardSlot, heroSlot } from '@core/utils/name-slot'
import type { EffectContextDeps } from '@core/contracts/effect-context-deps'

/**
 * EffectContext — 效果执行上下文
 *
 * 实现 ISkillContext 的所有受限写入方法。
 * 每个方法内部通过创建和分发事件来执行操作。
 */
export class EffectContext implements ISkillContext {
  readonly event: IGameEvent
  readonly player: IPlayer
  readonly game: IGameState
  readonly triggerCards: ICard[]
  readonly damageEvent?: IGameEvent
  /** Mod 查询口（纯只读） */
  readonly mods: IModQuery
  /** 正在执行的技能（卡牌 content 被调用时为 undefined） */
  readonly skill?: ISkill
  /** 持有者对该技能的运行时状态 */
  readonly skillState?: ISkillRuntimeState

  private deps: EffectContextDeps

  constructor(
    event: IGameEvent,
    player: IPlayer,
    triggerCards: ICard[],
    deps: EffectContextDeps,
    extra?: {
      damageEvent?: IGameEvent
      skill?: ISkill
      skillState?: ISkillRuntimeState
    },
  ) {
    this.event = event
    this.player = player
    this.game = deps.state
    this.triggerCards = triggerCards
    this.deps = deps
    this.damageEvent = extra?.damageEvent
    this.skill = extra?.skill
    this.skillState = extra?.skillState
    this.mods = deps.modQuery
  }

  // ── 受限写入操作 ──

  /**
   * 摸牌 — 从牌堆顶部抽取指定数量的卡牌加入手牌。
   */
  async drawCards(count: number): Promise<ICard[]> {
    const drawn = this.deps.deckManager.draw(count)
    // 走 CardSystem 而不是自己 push：`zone` / `owner` / `visibleTo` 必须一起改。
    // 以前这里只改了前两个——摸到的牌带着上一任主人的可见性进手牌，
    // 「别人看得见我刚摸的牌」就是这么来的。
    this.deps.cardSystem.obtainCards(drawn, this.player)
    return drawn
  }

  /**
   * 弃置卡牌 — 将指定卡牌从当前区域移入弃牌堆。
   */
  async discardCards(cards: ICard[]): Promise<void> {
    for (const card of cards) {
      // `mod.cardDiscardable` 的落点：不可被弃置的牌留在原地。
      // 技能弃牌（过河拆桥、寒冰剑）与死亡弃牌都经过这里，因此一处生效。
      if (!this.mods.cardDiscardable(this.player, card, this.event)) continue

      // Use the card's actual owner for ownership validation
      const cardOwner = card.owner ?? this.player
      this.deps.cardSystem.discardCard(card, cardOwner)
    }
  }

  /**
   * 造成伤害 —— 发一条 `damage` 事件，等它走完整条流水线
   *
   * 这里**不扣血**。伤害是一条普通事件，扣血发生在它自己的内容里
   * （`source/base/contents/damage-content.ts`），因此：
   *   - `damageBefore` 的技能能转移目标、改数值、甚至 `cancel()` 掉伤害
   *   - `damageEnd` / `damageAfter` 的技能能拿到最终结算结果
   *
   * 濒死结算同样由伤害内容负责，不在调用方——保证「任何来源的伤害」
   * 都会走同一条求桃流程。
   */
  async damageTarget(target: IPlayer, amount: number): Promise<void> {
    const card = this.triggerCards[0]
    const nature = card ? DamageResolver.damageTypeOf(card) : DamageType.Normal

    const damageEvent = new GameEvent({
      name: 'damage',
      source: this.player,
      player: this.player,
      targets: [target],
      cards: this.triggerCards,
      nature,
      // 伤害点数只有这一处真值源：values.num
      num: amount,
      parent: this.event,
      phase: this.game.currentPhase,
      round: this.game.currentRound,
      turn: this.player.seatIndex,
      data: {
        damageAmount: amount,
        damageType: nature,
        damageCard: card,
      },
    })

    // 挂到发起方事件的树上：伤害是「谁造成的」这件事的一部分，
    // 事件树要能读出 useCard → damage → dying 这条链（技能要靠它追溯来源）
    this.event.addChild(damageEvent)

    await this.deps.eventDispatcher.dispatch(damageEvent, this.deps.eventChain)
  }

  /**
   * 扣减体力 —— 伤害结算的唯一写入点
   *
   * 见 `ISkillContext.applyDamage` 的说明：只有伤害内容会调用它。
   */
  async applyDamage(target: IPlayer, amount: number): Promise<number> {
    return this.deps.damageResolver.applyDamage(target, amount)
  }

  /**
   * 濒死结算 — 从濒死者自己开始按座次求桃
   *
   * 一个桃就够（`stopOnFirstResponse`），因此窗口会在第一次响应后立即关闭。
   * 无人出桃才走死亡结算——在此之前角色一直「活着但 hp ≤ 0」。
   */
  async settleDying(player: IPlayer, killer?: IPlayer): Promise<boolean> {
    // 已经不濒死了（被其它结算救回 / 重复调用）→ 无事可做
    if (!this.deps.deathSystem.checkDying(player)) return true

    const result = await settle(this, {
      id: 'dying:peach',

      // 从濒死者自己开始，按座次问一圈
      responders: () =>
        seatOrderFrom(this.game.players, player, true).filter((p) => p.alive),

      // 求桃是「救人」而非普通响应，因此过的是 `cardSavable` 不是 `cardRespondable`
      //
      // 虚拟桃要一起进候选：能把某张牌当桃用的技能（程普之流）若在这里
      // 不被问到，就等于「有桃但救不了」。
      optionsFor: (responder) => [
        ...handOptions(responder, CardTag.Heal, undefined, (card) =>
          this.mods.cardSavable(responder, card, this.event),
        ),
        ...cardOptions(
          this.cardViews({
            player: responder,
            usage: 'dying',
            requireTag: CardTag.Heal,
            event: this.event,
          }).map((view) => view.card),
        ),
      ],

      // 姓名与牌名一律写成**占位符**（欠账 D40）：换皮表在展示层，
      // 引擎拼的是 ID，名字由 `resolveNameSlots` 在边界上补。
      // 「是否出桃」里的桃写成它的定义 id——引擎认识的是稳定 ID，
      // 不是「桃」这两个字。
      prompt: () =>
        `濒死：是否打出【${cardSlot('tao')}】救 ${heroSlot(player.hero?.id ?? player.id)}（当前 ${player.hp} 体力）？`,

      stopOnFirstResponse: true,

      onRespond: async (responder, option) => {
        if (option.card) await this.discardCards([option.card])
        this.deps.deathSystem.rescue(player, responder)
      },
    })

    if (result.responses.length > 0) return true

    // 无人出桃 → 死亡结算
    //
    // 三区的牌由 `handleDeath` 自己送进弃牌堆（走 CardSystem，
    // 顺带把装备技从台账上摘下来）。调用方**不要再弃一遍**——
    // 那些牌此刻已在弃牌堆里，再弃一次就是「弃置弃牌堆里的牌」。
    this.deps.deathSystem.handleDeath(player, killer)

    // ── 发一条 `die`（D11 的接线）──
    //
    // `die` 这个名字在 `event-name.ts` 的 EVENT_SUBJECTS 里挂了好久，
    // 却没有任何一处 emit 它——于是「某人死亡时」这个时机在引擎里
    // 根本不存在。死亡结算本身可以继续留在 DeathSystem（那是状态变更），
    // 但**通知**必须是事件：奖惩、连环、遗计这些规则都该挂在它上面，
    // 而不是被硬编码进 `handleDeath`。
    await this.emit({
      name: 'die',
      source: killer,
      targets: [player],
      data: { deadPlayer: player, killer },
    })

    return false
  }

  /**
   * 触发子事件 — 通用的事件发射方法。
   *
   * 这是 effect 触发任意子事件的通用入口。
   * 不需要为每种事件类型都新增专用方法——用 emit() 即可。
   *
   * 用法示例（触发濒死）:
   * ```ts
   * await ctx.emit({
   *   name: 'dying',
   *   targets: [target],
   *   data: { dyingPlayer: target },
   * })
   * ```
   *
   * 自动完成三件事：
   * 1. 创建 GameEvent（继承当前 phase/round/turn）
   * 2. 挂载 EffectContext（让子事件的效果钩子也能工作）
   * 3. dispatch 到 EventChain（自动推入 → 结算 → 弹出）
   */
  async emit(eventDef: {
    name: EventName
    source?: IPlayer
    targets?: IPlayer[]
    cards?: ICard[]
    data?: Record<string, unknown>
    forced?: boolean
    silent?: boolean
  }): Promise<void> {
    const event = new GameEvent({
      name: eventDef.name,
      source: eventDef.source ?? this.player,
      player: this.player,
      targets: eventDef.targets ?? [],
      cards: eventDef.cards ?? this.triggerCards,
      phase: this.game.currentPhase,
      round: this.game.currentRound,
      turn: this.player.seatIndex,
      forced: eventDef.forced ?? false,
      silent: eventDef.silent ?? false,
      data: eventDef.data ?? {},
    })

    await this.deps.eventDispatcher.dispatch(event, this.deps.eventChain)
  }

  /**
   * 请求玩家响应 — 暂停流水线，等待玩家决策。
   *
   * 内部使用 EventPauseManager 阻塞事件链推进，
   * 同时通过 decisionService 向外部（UI/AI）发起询问。
   *
   * 根据 options 中提供的字段自动路由：
   *   validCards   → 询问玩家选择卡牌（出闪/出桃）→ askForResponse
   *   validTargets → 询问玩家选择目标           → askForTarget
   *   都不提供     → 纯确认/取消询问
   *
   * 使用 finally 确保无论决策成功/失败都恢复流水线，
   * 防止回调永远不触发导致事件栈死锁。
   */
  async waitForResponse(prompt: string, options?: ResponseRequest): Promise<EffectResponse> {
    if (!this.deps.decisionService) {
      return { confirmed: false }
    }

    // 被询问者缺省为效果持有者；AOE / 决斗等场景会显式指定别人
    const responder = options?.player ?? this.player

    const pausePromise = this.deps.pauseManager.pause(
      this.event.id,
      prompt,
      options?.timeout,
    )

    const decisionPromise = (async () => {
      try {
        if (options?.validTargets && options.validTargets.length > 0) {
          const targets = await this.deps.decisionService!.askForTarget(
            responder,
            options.validTargets,
            prompt,
          )
          return { confirmed: targets.length > 0, targets }
        }

        if (options?.validCards && options.validCards.length > 0) {
          const card = await this.deps.decisionService!.askForResponse(
            responder,
            prompt,
            options.validCards,
            options.timeout,
          )
          return { confirmed: card !== null, card: card ?? undefined }
        }

        // 纯确认询问（无卡牌/目标）：传空数组走 askForResponse
        const card = await this.deps.decisionService!.askForResponse(
          responder,
          prompt,
          [],
          options?.timeout,
        )
        return { confirmed: card !== null }
      } finally {
        this.deps.pauseManager.resume(this.event.id)
      }
    })()

    // 暂停阻塞 → 等待 decisionService 调用 resume() → 解除阻塞
    await pausePromise
    return await decisionPromise
  }

  /**
   * 回复体力 — 目标回复指定点数的体力。
   */
  async recoverHp(target: IPlayer, amount: number): Promise<void> {
    const actualRecovered = this.deps.playerSystem.recoverHp(target, amount)
    this.game.addLog({
      id: this.game.nextLogId('heal'),
      round: this.game.currentRound,
      phase: this.game.currentPhase,
      // 占位符而不是姓名（欠账 D40）——这条日志进的是游戏状态，
      // 换皮表在展示层；写成姓名就成了「关羽回复了 2 点体力」，
      // 界面上换不掉。
      message: `${heroSlot(target.hero?.id ?? target.id)} 回复了 ${actualRecovered} 点体力`,
      level: LogLevel.Info,
      sourcePlayerId: this.player.id,
      targetPlayerIds: [target.id],
      // 结构化字段：让「一行字」能还原回「一次结算」
      eventName: this.event.name,
      num: actualRecovered,
    })
  }

  /**
   * 转移卡牌 — 将卡牌从当前玩家转移给目标玩家（顺手牵羊等）。
   */
  async transferCards(cards: ICard[], target: IPlayer): Promise<void> {
    for (const card of cards) {
      this.deps.cardSystem.transferCard(
        card,
        card.owner ?? this.player,
        target,
      )
    }
  }

  /**
   * 使用卡牌 — 以当前玩家的身份使用一张卡牌（借刀杀人等）。
   */
  async useCard(card: ICard, targets: IPlayer[]): Promise<void> {
    // 创建子 CardUse 事件
    const cardUseEvent = new GameEvent({
      name: 'useCard',
      source: this.player,
      player: this.player,
      targets,
      cards: [card],
      phase: this.game.currentPhase,
      round: this.game.currentRound,
      turn: this.player.seatIndex,
    })

    await this.deps.eventDispatcher.dispatch(
      cardUseEvent,
      this.deps.eventChain,
    )

    // 使用后进入弃牌堆
    this.deps.cardSystem.finishProcessing(card)
  }

  /**
   * 此刻可以「视作」打出的虚拟牌
   *
   * 出牌阶段由 `PhaseManager` 自己调同一个服务；这里是留给内容的作者——
   * 只有他知道自己在问「要不要出闪」，也只有他知道该问谁。
   */
  cardViews(query: CardViewQuery): ICardView[] {
    return this.deps.viewAs.getViews(query)
  }

  /**
   * 判定 — 从牌堆顶翻一张牌作为判定牌，判定结束后进入弃牌堆。
   */
  async judge(player: IPlayer): Promise<ICard> {
    const judgeCard = this.deps.deckManager.drawForJudge()
    if (!judgeCard) {
      throw new Error('EffectContext.judge: 牌堆已空，无法判定')
    }

    // 判定牌进入处理区（走 CardSystem，顺带同步 owner 与可见性）
    this.deps.cardSystem.moveToProcessing(judgeCard, player)

    // 创建判定事件
    const judgeEvent = new GameEvent({
      name: 'judge',
      source: player,
      player,
      targets: [player],
      cards: [judgeCard],
      phase: this.game.currentPhase,
      round: this.game.currentRound,
      turn: this.player.seatIndex,
      data: { [JUDGE_RESULT_CARD_KEY]: judgeCard },
    })

    await this.deps.eventDispatcher.dispatch(judgeEvent, this.deps.eventChain)

    // 结果读回来而不是用上面的局部变量：技能可以在改判时机上换掉它。
    // 键一律走共用的读写函数——两个判定发起方各抄一份字符串的那套，
    // 曾让改判改到延时牌头上去（D44）。
    const judged = judgeResultCardOf(judgeEvent) ?? judgeCard

    // 判定牌进入弃牌堆（此刻它可能已经不在处理区了——改判会挪它）
    this.deps.cardSystem.finishJudgeResult(judged)

    return judged
  }

  /**
   * 获得卡牌 — 将指定的卡牌移入目标玩家手牌区。
   */
  async obtainCards(target: IPlayer, cards: ICard[]): Promise<void> {
    for (const card of cards) {
      this.deps.cardSystem.obtainCard(card, target)
    }
  }

  /**
   * 装备卡牌 — 将指定的卡牌装备到效果持有者的装备区。
   */
  async equipCard(card: ICard): Promise<void> {
    this.deps.cardSystem.equipCard(card, this.player)
  }

  /**
   * 放置延时锦囊 — 将延时锦囊移入目标玩家的判定区。
   *
   * 延时锦囊使用时只做这一件事；判定与生效发生在目标的判定阶段。
   */
  async placeDelayedCard(card: ICard, target: IPlayer): Promise<void> {
    this.deps.cardSystem.placeJudgeCard(card, target)
  }

  /**
   * 修改体力上限。
   */
  async modifyMaxHp(target: IPlayer, delta: number): Promise<void> {
    this.deps.playerSystem.modifyMaxHp(target, delta)
  }

  // ── 标记（Phase 19：写入一律转交 PlayerSystem）──

  getMark(player: IPlayer, key: string): number {
    return this.deps.playerSystem.getMark(player, key)
  }

  setMark(player: IPlayer, key: string, value: number): void {
    this.deps.playerSystem.setMark(player, key, value)
  }

  addMark(player: IPlayer, key: string, delta = 1): number {
    return this.deps.playerSystem.addMark(player, key, delta)
  }

  clearMark(player: IPlayer, key: string): void {
    this.deps.playerSystem.clearMark(player, key)
  }

  markAttackUsed(): void {
    this.deps.playerSystem.markAttackUsed(this.player)
  }

  skipPhases(player: IPlayer, phases: GamePhase[]): void {
    this.deps.playerSystem.skipPhases(player, phases)
  }

  /**
   * 增删技能 —— 觉醒技获得新技能的那一句话
   *
   * 增删的目标可以是任何人（「令其获得『XX』」），因此留了 `target`
   * 而不是默认作用于自己。
   */
  async modifyEffects(
    target: IPlayer,
    addEffects?: string[],
    removeEffects?: string[],
  ): Promise<void> {
    for (const skillId of addEffects ?? []) {
      this.deps.skillRegistry.attach(target, skillId)
    }
    for (const skillId of removeEffects ?? []) {
      this.deps.skillRegistry.detach(target, skillId)
    }
  }

  /**
   * 觉醒 —— 目标永久获得一个技能
   *
   * 与 `modifyEffects(target, [id])` 只差「不可回退」：
   * 台账把它记成 permanent 且打上 `awakened`，
   * 于是装备对齐、临时技能到期都摘不掉它。
   */
  async awakenSkill(target: IPlayer, skillId: string): Promise<void> {
    this.deps.skillRegistry.awakenSkill(target, skillId)
  }

  /**
   * 一次性监听 —— 监听归属于**当前上下文的玩家**
   *
   * 内容里那句「下次摸牌后…」就写在这里。`whenOf()` 是引擎侧的入口，
   * 这里只补上「归属于谁」——`ctx.player`。
   */
  when(eventName: EventName): IWhenBuilder {
    return whenOf(this.player, eventName, this.deps.eventTrigger)
  }
}
