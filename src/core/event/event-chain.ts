// ============================================================
// 联盟杀 · EventChain — LIFO 事件栈
//
// 三国杀结算的核心规则是「后发先至」——最新触发的事件优先结算。
// EventChain 使用后进先出（LIFO）栈精确模拟这一规则。
//
// 嵌套示例:
//   事件A(BEGIN) → 事件A触发事件B → B进入栈顶
//   → B 完整结算 → B出栈 → A继续CONTENT → A完成
// ============================================================

import type { IGameEvent } from '@core/contracts/event.interface'

/**
 * LIFO 事件栈
 *
 * 所有游戏事件的结算通过此栈管理。
 * 新事件总是推入栈顶并优先结算，结算完成后弹出，
 * 前一个事件从暂停处继续。
 */
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
