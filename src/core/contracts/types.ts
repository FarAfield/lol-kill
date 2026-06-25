// ============================================================
// 联盟杀 · 基础类型别名
// ============================================================

/**
 * 卡牌点数 (1–13: A, 2–10, J, Q, K)
 */
export type CardRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13

/**
 * 座位位置索引 (0-based)
 */
export type Position = number

/**
 * 唯一标识符
 */
export type CardId = string
export type PlayerId = string
export type SkillId = string
export type HeroId = string
export type EventId = string

/**
 * 体力值
 */
export type Hp = number

/**
 * 距离
 */
export type Distance = number

import type { LogLevel, GamePhase } from './enums'

/**
 * 游戏日志条目
 */
export interface LogEntry {
  id: string
  timestamp: number
  round: number
  phase: GamePhase
  message: string
  level: LogLevel
  sourcePlayerId?: string
  targetPlayerIds?: string[]
}
