// ============================================================
// 联盟杀 · GameController — UI ↔ 引擎桥接层
//
// GameController 是 UI 层与 Core 引擎之间的唯一交互入口。
// UI 不直接引用 core/event、core/engine、core/system 中的任何模块。
//
// 职责：
// - 持有 GameEngine 实例，管理游戏生命周期
// - 提供 UI 可调用的操作方法（createGame, startGame, 答复提问 等）
// - 提供状态查询方法（getGameState, getCurrentPlayer, getAvailableActions 等）
// - 管理 StoreService → Pinia Store 的状态同步
// - 管理人类玩家 / AI 玩家的决策路由
//
// **推进模型（欠账 D38 形态丁）**：引擎是唯一的推进者。
// 控制器**不推引擎**，它只做两件事：把引擎挂起的提问交给 UI，
// 再把 UI 的答案递回去。因此下面的 `playCard` / `discardCards`
// 都不是「执行」而是「答复」——出牌这件事在整局里只由引擎做一次。
//
// 架构位置：
//   UI Layer (views/components/hooks) → GameController → Core Layer (GameEngine)
// ============================================================

import { ref } from 'vue'
import { GameEngine } from '@core/engine/game-engine'
import { StoreService } from '@core/services/store-service'
import type {
  IGameConfig,
  GameStateSnapshot,
  IGameResult,
} from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type {
  CardPlayOption,
  CardPlayResult,
  IUIDecisionService,
  IRandomService,
} from '@core/contracts/services.interface'
import { SeededRandomService, randomSeed } from '@core/services/seeded-random'
import { GamePhase } from '@core/contracts/enums'
import type { ISkill, SkillEnableContext } from '@core/contracts/skill.interface'
import { GameEvent } from '@core/event/game-event'
import type { IPlayerStatsQuery } from '@/store/game-store'

// ── Pinia Store 类型（延迟导入，避免循环依赖） ──
interface IGameStore {
  syncFromEngine(state: GameStateSnapshot): void
  /** 注入「要查规则才答得上来」的那几个数的查询口（欠账 D41） */
  setStatsQuery(query: IPlayerStatsQuery | null): void
  reset(): void
}

/**
 * 一个可打出项 —— 引擎挂起提问时给出的 `CardPlayOption` 在 UI 这一侧的形状。
 *
 * **它只有一个来源**：挂起提问的 `options`。UI 不另算一份
 * （不翻手牌、不重问额度、不重算距离），否则「此刻能打什么」
 * 就又变成两个答案——装了连弩以后两边给出不同结果（欠账 D8 的 UI 那一半）。
 */
export interface CardPlayChoice {
  /** 卡牌实例 ID */
  cardId: string
  /** 这张牌此刻的合法目标 */
  validTargetIds: string[]
  /** 至少要选几个目标（0 = 可以不选：AOE、只对自己生效的牌） */
  minTargets: number
  /** 至多选几个目标 */
  maxTargets: number
}

/**
 * 玩家可执行的操作描述。
 *
 * UI 根据此信息决定显示哪些按钮、高亮哪些卡牌/目标。
 */
export interface AvailableActions {
  /** 当前阶段 */
  phase: GamePhase
  /** 是否为当前玩家的回合 */
  isMyTurn: boolean
  /** 可打出的卡牌及其合法目标（= 当前挂起提问给出的选项） */
  playableCards: CardPlayChoice[]
  /** 可发动的技能 ID 列表 */
  usableEffects: string[]
  /**
   * 是否可以「结束」——**它的含义是「此刻正挂着一个出牌提问」**。
   *
   * 形态丁下回合内没有提问的阶段不会停（准备 / 判定 / 摸牌 / 结束
   * 引擎一路跑过去），所以「现在是某个阶段」不再是「能按按钮」的依据；
   * 「结束出牌」按钮按下去，答复的是那个已经挂起的提问。
   */
  canEndPhase: boolean
  /** 是否正在等待响应 */
  isWaitingResponse: boolean
  /** 等待响应的提示 */
  responsePrompt?: string
  /** 响应时可选的卡牌 ID 列表 */
  responseCardIds?: string[]
  /** 是否正在等一个弃牌提问（弃牌阶段只在手牌超上限时才停） */
  needDiscard: boolean
  /** 需要弃置的卡牌数量 */
  discardCount: number
}

/**
 * 引擎挂起的一个提问 —— 引擎正停在事件流水线里等这一个答案。
 */
interface PendingCardPlay {
  player: IPlayer
  options: readonly CardPlayOption[]
  resolve: (result: CardPlayResult | null) => void
}

interface PendingDiscard {
  player: IPlayer
  count: number
  validCards: readonly ICard[]
  resolve: (cards: ICard[]) => void
}

// ── 默认空可用操作 ──
const EMPTY_ACTIONS: AvailableActions = {
  phase: GamePhase.NotStarted,
  isMyTurn: false,
  playableCards: [],
  usableEffects: [],
  canEndPhase: false,
  isWaitingResponse: false,
  needDiscard: false,
  discardCount: 0,
}

/**
 * 引擎给的 `CardPlayOption` → UI 那一侧的形状。
 *
 * 目标数的上下限**随选项一起过来**，不在这里猜：
 * 「取一个」只是多数牌的巧合——AOE 是 0 个、借刀杀人是 2 个，
 * 猜错的后果是玩家点不到或点多（欠账 D31 记的就是这件事）。
 */
function toCardPlayChoice(option: CardPlayOption): CardPlayChoice {
  return {
    cardId: option.card.instanceId,
    validTargetIds: option.validTargets.map((p) => p.id),
    minTargets: option.minTargets,
    maxTargets: option.maxTargets,
  }
}

/**
 * GameController — UI 与引擎的唯一交互入口。
 *
 * 用法：
 *   const controller = new GameController()
 *   await controller.createGame(config)
 *   await controller.startGame()          // 只开局 + 起循环，不等到分出胜负
 *   // UI 通过 controller.getAvailableActions() 决定显示什么
 *   // 引擎挂起提问后：controller.playCard(cardId, [targetId]) / endCardPlay()
 */
export class GameController {
  private engine: GameEngine | null = null
  private storeService: StoreService
  private decisionService: IUIDecisionService | null = null
  private piniaStore: IGameStore | null = null
  private isRunning = false
  private gameResult: IGameResult | null = null
  private randomService: IRandomService
  /**
   * 引擎挂起、正在等 UI 答复的那个提问（至多一个）。
   *
   * 至多一个是**形态丁的必然结果**：引擎是唯一推进者，它停下来问的时候
   * 整条流水线都停在那儿，问完这一个才会问下一个。
   */
  private pendingCardPlay: PendingCardPlay | null = null
  private pendingDiscard: PendingDiscard | null = null
  /** 整局那个循环的出口（`startGame()` 只把它跑起来，不 await 到结束） */
  private loopPromise: Promise<IGameResult> | null = null
  /**
   * 「我的答案变了几次」——UI 唯一的响应式抓手（欠账 D45）。
   *
   * 控制器给出去的那些答案（此刻挂着哪个提问、能打哪几张牌、面板上
   * 有哪些技能）**全是普通字段**，Vue 看不见它们。而唯一能把变化推出去的
   * 那条路——「引擎同步状态 → Store → 重算」——**盖不住提问的时刻**：
   *
   *   executeTurn():  currentPhase = PhaseUse → onPhaseSync()  ← 最后一次同步
   *   executePhase(): await dispatch(阶段事件)
   *   doPhaseUse():   await askForCardPlay(...)                ← 提问挂起
   *
   * 同步在前、提问在后，中间没有任何一次状态推送。于是界面停在最后一次
   * 同步时的样子：没有按钮、没有可点的牌、只显示「等待其他玩家操作…」，
   * 而引擎正悬在那儿等这一位答复 —— 两边互相等，第一回合就卡死了。
   *
   * 所以「什么时候该重读控制器」由控制器自己报：提问挂起 / 答复 /
   * 状态同步，三处各自报一次变更。UI 不许另猜（按阶段猜、按手牌数猜，
   * 都会漏掉「提问刚好落在两次同步之间」这一种）。
   */
  private readonly revisionRef = ref(0)

  /** 见 `revisionRef` —— UI 的 computed 读它，就是挂上了那个依赖 */
  get revision(): number {
    return this.revisionRef.value
  }

  constructor(options?: { randomService?: IRandomService; seed?: number | string }) {
    this.storeService = new StoreService()
    // 引擎现在强制要求随机源：UI 不指定就按种子现开一个确定性的
    this.randomService =
      options?.randomService ?? new SeededRandomService(options?.seed ?? randomSeed())
  }

  // ── 初始化 ──

  /**
   * 绑定 Pinia Store。
   *
   * 必须在调用 createGame() 之前设置。
   * 引擎每次状态变更后都会通过 StoreService 推送最新状态到 Pinia Store。
   *
   * @param store Pinia GameStore 实例
   */
  bindStore(store: IGameStore): void {
    this.piniaStore = store

    // 注册同步回调：引擎状态变更 → Pinia Store
    this.storeService.onChange((state) => {
      store.syncFromEngine(state)
    })

    this.pushStatsQuery()
  }

  /**
   * 把「要查规则才答得上来」的那几个数的查询口递给 Store（欠账 D41）
   *
   * 攻击范围 / 手牌上限是 `ModRegistry` 算出来的，快照里没有，
   * 于是 Store 只能**去问引擎**。问的那个人就是本控制器——
   * 它是 UI 与引擎之间唯一的桥。
   *
   * **为什么两个地方都调**：引擎在 `createGame()` 里出生，Store 在
   * `bindStore()` 里进门，谁先谁后没保证。D37 已经为「补发只写在
   * 一条启动路径上」付出过代价（图形界面那一路的 AI 一直是瞎的），
   * 因此这里两边都补——补发是幂等的，漏一处才是真事故。
   */
  private pushStatsQuery(): void {
    const engine = this.engine
    const store = this.piniaStore
    if (!engine || !store) return

    const query: IPlayerStatsQuery = {
      attackRange: (player) => engine.getAttackRange(player),
      maxHandcard: (player) => engine.getMaxHandcard(player),
    }
    store.setStatsQuery(query)
  }

  /**
   * 设置决策服务（用于人类玩家交互或 AI 决策）。
   *
   * @param service 决策服务实现
   */
  setDecisionService(service: IUIDecisionService): void {
    this.decisionService = service
  }

  // ── 游戏生命周期 ──

  /**
   * 创建并初始化游戏。
   *
   * 流程：创建 GameEngine → init(config) → 同步状态到 Store
   *
   * @param config 游戏配置
   */
  async createGame(config: IGameConfig): Promise<void> {
    if (this.engine) {
      this.cleanup()
    }

    // 创建引擎并注入服务
    this.engine = new GameEngine({
      randomService: this.randomService,
      storeService: this.storeService,
      decisionService: this.decisionService ?? undefined,
    })

    await this.engine.init(config)

    // 查询口要在引擎出生之后才有得可问（欠账 D41）
    this.pushStatsQuery()

    // 首次同步到 Pinia Store
    this.syncToStore()
  }

  /**
   * 启动游戏——开局，并把那个唯一的循环**跑起来**。
   *
   * 必须在 createGame() 之后调用。
   *
   * ⚠️ **它不等到分出胜负**（欠账 D38）。`GameEngine.runGameLoop()` 是个
   * `while` 循环，await 到结束的话，视图里 `await startGame()` 之后那段
   * 「启动后检查状态」要等到整局打完才轮得到——界面在第一回合就冻住了。
   *
   * 于是开局与「等结果」在这里分成两件事：本方法只负责开局 + 起循环，
   * 整局结果走 `whenFinished()`。人类那一位被问到时，循环会**挂起**，
   * 直到 UI 用 `playCard` / `endCardPlay` / `discardCards` 给出答案。
   */
  async startGame(): Promise<void> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建，请先调用 createGame()')
    }

    this.isRunning = true
    await this.engine.start()
    this.syncToStore()

    const loop = this.engine.runGameLoop()
    this.loopPromise = loop.then((result) => {
      this.isRunning = false
      this.gameResult = result
      this.syncToStore()
      return result
    })

    // 循环里抛错也要把 isRunning 收回来；同时接住它——
    // 否则一次内部异常就变成一句没人管的 unhandled rejection。
    this.loopPromise.catch(() => {
      this.isRunning = false
    })
  }

  /**
   * 整局的结果 —— 循环跑完才 resolve。
   *
   * `startGame()` 不 await 到结束，所以「这一局打成什么样」必须有一个
   * 明确的出口回到 UI，而不是让调用方自己去猜循环还在不在跑。
   */
  whenFinished(): Promise<IGameResult> {
    if (!this.loopPromise) {
      return Promise.reject(
        new Error('[GameController] 循环尚未启动，请先调用 startGame()'),
      )
    }
    return this.loopPromise
  }

  /**
   * 跑完一整局（AI 自动模式 / 测试）。
   *
   * 它只是「开局 + 等结果」：推进的仍然是 `startGame()` 里起的那个循环，
   * **不另起一条**——两条循环同时推同一局，等于又有了两个推进者。
   *
   * @returns 游戏结果
   */
  async runGameLoop(): Promise<IGameResult> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建，请先调用 createGame()')
    }

    if (!this.loopPromise) await this.startGame()
    return this.whenFinished()
  }

  // ── 挂起的提问：引擎问 → UI 答 ──

  /**
   * 引擎在出牌阶段挂起，等这一个答案。
   *
   * 由视图的 `DecisionChannel.askForCardPlay` 转调过来（欠账 D38 形态丁）：
   * 引擎问 → `HumanDecisionService` 按座位分流 → 这里 → UI 把它摆到界面上。
   * 返回的 Promise 在 `playCard()` / `endCardPlay()` 给出答案时才 resolve。
   */
  askCardPlay(
    player: IPlayer,
    options: readonly CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    // 顶掉上一个还悬着的：新提问不会在旧提问未答复时到达（引擎是串行的），
    // 但「再来一局」这类事情没有这个保证。
    this.settleAllPending()

    return new Promise<CardPlayResult | null>((resolve) => {
      this.pendingCardPlay = { player, options, resolve }
      // 提问刚挂上：界面要在这一刻看见按钮，不能等下一次状态同步（欠账 D45）
      this.markChanged()
    })
  }

  /**
   * 引擎在弃牌阶段挂起，等这一个答案（只在手牌超上限时才会被问到）。
   */
  askDiscard(
    player: IPlayer,
    count: number,
    validCards: readonly ICard[],
  ): Promise<ICard[]> {
    this.settleAllPending()

    return new Promise<ICard[]>((resolve) => {
      this.pendingDiscard = { player, count, validCards, resolve }
      this.markChanged()
    })
  }

  /** 此刻是不是正挂着一个出牌提问（「结束出牌」按钮的开关就是它） */
  get isAwaitingCardPlay(): boolean {
    return this.pendingCardPlay !== null
  }

  /** 此刻是不是正挂着一个弃牌提问（弃牌面板的开关） */
  get isAwaitingDiscard(): boolean {
    return this.pendingDiscard !== null
  }

  /** 挂起的出牌提问给出的候选 —— 界面上「我能打什么牌」的唯一来源 */
  get cardPlayOptions(): readonly CardPlayOption[] {
    return this.pendingCardPlay?.options ?? []
  }

  /**
   * 按缺省答复所有还悬着的提问。
   *
   * 一条永不 resolve 的 Promise 就是一次**事件栈死锁**：不报错、不红测试，
   * 只是整局静静地卡住。所以销毁 / 卸载 / 重置会话时，
   * 悬着的提问一律按缺省答案交回去（不出 / 弃前 N 张）。
   */
  settleAllPending(): void {
    const cardPlay = this.pendingCardPlay
    this.pendingCardPlay = null
    cardPlay?.resolve(null) // 缺省：结束出牌阶段

    const discard = this.pendingDiscard
    this.pendingDiscard = null
    // 缺省必须**弃够张数**：少弃一张，手牌就超过上限，规则在那儿摆着
    discard?.resolve(discard.validCards.slice(0, discard.count))

    this.markChanged()
  }

  /**
   * 报一次「我的答案变了」——见 `revisionRef`。
   *
   * 挂起 / 答复 / 状态同步，三处都要报：漏掉哪一处，界面就在哪一处
   * 停在上一刻（欠账 D45 卡的就是「挂起」这一处）。
   */
  private markChanged(): void {
    this.revisionRef.value++
  }

  // ── 玩家操作 ──

  /**
   * 答复挂起的出牌提问 —— 打出一张牌。
   *
   * **它不执行出牌**（欠账 D38 形态丁）。以前它自己走一遍
   * 「查牌 → 查目标 → `engine.useCard`」，于是出牌这件事有两条路：
   * 引擎的 `doPhaseUse` 一条、UI 这条。额度记账、无懈可击征询、
   * 「这张牌算不算本回合的杀」都只在引擎那条路上发生，
   * 走 UI 这一条时它们全都不算数。
   *
   * 现在它只把「人点了哪张牌、点了谁」交回给那个挂起的提问，
   * 出牌由引擎做一次。牌与目标都**只能来自挂起提问给的选项**，
   * 因此目标合法性不需要在这里再判一遍——判据只有一个（`TargetSystem`）。
   *
   * @param cardId    卡牌实例 ID
   * @param targetIds 目标玩家 ID 列表
   * @returns 有没有答复上（false = 此刻引擎根本没在问，按钮点了个空）
   */
  async playCard(cardId: string, targetIds: string[]): Promise<boolean> {
    const pending = this.pendingCardPlay
    if (!pending) return false

    const option = pending.options.find((o) => o.card.instanceId === cardId)
    if (!option) return false

    // 目标只认选项里给出的那些：界面上点不到的人递不进来，
    // 「多传一个」也就不会变成一次非法出牌。
    const targets = targetIds
      .map((id) => option.validTargets.find((p) => p.id === id))
      .filter((p): p is IPlayer => p !== undefined)

    this.pendingCardPlay = null
    pending.resolve({ card: option.card, targets })
    // 答完了：按钮要立刻收掉，否则人还能再点一次「结束出牌」（欠账 D45）
    this.markChanged()
    return true
  }

  /**
   * 「结束出牌」按钮 —— 给挂起的出牌提问答复 `null`。
   *
   * 它**不推引擎**（欠账 D38）：引擎在出牌阶段的 while 循环里问到 `null`
   * 就自己结束这个阶段，然后一路走下去、把回合交给下一位。
   *
   * @returns 有没有答复上
   */
  endCardPlay(): boolean {
    const pending = this.pendingCardPlay
    if (!pending) return false

    this.pendingCardPlay = null
    pending.resolve(null)
    this.markChanged()
    return true
  }

  /**
   * 响应窗口的决策（如出闪、出桃等）。
   *
   * 注意：响应窗口的具体暂停/恢复由 EventPauseManager / ResponseWindow 管理。
   * 此方法标记玩家已完成决策，实际流程由引擎的事件调度循环接管。
   *
   * @param cardId 选择打出的卡牌 ID，null 表示不出/取消
   */
  async respondToWindow(cardId: string | null): Promise<void> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建')
    }

    // 响应窗口的恢复由 EventPauseManager.resume() 或 ResponseWindow 内部处理。
    // GameController 层面记录玩家的选择结果，实际的事件栈恢复
    // 由决策服务回调触发。
    if (cardId) {
      const player = this.engine.getCurrentPlayer()
      if (player) {
        const card = player.handCards.find((c) => c.instanceId === cardId)
        if (!card) {
          throw new Error(`[GameController] 找不到卡牌 ${cardId}`)
        }
        // 卡牌选择有效 — 响应窗口会通过 EventPauseManager 进行恢复
      }
    }
    // 响应决策由 engine 的 decision service 管道处理
    this.syncToStore()
  }

  //
  // 这里曾经有一个「结束当前阶段」的方法（UI 逐步推进那条路的入口）。
  // 它调的引擎接口在末阶段只是把 `phasePost` 原地重设一遍、
  // 从不交回合——**界面上按「结束阶段」永远停在同一个人**（欠账 D38）。
  // 形态丁下「推引擎一步」这个语义不存在，条目本身随之删除；
  // 按钮改成答复挂起的提问，见 `endCardPlay`。

  /**
   * 发动技能/效果。
   *
   * @param effectId 效果 ID
   * @param targetIds 目标玩家 ID 列表
   * @param cardIds 选择的卡牌 ID 列表（如弃牌发动）
   */
  async useEffect(
    effectId: string,
    targetIds: string[] = [],
    cardIds: string[] = [],
  ): Promise<void> {
    if (!this.engine) {
      throw new Error('[GameController] 游戏尚未创建')
    }

    const state = this.engine.getState()
    const player = this.engine.getCurrentPlayer()
    if (!player) {
      throw new Error('[GameController] 当前没有行动玩家')
    }

    // 验证效果存在
    //
    // 走 `getPlayerSkills`（= `SkillRegistry`），不是 `hero.effectIds`：
    // 后者看不见装备技与临时技能，于是「装上青龙偃月刀后发动【追击】」
    // 会被这句判成「找不到效果」——面板上明明显示着，点了却报错。
    // 「这人有哪些技能」只有一个答案（欠账 D36）。
    const owned = this.getPlayerSkills(player.id).map((s) => s.id)
    if (!owned.includes(effectId)) {
      throw new Error(`[GameController] 找不到效果 ${effectId}`)
    }

    // 效果发动通过事件系统处理
    const event = new GameEvent({
      name: 'useCardEffect',
      source: player,
      player,
      targets: targetIds
        .map((id) => state.players.find((p) => p.id === id))
        .filter((p): p is IPlayer => p !== undefined),
      cards: cardIds
        .map((id) => player.handCards.find((c) => c.instanceId === id))
        .filter((c): c is ICard => c !== undefined),
      phase: state.currentPhase,
      round: state.currentRound,
      turn: player.seatIndex,
      data: { effectId },
    })

    await this.engine.eventDispatcher.dispatch(event, this.engine.eventChain)
    this.syncToStore()
  }

  /**
   * 答复挂起的弃牌提问 —— 弃掉这几张牌。
   *
   * 与 `playCard` 同理：**它不执行弃牌**。以前它自己调 `cardSystem.discardCard`
   * 再「推一步」，于是「弃牌阶段怎么结束」也有两条路，而那条路上
   * 手牌上限的 Mod 与「不可被弃置」的否决器都不参与。
   *
   * 现在弃牌由引擎在收到答复后做一次（`doPhaseDiscard`）。
   *
   * @param cardIds 要弃置的卡牌 ID 列表
   * @returns 有没有答复上；张数不够（少弃一张手牌就超上限）则拒绝答复
   */
  async discardCards(cardIds: string[]): Promise<boolean> {
    const pending = this.pendingDiscard
    if (!pending) return false

    const cards = cardIds
      .map((id) => pending.validCards.find((c) => c.instanceId === id))
      .filter((c): c is ICard => c !== undefined)

    if (cards.length < pending.count) return false

    this.pendingDiscard = null
    pending.resolve(cards.slice(0, pending.count))
    this.markChanged()
    return true
  }

  // ── 查询 ──

  /**
   * 获取当前游戏状态（只读）。
   */
  getGameState(): Readonly<GameStateSnapshot> | null {
    return this.storeService.getGameStateSafe()
  }

  /**
   * 获取当前行动玩家。
   */
  getCurrentPlayer(): IPlayer | null {
    if (!this.engine) return null
    return this.engine.getCurrentPlayer() ?? null
  }

  /**
   * 获取指定玩家当前可执行的操作列表。
   *
   * UI 根据此信息决定显示内容：
   * - 哪些卡牌可打出
   * - 哪些目标可选
   * - 是否可以结束阶段
   * - 是否需要响应窗口
   *
   * @param playerId 玩家 ID（默认为当前行动玩家）
   */
  getAvailableActions(playerId?: string): AvailableActions {
    if (!this.engine) return { ...EMPTY_ACTIONS }

    const state = this.engine.getState()
    const currentPlayer = this.engine.getCurrentPlayer()
    const targetPlayer = playerId
      ? state.players.find((p) => p.id === playerId)
      : currentPlayer

    if (!targetPlayer) return { ...EMPTY_ACTIONS }

    const isMyTurn = currentPlayer?.id === targetPlayer.id
    const phase = state.currentPhase

    // ── 挂起的提问 ──
    //
    // 「此刻我能做什么」的全部答案都在挂起的提问里。以前这一段是
    // **按当前阶段推算**的：出牌阶段 → 翻一遍手牌算可打的牌；
    // 弃牌阶段 → 拿手牌数减上限算要弃几张。两套答案各有各的毛病：
    // 前一套与 `getPlayableCards`（引擎那份）各算各的，后者看不见
    // 「手牌上限被 Mod 改写」以外的东西、而且**在引擎没问的时候也会亮**。
    //
    // 形态丁下界面上亮什么，取决于引擎此刻是不是真的在问这个人。
    const cardPlay =
      this.pendingCardPlay?.player.id === targetPlayer.id ? this.pendingCardPlay : null
    const discard =
      this.pendingDiscard?.player.id === targetPlayer.id ? this.pendingDiscard : null

    // ── 基础动作 ──
    const actions: AvailableActions = {
      phase,
      isMyTurn,
      playableCards: cardPlay?.options.map(toCardPlayChoice) ?? [],
      usableEffects: [],
      // 「结束」按钮只在**正挂着一个出牌提问**时亮：
      // 回合内没有提问的阶段引擎不会停，那时候按它没有意义。
      canEndPhase: cardPlay !== null,
      isWaitingResponse: false,
      needDiscard: discard !== null,
      discardCount: discard?.count ?? 0,
    }

    // ── 可发动的技能 ──
    //
    // 放在上面那段**之后**：`needDiscard` 是刚才才算出来的，
    // 而「弃牌阶段能发动什么」要读它。
    actions.usableEffects = this.computeUsableEffects(targetPlayer, {
      phase,
      isMyTurn,
      isWaitingResponse: actions.isWaitingResponse,
      needDiscard: actions.needDiscard,
    })

    return actions
  }

  /**
   * 玩家此刻持有的一整套技能定义。
   *
   * **欠账 D36。** UI 此前读的是 `player.heroes.flatMap(h => h.effectIds)`——
   * 一串裸 id。它漏掉的东西比它给的东西更致命：
   * **装备带来的技能与临时技能都不在 `hero.effectIds` 上**
   * （那些是 `SkillRegistry.attach` / `addTempSkill` 挂上去的），
   * 于是穿了青龙偃月刀的玩家在面板上看不见「追击」。
   * 唯一真值源是 `SkillRegistry.getSkills(player)`。
   */
  getPlayerSkills(playerId?: string): ISkill[] {
    if (!this.engine) return []

    const state = this.engine.getState()
    const targetPlayer = playerId
      ? state.players.find((p) => p.id === playerId)
      : this.engine.getCurrentPlayer()

    if (!targetPlayer) return []

    return this.engine.skillRegistry.getSkills(targetPlayer)
  }

  /**
   * 此刻能**手动发动**的技能 id。
   *
   * 判据是技能自己写的 `enable: SkillEnableContext[]` 与当前上下文的交集，
   * 不是「出牌阶段就全都可用」。以前的实现（`player.heroes.flatMap`）
   * 对任何技能都返回「可用」——包括【仁德】这种锁定技，
   * 于是面板上出现一个点了也没反应的按钮。
   *
   * `enable` 是**技能定义的一部分**，因此这个判据只有一个答案：
   * 改技能的可发动时机改的是 `source/` 里的定义，不是这里。
   */
  private computeUsableEffects(
    player: IPlayer,
    ctx: {
      phase: GamePhase
      isMyTurn: boolean
      isWaitingResponse: boolean
      needDiscard: boolean
    },
  ): string[] {
    if (!this.engine || !ctx.isMyTurn) return []

    // 当前上下文：技能写 `enable: [GamePhase.PhaseUse, 'response']` 时，
    // 出牌阶段与被【杀】命中时都能点。
    const contexts = new Set<SkillEnableContext>()
    contexts.add(ctx.phase)
    if (ctx.isWaitingResponse) contexts.add('response')
    if (ctx.needDiscard) contexts.add('discard')

    return this.getPlayerSkills(player.id)
      .filter((skill) => skill.enable?.some((c) => contexts.has(c)) ?? false)
      .map((skill) => skill.id)
  }

  /**
   * 游戏是否正在运行。
   */
  get isActive(): boolean {
    return this.isRunning && this.engine !== null && !this.engine.isGameOver
  }

  /**
   * 游戏是否已结束。
   */
  get isGameOver(): boolean {
    return this.engine?.isGameOver ?? false
  }

  /**
   * 主动检查游戏是否满足结束条件。
   *
   * 在 UI 驱动的逐步推进模式下，每次玩家操作后应调用此方法。
   * 如果游戏满足结束条件，会自动标记 finished 并返回结果。
   *
   * @returns 游戏结果（如果游戏结束），null 表示游戏继续
   */
  checkGameOver(): IGameResult | null {
    if (!this.engine) return null

    // 已经结束则返回已有结果
    if (this.gameResult) return this.gameResult

    // 胜负规则在 `WinCondition`（纯函数），入口在引擎上
    const result = this.engine.checkGameOver()
    if (result) {
      // 标记游戏结束
      this.engine.state.markFinished()
      this.gameResult = result
      this.syncToStore()
    }

    return result
  }

  /**
   * 获取游戏结果（仅在游戏结束后有效）。
   */
  getGameResult(): IGameResult | null {
    return this.gameResult
  }

  // ── 私有方法 ──

  // 这里曾经还有一个「执行使用卡牌的完整流程」的私有方法，
  // 供 `playCard` 调（UI 那条出牌路径的执行体）。形态丁下出牌只由引擎做一次，
  // 所以连同 `playCard` 的执行语义一起删掉——留它就是在别处再开一条出牌路径。

  /**
   * 同步引擎状态到 Pinia Store。
   */
  private syncToStore(): void {
    if (!this.engine) return
    const state = this.engine.getState()
    this.storeService.syncGameState(state)
    // 引擎每推一次状态，「此刻我能做什么」都可能变了（欠账 D45）
    this.markChanged()
  }

  /**
   * 清理资源（新游戏创建前调用）。
   *
   * **挂起的提问必须先答复掉**：它悬在事件流水线上，销毁会话时没人管它，
   * 那条 `await` 就永远不返回——不报错、不红测试，只是整局静静地卡住
   * （欠账 D38 的死锁纪律）。
   */
  private cleanup(): void {
    this.settleAllPending()
    this.loopPromise = null
    this.storeService.reset()
    if (this.piniaStore) {
      // 查询口闭包里抓着**这一局**的引擎，不清掉它就成了一个
      // 指向已弃对象的活引用（欠账 D41）。
      this.piniaStore.setStatsQuery(null)
      this.piniaStore.reset()
    }
    this.engine = null
    this.isRunning = false
    this.gameResult = null
  }

  /**
   * 销毁控制器。
   */
  destroy(): void {
    this.cleanup()
    this.piniaStore = null
    this.decisionService = null
  }
}
