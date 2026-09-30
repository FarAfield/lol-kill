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

  /** UI 可见的玩家列表 */
  const uiPlayers = computed<UIPlayerInfo[]>(() => {
    const gs = gameState.value
    if (!gs) return []

    return gs.players.map((p) => ({
      id: p.id,
      seatIndex: p.seatIndex,
      name: p.heroes[0]?.name ?? `玩家${p.seatIndex + 1}`,
      role: p.roleRevealed ? (p.role ?? null) : null,
      roleRevealed: p.roleRevealed,
      alive: p.alive,
      hp: p.hp,
      maxHp: p.maxHp,
      power: p.power,
      maxPower: p.maxPower,
      hero: p.heroes[0] ?? null,
      handCount: p.handCards.length,
      equipCards: [...p.equipCards],
      judgeCards: [...p.judgeCards],
      isCurrentPlayer: p.seatIndex === gs.currentPlayerIndex,
      isHuman: false, // 默认 false，由 GameController 设置
    }))
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

  // ── Actions ──

  /**
   * 从引擎同步状态（由 StoreService.onChange 触发）。
   */
  function syncFromEngine(state: GameStateSnapshot): void {
    gameState.value = state
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

    // Actions
    syncFromEngine,
    setHumanPlayer,
    getUIPlayerInfo,
    reset,
  }
})
