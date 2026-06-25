// ============================================================
// 联盟杀 · Card 实体
//
// 统一卡牌实体——不再区分「定义」与「实例」。
// source/ 中的卡牌数据通过 Card.create() 创建实例。
// 牌堆中同一类卡牌有多张独立 Card 实例，每张拥有唯一 id。
// ============================================================

import { ZoneType, CardType, CardSuit } from '@core/contracts/enums'
import type { CardId, CardRank } from '@core/contracts/types'
import type { ICard, CardDefinition } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { EquipSlot } from '@core/contracts/enums'

// Re-export CardDefinition for convenience
export type { CardDefinition } from '@core/contracts/card.interface'

// ── 卡牌实体 ──

export class Card implements ICard {
  // ── 基础属性（创建后只读） ──
  readonly id: CardId
  readonly name: string
  readonly type: CardType
  readonly suit: CardSuit
  readonly rank: CardRank
  readonly description: string
  readonly tags: Set<string>
  readonly effectIds: string[]
  readonly equipSlot?: EquipSlot
  readonly attackRange?: number
  readonly isDelayed: boolean
  readonly canBeCanceled: boolean

  // ── 运行时状态 ──
  owner?: IPlayer
  zone: ZoneType
  visibleTo: IPlayer[]
  virtual: boolean

  // ── 实例计数器 ──
  private static _counter = 0

  private constructor(data: {
    id: CardId
    name: string
    type: CardType
    suit: CardSuit
    rank: CardRank
    description: string
    tags: Set<string>
    effectIds: string[]
    equipSlot?: EquipSlot
    attackRange?: number
    isDelayed: boolean
    canBeCanceled: boolean
    owner?: IPlayer
    zone: ZoneType
    visibleTo: IPlayer[]
    virtual: boolean
  }) {
    this.id = data.id
    this.name = data.name
    this.type = data.type
    this.suit = data.suit
    this.rank = data.rank
    this.description = data.description
    this.tags = data.tags
    this.effectIds = data.effectIds
    this.equipSlot = data.equipSlot
    this.attackRange = data.attackRange
    this.isDelayed = data.isDelayed
    this.canBeCanceled = data.canBeCanceled
    this.owner = data.owner
    this.zone = data.zone
    this.visibleTo = data.visibleTo
    this.virtual = data.virtual
  }

  // ── 工厂方法 ──

  /**
   * 从 CardDefinition 创建 Card 实例。
   *
   * 自动生成唯一实例 ID，并将运行时字段初始化为默认值：
   * - owner = undefined
   * - zone = ZoneType.Deck
   * - visibleTo = []
   * - virtual = false
   *
   * @param def        卡牌定义（来自 source/）
   * @param instanceId 可选的实例 ID，不提供则自动生成
   * @returns 新的 Card 实例
   */
  static create(def: CardDefinition, instanceId?: string): Card {
    const id = instanceId ?? `${def.name}_${Card._counter++}`
    return new Card({
      id,
      name: def.name,
      type: def.type,
      suit: def.suit,
      rank: def.rank,
      description: def.description,
      tags: new Set(def.tags),
      effectIds: [...def.effectIds],
      equipSlot: def.equipSlot,
      attackRange: def.attackRange,
      isDelayed: def.isDelayed,
      canBeCanceled: def.canBeCanceled,
      owner: undefined,
      zone: ZoneType.Deck,
      visibleTo: [],
      virtual: false,
    })
  }

  /**
   * 创建一个已指定 zone 的 Card 实例。
   *
   * 用于 source/ 数据中需要指定初始区域的场景（如装备区已有卡牌）。
   *
   * @param def  卡牌定义
   * @param zone 初始区域
   * @param instanceId 可选的实例 ID
   */
  static createInZone(def: CardDefinition, zone: ZoneType, instanceId?: string): Card {
    const card = Card.create(def, instanceId)
    card.zone = zone
    return card
  }

  // ── 区域操作 ──

  /**
   * 将卡牌移动到指定区域。
   *
   * 同时更新可见性：
   * - Deck / Discard → 清空 visibleTo
   * - Hand → 仅 owner 可见
   * - Equip / Judge → 所有玩家可见
   * - Processing → 所有玩家可见
   *
   * @param zone 目标区域
   */
  moveTo(zone: ZoneType): void {
    this.zone = zone

    switch (zone) {
      case ZoneType.Deck:
      case ZoneType.Discard:
        this.visibleTo = []
        break
      case ZoneType.Hand:
        this.visibleTo = this.owner ? [this.owner] : []
        break
      case ZoneType.Equip:
      case ZoneType.Judge:
      case ZoneType.Processing:
        // 可见性由外部玩家列表决定，此处不清空
        break
    }
  }

  /**
   * 将卡牌移动到指定区域并更新所属玩家。
   *
   * @param zone   目标区域
   * @param player 新的所属玩家
   */
  moveToPlayer(zone: ZoneType, player: IPlayer): void {
    this.owner = player
    this.moveTo(zone)
  }

  // ── 查询 ──

  /**
   * 检查卡牌是否拥有指定标签。
   */
  hasTag(tag: string): boolean {
    return this.tags.has(tag)
  }

  /**
   * 检查卡牌是否为装备牌。
   */
  get isEquip(): boolean {
    return this.type === CardType.Equip
  }

  /**
   * 检查卡牌是否为基本牌。
   */
  get isBasic(): boolean {
    return this.type === CardType.Basic
  }

  /**
   * 检查卡牌是否为符文（锦囊）牌。
   */
  get isRune(): boolean {
    return this.type === CardType.Rune
  }

  /**
   * 检查卡牌是否为延时锦囊。
   */
  get isDelayedRune(): boolean {
    return this.type === CardType.Rune && this.isDelayed
  }

  /**
   * 检查卡牌是否对指定玩家可见。
   */
  isVisibleTo(player: IPlayer): boolean {
    return this.visibleTo.includes(player)
  }

  /**
   * 将卡牌设为对指定玩家或所有玩家可见。
   */
  revealTo(players: IPlayer[]): void {
    this.visibleTo = players
  }

  /**
   * 重置实例计数器（主要用于测试）。
   */
  static resetCounter(): void {
    Card._counter = 0
  }

  /**
   * 将卡牌序列化为纯对象（用于日志 / 序列化）。
   */
  toJSON(): Omit<ICard, 'tags'> & { tags: string[] } {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      suit: this.suit,
      rank: this.rank,
      description: this.description,
      tags: [...this.tags],
      effectIds: this.effectIds,
      equipSlot: this.equipSlot,
      attackRange: this.attackRange,
      isDelayed: this.isDelayed,
      canBeCanceled: this.canBeCanceled,
      owner: this.owner,
      zone: this.zone,
      visibleTo: this.visibleTo,
      virtual: this.virtual,
    }
  }
}
