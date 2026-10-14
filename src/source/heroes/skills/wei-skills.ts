// ============================================================
// 联盟杀 · 魏国（Demacia）武将技能
//
// 包含：
//   曹操  — 奸雄 (被动) / 护驾 (主动)
//   司马懿 — 反馈 (被动) / 鬼才 (主动)
//   夏侯惇 — 刚烈 (被动)
//   张辽   — 突袭 (主动)
//
// Phase 13 起全部按 `ISkill` 契约书写：
// - `type: SkillType.X` → 分类布尔位（`locked` / `limited` / `equipSkill` …）
// - `frequency: Frequency.X` → 字符串频率
// - 选项是必要时才写（`priority` / `frequency` 都有默认值）
// ============================================================

import { CardSuit, ZoneType } from '@core/contracts/enums'
import type { ISkill, ISkillContext } from '@core/contracts/skill.interface'
import type { ICard } from '@core/contracts/card.interface'
import { CardTag } from '@core/contracts/card-tag'
import { judgeResultCardOf, setJudgeResultCard } from '@core/event/judge-keys'

/**
 * 取伤害事件里那张「造成伤害的牌」
 *
 * 伤害事件可能把牌挂在 `data.damageCard`，也可能挂在关联伤害事件上；
 * 两处都试一遍，比在调用方各写一遍 `as` 强转强。
 */
function damageCardOf(ctx: ISkillContext): ICard | undefined {
  const own = ctx.event.data?.['damageCard'] as ICard | undefined
  if (own) return own
  return ctx.damageEvent?.data?.['damageCard'] as ICard | undefined
}

/** 这次伤害有没有被防掉（被闪掉的奸雄 / 反馈都不该发动） */
function damagePrevented(ctx: ISkillContext): boolean {
  return ctx.event.data?.['damagePrevented'] === true
}

// ═══════════════════════════════════════════
// 曹操 · 奸雄
// 当你受到伤害后，你获得造成此伤害的牌。
// ═══════════════════════════════════════════

export const jianxiong: ISkill = {
  id: 'jianxiong',
  name: '奸雄',
  description: '当你受到伤害后，你获得造成此伤害的牌。',

  trigger: { target: ['damageAfter'] },

  filter: (ctx) => {
    // 自己伤害自己不算「别人的伤害」
    const source = ctx.event.source
    if (!source || source.id === ctx.player.id) return false
    // 被闪掉不发动：牌还是对方的那张，不是「打进来的」
    if (damagePrevented(ctx)) return false
    return damageCardOf(ctx) !== undefined
  },

  content: async (ctx) => {
    const card = damageCardOf(ctx)
    if (!card) return

    // 已在流动中的牌（处理区 / 弃牌堆）直接获得；
    // 还在别人身上（如借刀杀人时从对方装备取得）则走转移。
    if (card.zone === ZoneType.Processing || card.zone === ZoneType.Discard) {
      await ctx.obtainCards(ctx.player, [card])
    } else {
      await ctx.transferCards([card], ctx.player)
    }
  },

  ai: {
    order: 3,
    result: { player: (p) => (p.isWounded ? 3 : 1) },
  },
}

// ═══════════════════════════════════════════
// 曹操 · 护驾
// 主公技，当你需要使用或打出一张闪时，
// 你可以令一名魏势力角色打出一张闪。
// ═══════════════════════════════════════════

export const hujia: ISkill = {
  id: 'hujia',
  name: '护驾',
  description: '当你需要使用【闪】时，可令一名魏势力角色替你打出闪。',

  priority: 20,
  trigger: { target: ['useCardPrevent'] },

  filter: (ctx) => {
    const card = ctx.triggerCards[0]
    if (!card) return false
    // 只有需要闪的场合才有「求救」的意义
    return card.tags.has(CardTag.Strike) || card.tags.has(CardTag.Attack)
  },

  /**
   * 护驾不自己出闪，而是把这个标记挂上——真正的替代响应由
   * ResponseInquiry 读到标记后把魏势力角色加进被询问名单。
   */
  content: async (ctx) => {
    ctx.setMark(ctx.player, 'hujiaActive', 1)
  },

  ai: { order: 6 },
}

// ═══════════════════════════════════════════
// 司马懿 · 反馈
// 当你受到伤害后，你获得伤害来源的一张牌。
// ═══════════════════════════════════════════

export const fankui: ISkill = {
  id: 'fankui',
  name: '反馈',
  description: '当你受到伤害后，你获得伤害来源的一张牌。',

  trigger: { target: ['damageAfter'] },

  filter: (ctx) => {
    const source = ctx.event.source
    if (!source || source.id === ctx.player.id) return false
    if (!source.alive) return false
    if (damagePrevented(ctx)) return false
    return source.handCards.length > 0 || source.equipCards.length > 0
  },

  content: async (ctx) => {
    const source = ctx.event.source
    if (!source?.alive) return

    // 没有决策服务时按「手牌优先于装备」的顺序取第一张。
    // 用固定的确定顺序而不是随机——重放一局的必要条件。
    const target =
      source.handCards[0] ?? source.equipCards[0]
    if (!target) return

    await ctx.transferCards([target], ctx.player)
  },

  ai: { order: 4 },
}

// ═══════════════════════════════════════════
// 司马懿 · 鬼才
// 当一名角色的判定牌生效前，你可以打出一张手牌代替之。
// ═══════════════════════════════════════════

export const guicai: ISkill = {
  id: 'guicai',
  name: '鬼才',
  description: '当判定牌生效前，你可以打出一张手牌代替之。',

  priority: 30,
  trigger: { global: ['judgePrepare'] },

  filter: (ctx) => {
    if (!ctx.player.alive) return false
    if (ctx.player.handCards.length === 0) return false
    // 换的是**判定结果牌**。判定事件里还有另一张牌（延时锦囊自己），
    // 它挂在另一个键上——改到它头上，改判就变成了「把乐不思蜀摸进手牌」。
    return Boolean(judgeResultCardOf(ctx.event))
  },

  /**
   * 用一张手牌换掉判定结果牌
   *
   * 换下来的原结果牌进自己手里——这是「换」而不是「改」：
   * 场上没有牌消失，只是位置变了。
   */
  content: async (ctx) => {
    const original = judgeResultCardOf(ctx.event)
    if (!original) return

    const replacement = ctx.player.handCards[0]
    if (!replacement) return

    await ctx.discardCards([replacement])
    await ctx.obtainCards(ctx.player, [original])

    setJudgeResultCard(ctx.event, replacement)
  },

  ai: { order: 7 },
}

// ═══════════════════════════════════════════
// 夏侯惇 · 刚烈
// 当你受到伤害后，你可以进行判定：
// 若结果不为红桃，伤害来源选择弃置两张手牌或受到1点伤害。
// ═══════════════════════════════════════════

export const ganglie: ISkill = {
  id: 'ganglie',
  name: '刚烈',
  description: '受到伤害后可判定：若不为红桃，伤害来源需弃2牌或受1点伤害。',

  frequency: 'oncePerTurn',
  trigger: { target: ['damageAfter'] },

  filter: (ctx) => {
    const source = ctx.event.source
    if (!source || source.id === ctx.player.id) return false
    if (!source.alive) return false
    return !damagePrevented(ctx)
  },

  content: async (ctx) => {
    const source = ctx.event.source
    if (!source?.alive) return

    let judgeCard: ICard
    try {
      judgeCard = await ctx.judge(ctx.player)
    } catch {
      return
    }

    // 红桃 → 刚烈不发动
    if (judgeCard.suit === CardSuit.Heart) return

    // 来源手牌不足 2 张时只能吃伤害
    if (source.handCards.length < 2) {
      await ctx.damageTarget(source, 1)
      return
    }
    await ctx.discardCards(source.handCards.slice(0, 2))
  },

  ai: { order: 5, threaten: 2 },
}

// ═══════════════════════════════════════════
// 张辽 · 突袭
// 摸牌阶段，你可以放弃摸牌，
// 改为获得一至两名其他角色的各一张手牌。
// ═══════════════════════════════════════════

export const tuxi: ISkill = {
  id: 'tuxi',
  name: '突袭',
  description: '摸牌阶段可放弃摸牌，改为获得至多两名角色各一张手牌。',

  frequency: 'oncePerTurn',
  trigger: { player: ['phaseDrawBegin'] },

  filter: (ctx) => {
    if (!ctx.player.alive) return false
    return ctx.game.players.some(
      (p) => p.id !== ctx.player.id && p.alive && p.handCards.length > 0,
    )
  },

  content: async (ctx) => {
    ctx.setMark(ctx.player, 'skipDraw', 1)

    // 多的优先：手牌最多的人最值得抽，且排序稳定（相同张数按座次）
    const targets = [...ctx.game.players]
      .filter((p) => p.id !== ctx.player.id && p.alive && p.handCards.length > 0)
      .sort((a, b) => {
        if (b.handCards.length !== a.handCards.length) {
          return b.handCards.length - a.handCards.length
        }
        return a.seatIndex - b.seatIndex
      })
      .slice(0, 2)

    for (const target of targets) {
      const stolen = target.handCards[0]
      if (!stolen) continue
      await ctx.transferCards([stolen], ctx.player)
    }
  },

  ai: { order: 4 },
}

// ── 汇总导出 ──

export const weiSkills: ISkill[] = [
  jianxiong,
  hujia,
  fankui,
  guicai,
  ganglie,
  tuxi,
]
