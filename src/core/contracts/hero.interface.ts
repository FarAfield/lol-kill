import type { Kingdom } from './enums'
export interface IHero {
  /** 英雄唯一标识 */
  id: string
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
  /** 皮肤列表：每个元素为 {皮肤名, 皮肤图片路径} */
  skins: Array<{ skinName: string; skinImage: string }>
}
