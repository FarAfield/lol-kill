// ============================================================
// 联盟杀 · ResponseInquiry — 结算点的询问实现
//
// `settlement.ts` 只定义「怎么轮询」，不关心「怎么问」。
// 这里把询问接到 `ISkillContext.waitForResponse()` 上：
// 暂停、超时、UI/AI 决策全在那一层，结算点保持纯粹。
// ============================================================

import type { ISkillContext } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { CardTagValue } from '@core/contracts/card-tag'
import {
  SettlementRunner,
  type ResponseAsker,
  type ResponseOption,
  type SettlementPoint,
  type SettlementResult,
} from './settlement'
import { EventRunnerMissingError } from './errors'

/**
 * 把一组卡牌包装成响应选项
 *
 * @param cards 候选卡牌
 * @param label 展示文案（缺省用卡牌名）
 */
export function cardOptions(
  cards: readonly ICard[],
  label?: (card: ICard) => string,
): ResponseOption[] {
  return cards.map((card) => ({
    kind: 'card' as const,
    card,
    label: label ? label(card) : card.name,
  }))
}

/**
 * 取玩家手上带某个标签的牌作为响应选项
 *
 * 南蛮入侵（要杀）、万箭齐发（要闪）、濒死求桃（要桃）都用它。
 *
 * @param allow 额外的放行判定（缺省一律放行）
 *
 * 这张口子是 `mod.cardRespondable` / `mod.cardSavable` 的落点：
 * 「你有闪，但此刻不能用」这类否决必须发生在**选项生成时**，
 * 而不是等玩家选完再判——否则 UI 会先给出一个选了也无效的选项。
 * 调用方按场景传不同的否决器：响应征询传 `cardRespondable`，
 * 濒死求桃传 `cardSavable`。
 */
export function handOptions(
  player: IPlayer,
  tag: CardTagValue,
  label?: (card: ICard) => string,
  allow?: (card: ICard) => boolean,
): ResponseOption[] {
  return cardOptions(
    player.handCards.filter((card) => card.tags.has(tag) && (allow?.(card) ?? true)),
    label,
  )
}

/**
 * 构造一个询问函数
 *
 * `waitForResponse` 目前只支持「选一张牌 / 放弃」，因此 `kind === 'skill'`
 * 的选项在这里被过滤掉——宁可少问，也不能问了却没法执行。
 *
 * 注意「卡牌选项」里可能混着**虚拟牌**（`viewAs` 造出的视图，见 Phase 16）：
 * 它们有独立的 `instanceId`，因此选中后能精确回指到那一条视作结果；
 * 真正被弃置的是它的底牌，由 `CardSystem` 在移动时翻译。
 */
export function createAsker(ctx: ISkillContext): ResponseAsker {
  return async (player, options, prompt) => {
    const cardOpts = options.filter(
      (option): option is ResponseOption & { card: ICard } =>
        option.kind === 'card' && option.card !== undefined,
    )

    const response = await ctx.waitForResponse(prompt, {
      player,
      validCards: cardOpts.map((option) => option.card),
    })

    if (!response.confirmed || !response.card) return null

    const picked = cardOpts.find(
      (option) => option.card.instanceId === response.card!.instanceId,
    )
    return picked ?? null
  }
}

/**
 * 在一个事件上下文里开启结算点
 *
 * 事件必须已经进入调度（否则响应无法被压栈结算）。
 */
export async function settle(
  ctx: ISkillContext,
  point: SettlementPoint,
): Promise<SettlementResult> {
  if (!ctx.event.runner) {
    throw new EventRunnerMissingError(ctx.event.name)
  }
  return new SettlementRunner(createAsker(ctx)).run(point)
}
