// ============================================================
// 联盟杀 · EventDispatcher — AOP 流水线事件调度器
//
// 事件系统的核心调度引擎。将事件按流水线阶段推进，
// 在每个阶段查询并执行匹配的技能钩子。
//
// 完整流水线:
//   WAITING → SKIP_CHECK → (CANCELLED) → BEFORE → BEGIN
//     → PREPARE → CONTENT → PREVENT → (PREVENTED) → END → AFTER → COMPLETED
//
// 嵌套事件处理 (LIFO):
//   事件A 的 CONTENT 阶段触发事件B → B推入EventChain栈顶
//   → B完整结算 → B出栈 → EventChain栈顶恢复为A → A继续PREVENT阶段
//
// 设计要点:
//   - 所有钩子通过 EventTrigger 匹配
//   - 同时机钩子通过 PriorityManager 排序
//   - 需要玩家决策时通过 EventPauseManager 暂停
//   - 支持 forced 事件（不可取消/阻止）
//   - 支持 silent 事件（不产生日志）
// ============================================================

import type { IGameEvent, IEventContext, EventHookRegistration } from '@core/contracts/event.interface'
import { EventStatus, type TriggerStage } from '@core/contracts/enums'
import { EventChain } from './event-chain'
import { EventTrigger } from './event-trigger'
import { PriorityManager } from './priority-manager'
import { EventPauseManager } from './event-pause-manager'

/**
 * EventDispatcher 配置选项
 */
export interface EventDispatcherOptions {
  /** 最大事件嵌套深度（防止无限嵌套），默认 20 */
  maxDepth?: number
  /** 是否在钩子执行出错时继续（默认 false，出错即停止） */
  continueOnError?: boolean
  /** 钩子执行前后的日志回调 */
  onHookExecute?: (registration: EventHookRegistration, event: IGameEvent) => void
  /** 阶段变更回调（调试/日志用） */
  onStageChange?: (event: IGameEvent, stage: TriggerStage) => void
  /** 错误回调 */
  onError?: (error: Error, event: IGameEvent, stage: TriggerStage) => void
}

/**
 * 流水线阶段顺序
 *
 * 定义事件从创建到完成的完整生命周期。
 * SKIP_CHECK → CANCELLED 和 PREVENT → PREVENTED 是条件分支，
 * 在循环外部处理。
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
 * 事件是否已结束（已完成、已取消或已阻止）
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
 * 将子事件关联到父事件
 */
function linkChildToParent(parent: IGameEvent, child: IGameEvent): void {
  if (!child.player && parent.player) {
    ;(child as { player?: IGameEvent['player'] }).player = parent.player
  }
  if (!child.parent) {
    ;(child as { parent?: IGameEvent }).parent = parent
  }
  parent.children.push(child)
}

/**
 * EventDispatcher — AOP 流水线事件调度器
 */
export class EventDispatcher {
  readonly eventTrigger: EventTrigger
  readonly priorityManager: PriorityManager
  readonly pauseManager: EventPauseManager

  private options: Required<EventDispatcherOptions>

  constructor(options?: EventDispatcherOptions) {
    this.eventTrigger = new EventTrigger()
    this.priorityManager = new PriorityManager()
    this.pauseManager = new EventPauseManager()

    this.options = {
      maxDepth: options?.maxDepth ?? 20,
      continueOnError: options?.continueOnError ?? false,
      onHookExecute: options?.onHookExecute ?? (() => {}),
      onStageChange: options?.onStageChange ?? (() => {}),
      onError: options?.onError ?? (() => {}),
    }
  }

  /**
   * 调度事件 — 将事件推入链中并推进至完成
   *
   * 这是事件系统的核心入口。
   *
   * 如果事件已经在链顶（由外部预推入），不会重复推入。
   * 调度完成后，如果事件仍在链顶，自动弹出。
   *
   * @param event - 要调度的事件
   * @param chain - 事件链
   */
  async dispatch(event: IGameEvent, chain: EventChain): Promise<void> {
    // 深度检查 — 基于 parent 链的真实嵌套深度，而非事件栈大小
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
        // SKIP_CHECK 阶段检查是否被外部取消
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

        // 执行该阶段的钩子
        await this.executeHooks(event, stage)

        // Content 阶段后处理嵌套子事件
        if (stage === 'Content') {
          await this.processNestedEvents(event, chain)
        }

        // Prevent 阶段后检查 Prevented 分支
        if (stage === 'Prevent' && event.prevented && !event.forced) {
          // 进入 prevented 子流程
          this.transitionTo(event, EventStatus.Prevented)
          this.options.onStageChange(event, 'Prevent')

          this.transitionTo(event, EventStatus.End)
          this.options.onStageChange(event, 'End')
          await this.executeHooks(event, 'End')

          this.transitionTo(event, EventStatus.After)
          this.options.onStageChange(event, 'After')
          await this.executeHooks(event, 'After')

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
   *
   * 持续从链顶取出事件并调度，直到事件链清空。
   *
   * @param chain - 事件链（其中的事件会被依次取出调度）
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
   *
   * Content 阶段后，检查链顶是否出现了新事件（子事件）。
   * 若有，依次弹出并调度（LIFO: 后进先处理）。
   *
   * 每个子事件从链中弹出后再 dispatch，dispatch 会负责重新推入和最终弹出。
   */
  private async processNestedEvents(event: IGameEvent, chain: EventChain): Promise<void> {
    while (!chain.isEmpty() && chain.peek()?.id !== event.id) {
      const childEvent = chain.pop()!
      linkChildToParent(event, childEvent)
      await this.dispatch(childEvent, chain)
    }
  }

  /**
   * 执行指定阶段的所有匹配钩子
   */
  private async executeHooks(event: IGameEvent, stage: TriggerStage): Promise<void> {
    const hooks = this.eventTrigger.getMatchingHooks(event, stage)

    if (hooks.length === 0) return

    const sorted = this.priorityManager.prioritize(hooks)

    const context: IEventContext = {
      event,
      chain: [],
      depth: getEventDepth(event),
    }

    for (const registration of sorted) {
      this.options.onHookExecute(registration, event)
      try {
        await registration.hook(event, context)
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
