// ============================================================
// 联盟杀 · ContentHelpers — 事件内容的写作助手
//
// 无名杀里内容写 `player.damage(2)` / `player.draw(2)`，读起来就是规则书。
// 这里提供同等的书写体验，但底层一律走 `ISkillContext`，
// 因此「所有写操作必须经过事件与 system/*」这条铁律不会被绕过。
//
// 用法：
// ```ts
// const strike: EventContent = async (ctx) => {
//   const h = helpers(ctx)
//   const resp = await h.ask(h.targets[0]!, '是否出闪？', { validCards: dodges })
//   if (!resp.confirmed) await h.damage(h.targets[0]!, 1)
// }
// ```
// ============================================================

import type { ISkillContext } from '@core/contracts/skill.interface'
import type { ResponseRequest, EffectResponse } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { seatOrderFrom as seatOrder } from './settlement'

export interface ContentHelpers {
  /** 事件发起者 */
  readonly source: IPlayer
  /** 事件目标列表（副本，避免内容误改事件状态） */
  readonly targets: IPlayer[]
  /** 单目标便捷访问 */
  readonly target: IPlayer | undefined
  /** 触发卡牌 */
  readonly card: ICard | undefined

  /** 造成伤害 */
  damage(target: IPlayer, amount: number): Promise<void>
  /** 回复体力 */
  recover(target: IPlayer, amount: number): Promise<void>
  /** 摸牌（进入发起者手牌） */
  draw(count: number): Promise<ICard[]>
  /** 弃置卡牌 */
  discard(cards: ICard[]): Promise<void>
  /** 令目标获得卡牌 */
  gain(target: IPlayer, cards: ICard[]): Promise<void>
  /** 把卡牌从原持有者转移给目标 */
  transfer(cards: ICard[], to: IPlayer): Promise<void>
  /** 装备一张牌 */
  equip(card: ICard): Promise<void>
  /** 判定 —— 翻一张牌作为判定牌 */
  judge(player: IPlayer): Promise<ICard>
  /** 修改体力上限 */
  modifyMaxHp(target: IPlayer, delta: number): Promise<void>

  /**
   * 询问玩家
   *
   * 不传 `options.player` 时询问事件发起者；
   * AOE、决斗这类要问别人，显式传 `player`。
   */
  ask(prompt: string, options?: ResponseRequest): Promise<EffectResponse>

  /**
   * 从某人下家开始的座次顺序（不含某人自己）
   *
   * 南蛮入侵 / 万箭齐发 / 五谷丰登 的结算顺序都靠它。
   */
  seatOrderFrom(from: IPlayer, includeSelf?: boolean): IPlayer[]

  /** 全部存活角色（按座次） */
  alive(): IPlayer[]
}

/**
 * 为一个事件上下文构造助手
 */
export function helpers(ctx: ISkillContext): ContentHelpers {
  const source = ctx.player

  // 复用 settlement.ts 里的纯函数，避免两处座次实现走偏
  const seatOrderFrom = (from: IPlayer, includeSelf = false): IPlayer[] =>
    seatOrder(ctx.game.players, from, includeSelf)

  return {
    source,
    targets: [...ctx.event.targets],
    target: ctx.event.targets[0],
    card: ctx.event.cards[0],

    damage: (target, amount) => ctx.damageTarget(target, amount),
    recover: (target, amount) => ctx.recoverHp(target, amount),
    draw: (count) => ctx.drawCards(count),
    discard: (cards) => ctx.discardCards(cards),
    gain: (target, cards) => ctx.obtainCards(target, cards),
    transfer: (cards, to) => ctx.transferCards(cards, to),
    equip: (card) => ctx.equipCard(card),
    judge: (player) => ctx.judge(player),
    modifyMaxHp: (target, delta) => ctx.modifyMaxHp(target, delta),

    ask: (prompt, options) => ctx.waitForResponse(prompt, options),
    seatOrderFrom,

    alive: () => ctx.game.players.filter((p) => p.alive),
  }
}
