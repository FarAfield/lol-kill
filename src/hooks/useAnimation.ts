// ============================================================
// 联盟杀 · useAnimation — 游戏动画状态管理 Hook
//
// 管理卡牌动画和座位特效的播放队列。
// CardAnimation 组件消费此 Hook 的状态来渲染动画元素。
//
// 动画类型：
// - draw:    摸牌（牌堆 → 手牌滑动）
// - play:    出牌（手牌 → 目标飞行）
// - discard: 弃牌（手牌 → 弃牌堆翻转缩小）
// - equip:   装备（手牌 → 装备区）
// - damage:  伤害（目标座位抖动 + 红色闪烁）
// - heal:    回复（目标座位绿色闪烁）
// - death:   死亡（角色灰度化过渡）
// - skill:   技能发动（技能持有者发光）
//
// 用法：
//   const anim = useAnimation()
//   anim.play('draw', { playerId, count })
//   anim.play('play', { cardId, fromPlayerId, toPlayerId })
//   anim.play('damage', { playerId, amount: 2 })
// ============================================================

import { ref, computed, shallowRef } from 'vue'

// ── 动画类型 ──
export type AnimationType =
  | 'draw'
  | 'play'
  | 'discard'
  | 'equip'
  | 'damage'
  | 'heal'
  | 'death'
  | 'skill'

// ── 动画配置 ──
export interface AnimationConfig {
  /** 动画唯一 ID */
  id: string
  /** 动画类型 */
  type: AnimationType
  /** 开始时间戳 */
  startTime: number
  /** 持续时间（ms） */
  duration: number
  /** 播放器 ID */
  playerId?: string
  /** 目标玩家 ID */
  targetPlayerId?: string
  /** 来源玩家 ID（出牌时） */
  fromPlayerId?: string
  /** 卡牌 ID */
  cardId?: string
  /** 卡牌数量（摸牌时） */
  count?: number
  /** 伤害/回复数值 */
  amount?: number
  /** 技能名称 */
  skillName?: string
  /** 自定义数据 */
  data?: Record<string, unknown>
}

// ── 玩家座位位置接口（供动画计算起终点） ──
export interface SeatPosition {
  playerId: string
  x: number // 百分比 X
  y: number // 百分比 Y
}

/** 默认动画持续时间（ms） */
export const DEFAULT_DURATIONS: Record<AnimationType, number> = {
  draw: 500,
  play: 600,
  discard: 400,
  equip: 350,
  damage: 700,
  heal: 600,
  death: 800,
  skill: 500,
}

/** 动画状态 */
export type AnimationStatus = 'queued' | 'playing' | 'completed' | 'cancelled'

export interface AnimationState extends AnimationConfig {
  status: AnimationStatus
  progress: number // 0–1
  /** 给排队动画的预估剩余时间 */
  estimatedRemainingMs: number
}

// ── 简单 ID 生成器 ──
let _animIdCounter = 0
function generateAnimId(): string {
  return `anim_${Date.now()}_${++_animIdCounter}`
}

/**
 * useAnimation Hook。
 *
 * 提供动画队列管理——卡牌飞行、座位特效等排队播放。
 * 设计：所有动画放入队列，同一时间最多 3 个并行播放，
 * 否则排队等待前一个完成。每个动画独立追踪进度。
 *
 * @param maxParallel 最大并行动画数
 */
export function useAnimation(maxParallel: number = 3) {
  // ── 状态 ──
  /** 所有动画（排队中 + 播放中 + 已完成） */
  const allAnimations = ref<AnimationState[]>([])

  /** 活跃的动画（当前播放中） */
  const activeAnimations = computed(() =>
    allAnimations.value.filter((a) => a.status === 'playing'),
  )

  /** 排队的动画 */
  const queuedAnimations = computed(() =>
    allAnimations.value.filter((a) => a.status === 'queued'),
  )

  /** 是否有动画正在播放 */
  const isAnimating = computed(() => activeAnimations.value.length > 0)

  /** 当前活跃动画数 */
  const activeCount = computed(() => activeAnimations.value.length)

  /** 队列中的动画数 */
  const queuedCount = computed(() => queuedAnimations.value.length)

  // ── 玩家座位位置注册表（供飞行动画计算坐标） ──
  const seatPositions = shallowRef<Map<string, SeatPosition>>(new Map())

  // ── 动画播放定时器 ──
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  // ── 方法 ──

  /**
   * 注册玩家座位位置（供动画计算起终点坐标）。
   *
   * 由 GameBoard 或 game/index.vue 在布局更新时调用。
   */
  function registerSeatPositions(positions: SeatPosition[]): void {
    const map = new Map<string, SeatPosition>()
    for (const pos of positions) {
      map.set(pos.playerId, pos)
    }
    seatPositions.value = map
  }

  /**
   * 排队一个动画。
   *
   * @returns 动画 ID（可用于取消）
   */
  function play(
    type: AnimationType,
    config?: Partial<Omit<AnimationConfig, 'id' | 'type' | 'startTime' | 'duration'>>,
  ): string {
    const id = generateAnimId()
    const duration = config?.data?.['duration'] as number | undefined
      ?? DEFAULT_DURATIONS[type]

    const animation: AnimationState = {
      id,
      type,
      startTime: 0, // 实际开始时设置
      duration,
      playerId: config?.playerId,
      targetPlayerId: config?.targetPlayerId,
      fromPlayerId: config?.fromPlayerId,
      cardId: config?.cardId,
      count: config?.count,
      amount: config?.amount,
      skillName: config?.skillName,
      data: config?.data,
      status: 'queued',
      progress: 0,
      estimatedRemainingMs: duration,
    }

    allAnimations.value = [...allAnimations.value, animation]

    // 尝试立即推进队列
    advanceQueue()

    return id
  }

  /**
   * 批量排队动画。
   *
   * @returns 动画 ID 列表
   */
  function playBatch(
    items: Array<{ type: AnimationType; config?: Partial<Omit<AnimationConfig, 'id' | 'type'>> }>,
  ): string[] {
    return items.map((item) => play(item.type, item.config))
  }

  /**
   * 取消指定动画。
   *
   * @param animId 动画 ID
   */
  function cancel(animId: string): void {
    const idx = allAnimations.value.findIndex((a) => a.id === animId)
    if (idx < 0) return

    const anim = allAnimations.value[idx]!
    if (anim.status === 'playing') {
      stopTimer(animId)
    }

    allAnimations.value = allAnimations.value.map((a) =>
      a.id === animId ? { ...a, status: 'cancelled' as const } : a,
    )

    // 清理已完成的动画
    cleanupCompleted()

    // 推进队列
    advanceQueue()
  }

  /**
   * 取消所有动画。
   */
  function cancelAll(): void {
    // 停止所有定时器
    for (const [id] of timers) {
      stopTimer(id)
    }

    allAnimations.value = allAnimations.value.map((a) =>
      a.status === 'playing' || a.status === 'queued'
        ? { ...a, status: 'cancelled' as const }
        : a,
    )

    cleanupCompleted()
  }

  /**
   * 清除已完成/已取消的动画（保留最近 N 个用于调试）。
   */
  function cleanupCompleted(): void {
    const activeOrQueued = allAnimations.value.filter(
      (a) => a.status === 'playing' || a.status === 'queued',
    )
    // 保留最近 20 个已完成/取消的动画用于历史记录
    const completed = allAnimations.value.filter(
      (a) => a.status === 'completed' || a.status === 'cancelled',
    ).slice(-20)

    allAnimations.value = [...activeOrQueued, ...completed]
  }

  /**
   * 清除所有动画历史。
   */
  function clearHistory(): void {
    allAnimations.value = allAnimations.value.filter(
      (a) => a.status === 'playing' || a.status === 'queued',
    )
  }

  // ── 便捷方法 ──

  /** 摸牌动画 */
  function playDraw(playerId: string, count: number = 1): string {
    return play('draw', { playerId, count })
  }

  /** 出牌动画 */
  function playPlayCard(cardId: string, fromPlayerId: string, toPlayerId: string): string {
    return play('play', { cardId, fromPlayerId, targetPlayerId: toPlayerId })
  }

  /** 弃牌动画 */
  function playDiscard(playerId: string, count: number = 1): string {
    return play('discard', { playerId, count })
  }

  /** 装备动画 */
  function playEquip(playerId: string, cardId: string): string {
    return play('equip', { playerId, cardId })
  }

  /** 伤害动画 */
  function playDamage(playerId: string, amount: number = 1): string {
    return play('damage', { targetPlayerId: playerId, amount })
  }

  /** 回复动画 */
  function playHeal(playerId: string, amount: number = 1): string {
    return play('heal', { targetPlayerId: playerId, amount })
  }

  /** 死亡动画 */
  function playDeath(playerId: string): string {
    return play('death', { targetPlayerId: playerId })
  }

  /** 技能发动动画 */
  function playSkill(playerId: string, skillName: string): string {
    return play('skill', { playerId, skillName })
  }

  // ── 内部方法 ──

  /** 推进动画队列：启动排队中的动画直到达到并行上限 */
  function advanceQueue(): void {
    const available = maxParallel - activeAnimations.value.length
    if (available <= 0) return

    const queued = allAnimations.value.filter((a) => a.status === 'queued')
    const toStart = queued.slice(0, available)

    for (const anim of toStart) {
      startAnimation(anim.id)
    }
  }

  /** 开始播放指定动画 */
  function startAnimation(animId: string): void {
    const now = Date.now()
    allAnimations.value = allAnimations.value.map((a) =>
      a.id === animId
        ? { ...a, status: 'playing' as const, startTime: now, progress: 0 }
        : a,
    )

    const anim = allAnimations.value.find((a) => a.id === animId)
    if (!anim) return

    // 使用 requestAnimationFrame 驱动进度
    const step = () => {
      const current = allAnimations.value.find((a) => a.id === animId)
      if (!current || current.status !== 'playing') {
        stopTimer(animId)
        return
      }

      const elapsed = Date.now() - current.startTime
      const progress = Math.min(1, elapsed / current.duration)

      allAnimations.value = allAnimations.value.map((a) =>
        a.id === animId
          ? {
              ...a,
              progress,
              estimatedRemainingMs: Math.max(0, current.duration - elapsed),
            }
          : a,
      )

      if (progress >= 1) {
        completeAnimation(animId)
        return
      }

      // 继续下一帧
      const handle = requestAnimationFrame(step)
      timers.set(animId, handle as unknown as ReturnType<typeof setTimeout>)
    }

    const handle = requestAnimationFrame(step)
    timers.set(animId, handle as unknown as ReturnType<typeof setTimeout>)
  }

  /** 完成动画 */
  function completeAnimation(animId: string): void {
    stopTimer(animId)

    allAnimations.value = allAnimations.value.map((a) =>
      a.id === animId
        ? { ...a, status: 'completed' as const, progress: 1, estimatedRemainingMs: 0 }
        : a,
    )

    // 清理旧动画
    cleanupCompleted()

    // 推进下一个
    advanceQueue()
  }

  /** 停止动画定时器 */
  function stopTimer(animId: string): void {
    const handle = timers.get(animId)
    if (handle !== undefined) {
      cancelAnimationFrame(handle as unknown as number)
      timers.delete(animId)
    }
  }

  return {
    // 状态
    allAnimations,
    activeAnimations,
    queuedAnimations,
    isAnimating,
    activeCount,
    queuedCount,
    seatPositions,

    // 通用方法
    play,
    playBatch,
    cancel,
    cancelAll,
    cleanupCompleted,
    clearHistory,
    registerSeatPositions,

    // 便捷方法
    playDraw,
    playPlayCard,
    playDiscard,
    playEquip,
    playDamage,
    playHeal,
    playDeath,
    playSkill,
  }
}

/** useAnimation 返回类型 */
export type UseAnimationReturn = ReturnType<typeof useAnimation>
