// ============================================================
// 联盟杀 · 效果装配
//
// 唯一的内容装载点：把 `source/` 下的效果数据交给引擎。
//
// 引擎核心不直接 import `source/` 的具体内容包——它只认 ISkill 数组，
// 由这里决定"这一局加载哪些内容"。将来做扩展包 / 模式专属卡牌时，
// 只需改这一个文件。
// ============================================================

import { allHeroSkills } from '@source/heroes/skills'
import { equipEffects } from '@source/base/effects'
import { allCardContents } from '@source/base/contents'
import { allBaseMods } from '@source/base/mods'
import type { ISkill } from '@core/contracts/skill.interface'
import type { ContentEntry } from '@core/event/content-registry'
import type { IModDefinition } from '@core/contracts/mod.interface'

/**
 * 收集全部效果定义（英雄技能 + 装备被动）。
 *
 * 卡牌的**使用效果不再是 Effect**——它们是事件内容，见 `collectContents()`。
 * 这里只收「某人在某个时机额外做的事」，即真正的技能。
 *
 * 返回的是**定义**，不含任何玩家绑定信息；
 * 绑定到具体玩家由 `SkillRegistry` 在英雄分配后完成。
 */
export function collectEffects(): ISkill[] {
  return [...allHeroSkills, ...equipEffects]
}

/**
 * 收集全部事件内容（卡牌行为）。
 *
 * 键是事件名；卡牌用牌时以**卡牌 id** 作为事件名触发子事件，
 * 因此一张新卡牌 = 加一个内容条目，引擎零改动。
 */
export function collectContents(): ContentEntry[] {
  return [...allCardContents]
}

/**
 * 收集全部数值 / 布尔修改器。
 *
 * 与技能分开：Mod 是**纯函数**（不可 await、不可改状态、不可被无懈），
 * 回答「这个数字是多少」；技能回答「某个时机额外做什么」。
 * 混在一起的话，一次简单的距离查询也会变成一次能改变局面的结算。
 */
export function collectMods(): IModDefinition[] {
  return [...allBaseMods]
}
