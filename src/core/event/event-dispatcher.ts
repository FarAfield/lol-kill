import type {
  IGameEvent,
  IEventRunner,
} from '@core/contracts/event.interface'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { ISkillContext } from '@core/contracts/skill.interface'
import type { EffectContextDeps } from '@core/contracts/effect-context-deps'
import type { IEventTraceSink } from '@core/contracts/trace.interface'
import { EffectContext } from '@core/engine/effect-context'
import { EventStatus, type TriggerStage } from '@core/contracts/enums'
import { EventChain } from './event-chain'
import { EventTrigger } from './event-trigger'
import { PriorityManager } from './priority-manager'
import { ContentRegistry } from './content-registry'
import { EventNestingError } from './errors'

/**
 * EventDispatcher 配置选项
 */
export interface EventDispatcherOptions {
  /** 最大事件嵌套深度（防止无限嵌套），默认 20 */
  maxDepth?: number
  /** 是否在 handler 执行出错时继续（默认 false，出错即停止） */
  continueOnError?: boolean
  /** 事件链（不传则调度器自建一条） */
  chain?: EventChain
  /** 事件默认处理器（不传则事件只有技能触发，没有自身内容） */
  contentRegistry?: ContentRegistry
  /** handler 执行前后的日志回调 */
  onHandlerExecute?: (handler: CompiledHandler, event: IGameEvent) => void
  /** 阶段变更回调（调试/日志用） */
  onStageChange?: (event: IGameEvent, stage: TriggerStage) => void
  /** 错误回调 */
  onError?: (error: Error, event: IGameEvent, stage: TriggerStage) => void
  /**
   * 事件追踪接收端（可观测性侧信道）
   *
   * 缺省不接。接了之后它会收到每条事件的进 / 阶段 / 出三次通知，
   * 据此拼出事件嵌套树。**它对结算没有任何发言权**——返回值是 void，
   * 抛错也在调用点被吞掉（见 `notify`），观测出bug不该让引擎跟着挂。
   */
  trace?: IEventTraceSink
  /** EffectContext 依赖（注入游戏子系统，不传则 handler 无法执行） */
  deps?: EffectContextDeps
}

/**
 * 流水线阶段顺序
 */
const PIPELINE_STAGES: TriggerStage[] = [
  'Before',
  'Begin',
  'Prepare',
  'Content',
  'Prevent',
  'End',
  'After',
]

/**
 * EventDispatcher — AOP 流水线事件调度器
 *
 * 职责：
 * 1. 把事件推入 LIFO 链并推进完整流水线（Before → ... → After → Completed）
 * 2. Content 阶段驱动事件的**步骤机**（`event.runSteps()`）
 * 3. 作为 `IEventRunner` 注入事件，使 `event.trigger()` 能调度子事件
 */
export class EventDispatcher implements IEventRunner {
  readonly eventTrigger: EventTrigger
  readonly priorityManager: PriorityManager
  readonly maxDepth: number

  private chain: EventChain
  private contentRegistry?: ContentRegistry
  private trace?: IEventTraceSink
  private options: Required<
    Omit<
      EventDispatcherOptions,
      'deps' | 'chain' | 'maxDepth' | 'contentRegistry' | 'trace'
    >
  > &
    Pick<EventDispatcherOptions, 'deps'>
  private deps?: EffectContextDeps

  constructor(options?: EventDispatcherOptions) {
    this.eventTrigger = new EventTrigger()
    this.priorityManager = new PriorityManager()
    this.chain = options?.chain ?? new EventChain()
    this.contentRegistry = options?.contentRegistry
    this.trace = options?.trace
    this.maxDepth = options?.maxDepth ?? 20

    this.options = {
      continueOnError: options?.continueOnError ?? false,
      onHandlerExecute: options?.onHandlerExecute ?? (() => {}),
      onStageChange: options?.onStageChange ?? (() => {}),
      onError: options?.onError ?? (() => {}),
      deps: options?.deps,
    }

    this.deps = options?.deps
  }

  /**
   * 注入游戏子系统依赖
   *
   * 调度器由 GameEngine 持有，而 deps 里又需要调度器自己（效果要能发子事件），
   * 这是个循环依赖：只能在调度器构造完成后回填。
   */
  setDeps(deps: EffectContextDeps): void {
    this.deps = deps
    this.options.deps = deps
  }

  /**
   * 挂载追踪接收端
   *
   * 与 `setDeps` 同理，允许在构造之后挂载；传 `undefined` 即摘除。
   */
  setTrace(trace?: IEventTraceSink): void {
    this.trace = trace
  }

  /**
   * 调度事件 — 将事件推入链中并推进至完成
   *
   * @param event - 要调度的事件
   * @param chain - 事件链（省略则用调度器自带的链）
   */
  async dispatch(event: IGameEvent, chain: EventChain = this.chain): Promise<void> {
    // 深度检查——互相触发的效果环会在这里被拦下
    const actualDepth = event.depth
    if (actualDepth >= this.maxDepth) {
      throw new EventNestingError(event.name, actualDepth, this.maxDepth)
    }

    // 挂载运行器，使 event.trigger() 可用
    event.runner = this

    // 如果事件不在链顶，推入
    const alreadyOnTop = chain.peek()?.id === event.id
    if (!alreadyOnTop) {
      chain.push(event)
    }

    // 追踪端在**推入链之后**才收到通知：它据此判断有没有父亲，
    // 来早了就只能把所有事件都当成根。
    this.traceBegin(event)

    try {
      // ── Phase 1: WAITING → SKIP_CHECK ──
      if (!event.isTerminal) {
        event.status = EventStatus.Waiting
        this.transitionTo(event, EventStatus.SkipCheck)
      }

      // 对非 forced 事件，给予取消机会（无懈可击窗口）
      if (!event.forced && event.cancelled) {
        if (!event.isTerminal) {
          this.transitionTo(event, EventStatus.Cancelled)
          this.transitionTo(event, EventStatus.Completed)
        }
        return
      }

      // ── Phase 2: 流水线各阶段 ──
      for (const stage of PIPELINE_STAGES) {
        if (event.isTerminal) break
        // 事件在 Content 阶段被 cancel → 后续阶段全部跳过
        if (event.cancelled) break

        const eventStatus = this.stageToEventStatus(stage)
        this.transitionTo(event, eventStatus)
        event.stage = stage
        this.options.onStageChange(event, stage)
        this.traceStage(event, stage)

        // 执行该阶段的 handler
        await this.executeHandlers(event, stage)
        if (event.isTerminal) break

        // Content 阶段：挂载默认内容 → 跑步骤机 → 处理链上的嵌套子事件
        if (stage === 'Content') {
          this.mountContent(event)
          await event.runSteps()
          if (event.isTerminal) break
          await this.processNestedEvents(event, chain)
        }

        // Prevent 阶段后检查 Prevented 分支
        if (stage === 'Prevent' && event.prevented && !event.forced) {
          this.transitionTo(event, EventStatus.Prevented)
          this.transitionTo(event, EventStatus.End)
          event.stage = 'End'
          this.options.onStageChange(event, 'End')
          this.traceStage(event, 'End')
          await this.executeHandlers(event, 'End')

          this.transitionTo(event, EventStatus.After)
          event.stage = 'After'
          this.options.onStageChange(event, 'After')
          this.traceStage(event, 'After')
          await this.executeHandlers(event, 'After')

          // prevented 子流程完成后，跳过剩余的正常阶段
          break
        }
      }

      // ── Phase 3: 标记完成 ──
      if (!event.isTerminal) {
        if (event.cancelled && !event.forced) {
          this.transitionTo(event, EventStatus.Cancelled)
        }
        this.transitionTo(event, EventStatus.Completed)
      }
    } catch (error) {
      this.options.onError(
        error instanceof Error ? error : new Error(String(error)),
        event,
        event.stage,
      )
      if (!this.options.continueOnError) {
        throw error
      }
    } finally {
      // 如果当前事件仍在栈顶，弹出
      if (chain.peek()?.id === event.id) {
        chain.pop()
      }
      // 解绑运行器——事件结算完毕后不应再能 trigger
      if (event.runner === this) {
        event.runner = undefined
      }
      // 无论完成 / 取消 / 阻止 / 抛错都会走到这里，因此树里不会少节点
      this.traceFinish(event)
    }
  }

  /**
   * 通知追踪端
   *
   * 追踪端抛错一律吞掉：它是观察者，不是流水线的一环。
   * 「因为树记不下去导致整局崩了」是任何引擎都承受不起的失败模式。
   *
   * 吞掉不等于查不出来——缺了终态字段、缺了子树，导出的树自己会说话。
   *
   * 分三个小方法而不是一个 `notify((trace) => …)`，是为了让
   * **挂上但没开启**这个常态不付出代价：闭包在调用点就该被省掉，
   * 而不是建好之后在最后一行被 `if (!enabled) return` 丢掉。
   */
  private traceBegin(event: IGameEvent): void {
    const trace = this.trace
    if (!trace?.enabled) return
    try {
      trace.onBegin(event)
    } catch {
      // 观测失败不参与结算
    }
  }

  private traceStage(event: IGameEvent, stage: TriggerStage): void {
    const trace = this.trace
    if (!trace?.enabled) return
    try {
      trace.onStage(event, stage)
    } catch {
      // 同上
    }
  }

  private traceFinish(event: IGameEvent): void {
    const trace = this.trace
    if (!trace?.enabled) return
    try {
      trace.onFinish(event)
    } catch {
      // 同上
    }
  }

  /**
   * 调度事件直到链为空
   */
  async dispatchAll(chain: EventChain = this.chain): Promise<void> {
    while (!chain.isEmpty()) {
      const event = chain.pop()!
      await this.dispatch(event, chain)
    }
  }

  // ── 私有方法 ──

  /**
   * 挂载事件的默认内容（ContentRegistry → step 0）
   *
   * 只在事件**没有自带任何步骤**时挂载，避免覆盖调用方预设的步骤机。
   * 没有 deps（纯单测环境）或没有可确定的发起者时无法构造上下文，跳过。
   */
  private mountContent(event: IGameEvent): void {
    const registry = this.contentRegistry
    if (!registry || event.hasStep(0)) return

    const content = registry.get(event.name)
    if (!content) return

    const player = event.player ?? event.source
    if (!this.deps || !player) return

    event.addStep(0, () => content(new EffectContext(event, player, event.cards, this.deps!)))
  }

  /**
   * 处理嵌套事件
   */
  private async processNestedEvents(event: IGameEvent, chain: EventChain): Promise<void> {
    while (!chain.isEmpty() && chain.peek()?.id !== event.id) {
      const childEvent = chain.pop()!
      this.linkChildToParent(event, childEvent)
      await this.dispatch(childEvent, chain)
    }
  }

  /**
   * 执行指定阶段的所有匹配 handler
   *
   * 为每个匹配的 handler 创建 EffectContext 并传入 execute()。
   * EffectContext 在此处创建，不在 event.data 上暗线传递。
   */
  private async executeHandlers(event: IGameEvent, stage: TriggerStage): Promise<void> {
    const handlers = this.eventTrigger.getMatchingHandlers(event, stage)

    if (handlers.length === 0) return

    const sorted = this.prioritizeFor(event, handlers)

    for (const handler of sorted) {
      this.options.onHandlerExecute(handler, event)

      // 创建 EffectContext（如果 deps 可用）
      const ctx = this.createContext(event, handler)
      if (!ctx) {
        // 没有 deps，无法创建上下文（纯测试环境），跳过
        continue
      }

      try {
        await handler.execute(ctx)
      } catch (error) {
        this.options.onError(
          error instanceof Error ? error : new Error(String(error)),
          event,
          stage,
        )
        if (!this.options.continueOnError) {
          throw error
        }
      }
    }
  }

  /**
   * 排序：优先级 → 座次差
   *
   * 同优先级的 handler 按「离事件发起者的座次差」升序——
   * 顺时针顺序是「多人同时触发」时的默认裁决规则，
   * 也保证同优先级的结果不依赖注册顺序（确定性要求）。
   */
  private prioritizeFor(
    event: IGameEvent,
    handlers: CompiledHandler[],
  ): CompiledHandler[] {
    const sorted = this.priorityManager.prioritize(handlers)

    const anchor = event.player ?? event.source
    if (!anchor || !this.deps) return sorted

    const players = this.deps.state.players
    const seats = new Map(players.map((p) => [p.id, p.seatIndex]))

    return this.priorityManager.sortBySeatDistance(
      sorted,
      anchor,
      (playerId) => seats.get(playerId) ?? 0,
      players.length,
    )
  }

  /**
   * 为 handler 创建 EffectContext
   */
  private createContext(event: IGameEvent, handler: CompiledHandler): ISkillContext | undefined {
    if (!this.deps) return undefined

    // 无持有者的钩子（全局钩子 / `when()`）：上下文玩家取自事件本身
    const player =
      this.deps.state.players.find((p) => p.id === handler.playerId) ??
      (handler.ownerless ? (event.player ?? event.source) : undefined)
    if (!player) return undefined

    // 技能身份与运行时状态一并带进去：转换技要靠 `skillState` 分岔两态，
    // 记账类技能要靠它知道自己发动过几次。卡牌 content 没有技能，两个字段留空。
    const skill = this.deps.skillRegistry.get(handler.skillId)

    return new EffectContext(event, player, event.cards ?? [], this.deps, {
      skill,
      skillState: handler.runtime,
    })
  }

  /**
   * 将子事件关联到父事件
   */
  private linkChildToParent(parent: IGameEvent, child: IGameEvent): void {
    parent.addChild(child)
  }

  /**
   * 将 TriggerStage 映射到 EventStatus
   */
  private stageToEventStatus(stage: TriggerStage): EventStatus {
    const mapping: Record<TriggerStage, EventStatus> = {
      Before: EventStatus.Before,
      Begin: EventStatus.Begin,
      Prepare: EventStatus.Prepare,
      Content: EventStatus.Content,
      Prevent: EventStatus.Prevent,
      End: EventStatus.End,
      After: EventStatus.After,
    }
    return mapping[stage]
  }

  /**
   * 执行状态转移
   *
   * 优先用事件自己的 transitionTo（带合法性校验），
   * 兼容没有该方法的轻量事件对象（测试替身）。
   */
  private transitionTo(event: IGameEvent, target: EventStatus): void {
    event.transitionTo(target)
  }
}
