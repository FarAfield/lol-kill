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
import type { ISkill } from '@core/contracts/skill.interface'
import { SkillType } from '@core/contracts/enums'

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
 * `ISkill` 的布尔矩阵 → 面板上那一个 `SkillType`。
 *
 * 技能定义给的是**一组布尔位**（`locked` / `limited` / `awaken` / `enable`），
 * 而面板要的是**一个**类型，所以这里必须有且只有一条优先序：
 *
 * 1. `limited` → 限定技。它压过 `locked`：限定技是要人点的，
 *    判成锁定技就再也点不到（面板的 `activeSkills` 只收 Active / Limited）。
 * 2. `awaken` → 觉醒技。
 * 3. `enable` 非空 → 主动技（写明了在哪些上下文可以手动发动）。
 * 4. `locked` → 锁定技（强制发动，不可拒绝）。
 * 5. 其余 → 被动技。
 */
function skillTypeOf(skill: ISkill): SkillType {
  if (skill.limited) return SkillType.Limited
  if (skill.awaken) return SkillType.Awaken
  if (skill.enable && skill.enable.length > 0) return SkillType.Active
  if (skill.locked) return SkillType.Locked
  return SkillType.Passive
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

  /** 可用技能列表（技能定义来自 `SkillRegistry`，可发动与否来自引擎的上下文判定） */
  const availableSkills = computed<SkillUIInfo[]>(() => {
    const ctrl = controllerGetter()
    if (!ctrl) return []

    const player = ctrl.getCurrentPlayer()
    if (!player) return []

    // **欠账 D36。** 这里以前读的是英雄牌上那串**裸 id**：
    // 于是 `name` 就是 id、`description` 是空串、`type` 一律 Passive
    // ——`activeSkills`（只收 Active / Limited）因此**恒为空数组**，面板永远空白。
    // 真值源是 `SkillRegistry`（`ctrl.getPlayerSkills`）：
    // 它才含有装备技与临时技能，也才有真名、真描述与类型位。
    // （旧写法不在这里复述：`skill-panel.test.ts` 里那条源码级断言
    //  按模式匹配盯着它，连注释里出现也算——与 `GameBoard`
    //  那两个已删 props 同一规矩。）
    const skills = ctrl.getPlayerSkills(player.id)
    const usable = new Set(ctrl.getAvailableActions(player.id).usableEffects)

    return skills.map((skill) => {
      const type = skillTypeOf(skill)
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        type,
        usable: usable.has(skill.id),
        // usedThisTurn / usedThisRound 由频率记账维护，接入后补齐
        usedThisTurn: false,
        usedThisRound: false,
        priority: 0,
        enabled: true,
        typeLabel: SKILL_TYPE_LABELS[type],
        typeColor: SKILL_TYPE_COLORS[type],
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
