// ============================================================
// 联盟杀 · AI 决策接口
//
// 定义 AI 决策器的契约，引擎通过此接口向 AI 请求决策。
// 每种 AI 难度（Beginner / Normal / Hard）各自实现。
// ============================================================

import type { IPlayer } from './player.interface'
import type { ICard } from './card.interface'
import type { ISkill } from './skill.interface'
import type { GameStateSnapshot } from './game.interface'
import type { CardPlayOption } from './services.interface'

/**
 * AI 卡牌选择结果 — 包含选中的卡牌及其目标
 */
export interface AICardChoice {
  /** 选中的卡牌 */
  card: ICard
  /** 选中的目标列表 */
  targets: IPlayer[]
}

/**
 * AI 决策器接口
 *
 * 每种 AI 难度实现此接口。引擎在需要 AI 决策时调用对应方法。
 * 所有方法为同步调用（AI 不需要真实等待用户输入）。
 *
 * 方法分为两组：
 * - 主动决策：出牌阶段、弃牌阶段、英雄选择等
 * - 响应决策：防御响应、濒死求桃、技能发动等
 */
export interface IAIDecisionMaker {
  // ── 主动决策 ──

  /**
   * 选择一张卡牌打出，并指定目标。
   *
   * @param player  AI 玩家
   * @param state   当前游戏状态（只读视角）
   * @param options 引擎给出的**此刻可打的牌**（含视作造出来的虚拟牌）
   * @returns 选择的卡牌和目标，null 表示不出牌
   *
   * ── `options` 是候选的唯一真值源 ──
   *
   * 出牌阶段能打什么由引擎一处算出（`PhaseManager.getPlayableCards`）：
   * 真手牌、视作技能造出来的虚拟牌、被 Mod 禁掉的牌、额度用完的牌，
   * 四件事在那儿一次性收口。AI **只在它给的候选里挑**——
   * 自己翻一遍 `player.handCards` 就会漏掉虚拟牌（视作牌不在手牌数组里），
   * 而另问一趟 `viewAs.getViews` 是同一件事的第二个答案。
   *
   * 缺省时（纯策略单测）退回手牌，行为与注入前一致。
   */
  chooseCardToPlay(
    player: IPlayer,
    state: GameStateSnapshot,
    options?: readonly CardPlayOption[],
  ): AICardChoice | null

  /**
   * 选择一个可用的主动技能发动。
   *
   * @param player           AI 玩家
   * @param availableEffects 当前可发动的技能列表
   * @param state            当前游戏状态
   * @returns 选中的技能，null 表示不发动
   */
  chooseEffectToUse(
    player: IPlayer,
    availableEffects: ISkill[],
    state: GameStateSnapshot,
  ): ISkill | null

  /**
   * 选择指定数量的卡牌弃置。
   *
   * @param player AI 玩家
   * @param count  需弃置的数量
   * @param state  当前游戏状态
   * @returns 选中的卡牌列表（长度应等于 count）
   */
  chooseCardsToDiscard(player: IPlayer, count: number, state: GameStateSnapshot): ICard[]

  /**
   * 选择英雄。
   *
   * @param player      AI 玩家
   * @param candidates  候选英雄列表
   * @param selectCount 可选择数量
   * @param state       当前游戏状态
   * @returns 选中的英雄 ID 列表
   */
  chooseHero(
    player: IPlayer,
    candidates: { id: string; name: string; title: string; kingdom: string }[],
    selectCount: number,
    state: GameStateSnapshot,
  ): string[]

  // ── 响应决策 ──

  /**
   * 响应防御（如是否出闪）。
   *
   * @param player     AI 玩家
   * @param validCards 可用的响应卡牌（如闪）
   * @param state      当前游戏状态
   * @returns 选中的卡牌，null 表示不响应
   */
  respondToDefend(
    player: IPlayer,
    validCards: ICard[],
    state: GameStateSnapshot,
  ): ICard | null

  /**
   * 响应濒死求桃——是否出桃救濒死角色。
   *
   * @param player      AI 玩家（被询问者）
   * @param dyingPlayer 濒死角色
   * @param validCards  可用的桃牌
   * @param state       当前游戏状态
   * @returns 选中的桃牌，null 表示不出
   */
  respondToDying(
    player: IPlayer,
    dyingPlayer: IPlayer,
    validCards: ICard[],
    state: GameStateSnapshot,
  ): ICard | null

  /**
   * 响应技能发动机会（如被动技触发时是否发动）。
   *
   * @param player           AI 玩家
   * @param availableEffects 可发动的技能列表
   * @param state            当前游戏状态
   * @returns 选中的技能，null 表示不发动
   */
  respondWithEffect(
    player: IPlayer,
    availableEffects: ISkill[],
    state: GameStateSnapshot,
  ): ISkill | null

  /**
   * 选择技能的目标。
   *
   * @param player     AI 玩家
   * @param effect     要发动的技能
   * @param candidates 候选目标列表
   * @param state      当前游戏状态
   * @returns 选中的目标列表
   */
  chooseEffectTargets(
    player: IPlayer,
    effect: ISkill,
    candidates: IPlayer[],
    state: GameStateSnapshot,
  ): IPlayer[]

  /**
   * 选择技能所需的卡牌（如需要弃置/展示卡牌时）。
   *
   * @param player     AI 玩家
   * @param effect     要发动的技能
   * @param candidates 候选卡牌列表
   * @param state      当前游戏状态
   * @returns 选中的卡牌列表
   */
  chooseEffectCards(
    player: IPlayer,
    effect: ISkill,
    candidates: ICard[],
    state: GameStateSnapshot,
  ): ICard[]
}

/**
 * AI 难度等级
 */
export enum AIDifficulty {
  /** 新手 — 随机出牌，有响应必出 */
  Beginner = 'beginner',
  /** 普通 — 基本战术（优先出杀、保留闪桃） */
  Normal = 'normal',
  /** 困难 — 考虑身份、手牌管理、距离控制 */
  Hard = 'hard',
}

/**
 * AI 玩家配置 — 控制 AI 的行为参数
 */
export interface AIPlayerConfig {
  /** AI 难度等级 */
  difficulty: AIDifficulty
  /** 最小决策延迟（ms），用于模拟人类"思考" */
  minDelay: number
  /** 最大决策延迟（ms） */
  maxDelay: number
}

/**
 * AI 决策日志 — 记录一次 AI 决策的详细信息，用于调试和分析
 */
export interface AIDecisionLog {
  /** 决策时间戳 */
  timestamp: number
  /** 做出决策的玩家 ID */
  playerId: string
  /** 决策类型 */
  type: 'play' | 'respond' | 'discard' | 'effect' | 'hero'
  /** 决策摘要（人类可读） */
  summary: string
  /** 决策耗时（ms） */
  duration: number
}
