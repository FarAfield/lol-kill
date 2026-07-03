// ============================================================
// 联盟杀 · CompiledHandler — 编译后的效果处理器
//
// EventCompiler 在注册时将 IEffect + player 编译为此结构。
// 编译产物不依赖外部注入，所有服务通过 execute 的参数 ctx 获取。
//
// 运行时 EventDispatcher 匹配到 CompiledHandler 后，
// 创建 IEffectContext 并显式传入 execute() —— 没有暗线传递。
// ============================================================

import type { TriggerTiming, TriggerStage, Frequency } from './enums'
import type { IEffectContext } from './effect.interface'

/**
 * 编译后的效果处理器
 *
 * 由 EventCompiler 在技能注册时生成，存储在 EventTrigger 的全局索引中。
 * 每个 IEffect + player 展开为多个 CompiledHandler（每个 TriggerEntry 一个）。
 */
export interface CompiledHandler {
  /** 触发时机 */
  timing: TriggerTiming
  /** 触发阶段 */
  stage: TriggerStage
  /** 触发范围 */
  scope: 'player' | 'source' | 'global' | 'target'
  /** 效果 ID */
  skillId: string
  /** 效果持有者玩家 ID */
  playerId: string
  /** 同时机优先级（越高越先执行） */
  priority: number
  /** 是否为锁定技 */
  isLocked: boolean
  /** 频率限制 */
  frequency: Frequency
  /** 是否启用 */
  enabled: boolean
  /** 本回合是否已使用 */
  usedThisTurn: boolean
  /** 本轮是否已使用 */
  usedThisRound: boolean
  /** 执行入口 —— 由 EventDispatcher 在调度时调用，传入引擎提供的上下文 */
  execute: (context: IEffectContext) => Promise<void>
}
