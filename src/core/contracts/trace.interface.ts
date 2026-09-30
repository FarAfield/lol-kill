// ============================================================
// 联盟杀 · 可观测性契约
//
// 这一层的东西有一个共同点：**它们不该改变被观测的东西**。
//
// 于是它们一律是「旁听者」接口：谁实现了它们，谁就只许读、不许写；
// 实现方拿到的事件已经是结算完毕的样子，无论它做什么，都不参与
// 那条正在跑的流水线。写错了最多是日志难看，不会让引擎换个玩法。
//
// 放在 contracts 而不是 debug/ 里，是为了让 `@core/event/*` 能import
// 这些类型而不形成「引擎依赖调试设施」的环——依赖方向必须是
// 调试设施 → 引擎，反过来就成了引擎身上挂着观测包袱。
// ============================================================

import type { IGameEvent } from './event.interface'
import type { TriggerStage } from './enums'

/**
 * 事件追踪接收端
 *
 * 三个回调覆盖一条事件的完整生命周期。`onFinish` 是唯一保证被调用的
 * —— 事件被取消、被阻止、甚至在 handler 里抛错，`finally` 都会走到它。
 * 所以「树里少了一个节点」这种事不会发生；少的是终态字段，不是节点。
 */
export interface IEventTraceSink {
  /**
   * 是否正在记录
   *
   * 放在契约里而不是留在实现各自私用，是因为「关着的观测必须与不存在
   * 等价」这条要求需要调用方配合：调用方先看一眼这个开关，
   * 关着就别去构造中间对象、别去拼字符串。
   */
  readonly enabled: boolean
  /** 事件进入流水线 */
  onBegin(event: IGameEvent): void
  /** 流水线推进到新阶段（一条事件会走若干次） */
  onStage(event: IGameEvent, stage: TriggerStage): void
  /** 事件离开流水线（终态已定） */
  onFinish(event: IGameEvent): void
}

/**
 * Mod 追踪接收端
 *
 * 回答的是「这个 3 点伤害是怎么来的」——把 `base → 每个修改器 → result`
 * 这条链路摊开。这是本引擎里最难用肉眼重建的一条链路：
 * 四个钩子串着跑，每一步看到的都是上一步的结果，
 * 少看一步就会得出「为什么不是 2 点」这种错误结论。
 */
export interface IModTraceSink {
  /** @see IEventTraceSink.enabled */
  readonly enabled: boolean
  /** 一次查询开始（`key` 为钩子名，`base` 为初始值） */
  onQueryBegin(query: ModQueryInfo): void
  /** 一个修改器参与与否及其贡献 */
  onContribution(step: ModContribution): void
  /** 一次查询结束 */
  onQueryEnd(query: ModQueryInfo, result: number | boolean): void
}

/** 一次 Mod 查询的元信息 */
export interface ModQueryInfo {
  /** 钩子名（`damageTo` / `attackRange` / `maxHandcard` …） */
  key: string
  /** 查询主体 */
  playerId: string
  /** 初始值 */
  base: number | boolean
  /** 触发这次查询的事件（可能没有——纯查询接口不收 event） */
  eventId?: string
}

/** 一个修改器在一次查询中的贡献 */
export interface ModContribution {
  /** 钩子名 */
  key: string
  /** 修改器定义 id */
  modId: string
  /** 持有者（全局 Mod 没有持有者） */
  ownerId?: string
  /** 它被调用之前的当前值 */
  before: number | boolean
  /** 它返回之后的值 */
  after: number | boolean
  /** 是否真的改了值 */
  changed: boolean
  /**
   * 为什么没参与
   *
   * `applied` 为 false 时才会有值。写清楚理由是这里唯一值钱的部分：
   * 「某个修改器没生效」是这类引擎最常见的疑问，
   * 而答案通常不是「它写错了」，是「它的 filter 没过」。
   */
  skippedReason?: ModSkipReason
}

export type ModSkipReason =
  /** 持有者已死亡 —— Mod 随持有者自动失效 */
  | 'owner-dead'
  /** 持有者不是本次查询的任何一方（也包括「这一钩不认这个持有者」） */
  | 'owner-not-involved'
  /** 定义了 filter 且没通过 */
  | 'filtered-out'
  /** 布尔否决链已经 false，后面的人不必再问 */
  | 'short-circuited'
