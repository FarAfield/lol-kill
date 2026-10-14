// ============================================================
// 联盟杀 · 吴国（Ionia）武将技能
//
// 包含：
//   孙权 — 制衡 (主动)
//   吕蒙 — 克己 (锁定)
//   黄月英 — 集智 (触发) / 奇才 (距离 Mod)
//
// 克己在迁移时被重新对准了时机：它原本挂在 `phaseDiscardBefore` 上，
// 而 `PhaseManager.executeTurn` 是在**分发阶段事件之前**就检查
// `shouldSkipPhases` 的——等事件发出来，跳过与否早已决定完了。
// 也就是说原实现一次也没生效过。正确时机是「出牌阶段结束时」。
// ============================================================

import { GamePhase, ZoneType } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import type { ISkill } from '@core/contracts/skill.interface'

// ═══════════════════════════════════════════
// 孙权 · 制衡
// 出牌阶段，你可以弃置任意张牌，然后摸等量的牌（每回合限一次）。
// ═══════════════════════════════════════════

export const zhiheng: ISkill = {
  id: 'zhiheng',
  name: '制衡',
  description: '出牌阶段可弃置任意张牌，然后摸等量的牌（每回合限一次）。',

  priority: 10,
  frequency: 'oncePerTurn',
  enable: [GamePhase.PhaseUse],
  trigger: { player: ['phaseUseBegin'] },

  filter: (ctx) =>
    ctx.player.alive &&
    (ctx.player.handCards.length > 0 || ctx.player.equipCards.length > 0),

  content: async (ctx) => {
    ctx.setMark(ctx.player, 'zhihengAvailable', 1)

    // 无决策服务时按「装备优先于手牌」弃一张、摸一张；
    // 有 UI 时应由 `askForCardSelection` 的返回数量决定，
    // 但「弃几张摸几张」这条等式不能变。
    const chosen =
      ctx.player.equipCards.find((c) => c.zone === ZoneType.Equip) ??
      ctx.player.handCards.find((c) => c.zone === ZoneType.Hand)
    if (!chosen) return

    await ctx.discardCards([chosen])
    await ctx.drawCards(1)
  },

  ai: { order: 5 },
}

// ═══════════════════════════════════════════
// 吕蒙 · 克己
// 锁定技，若你于出牌阶段未使用过【杀】，你跳过本回合的弃牌阶段。
// ═══════════════════════════════════════════

/**
 * 克己 —— 锁定技，出牌阶段结束时决定要不要跳过弃牌阶段
 *
 * 挂在 `phaseUseEnd` 而不是 `phaseDiscardBefore`：
 * `executeTurn` 在分发阶段事件**之前**就检查 `shouldSkipPhases`，
 * 事件发出时去改它，已经太晚了。
 *
 * 「本回合出没出过杀」读 `player.usedAttackThisTurn` —— 它由
 * `basic-contents` 在结算杀时写入、由 `resetTurnState` 每回合清零，
 * 是一条真正被维护的信号（旧的 `usedShaThisTurn` 标记无人写入，恒为 0）。
 */
export const keji: ISkill = {
  id: 'keji',
  name: '克己',
  description: '锁定技，出牌阶段未使用【杀】，则跳过弃牌阶段。',

  locked: true,
  priority: 100,
  frequency: 'unlimited',
  trigger: { player: ['phaseUseEnd'] },

  filter: (ctx) => ctx.player.alive && !ctx.player.usedAttackThisTurn,

  content: async (ctx) => {
    const player = ctx.player
    if (player.shouldSkipPhases.includes(GamePhase.PhaseDiscard)) return
    ctx.skipPhases(player, [GamePhase.PhaseDiscard])
  },

  ai: { order: 7 },
}

// ═══════════════════════════════════════════
// 黄月英 · 集智
// 每当你使用一张非延时锦囊牌后，你可以摸一张牌。
// ═══════════════════════════════════════════

/**
 * 集智 —— 挂在 `useCardAfter` 而不是 `useCard`
 *
 * 空后缀那个事件名是**内容阶段**：那一刻卡牌自己的内容正在跑，
 * 在这儿摸牌就成了「牌还没结算完先把牌摸了」；而且被【无懈可击】
 * 抵消的那张同样会走到内容阶段。挂「用完之后」，摸的才是
 * 真的用出去的那一张。
 *
 * 「非延时锦囊」按**标签**判而不是按牌名——引擎依旧不认识任何
 * 一张具体的牌，将来加的新锦囊自动算数。
 */
export const jizhi: ISkill = {
  id: 'jizhi',
  name: '集智',
  description: '每当你使用一张非延时锦囊牌后，你可以摸一张牌。',

  priority: 10,
  frequency: 'unlimited',
  trigger: { player: ['useCardAfter'] },

  filter: (ctx) => {
    const card = ctx.event.cards[0]
    if (!card) return false
    // 延时锦囊是「放置」不是「使用」，不该触发
    return ctx.player.alive && card.tags.has(CardTag.Trick) && !card.isDelayed
  },

  content: async (ctx) => {
    await ctx.drawCards(1)
  },

  ai: { order: 4 },
}

// ═══════════════════════════════════════════
// 黄月英 · 奇才
// 你使用锦囊牌时无距离限制。
// ═══════════════════════════════════════════

/**
 * 【奇才】—— 本仓**第一个**「按牌型改写距离」的技能（欠账 D43）
 *
 * 它之所以曾经表达不出来，是因为距离 Mod 只收 `(value, ctx, to)`：
 * Mod 看到的是一串数字，不知道这次算距离是为了打哪张牌，于是只能
 * 无条件把距离改成 1 —— 那等于连【杀】的攻击范围也一起放开，
 * 而【奇才】并没有这个效果。
 *
 * 现在 `mod.distanceFrom` 的末尾多带一个 `card`，这就够了：
 * 是锦囊就压到 1（距离下限本来就是 1，压到 1 即「全场都在距离 1 内」），
 * 不是锦囊就原样返回。
 */
export const qicai: ISkill = {
  id: 'qicai',
  name: '奇才',
  description: '你使用锦囊牌时无距离限制。',

  mod: {
    distanceFrom: (value, _ctx, _to, card) => {
      if (!card || card.isDelayed) return value
      return card.tags.has(CardTag.Trick) ? 1 : value
    },
  },

  ai: { order: 6 },
}

// ── 汇总导出 ──

export const wuSkills: ISkill[] = [zhiheng, keji, jizhi, qicai]
