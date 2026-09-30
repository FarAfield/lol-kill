// ============================================================
// 联盟杀 · ContentRegistry — 事件默认处理器
//
// 对齐无名杀 `lib.element.Content`：「这个事件本身做什么」。
//
// 与技能（Trigger）的分工：
// - **Content** = 事件的默认行为。一张卡牌一张脸，与「谁在用」无关。
//   查表键是事件名；卡牌用牌时以**卡牌 id** 作为事件名触发子事件。
// - **Trigger** = 某人在某个时机额外做的事（技能）。由 SkillRegistry 注册。
//
// Content 只在事件**没有注册任何步骤**时挂载为 step 0，
// 因此一个事件要么走默认内容，要么由调用方自带步骤机，不会互相覆盖。
// ============================================================

import type { EventName } from '@core/contracts/event-name'
import type { ISkillContext } from '@core/contracts/skill.interface'

/**
 * 事件内容
 *
 * 接收受限上下文，返回 Promise（可异步等待玩家决策）。
 * 内容内部可以 `await ctx.waitForResponse(...)`、`ctx.emit(...)`、
 * `ctx.event.trigger(...)` —— 不需要自己写步骤机。
 */
export type EventContent = (ctx: ISkillContext) => Promise<void> | void

/**
 * 内容登记项
 *
 * 用数组而不是 Record，是为了保留注册顺序（同名后注册者覆盖，顺序可追溯）。
 */
export type ContentEntry = readonly [EventName, EventContent]

export class ContentRegistry {
  private contents = new Map<EventName, EventContent>()

  /**
   * 注册一个事件的内容
   *
   * 同名重复注册会**覆盖**并在 dev 下告警——内容应该是唯一的，
   * 出现覆盖通常意味着两个扩展包抢了同一张牌。
   */
  register(name: EventName, content: EventContent): void {
    if (this.contents.has(name)) {
      console.warn(`[ContentRegistry] 内容重复注册，后者覆盖前者: ${name}`)
    }
    this.contents.set(name, content)
  }

  /** 批量注册 */
  registerAll(entries: Iterable<ContentEntry>): void {
    for (const [name, content] of entries) {
      this.register(name, content)
    }
  }

  /** 取内容（未注册返回 undefined） */
  get(name: EventName): EventContent | undefined {
    return this.contents.get(name)
  }

  /** 是否已注册 */
  has(name: EventName): boolean {
    return this.contents.has(name)
  }

  /** 注销（返回是否确有其项） */
  unregister(name: EventName): boolean {
    return this.contents.delete(name)
  }

  /** 已注册的事件名清单（按注册顺序） */
  names(): EventName[] {
    return [...this.contents.keys()]
  }

  /** 已注册数量 */
  get size(): number {
    return this.contents.size
  }

  /** 清空（测试/重开用） */
  clear(): void {
    this.contents.clear()
  }
}
