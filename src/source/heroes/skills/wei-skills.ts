// ============================================================
// 联盟杀 · 魏国（Demacia）武将技能
//
// 包含：
//   曹操  — 奸雄 (被动) / 护驾 (主动)
//   司马懿 — 反馈 (被动) / 鬼才 (主动)
//   夏侯惇 — 刚烈 (被动)
//   张辽   — 突袭 (主动)
// ============================================================

import {
  SkillType,
  TriggerTiming,
  Frequency,
  CardSuit,
  ZoneType,
  GamePhase,
} from '@core/contracts/enums'
import type { IEffect } from '@core/contracts/effect.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'

// ═══════════════════════════════════════════
// 曹操 · 奸雄
// 当你受到伤害后，你获得造成此伤害的牌。
// ═══════════════════════════════════════════

export const jianxiongEffect: IEffect = {
  id: 'jianxiong',
  name: '奸雄',
  description: '当你受到伤害后，你获得造成此伤害的牌。',
  type: SkillType.Passive,
  priority: 10,
  frequency: Frequency.Unlimited,

  trigger: {
    target: [{ timing: TriggerTiming.Damage, stage: 'After' }],
  },

  filter: (ctx) => {
    // 伤害来源不是自己（自己伤害自己不触发奸雄）
    if (!ctx.event.source) return false
    if (ctx.event.source.id === ctx.player.id) return false

    // 必须有造成伤害的卡牌
    const damageCard = ctx.damageEvent?.data?.['damageCard'] as ICard | undefined
    if (!damageCard) {
      // 也可能是存储在 event data 中
      const card = ctx.event.data?.['damageCard'] as ICard | undefined
      if (!card) return false
    }

    // 伤害必须已应用（未被阻止）
    const prevented = ctx.event.data?.['damagePrevented'] as boolean | undefined
    if (prevented) return false

    return true
  },

  content: async (ctx) => {
    const source = ctx.event.source!
    const damageCard =
      (ctx.event.data?.['damageCard'] as ICard | undefined) ??
      (ctx.damageEvent?.data?.['damageCard'] as ICard | undefined)

    if (!damageCard) return

    // 获得造成伤害的牌（从任意区域移入手牌）
    // 检查卡牌所在区域
    if (damageCard.zone === ZoneType.Processing || damageCard.zone === ZoneType.Discard) {
      // 从处理区或弃牌堆获得
      await ctx.obtainCards(ctx.player, [damageCard])
    } else if (damageCard.zone === ZoneType.Hand || damageCard.zone === ZoneType.Equip) {
      // 从来源手牌/装备区获得（转移）
      await ctx.transferCards([damageCard], ctx.player)
    }
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ═══════════════════════════════════════════
// 曹操 · 护驾
// 当你需要使用或打出一张闪时，你可以令一名
// 魏（Demacia）势力角色打出一张闪（视为由你使用或打出）。
// ═══════════════════════════════════════════

export const hujiaEffect: IEffect = {
  id: 'hujia',
  name: '护驾',
  description: '当你需要使用闪时，可令一名魏势力角色替你打出闪。',
  type: SkillType.Active,
  priority: 20,
  frequency: Frequency.Unlimited,

  trigger: {
    // 当曹操成为杀的目标时（Prevent阶段），提供替代响应
    target: [{ timing: TriggerTiming.CardUse, stage: 'Prevent' }],
  },

  filter: (ctx) => {
    // 仅在触发牌为杀/需要闪响应时触发
    const cards = ctx.triggerCards
    if (cards.length === 0) return false
    const card = cards[0]!
    // 检查是否为需要闪响应的场景
    const needsShan =
      card.tags.has('sha') ||
      card.tags.has('attack') ||
      card.name === '万箭齐发'
    return needsShan
  },

  content: async (ctx) => {
    // 护驾的核心效果：标记当前事件允许魏势力角色替曹操出闪
    // 实际响应由 ResponseWindow 检查此标记后扩展可选响应者列表
    ctx.player.setMark('hujiaActive', 1)

    // 标记清除由事件结束时 EventDispatcher 处理
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ═══════════════════════════════════════════
// 司马懿 · 反馈
// 当你受到伤害后，你获得伤害来源的一张牌
// （手牌或装备区的牌，由你选择）。
// ═══════════════════════════════════════════

export const fankuiEffect: IEffect = {
  id: 'fankui',
  name: '反馈',
  description: '当你受到伤害后，你获得伤害来源的一张牌。',
  type: SkillType.Passive,
  priority: 10,
  frequency: Frequency.Unlimited,

  trigger: {
    target: [{ timing: TriggerTiming.Damage, stage: 'After' }],
  },

  filter: (ctx) => {
    const source = ctx.event.source
    if (!source || source.id === ctx.player.id) return false
    if (!source.alive) return false

    // 伤害必须已应用
    const prevented = ctx.event.data?.['damagePrevented'] as boolean | undefined
    if (prevented) return false

    // 伤害来源必须有牌（手牌或装备）
    return source.handCards.length > 0 || source.equipCards.length > 0
  },

  content: async (ctx) => {
    const source = ctx.event.source!
    if (!source.alive) return

    // 汇总可获得的牌（手牌 + 装备）
    const availableCards: ICard[] = [
      ...source.handCards,
      ...source.equipCards,
    ]

    if (availableCards.length === 0) return

    // 随机选择一张（无决策服务时的默认行为）
    // 实际应用中由 UIDecisionService 提供选择
    const chosenIndex = Math.floor(Math.random() * availableCards.length)
    const chosenCard = availableCards[chosenIndex]!

    // 将牌转移给司马懿
    if (chosenCard.zone === ZoneType.Equip) {
      // 从装备区获得
      await ctx.transferCards([chosenCard], ctx.player)
    } else {
      await ctx.transferCards([chosenCard], ctx.player)
    }
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ═══════════════════════════════════════════
// 司马懿 · 鬼才
// 当一名角色的判定牌生效前，你可以打出一张手牌
// 代替之。
// ═══════════════════════════════════════════

export const guicaiEffect: IEffect = {
  id: 'guicai',
  name: '鬼才',
  description: '当判定牌生效前，你可以打出一张手牌代替之。',
  type: SkillType.Active,
  priority: 30,
  frequency: Frequency.Unlimited,

  trigger: {
    global: [{ timing: TriggerTiming.Judge, stage: 'Prepare' }],
  },

  filter: (ctx) => {
    // 司马懿必须存活且有手牌
    if (!ctx.player.alive) return false
    return ctx.player.handCards.length > 0
  },

  content: async (ctx) => {
    // 获取当前判定牌
    const judgeCard = ctx.event.data?.['judgeCard'] as ICard | undefined
    if (!judgeCard) return

    // 随机选择一张手牌替换（无决策服务时的默认行为）
    const handCards = [...ctx.player.handCards]
    if (handCards.length === 0) return

    const replaceIndex = Math.floor(Math.random() * handCards.length)
    const replaceCard = handCards[replaceIndex]!

    // 弃置原判定牌
    judgeCard.zone = ZoneType.Discard
    ctx.player.handCards = ctx.player.handCards.filter(
      (c) => c.id !== replaceCard.id,
    )

    // 将手牌放入判定区替换
    replaceCard.zone = ZoneType.Judge
    ;(ctx.event.data as Record<string, unknown>)['judgeCard'] = replaceCard

    // 原判定牌进入弃牌堆
    ctx.player.handCards.push(judgeCard)
    judgeCard.zone = ZoneType.Hand
    judgeCard.owner = ctx.player
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ═══════════════════════════════════════════
// 夏侯惇 · 刚烈
// 当你受到伤害后，你可以进行判定：
// 若结果不为红桃，伤害来源选择：
//   1) 弃置两张手牌
//   2) 受到你造成的1点伤害
// ═══════════════════════════════════════════

export const ganglieEffect: IEffect = {
  id: 'ganglie',
  name: '刚烈',
  description: '受到伤害后可判定：若不为红桃，伤害来源需弃2牌或受1点伤害。',
  type: SkillType.Passive,
  priority: 10,
  frequency: Frequency.OncePerTurn,

  trigger: {
    target: [{ timing: TriggerTiming.Damage, stage: 'After' }],
  },

  filter: (ctx) => {
    const source = ctx.event.source
    if (!source || source.id === ctx.player.id) return false
    if (!source.alive) return false

    const prevented = ctx.event.data?.['damagePrevented'] as boolean | undefined
    if (prevented) return false

    return true
  },

  content: async (ctx) => {
    const source = ctx.event.source!
    if (!source.alive) return

    // 判定
    let judgeCard: ICard
    try {
      judgeCard = await ctx.judge(ctx.player)
    } catch {
      // 无法判定时跳过
      return
    }

    // 检查判定结果：不为红桃则触发效果
    if (judgeCard.suit === CardSuit.Heart && judgeCard.rank >= 10) {
      // 红桃10+（相当于红桃Q/K判定牌为红桃），刚烈不生效
      // 简化：非红桃才生效
      // 红桃 → 不触发
      return
    }

    // 判定不为红桃：伤害来源选择
    const handCount = source.handCards.length

    if (handCount >= 2) {
      // 来源有 ≥2 张手牌：随机选择弃2牌或受1伤害（简化实现：弃牌优先）
      if (source.handCards.length >= 2) {
        const toDiscard = source.handCards.slice(0, 2)
        await ctx.discardCards(toDiscard)
        // 从手牌中移除
        source.handCards = source.handCards.filter(
          (c) => !toDiscard.some((d) => d.id === c.id),
        )
      }
    } else {
      // 来源手牌不足2张：只能受到1点伤害
      await ctx.damageTarget(source, 1)
    }
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ═══════════════════════════════════════════
// 张辽 · 突袭
// 摸牌阶段，你可以放弃摸牌，改为获得一至两名
// 其他角色的各一张手牌。
// ═══════════════════════════════════════════

export const tuxiEffect: IEffect = {
  id: 'tuxi',
  name: '突袭',
  description: '摸牌阶段可放弃摸牌，改为获得至多两名角色各一张手牌。',
  type: SkillType.Active,
  priority: 20,
  frequency: Frequency.OncePerTurn,

  trigger: {
    player: [{ timing: TriggerTiming.PhaseDraw, stage: 'Begin' }],
  },

  filter: (ctx) => {
    // 张辽的摸牌阶段
    if (!ctx.player.alive) return false

    // 需要有其他存活的、有手牌的玩家
    const otherPlayers = ctx.game.players.filter(
      (p) =>
        p.id !== ctx.player.id &&
        p.alive &&
        p.handCards.length > 0,
    )
    return otherPlayers.length > 0
  },

  content: async (ctx) => {
    // 标记跳过正常摸牌
    ctx.player.setMark('skipDraw', 1)

    // 选择目标（简化：选择手牌最多的前2名其他角色）
    const otherPlayers = ctx.game.players
      .filter(
        (p) =>
          p.id !== ctx.player.id &&
          p.alive &&
          p.handCards.length > 0,
      )
      .sort((a, b) => b.handCards.length - a.handCards.length)

    const targets = otherPlayers.slice(0, 2)

    for (const target of targets) {
      if (target.handCards.length === 0) continue

      // 随机获得一张手牌
      const randomIndex = Math.floor(Math.random() * target.handCards.length)
      const stolenCard = target.handCards[randomIndex]!

      // 从目标手牌中移除
      target.handCards = target.handCards.filter(
        (c) => c.id !== stolenCard.id,
      )

      // 加入张辽手牌
      await ctx.obtainCards(ctx.player, [stolenCard])
    }
  },

  enabled: true,
  usedThisTurn: false,
  usedThisRound: false,
}

// ── 汇总导出 ──

export const weiSkills: IEffect[] = [
  jianxiongEffect,
  hujiaEffect,
  fankuiEffect,
  guicaiEffect,
  ganglieEffect,
  tuxiEffect,
]
