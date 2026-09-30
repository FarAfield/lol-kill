// ============================================================
// 联盟杀 · 锦囊牌内容（Phase 7.2 – 7.4）
//
// 单体：过河拆桥 / 顺手牵羊
// 群体：南蛮入侵 / 万箭齐发 / 桃园结义 / 五谷丰登
// 特殊：无中生有 / 借刀杀人 / 无懈可击
//
// 群体锦囊按**座次顺序**逐个结算（从使用者下家起）。
// 轮询本身在 `settle()`（Phase 8）——它负责排序、插入、暂停；
// 这里只回答「轮到某人时问什么、响应了算什么」。
// ============================================================

import type { EventContent } from '@core/event/content-registry'
import { helpers } from '@core/event/content-helpers'
import {
  COUNTER_TARGET_KEY,
  canBeCountered,
  isGameEventLike,
} from '@core/event/cancel-chain'
import { cardOptions, handOptions, settle } from '@core/event'
import { CardTag } from '@core/contracts/card-tag'
import type { CardTagValue } from '@core/contracts/card-tag'
import { EquipSlot } from '@core/contracts/enums'
import type { EffectResponse, ISkillContext } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'

const NO_RESPONSE: EffectResponse = { confirmed: false }

/** 目标三个区域里可被弃置 / 获得的牌 */
function zoneCards(target: IPlayer): ICard[] {
  return [...target.handCards, ...target.equipCards, ...target.judgeCards]
}

/**
 * 结算点的响应选项：带某标签、且 `mod.cardRespondable` 放行的手牌
 *
 * 「被封了响应的牌」必须在**选项生成时**就被剔掉——等玩家选完再判，
 * 等于先给了他一个选了也无效的选项。
 */
function respondable(
  ctx: ISkillContext,
  player: IPlayer,
  tag: CardTagValue,
): ReturnType<typeof handOptions> {
  return [
    ...handOptions(player, tag, undefined, (card) =>
      ctx.mods.cardRespondable(player, card, ctx.event),
    ),
    // 虚拟牌必须进候选：群体锦囊要的是「能不能变出这张闪 / 这张杀」，
    // 而不是「手里有没有」。
    ...cardOptions(
      ctx
        .cardViews({ player, usage: 'response', requireTag: tag, event: ctx.event })
        .map((view) => view.card),
    ),
  ]
}

/**
 * 询问一名角色是否打出某类牌
 *
 * 手上没有可打的牌时不再询问，直接视为放弃。
 * 可选牌同样要过 `mod.cardRespondable`。
 */
async function askForCard(
  ctx: ISkillContext,
  player: IPlayer,
  prompt: string,
  tag: CardTagValue,
): Promise<EffectResponse> {
  const usable = [
    ...player.handCards,
    ...ctx
      .cardViews({ player, usage: 'response', requireTag: tag, event: ctx.event })
      .map((view) => view.card),
  ].filter((card) => card.tags.has(tag) && ctx.mods.cardRespondable(player, card, ctx.event))

  if (usable.length === 0) return NO_RESPONSE
  return helpers(ctx).ask(prompt, { player, validCards: usable })
}

// ── 过河拆桥：弃置目标区域内一张牌 ──
export const guoHeChaiQiaoContent: EventContent = async (ctx) => {
  const h = helpers(ctx)
  const target = h.target
  if (!target || !target.alive) return

  const pool = zoneCards(target)
  if (pool.length === 0) return

  const response = await h.ask('选择要弃置的牌', { validCards: pool })
  await h.discard([response.card ?? pool[0]!])
}

// ── 顺手牵羊：获得目标区域内一张牌 ──
export const shunShouQianYangContent: EventContent = async (ctx) => {
  const h = helpers(ctx)
  const target = h.target
  if (!target || !target.alive) return

  const pool = zoneCards(target)
  if (pool.length === 0) return

  const response = await h.ask('选择要获得的牌', { validCards: pool })
  await h.transfer([response.card ?? pool[0]!], ctx.player)
}

// ── 无中生有：摸 2 张 ──
export const wuZhongShengYouContent: EventContent = async (ctx) => {
  await helpers(ctx).draw(2)
}

// ── 南蛮入侵：其他角色各需出杀，否则受到 1 点伤害 ──
//
// 走结算点：从使用者下家起**按座次**逐个询问，已经问过的人不再重复问。
export const nanManRuQinContent: EventContent = async (ctx) => {
  const h = helpers(ctx)

  await settle(ctx, {
    id: 'nanManRuQin',
    responders: () => h.seatOrderFrom(ctx.player).filter((p) => p.alive),
    optionsFor: (player) => respondable(ctx, player, CardTag.Strike),
    prompt: () => '南蛮入侵：是否出杀？',
    onRespond: async (_player, option) => {
      if (option.card) await h.discard([option.card])
    },
    onUnanswered: async (player) => {
      await h.damage(player, 1)
    },
  })
}

// ── 万箭齐发：其他角色各需出闪，否则受到 1 点伤害 ──
export const wanJianQiFaContent: EventContent = async (ctx) => {
  const h = helpers(ctx)

  await settle(ctx, {
    id: 'wanJianQiFa',
    responders: () => h.seatOrderFrom(ctx.player).filter((p) => p.alive),
    optionsFor: (player) => respondable(ctx, player, CardTag.Dodge),
    prompt: () => '万箭齐发：是否出闪？',
    onRespond: async (_player, option) => {
      if (option.card) await h.discard([option.card])
    },
    onUnanswered: async (player) => {
      await h.damage(player, 1)
    },
  })
}

// ── 决斗：与目标轮流出杀，先不出者受到 1 点伤害 ──
//
// 每次只问一个人，因此是一个「单人结算点」的序列。
export const jueDouContent: EventContent = async (ctx) => {
  const h = helpers(ctx)
  const target = h.target
  if (!target || !target.alive) return

  // 使用者已经「出了」决斗这张牌，因此由对方先出杀
  let defender: IPlayer = target
  let attacker: IPlayer = ctx.player
  const maxRounds = ctx.game.players.length * 2

  for (let round = 0; round < maxRounds; round += 1) {
    if (!defender.alive || !attacker.alive) return

    const current = defender
    const result = await settle(ctx, {
      id: 'jueDou',
      responders: () => [current],
      optionsFor: (player) => respondable(ctx, player, CardTag.Strike),
      prompt: () => '决斗：是否出杀？',
      stopOnFirstResponse: true,
      onRespond: async (_player, option) => {
        if (option.card) await h.discard([option.card])
      },
    })

    if (result.responses.length === 0) {
      await h.damage(current, 1)
      return
    }

    // 出得起杀 → 换对方出
    ;[defender, attacker] = [attacker, defender]
  }
}

// ── 无懈可击：抵消一张锦囊牌 ──
//
// 无懈可击是**响应牌**，要抵消的不是它自己所在的使用事件，
// 而是被响应的那个事件 —— 由 `data.counterTarget` 指定。
//
// 这里只做「抵消一次」这一件事，且必须过 `canBeCountered()`：
// - 不带 target（主动打出）→ 是空操作，不能拿来当普通锦囊用；
// - target 不可被抵消（卡牌 canBeCanceled=false、mod 守卫否决、
//   已经结算完了）→ 同样是空操作。
//
// 「后发先至」不在这里实现：这张牌自己的 `useCard` 事件在被抵消之前
// 也要先开一层窗口，抵消链因此一层层往下长。见 cancel-chain.ts。
export const wuXieKeJiContent: EventContent = async (ctx) => {
  const targetEvent = ctx.event.data[COUNTER_TARGET_KEY]
  if (!isGameEventLike(targetEvent)) return
  if (!canBeCountered(targetEvent)) return

  targetEvent.cancel('无懈可击')
}

// ── 五谷丰登：亮出等同于存活角色数的牌，从使用者开始依次各选一张 ──
export const wuGuFengDengContent: EventContent = async (ctx) => {
  const h = helpers(ctx)
  const alive = h.alive()
  if (alive.length === 0) return

  const revealed = await h.draw(alive.length)
  if (revealed.length === 0) return

  let remaining = [...revealed]

  for (const player of h.seatOrderFrom(ctx.player, true)) {
    if (!player.alive || remaining.length === 0) continue

    const response = await h.ask('五谷丰登：选择一张牌', {
      player,
      validCards: remaining,
    })

    const picked = response.card ?? remaining[0]!
    remaining = remaining.filter((c) => c.instanceId !== picked.instanceId)
    if (player.id !== ctx.player.id) await h.transfer([picked], player)
  }

  // 没人要的牌进弃牌堆
  if (remaining.length > 0) await h.discard(remaining)
}

// ── 桃园结义：所有存活角色各回复 1 点体力 ──
export const taoYuanJieYiContent: EventContent = async (ctx) => {
  const h = helpers(ctx)
  for (const player of h.alive()) {
    await h.recover(player, 1)
  }
}

// ── 借刀杀人：令一名角色对另一名角色出杀，否则交出武器 ──
export const jieDaoShaRenContent: EventContent = async (ctx) => {
  const h = helpers(ctx)
  const [borrowed, victim] = h.targets
  if (!borrowed || !borrowed.alive) return

  const weapon = borrowed.equipCards.find((c) => c.equipSlot === EquipSlot.Weapon)

  // 没有可杀的目标 → 直接拿武器
  if (!victim || !victim.alive) {
    if (weapon) await h.transfer([weapon], ctx.player)
    return
  }

  const response = await askForCard(ctx, borrowed, '借刀杀人：是否出杀？', CardTag.Strike)

  if (response.confirmed) {
    if (response.card) await h.discard([response.card])
    await h.damage(victim, 1)
    return
  }

  if (weapon) await h.transfer([weapon], ctx.player)
}
