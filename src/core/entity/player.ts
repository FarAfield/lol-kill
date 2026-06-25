// ============================================================
// 联盟杀 · Player 实体
//
// 统一 IPlayer —— 不拆分 IPlayerState。
// 所有玩家数据由引擎维护，通过 IStoreService 同步到 UI 层。
// ============================================================

import { GamePhase, RoleType, EquipSlot } from '@core/contracts/enums'
import type { PlayerId, Position } from '@core/contracts/types'
import type { IPlayer } from '@core/contracts/player.interface'
import type { IHero } from '@core/contracts/hero.interface'
import type { ICard } from '@core/contracts/card.interface'

// ── 玩家实体 ──

export class Player implements IPlayer {
  // ── 基础身份 ──
  readonly id: PlayerId
  readonly seatIndex: Position
  role?: RoleType
  roleRevealed: boolean
  alive: boolean

  // ── 英雄 / 体力 / 能量 ──
  hp: number
  maxHp: number
  power: number
  maxPower: number
  heroes: IHero[]

  // ── 卡牌区 ──
  handCards: ICard[]
  equipCards: ICard[]
  judgeCards: ICard[]

  // ── 回合追踪 ──
  usedAttackThisTurn: boolean
  attackLimit: number
  shouldSkipPhases: GamePhase[]
  skippedPhases: GamePhase[]

  // ── 通用标记 ──
  marks: Map<string, number>

  constructor(data: {
    id: PlayerId
    seatIndex: Position
    role?: RoleType
    roleRevealed?: boolean
    alive?: boolean
    hp?: number
    maxHp?: number
    power?: number
    maxPower?: number
    heroes?: IHero[]
    handCards?: ICard[]
    equipCards?: ICard[]
    judgeCards?: ICard[]
    usedAttackThisTurn?: boolean
    attackLimit?: number
    shouldSkipPhases?: GamePhase[]
    skippedPhases?: GamePhase[]
    marks?: Map<string, number>
  }) {
    this.id = data.id
    this.seatIndex = data.seatIndex
    this.role = data.role
    this.roleRevealed = data.roleRevealed ?? false
    this.alive = data.alive ?? true
    this.hp = data.hp ?? (data.heroes?.[0]?.maxHp ?? 4)
    this.maxHp = data.maxHp ?? (data.heroes?.[0]?.maxHp ?? 4)
    this.power = data.power ?? (data.heroes?.[0]?.maxPower ?? 0)
    this.maxPower = data.maxPower ?? (data.heroes?.[0]?.maxPower ?? 0)
    this.heroes = data.heroes ?? []
    this.handCards = data.handCards ?? []
    this.equipCards = data.equipCards ?? []
    this.judgeCards = data.judgeCards ?? []
    this.usedAttackThisTurn = data.usedAttackThisTurn ?? false
    this.attackLimit = data.attackLimit ?? 1
    this.shouldSkipPhases = data.shouldSkipPhases ?? []
    this.skippedPhases = data.skippedPhases ?? []
    this.marks = data.marks ?? new Map()
  }

  // ── 工厂方法 ──

  /**
   * 创建一个新的 Player 实例。
   *
   * @param id        玩家唯一 ID
   * @param seatIndex 座位号
   * @param hero      英雄
   * @param overrides 可选覆盖项
   */
  static create(
    id: PlayerId,
    seatIndex: Position,
    hero?: IHero,
    overrides?: Partial<Omit<IPlayer, 'id' | 'seatIndex' | 'heroes'>>,
  ): Player {
    return new Player({
      id,
      seatIndex,
      heroes: hero ? [hero] : [],
      hp: hero?.maxHp ?? 4,
      maxHp: hero?.maxHp ?? 4,
      power: hero?.maxPower ?? 0,
      maxPower: hero?.maxPower ?? 0,
      ...overrides,
    })
  }

  // ── 体力操作 ──

  /**
   * 扣减体力。
   *
   * HP 不会降到 0 以下（死亡由 DeathSystem 统一处理）。
   *
   * @param amount 扣减量
   * @returns 实际扣减值
   */
  loseHp(amount: number): number {
    const previous = this.hp
    this.hp = Math.max(0, this.hp - amount)
    return previous - this.hp
  }

  /**
   * 回复体力。
   *
   * HP 不会超过 maxHp。
   *
   * @param amount 回复量
   * @returns 实际回复值
   */
  recoverHp(amount: number): number {
    const previous = this.hp
    this.hp = Math.min(this.maxHp, this.hp + amount)
    return this.hp - previous
  }

  /**
   * 设置体力上限。
   *
   * @param delta 变化量（正数为增加，负数为减少）
   */
  modifyMaxHp(delta: number): void {
    this.maxHp = Math.max(0, this.maxHp + delta)
    // 当前体力不能超过新的上限
    if (this.hp > this.maxHp) {
      this.hp = this.maxHp
    }
  }

  // ── 能量操作 ──

  /**
   * 消耗能量。
   */
  consumePower(amount: number): number {
    const previous = this.power
    this.power = Math.max(0, this.power - amount)
    return previous - this.power
  }

  /**
   * 获得能量。
   */
  gainPower(amount: number): void {
    this.power = Math.min(this.maxPower, this.power + amount)
  }

  // ── 查询 ──

  /**
   * 当前手牌数量。
   */
  get handSize(): number {
    return this.handCards.length
  }

  /**
   * 是否受伤（hp < maxHp）。
   */
  get isWounded(): boolean {
    return this.hp < this.maxHp
  }

  /**
   * 是否处于濒死状态（hp <= 0）。
   */
  get isDying(): boolean {
    return this.alive && this.hp <= 0
  }

  /**
   * 当前攻击范围。
   *
   * 基础攻击范围 = 1，加上武器提供的 attackRange。
   */
  get attackRange(): number {
    const weapon = this.getEquipInSlot(EquipSlot.Weapon)
    const baseRange = 1
    const weaponBonus = weapon?.attackRange ?? 0
    return baseRange + weaponBonus
  }

  /**
   * 获取当前英雄（标准模式下为 heroes[0]）。
   */
  get hero(): IHero | undefined {
    return this.heroes[0]
  }

  // ── 装备区操作 ──

  /**
   * 获取指定装备槽位中的卡牌。
   */
  getEquipInSlot(slot: EquipSlot): ICard | undefined {
    return this.equipCards.find((c) => c.equipSlot === slot)
  }

  /**
   * 装备一张卡牌到装备区。
   *
   * 如果对应槽位已有装备，旧装备会被替换（移至弃牌堆）。
   *
   * @returns 被替换的旧装备，如果没有则返回 undefined
   */
  equipCard(card: ICard): ICard | undefined {
    if (!card.equipSlot) return undefined

    const oldEquip = this.getEquipInSlot(card.equipSlot)
    if (oldEquip) {
      this.equipCards = this.equipCards.filter((c) => c.id !== oldEquip.id)
    }

    this.equipCards.push(card)
    return oldEquip
  }

  /**
   * 卸下指定槽位的装备。
   *
   * @returns 被卸下的装备，如果槽位为空则返回 undefined
   */
  unequipSlot(slot: EquipSlot): ICard | undefined {
    const equip = this.getEquipInSlot(slot)
    if (equip) {
      this.equipCards = this.equipCards.filter((c) => c.id !== equip.id)
    }
    return equip
  }

  // ── 判定区操作 ──

  /**
   * 向判定区添加延时锦囊。
   */
  addJudgeCard(card: ICard): void {
    this.judgeCards.push(card)
  }

  /**
   * 从判定区移除卡牌。
   */
  removeJudgeCard(cardId: string): ICard | undefined {
    const idx = this.judgeCards.findIndex((c) => c.id === cardId)
    if (idx === -1) return undefined
    const [removed] = this.judgeCards.splice(idx, 1)
    return removed
  }

  // ── 标记操作 ──

  /**
   * 获取标记值。
   */
  getMark(key: string): number {
    return this.marks.get(key) ?? 0
  }

  /**
   * 设置标记值。
   */
  setMark(key: string, value: number): void {
    this.marks.set(key, value)
  }

  /**
   * 增加标记值。
   */
  addMark(key: string, delta: number = 1): void {
    this.marks.set(key, this.getMark(key) + delta)
  }

  /**
   * 清除指定标记。
   */
  clearMark(key: string): void {
    this.marks.delete(key)
  }

  // ── 回合追踪 ──

  /**
   * 重置回合内状态（在新回合开始时调用）。
   */
  resetTurnState(): void {
    this.usedAttackThisTurn = false
    this.attackLimit = 1
    this.shouldSkipPhases = []
    this.skippedPhases = []
  }

  /**
   * 使用了一次攻击。
   */
  markAttackUsed(): void {
    this.usedAttackThisTurn = true
  }

  /**
   * 本回合是否还能攻击。
   */
  get canAttack(): boolean {
    return this.attackLimit > (this.usedAttackThisTurn ? 1 : 0)
    // 注意：此简化逻辑假设 usedAttackThisTurn 为 boolean。
    // 诸葛连弩等效果通过 attackLimit = Infinity 实现。
  }

  // ── 序列化 ──

  /**
   * 将玩家序列化为纯对象（用于 Store 同步 / 日志）。
   */
  toJSON(): Omit<IPlayer, 'marks'> & { marks: Record<string, number> } {
    const marksObj: Record<string, number> = {}
    this.marks.forEach((v, k) => {
      marksObj[k] = v
    })

    return {
      id: this.id,
      seatIndex: this.seatIndex,
      role: this.role,
      roleRevealed: this.roleRevealed,
      alive: this.alive,
      hp: this.hp,
      maxHp: this.maxHp,
      power: this.power,
      maxPower: this.maxPower,
      heroes: this.heroes,
      handCards: this.handCards,
      equipCards: this.equipCards,
      judgeCards: this.judgeCards,
      usedAttackThisTurn: this.usedAttackThisTurn,
      attackLimit: this.attackLimit,
      shouldSkipPhases: this.shouldSkipPhases,
      skippedPhases: this.skippedPhases,
      marks: marksObj,
    }
  }
}
