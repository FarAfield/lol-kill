// ============================================================
// 联盟杀 · 基础类型别名 & 通用工具类
// ============================================================

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
