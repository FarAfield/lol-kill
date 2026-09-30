// ============================================================
// 联盟杀 · TurnManager — 回合与轮次管理
//
// 管理游戏的回合顺序和轮次推进。
//
// 职责：
// - startRound()  — 开始新的一轮，重置为第一个玩家
// - nextTurn()    — 切换到下一位存活玩家
// - getCurrentPlayer() — 获取当前行动玩家
// - skipTurn()    — 跳过玩家回合（乐不思蜀等）
// - 自动跳过死亡玩家
// ============================================================

import { GamePhase } from '@core/contracts/enums'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { PlayerSystem } from '@core/system/player-system'

/**
 * 回合管理器
 *
 * 负责管理轮次（Round）和回合（Turn）的推进。
 *
 * 轮次（Round）：所有存活玩家依次行动一次 = 一轮
 * 回合（Turn）：单个玩家的完整行动（准备→判定→摸牌→出牌→弃牌→结束）
 *
 * 基本流程：
 *   startRound() → nextTurn() × N → 所有玩家行动完 → startRound()
 */
export class TurnManager {
  /** 当前轮次中已经行动过的玩家索引集合 */
  private playersActedThisRound: Set<number> = new Set()

  /** 被跳过回合的玩家索引（乐不思蜀等） */
  private skippedPlayers: Set<number> = new Set()

  /**
   * 玩家状态系统 —— 「每回合归零」那几笔账的写入口（Phase 19）
   *
   * 无状态，因此这里自建一份即可，不必由引擎注入。
   */
  private playerSystem = new PlayerSystem()

  constructor(private state: GameStateSnapshot) {}

  // ── 轮次操作 ──

  /**
   * 开始新的一轮。
   *
   * 重置回合计数器，将当前玩家设为主公（seatIndex 0 的存活玩家）。
   * 如果主公已死亡，则选择第一个存活玩家。
   */
  startRound(): void {
    this.state.currentRound++
    this.playersActedThisRound.clear()
    this.skippedPlayers.clear()

    // 重置为第一个存活玩家（通常是主公）
    const firstAlive = this.state.players.find((p) => p.alive)
    if (firstAlive) {
      this.state.currentPlayerIndex = firstAlive.seatIndex
    } else {
      this.state.currentPlayerIndex = 0
    }

    this.state.currentPhase = GamePhase.RoundStart
  }

  /**
   * 推进到下一个存活玩家的回合。
   *
   * 按座位顺序循环，自动跳过死亡玩家。
   * 如果所有存活玩家都已行动过，返回 undefined（调用方应开始新轮次）。
   *
   * @returns 下一个行动玩家，若无玩家可行动则返回 undefined
   */
  nextTurn(): IPlayer | undefined {
    const playerCount = this.state.players.length
    if (playerCount === 0) return undefined

    // 检查是否所有存活玩家都已在本轮行动
    const alivePlayers = this.state.alivePlayers
    if (alivePlayers.length === 0) return undefined

    const allActed = alivePlayers.every((p) =>
      this.playersActedThisRound.has(p.seatIndex),
    )

    if (allActed) {
      // 本轮结束，所有存活玩家均已行动
      return undefined
    }

    // ── 先检查当前玩家是否还未行动 ──
    // 场景：startRound() 将 currentPlayerIndex 设为第一个存活玩家，
    // 该玩家尚未被返回过，应当作为第一个回合的持有者。
    const currentPlayer = this.state.players[this.state.currentPlayerIndex]
    if (
      currentPlayer?.alive &&
      !this.playersActedThisRound.has(currentPlayer.seatIndex) &&
      !this.skippedPlayers.has(currentPlayer.seatIndex)
    ) {
      this.playersActedThisRound.add(currentPlayer.seatIndex)
      this.playerSystem.resetTurnState(currentPlayer)
      this.state.currentPhase = GamePhase.PhasePre
      return currentPlayer
    }

    // 清除当前玩家曾经的跳过标记（如果它被 skipTurn 标记过但未被选中）
    if (currentPlayer && this.skippedPlayers.has(currentPlayer.seatIndex)) {
      this.skippedPlayers.delete(currentPlayer.seatIndex)
    }

    // ── 找到下一个存活且未行动且未被跳过的玩家 ──
    for (let i = 1; i <= playerCount; i++) {
      const nextIndex =
        (this.state.currentPlayerIndex + i) % playerCount
      const nextPlayer = this.state.players[nextIndex]

      if (!nextPlayer?.alive) continue
      if (this.skippedPlayers.has(nextIndex)) {
        // 跳过玩家被标记后移除标记（仅跳过一回合）
        this.skippedPlayers.delete(nextIndex)
        continue
      }
      if (this.playersActedThisRound.has(nextIndex)) continue

      // 找到下一个行动玩家
      this.state.currentPlayerIndex = nextIndex
      this.playersActedThisRound.add(nextIndex)

      // 重置该玩家的回合状态
      this.playerSystem.resetTurnState(nextPlayer)

      // 设置当前阶段为回合准备阶段
      this.state.currentPhase = GamePhase.PhasePre

      return nextPlayer
    }

    // 理论上不会到这里，但安全返回
    return undefined
  }

  /**
   * 获取当前行动玩家。
   *
   * @returns 当前玩家，如果无存活玩家则返回 undefined
   */
  getCurrentPlayer(): IPlayer | undefined {
    const player = this.state.players[this.state.currentPlayerIndex]
    if (player?.alive) return player
    return undefined
  }

  // ── 跳过回合 ──

  /**
   * 跳过指定玩家的回合。
   *
   * 在三国杀中，乐不思蜀等效果会使玩家跳过整个回合或部分阶段。
   * 此方法标记玩家为「跳过」，在 nextTurn() 中自动跳过。
   *
   * @param player 要跳过的玩家
   */
  skipTurn(player: IPlayer): void {
    this.skippedPlayers.add(player.seatIndex)
    // 同时在玩家身上标记（供 PhaseManager 查询）。
    // 写这行标记要走 PlayerSystem——自己 `player.shouldSkipPhases = [...]`
    // 就是绕过唯一写入口。
    this.playerSystem.setSkipPhases(player, [
      GamePhase.PhasePre,
      GamePhase.PhaseJudge,
      GamePhase.PhaseDraw,
      GamePhase.PhaseUse,
      GamePhase.PhaseDiscard,
      GamePhase.PhasePost,
    ])
  }

  /**
   * 跳过当前玩家的指定阶段。
   *
   * 例如乐不思蜀 → 跳过出牌阶段。
   * 注意：这不等同于跳过整个回合（skipTurn），而是跳过部分阶段。
   *
   * @param phases 要跳过的阶段列表
   */
  skipPhases(player: IPlayer, phases: GamePhase[]): void {
    // 去重在 PlayerSystem 内部做——以前那句 `Set` 去重就写在这儿，
    // 于是「同一个阶段被记两次怎么处理」这条规则也跟着住在调用方。
    this.playerSystem.skipPhases(player, phases)
  }

  /**
   * 当前回合玩家是否应跳过指定阶段。
   *
   * @param phase 要检查的阶段
   */
  shouldSkipPhase(phase: GamePhase): boolean {
    const player = this.getCurrentPlayer()
    if (!player) return false
    return player.shouldSkipPhases.includes(phase)
  }

  // ── 查询 ──

  /**
   * 当前轮次是否已结束（所有存活玩家均已行动）。
   */
  get isRoundComplete(): boolean {
    const alivePlayers = this.state.alivePlayers
    if (alivePlayers.length === 0) return true
    return alivePlayers.every((p) =>
      this.playersActedThisRound.has(p.seatIndex),
    )
  }

  /**
   * 获取本轮已行动过的玩家列表。
   */
  get playersActed(): IPlayer[] {
    return this.state.players.filter((p) =>
      this.playersActedThisRound.has(p.seatIndex),
    )
  }

  /**
   * 获取本轮尚未行动的存活玩家列表。
   */
  get playersRemaining(): IPlayer[] {
    return this.state.alivePlayers.filter(
      (p) => !this.playersActedThisRound.has(p.seatIndex),
    )
  }

  /**
   * 当前回合数（即 currentRound）。
   */
  get currentRound(): number {
    return this.state.currentRound
  }

  /**
   * 重置管理器状态（用于新游戏）。
   */
  reset(): void {
    this.playersActedThisRound.clear()
    this.skippedPlayers.clear()
  }
}
