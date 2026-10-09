// ============================================================
// 联盟杀 · PhaseManager — 回合阶段管理
//
// 管理单个玩家回合内的 6 个阶段：
//   准备 → 判定 → 摸牌 → 出牌 → 弃牌 → 结束
//
// 每个阶段通过事件系统触发，技能可以在各阶段挂载钩子。
// 阶段可以被跳过（乐不思蜀 → 跳过出牌阶段，兵粮寸断 → 跳过摸牌阶段）。
//
// 职责：
// - executeTurn()   — 执行当前玩家的完整回合
// - executePhase()  — 执行单个阶段
// - getNextPhase()  — 获取下一个阶段
// - 处理阶段跳过逻辑
// ============================================================

import { GamePhase, ZoneType } from '@core/contracts/enums'
import type { EventName } from '@core/contracts/event-name'
import { STANDARD_PHASE_ORDER, DEFAULT_DRAW_COUNT } from '@source/base/constants'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { GameEvent } from '@core/event/game-event'
import { EventChain } from '@core/event/event-chain'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { DeckManager } from '@core/system/deck-manager'
import { CardSystem } from '@core/system/card-system'
import { PlayerSystem } from '@core/system/player-system'
import { TargetSystem } from '@core/system/target-system'
import { CardBudget } from '@core/skill/card-budget'
import type { TurnManager } from './turn-manager'
import type { IUIDecisionService } from '@core/contracts/services.interface'
import type { IModQuery } from '@core/contracts/mod.interface'
import type { ICardView, ISkillRegistry, IViewAsService } from '@core/contracts/skill.interface'
import { viewsToCards } from '@core/skill/view-as'
import { CardTag } from '@core/contracts/card-tag'

/**
 * 阶段管理器配置选项
 */
export interface PhaseManagerOptions {
  /** 决策服务（用于玩家交互：出牌、弃牌、响应等） */
  decisionService?: IUIDecisionService
  /** 摸牌阶段摸牌数（默认 2） */
  drawCount?: number
  /**
   * Mod 查询口（可选）
   *
   * 有它时，「摸几张」「手牌上限多少」这些数值都由 Mod 说了算；
   * 没有则退回构造参数 / 体力的老办法（纯引擎单测常用）。
   */
  modQuery?: IModQuery
  /**
   * 出牌额度查询（可选）
   *
   * 「这张牌这一回合还能用几次」的唯一判定口（D8 形态甲）。
   * 缺席时一律放行——与 `modQuery` 缺席的约定一致。
   */
  cardBudget?: CardBudget
  /**
   * 技能台账 —— 回合 / 阶段边界上要清的两笔账都记在它那儿
   *
   * 「每回合一次」的额度与 `markClear: 'turnEnd'` 的标记。
   * 走台账而不是直接摸 EventTrigger，是为了让**技能的运行时状态**
   * 只有一个入口：要清零就找台账，不必知道它底下是谁在记账。
   */
  skillRegistry: ISkillRegistry
  /**
   * 视作服务（可选）
   *
   * 出牌阶段要把它造出来的虚拟牌列进候选：
   * 「红色牌可以当杀」如果在这里看不见，关羽就永远出不了那一刀。
   * 没有它的纯引擎单测就退回「只有手牌」。
   */
  viewAs?: IViewAsService
  /**
   * 玩家状态系统（Phase 19）
   *
   * 出牌阶段要记「本回合用过了杀」，那是玩家状态——以前直接写
   * `player.usedAttackThisTurn = true`，绕过了唯一的写入口。
   */
  playerSystem?: PlayerSystem
}

/**
 * 阶段管理器
 *
 * 负责推动一个玩家回合内的阶段流转。
 * 每个阶段通过事件系统分发，技能可以在对应阶段触发。
 */
export class PhaseManager {
  private decisionService?: IUIDecisionService
  private drawCount: number
  private cardSystem: CardSystem
  private modQuery?: IModQuery
  private cardBudget?: CardBudget
  private skillRegistry: ISkillRegistry
  private viewAs?: IViewAsService
  private playerSystem: PlayerSystem

  constructor(
    private state: GameStateSnapshot,
    private eventDispatcher: EventDispatcher,
    private eventChain: EventChain,
    private deckManager: DeckManager,
    private turnManager: TurnManager,
    cardSystem: CardSystem,
    options: PhaseManagerOptions,
  ) {
    this.decisionService = options.decisionService
    this.drawCount = options.drawCount ?? DEFAULT_DRAW_COUNT
    this.cardSystem = cardSystem
    this.modQuery = options.modQuery
    this.cardBudget = options.cardBudget
    this.skillRegistry = options.skillRegistry
    this.viewAs = options.viewAs
    // 缺省自建一份：PlayerSystem 是无状态的，多建一份不会不一致
    this.playerSystem = options.playerSystem ?? new PlayerSystem()
  }

  // ── 完整回合执行 ──

  /**
   * 执行当前玩家的完整回合。
   *
   * 按顺序执行 6 个阶段：准备 → 判定 → 摸牌 → 出牌 → 弃牌 → 结束。
   * 被标记为跳过的阶段会被自动跳过。
   *
   * 流程：
   * 1. 触发 TurnStart 事件
   * 2. 依次执行各阶段
   * 3. 触发 TurnEnd 事件
   *
   * @returns 回合是否正常完成（未因死亡/游戏结束中断）
   */
  async executeTurn(): Promise<boolean> {
    const player = this.turnManager.getCurrentPlayer()
    if (!player || !player.alive) return false

    // ── 新回合：清掉「每回合一次」类技能的额度 ──
    // 不清的话 `oncePerTurn` 实际等价于 `once`（整局一次）。
    this.skillRegistry.resetFrequency('turn')

    // ── 触发 TurnStart 事件 ──
    const turnStartEvent = new GameEvent({
      name: 'turnStart',
      source: player,
      player,
      phase: GamePhase.PhasePre,
      round: this.state.currentRound,
      turn: player.seatIndex,
    })

    await this.eventDispatcher.dispatch(turnStartEvent, this.eventChain)
    if (!player.alive) return false

    // ── 按顺序执行各阶段 ──
    for (const phase of STANDARD_PHASE_ORDER) {
      // 检查玩家是否在回合中死亡
      if (!player.alive) return false

      // 检查游戏是否已结束
      if (this.state.finished) return false

      // 检查是否跳过此阶段
      //
      // `mod.phaseSkippable` 返回 false = 此阶段不可被跳过，
      // 即使身上带着跳过标记（乐不思蜀之类）也必须照常执行。
      if (
        player.shouldSkipPhases.includes(phase) &&
        (this.modQuery?.phaseSkippable(player, phase) ?? true)
      ) {
        this.playerSystem.markPhaseSkipped(player, phase)
        continue
      }

      // 执行阶段
      this.state.currentPhase = phase
      const phaseCompleted = await this.executePhase(phase, player)
      if (!phaseCompleted) return false
    }

    // ── 触发 TurnEnd 事件 ──
    const turnEndEvent = new GameEvent({
      name: 'turnEnd',
      source: player,
      player,
      phase: GamePhase.PhasePost,
      round: this.state.currentRound,
      turn: player.seatIndex,
    })
    await this.eventDispatcher.dispatch(turnEndEvent, this.eventChain)

    // 回合末：清掉声明了 `markClear: 'turnEnd'` 的技能标记。
    // 放在 turnEnd 事件**之后**——技能要能在自己的回合末读到标记。
    this.skillRegistry.clearMarks(player, 'turnEnd')

    return true
  }

  /**
   * 执行单个阶段。
   *
   * @param phase  要执行的阶段
   * @param player 当前玩家
   * @returns 阶段是否完成（false = 被中断）
   */
  async executePhase(phase: GamePhase, player: IPlayer): Promise<boolean> {
    // 新阶段：清掉「每阶段一次」类技能的额度
    this.skillRegistry.resetFrequency('phase')

    // 创建阶段事件
    const phaseEvent = this.createPhaseEvent(phase, player)

    // 分发事件（技能可在各流水线阶段挂载钩子）
    await this.eventDispatcher.dispatch(phaseEvent, this.eventChain)

    // 如果玩家在阶段中死亡，中断
    if (!player.alive) return false

    // 执行阶段核心逻辑
    switch (phase) {
      case GamePhase.PhasePre:
        return await this.doPhasePre(player)
      case GamePhase.PhaseJudge:
        return await this.doPhaseJudge(player)
      case GamePhase.PhaseDraw:
        return await this.doPhaseDraw(player)
      case GamePhase.PhaseUse:
        return await this.doPhaseUse(player)
      case GamePhase.PhaseDiscard:
        return await this.doPhaseDiscard(player)
      case GamePhase.PhasePost:
        return await this.doPhasePost(player)
      default:
        return true
    }
  }

  // ── 各阶段核心逻辑 ──

  /**
   * 准备阶段 (PhasePre)
   *
   * 三国杀标准规则：
   * - 准备阶段通常没有自动执行的逻辑
   * - 技能可在此时机触发（如"准备阶段开始时，你可以..."）
   * - 部分延时效果在此阶段结算
   */
  private async doPhasePre(_player: IPlayer): Promise<boolean> {
    // 准备阶段主要作为技能触发点，核心逻辑由事件钩子处理
    return true
  }

  /**
   * 判定阶段 (PhaseJudge)
   *
   * 处理玩家判定区的延时锦囊（闪电、乐不思蜀、兵粮寸断）。
   * 判定区卡牌按 LIFO（后进先出）顺序依次判定。
   *
   * 判定流程：
   * 1. 从判定区取出一张牌（栈顶）
   * 2. 翻开牌堆顶牌进行判定
   * 3. 根据判定结果决定卡牌是否生效
   * 4. 判定牌进入弃牌堆
   */
  private async doPhaseJudge(player: IPlayer): Promise<boolean> {
    // 按 LIFO 顺序处理判定区（后放置的先判定）
    // 判定区按 LIFO 处理（后放置的先判定），栈顶 = 数组末尾
    while (player.judgeCards.length > 0) {
      if (!player.alive) return false

      // 只是**看**一眼栈顶，不在这里 pop：
      // 摘牌是 `CardSystem.finishJudge` 的事——它顺带改 zone / owner /
      // 可见性。手工 pop 只动数组，牌自己还以为在判定区里。
      const judgeCard = player.judgeCards[player.judgeCards.length - 1]
      if (!judgeCard) break

      // 从牌堆顶部抽判定牌
      const judgeResultCard = this.deckManager.drawForJudge()
      if (!judgeResultCard) break

      // 创建判定事件
      const judgeEvent = new GameEvent({
        name: 'judge',
        source: player,
        player,
        targets: [player],
        cards: [judgeCard, judgeResultCard],
        phase: GamePhase.PhaseJudge,
        round: this.state.currentRound,
        turn: player.seatIndex,
        data: {
          judgeCard,
          judgeResultCard,
        },
      })

      await this.eventDispatcher.dispatch(judgeEvent, this.eventChain)

      // ── 以延时牌自己的 id 触发一次子事件（D15 的接线）──
      //
      // 与普通牌「以卡牌 id 找内容」完全是同一套路，只是发起方从
      // `useCardContent` 换成了判定阶段——延时牌本来就该等到这一刻才结算。
      // 缺了这一步，内容注册表里那三个名字（`leBuSiShu` / `bingLiangCunDuan` /
      // `shanDian`）就永远没有人叫，于是延时锦囊表现为「进判定区后静默消失」。
      //
      // 技能可以在 `judgeBegin` 上换掉 `data.judgeResultCard`（改判，如【鬼才】），
      // 因此这里必须读事件的终值，而不是上面那个局部变量。
      const judged = (judgeEvent.data['judgeResultCard'] as ICard | undefined) ?? judgeResultCard

      // ── 延时牌先离开判定区、进处理区 ──
      //
      // 它正在被结算，不再是「挂在判定区等待」的状态。这一步顺带让
      // 闪电的内容能把它放到下家判定区——`placeJudgeCard` 只收
      // Hand / Processing，留在 Judge 区会直接抛错。
      this.cardSystem.moveToProcessing(judgeCard, player)

      if (!judgeEvent.cancelled) {
        // 这里必须自己建事件再 `dispatch`，不能写 `judgeEvent.trigger(...)`：
        // `trigger` 要求事件当前正挂在调度器上（runner 未解绑），而
        // `dispatch` 的 `finally` 块会在结算完就把 runner 摘掉——
        // 上面的 `await` 已经让 judge 走完了。等价写法是「建子事件 +
        // 认父 + 派发」，正是 `trigger` 内部做的三件事。
        const delayedEvent = new GameEvent({
          name: judgeCard.id as EventName,
          source: player,
          player,
          targets: [player],
          cards: [judgeCard, judged],
          parent: judgeEvent,
          phase: GamePhase.PhaseJudge,
          round: this.state.currentRound,
          turn: player.seatIndex,
          data: { judgeCard, judgeResultCard: judged },
        })
        judgeEvent.addChild(delayedEvent)
        await this.eventDispatcher.dispatch(delayedEvent, this.eventChain)
      }

      // 判定结果牌收尾。三种来路：
      //   1. 正常翻出来的 —— 此刻在处理区；
      //   2. 被改判顶掉的原始那张 —— 也还在处理区；
      //   3. 改判顶上来的那张 —— 它来自手牌，必须走 `discardCard`
      //      （而不是只改 zone），否则它会留在 `handCards` 里，
      //      弃牌阶段再扫一遍就会撞上「弃牌堆里的牌不能再弃」。
      // 判「是谁的手牌」用扫 players 而不是读 `judged.owner`：
      // 手牌的 owner 一般是设好的，但这里要的是**它在谁的 handCards 里**——
      // 只有这个事实决定了它该从哪个数组里被摘掉。
      const judgedHolder = this.state.players.find((p) => p.handCards.includes(judged))
      if (judged.zone === ZoneType.Processing) {
        this.cardSystem.finishProcessing(judged)
      } else if (judgedHolder) {
        this.cardSystem.discardCard(judged, judgedHolder)
      } else {
        this.cardSystem.moveToDiscard(judged)
      }

      // 被改判顶掉的那张（如果有）：它还留在处理区。
      const replaced = judgeResultCard !== judged && judgeResultCard.zone === ZoneType.Processing
      if (replaced) this.cardSystem.finishProcessing(judgeResultCard)

      // 延时锦囊本身：内容没挪走它（乐 / 兵）→ 进弃牌堆；
      // 内容挪走了它（闪电传给下家）→ 它此刻在下家的判定区，不能动。
      if (judgeCard.zone !== ZoneType.Judge) {
        this.cardSystem.moveToDiscard(judgeCard)
      }

      if (!player.alive) return false
    }

    return true
  }

  /**
   * 摸牌阶段 (PhaseDraw)
   *
   * 从牌堆顶部摸取固定数量的卡牌。
   * 默认 2 张，可被技能修改（如周瑜的"英姿"摸 3 张）。
   *
   * 如果被兵粮寸断跳过，此阶段不会执行。
   */
  private async doPhaseDraw(player: IPlayer): Promise<boolean> {
    // 摸牌数是规则数值 → 走 Mod（英姿摸 3 张这类技能将来就注册在这里）
    const count = this.modQuery
      ? this.modQuery.drawCount(player)
      : this.drawCount

    const drawnCards = this.deckManager.draw(count)

    // 走 CardSystem 而不是自己 push：可见性要跟着改成「仅本人可见」。
    // 牌在牌堆里是「谁都看不见」，直接改 zone 不动 visibleTo 的话，
    // UI 上刚摸的牌对别人仍然是隐藏的——反过来写就成了明牌。
    this.cardSystem.obtainCards(drawnCards, player)

    return true
  }

  /**
   * 出牌阶段 (PhaseUse)
   *
   * 玩家可以主动使用手牌的主要阶段。
   *
   * 此阶段需要玩家交互（出牌、使用技能等），
   * 通过 IUIDecisionService 获取玩家决策。
   *
   * 玩家可以选择：
   * - 使用手牌（杀、锦囊、装备等）
   * - 发动主动技能
   * - 结束出牌阶段
   *
   * 限制：
   * - 默认每回合只能使用一张杀（诸葛连弩等可提升上限）
   *   次数由 `mod.cardUsable` 决定，见 `getPlayableCards`
   * - 部分卡牌有使用时机限制
   */
  private async doPhaseUse(player: IPlayer): Promise<boolean> {
    // 出牌阶段需要玩家交互
    // 如果有决策服务，循环询问玩家操作直到主动结束
    if (this.decisionService) {
      let phaseEnded = false
      // 按**卡牌 id** 记本回合已用次数（不是实例 id——同名牌共享额度）
      const usedThisTurn = new Map<string, number>()

      while (!phaseEnded && player.alive) {
        // 获取玩家可用的卡牌选项
        const playableCards = this.getPlayableCards(player, usedThisTurn)

        if (playableCards.length === 0) {
          // 无可出之牌，自动结束出牌阶段
          break
        }

        // 询问玩家出牌决策
        try {
          // 目标数与合法目标同一处算出，一并递给决策方——
          // 让每个 UI / AI 自己去猜「取几个」必然猜错（AOE 是 0，
          // 借刀杀人是 2），而引擎那道目标校验只认真正的规则。
          const options = playableCards.map((card) => ({
            card,
            validTargets: this.getValidTargetsForCard(player, card),
            minTargets: TargetSystem.getMinTargets(card),
            maxTargets: TargetSystem.getMaxTargets(card, player, this.modQuery),
          }))

          const result = await this.decisionService.askForCardPlay(
            player,
            options,
          )

          if (result === null) {
            // 玩家选择结束出牌阶段
            phaseEnded = true
            break
          }

          // 执行完整出牌流程：移入处理区 → 事件分发 → 结算完成
          this.cardSystem.useCard(result.card, player)

          const cardUseEvent = new GameEvent({
            name: 'useCard',
            source: player,
            player,
            targets: result.targets,
            cards: [result.card],
            phase: GamePhase.PhaseUse,
            round: this.state.currentRound,
            turn: player.seatIndex,
          })

          await this.eventDispatcher.dispatch(cardUseEvent, this.eventChain)

          usedThisTurn.set(
            cardUsageKey(result.card),
            (usedThisTurn.get(cardUsageKey(result.card)) ?? 0) + 1,
          )

          this.cardSystem.finishProcessing(result.card)

          // 标记攻击（杀、万箭等）
          if (result.card.tags.has(CardTag.Strike)) {
            this.playerSystem.markAttackUsed(player)
          }
        } catch {
          // 决策服务不可用时，自动结束出牌阶段
          phaseEnded = true
        }
      }
    }

    return true
  }

  /**
   * 弃牌阶段 (PhaseDiscard)
   *
   * 三国杀核心规则：
   * - 手牌数 > 当前体力值时，必须弃置多余的牌
   * - 手牌上限 = 当前体力值（HP）
   * - 若手牌数 ≤ 体力值，此阶段无事发生
   *
   * 玩家选择要弃置的牌（通过 IUIDecisionService）。
   */
  private async doPhaseDiscard(player: IPlayer): Promise<boolean> {
    const handSize = player.handCards.length
    // 手牌上限默认等于体力，「不受手牌上限影响」「上限 +2」这类由 Mod 决定
    const handLimit = this.modQuery
      ? this.modQuery.maxHandcard(player)
      : player.hp

    if (handSize <= handLimit) {
      return true // 无需弃牌
    }

    const discardCount = handSize - handLimit

    // 不可被弃置的牌（`mod.cardDiscardable`）既不出现在选项里，
    // 也不会被自动弃牌挑中——「弃不掉」必须真的弃不掉。
    const discardable = player.handCards.filter(
      (card) => this.modQuery?.cardDiscardable(player, card) ?? true,
    )
    const actualCount = Math.min(discardCount, discardable.length)

    // 如果有决策服务，询问玩家选择弃哪些牌
    if (this.decisionService && actualCount > 0) {
      try {
        const cardsToDiscard = await this.decisionService.askForDiscard(
          player,
          actualCount,
          [...discardable],
        )

        // 弃置玩家选择的牌。
        // `CardSystem.discardCard` 自己会把手牌摘掉并推进弃牌堆——
        // 以前这里先 splice 再 `deckManager.discardOne`，牌的 `owner`
        // 因此一直留在身上（「已弃置的牌还属于我」）。
        for (const card of cardsToDiscard) {
          this.cardSystem.discardCard(card, player)
        }
      } catch {
        // 决策失败时自动弃置最前面的牌
        this.autoDiscard(player, actualCount)
      }
    } else {
      // 无决策服务时，自动弃置排序最前的牌（简化处理）
      this.autoDiscard(player, actualCount)
    }

    return true
  }

  /**
   * 结束阶段 (PhasePost)
   *
   * 回合结束时的清理工作：
   * - 清除回合内标记（usedAttackThisTurn 等）
   * - 处理"回合结束时"类技能（如"回合结束时，你可以..."）
   *
   * 注意：resetTurnState() 在 TurnManager.nextTurn() 中调用，
   * 此处仅处理结束阶段的技能触发。
   */
  private async doPhasePost(_player: IPlayer): Promise<boolean> {
    // 结束阶段主要作为技能触发点
    // 阶段事件已在 executePhase 中分发
    return true
  }

  // ── 工具方法 ──

  /**
   * 创建阶段事件。
   */
  private createPhaseEvent(phase: GamePhase, player: IPlayer) {
    /** 阶段 → 事件主体（阶段后缀由流水线派生：phaseUse + Begin → phaseUseBegin） */
    const eventMap: Partial<Record<GamePhase, EventName>> = {
      [GamePhase.PhasePre]: 'phasePre',
      [GamePhase.PhaseJudge]: 'phaseJudge',
      [GamePhase.PhaseDraw]: 'phaseDraw',
      [GamePhase.PhaseUse]: 'phaseUse',
      [GamePhase.PhaseDiscard]: 'phaseDiscard',
      [GamePhase.PhasePost]: 'phasePost',
    }

    return new GameEvent({
      name: eventMap[phase] ?? 'phasePre',
      source: player,
      player,
      targets: [player],
      phase,
      round: this.state.currentRound,
      turn: player.seatIndex,
    })
  }

  /**
   * 自动弃牌（无决策服务时的简化处理）。
   *
   * 弃置排序最靠前的牌（通常是手牌数组前面的牌）。
   */
  private autoDiscard(player: IPlayer, count: number): void {
    // 同样要避开不可弃置的牌，否则「弃不掉」会在无 UI 时被悄悄绕过
    const pool = player.handCards.filter(
      (card) => this.modQuery?.cardDiscardable(player, card) ?? true,
    )

    // 先挑够数量，再逐张走 CardSystem——不能边遍历边 splice，
    // 也不能自己 splice：摘牌是 CardSystem 的事（zone / owner / 可见性一起改）
    const toDiscard = pool.slice(0, count)
    for (const card of toDiscard) {
      this.cardSystem.discardCard(card, player)
    }
  }

  /**
   * 获取某张卡牌的合法目标列表。
   *
   * 早先这里是一份**按牌型 if-else 堆出来的副本**，与 `TargetSystem`
   * 各写各的规则，还带着一句「简化处理，不计算距离」——于是【杀】能
   * 指向场上任何活人，武器加的攻击范围一张也派不上用场（欠账 D3 / D4）。
   *
   * 现在直接问 `TargetSystem`：目标规则只有一处，`modQuery` 作为
   * `DistanceMods & TargetMods` 一起传进去，于是距离、攻击范围、
   * 「这人能不能被选」三层判断都在那边一次性收口。
   */
  private getValidTargetsForCard(player: IPlayer, card: ICard): IPlayer[] {
    return TargetSystem.getAvailableTargets(player, card, this.state, this.modQuery)
  }

  /**
   * 获取当前玩家可用的卡牌选项
   *
   * 三部分凑齐才算「此刻能打」：
   * 1. 牌的类别（基本 / 锦囊 / 装备都能在出牌阶段用）
   * 2. **这张牌此刻是否被允许** —— `mod.cardEnabled`（「你不能使用或打出【闪】」）
   * 3. **本回合的次数额度** —— `mod.cardUsable`（杀默认 1 次，连弩无限）
   *
   * 额度上限限制统一走 Mod：设备及技能都只是同一个数字的不同来源，
   * 不再各自去写 `player.attackLimit = Infinity` 这种散落的标记。
   *
   * 手上没有的东西也算：视作技能造出来的虚拟牌与真实手牌排在同一个
   * 候选列表里，UI 与 AI 因此不必区分「这是一张牌」还是「这是一次视作」。
   */
  private getPlayableCards(
    player: IPlayer,
    usedThisTurn: Map<string, number>,
  ): ICard[] {
    const views = this.cardViewsFor(player)
    const candidates = [
      ...player.handCards,
      ...viewsToCards(views),
    ]

    return candidates
      .filter((card) => this.isPlayableType(card))
      // 被禁的牌根本不进选项（清单 #10）
      .filter((card) => this.modQuery?.cardEnabled(player, card) ?? true)
      // 次数额度：已达上限的牌不再出现在选项里
      //
      // 判定只有 `CardBudget.canPlay` 一处（D8 形态甲）。以前这里自己
      // 写了一遍 `used < mod.cardUsable`，AI 与 UI 却各问各的——同一个
      // 问题三个答案。现在三方调的是同一个方法。
      .filter((card) => this.cardBudget?.canPlay(player, card, usedThisTurn) ?? true)
  }

  /** 出牌阶段这张牌属于可以主动打出的类别 */
  private isPlayableType(card: ICard): boolean {
    return card.type === 'basic' || card.type === 'rune' || card.type === 'equip'
  }

  /**
   * 出牌阶段的候选视作
   *
   * 每次都重新问一趟：虚拟牌不是握在手里的东西，它的价值全在于
   * 「此刻这些技能的额度还剩多少、哪些牌还在手上」。缓存它等于
   * 缓存一个几分钟前就该失效的答案。
   */
  private cardViewsFor(player: IPlayer): ICardView[] {
    if (!this.viewAs) return []
    return this.viewAs.getViews({ player, usage: GamePhase.PhaseUse })
  }

  /**
   * 获取下一个阶段。
   *
   * @param current 当前阶段
   * @returns 下一个阶段，如果是最后一个阶段则返回 null
   */
  getNextPhase(current: GamePhase): GamePhase | null {
    const idx = STANDARD_PHASE_ORDER.indexOf(current)
    if (idx === -1 || idx >= STANDARD_PHASE_ORDER.length - 1) return null
    return STANDARD_PHASE_ORDER[idx + 1]!
  }

/**
 * 更新决策服务（用于游戏运行中切换）。
 */
setDecisionService(service: IUIDecisionService): void {
  this.decisionService = service
}
}

/**
 * 出牌额度的记账键 —— 按「这张牌当什么用」记，而不是「这张牌叫什么」
 *
 * 真杀的额度是共享的：一回合只能用一张杀，说的是「用杀这件事」一次，
 * 而不是「每张名叫杀的牌」各一次。因此所有同名的杀记在同一个键上。
 *
 * 更关键的是**虚拟杀必须落在同一个键上**：武圣用一张红牌当的杀如果
 * 按底牌 id 记账，那么每张红牌都自带一次「出杀」的额度——
 * 「每回合一张杀」这条规则会在技能面前整体失效。
 */
export function cardUsageKey(card: ICard): string {
  if (card.tags.has(CardTag.Strike)) return CardTag.Strike
  return card.id
}
