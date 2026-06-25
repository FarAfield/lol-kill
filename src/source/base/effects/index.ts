// ============================================================
// 联盟杀 · 效果定义统一导出
// ============================================================

export {
  shaEffect,
  shanEffect,
  taoEffect,
  jiuEffect,
  basicEffects,
} from './basic-effects'

export {
  guoHeChaiQiaoEffect,
  shunShouQianYangEffect,
  wuZhongShengYouEffect,
  nanManRuQinEffect,
  wanJianQiFaEffect,
  jueDouEffect,
  wuXieKeJiEffect,
  wuGuFengDengEffect,
  taoYuanJieYiEffect,
  jieDaoShaRenEffect,
  trickEffects,
} from './trick-effects'

export {
  zhuGeLianNuEffect,
  qingGangJianEffect,
  ciXiongShuangGuJianEffect,
  zhangBaSheMaoEffect,
  guanShiFuEffect,
  baGuaZhenEffect,
  renWangDunEffect,
  defensiveHorseEffect,
  offensiveHorseEffect,
  equipEffects,
} from './equip-effects'

import { basicEffects } from './basic-effects'
import { trickEffects } from './trick-effects'
import { equipEffects } from './equip-effects'
import type { IEffect } from '@core/contracts/effect.interface'

/**
 * 所有卡牌效果的汇总数组。
 * 在游戏启动时批量注册到 EffectRegistry。
 */
export const allCardEffects: IEffect[] = [
  ...basicEffects,
  ...trickEffects,
  ...equipEffects,
]
