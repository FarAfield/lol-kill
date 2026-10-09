// ============================================================
// 联盟杀 · AIController — AI 玩家决策控制器
//
// AIController 实现 IUIDecisionService 接口，作为 AI 玩家的
// 自动化决策提供者。它将引擎的决策请求路由到对应的
// IAIDecisionMaker 策略实例。
//
// 职责：
// - 管理 AI 玩家配置（难度、延迟）
// - 为每个 AI 玩家分配决策策略
// - 实现 IUIDecisionService（可注入到 GameEngine）
// - 记录 AI 决策日志
// - 模拟人类思考延迟
//
// 用法：
//   const aiController = new AIController({
//     defaultDifficulty: AIDifficulty.Normal,
//   })
//   aiController.setStateAccessor(() => engine.getState())
//   aiController.registerPlayer('player_1', AIDifficulty.Hard)
//   engine.setDecisionService(aiController)
// ============================================================

import type {
  IAIDecisionMaker,
  AIPlayerConfig,
  AIDecisionLog,
} from '@core/contracts/ai.interface'
import { AIDifficulty } from '@core/contracts/ai.interface'
import type {
  IUIDecisionService,
  CardPlayOption,
  CardPlayResult,
  IRandomService,
} from '@core/contracts/services.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import type { PlayerId } from '@core/contracts/types'
import { RoleType } from '@core/contracts/enums'
import { AI_MIN_DELAY, AI_MAX_DELAY } from '@source/base/constants'
import { createAIStrategy } from './ai-strategies'
import type { CardBudget } from '@core/skill/card-budget'
import type { IModQuery } from '@core/contracts/mod.interface'
import type { ISkillRegistry } from '@core/contracts/skill.interface'
import { TargetSystem } from '@core/system/target-system'
import { SeededRandomService, randomSeed } from './seeded-random'

// ============================================================
// 默认配置
// ============================================================

const DEFAULT_AI_CONFIG: AIPlayerConfig = {
  difficulty: AIDifficulty.Normal,
  minDelay: AI_MIN_DELAY,
  maxDelay: AI_MAX_DELAY,
}

// ============================================================
// AIController
// ============================================================

/**
 * AI 玩家决策控制器。
 *
 * 实现 IUIDecisionService 接口，可注入到 GameEngine 中
 * 作为 AI 玩家的决策提供者。
 *
 * 线程安全：策略是无状态的，多个 AI 玩家可共享同一策略实例。
 * 如需每个玩家使用独立策略，在 registerPlayer 时传入不同配置。
 */
export class AIController implements IUIDecisionService {
  // ── 内部状态 ──
  private strategies: Map<PlayerId, IAIDecisionMaker> = new Map()
  private configs: Map<PlayerId, AIPlayerConfig> = new Map()
  private defaultDifficulty: AIDifficulty
  private defaultMinDelay: number
  private defaultMaxDelay: number

  /** 游戏状态访问器（由外部注入） */
  private getStateFn: (() => GameStateSnapshot) | null = null

  /** 决策日志 */
  private decisionLogs: AIDecisionLog[] = []
  private logEnabled: boolean = true

  /**
   * AI 自己的随机源
   *
   * 刻意与洗牌那条流分开：回放时没有 AI 参与，共用一条流的话
   * 两次运行消耗的次数不同，整条洗牌序列都会错位。
   */
  private randomService: IRandomService

  /** 出牌额度查询（可选，见构造选项） */
  private cardBudget: CardBudget | undefined

  /** Mod 查询口（可选，见构造选项） */
  private modQuery: IModQuery | undefined

  /** 技能台账（可选，见构造选项） */
  private skillRegistry: ISkillRegistry | undefined

  /** 通知回调（可选，用于 UI 日志） */
  private onNotify: ((message: string, level: 'info' | 'warn' | 'error') => void) | null = null

  constructor(options?: {
    defaultDifficulty?: AIDifficulty
    minDelay?: number
    maxDelay?: number
    logEnabled?: boolean
    /**
     * AI 的随机源（挑牌 / 拟人思考延迟）
     *
     * 不传则为每局新开一颗种子——AI 同桌两位玩家的手气不必雷同。
     * 需要可复现的场景（回放、回归测试）应当显式注入一颗固定种子。
     */
    randomService?: IRandomService
    /**
     * 出牌额度查询 —— 让 AI 与引擎、UI 用同一个「还能出几次」的答案
     *
     * 不注入时策略一律放行（与 `modQuery` 缺席的约定一致），
     * 但那样 AI 就看不见【诸葛连弩】这类额度加成（欠账 D8 的症状）。
     */
    cardBudget?: CardBudget
    /**
     * Mod 查询口 —— AI 靠它感知「对手身上的东西」
     *
     * 不注入时策略按牌面值估算伤害（与 `cardBudget` 缺席的约定一致），
     * 于是藤甲、减伤技这些在 AI 眼里统统不存在（欠账 D19 的症状）。
     */
    modQuery?: IModQuery
    /**
     * 技能台账 —— AI 读别人的 `ai.threaten` 时要问它
     *
     * 不注入时威胁度一律算 0（与其余查询口缺席的约定一致）。
     */
    skillRegistry?: ISkillRegistry
  }) {
    this.defaultDifficulty = options?.defaultDifficulty ?? AIDifficulty.Normal
    this.defaultMinDelay = options?.minDelay ?? AI_MIN_DELAY
    this.defaultMaxDelay = options?.maxDelay ?? AI_MAX_DELAY
    this.logEnabled = options?.logEnabled ?? true
    this.randomService = options?.randomService ?? new SeededRandomService(randomSeed())
    this.cardBudget = options?.cardBudget
    this.modQuery = options?.modQuery
    this.skillRegistry = options?.skillRegistry
  }

  // ── 配置方法 ──

  /**
   * 设置游戏状态访问器。
   *
   * AIController 通过此回调获取最新游戏状态，
   * 并将其传递给 AI 策略用于决策。
   *
   * @param fn 返回当前 GameStateSnapshot 的函数
   */
  setStateAccessor(fn: () => GameStateSnapshot): void {
    this.getStateFn = fn
  }

  /**
   * 设置出牌额度查询（由 `GameBoot` 在引擎就绪后回注）
   *
   * 与 `setStateAccessor` 同一套路：AI 先于引擎出生，只能事后补。
   */
  setCardBudget(budget: CardBudget): void {
    this.cardBudget = budget
    // 已经注册过的策略也要补上——它们是 `registerPlayer` 那一刻造的，
    // 而那时引擎还没出生。只改自己的字段等于没注入。
    this.rebuildStrategies()
  }

  /**
   * 设置 Mod 查询口（由 `GameBoot` 在引擎就绪后回注）
   *
   * 与 `setCardBudget` 同一套路。
   */
  setModQuery(modQuery: IModQuery): void {
    this.modQuery = modQuery
    this.rebuildStrategies()
  }

  /**
   * 设置技能台账（由 `GameBoot` 在引擎就绪后回注）
   */
  setSkillRegistry(skillRegistry: ISkillRegistry): void {
    this.skillRegistry = skillRegistry
    this.rebuildStrategies()
  }

  /**
   * 用当前持有的全部查询口重建策略
   *
   * 注入是**事后**发生的（AI 先于引擎出生），而策略在 `registerPlayer`
   * 时就造好了，晚到的 `cardBudget` / `modQuery` 需要一个补发动作。
   * 少了它，AI 会一直用「出生那天」的空查询口思考。
   */
  private rebuildStrategies(): void {
    const deps = {
      budget: this.cardBudget,
      mods: this.modQuery,
      skills: this.skillRegistry,
    }
    for (const [playerId, config] of this.configs) {
      this.strategies.set(
        playerId,
        createAIStrategy(config.difficulty, this.randomService, deps),
      )
    }
  }

  /**
   * 注册一个 AI 玩家。
   *
   * @param playerId  玩家 ID
   * @param difficulty AI 难度（可选，默认使用构造函数中的 defaultDifficulty）
   * @param config     额外的 AI 配置（可选）
   */
  registerPlayer(
    playerId: PlayerId,
    difficulty?: AIDifficulty,
    config?: Partial<AIPlayerConfig>,
  ): void {
    const diff = difficulty ?? this.defaultDifficulty
    const strategy = createAIStrategy(diff, this.randomService, {
      budget: this.cardBudget,
      mods: this.modQuery,
      skills: this.skillRegistry,
    })
    this.strategies.set(playerId, strategy)

    const fullConfig: AIPlayerConfig = {
      ...DEFAULT_AI_CONFIG,
      difficulty: diff,
      ...config,
    }
    this.configs.set(playerId, fullConfig)
  }

  /**
   * 批量注册 AI 玩家。
   *
   * @param playerIds 玩家 ID 列表
   * @param difficulty 统一难度（可选）
   */
  registerPlayers(
    playerIds: PlayerId[],
    difficulty?: AIDifficulty,
  ): void {
    for (const id of playerIds) {
      this.registerPlayer(id, difficulty)
    }
  }

  /**
   * 注销一个 AI 玩家。
   */
  unregisterPlayer(playerId: PlayerId): void {
    this.strategies.delete(playerId)
    this.configs.delete(playerId)
  }

  /**
   * 设置通知回调（用于 UI 日志输出）。
   */
  setNotifyCallback(
    cb: (message: string, level: 'info' | 'warn' | 'error') => void,
  ): void {
    this.onNotify = cb
  }

  /**
   * 获取决策日志。
   */
  getDecisionLogs(): readonly AIDecisionLog[] {
    return this.decisionLogs
  }

  /**
   * 清空决策日志。
   */
  clearLogs(): void {
    this.decisionLogs = []
  }

  /**
   * 启用/禁用日志。
   */
  setLogEnabled(enabled: boolean): void {
    this.logEnabled = enabled
  }

  // ── IUIDecisionService 实现 ──

  async askForCardPlay(
    player: IPlayer,
    options: CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    const strategy = this.getStrategy(player.id)
    const state = this.getState()

    if (!strategy || !state) {
      // 降级：随机选择
      return this.fallbackCardPlay(options)
    }

    const startTime = Date.now()

    try {
      // 把引擎给的候选整份递进去：视作造出来的虚拟牌**不在**
      // `player.handCards` 里，策略自己翻手牌永远翻不到它。
      // 让 AI 另问一趟 `viewAs.getViews` 则会得到同一件事的第二个答案。
      const choice = strategy.chooseCardToPlay(player, state, options)

      if (!choice) {
        this.logDecision(player.id, 'play', '不出牌', Date.now() - startTime)
        return null
      }

      // 确保选择的卡牌在可用选项中
      const option = options.find((o) => o.card.instanceId === choice.card.instanceId)
      if (!option) {
        this.logDecision(player.id, 'play', '选择无效，不出牌', Date.now() - startTime)
        return null
      }

      // 确保目标合法：先按「能打谁」滤一遍，再按「该打几个」收敛。
      //
      // 两步都不能省——策略是按敌我关系挑人的，它并不知道距离与攻击范围，
      // 于是经常挑出一个打不着的人；而 AOE 与自标牌的目标数是 0，
      // 照原样递上去又会被判「多给了目标」。
      const validTargetIds = new Set(option.validTargets.map((t) => t.id))
      const allowed = choice.targets.filter((t) => validTargetIds.has(t.id))
      const filteredTargets = TargetSystem.pickTargets({
        validTargets: allowed,
        minTargets: option.minTargets,
        maxTargets: option.maxTargets,
      })

      if (filteredTargets.length < option.minTargets) {
        this.logDecision(
          player.id,
          'play',
          `目标不足（需要 ${option.minTargets} 个，合法的只有 ${filteredTargets.length} 个），不出牌`,
          Date.now() - startTime,
        )
        return null
      }

      await this.simulateDelay(player.id)
      this.logDecision(
        player.id,
        'play',
        `使用 ${choice.card.name} → [${filteredTargets.map((t) => t.id).join(', ')}]`,
        Date.now() - startTime,
      )

      return { card: choice.card, targets: filteredTargets }
    } catch {
      this.logDecision(player.id, 'play', '决策异常', Date.now() - startTime)
      return null
    }
  }

  async askForResponse(
    player: IPlayer,
    _prompt: string,
    validCards: ICard[],
    _timeout?: number,
  ): Promise<ICard | null> {
    const strategy = this.getStrategy(player.id)
    const state = this.getState()

    if (!strategy || !state || validCards.length === 0) {
      return null
    }

    const startTime = Date.now()

    try {
      const card = strategy.respondToDefend(player, validCards, state)

      if (card && validCards.some((c) => c.instanceId === card.instanceId)) {
        await this.simulateDelay(player.id)
        this.logDecision(
          player.id,
          'respond',
          `响应: 使用 ${card.name}`,
          Date.now() - startTime,
        )
        return card
      }

      this.logDecision(player.id, 'respond', '不响应', Date.now() - startTime)
      return null
    } catch {
      return null
    }
  }

  async askForTarget(
    player: IPlayer,
    candidates: IPlayer[],
    _prompt: string,
    _minTargets?: number,
    _maxTargets?: number,
  ): Promise<IPlayer[]> {
    const strategy = this.getStrategy(player.id)
    const state = this.getState()

    if (!strategy || !state || candidates.length === 0) {
      return []
    }

    const startTime = Date.now()

    try {
      // 按技能选目标要等 Phase 26（AI 适配新契约）：AI 得先能读到
      // 台账里「这个人此刻有哪些主动技」。在那之前退回「活着的都算候选」。
      const targets: IPlayer[] = candidates.filter((c) => c.alive)

      const minT = _minTargets ?? 1
      const maxT = _maxTargets ?? 1

      await this.simulateDelay(player.id)
      this.logDecision(
        player.id,
        'respond',
        `选择目标: [${targets.slice(0, maxT).map((t) => t.id).join(', ')}]`,
        Date.now() - startTime,
      )

      return targets.slice(0, maxT).length >= minT ? targets.slice(0, maxT) : []
    } catch {
      return []
    }
  }

  async askForEffectUse(
    player: IPlayer,
    effects: ISkill[],
    _prompt: string,
  ): Promise<ISkill | null> {
    const strategy = this.getStrategy(player.id)
    const state = this.getState()

    if (!strategy || !state || effects.length === 0) {
      return null
    }

    const startTime = Date.now()

    try {
      const effect = strategy.chooseEffectToUse(player, effects, state)

      if (effect && effects.some((e) => e.id === effect.id)) {
        await this.simulateDelay(player.id)
        this.logDecision(
          player.id,
          'effect',
          `发动效果: ${effect.name}`,
          Date.now() - startTime,
        )
        return effect
      }

      return null
    } catch {
      return null
    }
  }

  async askForDiscard(
    player: IPlayer,
    count: number,
    validCards: ICard[],
  ): Promise<ICard[]> {
    if (count <= 0 || validCards.length === 0) {
      return []
    }

    const strategy = this.getStrategy(player.id)
    const state = this.getState()

    if (!strategy || !state) {
      // 降级：弃置最前面的牌
      return validCards.slice(0, count)
    }

    const startTime = Date.now()

    try {
      // 将 validCards 临时设置到 player 上供策略使用
      // 策略需要从玩家手牌中做决策
      const cards = strategy.chooseCardsToDiscard(player, count, state)

      // 确保选择的卡牌在合法范围内
      const validIds = new Set(validCards.map((c) => c.id))
      const result = cards.filter((c) => validIds.has(c.id)).slice(0, count)

      await this.simulateDelay(player.id)
      this.logDecision(
        player.id,
        'discard',
        `弃置 ${result.length} 张牌 (需要 ${count}): [${result.map((c) => c.name).join(', ')}]`,
        Date.now() - startTime,
      )

      return result
    } catch {
      // 降级：弃置最前面的牌
      return validCards.slice(0, count)
    }
  }

  async askForHeroSelect(
    player: IPlayer,
    candidates: { id: string; name: string; title: string; kingdom: string }[],
    selectCount: number,
  ): Promise<string> {
    const strategy = this.getStrategy(player.id)
    const state = this.getState()

    if (!strategy || !state || candidates.length === 0) {
      // 降级：选择第一个
      return candidates[0]?.id ?? ''
    }

    const startTime = Date.now()

    try {
      const selected = strategy.chooseHero(player, candidates, selectCount, state)

      if (selected.length > 0 && candidates.some((c) => c.id === selected[0])) {
        await this.simulateDelay(player.id)
        this.logDecision(
          player.id,
          'hero',
          `选择英雄: ${selected[0]}`,
          Date.now() - startTime,
        )
        return selected[0]!
      }

      return candidates[0]?.id ?? ''
    } catch {
      return candidates[0]?.id ?? ''
    }
  }

  notifyPlayer(
    _player: IPlayer,
    message: string,
    level: 'info' | 'warn' | 'error',
  ): void {
    if (this.onNotify) {
      this.onNotify(`[玩家 ${_player.id}] ${message}`, level)
    }
  }

  notifyAll(message: string, level: 'info' | 'warn' | 'error'): void {
    if (this.onNotify) {
      this.onNotify(message, level)
    }
  }

  async showGameResult(result: {
    winner: RoleType | null
    reason: string
  }): Promise<void> {
    if (this.onNotify) {
      this.onNotify(
        `游戏结束: ${result.reason} (胜者: ${result.winner ?? '无'})`,
        'info',
      )
    }
  }

  // ── 私有辅助方法 ──

  /**
   * 获取指定玩家的 AI 策略。
   */
  private getStrategy(playerId: PlayerId): IAIDecisionMaker | undefined {
    return this.strategies.get(playerId)
  }

  /**
   * 获取当前游戏状态。
   */
  private getState(): GameStateSnapshot | null {
    if (!this.getStateFn) return null
    try {
      return this.getStateFn()
    } catch {
      return null
    }
  }

  /**
   * 模拟 AI "思考"延迟。
   */
  private async simulateDelay(playerId: PlayerId): Promise<void> {
    const config = this.configs.get(playerId) ?? {
      difficulty: this.defaultDifficulty,
      minDelay: this.defaultMinDelay,
      maxDelay: this.defaultMaxDelay,
    }
    await new Promise((resolve) => setTimeout(resolve, this.randomService.nextInt(config.minDelay, config.maxDelay)))
  }

  /**
   * 记录决策日志。
   */
  private logDecision(
    playerId: string,
    type: AIDecisionLog['type'],
    summary: string,
    duration: number,
  ): void {
    if (!this.logEnabled) return

    this.decisionLogs.push({
      timestamp: Date.now(),
      playerId,
      type,
      summary,
      duration,
    })
  }

  /**
   * 降级——无策略时的随机出牌。
   */
  private fallbackCardPlay(options: CardPlayOption[]): CardPlayResult | null {
    if (options.length === 0) return null
    const option = options[this.randomService.nextInt(0, options.length - 1)]!
    return { card: option.card, targets: TargetSystem.pickTargets(option) }
  }
}

// ============================================================
// 便捷工厂函数
// ============================================================

/**
 * 为完全 AI 对局创建 AIController。
 *
 * 自动注册所有玩家为 AI 玩家，使用相同的难度。
 *
 * @param playerIds  所有玩家 ID 列表
 * @param difficulty AI 难度（默认 Normal）
 * @param getStateFn 游戏状态访问器
 * @returns 配置好的 AIController 实例
 */
export function createAIControllerForAllPlayers(
  playerIds: PlayerId[],
  difficulty: AIDifficulty = AIDifficulty.Normal,
  getStateFn: () => GameStateSnapshot,
): AIController {
  const controller = new AIController({ defaultDifficulty: difficulty })
  controller.setStateAccessor(getStateFn)
  controller.registerPlayers(playerIds, difficulty)
  return controller
}

/**
 * 为混合对局（人类 + AI）创建 AIController。
 *
 * @param aiPlayerIds  AI 玩家 ID 列表
 * @param difficulty   AI 难度（默认 Normal）
 * @param getStateFn   游戏状态访问器
 * @returns 配置好的 AIController 实例
 */
export function createAIControllerForPlayers(
  aiPlayerIds: PlayerId[],
  difficulty: AIDifficulty = AIDifficulty.Normal,
  getStateFn: () => GameStateSnapshot,
): AIController {
  const controller = new AIController({ defaultDifficulty: difficulty })
  controller.setStateAccessor(getStateFn)
  controller.registerPlayers(aiPlayerIds, difficulty)
  return controller
}
