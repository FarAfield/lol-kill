// ============================================================
// 联盟杀 · 事件内容统一导出
//
// 键是**事件名**。卡牌用牌时以卡牌 id 作为事件名触发子事件，
// 所以下面绝大多数键就是卡牌 id：
//   sha / shan / tao / jiu / guoHeChaiQiao / shanDian ...
//
// 新增一张牌 = 在这里加一个条目，引擎零改动。
// ============================================================

import type { ContentEntry } from '@core/event/content-registry'

import { useCardContent } from './use-card-content'
import {
  shaContent,
  shanContent,
  taoContent,
  jiuContent,
} from './basic-contents'
import {
  guoHeChaiQiaoContent,
  shunShouQianYangContent,
  wuZhongShengYouContent,
  nanManRuQinContent,
  wanJianQiFaContent,
  jueDouContent,
  wuXieKeJiContent,
  wuGuFengDengContent,
  taoYuanJieYiContent,
  jieDaoShaRenContent,
} from './trick-contents'
import {
  leBuSiShuContent,
  bingLiangCunDuanContent,
  shanDianContent,
} from './delayed-contents'
import { equipContent } from './equip-contents'
import { dyingContent, dieContent } from './dying-content'
import { damageContent } from './damage-content'
import { counterWindowContent } from './counter-window'

/** 本包全部事件内容 */
export const allCardContents: ContentEntry[] = [
  // 用牌总入口
  ['useCard', useCardContent],

  // 基本牌
  ['sha', shaContent],
  ['shan', shanContent],
  ['tao', taoContent],
  ['jiu', jiuContent],

  // 锦囊
  ['guoHeChaiQiao', guoHeChaiQiaoContent],
  ['shunShouQianYang', shunShouQianYangContent],
  ['wuZhongShengYou', wuZhongShengYouContent],
  ['nanManRuQin', nanManRuQinContent],
  ['wanJianQiFa', wanJianQiFaContent],
  ['jueDou', jueDouContent],
  ['wuXieKeJi', wuXieKeJiContent],
  ['wuGuFengDeng', wuGuFengDengContent],
  ['taoYuanJieYi', taoYuanJieYiContent],
  ['jieDaoShaRen', jieDaoShaRenContent],

  // 延时锦囊（判定阶段触发）
  ['leBuSiShu', leBuSiShuContent],
  ['bingLiangCunDuan', bingLiangCunDuanContent],
  ['shanDian', shanDianContent],

  // 装备
  ['equip', equipContent],

  // 流程类
  ['dying', dyingContent],
  ['die', dieContent],
  ['damage', damageContent],
  ['counterWindow', counterWindowContent],
]

export { useCardContent } from './use-card-content'
export {
  shaContent,
  shanContent,
  taoContent,
  jiuContent,
} from './basic-contents'
export {
  guoHeChaiQiaoContent,
  shunShouQianYangContent,
  wuZhongShengYouContent,
  nanManRuQinContent,
  wanJianQiFaContent,
  jueDouContent,
  wuXieKeJiContent,
  wuGuFengDengContent,
  taoYuanJieYiContent,
  jieDaoShaRenContent,
} from './trick-contents'
export {
  leBuSiShuContent,
  bingLiangCunDuanContent,
  shanDianContent,
} from './delayed-contents'
export { equipContent } from './equip-contents'
export { dyingContent, dieContent } from './dying-content'
export { damageContent, DAMAGE_STEPS, DAMAGE_SOURCE_EVENT } from './damage-content'
export { counterWindowContent } from './counter-window'
