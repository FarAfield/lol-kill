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
import type { EventName } from './event-name'

// ── 日志 ──
//
// 一条日志有**两个**时间，它们回答的是不同的问题，混在一起就会出事：
//
// | 字段        | 谁盖的        | 回答什么            | 是否进游戏状态 |
// |-------------|---------------|---------------------|----------------|
// | `tick`      | GameState     | 「这是本局第几步」  | 是             |
// | `wallClock` | 呈现层 store  | 「现在几点几分」    | **否**         |
//
// Phase 20 之前这里只有一个 `timestamp`，由引擎自己 `Date.now()` 填上——
// 于是「现在是几点几分」这个纯粹属于呈现层的关心，被人塞进了游戏状态。
// 后果不止于难看：同一份录像放两次，两边的日志时间戳必然对不上，
// 而它在 `state.log` 里，于是「逐字节比对两局是否一致」这件本该干净的事，
// 必须先记得把时间戳剔除掉——忘了就是一次假阳性，而假阳性会让人
// 慢慢不再相信这套比对。
//
// 现在：状态里的日志只带逻辑刻度（GameState 盖章，调用方传不进来），
// UI 想显示几点几分，在日志进入 presentation store 的那一刻自己补。

/**
 * 游戏日志条目（**进游戏状态**的那一份）
 *
 * `tick` 由 `IGameState.addLog` 盖，`id` 由 `nextLogId` 发——两者都不由
 * 调用方指定。日志的序号与时间必须出自同一处：否则「这两局是不是同一局」
 * 就永远要补一句「除了时间戳以外」，而那句话正是 bug 最喜欢躲的地方。
 */
export interface LogEntry {
  id: string
  /**
   * 逻辑刻度——本局内的第几步
   *
   * 取的是 `core/utils/clock` 的递增计数器，不是 `Date.now()`。
   * 同一份过程重放两次，同一条日志拿到同一个刻度。
   */
  tick: number
  round: number
  phase: GamePhase
  message: string
  level: LogLevel
  sourcePlayerId?: string
  targetPlayerIds?: string[]

  // ── Phase 20：结构化字段 ──
  /**
   * 触发这条日志的事件名
   *
   * 有它才能把「一行字」还原回「一次结算」——排查「伤害为什么是
   * 3 点」时，人需要顺着事件名找到那条 `damage` 事件，而不是在
   * 一屏文本里捞针。
   */
  eventName?: EventName
  /** 涉及的卡牌实例 id */
  cardIds?: string[]
  /** 本次结算的通用数值（伤害点数 / 摸牌数 / 回复量…） */
  num?: number
}

/**
 * 呈现层日志条目
 *
 * 在 `LogEntry` 之上补一个墙钟——**这份对象不进游戏状态**，
 * 它由 UI 的 store 在进入显示层的那一刻补上。
 */
export interface UILogEntry extends LogEntry {
  /** 墙上时间（`Date.now()`），仅用于 UI 显示「几点几分」 */
  timestamp: number
}
