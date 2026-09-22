import { ZoneType, CardType, CardSuit, CardRank, EquipSlot } from '@core/contracts/enums'
import { IdGenerator } from '@core/utils'
import type { ICard, CardDefinition } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'

export class Card implements ICard {
  readonly instanceId: string
  readonly id: string
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
  /** -------运行时状态-------- */
  owner?: IPlayer
  zone: ZoneType
  visibleTo: IPlayer[]
  virtual: boolean
  isFaceDown: boolean

  /** 全局共享 ID 生成器（所有 Card 实例共用，保证 ID 递增不重复） */
  private static _idGenerator = new IdGenerator()

  // 构造函数
  private constructor(data: {
    id: string
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
    isFaceDown: boolean
  }) {
    this.instanceId = Card._idGenerator.next(data.id)
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
    this.isFaceDown = data.isFaceDown
  }

  /**
   * 工厂方法
   * 从 CardDefinition 创建 Card 实例。
   */
  static create(def: CardDefinition): Card {
    return new Card({
      id: def.id,
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
      isFaceDown: false,
    })
  }

  /**
   * 创建一个已指定 zone 的 Card 实例。
   * 用于 source/ 数据中需要指定初始区域的场景（如装备区已有卡牌）。
   * @param def  卡牌定义
   * @param zone 初始区域
   */
  static createInZone(def: CardDefinition, zone: ZoneType): Card {
    const card = Card.create(def)
    card.zone = zone
    return card
  }

  /**
   * 将卡牌移动到指定区域。
   * 同时更新可见性：
   * - Deck / Discard → 清空 visibleTo
   * - Hand → 仅 owner 可见
   * - Equip / Judge → 所有玩家可见
   * - Processing → 所有玩家可见
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
   * @param zone   目标区域
   * @param player 新的所属玩家
   */
  moveToPlayer(zone: ZoneType, player: IPlayer): void {
    this.owner = player
    this.moveTo(zone)
  }

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
   * 检查卡牌是否为符文牌。
   */
  get isRune(): boolean {
    return this.type === CardType.Rune
  }

  /**
   * 检查卡牌是否为延时符文牌。
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

  /** 重置 ID 生成器（重放 / 测试前调用） */
  static resetIdGenerator(): void {
    Card._idGenerator.reset()
  }

  /**
   * 将卡牌序列化为纯对象（用于日志 / 序列化）。
   */
  toJSON(): Omit<ICard, 'tags'> & { tags: string[] } {
    return {
      instanceId: this.instanceId,
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
      isFaceDown: this.isFaceDown,
    }
  }
}

export type { CardDefinition } from '@core/contracts/card.interface'