// ============================================================
// 联盟杀 · 卡牌接口
//
// 不再区分「定义」和「实体」——卡牌只有一个统一的 ICard。
// - source/ 导入的卡牌数据直接创建为 ICard（运行时字段为默认值）
// - 牌堆中同一类卡牌有多张独立 ICard 实例
// - 页面渲染只读基础字段，游戏逻辑读写运行时字段
// - 卡牌效果通过 effectIds 引用全局 EffectRegistry
// ============================================================

import type { CardType, CardSuit, ZoneType, EquipSlot, GamePhase } from './enums'
import type { CardId, CardRank } from './types'
import type { IPlayer } from './player.interface'

/**
 * 卡牌定义——描述一类卡牌的静态属性（不可变模板）。
 *
 * source/ 中的数据以此格式导出。引擎通过 Card.create(definition)
 * 创建带有唯一实例 ID 和默认运行时状态的可玩 ICard 实例。
 *
 * 与 ICard 的区别：
 * - 不含 id（实例 ID 由工厂方法生成）
 * - 不含运行时字段（owner, zone, visibleTo, virtual）
 * - tags / effectIds 为普通数组（便于 JSON 序列化）
 */
export interface CardDefinition {
  name: string
  type: CardType
  suit: CardSuit
  rank: CardRank
  description: string
  tags: string[]
  effectIds: string[]
  equipSlot?: EquipSlot
  attackRange?: number
  isDelayed: boolean
  canBeCanceled: boolean
}

export interface ICard {
  // ── 基础属性（来自 source/，创建后只读） ──
  /** 卡牌实例唯一标识 */
  id: CardId
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
  /** 标签集合（分类/筛选用） */
  tags: Set<string>
  /** 关联的效果 ID 列表（引用全局 EffectRegistry） */
  effectIds: string[]
  /** 装备槽位（仅装备牌） */
  equipSlot?: EquipSlot
  /** 攻击范围加成（仅武器装备牌） */
  attackRange?: number
  /** 是否为延时生效（进入判定区而非立即结算） */
  isDelayed: boolean
  /** 能否被抵消 */
  canBeCanceled: boolean

  // ── 运行时状态（游戏过程中动态变化） ──
  /** 当前所属玩家 */
  owner?: IPlayer
  /** 当前所在区域 */
  zone: ZoneType
  /** 可见性 */
  visibleTo: IPlayer[]
  /** 是否被虚拟化（viewAs 产生的临时视图） */
  virtual: boolean
}
