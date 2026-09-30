// ============================================================
// 联盟杀 · 基本牌内容（Phase 7.1）
//
// 杀 / 闪 / 桃 / 酒
//
// 「内容」回答的是「这张牌本身做什么」，与谁在用无关。
// 别人的技能（如「你使用杀时…」）是 Trigger，不写在这里。
// ============================================================

import type { EventContent } from '@core/event/content-registry'
import { helpers } from '@core/event/content-helpers'
import { CardTag } from '@core/contracts/card-tag'
import type { CardTagValue } from '@core/contracts/card-tag'
import type { ICard } from '@core/contracts/card.interface'

/** 手牌中带指定标签的牌 */
function responseCards(hand: ICard[], tag: CardTagValue): ICard[] {
  return hand.filter((c) => c.tags.has(tag))
}


// ── 杀 ──
// 指定目标 → 询问闪 → 未出闪则结算伤害（酒杀 +1）
export const shaContent: EventContent = async (ctx) => {
  const h = helpers(ctx)
  const target = h.target
  if (!target || !target.alive) return

  // 可选牌要过 `mod.cardRespondable`：被封了响应的闪不能出现在选项里，
  // 否则玩家会看到一个「选了也没用」的选项。
  //
  // 虚拟闪要和真正的闪排在一起——【龙胆】把杀当闪打出去，
  // 走的就是这一条断链：不问，赵云就永远打不出去。
  const dodges = [
    ...responseCards(target.handCards, CardTag.Dodge),
    ...ctx
      .cardViews({ player: target, usage: 'response', requireTag: CardTag.Dodge })
      .map((view) => view.card),
  ].filter((card) => ctx.mods.cardRespondable(target, card, ctx.event))
  const response =
    dodges.length > 0
      ? await h.ask('是否出闪？', { player: target, validCards: dodges })
      : { confirmed: false }

  if (response.confirmed) {
    // 出闪 → 这一击被抵消：`cancel()` 掉杀事件，伤害根本不会发生
    //
    // 用 cancel 而不是「悄悄不造成伤害」：Cancel 会跳过后续阶段，
    // 因此「受伤后」的技能不会被误触发，且调用方能从 cancelled 上
    // 明确读到「这张杀没打中」。
    if (response.card) await h.discard([response.card])
    ctx.markAttackUsed()
    ctx.event.result.bool = false
    ctx.event.cancel('闪')
    return
  }

  const boosted = ctx.player.getMark('jiuBoost') > 0
  if (boosted) ctx.clearMark(ctx.player, 'jiuBoost')

  await h.damage(target, 1 + (boosted ? 1 : 0))
  ctx.markAttackUsed()
  ctx.event.result.bool = true
}

// ── 闪 ──
// 作为响应打出时，**取消**父事件（通常是伤害）
//
// 用 `cancel()` 而不是 `prevented = true`：cancel 会跳过 Content 之后的
// 全部阶段，因此「受伤后」的技能（刚烈 / 奸雄 / 遗计）不会被误触发；
// 单纯置 prevented 只跳过扣血，damageEnd / damageAfter 仍会跑。
export const shanContent: EventContent = async (ctx) => {
  const parent = ctx.event.parent
  if (!parent) return

  parent.cancel('闪')
  parent.result = { ...parent.result, bool: false }
}

// ── 桃 ──
// 对自己或濒死角色使用，回复 1 点体力
export const taoContent: EventContent = async (ctx) => {
  const h = helpers(ctx)
  const target = h.target ?? ctx.player
  if (!target.alive) return

  await h.recover(target, 1)
}

// ── 酒 ──
// 濒死时：回复 1 点体力；出牌阶段：本回合下一张杀伤害 +1
export const jiuContent: EventContent = async (ctx) => {
  const h = helpers(ctx)

  if (ctx.player.isDying) {
    await h.recover(ctx.player, 1)
    return
  }

  ctx.setMark(ctx.player, 'jiuBoost', 1)
  ctx.setMark(ctx.player, 'jiuUsed', 1)
}
