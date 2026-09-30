// ============================================================
// 联盟杀 · 事件相关接口
// ============================================================

import type { EventStatus, GamePhase, TriggerStage, DamageType } from './enums'
import type { EventName } from './event-name'
import type { EventId } from './types'
import type { IPlayer } from './player.interface'
import type { ICard } from './card.interface'

/**
 * 事件值对象
 */
export interface EventValues {
  num: number
  numFixed: boolean
  baseDamage: number
  extraDamage: number
}

/**
 * 事件结果
 *
 * 事件结算完毕后对外暴露的产物。
 * 调用方按需写入字段，读取方（多为发起 trigger 的父事件）按需读取。
 *
 * 典型用途：
 * - `bool`：判定是否命中、是否成功响应
 * - `cards`：判定牌、被弃置/获得的牌
 * - `targets`：最终实际生效的目标（可能与初始 targets 不同）
 * - `num`：最终伤害值、实际摸牌数
 */
export interface EventResult {
  bool?: boolean
  cards?: ICard[]
  targets?: IPlayer[]
  num?: number
  /** 自定义结果字段（扩展包可用，避免为每种结果都改契约） */
  [key: string]: unknown
}

/**
 * 事件运行器
 *
 * `GameEvent` 自身不持有引擎引用——它只持有这个最小接口，
 * 由 `EventDispatcher` 在调度期注入。这样事件实体对引擎保持无依赖，
 * 单元测试里可以用假运行器驱动。
 */
export interface IEventRunner {
  /** 调度一个事件并等待其结算完成 */
  dispatch(event: IGameEvent): Promise<void>
  /** 嵌套深度上限（超过则抛 EventNestingError） */
  readonly maxDepth: number
}

/**
 * 步骤机处理器
 *
 * 一个事件的内容（content）由若干「步骤」组成，每个步骤是一个函数。
 * 步骤机按 `step` 顺序执行，处理器内部可用 `goto()` 跳转、`finish()` 提前收尾。
 */
export type EventStepHandler = (event: IGameEvent) => Promise<void> | void

/**
 * 游戏事件
 *
 * 设计原则：
 * - source / player 为可选——系统事件（如闪电）可能没有明确的来源玩家
 * - AOP 钩子由 EventDispatcher 管理，不存储在事件上
 * - 通用数值聚合到 values 子对象
 */
export interface IGameEvent {
  /** 事件唯一标识 */
  id: EventId
  /**
   * 事件名（事件主体，不含阶段后缀）
   *
   * 阶段后缀由流水线在调度时派生：`damage` + After → `damageAfter`。
   * 见 `contracts/event-name.ts`。
   */
  name: EventName

  // ── 参与者（可选——系统事件可能无来源） ──
  /** 事件来源玩家（谁触发了此事件，可为空） */
  source?: IPlayer
  /** 事件驱动者（谁在主导这条事件链，可为空） */
  player?: IPlayer
  /** 事件目标玩家列表 */
  targets: IPlayer[]
  /** 单目标便捷访问（等价于 targets[0]，无目标时为 undefined） */
  readonly target?: IPlayer

  // ── 关联数据 ──
  /** 关联的卡牌列表 */
  cards: ICard[]
  /** 单卡便捷访问（等价于 cards[0]，无卡牌时为 undefined） */
  readonly card?: ICard
  /**
   * 通用数值（伤害点数 / 摸牌数 / 回复量 ...）
   *
   * 直接映射到 `values.num`，不另设字段——数值只有一个真值源。
   */
  num: number
  /** 伤害属性（仅伤害事件有意义） */
  nature?: DamageType

  // ── 事件树 ──
  /** 父事件 */
  parent?: IGameEvent
  /** 子事件列表 */
  children: IGameEvent[]
  /** 嵌套深度（根事件为 0，每嵌套一层 +1） */
  readonly depth: number
  /**
   * 当前挂载的运行器（由 EventDispatcher 在调度时注入，结算后解绑）
   *
   * `trigger()` 依赖它执行子事件。未挂载时 trigger 会抛错而非静默失败。
   */
  runner?: IEventRunner

  // ── 流水线状态 ──
  /** 当前事件状态 */
  status: EventStatus
  /** 触发阶段（Before / Begin / Prepare / Content / Prevent / End / After） */
  stage: TriggerStage
  /** 是否已被取消 */
  cancelled: boolean
  /** 取消原因（调试用） */
  cancelReason?: string
  /** 是否已被阻止 */
  prevented: boolean
  /** 是否强制（不可取消/阻止） */
  forced: boolean
  /** 是否静默（不产生日志） */
  silent: boolean

  /**
   * 是否**开**无懈可击窗口（结构性标记）
   *
   * 只表示「这类事件会征询无懈」，不代表此刻一定能被抵消：
   * 还得过 `canBeCountered()` 那一关（卡牌自身的 `canBeCanceled`、
   * 事件是否已终态、以及 `mod.cardCancelable` 之类的守卫）。
   *
   * 默认 `false`——只有锦囊类事件会把它打开。
   */
  cancelable: boolean
  /**
   * 在无懈抵消链中的层级
   *
   * 被抵消的原始事件为 0，抵消它的第 1 张无懈为 1，抵消那张无懈的
   * 第 2 张为 2 …… 每往下一层 +1。它就是「后发先至」的层数计数器：
   * 链长（最大 cancelDepth）的奇偶决定原事件最终生不生效。
   */
  cancelDepth: number

  /**
   * 内容是否已结束（步骤机是否终止）
   *
   * 与 `status` 的终态是两个概念：
   * - `finished === true` 只表示**剩余步骤不再执行**
   * - 事件仍会走完 Prevent / End / After 阶段（除非调用了 `cancel()`）
   */
  finished: boolean
  /** 当前步骤号（步骤机用） */
  step: number

  // ── 产物 ──
  /** 事件结算结果 */
  result: EventResult

  // ── 通用数值 ──
  /** 事件关联的通用数值 */
  values: EventValues

  // ── 状态机快照 ──
  /** 事件创建时的游戏阶段 */
  phase?: GamePhase
  /** 事件创建时所在轮次 */
  round?: number
  /** 事件创建时所在回合（玩家索引） */
  turn?: number

  // ── 扩展数据 ──
  /** 自定义扩展数据 */
  data: Record<string, unknown>
  /** 事件创建时间戳 */
  timestamp: number

  // ── 状态机 ──

  /**
   * 转移到目标状态
   * @throws EventTransitionError 转移非法时
   */
  transitionTo(target: EventStatus): void

  /** 是否处于终态（completed / cancelled / prevented） */
  readonly isTerminal: boolean

  /**
   * 挂载子事件
   *
   * 子事件会继承父事件的 player / runner。
   */
  addChild(child: IGameEvent): void

  // ── 步骤机 ──

  /**
   * 注册一个步骤
   *
   * 步骤机是事件「内容（content）」的执行载体。
   * 卡牌行为（`@source/base/contents/*`）注册在 `ContentRegistry` 上，
   * 由它在事件进入 Content 阶段时把步骤注册到这里。
   */
  addStep(step: number, handler: EventStepHandler): void

  /** 该步骤是否已注册 */
  hasStep(step: number): boolean

  /** 跳转到指定步骤（下一个被执行的步骤即为此步骤） */
  goto(step: number): void

  /** 执行当前步骤并推进（无注册步骤时不执行任何操作） */
  next(): Promise<void>

  /**
   * 运行步骤机直到内容结束
   *
   * 由 EventDispatcher 在 Content 阶段调用，效果逻辑不应直接调用。
   * @throws EventStepOverflowError 迭代超过预算（无出口的 goto 循环）
   */
  runSteps(): Promise<void>

  /**
   * 结束事件内容——跳过剩余步骤
   *
   * 注意：`finish()` **不会**终止整条流水线，Prevent / End / After 阶段照常执行。
   * 要让事件立刻收尾（后续阶段都不执行），用 `cancel()`。
   */
  finish(): void

  /**
   * 取消事件——跳过剩余步骤与后续阶段，直接进入终态
   *
   * 强制事件（forced）不可取消，调用为空操作。
   */
  cancel(reason?: string): void

  // ── 子事件 ──

  /**
   * 触发子事件并等待其结算完成
   *
   * @throws EventRunnerMissingError 事件尚未进入调度时
   */
  trigger(name: EventName, data?: Omit<GameEventInit, 'name'>): Promise<IGameEvent>
}

/**
 * 事件初始化参数
 *
 * 定义在契约层而不放在 `GameEventOptions`（实体层），
 * 是为了让 `trigger()` 的子事件参数可以复用它，避免契约层反向依赖实体层。
 */
export interface GameEventInit {
  name: EventName
  source?: IPlayer
  player?: IPlayer
  targets?: IPlayer[]
  cards?: ICard[]
  parent?: IGameEvent
  forced?: boolean
  silent?: boolean
  /** 是否开无懈可击窗口（默认 false） */
  cancelable?: boolean
  /** 抵消链层级（省略则继承 parent，根事件为 0） */
  cancelDepth?: number
  data?: Record<string, unknown>
  phase?: GamePhase
  round?: number
  turn?: number
}

/**
 * 事件上下文
 */
export interface IEventContext {
  event: IGameEvent
  chain: IGameEvent[]
  depth: number
}

/**
 * 触发范围
 *
 * - player: 钩子持有者是事件驱动者（自身触发，匹配 event.player）
 * - source: 钩子持有者是事件实际执行者（匹配 event.source）
 * - global: 任意玩家触发均匹配
 * - target: 钩子持有者在事件目标列表中（匹配 event.targets）
 *
 * player 与 source 的区别：
 * - source = 谁实际做了这件事（使用杀的人、造成伤害的人）
 * - player = 谁在主导这条事件链（借刀杀人的发起者、事件链的顶层驱动者）
 * 多数情况下 source === player，但借刀杀人等场景下两者不同。
 */
export type TriggerScope = 'player' | 'source' | 'global' | 'target'
