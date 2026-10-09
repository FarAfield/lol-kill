// ============================================================
// 联盟杀 · AI 决策策略 — Beginner / Normal / Hard
//
// 采用策略模式，每种难度实现 IAIDecisionMaker 接口。
// 引擎通过 AIController 将决策请求路由到对应策略。
//
// 设计原则：
// - 策略不持有可变状态（无副作用，每次调用独立）
// - 所有决策基于传入的 state 快照
// - 难度越高，考虑的维度越多（身份、距离、手牌管理）
// ============================================================

import type { IAIDecisionMaker, AICardChoice } from '@core/contracts/ai.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { CardTagValue } from '@core/contracts/card-tag'
import type { ISkill, ISkillRegistry } from '@core/contracts/skill.interface'
import type { CardPlayOption } from '@core/contracts/services.interface'
import {
  aiOrderOf,
  aiTargetValueOf,
  aiValueOf,
  exposeOf,
  isDeclinableSkill,
  isManualSkill,
  skillPriority,
  threatenOf,
} from '@core/skill/skill-utils'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import type { IRandomService } from '@core/contracts/services.interface'
import { SeededRandomService, randomSeed } from './seeded-random'
import { CardBudget } from '@core/skill/card-budget'
import { DamageResolver } from '@core/system/damage-resolver'
import type { IModQuery } from '@core/contracts/mod.interface'
import { RoleType, ZoneType } from '@core/contracts/enums'

// ============================================================
// 工具函数
// ============================================================

/**
 * 策略需要的**引擎侧查询口**
 *
 * 三样都是「AI 出生时还不存在、只能事后补」的东西：AI 要先被当成
 * 决策服务传进 `GameBoot`，那时引擎还没构造完。因此它们一律**可缺席**——
 * 缺了就退回无 Mod 知识的旧行为，而不是崩。
 *
 * 收成一个对象而不是四个位置参数：`createAIStrategy(diff, random,
 * undefined, undefined)` 这种调用点读不出来哪个 `undefined` 是什么。
 */
export interface AIStrategyDeps {
  /** 出牌额度（D8） */
  budget?: CardBudget
  /** Mod 查询（D19） */
  mods?: IModQuery
  /** 技能台账（D21：读别人的 `ai.threaten`） */
  skills?: ISkillRegistry
}

/**
 * 获取存活玩家列表。
 */
function getAlivePlayers(state: GameStateSnapshot): IPlayer[] {
  return state.players.filter((p) => p.alive)
}

/**
 * 获取其他存活玩家列表（排除自己）。
 */
function getOtherAlivePlayers(player: IPlayer, state: GameStateSnapshot): IPlayer[] {
  return state.players.filter((p) => p.alive && p.id !== player.id)
}

/**
 * 判断 target 是否为 player 的敌人。
 *
 * 规则：
 * - Aspect / Guardian 互为盟友
 * - Ascended 对所有非 Ascended 是敌人
 * - Infiltrator 对所有角色都是敌人
 * - 未公开身份的角色视为潜在敌人（除非同队已确定）
 */
function isEnemy(player: IPlayer, target: IPlayer): boolean {
  if (player.id === target.id) return false

  const myRole = player.role
  const theirRole = target.role

  // Infiltrator considers everyone an enemy
  if (myRole === RoleType.Infiltrator) return true
  if (theirRole === RoleType.Infiltrator) return true

  // Both roles known — use explicit rules
  if (myRole && theirRole) {
    if (myRole === RoleType.Aspect || myRole === RoleType.Guardian) {
      return theirRole === RoleType.Ascended
    }
    if (myRole === RoleType.Ascended) {
      return theirRole === RoleType.Aspect || theirRole === RoleType.Guardian
    }
  }

  // If target's role is revealed:
  if (theirRole && target.roleRevealed) {
    if (myRole === RoleType.Aspect || myRole === RoleType.Guardian) {
      return theirRole === RoleType.Ascended
    }
    if (myRole === RoleType.Ascended) {
      return theirRole === RoleType.Aspect || theirRole === RoleType.Guardian
    }
  }

  // Unknown role → treat as potential enemy (cautious)
  if (myRole === RoleType.Aspect || myRole === RoleType.Guardian) {
    return !target.roleRevealed || (target.role !== RoleType.Aspect && target.role !== RoleType.Guardian)
  }
  if (myRole === RoleType.Ascended) {
    return !target.roleRevealed || (target.role !== RoleType.Ascended)
  }

  return true
}

/**
 * 判断 target 是否为 player 的盟友。
 */
function isAlly(player: IPlayer, target: IPlayer): boolean {
  if (player.id === target.id) return true
  return !isEnemy(player, target)
}

/**
 * 卡牌价值评估（0–100）。
 *
 * 用于 Normal+ AI 在弃牌时选择保留高价值卡牌。
 */
function getCardValue(card: ICard): number {
  const tags = card.tags

  if (tags.has(CardTag.Heal)) return 90
  if (tags.has(CardTag.Dodge)) return 60
  if (tags.has(CardTag.Strike)) return 50
  if (tags.has(CardTag.Wine)) return 45

  // 锦囊牌
  if (tags.has(CardTag.Counter)) return 85
  if (tags.has(CardTag.SomethingFromNothing)) return 80
  if (tags.has(CardTag.Snatch)) return 75
  if (tags.has(CardTag.Dismantle)) return 75
  if (tags.has(CardTag.BarbarianRaid)) return 65
  if (tags.has(CardTag.ArrowBarrage)) return 60
  if (tags.has(CardTag.Duel)) return 55
  if (tags.has(CardTag.BorrowedBlade)) return 55
  if (tags.has(CardTag.BountifulHarvest)) return 50
  if (tags.has(CardTag.PeachGardenOath)) return 45

  // 延时锦囊
  if (card.isDelayed) return 35

  // 装备牌
  if (tags.has(CardTag.Equip) || card.equipSlot) return 40

  return 30
}

// ============================================================
// 基础 AI 策略（抽象基类）
// ============================================================

/**
 * 基础 AI 策略 —— 提供共享的工具方法。
 *
 * 子类只需覆写决策方法即可实现不同难度。
 *
 * `random` 是注入进来的随机源：AI 在「几张牌差不多好」时要随机挑一张，
 * 这个随机和对局走向直接相关，**必须**可复现，否则录像永远放不回去。
 */
export abstract class BaseAIStrategy implements IAIDecisionMaker {
  /**
   * AI 自己的随机源
   *
   * 刻意与引擎洗牌用的那条流**分开**：回放时没有 AI 参与，
   * 共用一条流的话两边消耗的次数不同，洗牌序列会整体错位。
   */
  protected readonly random: IRandomService

  /**
   * 出牌额度查询 —— 「这张牌还能用几次」的唯一判定口
   *
   * 早先这里问的是 `player.canAttack`（读 `attackLimit`），与出牌阶段
   * 走的 `mod.cardUsable` 不是一个数：连弩装上去以后，出牌选项说可以
   * 无限出，AI 却因为 `attackLimit` 还停在 1 而不肯出第二刀（欠账 D8）。
   */
  protected readonly budget: CardBudget | undefined

  /**
   * Mod 查询口 —— 「这张牌打这个人真的会造成几点伤害」的唯一答案
   *
   * 没有它，AI 只能按牌面想当然：藤甲挨火杀是 2 点血，它却当成 1 点，
   * 于是挑目标时看不出「这一刀下去人就死了」。易伤 / 减伤 / 加伤
   * 全是 Mod 上的事，AI 不必认识任何一个具体防具。
   */
  protected readonly mods: IModQuery | undefined

  /**
   * 技能台账 —— 「谁身上有哪些技能」的唯一答案
   *
   * 评估一个**别人**有多危险要读它：威胁度写在各自的技能定义上
   * （`ai.threaten`），AI 自己不该记一份「哪个武将厉害」的名单。
   */
  protected readonly skills: ISkillRegistry | undefined

  constructor(random?: IRandomService, deps: AIStrategyDeps = {}) {
    this.random = random ?? new SeededRandomService(randomSeed())
    this.budget = deps.budget
    this.mods = deps.mods
    this.skills = deps.skills
  }

  // ── 实现 IAIDecisionMaker ──

  abstract chooseCardToPlay(
    player: IPlayer,
    state: GameStateSnapshot,
    options?: readonly CardPlayOption[],
  ): AICardChoice | null

  abstract chooseEffectToUse(
    player: IPlayer,
    availableEffects: ISkill[],
    state: GameStateSnapshot,
  ): ISkill | null

  abstract chooseCardsToDiscard(
    player: IPlayer,
    count: number,
    state: GameStateSnapshot,
  ): ICard[]

  chooseHero(
    _player: IPlayer,
    candidates: { id: string; name: string; title: string; kingdom: string }[],
    selectCount: number,
    _state: GameStateSnapshot,
  ): string[] {
    // 默认随机选择指定数量的英雄
    const shuffled = this.random.shuffle(candidates)
    return shuffled.slice(0, selectCount).map((c) => c.id)
  }

  abstract respondToDefend(
    player: IPlayer,
    validCards: ICard[],
    state: GameStateSnapshot,
  ): ICard | null

  respondToDying(
    _player: IPlayer,
    dyingPlayer: IPlayer,
    validCards: ICard[],
    _state: GameStateSnapshot,
  ): ICard | null {
    // 默认逻辑：对自己或盟友使用桃
    // 先检查是否有桃
    const heal = validCards.find((c) => c.tags.has(CardTag.Heal))
    if (!heal) return null

    // 如果是自己濒死，或者盟友濒死，使用桃
    if (dyingPlayer.id === _player.id || isAlly(_player, dyingPlayer)) {
      return heal
    }

    return null
  }

  respondWithEffect(
    _player: IPlayer,
    _availableEffects: ISkill[],
    _state: GameStateSnapshot,
  ): ISkill | null {
    return null
  }

  chooseEffectTargets(
    _player: IPlayer,
    _effect: ISkill,
    candidates: IPlayer[],
    _state: GameStateSnapshot,
  ): IPlayer[] {
    // 默认选择所有候选人（子类可覆写）
    return candidates
  }

  chooseEffectCards(
    _player: IPlayer,
    _effect: ISkill,
    candidates: ICard[],
    _state: GameStateSnapshot,
  ): ICard[] {
    return candidates
  }

  // ── 共享工具方法 ──

  protected getCardValue(card: ICard): number {
    return getCardValue(card)
  }

  protected isEnemy(player: IPlayer, target: IPlayer): boolean {
    return isEnemy(player, target)
  }

  protected isAlly(player: IPlayer, target: IPlayer): boolean {
    return isAlly(player, target)
  }

  protected canPlayCard(player: IPlayer, card: ICard): boolean {
    // 没注入额度查询（纯策略单测）时一律放行，与 `modQuery` 缺席的约定一致
    return this.budget?.canPlay(player, card) ?? true
  }

  protected getAlivePlayers(state: GameStateSnapshot): IPlayer[] {
    return getAlivePlayers(state)
  }

  protected getOtherAlivePlayers(player: IPlayer, state: GameStateSnapshot): IPlayer[] {
    return getOtherAlivePlayers(player, state)
  }

  protected shuffle<T>(array: readonly T[]): T[] {
    return this.random.shuffle(array)
  }

  protected pickRandom<T>(array: readonly T[]): T | null {
    if (array.length === 0) return null
    return array[this.random.nextInt(0, array.length - 1)]!
  }

  /**
   * 查找手牌中匹配指定 tag 的卡牌。
   */
  protected findCardByTag(player: IPlayer, tag: CardTagValue): ICard | undefined {
    return player.handCards.find((c) => c.tags.has(tag) && c.zone === ZoneType.Hand)
  }

  /**
   * 获取玩家手牌中可打出的卡牌（非延时、在手牌区）。
   *
   * **只翻手牌**——视作造出来的虚拟牌不在 `handCards` 里，
   * 要连它们一起看就得用 {@link playContext} 拿引擎给的候选。
   */
  protected getPlayableHandCards(player: IPlayer): ICard[] {
    return player.handCards.filter((c) => c.zone === ZoneType.Hand && !c.isDelayed)
  }

  /**
   * 一次出牌决策的候选视图
   *
   * 两样东西都只从引擎给的 `options` 读，AI 自己不算第二遍：
   *
   * - **能打什么**：真手牌在前，视作造出来的虚拟牌在后。
   *   虚拟牌不在 `handCards` 里，翻手牌永远翻不到它——【武圣】
   *   把红牌当杀、【丈八蛇矛】把两张手牌当杀，此前 AI 一张都用不上。
   * - **这张牌能打谁**：已经过了距离、攻击范围与目标否决，
   *   因此「挑一个够不着的人」这件事在这里就不可能发生了。
   *
   * 没给 `options` 时（纯策略单测）退回手牌 + 其他存活玩家，
   * 行为与接线前一致。
   */
  protected playContext(
    player: IPlayer,
    state: GameStateSnapshot,
    options?: readonly CardPlayOption[],
  ): {
    /** 此刻能打出的牌 */
    cards: ICard[]
    /** 这张牌此刻的合法目标 */
    targetsOf: (card: ICard) => IPlayer[]
  } {
    if (!options) {
      const fallback = this.getPlayableHandCards(player)
      return {
        cards: fallback,
        targetsOf: () => this.getOtherAlivePlayers(player, state),
      }
    }

    // 虚拟牌的 instanceId 由「技能 + 底牌」推导出来，每次问都一样，
    // 因此拿它当 key 是稳的（见 `Card.createVirtual`）。
    const byCard = new Map(options.map((o) => [o.card.instanceId, o.validTargets]))
    return {
      cards: options.map((o) => o.card),
      targetsOf: (card) => byCard.get(card.instanceId) ?? [],
    }
  }

  /**
   * 这张牌此刻能打到的人里，哪些是敌人
   *
   * 自标牌（装备 / 桃 / 酒 / 无中生有）的合法目标本来就只有自己，
   * 去掉自己后就空了——不会因此被误当成「没有敌人可用」。
   */
  protected enemiesAmong(player: IPlayer, candidates: IPlayer[]): IPlayer[] {
    return candidates.filter((p) => p.id !== player.id && this.isEnemy(player, p))
  }

  /**
   * 获取手牌中指定 tag 的所有卡牌。
   */
  protected getCardsByTag(player: IPlayer, tag: CardTagValue): ICard[] {
    return player.handCards.filter(
      (c) => c.tags.has(tag) && c.zone === ZoneType.Hand,
    )
  }

  /**
   * 按价值升序排列卡牌（最低价值在前，用于弃牌选择）。
   */
  protected sortByValueAsc(cards: ICard[]): ICard[] {
    return [...cards].sort((a, b) => getCardValue(a) - getCardValue(b))
  }

  /**
   * 按价值降序排列卡牌（最高价值在前）。
   */
  protected sortByValueDesc(cards: ICard[]): ICard[] {
    return [...cards].sort((a, b) => getCardValue(b) - getCardValue(a))
  }
}

// ============================================================
// 新手 AI —— 随机决策
// ============================================================

/**
 * 新手 AI 策略。
 *
 * 特点：
 * - 随机出牌
 * - 有响应必出（简化逻辑）
 * - 不考虑身份/距离/手牌管理
 */
export class BeginnerAIStrategy extends BaseAIStrategy {
  chooseCardToPlay(
    player: IPlayer,
    state: GameStateSnapshot,
    options?: readonly CardPlayOption[],
  ): AICardChoice | null {
    const { cards, targetsOf } = this.playContext(player, state, options)
    if (cards.length === 0) return null

    // 随机选择一张卡牌
    const card = this.pickRandom(cards)
    if (!card) return null

    // 目标也从这张牌自己的合法目标里随机挑一个。
    //
    // 不必再按牌型分支（「桃给自己、杀给别人」）——合法目标已经
    // 回答了这件事：自标牌的合法目标就是自己，攻击牌的已经按距离
    // 筛过。这里唯一要守的是「别挑打不着的人」，而那是 `targetsOf`
    // 的事。
    const target = this.pickRandom(targetsOf(card))
    return { card, targets: target ? [target] : [] }
  }

  chooseEffectToUse(
    _player: IPlayer,
    availableEffects: ISkill[],
    _state: GameStateSnapshot,
  ): ISkill | null {
    // 随机选择一个可用效果
    const activeEffects = availableEffects.filter((e) => isManualSkill(e))
    return this.pickRandom(activeEffects)
  }

  chooseCardsToDiscard(player: IPlayer, count: number, _state: GameStateSnapshot): ICard[] {
    // 随机弃牌
    const handCards = player.handCards.filter((c) => c.zone === ZoneType.Hand)
    const shuffled = this.shuffle(handCards)
    return shuffled.slice(0, Math.min(count, shuffled.length))
  }

  respondToDefend(
    _player: IPlayer,
    validCards: ICard[],
    _state: GameStateSnapshot,
  ): ICard | null {
    // 有可用的防御牌就出
    const dodge = validCards.find((c) => c.tags.has(CardTag.Dodge))
    if (dodge) return dodge
    // 随机选一张
    return this.pickRandom(validCards)
  }
}

// ============================================================
// 普通 AI —— 基本战术
// ============================================================

/**
 * 普通 AI 策略。
 *
 * 特点：
 * - 优先出杀
 * - 保留闪/桃
 * - 基本敌人/盟友判断
 * - 按价值弃牌（保留高价值卡牌）
 */
export class NormalAIStrategy extends BaseAIStrategy {
  chooseCardToPlay(
    player: IPlayer,
    state: GameStateSnapshot,
    options?: readonly CardPlayOption[],
  ): AICardChoice | null {
    const { cards, targetsOf } = this.playContext(player, state, options)
    if (cards.length === 0) return null

    // 敌人是**按牌**算的：这张牌够得着谁，才谈得上打谁。
    const enemiesOf = (card: ICard) => this.enemiesAmong(player, targetsOf(card))

    // 出牌阶段策略：
    // 1. 装备牌优先（直接装备）
    const equipCard = cards.find((c) => c.tags.has(CardTag.Equip) || c.equipSlot)
    if (equipCard) {
      return { card: equipCard, targets: targetsOf(equipCard) }
    }

    // 2. 桃/酒：仅在受伤时使用
    if (player.isWounded) {
      const heal = cards.find((c) => c.tags.has(CardTag.Heal))
      if (heal && targetsOf(heal).includes(player)) {
        return { card: heal, targets: [player] }
      }
      // 酒也可以在出牌阶段对自己使用
      const wine = cards.find((c) => c.tags.has(CardTag.Wine) && !c.tags.has(CardTag.Strike))
      if (wine && targetsOf(wine).includes(player)) {
        return { card: wine, targets: [player] }
      }
    }

    // 3. 优先使用增益类锦囊（无中生有、五谷丰登、桃园结义）
    const buffTrick = cards.find(
      (c) =>
        c.tags.has(CardTag.SomethingFromNothing) ||
        c.tags.has(CardTag.BountifulHarvest) ||
        c.tags.has(CardTag.PeachGardenOath),
    )
    if (buffTrick) {
      return { card: buffTrick, targets: targetsOf(buffTrick) }
    }

    // 4. 杀：攻击敌人
    const strike = cards.find((c) => c.tags.has(CardTag.Strike))
    if (strike && this.canPlayCard(player, strike)) {
      const enemies = enemiesOf(strike)
      if (enemies.length > 0) {
        // 优先攻击受伤的敌人
        const woundedEnemy = enemies.find((e) => e.isWounded)
        const target = woundedEnemy ?? this.pickRandom(enemies)
        if (target) return { card: strike, targets: [target] }
      }
    }

    // 5. 控制类锦囊（顺手牵羊、过河拆桥、决斗等）——攻击敌人
    const controlTricks = cards.filter(
      (c) =>
        c.tags.has(CardTag.Snatch) ||
        c.tags.has(CardTag.Dismantle) ||
        c.tags.has(CardTag.Duel) ||
        c.tags.has(CardTag.BorrowedBlade),
    )
    const controlTarget = controlTricks
      .map((trick) => ({ trick, enemies: enemiesOf(trick) }))
      .find((c) => c.enemies.length > 0)
    if (controlTarget) {
      const target = this.pickRandom(controlTarget.enemies)
      if (target) return { card: controlTarget.trick, targets: [target] }
    }

    // 6. AOE 锦囊（南蛮入侵、万箭齐发）——有多个敌人时使用
    if (this.enemiesAmong(player, getAlivePlayers(state)).length >= 2) {
      const aoe = cards.find(
        (c) => c.tags.has(CardTag.BarbarianRaid) || c.tags.has(CardTag.ArrowBarrage),
      )
      if (aoe) {
        return { card: aoe, targets: targetsOf(aoe) }
      }
    }

    // 7. 延时锦囊 → 对敌人使用
    const delayed = cards
      .filter((c) => c.isDelayed)
      .map((card) => ({ card, enemies: enemiesOf(card) }))
      .find((c) => c.enemies.length > 0)
    if (delayed) {
      const target = this.pickRandom(delayed.enemies)
      if (target) return { card: delayed.card, targets: [target] }
    }

    return null
  }

  chooseEffectToUse(
    _player: IPlayer,
    availableEffects: ISkill[],
    _state: GameStateSnapshot,
  ): ISkill | null {
    const active = availableEffects.filter((e) => isManualSkill(e))
    if (active.length === 0) return null

    // 先按 `ai.order`（AI 的考虑顺序）排，同序再比 `priority`。
    // `ai.order` 是「AI 先盘算谁」，`priority` 是「同时机谁先结算」——
    // 两件事，不能互相顶替。
    const sorted = [...active].sort(
      (a, b) => aiOrderOf(b) - aiOrderOf(a) || skillPriority(b) - skillPriority(a),
    )
    return sorted[0] ?? null
  }

  chooseCardsToDiscard(player: IPlayer, count: number, _state: GameStateSnapshot): ICard[] {
    const handCards = player.handCards.filter((c) => c.zone === ZoneType.Hand)
    // 按价值升序排列，弃置价值最低的牌
    const sorted = this.sortByValueAsc(handCards)
    return sorted.slice(0, Math.min(count, sorted.length))
  }

  respondToDefend(
    _player: IPlayer,
    validCards: ICard[],
    _state: GameStateSnapshot,
  ): ICard | null {
    // 优先出闪
    const dodge = validCards.find((c) => c.tags.has(CardTag.Dodge))
    if (dodge) return dodge
    // 有桃也可以考虑（濒死场景由 respondToDying 处理）
    // 如果没有闪，不出
    return null
  }

  respondToDying(
    player: IPlayer,
    dyingPlayer: IPlayer,
    validCards: ICard[],
    _state: GameStateSnapshot,
  ): ICard | null {
    const heal = validCards.find((c) => c.tags.has(CardTag.Heal))
    if (!heal) return null

    // 自己濒死 → 一定用桃
    if (dyingPlayer.id === player.id) return heal

    // 盟友濒死 → 用桃
    if (this.isAlly(player, dyingPlayer)) return heal

    // 敌人濒死 → 不用桃
    return null
  }

  respondWithEffect(
    _player: IPlayer,
    availableEffects: ISkill[],
    _state: GameStateSnapshot,
  ): ISkill | null {
    // 锁定技 / 强制技**不接受也不拒绝**：它已经发动了，
    // 把它列进「要不要响应」的候选里是给 AI 一个并不存在的否决权。
    const usable = availableEffects.filter(isDeclinableSkill)
    if (usable.length === 0) return null
    const sorted = [...usable].sort((a, b) => skillPriority(b) - skillPriority(a))
    return sorted[0] ?? null
  }
}

// ============================================================
// 困难 AI —— 进阶战术
// ============================================================

/**
 * 困难 AI 策略。
 *
 * 特点：
 * - 考虑身份和阵营（优先攻击主公/公开敌人）
 * - 手牌管理（保留关键牌）
 * - 距离控制（考虑武器/马）
 * - 目标优先级（受伤 > 手牌少 > 关键角色）
 * - 适时保留无懈可击等防御牌
 * - 判断是否值得使用 AOE
 */
export class HardAIStrategy extends BaseAIStrategy {
  chooseCardToPlay(
    player: IPlayer,
    state: GameStateSnapshot,
    options?: readonly CardPlayOption[],
  ): AICardChoice | null {
    const { cards, targetsOf } = this.playContext(player, state, options)
    if (cards.length === 0) return null

    const allAlive = this.getAlivePlayers(state)
    // 敌人按牌算：够得着才谈得上威胁
    const enemiesOf = (card: ICard) => this.enemiesAmong(player, targetsOf(card))

    // 1. 装备牌优先（立即提升战力）
    const equipCard = cards.find((c) => c.tags.has(CardTag.Equip) || c.equipSlot)
    if (equipCard && targetsOf(equipCard).includes(player)) {
      // 检查是否已有同槽位装备（不重复装备低价值装备）
      const existingEquip = player.equipCards.find(
        (e) => e.equipSlot === equipCard.equipSlot,
      )
      if (!existingEquip || this.getCardValue(equipCard) > this.getCardValue(existingEquip)) {
        return { card: equipCard, targets: [player] }
      }
    }

    // 2. 桃：仅在受伤较重（hp <= maxHp - 2）或体力低时使用
    const heal = cards.find((c) => c.tags.has(CardTag.Heal))
    if (heal && targetsOf(heal).includes(player) && player.hp <= player.maxHp - 2) {
      return { card: heal, targets: [player] }
    }

    // 3. 酒：配合杀使用（本回合后续出杀伤害+1），或濒死自救
    const wine = cards.find((c) => c.tags.has(CardTag.Wine) && !c.tags.has(CardTag.Strike))
    const strikeForWine = cards.find((c) => c.tags.has(CardTag.Strike))
    if (
      wine &&
      targetsOf(wine).includes(player) &&
      strikeForWine &&
      this.canPlayCard(player, strikeForWine) &&
      enemiesOf(strikeForWine).length > 0
    ) {
      return { card: wine, targets: [player] }
    }

    // 4. 增益类锦囊
    const fromNothing = cards.find((c) => c.tags.has(CardTag.SomethingFromNothing))
    if (fromNothing) {
      return { card: fromNothing, targets: targetsOf(fromNothing) }
    }

    // 5. 优先攻击：**牌 × 目标**一起选
    //
    // 先摸到哪张杀就用哪张是不够的——手里同时有火杀与普通杀时，
    // 打一个穿藤甲的人该用火杀（火焰 +1），换一张就少一点伤害。
    // 伤害是「这张牌打这个人」的函数，不是牌的属性也不是人的属性。
    const strikes = cards.filter(
      (c) => c.tags.has(CardTag.Strike) && this.canPlayCard(player, c),
    )
    const bestAttack = this.bestAttack(player, strikes, state, targetsOf)
    if (bestAttack) return bestAttack

    // 6. 控制类锦囊 — 针对高价值目标
    const controlTricks = this.sortByValueDesc(
      cards.filter(
        (c) =>
          c.tags.has(CardTag.Snatch) ||
          c.tags.has(CardTag.Dismantle) ||
          c.tags.has(CardTag.Duel) ||
          c.tags.has(CardTag.BorrowedBlade),
      ),
    )
    const control = controlTricks
      .map((trick) => ({ trick, enemies: enemiesOf(trick) }))
      .find((c) => c.enemies.length > 0)
    if (control) {
      const target = this.selectBestAttackTarget(player, control.enemies, state, control.trick)
      if (target) return { card: control.trick, targets: [target] }
    }

    // 7. AOE：评估敌我比例
    const aoe = cards.find(
      (c) => c.tags.has(CardTag.BarbarianRaid) || c.tags.has(CardTag.ArrowBarrage),
    )
    if (aoe) {
      const allyCount = allAlive.filter((p) => this.isAlly(player, p)).length
      const enemyCount = allAlive.filter((p) => this.isEnemy(player, p)).length
      // 敌多我寡时使用 AOE
      if (enemyCount > allyCount) {
        return { card: aoe, targets: targetsOf(aoe) }
      }
      // 盟友较多时不使用（避免误伤）
    }

    // 8. 延时锦囊 → 对威胁最高的敌人
    const delayed = this.sortByValueDesc(cards.filter((c) => c.isDelayed))
      .map((card) => ({ card, enemies: enemiesOf(card) }))
      .find((c) => c.enemies.length > 0)
    if (delayed) {
      const target = this.selectBestAttackTarget(player, delayed.enemies, state, delayed.card)
      if (target) return { card: delayed.card, targets: [target] }
    }

    // 9. 桃在轻度受伤时保留
    if (heal && targetsOf(heal).includes(player) && player.isWounded && player.hp > player.maxHp - 2) {
      // 如果手牌多，可以用掉
      if (player.handCards.length > player.maxHp + 2) {
        return { card: heal, targets: [player] }
      }
    }

    return null
  }

  chooseEffectToUse(
    player: IPlayer,
    availableEffects: ISkill[],
    _state: GameStateSnapshot,
  ): ISkill | null {
    const active = availableEffects.filter((e) => isManualSkill(e))
    if (active.length === 0) return null

    // 先按 `ai.order`（AI 的考虑顺序）排，同序再比估值。
    // `ai.order` 不是 `skillPriority` ——后者是结算顺序，混用会让
    // 「调 AI 先想哪个技能」的人无意中改动引擎的结算先后。
    const scored = active
      .map((e) => ({
        effect: e,
        order: aiOrderOf(e),
        score: aiValueOf(e, player) - this.exposureCost(player, e),
      }))
      .sort((a, b) => b.order - a.order || b.score - a.score)

    // 扣完暴露代价后不划算就不发动。
    //
    // 门槛是 `>= 0` 而不是 `> 0`：绝大多数技能没写 `ai.result.player`，
    // 估值退回 `priority`（通常是 0），写成 `> 0` 会让 AI 一个技能
    // 都不发动。0 分的含义是「没有额外意见」，不是「不划算」。
    return scored[0] && scored[0].score >= 0 ? scored[0].effect : null
  }

  /**
   * 发动这条技能要付的「暴露身份」代价
   *
   * 身份已经亮了的人无所谓（藏不住了）；还没亮的——内奸、没翻面的
   * 反贼——每发动一个一眼能认出来的技能都在自报家门。
   */
  private exposureCost(player: IPlayer, skill: ISkill): number {
    if (player.roleRevealed) return 0
    return exposeOf(skill)
  }

  chooseCardsToDiscard(player: IPlayer, count: number, _state: GameStateSnapshot): ICard[] {
    const handCards = player.handCards.filter((c) => c.zone === ZoneType.Hand)

    // 考虑保留策略：
    // - 至少保留 1 张闪
    // - 至少保留 1 张桃（如果受伤）
    // - 优先弃置装备（如果已装备同槽位）
    // - 优先弃置延时锦囊（效果慢）

    const toDiscard: ICard[] = []
    const remaining = [...handCards]

    // 下面两步都会**边遍历边删** `remaining`（挑中了就移出候选池），
    // 所以先筛出一批再逐个处理，而不是直接 for-of 原数组。

    // 1. 先弃置与已有装备重复的装备牌
    const equippedSlots = new Set(player.equipCards.map((c) => c.equipSlot).filter(Boolean))
    for (const card of remaining.filter((c) => c.equipSlot && equippedSlots.has(c.equipSlot))) {
      if (toDiscard.length >= count) break
      toDiscard.push(card)
      remaining.splice(remaining.indexOf(card), 1)
    }

    // 2. 弃置延时锦囊
    for (const card of remaining.filter((c) => c.isDelayed)) {
      if (toDiscard.length >= count) break
      toDiscard.push(card)
      remaining.splice(remaining.indexOf(card), 1)
    }

    // 3. 按价值升序弃置剩余卡牌
    const sorted = this.sortByValueAsc(remaining)
    for (const card of sorted) {
      if (toDiscard.length >= count) break
      // 保留至少 1 张闪
      if (card.tags.has(CardTag.Dodge)) {
        const dodgeCount = remaining.filter((c) => c.tags.has(CardTag.Dodge)).length
        const dodgeDiscarding = toDiscard.filter((c) => c.tags.has(CardTag.Dodge)).length
        if (dodgeCount - dodgeDiscarding <= 1) continue
      }
      // 受伤时保留至少 1 张桃
      if (card.tags.has(CardTag.Heal) && player.isWounded) {
        const healCount = remaining.filter((c) => c.tags.has(CardTag.Heal)).length
        const healDiscarding = toDiscard.filter((c) => c.tags.has(CardTag.Heal)).length
        if (healCount - healDiscarding <= 1) continue
      }
      toDiscard.push(card)
    }

    return toDiscard.slice(0, count)
  }

  respondToDefend(
    player: IPlayer,
    validCards: ICard[],
    _state: GameStateSnapshot,
  ): ICard | null {
    // 优先出闪
    const dodge = validCards.find((c) => c.tags.has(CardTag.Dodge))
    if (dodge) {
      // 如果手牌充足，总是出闪
      if (player.handCards.length >= 3) return dodge
      // 手牌少时，只在体力低时出闪
      if (player.hp <= 2) return dodge
      // 手牌极少（1张），保留闪用于更关键的时刻
      if (player.handCards.length === 1) {
        if (player.hp <= 1) return dodge
        return null
      }
      return dodge
    }
    return null
  }

  respondToDying(
    player: IPlayer,
    dyingPlayer: IPlayer,
    validCards: ICard[],
    _state: GameStateSnapshot,
  ): ICard | null {
    const heal = validCards.find((c) => c.tags.has(CardTag.Heal))
    if (!heal) {
      // 检查是否有酒（酒在濒死时也可回复 1 点体力）
      const wine = validCards.find((c) => c.tags.has(CardTag.Wine))
      if (!wine) return null
      if (dyingPlayer.id === player.id) return wine
      if (this.isAlly(player, dyingPlayer)) return wine
      return null
    }

    // 自己濒死 → 一定用桃
    if (dyingPlayer.id === player.id) return heal

    // 盟友濒死：
    if (this.isAlly(player, dyingPlayer)) {
      // 主公濒死 → 忠臣必救
      if (dyingPlayer.role === RoleType.Aspect) return heal
      // 自己有多个桃 → 救盟友
      const healCount = player.handCards.filter((c) => c.tags.has(CardTag.Heal)).length
      if (healCount >= 2) return heal
      // 自己体力充足 → 救盟友
      if (player.hp >= player.maxHp) return heal
      // 自己体力低 → 保留桃自救
      return null
    }

    // 敌人 → 不用桃
    return null
  }

  respondWithEffect(
    player: IPlayer,
    availableEffects: ISkill[],
    _state: GameStateSnapshot,
  ): ISkill | null {
    // 同 Normal：强制技不在候选里 —— 它没有「不发动」这个选项
    const usable = availableEffects.filter(isDeclinableSkill)
    if (usable.length === 0) return null

    // 评估每个效果的价值
    const scored = usable.map((e) => ({
      effect: e,
      score: aiValueOf(e, player),
    }))

    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.effect ?? null
  }

  chooseEffectTargets(
    player: IPlayer,
    effect: ISkill,
    candidates: IPlayer[],
    state: GameStateSnapshot,
  ): IPlayer[] {
    // 按威胁度排序，选择目标。
    //
    // 技能自己也有发言权（`ai.result.target`）：【仁德】给谁、给谁更值，
    // 是这条技能知道而通用威胁度不知道的事。两者相加——通用打分负责
    // 「谁值得被针对」，技能负责「我这张牌想给谁」。
    const scored = candidates
      .filter((c) => c.alive)
      .map((c) => ({
        player: c,
        score: this.getTargetThreatScore(player, c, state) + aiTargetValueOf(effect, player, c),
      }))

    // 敌人得分越高（更有攻击价值），盟友得分越低
    scored.sort((a, b) => {
      const aEnemy = this.isEnemy(player, a.player)
      const bEnemy = this.isEnemy(player, b.player)
      if (aEnemy && !bEnemy) return -1
      if (!aEnemy && bEnemy) return 1
      if (aEnemy) return b.score - a.score
      return a.score - b.score
    })

    return scored.map((s) => s.player)
  }

  chooseEffectCards(
    _player: IPlayer,
    _effect: ISkill,
    candidates: ICard[],
    _state: GameStateSnapshot,
  ): ICard[] {
    // 按价值升序选择（优先使用低价值卡牌）
    const sorted = this.sortByValueAsc(candidates)
    return sorted
  }

  // ── Hard 专用工具方法 ──

  /**
   * 选择最佳攻击目标。
   *
   * 优先级：
   * 1. 主公（如果是反贼/内奸）
   * 2. 受伤的敌人
   * 3. 手牌少的敌人（更难防御）
   * 4. 体力低的敌人
   * 5. 身份已公开的敌人
   */
  /**
   * 从「牌 × 目标」的组合里挑最好的一刀
   *
   * 只看目标会漏掉一半：同样一个人，用火杀打穿藤甲的他是 2 点，
   * 用普通杀只有 1 点。因此两队变量一起比，先比伤害再比威胁度。
   */
  private bestAttack(
    player: IPlayer,
    cards: ICard[],
    state: GameStateSnapshot,
    targetsOf: (card: ICard) => IPlayer[],
  ): AICardChoice | null {
    let best: { card: ICard; target: IPlayer; damage: number; score: number } | null = null

    for (const card of cards) {
      for (const target of this.enemiesAmong(player, targetsOf(card))) {
        const damage = this.estimateDamage(player, target, card)
        const score = this.getTargetThreatScore(player, target, state)
        if (
          !best ||
          damage > best.damage ||
          (damage === best.damage && score > best.score)
        ) {
          best = { card, target, damage, score }
        }
      }
    }

    return best ? { card: best.card, targets: [best.target] } : null
  }

  private selectBestAttackTarget(
    player: IPlayer,
    enemies: IPlayer[],
    state: GameStateSnapshot,
    card?: ICard,
  ): IPlayer | null {
    if (enemies.length === 0) return null

    const scored = enemies.map((enemy) => ({
      player: enemy,
      score: this.getTargetThreatScore(player, enemy, state),
      // 这一刀下去真的能掉几点血 —— 藤甲挨火杀是 2 点，挨普通杀是 1 点。
      // 「这张牌打这个人值不值」问的是伤害，不是牌面。
      damage: this.estimateDamage(player, enemy, card),
    }))

    scored.sort((a, b) => {
      if (b.damage !== a.damage) return b.damage - a.damage
      return b.score - a.score
    })
    return scored[0]?.player ?? null
  }

  /**
   * 预估「这张牌打这个人」会造成几点伤害
   *
   * 走 `mods.damage` 这条总管道，于是防具易伤（藤甲：火焰 +1）、
   * 技能加减伤全都算进来——AI 不必知道「藤甲」是什么，只要知道
   * 这一刀下去目标会掉几点血。
   *
   * 没有 Mod 查询口时（纯策略单测）退回牌面值 1。
   */
  private estimateDamage(player: IPlayer, target: IPlayer, card?: ICard): number {
    if (!card || !this.mods) return 1
    // `nature` 从牌推出（火 / 雷 / 冰 / 毒），与 `damage-content` 结算
    // 伤害时用的是同一个 `DamageResolver.damageTypeOf`——两边各推一遍
    // 就会在「这张杀是不是火杀」上给出两个答案。
    return this.mods.damage(1, player, target, card, DamageResolver.damageTypeOf(card))
  }

  /**
   * 计算目标威胁/优先级评分。
   *
   * 分数越高 → 越应该优先攻击。
   */
  private getTargetThreatScore(
    player: IPlayer,
    target: IPlayer,
    _state: GameStateSnapshot,
  ): number {
    let score = 0

    // 主公是首要目标（对反贼/内奸而言）
    if (target.role === RoleType.Aspect && target.roleRevealed) {
      if (player.role === RoleType.Ascended || player.role === RoleType.Infiltrator) {
        score += 50
      }
    }

    // 受伤的目标优先级更高
    if (target.isWounded) {
      score += 20 + (target.maxHp - target.hp) * 5
    }

    // 体力低的目标
    if (target.hp <= 1) score += 30
    else if (target.hp <= 2) score += 15

    // 手牌少的目标更难防御
    if (target.handCards.length <= 1) score += 20
    else if (target.handCards.length <= 2) score += 10

    // 已公开身份的敌人
    if (target.roleRevealed && this.isEnemy(player, target)) {
      score += 10
    }

    // 有装备的敌人（资源多，需要压制）
    if (target.equipCards.length > 0) score += 5

    // 身上带威胁技的敌人更该先处理。
    // 威胁度写在技能定义上（`ai.threaten`），AI 只做累加——
    // 「哪个武将厉害」不该有一份抄在 AI 里的名单。
    score += this.threatOf(target)

    return score
  }

  /**
   * 这个人身上所有技能的威胁度之和
   *
   * 没有台账时（纯策略单测）是 0，于是威胁评分退回纯局面判断。
   */
  private threatOf(player: IPlayer): number {
    if (!this.skills) return 0
    return this.skills.getSkills(player).reduce((sum, skill) => sum + threatenOf(skill), 0)
  }
}

// ============================================================
// 策略工厂
// ============================================================

export { AIDifficulty } from '@core/contracts/ai.interface'
import { AIDifficulty } from '@core/contracts/ai.interface'
import { CardTag } from '@core/contracts/card-tag'
/**
 * 根据难度创建 AI 策略实例。
 *
 * 策略是无状态的，可以安全地在多个玩家间共享。
 * 如需每个玩家使用独立策略，可多次调用此工厂。
 *
 * @param difficulty 难度等级
 * @param random     随机源（AI 挑牌用）。同一颗种子 → 同一串 AI 决策
 * @returns 对应难度的 IAIDecisionMaker 实例
 */
export function createAIStrategy(
  difficulty: AIDifficulty,
  random?: IRandomService,
  deps: AIStrategyDeps = {},
): IAIDecisionMaker {
  switch (difficulty) {
    case AIDifficulty.Beginner:
      return new BeginnerAIStrategy(random, deps)
    case AIDifficulty.Normal:
      return new NormalAIStrategy(random, deps)
    case AIDifficulty.Hard:
      return new HardAIStrategy(random, deps)
    default:
      return new NormalAIStrategy(random, deps)
  }
}
