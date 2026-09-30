// ============================================================
// 联盟杀 · Skill 层统一导出
//
// Phase 11 起，「数值怎么算」不再散落在各个 if 里，而是集中在 ModRegistry。
// Phase 13–17 的技能体系（ISkill 契约、SkillRegistry 挂载卸载、
// 属性矩阵、viewAs）也落在这个目录下。
// ============================================================

export { ModRegistry, ModPurityError } from './mod-registry'
export { ModQuery, BASE_ATTACK_RANGE, defaultCardUsable } from './mod-query'
export { SkillRegistry } from './skill-registry'
export { registerSkillMods } from './skill-mods'
export { ViewAsService, viewLike, viewsToCards, combinationsOf } from './view-as'
export type { ViewAsDeps } from './view-as'
