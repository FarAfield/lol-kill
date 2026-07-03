import type { IGameEvent } from '@core/contracts/event.interface'
export class EventChain {
  private stack: IGameEvent[] = []
  /**
   * 推入事件到栈顶
   */
  push(event: IGameEvent): void {
    this.stack.push(event)
  }

  /**
   * 弹出栈顶事件
   * @returns 栈顶事件，若栈为空则返回 null
   */
  pop(): IGameEvent | null {
    return this.stack.pop() ?? null
  }

  /**
   * 查看栈顶事件（不改变栈状态）
   * @returns 栈顶事件，若栈为空则返回 null
   */
  peek(): IGameEvent | null {
    if (this.stack.length === 0) return null
    return this.stack[this.stack.length - 1]!
  }

  /**
   * 栈是否为空
   */
  isEmpty(): boolean {
    return this.stack.length === 0
  }

  /**
   * 当前栈深度
   */
  get depth(): number {
    return this.stack.length
  }

  /**
   * 获取完整栈（调试用，返回副本）
   */
  getStack(): IGameEvent[] {
    return [...this.stack]
  }

  /**
   * 获取栈顶的若干事件（调试用）
   * @param count 要获取的数量
   */
  getTop(count: number): IGameEvent[] {
    return this.stack.slice(-count)
  }

  /**
   * 清空事件栈
   */
  clear(): void {
    this.stack = []
  }
}
