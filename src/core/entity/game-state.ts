// ============================================================
// 联盟杀 · GameState 实体
//
// 游戏全局状态——纯内存对象（非响应式）。
// 引擎通过此对象追踪所有游戏数据，并通过 IStoreService 同步到 UI 层。
// ============================================================

import { GamePhase, RoleType } from '@core/contracts/enums'
import type { LogEntry } from '@core/contracts/types'
import type {
  IGameState,
  GameStateSnapshot,
  IGameConfig,
  IGameResult,
} from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { gameClock } from '@core/utils/clock'

// ── 默认配置 ──

/**
 * 创建默认游戏配置。
 */
export function createDefaultConfig(overrides?: Partial<IGameConfig>): IGameConfig {
  return {
    mode: 'standard-5p',
    playerCount: 5,
    roles: [],
    heroes: [],
    cards: [],
    heroSelectCount: 3,
    initialHandSize: 4,
    equipEnabled: true,
    delayedCardEnabled: true,
    maxRounds: 100,
    ...overrides,
  }
}

// ── 游戏状态实体 ──

export class GameState implements IGameState {
  players: IPlayer[]
  deck: ICard[]
  discardPile: ICard[]
  currentRound: number
  currentPlayerIndex: number
  currentPhase: GamePhase
  phaseIndex: number
  log: LogEntry[]
  config: IGameConfig
  started: boolean
  finished: boolean
  processingCards: ICard[]

  /** 日志 id 的自增序号（跨局由 `reset()` 归零） */
  private logSeq = 0

  constructor(data?: Partial<GameStateSnapshot>) {
    this.players = data?.players ?? []
    this.deck = data?.deck ?? []
    this.discardPile = data?.discardPile ?? []
    this.currentRound = data?.currentRound ?? 0
    this.currentPlayerIndex = data?.currentPlayerIndex ?? 0
    this.currentPhase = data?.currentPhase ?? GamePhase.NotStarted
    this.phaseIndex = data?.phaseIndex ?? 0
    this.log = data?.log ?? []
    this.config = data?.config ?? createDefaultConfig()
    this.started = data?.started ?? false
    this.finished = data?.finished ?? false
    this.processingCards = data?.processingCards ?? []
  }

  // ── 工厂方法 ──

  /**
   * 创建一个新的 GameState 实例。
   *
   * @param config 游戏配置
   * @param overrides 可选覆盖项
   */
  static create(config: IGameConfig, overrides?: Partial<GameStateSnapshot>): GameState {
    return new GameState({
      config,
      currentRound: 1,
      currentPlayerIndex: 0,
      currentPhase: GamePhase.NotStarted,
      phaseIndex: 0,
      started: false,
      finished: false,
      ...overrides,
    })
  }

  /**
   * 原地重置为新一局。
   *
   * **这是 `init()` 唯一允许的状态重建入口**——禁止替换 `GameState` 实例本身。
   * 引擎的子系统（DeckManager / CardSystem / TurnManager 等）与 `EventDispatcher.deps`
   * 都持有本对象的引用，替换实例会让它们全部指向废弃对象。
   *
   * @param config    新的游戏配置
   * @param overrides 可选覆盖项
   */
  reset(config: IGameConfig, overrides?: Partial<GameStateSnapshot>): void {
    this.players = overrides?.players ?? []
    this.deck = overrides?.deck ?? []
    this.discardPile = overrides?.discardPile ?? []
    this.currentRound = overrides?.currentRound ?? 1
    this.currentPlayerIndex = overrides?.currentPlayerIndex ?? 0
    this.currentPhase = overrides?.currentPhase ?? GamePhase.NotStarted
    this.phaseIndex = overrides?.phaseIndex ?? 0
    this.log = overrides?.log ?? []
    this.config = overrides?.config ?? config
    this.started = overrides?.started ?? false
    this.finished = overrides?.finished ?? false
    this.processingCards = overrides?.processingCards ?? []
    this.logSeq = 0
  }

  // ── 玩家查询 ──

  /**
   * 获取当前行动玩家。
   */
  get currentPlayer(): IPlayer | undefined {
    return this.players[this.currentPlayerIndex]
  }

  /**
   * 获取存活玩家列表。
   */
  get alivePlayers(): IPlayer[] {
    return this.players.filter((p) => p.alive)
  }

  /**
   * 获取存活玩家数量。
   */
  get aliveCount(): number {
    return this.alivePlayers.length
  }

  /**
   * 根据 ID 查找玩家。
   */
  getPlayerById(id: string): IPlayer | undefined {
    return this.players.find((p) => p.id === id)
  }

  /**
   * 获取指定身份的玩家列表。
   */
  getPlayersByRole(role: RoleType): IPlayer[] {
    return this.players.filter((p) => p.role === role)
  }

  /**
   * 获取主公（天命星灵）。
   */
  get lord(): IPlayer | undefined {
    return this.players.find((p) => p.role === RoleType.Aspect)
  }

  // ── 回合操作 ──

  /**
   * 推进到下一个存活玩家。
   *
   * @returns 新的 currentPlayerIndex，如果找不到存活玩家则返回 -1
   */
  advanceToNextPlayer(): number {
    const playerCount = this.players.length
    if (playerCount === 0) {
      this.currentPlayerIndex = 0
      return 0
    }

    for (let i = 1; i <= playerCount; i++) {
      const nextIndex = (this.currentPlayerIndex + i) % playerCount
      const nextPlayer = this.players[nextIndex]
      if (nextPlayer?.alive) {
        this.currentPlayerIndex = nextIndex
        return nextIndex
      }
    }

    // 没有存活玩家
    return -1
  }

  /**
   * 开始新的一轮。
   */
  startNewRound(): void {
    this.currentRound++
    this.currentPlayerIndex = 0
  }

  // ── 牌堆操作 ──

  /**
   * 从牌堆顶部抽牌。
   *
   * @param count 抽牌数量
   * @returns 抽到的卡牌数组（可能少于 count，如果牌堆不足）
   */
  drawFromDeck(count: number): ICard[] {
    const drawn: ICard[] = []
    for (let i = 0; i < count; i++) {
      const card = this.deck.pop()
      if (card) {
        drawn.push(card)
      } else {
        // 牌堆耗尽，尝试回收弃牌堆
        if (this.recycleDiscardPile()) {
          const recycled = this.deck.pop()
          if (recycled) {
            drawn.push(recycled)
            continue
          }
        }
        break // 无牌可抽
      }
    }
    return drawn
  }

  /**
   * 将卡牌放入弃牌堆。
   */
  discardCards(cards: ICard[]): void {
    this.discardPile.push(...cards)
  }

  /**
   * 回收弃牌堆：将弃牌堆洗牌后移回牌堆。
   *
   * @returns 是否成功回收（弃牌堆有牌）
   */
  recycleDiscardPile(): boolean {
    if (this.discardPile.length === 0) return false
    this.deck.push(...this.discardPile)
    this.discardPile = []
    // 洗牌由 IRandomService 处理，此处仅做数据转移
    return true
  }

  /**
   * 牌堆是否为空。
   */
  get isDeckEmpty(): boolean {
    return this.deck.length === 0
  }

  /**
   * 牌堆和弃牌堆的总卡牌数。
   */
  get totalCardsAvailable(): number {
    return this.deck.length + this.discardPile.length
  }

  // ── 日志操作 ──

  /**
   * 添加一条游戏日志
   *
   * **时间与序号都不接受外部传入**——它们由本方法自己盖：
   * - `tick` 取逻辑时钟当前刻度（不推进它，只读取）
   * - `id` 未给出时用 `nextLogId` 发
   *
   * 这不是洁癖。`EffectContext` 里曾经写死 `timestamp: Date.now()`，
   * 于是「同一份录像放两次」这件事在日志这一层天然不成立——
   * 回放比对每次都得额外记得剔除时间戳，忘一次就是一次假阳性。
   * 让调用方**没法**指定时间，这条规则就从「记得遵守」变成「不可能违反」。
   *
   * 再者 `tick` 只**读**逻辑时钟、不推进它：观测不该改变被观测的东西——
   * 每写一条日志就把时钟往前拨一格，后续事件的 timestamp 会整体错位。
   */
  addLog(entry: Omit<LogEntry, 'tick' | 'id'> & { id?: string }): void {
    this.log.push({
      ...entry,
      id: entry.id ?? this.nextLogId(),
      tick: gameClock.now,
    })
  }

  /**
   * 下一条日志的 id
   *
   * 自增序号而非时间戳 / 随机数：后者会让「两局同一过程」的日志
   * 连 id 都对不上，回放比对里全是噪声。
   */
  nextLogId(prefix = 'log'): string {
    return `${prefix}_${++this.logSeq}`
  }

  /**
   * 获取最近的 N 条日志。
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.log.slice(-count)
  }

  /**
   * 清理旧日志（保留最近 N 条）。
   */
  trimLogs(keepCount: number = 500): void {
    if (this.log.length > keepCount) {
      this.log = this.log.slice(-keepCount)
    }
  }

  // ── 游戏流程 ──

  /**
   * 标记游戏为已开始。
   */
  markStarted(): void {
    this.started = true
    this.currentPhase = GamePhase.Prepare
  }

  /**
   * 标记游戏为已结束。
   */
  markFinished(): void {
    this.finished = true
    this.currentPhase = GamePhase.GameOver
  }

  /**
   * 构建游戏结果。
   */
  buildResult(winner: RoleType | null, reason: string): IGameResult {
    return {
      winner,
      reason,
      survivingPlayers: this.alivePlayers,
      totalRounds: this.currentRound,
      endedAt: gameClock.next(),
    }
  }

  // ── 序列化 ──

  /**
   * 将游戏状态序列化为纯对象（浅拷贝）。
   *
   * 数组通过展开运算符复制，但数组内的对象（Player、Card 等）是共享引用。
   * 用于 StoreService 同步——轻量且快速。调用方不应修改返回的对象属性。
   */
  toJSON(): GameStateSnapshot {
    return {
      players: [...this.players],
      deck: [...this.deck],
      discardPile: [...this.discardPile],
      currentRound: this.currentRound,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPhase: this.currentPhase,
      phaseIndex: this.phaseIndex,
      log: [...this.log],
      config: { ...this.config },
      started: this.started,
      finished: this.finished,
      processingCards: [...this.processingCards],
      alivePlayers: this.alivePlayers,
      aliveCount: this.aliveCount,
    }
  }

  /**
   * 获取只读快照（等同于 toJSON，浅拷贝）。
   */
  snapshot(): Readonly<GameStateSnapshot> {
    return this.toJSON()
  }

  /**
   * 生成游戏状态的完整深拷贝。
   *
   * 使用 structuredClone 彻底复制所有嵌套对象（Player、Card、Map 等）。
   * 返回的对象与原始状态完全独立——修改副本不影响原状态。
   *
   * **用途**：
   * - 游戏存档 / 读档
   * - 回放系统（检查点快照）
   * - 测试验证（比较状态变更前后）
   *
   * **性能注意**：深拷贝有开销，不适合高频调用（如 StoreService 同步）。
   * StoreService 应使用 toJSON()（浅拷贝），replay/save 使用 deepClone()。
   *
   * @returns 完全独立的 GameStateSnapshot 副本
   */
  deepClone(): GameStateSnapshot {
    return structuredClone(this.toJSON())
  }

  /**
   * 从序列化数据恢复 GameState。
   *
   * 配合 deepClone() 使用可实现完整的存档/读档。
   *
   * @param data 通过 deepClone() 或 toJSON() 获得的游戏状态数据
   * @returns 新的 GameState 实例
   *
   * @example
   * ```ts
   * // 存档
   * const saved = gameState.deepClone()
   *
   * // 读档
   * const restored = GameState.restore(saved)
   * ```
   */
  static restore(data: GameStateSnapshot): GameState {
    return new GameState(data)
  }
}
