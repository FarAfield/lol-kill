// ============================================================
// 联盟杀 · GameEngine — 游戏主控引擎
//
// 将状态机、事件系统、子系统和阶段管理串联起来，
// 是 Core 层的顶层协调器。
//
// 职责：
// - init(config)   — 初始化所有子系统，创建牌堆、分配角色、发放初始手牌
// - start()        — 启动游戏，进入第一个回合
// - runGameLoop()  — 运行完整游戏循环（轮次 → 回合 → 阶段）
// - nextPhase()    — 推进到下一个阶段
//
// 架构：
//   GameEngine 持有所有子系统的引用，作为它们的协调者。
//   UI 通过 GameController 调用引擎，不直接引用内部模块。
// ============================================================

import { GamePhase, RoleType, ZoneType } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import { DEFAULT_DRAW_COUNT, LORD_HP_BONUS } from '@source/base/constants'
import type {
  GameStateSnapshot,
  IGameConfig,
  IGameResult,
} from '@core/contracts/game.interface'
import type { PlayerId, Position } from '@core/contracts/types'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IHero } from '@core/contracts/hero.interface'
import type {
  IUIDecisionService,
  IRandomService,
  ILoggerService,
  IStoreService,
} from '@core/contracts/services.interface'

// ── Entity ──
import { GameState } from '@core/entity/game-state'
import { Player } from '@core/entity/player'
import { Card } from '@core/entity/card'
import { gameClock } from '@core/utils/clock'

// ── Engine ──
import { GameStateMachine, WILDCARD } from './state-machine'
import { TurnManager } from './turn-manager'
import { PhaseManager } from './phase-manager'

// ── Event ──
import { EventChain } from '@core/event/event-chain'
import { ContentRegistry } from '@core/event/content-registry'
import type { ContentEntry } from '@core/event/content-registry'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { GameEvent } from '@core/event/game-event'
import { EventPauseManager } from '@core/event/event-pause-manager'
import { registerCancelGuard } from '@core/event/cancel-chain'
import { GlobalHookRegistry } from '@core/event/global-hook'
import type { EffectContextDeps } from '@core/contracts/effect-context-deps'
import type { IModDefinition } from '@core/contracts/mod.interface'

// ── Skill 层 ──
import { ModRegistry } from '@core/skill/mod-registry'
import { ModQuery } from '@core/skill/mod-query'
import { CardBudget } from '@core/skill/card-budget'
import * as WinCondition from '@core/system/win-condition'
import { TargetSystem } from '@core/system/target-system'
import { SkillRegistry } from '@core/skill/skill-registry'
import { ViewAsService } from '@core/skill/view-as'
import { registerSkillMods } from '@core/skill/skill-mods'

// ── Effect 装配 ──
import { EventCompiler } from '@core/event/event-compiler'
import { collectContents, collectEffects, collectMods } from '@core/boot/effect-setup'
import type { ISkill } from '@core/contracts/skill.interface'

// ── System ──
import { EventTrace } from '@core/debug/event-trace'
import { ModTrace } from '@core/debug/mod-trace'
import { DeckManager } from '@core/system/deck-manager'
import { CardSystem } from '@core/system/card-system'
import { PlayerSystem } from '@core/system/player-system'
import { DamageResolver } from '@core/system/damage-resolver'
import { DeathSystem } from '@core/system/death-system'

/**
 * GameEngine 配置选项
 */
export interface GameEngineOptions {
  /**
   * 随机服务（洗牌 / 身份分配 / 英雄池）——**必填**
   *
   * 引擎里没有第二条随机源：牌堆顺序、身份、英雄候选全由它决定，
   * 于是「同一种子 → 同一局」才有意义（回放与回归测试的前提）。
   */
  randomService: IRandomService
  /** 日志服务 */
  loggerService?: ILoggerService
  /** 存储服务（同步到 UI） */
  storeService?: IStoreService
  /** 决策服务（玩家交互 / AI） */
  decisionService?: IUIDecisionService
  /** 摸牌阶段摸牌数（默认 2） */
  drawCount?: number
  /**
   * 本局加载的效果定义（英雄技能 + 装备被动）。
   * 不传则使用 `collectEffects()` 的默认全集。
   */
  effects?: ISkill[]
  /**
   * 本局加载的事件默认内容（卡牌行为）。
   * 不传则使用 `collectContents()` 的默认全集。
   */
  contents?: ContentEntry[]
  /**
   * 本局加载的 Mod（数值 / 布尔修改器）。
   * 不传则使用 `collectMods()` 的默认全集。
   */
  mods?: IModDefinition[]
}

/**
 * 游戏主控引擎
 *
 * 协调所有子系统完成游戏的生命周期。
 * 所有游戏状态的修改都通过事件系统进行。
 */
export class GameEngine {
  // ── 核心状态 ──
  state: GameState
  stateMachine: GameStateMachine

  // ── 事件系统 ──
  eventChain: EventChain
  eventDispatcher: EventDispatcher
  pauseManager: EventPauseManager
  /**
   * 全局钩子 —— 不属于任何人的监听（Phase 17）
   *
   * 「任意角色出牌时…」这类需求没有持有者，写成技能就得凭空指定
   * 一个人来持有它，而那个人一死监听就意外失效。
   */
  globalHooks: GlobalHookRegistry
  /** 事件默认处理器（卡牌行为等，与「谁在用」无关） */
  contentRegistry: ContentRegistry

  // ── 可观测性（Phase 20）──
  //
  // 两者默认都是**关**的。它们记录的是「发生了什么」的一条流水，
  // 开着跑完一局能有几千个节点——那是排查时愿意付的代价，不是每局都该付的。
  // 更重要的是：**关着的观测必须与不存在等价**。所以「开关」不是
  // 「记完之后丢弃」，而是从一开始就不往下走。
  /** 事件嵌套树 */
  readonly eventTrace = new EventTrace()
  /** Mod 查询的 base → result 链路 */
  readonly modTrace = new ModTrace()

  // ── 回合/阶段管理 ──
  turnManager: TurnManager
  phaseManager: PhaseManager

  // ── 效果系统 ──
  /**
   * 技能台账 —— 「谁拥有哪些技能」的唯一答案
   *
   * 定义（全局的 `ISkill`）与持有者（按人的挂载）都记在这里，
   * 触发技与 `mod` 都以它为准。见 `core/skill/skill-registry.ts`。
   */
  skillRegistry: SkillRegistry
  /**
   * 视作服务 —— 「这张牌此刻能当什么用」的唯一答案来源
   *
   * 出牌阶段用它列候选，响应征询与濒死求桃也用它。
   */
  viewAs: ViewAsService

  // ── Mod（数值 / 布尔修改器）──
  /**
   * Mod 注册表 —— 「数值怎么算」的唯一答案来源
   *
   * 里面的东西必须是纯函数，详见 `core/skill/mod-registry.ts`。
   */
  modRegistry: ModRegistry
  /** Mod 查询门面 —— 系统与效果逻辑一律走这里问数值 */
  modQuery: ModQuery
  /** 出牌额度查询 —— 「这张牌还能用几次」的唯一出口（D8 形态甲） */
  cardBudget: CardBudget

  // ── 子系统 ──
  deckManager: DeckManager
  cardSystem: CardSystem
  /** 玩家状态系统（Phase 19）—— 数值 / 标记 / 存活的唯一写入点 */
  playerSystem: PlayerSystem
  /** 伤害求解器（数值计算是纯的；扣血转交 PlayerSystem） */
  damageResolver: DamageResolver
  deathSystem: DeathSystem

  // ── 服务 ──
  private randomService: IRandomService
  private loggerService?: ILoggerService
  private storeService?: IStoreService
  private decisionService?: IUIDecisionService

  constructor(options: GameEngineOptions) {
    // ── 保存服务引用（必须先于 buildEffectDeps —— deps 里带着决策服务）──
    this.randomService = options.randomService
    this.loggerService = options?.loggerService
    this.storeService = options?.storeService
    this.decisionService = options?.decisionService

    // ── 初始化状态（全生命周期唯一实例，init 时原地 reset） ──
    this.state = new GameState()
    this.stateMachine = new GameStateMachine(GamePhase.NotStarted)

    // ── 初始化子系统（先于事件系统创建，EventDispatcher 需要 deps） ──
    this.deckManager = new DeckManager(this.state, options?.randomService)
    // 玩家系统要早于一切：伤害求解器、死亡系统、技能台账都要拿它当写入口
    this.playerSystem = new PlayerSystem()
    this.damageResolver = new DamageResolver(this.playerSystem)

    // ── 初始化事件系统 ──
    this.eventChain = new EventChain()
    this.pauseManager = new EventPauseManager()
    this.contentRegistry = new ContentRegistry()
    this.eventDispatcher = new EventDispatcher({
      contentRegistry: this.contentRegistry,
      // 追踪端始终挂上，但 `EventTrace.enabled` 默认 false——
      // 挂与**开启**是两件事：挂在树上不动成本，开着才付。
      trace: this.eventTrace,
      // handler 命中数属于「这件事有没有人响应」，
      // 由这里转发给追踪端，调度器不必知道节点长什么样。
      onHandlerExecute: (_handler, event) => this.eventTrace.noteHandler(event.id),
    })
    // ── 全局钩子 ──
    // 挂进技能钩子所在的同一个触发器：两者共用同一条流水线
    // （同样的阶段后缀、同样的优先级排序、同样的 EffectContext）。
    this.globalHooks = new GlobalHookRegistry(this.eventDispatcher.eventTrigger)
    // ── 装载 Mod（数值 / 布尔修改器）──
    // 必须早于 buildEffectDeps()：EffectContext 要把它交给每条事件。
    this.modRegistry = new ModRegistry()
    this.modRegistry.registerAll(options?.mods ?? collectMods())
    this.modRegistry.trace = this.modTrace
    this.modQuery = new ModQuery(this.state, this.modRegistry)
    this.cardBudget = new CardBudget(this.modQuery)
    this.registerCardCancelableGuard()
    this.registerSkillGate()

    // ── 技能台账 ──
    // EventTrigger 由 EventDispatcher 持有，SkillRegistry 通过它把技能挂上去。
    // 必须先于 CardSystem 创建：装备区的每一次变动都要来这里挂/摘装备技。
    // 每登记一条技能就顺手把它的 `mod` 装进 Mod 注册表——于是
    // 「开局之后再登记的技能」与「开局时就有的」走的是同一条路。
    this.skillRegistry = new SkillRegistry(this.eventDispatcher.eventTrigger, new EventCompiler(), {
      onRegister: (skill) =>
        registerSkillMods(this.modRegistry, [skill], (id) =>
          this.skillRegistry.ownersOf(id),
        ),
      // 台账要写标记（转换技态 / 技能计数）——交给玩家系统，不直接碰实体
      playerSystem: this.playerSystem,
    })
    this.skillRegistry.registerAll(options?.effects ?? collectEffects())

    this.cardSystem = new CardSystem(this.state, {
      onEquipmentChange: (players) => {
        for (const player of players) this.skillRegistry.syncEquipSkills(player)
      },
    })

    // 死亡系统要在 CardSystem 之后：死者三区的清空得走它，
    // 否则装备变动通知不发，死者的装备技会一直挂在台账上。
    this.deathSystem = new DeathSystem(this.state, this.playerSystem, this.cardSystem)

    // ── 视作服务 ──
    // 出牌阶段（`PhaseManager`）与响应征询（`ctx.cardViews`）共用这一份，
    // 因此「这张牌能当什么用」在两个场合的答案来自同一处：
    // 同一时刻、同一个人，列出来的候选必然一致。
    this.viewAs = new ViewAsService({
      state: this.state,
      skillRegistry: this.skillRegistry,
      modQuery: this.modQuery,
    })

    // deps 里包含调度器自己（效果要能发子事件），构造完才能回填
    this.eventDispatcher.setDeps(this.buildEffectDeps())

    // ── 装载事件默认内容（卡牌行为）──
    // 与技能分开：内容回答「这个事件本身做什么」，与「谁在用」无关。
    this.contentRegistry.registerAll(options?.contents ?? collectContents())

    // ── 初始化回合/阶段管理 ──
    this.turnManager = new TurnManager(this.state)
    this.phaseManager = new PhaseManager(
      this.state,
      this.eventDispatcher,
      this.eventChain,
      this.deckManager,
      this.turnManager,
      this.cardSystem,
      {
        decisionService: options?.decisionService,
        drawCount: options?.drawCount ?? DEFAULT_DRAW_COUNT,
        modQuery: this.modQuery,
        cardBudget: this.cardBudget,
        skillRegistry: this.skillRegistry,
        viewAs: this.viewAs,
        playerSystem: this.playerSystem,
      },
    )
  }

  /**
   * 开始一个新轮次
   *
   * 三步固定顺序：推进轮次号 → RoundStart 事件 → 清空「每轮一次」的额度。
   * 清空放在 RoundStart 事件**之后**：挂在 `roundStart` 上的技能
   * 仍按上一轮的记账被限制住，不会因为「新轮次先清账」白得一次发动。
   */
  private async beginRound(): Promise<void> {
    this.turnManager.startRound()
    await this.stateMachine.transition(GamePhase.RoundStart, this.state)

    const roundStartEvent = new GameEvent({
      name: 'roundStart',
      phase: GamePhase.RoundStart,
      round: this.state.currentRound,
    })
    await this.eventDispatcher.dispatch(roundStartEvent, this.eventChain)

    this.skillRegistry.resetFrequency('round')
  }

  /**
   * 结束当前轮次
   *
   * `roundEnd` 事件是「持续到轮次结束」的临时技能的到期点——
   * 没有这个事件，那一档持续期就永远等不到自己。
   */
  private async endRound(): Promise<void> {
    const roundEndEvent = new GameEvent({
      name: 'roundEnd',
      phase: GamePhase.RoundEnd,
      round: this.state.currentRound,
    })
    await this.eventDispatcher.dispatch(roundEndEvent, this.eventChain)

    // 轮次末：清掉声明了 `markClear: 'roundEnd'` 的标记（全员）
    for (const player of this.state.players) {
      this.skillRegistry.clearMarks(player, 'roundEnd')
    }
  }

  /**
   * 构建 EffectContextDeps，供 EventDispatcher 在执行 CompiledHandler 时
   * 创建 EffectContext 实例。
   */
  private buildEffectDeps(): EffectContextDeps {
    return {
      state: this.state,
      eventChain: this.eventChain,
      eventDispatcher: this.eventDispatcher,
      pauseManager: this.pauseManager,
      deckManager: this.deckManager,
      cardSystem: this.cardSystem,
      playerSystem: this.playerSystem,
      damageResolver: this.damageResolver,
      deathSystem: this.deathSystem,
      modQuery: this.modQuery,
      skillRegistry: this.skillRegistry,
      viewAs: this.viewAs,
      decisionService: this.decisionService,
      eventTrigger: this.eventDispatcher.eventTrigger,
    }
  }

  /**
   * 把 `mod.cardCancelable` 接到无懈可击的守卫上（验收清单 #13）
   *
   * `registerCancelGuard` 是全局的，而 engine 可能一局一个
   * （测试里经常同时存在好几个），因此守卫先确认事件里的玩家
   * 是不是**本局**的人，不是就放行——否则跨局的 Mod 会互相干扰。
   */
  private registerCardCancelableGuard(): void {
    registerCancelGuard((event, card) => {
      const player = event.player ?? event.source
      if (!player || !card) return undefined
      if (!this.state.players.includes(player)) return undefined
      return this.modQuery.cardCancelable(player, card, event) ? undefined : false
    })
  }

  /**
   * 把 `mod.skillEnabled` 接到事件触发器上
   *
   * 技能被封 = 它的所有钩子都不参与匹配，而不是「跑了再在里面判断」。
   * 后者会让「发动前」与「发动后」的时机都被误触发。
   */
  private registerSkillGate(): void {
    this.eventDispatcher.eventTrigger.setSkillGate((playerId, skillId, event) => {
      const player = this.state.players.find((p) => p.id === playerId)
      // 死者一律不发动。钩子不从台账里摘——摘了就得在复活时记着挂回去，
      // 而「记着」正是这类 bug 的唯一成因；一道闸就够了。
      if (!player || !player.alive) return false
      return this.modQuery.skillEnabled(player, skillId, event)
    })
  }

  /** 两点实际距离（含双方的马 / 技能修正） */
  getDistance(from: IPlayer, to: IPlayer): number {
    return this.modQuery.distance(from, to)
  }

  /** 某人的攻击范围（含武器） */
  getAttackRange(player: IPlayer): number {
    return this.modQuery.attackRange(player)
  }

  /** 某人的手牌上限（含技能修正） */
  getMaxHandcard(player: IPlayer): number {
    return this.modQuery.maxHandcard(player)
  }

  /**
   * 一张牌本回合还能使用几次
   *
   * 上限来自 Mod 注册表，与「能不能出」的判定同出一处（CardBudget）——
   * 早先这两件事分在两个地方，于是连弩装上去以后 AI 与出牌选项
   * 给出不同答案（欠账 D8）。
   */
  cardUsableCount(player: IPlayer, card: ICard): number {
    return this.cardBudget.limitOf(player, card)
  }

  /** 这张牌此刻还能不能再出一次（唯一判定） */
  canPlayCard(player: IPlayer, card: ICard): boolean {
    return this.cardBudget.canPlay(player, card)
  }

  /**
   * 这张牌的合法目标
   *
   * UI 与 AI 都从这里问。此前 `game-controller` 自己按牌型写过一份
   * 目标规则（`src/services/game-controller.ts`），与引擎里的那份各算各的。
   */
  getValidTargets(player: IPlayer, card: ICard): IPlayer[] {
    return TargetSystem.getAvailableTargets(player, card, this.state, this.modQuery)
  }

  // ── 可观测性开关 ──

  /**
   * 开关可观测记录
   *
   * 两个开关默认都关。**它们不参与游戏逻辑**——关着跑出来的一局，
   * 与开着跑出来的一局，必须是同一局（这正是 Phase 20 验收第 3 条
   * 要钉死的事）。
   *
   * @param options.trace 记录事件嵌套树（`EventTrace`）
   * @param options.mods 记录每次 Mod 查询的贡献链路（`ModTrace`）
   */
  setObservability(options: { trace?: boolean; mods?: boolean }): void {
    if (options.trace !== undefined) this.eventTrace.enabled = options.trace
    if (options.mods !== undefined) this.modTrace.enabled = options.mods
  }

  /** 导出本局的事件树 JSON（一局结束后落盘 / 打日志用） */
  exportEventTrace(pretty = false): string {
    return this.eventTrace.export(pretty)
  }

  // ── 初始化 ──

  /**
   * 初始化游戏引擎。
   *
   * 完整的初始化流程：
   * 1. 验证游戏配置
   * 2. 注册状态机转移规则
   * 3. 创建玩家实体
   * 4. 分配身份和英雄
   * 5. 初始化牌堆并洗牌
   * 6. 发放初始手牌
   * 7. 同步到 Store
   *
   * @param config 游戏配置
   */
  async init(config: IGameConfig): Promise<void> {
    this.log('info', 'GameEngine.init() — 开始初始化游戏')

    // 1. 原地重置状态（禁止替换实例，子系统持有引用）
    this.state.reset(config)
    this.skillRegistry.clear()

    // 1b. 归零一切「跨局累积」的确定性计数器
    //     卡牌实例 id、事件 id 与逻辑时钟都是模块级自增的，不归零的话
    //     第二局的 id 会从上一局的尾巴接着往下走——
    //     回放因此永远对不上（录的是 card_1…/event_1…，放的是 card_93…/event_546…）。
    //     事件 id 这一条是 Phase 20 补的：Phase 18 只归零了卡牌，而事件树
    //     导出里带着 id，于是「开着观测跑两遍」反而比不开时对不上。
    Card.resetIdGenerator()
    GameEvent.resetIdGenerator()
    gameClock.reset()

    // 1c. 清空上一局的可观测记录。
    //     观测档案是**按局**切的：留着上一局的节点会让「这局为什么这样」
    //     的排查从第一行就开始走错路。
    this.eventTrace.reset()
    this.modTrace.reset()

    // 2. 注册状态机
    this.registerStateMachine()

    // 3. 创建玩家
    this.createPlayers(config)

    // 4. 分配身份
    this.assignRoles(config.roles)

    // 5. 分配英雄
    await this.assignHeroes(config.heroes, config.heroSelectCount)

    // 5b. 按现状把技能挂到每个人身上（英雄技 + 装备技）
    //     必须晚于英雄分配——技能的持有者此刻才存在。
    const loadedSkills = this.skillRegistry.syncAll(this.state.players)
    this.log('info', `GameEngine.init() — 已挂载 ${loadedSkills} 个技能`)

    // 6. 初始化牌堆
    this.deckManager.initializeDeck(config.cards)
    this.deckManager.shuffle()

    // 7. 发放初始手牌
    this.dealInitialHands(config.initialHandSize)

    // 8. 标记准备完成
    this.state.markStarted()
    this.stateMachine.reset(GamePhase.Prepare)

    // 9. 同步
    this.syncState()

    this.log('info', 'GameEngine.init() — 初始化完成')
  }

  /**
   * 启动游戏——进入第一个回合。
   *
   * 在 init() 之后调用。
   * 流程：Prepare → RoundStart → 第一个玩家的 PhasePre
   */
  async start(): Promise<void> {
    if (!this.state.started) {
      throw new Error('[GameEngine] 游戏尚未初始化，请先调用 init()')
    }

    this.log('info', 'GameEngine.start() — 游戏开始')

    // ── 触发 GameStart 事件 ──
    const gameStartEvent = new GameEvent({
      name: 'gameStart',
      phase: GamePhase.Prepare,
      round: this.state.currentRound,
    })
    await this.eventDispatcher.dispatch(gameStartEvent, this.eventChain)

    // ── Prepare → RoundStart ──
    await this.stateMachine.transition(GamePhase.RoundStart, this.state)
    this.state.currentPhase = GamePhase.RoundStart

    // ── 开始第一轮 ──
    await this.beginRound()

    // ── 进入第一个玩家的回合 ──
    const firstPlayer = this.turnManager.getCurrentPlayer()
    if (firstPlayer) {
      await this.phaseManager.executeTurn()
    }

    this.syncState()
  }

  /**
   * 运行完整的游戏循环。
   *
   * 持续循环：轮次 → 回合 → 阶段，直到游戏结束。
   * 在每步之间检查胜利条件和游戏结束标记。
   *
   * @returns 游戏结果
   */
  async runGameLoop(): Promise<IGameResult> {
    while (!this.state.finished) {
      // 检查当前轮次是否所有玩家都已行动
      if (this.turnManager.isRoundComplete) {
        // 轮次结束 → 检查游戏结束 → 开始新轮次
        this.state.currentPhase = GamePhase.RoundEnd
        await this.stateMachine.transition(GamePhase.RoundEnd, this.state)

        const gameOverResult = this.checkGameOver()
        if (gameOverResult) {
          return this.endGame(gameOverResult)
        }

        await this.endRound()

        // 检查最大轮次数
        if (this.state.currentRound >= this.state.config.maxRounds) {
          return this.endGame({
            winner: null,
            reason: `达到最大轮次数 ${this.state.config.maxRounds}，游戏平局`,
            survivingPlayers: this.state.alivePlayers,
            totalRounds: this.state.currentRound,
            endedAt: gameClock.next(),
          })
        }

        // 开始新轮次
        await this.beginRound()
      }

      // 获取下一个玩家
      const nextPlayer = this.turnManager.nextTurn()
      if (!nextPlayer) {
        // 没有可行动的玩家（异常情况）
        if (this.state.aliveCount === 0) {
          return this.endGame({
            winner: null,
            reason: '所有玩家已死亡',
            survivingPlayers: [],
            totalRounds: this.state.currentRound,
            endedAt: gameClock.next(),
          })
        }
        continue
      }

      // 执行该玩家的回合
      await this.phaseManager.executeTurn()

      // 检查游戏是否结束（玩家可能在回合中死亡导致胜利条件满足）
      const gameOverResult = this.checkGameOver()
      if (gameOverResult) {
        return this.endGame(gameOverResult)
      }

      this.syncState()
    }

    // 构建最终结果
    return this.state.buildResult(null, '游戏已结束')
  }

  /**
   * 检查是否已达终局
   *
   * 规则本身在 `WinCondition.evaluate()`（纯函数，`src/core/system/win-condition.ts`）——
   * 它只吃 `{ players }`，跟牌堆、阶段、日志一概无关，因此 9 种终局都能
   * 写成不启动引擎的单测。这里只负责把结论翻译成 `IGameResult`。
   *
   * 早先这段规则住在 `DeathSystem.checkGameOver` 里（欠账 D17）：
   * 一个系统实例方法，于是每验一条胜负规则都得先打完一局。
   */
  checkGameOver(): IGameResult | null {
    const outcome = WinCondition.evaluate(this.state)
    if (!outcome.over) return null

    return {
      winner: outcome.winner,
      reason: outcome.reason,
      survivingPlayers: this.state.players.filter((p) => p.alive),
      totalRounds: this.state.currentRound,
      endedAt: gameClock.next(),
    }
  }

  /**
   * 使用一张牌 —— 唯一的用牌入口。
   *
   * UI、AI、技能（借刀杀人等）都走这里，避免各写一份「移入处理区 →
   * 发 useCard 事件 → 结算完入弃牌堆」的样板。
   *
   * 真正的卡牌行为由 `ContentRegistry` 决定（见 `useCard` 内容），
   * 引擎本身不认识任何一张具体的牌。
   */
  async useCard(player: IPlayer, card: ICard, targets: IPlayer[]): Promise<void> {
    // 1. 从手牌移入处理区
    this.cardSystem.useCard(card, player)

    // 2. 使用事件（卡牌自己的内容在这里被触发）
    const event = new GameEvent({
      name: 'useCard',
      source: player,
      player,
      targets,
      cards: [card],
      // 结构性标记：锦囊类事件会征询无懈可击。
      // 按**标签**判定而非牌名，因此引擎依旧不认识任何一张具体的牌。
      // 此刻能否真的被抵消由 canBeCountered() 综合判定（Phase 9）。
      cancelable: card.tags.has(CardTag.Trick) && !card.isDelayed,
      phase: this.state.currentPhase,
      round: this.state.currentRound,
      turn: player.seatIndex,
    })
    await this.eventDispatcher.dispatch(event, this.eventChain)

    // 3. 结算完成 → 移入弃牌堆
    //    装备牌已被 equip 内容挪进装备区，延时锦囊已进判定区，都不是处理区
    if (card.zone === ZoneType.Processing) {
      this.cardSystem.finishProcessing(card)
    }

    this.syncState()
  }

  /**
   * 推进到下一个阶段（玩家主动结束当前阶段时调用）。
   *
   * UI 通过此方法通知引擎当前阶段结束，进入下一阶段。
   * 例如：玩家在出牌阶段点击「结束出牌」时调用。
   */
  async nextPhase(): Promise<void> {
    const currentPlayer = this.turnManager.getCurrentPlayer()
    if (!currentPlayer) return

    const currentPhase = this.state.currentPhase
    const nextPhase = this.phaseManager.getNextPhase(currentPhase)

    if (nextPhase) {
      // 转移到下一个阶段
      await this.stateMachine.transition(nextPhase, this.state)
      this.state.currentPhase = nextPhase

      // 执行下一阶段
      await this.phaseManager.executePhase(nextPhase, currentPlayer)
    } else {
      // 最后一个阶段（PhasePost）结束，回合结束
      this.state.currentPhase = GamePhase.PhasePost
      await this.stateMachine.transition(GamePhase.PhasePost, this.state)
    }

    this.syncState()
  }

  // ── 游戏结束 ──

  /**
   * 结束游戏。
   *
   * 触发 GameOver 事件，标记 finished，同步状态。
   */
  private async endGame(result: IGameResult): Promise<IGameResult> {
    this.state.markFinished()
    await this.stateMachine.transition(GamePhase.GameOver, this.state)

    // 触发 GameOver 事件
    const gameOverEvent = new GameEvent({
      name: 'gameOver',
      phase: GamePhase.GameOver,
      round: this.state.currentRound,
      data: { result },
    })
    await this.eventDispatcher.dispatch(gameOverEvent, this.eventChain)

    this.syncState()
    this.log('info', `游戏结束: ${result.reason}`)

    return result
  }

  // ── 查询 ──

  /**
   * 获取当前玩家。
   */
  getCurrentPlayer(): IPlayer | undefined {
    return this.turnManager.getCurrentPlayer()
  }

  /**
   * 获取游戏状态快照。
   */
  getState(): Readonly<GameStateSnapshot> {
    return this.state.snapshot()
  }

  /**
   * 游戏是否已结束。
   */
  get isGameOver(): boolean {
    return this.state.finished
  }

  // ── 私有方法 ──

  /**
   * 注册状态机的全部转移规则。
   */
  private registerStateMachine(): void {
    // ── 标准游戏流程 ──
    this.stateMachine.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
    this.stateMachine.registerState(GamePhase.Prepare, [GamePhase.RoundStart])
    this.stateMachine.registerState(GamePhase.RoundStart, [GamePhase.PhasePre])

    // 回合内阶段顺序
    this.stateMachine.registerState(GamePhase.PhasePre, [GamePhase.PhaseJudge])
    this.stateMachine.registerState(GamePhase.PhaseJudge, [GamePhase.PhaseDraw])
    this.stateMachine.registerState(GamePhase.PhaseDraw, [GamePhase.PhaseUse])
    this.stateMachine.registerState(GamePhase.PhaseUse, [GamePhase.PhaseDiscard])
    this.stateMachine.registerState(GamePhase.PhaseDiscard, [GamePhase.PhasePost])

    // 回合结束 → 轮次结束
    this.stateMachine.registerState(GamePhase.PhasePost, [GamePhase.RoundEnd])

    // 轮次结束 → 下一轮 或 游戏结束
    this.stateMachine.registerState(GamePhase.RoundEnd, [
      {
        to: GamePhase.RoundStart,
        condition: (s) =>
          s.currentRound < s.config.maxRounds && !s.finished,
      },
      { to: GamePhase.GameOver, condition: (s) => s.finished },
    ])

    // ── 通配符：任意状态 → GameOver（玩家死亡等突发事件） ──
    this.stateMachine.registerState(WILDCARD, [GamePhase.GameOver])
  }

  /**
   * 创建玩家实体。
   */
  private createPlayers(config: IGameConfig): void {
    const players: IPlayer[] = []
    for (let i = 0; i < config.playerCount; i++) {
      const player = new Player({
        id: `player_${i}` as PlayerId,
        seatIndex: i as Position,
      })
      players.push(player)
    }
    this.state.players = players
    this.state.currentPlayerIndex = 0
  }

  /**
   * 分配身份。
   */
  private assignRoles(roles: RoleType[]): void {
    if (roles.length === 0) return

    // 随机打乱身份
    const shuffled = this.randomService.shuffle([...roles])

    for (let i = 0; i < this.state.players.length && i < shuffled.length; i++) {
      const player = this.state.players[i]!
      const role = shuffled[i]!
      this.playerSystem.setRole(player, role)

      // 天命星灵（主公）身份公开
      if (role === RoleType.Aspect) {
        this.playerSystem.revealRole(player)
      }
      //
      // 注：主公的体力上限加成**不在这里加**。它跟着英雄走——
      // `PlayerSystem.chooseHeroes(player, [hero], LORD_HP_BONUS)` 在下一步
      // 分配英雄时一次算清（`assignHero` 会按身份传加成）。
      // 这里曾经写过一句 `player.maxHp += LORD_HP_BONUS`，但那时 `maxHp` 还是 0
      // （英雄尚未分配），加完又被 `chooseHeroes` 整个覆盖——是一句只会误导人的空转。
    }
  }

  /**
   * 分配英雄。
   *
   * 从英雄池中为每位玩家随机选择指定数量的英雄供选择（或直接随机分配）。
   *
   * @param heroes      可用英雄池
   * @param selectCount 每位玩家可选择的英雄数量（从 selectCount 中选 1）
   */
  private async assignHeroes(
    heroes: IHero[],
    selectCount: number,
  ): Promise<void> {
    if (heroes.length === 0) return

    const shuffled = this.randomService.shuffle([...heroes])

    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i]!
      // 为每位玩家从英雄池中分配 selectCount 个候选
      const startIdx = (i * selectCount) % shuffled.length
      const candidates = shuffled.slice(startIdx, startIdx + selectCount)

      // 如果有决策服务，让玩家选择
      if (this.decisionService && candidates.length > 0) {
        try {
          const chosenId = await this.decisionService.askForHeroSelect(
            player,
            candidates.map((h) => ({
              id: h.id,
              name: h.name,
              title: h.title,
              kingdom: h.kingdom,
            })),
            1,
          )
          const chosen = candidates.find((h) => h.id === chosenId)
          if (chosen) {
            this.assignHero(player, chosen)
            continue
          }
        } catch {
          // 选择失败，走默认分配
        }
      }

      // 默认分配第一个候选英雄
      if (candidates.length > 0) {
        this.assignHero(player, candidates[0]!)
      }
    }
  }

  /**
   * 把一位英雄安给某位玩家
   *
   * 写在这里而不是内联两次（玩家自选 / 默认分配各一份），是因为
   * 「主公多加一点体力上限」这种追加规则**只要漏掉一份就永远发现不了**——
   * 走默认分配的人拿不到加成，而这条路径在 AI 对局里才是常态。
   * 加成本身也交给了 `PlayerSystem.chooseHeroes`，它跟着英雄一起算。
   */
  private assignHero(player: IPlayer, hero: IHero): void {
    const bonus = player.role === RoleType.Aspect ? LORD_HP_BONUS : 0
    this.playerSystem.chooseHeroes(player, [hero], bonus)
  }

  /**
   * 发放初始手牌。
   *
   * 每位存活玩家抽取 initialHandSize 张牌。
   */
  private dealInitialHands(handSize: number): void {
    for (const player of this.state.players) {
      if (!player.alive) continue
      const cards = this.deckManager.draw(handSize)
      // 走 CardSystem：owner 与 visibleTo 一起改，
      // 否则开局手牌带着上一次的可见性（牌堆里的「谁都看不见」）进手牌。
      this.cardSystem.obtainCards(cards, player)
    }
  }

  /**
   * 同步状态到 Store（如果已注入）。
   */
  private syncState(): void {
    if (this.storeService) {
      this.storeService.syncGameState(this.state.toJSON())
    }
  }

  /**
   * 日志记录。
   */
  private log(level: 'info' | 'warn' | 'error', message: string): void {
    if (this.loggerService) {
      this.loggerService.log(message, level as import('@core/contracts/enums').LogLevel)
    }
  }

}
