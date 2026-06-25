// ============================================================
// 联盟杀 · 英雄技能统一导出
//
// 按势力组织：
//   weiSkills  — Demacia（魏）：曹操、司马懿、夏侯惇、张辽
//   shuSkills  — Noxus（蜀）：刘备、关羽、张飞、赵云
//   wuSkills   — Ionia（吴）：孙权、吕蒙
//
// 所有技能均为 IEffect 对象，通过 EffectRegistry 全局管理。
// ============================================================

export {
  jianxiongEffect,
  hujiaEffect,
  fankuiEffect,
  guicaiEffect,
  ganglieEffect,
  tuxiEffect,
  weiSkills,
} from './wei-skills'

export {
  rendeEffect,
  wushengEffect,
  paoxiaoEffect,
  longdanEffect,
  shuSkills,
} from './shu-skills'

export {
  zhihengEffect,
  kejiEffect,
  wuSkills,
} from './wu-skills'

import { weiSkills } from './wei-skills'
import { shuSkills } from './shu-skills'
import { wuSkills } from './wu-skills'
import type { IEffect } from '@core/contracts/effect.interface'

/**
 * 所有英雄技能的汇总数组。
 * 在游戏启动时批量注册到 EffectRegistry。
 */
export const allHeroSkills: IEffect[] = [
  ...weiSkills,
  ...shuSkills,
  ...wuSkills,
]
