// ============================================================
// 联盟杀 · 基本牌效果定义
//
// 四种基本牌的核心结算逻辑：
//   杀 — 对目标造成1点伤害（可被闪响应）
//   闪 — 响应杀/万箭齐发，抵消伤害
//   桃 — 回复1点体力 / 濒死时救活
//   酒 — 出牌阶段：本回合下一张杀伤害+1 / 濒死时回复1点体力
//
// 每项效果均为纯 IEffect 对象，注册到 EffectRegistry 中。
// 卡牌通过 effectIds 字段引用这些效果。
// ============================================================

import {
  SkillType,
  TriggerTiming,
  Frequency,
  CardSuit,
} from '@core/contracts/enums'
import type { IEffect } from '@core/contracts/effect.interface'
import type { ICard } from '@core/contracts/card.interface'

// ────────────────────────────────────────
// 杀 — 对目标造成1点伤害
// ────────────────────────────────────────

export const shaEffect: IEffect = {
  id: 'sha',
  name: '杀',
  description: '对一名攻击范围内的角色造成1点伤害（可被闪响应）',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    // 仅当使用的卡牌为"杀"时触发
    return ctx.triggerCards.some((c) => c.tags.has('sha'))
  },

  content: async (ctx) => {
    const target = ctx.event.targets[0]
    if (!target || !target.alive) return

    // 检查是否为酒杀（damage boost）
    const isJiuBoosted = ctx.player.getMark('jiuBoost') > 0
    const damageAmount = 1 + (isJiuBoosted ? 1 : 0)

    // 清除酒标记
    if (isJiuBoosted) {
      ctx.player.clearMark('jiuBoost')
    }

    // 造成伤害（DamageSystem 流水线中会检查闪响应）
    await ctx.damageTarget(target, damageAmount)

    // 标记已使用杀
    ctx.player.markAttackUsed()
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ────────────────────────────────────────
// 闪 — 响应杀，抵消伤害
// ────────────────────────────────────────

export const shanEffect: IEffect = {
  id: 'shan',
  name: '闪',
  description: '抵消一张杀或万箭齐发的效果',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    // 闪在成为杀的目标时触发（Prepare/Prevent阶段）
    target: [{ timing: TriggerTiming.CardUse, stage: 'Prepare' }],
  },

  filter: (ctx) => {
    // 仅在触发牌为杀或万箭齐发时可用
    const card = ctx.triggerCards[0]
    if (!card) return false
    return card.tags.has('sha') || card.tags.has('attack') || card.name === '万箭齐发'
  },

  content: async (ctx) => {
    // 闪的效果：标记该次伤害应被阻止
    // 实际的闪响应由 ResponseWindow 处理，此处作为效果占位
    // DamageSystem 在 Prevent 阶段会检查此标记
    ctx.player.setMark('shanUsed', 1)
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ────────────────────────────────────────
// 桃 — 回复1点体力 / 濒死时救活
// ────────────────────────────────────────

export const taoEffect: IEffect = {
  id: 'tao',
  name: '桃',
  description: '回复1点体力；可在濒死时使用',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    if (!card || !card.tags.has('tao')) return false

    // 出牌阶段：只能对自己或濒死角色使用
    // 濒死阶段：可以对任何濒死角色使用（包含自己）
    return true
  },

  content: async (ctx) => {
    // 桃的目标：事件 target（可能是自己或濒死角色）
    const target = ctx.event.targets[0] ?? ctx.player

    if (!target.alive) return

    // 回复 1 点体力
    await ctx.recoverHp(target, 1)
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ────────────────────────────────────────
// 酒 — 出牌阶段：下一张杀伤害+1 / 濒死时回复1点体力
// ────────────────────────────────────────

export const jiuEffect: IEffect = {
  id: 'jiu',
  name: '酒',
  description: '出牌阶段：本回合下一张杀伤害+1；濒死时：回复1点体力',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.OncePerTurn,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    return card?.tags.has('jiu') ?? false
  },

  content: async (ctx) => {
    // 酒有两种使用场景：
    // 1. 出牌阶段：给自己加伤害buff
    // 2. 濒死阶段：回复1点体力（优先级高于buff）

    if (ctx.player.isDying) {
      // 濒死时使用：回复1点体力
      await ctx.recoverHp(ctx.player, 1)
    } else {
      // 出牌阶段使用：本回合下一张杀伤害+1
      ctx.player.setMark('jiuBoost', 1)

      // 记录已使用酒（本回合只能使用一次酒的buff效果）
      ctx.player.setMark('jiuUsed', 1)
    }
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ────────────────────────────────────────
// 汇总导出
// ────────────────────────────────────────

export const basicEffects: IEffect[] = [
  shaEffect,
  shanEffect,
  taoEffect,
  jiuEffect,
]
