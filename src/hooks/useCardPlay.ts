// ============================================================
// 联盟杀 · useCardPlay — 手牌操作 Hook
//
// 协调卡牌选择、目标高亮、出牌确认的完整交互流程。
//
// 用法：
//   const cardPlay = useCardPlay(controller, gameStore)
//   cardPlay.selectCard(cardId)        // 选中手牌 → 高亮合法目标
//   cardPlay.selectTarget(targetId)    // 点击目标 → 锁定目标
//   cardPlay.confirmPlay()             // 确认出牌
//   cardPlay.cancelSelection()         // 取消（右键）
// ============================================================

import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { GameController } from '@/services/game-controller'
import type { useGameStore } from '@/store/game-store'
import { ZoneType } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'

/** 卡牌-目标关联信息 */
export interface CardTargetInfo {
  cardId: string
  validTargetIds: string[]
}

/** useCardPlay 返回类型 */
export interface UseCardPlayReturn {
  // ── 状态 ──
  /** 当前选中的卡牌 ID */
  selectedCardId: Ref<string | null>
  /** 当前选中的目标 ID 列表（多目标卡牌时可能有多个） */
  selectedTargetIds: Ref<string[]>
  /** 当前悬停的目标 ID */
  hoveredTargetId: Ref<string | null>
  /** 当前可打出的卡牌及合法目标 */
  playableCards: ComputedRef<CardTargetInfo[]>
  /** 当前选中卡牌的合法目标 ID 集合 */
  validTargetIds: ComputedRef<Set<string>>
  /** 是否可以确认出牌 */
  canConfirm: ComputedRef<boolean>
  /** 是否正在执行出牌 */
  isPlaying: Ref<boolean>
  /** 选中的卡牌是否需要选择目标 */
  needsTarget: ComputedRef<boolean>
  /** 最少需要选择的目标数 */
  minTargets: ComputedRef<number>
  /** 最多可选择的目标数 */
  maxTargets: ComputedRef<number>
  /** 当前选中卡牌的类型标签 */
  selectedCardTags: ComputedRef<Set<string>>

  // ── 方法 ──
  /** 选中/取消选中一张手牌 */
  selectCard(cardId: string): void
  /** 选中/取消选中一个目标 */
  selectTarget(targetId: string): void
  /** 悬停目标（用于预览） */
  hoverTarget(targetId: string | null): void
  /** 确认出牌 */
  confirmPlay(): Promise<void>
  /** 取消所有选择 */
  cancelSelection(): void
  /** 刷新可选卡牌列表（回合切换时调用） */
  refresh(): void
}

/**
 * 手牌操作 Hook。
 *
 * 协调卡牌选择和目标选择的完整交互流程：
 * 1. 玩家点击手牌 → 选中卡牌
 * 2. 系统高亮合法目标
 * 3. 玩家点击目标 → 锁定目标
 * 4. 玩家确认 → 调用 GameController.playCard()
 *
 * @param controllerGetter 获取 GameController 实例的函数（支持响应式）
 * @param _storeGetter     保留位：当前所有需要的状态都能从 controller 读到，
 *                         不再绕道 Pinia。留着参数是为了不动调用方签名。
 */
export function useCardPlay(
  controllerGetter: () => GameController | null,
  _storeGetter: () => ReturnType<typeof useGameStore>,
): UseCardPlayReturn {
  // ── 响应式状态 ──
  const selectedCardId = ref<string | null>(null)
  const selectedTargetIds = ref<string[]>([])
  const hoveredTargetId = ref<string | null>(null)
  const isPlaying = ref(false)

  // ── 从 controller 获取可用操作 ──
  const availableActions = computed(() => {
    const ctrl = controllerGetter()
    if (!ctrl) return null
    return ctrl.getAvailableActions()
  })

  /** 当前可打出的卡牌及合法目标 */
  const playableCards = computed<CardTargetInfo[]>(() => {
    return availableActions.value?.playableCards ?? []
  })

  /** 可打出卡牌的 ID 集合 */
  const playableCardIds = computed(() => {
    return new Set(playableCards.value.map((c) => c.cardId))
  })

  /** 当前选中卡牌的合法目标 ID 集合 */
  const validTargetIds = computed<Set<string>>(() => {
    if (!selectedCardId.value) return new Set()
    const info = playableCards.value.find((c) => c.cardId === selectedCardId.value)
    return new Set(info?.validTargetIds ?? [])
  })

  /** 是否需要选择目标（桃=自己，杀=其他角色） */
  const needsTarget = computed(() => {
    if (!selectedCardId.value) return false
    const info = playableCards.value.find((c) => c.cardId === selectedCardId.value)
    if (!info) return false
    // 如果合法目标仅自己且不需要手动选择，则认为不需要
    return info.validTargetIds.length > 0
  })

  /** 最少目标数 */
  const minTargets = computed(() => {
    const info = playableCards.value.find((c) => c.cardId === selectedCardId.value)
    // 桃通常需要 0 个外部目标（自动对自己使用）
    // 杀需要 1 个目标
    // 锦囊可能需要 1+ 个目标
    // 这里简化为：至少选择 0 个（桃等）或 1 个（杀、锦囊）
    if (!info) return 0
    // 检查是否只有自己可选（桃）
    const ctrl = controllerGetter()
    const humanPlayer = ctrl?.getCurrentPlayer()
    const isSelfOnly =
      info.validTargetIds.length === 1 &&
      humanPlayer &&
      info.validTargetIds[0] === humanPlayer.id
    return isSelfOnly ? 0 : 1
  })

  /** 最多目标数 */
  const maxTargets = computed(() => {
    const info = playableCards.value.find((c) => c.cardId === selectedCardId.value)
    if (!info) return 1
    // 杀和大部分锦囊通常选择 1 个目标
    return Math.min(info.validTargetIds.length, 3)
  })

  /** 是否可以确认 */
  const canConfirm = computed(() => {
    if (!selectedCardId.value || isPlaying.value) return false
    const min = minTargets.value
    const count = selectedTargetIds.value.length
    return count >= min && count <= maxTargets.value
  })

  /** 当前选中卡牌的类型标签 */
  const selectedCardTags = computed<Set<string>>(() => {
    if (!selectedCardId.value) return new Set()
    const ctrl = controllerGetter()
    const player = ctrl?.getCurrentPlayer()
    if (!player) return new Set()
    const card = player.handCards.find((c) => c.instanceId === selectedCardId.value)
    return card?.tags ?? new Set()
  })

  // ── 方法 ──

  /**
   * 选中/取消选中一张手牌。
   *
   * - 点击已选中的牌 → 取消选中
   * - 点击不可打的牌 → 无操作
   * - 点击可打的新牌 → 切换选中，清除旧目标
   */
  function selectCard(cardId: string): void {
    if (isPlaying.value) return

    // 取消当前选中
    if (selectedCardId.value === cardId) {
      cancelSelection()
      return
    }

    // 仅可打出的牌可选中
    if (!playableCardIds.value.has(cardId)) return

    selectedCardId.value = cardId
    selectedTargetIds.value = []

    // 桃（仅自己可选）自动添加自己为目标
    const ctrl = controllerGetter()
    const player = ctrl?.getCurrentPlayer()
    if (player) {
      const card = player.handCards.find((c) => c.instanceId === cardId)
      if (card?.tags.has(CardTag.Heal) && card.zone === ZoneType.Hand) {
        selectedTargetIds.value = [player.id]
      }
    }
  }

  /**
   * 选中/取消选中一个目标。
   *
   * - 未选中卡牌时 → 无操作
   * - 目标已在列表中 → 取消选中
   * - 已达最大目标数 → 替换最后一个
   * - 正常情况 → 添加到列表
   */
  function selectTarget(targetId: string): void {
    if (isPlaying.value || !selectedCardId.value) return
    if (!validTargetIds.value.has(targetId)) return

    const idx = selectedTargetIds.value.indexOf(targetId)
    if (idx >= 0) {
      // 已选中 → 取消
      selectedTargetIds.value = selectedTargetIds.value.filter((id) => id !== targetId)
      return
    }

    const max = maxTargets.value
    if (selectedTargetIds.value.length >= max) {
      // 已达上限 → 替换最后一个
      selectedTargetIds.value = [...selectedTargetIds.value.slice(0, -1), targetId]
    } else {
      selectedTargetIds.value = [...selectedTargetIds.value, targetId]
    }
  }

  /** 悬停目标（用于预览效果） */
  function hoverTarget(targetId: string | null): void {
    hoveredTargetId.value = targetId
  }

  /**
   * 确认出牌。
   *
   * 调用 GameController.playCard() 执行实际的出牌操作。
   */
  async function confirmPlay(): Promise<void> {
    const ctrl = controllerGetter()
    if (!ctrl || !selectedCardId.value || !canConfirm.value) return

    isPlaying.value = true
    try {
      await ctrl.playCard(selectedCardId.value, [...selectedTargetIds.value])
    } catch (err) {
      console.error('[useCardPlay] 出牌失败:', err)
    } finally {
      // 清除选中状态
      selectedCardId.value = null
      selectedTargetIds.value = []
      hoveredTargetId.value = null
      isPlaying.value = false
    }
  }

  /** 取消所有选择 */
  function cancelSelection(): void {
    selectedCardId.value = null
    selectedTargetIds.value = []
    hoveredTargetId.value = null
  }

  /** 刷新可选卡牌列表（如回合/阶段切换时） */
  function refresh(): void {
    // 切换回合/阶段时清除选中状态
    cancelSelection()
  }

  return {
    // 状态
    selectedCardId,
    selectedTargetIds,
    hoveredTargetId,
    playableCards,
    validTargetIds,
    canConfirm,
    isPlaying,
    needsTarget,
    minTargets,
    maxTargets,
    selectedCardTags,

    // 方法
    selectCard,
    selectTarget,
    hoverTarget,
    confirmPlay,
    cancelSelection,
    refresh,
  }
}
