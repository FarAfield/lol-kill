// ============================================================
// 联盟杀 · 英雄接口
//
// 不区分「定义」和「实体」——英雄只有一个统一的 IHero。
// source/ 导入的英雄数据直接创建为 IHero 对象。
// 页面渲染只读基础字段，游戏逻辑在运行时挂载额外数据。
// ============================================================

import type { HeroId } from './types'
import type { Kingdom } from './enums'

export interface IHero {
  /** 英雄唯一标识 */
  id: HeroId
  /** 英雄名称 */
  name: string
  /** 称号 */
  title: string
  /** 所属势力 */
  kingdom: Kingdom
  /** 体力上限 */
  maxHp: number
  /** 能量上限 */
  maxPower: number
  /** 效果 ID 列表（引用全局 EffectRegistry） */
  effectIds: string[]
}
