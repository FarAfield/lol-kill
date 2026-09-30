// ============================================================
// 联盟杀 · 锦囊牌定义
//
// 首批锦囊牌（含非延时与延时）：
//   过河拆桥、顺手牵羊、无中生有、南蛮入侵、万箭齐发、
//   决斗、无懈可击、五谷丰登、桃园结义、借刀杀人、
//   乐不思蜀、兵粮寸断、闪电
//
// 每张定义描述卡牌的类型模板。实际牌堆中的花色/点数分布
// 由 DeckManager 在初始化时创建。
// ============================================================

import { CardType, CardSuit } from '@core/contracts/enums'
import type { CardDefinition } from '@core/entity/card'
import { CardTag } from '@core/contracts/card-tag'

// ── 非延时锦囊 ──

/**
 * 过河拆桥 — 弃置目标角色区域内一张牌。
 */
export const GuoHeChaiQiao: CardDefinition = {
  id: 'guoHeChaiQiao',
  name: '过河拆桥',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '弃置目标角色区域内一张牌（手牌、装备区或判定区）',
  tags: [CardTag.Dismantle, CardTag.Trick],
  effectIds: ['guoHeChaiQiao'],
  isDelayed: false,
  canBeCanceled: true,
}

/**
 * 顺手牵羊 — 获得目标角色区域内一张牌。
 */
export const ShunShouQianYang: CardDefinition = {
  id: 'shunShouQianYang',
  name: '顺手牵羊',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '获得距离1以内的一名角色区域内一张牌',
  tags: [CardTag.Snatch, CardTag.Trick],
  effectIds: ['shunShouQianYang'],
  isDelayed: false,
  canBeCanceled: true,
}

/**
 * 无中生有 — 摸2张牌。
 */
export const WuZhongShengYou: CardDefinition = {
  id: 'wuZhongShengYou',
  name: '无中生有',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '摸2张牌',
  tags: [CardTag.SomethingFromNothing, CardTag.Trick, CardTag.Draw],
  effectIds: ['wuZhongShengYou'],
  isDelayed: false,
  canBeCanceled: true,
}

/**
 * 南蛮入侵 — 所有其他角色需出杀，否则受到1点伤害。
 */
export const NanManRuQin: CardDefinition = {
  id: 'nanManRuQin',
  name: '南蛮入侵',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '所有其他角色各需打出一张杀，否则受到你造成的1点伤害',
  tags: [CardTag.BarbarianRaid, CardTag.Trick, CardTag.Aoe],
  effectIds: ['nanManRuQin'],
  isDelayed: false,
  canBeCanceled: true,
}

/**
 * 万箭齐发 — 所有其他角色需出闪，否则受到1点伤害。
 */
export const WanJianQiFa: CardDefinition = {
  id: 'wanJianQiFa',
  name: '万箭齐发',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '所有其他角色各需打出一张闪，否则受到你造成的1点伤害',
  tags: [CardTag.ArrowBarrage, CardTag.Trick, CardTag.Aoe],
  effectIds: ['wanJianQiFa'],
  isDelayed: false,
  canBeCanceled: true,
}

/**
 * 决斗 — 与目标轮流出杀，先不出者受到1点伤害。
 */
export const JueDou: CardDefinition = {
  id: 'jueDou',
  name: '决斗',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '与一名角色拼杀：轮流出杀，先不出者受到对方造成的1点伤害',
  tags: [CardTag.Duel, CardTag.Trick],
  effectIds: ['jueDou'],
  isDelayed: false,
  canBeCanceled: true,
}

/**
 * 无懈可击 — 抵消一张锦囊牌效果。
 */
export const WuXieKeJi: CardDefinition = {
  id: 'wuXieKeJi',
  name: '无懈可击',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '抵消一张锦囊牌的效果',
  tags: [CardTag.Counter, CardTag.Trick, CardTag.Cancel, CardTag.Response],
  effectIds: ['wuXieKeJi'],
  isDelayed: false,
  canBeCanceled: true,
}

/**
 * 五谷丰登 — 亮出等同于存活角色数的牌，依次各选一张。
 */
export const WuGuFengDeng: CardDefinition = {
  id: 'wuGuFengDeng',
  name: '五谷丰登',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '亮出等同于存活角色数的牌，从当前回合角色开始依次各选一张',
  tags: [CardTag.BountifulHarvest, CardTag.Trick, CardTag.Draw],
  effectIds: ['wuGuFengDeng'],
  isDelayed: false,
  canBeCanceled: true,
}

/**
 * 桃园结义 — 所有角色回复1点体力。
 */
export const TaoYuanJieYi: CardDefinition = {
  id: 'taoYuanJieYi',
  name: '桃园结义',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '所有角色各回复1点体力',
  tags: [CardTag.PeachGardenOath, CardTag.Trick, CardTag.Heal, CardTag.Aoe],
  effectIds: ['taoYuanJieYi'],
  isDelayed: false,
  canBeCanceled: true,
}

/**
 * 借刀杀人 — 令一名角色对其攻击范围内另一角色出杀，否则将其武器交给你。
 */
export const JieDaoShaRen: CardDefinition = {
  id: 'jieDaoShaRen',
  name: '借刀杀人',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '令一名装备武器的角色对其攻击范围内你指定的一名角色出杀，否则将其武器交给你',
  tags: [CardTag.BorrowedBlade, CardTag.Trick],
  effectIds: ['jieDaoShaRen'],
  isDelayed: false,
  canBeCanceled: true,
}

// ── 延时锦囊（进入判定区） ──

/**
 * 乐不思蜀 — 判定生效后跳过出牌阶段。
 */
export const LeBuSiShu: CardDefinition = {
  id: 'leBuSiShu',
  name: '乐不思蜀',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '延时：判定阶段判定，若结果不为红桃则跳过出牌阶段',
  tags: [CardTag.SkipPlayPhase, CardTag.Trick, CardTag.Delayed, CardTag.SkipPhase],
  effectIds: ['leBuSiShu'],
  isDelayed: true,
  canBeCanceled: true,
}

/**
 * 兵粮寸断 — 判定生效后跳过摸牌阶段。
 */
export const BingLiangCunDuan: CardDefinition = {
  id: 'bingLiangCunDuan',
  name: '兵粮寸断',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '延时：判定阶段判定，若结果不为梅花则跳过摸牌阶段',
  tags: [CardTag.SkipDrawPhase, CardTag.Trick, CardTag.Delayed, CardTag.SkipPhase],
  effectIds: ['bingLiangCunDuan'],
  isDelayed: true,
  canBeCanceled: true,
}

/**
 * 闪电 — 判定生效后受到3点雷电伤害。
 */
export const ShanDian: CardDefinition = {
  id: 'shanDian',
  name: '闪电',
  type: CardType.Rune,
  suit: CardSuit.None,
  rank: 1,
  description: '延时：判定阶段判定，若结果为黑桃2-9则受到3点雷电伤害，否则移至下家判定区',
  tags: [CardTag.Lightning, CardTag.Trick, CardTag.Delayed, CardTag.Damage],
  effectIds: ['shanDian'],
  isDelayed: true,
  canBeCanceled: true,
}

// ── 汇总导出 ──

/**
 * 全部非延时锦囊牌定义
 */
export const nonDelayedTrickCards: CardDefinition[] = [
  GuoHeChaiQiao,
  ShunShouQianYang,
  WuZhongShengYou,
  NanManRuQin,
  WanJianQiFa,
  JueDou,
  WuXieKeJi,
  WuGuFengDeng,
  TaoYuanJieYi,
  JieDaoShaRen,
]

/**
 * 全部延时锦囊牌定义
 */
export const delayedTrickCards: CardDefinition[] = [
  LeBuSiShu,
  BingLiangCunDuan,
  ShanDian,
]

/**
 * 全部锦囊牌定义
 */
export const trickCards: CardDefinition[] = [
  ...nonDelayedTrickCards,
  ...delayedTrickCards,
]
