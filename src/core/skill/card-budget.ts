// ============================================================
// 联盟杀 · CardBudget — 一张牌这一回合还能用几次
//
// 欠账 D8 的形态甲：**杀的额度只有一个出口**。
//
// 在此之前「本回合还能不能出杀」有两个互不通气的答案：
//   - 出牌阶段的选项（`PhaseManager.getPlayableCards`）问 `mod.cardUsable`；
//   - 其他地方（AI、UI）问 `player.canAttack`，它读的是
//     `attackLimit > (usedAttackThisTurn ? 1 : 0)` —— 一个**完全不经过
//     Mod 注册表**的算式。
//
// 于是【诸葛连弩】装上去以后，出牌选项承认「可以无限出」，
// AI 却因为 `attackLimit` 还停在 1 而不肯出第二刀。
// 同一个问题两个答案，这就是 D8。
//
// 收口之后：
//   - **判定**只有这一处：已用次数 < `mod.cardUsable(...)`
//   - `usedAttackThisTurn` 退化为**事实账本**：它继续被 `markAttackUsed`
//     维护、被技能的 `filter` 读（克己看的就是它），但它自己不再回答
//     「能不能」——回答「能不能」的只有这里。
// ============================================================

import { CardTag } from '@core/contracts/card-tag'
import type { IModQuery } from '@core/contracts/mod.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'

/** 其余牌的本回合流水：键是卡牌 id，值是已用次数 */
export type UsageLedger = ReadonlyMap<string, number>

export class CardBudget {
  constructor(private readonly modQuery?: IModQuery) {}

  /**
   * 上限：这张牌一回合能用几次
   *
   * 数字来自 Mod 注册表（`cardUsable`）——武器、技能、装备技都只是
   * 同一个数字的不同来源，谁也不许自己另存一份。
   */
  limitOf(player: IPlayer, card: ICard): number {
    if (!this.modQuery) return Infinity
    return this.modQuery.cardUsable(player, card)
  }

  /**
   * **唯一的判定**：已用次数 < 上限
   *
   * 【杀】的账本在玩家身上（`usedAttackThisTurn`）——那是 AI / UI / 引擎
   * 三方都读得到的同一份；其余牌的计数由调用方按本回合流水给。
   *
   * 没有注入 `modQuery` 时一律放行，与全仓「`modQuery` 缺席即不禁」的
   * 约定保持一致（`cardEnabled` / `cardDiscardable` 都是这么做的）。
   */
  canPlay(player: IPlayer, card: ICard, others?: UsageLedger): boolean {
    const used = card.tags.has(CardTag.Strike)
      ? player.usedAttackThisTurn
        ? 1
        : 0
      : (others?.get(card.id) ?? 0)

    return used < this.limitOf(player, card)
  }

  /** 剩余次数（供 UI 显示「还能出几次」） */
  remainingOf(player: IPlayer, card: ICard, others?: UsageLedger): number {
    const limit = this.limitOf(player, card)
    if (limit === Infinity) return Infinity

    const used = card.tags.has(CardTag.Strike)
      ? player.usedAttackThisTurn
        ? 1
        : 0
      : (others?.get(card.id) ?? 0)

    return Math.max(0, limit - used)
  }
}
