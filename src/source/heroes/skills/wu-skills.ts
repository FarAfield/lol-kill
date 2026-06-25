// ============================================================
// 联盟杀 · 吴国（Ionia）武将技能
//
// 包含：
//   孙权 — 制衡 (主动)
//   吕蒙 — 克己 (锁定)
// ============================================================

import {
  SkillType,
  TriggerTiming,
  Frequency,
  GamePhase,
} from '@core/contracts/enums'
import type { IEffect } from '@core/contracts/effect.interface'
import type { ICard } from '@core/contracts/card.interface'

// ═══════════════════════════════════════════
// 孙权 · 制衡
// 出牌阶段，你可以弃置任意张牌，
// 然后摸等量的牌（每回合限一次）。
// ═══════════════════════════════════════════

export const zhihengEffect: IEffect = {
  id: 'zhiheng',
  name: '制衡',
  description: '出牌阶段可弃置任意张牌，然后摸等量的牌（每回合限一次）。',
  type: SkillType.Active,
  priority: 10,
  frequency: Frequency.OncePerTurn,

  trigger: {
    player: [{ timing: TriggerTiming.PhaseUse, stage: 'Begin' }],
  },

  filter: (ctx) => {
    if (!ctx.player.alive) return false
    // 需要至少有1张可弃置的牌（手牌或装备）
    return (
      ctx.player.handCards.length > 0 ||
      ctx.player.equipCards.length > 0
    )
  },

  content: async (ctx) => {
    // 标记制衡可用
    ctx.player.setMark('zhihengAvailable', 1)

    // 实际制衡操作由 UI 驱动：
    // 1. 玩家选择 X 张手牌/装备牌弃置
    // 2. 摸 X 张牌
    //
    // 简化实现：随机弃置一张手牌并摸一张
    const allCards = [
      ...ctx.player.handCards,
      ...ctx.player.equipCards,
    ]
    if (allCards.length === 0) return

    // 弃置 1 张并摸 1 张（简化，完整实现需 UI 决策）
    const randomIndex = Math.floor(Math.random() * allCards.length)
    const chosenCard = allCards[randomIndex]!

    await ctx.discardCards([chosenCard])

    // 从手牌/装备区移除
    ctx.player.handCards = ctx.player.handCards.filter(
      (c) => c.id !== chosenCard.id,
    )
    ctx.player.equipCards = ctx.player.equipCards.filter(
      (c) => c.id !== chosenCard.id,
    )

    // 摸 1 张牌
    const drawn = await ctx.drawCards(1)
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ═══════════════════════════════════════════
// 吕蒙 · 克己
// 锁定技，若你于出牌阶段未使用或弃置过【杀】，
// 你跳过本回合的弃牌阶段。
// ═══════════════════════════════════════════

export const kejiEffect: IEffect = {
  id: 'keji',
  name: '克己',
  description: '锁定技，出牌阶段未使用【杀】，则跳过弃牌阶段。',
  type: SkillType.Locked,
  priority: 100,
  frequency: Frequency.Unlimited,

  trigger: {
    player: [{ timing: TriggerTiming.PhaseDiscard, stage: 'Before' }],
  },

  filter: (ctx) => {
    // 克己触发条件：出牌阶段未使用过杀且未弃置过杀
    if (!ctx.player.alive) return false

    // 检查是否在出牌阶段使用过杀
    const usedSha = ctx.player.getMark('usedShaThisTurn') > 0
    return !usedSha
  },

  content: async (ctx) => {
    // 跳过弃牌阶段
    ctx.player.setMark('kejiActive', 1)

    // 将 PhaseDiscard 加入应跳过的阶段列表
    if (!ctx.player.shouldSkipPhases.includes(GamePhase.PhaseDiscard)) {
      ctx.player.shouldSkipPhases.push(GamePhase.PhaseDiscard)
    }
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ── 汇总导出 ──

export const wuSkills: IEffect[] = [
  zhihengEffect,
  kejiEffect,
]
