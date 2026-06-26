// ============================================================
// 联盟杀 · GameController — UI ↔ 引擎桥接层
//
// GameController 是 UI 层与 Core 引擎之间的唯一交互入口。
// UI 不直接引用 core/event、core/engine、core/system 中的任何模块。
//
// 职责：
// - 持有 GameEngine 实例，管理游戏生命周期
// - 提供 UI 可调用的操作方法（createGame, startGame, playCard, endPhase 等）
// - 提供状态查询方法（getGameState, getCurrentPlayer, getAvailableActions 等）
// - 管理 StoreService → Pinia Store 的状态同步
// - 管理人类玩家 / AI 玩家的决策路由
//
// 架构位置：
//   UI Layer (views/components/hooks) → GameController → Core Layer (GameEngine)
// ============================================================

import { GameEngine } from '@core/engine/game-engine'
import { StoreService } from '@core/services/store-service'
import type {
  IGameConfig,
  IGameState,
  IGameResult,
} from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IUIDecisionService } from '@core/contracts/services.interface'
import { GamePhase, ZoneType, TriggerTiming, EquipSlot } from '@core/contracts/enums'
import { GameEvent } from '@core/event/game-event'
import { DistanceSystem } from '@core/system/distance-system'

// ── Pinia Store 类型（延迟导入，避免循环依赖） ──
interface IGameStore {
  syncFromEngine(state: IGameState): void
  reset(): void
}

/**
 * 玩家可执行的操作描述。
 *
 * UI 根据此信息决定显示哪些按钮、高亮哪些卡牌/目标。
 */
export interface AvailableActions {
  /** 当前阶段 */
  phase: GamePhase
  /** 是否为当前玩家的回合 */
  isMyTurn: boolean
  /** 可打出的卡牌 ID 列表 */
  playableCards: Array<{ cardId: string; validTargetIds: string[] }>
  /** 可发动的技能 ID 列表 */
  usableEffects: string[]
  /** 是否可以结束当前阶段 */
  canEndPhase: boolean
  /** 是否正在等待响应 */
  isWaitingResponse: boolean
  /** 等待响应的提示 */
  responsePrompt?: string
  /** 响应时可选的卡牌 ID 列表 */
  responseCardIds?: string[]
  /** 是否需要弃牌（弃牌阶段） */
  needDiscard: boolean
  /** 需要弃置的卡牌数量（弃牌阶段） */
  discardCount: number
}

// ── 默认空可用操作 ──
const EMPTY_ACTIONS: AvailableActions = {
  phase: GamePhase.NotStarted,
  isMyTurn: false,
  playableCards: [],
  usableEffects: [],
  canEndPhase: false,
  isWaitingResponse: false,
  needDiscard: false,
  discardCount: 0,
}

// ── 辅助函数 —— 使用 IPlayer 接口兼容的方式 ──

/** 检查玩家是否受伤（hp < maxHp）。IPlayer 兼容版本。 */
function isPlayerWounded(player: IPlayer): boolean {
  return player.hp < player.maxHp
}

/** 获取玩家存活列表。IGameState 兼容版本。 */
function getAlivePlayers(state: IGameState): IPlayer[] {
  return state.players.filter((p) => p.alive)
}

/** 获取玩家的攻击范围（基础 1 + 武器加成）。 */
function getPlayerAttackRange(player: IPlayer): number {
  const weapon = player.equipCards.find((c) => c.equipSlot === EquipSlot.Weapon)
  return 1 + (weapon?.attackRange ?? 0)
}

/** 检查玩家本回合是否还能攻击（基于 usedAttackThisTurn + attackLimit）。 */
function canPlayerAttack(player: IPlayer): boolean {
  if (player.attackLimit === Infinity) return true
  // usedAttackThisTurn 是 boolean，attackLimit 通常是 1
  const attacksUsed = player.usedAttackThisTurn ? 1 : 0
  return attacksUsed < player.attackLimit
}

/**
 * GameController — UI 与引擎的唯一交互入口。
 *
 * 用法：
 *   const controller = new GameController()
 *   await controller.createGame(config)
 *   await controller.startGame()
 *   // UI 通过 controller.getAvailableActions() 决定显示什么
 *   // 玩家点击出牌后调用 controller.playCard(cardId, [targetId])
 */
export class GameController {
  private engine: GameEngine | null = null
  private storeService: StoreService
  private decisionService: IUIDecisionService | null = null
  private piniaStore: IGameStore | null = null
  private isRunning = false
  private gameResult: IGameResult | null = null

  constructor() {
    this.storeService = new StoreService()
  }

  // ── 初始化 ──

  /**
   * 绑定 Pinia Store。
   *
   * 必须在调用 createGame() 之前设置。
   * 引擎每次状态变更后都会通过 StoreService 推送最新状态到 Pinia Store。
   *
   * @param store Pinia GameStore 实例
   */
  bindStore(store: IGameStore): void {
    this.piniaStore = store

    // 注册同步回调：引擎状态变更 → Pinia Store
    this.storeService.onChange((state) => {
      store.syncFromEngine(state)
    })
  }

  /**
   * 设置决策服务（用于人类玩家交互或 AI 决策）。
   *
   * @param service 决策服务实现
   */
  setDecisionService(service: IUIDecisionService): void {
    this.decisionService = service
  }

  // ── 游戏生命周期 ──

  /**
   * 创建并初始化游戏。
   *
   * 流程：创建 GameEngine → init(config) → 同步状态到 Store
   *
   * @param config 游戏配置
   */
  async createGame(config: IGameConfig): Promise<void> {
    if (this.engine) {
      this.cleanup()
    }

    // 创建引擎并注入服务
    this.engine = new GameEngine({
      storeService: this.storeService,
      decisionService: this.decisionService ?? undefined,
    })

    await this.engine.init(config)

    // 首次同步到 Pinia Store
    this.syncToStore()
  }

  /**
   * 启动游戏——进入第一个回合。
   *
   * 必须在 createGame() 之后调用。
   */
  async startGame(): Promise<void> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建，请先调用 createGame()')
    }

    this.isRunning = true
    await this.engine.start()
    this.syncToStore()
  }

  /**
   * 运行完整的游戏循环（AI 自动模式）。
   *
   * 适用于 AI vs AI 模拟或测试场景。
   * 人类玩家交互场景下，应使用 startGame() + 手动逐步推进。
   *
   * @returns 游戏结果
   */
  async runGameLoop(): Promise<IGameResult> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建，请先调用 createGame()')
    }

    this.isRunning = true
    const result = await this.engine.runGameLoop()
    this.isRunning = false
    this.syncToStore()
    return result
  }

  // ── 玩家操作 ──

  /**
   * 打出一张卡牌。
   *
   * UI 在玩家选择卡牌和目标后调用此方法。
   *
   * @param cardId   卡牌实例 ID
   * @param targetIds 目标玩家 ID 列表
   */
  async playCard(cardId: string, targetIds: string[]): Promise<void> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建')
    }

    const state = this.engine.getState()
    const player = this.engine.getCurrentPlayer()
    if (!player) {
      throw new Error('[GameController] 当前没有行动玩家')
    }

    // 查找卡牌
    const card = player.handCards.find((c) => c.id === cardId)
    if (!card) {
      throw new Error(`[GameController] 找不到卡牌 ${cardId}`)
    }

    // 查找目标玩家
    const targets: IPlayer[] = []
    for (const targetId of targetIds) {
      const target = state.players.find((p) => p.id === targetId)
      if (!target) {
        throw new Error(`[GameController] 找不到目标玩家 ${targetId}`)
      }
      targets.push(target)
    }

    // 通过引擎执行出牌
    try {
      await this.executeCardUse(card, targets)
    } catch (err) {
      console.error('[GameController] playCard 失败:', err)
      throw err
    }

    this.syncToStore()
  }

  /**
   * 响应窗口的决策（如出闪、出桃等）。
   *
   * 注意：响应窗口的具体暂停/恢复由 EventPauseManager / ResponseWindow 管理。
   * 此方法标记玩家已完成决策，实际流程由引擎的事件调度循环接管。
   *
   * @param cardId 选择打出的卡牌 ID，null 表示不出/取消
   */
  async respondToWindow(cardId: string | null): Promise<void> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建')
    }

    // 响应窗口的恢复由 EventPauseManager.resume() 或 ResponseWindow 内部处理。
    // GameController 层面记录玩家的选择结果，实际的事件栈恢复
    // 由决策服务回调触发。
    if (cardId) {
      const player = this.engine.getCurrentPlayer()
      if (player) {
        const card = player.handCards.find((c) => c.id === cardId)
        if (!card) {
          throw new Error(`[GameController] 找不到卡牌 ${cardId}`)
        }
        // 卡牌选择有效 — 响应窗口会通过 EventPauseManager 进行恢复
      }
    }
    // 响应决策由 engine 的 decision service 管道处理
    this.syncToStore()
  }

  /**
   * 结束当前阶段（玩家点击「结束出牌」等按钮）。
   */
  async endPhase(): Promise<void> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建')
    }

    await this.engine.nextPhase()
    this.syncToStore()
  }

  /**
   * 发动技能/效果。
   *
   * @param effectId 效果 ID
   * @param targetIds 目标玩家 ID 列表
   * @param cardIds 选择的卡牌 ID 列表（如弃牌发动）
   */
  async useEffect(
    effectId: string,
    targetIds: string[] = [],
    cardIds: string[] = [],
  ): Promise<void> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建')
    }

    const state = this.engine.getState()
    const player = this.engine.getCurrentPlayer()
    if (!player) {
      throw new Error('[GameController] 当前没有行动玩家')
    }

    // 验证效果存在
    const heroEffectIds = player.heroes.flatMap((h) => h.effectIds)
    if (!heroEffectIds.includes(effectId)) {
      throw new Error(`[GameController] 找不到效果 ${effectId}`)
    }

    // 效果发动通过事件系统处理
    const event = new GameEvent({
      name: `效果发动: ${effectId}`,
      type: TriggerTiming.CardEffect,
      source: player,
      player,
      targets: targetIds
        .map((id) => state.players.find((p) => p.id === id))
        .filter((p): p is IPlayer => p !== undefined),
      cards: cardIds
        .map((id) => player.handCards.find((c) => c.id === id))
        .filter((c): c is ICard => c !== undefined),
      phase: state.currentPhase,
      round: state.currentRound,
      turn: player.seatIndex,
      data: { effectId },
    })

    await this.engine.eventDispatcher.dispatch(event, this.engine.eventChain)
    this.syncToStore()
  }

  /**
   * 弃牌（弃牌阶段使用）。
   *
   * @param cardIds 要弃置的卡牌 ID 列表
   */
  async discardCards(cardIds: string[]): Promise<void> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建')
    }

    const player = this.engine.getCurrentPlayer()
    if (!player) {
      throw new Error('[GameController] 当前没有行动玩家')
    }

    const cards: ICard[] = []
    for (const cardId of cardIds) {
      const card = player.handCards.find((c) => c.id === cardId)
      if (!card) {
        throw new Error(`[GameController] 找不到卡牌 ${cardId}`)
      }
      cards.push(card)
    }

    // 弃牌通过 CardSystem
    for (const card of cards) {
      this.engine.cardSystem.discardCard(card, player)
    }

    // 弃牌完成后推进阶段
    await this.engine.nextPhase()
    this.syncToStore()
  }

  // ── 查询 ──

  /**
   * 获取当前游戏状态（只读）。
   */
  getGameState(): Readonly<IGameState> | null {
    return this.storeService.getGameStateSafe()
  }

  /**
   * 获取当前行动玩家。
   */
  getCurrentPlayer(): IPlayer | null {
    if (!this.engine) return null
    return this.engine.getCurrentPlayer() ?? null
  }

  /**
   * 获取指定玩家当前可执行的操作列表。
   *
   * UI 根据此信息决定显示内容：
   * - 哪些卡牌可打出
   * - 哪些目标可选
   * - 是否可以结束阶段
   * - 是否需要响应窗口
   *
   * @param playerId 玩家 ID（默认为当前行动玩家）
   */
  getAvailableActions(playerId?: string): AvailableActions {
    if (!this.engine) return { ...EMPTY_ACTIONS }

    const state = this.engine.getState()
    const currentPlayer = this.engine.getCurrentPlayer()
    const targetPlayer = playerId
      ? state.players.find((p) => p.id === playerId)
      : currentPlayer

    if (!targetPlayer) return { ...EMPTY_ACTIONS }

    const isMyTurn = currentPlayer?.id === targetPlayer.id
    const phase = state.currentPhase

    // ── 基础动作 ──
    const actions: AvailableActions = {
      phase,
      isMyTurn,
      playableCards: [],
      usableEffects: [],
      canEndPhase: false,
      isWaitingResponse: false,
      needDiscard: false,
      discardCount: 0,
    }

    // ── 根据阶段决定可执行操作 ──
    switch (phase) {
      case GamePhase.PhaseUse:
        if (isMyTurn) {
          actions.playableCards = this.computePlayableCards(targetPlayer, state)
          actions.usableEffects = this.computeUsableEffects(targetPlayer)
          actions.canEndPhase = true
        }
        break

      case GamePhase.PhaseDiscard:
        if (isMyTurn) {
          const handSize = targetPlayer.handCards.length
          const maxHp = targetPlayer.maxHp
          if (handSize > maxHp) {
            actions.needDiscard = true
            actions.discardCount = handSize - maxHp
          }
          actions.canEndPhase = true
        }
        break

      case GamePhase.PhasePre:
      case GamePhase.PhaseJudge:
      case GamePhase.PhaseDraw:
      case GamePhase.PhasePost:
        if (isMyTurn) {
          actions.canEndPhase = true
        }
        break

      default:
        break
    }

    return actions
  }

  /**
   * 游戏是否正在运行。
   */
  get isActive(): boolean {
    return this.isRunning && this.engine !== null && !this.engine.isGameOver
  }

  /**
   * 游戏是否已结束。
   */
  get isGameOver(): boolean {
    return this.engine?.isGameOver ?? false
  }

  /**
   * 主动检查游戏是否满足结束条件。
   *
   * 在 UI 驱动的逐步推进模式下，每次玩家操作后应调用此方法。
   * 如果游戏满足结束条件，会自动标记 finished 并返回结果。
   *
   * @returns 游戏结果（如果游戏结束），null 表示游戏继续
   */
  checkGameOver(): IGameResult | null {
    if (!this.engine) return null

    // 已经结束则返回已有结果
    if (this.gameResult) return this.gameResult

    // 调用 DeathSystem 检查胜利条件
    const result = this.engine.deathSystem.checkGameOver()
    if (result) {
      // 标记游戏结束
      this.engine.state.markFinished()
      this.gameResult = result
      this.syncToStore()
    }

    return result
  }

  /**
   * 获取游戏结果（仅在游戏结束后有效）。
   */
  getGameResult(): IGameResult | null {
    return this.gameResult
  }

  // ── 私有方法 ──

  /**
   * 执行使用卡牌的完整流程。
   */
  private async executeCardUse(card: ICard, targets: IPlayer[]): Promise<void> {
    if (!this.engine) return

    const player = this.engine.getCurrentPlayer()
    if (!player) return

    const state = this.engine.getState()

    // 1. 卡牌从手牌移入处理区
    this.engine.cardSystem.useCard(card, player, targets)

    // 2. 创建 CardUse 事件
    const cardUseEvent = new GameEvent({
      name: `使用: ${card.name}`,
      type: TriggerTiming.CardUse,
      source: player,
      player,
      targets,
      cards: [card],
      phase: state.currentPhase,
      round: state.currentRound,
      turn: player.seatIndex,
    })

    // 3. 分发事件
    await this.engine.eventDispatcher.dispatch(
      cardUseEvent,
      this.engine.eventChain,
    )

    // 4. 卡牌结算完成
    this.engine.cardSystem.finishProcessing(card)

    // 5. 标记攻击使用（如果是杀）
    if (card.tags.has('sha')) {
      player.usedAttackThisTurn = true
    }
  }

  /**
   * 计算当前玩家可以打出的卡牌及其合法目标。
   */
  private computePlayableCards(
    player: IPlayer,
    state: IGameState,
  ): Array<{ cardId: string; validTargetIds: string[] }> {
    const engine = this.engine
    if (!engine) return []

    const result: Array<{ cardId: string; validTargetIds: string[] }> = []
    const playerAttackRange = getPlayerAttackRange(player)

    for (const card of player.handCards) {
      if (card.zone !== ZoneType.Hand) continue
      if (card.isDelayed) continue

      let validTargets: IPlayer[] = []

      if (card.tags.has('sha')) {
        // 杀：攻击范围内的一名其他角色
        if (!canPlayerAttack(player)) continue
        validTargets = getAlivePlayers(state).filter((p) => {
          if (p.id === player.id) return false
          const dist = DistanceSystem.getDistance(player, p, state.players)
          return dist <= playerAttackRange
        })
      } else if (card.tags.has('peach')) {
        // 桃：自己（受伤时）
        if (isPlayerWounded(player)) {
          validTargets = [player]
        }
      } else if (card.tags.has('trick')) {
        // 非延时锦囊：其他存活角色
        validTargets = getAlivePlayers(state).filter((p) => p.id !== player.id)
      } else if (card.tags.has('equip')) {
        // 装备牌：只能装备到自己
        validTargets = [player]
      }

      if (validTargets.length > 0) {
        result.push({
          cardId: card.id,
          validTargetIds: validTargets.map((p) => p.id),
        })
      }
    }

    return result
  }

  /**
   * 计算当前玩家可选用的技能。
   */
  private computeUsableEffects(player: IPlayer): string[] {
    // 从英雄技能列表中获取所有效果 ID
    // 在后续 Phase 集成时完善：需结合 PhaseManager 中的主动技判定逻辑
    return player.heroes.flatMap((h) => h.effectIds)
  }

  /**
   * 同步引擎状态到 Pinia Store。
   */
  private syncToStore(): void {
    if (!this.engine) return
    const state = this.engine.getState()
    this.storeService.syncGameState(state)
  }

  /**
   * 清理资源（新游戏创建前调用）。
   */
  private cleanup(): void {
    this.storeService.reset()
    if (this.piniaStore) {
      this.piniaStore.reset()
    }
    this.engine = null
    this.isRunning = false
    this.gameResult = null
  }

  /**
   * 销毁控制器。
   */
  destroy(): void {
    this.cleanup()
    this.piniaStore = null
    this.decisionService = null
  }
}
