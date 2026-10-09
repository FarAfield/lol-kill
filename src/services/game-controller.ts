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
  GameStateSnapshot,
  IGameResult,
} from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type {
  IUIDecisionService,
  IRandomService,
} from '@core/contracts/services.interface'
import { SeededRandomService, randomSeed } from '@core/services/seeded-random'
import { GamePhase, ZoneType } from '@core/contracts/enums'
import type { ISkill, SkillEnableContext } from '@core/contracts/skill.interface'
import { GameEvent } from '@core/event/game-event'

// ── Pinia Store 类型（延迟导入，避免循环依赖） ──
interface IGameStore {
  syncFromEngine(state: GameStateSnapshot): void
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
  private randomService: IRandomService

  constructor(options?: { randomService?: IRandomService; seed?: number | string }) {
    this.storeService = new StoreService()
    // 引擎现在强制要求随机源：UI 不指定就按种子现开一个确定性的
    this.randomService =
      options?.randomService ?? new SeededRandomService(options?.seed ?? randomSeed())
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
      randomService: this.randomService,
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
    const card = player.handCards.find((c) => c.instanceId === cardId)
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

    // 出牌前校验：boolean 否决器的最后一道闸
    //
    // `PhaseManager.getPlayableCards` 负责「不把禁用的牌摆进选项」，
    // 这里负责「摆进去了但局面已变」——两条路径必须都查 `modQuery`，
    // 否则 UI 能点、引擎也照收，否决器就成了摆设。
    const modQuery = this.engine.modQuery
    if (!modQuery.cardEnabled(player, card)) {
      throw new Error(`[GameController] ${player.hero?.name ?? player.id} 不能使用【${card.name}】`)
    }
    for (const target of targets) {
      if (!modQuery.targetEnabled(player, card, target)) {
        throw new Error(
          `[GameController] ${target.hero?.name ?? target.id} 不能作为【${card.name}】的目标`,
        )
      }
      if (!modQuery.targetInRange(player, card, target)) {
        throw new Error(
          `[GameController] ${target.hero?.name ?? target.id} 不在【${card.name}】的范围内`,
        )
      }
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
        const card = player.handCards.find((c) => c.instanceId === cardId)
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
    //
    // 走 `getPlayerSkills`（= `SkillRegistry`），不是 `hero.effectIds`：
    // 后者看不见装备技与临时技能，于是「装上青龙偃月刀后发动【追击】」
    // 会被这句判成「找不到效果」——面板上明明显示着，点了却报错。
    // 「这人有哪些技能」只有一个答案（欠账 D36）。
    const owned = this.getPlayerSkills(player.id).map((s) => s.id)
    if (!owned.includes(effectId)) {
      throw new Error(`[GameController] 找不到效果 ${effectId}`)
    }

    // 效果发动通过事件系统处理
    const event = new GameEvent({
      name: 'useCardEffect',
      source: player,
      player,
      targets: targetIds
        .map((id) => state.players.find((p) => p.id === id))
        .filter((p): p is IPlayer => p !== undefined),
      cards: cardIds
        .map((id) => player.handCards.find((c) => c.instanceId === id))
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
      const card = player.handCards.find((c) => c.instanceId === cardId)
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
  getGameState(): Readonly<GameStateSnapshot> | null {
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
          actions.canEndPhase = true
        }
        break

      case GamePhase.PhaseDiscard:
        if (isMyTurn) {
          // 手牌上限默认等于当前体力，但 Mod 可以改写它——
          // 这里必须走 `maxHandcard`，不能用 `maxHp`，否则「上限 ±N」
          // 类技能在 UI 上完全看不出来。
          const handSize = targetPlayer.handCards.length
          const handLimit = this.engine?.getMaxHandcard(targetPlayer) ?? targetPlayer.hp
          if (handSize > handLimit) {
            actions.needDiscard = true
            actions.discardCount = handSize - handLimit
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

    // ── 可发动的技能 ──
    //
    // 放在 switch **之后**：`needDiscard` 是在上面那一段里才算出来的，
    // 而「弃牌阶段能发动什么」要读它。
    actions.usableEffects = this.computeUsableEffects(targetPlayer, {
      phase,
      isMyTurn,
      isWaitingResponse: actions.isWaitingResponse,
      needDiscard: actions.needDiscard,
    })

    return actions
  }

  /**
   * 玩家此刻持有的一整套技能定义。
   *
   * **欠账 D36。** UI 此前读的是 `player.heroes.flatMap(h => h.effectIds)`——
   * 一串裸 id。它漏掉的东西比它给的东西更致命：
   * **装备带来的技能与临时技能都不在 `hero.effectIds` 上**
   * （那些是 `SkillRegistry.attach` / `addTempSkill` 挂上去的），
   * 于是穿了青龙偃月刀的玩家在面板上看不见「追击」。
   * 唯一真值源是 `SkillRegistry.getSkills(player)`。
   */
  getPlayerSkills(playerId?: string): ISkill[] {
    if (!this.engine) return []

    const state = this.engine.getState()
    const targetPlayer = playerId
      ? state.players.find((p) => p.id === playerId)
      : this.engine.getCurrentPlayer()

    if (!targetPlayer) return []

    return this.engine.skillRegistry.getSkills(targetPlayer)
  }

  /**
   * 此刻能**手动发动**的技能 id。
   *
   * 判据是技能自己写的 `enable: SkillEnableContext[]` 与当前上下文的交集，
   * 不是「出牌阶段就全都可用」。以前的实现（`player.heroes.flatMap`）
   * 对任何技能都返回「可用」——包括【仁德】这种锁定技，
   * 于是面板上出现一个点了也没反应的按钮。
   *
   * `enable` 是**技能定义的一部分**，因此这个判据只有一个答案：
   * 改技能的可发动时机改的是 `source/` 里的定义，不是这里。
   */
  private computeUsableEffects(
    player: IPlayer,
    ctx: {
      phase: GamePhase
      isMyTurn: boolean
      isWaitingResponse: boolean
      needDiscard: boolean
    },
  ): string[] {
    if (!this.engine || !ctx.isMyTurn) return []

    // 当前上下文：技能写 `enable: [GamePhase.PhaseUse, 'response']` 时，
    // 出牌阶段与被【杀】命中时都能点。
    const contexts = new Set<SkillEnableContext>()
    contexts.add(ctx.phase)
    if (ctx.isWaitingResponse) contexts.add('response')
    if (ctx.needDiscard) contexts.add('discard')

    return this.getPlayerSkills(player.id)
      .filter((skill) => skill.enable?.some((c) => contexts.has(c)) ?? false)
      .map((skill) => skill.id)
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

    // 胜负规则在 `WinCondition`（纯函数），入口在引擎上
    const result = this.engine.checkGameOver()
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

    // 先把关再出牌：引擎那道校验会**抛错**（它不知道该把原因说给谁听），
    // 而 UI 这一层的职责恰恰是把原因讲清楚——点在打不着的人身上，
    // 玩家应当看到「为什么不行」，而不是一张静默退回手里的牌。
    const check = this.engine.validatePlay(player, card, targets)
    if (!check.valid) {
      this.decisionService?.notifyPlayer(player, check.reason ?? '目标不合法', 'warn')
      return
    }

    // 完整的用牌流程收口在引擎：移入处理区 → useCard 事件（卡牌内容在此触发）
    // → 结算完成入弃牌堆。出杀次数由「杀」的内容自己标记，这里不再重复处理。
    await this.engine.useCard(player, card, targets)
  }

  /**
   * 计算当前玩家可以打出的卡牌及其合法目标。
   */
  private computePlayableCards(
    player: IPlayer,
    _state: GameStateSnapshot,
  ): Array<{ cardId: string; validTargetIds: string[] }> {
    const engine = this.engine
    if (!engine) return []

    const result: Array<{ cardId: string; validTargetIds: string[] }> = []

    for (const card of player.handCards) {
      if (card.zone !== ZoneType.Hand) continue
      if (card.isDelayed) continue

      // 被 `mod.cardEnabled` 否决的牌根本不进选项（清单 #10）。
      // UI 这一层是玩家真正看到的「我能点哪些牌」，漏了这里，
      // 禁用就只存在于引擎的错误提示里——点了才知道不行。
      if (!engine.modQuery.cardEnabled(player, card)) continue

      // 次数额度：与引擎、AI 共用同一个判定口（`CardBudget`）。
      // 以前这里问的是 `player.canAttack` —— 一个不经过 Mod 的算式，
      // 于是装了连弩以后 UI 与出牌阶段给出不同答案（欠账 D8）。
      if (!engine.canPlayCard(player, card)) continue

      // 目标范围也只有一处：`TargetSystem`。
      // 早先这里按牌型写过一整段（杀看距离、桃看自己、锦囊看全场……），
      // 与引擎里那份各算各的；距离、攻击范围、否决器三层判断
      // 现在全在 `getValidTargets` 里一次做完。
      const validTargets = engine.getValidTargets(player, card)

      if (validTargets.length > 0) {
        result.push({
          cardId: card.instanceId,
          validTargetIds: validTargets.map((p) => p.id),
        })
      }
    }

    return result
  }

  /**
   * 计算当前玩家可选用的技能。
   */
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
