// ============================================================
// 联盟杀 · ModTrace — Mod 查询的贡献链路
//
// 「这发杀为什么是 3 点」是这类引擎里最难答的一个问题。
//
// 难不在计算，而在**它是一次四人接力**：伤害管道串着
// `globalDamageFrom → damageFrom → globalDamageTo → damageTo` 四个钩子，
// 每一步看到的都是上一步的结果。屏幕上只有一个最终数字，
// 中间四个数字分别是谁改的、改了多少，全丢了。
// 于是排查只能靠猜——而人猜的顺序通常是错的（先怀疑自己写的技能）。
//
// 本文件把那条接力摊平：每次查询留下一条 `before → after` 的记录，
// 没参与也记一笔，并写清**为什么**（持有者死了 / filter 没过 / 持有者
// 不是这一方……）。「没生效」的答案十次有八次是最后那种。
//
// 与 EventTrace 一样，它默认关闭、只读不写、不拨时钟。
// ============================================================

import type {
  IModTraceSink,
  ModContribution,
  ModQueryInfo,
  ModSkipReason,
} from '@core/contracts/trace.interface'

/** 一次完整查询的记录 */
export interface ModTraceQuery {
  info: ModQueryInfo
  steps: ModContribution[]
  result: number | boolean
  /** 有没有任何修改器真的改了值 */
  changed: boolean
}

/**
 * Mod 查询追踪器
 *
 * 由 `ModRegistry` 在每次查询时调用。它不做任何筛选 / 聚合——
 * 聚合会让「谁在第几步」这件事变模糊，而那正是要查的东西。
 */
export class ModTrace implements IModTraceSink {
  readonly queries: ModTraceQuery[] = []

  /** 总开关：关闭时不记录，`ModRegistry` 那边也不必构造中间对象 */
  enabled = false

  private current?: ModTraceQuery

  onQueryBegin(info: ModQueryInfo): void {
    if (!this.enabled) return
    this.current = { info, steps: [], result: info.base, changed: false }
    this.queries.push(this.current)
  }

  onContribution(step: ModContribution): void {
    if (!this.enabled) return
    if (!this.current) return
    this.current.steps.push(step)
    if (step.changed) this.current.changed = true
  }

  onQueryEnd(_info: ModQueryInfo, result: number | boolean): void {
    if (!this.enabled) return
    if (!this.current) return
    this.current.result = result
    this.current = undefined
  }

  // ── 读取 ──

  /** 只看某一种钩子的查询（如全部 `damageTo`） */
  forHook(key: string): ModTraceQuery[] {
    return this.queries.filter((q) => q.info.key === key)
  }

  /**
   * 人类可读的链路文本
   *
   * 例：
   * ```
   * damageTo(base=2)
   *   ├ 藤甲 [p2] 2 → 3        (+1)
   *   └ 白银狮子 [p2] skip: filtered-out
   *   = 3
   * ```
   */
  render(query: ModTraceQuery): string {
    const lines: string[] = []
    const base = query.info.base
    const kind = typeof base === 'number' ? 'num' : 'bool'
    lines.push(`${query.info.key}(base=${String(base)}, ${kind})`)

    for (const step of query.steps) {
      const owner = step.ownerId ?? 'global'
      if (step.skippedReason) {
        lines.push(`  └ ${step.modId} [${owner}] skip: ${step.skippedReason}`)
        continue
      }
      const delta =
        typeof step.after === 'number' && typeof step.before === 'number'
          ? ` (${step.after - step.before >= 0 ? '+' : ''}${step.after - step.before})`
          : ''
      lines.push(
        `  └ ${step.modId} [${owner}] ${String(step.before)} → ${String(step.after)}${delta}`,
      )
    }

    lines.push(`  = ${String(query.result)}`)
    return lines.join('\n')
  }

  /** 全部查询的文本（调试 Console 里直接打） */
  renderAll(): string {
    return this.queries.map((q) => this.render(q)).join('\n')
  }

  reset(): void {
    this.queries.length = 0
    this.current = undefined
  }
}

export type { ModSkipReason }
