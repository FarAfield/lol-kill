// ============================================================
// 联盟杀 · EventCompiler — 事件编译器
//
// 将声明式 IEffect 定义为引擎可高效匹配的 CompiledHandler。
// 编译在注册时完成，运行时只做匹配 + 执行。
//
// 典型用法（SkillRegistry 注册英雄技能时）：
//   const handlers = eventCompiler.compile(effect, player)
//   eventTrigger.registerCompiledBatch(handlers)
//
// 每个 IEffect.trigger 中的 TriggerEntry 展开为一个 CompiledHandler。
// handler.execute 不依赖外部注入，所有服务通过参数 ctx 获取。
// ============================================================

import type { IEffect, IEffectContext } from '@core/contracts/effect.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { CompiledHandler } from '@core/contracts/compiled-handler'

/**
 * 检查效果的 frequency 限制
 */
function checkFrequency(effect: IEffect): boolean {
  switch (effect.frequency) {
    case 'once':
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

/**
 * 标记效果已使用（更新 frequency 状态）
 */
function markUsed(effect: IEffect): void {
  switch (effect.frequency) {
    case 'once':
      effect.usedThisRound = true
      effect.usedThisTurn = true
      effect.enabled = false
      break
    case 'oncePerTurn':
      effect.usedThisTurn = true
      break
    case 'oncePerRound':
      effect.usedThisRound = true
      break
    case 'unlimited':
    default:
      break
  }
}

/**
 * EventCompiler — 事件编译器
 *
 * 将 IEffect + player 编译为 CompiledHandler 列表。
 * 不持有任何状态，不依赖游戏子系统，纯变换函数。
 */
export class EventCompiler {
  // ── 编译入口 ──

  /**
   * 将单个效果编译为一个或多个 CompiledHandler。
   *
   * 展开 effect.trigger 中所有 TriggerEntry（source / global / target 三种监听范围），
   * 每个 entry 产出一个 CompiledHandler。
   *
   * @param effect - 效果定义
   * @param player - 效果持有者
   * @returns CompiledHandler 列表
   */
  compile(effect: IEffect, player: IPlayer): CompiledHandler[] {
    const handlers: CompiledHandler[] = []
    const trigger = effect.trigger
    if (!trigger) return handlers

    // 三种监听范围
    const scopes: Array<{ entries: typeof trigger.source; scope: CompiledHandler['scope'] }> = [
      { entries: trigger.source, scope: 'source' },
      { entries: trigger.target, scope: 'target' },
      { entries: trigger.global, scope: 'global' },
      { entries: trigger.player, scope: 'player' },
    ]

    for (const { entries, scope } of scopes) {
      if (!entries) continue
      for (const entry of entries) {
        handlers.push(this.compileEntry(effect, player, entry, scope))
      }
    }

    return handlers
  }

  // ── 私有编译方法 ──

  /**
   * 将单个 TriggerEntry 编译为 CompiledHandler。
   */
  private compileEntry(
    effect: IEffect,
    player: IPlayer,
    entry: IEffect['trigger']['source'][number],
    scope: CompiledHandler['scope'],
  ): CompiledHandler {
    const { timing, stage } = entry

    return {
      timing,
      stage,
      scope,
      skillId: effect.id,
      playerId: player.id,
      priority: effect.priority,
      isLocked: effect.type === 'locked',
      frequency: effect.frequency,
      enabled: effect.enabled,
      usedThisTurn: effect.usedThisTurn,
      usedThisRound: effect.usedThisRound,

      execute: async (ctx: IEffectContext) => {
        // 1. enabled 检查
        if (!effect.enabled) return

        // 2. frequency 检查
        if (!checkFrequency(effect)) return

        // 3. filter 检查
        if (effect.filter && !effect.filter(ctx)) return

        // 4. 执行核心逻辑
        if (effect.content) {
          await effect.content(ctx)
        }

        // 5. 更新 frequency 标记
        markUsed(effect)
      },
    }
  }
}
