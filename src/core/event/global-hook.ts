// ============================================================
// 联盟杀 · GlobalHookRegistry — 全局钩子（Phase 17）
//
// 技能回答的是「**某个人**在某个时机额外做什么」——它的持有者决定了
// `ctx.player` 是谁，也决定了谁死了、谁被封技就不再触发。
//
// 但有一类监听不属于任何人：
//
//   「本局第一次有人出牌时…」            （成就 / 教学引导）
//   「任意角色受到伤害时记一笔」          （统计 / 回放）
//   「有人死亡时翻开身份」                （规则本身，不是某个人的技能）
//
// 它们的共同点是**没有持有者**：写成技能就得凭空指定一个人来持有它，
// 而「指定的这个人死了」会让它意外失效——这正是全局钩子必须存在、
// 且不能靠 `ISkill` 凑出来的理由。
//
// ── 与技能钩子的两处不同 ──
// |            | 技能钩子              | 全局钩子                  |
// |------------|----------------------|---------------------------|
// | ctx.player | 恒是技能持有者        | 取自事件本身（发起者→执行者）|
// | 放行闸      | 封技 / 死亡 → 不触发  | 不过闸（它不是技能）        |
//
// 两处都由 `CompiledHandler.ownerless` 表达，见 `compiled-handler.ts`。
//
// ── 注销 ──
// 钩子**必须能摘**：一次性监听忘了摘就是幽灵钩子，它会在整局里
// 反复生效。`on()` 返回的句柄带 `off()`，`off(id)` / `clear()` 也能摘。
// 摘按**对象身份**，不按 skillId——同名的两条钩子不该一起消失。
// ============================================================

import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { EventName } from '@core/contracts/event-name'
import type { TriggerScope } from '@core/contracts/event.interface'
import type { ISkillContext } from '@core/contracts/skill.interface'
import { createSkillRuntimeState } from '@core/skill/skill-runtime'
import type { EventTrigger } from './event-trigger'

/** 钩子体 */
export type GlobalHookFn = (ctx: ISkillContext) => void | Promise<void>

/** 注册选项 */
export interface GlobalHookOptions {
  /**
   * 监听范围，默认 `global`
   *
   * 与技能的 `trigger` 同义：想只听「自己作为目标」的事件就写 `target`，
   * 但那样就该用 `when()` 或写一条技能——全局钩子的本分是 `global`。
   */
  scope?: TriggerScope
  /** 同时机优先级（越高越先跑），默认 0 */
  priority?: number
}

/**
 * 一条已注册的钩子
 *
 * 句柄而不是 id 字符串：`on()` 的调用方通常要在某处摘掉它，
 * 拿着句柄就不用记住编号。想按编号摘也有 `off(id)`。
 */
export interface IGlobalHook {
  /** 钩子编号（形如 `__hook:3`） */
  readonly id: string
  /** 监听的事件名 */
  readonly event: EventName
  /** 摘掉这条钩子；重复调用无害 */
  off(): void
}

/** 钩子编号前缀（仅用于识别，不对应任何技能） */
const HOOK_PREFIX = '__hook:'

/**
 * 全局钩子注册表
 *
 * 每条钩子编译成一条 `ownerless` 的 `CompiledHandler` 挂进 `EventTrigger`，
 * 于是它和技能钩子走**同一条流水线**：同样的阶段后缀、同样的优先级排序、
 * 同样的 `EffectContext`。引擎因此不需要为「监听」再开一条路。
 */
export class GlobalHookRegistry {
  private seq = 0
  /** 本注册表挂上去的钩子（按对象身份摘，不按 id 过滤） */
  private hooks = new Set<CompiledHandler>()

  constructor(private trigger: EventTrigger) {}

  /**
   * 注册一条全局钩子
   *
   * @returns 句柄，握着它才能 `off()`
   */
  on(
    event: EventName,
    fn: GlobalHookFn,
    options?: GlobalHookOptions,
  ): IGlobalHook {
    const id = `${HOOK_PREFIX}${++this.seq}`

    const handler: CompiledHandler = {
      event,
      scope: options?.scope ?? 'global',
      skillId: id,
      // 没有持有者：`ctx.player` 由事件本身决定（见 `ownerless` 的说明）
      playerId: '',
      priority: options?.priority ?? 0,
      isLocked: false,
      frequency: 'unlimited',
      // 全局钩子没有「本回合发动了几次」这回事，给一份一次性状态免得误改别处的计数
      runtime: createSkillRuntimeState(),
      ownerless: true,
      execute: async (ctx) => {
        await fn(ctx)
      },
    }

    this.trigger.registerCompiled(handler)
    this.hooks.add(handler)

    return {
      id,
      event,
      off: () => this.remove(handler),
    }
  }

  /**
   * 按编号摘掉一条钩子
   *
   * @returns 是否真的摘掉了（编号不存在 / 已摘过 → false）
   */
  off(id: string): boolean {
    for (const handler of this.hooks) {
      if (handler.skillId !== id) continue
      this.remove(handler)
      return true
    }
    return false
  }

  /** 摘掉本注册表挂上去的全部钩子（技能钩子不受影响） */
  clear(): void {
    const doomed = new Set(this.hooks)
    this.hooks.clear()
    this.trigger.unregisterBy((handler) => doomed.has(handler))
  }

  /** 当前挂着的钩子数 */
  get count(): number {
    return this.hooks.size
  }

  /** 当前钩子编号（调试用） */
  get ids(): string[] {
    return [...this.hooks].map((handler) => handler.skillId)
  }

  private remove(handler: CompiledHandler): void {
    if (!this.hooks.delete(handler)) return
    this.trigger.unregisterBy((candidate) => candidate === handler)
  }
}
