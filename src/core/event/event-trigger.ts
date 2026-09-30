// ============================================================
// 联盟杀 · EventTrigger — 事件触发器管理器
//
// 维护全局 CompiledHandler 注册表，在事件推进到各阶段时
// 提供匹配的 handler 供 EventDispatcher 执行。
//
// 与旧版 EventHookRegistration 不同，CompiledHandler 在
// 注册时已完成编译，不依赖 event.data['_effectContext'] 暗线。
// ============================================================

import type { IGameEvent } from '@core/contracts/event.interface'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { IPlayer } from '@core/contracts/player.interface'
import type { TriggerStage } from '@core/contracts/enums'
import type { FrequencyScope, ISkillRuntimeState } from '@core/contracts/skill.interface'
import { matchesEventName } from '@core/contracts/event-name'
import { resetFrequencyOf, withinFrequency } from '@core/skill/skill-runtime'

/**
 * 技能放行判定
 *
 * 返回 `false` = 这个技能此刻被封，它的全部钩子都不参与匹配。
 * 由引擎注入 `mod.skillEnabled`——EventTrigger 不认识 ModRegistry，
 * 也不该认识：它只管「哪些钩子该跑」。
 *
 * 首参是持有者的 **id** 而不是 `IPlayer`：触发器手里只有 id，
 * 解析玩家的活儿归引擎（它才有 `state.players`）。
 */
export type SkillGate = (
  playerId: string,
  skillId: string,
  event: IGameEvent,
) => boolean

/**
 * EventTrigger — 事件触发器管理器
 */
export class EventTrigger {
  /** 全局 CompiledHandler 注册表 */
  private handlers: CompiledHandler[] = []

  /** 技能放行判定（由引擎注入，缺省一律放行） */
  private skillGate?: SkillGate

  /**
   * 注册一个编译后的 handler
   */
  registerCompiled(handler: CompiledHandler): void {
    this.handlers.push(handler)
  }

  /**
   * 批量注册编译后的 handlers
   */
  registerCompiledBatch(handlers: CompiledHandler[]): void {
    this.handlers.push(...handlers)
  }

  /**
   * 注销指定效果 ID 的所有 handler
   */
  unregister(skillId: string): void {
    this.handlers = this.handlers.filter((h) => h.skillId !== skillId)
  }

  /**
   * 注销指定玩家的所有 handler
   */
  unregisterAll(player: IPlayer): void {
    this.handlers = this.handlers.filter((h) => h.playerId !== player.id)
  }

  /**
   * 注销匹配条件的 handler
   */
  unregisterBy(predicate: (handler: CompiledHandler) => boolean): void {
    this.handlers = this.handlers.filter((h) => !predicate(h))
  }

  /**
   * 清空所有注册
   */
  clear(): void {
    this.handlers = []
  }

  /**
   * 注入技能放行判定
   *
   * 引擎在装配时调一次。不注入 = 所有技能恒可用。
   */
  setSkillGate(gate: SkillGate | undefined): void {
    this.skillGate = gate
  }

  /**
   * 获取指定事件在某阶段下的所有匹配 handler
   *
   * 匹配条件:
   *   1. handler.event === 事件在当前阶段的完整事件名（主体 + 阶段后缀）
   *   2. scope 匹配（source / target / global / player）
   *   3. **频率额度还没用光**（Phase 15 起前置到这一步）
   *   4. `mod.skillEnabled` 放行（技能被封时它的钩子一个都不跑）
   *
   * 第 3 条放在这里而不是 handler 的执行体里，是为了让
   * 「流水线会不会跑它」与「UI 问 SkillRegistry.isAvailable 得到的答案」
   * 出自同一个判据——两处各判一次的话，迟早有一处漏掉某一档频率。
   *
   * @param event - 当前事件
   * @param stage - 当前流水线阶段
   * @returns 所有匹配的 handler
   */
  getMatchingHandlers(event: IGameEvent, stage: TriggerStage): CompiledHandler[] {
    return this.handlers.filter((handler) => {
      // 1. 事件名必须匹配（含阶段后缀）
      if (!matchesEventName(handler.event, event.name, stage)) return false

      // 2. scope 匹配
      if (!this.matchesScope(handler, event)) return false

      // 3. 频率额度
      if (!withinFrequency(handler.runtime, handler.frequency)) return false

      // 4. 技能是否可用
      //    无持有者的钩子（全局钩子 / `when()`）不过这道闸：
      //    它不是任何人的技能，「封了某人的技能」不该连监听一起封掉。
      if (handler.skillId && !handler.ownerless && this.skillGate) {
        return this.skillGate(handler.playerId, handler.skillId, event)
      }

      return true
    })
  }

  /**
   * 清零某一档频率的记账
   *
   * `oncePerTurn` 要等到有人调用它才真的是「每回合一次」——
   * 在此之前它和 `once`（整局一次）是同一种东西。
   * 由 `PhaseManager` / `GameEngine` 在对应的时间边界上调用：
   *
   * | scope | 谁在什么时候调 |
   * |-------|---------------|
   * | `phase` | `PhaseManager.executePhase` 每个阶段开始 |
   * | `turn`  | `PhaseManager.executeTurn` 回合开始（准备阶段前） |
   * | `round` | `GameEngine` 轮次开始（RoundStart 事件后） |
   */
  resetFrequency(scope: FrequencyScope): void {
    // 一条技能展开出的多个 handler 共享同一份状态对象，
    // 不去重就是把同一份状态清 N 遍——无害，但会让人误以为计数是 per-handler 的。
    const done = new Set<ISkillRuntimeState>()
    for (const handler of this.handlers) {
      const state = handler.runtime
      if (!state || done.has(state)) continue
      done.add(state)
      resetFrequencyOf(state, scope)
    }
  }

  /**
   * 获取所有注册的 handler 数量
   */
  get count(): number {
    return this.handlers.length
  }

  /**
   * 获取所有注册（调试用，返回副本）
   */
  getAllHandlers(): CompiledHandler[] {
    return [...this.handlers]
  }

  // ── 私有方法 ──

  /**
   * 检查 scope 是否匹配
   */
  private matchesScope(handler: CompiledHandler, event: IGameEvent): boolean {
    switch (handler.scope) {
      case 'player':
        // handler 持有者是事件的驱动者（event.player）
        return event.player?.id === handler.playerId
      case 'source':
        // handler 持有者是事件的实际执行者（event.source）
        return event.source?.id === handler.playerId
      case 'target':
        // handler 持有者在事件目标列表中
        return event.targets.some((t) => t.id === handler.playerId)
      case 'global':
        // 任意玩家触发均匹配
        return true
      default:
        return false
    }
  }
}
