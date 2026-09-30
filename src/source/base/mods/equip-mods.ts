// ============================================================
// 联盟杀 · 装备 Mod（Phase 11）
//
// 「装备带来什么」分两类：
//
// | 类型 | 例子 | 在哪实现 |
// |------|------|---------|
// | **通用数值修正** | 任何武器的攻击范围、任何藤甲的火焰易伤 | 本文件（Mod） |
// | **单张牌的数值修正** | 连弩的无限杀、±1 马的距离 | `effects/equip-effects.ts` 的 `mod` |
// | **时机反应** | 八卦阵判定、贯石斧弃牌强命、雌雄双股剑二选一 | `effects/equip-effects.ts`（Trigger） |
//
// 区分标准：**是不是「任何带这个特征的东西都会」**？
// 是 → 本文件；只属于某一张具体的牌 → 写在那张牌自己的技能上。
// 两处都写会重复计入（一次查询命中两条），这是最容易埋的坑。
//
// `owners` 每次现算持有者，因此：
// - 装备被拆掉 → 下次查询自然不再命中
// - 玩家死亡 → `ModRegistry` 过滤掉不存活者
// 两种情形都不需要一行清理代码。
// ============================================================

import { DamageType, EquipSlot, ZoneType } from '@core/contracts/enums'
import type { IModDefinition } from '@core/contracts/mod.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { CardTag } from '@core/contracts/card-tag'

/** 取某人某槽位上的装备（必须是真的在装备区，不在手牌/处理区） */
function equippedIn(player: IPlayer, slot: EquipSlot): ICard | undefined {
  return player.equipCards.find(
    (card) => card.equipSlot === slot && card.zone === ZoneType.Equip,
  )
}

/** 从 ModContext 里取持有者（owners 已保证它一定存在） */
function owner(ctx: { owner?: IPlayer }): IPlayer | undefined {
  return ctx.owner
}

// ── 武器：攻击范围 ──

/**
 * 武器 — 攻击范围 = 基础 1 + 武器自身的 attackRange
 *
 * 一张表覆盖所有武器：新增武器只要带 `equipSlot: Weapon` 和 `attackRange`
 * 就自动生效，不用改引擎也不用改这里。
 */
export const weaponRangeMod: IModDefinition = {
  id: 'mod:equip.weaponRange',
  owners: (ctx) =>
    ctx.game.players.filter((p) => p.alive && equippedIn(p, EquipSlot.Weapon)),
  mods: {
    attackRange: (value, ctx) => {
      const weapon = owner(ctx) && equippedIn(owner(ctx)!, EquipSlot.Weapon)
      return value + (weapon?.attackRange ?? 0)
    },
  },
}

// ── 防具：易伤 ──

/**
 * 藤甲 — 火焰伤害 +1，普通伤害不变
 *
 * 这是 `damageTo` 的典型用法：易伤是「我受到伤害时」的事，
 * 因此挂在受伤方名下，而不是来源方。
 */
export const rattanArmorMod: IModDefinition = {
  id: 'mod:equip.rattanArmor',
  owners: (ctx) => ctx.game.players.filter((p) => p.alive && equippedIn(p, EquipSlot.Armor)?.tags.has(CardTag.RattanArmor)),
  mods: {
    damageTo: (value, _ctx, payload) =>
      payload.nature === DamageType.Fire ? value + 1 : value,
  },
}

// ── 汇总 ──

/**
 * 基础包的全部装备 Mod
 *
 * 只收**按槽位 / tag 通用**的那些。±1 马和诸葛连弩的 Mod 在
 * `../effects/equip-effects.ts` 各自的技能上——它们属于具体的某张牌，
 * 跟着卡牌的 `effectIds` 走，由 `registerSkillMods` 一并装载。
 * 两边都写的话，同一次查询会命中两条，距离 +2 而没人知道为什么。
 */
export const equipMods: IModDefinition[] = [weaponRangeMod, rattanArmorMod]

/** 基础包的全部 Mod（将来还会加入全局规则 / 模式规则） */
export const allBaseMods: IModDefinition[] = [...equipMods]
