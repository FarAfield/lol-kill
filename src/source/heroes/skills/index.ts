// ============================================================
// 联盟杀 · 英雄技能统一导出
//
// 按势力组织：
//   weiSkills  — Demacia（魏）：曹操、司马懿、夏侯惇、张辽
//   shuSkills  — Noxus（蜀）：刘备、关羽、张飞、赵云
//   wuSkills   — Ionia（吴）：孙权、吕蒙
//
// Phase 13 起全部是 `ISkill`，登记进 SkillRegistry 后
// 由它按英雄 / 装备的持有关系挂到具体玩家身上。
// ============================================================

export {
  jianxiong,
  hujia,
  fankui,
  guicai,
  ganglie,
  tuxi,
  weiSkills,
} from './wei-skills'

export { rende, wusheng, paoxiao, longdan, shuSkills } from './shu-skills'

export { zhiheng, keji, wuSkills } from './wu-skills'

import { weiSkills } from './wei-skills'
import { shuSkills } from './shu-skills'
import { wuSkills } from './wu-skills'
import type { ISkill } from '@core/contracts/skill.interface'

/**
 * 所有英雄技能的汇总数组。
 * 在游戏启动时批量登记进 SkillRegistry。
 */
export const allHeroSkills: ISkill[] = [...weiSkills, ...shuSkills, ...wuSkills]
