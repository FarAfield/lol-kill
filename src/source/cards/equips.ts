// ============================================================
// 联盟杀 · 装备牌定义
//
// 首批装备牌：
//   武器：诸葛连弩、青釭剑、雌雄双股剑、丈八蛇矛、贯石斧
//   防具：八卦阵、仁王盾、藤甲
//   马：  +1马（防御马）、-1马（进攻马）
//
// 每张定义描述卡牌的类型模板。实际牌堆中的花色/点数分布
// 由 DeckManager 在初始化时创建。
// ============================================================

import { CardType, CardSuit, EquipSlot } from '@core/contracts/enums'
import type { CardDefinition } from '@core/entity/card'
import { CardTag } from '@core/contracts/card-tag'

// ── 武器牌 ──

/**
 * 诸葛连弩 — 攻击范围1，出牌阶段可出任意张杀。
 */
export const ZhuGeLianNu: CardDefinition = {
  id: 'zhuGeLianNu',
  name: '诸葛连弩',
  type: CardType.Equip,
  suit: CardSuit.None,
  rank: 1,
  description: '攻击范围1。出牌阶段可以出任意张杀',
  tags: [CardTag.RepeatingCrossbow, CardTag.Equip, CardTag.Weapon],
  effectIds: ['zhuGeLianNu'],
  equipSlot: EquipSlot.Weapon,
  attackRange: 1,
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 青釭剑 — 攻击范围2，使用杀时无视目标防具。
 */
export const QingGangJian: CardDefinition = {
  id: 'qingGangJian',
  name: '青釭剑',
  type: CardType.Equip,
  suit: CardSuit.None,
  rank: 1,
  description: '攻击范围2。使用杀时无视目标防具效果',
  tags: [CardTag.BlueSteelBlade, CardTag.Equip, CardTag.Weapon],
  effectIds: ['qingGangJian'],
  equipSlot: EquipSlot.Weapon,
  attackRange: 2,
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 雌雄双股剑 — 攻击范围2，对异性出杀时，目标需弃一张牌或让你摸一张牌。
 */
export const CiXiongShuangGuJian: CardDefinition = {
  id: 'ciXiongShuangGuJian',
  name: '雌雄双股剑',
  type: CardType.Equip,
  suit: CardSuit.None,
  rank: 1,
  description: '攻击范围2。对异性出杀时，目标需弃一张牌，否则你摸一张牌',
  tags: [CardTag.TwinBlades, CardTag.Equip, CardTag.Weapon],
  effectIds: ['ciXiongShuangGuJian'],
  equipSlot: EquipSlot.Weapon,
  attackRange: 2,
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 丈八蛇矛 — 攻击范围3，可将2张手牌当杀使用。
 */
export const ZhangBaSheMao: CardDefinition = {
  id: 'zhangBaSheMao',
  name: '丈八蛇矛',
  type: CardType.Equip,
  suit: CardSuit.None,
  rank: 1,
  description: '攻击范围3。可将2张手牌当杀使用',
  tags: [CardTag.SerpentSpear, CardTag.Equip, CardTag.Weapon],
  effectIds: ['zhangBaSheMao'],
  equipSlot: EquipSlot.Weapon,
  attackRange: 3,
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 贯石斧 — 攻击范围3，杀被闪抵消后可弃2张牌强制命中。
 */
export const GuanShiFu: CardDefinition = {
  id: 'guanShiFu',
  name: '贯石斧',
  type: CardType.Equip,
  suit: CardSuit.None,
  rank: 1,
  description: '攻击范围3。杀被闪抵消后可弃2张牌，强制造成伤害',
  tags: [CardTag.StoneAxe, CardTag.Equip, CardTag.Weapon],
  effectIds: ['guanShiFu'],
  equipSlot: EquipSlot.Weapon,
  attackRange: 3,
  isDelayed: false,
  canBeCanceled: false,
}

// ── 防具牌 ──

/**
 * 八卦阵 — 需要出闪时可判定，红色视为出闪。
 */
export const BaGuaZhen: CardDefinition = {
  id: 'baGuaZhen',
  name: '八卦阵',
  type: CardType.Equip,
  suit: CardSuit.None,
  rank: 1,
  description: '需要出闪时可判定，若结果为红色则视为打出了闪',
  tags: [CardTag.EightTrigrams, CardTag.Equip, CardTag.Armor],
  effectIds: ['baGuaZhen'],
  equipSlot: EquipSlot.Armor,
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 仁王盾 — 黑色杀对你无效。
 */
export const RenWangDun: CardDefinition = {
  id: 'renWangDun',
  name: '仁王盾',
  type: CardType.Equip,
  suit: CardSuit.None,
  rank: 1,
  description: '黑色杀对你无效',
  tags: [CardTag.BenevolentShield, CardTag.Equip, CardTag.Armor],
  effectIds: ['renWangDun'],
  equipSlot: EquipSlot.Armor,
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * 藤甲 — 防具，受到的火焰伤害 +1。
 *
 * 它的效果由 `mods/equip-mods.ts` 的 `rattanArmorMod` 提供（数值 → Mod），
 * 因此本定义不需要任何 effectIds。
 */
export const TengJia: CardDefinition = {
  id: 'tengJia',
  name: '藤甲',
  type: CardType.Equip,
  suit: CardSuit.None,
  rank: 1,
  description: '防具。你受到的火焰伤害+1',
  tags: [CardTag.RattanArmor, CardTag.Equip, CardTag.Armor],
  effectIds: [],
  equipSlot: EquipSlot.Armor,
  isDelayed: false,
  canBeCanceled: false,
}

// ── 坐骑牌 ──

/**
 * +1马 — 防御马，其他角色计算与你的距离时+1。
 */
export const PlusOneHorse: CardDefinition = {
  id: 'plusOneHorse',
  name: '+1马',
  type: CardType.Equip,
  suit: CardSuit.None,
  rank: 1,
  description: '其他角色计算与你的距离时+1',
  tags: [CardTag.DefensiveHorse, CardTag.Equip],
  effectIds: ['defensiveHorse'],
  equipSlot: EquipSlot.DefensiveHorse,
  isDelayed: false,
  canBeCanceled: false,
}

/**
 * -1马 — 进攻马，你计算与其他角色的距离时-1。
 */
export const MinusOneHorse: CardDefinition = {
  id: 'minusOneHorse',
  name: '-1马',
  type: CardType.Equip,
  suit: CardSuit.None,
  rank: 1,
  description: '你计算与其他角色的距离时-1',
  tags: [CardTag.OffensiveHorse, CardTag.Equip],
  effectIds: ['offensiveHorse'],
  equipSlot: EquipSlot.OffensiveHorse,
  isDelayed: false,
  canBeCanceled: false,
}

// ── 汇总导出 ──

/**
 * 全部武器牌定义
 */
export const weaponCards: CardDefinition[] = [
  ZhuGeLianNu,
  QingGangJian,
  CiXiongShuangGuJian,
  ZhangBaSheMao,
  GuanShiFu,
]

/**
 * 全部防具牌定义
 */
export const armorCards: CardDefinition[] = [BaGuaZhen, RenWangDun, TengJia]

/**
 * 全部坐骑牌定义
 */
export const horseCards: CardDefinition[] = [PlusOneHorse, MinusOneHorse]

/**
 * 全部装备牌定义
 */
export const equipCards: CardDefinition[] = [
  ...weaponCards,
  ...armorCards,
  ...horseCards,
]
