import type { IGameEvent } from '@core/contracts/event.interface'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { IEffectContext } from '@core/contracts/effect.interface'
import type { EffectContextDeps } from '@core/contracts/effect-context-deps'
import { EffectContext } from '@core/engine/effect-context'
import { EventStatus, type TriggerStage } from '@core/contracts/enums'
import { EventChain } from './event-chain'
import { EventTrigger } from './event-trigger'
import { PriorityManager } from './priority-manager'
/**
 * EventDispatcher 配置选项
 */
export interface EventDispatcherOptions {
  /** 最大事件嵌套深度（防止无限嵌套），默认 20 */
  maxDepth?: number
  /** 是否在 handler 执行出错时继续（默认 false，出错即停止） */
  continueOnError?: boolean
  /** handler 执行前后的日志回调 */
  onHandlerExecute?: (handler: CompiledHandler, event: IGameEvent) => void
  /** 阶段变更回调（调试/日志用） */
  onStageChange?: (event: IGameEvent, stage: TriggerStage) => void
  /** 错误回调 */
  onError?: (error: Error, event: IGameEvent, stage: TriggerStage) => void
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
 * 事件终端状态集合
 */
const TERMINAL_STATUSES: EventStatus[] = [
  EventStatus.Completed,
  EventStatus.Cancelled,
  EventStatus.Prevented,
]

/**
 * 事件是否已结束
 */
function isEventFinished(event: IGameEvent): boolean {
  return TERMINAL_STATUSES.includes(event.status)
}

/**
 * 计算事件嵌套深度
 */
function getEventDepth(event: IGameEvent): number {
  let d = 0
  let current: IGameEvent | undefined = event.parent
  while (current) {
    d += 1
    current = current.parent
  }
  return d
}

/**
 * EventDispatcher — AOP 流水线事件调度器
 */
export class EventDispatcher {
  readonly eventTrigger: EventTrigger
  readonly priorityManager: PriorityManager
  private options: Required<Omit<EventDispatcherOptions, 'deps'>> & Pick<EventDispatcherOptions, 'deps'>
  private deps?: EffectContextDeps

  constructor(options?: EventDispatcherOptions) {
    this.eventTrigger = new EventTrigger()
    this.priorityManager = new PriorityManager()

    this.options = {
      maxDepth: options?.maxDepth ?? 20,
      continueOnError: options?.continueOnError ?? false,
      onHandlerExecute: options?.onHandlerExecute ?? (() => {}),
      onStageChange: options?.onStageChange ?? (() => {}),
      onError: options?.onError ?? (() => {}),
      deps: options?.deps,
    }

    this.deps = options?.deps
  }

  /**
   * 调度事件 — 将事件推入链中并推进至完成
   *
   * @param event - 要调度的事件
   * @param chain - 事件链
   */
  async dispatch(event: IGameEvent, chain: EventChain): Promise<void> {
    // 深度检查
    const actualDepth = getEventDepth(event)
    if (actualDepth >= this.options.maxDepth) {
      throw new Error(
        `[EventDispatcher] 事件嵌套深度超过上限 (${this.options.maxDepth}): ${event.name} (actual: ${actualDepth})`,
      )
    }

    // 如果事件不在链顶，推入
    const alreadyOnTop = chain.peek()?.id === event.id
    if (!alreadyOnTop) {
      chain.push(event)
    }

    try {
      // ── Phase 1: WAITING → SKIP_CHECK ──
      event.status = EventStatus.Waiting

      // 进入 SKIP_CHECK 阶段
      this.transitionTo(event, EventStatus.SkipCheck)

      // 对非 forced 事件，给予取消机会（无懈可击窗口）
      if (!event.forced) {
        if (event.canceled) {
          this.transitionTo(event, EventStatus.Cancelled)
          this.transitionTo(event, EventStatus.Completed)
          return
        }
      }

      // ── Phase 2: 流水线各阶段 ──
      for (const stage of PIPELINE_STAGES) {
        if (isEventFinished(event)) break

        const eventStatus = this.stageToEventStatus(stage)
        this.transitionTo(event, eventStatus)
        this.options.onStageChange(event, stage)

        // 执行该阶段的 handler
        await this.executeHandlers(event, stage)

        // Content 阶段后处理嵌套子事件
        if (stage === 'Content') {
          await this.processNestedEvents(event, chain)
        }

        // Prevent 阶段后检查 Prevented 分支
        if (stage === 'Prevent' && event.prevented && !event.forced) {
          this.transitionTo(event, EventStatus.Prevented)
          this.options.onStageChange(event, 'Prevent')

          this.transitionTo(event, EventStatus.End)
          this.options.onStageChange(event, 'End')
          await this.executeHandlers(event, 'End')

          this.transitionTo(event, EventStatus.After)
          this.options.onStageChange(event, 'After')
          await this.executeHandlers(event, 'After')

          // prevented 子流程完成后，跳过剩余的正常阶段
          break
        }
      }

      // ── Phase 3: 标记完成 ──
      if (!isEventFinished(event)) {
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
    }
  }

  /**
   * 调度事件直到链为空
   */
  async dispatchAll(chain: EventChain): Promise<void> {
    while (!chain.isEmpty()) {
      const event = chain.pop()!
      await this.dispatch(event, chain)
    }
  }

  // ── 私有方法 ──

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

    const sorted = this.priorityManager.prioritize(handlers)

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
   * 为 handler 创建 EffectContext
   */
  private createContext(event: IGameEvent, handler: CompiledHandler): IEffectContext | undefined {
    if (!this.deps) return undefined

    const player = this.deps.state.players.find((p) => p.id === handler.playerId)
    if (!player) return undefined

    return new EffectContext(event, player, event.cards ?? [], this.deps)
  }

  /**
   * 将子事件关联到父事件
   */
  private linkChildToParent(parent: IGameEvent, child: IGameEvent): void {
    if (!child.player && parent.player) {
      ;(child as { player?: IGameEvent['player'] }).player = parent.player
    }
    if (!child.parent) {
      ;(child as { parent?: IGameEvent }).parent = parent
    }
    parent.children.push(child)
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
   */
  private transitionTo(event: IGameEvent, target: EventStatus): void {
    const eventWithTransition = event as { transitionTo?: (target: EventStatus) => void }
    if (typeof eventWithTransition.transitionTo === 'function') {
      eventWithTransition.transitionTo(target)
    } else {
      event.status = target
      if (target === EventStatus.Cancelled) event.canceled = true
      if (target === EventStatus.Prevented) event.prevented = true
    }
  }
}
