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

import { GamePhase, TriggerTiming, ZoneType } from '@core/contracts/enums'
import { STANDARD_PHASE_ORDER, DEFAULT_DRAW_COUNT } from '@source/base/constants'
import type { IGameState } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { GameEvent } from '@core/event/game-event'
import { EventChain } from '@core/event/event-chain'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { DeckManager } from '@core/system/deck-manager'
import { CardSystem } from '@core/system/card-system'
import type { TurnManager } from './turn-manager'
import type { IUIDecisionService } from '@core/contracts/services.interface'

/**
 * 阶段管理器配置选项
 */
export interface PhaseManagerOptions {
  /** 决策服务（用于玩家交互：出牌、弃牌、响应等） */
  decisionService?: IUIDecisionService
  /** 摸牌阶段摸牌数（默认 2） */
  drawCount?: number
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

  constructor(
    private state: IGameState,
    private eventDispatcher: EventDispatcher,
    private eventChain: EventChain,
    private deckManager: DeckManager,
    private turnManager: TurnManager,
    cardSystem: CardSystem,
    options?: PhaseManagerOptions,
  ) {
    this.decisionService = options?.decisionService
    this.drawCount = options?.drawCount ?? DEFAULT_DRAW_COUNT
    this.cardSystem = cardSystem
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

    // ── 触发 TurnStart 事件 ──
    const turnStartEvent = new GameEvent({
      name: '回合开始',
      type: TriggerTiming.TurnStart,
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
      if (player.shouldSkipPhases.includes(phase)) {
        player.skippedPhases.push(phase)
        continue
      }

      // 执行阶段
      this.state.currentPhase = phase
      const phaseCompleted = await this.executePhase(phase, player)
      if (!phaseCompleted) return false
    }

    // ── 触发 TurnEnd 事件 ──
    const turnEndEvent = new GameEvent({
      name: '回合结束',
      type: TriggerTiming.TurnEnd,
      source: player,
      player,
      phase: GamePhase.PhasePost,
      round: this.state.currentRound,
      turn: player.seatIndex,
    })
    await this.eventDispatcher.dispatch(turnEndEvent, this.eventChain)

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
  private async doPhasePre(player: IPlayer): Promise<boolean> {
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
    while (player.judgeCards.length > 0) {
      if (!player.alive) return false

      const judgeCard = player.judgeCards.pop()!
      if (!judgeCard) break

      // 从牌堆顶部抽判定牌
      const judgeResultCard = this.deckManager.drawForJudge()
      if (!judgeResultCard) break

      // 创建判定事件
      const judgeEvent = new GameEvent({
        name: `判定: ${judgeCard.name}`,
        type: TriggerTiming.Judge,
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

      // 判定牌进入弃牌堆
      judgeResultCard.zone = ZoneType.Discard
      this.state.discardPile.push(judgeResultCard)

      // 延时锦囊也进入弃牌堆
      judgeCard.zone = ZoneType.Discard
      this.state.discardPile.push(judgeCard)

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
    const drawnCards = this.deckManager.draw(this.drawCount)

    // 将抽到的牌加入手牌
    for (const card of drawnCards) {
      card.zone = ZoneType.Hand
      if (!card.owner) {
        ;(card as { owner?: IPlayer }).owner = player
      }
    }
    player.handCards.push(...drawnCards)

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
   * - 部分卡牌有使用时机限制
   */
  private async doPhaseUse(player: IPlayer): Promise<boolean> {
    // 出牌阶段需要玩家交互
    // 如果有决策服务，循环询问玩家操作直到主动结束
    if (this.decisionService) {
      let phaseEnded = false

      while (!phaseEnded && player.alive) {
        // 获取玩家可用的卡牌选项
        const playableCards = this.getPlayableCards(player)

        if (playableCards.length === 0) {
          // 无可出之牌，自动结束出牌阶段
          break
        }

        // 询问玩家出牌决策
        try {
          const options = playableCards.map((card) => ({
            card,
            validTargets: this.getValidTargetsForCard(player, card),
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
          this.cardSystem.useCard(result.card, player, result.targets)

          const cardUseEvent = new GameEvent({
            name: `使用: ${result.card.name}`,
            type: TriggerTiming.CardUse,
            source: player,
            player,
            targets: result.targets,
            cards: [result.card],
            phase: GamePhase.PhaseUse,
            round: this.state.currentRound,
            turn: player.seatIndex,
          })

          await this.eventDispatcher.dispatch(cardUseEvent, this.eventChain)

          this.cardSystem.finishProcessing(result.card)

          // 标记攻击（杀、万箭等）
          if (result.card.tags.has('sha')) {
            player.usedAttackThisTurn = true
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
    const handLimit = player.hp

    if (handSize <= handLimit) {
      return true // 无需弃牌
    }

    const discardCount = handSize - handLimit

    // 如果有决策服务，询问玩家选择弃哪些牌
    if (this.decisionService) {
      try {
        const cardsToDiscard = await this.decisionService.askForDiscard(
          player,
          discardCount,
          [...player.handCards],
        )

        // 弃置玩家选择的牌
        for (const card of cardsToDiscard) {
          // 从手牌移除
          const idx = player.handCards.findIndex((c) => c.id === card.id)
          if (idx !== -1) {
            player.handCards.splice(idx, 1)
          }
          // 放入弃牌堆
          this.deckManager.discardOne(card)
        }
      } catch {
        // 决策失败时自动弃置最前面的牌
        this.autoDiscard(player, discardCount)
      }
    } else {
      // 无决策服务时，自动弃置排序最前的牌（简化处理）
      this.autoDiscard(player, discardCount)
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
    const timingMap: Partial<Record<GamePhase, TriggerTiming>> = {
      [GamePhase.PhasePre]: TriggerTiming.PhasePre,
      [GamePhase.PhaseJudge]: TriggerTiming.PhaseJudge,
      [GamePhase.PhaseDraw]: TriggerTiming.PhaseDraw,
      [GamePhase.PhaseUse]: TriggerTiming.PhaseUse,
      [GamePhase.PhaseDiscard]: TriggerTiming.PhaseDiscard,
      [GamePhase.PhasePost]: TriggerTiming.PhasePost,
    }

    const timing = timingMap[phase] ?? TriggerTiming.PhasePre
    const phaseNames: Record<string, string> = {
      [GamePhase.PhasePre]: '准备阶段',
      [GamePhase.PhaseJudge]: '判定阶段',
      [GamePhase.PhaseDraw]: '摸牌阶段',
      [GamePhase.PhaseUse]: '出牌阶段',
      [GamePhase.PhaseDiscard]: '弃牌阶段',
      [GamePhase.PhasePost]: '结束阶段',
    }

    return new GameEvent({
      name: phaseNames[phase] ?? phase,
      type: timing,
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
    const toDiscard = player.handCards.splice(0, count)
    for (const card of toDiscard) {
      this.cardSystem.discardCard(card, player)
    }
  }

  /**
   * 获取某张卡牌的合法目标列表。
   */
  private getValidTargetsForCard(player: IPlayer, card: ICard): IPlayer[] {
    const aliveOthers = this.state.alivePlayers.filter((p) => p.id !== player.id)

    // 杀：其他存活角色（简化处理，不计算距离）
    if (card.tags.has('sha')) {
      return aliveOthers
    }

    // 桃：仅受伤时可对自己使用
    if (card.tags.has('peach') || card.tags.has('tao')) {
      if (player.hp < player.maxHp) return [player]
      return []
    }

    // 装备牌：仅对自己使用
    if (card.type === 'equip' || card.tags.has('equip')) {
      return [player]
    }

    // 非延时锦囊：其他存活角色
    if (card.tags.has('trick')) {
      return aliveOthers
    }

    // 默认：其他存活角色
    return aliveOthers
  }

  /**
   * 获取当前玩家可用的卡牌选项。
   */
  private getPlayableCards(player: IPlayer): ICard[] {
    // 仅返回手牌中可以在出牌阶段使用的牌
    return player.handCards.filter((card) => {
      // 基本牌（杀、桃、酒等）可在出牌阶段使用
      if (card.type === 'basic') return true
      // 锦囊牌可在出牌阶段使用
      if (card.type === 'rune') return true
      // 装备牌可在出牌阶段使用
      if (card.type === 'equip') return true
      return false
    })
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
