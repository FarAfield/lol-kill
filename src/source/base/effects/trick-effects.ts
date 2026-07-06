// ============================================================
// 联盟杀 · 锦囊牌效果定义
//
// 首批非延时锦囊效果（10张）：
//   过河拆桥、顺手牵羊、无中生有、南蛮入侵、万箭齐发、
//   决斗、无懈可击、五谷丰登、桃园结义、借刀杀人
//
// 每项效果均为纯 IEffect 对象，注册到 EffectRegistry 中。
// ============================================================

import {
  SkillType,
  TriggerTiming,
  Frequency,
  ZoneType,
} from '@core/contracts/enums'
import type { IEffect, IEffectContext } from '@core/contracts/effect.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { DistanceSystem } from '@core/system/distance-system'

// ────────────────────────────────────────
// 过河拆桥 — 弃置目标角色区域内一张牌
// ────────────────────────────────────────

export const guoHeChaiQiaoEffect: IEffect = {
  id: 'guoHeChaiQiao',
  name: '过河拆桥',
  description: '弃置目标角色区域内一张牌（手牌、装备区或判定区）',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    return (card?.tags.has('dismantle') || card?.tags.has('guoHeChaiQiao')) ?? false
  },

  content: async (ctx) => {
    const target = ctx.event.targets[0]
    if (!target || !target.alive) return

    // 收集目标区域内所有可弃置的牌
    const availableCards: ICard[] = [
      ...target.handCards,
      ...target.equipCards,
      ...target.judgeCards,
    ]

    if (availableCards.length === 0) return

    // 由调用方（通过 selectCard）选择要弃置的牌
    // 若未提供选择器，默认弃置第一张
    const cardToDiscard = ctx.event.data['_selectedCard'] as ICard | undefined
      ?? availableCards[0]!

    await ctx.discardCards([cardToDiscard])
  },

}

// ────────────────────────────────────────
// 顺手牵羊 — 获得目标角色区域内一张牌
// ────────────────────────────────────────

export const shunShouQianYangEffect: IEffect = {
  id: 'shunShouQianYang',
  name: '顺手牵羊',
  description: '获得距离1以内的一名角色区域内一张牌',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    return (card?.tags.has('snatch') || card?.tags.has('shunShouQianYang')) ?? false
  },

  content: async (ctx) => {
    const target = ctx.event.targets[0]
    if (!target || !target.alive) return

    // 收集目标区域内所有可获得的牌
    const availableCards: ICard[] = [
      ...target.handCards,
      ...target.equipCards,
      ...target.judgeCards,
    ]

    if (availableCards.length === 0) return

    // 由调用方选择要获得的牌，默认第一张
    const cardToTake = ctx.event.data['_selectedCard'] as ICard | undefined
      ?? availableCards[0]!

    // 将牌从目标转移给使用者
    await ctx.transferCards([cardToTake], ctx.player)
  },

}

// ────────────────────────────────────────
// 无中生有 — 摸2张牌
// ────────────────────────────────────────

export const wuZhongShengYouEffect: IEffect = {
  id: 'wuZhongShengYou',
  name: '无中生有',
  description: '摸2张牌',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    return card?.tags.has('wuZhongShengYou') ?? false
  },

  content: async (ctx) => {
    // 摸2张牌
    await ctx.drawCards(2)
  },

}

// ────────────────────────────────────────
// 南蛮入侵 — 所有其他角色需出杀，否则受到1点伤害
// ────────────────────────────────────────

export const nanManRuQinEffect: IEffect = {
  id: 'nanManRuQin',
  name: '南蛮入侵',
  description: '所有其他角色各需打出一张杀，否则受到你造成的1点伤害',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    return (card?.tags.has('nanManRuQin') || card?.tags.has('aoe') || card?.name === '南蛮入侵') ?? false
  },

  content: async (ctx) => {
    const source = ctx.player
    const allPlayers = ctx.game.players

    // 从当前回合玩家开始，按座位顺序依次结算
    const startIndex = source.seatIndex
    const totalPlayers = allPlayers.length

    for (let i = 1; i < totalPlayers; i++) {
      const idx = (startIndex + i) % totalPlayers
      const player = allPlayers[idx]!

      if (!player.alive) continue
      if (player.id === source.id) continue

      // 检查玩家是否有杀可以响应
      // 由外部（决策服务）决定是否出杀
      const responded = ctx.event.data[`_nanman_${player.id}`] as boolean | undefined

      if (!responded) {
        // 未出杀 → 受到1点伤害
        await ctx.damageTarget(player, 1)
      }
    }
  },

}

// ────────────────────────────────────────
// 万箭齐发 — 所有其他角色需出闪，否则受到1点伤害
// ────────────────────────────────────────

export const wanJianQiFaEffect: IEffect = {
  id: 'wanJianQiFa',
  name: '万箭齐发',
  description: '所有其他角色各需打出一张闪，否则受到你造成的1点伤害',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    return (card?.tags.has('wanJianQiFa') || card?.name === '万箭齐发') ?? false
  },

  content: async (ctx) => {
    const source = ctx.player
    const allPlayers = ctx.game.players

    const startIndex = source.seatIndex
    const totalPlayers = allPlayers.length

    for (let i = 1; i < totalPlayers; i++) {
      const idx = (startIndex + i) % totalPlayers
      const player = allPlayers[idx]!

      if (!player.alive) continue
      if (player.id === source.id) continue

      // 由外部决定是否出闪
      const responded = ctx.event.data[`_wanjian_${player.id}`] as boolean | undefined

      if (!responded) {
        // 未出闪 → 受到1点伤害
        await ctx.damageTarget(player, 1)
      }
    }
  },

}

// ────────────────────────────────────────
// 决斗 — 与目标轮流出杀，先不出者受到1点伤害
// ────────────────────────────────────────

export const jueDouEffect: IEffect = {
  id: 'jueDou',
  name: '决斗',
  description: '与一名角色拼杀：轮流出杀，先不出者受到对方造成的1点伤害',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    return (card?.tags.has('jueDou') || card?.tags.has('duel')) ?? false
  },

  content: async (ctx) => {
    const source = ctx.player
    const target = ctx.event.targets[0]

    if (!target || !target.alive) return

    // 决斗规则：由目标开始轮流出杀
    // 首次由目标出杀（因为决斗发起者已经"出了"决斗牌）
    let currentDefender = target
    let currentAttacker = source
    const maxRounds = ctx.game.players.length * 2 // 防止无限循环
    let round = 0

    while (round < maxRounds) {
      // 当前防守方需要出杀
      const responded = ctx.event.data[`_juedou_${currentDefender.id}_${round}`] as boolean | undefined

      if (!responded) {
        // 当前防守方无法出杀 → 受到1点伤害（由对方造成）
        await ctx.damageTarget(currentDefender, 1)
        return
      }

      // 交换攻守
      const temp = currentDefender
      currentDefender = currentAttacker
      currentAttacker = temp
      round++
    }
  },

}

// ────────────────────────────────────────
// 无懈可击 — 抵消一张锦囊牌效果
// ────────────────────────────────────────

export const wuXieKeJiEffect: IEffect = {
  id: 'wuXieKeJi',
  name: '无懈可击',
  description: '抵消一张锦囊牌的效果',
  type: SkillType.Active,
  priority: 100, // 高优先级，确保在其他效果前执行
  frequency: Frequency.Unlimited,

  trigger: {
    // 无懈可击可以在任何锦囊牌使用时触发
    global: [{ timing: TriggerTiming.CardUse, stage: 'Before' }],
  },

  filter: (ctx) => {
    // 仅对锦囊牌生效
    const card = ctx.triggerCards[0]
    if (!card) return false
    return card.type === 'rune' && card.canBeCanceled !== false
  },

  content: async (ctx) => {
    // 抵消当前事件（标记为取消）
    // 事件系统会在 Before 阶段检查 canceled 标记
    ctx.event.canceled = true

    // 将抵消信息记录到事件数据中
    ctx.event.data['_canceledBy'] = {
      player: ctx.player.id,
      card: ctx.triggerCards.find((c) => c.tags.has('wuXieKeJi'))?.id,
    }
  },

}

// ────────────────────────────────────────
// 五谷丰登 — 亮出等同于存活角色数的牌，从当前回合角色开始依次各选一张
// ────────────────────────────────────────

export const wuGuFengDengEffect: IEffect = {
  id: 'wuGuFengDeng',
  name: '五谷丰登',
  description: '亮出等同于存活角色数的牌，从当前回合角色开始依次各选一张',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    return card?.tags.has('wuGuFengDeng') ?? false
  },

  content: async (ctx) => {
    const aliveCount = ctx.game.aliveCount
    if (aliveCount === 0) return

    // 亮出等同于存活角色数的牌
    const revealedCards = await ctx.drawCards(aliveCount)
    if (revealedCards.length === 0) return

    // 从当前回合玩家开始，轮流选一张 → 由外部循环调用完成
    // 此处将亮出的牌存到事件数据中供后续处理
    ctx.event.data['_wuGuFengDeng_cards'] = revealedCards.map((c) => c.id)
    ctx.event.data['_wuGuFengDeng_remaining'] = [...revealedCards]
  },

}

// ────────────────────────────────────────
// 桃园结义 — 所有角色回复1点体力
// ────────────────────────────────────────

export const taoYuanJieYiEffect: IEffect = {
  id: 'taoYuanJieYi',
  name: '桃园结义',
  description: '所有角色各回复1点体力',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    return card?.tags.has('taoYuanJieYi') ?? false
  },

  content: async (ctx) => {
    // 所有存活角色各回复1点体力
    for (const player of ctx.game.players) {
      if (!player.alive) continue
      await ctx.recoverHp(player, 1)
    }
  },

}

// ────────────────────────────────────────
// 借刀杀人 — 令一名角色对其攻击范围内另一角色出杀，否则将其武器交给你
// ────────────────────────────────────────

export const jieDaoShaRenEffect: IEffect = {
  id: 'jieDaoShaRen',
  name: '借刀杀人',
  description: '令一名装备武器的角色对其攻击范围内你指定的一名角色出杀，否则将其武器交给你',
  type: SkillType.Active,
  priority: 0,
  frequency: Frequency.Unlimited,

  trigger: {
    source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
  },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    return card?.tags.has('jieDaoShaRen') ?? false
  },

  content: async (ctx) => {
    const target = ctx.event.targets[0] // 被借刀者
    const secondaryTarget = ctx.event.targets[1] // 需要出杀的目标

    if (!target || !target.alive) return

    // 检查目标是否有武器
    const weapon = target.equipCards.find(
      (c) => (c as ICard).equipSlot === 'weapon',
    )

    if (!weapon && !secondaryTarget) {
      // 无武器且无次要目标 → 无事发生
      return
    }

    // 由外部决策决定 target 是否出杀
    const willAttack = ctx.event.data[`_jiedao_${target.id}`] as boolean | undefined

    if (willAttack && secondaryTarget && secondaryTarget.alive) {
      // 目标对 secondaryTarget 出杀 → 视为 target 使用了一张杀
      await ctx.damageTarget(secondaryTarget, 1)
    } else if (weapon) {
      // 目标不出杀 → 将武器交给使用者
      await ctx.transferCards([weapon], ctx.player)
    }
  },

}

// ────────────────────────────────────────
// 汇总导出
// ────────────────────────────────────────

export const trickEffects: IEffect[] = [
  guoHeChaiQiaoEffect,
  shunShouQianYangEffect,
  wuZhongShengYouEffect,
  nanManRuQinEffect,
  wanJianQiFaEffect,
  jueDouEffect,
  wuXieKeJiEffect,
  wuGuFengDengEffect,
  taoYuanJieYiEffect,
  jieDaoShaRenEffect,
]
