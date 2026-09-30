// ============================================================
// 联盟杀 · useLogStore — 游戏日志 Pinia Store
//
// 存储和分类游戏事件日志，提供颜色编码和过滤功能。
// UI 通过此 Store 获取实时日志流并渲染彩色日志条目。
//
// 设计原则：
// - 日志由引擎/GameController 推入，UI 只读消费
// - 按 LogLevel + 消息关键词自动分配颜色类别
// - 支持清空和最大条目数限制
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { LogLevel } from '@core/contracts/enums'
import type { LogEntry, UILogEntry } from '@core/contracts/types'

/**
 * 日志颜色类别（用于 UI 渲染彩色日志）。
 */
export type LogColorCategory =
  | 'damage'    // 伤害相关 → 红色
  | 'heal'      // 回复相关 → 绿色
  | 'card'      // 卡牌使用 → 蓝色
  | 'skill'     // 技能发动 → 紫色
  | 'death'     // 死亡相关 → 深红
  | 'system'    // 系统/阶段 → 灰色
  | 'info'      // 一般信息 → 白色
  | 'error'     // 错误 → 橙红

/** 带颜色分类的日志条目 */
export interface ColoredLogEntry extends UILogEntry {
  /** 颜色类别 */
  colorCategory: LogColorCategory
}

/**
 * 视图层自建日志的输入形态
 *
 * 引擎写出来的日志带 `tick`（本局第几步）；视图自己写的那些——
 * 「正在初始化游戏」「连接已断开」——不在任何一局内部，
 * 压根谈不上第几步，因此允许不带。缺省 0 就是字面意思「不属于任何一步」。
 */
export type ViewLogInput = Omit<LogEntry, 'tick'> & { tick?: number }

// ── 颜色类别映射 ──
const COLOR_CATEGORIES: Record<LogColorCategory, string> = {
  damage: '#e74c3c',
  heal: '#2ecc71',
  card: '#3498db',
  skill: '#9b59b6',
  death: '#c0392b',
  system: '#95a5a6',
  info: '#ecf0f1',
  error: '#e67e22',
}

/**
 * 根据日志内容自动推断颜色类别。
 *
 * 规则（按优先级）：
 * 1. LogLevel.Error → error
 * 2. 消息关键词匹配
 * 3. 默认 → info
 */
function inferColorCategory(entry: LogEntry): LogColorCategory {
  // 级别优先
  if (entry.level === LogLevel.Error) return 'error'

  const msg = entry.message

  // ── 伤害关键词 ──
  if (/伤害|造成.*点伤害|受伤|受到.*伤害|体力扣减|失去.*体力|damage/i.test(msg)) {
    return 'damage'
  }

  // ── 死亡关键词 ──
  if (/死亡|阵亡|濒死|求桃|已阵亡|被消灭|death|die|dying/i.test(msg)) {
    return 'death'
  }

  // ── 回复关键词 ──
  if (/回复|恢复|使用.*桃|使用.*酒|桃园结义|体力回复|回复.*体力|heal|recover/i.test(msg)) {
    return 'heal'
  }

  // ── 卡牌关键词 ──
  if (/使用|打出|装备|弃置|摸.*牌|判定|使用.*杀|使用.*闪|card|play|use/i.test(msg)) {
    return 'card'
  }

  // ── 技能关键词 ──
  if (/技能|发动|触发|效果|skill|effect|激活/i.test(msg)) {
    return 'skill'
  }

  // ── 系统/阶段关键词 ──
  if (/阶段|回合|轮次|开始|结束|准备|phase|round|turn|start|end/i.test(msg)) {
    return 'system'
  }

  // 默认 info
  return 'info'
}

// ── 最大日志条目数 ──
const MAX_LOG_ENTRIES = 500

/**
 * 日志 Store。
 *
 * 用法：
 *   const logStore = useLogStore()
 *   logStore.addLog({ id, tick, round, phase, message, level: LogLevel.Info })
 *   console.log(logStore.coloredEntries)  // 彩色日志列表
 */
export const useLogStore = defineStore('log', () => {
  // ── 状态 ──
  /** 原始日志条目（含呈现层补的墙钟） */
  const entries = ref<UILogEntry[]>([])

  /** 带颜色分类的日志条目 */
  const coloredEntries = computed<ColoredLogEntry[]>(() => {
    return entries.value.map((entry) => ({
      ...entry,
      colorCategory: inferColorCategory(entry),
    }))
  })

  /** 最近 N 条日志（默认 100） */
  const recentEntries = computed(() => (limit: number = 100) => {
    return entries.value.slice(-limit)
  })

  /** 日志总数 */
  const count = computed(() => entries.value.length)

  /** 按颜色类别分组统计 */
  const categoryStats = computed(() => {
    const stats: Partial<Record<LogColorCategory, number>> = {}
    for (const entry of coloredEntries.value) {
      const cat = entry.colorCategory
      stats[cat] = (stats[cat] ?? 0) + 1
    }
    return stats
  })

  // ── Actions ──

  /**
   * 添加一条日志。
   *
   * 由 GameController / StoreService / 视图在事件发生时调用。
   *
   * **墙钟由这里补，不由调用方传**。来自引擎的那份 `LogEntry` 只带
   * `tick`（本局第几步），「现在几点几分」是呈现层自己的事——
   * 它在这一刻才发生，也就该在这一刻被记下。
   */
  function addLog(entry: ViewLogInput): void {
    const presented: UILogEntry = { tick: 0, ...entry, timestamp: Date.now() }
    entries.value = [...entries.value, presented]

    // 超出上限时裁剪旧日志
    if (entries.value.length > MAX_LOG_ENTRIES) {
      entries.value = entries.value.slice(-MAX_LOG_ENTRIES / 2)
    }
  }

  /**
   * 批量添加日志。
   */
  function addLogs(newEntries: ViewLogInput[]): void {
    if (newEntries.length === 0) return
    const now = Date.now()
    entries.value = [
      ...entries.value,
      ...newEntries.map((entry) => ({ tick: 0, ...entry, timestamp: now }) as UILogEntry),
    ]
    if (entries.value.length > MAX_LOG_ENTRIES) {
      entries.value = entries.value.slice(-MAX_LOG_ENTRIES)
    }
  }

  /**
   * 清空所有日志。
   */
  function clear(): void {
    entries.value = []
  }

  /**
   * 获取指定颜色类别的日志。
   */
  function getByCategory(category: LogColorCategory): ColoredLogEntry[] {
    return coloredEntries.value.filter((e) => e.colorCategory === category)
  }

  return {
    // 状态
    entries,
    coloredEntries,
    recentEntries,
    count,
    categoryStats,

    // Actions
    addLog,
    addLogs,
    clear,
    getByCategory,
  }
})

/**
 * 获取颜色类别的 CSS 颜色值。
 */
export function getLogCategoryColor(category: LogColorCategory): string {
  return COLOR_CATEGORIES[category] ?? COLOR_CATEGORIES.info
}

/**
 * 获取颜色类别的中文标签。
 */
export function getLogCategoryLabel(category: LogColorCategory): string {
  const labels: Record<LogColorCategory, string> = {
    damage: '伤害',
    heal: '回复',
    card: '卡牌',
    skill: '技能',
    death: '死亡',
    system: '系统',
    info: '信息',
    error: '错误',
  }
  return labels[category] ?? category
}
