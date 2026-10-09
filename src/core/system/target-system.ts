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
 * 目标非法 —— `GameEngine.useCard` 拒绝一次出牌时抛出
 *
 * 为什么抛而不是静默跳过：静默的「这张牌没生效」是本仓最难查的一类
 * 故障。调用方若想避免它，`GameEngine.validatePlay` 可以先问一次。
 */
export class TargetValidationError extends Error {
  constructor(
    readonly card: ICard,
    readonly reason: string,
  ) {
    super(`[Target] 非法目标 —— 「${card.name}」: ${reason}`)
    this.name = 'TargetValidationError'
    Object.setPrototypeOf(this, TargetValidationError.prototype)
  }
}

/**
 * 目标选择系统
 *
 * 所有方法均为纯函数——不修改游戏状态。
 */
export class TargetSystem {
  /**
   * 校验目标集合是否合法
   *
   * **生产入口是 `GameEngine.useCard`**（欠账 D31）：本函数此前零调用方，
   * 于是「出牌时非法目标被拒绝并给出原因」这条验收项一直不成立——
   * 校验写得很完整，只是没人叫它。
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

    // 空目标只在「这张牌要求显式选目标」时才算错——
    // AOE 与自标牌的目标数下限是 0（见 getMinTargets）。
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
   * 按一张牌的目标数规则，从合法目标里取出「该选的那几个」
   *
   * 决策服务（UI / AI / 自动回放）共用的收敛口。此前每一处都各写一句
   * `validTargets.slice(0, 1)`，于是 AOE（上限 0）被塞进一个目标、
   * 【借刀杀人】（下限 2）只拿到一个——引擎一旦开始校验目标，
   * 这些出牌全都被判非法。「取几个」和「能打谁」必须同出一处。
   */
  static pickTargets(option: {
    validTargets: IPlayer[]
    minTargets: number
    maxTargets: number
  }): IPlayer[] {
    const { validTargets, minTargets, maxTargets } = option
    // 上限 0 = 这张牌不设目标（AOE / 五谷丰登）
    if (maxTargets <= 0) return []
    const want = Math.max(minTargets, 1)
    return validTargets.slice(0, Math.min(want, maxTargets))
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
   * 获取卡牌的最小目标数 —— 「必须显式选出几个目标」
   *
   * 与 {@link getMaxTargets} 必须同口径，否则会出现「至少 1 个、
   * 至多 0 个」这种无论如何都打不出去的牌（【五谷丰登】曾经就是这样）。
   *
   * 注意「显式」二字：**只对自己生效的牌不算**。装备、酒、无中生有
   * 在各处调用时一律传 `[]`——目标就是自己，写出来是冗余。把它们算成
   * 「至少 1 个」会让每一次正常出牌都被判「未选择目标」。
   */
  static getMinTargets(card: ICard): number {
    // 无懈可击的最小目标为 0（可以选择是否使用）
    if (card.tags.has(CardTag.Cancel) || card.name === '无懈可击') return 0
    // 桃园结义、五谷丰登、南蛮入侵、万箭齐发无目标（AOE 全体生效）
    if (card.tags.has(CardTag.Aoe) || card.tags.has(CardTag.All)) return 0
    // 借刀杀人需要选择2个目标
    if (card.tags.has(CardTag.BorrowedBlade)) return 2
    // 只对自己生效的牌：目标隐含为自己，无需显式给出
    if (this.isSelfOnly(card)) return 0
    // 其他卡牌至少 1 个目标
    return 1
  }

  /**
   * 这张牌是否**只对自己生效**
   *
   * 判据与 {@link computeAvailableTargets} 里那些 `return [source]`
   * 的分支一一对应——两处必须一致，否则「能选的目标只有自己」与
   * 「必须选一个目标」会同时成立，自标牌就永远打不出去。
   */
  static isSelfOnly(card: ICard): boolean {
    const tags = card.tags
    return (
      tags.has(CardTag.Equip) ||
      card.type === 'equip' ||
      tags.has(CardTag.Wine) ||
      tags.has(CardTag.Draw) ||
      tags.has(CardTag.Boost) ||
      tags.has(CardTag.SelfOnly)
    )
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
