// ============================================================
// 联盟杀 · EventTrace — 事件嵌套树
//
// 「他为什么只掉 1 点血」这种问题，光看答案是查不出来的。
// 伤害是一次嵌套结算：`useCard → cardTarget → damage → hpChange`，
// 中间每一层都可能被某个技能改写一次。屏幕上一行「造成 1 点伤害」
// 是这条链跑完之后的结果，中间过程全丢掉了。
//
// 本文件把那条链留住。它记的不是日志文本，而是**结构**：
// 谁触发了谁、每层走过哪些阶段、最后以什么姿态收尾、
// 通用数值（伤害点数 / 摸牌数）在结算完是多少。
//
// ── 三条硬规矩 ──
// 1. **默认关闭。** 开着跑一局会记录上千个节点，那是排查时愿意付的代价，
//    不是每局都该付的。关着的时候除了几次空判断，什么都不做。
// 2. **只旁听。** 拿到的是已结算完的事件；本文件里没有一处写回游戏状态。
// 3. **不拨时钟。** 时间戳只读 `gameClock.now`，绝不调用 `next()`——
//    观测每走一步就把逻辑时钟往前拨一格的话，同一份录像放两次会拿到
//    两串不同的刻度，Phase 18 的确定性就被观测自己弄坏了。
// ============================================================

import type { EventStatus, GamePhase, TriggerStage, DamageType } from '@core/contracts/enums'
import type { EventName } from '@core/contracts/event-name'
import type { IGameEvent } from '@core/contracts/event.interface'
import type { IEventTraceSink } from '@core/contracts/trace.interface'
import { gameClock } from '@core/utils/clock'

/** 事件追踪的节点形态（也是导出 JSON 的形状） */
export interface EventTraceNode {
  id: string
  name: EventName
  /** 嵌套层级（根为 0） */
  depth: number

  // ── 参与者 ──
  sourceId?: string
  playerId?: string
  targetIds: string[]
  cardIds: string[]

  // ── 数值 ──
  /** 结算后的通用数值（伤害点数 / 摸牌数 / 回复量…） */
  num: number
  /** 伤害拆分：基础值与增量。`num` 是两者之和 */
  baseDamage: number
  extraDamage: number
  nature?: DamageType

  // ── 上下文 ──
  round?: number
  turn?: number
  phase?: GamePhase

  // ── 结算姿态 ──
  status: EventStatus
  stage: TriggerStage
  stages: TriggerStage[]
  cancelled: boolean
  prevented: boolean
  cancelReason?: string
  /** 有没有真的执行内容（false = 只是走了一遍流水线没做事） */
  finished: boolean
  /** 匹配并执行过的 handler 数量 */
  handlerCount: number

  /** 进入流水线时的逻辑刻度 */
  tick: number

  children: EventTraceNode[]
}

/** 导出档案的整体形状 */
export interface EventTraceExport {
  version: number
  /** 根节点列表（一局通常有多个：每个回合、每个阶段各自起一棵） */
  roots: EventTraceNode[]
  stats: EventTraceStats
}

export interface EventTraceStats {
  /** 节点总数 */
  nodes: number
  /** 最大嵌套深度 */
  maxDepth: number
  /** 各终态的数量 */
  completed: number
  cancelled: number
  prevented: number
}

const EXPORT_VERSION = 1

/**
 * 事件嵌套树记录器
 *
 * 三个回调由 `EventDispatcher` 调用。它自己不知道引擎长什么样，
 * 也不需要——给它事件，它还你一棵树。
 */
export class EventTrace implements IEventTraceSink {
  private nodes = new Map<string, EventTraceNode>()
  private roots: EventTraceNode[] = []
  private order: string[] = []
  private handlerCalls = new Map<string, number>()

  /** 总开关：关着的时候三个回调直接返回，不做任何工作 */
  enabled = false

  onBegin(event: IGameEvent): void {
    if (!this.enabled) return

    const existing = this.nodes.get(event.id)
    if (existing) {
      // 同一条事件被二次调度（重置后重入）——刷新快照，不重复挂树
      this.apply(event, existing)
      return
    }

    const node: EventTraceNode = {
      id: event.id,
      name: event.name,
      depth: event.depth,
      sourceId: event.source?.id,
      playerId: event.player?.id,
      targetIds: event.targets.map((t) => t.id),
      cardIds: event.cards.map((c) => c.instanceId),
      num: 0,
      baseDamage: 0,
      extraDamage: 0,
      nature: event.nature,
      round: event.round,
      turn: event.turn,
      phase: event.phase,
      status: event.status,
      stage: event.stage,
      stages: [],
      cancelled: false,
      prevented: false,
      cancelReason: undefined,
      finished: false,
      handlerCount: 0,
      tick: gameClock.now,
      children: [],
    }
    this.apply(event, node)
    this.nodes.set(event.id, node)
    this.order.push(event.id)
    this.link(event, node)
  }

  onStage(event: IGameEvent, stage: TriggerStage): void {
    if (!this.enabled) return
    const node = this.nodes.get(event.id)
    if (!node) return
    if (node.stages[node.stages.length - 1] !== stage) {
      node.stages.push(stage)
    }
    node.stage = stage
  }

  onFinish(event: IGameEvent): void {
    if (!this.enabled) return
    // 事件可能在记录器开启之前就进了流水线，此时补一个节点——
    // 「树里少了一段」比「多了一段」难查得多
    const node = this.nodes.get(event.id) ?? (this.onBegin(event), this.nodes.get(event.id))
    if (!node) return
    this.apply(event, node)
  }

  // ── 读取 ──

  /** 根节点列表 */
  get rootNodes(): readonly EventTraceNode[] {
    return this.roots
  }

  /**
   * 按「完成顺序」摊平
   *
   * 树的形状适合看因果，列表适合做 diff——两次回放逐条比对时，
   * 摊平之后才是 `JSON.stringify(a) === JSON.stringify(b)` 能直接用的东西。
   */
  flatten(): EventTraceNode[] {
    const out: EventTraceNode[] = []
    const walk = (node: EventTraceNode) => {
      out.push(node)
      for (const child of node.children) walk(child)
    }
    for (const root of this.roots) walk(root)
    return out
  }

  /** 导出为可 JSON 序列化的档案 */
  toJSON(): EventTraceExport {
    const nodes = this.flatten()
    const counter = { completed: 0, cancelled: 0, prevented: 0 }
    let maxDepth = 0

    for (const node of nodes) {
      maxDepth = Math.max(maxDepth, node.depth)
      if (node.cancelled) counter.cancelled += 1
      else if (node.prevented) counter.prevented += 1
      else counter.completed += 1
    }

    return {
      version: EXPORT_VERSION,
      roots: this.roots as EventTraceNode[],
      stats: { nodes: nodes.length, maxDepth, ...counter },
    }
  }

  /** 导出 JSON 字符串（一局结束后直接落盘 / 打日志） */
  export(pretty = false): string {
    return JSON.stringify(this.toJSON(), null, pretty ? 2 : undefined)
  }

  /**
   * 人类可读的树形文本
   *
   * 调试 Console 里比 JSON 好用：缩进就是嵌套，不需要在方括号里数层。
   */
  render(node?: EventTraceNode, indent = 0): string {
    const lines: string[] = []
    const walk = (n: EventTraceNode, depth: number) => {
      const pad = '  '.repeat(depth)
      const mark = n.cancelled ? ' [已取消]' : n.prevented ? ' [已阻止]' : ''
      lines.push(
        `${pad}${n.name} (${n.id}) num=${n.num} → ${n.status}${mark}`,
      )
      for (const child of n.children) walk(child, depth + 1)
    }

    if (node) walk(node, indent)
    else for (const root of this.roots) walk(root, 0)

    return lines.join('\n')
  }

  /** 清空（下一局开始前调用） */
  reset(): void {
    this.nodes.clear()
    this.handlerCalls.clear()
    this.roots = []
    this.order = []
  }

  // ── 内部 ──

  /** 记录一次 handler 命中（由引擎在 onHandlerExecute 时转发） */
  noteHandler(eventId: string): void {
    if (!this.enabled) return
    const node = this.nodes.get(eventId)
    if (node) node.handlerCount += 1
    else this.handlerCalls.set(eventId, (this.handlerCalls.get(eventId) ?? 0) + 1)
  }

  /** 把事件此刻的状态刷进节点 */
  private apply(event: IGameEvent, node: EventTraceNode): void {
    node.num = event.num
    node.baseDamage = event.values.baseDamage
    node.extraDamage = event.values.extraDamage
    node.status = event.status
    node.stage = event.stage
    node.cancelled = event.cancelled
    node.prevented = event.prevented
    node.cancelReason = event.cancelReason
    node.finished = event.finished
    node.targetIds = event.targets.map((t) => t.id)
    node.cardIds = event.cards.map((c) => c.instanceId)
    node.round = event.round
    node.turn = event.turn
    node.phase = event.phase

    const pending = this.handlerCalls.get(event.id)
    if (pending !== undefined) {
      node.handlerCount += pending
      this.handlerCalls.delete(event.id)
    }
  }

  /** 把节点挂到父节点上（没有父亲就是根） */
  private link(event: IGameEvent, node: EventTraceNode): void {
    const parent = event.parent
    if (!parent) {
      if (!this.roots.includes(node)) this.roots.push(node)
      return
    }

    // 父亲可能先于记录器开启而错过了 begin，此刻补建它
    let parentNode = this.nodes.get(parent.id)
    if (!parentNode) {
      this.onBegin(parent)
      parentNode = this.nodes.get(parent.id)
    }
    if (parentNode && !parentNode.children.includes(node)) {
      parentNode.children.push(node)
    }
    // 被认领之后就不是根了
    const at = this.roots.indexOf(node)
    if (at !== -1) this.roots.splice(at, 1)
  }
}
