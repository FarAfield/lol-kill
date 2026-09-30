// ============================================================
// 联盟杀 · TargetSystem — 目标选择与合法性校验
//
// 根据卡牌类型、距离限制、游戏状态等条件，
// 校验目标的合法性并获取可选目标列表。
//
// 不同卡牌类型的目标规则：
// - 杀：攻击范围内的一名其他角色
// - 桃：自己（受伤时）/ 濒死角色（濒死时）
// - 无懈可击：任意锦囊牌结算中的目标
// - 过河拆桥/顺手牵羊：距离为 1 且区域内有牌的其他角色
// - 决斗/借刀杀人：其他角色
// - 南蛮入侵/万箭齐发/桃园结义/五谷丰登：所有其他角色（无距离限制）
// ============================================================

import { DistanceSystem } from './distance-system'
import type { DistanceMods } from './distance-system'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import { CardTag } from '@core/contracts/card-tag'

/**
 * 目标相关的 Mod 查询接口
 *
 * 「这张牌能选几个目标」——多数技能（双目标锦囊、全军出动）改的是这个数。
 *
 * 布尔那两个是 Phase 12 的否决器落点：`targetEnabledOf` 回答「这个人
 * 能不能被选」，`targetInRangeOf` 回答「够不够得着」。两者都与距离无关——
 * 「够不够得着」是可以被技能改写的结论，不是距离本身。
 */
export interface TargetMods {
  selectTargetOf(source: IPlayer, card: ICard, base: number): number
  targetEnabledOf?(source: IPlayer, card: ICard, target: IPlayer): boolean
  targetInRangeOf?(source: IPlayer, card: ICard, target: IPlayer): boolean
}

/**
 * 目标校验结果
 */
export interface TargetValidationResult {
  valid: boolean
  reason?: string
}

/**
 * 目标选择系统
 *
 * 所有方法均为纯函数——不修改游戏状态。
 */
export class TargetSystem {
  /**
   * 校验目标集合是否合法。
   *
   * @param source  卡牌/效果的使用者
   * @param targets 候选目标列表
   * @param card    使用的卡牌
   * @param state   游戏状态
   * @returns 校验结果
   */
  static validateTargets(
    source: IPlayer,
    targets: IPlayer[],
    card: ICard,
    state: GameStateSnapshot,
    mods?: DistanceMods & TargetMods,
  ): TargetValidationResult {
    const minTargets = this.getMinTargets(card)
    const maxTargets = this.getMaxTargets(card, source, mods)

    // Allow empty targets only when minTargets is 0 (AOE, self-targeting cards)
    if (targets.length === 0 && minTargets > 0) {
      return { valid: false, reason: '未选择目标' }
    }

    const availableTargets = this.getAvailableTargets(source, card, state, mods)

    // 检查是否多选（基本牌/普通锦囊通常只能选1个目标）
    if (targets.length > maxTargets) {
      return { valid: false, reason: `最多只能选择 ${maxTargets} 个目标` }
    }

    // 检查是否少选
    if (targets.length < minTargets) {
      return { valid: false, reason: `至少需要选择 ${minTargets} 个目标` }
    }

    // 每个目标必须在可选列表中
    for (const target of targets) {
      if (!availableTargets.some((t) => t.id === target.id)) {
        return {
          valid: false,
          reason: `"${target.hero?.name ?? target.id}" 不是合法目标`,
        }
      }
    }

    return { valid: true }
  }

  /**
   * 获取卡牌的可选目标列表。
   *
   * 根据不同卡牌类型和标签应用不同的筛选规则。
   *
   * @param source 卡牌使用者
   * @param card   使用的卡牌
   * @param state  游戏状态
   * @returns 可选目标玩家列表
   */
  static getAvailableTargets(
    source: IPlayer,
    card: ICard,
    state: GameStateSnapshot,
    mods?: DistanceMods & TargetMods,
  ): IPlayer[] {
    const candidates = this.computeAvailableTargets(source, card, state, mods)

    // 否决器统一收口在这里，而不是散在各个分支里：
    // 无论这张牌的目标规则多特殊，「这人能不能被选 / 够不够得着」
    // 都是**覆盖在结论之上**的最后一层判断。
    if (!mods) return candidates

    return candidates.filter(
      (target) =>
        (mods.targetEnabledOf?.(source, card, target) ?? true) &&
        (mods.targetInRangeOf?.(source, card, target) ?? true),
    )
  }

  /**
   * 按卡牌类型算出候选目标（不含 Mod 否决）
   *
   * 与 {@link getAvailableTargets} 分开，是为了让否决器只有一处生效——
   * 下面每个分支都 `return`，若把过滤塞进去就会漏掉某个分支。
   */
  private static computeAvailableTargets(
    source: IPlayer,
    card: ICard,
    state: GameStateSnapshot,
    mods?: DistanceMods & TargetMods,
  ): IPlayer[] {
    const tags = card.tags
    const alivePlayers = state.players.filter((p) => p.alive)

    // ── 杀 ──
    if (tags.has(CardTag.Strike) && tags.has(CardTag.Attack)) {
      return this.getTargetsForAttack(source, alivePlayers, mods)
    }

    // ── 桃 ──
    //
    // 判据必须是「具体牌 tag + 类别 tag」两个不同维度：`Heal` 不是桃独有的，
    // 【桃园结义】同样带着它（`[PeachGardenOath, Trick, Heal, Aoe]`）。
    // 只判 `Heal` 会把那张群体牌塞进桃的目标规则里——「只能对自己用」。
    if (tags.has(CardTag.Heal) && tags.has(CardTag.Basic)) {
      return this.getTargetsForPeach(source, alivePlayers)
    }

    // ── 酒 ──
    if (tags.has(CardTag.Wine)) {
      return [source] // 酒只能对自己使用
    }

    // ── 装备 ──
    //
    // 装备牌只对自己生效。这一分支原先只在 `PhaseManager` 的副本里有，
    // 本系统缺它——于是装备牌会一路落到文件末尾的「默认：距离 1 的其他角色」，
    // 变成「把自己的武器装到别人身上」。补上才能让副本退休。
    if (tags.has(CardTag.Equip) || card.type === 'equip') {
      return [source]
    }

    // ── 无懈可击 ──
    if (tags.has(CardTag.Cancel) || card.name === '无懈可击') {
      // 无懈可击的目标是锦囊牌（而非玩家）
      // 此处返回空数组——实际目标选择由响应窗口处理
      return []
    }

    // ── 过河拆桥 / 顺手牵羊 ──
    if (tags.has(CardTag.Dismantle) || tags.has(CardTag.Snatch)) {
      return this.getTargetsForStealOrDismantle(source, alivePlayers, mods)
    }

    // ── 决斗 ──
    if (tags.has(CardTag.Duel)) {
      return alivePlayers.filter((p) => p.id !== source.id)
    }

    // ── 借刀杀人 ──
    if (tags.has(CardTag.BorrowedBlade)) {
      // 所有其他角色均可作为目标；具体合法性由效果内部校验
      return alivePlayers.filter((p) => p.id !== source.id)
    }

    // ── 延时锦囊（乐不思蜀/兵粮寸断/闪电） ──
    if (card.isDelayed) {
      return this.getTargetsForDelayedCard(source, alivePlayers, card)
    }

    // ── 非延时锦囊（南蛮入侵/万箭齐发/五谷丰登/桃园结义） ──
    if (tags.has(CardTag.Aoe)) {
      return alivePlayers.filter((p) => p.id !== source.id)
    }

    // ── 牌面效果仅对自己生效（无中生有、酒等） ──
    if (tags.has(CardTag.Draw) || tags.has(CardTag.Boost) || card.tags.has(CardTag.SelfOnly)) {
      return [source]
    }

    // ── 默认：距离为1的其他角色 ──
    return DistanceSystem.getPlayersWithinDistance(source, 1, alivePlayers, mods)
  }

  // ── 卡牌目标数限制 ──

  /**
   * 获取卡牌的最小目标数。
   */
  static getMinTargets(card: ICard): number {
    // 无懈可击的最小目标为 0（可以选择是否使用）
    if (card.tags.has(CardTag.Cancel) || card.name === '无懈可击') return 0
    // 桃园结义、五谷丰登、南蛮入侵、万箭齐发无目标（AOE 全体生效）
    if (card.tags.has(CardTag.Aoe) || card.tags.has(CardTag.All)) return 0
    // 借刀杀人需要选择2个目标
    if (card.tags.has(CardTag.BorrowedBlade)) return 2
    // 其他卡牌至少 1 个目标
    return 1
  }

  /**
   * 获取卡牌的最大目标数。
   *
   * 表里的数字只是**基础值**；实际额度还要过一遍 `mod.selectTarget`。
   *
   * @param card   使用的卡牌
   * @param source 使用者（`mod.selectTarget` 需要知道「谁」在选）
   * @param mods   Mod 查询口
   */
  static getMaxTargets(card: ICard, source: IPlayer, mods?: TargetMods): number {
    const base = this.baseMaxTargets(card)
    return mods ? mods.selectTargetOf(source, card, base) : base
  }

  /** 最大目标数的**基础规则**（Mod 之前） */
  private static baseMaxTargets(card: ICard): number {
    // AOE 无目标选择
    if (card.tags.has(CardTag.Aoe) || card.tags.has(CardTag.All)) return 0
    // 无懈可击可以同时抵消多张同类型牌
    if (card.tags.has(CardTag.Cancel) || card.name === '无懈可击') return 1
    // 借刀杀人需要选择2个目标
    if (card.tags.has(CardTag.BorrowedBlade)) return 2
    // 五谷丰登无目标
    if (card.tags.has(CardTag.BountifulHarvest)) return 0
    // 默认 1 个目标
    return 1
  }

  // ── 私有辅助 ──

  /**
   * 杀的目标筛选：攻击范围内的其他角色。
   */
  private static getTargetsForAttack(
    source: IPlayer,
    alivePlayers: IPlayer[],
    mods?: DistanceMods,
  ): IPlayer[] {
    return alivePlayers.filter((p) => {
      if (p.id === source.id) return false
      return DistanceSystem.isInRange(source, p, alivePlayers, mods)
    })
  }

  /**
   * 桃的目标筛选：自己（受伤时）或 濒死角色。
   */
  private static getTargetsForPeach(
    source: IPlayer,
    alivePlayers: IPlayer[],
  ): IPlayer[] {
    const targets: IPlayer[] = []

    // 自己受伤时可以对自己使用
    if (source.isWounded) {
      targets.push(source)
    }

    // 任何濒死角色（包括自己）
    for (const p of alivePlayers) {
      if (p.isDying && !targets.includes(p)) {
        targets.push(p)
      }
    }

    return targets
  }

  /**
   * 过河拆桥/顺手牵羊的目标筛选：
   * 距离为 1 且区域内有牌（手牌/装备/判定区）的其他角色。
   */
  private static getTargetsForStealOrDismantle(
    source: IPlayer,
    alivePlayers: IPlayer[],
    mods?: DistanceMods,
  ): IPlayer[] {
    return alivePlayers.filter((p) => {
      if (p.id === source.id) return false
      // 必须在距离 1 内
      if (DistanceSystem.getDistance(source, p, alivePlayers, mods) > 1) return false
      // 允许目标区域内无牌（卡牌效果会空放）
      return true
    })
  }

  /**
   * 延时锦囊的目标筛选。
   *
   * - 乐不思蜀/兵粮寸断：判定区内无同名延时锦囊的其他角色
   * - 闪电：自己（或判定区内无闪电的其他角色）
   */
  private static getTargetsForDelayedCard(
    source: IPlayer,
    alivePlayers: IPlayer[],
    card: ICard,
  ): IPlayer[] {
    return alivePlayers.filter((p) => {
      if (p.id === source.id) return true // 总是可以对自己使用
      // 同名延时锦囊不能叠放：判定区里已经有【乐不思蜀】的人不能再吃一张
      return !p.judgeCards.some((c) => c.name === card.name)
    })
  }
}
