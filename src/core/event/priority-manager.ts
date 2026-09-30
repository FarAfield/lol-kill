// ============================================================
// 联盟杀 · PriorityManager — 同时机 handler 排序管理器
// ============================================================

import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { IPlayer } from '@core/contracts/player.interface'
import { seatDistance } from './settlement'

/**
 * 对同时机的 handler 按优先级排序
 *
 * @param handlers - 待排序的 handler 列表
 * @param deduplicate - 是否去重同名技能（默认 true）
 * @returns 排序后的 handler 列表
 */
export function sortHandlers(
  handlers: CompiledHandler[],
  deduplicate = true,
): CompiledHandler[] {
  const sorted = [...handlers].sort((a, b) => {
    // 1. 锁定技优先
    if (a.isLocked && !b.isLocked) return -1
    if (!a.isLocked && b.isLocked) return 1
    // 2. 优先级高的优先
    if (a.priority !== b.priority) {
      return b.priority - a.priority
    }
    // 3. 优先级相同时保持原顺序（稳定排序）
    return 0
  })
  if (!deduplicate) return sorted
  // 去重：同名技能只保留优先级最高的一条
  const seen = new Set<string>()
  const result: CompiledHandler[] = []
  for (const handler of sorted) {
    if (seen.has(handler.skillId)) continue
    seen.add(handler.skillId)
    result.push(handler)
  }
  return result
}

/**
 * PriorityManager — 同时机 handler 排序管理器
 */
export class PriorityManager {
  /**
   * 对 handler 列表排序并去重
   */
  prioritize(handlers: CompiledHandler[]): CompiledHandler[] {
    return sortHandlers(handlers, true)
  }

  /**
   * 仅排序不去重（用于需要多次触发的场景）
   */
  prioritizeNoDedupe(handlers: CompiledHandler[]): CompiledHandler[] {
    return sortHandlers(handlers, false)
  }

  /**
   * 按玩家座位顺序对 handler 进行二次排序
   *
   * 当优先级完全相同时，按玩家座位号排序。
   * 用于「多名玩家同时触发」的场景（如南蛮入侵响应顺序）。
   * 注意：需要从外部传入 playerSeatMap 进行 playerId → seatIndex 的映射。
   */
  sortBySeatOrder(handlers: CompiledHandler[], playerSeatMap: Map<string, number>): CompiledHandler[] {
    return [...handlers].sort((a, b) => {
      if (a.isLocked && !b.isLocked) return -1
      if (!a.isLocked && b.isLocked) return 1
      if (a.priority !== b.priority) return b.priority - a.priority
      const seatA = playerSeatMap.get(a.playerId) ?? 0
      const seatB = playerSeatMap.get(b.playerId) ?? 0
      return seatA - seatB
    })
  }

  /**
   * 按「距当前行动者的座次差」二次排序
   *
   * 同优先级且同锁定状态时，离发起者**近**的先结算——
   * 顺时针顺序是三国杀里一切「多名玩家同时触发」的默认裁决规则。
   *
   * @param handlers 待排序列表
   * @param from     当前行动者（排序锚点）
   * @param seatOf   取玩家座次的映射（避免依赖 handler 上是否挂了 player 实体）
   */
  sortBySeatDistance(
    handlers: CompiledHandler[],
    from: IPlayer,
    seatOf: (playerId: string) => number,
    total: number,
  ): CompiledHandler[] {
    const distance = (playerId: string): number =>
      seatDistance(from.seatIndex, seatOf(playerId), total)

    return [...handlers].sort((a, b) => {
      if (a.isLocked && !b.isLocked) return -1
      if (!a.isLocked && b.isLocked) return 1
      if (a.priority !== b.priority) return b.priority - a.priority
      return distance(a.playerId) - distance(b.playerId)
    })
  }

  /**
   * 分组：将 handler 按玩家分组
   */
  groupByPlayer(handlers: CompiledHandler[]): Map<string, CompiledHandler[]> {
    const groups = new Map<string, CompiledHandler[]>()
    for (const handler of handlers) {
      const existing = groups.get(handler.playerId)
      if (existing) {
        existing.push(handler)
      } else {
        groups.set(handler.playerId, [handler])
      }
    }
    return groups
  }
}
