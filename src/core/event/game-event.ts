import type { IGameEvent, EventValues } from '@core/contracts/event.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { EventStatus } from '@core/contracts/enums'
import type { TriggerTiming, TriggerStage, GamePhase } from '@core/contracts/enums'
import { IdGenerator } from '@core/utils'

/**
 * 事件创建选项
 */
export interface GameEventOptions {
  /** 事件名称 */
  name: string
  /** 触发时机类型 */
  type: TriggerTiming
  /** 事件来源玩家 */
  source?: IPlayer
  /** 事件驱动者 */
  player?: IPlayer
  /** 事件目标列表 */
  targets?: IPlayer[]
  /** 关联卡牌 */
  cards?: ICard[]
  /** 父事件 */
  parent?: IGameEvent
  /** 是否强制（不可取消/阻止） */
  forced?: boolean
  /** 是否静默（不产生日志） */
  silent?: boolean
  /** 自定义数据 */
  data?: Record<string, unknown>
  /** 事件创建时的游戏阶段 */
  phase?: GamePhase
  /** 事件创建时所在轮次 */
  round?: number
  /** 事件创建时所在回合 */
  turn?: number
}

/**
 * 默认事件值对象
 */
function createDefaultValues(): EventValues {
  return {
    num: 0,
    numFixed: false,
    baseDamage: 0,
    extraDamage: 0,
  }
}

/** 全局共享 ID 生成器（所有 GameEvent 实例共用，保证 ID 递增不重复） */
const _idGenerator = new IdGenerator()

/**
 * 有效的状态转移表
 *
 * 每个状态可以转移到哪些后续状态。
 * 用于在 transitionTo 时验证合法性。
 */
const VALID_TRANSITIONS: Partial<Record<EventStatus, EventStatus[]>> = {
  [EventStatus.Waiting]: [EventStatus.SkipCheck],
  [EventStatus.SkipCheck]: [EventStatus.Cancelled, EventStatus.Before],
  [EventStatus.Cancelled]: [EventStatus.Completed],
  [EventStatus.Before]: [EventStatus.Begin],
  [EventStatus.Begin]: [EventStatus.Prepare],
  [EventStatus.Prepare]: [EventStatus.Content],
  [EventStatus.Content]: [EventStatus.Prevent],
  [EventStatus.Prevent]: [EventStatus.Prevented, EventStatus.End],
  [EventStatus.Prevented]: [EventStatus.End],
  [EventStatus.End]: [EventStatus.After],
  [EventStatus.After]: [EventStatus.Completed],
  [EventStatus.Completed]: [],
}

export class GameEvent implements IGameEvent {
  id: string
  name: string
  type: TriggerTiming

  source?: IPlayer
  player?: IPlayer
  targets: IPlayer[]

  cards: ICard[]

  parent?: IGameEvent
  children: IGameEvent[]

  status: EventStatus
  stage: TriggerStage
  canceled: boolean
  prevented: boolean
  forced: boolean
  silent: boolean

  values: EventValues

  phase?: GamePhase
  round?: number
  turn?: number

  data: Record<string, unknown>
  timestamp: number

  constructor(options: GameEventOptions) {
    this.id = _idGenerator.next('event')
    this.name = options.name
    this.type = options.type

    this.source = options.source
    this.player = options.player
    this.targets = options.targets ?? []

    this.cards = options.cards ?? []

    this.parent = options.parent
    this.children = []

    // 初始状态为 waiting
    this.status = 'waiting' as EventStatus
    this.stage = 'Begin' as TriggerStage
    this.canceled = false
    this.prevented = false
    this.forced = options.forced ?? false
    this.silent = options.silent ?? false

    this.values = createDefaultValues()

    this.phase = options.phase
    this.round = options.round
    this.turn = options.turn

    this.data = options.data ?? {}
    this.timestamp = Date.now()
  }

  /**
   * 尝试将事件转移到目标状态
   *
   * 验证转移的合法性：
   * - 必须从当前状态可以转移到目标状态
   * - 特殊处理 cancelled / prevented 分支
   *
   * @param target 目标状态
   * @throws 如果转移非法
   */
  transitionTo(target: EventStatus): void {
    // 如果是强制事件且目标为 cancelled/prevented，跳过（强制事件无法流转至此状态）
    if (this.forced && (target === 'cancelled' || target === 'prevented')) {
      return
    }
    const allowed = VALID_TRANSITIONS[this.status]
    if (!allowed || !(allowed as EventStatus[]).includes(target)) {
      throw new Error(
        `[GameEvent] 非法状态转移: ${this.status} → ${target} (event: ${this.name}, id: ${this.id})`,
      )
    }
    this.status = target
    // 设置取消/阻止标记
    if (target === 'cancelled') {
      this.canceled = true
    }
    if (target === 'prevented') {
      this.prevented = true
    }
  }

  /**
   * 添加子事件
   *
   * 子事件的 player 继承当前事件的 player（除非子事件已指定）。
   */
  addChild(child: IGameEvent): void {
    // 如果子事件没有 player，继承父事件的 player
    if (!child.player && this.player) {
      child.player = this.player
    }
    // 如果子事件没有 parent，设置为当前事件
    if (!child.parent) {
      child.parent = this
    }
    this.children.push(child)
  }

  /**
   * 事件是否已结束（已完成、已取消、已阻止）
   */
  get isFinished(): boolean {
    return this.status === 'completed' || this.status === 'cancelled' || this.status === 'prevented'
  }

  /**
   * 事件是否处于可继续结算的状态
   */
  get isActive(): boolean {
    return !this.isFinished
  }

  /**
   * 深度（事件嵌套层级）
   *
   * 根事件的深度为 0，每嵌套一层子事件 +1。
   */
  get depth(): number {
    let d = 0
    let current: IGameEvent | undefined = this.parent
    while (current) {
      d += 1
      current = current.parent
    }
    return d
  }

  /**
   * 调试用的简要描述
   */
  toString(): string {
    return `GameEvent(【${this.id}】: ${this.name}, type=${this.type}, status=${this.status}, depth=${this.depth})`
  }

  /** 重置 ID 生成器（重放 / 测试前调用） */
  static resetIdGenerator(): void {
    _idGenerator.reset()
  }
}
