// ============================================================
// 联盟杀 · 游戏状态与配置接口
// ============================================================

import type { GamePhase, RoleType } from './enums'
import type { LogEntry } from './types'
import type { IPlayer } from './player.interface'
import type { ICard, CardDefinition } from './card.interface'
import type { IHero } from './hero.interface'

/**
 * 游戏模式配置
 */
export interface IGameConfig {
  mode: string
  playerCount: number
  roles: RoleType[]
  heroes: IHero[]
  cards: CardDefinition[]
  heroSelectCount: number
  initialHandSize: number
  equipEnabled: boolean
  delayedCardEnabled: boolean
  maxRounds: number
}

/**
 * 游戏全局状态
 */
/**
 * 游戏状态的可序列化快照 —— 纯数据 + 派生只读字段，无行为方法。
 *
 * UI（Pinia Store）与回放系统一律消费快照，不接触 `IGameState`。
 */
export interface GameStateSnapshot {
  /** 全部玩家（按座次排列） */
  players: IPlayer[]
  /** 牌堆 */
  deck: ICard[]
  /** 弃牌堆 */
  discardPile: ICard[]
  /** 当前轮次 */
  currentRound: number
  /** 当前行动玩家的座位索引 */
  currentPlayerIndex: number
  /** 当前阶段 */
  currentPhase: GamePhase
  /** 阶段索引 */
  phaseIndex: number
  /** 游戏日志 */
  log: LogEntry[]
  /** 游戏配置 */
  config: IGameConfig
  /** 是否已开始 */
  started: boolean
  /** 是否已结束 */
  finished: boolean
  /** 结算中的卡牌 */
  processingCards: ICard[]

  // ── 派生状态 ──
  /** 存活玩家列表 */
  readonly alivePlayers: IPlayer[]
  /** 存活玩家数量 */
  readonly aliveCount: number
}

/** 游戏全局状态 —— 快照 + 行为 */
export interface IGameState extends GameStateSnapshot {
  /**
   * 追加一条游戏日志
   *
   * 时间与序号由实现方盖章，调用方传不进来——详见 `types.ts` 里
   * 「一条日志有两个时间」那段说明。唯一允许指定的例外是 `id`：
   * 那是给调用方事后认回自己那条用的（例如把日志与某次回血对应起来）。
   */
  addLog(entry: Omit<LogEntry, 'tick' | 'id'> & { id?: string }): void
  /**
   * 下一条日志的 id
   *
   * 自增序号而非时间戳 / 随机数：后两者会让「两局同一过程」的日志
   * 连 id 都对不上，回放比对里全是噪声。
   */
  nextLogId(prefix?: string): string
}

/**
 * 游戏结果
 */
export interface IGameResult {
  winner: RoleType | null
  reason: string
  survivingPlayers: IPlayer[]
  totalRounds: number
  endedAt: number
}
