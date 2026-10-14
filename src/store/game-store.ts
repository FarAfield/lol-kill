// ============================================================
// 联盟杀 · useGameStore — Pinia 响应式游戏状态
//
// 通过 StoreService 的 onChange 回调与引擎同步。
// UI 组件通过此 Store 获取响应式游戏数据。
//
// 设计原则：
// - 引擎单向同步 → Store（UI 不直接修改游戏数据）
// - UI 通过 GameController 发起操作，不直接调用引擎
// - Store 提供派生状态（当前玩家、阶段信息等）方便 UI 使用
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import { GamePhase, RoleType } from '@core/contracts/enums'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IHero } from '@core/contracts/hero.interface'
import type { LogEntry } from '@core/contracts/types'
import { BASE_ATTACK_RANGE } from '@core/skill'
import { lolHeroName, lolHeroTitle } from '@source/theme/lol-mapping'

/**
 * 玩家面板上那几个**要查规则才答得上来**的数（欠账 D41）
 *
 * 它们都不在快照里：`hp` / `maxHp` 是状态，而「攻击范围」「手牌上限」
 * 是 `ModRegistry` 算出来的结果 —— 装把武器、挂个技能都会变。
 * 快照里没有，因此 Store 只能**去问**。
 */
export interface UIPlayerStats {
  /** 攻击范围（含武器与技能修正） */
  attackRange: number
  /** 手牌上限（默认等于体力上限，可被技能改写） */
  maxHandcard: number
}

/**
 * 那几个数的查询口
 *
 * Store 自己**不认识** `ModRegistry`，也不许按装备槽位另算一份——
 * 「攻击范围是多少」只有一个答案，在引擎那边。因此这里只接收一个
 * 由控制器注入的查询函数；没注入就退回各自的缺省值（与「查不到
 * 就显示原名」同一条规矩：缺一块比给个错的强）。
 */
export interface IPlayerStatsQuery {
  attackRange(player: IPlayer): number
  maxHandcard(player: IPlayer): number
}

/**
 * 查询口缺席时退到哪里
 *
 * 手牌上限退回**实体上的上限**，攻击范围退回 `@core/skill` 里那个基础值——
 * 那个常量是「赤手空拳够得着邻座」这条规则的唯一答案，这里不许再抄一份。
 */
const FALLBACK_MAX_HANDCARD = (player: IPlayer): number => player.maxHp

/**
 * UI 可见的玩家信息（隐藏未公开身份、对手手牌内容等）。
 */
export interface UIPlayerInfo {
  id: string
  seatIndex: number
  name: string
  role: RoleType | null
  roleRevealed: boolean
  alive: boolean
  hp: number
  maxHp: number
  power: number
  maxPower: number
  hero: IHero | null
  handCount: number
  equipCards: ICard[]
  judgeCards: ICard[]
  /** Mod 算出来的那几个数（欠账 D41） */
  stats: UIPlayerStats
  isCurrentPlayer: boolean
  isHuman: boolean
}

/**
 * UI 可见的游戏状态。
 */
export interface UIGameState {
  phase: GamePhase
  phaseLabel: string
  round: number
  currentPlayerIndex: number
  started: boolean
  finished: boolean
  log: LogEntry[]
  aliveCount: number
  totalPlayers: number
}

// ── 阶段中文标签映射 ──
const PHASE_LABELS: Record<GamePhase, string> = {
  [GamePhase.NotStarted]: '未开始',
  [GamePhase.Prepare]: '准备阶段',
  [GamePhase.RoundStart]: '轮次开始',
  [GamePhase.PhasePre]: '准备阶段',
  [GamePhase.PhaseJudge]: '判定阶段',
  [GamePhase.PhaseDraw]: '摸牌阶段',
  [GamePhase.PhaseUse]: '出牌阶段',
  [GamePhase.PhaseDiscard]: '弃牌阶段',
  [GamePhase.PhasePost]: '结束阶段',
  [GamePhase.RoundEnd]: '轮次结束',
  [GamePhase.GameOver]: '游戏结束',
}

/**
 * 全局游戏状态 Store。
 *
 * 用法：
 *   const gameStore = useGameStore()
 *   gameStore.syncFromEngine(gameState)  // 引擎调用
 *   console.log(gameStore.phaseLabel)     // 组件消费
 */
export const useGameStore = defineStore('game', () => {
  // ── 原始引擎状态 ──
  const gameState = ref<GameStateSnapshot | null>(null)

  /**
   * 「要查规则才答得上来」的那几个数从哪儿问（欠账 D41）
   *
   * 由 `GameController` 在创建引擎之后注入。它必须在**引擎出生之后**
   * 才有得可问，而 Store 比引擎活得早，所以只能事后补——
   * 这与 `setCardBudget` / `setModQuery` 那三条补发是同一件事，
   * 补发的那一行必须放在「引擎创建」那个唯一的出口上。
   */
  const statsQuery = ref<IPlayerStatsQuery | null>(null)

  // ── 派生状态 ──

  /** UI 友好的游戏状态 */
  const uiState = computed<UIGameState | null>(() => {
    const gs = gameState.value
    if (!gs) return null

    return {
      phase: gs.currentPhase,
      phaseLabel: PHASE_LABELS[gs.currentPhase] ?? gs.currentPhase,
      round: gs.currentRound,
      currentPlayerIndex: gs.currentPlayerIndex,
      started: gs.started,
      finished: gs.finished,
      log: [...gs.log].slice(-100), // 最近 100 条日志
      aliveCount: gs.players.filter((p) => p.alive).length,
      totalPlayers: gs.players.length,
    }
  })

  /** 当前行动玩家 */
  const currentPlayer = computed<IPlayer | null>(() => {
    const gs = gameState.value
    if (!gs || !gs.players[gs.currentPlayerIndex]) return null
    return gs.players[gs.currentPlayerIndex]!
  })

  /**
 * 展示用的英雄 —— **换皮只发生在这里**（欠账 D27）
 *
 * 引擎那份 `IHero` 的 `name` / `title` 是三国杀的名字，是数据；
 * 界面上显示的 LOL 名字从这里查表换出来。Store 本来就是「引擎数据 → UI
 * 显示值」的派生层，所以换皮落在这一层：座位组件、当前回合名、文本视图
 * 读的都是同一份，不存在第二个答案。
 */
  function displayHero(hero: IHero | null): IHero | null {
    if (!hero) return null
    return {
      ...hero,
      name: lolHeroName(hero.id, hero.name),
      title: lolHeroTitle(hero.id, hero.title),
    }
  }

  /** UI 可见的玩家列表 */
  const uiPlayers = computed<UIPlayerInfo[]>(() => {
    const gs = gameState.value
    if (!gs) return []

    const query = statsQuery.value
    return gs.players.map((p) => {
      const hero = displayHero(p.heroes[0] ?? null)
      const stats: UIPlayerStats = {
        attackRange: query ? query.attackRange(p) : BASE_ATTACK_RANGE,
        maxHandcard: query ? query.maxHandcard(p) : FALLBACK_MAX_HANDCARD(p),
      }
      return {
        id: p.id,
        seatIndex: p.seatIndex,
        name: hero?.name ?? `玩家${p.seatIndex + 1}`,
        role: p.roleRevealed ? (p.role ?? null) : null,
        roleRevealed: p.roleRevealed,
        alive: p.alive,
        hp: p.hp,
        maxHp: p.maxHp,
        power: p.power,
        maxPower: p.maxPower,
        hero,
        handCount: p.handCards.length,
        equipCards: [...p.equipCards],
        judgeCards: [...p.judgeCards],
        stats,
        isCurrentPlayer: p.seatIndex === gs.currentPlayerIndex,
        isHuman: false, // 默认 false，由 GameController 设置
      }
    })
  })

  /** 游戏阶段标签 */
  const phaseLabel = computed<string>(() => {
    const gs = gameState.value
    if (!gs) return '未开始'
    return PHASE_LABELS[gs.currentPhase] ?? gs.currentPhase
  })

  /** 是否游戏中 */
  const isPlaying = computed(() => {
    const gs = gameState.value
    return gs?.started === true && gs?.finished === false
  })

  /** 是否游戏结束 */
  const isGameOver = computed(() => {
    return gameState.value?.finished === true
  })

  /** 存活玩家数量 */
  const aliveCount = computed(() => {
    return gameState.value?.players.filter((p) => p.alive).length ?? 0
  })

  /**
   * 牌堆剩余张数。
   *
   * 这里给的是**张数**而不是 `deck` 本身：UI 只数得清还剩几张，
   * 把整个 `ICard[]` 递下去，组件就会顺手从里面派生别的东西，
   * 于是同一件事出现第二个答案。要详情的那天再单独开一个查询口。
   */
  const deckCount = computed(() => gameState.value?.deck.length ?? 0)

  /** 弃牌堆张数 */
  const discardCount = computed(() => gameState.value?.discardPile.length ?? 0)

  // ── Actions ──

  /**
   * 从引擎同步状态（由 StoreService.onChange 触发）。
   */
  function syncFromEngine(state: GameStateSnapshot): void {
    gameState.value = state
  }

  /**
   * 注入「要查规则才答得上来」的那几个数的查询口（欠账 D41）
   *
   * 由 `GameController` 调用。不注入也能跑——面板显示的是基础值，
   * 只是看不到武器与技能带来的变化。
   */
  function setStatsQuery(query: IPlayerStatsQuery | null): void {
    statsQuery.value = query
  }

  /**
   * 设置玩家为人类玩家。
   *
   * @param playerId 玩家 ID
   * @param isHuman  是否人类
   */
  function setHumanPlayer(_playerId: string, _isHuman: boolean): void {
    // 人类玩家标记在 GameController 层管理
    // 此处保留接口以供扩展（例如多人游戏时的客户端识别）
  }

  /**
   * 获取指定玩家的 UI 信息。
   */
  function getUIPlayerInfo(playerId: string): UIPlayerInfo | null {
    return uiPlayers.value.find((p) => p.id === playerId) ?? null
  }

  /**
   * 重置 Store（新游戏开始时）。
   */
  function reset(): void {
    gameState.value = null
  }

  return {
    // 原始状态
    gameState: readonly(gameState),

    // 派生状态
    uiState,
    currentPlayer,
    uiPlayers,
    phaseLabel,
    isPlaying,
    isGameOver,
    aliveCount,
    deckCount,
    discardCount,

    // Actions
    syncFromEngine,
    setStatsQuery,
    setHumanPlayer,
    getUIPlayerInfo,
    reset,
  }
})
