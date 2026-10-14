// ============================================================
// 联盟杀 · 基本牌定义
//
// 四种基本牌：杀、闪、桃、酒
//
// 每张定义描述卡牌的类型模板。实际牌堆中的花色/点数分布
// 由 DeckManager 在初始化时根据 STANDARD_DECK_COMPOSITION 创建。
// 此处的 suit / rank 为占位值。
// ============================================================

import { CardType, CardSuit } from '@core/contracts/enums'
import type { CardDefinition } from '@core/entity/card'
import { CardTag } from '@core/contracts/card-tag'

/**
 * 杀 — 对一名角色造成1点伤害。
 *
 * 使用时机：出牌阶段
 * 使用目标：攻击范围内的一名其他角色
 * 使用次数：每回合限一次（默认）
 * 效果：对目标角色造成1点伤害（可被闪响应）
 */
export const Sha: CardDefinition = {
  id: 'sha',
  name: '杀',
  type: CardType.Basic,
  suit: CardSuit.None,
  rank: 1,
  description: '对一名攻击范围内的角色造成1点伤害',
  tags: [CardTag.Strike, CardTag.Attack, CardTag.Basic],
  effectIds: ['sha'],
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 火杀 — 带火焰属性的杀。
 *
 * **为什么要有它**：`CardTag.Fire` 与藤甲的「受到火焰伤害 +1」早就写好了，
 * 可牌堆里从来没有任何一张牌带这个 tag —— 那条 Mod 在真实对局里
 * **永远触发不到**。属性杀不是装饰，`DamageResolver.damageTypeOf(card)`
 * 就是靠它决定这次伤害的属性。
 *
 * 内容复用 `shaContent`（`basic-contents.ts`），只是内容表里多挂一个键：
 * 用牌事件以**卡牌 id** 为名派发，因此 `huoSha` 必须有自己的条目，
 * 否则这张牌打出去了却什么都不会发生。
 */
export const HuoSha: CardDefinition = {
  id: 'huoSha',
  name: '火杀',
  type: CardType.Basic,
  suit: CardSuit.None,
  rank: 1,
  description: '对一名攻击范围内的角色造成1点火焰伤害',
  tags: [CardTag.Strike, CardTag.Attack, CardTag.Basic, CardTag.Fire],
  effectIds: ['sha'],
  isDelayed: false,
  canBeCanceled: false,
}

/** 雷杀 — 带雷电属性的杀（藤甲对它无效，见 `HuoSha` 的说明） */
export const LeiSha: CardDefinition = {
  id: 'leiSha',
  name: '雷杀',
  type: CardType.Basic,
  suit: CardSuit.None,
  rank: 1,
  description: '对一名攻击范围内的角色造成1点雷电伤害',
  tags: [CardTag.Strike, CardTag.Attack, CardTag.Basic, CardTag.Thunder],
  effectIds: ['sha'],
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 闪 — 抵消杀的效果。
 *
 * 使用时机：响应杀时 / 响应万箭齐发时
 * 使用目标：无（自身响应）
 * 效果：抵消一张杀或万箭齐发的效果
 */
export const Shan: CardDefinition = {
  id: 'shan',
  name: '闪',
  type: CardType.Basic,
  suit: CardSuit.None,
  rank: 1,
  description: '抵消一张杀或万箭齐发的效果',
  tags: [CardTag.Dodge, CardTag.Defense, CardTag.Basic, CardTag.Response],
  effectIds: ['shan'],
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 桃 — 回复1点体力。
 *
 * 使用时机：出牌阶段 / 濒死时
 * 使用目标：自己（受伤时） / 濒死角色
 * 效果：目标回复1点体力；在濒死时使用可救活濒死角色
 */
export const Tao: CardDefinition = {
  id: 'tao',
  name: '桃',
  type: CardType.Basic,
  suit: CardSuit.None,
  rank: 1,
  description: '回复1点体力；可在濒死时使用',
  tags: [CardTag.Heal, CardTag.Basic, CardTag.Dying],
  effectIds: ['tao'],
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 酒 — 本回合下一张杀伤害+1 / 濒死时回复1点体力。
 *
 * 使用时机：出牌阶段 / 濒死时
 * 使用目标：自己
 * 效果（出牌阶段）：本回合下一张使用的杀的伤害+1（不可叠加）
 * 效果（濒死时）：回复1点体力
 */
export const Jiu: CardDefinition = {
  id: 'jiu',
  name: '酒',
  type: CardType.Basic,
  suit: CardSuit.None,
  rank: 1,
  description: '出牌阶段：本回合下一张杀伤害+1；濒死时：回复1点体力',
  tags: [CardTag.Wine, CardTag.Boost, CardTag.Basic, CardTag.Dying],
  effectIds: ['jiu'],
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 全部基本牌定义
 */
export const basicCards: CardDefinition[] = [Sha, HuoSha, LeiSha, Shan, Tao, Jiu]
