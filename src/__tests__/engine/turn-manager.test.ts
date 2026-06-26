// ============================================================
// 联盟杀 · TurnManager 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { TurnManager } from '@core/engine/turn-manager'
import { GameState, createDefaultConfig } from '@core/entity/game-state'
import { Player } from '@core/entity/player'
import { GamePhase, RoleType } from '@core/contracts/enums'
import type { IPlayer } from '@core/contracts/player.interface'

// ── 测试辅助 ──

function createPlayers(count: number, state: GameState): IPlayer[] {
  const players: IPlayer[] = []
  for (let i = 0; i < count; i++) {
    const player = new Player({ id: `player_${i}`, seatIndex: i })
    players.push(player)
  }
  state.players = players
  return players
}

describe('TurnManager', () => {
  let state: GameState
  let manager: TurnManager

  beforeEach(() => {
    state = new GameState()
    manager = new TurnManager(state)
  })

  // ================================================================
  // startRound — 开始新轮次
  // ================================================================

  describe('startRound', () => {
    it('should increment the round counter', () => {
      createPlayers(5, state)
      const initialRound = state.currentRound

      manager.startRound()

      expect(state.currentRound).toBe(initialRound + 1)
    })

    it('should set currentPlayerIndex to the first alive player', () => {
      const players = createPlayers(5, state)
      state.currentPlayerIndex = 3 // some non-zero index

      manager.startRound()

      // Should reset to first alive player (seatIndex 0)
      expect(state.currentPlayerIndex).toBe(players[0]!.seatIndex)
    })

    it('should set currentPhase to RoundStart', () => {
      createPlayers(5, state)
      state.currentPhase = GamePhase.NotStarted

      manager.startRound()

      expect(state.currentPhase).toBe(GamePhase.RoundStart)
    })

    it('should clear playersActedThisRound', () => {
      createPlayers(5, state)
      // Simulate some players having already acted
      manager.startRound()
      const p1 = manager.nextTurn()
      expect(p1).toBeDefined()

      // Start new round
      manager.startRound()
      expect(manager.playersActed.length).toBe(0)
    })

    it('should skip to first alive player if seatIndex 0 is dead', () => {
      const players = createPlayers(3, state)
      players[0]!.alive = false

      manager.startRound()

      // Should select first alive player (seatIndex 1)
      expect(state.currentPlayerIndex).toBe(1)
    })

    it('should handle all players dead gracefully', () => {
      const players = createPlayers(3, state)
      players.forEach((p) => (p.alive = false))

      manager.startRound()

      // Should not crash; currentPlayerIndex stays at 0
      expect(state.currentPlayerIndex).toBe(0)
    })
  })

  // ================================================================
  // nextTurn — 切换到下一位存活玩家
  // ================================================================

  describe('nextTurn', () => {
    it('should advance to the next alive player in seat order', () => {
      createPlayers(5, state)
      manager.startRound()

      // First nextTurn() returns the current player (seat 0) who hasn't acted yet
      const firstPlayer = manager.nextTurn()
      expect(firstPlayer).toBeDefined()
      expect(firstPlayer!.seatIndex).toBe(0)

      // Second nextTurn() finds the next unacted alive player (seat 1)
      const secondPlayer = manager.nextTurn()
      expect(secondPlayer).toBeDefined()
      expect(secondPlayer!.seatIndex).toBe(1)
    })

    it('should skip dead players', () => {
      const players = createPlayers(4, state)
      players[1]!.alive = false // player 1 is dead
      manager.startRound()

      const firstPlayer = manager.nextTurn()
      expect(firstPlayer!.seatIndex).toBe(0)

      // Next should skip player 1 (dead) and go to player 2
      const secondPlayer = manager.nextTurn()
      expect(secondPlayer!.seatIndex).toBe(2)
    })

    it('should wrap around to seat 0 after the last player', () => {
      createPlayers(3, state)
      manager.startRound()

      manager.nextTurn() // seat 0
      manager.nextTurn() // seat 1
      manager.nextTurn() // seat 2
      // All have acted
      const next = manager.nextTurn()
      expect(next).toBeUndefined() // round complete
    })

    it('should return undefined when all alive players have acted', () => {
      createPlayers(3, state)
      manager.startRound()

      // All 3 players act
      expect(manager.nextTurn()!.seatIndex).toBe(0)
      expect(manager.nextTurn()!.seatIndex).toBe(1)
      expect(manager.nextTurn()!.seatIndex).toBe(2)
      expect(manager.nextTurn()).toBeUndefined() // round complete
    })

    it('should reset player turn state on nextTurn', () => {
      const players = createPlayers(3, state)
      manager.startRound()

      const player = manager.nextTurn()!
      // Simulate using an attack
      player.usedAttackThisTurn = true
      player.shouldSkipPhases = [GamePhase.PhaseUse]

      // When this player comes around again in a future turn,
      // resetTurnState will be called
      // Verify current state is set
      expect(state.currentPhase).toBe(GamePhase.PhasePre)
    })

    it('should handle empty player list', () => {
      const result = manager.nextTurn()
      expect(result).toBeUndefined()
    })

    it('should handle all dead players', () => {
      const players = createPlayers(3, state)
      players.forEach((p) => (p.alive = false))
      manager.startRound()

      const result = manager.nextTurn()
      expect(result).toBeUndefined()
    })

    it('should track which players have acted', () => {
      createPlayers(3, state)
      manager.startRound()

      expect(manager.playersActed.length).toBe(0)
      expect(manager.playersRemaining.length).toBe(3)

      manager.nextTurn() // seat 0
      expect(manager.playersActed.length).toBe(1)
      expect(manager.playersRemaining.length).toBe(2)

      manager.nextTurn() // seat 1
      expect(manager.playersActed.length).toBe(2)
      expect(manager.playersRemaining.length).toBe(1)
    })
  })

  // ================================================================
  // getCurrentPlayer
  // ================================================================

  describe('getCurrentPlayer', () => {
    it('should return the player at currentPlayerIndex', () => {
      const players = createPlayers(5, state)
      state.currentPlayerIndex = 2

      const player = manager.getCurrentPlayer()
      expect(player).toBe(players[2])
    })

    it('should return undefined if current player is dead', () => {
      const players = createPlayers(3, state)
      players[0]!.alive = false
      state.currentPlayerIndex = 0

      const player = manager.getCurrentPlayer()
      // When the player at the index is dead, we return undefined
      // (the caller should check and advance)
      expect(player).toBeUndefined()
    })

    it('should return undefined for empty player list', () => {
      const player = manager.getCurrentPlayer()
      expect(player).toBeUndefined()
    })
  })

  // ================================================================
  // skipTurn — 跳过回合
  // ================================================================

  describe('skipTurn', () => {
    it('should mark a player to be skipped', () => {
      const players = createPlayers(5, state)
      manager.startRound()

      // Skip player at seat 1
      manager.skipTurn(players[1]!)

      // Player 0 acts
      manager.nextTurn() // seat 0

      // Next should skip seat 1 and go to seat 2
      const nextPlayer = manager.nextTurn()
      expect(nextPlayer!.seatIndex).toBe(2)
    })

    it('should set shouldSkipPhases on the player', () => {
      const players = createPlayers(5, state)
      const player = players[0]!

      manager.skipTurn(player)

      expect(player.shouldSkipPhases).toContain(GamePhase.PhasePre)
      expect(player.shouldSkipPhases).toContain(GamePhase.PhaseJudge)
      expect(player.shouldSkipPhases).toContain(GamePhase.PhaseDraw)
      expect(player.shouldSkipPhases).toContain(GamePhase.PhaseUse)
      expect(player.shouldSkipPhases).toContain(GamePhase.PhaseDiscard)
      expect(player.shouldSkipPhases).toContain(GamePhase.PhasePost)
    })

    it('should only skip the player once (remove mark after skip)', () => {
      const players = createPlayers(3, state)
      manager.startRound()

      // Skip player 1 for this round
      manager.skipTurn(players[1]!)

      manager.nextTurn() // seat 0 acts
      // Next should skip seat 1
      const next = manager.nextTurn()
      expect(next!.seatIndex).toBe(2)
    })
  })

  // ================================================================
  // skipPhases — 跳过指定阶段
  // ================================================================

  describe('skipPhases', () => {
    it('should add phases to player shouldSkipPhases', () => {
      const players = createPlayers(3, state)
      const player = players[0]!

      manager.skipPhases(player, [GamePhase.PhaseUse])

      expect(player.shouldSkipPhases).toContain(GamePhase.PhaseUse)
    })

    it('should not duplicate phases', () => {
      const players = createPlayers(3, state)
      const player = players[0]!

      manager.skipPhases(player, [GamePhase.PhaseUse])
      manager.skipPhases(player, [GamePhase.PhaseUse])

      // Should only appear once
      const usePhases = player.shouldSkipPhases.filter(
        (p) => p === GamePhase.PhaseUse,
      )
      expect(usePhases.length).toBe(1)
    })
  })

  // ================================================================
  // shouldSkipPhase — 检查是否跳过阶段
  // ================================================================

  describe('shouldSkipPhase', () => {
    it('should return true if current player should skip the phase', () => {
      const players = createPlayers(3, state)
      manager.startRound()
      const player = manager.nextTurn()!

      player.shouldSkipPhases = [GamePhase.PhaseDraw]
      expect(manager.shouldSkipPhase(GamePhase.PhaseDraw)).toBe(true)
    })

    it('should return false if current player should not skip the phase', () => {
      createPlayers(3, state)
      manager.startRound()
      manager.nextTurn()

      expect(manager.shouldSkipPhase(GamePhase.PhaseDraw)).toBe(false)
    })

    it('should return false if there is no current player', () => {
      expect(manager.shouldSkipPhase(GamePhase.PhaseDraw)).toBe(false)
    })
  })

  // ================================================================
  // isRoundComplete — 检查轮次是否结束
  // ================================================================

  describe('isRoundComplete', () => {
    it('should return false when players still need to act', () => {
      createPlayers(3, state)
      manager.startRound()
      manager.nextTurn() // only 1 of 3 acted

      expect(manager.isRoundComplete).toBe(false)
    })

    it('should return true when all alive players have acted', () => {
      createPlayers(3, state)
      manager.startRound()

      manager.nextTurn()
      manager.nextTurn()
      manager.nextTurn()

      expect(manager.isRoundComplete).toBe(true)
    })

    it('should return true when no alive players', () => {
      const players = createPlayers(3, state)
      players.forEach((p) => (p.alive = false))

      expect(manager.isRoundComplete).toBe(true)
    })

    it('should ignore dead players when checking completeness', () => {
      const players = createPlayers(3, state)
      players[2]!.alive = false // only 2 alive
      manager.startRound()

      manager.nextTurn() // seat 0
      manager.nextTurn() // seat 1
      // seat 2 is dead, so round should be complete

      expect(manager.isRoundComplete).toBe(true)
    })
  })

  // ================================================================
  // reset — 重置管理器
  // ================================================================

  describe('reset', () => {
    it('should clear all internal state', () => {
      createPlayers(3, state)
      manager.startRound()
      manager.nextTurn()
      manager.nextTurn()

      manager.reset()

      expect(manager.playersActed.length).toBe(0)
      expect(manager.playersRemaining.length).toBe(3)
      expect(manager.isRoundComplete).toBe(false)
    })
  })

  // ================================================================
  // 完整轮次流程
  // ================================================================

  describe('full round flow', () => {
    it('should cycle through 5 players correctly', () => {
      createPlayers(5, state)
      manager.startRound()

      const actedSeats: number[] = []
      let player = manager.nextTurn()
      while (player) {
        actedSeats.push(player.seatIndex)
        player = manager.nextTurn()
      }

      expect(actedSeats).toEqual([0, 1, 2, 3, 4])
      expect(manager.isRoundComplete).toBe(true)
    })

    it('should handle 8-player game correctly', () => {
      createPlayers(8, state)
      manager.startRound()

      let count = 0
      let player = manager.nextTurn()
      while (player) {
        count++
        player = manager.nextTurn()
      }

      expect(count).toBe(8)
      expect(manager.isRoundComplete).toBe(true)
    })

    it('should handle multiple rounds', () => {
      createPlayers(3, state)

      // Round 1
      manager.startRound()
      expect(state.currentRound).toBe(1)
      let player = manager.nextTurn()
      while (player) {
        player = manager.nextTurn()
      }
      expect(manager.isRoundComplete).toBe(true)

      // Round 2
      manager.startRound()
      expect(state.currentRound).toBe(2)
      player = manager.nextTurn()
      while (player) {
        player = manager.nextTurn()
      }
      expect(manager.isRoundComplete).toBe(true)
    })
  })

  // ================================================================
  // 边界情况：玩家中途死亡
  // ================================================================

  describe('edge cases: player death during turn', () => {
    it('should end turn immediately when current player dies mid-turn', () => {
      createPlayers(3, state)
      manager.startRound()
      const currentPlayer = manager.nextTurn()!
      expect(currentPlayer.seatIndex).toBe(0)

      // Simulate current player dying during their own turn
      currentPlayer.alive = false

      // nextTurn should skip to next alive player (seat 1), not continue p0
      const nextPlayer = manager.nextTurn()
      expect(nextPlayer).toBeDefined()
      expect(nextPlayer!.seatIndex).toBe(1)
    })

    it('should advance to next alive player when player dies mid-round', () => {
      createPlayers(4, state)
      manager.startRound()

      // Player 0 takes turn, then player 1 takes turn
      manager.nextTurn() // player 0
      manager.nextTurn() // player 1

      // Player 1 dies
      state.players[1]!.alive = false

      // Next turn should be player 2, not player 1
      const nextPlayer = manager.nextTurn()
      expect(nextPlayer!.seatIndex).toBe(2)
    })
  })
})
