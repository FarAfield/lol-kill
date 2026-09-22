// ============================================================
// 联盟杀 · GameBoot — 游戏启动引导
//
// GameBoot 是游戏引擎的应用程序入口点。
// 它编排完整的游戏启动流程，将配置、服务、引擎串联起来。
//
// 职责：
// - 接收 IGameConfig 游戏配置
// - 初始化 DI 容器并注册服务（随机、日志、存储、决策）
// - 创建并配置 GameEngine 实例
// - 执行完整的启动序列（init → start）
// - 提供标准游戏模式的便捷创建方法
//
// 完整启动流程：
//   GameBoot.create(config)
//     → 加载 Source 数据（英雄/卡牌，由 config 提供）
//     → 初始化 DI 容器
//     → 创建 GameEngine 并注入服务
//     → engine.init(config) → 分配角色/英雄/手牌
//     → engine.start() → 进入第一个回合
//
// 用法：
//   // 直接创建
//   const boot = new GameBoot(config)
//   await boot.boot()
//   await boot.start()
//
//   // 标准模式快捷方法
//   const boot = GameBoot.createStandard5P()
//   await boot.boot()
//   await boot.start()
//
//   // AI 自动模式
//   const result = await boot.runGameLoop()
// ============================================================

import { GameEngine } from '@core/engine/game-engine'
import type { GameEngineOptions } from '@core/engine/game-engine'
import { StoreService } from '@core/services/store-service'
import type { IGameConfig, IGameResult } from '@core/contracts/game.interface'
import type { IGameState } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type {
  IStoreService,
  IRandomService,
  ILoggerService,
  IUIDecisionService,
} from '@core/contracts/services.interface'
import { RoleType, LogLevel, GamePhase } from '@core/contracts/enums'

// ── 标准模式配置 ──
import { standard5pConfig } from '@source/modes/standard-5p'
import { standard8pConfig } from '@source/modes/standard-8p'

// ── 默认服务实现 ──

/**
 * 默认随机服务（使用 Math.random）。
 */
class DefaultRandomService implements IRandomService {
  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
  }

  nextInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)]!
  }

  pickN<T>(array: T[], n: number): T[] {
    return this.shuffle([...array]).slice(0, n)
  }

  uuid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

/**
 * 默认控制台日志服务。
 */
class DefaultLoggerService implements ILoggerService {
  private logs: Array<{ message: string; level: LogLevel; timestamp: number }> = []

  log(message: string, level: LogLevel): void {
    this.logs.push({ message, level, timestamp: Date.now() })
    const prefix = `[GameBoot][${level}]`
    switch (level) {
      case LogLevel.Error:
        console.error(prefix, message)
        break
      case LogLevel.Warn:
        console.warn(prefix, message)
        break
      case LogLevel.Debug:
        console.debug(prefix, message)
        break
      default:
        console.log(prefix, message)
    }
  }

  debug(message: string): void {
    this.log(message, LogLevel.Debug)
  }
  info(message: string): void {
    this.log(message, LogLevel.Info)
  }
  warn(message: string): void {
    this.log(message, LogLevel.Warn)
  }
  error(message: string): void {
    this.log(message, LogLevel.Error)
  }

  getLogs(): ReadonlyArray<{ message: string; level: LogLevel; timestamp: number }> {
    return this.logs
  }

  clear(): void {
    this.logs = []
  }
}

// ── GameBoot 配置选项 ──

/**
 * GameBoot 的配置选项。
 *
 * 允许在启动时注入自定义服务实现。
 */
export interface GameBootOptions {
  /** 随机服务（洗牌等），不提供则使用 Math.random */
  randomService?: IRandomService
  /** 日志服务，不提供则使用 console */
  loggerService?: ILoggerService
  /** 存储服务（同步到 UI），不提供则使用内存储存 */
  storeService?: IStoreService
  /** 决策服务（玩家交互/AI），不提供则引擎以自动模式运行 */
  decisionService?: IUIDecisionService
  /** 摸牌阶段摸牌数（默认 2） */
  drawCount?: number
}

/**
 * GameBoot 启动后返回的状态。
 */
export interface BootResult {
  engine: GameEngine
  config: IGameConfig
  phase: GamePhase
  started: boolean
}

// ── GameBoot ──

/**
 * GameBoot — 游戏启动引导器
 *
 * 将配置加载、服务注册、引擎初始化串联为一条完整的启动链路。
 *
 * 使用方式：
 * ```ts
 * // 方式 1：使用构造函数
 * const boot = new GameBoot(config, { randomService: myRandom })
 * const { engine } = await boot.boot()
 * await boot.start()
 *
 * // 方式 2：标准模式快捷方法
 * const boot = GameBoot.createStandard5P()
 * await boot.boot()
 * await boot.start()
 *
 * // 方式 3：AI 自动模式
 * const boot = GameBoot.createStandard8P()
 * const result = await boot.runGameLoop()  // 自动运行到结束
 * ```
 */
export class GameBoot {
  private engine: GameEngine | null = null
  private config: IGameConfig
  private options: GameBootOptions

  // ── 服务实例 ──
  private randomService: IRandomService
  private loggerService: ILoggerService
  private storeService: IStoreService
  private decisionService?: IUIDecisionService

  /**
   * @param config  游戏配置
   * @param options 启动选项
   */
  constructor(config: IGameConfig, options?: GameBootOptions) {
    this.config = { ...config }
    this.options = options ?? {}

    // 初始化服务
    this.randomService = options?.randomService ?? new DefaultRandomService()
    this.loggerService = options?.loggerService ?? new DefaultLoggerService()
    this.storeService = options?.storeService ?? new StoreService()
    this.decisionService = options?.decisionService
  }

  // ── 静态工厂方法：标准游戏模式 ──

  /**
   * 创建标准 5 人局 GameBoot。
   *
   * 身份分布：1 Aspect + 1 Guardian + 2 Ascended + 1 Infiltrator
   *
   * @param options 启动选项
   */
  static createStandard5P(options?: GameBootOptions): GameBoot {
    return new GameBoot({ ...standard5pConfig }, options)
  }

  /**
   * 创建标准 8 人局 GameBoot。
   *
   * 身份分布：1 Aspect + 2 Guardian + 4 Ascended + 1 Infiltrator
   *
   * @param options 启动选项
   */
  static createStandard8P(options?: GameBootOptions): GameBoot {
    return new GameBoot({ ...standard8pConfig }, options)
  }

  /**
   * 从自定义配置创建 GameBoot。
   *
   * @param config  自定义游戏配置
   * @param options 启动选项
   */
  static create(config: IGameConfig, options?: GameBootOptions): GameBoot {
    return new GameBoot(config, options)
  }

  // ── 生命周期 ──

  /**
   * 执行完整的启动引导流程。
   *
   * 流程：
   * 1. 验证配置有效性
   * 2. 创建 GameEngine 并注入服务
   * 3. 调用 engine.init(config) → 分配角色、英雄、手牌
   * 4. 返回 BootResult
   *
   * 注意：此方法在 init 后停止，不会自动调用 start()。
   * 调用方可以在 start() 前进行额外的设置（如绑定 UI Store）。
   *
   * @returns BootResult 包含引擎实例和状态
   */
  async boot(): Promise<BootResult> {
    this.loggerService.info(
      `GameBoot.boot() — 开始启动游戏 (模式: ${this.config.mode}, 玩家: ${this.config.playerCount})`,
    )

    // 1. 验证配置
    this.validateConfig()

    // 2. 创建 GameEngine
    const engineOptions: GameEngineOptions = {
      randomService: this.randomService,
      loggerService: this.loggerService,
      storeService: this.storeService,
      decisionService: this.decisionService,
      drawCount: this.options.drawCount,
    }
    this.engine = new GameEngine(engineOptions)

    // 3. 初始化引擎
    await this.engine.init(this.config)

    this.loggerService.info(
      `GameBoot.boot() — 引擎初始化完成 ` +
        `(玩家: ${this.engine.state.players.length}, ` +
        `牌堆: ${this.engine.state.deck.length} 张, ` +
        `轮次: ${this.engine.state.currentRound})`,
    )

    return {
      engine: this.engine,
      config: this.config,
      phase: this.engine.state.currentPhase,
      started: this.engine.state.started,
    }
  }

  /**
   * 启动游戏——进入第一个回合。
   *
   * 必须在 boot() 之后调用。
   *
   * 流程：触发 GameStart → RoundStart → 第一个玩家的 PhasePre → 执行完整回合
   */
  async start(): Promise<void> {
    if (!this.engine) {
      throw new Error('[GameBoot] 尚未调用 boot()，请先执行启动引导')
    }

    this.loggerService.info('GameBoot.start() — 游戏开始')
    await this.engine.start()

    this.loggerService.info(
      `GameBoot.start() — 游戏已启动，当前阶段: ${this.engine.state.currentPhase}`,
    )
  }

  /**
   * 运行完整的游戏循环（AI 自动模式）。
   *
   * 适用于：
   * - AI vs AI 模拟
   * - 自动化测试
   * - 批量对局统计
   *
   * 调用此方法前必须先调用 boot()。
   * 此方法会自动推进所有轮次直到游戏结束。
   *
   * @returns 游戏结果
   */
  async runGameLoop(): Promise<IGameResult> {
    if (!this.engine) {
      throw new Error('[GameBoot] 尚未调用 boot()，请先执行启动引导')
    }

    this.loggerService.info('GameBoot.runGameLoop() — 开始自动游戏循环')

    // 如果尚未 start，先 start
    if (this.engine.state.currentPhase === GamePhase.Prepare) {
      await this.start()
    }

    const result = await this.engine.runGameLoop()

    this.loggerService.info(
      `GameBoot.runGameLoop() — 游戏结束: ${result.reason} ` +
        `(胜者: ${result.winner ?? '无'}, 轮次: ${result.totalRounds})`,
    )

    return result
  }

  /**
   * 一键启动并运行完整游戏（boot + start + runGameLoop）。
   *
   * 最简使用方式——适用于 AI 对战和测试场景。
   *
   * @returns 游戏结果
   */
  async run(): Promise<IGameResult> {
    await this.boot()
    return this.runGameLoop()
  }

  // ── 查询 ──

  /**
   * 获取当前引擎实例。
   */
  getEngine(): GameEngine | null {
    return this.engine
  }

  /**
   * 获取当前游戏状态快照。
   */
  getState(): Readonly<IGameState> | null {
    return this.engine?.getState() ?? null
  }

  /**
   * 获取当前行动玩家。
   */
  getCurrentPlayer(): IPlayer | undefined {
    return this.engine?.getCurrentPlayer()
  }

  /**
   * 游戏是否已结束。
   */
  get isGameOver(): boolean {
    return this.engine?.isGameOver ?? false
  }

  /**
   * 获取注入的存储服务（用于绑定 Pinia Store）。
   */
  getStoreService(): IStoreService {
    return this.storeService
  }

  /**
   * 获取注入的日志服务。
   */
  getLoggerService(): ILoggerService {
    return this.loggerService
  }

  /**
   * 获取注入的随机服务。
   */
  getRandomService(): IRandomService {
    return this.randomService
  }

  // ── 私有方法 ──

  /**
   * 验证游戏配置的有效性。
   *
   * @throws 如果配置无效
   */
  private validateConfig(): void {
    const { config } = this

    // 玩家数量检查
    if (config.playerCount < 2) {
      throw new Error('[GameBoot] 玩家数量必须至少为 2')
    }
    if (config.playerCount > 10) {
      throw new Error('[GameBoot] 玩家数量最多为 10')
    }

    // 身份与玩家数量匹配
    if (config.roles.length !== config.playerCount) {
      throw new Error(
        `[GameBoot] 身份数量 (${config.roles.length}) 与玩家数量 (${config.playerCount}) 不匹配`,
      )
    }

    // 必须有一个主公
    if (!config.roles.includes(RoleType.Aspect)) {
      throw new Error('[GameBoot] 游戏必须有一个天命星灵 (Aspect / 主公)')
    }

    // 英雄池检查
    const heroCount = config.heroes.length
    const neededHeroes = config.playerCount * config.heroSelectCount
    if (heroCount > 0 && heroCount < neededHeroes) {
      this.loggerService.warn(
        `[GameBoot] 英雄池数量 (${heroCount}) 不足以为每位玩家提供 ` +
          `${config.heroSelectCount} 名候选 (需要 ${neededHeroes})。将重用英雄。`,
      )
    }

    // 卡牌数量检查
    const totalCardsInDeck = config.cards.reduce((sum) => sum + 1, 0)
    const minCards = config.playerCount * (config.initialHandSize + 5) // 初始手牌 + 缓冲
    if (config.cards.length > 0 && totalCardsInDeck < minCards) {
      this.loggerService.warn(
        `[GameBoot] 卡牌种类较少 (${config.cards.length} 种)，` +
          `建议至少 ${minCards} 张卡牌以确保游戏可进行`,
      )
    }

    this.loggerService.debug(
      `[GameBoot] 配置验证通过: ${config.playerCount} 人, ` +
        `${config.roles.length} 身份, ${config.heroes.length} 英雄, ` +
        `${config.cards.length} 种卡牌`,
    )
  }
}
