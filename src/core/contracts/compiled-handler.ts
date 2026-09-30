// ============================================================
// 联盟杀 · CompiledHandler — 编译后的效果处理器
//
// EventCompiler 在注册时将 ISkill + player 编译为此结构。
// 编译产物不依赖外部注入，所有服务通过 execute 的参数 ctx 获取。
//
// 运行时 EventDispatcher 匹配到 CompiledHandler 后，
// 创建 ISkillContext 并显式传入 execute() —— 没有暗线传递。
// ============================================================

import type { SkillFrequency, ISkillRuntimeState } from './skill.interface'
import type { EventName } from './event-name'
import type { TriggerScope } from './event.interface'
import type { ISkillContext } from './skill.interface'

/**
 * 编译后的效果处理器
 *
 * 由 EventCompiler 在技能注册时生成，存储在 EventTrigger 的全局索引中。
 * 每个 ISkill + player 监听的每个事件名展开为一个 CompiledHandler。
 */
export interface CompiledHandler {
  /**
   * 监听的事件名（含阶段后缀，如 'damageAfter'）
   *
   * 事件名即触发点：主体决定"什么事"，后缀决定"什么时候"。
   * 扩展包可以用任意自定义字符串，无需改动引擎。
   */
  event: EventName
  /** 触发范围 */
  scope: TriggerScope
  /** 效果 ID */
  skillId: string
  /** 效果持有者玩家 ID */
  playerId: string
  /** 同时机优先级（越高越先执行） */
  priority: number
  /** 是否为锁定技 */
  isLocked: boolean
  /** 频率限制 */
  frequency: SkillFrequency
  /**
   * 运行时状态 —— **同一条技能的所有 handler 共享同一份**
   *
   * 一份技能监听 N 个事件就编译出 N 个 handler，但它们必须共用
   * 一个「本回合用了几次」的答案，否则「每回合限一次」会退化成
   * 「每个事件各限一次」。这里存的是引用，不是副本。
   */
  runtime: ISkillRuntimeState
  /**
   * 无持有者的钩子（全局钩子 / `when()`）
   *
   * 技能的持有者恒是 `playerId`，两件事都由它决定：
   * 上下文里的 `ctx.player` 是谁、以及要不要过技能放行闸
   * （封技 / 死亡）。全局钩子两者都没有——它不是任何人的技能，
   * 于是上下文玩家取自**事件本身**（发起者 → 执行者），
   * 放行闸对它不适用（「封了某人的技能」不该连监听也一起封掉）。
   *
   * 技能钩子一律不写这个字段。
   */
  ownerless?: boolean
  /** 执行入口 —— 由 EventDispatcher 在调度时调用，传入引擎提供的上下文 */
  execute: (context: ISkillContext) => Promise<void>
}
