// ============================================================
// 联盟杀 · EventPauseManager
//
// 暂停粒度是**单个事件**而非整个事件栈：
// 一个事件等待玩家决策时，只阻塞它自己，同一条链上的其它事件不受影响。
// ============================================================

import { gameClock } from '@core/utils/clock'

export interface PauseState {
  /** 被暂停的事件 id */
  eventId: string
  /** 暂停原因（调试用） */
  reason: string
  /** 暂停时刻的逻辑刻度（不取挂钟——它会被写进调试档案） */
  timestamp: number
  /** resolve 回调 — 调用以恢复 */
  resolve: () => void
  /** reject 回调 — 调用以取消 */
  reject: (error: Error) => void
  /** 超时计时器 */
  timeoutTimer?: ReturnType<typeof setTimeout>
}

export class EventPauseManager {
  /** 暂停状态栈（支持嵌套暂停） */
  private pauseStack: PauseState[] = []
  /** 全局超时时间（毫秒），0 表示不启用 */
  private defaultTimeout: number
  /** 是否允许嵌套暂停 */
  private allowNested: boolean

  constructor(options?: { defaultTimeout?: number; allowNested?: boolean }) {
    this.defaultTimeout = options?.defaultTimeout ?? 0
    this.allowNested = options?.allowNested ?? true
  }

  /**
   * 暂停某个事件的执行
   *
   * @param eventId - 被暂停的事件 id
   * @param reason - 暂停原因（调试/日志用）
   * @param timeout - 超时时间（ms），超时后自动恢复。0 表示不超时，默认使用全局超时
   * @returns Promise，在 resume() 被调用或超时后 resolve
   */
  pause(eventId: string, reason: string, timeout?: number): Promise<void> {
    // 如果不允许嵌套且已有暂停，先恢复上一个
    if (!this.allowNested && this.pauseStack.length > 0) {
      this.resume()
    }
    const effectiveTimeout = timeout ?? this.defaultTimeout
    return new Promise<void>((resolve, reject) => {
      const state: PauseState = {
        eventId,
        reason,
        timestamp: gameClock.next(),
        resolve,
        reject,
      }
      // 设置超时
      if (effectiveTimeout > 0) {
        state.timeoutTimer = setTimeout(() => {
          this.removeState(state)
          resolve()
        }, effectiveTimeout)
      }
      this.pauseStack.push(state)
    })
  }

  /**
   * 恢复事件执行
   *
   * @param eventId - 指定事件则恢复该事件最近的一个暂停点；
   *                  省略则恢复栈顶（最近）的一个暂停点。
   */
  resume(eventId?: string): void {
    const index = this.findStateIndex(eventId)
    if (index === -1) return
    const state = this.pauseStack[index]!
    this.pauseStack.splice(index, 1)
    this.clearTimer(state)
    state.resolve()
  }

  /**
   * 恢复所有暂停点
   */
  resumeAll(): void {
    while (this.pauseStack.length > 0) {
      this.resume()
    }
  }

  /**
   * 取消暂停（以错误方式解除阻塞）
   *
   * @param eventId - 指定事件则取消该事件最近的暂停点；省略则取消栈顶
   * @param reason - 取消原因
   */
  cancel(eventId?: string, reason?: string): void {
    const index = this.findStateIndex(eventId)
    if (index === -1) return
    const state = this.pauseStack[index]!
    this.pauseStack.splice(index, 1)
    this.clearTimer(state)
    state.reject(new Error(reason ?? 'Pause cancelled'))
  }

  /**
   * 取消所有暂停
   */
  cancelAll(reason?: string): void {
    while (this.pauseStack.length > 0) {
      this.cancel(undefined, reason)
    }
  }

  /**
   * 是否处于暂停状态
   *
   * @param eventId - 指定事件则只判断该事件；省略则判断是否存在任意暂停
   */
  isPaused(eventId?: string): boolean {
    return this.findStateIndex(eventId) !== -1
  }

  /**
   * 当前暂停深度
   */
  get pauseDepth(): number {
    return this.pauseStack.length
  }

  /**
   * 获取当前暂停原因
   */
  get currentReason(): string | null {
    if (this.pauseStack.length === 0) return null
    return this.pauseStack[this.pauseStack.length - 1]!.reason
  }

  /**
   * 获取所有暂停原因（调试用）
   */
  getAllReasons(): string[] {
    return this.pauseStack.map((s) => s.reason)
  }

  /**
   * 获取当前处于等待中的事件 id（按暂停顺序）
   */
  getPendingEventIds(): string[] {
    return this.pauseStack.map((s) => s.eventId)
  }

  /**
   * 重置管理器状态
   */
  reset(): void {
    this.cancelAll('EventPauseManager reset')
    this.pauseStack = []
  }

  // ── 私有方法 ──

  /** 找到待操作的暂停点下标（-1 表示不存在） */
  private findStateIndex(eventId?: string): number {
    for (let i = this.pauseStack.length - 1; i >= 0; i -= 1) {
      const state = this.pauseStack[i]
      if (state && (eventId === undefined || state.eventId === eventId)) {
        return i
      }
    }
    return -1
  }

  private clearTimer(state: PauseState): void {
    if (state.timeoutTimer) {
      clearTimeout(state.timeoutTimer)
      state.timeoutTimer = undefined
    }
  }

  private removeState(target: PauseState): void {
    const index = this.pauseStack.indexOf(target)
    if (index !== -1) {
      this.pauseStack.splice(index, 1)
    }
  }
}
