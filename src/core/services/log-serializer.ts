// ============================================================
// 联盟杀 · LogSerializer — 游戏日志序列化
//
// 将 LogEntry[] 序列化为 JSON 字符串，便于存档、传输和回放。
// ============================================================

import type { LogEntry } from '@core/contracts/types'
import type { IGameState } from '@core/contracts/game.interface'

/**
 * 游戏录像数据结构
 *
 * 包含完整的初始状态和操作日志，可独立用于回放。
 */
export interface GameReplayData {
  /** 格式版本号 */
  version: number
  /** 游戏模式 */
  mode: string
  /** 玩家数量 */
  playerCount: number
  /** 总轮次 */
  totalRounds: number
  /** 游戏结果简述 */
  result: string
  /** 初始游戏状态（deep clone） */
  initialState: IGameState
  /** 操作日志序列 */
  logs: LogEntry[]
  /** 最终游戏状态（deep clone） */
  finalState: IGameState
  /** 录像创建时间戳 */
  createdAt: number
}

/**
 * 日志序列化器
 *
 * 提供 LogEntry[] 和 GameReplayData 的序列化/反序列化。
 * 纯数据转换，无副作用。
 */
export class LogSerializer {
  /** 当前录像格式版本 */
  static readonly VERSION = 1

  /**
   * 将日志数组序列化为 JSON 字符串。
   *
   * @param logs 日志条目数组
   * @returns 美化的 JSON 字符串（indent=2）
   */
  static serializeLogs(logs: LogEntry[]): string {
    return JSON.stringify(logs, null, 2)
  }

  /**
   * 从 JSON 字符串反序列化日志数组。
   *
   * @param json JSON 字符串
   * @returns 日志条目数组
   * @throws 如果 JSON 格式无效
   */
  static deserializeLogs(json: string): LogEntry[] {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) {
      throw new Error('[LogSerializer] JSON 数据不是数组格式')
    }
    return parsed as LogEntry[]
  }

  /**
   * 创建完整录像数据。
   *
   * @param initialState 游戏开始时的状态快照
   * @param logs        完整操作日志
   * @param finalState  游戏结束时的状态快照
   * @param result      游戏结果简述
   * @returns 录像数据结构
   */
  static createReplayData(
    initialState: IGameState,
    logs: LogEntry[],
    finalState: IGameState,
    result: string,
  ): GameReplayData {
    return {
      version: LogSerializer.VERSION,
      mode: initialState.config.mode,
      playerCount: initialState.players.length,
      totalRounds: initialState.currentRound,
      result,
      initialState,
      logs: [...logs],
      finalState,
      createdAt: Date.now(),
    }
  }

  /**
   * 序列化完整录像数据为 JSON 字符串。
   *
   * @param replay 录像数据
   * @returns JSON 字符串
   */
  static serializeReplay(replay: GameReplayData): string {
    return JSON.stringify(replay, null, 2)
  }

  /**
   * 从 JSON 字符串反序列化录像数据。
   *
   * @param json JSON 字符串
   * @returns 录像数据结构
   * @throws 如果 JSON 格式无效或版本不兼容
   */
  static deserializeReplay(json: string): GameReplayData {
    const parsed = JSON.parse(json) as GameReplayData

    if (!parsed.version || !parsed.initialState || !Array.isArray(parsed.logs)) {
      throw new Error('[LogSerializer] 录像数据格式无效：缺少必要字段')
    }

    if (parsed.version > LogSerializer.VERSION) {
      throw new Error(
        `[LogSerializer] 录像版本 ${parsed.version} 不兼容（当前支持版本 ≤ ${LogSerializer.VERSION}）`,
      )
    }

    return parsed
  }

  /**
   * 比较两次序列化结果是否一致（用于测试回放正确性）。
   *
   * @param a 第一次序列化
   * @param b 第二次序列化
   * @returns true = 日志内容一致
   */
  static compareLogs(a: LogEntry[], b: LogEntry[]): boolean {
    if (a.length !== b.length) return false
    return a.every((entry, i) => {
      const other = b[i]!
      return (
        entry.message === other.message &&
        entry.round === other.round &&
        entry.phase === other.phase &&
        entry.level === other.level
      )
    })
  }
}
