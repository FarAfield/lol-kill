import { GamePhase, RoleType, EquipSlot } from '@core/contracts/enums'
import type {
  IPlayer,
  PlayerSnapshot,
  PlayerState,
} from '@core/contracts/player.interface'
import type { IHero } from '@core/contracts/hero.interface'
import type { ICard } from '@core/contracts/card.interface'

// ── 构造参数 ──

/** 创建玩家所需的最小信息：座位与 ID，其余字段均有默认值 */
export type PlayerInit = Partial<PlayerState> & Pick<PlayerState, 'id' | 'seatIndex'>

// ── 玩家实体 ──
//
// **这里没有任何一个变更方法。**
//
// Phase 19 之前本类带着 17 个 `loseHp` / `equipCard` / `setMark` 之类的方法，
// 于是「改玩家状态」有两套入口：实体自己一套、`system/*` 一套。
// 后果是夹取规则各写各的——`recoverHp` 知道不能超过上限，而濒死救活
// 那句 `hp = 1`（在 `DeathSystem` 里）不知道，它只是碰巧在 hp ≤ 0 时才被调用。
//
// 更糟的是其中 10 个方法**生产代码里根本没人调用**，只在测试里被用：
// `addHandCards` / `removeHandCards` / `equipCard` / `unEquipSlot` /
// `addJudgeCard` / `removeJudgeCard` / `chooseHeroes` / power 三件套。
// 它们是 `CardSystem` 的重复实现，且绕过 `zone` / `owner` / `visibleTo`
// 的同步与装备变动通知——「有一条路能改装备区却不会挂装备技」是纯粹的隐患。
//
// 现在：写入一律走 `system/player-system.ts`（数值与标记）
// 与 `system/card-system.ts`（卡牌区域）。本类只留数据与派生只读量。

export class Player implements IPlayer {
  readonly id: string
  seatIndex: number
  role?: RoleType
  roleRevealed: boolean
  alive: boolean
  // 基础属性
  hp: number
  maxHp: number
  power: number
  maxPower: number
  heroes: IHero[]
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

  constructor(data: PlayerInit) {
    this.id = data.id
    this.seatIndex = data.seatIndex
    this.role = data.role
    this.roleRevealed = data.roleRevealed ?? false
    this.alive = data.alive ?? true
    this.hp = data.hp ?? data.heroes?.[0]?.maxHp ?? 0
    this.maxHp = data.maxHp ?? data.heroes?.[0]?.maxHp ?? 0
    this.power = data.power ?? data.heroes?.[0]?.maxPower ?? 0
    this.maxPower = data.maxPower ?? data.heroes?.[0]?.maxPower ?? 0
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

  static batchCreate(num: number): Player[] {
    return Array.from(
      { length: num },
      (_, i) =>
        new Player({ id: `player_${i}`, seatIndex: i }),
    )
  }

  // ── 派生状态（只读）──

  /** 当前手牌数量 */
  get handSize(): number {
    return this.handCards.length
  }

  /** 是否受伤（hp < maxHp） */
  get isWounded(): boolean {
    return this.hp < this.maxHp
  }

  /** 是否处于濒死状态（hp <= 0 且仍存活） */
  get isDying(): boolean {
    return this.alive && this.hp <= 0
  }

  /**
   * 当前攻击范围（基础 1 + 武器加成）
   *
   * 诸葛连弩之类的**次数**加成不在这里——那是出牌阶段的 `mod.cardUsable`。
   */
  get attackRange(): number {
    const weapon = this.getEquipInSlot(EquipSlot.Weapon)
    const baseRange = 1
    const weaponBonus = weapon?.attackRange ?? 0
    return baseRange + weaponBonus
  }

  /** 当前英雄（标准模式下为 heroes[0]） */
  get hero(): IHero | undefined {
    return this.heroes[0]
  }

  // ── 「本回合还能不能出杀」不在这里 ──
  //
  // 这个 getter 曾经叫 `canAttack`，算的是 `attackLimit > (usedAttackThisTurn ? 1 : 0)`
  // ——一个**完全不经过 Mod 注册表**的算式。于是装了【诸葛连弩】以后，
  // 出牌选项（走 `mod.cardUsable`）说「可以无限出」，而读这个 getter 的
  // AI / UI 说「不行」。同一个问题两个答案，那是欠账 D8。
  //
  // 判定已收口到 `CardBudget.canPlay`（`src/core/skill/card-budget.ts`）：
  // 它读同一个账本（`usedAttackThisTurn`），但上限只认 Mod。
  // `Player` 是纯实体，不认识 ModRegistry，因此这类「要查规则才答得上来」
  // 的问题一律不该挂在实体上。

  // ── 查询（只读）──

  /** 获取指定装备槽位中的卡牌 */
  getEquipInSlot(slot: EquipSlot): ICard | undefined {
    return this.equipCards.find((c) => c.equipSlot === slot)
  }

  /**
   * 获取标记值（不存在时返回 0）
   *
   * 只留读——写入归 `PlayerSystem.setMark` / `ctx.setMark`。
   */
  getMark(key: string): number {
    return this.marks.get(key) ?? 0
  }

  // ── 序列化 ──

  /** 将玩家序列化为纯对象（用于 Store 同步 / 日志） */
  toJSON(): PlayerSnapshot {
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
