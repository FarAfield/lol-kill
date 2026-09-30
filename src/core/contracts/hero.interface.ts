import type { HeroId } from './types'
import type { Kingdom } from './enums'

/** 皮肤资源 */
export interface HeroSkin {
  /** 皮肤名 */
  name: string
  /** 皮肤图片路径 */
  image: string
}

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
  /** 能量上限（缺省为 0） */
  maxPower?: number
  /** 效果 ID 列表（引用全局 SkillRegistry） */
  effectIds: string[]
  /** 皮肤列表（缺省为空） */
  skins?: HeroSkin[]
}
