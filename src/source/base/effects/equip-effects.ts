// ============================================================
// 联盟杀 · 装备牌触发效果
//
// 首批装备（9张）：
//   武器：诸葛连弩、青釭剑、雌雄双股剑、丈八蛇矛、贯石斧
//   防具：八卦阵、仁王盾
//   坐骑：+1马、-1马
//
// Phase 13 起这里只留**时机反应**（「某件事发生时额外做点什么」）。
// 装备带来的**数值改动**在 `../mods/equip-mods.ts`：攻击范围、距离、
// 出杀次数、火焰易伤——那些是「这个数字是多少」的问题，属于 Mod 层。
// 分界线在这两层之间，不在此文件内部：
// **属于某一张具体装备**的数值（连弩的无限杀、±1 马的距离）写在本文件的
// `mod` 里，跟着卡牌的 `effectIds` 走；**按槽位/tag 通用**的
// （任何武器的攻击范围、任何藤甲的火焰易伤）留在 `../mods/equip-mods.ts`。
// ============================================================

import { EquipSlot, CardSuit, GamePhase } from '@core/contracts/enums'
import type { ISkill, ISkillContext } from '@core/contracts/skill.interface'
import type { ICard } from '@core/contracts/card.interface'
import { CardTag } from '@core/contracts/card-tag'
import { viewLike } from '@core/skill/view-as'
import { Sha } from '@source/cards/basic'

/** 某人是否装备了指定名字的武器 */
function hasWeapon(player: { equipCards: ICard[] }, name: string): boolean {
  return player.equipCards.some((c) => c.equipSlot === EquipSlot.Weapon && c.name === name)
}

/** 某人是否装备了指定名字的防具 */
function hasArmor(player: { equipCards: ICard[] }, name: string): boolean {
  return player.equipCards.some((c) => c.equipSlot === EquipSlot.Armor && c.name === name)
}

/** 事件里那笔伤害账（`_damageInstance`） */
function damageInstance(ctx: ISkillContext):
  | { prevented: boolean; currentAmount?: number }
  | undefined {
  return ctx.event.data['_damageInstance'] as
    | { prevented: boolean; currentAmount?: number }
    | undefined
}

// ────────────────────────────────────────
// 诸葛连弩 — 出牌阶段可出任意张杀
// ────────────────────────────────────────

/**
 * 诸葛连弩 —— 【杀】本回合使用次数无限
 *
 * `cardUsable` 的语义是「这张牌还能用几次」，`Infinity` 即无限。
 * 只对【杀】生效——连弩管的是挥刀的手速，不是念咒的速度。
 *
 * 与 `mods/equip-mods.ts` 的分工：那边的 `weaponRangeMod` / `rattanArmorMod`
 * 按**装备槽位和 tag** -generic 生效（任何武器、任何藤甲），
 * 而这一条只属于「诸葛连弩」这一张牌，因此跟着它的 effectId 走。
 */
export const zhuGeLianNu: ISkill = {
  id: 'zhuGeLianNu',
  name: '诸葛连弩',
  description: '攻击范围1。出牌阶段可以出任意张杀',

  equipSkill: true,
  locked: true,

  mod: {
    cardUsable: (value, _ctx, card) =>
      card.tags.has(CardTag.Strike) ? Infinity : value,
  },
}

// ────────────────────────────────────────
// 青釭剑 — 使用杀时无视目标防具
// ────────────────────────────────────────

export const qingGangJian: ISkill = {
  id: 'qingGangJian',
  name: '青釭剑',
  description: '攻击范围2。使用杀时无视目标防具效果',

  equipSkill: true,
  locked: true,
  trigger: { source: ['useCardBefore'] },

  filter: (ctx) =>
    hasWeapon(ctx.player, '青釭剑') &&
    ctx.triggerCards.some((c) => c.tags.has(CardTag.Strike)),

  content: async (ctx) => {
    const target = ctx.event.targets[0]
    if (target) ctx.setMark(target, 'ignoreArmor', 1)
    ctx.event.data['_ignoreArmor'] = true
  },
}

// ────────────────────────────────────────
// 雌雄双股剑 — 对异性出杀时，目标需弃一张牌，否则你摸一张牌
// ────────────────────────────────────────

export const ciXiongShuangGuJian: ISkill = {
  id: 'ciXiongShuangGuJian',
  name: '雌雄双股剑',
  description: '攻击范围2。对异性出杀时，目标需弃一张牌，否则使用者摸一张牌',

  equipSkill: true,
  trigger: { source: ['useCardPrepare'] },

  filter: (ctx) =>
    hasWeapon(ctx.player, '雌雄双股剑') &&
    ctx.triggerCards.some((c) => c.tags.has(CardTag.Strike)),

  /**
   * 二选一的决定由 UI / AI 事先写进事件数据：
   * `_cixiong_discard` 为真 → 弃指定的牌；否则使用者摸一张。
   */
  content: async (ctx) => {
    const target = ctx.event.targets[0]
    if (!target?.alive) return

    const card = ctx.event.data['_cixiong_card'] as ICard | undefined
    if (ctx.event.data['_cixiong_discard'] === true && card) {
      await ctx.discardCards([card])
      return
    }
    await ctx.drawCards(1)
  },

  ai: { order: 4 },
}

// ────────────────────────────────────────
// 丈八蛇矛 — 可将2张手牌当杀使用
// ────────────────────────────────────────

/**
 * 视作技能 —— 不靠事件触发，它回答的是「哪张牌能当什么」
 *
 * `selectCard: 2` 是它与武圣唯一的结构差别：**两张**手牌换一张杀。
 * 组合的枚举由 `ViewAsService` 做，这里只声明「要两张」。
 */
export const zhangBaSheMao: ISkill = {
  id: 'zhangBaSheMao',
  name: '丈八蛇矛',
  description: '攻击范围3。可将2张手牌当杀使用',

  equipSkill: true,
  enable: [GamePhase.PhaseUse],

  position: ['h'],
  selectCard: 2,
  filterCard: () => true,
  viewAs: () => viewLike(Sha, { name: '杀（丈八蛇矛）' }),
}

// ────────────────────────────────────────
// 贯石斧 — 杀被闪抵消后可弃2张牌强制命中
// ────────────────────────────────────────

export const guanShiFu: ISkill = {
  id: 'guanShiFu',
  name: '贯石斧',
  description: '攻击范围3。杀被闪抵消后可弃2张牌，强制造成伤害',

  equipSkill: true,
  trigger: { source: ['damagePrevent'] },

  filter: (ctx) =>
    hasWeapon(ctx.player, '贯石斧') && damageInstance(ctx)?.prevented === true,

  content: async (ctx) => {
    if (ctx.event.data['_guanshifu_force'] !== true) return

    const cards = (ctx.event.data['_guanshifu_cards'] as ICard[] | undefined) ?? []
    if (cards.length < 2) return

    await ctx.discardCards(cards.slice(0, 2))

    // 付了代价就把这次伤害从「已被防掉」改回「有效」
    const instance = damageInstance(ctx)
    if (instance) instance.prevented = false
  },

  ai: { order: 3 },
}

// ────────────────────────────────────────
// 八卦阵 — 需要出闪时可判定，红色视为出闪
// ────────────────────────────────────────

export const baGuaZhen: ISkill = {
  id: 'baGuaZhen',
  name: '八卦阵',
  description: '需要出闪时可判定，若结果为红色则视为打出了闪',

  equipSkill: true,
  trigger: { target: ['useCardPrevent'] },

  filter: (ctx) => {
    if (!hasArmor(ctx.player, '八卦阵')) return false
    const card = ctx.triggerCards[0]
    if (!card) return false
    return (
      card.tags.has(CardTag.Strike) ||
      card.tags.has(CardTag.Attack) ||
      card.name === '万箭齐发'
    )
  },

  content: async (ctx) => {
    const judgeCard = await ctx.judge(ctx.player)
    // 红桃 / 方块 = 红，视为出了一张闪
    if (judgeCard.suit !== CardSuit.Heart && judgeCard.suit !== CardSuit.Diamond) return

    ctx.setMark(ctx.player, 'baguaSuccess', 1)
    const instance = damageInstance(ctx)
    if (instance) instance.prevented = true
  },

  ai: { order: 8 },
}

// ────────────────────────────────────────
// 仁王盾 — 黑色杀对你无效
// ────────────────────────────────────────

export const renWangDun: ISkill = {
  id: 'renWangDun',
  name: '仁王盾',
  description: '黑色杀对你无效',

  equipSkill: true,
  locked: true,
  priority: 10,
  trigger: { target: ['useCardPrepare'] },

  filter: (ctx) => {
    if (!hasArmor(ctx.player, '仁王盾')) return false
    const card = ctx.triggerCards[0]
    if (!card?.tags.has(CardTag.Strike)) return false
    return card.suit === CardSuit.Spade || card.suit === CardSuit.Club
  },

  content: async (ctx) => {
    ctx.setMark(ctx.player, 'renWangDunBlock', 1)
    ctx.event.data['_renwangdun_blocked'] = true

    const instance = damageInstance(ctx)
    if (instance) instance.prevented = true
  },
}

// ────────────────────────────────────────
// +1马（防御马） — 其他角色计算与你的距离+1
// ────────────────────────────────────────

/**
 * +1马（防御马） —— 其他角色计算与你的距离时 +1
 *
 * 挂在 `distanceTo` 而不是 `distanceFrom`：+1 马改的是**别人看我的距离**，
 * 主语是「我」，所以要按 Mod 层的 `distanceTo` 语义写。写反了不会报错，
 * 只会让你自己出杀变近、别人打你不变远。
 */
export const defensiveHorse: ISkill = {
  id: 'defensiveHorse',
  name: '+1马',
  description: '其他角色计算与你的距离时+1',

  equipSkill: true,
  locked: true,

  mod: { distanceTo: (value) => value + 1 },
}

// ────────────────────────────────────────
// -1马（进攻马） — 你计算与其他角色的距离-1
// ────────────────────────────────────────

/** -1 马改的是**我看别人的距离**，因此挂在 `distanceFrom` */
export const offensiveHorse: ISkill = {
  id: 'offensiveHorse',
  name: '-1马',
  description: '你计算与其他角色的距离时-1',

  equipSkill: true,
  locked: true,

  mod: { distanceFrom: (value) => value - 1 },
}

// ────────────────────────────────────────
// 汇总导出
// ────────────────────────────────────────

export const equipEffects: ISkill[] = [
  zhuGeLianNu,
  qingGangJian,
  ciXiongShuangGuJian,
  zhangBaSheMao,
  guanShiFu,
  baGuaZhen,
  renWangDun,
  defensiveHorse,
  offensiveHorse,
]
