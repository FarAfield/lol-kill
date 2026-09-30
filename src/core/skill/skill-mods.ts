// ============================================================
// 联盟杀 · 技能 Mod 装载
//
// `ISkill.mod` 的类型与 `IModDefinition.mods` **完全相同**
// （都是 `INumericMods & IBooleanMods`），因此可以零转换地交给
// `ModRegistry` 注册——这正是 Phase 13 验收项里那条「类型一致」的兑现：
// 一致不是靠一行断言保住，而是靠「它们本来就是同一个类型」。
//
// ── 为什么不按持有者临时注册 ──
// Mod 必须**永远在表里**，只是持有者随局面变化。
// 若按「谁此刻拥有就去注册」的思路，卸装备 / 死亡 / 失去技能
// 都要记得反注册，漏一处就是幽灵数值。`owners` 每次现算，
// 于是「失效」这件事务落成零行代码——这是 `ModRegistry` 的核心设计。
// ============================================================

import type { IModDefinition, IModRegistry } from '@core/contracts/mod.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import { skillPriority } from './skill-utils'

/**
 * 某技能的当前持有者
 *
 * 由引擎注入，实际就是 `SkillRegistry.ownersOf`——「谁拥有哪些技能」
 * 这笔账只有一份，这里不另起一份。
 */
export type SkillOwnersResolver = (skillId: string) => IPlayer[]

/** 技能 Mod 在注册表里的 ID 前缀，避免与装备 Mod 撞号 */
const ID_PREFIX = 'skill:'

/**
 * 把一批技能的 `mod` 注册进 Mod 注册表
 *
 * 没有 `mod` 的技能会被跳过——一个技能可以同时是纯 Trigger、
 * 纯 Mod，或两者兼有。
 *
 * **这里不展开子技能**：展开发生在 `SkillRegistry.register`
 * （子技能是独立定义，父与子各登记一次）。两处都展开的话，
 * 同一个子技能的 Mod 会被登记两遍，Mod 表里出现两条同 id 的条目。
 *
 * @param registry Mod 注册表
 * @param skills   已展开的技能定义集合
 * @param ownersOf 求某技能的当前持有者（每次查询都会重新调用）
 * @returns 实际装载的 Mod 条数
 */
export function registerSkillMods(
  registry: IModRegistry,
  skills: Iterable<ISkill>,
  ownersOf: SkillOwnersResolver,
): number {
  let count = 0
  for (const skill of skills) {
    if (!skill.mod) continue
    const id = `${ID_PREFIX}${skill.id}`
    registry.register(toModDefinition(id, skill, ownersOf))
    count++
  }
  return count
}

/**
 * 把一条技能翻译成 Mod 定义
 *
 * `owners` 直接调用上层闭包进来的解析器：「谁拥有哪些技能」这笔账归引擎管，
 * 这里只负责把「技能 id」翻译成「此刻哪些人拥有它」。
 */
function toModDefinition(
  id: string,
  skill: ISkill,
  ownersOf: SkillOwnersResolver,
): IModDefinition {
  return {
    id,
    mods: skill.mod!,
    priority: skillPriority(skill),
    owners: (ctx) => {
      const owners = ownersOf(skill.id)
      return owners.filter((owner) => ctx.game.players.includes(owner))
    },
  }
}
