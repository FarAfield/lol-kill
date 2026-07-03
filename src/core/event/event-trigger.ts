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

/**
 * EventTrigger — 事件触发器管理器
 */
export class EventTrigger {
  /** 全局 CompiledHandler 注册表 */
  private handlers: CompiledHandler[] = []

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
   * 获取指定事件在某阶段下的所有匹配 handler
   *
   * 匹配条件:
   *   1. timing === event.type
   *   2. stage === 当前阶段
   *   3. scope 匹配（source / target / global / player）
   *
   * @param event - 当前事件
   * @param stage - 当前流水线阶段
   * @returns 所有匹配的 handler
   */
  getMatchingHandlers(event: IGameEvent, stage: TriggerStage): CompiledHandler[] {
    return this.handlers.filter((handler) => {
      // 1. 触发时机必须匹配
      if (handler.timing !== event.type) return false

      // 2. 触发阶段必须匹配
      if (handler.stage !== stage) return false

      // 3. scope 匹配
      return this.matchesScope(handler, event)
    })
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
