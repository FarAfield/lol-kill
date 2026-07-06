// ============================================================
// 联盟杀 · EffectContext — IEffectContext 实现
//
// 提供效果执行时的受限读写接口，作为引擎与效果逻辑之间的安全边界。
// 所有写操作最终都通过事件系统执行——效果不能直接修改 Player/Card 属性。
// EffectContext 由 EventDispatcher 在执行 CompiledHandler 时创建，不再通过 event.data 暗线传递。
// ============================================================

import {
  TriggerTiming,
  ZoneType,
  DamageType,
  GamePhase,
} from '@core/contracts/enums'
import type { IEffectContext, ResponseRequest, EffectResponse } from '@core/contracts/effect.interface'
import type { IGameEvent } from '@core/contracts/event.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { GameEvent } from '@core/event/game-event'
import { DamageSystem } from '@core/system/damage-system'
import type { EffectContextDeps } from '@core/contracts/effect-context-deps'

/**
 * EffectContext — 效果执行上下文
 *
 * 实现 IEffectContext 的所有受限写入方法。
 * 每个方法内部通过创建和分发事件来执行操作。
 */
export class EffectContext implements IEffectContext {
  readonly event: IGameEvent
  readonly player: IPlayer
  readonly game: IGameState
  readonly triggerCards: ICard[]
  readonly damageEvent?: IGameEvent

  private deps: EffectContextDeps

  constructor(
    event: IGameEvent,
    player: IPlayer,
    triggerCards: ICard[],
    deps: EffectContextDeps,
    damageEvent?: IGameEvent,
  ) {
    this.event = event
    this.player = player
    this.game = deps.state
    this.triggerCards = triggerCards
    this.deps = deps
    this.damageEvent = damageEvent
  }

  // ── 受限写入操作 ──

  /**
   * 摸牌 — 从牌堆顶部抽取指定数量的卡牌加入手牌。
   */
  async drawCards(count: number): Promise<ICard[]> {
    const drawn = this.deps.deckManager.draw(count)
    for (const card of drawn) {
      card.zone = ZoneType.Hand
      ;(card as { owner?: IPlayer }).owner = this.player
    }
    this.player.handCards.push(...drawn)
    return drawn
  }

  /**
   * 弃置卡牌 — 将指定卡牌从当前区域移入弃牌堆。
   */
  async discardCards(cards: ICard[]): Promise<void> {
    for (const card of cards) {
      // Use the card's actual owner for ownership validation
      const cardOwner = card.owner ?? this.player
      this.deps.cardSystem.discardCard(card, cardOwner)
    }
  }

  /**
   * 造成伤害 — 对目标造成指定点数的伤害。
   *
   * 创建 Damage 事件并通过 EventDispatcher 分发。
   * 伤害会经过完整的伤害流水线（Before → Prevent → Modify → Apply → After → Complete）。
   */
  async damageTarget(target: IPlayer, amount: number): Promise<void> {
    const card = this.triggerCards[0]
    const damageType = card
      ? DamageSystem.getDamageTypeFromCard(card)
      : DamageType.Normal

    const damageEvent = new GameEvent({
      name: `伤害: ${this.player.hero?.name ?? this.player.id} → ${target.hero?.name ?? target.id}`,
      type: TriggerTiming.Damage,
      source: this.player,
      player: this.player,
      targets: [target],
      cards: this.triggerCards,
      phase: this.game.currentPhase,
      round: this.game.currentRound,
      turn: this.player.seatIndex,
      data: {
        damageAmount: amount,
        damageType,
        damageCard: card,
      },
    })

    // 创建伤害实例并执行流水线
    const damageInstance = this.deps.damageSystem.createDamage(
      this.player,
      target,
      amount,
      damageType,
      card,
    )

    // 将伤害实例挂载到事件数据中
    damageEvent.data['_damageInstance'] = damageInstance

    // 执行伤害流水线
    await this.deps.damageSystem.executePipeline(damageInstance)

    await this.deps.eventDispatcher.dispatch(damageEvent, this.deps.eventChain)

    // 检查目标是否濒死
    if (this.deps.deathSystem.checkDying(target)) {
      await this.emit({
        name: `濒死: ${target.hero?.name ?? target.id}`,
        type: TriggerTiming.PlayerDying,
        targets: [target],
        data: { dyingPlayer: target },
      })
    }
  }

  /**
   * 触发子事件 — 通用的事件发射方法。
   *
   * 这是 effect 触发任意子事件的通用入口。
   * 不需要为每种事件类型都新增专用方法——用 emit() 即可。
   *
   * 用法示例（触发 PlayerDying）:
   * ```ts
   * await ctx.emit({
   *   type: TriggerTiming.PlayerDying,
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
    type: TriggerTiming
    name?: string
    source?: IPlayer
    targets?: IPlayer[]
    cards?: ICard[]
    data?: Record<string, unknown>
    forced?: boolean
    silent?: boolean
  }): Promise<void> {
    const event = new GameEvent({
      name: eventDef.name ?? `${eventDef.type}`,
      type: eventDef.type,
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

    const pausePromise = this.deps.pauseManager.pause(
      prompt,
      options?.timeout,
    )

    const decisionPromise = (async () => {
      try {
        if (options?.validTargets && options.validTargets.length > 0) {
          const targets = await this.deps.decisionService!.askForTarget(
            this.player,
            options.validTargets,
            prompt,
          )
          return { confirmed: targets.length > 0, targets }
        }

        if (options?.validCards && options.validCards.length > 0) {
          const card = await this.deps.decisionService!.askForResponse(
            this.player,
            prompt,
            options.validCards,
            options.timeout,
          )
          return { confirmed: card !== null, card: card ?? undefined }
        }

        // 纯确认询问（无卡牌/目标）：传空数组走 askForResponse
        const card = await this.deps.decisionService!.askForResponse(
          this.player,
          prompt,
          [],
          options?.timeout,
        )
        return { confirmed: card !== null }
      } finally {
        this.deps.pauseManager.resume()
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
    const actualRecovered = target.recoverHp(amount)
    this.game.addLog({
      id: `heal_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      round: this.game.currentRound,
      phase: this.game.currentPhase,
      message: `${target.hero?.name ?? target.id} 回复了 ${actualRecovered} 点体力`,
      level: 1, // Info
      sourcePlayerId: this.player.id,
      targetPlayerIds: [target.id],
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
      name: `使用: ${card.name}`,
      type: TriggerTiming.CardUse,
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
   * 判定 — 从牌堆顶翻一张牌作为判定牌，判定结束后进入弃牌堆。
   */
  async judge(player: IPlayer): Promise<ICard> {
    const judgeCard = this.deps.deckManager.drawForJudge()
    if (!judgeCard) {
      throw new Error('EffectContext.judge: 牌堆已空，无法判定')
    }

    // 判定牌进入处理区
    judgeCard.zone = ZoneType.Processing
    this.game.processingCards.push(judgeCard)

    // 创建判定事件
    const judgeEvent = new GameEvent({
      name: `判定: ${player.hero?.name ?? player.id}`,
      type: TriggerTiming.Judge,
      source: player,
      player,
      targets: [player],
      cards: [judgeCard],
      phase: this.game.currentPhase,
      round: this.game.currentRound,
      turn: this.player.seatIndex,
      data: { judgeCard },
    })

    await this.deps.eventDispatcher.dispatch(judgeEvent, this.deps.eventChain)

    // 判定牌进入弃牌堆
    this.deps.cardSystem.finishProcessing(judgeCard)

    return judgeCard
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
   * 修改体力上限。
   */
  async modifyMaxHp(target: IPlayer, delta: number): Promise<void> {
    target.modifyMaxHp(delta)
  }

  /**
   * 修改效果 — 为目标玩家添加/移除技能效果（觉醒技等）。
   */
  async modifyEffects(
    target: IPlayer,
    addEffects?: string[],
    removeEffects?: string[],
  ): Promise<void> {
    // 效果修改通过 EventTrigger 的注册/注销完成
    // 此处仅记录意图，实际注册由调用方（如 SkillRegistry）处理
    // 标记效果变更供引擎处理
    if (addEffects && addEffects.length > 0) {
      target.setMark('_pendingAddEffects', addEffects.length)
    }
    if (removeEffects && removeEffects.length > 0) {
      target.setMark('_pendingRemoveEffects', removeEffects.length)
    }
  }
}
