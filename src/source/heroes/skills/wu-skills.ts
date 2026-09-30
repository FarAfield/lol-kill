// ============================================================
// 联盟杀 · 吴国（Ionia）武将技能
//
// 包含：
//   孙权 — 制衡 (主动)
//   吕蒙 — 克己 (锁定)
//
// 克己在迁移时被重新对准了时机：它原本挂在 `phaseDiscardBefore` 上，
// 而 `PhaseManager.executeTurn` 是在**分发阶段事件之前**就检查
// `shouldSkipPhases` 的——等事件发出来，跳过与否早已决定完了。
// 也就是说原实现一次也没生效过。正确时机是「出牌阶段结束时」。
// ============================================================

import { GamePhase, ZoneType } from '@core/contracts/enums'
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

// ── 汇总导出 ──

export const wuSkills: ISkill[] = [zhiheng, keji]
