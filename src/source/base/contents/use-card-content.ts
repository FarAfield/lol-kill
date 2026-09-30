// ============================================================
// 联盟杀 · 用牌总入口
//
// `useCard` 是「使用一张牌」这件事本身。它不关心这张牌是什么，
// 只负责把牌送到正确的处理器：
//
//   装备牌   → 触发 `equip` 事件（装上）
//   延时锦囊 → 放入目标判定区（判定留到目标的判定阶段，Phase 24）
//   锦囊牌   → 开一层无懈可击窗口 → 未被抵消才继续
//   其余牌   → 以**卡牌 id** 为事件名触发子事件（杀→sha、过河拆桥→guoHeChaiQiao）
//
// 因此新增一张牌 = 在 `contents/` 加一个以卡牌 id 命名的条目，引擎零改动。
//
// 注意【无懈可击】自己也走这条路：它是一张锦囊，所以它也会开一层窗口
// ——问的正是「是否抵消这张无懈」。链式抵消（后发先至）就是这么来的，
// 不需要在这里写递归。见 `core/event/cancel-chain.ts`。
// ============================================================

import type { EventContent } from '@core/event/content-registry'
import {
  COUNTER_LABEL_KEY,
  COUNTER_TARGET_KEY,
  openCancelChain,
} from '@core/event/cancel-chain'
import { CardTag } from '@core/contracts/card-tag'
import type { EventName } from '@core/contracts/event-name'
import type { ICard } from '@core/contracts/card.interface'

/** 可被无懈可击抵消的牌：锦囊（含延时锦囊） */
function isCounterable(card: ICard): boolean {
  return card.tags.has(CardTag.Trick) || card.tags.has(CardTag.Delayed)
}

export const useCardContent: EventContent = async (ctx) => {
  const card = ctx.event.card
  if (!card) return

  // 结构性标记：这张牌所在的事件会征询无懈。
  // 「此刻能不能真的被抵消」由 canBeCountered() 综合判定
  // （卡牌 canBeCanceled、事件是否已终态、mod 守卫……）。
  ctx.event.cancelable = isCounterable(card) && !card.isDelayed

  // 装备牌：装上，没有独立的卡牌事件
  if (card.tags.has(CardTag.Equip)) {
    await ctx.event.trigger('equip', { cards: [card] })
    return
  }

  // 延时锦囊：放进目标判定区，判定阶段才会结算
  if (card.isDelayed) {
    const target = ctx.event.target
    if (target) await ctx.placeDelayedCard(card, target)
    return
  }

  // 锦囊牌：先开一层无懈可击窗口，被抵消就到此为止
  if (isCounterable(card)) {
    await openCancelChain(ctx, ctx.event, card.name)
    if (ctx.event.cancelled) return
  }

  // 其余牌：以卡牌 id 作为事件名，触发这张牌自己的内容
  //
  // 抵消目标要跟着往下传：无懈可击靠 `data.counterTarget` 才知道
  // 该去抵消谁，丢在这里的话它就成了一个空操作。
  const inherited: Record<string, unknown> = {}
  const counterTarget = ctx.event.data[COUNTER_TARGET_KEY]
  const counterLabel = ctx.event.data[COUNTER_LABEL_KEY]
  if (counterTarget !== undefined) inherited[COUNTER_TARGET_KEY] = counterTarget
  if (counterLabel !== undefined) inherited[COUNTER_LABEL_KEY] = counterLabel

  await ctx.event.trigger(card.id as EventName, {
    targets: ctx.event.targets,
    cards: [card],
    data: inherited,
  })
}
