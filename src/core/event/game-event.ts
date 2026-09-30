import type {
  IGameEvent,
  EventValues,
  EventResult,
  EventStepHandler,
  GameEventInit,
  IEventRunner,
} from '@core/contracts/event.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { EventStatus, type TriggerStage, type GamePhase, type DamageType } from '@core/contracts/enums'
import type { EventName } from '@core/contracts/event-name'
import { IdGenerator } from '@core/utils'
import { gameClock } from '@core/utils/clock'
import {
  EventNestingError,
  EventRunnerMissingError,
  EventStepOverflowError,
  EventTransitionError,
} from './errors'

/**
 * 事件创建选项
 *
 * 字段与契约层 `GameEventInit` 一致，额外支持 `num`（初始数值）与 `nature`（伤害属性）。
 */
export interface GameEventOptions extends GameEventInit {
  /** 初始通用数值（伤害点数 / 摸牌数等），默认 0 */
  num?: number
  /** 伤害属性 */
  nature?: DamageType
}

/**
 * 默认事件值对象
 */
function createDefaultValues(): EventValues {
  return {
    num: 0,
    numFixed: false,
    baseDamage: 0,
    extraDamage: 0,
  }
}

/** 全局共享 ID 生成器（所有 GameEvent 实例共用，保证 ID 递增不重复） */
const _idGenerator = new IdGenerator()

/**
 * 单次调度允许的最大步骤迭代次数
 *
 * 步骤机是循环不是递归，所以 `goto` 循环不会爆栈，但会空转。
 * 用迭代预算兜底：超过即抛错，而不是让引擎静默卡死。
 */
export const MAX_STEP_ITERATIONS = 256

/**
 * 流水线主链：相邻状态的合法推进关系
 *
 * 单发事件走 `waiting → skipCheck → before → begin → prepare → content
 * → prevent → end → after → completed`。
 */
const CHAIN_NEXT: Partial<Record<EventStatus, EventStatus[]>> = {
  [EventStatus.Waiting]: [EventStatus.SkipCheck],
  [EventStatus.SkipCheck]: [EventStatus.Before],
  [EventStatus.Before]: [EventStatus.Begin],
  [EventStatus.Begin]: [EventStatus.Prepare],
  [EventStatus.Prepare]: [EventStatus.Content],
  [EventStatus.Content]: [EventStatus.Prevent],
  [EventStatus.Prevent]: [EventStatus.Prevented, EventStatus.End],
  [EventStatus.Prevented]: [EventStatus.End],
  [EventStatus.End]: [EventStatus.After],
  [EventStatus.After]: [EventStatus.Completed],
  [EventStatus.Cancelled]: [EventStatus.Completed],
  [EventStatus.Completed]: [],
}

/**
 * 终态集合
 *
 * 从任意非终态都可以直接跳到终态（取消 / 阻止 / 完成）——
 * 这是「事件在流水线上任意位置被无懈可击」所必需的。
 */
const TERMINAL_STATUSES = new Set<EventStatus>([
  EventStatus.Cancelled,
  EventStatus.Prevented,
  EventStatus.Completed,
])

/**
 * 可被取消 / 阻止的终态（受 forced 约束）
 */
const NEGATIVE_TERMINAL_STATUSES = new Set<EventStatus>([
  EventStatus.Cancelled,
  EventStatus.Prevented,
])

export class GameEvent implements IGameEvent {
  id: string
  name: EventName

  source?: IPlayer
  player?: IPlayer
  targets: IPlayer[]

  cards: ICard[]
  nature?: DamageType

  parent?: IGameEvent
  children: IGameEvent[]
  runner?: IEventRunner

  status: EventStatus
  stage: TriggerStage
  cancelled: boolean
  cancelReason?: string
  prevented: boolean
  forced: boolean
  silent: boolean

  /** 是否开无懈可击窗口（结构性标记，见 `contracts/event.interface.ts`） */
  cancelable: boolean
  /** 在无懈抵消链中的层级（原始事件 0，第 n 张无懈 n） */
  cancelDepth: number

  finished: boolean
  step: number
  result: EventResult

  values: EventValues

  phase?: GamePhase
  round?: number
  turn?: number

  data: Record<string, unknown>
  timestamp: number

  /** 已注册的步骤 */
  private steps = new Map<number, EventStepHandler>()
  /** 本轮步骤是否被 goto 改写过（决定 next() 是否自动前进） */
  private stepMoved = false

  constructor(options: GameEventOptions) {
    this.id = _idGenerator.next('event')
    this.name = options.name

    this.source = options.source
    this.player = options.player ?? options.source
    this.targets = options.targets ?? []

    this.cards = options.cards ?? []
    this.nature = options.nature

    this.parent = options.parent
    this.children = []

    this.status = EventStatus.Waiting
    this.stage = 'Begin' as TriggerStage
    this.cancelled = false
    this.prevented = false
    this.forced = options.forced ?? false
    this.silent = options.silent ?? false

    this.cancelable = options.cancelable ?? false
    // 抵消链层级：显式指定优先，否则继承父事件（根事件为 0）
    this.cancelDepth = options.cancelDepth ?? options.parent?.cancelDepth ?? 0

    this.finished = false
    this.step = 0
    this.result = {}

    this.values = createDefaultValues()
    if (options.num !== undefined) {
      this.values.num = options.num
    }

    this.phase = options.phase
    this.round = options.round
    this.turn = options.turn

    this.data = options.data ?? {}
    // 逻辑刻度而非挂钟：同一条流水重放两次要拿到一模一样的事件
    this.timestamp = gameClock.next()
  }

  // ── 便捷访问 ──

  get target(): IPlayer | undefined {
    return this.targets[0]
  }

  get card(): ICard | undefined {
    return this.cards[0]
  }

  /** 通用数值（映射到 values.num，保持单一真值源） */
  get num(): number {
    return this.values.num
  }

  set num(value: number) {
    this.values.num = value
  }

  get isTerminal(): boolean {
    return TERMINAL_STATUSES.has(this.status)
  }

  /**
   * 深度（事件嵌套层级）
   *
   * 根事件的深度为 0，每嵌套一层子事件 +1。
   */
  get depth(): number {
    let d = 0
    let current: IGameEvent | undefined = this.parent
    while (current) {
      d += 1
      current = current.parent
    }
    return d
  }

  // ── 状态机 ──

  /**
   * 尝试将事件转移到目标状态
   *
   * 合法转移有两种：
   * 1. 主链上的相邻推进
   * 2. 任意非终态 → 终态（取消 / 阻止 / 完成）
   *
   * 强制事件（forced）不能进入 cancelled / prevented。
   *
   * @throws EventTransitionError 转移非法时
   */
  transitionTo(target: EventStatus): void {
    // 强制事件无法被取消或阻止
    if (this.forced && NEGATIVE_TERMINAL_STATUSES.has(target)) {
      return
    }

    // 合法转移：主链相邻推进，或「非终态 → 终态」的直接收尾
    const legal =
      (CHAIN_NEXT[this.status] ?? []).includes(target) ||
      (TERMINAL_STATUSES.has(target) && !this.isTerminal)

    if (!legal) {
      throw new EventTransitionError(this.name, this.id, this.status, target)
    }

    this.status = target

    if (target === EventStatus.Cancelled) {
      this.cancelled = true
      this.finished = true
    }
    if (target === EventStatus.Prevented) {
      this.prevented = true
    }
    if (TERMINAL_STATUSES.has(target)) {
      this.finished = true
    }
  }

  /**
   * 添加子事件
   *
   * 子事件继承父事件的 player 与 runner（除非已指定）。
   */
  addChild(child: IGameEvent): void {
    if (!child.player && this.player) {
      ;(child as { player?: IPlayer }).player = this.player
    }
    if (!child.parent) {
      ;(child as { parent?: IGameEvent }).parent = this
    }
    if (!child.runner) {
      ;(child as { runner?: IEventRunner }).runner = this.runner
    }
    this.children.push(child)
  }

  // ── 步骤机 ──

  addStep(step: number, handler: EventStepHandler): void {
    this.steps.set(step, handler)
  }

  hasStep(step: number): boolean {
    return this.steps.has(step)
  }

  /**
   * 跳转到指定步骤
   *
   * 与「直接改 step」的区别：会抑制 `next()` 的自动前进，
   * 因此 `goto(0)` 在步骤 0 内部调用可以形成循环。
   */
  goto(step: number): void {
    this.step = step
    this.stepMoved = true
  }

  /**
   * 执行当前步骤并推进
   *
   * - 当前步骤没有注册处理器 → 内容自然结束（设置 finished），不终止事件
   * - 处理器内部调用了 goto / finish → 不再自动前进
   */
  async next(): Promise<void> {
    if (this.isTerminal) return

    const handler = this.steps.get(this.step)
    if (!handler) {
      this.finished = true
      return
    }

    this.stepMoved = false
    await handler(this)

    if (this.isTerminal || this.finished) return
    if (!this.stepMoved) {
      this.step += 1
    }
  }

  /**
   * 运行步骤机直到内容结束
   *
   * 迭代实现（非递归），因此 `goto` 循环不会爆栈；
   * 用迭代预算防止无出口的循环空转。
   *
   * @throws EventStepOverflowError 迭代次数超过 MAX_STEP_ITERATIONS
   */
  async runSteps(): Promise<void> {
    let iterations = 0

    while (!this.finished && !this.isTerminal) {
      iterations += 1
      if (iterations > MAX_STEP_ITERATIONS) {
        throw new EventStepOverflowError(this.name, MAX_STEP_ITERATIONS)
      }
      await this.next()
    }
  }

  /**
   * 结束事件内容——跳过剩余步骤
   *
   * 流水线仍会继续走 Prevent / End / After。
   * 若需立即收尾（后续阶段都不执行），用 `cancel()`。
   */
  finish(): void {
    this.finished = true
  }

  /**
   * 取消事件——跳过剩余步骤与后续阶段，直接进入终态
   *
   * 强制事件（forced）不可取消，此时为空操作。
   */
  cancel(reason?: string): void {
    if (this.forced) return
    if (this.isTerminal) return

    this.cancelled = true
    this.cancelReason = reason
    this.finished = true
    this.transitionTo(EventStatus.Cancelled)
    this.transitionTo(EventStatus.Completed)
  }

  // ── 子事件 ──

  /**
   * 触发子事件并等待其结算完成
   *
   * 子事件继承当前事件的 player / phase / round / turn 与 runner，
   * 并保证深度不超过运行器的 maxDepth。
   *
   * @throws EventRunnerMissingError 事件尚未进入调度时
   * @throws EventNestingError 嵌套深度超过上限
   */
  async trigger(
    name: EventName,
    data?: Omit<GameEventInit, 'name'>,
  ): Promise<IGameEvent> {
    const runner = this.runner
    if (!runner) {
      throw new EventRunnerMissingError(this.name)
    }

    const depth = this.depth + 1
    if (depth >= runner.maxDepth) {
      throw new EventNestingError(name, depth, runner.maxDepth)
    }

    const child = new GameEvent({
      name,
      source: data?.source ?? this.source,
      player: data?.player ?? this.player,
      targets: data?.targets ?? [],
      cards: data?.cards ?? [],
      parent: this,
      forced: data?.forced ?? false,
      silent: data?.silent ?? false,
      cancelable: data?.cancelable ?? false,
      cancelDepth: data?.cancelDepth,
      data: data?.data ?? {},
      phase: data?.phase ?? this.phase,
      round: data?.round ?? this.round,
      turn: data?.turn ?? this.turn,
    })

    this.addChild(child)
    await runner.dispatch(child)
    return child
  }

  /**
   * 调试用的简要描述
   */
  toString(): string {
    return `GameEvent(【${this.id}】: ${this.name}, stage=${this.stage}, status=${this.status}, step=${this.step}, depth=${this.depth})`
  }

  /** 重置 ID 生成器（重放 / 测试前调用） */
  static resetIdGenerator(): void {
    _idGenerator.reset()
  }
}
