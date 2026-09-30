import type { PlayerId, Position } from './types'
import type { RoleType, GamePhase, EquipSlot } from './enums'
import type { IHero } from './hero.interface'
import type { ICard } from './card.interface'

/**
 * 玩家可序列化状态 —— 纯数据，不含任何行为。
 *
 * 字段分组：
 * - 基础身份：id, seatIndex, role, roleRevealed, alive
 * - 英雄/体力/能量：heroes, hp, maxHp, power, maxPower
 * - 卡牌区：handCards, equipCards, judgeCards
 * - 回合追踪：usedAttackThisTurn, attackLimit, shouldSkipPhases, skippedPhases
 * - 通用标记：marks
 */
export interface PlayerState {
  // ── 基础身份 ──
  /** 玩家唯一 ID */
  id: PlayerId
  /** 座位号 (0-based) */
  seatIndex: Position
  /** 身份（仅天命星灵或已死亡角色公开给所有玩家） */
  role?: RoleType
  /** 身份是否已公开 */
  roleRevealed: boolean
  /** 是否存活 */
  alive: boolean

  // ── 英雄 / 体力 / 能量 ──
  /** 当前体力 */
  hp: number
  /** 体力上限 */
  maxHp: number
  /** 当前能量 */
  power: number
  /** 能量上限 */
  maxPower: number
  /** 英雄列表（标准模式 1 个，双将模式 2 个） */
  heroes: IHero[]

  // ── 卡牌区 ──
  /** 手牌区（对其他玩家不可见） */
  handCards: ICard[]
  /** 装备区 */
  equipCards: ICard[]
  /** 判定区（延时类锦囊） */
  judgeCards: ICard[]

  // ── 回合追踪 ──
  /** 本回合是否已使用过攻击牌（如杀） */
  usedAttackThisTurn: boolean
  /** 本回合攻击次数上限（默认 1，装备诸葛连弩等可提升） */
  attackLimit: number
  /** 本回合需要跳过的阶段（乐不思蜀 → 跳过出牌阶段） */
  shouldSkipPhases: GamePhase[]
  /** 本回合已跳过的阶段 */
  skippedPhases: GamePhase[]

  // ── 通用标记 ──
  /**
   * 技能通用计数器
   *
   * 用于技能内部追踪状态，例如：
   * - 'damageDealtThisTurn': 本回合已造成伤害次数
   * - 'healCount': 已回复次数
   * - 'rage': 怒气层数
   */
  marks: Map<string, number>
}

/**
 * 玩家的序列化输出。
 *
 * 与 `PlayerState` 唯一的区别是 `marks` 由 `Map` 转为普通对象，
 * 保证 `JSON.stringify` 可直接处理。
 */
export type PlayerSnapshot = Omit<PlayerState, 'marks'> & {
  marks: Record<string, number>
}

/**
 * 玩家实体 —— 状态 + 只读派生。
 *
 * **本接口没有任何变更方法**（Phase 19）。
 *
 * 以前它带着 `loseHp` / `equipCard` / `setMark` 一整套写入口，
 * 于是「改玩家状态」始终存在两条路：实体一条、`system/*` 一条。
 * 两路并存时，写在其中一条上的夹取规则对另一条形同虚设
 * （`recoverHp` 会裁上限，而濒死救活那句 `hp = 1` 不会）。
 *
 * 现在的分工是硬的：
 * - 数值（hp / maxHp / power / 标记 / 存活 / 英雄）→ `PlayerSystem`
 * - 卡牌区域（handCards / equipCards / judgeCards）→ `CardSystem`
 *
 * 技能与内容层要写状态，一律经过 `ISkillContext`（`ctx.setMark` 等），
 * 由它转交对应的系统——内容层因此永远拿不到实体的写入口。
 *
 * UI 通过 StoreService 获取只读副本（PlayerSnapshot）。
 */
export interface IPlayer extends PlayerState {
  // ── 派生状态（只读）──
  /** 当前手牌数量 */
  readonly handSize: number
  /** 是否受伤（hp < maxHp） */
  readonly isWounded: boolean
  /** 是否处于濒死状态（hp <= 0 且存活） */
  readonly isDying: boolean
  /** 当前攻击范围（基础 1 + 武器加成） */
  readonly attackRange: number
  /** 当前英雄（标准模式下为 heroes[0]） */
  readonly hero: IHero | undefined
  // 「本回合还能不能出杀」不在实体上回答 —— 见 `CardBudget.canPlay`。
  // 它要查 Mod 注册表，而 `IPlayer` 是纯数据契约，不该认识规则。

  // ── 查询（只读）──
  /** 获取指定装备槽位中的卡牌 */
  getEquipInSlot(slot: EquipSlot): ICard | undefined
  /**
   * 获取标记值（不存在时返回 0）
   *
   * 只留读——写入见 `PlayerSystem.setMark` / `ISkillContext.setMark`。
   */
  getMark(key: string): number

  /** 序列化为纯对象 */
  toJSON(): PlayerSnapshot
}
