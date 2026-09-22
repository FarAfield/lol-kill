// ============================================================
// 联盟杀 · 游戏状态与配置接口
// ============================================================

import type { GamePhase, RoleType } from './enums'
import type { LogEntry } from './types'
import type { IPlayer } from './player.interface'
import type { ICard, CardDefinition } from './card.interface'
import type { IHero } from './hero.interface'

/**
 * 游戏模式配置
 */
export interface IGameConfig {
  mode: string
  playerCount: number
  roles: RoleType[]
  heroes: IHero[]
  cards: CardDefinition[]
  heroSelectCount: number
  initialHandSize: number
  equipEnabled: boolean
  delayedCardEnabled: boolean
  maxRounds: number
}

/**
 * 游戏全局状态
 */
export interface IGameState {
  players: IPlayer[]
  deck: ICard[]
  discardPile: ICard[]
  currentRound: number
  currentPlayerIndex: number
  currentPhase: GamePhase
  phaseIndex: number
  log: LogEntry[]
  config: IGameConfig
  started: boolean
  finished: boolean
  processingCards: ICard[]

  /** 存活玩家列表 */
  readonly alivePlayers: IPlayer[]
  /** 存活玩家数量 */
  readonly aliveCount: number

  /** 添加一条游戏日志 */
  addLog(entry: LogEntry): void
  /** 获取只读快照 */
  snapshot(): Readonly<IGameState>
  /** 标记游戏已开始 */
  markStarted(): void
  /** 标记游戏已结束 */
  markFinished(): void
}

/**
 * 游戏结果
 */
export interface IGameResult {
  winner: RoleType | null
  reason: string
  survivingPlayers: IPlayer[]
  totalRounds: number
  endedAt: number
}
