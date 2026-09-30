// ============================================================
// 联盟杀 · Mod（数值 / 布尔修改器）契约
//
// 对齐无名杀 `skill.mod`。这是它能支撑上千武将的关键：
// 把「数值怎么算」从「流程怎么走」里彻底剥离出来。
//
// 分工（与 Content / Trigger 三足鼎立）：
//
// | 层 | 回答的问题 | 能不能问玩家 | 能不能发事件 |
// |----|-----------|-------------|-------------|
// | Content | 这件事本身怎么做 | 能 | 能 |
// | Trigger | 某时机额外做什么 | 能 | 能 |
// | **Mod** | **这个数字是多少 / 这件事允不允许** | **不能** | **不能** |
//
// Mod 是**纯函数**：只读 `ctx`，不许改状态、不许发事件、不许 `await`。
// 这条不是君子协定——`ModRegistry` 会把 `ctx.game` 包成只读代理，
// 任何写入都抛 `ModPurityError`（见 `core/skill/mod-registry.ts`）。
//
// 为什么要这么狠：Mod 会在**一次非要害查询里被反复调用**
// （距离、攻击范围、能不能出这张牌 ……）。一旦允许它改状态或暂停，
// 「查询」就变成了「结算」，确定性随即崩塌。
// ============================================================

import type { GamePhase, DamageType } from './enums'
import type { IPlayer } from './player.interface'
import type { ICard } from './card.interface'
import type { IGameState } from './game.interface'
import type { IGameEvent } from './event.interface'

// ── 负载 ──

/**
 * 伤害类 Mod 的负载
 *
 * 四个伤害钩子共用同一份，`ctx.player` 才区分「这次算的是谁的视角」。
 */
export interface DamageModPayload {
  /** 伤害来源（闪电等无来源时为 undefined） */
  source?: IPlayer
  /** 受伤者 */
  target: IPlayer
  /** 造成伤害的牌 */
  card?: ICard
  /** 伤害属性 */
  nature: DamageType
}

// ── 上下文 ──

/**
 * 修改器上下文 —— 只读快照
 *
 * - `player` 是**本次查询的主体**（算谁的距离、谁的伤害、谁的手牌上限）
 * - `owner` 是**这个 Mod 的持有者**（可以理解为 Mod 函数里的「我」）
 *
 * 两者多数时候相等（`attackRange` / `distanceFrom` / `cardUsable` …），
 * 但伤害的四个钩子里刻意区分：算 `damageFrom` 时 player 是来源，
 * 算 `damageTo` 时 player 是受伤者，而 owner 恒为持有者本人。
 */
export interface ModContext {
  /** 被计算数值的归属玩家 */
  player: IPlayer
  /** Mod 持有者（全局 Mod 为 undefined） */
  owner?: IPlayer
  /** 游戏状态（只读代理，写入会抛错） */
  game: IGameState
  /** 触发本次查询的事件（若有） */
  event?: IGameEvent
  /** 扩展负载，由调用方注入 */
  payload?: Record<string, unknown>
}

// ── 参数表 ──
//
// 单独维护一张参数表，而不是从函数签名里推导。
// 推导要靠 `infer`，但 Mod 的首参类型各不相同（number / ICard / string / GamePhase），
// 在 `strictFunctionTypes` 下条件类型会退化成 `never`，签名就全废了。
// 显式表反而确保了「Mod 函数签名」与「查询入参」永远一致。

export interface NumericModArgsMap {
  damageFrom: [payload: DamageModPayload]
  damageTo: [payload: DamageModPayload]
  globalDamageFrom: [payload: DamageModPayload]
  globalDamageTo: [payload: DamageModPayload]
  attackRange: []
  maxHandcard: []
  maxHp: []
  distanceFrom: [to: IPlayer]
  distanceTo: [from: IPlayer]
  drawCount: []
  cardUsable: [card: ICard]
  selectTarget: [card: ICard]
}

export interface BooleanModArgsMap {
  cardEnabled: [card: ICard]
  cardRespondable: [card: ICard]
  cardSavable: [card: ICard]
  cardDiscardable: [card: ICard]
  cardCancelable: [card: ICard]
  targetEnabled: [card: ICard, target: IPlayer]
  targetInRange: [card: ICard, target: IPlayer]
  skillEnabled: [skillId: string]
  phaseSkippable: [phase: GamePhase]
}

/** 数值 Mod 函数签名：`(当前值, ctx, 附加参数) => 新值` */
export type NumericMod<K extends keyof NumericModArgsMap> = (
  value: number,
  ctx: ModContext,
  ...args: NumericModArgsMap[K]
) => number

/** 布尔 Mod 函数签名：`(当前值, ctx, 附加参数) => 新值` */
export type BooleanMod<K extends keyof BooleanModArgsMap> = (
  value: boolean,
  ctx: ModContext,
  ...args: BooleanModArgsMap[K]
) => boolean

// ── Mod 集合 ──

/**
 * 数值型修改器：累加语义
 *
 * 每个钩子按 `resolveModOrder` 排定的顺序依次把值传下去——
 * 后来的那个看到的是前一个改完的结果。
 */
export interface INumericMods {
  /** 我造成的伤害 */
  damageFrom?: NumericMod<'damageFrom'>
  /** 我受到的伤害 */
  damageTo?: NumericMod<'damageTo'>
  /** 任意角色造成的伤害（持有者限制放宽，但仍有持有者） */
  globalDamageFrom?: NumericMod<'globalDamageFrom'>
  /** 任意角色受到的伤害 */
  globalDamageTo?: NumericMod<'globalDamageTo'>
  /** 攻击范围 */
  attackRange?: NumericMod<'attackRange'>
  /** 手牌上限 */
  maxHandcard?: NumericMod<'maxHandcard'>
  /** 体力上限 */
  maxHp?: NumericMod<'maxHp'>
  /** 我计算到他人的距离 */
  distanceFrom?: NumericMod<'distanceFrom'>
  /** 他人计算到我的距离 */
  distanceTo?: NumericMod<'distanceTo'>
  /** 摸牌阶段的摸牌数 */
  drawCount?: NumericMod<'drawCount'>
  /** 某张牌本回合可使用次数（返回 `Infinity` 表示无限） */
  cardUsable?: NumericMod<'cardUsable'>
  /** 一张牌能选择的目标数 */
  selectTarget?: NumericMod<'selectTarget'>
}

/**
 * 布尔型修改器：否决语义
 *
 * 任一 Mod 返回 `false` 即 `false`；全部返回 true 才 true。
 * 注意：**无法反过来把 false 变 true**——这是刻意的，
 * 「不允许」应该是一票否决，不该被某个移除 Reserved Word 的边缘乞求翻盘。
 */
export interface IBooleanMods {
  /** 这张牌能否使用 */
  cardEnabled?: BooleanMod<'cardEnabled'>
  /** 这张牌能否用于响应 */
  cardRespondable?: BooleanMod<'cardRespondable'>
  /** 这张牌能否用于救（濒死） */
  cardSavable?: BooleanMod<'cardSavable'>
  /** 这张牌能否被弃置 */
  cardDiscardable?: BooleanMod<'cardDiscardable'>
  /** 这张牌能否被无懈可击（清单 #13） */
  cardCancelable?: BooleanMod<'cardCancelable'>
  /** 该目标是否合法 */
  targetEnabled?: BooleanMod<'targetEnabled'>
  /** 该目标是否在范围内 */
  targetInRange?: BooleanMod<'targetInRange'>
  /** 该技能是否可用 */
  skillEnabled?: BooleanMod<'skillEnabled'>
  /** 该阶段能否被跳过 */
  phaseSkippable?: BooleanMod<'phaseSkippable'>
}

/**
 * Mod 定义
 *
 * 一条定义可以同时提供多个钩子（藤甲 `damageTo` + `cardEnabled` 很常见）。
 */
export interface IModDefinition {
  /** 全局唯一 ID（同名重复注册会覆盖并告警） */
  id: string
  /** 修改器集合 */
  mods: INumericMods & IBooleanMods
  /** 优先级，越大越先算（默认 0） */
  priority?: number
  /**
   * 生效条件
   *
   * 在「持有者判定」之后、`owners` 过滤之后执行，
   * 不满足则该 Mod 本次不参与计算。
   */
  filter?: (ctx: ModContext) => boolean
  /**
   * 本次计算的**持有者列表**
   *
   * 省略 = 全局 Mod，与谁持有无关，恒参与计算。
   * 返回空数组 = 当前无人持有，本次不生效。
   *
   * 这是「Mod 随持有者自动失效」的实现方式——不要在此处**缓存**，
   * 每次都从当前局面现算：卸下装备、失去技能、角色死亡，下一次查询
   * 就自动不再命中它，不需要任何清理代码。
   */
  owners?: (ctx: ModContext) => IPlayer[]
}

/**
 * Mod 注册表
 *
 * 查询接口刻意保留 `(key, base, ctx, ...args)` 形状：
 * 真正好用的语义封装在 `ModQuery`（`core/skill/mod-query.ts`）里，
 * 业务代码不该裸调这里。
 */
export interface IModRegistry {
  /** 注册（同名覆盖并告警） */
  register(def: IModDefinition): void
  /** 批量注册 */
  registerAll(defs: Iterable<IModDefinition>): void
  /** 注销，返回是否确有其项 */
  unregister(id: string): boolean
  /** 清空 */
  clear(): void
  /** 已注册数量 */
  readonly size: number
  /** 查询数值：base 依次经过所有匹配的 Mod */
  queryNumeric<K extends keyof INumericMods>(
    key: K,
    base: number,
    ctx: ModContext,
    ...args: NumericModArgsMap[K]
  ): number
  /** 查询布尔：任一 Mod 返回 false 即 false */
  queryBoolean<K extends keyof IBooleanMods>(
    key: K,
    base: boolean,
    ctx: ModContext,
    ...args: BooleanModArgsMap[K]
  ): boolean
}

/**
 * Mod 查询门面
 *
 * 把「键 + 主体 + 负载」翻译成一次注册表查询。 EffectContext / 各系统
 * 只认识这个接口，不认识注册表本身。
 */
export interface IModQuery {
  // ── 数值 ──
  /** 伤害必经的总管道：来自两人的四个钩子依次作用 */
  damage(
    base: number,
    source: IPlayer | undefined,
    target: IPlayer,
    card: ICard | undefined,
    nature?: DamageType,
    event?: IGameEvent,
  ): number
  attackRange(player: IPlayer, event?: IGameEvent): number
  maxHandcard(player: IPlayer, event?: IGameEvent): number
  maxHp(player: IPlayer, event?: IGameEvent): number
  drawCount(player: IPlayer, event?: IGameEvent): number
  cardUsable(player: IPlayer, card: ICard, base?: number, event?: IGameEvent): number
  selectTarget(player: IPlayer, card: ICard, base: number, event?: IGameEvent): number
  /** 我算到他人的距离（供 DistanceSystem 回调） */
  distanceFrom(from: IPlayer, to: IPlayer, base: number, event?: IGameEvent): number
  /** 他人算到我的距离（供 DistanceSystem 回调） */
  distanceTo(to: IPlayer, from: IPlayer, base: number, event?: IGameEvent): number

  // ── 供 DistanceSystem / TargetSystem 直接回调的变体 ──
  //
  // 上面三个带 `event?` 的方法是**内容层**用的；这两个系统要的是
  // 「拿到基础值、返回修正值」的形状（`attackRangeOf` / `distanceFromOf` /
  // `distanceToOf` / `selectTargetOf` / `targetEnabledOf` / `targetInRangeOf`）。
  // 实现早已在 `ModQuery` 上，但接口里没声明——于是 `IModQuery`
  // 类型上「看不出」它能当 `DistanceMods & TargetMods` 用，
  // 那两个系统只能被测试单独喂一个具体类，生产侧接不上线（欠账 D3 / D4）。
  attackRangeOf(player: IPlayer, base: number): number
  distanceFromOf(from: IPlayer, to: IPlayer, base: number): number
  distanceToOf(to: IPlayer, from: IPlayer, base: number): number
  selectTargetOf(source: IPlayer, card: ICard, base: number): number
  targetEnabledOf(source: IPlayer, card: ICard, target: IPlayer): boolean
  targetInRangeOf(source: IPlayer, card: ICard, target: IPlayer): boolean

  // ── 布尔 ──
  cardEnabled(player: IPlayer, card: ICard, event?: IGameEvent): boolean
  cardRespondable(player: IPlayer, card: ICard, event?: IGameEvent): boolean
  cardSavable(player: IPlayer, card: ICard, event?: IGameEvent): boolean
  cardDiscardable(player: IPlayer, card: ICard, event?: IGameEvent): boolean
  cardCancelable(player: IPlayer, card: ICard, event?: IGameEvent): boolean
  targetEnabled(player: IPlayer, card: ICard, target: IPlayer, event?: IGameEvent): boolean
  targetInRange(player: IPlayer, card: ICard, target: IPlayer, event?: IGameEvent): boolean
  skillEnabled(player: IPlayer, skillId: string, event?: IGameEvent): boolean
  phaseSkippable(player: IPlayer, phase: GamePhase, event?: IGameEvent): boolean
}
