// ============================================================
// 联盟杀 · when() — 一次性监听（Phase 17）
//
// 技能的 `trigger` 是**长期的**：挂上去就一直有效，直到技能被摘。
// 但内容里大量出现的是另一种需求——「**接下来这一次**发生 X 时，做 Y」：
//
//   【借刀杀人】结算后，若被杀者死亡，杀他的人要弃装备
//   【放逐】   跳过下一个回合的摸牌阶段
//   【铁索连环】下次受到的属性伤害传给下一个人
//
// 用技能表达它们要付两次代价：先造一条 `ISkill` 写 `trigger` + `filter`，
// 再在 content 里挂上它、并在合适时机记得摘掉。忘了摘就是幽灵钩子。
//
// `when()` 把这三件事合成一句话：
//
// ```ts
// ctx.when('drawEnd')
//   .filter((event) => event.player === ctx.player)
//   .once()
//   .then(async (c) => { await c.drawCards(1) })
//   .finish()
// ```
//
// ── 四条约定 ──
// 1. **`.once()` 先摘后跑**。注销发生在 `then` 之前：`then` 里再触发
//    同一个事件也不会重入，而 `then` 抛错也不会留下一条已废未摘的钩子。
// 2. **`filter` 看的是事件，不是上下文**。它回答「这一次算不算」，
//    拿不到 `ctx`（那时还没有上下文）。要看局面就写在 `then` 里。
// 3. **监听属于某个玩家**，因此过技能放行闸：他死了就不再触发。
//    不属于任何人的监听请用 `GlobalHookRegistry`（`core/event/global-hook.ts`）。
// 4. **`finish()` 才真的挂上**。构造器本身什么都不做——
//    半句没写完的监听不该自己生效。
// ============================================================

import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { EventName } from '@core/contracts/event-name'
import type { TriggerScope } from '@core/contracts/event.interface'
import type { IGameEvent } from '@core/contracts/event.interface'
import type {
  IWhenBuilder,
  IWhenHandle,
  ISkillContext,
} from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { createSkillRuntimeState } from '@core/skill/skill-runtime'
import type { EventTrigger } from './event-trigger'

/** 监听编号前缀（仅用于识别，不对应任何技能） */
const WHEN_PREFIX = '__when:'

/** 全局编号，只为了编号不撞车——身份靠 handler 对象，不靠它 */
let whenSeq = 0

/**
 * 一次性监听的句柄
 */
class WhenHandle implements IWhenHandle {
  /** 已经触发过几次（通过了 `filter` 才算） */
  fired = 0

  constructor(
    readonly id: string,
    private onOff: () => void,
  ) {}

  /** 摘掉这条监听；重复调用无害 */
  off(): void {
    this.onOff()
  }
}

/**
 * `when()` 构造器
 *
 * 链式方法都返回 `this`，因此写法上是一句话；只有 `finish()` 会产生副作用。
 */
export class WhenBuilder implements IWhenBuilder {
  private predicates: Array<(event: IGameEvent) => boolean> = []
  private effect?: (ctx: ISkillContext) => void | Promise<void>
  private onceOnly = false
  private triggerScope: TriggerScope = 'global'
  private priorityValue = 0

  constructor(
    private player: IPlayer,
    private event: EventName,
    private trigger: EventTrigger,
  ) {}

  /** 只在这次事件满足条件时触发；可写多个，全部满足才算 */
  filter(predicate: (event: IGameEvent) => boolean): this {
    this.predicates.push(predicate)
    return this
  }

  /**
   * 监听范围，默认 `global`
   *
   * 与技能的 `trigger` 同义：想限定「自己作为目标」就写 `target`。
   */
  scope(scope: TriggerScope): this {
    this.triggerScope = scope
    return this
  }

  /** 同时机优先级（越高越先跑），默认 0 */
  priority(value: number): this {
    this.priorityValue = value
    return this
  }

  /** 触发一次后自动注销 */
  once(): this {
    this.onceOnly = true
    return this
  }

  /**
   * 触发时做什么
   *
   * 方法名 `then` 会让这个构造器变成 thenable——**漏写 `.finish()` 又拿它
   * `await` 会永久挂起**（`then` 拿到的两个参数是 resolve/reject，
   * 而这里当成了效果函数，于是 resolve 永不被调用）。
   * 名字是链式写法的一部分（`when(…).then(…).finish()`），不能改，
   * 因此只在这里留一句警告：拿 `when()` 的结果，一律先 `.finish()`。
   */
  // oxlint-disable-next-line no-thenable
  then(effect: (ctx: ISkillContext) => void | Promise<void>): this {
    this.effect = effect
    return this
  }

  /**
   * 挂上这条监听
   *
   * 返回值握着才能提前摘掉它——「下回合的摸牌阶段」这类监听
   * 常常因为局面变化（人死了、牌被无懈了）而不再需要。
   */
  finish(): IWhenHandle {
    const id = `${WHEN_PREFIX}${++whenSeq}`
    const handle = new WhenHandle(id, () => this.remove(handler))
    const predicates = [...this.predicates]
    const effect = this.effect

    const handler: CompiledHandler = {
      event: this.event,
      scope: this.triggerScope,
      skillId: id,
      playerId: this.player.id,
      priority: this.priorityValue,
      isLocked: false,
      frequency: 'unlimited',
      // 一次性监听没有「本回合发动了几次」这回事，
      // 给一份独立状态免得误改别处的计数。
      runtime: createSkillRuntimeState(),

      execute: async (ctx) => {
        for (const predicate of predicates) {
          if (!predicate(ctx.event)) return
        }

        handle.fired += 1
        // 先摘后跑：`then` 里再触发同一事件不会重入，
        // `then` 抛错也不会留下一条已废未摘的钩子。
        if (this.onceOnly) this.remove(handler)

        if (effect) await effect(ctx)
      },
    }

    this.trigger.registerCompiled(handler)
    return handle
  }

  private remove(handler: CompiledHandler): void {
    this.trigger.unregisterBy((candidate) => candidate === handler)
  }
}

/**
 * 起一条监听 —— `player.when(eventName)` 的引擎侧写法
 *
 * 内容作者更常写 `ctx.when(name)`（见 `ISkillContext.when`），
 * 它就是这个函数的薄封装：监听归属于 `ctx.player`。
 */
export function whenOf(
  player: IPlayer,
  event: EventName,
  trigger: EventTrigger,
): WhenBuilder {
  return new WhenBuilder(player, event, trigger)
}
