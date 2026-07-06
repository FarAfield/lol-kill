// ============================================================
// 联盟杀 · 蜀国（Noxus）武将技能
//
// 包含：
//   刘备 — 仁德 (主动)
//   关羽 — 武圣 (主动)
//   张飞 — 咆哮 (锁定)
//   赵云 — 龙胆 (主动)
// ============================================================

import {
  SkillType,
  TriggerTiming,
  Frequency,
  CardSuit,
  CardType,
  ZoneType,
  GamePhase,
} from '@core/contracts/enums'
import type { IEffect } from '@core/contracts/effect.interface'
import type { ICard } from '@core/contracts/card.interface'

// ═══════════════════════════════════════════
// 刘备 · 仁德
// 出牌阶段，你可以将任意张手牌交给其他角色。
// 当你于此阶段内以此法交出第二张手牌时，
// 你回复1点体力。
// ═══════════════════════════════════════════

export const rendeEffect: IEffect = {
  id: 'rende',
  name: '仁德',
  description: '出牌阶段可将手牌交给其他角色；每阶段交出≥2张时回复1点体力。',
  type: SkillType.Active,
  priority: 10,
  frequency: Frequency.OncePerTurn,

  trigger: {
    player: [{ timing: TriggerTiming.PhaseUse, stage: 'Begin' }],
  },

  filter: (ctx) => {
    // 刘备必须存活且有手牌
    if (!ctx.player.alive) return false
    return ctx.player.handCards.length > 0
  },

  content: async (ctx) => {
    // 仁德是一个出牌阶段内的可选动作
    // 实际交互由 UI 驱动：玩家选择手牌和目标
    // 此处标记技能可用状态，由 PhaseManager/ResponseWindow 检查
    ctx.player.setMark('rendeAvailable', 1)

    // 追踪本阶段已给出的牌数
    const givenCount = ctx.player.getMark('rendeGivenCount')
    ctx.player.setMark('rendePhaseActive', 1)
  },

}

// ═══════════════════════════════════════════
// 关羽 · 武圣
// 你可以将一张红色牌当【杀】使用或打出。
// ═══════════════════════════════════════════

export const wushengEffect: IEffect = {
  id: 'wusheng',
  name: '武圣',
  description: '你可以将一张红色牌当【杀】使用或打出。',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    // viewAs 技能不需要事件触发，由 CardSystem 在牌使用检查时调用
    // 此处留空 trigger，由 SkillRegistry 特殊处理或由 CardSystem 查询
    source: [],
  },

  /**
   * viewAsFilter: 预筛选哪些牌可用于武圣
   * 红色牌（红桃/方片）且不是杀本身，可视为杀
   */
  viewAsFilter: (card: ICard, _ctx) => {
    if (card.tags.has('sha')) return false // 已经是杀，不需要武圣
    // 红色牌 = 红桃(Heart) 或 方片(Diamond)
    return card.suit === CardSuit.Heart || card.suit === CardSuit.Diamond
  },

  /**
   * viewAs: 将红色牌视为杀
   */
  viewAs: (card: ICard, _ctx) => {
    if (card.suit !== CardSuit.Heart && card.suit !== CardSuit.Diamond) {
      return null
    }
    return {
      name: '杀（武圣）',
      description: `关羽将 ${card.name} 当【杀】使用`,
      tags: new Set(['sha']),
      virtual: true,
    }
  },

  content: async (_ctx) => {
    // viewAs 技能的核心逻辑由 CardSystem 在使用牌时调用 viewAs/viewAsFilter
    // 此 content 仅作占位
  },

}

// ═══════════════════════════════════════════
// 张飞 · 咆哮
// 锁定技，你使用【杀】无次数限制。
// ═══════════════════════════════════════════

export const paoxiaoEffect: IEffect = {
  id: 'paoxiao',
  name: '咆哮',
  description: '锁定技，你使用【杀】无次数限制。',
  type: SkillType.Locked,
  priority: 100,
  frequency: Frequency.Unlimited,

  trigger: {
    player: [{ timing: TriggerTiming.TurnStart, stage: 'Begin' }],
  },

  filter: (ctx) => {
    return ctx.player.alive
  },

  content: async (ctx) => {
    // 回合开始时：将攻击次数限制设为无限
    ctx.player.attackLimit = Infinity
    // 设置标记表示本回合可无限出杀
    ctx.player.setMark('paoxiaoActive', 1)
  },

}

// ═══════════════════════════════════════════
// 赵云 · 龙胆
// 你可以将一张【杀】当【闪】使用或打出，
// 或将一张【闪】当【杀】使用或打出。
// ═══════════════════════════════════════════

export const longdanEffect: IEffect = {
  id: 'longdan',
  name: '龙胆',
  description: '你可以将【杀】当【闪】、【闪】当【杀】使用或打出。',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [],
  },

  /**
   * viewAsFilter: 杀或闪都可以用于龙胆转换
   */
  viewAsFilter: (card: ICard, _ctx) => {
    return card.tags.has('sha') || card.tags.has('shan')
  },

  /**
   * viewAs: 杀→闪，闪→杀
   */
  viewAs: (card: ICard, _ctx) => {
    if (card.tags.has('sha')) {
      return {
        name: '闪（龙胆）',
        description: `赵云将 ${card.name} 当【闪】使用`,
        tags: new Set(['shan']),
        virtual: true,
      }
    }
    if (card.tags.has('shan')) {
      return {
        name: '杀（龙胆）',
        description: `赵云将 ${card.name} 当【杀】使用`,
        tags: new Set(['sha']),
        virtual: true,
      }
    }
    return null
  },

  content: async (_ctx) => {
    // viewAs 技能，核心逻辑由 CardSystem 在使用牌时调用 viewAs
  },

}

// ── 汇总导出 ──

export const shuSkills: IEffect[] = [
  rendeEffect,
  wushengEffect,
  paoxiaoEffect,
  longdanEffect,
]
