// ============================================================
// 联盟杀 · EventTrigger — 事件触发器管理
//
// 负责注册和匹配技能/效果的触发条件。
//
// 核心功能:
//   1. 注册效果钩子 — 将 IEffect 的触发条件展开为 EventHookRegistration
//   2. 匹配触发 — 当事件进入某阶段时，找到所有匹配的钩子
//   3. 生命周期管理 — 支持按技能/玩家注销钩子
//
// 触发范围 (scope) 匹配规则:
//   - player: 钩子持有者是事件的驱动者 → "当【你】的回合开始时"
//   - source: 钩子持有者是事件的实际执行者 → "当【你】使用杀时"
//   - target: 钩子持有者在事件目标列表中 → "当【你】成为杀的目标时"
//   - global: 任意玩家触发该事件 → "当【任意角色】受到伤害后"
//
// player 与 source 的区别:
//   player 匹配 event.player（事件链驱动者，如借刀杀人的发起者）
//   source 匹配 event.source（实际做事的人，如被借刀出杀的人）
//   多数情况下 source === player。
// ============================================================

import type { IGameEvent, EventHookRegistration, EventHook } from '@core/contracts/event.interface'
import type { IEffect, ITriggerCondition, TriggerEntry } from '@core/contracts/effect.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { TriggerStage } from '@core/contracts/enums'

/**
 * 注册选项（从 IEffect 创建注册信息时使用）
 */
export interface EffectRegistrationOptions {
  effect: IEffect
  player: IPlayer
  /** 可选：额外的钩子包装器（用于日志/调试） */
  hookWrapper?: (originalHook: EventHook) => EventHook
}

/**
 * EventTrigger — 事件触发器管理器
 *
 * 维护全局钩子注册表，在事件推进到各阶段时
 * 提供匹配的钩子供 EventDispatcher 执行。
 */
export class EventTrigger {
  /** 全局钩子注册表 */
  private registrations: EventHookRegistration[] = []

  /**
   * 注册单个钩子
   */
  register(registration: EventHookRegistration): void {
    this.registrations.push(registration)
  }

  /**
   * 批量注册钩子
   */
  registerBatch(registrations: EventHookRegistration[]): void {
    this.registrations.push(...registrations)
  }

  /**
   * 从 IEffect 注册效果
   *
   * 展开 IEffect.trigger 中的 source / global / target
   * 每个 TriggerEntry 生成一个 EventHookRegistration。
   *
   * @param options - 包含 effect、player 和可选的 hookWrapper
   */
  registerEffect(options: EffectRegistrationOptions): void {
    const { effect, player, hookWrapper } = options

    const trigger = effect.trigger
    if (!trigger) return

    // player scope: 效果持有者是事件的驱动者
    if (trigger.player) {
      for (const entry of trigger.player) {
        const hook = this.createHook(effect, player, entry, 'player', hookWrapper)
        this.register(hook)
      }
    }

    // source scope: 效果持有者是事件的实际执行者
    if (trigger.source) {
      for (const entry of trigger.source) {
        const hook = this.createHook(effect, player, entry, 'source', hookWrapper)
        this.register(hook)
      }
    }

    // global scope: 任意玩家触发
    if (trigger.global) {
      for (const entry of trigger.global) {
        const hook = this.createHook(effect, player, entry, 'global', hookWrapper)
        this.register(hook)
      }
    }

    // target scope: 效果持有者是事件目标
    if (trigger.target) {
      for (const entry of trigger.target) {
        const hook = this.createHook(effect, player, entry, 'target', hookWrapper)
        this.register(hook)
      }
    }
  }

  /**
   * 批量注册多个效果
   */
  registerEffects(optionsList: EffectRegistrationOptions[]): void {
    for (const options of optionsList) {
      this.registerEffect(options)
    }
  }

  /**
   * 注销指定技能的所有钩子
   *
   * @param skillId - 效果 ID
   */
  unregister(skillId: string): void {
    this.registrations = this.registrations.filter((r) => r.skillId !== skillId)
  }

  /**
   * 注销指定玩家的所有钩子
   *
   * @param player - 玩家
   */
  unregisterAll(player: IPlayer): void {
    this.registrations = this.registrations.filter((r) => r.player.id !== player.id)
  }

  /**
   * 注销匹配条件的钩子
   *
   * @param predicate - 筛选条件
   */
  unregisterBy(predicate: (reg: EventHookRegistration) => boolean): void {
    this.registrations = this.registrations.filter((r) => !predicate(r))
  }

  /**
   * 清空所有注册
   */
  clear(): void {
    this.registrations = []
  }

  /**
   * 获取指定事件在某阶段下的所有匹配钩子
   *
   * 匹配条件:
   *   1. timing === event.type
   *   2. stage === 当前阶段
   *   3. scope 匹配（source / target / global）
   *
   * @param event - 当前事件
   * @param stage - 当前流水线阶段
   * @returns 所有匹配的钩子注册信息
   */
  getMatchingHooks(event: IGameEvent, stage: TriggerStage): EventHookRegistration[] {
    return this.registrations.filter((reg) => {
      // 1. 触发时机必须匹配
      if (reg.timing !== event.type) return false

      // 2. 触发阶段必须匹配
      if (reg.stage !== stage) return false

      // 3. scope 匹配
      return this.matchesScope(reg, event)
    })
  }

  /**
   * 获取所有注册的钩子数量
   */
  get count(): number {
    return this.registrations.length
  }

  /**
   * 获取所有注册（调试用，返回副本）
   */
  getAllRegistrations(): EventHookRegistration[] {
    return [...this.registrations]
  }

  // ── 私有方法 ──

  /**
   * 检查 scope 是否匹配
   */
  private matchesScope(reg: EventHookRegistration, event: IGameEvent): boolean {
    switch (reg.scope) {
      case 'player':
        // 钩子持有者是事件的驱动者（event.player）
        return event.player?.id === reg.player.id

      case 'source':
        // 钩子持有者是事件的实际执行者（event.source）
        return event.source?.id === reg.player.id

      case 'target':
        // 钩子持有者在事件目标列表中
        return event.targets.some((t) => t.id === reg.player.id)

      case 'global':
        // 任意玩家触发均匹配
        return true

      default:
        return false
    }
  }

  /**
   * 从 IEffect 的 TriggerEntry 创建 EventHookRegistration
   */
  private createHook(
    effect: IEffect,
    player: IPlayer,
    entry: TriggerEntry,
    scope: 'player' | 'source' | 'global' | 'target',
    hookWrapper?: (originalHook: EventHook) => EventHook,
  ): EventHookRegistration {
    // 基础钩子：执行 effect.filter 检查 + effect.content
    const baseHook: EventHook = async (event, context) => {
      // 运行时检查：effect 是否仍然启用
      if (!effect.enabled) return

      // frequency 检查
      if (!this.checkFrequency(effect)) return

      // filter 检查
      if (effect.filter) {
        // 需要构建 IEffectContext — 这是由 EventDispatcher 在调用时传入的
        // 这里我们传递一个轻量上下文给 filter
        try {
          // filter 通过 IEffectContext 调用，这里从 event.data 中获取
          // 实际的 context 构建由 EventDispatcher 负责
          const contextFromEvent = event.data['_effectContext'] as Parameters<NonNullable<typeof effect.filter>>[0] | undefined
          if (contextFromEvent && !effect.filter(contextFromEvent)) {
            return
          }
        } catch {
          // filter 抛出异常则跳过
          return
        }
      }

      // 执行效果核心逻辑
      if (effect.content) {
        const contextFromEvent = event.data['_effectContext'] as Parameters<typeof effect.content>[0] | undefined
        if (contextFromEvent) {
          await effect.content(contextFromEvent)
        }
      }
    }

    const finalHook = hookWrapper ? hookWrapper(baseHook) : baseHook

    return {
      hook: finalHook,
      skillId: effect.id,
      player,
      priority: effect.priority,
      isLocked: effect.type === 'locked',
      timing: entry.timing,
      stage: entry.stage,
      scope,
    }
  }

  /**
   * 检查效果的 frequency 限制
   */
  private checkFrequency(effect: IEffect): boolean {
    switch (effect.frequency) {
      case 'once':
        // 每局游戏只能发动一次
        return !effect.usedThisRound && !effect.usedThisTurn
      case 'oncePerTurn':
        return !effect.usedThisTurn
      case 'oncePerRound':
        return !effect.usedThisRound
      case 'unlimited':
      default:
        return true
    }
  }
}
