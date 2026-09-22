// ============================================================
// 联盟杀 · useSkill — 技能发动 Hook
//
// 管理英雄技能的可用性判断、发动流程和触发通知。
//
// 用法：
//   const skill = useSkill(controllerGetter, storeGetter)
//   skill.activateSkill(effectId, targetIds, cardIds)
//   skill.getSkillInfo(effectId) → { name, description, type, usable }
// ============================================================

import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { GameController } from '@/services/game-controller'
import { SkillType } from '@core/contracts/enums'
import type { IEffect } from '@core/contracts/effect.interface'

/** 技能的 UI 展示信息 */
export interface SkillUIInfo {
  /** 效果 ID */
  id: string
  /** 技能名称 */
  name: string
  /** 描述 */
  description: string
  /** 技能类型 */
  type: SkillType
  /** 当前是否可用 */
  usable: boolean
  /** 本回合是否已使用 */
  usedThisTurn: boolean
  /** 本轮是否已使用 */
  usedThisRound: boolean
  /** 优先级 */
  priority: number
  /** 是否已启用（觉醒技可能未启用） */
  enabled: boolean
  /** 类型标签 */
  typeLabel: string
  /** 类型颜色 */
  typeColor: string
}

/** useSkill 返回类型 */
export interface UseSkillReturn {
  // ── 状态 ──
  /** 当前玩家可发动的技能列表 */
  availableSkills: ComputedRef<SkillUIInfo[]>
  /** 主动技列表（可点击发动） */
  activeSkills: ComputedRef<SkillUIInfo[]>
  /** 被动/锁定技列表（自动触发） */
  passiveSkills: ComputedRef<SkillUIInfo[]>
  /** 是否正在发动技能 */
  isActivating: Ref<boolean>
  /** 当前发动的技能 ID */
  activatingSkillId: Ref<string | null>
  /** 最近触发通知（被动/锁定技自动触发时） */
  lastTriggerNotification: Ref<{
    skillName: string
    type: SkillType
    timestamp: number
  } | null>

  // ── 方法 ──
  /** 发动主动技能 */
  activateSkill(
    effectId: string,
    targetIds?: string[],
    cardIds?: string[],
  ): Promise<void>
  /** 显示触发通知（被动/锁定技自动触发时） */
  showTriggerNotification(effectId: string): void
  /** 清除触发通知 */
  clearNotification(): void
  /** 获取单个技能的 UI 信息 */
  getSkillInfo(effectId: string): SkillUIInfo | null
  /** 刷新技能列表 */
  refresh(): void
}

// ── 技能类型标签映射 ──
const SKILL_TYPE_LABELS: Record<SkillType, string> = {
  [SkillType.Active]: '主动',
  [SkillType.Passive]: '被动',
  [SkillType.Locked]: '锁定',
  [SkillType.Limited]: '限定',
  [SkillType.Awaken]: '觉醒',
}

const SKILL_TYPE_COLORS: Record<SkillType, string> = {
  [SkillType.Active]: '#2080f0',
  [SkillType.Passive]: '#18a058',
  [SkillType.Locked]: '#f0a020',
  [SkillType.Limited]: '#d03050',
  [SkillType.Awaken]: '#7c3aed',
}

/**
 * 技能发动 Hook。
 *
 * 管理技能可用性判断、发动和触发通知：
 * - 主动技：玩家点击按钮发动
 * - 被动技/锁定技：条件满足时自动触发，显示通知
 * - 限定技：每局仅一次
 * - 觉醒技：条件满足时自动觉醒
 *
 * @param controllerGetter 获取 GameController 实例的函数
 */
export function useSkill(
  controllerGetter: () => GameController | null,
): UseSkillReturn {
  // ── 响应式状态 ──
  const isActivating = ref(false)
  const activatingSkillId = ref<string | null>(null)
  const lastTriggerNotification = ref<{
    skillName: string
    type: SkillType
    timestamp: number
  } | null>(null)

  /** 当前玩家可用的效果 ID 列表 */
  const usableEffectIds = computed(() => {
    const ctrl = controllerGetter()
    if (!ctrl) return []
    return ctrl.getAvailableActions().usableEffects
  })

  /** 当前玩家的英雄列表 */
  const currentHeroEffects = computed<IEffect[]>(() => {
    const ctrl = controllerGetter()
    if (!ctrl) return []
    // 通过 GameController 的 getCurrentPlayer 获取英雄的效果 ID
    // 然后从 EffectRegistry 查找（如果有权限访问的话）
    // 这里返回占位 — 实际效果数据应在 engine 层暴露
    return []
  })

  /** 可用技能列表（从 GameController.getAvailableActions 获取） */
  const availableSkills = computed<SkillUIInfo[]>(() => {
    const ctrl = controllerGetter()
    if (!ctrl) return []

    const player = ctrl.getCurrentPlayer()
    if (!player) return []

    // 从当前玩家所有英雄收集效果 ID
    const allEffectIds = new Set<string>()
    for (const hero of player.heroes) {
      for (const eid of hero.effectIds) {
        allEffectIds.add(eid)
      }
    }

    const usable = new Set(ctrl.getAvailableActions().usableEffects)

    // 构建技能信息 — 实际技能详情应从 EffectRegistry 获取
    // 当前阶段使用简化的映射
    return Array.from(allEffectIds).map((id) => {
      const effect = findEffectById(id, player)
      return {
        id,
        name: effect?.name ?? id,
        description: effect?.description ?? '',
        type: effect?.type ?? SkillType.Passive,
        usable: usable.has(id),
        // usedThisTurn/usedThisRound 在 CompiledHandler 上维护，
        // UI 层暂从 handler 获取，这里用 false 兜底
        usedThisTurn: false,
        usedThisRound: false,
        priority: effect?.priority ?? 0,
        // 可用性由 isAvailable(ctx) 运行时判断，不再有简单的 boolean 字段
        enabled: true,
        typeLabel: SKILL_TYPE_LABELS[effect?.type ?? SkillType.Passive],
        typeColor: SKILL_TYPE_COLORS[effect?.type ?? SkillType.Passive],
      }
    })
  })

  /** 主动技列表 */
  const activeSkills = computed(() =>
    availableSkills.value.filter(
      (s) =>
        s.type === SkillType.Active ||
        s.type === SkillType.Limited,
    ),
  )

  /** 被动/锁定技列表 */
  const passiveSkills = computed(() =>
    availableSkills.value.filter(
      (s) =>
        s.type === SkillType.Passive ||
        s.type === SkillType.Locked ||
        s.type === SkillType.Awaken,
    ),
  )

  // ── 方法 ──

  /**
   * 在 player 的 heroes 数据中查找效果信息。
   * 当前为简化实现 — Phase 15 中将从全局 EffectRegistry 获取。
   */
  function findEffectById(
    effectId: string,
    player: ReturnType<typeof controllerGetter> extends GameController | null
      ? NonNullable<ReturnType<GameController['getCurrentPlayer']>>
      : never,
  ): IEffect | null {
    // 尝试从 hero 数据中查找
    for (const hero of player.heroes) {
      // IHero 可能有内部效果数据引用
      const heroAny = hero as unknown as Record<string, unknown>
      if (Array.isArray(heroAny._effects)) {
        const found = (heroAny._effects as IEffect[]).find(
          (e: IEffect) => e.id === effectId,
        )
        if (found) return found
      }
    }
    return null
  }

  /** 发动主动技能 */
  async function activateSkill(
    effectId: string,
    targetIds: string[] = [],
    cardIds: string[] = [],
  ): Promise<void> {
    const ctrl = controllerGetter()
    if (!ctrl) return

    isActivating.value = true
    activatingSkillId.value = effectId

    try {
      await ctrl.useEffect(effectId, targetIds, cardIds)
    } catch (err) {
      console.error('[useSkill] 技能发动失败:', err)
    } finally {
      isActivating.value = false
      activatingSkillId.value = null
    }
  }

  /** 显示被动/锁定技触发通知 */
  function showTriggerNotification(effectId: string): void {
    const skillInfo = getSkillInfo(effectId)
    lastTriggerNotification.value = {
      skillName: skillInfo?.name ?? effectId,
      type: skillInfo?.type ?? SkillType.Passive,
      timestamp: Date.now(),
    }

    // 3秒后自动清除通知
    setTimeout(() => {
      if (
        lastTriggerNotification.value?.skillName === (skillInfo?.name ?? effectId)
      ) {
        lastTriggerNotification.value = null
      }
    }, 3000)
  }

  /** 清除触发通知 */
  function clearNotification(): void {
    lastTriggerNotification.value = null
  }

  /** 获取单个技能的 UI 信息 */
  function getSkillInfo(effectId: string): SkillUIInfo | null {
    return availableSkills.value.find((s) => s.id === effectId) ?? null
  }

  /** 刷新技能列表 */
  function refresh(): void {
    // 派生状态会自动更新
  }

  return {
    // 状态
    availableSkills,
    activeSkills,
    passiveSkills,
    isActivating,
    activatingSkillId,
    lastTriggerNotification,

    // 方法
    activateSkill,
    showTriggerNotification,
    clearNotification,
    getSkillInfo,
    refresh,
  }
}
