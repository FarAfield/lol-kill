export interface PauseState {
  /** 暂停原因（调试用） */
  reason: string
  /** 暂停时间戳 */
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
   * 暂停事件执行
   *
   * @param reason - 暂停原因（调试/日志用）
   * @param timeout - 超时时间（ms），超时后自动恢复。0 表示不超时，默认使用全局超时
   * @returns Promise，在 resume() 被调用或超时后 resolve
   */
  pause(reason: string, timeout?: number): Promise<void> {
    // 如果不允许嵌套且已有暂停，先恢复上一个
    if (!this.allowNested && this.pauseStack.length > 0) {
      this.resume()
    }
    const effectiveTimeout = timeout ?? this.defaultTimeout
    return new Promise<void>((resolve, reject) => {
      const state: PauseState = {
        reason,
        timestamp: Date.now(),
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
   * 恢复最近的一个暂停点（栈顶）。
   * 如果栈为空则什么都不做。
   */
  resume(): void {
    const state = this.pauseStack.pop()
    if (state) {
      this.clearTimer(state)
      state.resolve()
    }
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
   * 取消当前暂停
   * @param reason - 取消原因
   */
  cancel(reason?: string): void {
    const state = this.pauseStack.pop()
    if (state) {
      this.clearTimer(state)
      state.reject(new Error(reason ?? 'Pause cancelled'))
    }
  }

  /**
   * 取消所有暂停
   */
  cancelAll(reason?: string): void {
    while (this.pauseStack.length > 0) {
      this.cancel(reason)
    }
  }

  /**
   * 当前是否处于暂停状态
   */
  get isPaused(): boolean {
    return this.pauseStack.length > 0
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
   * 重置管理器状态
   */
  reset(): void {
    this.cancelAll('EventPauseManager reset')
    this.pauseStack = []
  }

  // ── 私有方法 ──

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
