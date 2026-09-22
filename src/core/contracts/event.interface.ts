// ============================================================
// 联盟杀 · 事件相关接口
// ============================================================

import type { TriggerTiming, EventStatus, GamePhase, TriggerStage } from './enums'
import type { EventId } from './types'
import type { IPlayer } from './player.interface'
import type { ICard } from './card.interface'
import type { DamageInstance } from './damage.interface'

/**
 * 事件值对象
 */
export interface EventValues {
  num: number
  numFixed: boolean
  baseDamage: number
  extraDamage: number
}

/**
 * 游戏事件
 *
 * 设计原则：
 * - source / player 为可选——系统事件（如闪电）可能没有明确的来源玩家
 * - AOP 钩子由 EventDispatcher 管理，不存储在事件上
 * - 通用数值聚合到 values 子对象
 */
export interface IGameEvent {
  /** 事件唯一标识 */
  id: EventId
  /** 事件名称 */
  name: string
  /** 触发时机类型 */
  type: TriggerTiming

  // ── 参与者（可选——系统事件可能无来源） ──
  /** 事件来源玩家（谁触发了此事件，可为空） */
  source?: IPlayer
  /** 事件驱动者（谁在主导这条事件链，可为空） */
  player?: IPlayer
  /** 事件目标玩家列表 */
  targets: IPlayer[]

  // ── 关联数据 ──
  /** 关联的卡牌列表 */
  cards: ICard[]

  // ── 事件树 ──
  /** 父事件 */
  parent?: IGameEvent
  /** 子事件列表 */
  children: IGameEvent[]

  // ── 流水线状态 ──
  /** 当前事件状态 */
  status: EventStatus
  /** 触发阶段（Before / Begin / Prepare / Content / Prevent / End / After） */
  stage: TriggerStage
  /** 是否已被取消 */
  canceled: boolean
  /** 是否已被阻止 */
  prevented: boolean
  /** 是否强制（不可取消/阻止） */
  forced: boolean
  /** 是否静默（不产生日志） */
  silent: boolean

  // ── 通用数值 ──
  /** 事件关联的通用数值 */
  values: EventValues

  // ── 状态机快照 ──
  /** 事件创建时的游戏阶段 */
  phase?: GamePhase
  /** 事件创建时所在轮次 */
  round?: number
  /** 事件创建时所在回合（玩家索引） */
  turn?: number

  // ── 扩展数据 ──
  /** 自定义扩展数据 */
  data: Record<string, unknown>
  /** 伤害实例（仅 Damage 类型事件有此字段） */
  damageInstance?: DamageInstance
  /** 事件创建时间戳 */
  timestamp: number
}

/**
 * 事件上下文
 */
export interface IEventContext {
  event: IGameEvent
  chain: IGameEvent[]
  depth: number
}

/**
 * 事件钩子
 *
 * 钩子的注册和调度由 EventDispatcher 统一管理。
 */
export type EventHook = (event: IGameEvent, context: IEventContext) => Promise<void> | void

/**
 * 事件钩子注册信息（EventTrigger 内部使用）
 *
 * EventTrigger 维护全局钩子注册表。
 * 每个钩子声明它在哪个 timing 的哪个 stage 触发，
 * EventDispatcher 在推进事件到对应 stage 时执行匹配的钩子。
 */
export interface EventHookRegistration {
  hook: EventHook
  skillId: string
  player: IPlayer
  priority: number
  isLocked: boolean
  /** 触发时机 */
  timing: TriggerTiming
  /** 触发阶段（Before / Begin / Prepare / Content / Prevent / End / After） */
  stage: TriggerStage
  /**
   * 触发范围
   * - player: 钩子持有者是事件驱动者（自身触发，匹配 event.player）
   * - source: 钩子持有者是事件实际执行者（匹配 event.source）
   * - global: 任意玩家触发均匹配
   * - target: 钩子持有者在事件目标列表中（匹配 event.targets）
   *
   * player 与 source 的区别：
   * - source = 谁实际做了这件事（使用杀的人、造成伤害的人）
   * - player = 谁在主导这条事件链（借刀杀人的发起者、事件链的顶层驱动者）
   * 多数情况下 source === player，但借刀杀人等场景下两者不同。
   */
  scope: 'player' | 'source' | 'global' | 'target'
}
