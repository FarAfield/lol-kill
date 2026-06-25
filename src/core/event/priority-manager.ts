// ============================================================
// 联盟杀 · PriorityManager — 同时机技能优先级排序
//
// 当多个技能在同一时机触发时，需要按优先级确定结算顺序。
// 排序规则:
//   1. 锁定技 (locked) 优先于非锁定技
//   2. 优先级数值高的优先
//   3. 同名技能去重（同一 skillId 只保留优先级最高的一条）
//
// 三国杀规则参考:
//   - 锁定技总是最先触发（如马超的「马术」）
//   - 同等条件下按技能声明顺序或玩家座位顺序结算
// ============================================================

import type { EventHookRegistration } from '@core/contracts/event.interface'

/**
 * 对同时机的技能钩子按优先级排序
 *
 * @param hooks - 待排序的钩子注册信息列表
 * @param deduplicate - 是否去重同名技能（默认 true）
 * @returns 排序后的钩子列表
 */
export function sortHooks(
  hooks: EventHookRegistration[],
  deduplicate = true,
): EventHookRegistration[] {
  const sorted = [...hooks].sort((a, b) => {
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

  // 去重：同名技能只保留优先级最高的一条（已在排序中靠前）
  const seen = new Set<string>()
  const result: EventHookRegistration[] = []

  for (const hook of sorted) {
    if (seen.has(hook.skillId)) continue
    seen.add(hook.skillId)
    result.push(hook)
  }

  return result
}

/**
 * PriorityManager — 同时机技能排序管理器
 *
 * 在 EventDispatcher 推进事件到某阶段时，
 * EventTrigger 返回所有匹配的钩子后，由 PriorityManager 确定执行顺序。
 */
export class PriorityManager {
  /**
   * 对钩子列表排序并去重
   *
   * 排序优先级: 锁定技 > priority 数值高 > 原顺序
   */
  prioritize(hooks: EventHookRegistration[]): EventHookRegistration[] {
    return sortHooks(hooks, true)
  }

  /**
   * 仅排序不去重（用于需要多次触发的场景）
   */
  prioritizeNoDedup(hooks: EventHookRegistration[]): EventHookRegistration[] {
    return sortHooks(hooks, false)
  }

  /**
   * 按玩家座位顺序对钩子进行二次排序
   *
   * 当优先级完全相同时，按玩家座位号排序。
   * 用于「多名玩家同时触发」的场景（如南蛮入侵响应顺序）。
   */
  sortBySeatOrder(hooks: EventHookRegistration[]): EventHookRegistration[] {
    return [...hooks].sort((a, b) => {
      // 锁定技 > 优先级 > 座位号
      if (a.isLocked && !b.isLocked) return -1
      if (!a.isLocked && b.isLocked) return 1
      if (a.priority !== b.priority) return b.priority - a.priority
      return a.player.seatIndex - b.player.seatIndex
    })
  }

  /**
   * 分组：将钩子按玩家分组
   *
   * 用于依次询问每个玩家是否发动技能的场景。
   */
  groupByPlayer(hooks: EventHookRegistration[]): Map<string, EventHookRegistration[]> {
    const groups = new Map<string, EventHookRegistration[]>()
    for (const hook of hooks) {
      const existing = groups.get(hook.player.id)
      if (existing) {
        existing.push(hook)
      } else {
        groups.set(hook.player.id, [hook])
      }
    }
    return groups
  }
}
