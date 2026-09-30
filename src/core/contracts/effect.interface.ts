// ============================================================
// 联盟杀 · 旧「效果（Effect）」别名 —— 已废弃
//
// Phase 13 里所有技能（英雄 + 装备）已按 `ISkill` 重写完毕，
// 本文件不再定义任何结构，只把旧名字映射到新名字上，
// 让「还没改完的引用」能继续编译。
//
// 为什么留着名字而不是直接删：外部配置和文档里仍在写 `IEffect`，
// 一步删干净会让编译错误指向 `contracts/skill.interface.ts`，
// 而那里一行都没错——错误信息毫无价值。留个别名，
// 报错才至少还带着 `@deprecated` 这条线索。
//
// 本文件预计在下一个大版本删除。新代码请写 `ISkill`。
// ============================================================

import type {
  ISkill,
  ISkillContext,
  ISkillTriggerCondition,
  ResponseRequest,
  EffectResponse,
} from './skill.interface'

export type {
  ResponseRequest,
  EffectResponse,
  ISkillContext,
  ISkillTriggerCondition,
}

/**
 * @deprecated 已迁移至 `ISkill`
 *
 * 迁移对照：
 *
 * | 旧 | 新 |
 * |----|----|
 * | `type: SkillType.Locked` | `locked: true` |
 * | `type: SkillType.Limited` | `limited: true` |
 * | `type: SkillType.Awaken` | `awaken: true` |
 * | `type: SkillType.Active` | 不写分类位，改在 `enable` 里声明场合 |
 * | `frequency: Frequency.OncePerTurn` | `frequency: 'oncePerTurn'` |
 * | `selectTarget(ctx) => {...}` | `selectTarget`（数值 Mod）+ `selectCard`（数量） |
 * | `selectCard(ctx) => {...}` | `position` + `selectCard` + `filterCard` |
 * | `viewAsFilter(card, ctx)` | `filterCard(card, ctx)` |
 * | `aiValue / aiCard / aiTarget` | `ai.result.player` / `ai.result.target` |
 * | `isAvailable(ctx)` | `filter(ctx)` |
 */
export type IEffect = ISkill

/** @deprecated 已迁移至 `ISkillContext` */
export type IEffectContext = ISkillContext

/** @deprecated 已迁移至 `ISkillTriggerCondition` */
export type ITriggerCondition = ISkillTriggerCondition
