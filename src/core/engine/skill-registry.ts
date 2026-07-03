// ============================================================
// 联盟杀 · SkillRegistry — 技能加载与注册
//
// 负责从 Hero 定义加载技能（Effect），注册到 EventTrigger，
// 管理觉醒技的启用/禁用，以及效果的生命周期。
//
// 职责：
// - loadHeroSkills(player, hero) — 加载英雄的所有效果并注册钩子
// - registerPlayerEffects(player, effects) — 为玩家注册效果到 EventTrigger
// - unregisterPlayer(player) — 注销玩家所有效果钩子
// - setEffectEnabled / setEffectDisabled — 控制觉醒技等效果的启停
//
// SkillRegistry 不存储 Effect 定义（由 EffectRegistry 负责），
// 它负责的是「哪个玩家拥有哪些效果」以及将这些效果注册到事件系统。
// ============================================================

import type { IEffect } from '@core/contracts/effect.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { IHero } from '@core/contracts/hero.interface'
import { EffectRegistry } from './effect-registry'
import { EventTrigger } from '@core/event/event-trigger'
import { EventCompiler } from '@core/event/event-compiler'

/**
 * 玩家效果注册记录
 *
 * 追踪为哪个玩家注册了哪些效果，便于批量注销。
 */
interface PlayerEffectRecord {
  playerId: string
  effectIds: string[]
}

/**
 * SkillRegistry — 技能加载与注册管理器
 *
 * 作为 EffectRegistry（效果定义存储）和 EventTrigger（事件钩子注册）之间的桥梁。
 *
 * 使用方式：
 *   1. 游戏启动时将效果定义注册到 EffectRegistry
 *   2. 为每位玩家调用 loadHeroSkills() 加载英雄技能
 *   3. 玩家死亡时调用 unregisterPlayer() 清理钩子
 *   4. 觉醒技触发时调用 enableEffect() / disableEffect()
 */
export class SkillRegistry {
  /** 效果定义注册表 */
  readonly effectRegistry: EffectRegistry

  /** 事件触发器 */
  readonly eventTrigger: EventTrigger

  /** 事件编译器 */
  readonly eventCompiler: EventCompiler

  /** 玩家效果记录（playerId → 已注册效果 ID 列表） */
  private playerEffects: Map<string, PlayerEffectRecord> = new Map()

  /**
   * 已注册的效果 ID 集合（用于快速检查是否已注册）。
   * key = `${playerId}:${effectId}`
   */
  private registeredEffectIds: Set<string> = new Set()

  constructor(effectRegistry: EffectRegistry, eventTrigger: EventTrigger, eventCompiler: EventCompiler) {
    this.effectRegistry = effectRegistry
    this.eventTrigger = eventTrigger
    this.eventCompiler = eventCompiler
  }

  // ── 英雄技能加载 ──

  /**
   * 加载英雄的全部技能并注册到事件系统。
   *
   * 从 Hero.effectIds 查找 EffectRegistry 中对应的效果定义，
   * 然后为指定玩家注册触发钩子。
   *
   * 觉醒技（type === 'awaken'）初始注册但 enabled = false，
   * 直到满足觉醒条件时通过 enableEffect() 启用。
   *
   * @param player 拥有该英雄的玩家
   * @param hero   英雄实例（含 effectIds）
   * @returns 成功注册的效果数量
   */
  loadHeroSkills(player: IPlayer, hero: IHero): number {
    if (!hero.effectIds || hero.effectIds.length === 0) return 0

    const effects = this.effectRegistry.getAll(hero.effectIds)

    if (effects.length === 0) {
      // 效果尚未注册到 EffectRegistry，跳过
      return 0
    }

    return this.registerPlayerEffects(player, effects)
  }

  /**
   * 批量加载多个玩家的英雄技能。
   *
   * @param players 玩家列表（需已分配英雄）
   * @returns 总共注册的效果数量
   */
  loadAllHeroSkills(players: IPlayer[]): number {
    let total = 0
    for (const player of players) {
      if (!player.alive) continue
      for (const hero of player.heroes) {
        total += this.loadHeroSkills(player, hero)
      }
    }
    return total
  }

  // ── 效果注册与注销 ──

  /**
   * 为指定玩家注册一批效果到事件系统。
   *
   * 每个效果通过 EventTrigger.registerEffect() 展开其 trigger 声明，
   * 生成对应的 EventHookRegistration 并注册到全局钩子表。
   *
   * @param player  效果持有者
   * @param effects 要注册的效果列表
   * @returns 实际注册的效果数量
   */
  registerPlayerEffects(player: IPlayer, effects: IEffect[]): number {
    let count = 0

    for (const effect of effects) {
      const key = `${player.id}:${effect.id}`

      // 防止重复注册
      if (this.registeredEffectIds.has(key)) continue

      // 觉醒技初始 enabled = false，编译到 CompiledHandler 后
      // handler.execute 会在运行时检查 effect.enabled
      const handlers = this.eventCompiler.compile(effect, player)

      if (handlers.length > 0) {
        this.eventTrigger.registerCompiledBatch(handlers)
        this.registeredEffectIds.add(key)
        count++
      }
    }

    // 记录玩家效果关联
    const record = this.playerEffects.get(player.id)
    if (record) {
      for (const e of effects) {
        if (!record.effectIds.includes(e.id)) {
          record.effectIds.push(e.id)
        }
      }
    } else {
      this.playerEffects.set(player.id, {
        playerId: player.id,
        effectIds: effects.map((e) => e.id),
      })
    }

    return count
  }

  /**
   * 注销指定玩家的所有效果钩子。
   *
   * 通常在玩家死亡时调用。
   * 注意：锁定技在玩家死亡后也可能需要保留（视具体规则），
   * 此时应使用 unregisterEffect() 逐个处理。
   *
   * @param player 玩家
   */
  unregisterPlayer(player: IPlayer): void {
    // 从 EventTrigger 移除该玩家的所有钩子
    this.eventTrigger.unregisterAll(player)

    // 清除追踪记录
    const record = this.playerEffects.get(player.id)
    if (record) {
      for (const effectId of record.effectIds) {
        this.registeredEffectIds.delete(`${player.id}:${effectId}`)
      }
      this.playerEffects.delete(player.id)
    }
  }

  /**
   * 注销指定玩家的单个效果。
   *
   * @param player    玩家
   * @param effectId  效果 ID
   */
  unregisterEffect(player: IPlayer, effectId: string): void {
    const hookKey = `${player.id}:${effectId}`

    // 从 EventTrigger 移除匹配的钩子
    this.eventTrigger.unregisterBy(
      (handler) => handler.skillId === effectId && handler.playerId === player.id,
    )

    this.registeredEffectIds.delete(hookKey)

    // 从记录中移除
    const record = this.playerEffects.get(player.id)
    if (record) {
      record.effectIds = record.effectIds.filter((id) => id !== effectId)
      if (record.effectIds.length === 0) {
        this.playerEffects.delete(player.id)
      }
    }
  }

  // ── 效果启停控制（觉醒技等） ──

  /**
   * 启用效果（用于觉醒技触发后）。
   *
   * 觉醒技在注册时 enabled = false，钩子虽然已注册但不会执行。
   * 调用此方法将 enabled 置为 true，后续触发时钩子正常执行。
   *
   * @param player    效果持有者
   * @param effectId  效果 ID
   * @returns 是否成功启用
   */
  enableEffect(player: IPlayer, effectId: string): boolean {
    const hookKey = `${player.id}:${effectId}`

    if (!this.registeredEffectIds.has(hookKey)) {
      return false
    }

    const effect = this.effectRegistry.get(effectId)
    if (!effect) return false

    effect.enabled = true
    return true
  }

  /**
   * 禁用效果。
   *
   * @param player    效果持有者
   * @param effectId  效果 ID
   * @returns 是否成功禁用
   */
  disableEffect(player: IPlayer, effectId: string): boolean {
    const hookKey = `${player.id}:${effectId}`

    if (!this.registeredEffectIds.has(hookKey)) {
      return false
    }

    const effect = this.effectRegistry.get(effectId)
    if (!effect) return false

    effect.enabled = false
    return true
  }

  // ── 查询 ──

  /**
   * 获取玩家当前所有已注册的效果 ID。
   */
  getPlayerEffectIds(playerId: string): string[] {
    const record = this.playerEffects.get(playerId)
    return record ? [...record.effectIds] : []
  }

  /**
   * 获取玩家当前所有已注册的效果实例。
   */
  getPlayerEffects(playerId: string): IEffect[] {
    const ids = this.getPlayerEffectIds(playerId)
    return this.effectRegistry.getAll(ids)
  }

  /**
   * 检查玩家的某效果是否已注册。
   */
  hasEffect(playerId: string, effectId: string): boolean {
    return this.registeredEffectIds.has(`${playerId}:${effectId}`)
  }

  /**
   * 获取已注册钩子的总数。
   */
  get registeredCount(): number {
    return this.registeredEffectIds.size
  }

  // ── 重置 ──

  /**
   * 清空所有注册（用于测试/重新开始游戏）。
   */
  clear(): void {
    this.eventTrigger.clear()
    this.registeredEffectIds.clear()
    this.playerEffects.clear()
  }
}
