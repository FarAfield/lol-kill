// ============================================================
// 联盟杀 · 延时锦囊内容（Phase 7.5）
//
// 乐不思蜀 / 兵粮寸断 / 闪电
//
// 延时锦囊分两步：
//   1. 使用时 —— 放入目标判定区（由 `useCard` 内容直接处理，不走这里）
//   2. 判定阶段 —— 翻判定牌，按结果生效（**这里**）
//
// 因此这里的内容只在判定阶段被触发（Phase 24 的判定流程会调用它）。
// ============================================================

import type { EventContent } from '@core/event/content-registry'
import { helpers } from '@core/event/content-helpers'
import { CardSuit, GamePhase } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ISkillContext } from '@core/contracts/skill.interface'

/**
 * 取本次判定的结果牌
 *
 * 判定由**判定阶段**负责（`PhaseManager.doPhaseJudge`）：它翻牌、发 `judge` 事件、
 * 再把延时牌自己的 id 作为子事件名触发到这里，顺带把翻出来的那张牌放进
 * `data.judgeResultCard`。本函数照抄同一份结果，于是**一回合只翻一张牌**。
 *
 * 兜底那一路（没有提供结果时自己翻）不是摆设：直接 dispatch `leBuSiShu`
 * 这类场景（内容层的单元测试）不走判定阶段，内容得自己把判定做完——
 * 「Content = 这个事件本身做什么」，它不该假设调用方替它翻过牌了。
 */
async function judgeResult(ctx: ISkillContext, owner: IPlayer): Promise<ICard> {
  const provided = ctx.event.data['judgeResultCard'] as ICard | undefined
  if (provided) return provided
  return helpers(ctx).judge(owner)
}

// ── 乐不思蜀：判定不为红桃 → 跳过出牌阶段 ──
export const leBuSiShuContent: EventContent = async (ctx) => {
  const owner = ctx.event.target ?? ctx.player

  const judged = await judgeResult(ctx, owner)
  if (judged.suit !== CardSuit.Heart) {
    ctx.skipPhases(owner, [GamePhase.PhaseUse])
  }
}

// ── 兵粮寸断：判定不为梅花 → 跳过摸牌阶段 ──
export const bingLiangCunDuanContent: EventContent = async (ctx) => {
  const owner = ctx.event.target ?? ctx.player

  const judged = await judgeResult(ctx, owner)
  if (judged.suit !== CardSuit.Club) {
    ctx.skipPhases(owner, [GamePhase.PhaseDraw])
  }
}

// ── 闪电：判定为黑桃 2–9 → 受到 3 点雷电伤害，否则移给下家 ──
export const shanDianContent: EventContent = async (ctx) => {
  const h = helpers(ctx)
  const owner = ctx.event.target ?? ctx.player
  const card = ctx.event.card

  const judged = await judgeResult(ctx, owner)
  const hits = judged.suit === CardSuit.Spade && judged.rank >= 2 && judged.rank <= 9

  if (hits) {
    await h.damage(owner, 3)
    return
  }

  // 未命中：传给下家判定区
  const next = h.seatOrderFrom(owner).find((p) => p.alive)
  if (next && card) await ctx.placeDelayedCard(card, next)
}
