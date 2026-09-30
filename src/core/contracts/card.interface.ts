import type { CardType, CardSuit, CardRank, ZoneType, EquipSlot } from './enums'
import type { CardTagValue } from './card-tag'
import type { IPlayer } from './player.interface'

export interface CardDefinition {
  /** 卡牌唯一标识 */
  id: string
  name: string
  type: CardType
  suit: CardSuit
  rank: CardRank
  description: string
  /** 标签数组（便于 JSON 序列化，运行时由工厂方法转为 Set） */
  tags: CardTagValue[]
  effectIds: string[]
  equipSlot?: EquipSlot
  attackRange?: number
  isDelayed: boolean
  canBeCanceled: boolean
}

export interface ICard {
  /** -------基础属性-------- */
  /** 卡牌实例唯一标识 */
  instanceId: string
  /** 卡牌唯一标识 */
  id: string
  /** 卡牌名称 */
  name: string
  /** 卡牌大类 */
  type: CardType
  /** 花色 */
  suit: CardSuit
  /** 点数 (1–13) */
  rank: CardRank
  /** 描述文本 */
  description: string
  /** 标签集合 */
  tags: Set<CardTagValue>
  /** 关联的技能 ID 列表（引用全局 SkillRegistry） */
  effectIds: string[]
  /** 装备槽位（仅装备牌） */
  equipSlot?: EquipSlot
  /** 攻击范围加成（仅武器装备牌） */
  attackRange?: number
  /** 是否为延时生效（进入判定区而非立即结算） */
  isDelayed: boolean
  /** 能否被抵消 */
  canBeCanceled: boolean
  /** -------运行时状态-------- */
  /** 当前所属玩家 */
  owner?: IPlayer
  /** 当前所在区域 */
  zone: ZoneType
  /** 可见性 */
  visibleTo: IPlayer[]
  /** 是否被虚拟化（viewAs 产生的临时视图） */
  virtual: boolean
  /** 牌面是否是朝下状态 */
  isFaceDown: boolean
  /**
   * 虚拟牌的底牌实例 id —— 仅 `viewAs` 造出来的虚拟牌有值
   *
   * 虚拟牌**没有物理实体**：它不属于任何区域，真正流转的是这里指向的
   * 底牌。有了这个字段，任何拿到一张虚拟牌的地方都能反查出
   * 「它消耗了哪些真实卡牌」——于是「打出虚拟闪」自动等价于
   * 「把它消耗的那张杀送进弃牌堆」，调用方不用知道这件事的存在。
   */
  viewedFrom?: string[]
}
