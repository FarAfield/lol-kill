import type { PlayerId, Position } from './types'
import type { RoleType, GamePhase, EquipSlot } from './enums'
import type { IHero } from './hero.interface'
import type { ICard } from './card.interface'

/**
 * 玩家实体
 *
 * 所有字段由引擎统一管理，UI 通过 StoreService 获取只读副本。
 *
 * 字段分组：
 * - 基础身份：id, seatIndex, role, roleRevealed, alive
 * - 英雄/体力/能量：hero, hp, maxHp, power, maxPower
 * - 卡牌区：handCards, equipCards, judgeCards
 * - 回合追踪：usedAttackThisTurn, attackLimit, shouldSkipPhases, skippedPhases
 * - 通用标记：marks
 */
export interface IPlayer {
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
  /** 当前英雄（标准模式下为 heroes[0]） */
  readonly hero: IHero | undefined
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
   * - 'damageThisTurn': 本回合已造成伤害次数
   * - 'healCount': 已回复次数
   * - 'rage': 怒气层数
   */
  marks: Map<string, number>

  // ── 方法 ──
  /** 回复体力 */
  recoverHp(amount: number): number
  /** 修改体力上限 */
  modifyMaxHp(delta: number): void
  /** 获取标记值 */
  getMark(key: string): number
  /** 设置标记值 */
  setMark(key: string, value: number): void
  /** 清除指定标记 */
  clearMark(key: string): void
  /** 重置回合内状态 */
  resetTurnState(): void
  /** 标记已使用一次攻击 */
  markAttackUsed(): void
  /** 获取指定装备槽位中的卡牌 */
  getEquipInSlot(slot: EquipSlot): ICard | undefined
  /** 是否受伤（hp < maxHp） */
  readonly isWounded: boolean
  /** 是否处于濒死状态 */
  readonly isDying: boolean
}
