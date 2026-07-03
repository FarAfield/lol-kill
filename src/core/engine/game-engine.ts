// ============================================================
// 联盟杀 · GameEngine — 游戏主控引擎
//
// 将状态机、事件系统、子系统和阶段管理串联起来，
// 是 Core 层的顶层协调器。
//
// 职责：
// - init(config)   — 初始化所有子系统，创建牌堆、分配角色、发放初始手牌
// - start()        — 启动游戏，进入第一个回合
// - runGameLoop()  — 运行完整游戏循环（轮次 → 回合 → 阶段）
// - nextPhase()    — 推进到下一个阶段
//
// 架构：
//   GameEngine 持有所有子系统的引用，作为它们的协调者。
//   UI 通过 GameController 调用引擎，不直接引用内部模块。
// ============================================================

import { GamePhase, RoleType, ZoneType } from '@core/contracts/enums'
import { STANDARD_PHASE_ORDER, DEFAULT_DRAW_COUNT, INITIAL_HAND_SIZE, LORD_HP_BONUS } from '@source/base/constants'
import type { IGameState, IGameConfig, IGameResult } from '@core/contracts/game.interface'
import type { PlayerId, Position } from '@core/contracts/types'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard, CardDefinition } from '@core/contracts/card.interface'
import type { IHero } from '@core/contracts/hero.interface'
import type {
  IUIDecisionService,
  IRandomService,
  ILoggerService,
  IStoreService,
} from '@core/contracts/services.interface'

// ── Entity ──
import { GameState } from '@core/entity/game-state'
import { Player } from '@core/entity/player'

// ── Engine ──
import { GameStateMachine, WILDCARD } from './state-machine'
import { TurnManager } from './turn-manager'
import { PhaseManager } from './phase-manager'

// ── Event ──
import { EventChain } from '@core/event/event-chain'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { GameEvent } from '@core/event/game-event'
import { TriggerTiming } from '@core/contracts/enums'
import type { EffectContextDeps } from '@core/contracts/effect-context-deps'

// ── System ──
import { DeckManager } from '@core/system/deck-manager'
import { CardSystem } from '@core/system/card-system'
import { DamageSystem } from '@core/system/damage-system'
import { DistanceSystem } from '@core/system/distance-system'
import { TargetSystem } from '@core/system/target-system'
import { DeathSystem } from '@core/system/death-system'
import { CardAuditor } from '@core/system/card-auditor'

/**
 * GameEngine 配置选项
 */
export interface GameEngineOptions {
  /** 随机服务（洗牌等） */
  randomService?: IRandomService
  /** 日志服务 */
  loggerService?: ILoggerService
  /** 存储服务（同步到 UI） */
  storeService?: IStoreService
  /** 决策服务（玩家交互 / AI） */
  decisionService?: IUIDecisionService
  /** 摸牌阶段摸牌数（默认 2） */
  drawCount?: number
  /** 启用卡牌数量审计（开发/测试用，默认关闭） */
  enableAudit?: boolean
  /** 预期卡牌总数（审计用），不设置则从 config.cards 推导 */
  expectedCardTotal?: number
}

/**
 * 游戏主控引擎
 *
 * 协调所有子系统完成游戏的生命周期。
 * 所有游戏状态的修改都通过事件系统进行。
 */
export class GameEngine {
  // ── 核心状态 ──
  state: GameState
  stateMachine: GameStateMachine

  // ── 事件系统 ──
  eventChain: EventChain
  eventDispatcher: EventDispatcher

  // ── 回合/阶段管理 ──
  turnManager: TurnManager
  phaseManager: PhaseManager

  // ── 子系统 ──
  deckManager: DeckManager
  cardSystem: CardSystem
  damageSystem: DamageSystem
  distanceSystem: DistanceSystem
  targetSystem: TargetSystem
  deathSystem: DeathSystem

  // ── 服务 ──
  private randomService?: IRandomService
  private loggerService?: ILoggerService
  private storeService?: IStoreService
  private decisionService?: IUIDecisionService
  private enableAudit: boolean
  private expectedCardTotal: number

  constructor(options?: GameEngineOptions) {
    // ── 初始化状态 ──
    this.state = new GameState()
    this.stateMachine = new GameStateMachine(GamePhase.NotStarted)

    // ── 初始化子系统（先于事件系统创建，EventDispatcher 需要 deps） ──
    this.deckManager = new DeckManager(this.state, options?.randomService)
    this.cardSystem = new CardSystem(this.state)
    this.damageSystem = new DamageSystem()
    this.distanceSystem = new DistanceSystem()
    this.targetSystem = new TargetSystem()
    this.deathSystem = new DeathSystem(this.state)

    // ── 初始化事件系统 ──
    this.eventChain = new EventChain()
    this.eventDispatcher = new EventDispatcher({
      deps: this.buildEffectDeps(),
    })

    // ── 初始化回合/阶段管理 ──
    this.turnManager = new TurnManager(this.state)
    this.phaseManager = new PhaseManager(
      this.state,
      this.eventDispatcher,
      this.eventChain,
      this.deckManager,
      this.turnManager,
      this.cardSystem,
      {
        decisionService: options?.decisionService,
        drawCount: options?.drawCount ?? DEFAULT_DRAW_COUNT,
      },
    )

    // ── 保存服务引用 ──
    this.randomService = options?.randomService
    this.loggerService = options?.loggerService
    this.storeService = options?.storeService
    this.decisionService = options?.decisionService
    this.enableAudit = options?.enableAudit ?? false
    this.expectedCardTotal = options?.expectedCardTotal ?? -1
  }

  /**
   * 构建 EffectContextDeps，供 EventDispatcher 在执行 CompiledHandler 时
   * 创建 EffectContext 实例。
   */
  private buildEffectDeps(): EffectContextDeps {
    return {
      state: this.state,
      eventChain: this.eventChain,
      eventDispatcher: this.eventDispatcher,
      deckManager: this.deckManager,
      cardSystem: this.cardSystem,
      damageSystem: this.damageSystem,
      deathSystem: this.deathSystem,
      decisionService: this.decisionService,
    }
  }

  // ── 初始化 ──

  /**
   * 初始化游戏引擎。
   *
   * 完整的初始化流程：
   * 1. 验证游戏配置
   * 2. 注册状态机转移规则
   * 3. 创建玩家实体
   * 4. 分配身份和英雄
   * 5. 初始化牌堆并洗牌
   * 6. 发放初始手牌
   * 7. 同步到 Store
   *
   * @param config 游戏配置
   */
  async init(config: IGameConfig): Promise<void> {
    this.log('info', 'GameEngine.init() — 开始初始化游戏')

    // 1. 更新状态配置
    this.state = GameState.create(config)
    this.rebindState()

    // 2. 注册状态机
    this.registerStateMachine()

    // 3. 创建玩家
    this.createPlayers(config)

    // 4. 分配身份
    this.assignRoles(config.roles)

    // 5. 分配英雄
    await this.assignHeroes(config.heroes, config.heroSelectCount)

    // 6. 初始化牌堆
    this.deckManager.initializeDeck(config.cards)
    this.deckManager.shuffle()

    // 7. 发放初始手牌
    this.dealInitialHands(config.initialHandSize)

    // 8. 标记准备完成
    this.state.markStarted()
    this.stateMachine.reset(GamePhase.Prepare)

    // 9. 同步
    this.syncState()

    this.log('info', 'GameEngine.init() — 初始化完成')
  }

  /**
   * 启动游戏——进入第一个回合。
   *
   * 在 init() 之后调用。
   * 流程：Prepare → RoundStart → 第一个玩家的 PhasePre
   */
  async start(): Promise<void> {
    if (!this.state.started) {
      throw new Error('[GameEngine] 游戏尚未初始化，请先调用 init()')
    }

    this.log('info', 'GameEngine.start() — 游戏开始')

    // ── 触发 GameStart 事件 ──
    const gameStartEvent = new GameEvent({
      name: '游戏开始',
      type: TriggerTiming.GameStart,
      phase: GamePhase.Prepare,
      round: this.state.currentRound,
    })
    await this.eventDispatcher.dispatch(gameStartEvent, this.eventChain)

    // ── Prepare → RoundStart ──
    await this.stateMachine.transition(GamePhase.RoundStart, this.state)
    this.state.currentPhase = GamePhase.RoundStart

    // ── 开始第一轮 ──
    this.turnManager.startRound()

    // ── RoundStart → PhasePre ──
    await this.stateMachine.transition(GamePhase.PhasePre, this.state)

    // ── 触发 RoundStart 事件 ──
    const roundStartEvent = new GameEvent({
      name: '轮次开始',
      type: TriggerTiming.RoundStart,
      phase: GamePhase.RoundStart,
      round: this.state.currentRound,
    })
    await this.eventDispatcher.dispatch(roundStartEvent, this.eventChain)

    // ── 进入第一个玩家的回合 ──
    const firstPlayer = this.turnManager.getCurrentPlayer()
    if (firstPlayer) {
      await this.phaseManager.executeTurn()
    }

    this.syncState()
  }

  /**
   * 运行完整的游戏循环。
   *
   * 持续循环：轮次 → 回合 → 阶段，直到游戏结束。
   * 在每步之间检查胜利条件和游戏结束标记。
   *
   * @returns 游戏结果
   */
  async runGameLoop(): Promise<IGameResult> {
    while (!this.state.finished) {
      // 检查当前轮次是否所有玩家都已行动
      if (this.turnManager.isRoundComplete) {
        // 轮次结束 → 检查游戏结束 → 开始新轮次
        this.state.currentPhase = GamePhase.RoundEnd
        await this.stateMachine.transition(GamePhase.RoundEnd, this.state)

        const gameOverResult = this.deathSystem.checkGameOver()
        if (gameOverResult) {
          return this.endGame(gameOverResult)
        }

        // 检查最大轮次数
        if (this.state.currentRound >= this.state.config.maxRounds) {
          return this.endGame({
            winner: null,
            reason: `达到最大轮次数 ${this.state.config.maxRounds}，游戏平局`,
            survivingPlayers: this.state.alivePlayers,
            totalRounds: this.state.currentRound,
            endedAt: Date.now(),
          })
        }

        // 开始新轮次
        this.turnManager.startRound()
        await this.stateMachine.transition(GamePhase.RoundStart, this.state)

        // 触发 RoundStart 事件
        const roundStartEvent = new GameEvent({
          name: '轮次开始',
          type: TriggerTiming.RoundStart,
          phase: GamePhase.RoundStart,
          round: this.state.currentRound,
        })
        await this.eventDispatcher.dispatch(roundStartEvent, this.eventChain)
      }

      // 获取下一个玩家
      const nextPlayer = this.turnManager.nextTurn()
      if (!nextPlayer) {
        // 没有可行动的玩家（异常情况）
        if (this.state.aliveCount === 0) {
          return this.endGame({
            winner: null,
            reason: '所有玩家已死亡',
            survivingPlayers: [],
            totalRounds: this.state.currentRound,
            endedAt: Date.now(),
          })
        }
        continue
      }

      // 执行该玩家的回合
      await this.phaseManager.executeTurn()

      // 检查游戏是否结束（玩家可能在回合中死亡导致胜利条件满足）
      const gameOverResult = this.deathSystem.checkGameOver()
      if (gameOverResult) {
        return this.endGame(gameOverResult)
      }

      this.syncState()
    }

    // 构建最终结果
    return this.state.buildResult(null, '游戏已结束')
  }

  /**
   * 推进到下一个阶段（玩家主动结束当前阶段时调用）。
   *
   * UI 通过此方法通知引擎当前阶段结束，进入下一阶段。
   * 例如：玩家在出牌阶段点击「结束出牌」时调用。
   */
  async nextPhase(): Promise<void> {
    const currentPlayer = this.turnManager.getCurrentPlayer()
    if (!currentPlayer) return

    const currentPhase = this.state.currentPhase
    const nextPhase = this.phaseManager.getNextPhase(currentPhase)

    if (nextPhase) {
      // 转移到下一个阶段
      await this.stateMachine.transition(nextPhase, this.state)
      this.state.currentPhase = nextPhase

      // 执行下一阶段
      await this.phaseManager.executePhase(nextPhase, currentPlayer)
    } else {
      // 最后一个阶段（PhasePost）结束，回合结束
      this.state.currentPhase = GamePhase.PhasePost
      await this.stateMachine.transition(GamePhase.PhasePost, this.state)
    }

    this.syncState()
  }

  // ── 游戏结束 ──

  /**
   * 结束游戏。
   *
   * 触发 GameOver 事件，标记 finished，同步状态。
   */
  private async endGame(result: IGameResult): Promise<IGameResult> {
    this.state.markFinished()
    await this.stateMachine.transition(GamePhase.GameOver, this.state)

    // 触发 GameOver 事件
    const gameOverEvent = new GameEvent({
      name: '游戏结束',
      type: TriggerTiming.GameOver,
      phase: GamePhase.GameOver,
      round: this.state.currentRound,
      data: { result },
    })
    await this.eventDispatcher.dispatch(gameOverEvent, this.eventChain)

    this.syncState()
    this.log('info', `游戏结束: ${result.reason}`)

    return result
  }

  // ── 查询 ──

  /**
   * 获取当前玩家。
   */
  getCurrentPlayer(): IPlayer | undefined {
    return this.turnManager.getCurrentPlayer()
  }

  /**
   * 获取游戏状态快照。
   */
  getState(): Readonly<IGameState> {
    return this.state.snapshot()
  }

  /**
   * 游戏是否已结束。
   */
  get isGameOver(): boolean {
    return this.state.finished
  }

  // ── 私有方法 ──

  /**
   * 重新绑定 state 到所有子系统（init 时 state 被替换需要重新绑定）。
   */
  private rebindState(): void {
    this.deckManager = new DeckManager(this.state, this.randomService)
    this.cardSystem = new CardSystem(this.state)
    this.damageSystem = new DamageSystem()
    this.distanceSystem = new DistanceSystem()
    this.targetSystem = new TargetSystem()
    this.deathSystem = new DeathSystem(this.state)
    this.turnManager = new TurnManager(this.state)
    this.phaseManager = new PhaseManager(
      this.state,
      this.eventDispatcher,
      this.eventChain,
      this.deckManager,
      this.turnManager,
      this.cardSystem,
      {
        decisionService: this.decisionService,
        drawCount: DEFAULT_DRAW_COUNT,
      },
    )
  }

  /**
   * 注册状态机的全部转移规则。
   */
  private registerStateMachine(): void {
    // ── 标准游戏流程 ──
    this.stateMachine.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
    this.stateMachine.registerState(GamePhase.Prepare, [GamePhase.RoundStart])
    this.stateMachine.registerState(GamePhase.RoundStart, [GamePhase.PhasePre])

    // 回合内阶段顺序
    this.stateMachine.registerState(GamePhase.PhasePre, [GamePhase.PhaseJudge])
    this.stateMachine.registerState(GamePhase.PhaseJudge, [GamePhase.PhaseDraw])
    this.stateMachine.registerState(GamePhase.PhaseDraw, [GamePhase.PhaseUse])
    this.stateMachine.registerState(GamePhase.PhaseUse, [GamePhase.PhaseDiscard])
    this.stateMachine.registerState(GamePhase.PhaseDiscard, [GamePhase.PhasePost])

    // 回合结束 → 轮次结束
    this.stateMachine.registerState(GamePhase.PhasePost, [GamePhase.RoundEnd])

    // 轮次结束 → 下一轮 或 游戏结束
    this.stateMachine.registerState(GamePhase.RoundEnd, [
      {
        to: GamePhase.RoundStart,
        condition: (s) =>
          s.currentRound < s.config.maxRounds && !s.finished,
      },
      { to: GamePhase.GameOver, condition: (s) => s.finished },
    ])

    // ── 通配符：任意状态 → GameOver（玩家死亡等突发事件） ──
    this.stateMachine.registerState(WILDCARD, [GamePhase.GameOver])
  }

  /**
   * 创建玩家实体。
   */
  private createPlayers(config: IGameConfig): void {
    const players: IPlayer[] = []
    for (let i = 0; i < config.playerCount; i++) {
      const player = new Player({
        id: `player_${i}` as PlayerId,
        seatIndex: i as Position,
      })
      players.push(player)
    }
    this.state.players = players
    this.state.currentPlayerIndex = 0
  }

  /**
   * 分配身份。
   */
  private assignRoles(roles: RoleType[]): void {
    if (roles.length === 0) return

    // 随机打乱身份
    const shuffled = this.randomService
      ? this.randomService.shuffle([...roles])
      : this.fisherYatesShuffle([...roles])

    for (let i = 0; i < this.state.players.length && i < shuffled.length; i++) {
      const player = this.state.players[i]!
      player.role = shuffled[i]!

      // 天命星灵（主公）身份公开
      if (player.role === RoleType.Aspect) {
        player.roleRevealed = true
        // 主公体力上限 +1
        player.maxHp += LORD_HP_BONUS
        player.hp = player.maxHp
      }
    }
  }

  /**
   * 分配英雄。
   *
   * 从英雄池中为每位玩家随机选择指定数量的英雄供选择（或直接随机分配）。
   *
   * @param heroes      可用英雄池
   * @param selectCount 每位玩家可选择的英雄数量（从 selectCount 中选 1）
   */
  private async assignHeroes(
    heroes: IHero[],
    selectCount: number,
  ): Promise<void> {
    if (heroes.length === 0) return

    const shuffled = this.randomService
      ? this.randomService.shuffle([...heroes])
      : this.fisherYatesShuffle([...heroes])

    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i]!
      // 为每位玩家从英雄池中分配 selectCount 个候选
      const startIdx = (i * selectCount) % shuffled.length
      const candidates = shuffled.slice(startIdx, startIdx + selectCount)

      // 如果有决策服务，让玩家选择
      if (this.decisionService && candidates.length > 0) {
        try {
          const chosenId = await this.decisionService.askForHeroSelect(
            player,
            candidates.map((h) => ({
              id: h.id,
              name: h.name,
              title: h.title,
              kingdom: h.kingdom,
            })),
            1,
          )
          const chosen = candidates.find((h) => h.id === chosenId)
          if (chosen) {
            player.heroes = [chosen]
            player.maxHp = chosen.maxHp
            player.hp = player.maxHp
            // 主公体力上限加成
            if (player.role === RoleType.Aspect) {
              player.maxHp += LORD_HP_BONUS
              player.hp = player.maxHp
            }
            continue
          }
        } catch {
          // 选择失败，走默认分配
        }
      }

      // 默认分配第一个候选英雄
      if (candidates.length > 0) {
        const hero = candidates[0]!
        player.heroes = [hero]
        player.maxHp = hero.maxHp
        player.hp = player.maxHp
        // 主公体力上限加成
        if (player.role === RoleType.Aspect) {
          player.maxHp += LORD_HP_BONUS
          player.hp = player.maxHp
        }
      }
    }
  }

  /**
   * 发放初始手牌。
   *
   * 每位存活玩家抽取 initialHandSize 张牌。
   */
  private dealInitialHands(handSize: number): void {
    for (const player of this.state.players) {
      if (!player.alive) continue
      const cards = this.deckManager.draw(handSize)
      for (const card of cards) {
        card.zone = ZoneType.Hand
        ;(card as { owner?: IPlayer }).owner = player
      }
      player.handCards.push(...cards)
    }
  }

  /**
   * 同步状态到 Store（如果已注入）。
   * 如果启用了审计，在同步前验证卡牌完整性。
   */
  private syncState(): void {
    if (this.enableAudit) {
      this.auditCards()
    }
    if (this.storeService) {
      this.storeService.syncGameState(this.state.toJSON())
    }
  }

  /**
   * 执行卡牌数量审计（仅在 enableAudit 开启时调用）。
   *
   * 检测重复卡牌 ID、总数偏差、区域不一致等异常。
   * 发现问题时通过 loggerService 输出警告/错误。
   */
  private auditCards(): void {
    const expectedTotal = this.expectedCardTotal >= 0
      ? this.expectedCardTotal
      : this.state.config.cards.length
    const result = CardAuditor.verify(this.state, expectedTotal)

    for (const warning of result.warnings) {
      this.log('warn', `[CardAuditor] ${warning}`)
    }
    for (const error of result.errors) {
      this.log('error', `[CardAuditor] ${error}`)
    }

    if (!result.valid) {
      this.log(
        'error',
        `[CardAuditor] 卡牌审计未通过: ${result.errors.length} 个错误, ${result.warnings.length} 个警告`,
      )
    }
  }

  /**
   * 日志记录。
   */
  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.loggerService) {
      this.loggerService.log(message, level as import('@core/contracts/enums').LogLevel)
    }
  }

  /**
   * 简易 Fisher-Yates 洗牌（不依赖 IRandomService 时使用）。
   */
  private fisherYatesShuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
  }
}
