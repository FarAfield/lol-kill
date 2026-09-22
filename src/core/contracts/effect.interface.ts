// ============================================================
// 联盟杀 · 统一效果（Effect）接口
//
// Effect 是卡牌和英雄的通用技能定义单位。
// 卡牌技能、装备效果、英雄技能都通过此接口统一描述。
// 所有 Effect 由全局 EffectRegistry 管理，卡牌/英雄通过 effectIds 引用。
// ============================================================

import type { SkillType, TriggerTiming, Frequency, TriggerStage } from './enums'
import type { IGameEvent } from './event.interface'
import type { IPlayer } from './player.interface'
import type { ICard } from './card.interface'
import type { IGameState } from './game.interface'

/**
 * 触发条目
 *
 * 一条 TriggerEntry 声明「在哪个时机的哪个阶段触发」。
 * timing  + stage 共同确定唯一的触发点。
 *
 * 示例：
 * - { timing: TriggerTiming.CardUse,  stage: 'Before' }  → "当你使用杀时"（卡牌生效前）
 * - { timing: TriggerTiming.CardUse,  stage: 'Prepare' } → "指定目标后"
 * - { timing: TriggerTiming.Damage,   stage: 'Content' } → "当你造成伤害时"
 * - { timing: TriggerTiming.Damage,   stage: 'After' }   → "当你造成伤害后"
 * - { timing: TriggerTiming.TurnStart, stage: 'Begin' }  → "回合开始时"
 */
export interface TriggerEntry {
  /** 监听的时机 */
  timing: TriggerTiming
  /** 在该时机的哪个流水线阶段触发 */
  stage: TriggerStage
}

/**
 * 触发条件
 *
 * 定义效果在四种监听范围下的触发规则。
 * 效果持有者（effect owner）与事件参与者的关系决定是否触发：
 *
 * - player: 效果持有者是事件的「驱动者」（匹配 event.player）
 *   示例：回合开始（自身回合）、借刀杀人中发起借刀的角色
 *
 * - source: 效果持有者是事件的「实际执行者」（匹配 event.source）
 *   示例：使用杀、造成伤害
 *
 * - target: 效果持有者在事件的「目标列表」中（匹配 event.targets）
 *   示例：成为杀的目标、受到伤害
 *
 * - global: 任意玩家触发该事件时均触发，不限制 player/source/target
 *   示例：任意角色使用锦囊、任意角色受到伤害
 *
 * 当需要「其他角色」语义时，使用 global + filter 中排除自身：
 *   trigger: { global: [...] }
 *   filter: (ctx) => ctx.event.source !== ctx.player
 *
 * player 与 source 的区别：
 * - source = 谁实际做了这件事（使用杀的人）
 * - player = 谁在主导这条事件链（借刀杀人的 A 让 B 对 C 出杀 → player=A, source=B）
 * 多数情况下 source === player。
 */
export interface ITriggerCondition {
  /** 自身作为事件驱动者时触发（匹配 event.player） */
  player?: TriggerEntry[]
  /** 自身作为事件实际执行者时触发（匹配 event.source） */
  source?: TriggerEntry[]
  /** 全局事件触发（任意玩家的该事件均会触发） */
  global?: TriggerEntry[]
  /** 自身作为事件目标时触发（匹配 event.targets） */
  target?: TriggerEntry[]
}

/**
 * 响应请求参数
 *
 * 传递给 waitForResponse 的选项，定义玩家可以响应什么。
 * 三个字段按优先级匹配：validEffects > validTargets > validCards。
 * 不传任何 valid 字段时视为纯确认/取消询问。
 */
export interface ResponseRequest {
  /** 可选的响应卡牌（如闪、桃） */
  validCards?: ICard[]
  /** 可选的目标列表 */
  validTargets?: IPlayer[]
  /** 超时时间（毫秒），0 表示不超时 */
  timeout?: number
}

/**
 * 响应结果
 *
 * waitForResponse 的返回值。
 * confirmed === false 表示玩家放弃响应（未出闪、未出桃等）。
 */
export interface EffectResponse {
  /** 是否确认响应 */
  confirmed: boolean
  /** 选择的卡牌（如有） */
  card?: ICard
  /** 选择的目标（如有） */
  targets?: IPlayer[]
}

/**
 * 效果执行上下文（受限读写接口）
 *
 * 引擎提供给 Effect 逻辑的安全边界。
 * 所有写操作最终都通过事件系统执行——Effect 不能直接修改 Player / Card 属性。
 */
export interface IEffectContext {
  /** 触发本效果的事件 */
  event: IGameEvent
  /** 效果持有者 */
  player: IPlayer
  /** 游戏全局状态（只读） */
  game: IGameState
  /** 触发此效果的卡牌列表 */
  triggerCards: ICard[]
  /** 关联的伤害事件（如果是伤害触发） */
  damageEvent?: IGameEvent

  // ── 受限写入操作 ──
  drawCards(count: number): Promise<ICard[]>
  discardCards(cards: ICard[]): Promise<void>
  damageTarget(target: IPlayer, amount: number): Promise<void>
  recoverHp(target: IPlayer, amount: number): Promise<void>
  transferCards(cards: ICard[], target: IPlayer): Promise<void>
  /**
   * 请求玩家响应 — 暂停当前事件流水线，等待玩家决策。
   *
   * 在效果 content() 中调用此方法，会冻结事件链的推进，
   * 直到玩家回应或超时。常用于：
   * - Prevent 阶段询问是否出闪
   * - 濒死求桃
   * - 技能发动确认
   * - 选择目标
   *
   * @param prompt  提示文本（如 "是否出闪？"）
   * @param options 响应选项（可用卡牌、目标、超时）
   * @returns 响应结果
   *
   * @example
   * ```ts
   * const resp = await ctx.waitForResponse('是否出闪？', {
   *   validCards: handCards.filter(c => c.name === '闪'),
   * })
   * if (resp.confirmed) {
   *   ctx.event.prevented = true  // 出闪成功，阻止伤害
   * }
   * ```
   */
  waitForResponse(prompt: string, options?: ResponseRequest): Promise<EffectResponse>
  /**
   * 触发子事件 — 在当前事件链中插入一个任意类型的事件。
   *
   * 子事件会被 dispatch 到 EventChain，以 LIFO 顺序在当前事件之后结算。
   * 自动继承当前事件的 phase/round/turn 信息。
   *
   * @param eventDef 事件定义
   */
  emit(eventDef: {
    /** 触发时机类型 */
    type: TriggerTiming
    /** 事件名称（可选，默认用 type 生成） */
    name?: string
    /** 事件来源 */
    source?: IPlayer
    /** 事件目标列表 */
    targets?: IPlayer[]
    /** 关联卡牌 */
    cards?: ICard[]
    /** 自定义数据 */
    data?: Record<string, unknown>
    /** 是否强制（不可取消/阻止） */
    forced?: boolean
    /** 是否静默 */
    silent?: boolean
  }): Promise<void>

  /**
   * 询问指定玩家一个确认性问题（是否出杀/是否出闪等）。
   *
   * 与 waitForResponse 不同，此方法向指定玩家发出询问，而非效果持有者。
   * 内部使用 decisionService.askForResponse，通过 pauseManager 暂停事件链等待响应。
   *
   * @param player  被询问的玩家
   * @param prompt  提示文本
   * @param timeout 超时时间（毫秒），0 表示不超时
   * @returns true 表示玩家确认响应
   */
  askPlayer(player: IPlayer, prompt: string, timeout?: number): Promise<boolean>

  /**
   * 询问指定玩家选择一张卡牌。
   *
   * 向指定玩家展示可选卡牌列表，由玩家选择一张。
   * 放弃选择或超时返回 null。
   *
   * @param player     被询问的玩家
   * @param prompt     提示文本
   * @param validCards 可选卡牌列表
   * @param timeout    超时时间（毫秒），0 表示不超时
   * @returns 玩家选择的卡牌，放弃/超时返回 null
   */
  askPlayerForCard(
    player: IPlayer,
    prompt: string,
    validCards: ICard[],
    timeout?: number,
  ): Promise<ICard | null>

  /**
   * 附加事件元数据供外部（UI/AI/日志）使用。
   *
   * 替代 event.data['_xxx'] 暗线模式——效果通过此方法向外部输出信息，
   * 外部层通过对应的 getEventMeta 或直接读取事件元数据获取。
   *
   * 元数据 key 使用 camelCase 命名，不再以下划线开头。
   *
   * @param key   元数据键名（camelCase）
   * @param value 元数据值
   */
  setEventMeta(key: string, value: unknown): void

  /**
   * 获取事件元数据。
   *
   * @param key 元数据键名
   * @returns 元数据值，不存在时返回 undefined
   */
  getEventMeta<T>(key: string): T | undefined

  useCard(card: ICard, targets: IPlayer[]): Promise<void>
  judge(player: IPlayer): Promise<ICard>
  obtainCards(target: IPlayer, cards: ICard[]): Promise<void>
  equipCard(card: ICard): Promise<void>
  modifyMaxHp(target: IPlayer, delta: number): Promise<void>
  modifyEffects(target: IPlayer, addEffects?: string[], removeEffects?: string[]): Promise<void>
}

/**
 * 目标选择器
 *
 * 定义技能/卡牌可以选择的目标规则。
 * 由效果在运行时通过 selectTarget 工厂返回具体实例。
 */
export interface ITargetSelector {
  /** 最少目标数 */
  minTargets: number
  /** 最多目标数 */
  maxTargets: number
  /** 判断单个玩家是否为合法目标 */
  isValidTarget(player: IPlayer, context: IEffectContext): boolean
  /** 获取当前所有可选目标 */
  getAvailableTargets(context: IEffectContext): IPlayer[]
}

/**
 * 卡牌选择器
 *
 * 定义技能需要选择卡牌时的规则（如弃牌、展示、获得等）。
 * 由效果在运行时通过 selectCard 工厂返回具体实例。
 */
export interface ICardSelector {
  /** 最少卡牌数 */
  minCards: number
  /** 最多卡牌数 */
  maxCards: number
  /** 判断单张卡牌是否可选 */
  isValidCard(card: ICard, context: IEffectContext): boolean
  /** 获取当前所有可选卡牌 */
  getAvailableCards(context: IEffectContext): ICard[]
}

/**
 * 统一效果定义
 *
 * 卡牌技能、装备效果、英雄技能均使用此接口。
 * 效果本身独立于载体存在——卡牌和英雄通过 effectIds 引用全局 EffectRegistry 中的效果。
 *
 * 属性分组：
 * - 基础：id, name, description, type
 * - 权重：priority, frequency
 * - 触发：trigger（source / global / target 三种监听范围 × 七个流水线阶段）
 * - 筛选：filter, selectTarget, selectCard
 * - 执行：content
 * - 可用性：isAvailable
 * - 视作：viewAs, viewAsFilter
 * - AI：aiValue, aiCard, aiTarget
 *
 * 注意：IEffect 是纯定义接口，不包含任何运行时可变状态。
 * usedThisTurn / usedThisRound 等频率状态放在 CompiledHandler 上。
 */
export interface IEffect {
  /** 效果唯一标识 */
  id: string
  /** 效果名称 */
  name: string
  /** 描述文本 */
  description: string

  // ── 效果类型 ──
  /** 技能类型（被动/主动/锁定/限定/觉醒） */
  type: SkillType

  // ── 权重 ──
  /** 同时机优先级（越高越先结算） */
  priority: number
  /** 发动频率限制 */
  frequency: Frequency

  // ── 触发 ──
  /**
   * 触发条件
   *
   * 声明效果在哪些时机/阶段/范围下触发。
   * 三个监听范围：
   * - source：自身作为事件来源 → "当【你】使用杀时"
   * - global：任意玩家触发 → "当【任意角色】受到伤害后"
   * - target：自身作为事件目标 → "当【你】成为杀的目标时"
   *
   * 若需「其他角色」语义，用 global + filter 排除自身。
   */
  trigger: ITriggerCondition

  /**
   * 发动条件筛选
   *
   * 即使 trigger 匹配，filter 返回 false 时本次也不触发。
   * 用于实现额外条件：体力限制、手牌数限制、特定阶段等。
   *
   * @returns true 表示本次可以发动
   */
  filter?: (context: IEffectContext) => boolean

  /** 目标选择器工厂 */
  selectTarget?: (context: IEffectContext) => ITargetSelector

  /** 卡牌选择器工厂 */
  selectCard?: (context: IEffectContext) => ICardSelector

  /** 效果核心逻辑 */
  content: (context: IEffectContext) => Promise<void>

  // ── 视作（viewAs） ──
  /**
   * 将一张牌「视为」另一张牌使用/打出。
   *
   * 典型应用：
   * - 关羽·武圣：红色牌视为杀
   * - 赵云·龙胆：杀视为闪、闪视为杀
   *
   * @returns partial ICard 覆盖项，返回 null 表示该牌不可视作
   */
  viewAs?: (card: ICard, context: IEffectContext) => Partial<ICard> | null

  /** viewAs 预筛选（减少无效 viewAs 调用） */
  viewAsFilter?: (card: ICard, context: IEffectContext) => boolean

  // ── AI 决策提示 ──
  /** AI 发动价值评估 (0–100) */
  aiValue?: (context: IEffectContext) => number
  /** AI 选择卡牌 */
  aiCard?: (cards: ICard[], context: IEffectContext) => ICard | null
  /** AI 选择目标 */
  aiTarget?: (targets: IPlayer[], context: IEffectContext) => IPlayer[]

  // ── 可用性检查（运行时） ──
  /**
   * 检查技能当前是否可用（运行时判断）。
   *
   * 在每次触发时被调用，返回 false 则跳过本次执行。
   * 用于实现：
   * - 觉醒技：检查觉醒条件是否满足
   * - 沉默/禁魔：检查玩家 mark
   * - 状态限制：体力、手牌数等条件
   *
   * 与 filter 的区别：
   * - isAvailable 是"这个技能现在能用吗？"（全局可用性）
   * - filter 是"这次触发要发动吗？"（具体条件筛选）
   *
   * @param context 效果执行上下文
   * @returns true 表示技能当前可用
   */
  isAvailable?: (context: IEffectContext) => boolean
}
