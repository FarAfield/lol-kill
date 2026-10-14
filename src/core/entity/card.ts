import { ZoneType, CardType, CardSuit, CardRank, EquipSlot } from '@core/contracts/enums'
import { IdGenerator } from '@core/utils'
import type { ICard, CardDefinition } from '@core/contracts/card.interface'
import type { CardTagValue } from '@core/contracts/card-tag'
import type { IPlayer } from '@core/contracts/player.interface'

/** 卡牌定义：由 `source/cards/*` 提供，工厂方法 `Card.create()` 消费 */
export type { CardDefinition }

export class Card implements ICard {
  readonly instanceId: string
  readonly id: string
  readonly name: string
  readonly type: CardType
  readonly suit: CardSuit
  readonly rank: CardRank
  readonly description: string
  readonly tags: Set<CardTagValue>
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
  /** 虚拟牌消耗的底牌实例 id（虚拟牌专用） */
  viewedFrom?: string[]

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
    tags: Set<CardTagValue>
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
    viewedFrom?: string[]
    /** 显式指定实例 id（虚拟牌专用：它的身份是可推导的，见 `createVirtual`） */
    instanceId?: string
  }) {
    this.instanceId = data.instanceId ?? Card._idGenerator.next(data.id)
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
    this.viewedFrom = data.viewedFrom
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
   * 由一条 `viewAs` 技能造出一张**虚拟牌**
   *
   * 虚拟牌是一张**不属于任何区域**的临时视图：它有新的 `instanceId`
   * （所以能和别的牌区分开），但没有物理实体——真正被使用与弃置的，
   * 是 `baseCards` 里那几张真牌。
   *
   * 之所以不直接改造底牌：把一张红色牌「暂时变成杀」就得在事后还原，
   * 而中途任何一次提前返回 / 抛错都会把它永久染成杀。造一个独立视图，
   * 底牌从头到尾没有被改写过。
   *
   * ── 虚拟牌的 `instanceId` 是**推导出来的**，不是发号发出来的 ──
   * 一条视作由「哪条技能 + 哪几张底牌」唯一决定（`skillId` + 底牌
   * instanceId），因此它的身份可以现算，且**每次算都一样**。
   * 交给自增发号器的话，出牌阶段每刷新一次候选列表，同一条视作就
   * 换一个 id——UI 的选中项、测试里编排好的应答、日志里那一行
   * 全都对不上号。
   *
   * @param base     模板：未被覆盖的字段全部继承它
   * @param overrides `viewAs` 的返回值（名字 / tags / id …）
   * @param baseCards 这张视图消耗的底牌（默认只有 `base`）
   * @param skillId  产生它的技能（参与推导实例 id）
   */
  static createVirtual(
    base: ICard,
    overrides: Partial<ICard>,
    baseCards: readonly ICard[] = [base],
    skillId = 'viewAs',
  ): Card {
    const bases = baseCards.length > 0 ? baseCards : [base]

    return new Card({
      instanceId: `virtual:${skillId}:${bases.map((card) => card.instanceId).join('+')}`,
      id: overrides.id ?? base.id,
      name: overrides.name ?? base.name,
      type: overrides.type ?? base.type,
      suit: overrides.suit ?? base.suit,
      rank: overrides.rank ?? base.rank,
      description: overrides.description ?? base.description,
      tags: overrides.tags ?? new Set(base.tags),
      effectIds: overrides.effectIds ?? base.effectIds,
      equipSlot: overrides.equipSlot ?? base.equipSlot,
      attackRange: overrides.attackRange ?? base.attackRange,
      isDelayed: overrides.isDelayed ?? base.isDelayed,
      canBeCanceled: overrides.canBeCanceled ?? base.canBeCanceled,
      owner: overrides.owner ?? base.owner,
      zone: overrides.zone ?? base.zone,
      visibleTo: overrides.visibleTo ?? base.visibleTo,
      isFaceDown: overrides.isFaceDown ?? base.isFaceDown,
      virtual: true,
      viewedFrom: bases.map((card) => card.instanceId),
    })
  }

  // ── 区域 ──
  //
  // **这里没有任何改区域的方法**（Phase 19）。
  //
  // `createInZone` / `moveTo` / `moveToPlayer` 曾经在这儿，是 `CardSystem`
  // 的第二套实现——而且两套的规则并不一致：这里的 `moveTo` 在
  // Equip / Judge / Processing 下不动 `visibleTo`，也完全不碰区域数组，
  // 于是「改了 zone 却没进数组」这种半身不遂能堂而皇之地发生。
  // 生产代码里它们一个调用点都没有（只在测试里被用过），
  // 因此删掉而不是修——留着就是给下一个人留一条绕过系统的近路。
  //
  // 改区域一律走 `CardSystem.moveCard` 及其语义化入口。

  /**
   * 检查卡牌是否拥有指定标签。
   */
  hasTag(tag: CardTagValue): boolean {
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

  //
  // 这里曾经还有一个「把这张牌设为对某些人可见」的方法（欠账 D28），
  // 它是实体上的**第二个写入点**，而且零调用方。
  //
  // 「谁看得见这张牌」这件事的唯一答案在 `CardSystem` 里：牌进入哪个区域
  // 就同步算出可见集合（手牌只给持有者、装备与判定区给所有人、牌堆谁都不给）。
  // 实体上再留一个入口，就等于允许有人改了可见性而区域不跟着变——
  // 那正是 `zone` / `owner` / 可见集合必须一起改这条规矩要防的事。

  /**
   * 重置 ID 生成器 —— 每局开局由 `GameEngine.init()` 调用
   *
   * 不归零的话第二局的牌会接着上一局的尾巴编号，于是同一颗种子
   * 也复现不出同一局：局面完全一样，可每张牌的 instanceId 都不一样，
   * 回放比对在第一张牌上就会全线飘红。
   */
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
      viewedFrom: this.viewedFrom,
    }
  }
}
