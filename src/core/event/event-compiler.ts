// ============================================================
// 联盟杀 · EventCompiler — 把技能编译成事件钩子
//
// Phase 13 起输入是 `ISkill`（旧 `ISkill` 是它的子接口，自动兼容）。
// 编译是**纯变换**：不持有状态、不依赖游戏子系统。
// 产物 `CompiledHandler` 带着自己的执行体，注册后就与技能定义解耦。
//
// ── skill.execute 的执行顺序 ──
//   1. filter       必要条件，false → 不发动
//   2. filter2      充分条件，定义了就必须 true（“发动了也没用的局面”）
//   3. usable       手动发动的次数上限
//   4. cost         支付代价（选牌/弃牌/选目标）
//   5. content      真正做事
//   6. 记账         标记已用（含转换技翻态、觉醒标记）
//
// **频率不在这一列**。它在 `EventTrigger.getMatchingHandlers` 里就被挡掉了：
// 额度用光的钩子压根不该被收集进来。这样「UI 问这句技能还能不能发动」
// 与「流水线到底跑不跑它」用的是同一个判据，不会各说各话。
//
// 顺序不能换：cost 在 content 之前，代价才可能失败在前、效果半途而废在后；
// 记账在最后，是为了「content 抛错则不计入次数」——发动失败不该扣额度。
// ============================================================

import type {
  ISkill,
  ISkillContext,
  ISkillRuntimeState,
} from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { EventName } from '@core/contracts/event-name'
import {
  isLockedSkill,
  isAwakenSkill,
  skillFrequency,
  skillPriority,
} from '@core/skill/skill-utils'
import { createSkillRuntimeState, markFrequencyUsed } from '@core/skill/skill-runtime'

/**
 * 求技能允许的手动发动次数
 *
 * `usable` 可以是常量也可以是函数；没写 = 无限。
 */
function usableLimit(skill: ISkill, ctx: ISkillContext): number {
  const usable = skill.usable
  if (usable === undefined) return Infinity
  return typeof usable === 'number' ? usable : usable(ctx)
}

/**
 * EventCompiler — 事件编译器
 *
 * 将 `ISkill` + 持有玩家编译为 `CompiledHandler` 列表。
 * 纯变换，无状态，可并发使用。
 */
export class EventCompiler {
  /**
   * 将单个技能编译为一个或多个 CompiledHandler
   *
   * 展开 `trigger` 里四种监听范围（player / source / target / global）下的
   * 每个事件名，每个事件名产出一个 handler。
   *
   * 没有 `trigger` 的技能（纯 Mod 或纯 viewAs）返回空数组——
   * 它们不参与事件流水线，自然也不该有钩子。
   *
   * @param skill   技能定义
   * @param player  技能持有者
   * @param runtime 共享的运行时状态。同一个技能展开出的所有 handler
   *                必须共用一份，否则「每回合限一次」会变成「每事件限一次」。
   *                不传则新建一份（单件套件的测试常用）。
   */
  compile(
    skill: ISkill,
    player: IPlayer,
    runtime: ISkillRuntimeState = createSkillRuntimeState(),
  ): CompiledHandler[] {
    const handlers: CompiledHandler[] = []
    const trigger = skill.trigger
    if (!trigger) return handlers

    const scopes: Array<{
      events: EventName[] | undefined
      scope: CompiledHandler['scope']
    }> = [
      { events: trigger.source, scope: 'source' },
      { events: trigger.target, scope: 'target' },
      { events: trigger.global, scope: 'global' },
      { events: trigger.player, scope: 'player' },
    ]

    for (const { events, scope } of scopes) {
      if (!events) continue
      for (const eventName of events) {
        handlers.push(this.compileEntry(skill, player, eventName, scope, runtime))
      }
    }

    return handlers
  }

  private compileEntry(
    skill: ISkill,
    player: IPlayer,
    eventName: EventName,
    scope: CompiledHandler['scope'],
    runtime: ISkillRuntimeState,
  ): CompiledHandler {
    const frequency = skillFrequency(skill)

    const handler: CompiledHandler = {
      event: eventName,
      scope,
      skillId: skill.id,
      playerId: player.id,
      priority: skillPriority(skill),
      isLocked: isLockedSkill(skill),
      frequency,
      runtime,

      execute: async (ctx: ISkillContext) => {
        // 1. 必要条件
        if (skill.filter && !skill.filter(ctx)) return

        // 2. 充分条件 —— 定义了就必须是 true，用来排除「发动也白搭」的局面
        if (skill.filter2 && !skill.filter2(ctx)) return

        // 3. 次数额度（`usable` 要读局面，因此只能在执行的这一刻算）
        if (runtime.usedCount >= usableLimit(skill, ctx)) return

        // 4. 支付代价
        if (skill.cost) await skill.cost(ctx)

        // 5. 执行内容
        if (skill.content) await skill.content(ctx)

        // 6. 记账 —— 放在最后：content 抛错就落不到这一行，
        //    一次失败的发动不该扣掉额度。
        markFrequencyUsed(runtime, frequency)
        if (isAwakenSkill(skill)) runtime.awakened = true
      },
    }

    return handler
  }
}
