// ============================================================
// 联盟杀 · 技能（Skill）契约 —— 对齐无名杀的技能定义结构
//
// Phase 13 之前，所有与游戏内容相关的定义都叫 `IEffect`，字段是
// 三条穷举式一对一的属性：`type` / `frequency` / `priority`。
// 它撑不住真实武将：
//
//   「锁定技 + 限定技」怎么表达？（type 只能二选一）
//   「每回合各限一次」怎么表达？（frequency 是单值）
//   「选 N 张装备区的牌当杀」怎么表达？（没有 position / selectCard）
//   「技能带来的数值修正」放哪？（没有 mod 字段）
//
// 无名杀的答案是：**把「穷举」换成「布尔矩阵」**。
// 一个技能可以同时是锁定技、限定技、觉醒技、装备技——它们互不排斥，
// 只是各自在不同环节被问一句。本契约即按此思路组织。
//
// ── 与 `IEffect` 的关系 ──
// `IEffect` 现在是 `ISkill` 的**子接口**（见 `effect.interface.ts`），
// 只是额外保留几个旧字段以保证存量代码可编译。也就是说：
// 每个现存 IEffect 都自动是一个合法的 ISkill，无需转换。
//
// ── 三条机制，各管一段 ──
// | 字段组 | 回答的问题 | 什么时候跑 |
// |--------|-----------|-----------|
// | `trigger` + `filter` + `cost` + `content` | 某个时机额外做什么 | 事件流水线里 |
// | `mod` | 这个数字是多少 / 这件事允不允许 | 每次查询，**不在流水线里** |
// | `viewAs` + `filterCard` + `position` + `selectCard` | 这张牌能当什么用 | 出牌合法性检查时 |
// ============================================================

import type { GamePhase } from './enums'
import type { EventName } from './event-name'
import type { IGameEvent, TriggerScope } from './event.interface'
import type { IPlayer } from './player.interface'
import type { ICard } from './card.interface'
import type { IGameState } from './game.interface'
import type { IModQuery, INumericMods, IBooleanMods } from './mod.interface'
import type { CardTagValue } from './card-tag'

// ═══════════════════════════════════════════
// 分类：什么时候能发动
// ═══════════════════════════════════════════

/**
 * 主动技的可用场合
 *
 * 回合内的场合直接用 `GamePhase`（`'phaseUse'` 出牌阶段 …
 * 见 `enums.ts`），回合外 / 非阶段的场合用下面几个关键字：
 *
 * - `'response'` —— 被询问「是否出 ××」时可以作为回答打出
 *   （例：赵云·龙胆把【杀】当【闪】）
 * - `'dying'` —— 濒死求桃时可以打出
 *   （例：程普可以把【酒】当【桃】）
 * - `'discard'` —— 弃牌阶段 / 被要求弃牌时可以打出
 *
 * 不写 `enable` = 没有手动发动入口，只能被事件被动触发。
 */
export type SkillEnableContext =
  | GamePhase
  | 'response'
  | 'dying'
  | 'discard'

// ═══════════════════════════════════════════
// 频率
// ═══════════════════════════════════════════

/**
 * 发动频率
 *
 * 与旧 `Frequency` 枚举对应，多了 `oncePerPhase`。
 * 之所以换成字符串联合：加一种频率不该需要改枚举、
 * 改缩进、再改一遍 switch——它只是个字符串。
 */
export type SkillFrequency =
  | 'once' // 整局一次
  | 'oncePerTurn' // 每回合一次
  | 'oncePerRound' // 每轮一次
  | 'oncePerPhase' // 每阶段一次
  | 'unlimited' // 无限

/**
 * 清零频率记账的时间边界
 *
 * 三档各自独立：`turn` 清「每回合一次」，不清「每轮一次」。
 */
export type FrequencyScope = 'phase' | 'turn' | 'round'

/**
 * 技能运行时状态 —— **一个「玩家 × 技能」一份**
 *
 * Phase 15 之前这份状态是长在 `CompiledHandler` 上的，于是有两处错：
 *
 * 1. 一条技能监听 N 个事件就编译出 N 个 handler，N 份计数互不相干
 *    —— 「每回合限一次」实际变成「每个事件各限一次」。
 * 2. 限定技的判据是 `usedThisRound`，而它在轮次边界被清零
 *    —— 限定技过一轮就能再放一次。
 *
 * 现在状态挂在台账的挂载记录上，handler 只持引用：
 * 计数按技能走，摘掉技能则状态随之消失。
 */
export interface ISkillRuntimeState {
  /** 整局累计发动次数 —— 限定技与 `usable` 的判据，永不清零 */
  usedCount: number
  /** 本回合已发动次数 */
  usedThisTurn: number
  /** 本轮已发动次数 */
  usedThisRound: number
  /** 本阶段已发动次数 */
  usedThisPhase: number
  /** 觉醒技是否已觉醒（觉醒是一次性的，且不可回退） */
  awakened: boolean
  /** 转换技当前态：0 或 1 */
  convertState: number
}

// ═══════════════════════════════════════════
// 视作（viewAs）
// ═══════════════════════════════════════════

/** 选牌来源区域：h 手牌 / e 装备 / j 判定 */
export type SkillPosition = 'h' | 'e' | 'j'

/**
 * 需选牌数
 *
 * - 数字 = 恰好 N 张
 * - `[min, max]` = 区间
 */
export type SkillSelectCount = number | [min: number, max: number]

/**
 * `viewAs` / `filterCard` 能看到的上下文
 *
 * 比 `ISkillContext` 窄得多——**这是刻意的**。视作问答发生在
 * 「有哪些牌可以打」这一刻画 ask 的时刻，那时还没有任何事件发生：
 * 出牌阶段列候选牌、响应征询列候选牌，都不是某条 `useCard` 事件的
 * 流水线里。以前为了复用 `ISkillContext`，调用方只能**伪造一个空事件**
 * 去凑类型（坏味道：那个假上下文的 `event.cards` 恒为空数组）。
 *
 * 所以这里只给三样东西：谁在问、全局状态够不够、以及 Mod 查询口
 * （「这张虚拟牌此刻让不让用」）。
 */
export interface IViewAsContext {
  /** 发起这次视作查询的玩家 */
  player: IPlayer
  /** 游戏全局状态（只读） */
  game: IGameState
  /** Mod 查询口（纯只读） */
  mods: IModQuery
  /**
   * 这次查询的使用场景
   *
   * 两可的技能（如龙胆「杀当闪 / 闪当杀」）靠它决定
   * 此刻该给出哪一面。
   */
  usage?: SkillEnableContext
}

/**
 * 一条视作结果 —— 「用这几张真牌，当作这张虚拟牌使用」
 *
 * `card` 是一张虚拟牌：`virtual === true`、**不属于任何区域**，
 * 真正转移与弃置的是 `baseCards`。
 */
export interface ICardView {
  /** 视作出来的虚拟牌 */
  readonly card: ICard
  /** 它消耗的真实卡牌（使用后离手） */
  readonly baseCards: readonly ICard[]
  /** 产生它的技能 id */
  readonly skillId: string
  /** 产生它的技能名（UI 展示用） */
  readonly skillName: string
}

/**
 * 一次视作查询
 *
 * `usage` 决定「哪些技能来回答」「走哪个 Mod 闸门」；
 * `requireTag` 决定「只留能产出什么牌的答案」。
 */
export interface CardViewQuery {
  /** 谁在视作 */
  player: IPlayer
  /** 使用场景：出牌阶段 / 响应 / 濒死 / 弃牌 */
  usage: SkillEnableContext
  /**
   * 只保留能产出该标签的视图
   *
   * 响应征询专用：「我要闪」的时候，能变出杀的视图不相关。
   */
  requireTag?: CardTagValue
  /** 当前事件（Mod 查询需要上下文） */
  event?: IGameEvent
  /** 额外放行判定（最后一问在 ask 处的 caller 手里） */
  allow?: (card: ICard) => boolean
}

/**
 * 视作服务 —— 「这张牌此刻能当什么用」的唯一答案
 *
 * 引擎构造一份，`PhaseManager`（出牌阶段）与 `ISkillContext.cardViews`
 * （响应征询 / 濒死求桃）共用，因此两处看到的候选集合是同一套。
 */
export interface IViewAsService {
  /** 列出此刻所有可用的视作结果 */
  getViews(query: CardViewQuery): ICardView[]
}

// ═══════════════════════════════════════════
// 触发
// ═══════════════════════════════════════════

/**
 * 触发条件
 *
 * 定义技能在四种监听范围下的触发规则。
 * 技能持有者与事件参与者的关系决定是否触发：
 *
 * - player: 持有者是事件的「驱动者」（匹配 `event.player`）
 * - source: 持有者是事件的「实际执行者」（匹配 `event.source`）
 * - target: 持有者在事件的「目标列表」中（匹配 `event.targets`）
 * - global: 任意角色触发该事件时均触发
 *
 * 「其他角色」语义用 `global` + `filter` 排除自身：
 * ```ts
 * trigger: { global: ['damageAfter'] }
 * filter: (ctx) => ctx.event.source !== ctx.player
 * ```
 */
export interface ISkillTriggerCondition {
  /** 自身作为事件驱动者时触发（匹配 event.player） */
  player?: EventName[]
  /** 自身作为事件实际执行者时触发（匹配 event.source） */
  source?: EventName[]
  /** 全局事件触发（任意玩家的该事件均会触发） */
  global?: EventName[]
  /** 自身作为事件目标时触发（匹配 event.targets） */
  target?: EventName[]
}

// ═══════════════════════════════════════════
// 一次性监听（when）
// ═══════════════════════════════════════════

/**
 * 一条已挂上的监听的句柄
 *
 * 「下回合的摸牌阶段」这类监听常因局面变化而不再需要，
 * 握着句柄才能在它该消失的时候摘掉它。
 */
export interface IWhenHandle {
  /** 监听编号（形如 `__when:3`） */
  readonly id: string
  /** 已经触发过几次（通过了 `filter` 才算一次） */
  readonly fired: number
  /** 摘掉这条监听；重复调用无害 */
  off(): void
}

/**
 * 监听构造器
 *
 * 链式方法都只改构造器自己，**只有 `finish()` 会挂上监听**——
 * 半句没写完的监听不该自己生效。
 */
export interface IWhenBuilder {
  /**
   * 只在这次事件满足条件时触发
   *
   * 拿的是**事件**不是上下文：`filter` 回答「这一次算不算」，
   * 那时还没有 `ISkillContext`。要看局面就写在 `then` 里。
   */
  filter(predicate: (event: IGameEvent) => boolean): IWhenBuilder
  /** 监听范围，默认 `global`（与技能的 `trigger` 同义） */
  scope(scope: TriggerScope): IWhenBuilder
  /** 同时机优先级（越高越先跑），默认 0 */
  priority(value: number): IWhenBuilder
  /** 触发一次后自动注销 */
  once(): IWhenBuilder
  /** 触发时做什么 */
  then(effect: (ctx: ISkillContext) => void | Promise<void>): IWhenBuilder
  /** 挂上这条监听，返回句柄 */
  finish(): IWhenHandle
}

// ═══════════════════════════════════════════
// 上下文
// ═══════════════════════════════════════════

/**
 * 响应请求参数
 *
 * 传给 `waitForResponse` 的选项，定义玩家可以响应什么。
 * 不传任何 valid 字段时视为纯确认 / 取消询问。
 */
export interface ResponseRequest {
  /**
   * 被询问的玩家
   *
   * 缺省为技能持有者。AOE、决斗这类要问**别人**的场景必须显式指定。
   */
  player?: IPlayer
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
 * `waitForResponse` 的返回值。
 * `confirmed === false` 表示玩家放弃响应。
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
 * 技能执行上下文（受限读写接口）
 *
 * 引擎提供给技能逻辑的安全边界。
 * 所有写操作最终都通过事件系统执行——技能不能直接修改 Player / Card 属性。
 */
export interface ISkillContext {
  /** 触发本技能的事件 */
  event: IGameEvent
  /** 技能持有者 */
  player: IPlayer
  /** 游戏全局状态（只读） */
  game: IGameState
  /** 触发此技能的卡牌列表 */
  triggerCards: ICard[]
  /** 关联的伤害事件（如果是伤害触发） */
  damageEvent?: IGameEvent

  /**
   * 正在执行的技能定义
   *
   * 卡牌 `content` 被调用时为 `undefined`（那不是技能）。
   * 有了它，技能才能读自己的 `subSkill` / `marktext`，
   * 而不必把 id 硬编码进 content。
   */
  skill?: ISkill
  /**
   * 持有者对本技能的运行时状态
   *
   * 转换技靠 `convertState` 分岔两态的行为，
   * 记账类技能靠 `usedCount` 判断自己发动过几次。
   */
  skillState?: ISkillRuntimeState

  /**
   * Mod 查询口 —— 「这个数字是多少 / 这件事允不允许」
   *
   * 纯查询，不改状态。技能`content` 里想改数值请发事件，
   * 想让别人改不了请写自己的 `mod`（见 `ISkill.mod`）。
   */
  mods: IModQuery

  // ── 受限写入操作 ──
  drawCards(count: number): Promise<ICard[]>
  discardCards(cards: ICard[]): Promise<void>
  /** 造成伤害 —— 发一条 `damage` 事件并等它结算完 */
  damageTarget(target: IPlayer, amount: number): Promise<void>
  /** 扣减体力 —— 伤害结算的唯一写入点 */
  applyDamage(target: IPlayer, amount: number): Promise<number>
  recoverHp(target: IPlayer, amount: number): Promise<void>
  transferCards(cards: ICard[], target: IPlayer): Promise<void>
  /** 请求玩家响应 —— 暂停流水线，等玩家决策 */
  waitForResponse(prompt: string, options?: ResponseRequest): Promise<EffectResponse>
  /** 触发子事件 —— 在当前事件链中插入一个任意类型的事件 */
  emit(eventDef: {
    name: EventName
    source?: IPlayer
    targets?: IPlayer[]
    cards?: ICard[]
    data?: Record<string, unknown>
    forced?: boolean
    silent?: boolean
  }): Promise<void>

  useCard(card: ICard, targets: IPlayer[]): Promise<void>
  /**
   * 此刻可以「视作」打出的虚拟牌（Phase 16）
   *
   * 出牌之外的场景（响应征询、濒死求桃）都要由内容的作者显式调用它——
   * 「是否需要列出虚拟牌」是那个结算点自己的语义，引擎不该替它猜。
   *
   * @param query.usage     通常是 `'response'`（被问「是否出闪」）或 `'dying'`
   * @param query.requireTag 只要能变成该标签的答案（我要闪 / 我要桃）
   */
  cardViews(query: CardViewQuery): ICardView[]
  judge(player: IPlayer): Promise<ICard>
  obtainCards(target: IPlayer, cards: ICard[]): Promise<void>
  equipCard(card: ICard): Promise<void>
  /** 将延时锦囊放入目标的判定区 */
  placeDelayedCard(card: ICard, target: IPlayer): Promise<void>
  modifyMaxHp(target: IPlayer, delta: number): Promise<void>

  // ── 标记（Phase 19）──
  //
  // 技能写标记**只能**走这里。以前写的是 `ctx.player.setMark(...)`，
  // 那是实体的写入口——Phase 19 把实体的写入口全关了，
  // 内容层因此拿不到第二种写法。读取仍是 `player.getMark()`（无夹取，属读）。
  /** 读取标记值（不存在为 0） */
  getMark(player: IPlayer, key: string): number
  /** 设置标记值 */
  setMark(player: IPlayer, key: string, value: number): void
  /** 增减标记值，返回新值 */
  addMark(player: IPlayer, key: string, delta?: number): number
  /** 清除指定标记 */
  clearMark(player: IPlayer, key: string): void
  /** 记录本回合已使用一次攻击 */
  markAttackUsed(): void
  /**
   * 追加待跳过的阶段 —— 内容层唯一的写法
   *
   * 以前写的是 `ctx.player.shouldSkipPhases.push(GamePhase.PhaseUse)`
   * （乐不思蜀 / 兵粮寸断 / 克己都这么写），那是直接改实体的数组，
   * 绕过了 `PlayerSystem`。现在唯一写法在这里。
   */
  skipPhases(player: IPlayer, phases: GamePhase[]): void

  modifyEffects(
    target: IPlayer,
    addEffects?: string[],
    removeEffects?: string[],
  ): Promise<void>
  /**
   * 觉醒 —— 让目标永久获得一个技能
   *
   * 与 `modifyEffects(target, [id])` 的区别只有一处：**不可回退**。
   * 台账把它记成 permanent 挂载，装备对齐、临时技能到期都摘不掉它。
   */
  awakenSkill(target: IPlayer, skillId: string): Promise<void>
  /** 濒死结算 —— 从濒死者自己开始按座次求桃 */
  settleDying(player: IPlayer, killer?: IPlayer): Promise<boolean>

  /**
   * 一次性监听 —— 「接下来这一次发生 X 时，做 Y」（Phase 17）
   *
   * 与 `ISkill.trigger` 的分工：技能是**长期的**（挂上就一直有效），
   * 而内容里大量出现的是「下次摸牌后…」「本回合结束时…」这种一次性的话。
   * 用技能表达它们要先造一条定义、挂上、再记得摘——忘了摘就是幽灵钩子。
   *
   * ```ts
   * ctx.when('drawEnd').once().then(async (c) => { await c.drawCards(1) }).finish()
   * ```
   *
   * 监听归属于 `ctx.player`，因此过技能放行闸：他死了就不再触发。
   * 不属于任何人的监听请用 `GlobalHookRegistry`。
   */
  when(eventName: EventName): IWhenBuilder
}

// ═══════════════════════════════════════════
// 附属结构
// ═══════════════════════════════════════════

/** 标记的显示信息 */
export interface ISkillIntro {
  /** 标记名 */
  name: string
  /** 按层数生成展示文本 */
  content: (count: number, player: IPlayer) => string
}

/** AI 对某个结果的打分 */
export interface ISkillResult {
  /** 以自己为目标的价值 */
  player?(player: IPlayer): number
  /** 以别人为目标的价值 */
  target?(player: IPlayer, target: IPlayer): number
}

/**
 * AI 决策元数据
 *
 * `order` 是**结算顺序**（数字大的先考虑），与 `priority`（钩子优先级）无关。
 */
export interface ISkillAi {
  /** 结算顺序，数字越大越先被 AI 考虑 */
  order: number
  /** 结果估值：用来选目标 */
  result?: ISkillResult
  /** 威胁度：AI 评估谁最危险时用 */
  threaten?: number
  /** 暴露度：AI 装身份时用 */
  expose?: number
}

// ═══════════════════════════════════════════
// 技能台账
// ═══════════════════════════════════════════

/**
 * 临时技能的持续期
 *
 * 三种简写就是三个事件名：到期 = 该事件在自己身上结算完那一刻。
 * 想更精确就写 `{ event, scope }`——`scope: 'global'` 表示
 * 「任意角色的这个事件结算完就到期」，而不只是自己的。
 */
export type TempSkillDuration =
  | 'turnEnd'
  | 'roundEnd'
  | 'phaseUseEnd'
  | { event: EventName; scope: 'player' | 'global' }

/**
 * 技能台账 —— 「谁拥有哪些技能」的唯一答案
 *
 * 技能**定义**与**持有者**是两件事：定义是全局的（`register`），
 * 持有者是按人的（`attach`）。只有挂到某个人身上，它的触发技与
 * `mod` 才开始生效——这是「装备技随装备装卸自动生效」的实现基础。
 */
export interface ISkillRegistry {
  /** 登记一条技能定义 */
  register(def: ISkill): void
  /** 批量登记 */
  registerAll(defs: Iterable<ISkill>): void
  /** 按 id 取定义（未登记则 undefined） */
  get(id: string): ISkill | undefined

  /** 挂载到玩家（永久） */
  attach(player: IPlayer, skillId: string): void
  /** 卸载（不论来源） */
  detach(player: IPlayer, skillId: string): void

  /** 临时技能：到期自动 `detach` */
  addTempSkill(player: IPlayer, skillId: string, until: TempSkillDuration): void
  /** 提前结束一个临时技能（不是临时的则不动） */
  removeTempSkill(player: IPlayer, skillId: string): void

  /** 觉醒技：永久获得，且不可回退、不可重复 */
  awakenSkill(player: IPlayer, skillId: string): void

  /** 玩家当前持有的全部技能（含装备带来与临时的） */
  getSkills(player: IPlayer): ISkill[]
  /** 是否持有某技能 */
  hasSkill(player: IPlayer, skillId: string): boolean

  // ── 运行时状态（Phase 15）──

  /**
   * 此刻可否发动
   *
   * 回答的是「额度还有没有」：频率没耗尽、限定技没用过、
   * 觉醒技没觉醒过。不含 `filter` —— 那是局面问题，这里只管额度。
   */
  isAvailable(player: IPlayer, skillId: string): boolean

  /** 清零某一档频率的记账 */
  resetFrequency(scope: FrequencyScope): void

  /** 转换技当前态（0 或 1） */
  getConvertState(player: IPlayer, skillId: string): number
  /** 翻转转换技的态，返回翻转后的态 */
  flipConvertState(player: IPlayer, skillId: string): number

  /** 觉醒技是否已觉醒 */
  isAwakened(player: IPlayer, skillId: string): boolean

  // ── 标记（Phase 15）──

  /** 给某技能加标记层数（delta 默认 1），返回加完后的层数 */
  addMark(player: IPlayer, skillId: string, delta?: number): number
  /** 某技能当前的标记层数 */
  countMark(player: IPlayer, skillId: string): number
  /** 清掉某技能的标记 */
  clearMark(player: IPlayer, skillId: string): void
  /**
   * 按 `ISkill.markClear` 清掉该清的标记
   *
   * 不传 scope = 全清。技能的 `markClear` 没写就是永不清，
   * 这是无名杀的默认值——标记本来就该跨回合累积。
   */
  clearMarks(player: IPlayer, scope?: 'turnEnd' | 'roundEnd'): void
}

// ═══════════════════════════════════════════
// ISkill
// ═══════════════════════════════════════════

/**
 * 技能定义
 *
 * 英雄技能、装备效果、卡牌附加能力统一用这一个接口描述。
 * 技能本身独立于载体存在——英雄通过 `effectIds` 引用全局注册表里的技能。
 *
 * **最少只需 `id` + `name` + `description`**，其余全可选。
 * 但至少要给出 `content` / `mod` / `viewAs` 之一，否则它什么事也不做。
 *
 * ── 属性分组 ──
 * - 基础：id, name, description
 * - 分类：enable / locked / forced / limited / awaken / equipSkill / convertible / charlotte
 * - 触发：trigger
 * - 筛选与消耗：filter / filter2 / cost / check
 * - 执行：content
 * - 频率：frequency / usable
 * - 视作：viewAs / filterCard / position / selectCard
 * - 修改器：mod
 * - 标记：mark / marktext / intro
 * - 组合：group / subSkill
 * - AI：ai
 * - 表现：popup / silent / firstDo / priority
 */
export interface ISkill {
  // ── 基础 ──
  /** 技能唯一标识 */
  id: string
  /** 技能名称 */
  name: string
  /** 描述文本 */
  description: string

  // ── 分类属性 ──
  //
  // 布尔矩阵而不是单值枚举：一个技能可以同时是锁定技和限定技。

  /** 主动技：在哪些上下文可以手动发动 */
  enable?: SkillEnableContext[]
  /** 锁定技：满足条件强制发动，不可拒绝 */
  locked?: boolean
  /** 强制技：不可拒绝，但会给提示 */
  forced?: boolean
  /** 限定技：整局只能用一次 */
  limited?: boolean
  /** 觉醒技：满足条件后才解锁 */
  awaken?: boolean
  /** 装备技：随装备获得/失去，不占武将牌格子 */
  equipSkill?: boolean
  /**
   * 转换技：有阴阳两态
   *
   * `true` = 只翻状态；给函数 = 翻转时额外执行一次（如「阳态摸一张」）。
   * 态记在 `ISkillRuntimeState.convertState`，`content` 靠
   * `ctx.skillState?.convertState` 分岔两态的行为。
   */
  convertible?: boolean | ((player: IPlayer, state: number) => void)
  /** 隐藏技：不在武将牌上显示 */
  charlotte?: boolean

  // ── 触发 ──
  trigger?: ISkillTriggerCondition

  // ── 筛选与消耗 ──
  /**
   * 能否发动（必要条件，返回 false 则不发动）
   *
   * 这是**必要条件**：没有 filter = 恒真。
   */
  filter?(ctx: ISkillContext): boolean
  /**
   * 充分条件 —— 对应无名杀的 `filter2`
   *
   * 与 `filter` 的区别：`filter` 卡的是「能不能」，`filter2` 卡的是
   * 「有没有意义」。定义了 `filter2` 时它必须返回 true，
   * 用来过滤掉「发动了也白搭」的局面（如对空场发动群体技能）。
   */
  filter2?(ctx: ISkillContext): boolean
  /**
   * 发动代价 —— 选牌 / 选目标 / 弃牌
   *
   * 在 `content` **之前**执行。cost 里应当完成「支付」，
   * content 里只做效果——这样「代价付了但被打断」才是可追踪的。
   */
  cost?(ctx: ISkillContext): Promise<void>
  /** AI 是否应该发动（与 `filter` 相同，但只影响 AI，不影响合法性） */
  check?(ctx: ISkillContext): boolean

  // ── 执行 ──
  /**
   * 技能效果
   *
   * 可选：只有 `mod` 或只有 `viewAs` 的技能不需要 content。
   */
  content?(ctx: ISkillContext): Promise<void>

  // ── 频率 ──
  /** 默认 `unlimited` */
  frequency?: SkillFrequency
  /**
   * 手动发动的次数上限
   *
   * 与 `frequency` 的区别：`frequency` 管「这一整段时间内一次还是多次」，
   * `usable` 管「具体几次」。返回值的单位跟随 `frequency`。
   */
  usable?: number | ((ctx: ISkillContext) => number)

  // ── 视作 ──
  /**
   * 将一张牌视作另一张牌使用 / 打出
   *
   * **必须给出 `id`**：使用后以卡牌 id 作为事件名分发内容（见
   * `useCardContent`），不写 id 的视图会继承底牌的 id，于是
   * 「红色牌当杀」打出去的是那张红牌自己的内容——看起来什么都没发生。
   * 正确写法是用 `viewLike()` 或直接引用卡牌定义。
   *
   * @param card     被视作的那张真牌（多底牌时是第一张）
   * @param selected 本次选中、将被这张视图消耗的全部底牌
   * @returns 覆盖项；返回 `null` 表示这张牌不可视作
   */
  viewAs?(card: ICard, ctx: IViewAsContext, selected: ICard[]): Partial<ICard> | null
  /** 哪些牌可以被视作（`viewAs` 的预筛选） */
  filterCard?(card: ICard, ctx: IViewAsContext): boolean
  /** 选牌来源区域，默认 `['h']` */
  position?: SkillPosition[]
  /** 需选牌数 */
  selectCard?: SkillSelectCount

  // ── 修改器 ──
  /**
   * 数值 / 布尔修改器
   *
   * 类型与 `IModDefinition.mods` **完全一致**，因此可以零转换地
   * 交给 `ModRegistry` 注册——技能一旦被注册，它的 mod 自动生效，
   * 持有者死亡或失去技能后又自动失效（见 `mod-registry.ts` 的 `owners`）。
   */
  mod?: INumericMods & IBooleanMods

  // ── 标记 ──
  /** 该技能是有层数的标记技 */
  mark?: boolean
  /** 标记的简称 */
  marktext?: string
  /** 标记的显示信息 */
  intro?: ISkillIntro
  /**
   * 标记什么时候清零
   *
   * 不写 = 永不清（无名杀默认值，标记本来就该跨回合累积）。
   * 写了就由引擎在对应的边界上统一清，技能自己不必记得。
   */
  markClear?: 'turnEnd' | 'roundEnd'

  // ── 组合 ──

  /**
   * 同组的其它技能 ID
   *
   * **持有主技能等价于持有组内全部技能**：`attach` 主技能时组里每条
   * 都被递归挂载（组里还能有组），`detach` 主技能时它们跟着一起走。
   * 组内的挂载是**派生**的——它不参与装备区的对齐，归主技能管。
   *
   * 典型用法是「一个技能的两半」：主技能负责被看见，组内技能各自
   * 管一个时机，于是 UI 只显示一个技能而实现是几条。
   */
  group?: string[]
  /**
   * 子技能
   *
   * 键是子技能名，值是**部分** ISkill——未给出的字段继承父技能。
   * 子技能可以有自己的 `content` / `mod` / `viewAs`。
   *
   * 登记时被摊平成独立定义，id 是 `<主技能>_<子技能>`（如
   * `benevolence_give`），**不随主技能自动挂载**：要谁有，就对谁
   * `attach(player, 'benevolence_give')` 或 `addTempSkill(…)`。
   */
  subSkill?: Record<string, Partial<ISkill>>

  // ── AI ──
  ai?: ISkillAi

  // ── 表现 ──
  /** 是否弹窗提示发动 */
  popup?: boolean
  /** 是否静默（不进日志） */
  silent?: boolean
  /** 同类技能中优先结算 */
  firstDo?: boolean
  /** 同时机优先级（越高越先结算），默认 0 */
  priority?: number
}
