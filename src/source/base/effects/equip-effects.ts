// ============================================================
// 联盟杀 · 装备牌效果定义
//
// 首批装备效果（9张）：
//   武器：诸葛连弩、青釭剑、雌雄双股剑、丈八蛇矛、贯石斧
//   防具：八卦阵、仁王盾
//   坐骑：+1马、-1马
//
// 装备效果为被动/锁定技，装备时注册到 EventTrigger，卸下时注销。
// 部分效果仅通过装备槽位生效（攻击范围、距离修正），由 DistanceSystem 处理。
// ============================================================

import {
  SkillType,
  TriggerTiming,
  Frequency,
  EquipSlot,
  CardSuit,
  ZoneType,
} from '@core/contracts/enums'
import type { IEffect } from '@core/contracts/effect.interface'
import type { ICard } from '@core/contracts/card.interface'

// ────────────────────────────────────────
// 诸葛连弩 — 出牌阶段可出任意张杀
// ────────────────────────────────────────

export const zhuGeLianNuEffect: IEffect = {
  id: 'zhuGeLianNu',
  name: '诸葛连弩',
  description: '攻击范围1。出牌阶段可以出任意张杀',
  type: SkillType.Locked,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    // 装备时自动生效（通过 marks 系统设置 attackLimit）
    // 此效果在回合开始时重置 attackLimit
    player: [{ timing: TriggerTiming.TurnStart, stage: 'Begin' }],
  },

  filter: (ctx) => {
    // 检查是否装备了诸葛连弩
    return ctx.player.equipCards.some(
      (c) => c.equipSlot === EquipSlot.Weapon && c.name === '诸葛连弩',
    )
  },

  content: async (ctx) => {
    // 设置本回合攻击无上限
    ctx.player.attackLimit = Infinity
  },

}

// ────────────────────────────────────────
// 青釭剑 — 使用杀时无视目标防具
// ────────────────────────────────────────

export const qingGangJianEffect: IEffect = {
  id: 'qingGangJian',
  name: '青釭剑',
  description: '攻击范围2。使用杀时无视目标防具效果',
  type: SkillType.Locked,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Before' }],
  },

  filter: (ctx) => {
    // 检查使用者是否装备青釭剑，且使用的牌为杀
    const hasQingGangJian = ctx.player.equipCards.some(
      (c) => c.equipSlot === EquipSlot.Weapon && c.name === '青釭剑',
    )
    if (!hasQingGangJian) return false

    return ctx.triggerCards.some((c) => c.tags.has('sha'))
  },

  content: async (ctx) => {
    // 为目标添加"无视防具"标记
    const target = ctx.event.targets[0]
    if (target) {
      target.setMark('ignoreArmor', 1)
    }

    // 将标记信息附加到事件中
    ctx.event.data['_ignoreArmor'] = true
  },

}

// ────────────────────────────────────────
// 雌雄双股剑 — 对异性出杀时，目标需弃一张牌，否则你摸一张牌
// ────────────────────────────────────────

export const ciXiongShuangGuJianEffect: IEffect = {
  id: 'ciXiongShuangGuJian',
  name: '雌雄双股剑',
  description: '攻击范围2。对异性出杀时，目标需弃一张牌，否则使用者摸一张牌',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Prepare' }],
  },

  filter: (ctx) => {
    // 检查使用者是否装备雌雄双股剑
    const hasSword = ctx.player.equipCards.some(
      (c) => c.equipSlot === EquipSlot.Weapon && c.name === '雌雄双股剑',
    )
    if (!hasSword) return false

    // 检查使用的牌是否为杀
    return ctx.triggerCards.some((c) => c.tags.has('sha'))
  },

  content: async (ctx) => {
    const target = ctx.event.targets[0]
    if (!target || !target.alive) return

    // 目标选择：弃一张牌或让使用者摸一张牌
    // 由外部决策决定
    const targetChoseDiscard =
      ctx.event.data['_cixiong_discard'] as boolean | undefined

    if (targetChoseDiscard) {
      const cardToDiscard = ctx.event.data['_cixiong_card'] as ICard | undefined
      if (cardToDiscard) {
        await ctx.discardCards([cardToDiscard])
      }
    } else {
      // 目标不弃牌 → 使用者摸一张牌
      await ctx.drawCards(1)
    }
  },

}

// ────────────────────────────────────────
// 丈八蛇矛 — 可将2张手牌当杀使用 (viewAs)
// ────────────────────────────────────────

export const zhangBaSheMaoEffect: IEffect = {
  id: 'zhangBaSheMao',
  name: '丈八蛇矛',
  description: '攻击范围3。可将2张手牌当杀使用',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    // 此效果通过 viewAs 机制实现，不依赖事件触发
    // viewAs 由 EventCompiler 在编译卡牌使用时调用
  },

  viewAs: (card: ICard, ctx) => {
    // 将2张手牌视作杀（由外部选择2张牌后调用）
    // 此处仅提供占位：实际 viewAs 由使用者在选择2张牌时触发
    return null
  },

  content: async (_ctx) => {
    // 效果核心逻辑由 viewAs 和外部选择器处理
  },

}

// ────────────────────────────────────────
// 贯石斧 — 杀被闪抵消后可弃2张牌强制命中
// ────────────────────────────────────────

export const guanShiFuEffect: IEffect = {
  id: 'guanShiFu',
  name: '贯石斧',
  description: '攻击范围3。杀被闪抵消后可弃2张牌，强制造成伤害',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.Damage, stage: 'Prevent' }],
  },

  filter: (ctx) => {
    // 检查使用者是否装备贯石斧
    const hasAxe = ctx.player.equipCards.some(
      (c) => c.equipSlot === EquipSlot.Weapon && c.name === '贯石斧',
    )
    if (!hasAxe) return false

    // 检查伤害是否被阻止（杀被闪抵消）
    const damageInstance = ctx.event.data['_damageInstance'] as
      | { prevented: boolean }
      | undefined
    return damageInstance?.prevented === true
  },

  content: async (ctx) => {
    // 由外部决策决定是否弃2张牌强制命中
    const willForce = ctx.event.data['_guanshifu_force'] as boolean | undefined

    if (willForce) {
      // 弃2张牌
      const cardsToDiscard = (ctx.event.data['_guanshifu_cards'] as ICard[] | undefined) ?? []
      if (cardsToDiscard.length >= 2) {
        await ctx.discardCards(cardsToDiscard.slice(0, 2))
        // 强制命中：设置伤害不被阻止
        const damageInstance = ctx.event.data['_damageInstance'] as
          | { prevented: boolean; currentAmount: number }
          | undefined
        if (damageInstance) {
          damageInstance.prevented = false
        }
      }
    }
  },

}

// ────────────────────────────────────────
// 八卦阵 — 需要出闪时可判定，红色视为出闪
// ────────────────────────────────────────

export const baGuaZhenEffect: IEffect = {
  id: 'baGuaZhen',
  name: '八卦阵',
  description: '需要出闪时可判定，若结果为红色则视为打出了闪',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    target: [{ timing: TriggerTiming.CardUse, stage: 'Prevent' }],
  },

  filter: (ctx) => {
    // 检查是否装备八卦阵，且成为杀或万箭齐发的目标
    const hasBagua = ctx.player.equipCards.some(
      (c) => c.equipSlot === EquipSlot.Armor && c.name === '八卦阵',
    )
    if (!hasBagua) return false

    const card = ctx.triggerCards[0]
    if (!card) return false
    return card.tags.has('sha') || card.tags.has('attack') || card.name === '万箭齐发'
  },

  content: async (ctx) => {
    // 判定：从牌堆顶翻一张牌
    const judgeCard = await ctx.judge(ctx.player)

    // 若判定结果为红色（红桃/方片），视为出闪
    if (judgeCard.suit === CardSuit.Heart || judgeCard.suit === CardSuit.Diamond) {
      ctx.player.setMark('baguaSuccess', 1)
      // 标记伤害被阻止
      const damageInstance = ctx.event.data['_damageInstance'] as
        | { prevented: boolean }
        | undefined
      if (damageInstance) {
        damageInstance.prevented = true
      }
    }
  },

}

// ────────────────────────────────────────
// 仁王盾 — 黑色杀对你无效
// ────────────────────────────────────────

export const renWangDunEffect: IEffect = {
  id: 'renWangDun',
  name: '仁王盾',
  description: '黑色杀对你无效',
  type: SkillType.Locked,
  priority: 10, // 高优先级，在其他防御效果前
  frequency: Frequency.Unlimited,

  trigger: {
    target: [{ timing: TriggerTiming.CardUse, stage: 'Prepare' }],
  },

  filter: (ctx) => {
    // 检查是否装备仁王盾
    const hasRenWangDun = ctx.player.equipCards.some(
      (c) => c.equipSlot === EquipSlot.Armor && c.name === '仁王盾',
    )
    if (!hasRenWangDun) return false

    // 检查触发牌是否为黑色杀
    const card = ctx.triggerCards[0]
    if (!card || !card.tags.has('sha')) return false
    return card.suit === CardSuit.Spade || card.suit === CardSuit.Club
  },

  content: async (ctx) => {
    // 黑色杀无效：标记伤害应被阻止
    ctx.player.setMark('renWangDunBlock', 1)

    // 设置事件数据中的阻止标记
    ctx.event.data['_renwangdun_blocked'] = true

    const damageInstance = ctx.event.data['_damageInstance'] as
      | { prevented: boolean }
      | undefined
    if (damageInstance) {
      damageInstance.prevented = true
    }
  },

}

// ────────────────────────────────────────
// +1马（防御马） — 其他角色计算与你的距离+1
// ────────────────────────────────────────
//
// 效果由 DistanceSystem.hasDefensiveHorse() 自动处理。
// 此 IEffect 主要用于注册表中存在以支持 effectIds 引用，
// 以及未来可能的技能互动（如"盗马"等）。
// ────────────────────────────────────────

export const defensiveHorseEffect: IEffect = {
  id: 'defensiveHorse',
  name: '+1马',
  description: '其他角色计算与你的距离时+1',
  type: SkillType.Locked,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    // 距离修正由 DistanceSystem 自动处理，无需事件触发
  },

  content: async (_ctx) => {
    // 距离修正由 DistanceSystem 自动处理
    // 此 content 为占位
  },

}

// ────────────────────────────────────────
// -1马（进攻马） — 你计算与其他角色的距离-1
// ────────────────────────────────────────
//
// 效果由 DistanceSystem.hasOffensiveHorse() 自动处理。
// ────────────────────────────────────────

export const offensiveHorseEffect: IEffect = {
  id: 'offensiveHorse',
  name: '-1马',
  description: '你计算与其他角色的距离时-1',
  type: SkillType.Locked,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    // 距离修正由 DistanceSystem 自动处理，无需事件触发
  },

  content: async (_ctx) => {
    // 距离修正由 DistanceSystem 自动处理
    // 此 content 为占位
  },

}

// ────────────────────────────────────────
// 汇总导出
// ────────────────────────────────────────

export const equipEffects: IEffect[] = [
  zhuGeLianNuEffect,
  qingGangJianEffect,
  ciXiongShuangGuJianEffect,
  zhangBaSheMaoEffect,
  guanShiFuEffect,
  baGuaZhenEffect,
  renWangDunEffect,
  defensiveHorseEffect,
  offensiveHorseEffect,
]
