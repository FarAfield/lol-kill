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
import type { IEffect } from '@core/contracts/effect.interface'
import type { IGameState } from '@core/contracts/game.interface'
import { RoleType, ZoneType, EquipSlot, GamePhase, SkillType } from '@core/contracts/enums'
import { DEFAULT_ATTACK_RANGE } from '@source/base/constants'

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取存活玩家列表。
 */
function getAlivePlayers(state: IGameState): IPlayer[] {
  return state.players.filter((p) => p.alive)
}

/**
 * 获取其他存活玩家列表（排除自己）。
 */
function getOtherAlivePlayers(player: IPlayer, state: IGameState): IPlayer[] {
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

  if (tags.has('peach')) return 90
  if (tags.has('shan')) return 60
  if (tags.has('sha')) return 50
  if (tags.has('jiu')) return 45

  // 锦囊牌
  if (tags.has('wuXieKeJi')) return 85
  if (tags.has('wuZhongShengYou')) return 80
  if (tags.has('shunShouQianYang')) return 75
  if (tags.has('guoHeChaiQiao')) return 75
  if (tags.has('nanManRuQin')) return 65
  if (tags.has('wanJianQiFa')) return 60
  if (tags.has('jueDou')) return 55
  if (tags.has('jieDaoShaRen')) return 55
  if (tags.has('wuGuFengDeng')) return 50
  if (tags.has('taoYuanJieYi')) return 45

  // 延时锦囊
  if (card.isDelayed) return 35

  // 装备牌
  if (tags.has('equip') || card.equipSlot) return 40

  return 30
}

/**
 * 判断玩家是否可以在当前回合攻击。
 */
function canAttack(player: IPlayer): boolean {
  if (player.attackLimit === Infinity) return true
  return !player.usedAttackThisTurn
}

/**
 * Fisher-Yates 洗牌（纯函数）。
 */
function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

/**
 * 随机选取一个元素。
 */
function pickRandom<T>(array: readonly T[]): T | null {
  if (array.length === 0) return null
  return array[Math.floor(Math.random() * array.length)]!
}

// ============================================================
// 基础 AI 策略（抽象基类）
// ============================================================

/**
 * 基础 AI 策略 —— 提供共享的工具方法。
 *
 * 子类只需覆写决策方法即可实现不同难度。
 */
export abstract class BaseAIStrategy implements IAIDecisionMaker {
  // ── 实现 IAIDecisionMaker ──

  abstract chooseCardToPlay(player: IPlayer, state: IGameState): AICardChoice | null

  abstract chooseEffectToUse(
    player: IPlayer,
    availableEffects: IEffect[],
    state: IGameState,
  ): IEffect | null

  abstract chooseCardsToDiscard(
    player: IPlayer,
    count: number,
    state: IGameState,
  ): ICard[]

  chooseHero(
    _player: IPlayer,
    candidates: { id: string; name: string; title: string; kingdom: string }[],
    selectCount: number,
    _state: IGameState,
  ): string[] {
    // 默认随机选择指定数量的英雄
    const shuffled = shuffle(candidates)
    return shuffled.slice(0, selectCount).map((c) => c.id)
  }

  abstract respondToDefend(
    player: IPlayer,
    validCards: ICard[],
    state: IGameState,
  ): ICard | null

  respondToDying(
    _player: IPlayer,
    dyingPlayer: IPlayer,
    validCards: ICard[],
    _state: IGameState,
  ): ICard | null {
    // 默认逻辑：对自己或盟友使用桃
    // 先检查是否有桃
    const peach = validCards.find((c) => c.tags.has('peach'))
    if (!peach) return null

    // 如果是自己濒死，或者盟友濒死，使用桃
    if (dyingPlayer.id === _player.id || isAlly(_player, dyingPlayer)) {
      return peach
    }

    return null
  }

  respondWithEffect(
    _player: IPlayer,
    _availableEffects: IEffect[],
    _state: IGameState,
  ): IEffect | null {
    return null
  }

  chooseEffectTargets(
    _player: IPlayer,
    _effect: IEffect,
    candidates: IPlayer[],
    _state: IGameState,
  ): IPlayer[] {
    // 默认选择所有候选人（子类可覆写）
    return candidates
  }

  chooseEffectCards(
    _player: IPlayer,
    _effect: IEffect,
    candidates: ICard[],
    _state: IGameState,
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

  protected canAttack(player: IPlayer): boolean {
    return canAttack(player)
  }

  protected getAlivePlayers(state: IGameState): IPlayer[] {
    return getAlivePlayers(state)
  }

  protected getOtherAlivePlayers(player: IPlayer, state: IGameState): IPlayer[] {
    return getOtherAlivePlayers(player, state)
  }

  protected shuffle<T>(array: readonly T[]): T[] {
    return shuffle(array)
  }

  protected pickRandom<T>(array: readonly T[]): T | null {
    return pickRandom(array)
  }

  /**
   * 查找手牌中匹配指定 tag 的卡牌。
   */
  protected findCardByTag(player: IPlayer, tag: string): ICard | undefined {
    return player.handCards.find((c) => c.tags.has(tag) && c.zone === ZoneType.Hand)
  }

  /**
   * 获取玩家手牌中可打出的卡牌（非延时、在手牌区）。
   */
  protected getPlayableHandCards(player: IPlayer): ICard[] {
    return player.handCards.filter((c) => c.zone === ZoneType.Hand && !c.isDelayed)
  }

  /**
   * 获取手牌中指定 tag 的所有卡牌。
   */
  protected getCardsByTag(player: IPlayer, tag: string): ICard[] {
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
  chooseCardToPlay(player: IPlayer, state: IGameState): AICardChoice | null {
    const playableCards = this.getPlayableHandCards(player)
    if (playableCards.length === 0) return null

    // 随机选择一张卡牌
    const card = this.pickRandom(playableCards)
    if (!card) return null

    // 根据卡牌类型选择目标
    let targets: IPlayer[] = []

    if (card.tags.has('sha') || card.tags.has('jueDou') || card.tags.has('jieDaoShaRen')) {
      // 攻击牌：随机选择一名其他存活玩家
      const others = this.getOtherAlivePlayers(player, state)
      const target = this.pickRandom(others)
      if (target) targets = [target]
    } else if (card.tags.has('peach') || card.tags.has('jiu')) {
      // 回复牌：对自己使用
      targets = [player]
    } else if (card.tags.has('equip')) {
      // 装备牌：对自己使用
      targets = [player]
    } else if (card.tags.has('trick') && !card.isDelayed) {
      // 非延时锦囊：随机选择目标
      const others = this.getOtherAlivePlayers(player, state)
      const target = this.pickRandom(others)
      if (target) targets = [target]
    }

    return { card, targets }
  }

  chooseEffectToUse(
    _player: IPlayer,
    availableEffects: IEffect[],
    _state: IGameState,
  ): IEffect | null {
    // 随机选择一个可用效果
    const activeEffects = availableEffects.filter((e) => e.type === SkillType.Active)
    return this.pickRandom(activeEffects)
  }

  chooseCardsToDiscard(player: IPlayer, count: number, _state: IGameState): ICard[] {
    // 随机弃牌
    const handCards = player.handCards.filter((c) => c.zone === ZoneType.Hand)
    const shuffled = this.shuffle(handCards)
    return shuffled.slice(0, Math.min(count, shuffled.length))
  }

  respondToDefend(
    _player: IPlayer,
    validCards: ICard[],
    _state: IGameState,
  ): ICard | null {
    // 有可用的防御牌就出
    const shan = validCards.find((c) => c.tags.has('shan'))
    if (shan) return shan
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
  chooseCardToPlay(player: IPlayer, state: IGameState): AICardChoice | null {
    const hand = this.getPlayableHandCards(player)
    if (hand.length === 0) return null

    const enemies = this.getOtherAlivePlayers(player, state).filter((p) =>
      this.isEnemy(player, p),
    )

    // 出牌阶段策略：
    // 1. 装备牌优先（直接装备）
    const equipCard = hand.find((c) => c.tags.has('equip') || c.equipSlot)
    if (equipCard) {
      return { card: equipCard, targets: [player] }
    }

    // 2. 桃/酒：仅在受伤时使用
    if (player.isWounded) {
      const peach = hand.find((c) => c.tags.has('peach'))
      if (peach) {
        return { card: peach, targets: [player] }
      }
      // 酒也可以在出牌阶段对自己使用
      const jiu = hand.find((c) => c.tags.has('jiu') && !c.tags.has('sha'))
      if (jiu) {
        return { card: jiu, targets: [player] }
      }
    }

    // 3. 优先使用增益类锦囊（无中生有、五谷丰登、桃园结义）
    const buffTrick = hand.find(
      (c) =>
        c.tags.has('wuZhongShengYou') ||
        c.tags.has('wuGuFengDeng') ||
        c.tags.has('taoYuanJieYi'),
    )
    if (buffTrick) {
      return { card: buffTrick, targets: [player] }
    }

    // 4. 杀：攻击敌人
    if (this.canAttack(player)) {
      const sha = this.findCardByTag(player, 'sha')
      if (sha && enemies.length > 0) {
        // 优先攻击受伤的敌人
        const woundedEnemy = enemies.find((e) => e.isWounded)
        const target = woundedEnemy ?? this.pickRandom(enemies)
        if (target) return { card: sha, targets: [target] }
      }
    }

    // 5. 控制类锦囊（顺手牵羊、过河拆桥、决斗等）——攻击敌人
    const controlTricks = hand.filter(
      (c) =>
        c.tags.has('shunShouQianYang') ||
        c.tags.has('guoHeChaiQiao') ||
        c.tags.has('jueDou') ||
        c.tags.has('jieDaoShaRen'),
    )
    if (controlTricks.length > 0 && enemies.length > 0) {
      const trick = controlTricks[0]!
      const target = this.pickRandom(enemies)
      if (target) return { card: trick, targets: [target] }
    }

    // 6. AOE 锦囊（南蛮入侵、万箭齐发）——有多个敌人时使用
    if (enemies.length >= 2) {
      const aoe = hand.find(
        (c) => c.tags.has('nanManRuQin') || c.tags.has('wanJianQiFa'),
      )
      if (aoe) {
        return { card: aoe, targets: getAlivePlayers(state) }
      }
    }

    // 7. 延时锦囊 → 对敌人使用
    const delayedTrick = hand.find((c) => c.isDelayed)
    if (delayedTrick && enemies.length > 0) {
      const target = this.pickRandom(enemies)
      if (target) return { card: delayedTrick, targets: [target] }
    }

    return null
  }

  chooseEffectToUse(
    _player: IPlayer,
    availableEffects: IEffect[],
    _state: IGameState,
  ): IEffect | null {
    const active = availableEffects.filter((e) => e.type === SkillType.Active)
    if (active.length === 0) return null

    // 按优先级排序，选择最高优先级的效果
    const sorted = [...active].sort((a, b) => b.priority - a.priority)
    return sorted[0] ?? null
  }

  chooseCardsToDiscard(player: IPlayer, count: number, _state: IGameState): ICard[] {
    const handCards = player.handCards.filter((c) => c.zone === ZoneType.Hand)
    // 按价值升序排列，弃置价值最低的牌
    const sorted = this.sortByValueAsc(handCards)
    return sorted.slice(0, Math.min(count, sorted.length))
  }

  respondToDefend(
    _player: IPlayer,
    validCards: ICard[],
    _state: IGameState,
  ): ICard | null {
    // 优先出闪
    const shan = validCards.find((c) => c.tags.has('shan'))
    if (shan) return shan
    // 有桃也可以考虑（濒死场景由 respondToDying 处理）
    // 如果没有闪，不出
    return null
  }

  respondToDying(
    player: IPlayer,
    dyingPlayer: IPlayer,
    validCards: ICard[],
    state: IGameState,
  ): ICard | null {
    const peach = validCards.find((c) => c.tags.has('peach'))
    if (!peach) return null

    // 自己濒死 → 一定用桃
    if (dyingPlayer.id === player.id) return peach

    // 盟友濒死 → 用桃
    if (this.isAlly(player, dyingPlayer)) return peach

    // 敌人濒死 → 不用桃
    return null
  }

  respondWithEffect(
    _player: IPlayer,
    availableEffects: IEffect[],
    _state: IGameState,
  ): IEffect | null {
    // 有可用的响应效果就用
    const usable = availableEffects.filter(() => true)
    if (usable.length === 0) return null
    const sorted = [...usable].sort((a, b) => b.priority - a.priority)
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
  chooseCardToPlay(player: IPlayer, state: IGameState): AICardChoice | null {
    const hand = this.getPlayableHandCards(player)
    if (hand.length === 0) return null

    const allAlive = this.getAlivePlayers(state)
    const enemies = this.getOtherAlivePlayers(player, state).filter((p) =>
      this.isEnemy(player, p),
    )

    // 1. 装备牌优先（立即提升战力）
    const equipCard = hand.find((c) => c.tags.has('equip') || c.equipSlot)
    if (equipCard) {
      // 检查是否已有同槽位装备（不重复装备低价值装备）
      const existingEquip = player.equipCards.find(
        (e) => e.equipSlot === equipCard.equipSlot,
      )
      if (!existingEquip || this.getCardValue(equipCard) > this.getCardValue(existingEquip)) {
        return { card: equipCard, targets: [player] }
      }
    }

    // 2. 桃：仅在受伤较重（hp <= maxHp - 2）或体力低时使用
    const peach = this.findCardByTag(player, 'peach')
    if (peach && player.hp <= player.maxHp - 2) {
      return { card: peach, targets: [player] }
    }

    // 3. 酒：配合杀使用（本回合后续出杀伤害+1），或濒死自救
    const jiu = hand.find((c) => c.tags.has('jiu') && !c.tags.has('sha'))
    const hasSha = !!this.findCardByTag(player, 'sha')
    if (jiu && hasSha && this.canAttack(player) && enemies.length > 0) {
      return { card: jiu, targets: [player] }
    }

    // 4. 增益类锦囊
    const wuzhong = hand.find((c) => c.tags.has('wuZhongShengYou'))
    if (wuzhong) {
      return { card: wuzhong, targets: [player] }
    }

    // 5. 优先攻击：按威胁度排序目标
    if (this.canAttack(player)) {
      const sha = this.findCardByTag(player, 'sha')
      if (sha && enemies.length > 0) {
        const target = this.selectBestAttackTarget(player, enemies, state)
        if (target) return { card: sha, targets: [target] }
      }
    }

    // 6. 控制类锦囊 — 针对高价值目标
    const controlTricks = this.sortByValueDesc(
      hand.filter(
        (c) =>
          c.tags.has('shunShouQianYang') ||
          c.tags.has('guoHeChaiQiao') ||
          c.tags.has('jueDou') ||
          c.tags.has('jieDaoShaRen'),
      ),
    )
    if (controlTricks.length > 0 && enemies.length > 0) {
      const trick = controlTricks[0]!
      const target = this.selectBestAttackTarget(player, enemies, state)
      if (target) return { card: trick, targets: [target] }
    }

    // 7. AOE：评估敌我比例
    const aoe = hand.find(
      (c) => c.tags.has('nanManRuQin') || c.tags.has('wanJianQiFa'),
    )
    if (aoe) {
      const allyCount = allAlive.filter((p) => this.isAlly(player, p)).length
      const enemyCount = allAlive.filter((p) => this.isEnemy(player, p)).length
      // 敌多我寡时使用 AOE
      if (enemyCount > allyCount) {
        return { card: aoe, targets: allAlive }
      }
      // 盟友较多时不使用（避免误伤）
    }

    // 8. 延时锦囊 → 对威胁最高的敌人
    const delayedTrick = this.sortByValueDesc(hand.filter((c) => c.isDelayed))[0]
    if (delayedTrick && enemies.length > 0) {
      const target = this.selectBestAttackTarget(player, enemies, state)
      if (target) return { card: delayedTrick, targets: [target] }
    }

    // 9. 桃在轻度受伤时保留
    if (peach && player.isWounded && player.hp > player.maxHp - 2) {
      // 如果手牌多，可以用掉
      if (player.handCards.length > player.maxHp + 2) {
        return { card: peach, targets: [player] }
      }
    }

    return null
  }

  chooseEffectToUse(
    player: IPlayer,
    availableEffects: IEffect[],
    state: IGameState,
  ): IEffect | null {
    const active = availableEffects.filter(
      (e) => e.type === SkillType.Active,
    )
    if (active.length === 0) return null

    // 评估每个效果的价值
    const scored = active.map((e) => ({
      effect: e,
      score: e.aiValue ? e.aiValue({ event: null!, player, game: state, triggerCards: [] } as any) : e.priority,
    }))

    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.effect ?? null
  }

  chooseCardsToDiscard(player: IPlayer, count: number, state: IGameState): ICard[] {
    const handCards = player.handCards.filter((c) => c.zone === ZoneType.Hand)

    // 考虑保留策略：
    // - 至少保留 1 张闪
    // - 至少保留 1 张桃（如果受伤）
    // - 优先弃置装备（如果已装备同槽位）
    // - 优先弃置延时锦囊（效果慢）

    const toDiscard: ICard[] = []
    const remaining = [...handCards]

    // 1. 先弃置与已有装备重复的装备牌
    const equippedSlots = new Set(player.equipCards.map((c) => c.equipSlot).filter(Boolean))
    for (const card of [...remaining]) {
      if (toDiscard.length >= count) break
      if (card.equipSlot && equippedSlots.has(card.equipSlot)) {
        toDiscard.push(card)
        remaining.splice(remaining.indexOf(card), 1)
      }
    }

    // 2. 弃置延时锦囊
    for (const card of [...remaining]) {
      if (toDiscard.length >= count) break
      if (card.isDelayed) {
        toDiscard.push(card)
        remaining.splice(remaining.indexOf(card), 1)
      }
    }

    // 3. 按价值升序弃置剩余卡牌
    const sorted = this.sortByValueAsc(remaining)
    for (const card of sorted) {
      if (toDiscard.length >= count) break
      // 保留至少 1 张闪
      if (card.tags.has('shan')) {
        const shanCount = remaining.filter((c) => c.tags.has('shan')).length
        const shanDiscarding = toDiscard.filter((c) => c.tags.has('shan')).length
        if (shanCount - shanDiscarding <= 1) continue
      }
      // 受伤时保留至少 1 张桃
      if (card.tags.has('peach') && player.isWounded) {
        const peachCount = remaining.filter((c) => c.tags.has('peach')).length
        const peachDiscarding = toDiscard.filter((c) => c.tags.has('peach')).length
        if (peachCount - peachDiscarding <= 1) continue
      }
      toDiscard.push(card)
    }

    return toDiscard.slice(0, count)
  }

  respondToDefend(
    player: IPlayer,
    validCards: ICard[],
    state: IGameState,
  ): ICard | null {
    // 优先出闪
    const shan = validCards.find((c) => c.tags.has('shan'))
    if (shan) {
      // 如果手牌充足，总是出闪
      if (player.handCards.length >= 3) return shan
      // 手牌少时，只在体力低时出闪
      if (player.hp <= 2) return shan
      // 手牌极少（1张），保留闪用于更关键的时刻
      if (player.handCards.length === 1) {
        if (player.hp <= 1) return shan
        return null
      }
      return shan
    }
    return null
  }

  respondToDying(
    player: IPlayer,
    dyingPlayer: IPlayer,
    validCards: ICard[],
    state: IGameState,
  ): ICard | null {
    const peach = validCards.find((c) => c.tags.has('peach'))
    if (!peach) {
      // 检查是否有酒（酒在濒死时也可回复 1 点体力）
      const jiu = validCards.find((c) => c.tags.has('jiu'))
      if (!jiu) return null
      if (dyingPlayer.id === player.id) return jiu
      if (this.isAlly(player, dyingPlayer)) return jiu
      return null
    }

    // 自己濒死 → 一定用桃
    if (dyingPlayer.id === player.id) return peach

    // 盟友濒死：
    if (this.isAlly(player, dyingPlayer)) {
      // 主公濒死 → 忠臣必救
      if (dyingPlayer.role === RoleType.Aspect) return peach
      // 自己有多个桃 → 救盟友
      const peachCount = player.handCards.filter((c) => c.tags.has('peach')).length
      if (peachCount >= 2) return peach
      // 自己体力充足 → 救盟友
      if (player.hp >= player.maxHp) return peach
      // 自己体力低 → 保留桃自救
      return null
    }

    // 敌人 → 不用桃
    return null
  }

  respondWithEffect(
    player: IPlayer,
    availableEffects: IEffect[],
    state: IGameState,
  ): IEffect | null {
    const usable = availableEffects.filter(() => true)
    if (usable.length === 0) return null

    // 评估每个效果的价值
    const scored = usable.map((e) => ({
      effect: e,
      score: e.aiValue
        ? e.aiValue({ event: null!, player, game: state, triggerCards: [] } as any)
        : e.priority,
    }))

    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.effect ?? null
  }

  chooseEffectTargets(
    player: IPlayer,
    _effect: IEffect,
    candidates: IPlayer[],
    state: IGameState,
  ): IPlayer[] {
    // 按威胁度排序，选择目标
    const scored = candidates
      .filter((c) => c.alive)
      .map((c) => ({
        player: c,
        score: this.getTargetThreatScore(player, c, state),
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
    _effect: IEffect,
    candidates: ICard[],
    _state: IGameState,
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
  private selectBestAttackTarget(
    player: IPlayer,
    enemies: IPlayer[],
    state: IGameState,
  ): IPlayer | null {
    if (enemies.length === 0) return null

    const scored = enemies.map((enemy) => ({
      player: enemy,
      score: this.getTargetThreatScore(player, enemy, state),
    }))

    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.player ?? null
  }

  /**
   * 计算目标威胁/优先级评分。
   *
   * 分数越高 → 越应该优先攻击。
   */
  private getTargetThreatScore(
    player: IPlayer,
    target: IPlayer,
    _state: IGameState,
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

    return score
  }
}

// ============================================================
// 策略工厂
// ============================================================

export { AIDifficulty } from '@core/contracts/ai.interface'
import { AIDifficulty } from '@core/contracts/ai.interface'

/**
 * 根据难度创建 AI 策略实例。
 *
 * 策略是无状态的，可以安全地在多个玩家间共享。
 * 如需每个玩家使用独立策略，可多次调用此工厂。
 *
 * @param difficulty 难度等级
 * @returns 对应难度的 IAIDecisionMaker 实例
 */
export function createAIStrategy(difficulty: AIDifficulty): IAIDecisionMaker {
  switch (difficulty) {
    case AIDifficulty.Beginner:
      return new BeginnerAIStrategy()
    case AIDifficulty.Normal:
      return new NormalAIStrategy()
    case AIDifficulty.Hard:
      return new HardAIStrategy()
    default:
      return new NormalAIStrategy()
  }
}
