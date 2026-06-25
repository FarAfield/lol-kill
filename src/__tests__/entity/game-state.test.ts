// ============================================================
// GameState 实体 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { GameState, createDefaultConfig } from '@core/entity/game-state'
import { Player } from '@core/entity/player'
import { Card } from '@core/entity/card'
import { Hero } from '@core/entity/hero'
import {
  GamePhase,
  RoleType,
  Kingdom,
  ZoneType,
  CardType,
  CardSuit,
  LogLevel,
} from '@core/contracts/enums'
import type { IGameConfig } from '@core/contracts/game.interface'
import type { CardDefinition } from '@core/contracts/card.interface'

// ── 测试辅助 ──

function createTestConfig(overrides?: Partial<IGameConfig>): IGameConfig {
  return createDefaultConfig(overrides)
}

function createTestPlayer(id: string, seat: number, role?: RoleType): Player {
  return Player.create(id, seat, undefined, { role })
}

function createTestCardDef(name: string = '测试'): CardDefinition {
  return {
    name,
    type: CardType.Basic,
    suit: CardSuit.Spade,
    rank: 1,
    description: '测试卡牌',
    tags: ['test'],
    effectIds: [],
    isDelayed: false,
    canBeCanceled: false,
  }
}

// ── 测试套件 ──

describe('GameState', () => {
  beforeEach(() => {
    Card.resetCounter()
  })

  // ================================================================
  // 创建
  // ================================================================

  describe('create', () => {
    it('should create with config defaults', () => {
      const config = createTestConfig()
      const state = GameState.create(config)

      expect(state).toBeInstanceOf(GameState)
      expect(state.config).toBe(config)
      expect(state.currentRound).toBe(1)
      expect(state.currentPlayerIndex).toBe(0)
      expect(state.currentPhase).toBe(GamePhase.NotStarted)
      expect(state.started).toBe(false)
      expect(state.finished).toBe(false)
      expect(state.players).toEqual([])
      expect(state.deck).toEqual([])
      expect(state.discardPile).toEqual([])
    })

    it('should accept overrides', () => {
      const config = createTestConfig()
      const state = GameState.create(config, {
        currentRound: 5,
        started: true,
      })

      expect(state.currentRound).toBe(5)
      expect(state.started).toBe(true)
    })
  })

  describe('constructor', () => {
    it('should create with partial data', () => {
      const state = new GameState({
        currentRound: 3,
        currentPhase: GamePhase.PhaseUse,
      })

      expect(state.currentRound).toBe(3)
      expect(state.currentPhase).toBe(GamePhase.PhaseUse)
      expect(state.players).toEqual([])
    })

    it('should use defaults for unspecified fields', () => {
      const state = new GameState()

      expect(state.currentRound).toBe(0)
      expect(state.currentPhase).toBe(GamePhase.NotStarted)
      expect(state.started).toBe(false)
      expect(state.finished).toBe(false)
    })
  })

  // ================================================================
  // createDefaultConfig
  // ================================================================

  describe('createDefaultConfig', () => {
    it('should return default 5p config', () => {
      const config = createDefaultConfig()
      expect(config.mode).toBe('standard-5p')
      expect(config.playerCount).toBe(5)
      expect(config.initialHandSize).toBe(4)
      expect(config.maxRounds).toBe(100)
    })

    it('should merge overrides', () => {
      const config = createDefaultConfig({ mode: 'custom', playerCount: 8 })
      expect(config.mode).toBe('custom')
      expect(config.playerCount).toBe(8)
    })
  })

  // ================================================================
  // 玩家查询
  // ================================================================

  describe('player queries', () => {
    let state: GameState
    let players: Player[]

    beforeEach(() => {
      players = [
        createTestPlayer('p0', 0, RoleType.Aspect),
        createTestPlayer('p1', 1, RoleType.Guardian),
        createTestPlayer('p2', 2, RoleType.Ascended),
        createTestPlayer('p3', 3, RoleType.Ascended),
        createTestPlayer('p4', 4, RoleType.Infiltrator),
      ]
      state = new GameState({ players })
    })

    it('should get current player', () => {
      expect(state.currentPlayer).toBe(players[0])
    })

    it('should return undefined current player when players is empty', () => {
      const emptyState = new GameState()
      expect(emptyState.currentPlayer).toBeUndefined()
    })

    it('should get alive players', () => {
      players[2]!.alive = false
      const alive = state.alivePlayers

      expect(alive).toHaveLength(4)
      expect(alive).not.toContain(players[2])
    })

    it('should report aliveCount', () => {
      players[2]!.alive = false
      expect(state.aliveCount).toBe(4)
    })

    it('should find player by id', () => {
      const found = state.getPlayerById('p3')
      expect(found).toBe(players[3])
    })

    it('should return undefined for unknown player id', () => {
      const found = state.getPlayerById('unknown')
      expect(found).toBeUndefined()
    })

    it('should get players by role', () => {
      const ascended = state.getPlayersByRole(RoleType.Ascended)
      expect(ascended).toHaveLength(2)
      expect(ascended[0]!.role).toBe(RoleType.Ascended)
    })

    it('should get lord (Aspect)', () => {
      const lord = state.lord
      expect(lord).toBe(players[0])
      expect(lord!.role).toBe(RoleType.Aspect)
    })

    it('should return undefined lord when no Aspect', () => {
      const noLordState = new GameState({
        players: [createTestPlayer('p1', 1, RoleType.Guardian)],
      })
      expect(noLordState.lord).toBeUndefined()
    })
  })

  // ================================================================
  // 回合操作
  // ================================================================

  describe('advanceToNextPlayer', () => {
    it('should advance to next alive player', () => {
      const players = [
        createTestPlayer('p0', 0),
        createTestPlayer('p1', 1),
        createTestPlayer('p2', 2),
      ]
      const state = new GameState({ players, currentPlayerIndex: 0 })

      const nextIdx = state.advanceToNextPlayer()
      expect(nextIdx).toBe(1)
      expect(state.currentPlayerIndex).toBe(1)
    })

    it('should skip dead players', () => {
      const players = [
        createTestPlayer('p0', 0),
        createTestPlayer('p1', 1),
        createTestPlayer('p2', 2),
      ]
      players[1]!.alive = false
      const state = new GameState({ players, currentPlayerIndex: 0 })

      const nextIdx = state.advanceToNextPlayer()
      expect(nextIdx).toBe(2)
      expect(state.currentPlayerIndex).toBe(2)
    })

    it('should wrap around to beginning', () => {
      const players = [
        createTestPlayer('p0', 0),
        createTestPlayer('p1', 1),
      ]
      const state = new GameState({ players, currentPlayerIndex: 1 })

      const nextIdx = state.advanceToNextPlayer()
      expect(nextIdx).toBe(0)
    })

    it('should return -1 when no alive players', () => {
      const players = [
        createTestPlayer('p0', 0),
      ]
      players[0]!.alive = false
      const state = new GameState({ players, currentPlayerIndex: 0 })

      expect(state.advanceToNextPlayer()).toBe(-1)
    })

    it('should handle empty players list', () => {
      const state = new GameState({ players: [], currentPlayerIndex: 0 })
      expect(state.advanceToNextPlayer()).toBe(0)
    })
  })

  describe('startNewRound', () => {
    it('should increment round and reset player index', () => {
      const state = new GameState({ currentRound: 3, currentPlayerIndex: 4 })
      state.startNewRound()

      expect(state.currentRound).toBe(4)
      expect(state.currentPlayerIndex).toBe(0)
    })
  })

  // ================================================================
  // 牌堆操作
  // ================================================================

  describe('drawFromDeck', () => {
    it('should draw cards from deck', () => {
      const cards = [Card.create(createTestCardDef('c1')), Card.create(createTestCardDef('c2')), Card.create(createTestCardDef('c3'))]
      const state = new GameState({ deck: [...cards] })

      const drawn = state.drawFromDeck(2)
      expect(drawn).toHaveLength(2)
      expect(drawn[0]!.name).toBe('c3')
      expect(drawn[1]!.name).toBe('c2')
      expect(state.deck).toHaveLength(1)
    })

    it('should recycle discard pile when deck is empty', () => {
      const cards = [Card.create(createTestCardDef('c1')), Card.create(createTestCardDef('c2'))]
      const state = new GameState({
        deck: [Card.create(createTestCardDef('top'))],
        discardPile: [...cards],
      })

      // Draw the only deck card
      const drawn1 = state.drawFromDeck(1)
      expect(drawn1).toHaveLength(1)

      // Now deck should be empty, next draw should recycle
      const drawn2 = state.drawFromDeck(2)
      expect(drawn2).toHaveLength(2)
      expect(state.discardPile).toHaveLength(0)
    })

    it('should return empty array when no cards available', () => {
      const state = new GameState({ deck: [], discardPile: [] })

      const drawn = state.drawFromDeck(5)
      expect(drawn).toEqual([])
    })
  })

  describe('discardCards', () => {
    it('should add cards to discard pile', () => {
      const card1 = Card.create(createTestCardDef('c1'))
      const card2 = Card.create(createTestCardDef('c2'))
      const state = new GameState()

      state.discardCards([card1, card2])
      expect(state.discardPile).toHaveLength(2)
    })
  })

  describe('recycleDiscardPile', () => {
    it('should move discard pile to deck', () => {
      const cards = [Card.create(createTestCardDef('c1')), Card.create(createTestCardDef('c2'))]
      const state = new GameState({ discardPile: [...cards], deck: [] })

      const result = state.recycleDiscardPile()
      expect(result).toBe(true)
      expect(state.discardPile).toHaveLength(0)
      expect(state.deck).toHaveLength(2)
    })

    it('should return false when discard pile is empty', () => {
      const state = new GameState({ discardPile: [] })
      expect(state.recycleDiscardPile()).toBe(false)
    })
  })

  describe('deck queries', () => {
    it('should report empty deck', () => {
      const state = new GameState({ deck: [] })
      expect(state.isDeckEmpty).toBe(true)
    })

    it('should report total available cards', () => {
      const state = new GameState({
        deck: [Card.create(createTestCardDef())],
        discardPile: [Card.create(createTestCardDef()), Card.create(createTestCardDef())],
      })
      expect(state.totalCardsAvailable).toBe(3)
    })
  })

  // ================================================================
  // 日志操作
  // ================================================================

  describe('log', () => {
    it('should add log entries', () => {
      const state = new GameState()

      state.addLog({
        id: 'log1',
        timestamp: Date.now(),
        round: 1,
        phase: GamePhase.PhaseUse,
        message: '玩家出杀',
        level: LogLevel.Info,
      })

      expect(state.log).toHaveLength(1)
      expect(state.log[0]!.message).toBe('玩家出杀')
    })

    it('should get recent logs', () => {
      const state = new GameState()
      for (let i = 0; i < 10; i++) {
        state.addLog({
          id: `log${i}`,
          timestamp: Date.now(),
          round: 1,
          phase: GamePhase.PhaseUse,
          message: `msg${i}`,
          level: LogLevel.Info,
        })
      }

      const recent = state.getRecentLogs(3)
      expect(recent).toHaveLength(3)
      expect(recent[2]!.message).toBe('msg9')
    })

    it('should trim old logs', () => {
      const state = new GameState()
      for (let i = 0; i < 10; i++) {
        state.addLog({
          id: `log${i}`,
          timestamp: Date.now(),
          round: 1,
          phase: GamePhase.PhaseUse,
          message: `msg${i}`,
          level: LogLevel.Info,
        })
      }

      state.trimLogs(5)
      expect(state.log).toHaveLength(5)
      expect(state.log[0]!.message).toBe('msg5')
    })

    it('should not trim when log count <= keepCount', () => {
      const state = new GameState()
      state.addLog({
        id: 'log1',
        timestamp: Date.now(),
        round: 1,
        phase: GamePhase.PhaseUse,
        message: 'test',
        level: LogLevel.Info,
      })

      state.trimLogs(10)
      expect(state.log).toHaveLength(1)
    })
  })

  // ================================================================
  // 游戏流程
  // ================================================================

  describe('game flow', () => {
    it('should mark game as started', () => {
      const state = new GameState()
      state.markStarted()

      expect(state.started).toBe(true)
      expect(state.currentPhase).toBe(GamePhase.Prepare)
    })

    it('should mark game as finished', () => {
      const state = new GameState()
      state.markFinished()

      expect(state.finished).toBe(true)
      expect(state.currentPhase).toBe(GamePhase.GameOver)
    })

    it('should build game result', () => {
      const players = [
        createTestPlayer('p0', 0, RoleType.Aspect),
        createTestPlayer('p1', 1, RoleType.Guardian),
      ]
      players[1]!.alive = false
      const state = new GameState({ players, currentRound: 12 })

      const result = state.buildResult(RoleType.Aspect, '反贼全部死亡')

      expect(result.winner).toBe(RoleType.Aspect)
      expect(result.reason).toBe('反贼全部死亡')
      expect(result.totalRounds).toBe(12)
      expect(result.survivingPlayers).toHaveLength(1)
      expect(result.endedAt).toBeGreaterThan(0)
    })
  })

  // ================================================================
  // 序列化
  // ================================================================

  describe('toJSON / snapshot', () => {
    it('should serialize all fields', () => {
      const players = [createTestPlayer('p0', 0)]
      const state = new GameState({
        players,
        currentRound: 5,
        currentPhase: GamePhase.PhaseUse,
        started: true,
      })

      const json = state.toJSON()

      expect(json.currentRound).toBe(5)
      expect(json.currentPhase).toBe(GamePhase.PhaseUse)
      expect(json.started).toBe(true)
      expect(json.players).toHaveLength(1)
    })

    it('should return a defensive copy via toJSON', () => {
      const state = new GameState({ players: [createTestPlayer('p0', 0)] })
      const json = state.toJSON()

      // Modifying the copy should not affect original
      json.players.push(createTestPlayer('p1', 1))
      expect(state.players).toHaveLength(1)
    })

    it('should snapshot return the same as toJSON', () => {
      const state = new GameState({ currentRound: 3 })
      expect(state.snapshot()).toEqual(state.toJSON())
    })
  })

  // ================================================================
  // deepClone / restore
  // ================================================================

  describe('deepClone / restore', () => {
    it('should produce structurally equal data', () => {
      const player = createTestPlayer('p0', 0)
      const state = new GameState({
        players: [player],
        currentRound: 3,
        currentPhase: GamePhase.PhaseUse,
        started: true,
      })

      const clone = state.deepClone()
      expect(clone.currentRound).toBe(3)
      expect(clone.currentPhase).toBe(GamePhase.PhaseUse)
      expect(clone.started).toBe(true)
      expect(clone.players).toHaveLength(1)
      expect(clone.players[0]!.id).toBe('p0')
    })

    it('should produce an independent copy (modifying clone does not affect original)', () => {
      const player = createTestPlayer('p0', 0)
      player.hp = 5
      const state = new GameState({
        players: [player],
        currentRound: 2,
      })

      const clone = state.deepClone()
      // Modify cloned player's HP
      clone.players[0]!.hp = 1

      // Original should be unchanged
      expect(state.players[0]!.hp).toBe(5)
      // Clone should have the new value
      expect(clone.players[0]!.hp).toBe(1)
    })

    it('should handle state with processingCards', () => {
      const card = Card.create(createTestCardDef())
      const state = new GameState({ processingCards: [card] })

      const clone = state.deepClone()
      expect(clone.processingCards).toHaveLength(1)

      // Modify clone
      clone.processingCards = []
      expect(state.processingCards).toHaveLength(1)
    })

    it('should handle state with deck and discardPile', () => {
      const state = new GameState()
      state.deck = [
        Card.create(createTestCardDef({ name: 'sha' })),
        Card.create(createTestCardDef({ name: 'shan', tags: ['shan'] })),
      ]
      state.discardPile = [
        Card.create(createTestCardDef({ name: 'tao', tags: ['tao'] })),
      ]

      const clone = state.deepClone()
      expect(clone.deck).toHaveLength(2)
      expect(clone.discardPile).toHaveLength(1)

      // Modify clone
      clone.deck.pop()
      expect(state.deck).toHaveLength(2)
    })

    it('should restore a GameState from deepClone data', () => {
      const state = new GameState({
        currentRound: 5,
        currentPlayerIndex: 2,
        started: true,
        finished: false,
        players: [createTestPlayer('p0', 0), createTestPlayer('p1', 1)],
      })

      const cloned = state.deepClone()
      const restored = GameState.restore(cloned)

      expect(restored.currentRound).toBe(5)
      expect(restored.currentPlayerIndex).toBe(2)
      expect(restored.started).toBe(true)
      expect(restored.players).toHaveLength(2)
      expect(restored.players[0]!.id).toBe('p0')
    })

    it('should round-trip: deepClone → restore → same values', () => {
      const original = new GameState({
        currentRound: 10,
        currentPhase: GamePhase.PhaseDiscard,
        phaseIndex: 4,
        players: [createTestPlayer('p0', 0)],
        deck: [Card.create(createTestCardDef({ name: 'sha' }))],
      })
      original.markStarted()
      original.startNewRound()

      const clone = original.deepClone()
      const restored = GameState.restore(clone)

      expect(restored.currentRound).toBe(original.currentRound)
      expect(restored.currentPhase).toBe(original.currentPhase)
      expect(restored.phaseIndex).toBe(original.phaseIndex)
      expect(restored.started).toBe(original.started)
      expect(restored.players).toHaveLength(original.players.length)
      expect(restored.deck).toHaveLength(original.deck.length)
    })
  })

  // ================================================================
  // 边界情况
  // ================================================================

  describe('edge cases', () => {
    it('should handle empty state', () => {
      const state = new GameState()
      expect(state.players).toEqual([])
      expect(state.deck).toEqual([])
      expect(state.aliveCount).toBe(0)
      expect(state.lord).toBeUndefined()
    })

    it('should handle processingCards', () => {
      const card = Card.create(createTestCardDef())
      const state = new GameState({ processingCards: [card] })

      expect(state.processingCards).toHaveLength(1)
      expect(state.processingCards[0]).toBe(card)
    })

    it('should handle many players advance correctly', () => {
      const players = Array.from({ length: 8 }, (_, i) =>
        createTestPlayer(`p${i}`, i),
      )
      // Kill players 1-6, leave 0 and 7 alive
      for (let i = 1; i < 7; i++) {
        players[i]!.alive = false
      }
      const state = new GameState({ players, currentPlayerIndex: 0 })

      // From 0, next alive should be 7
      expect(state.advanceToNextPlayer()).toBe(7)
      // From 7, wrapping to 0
      expect(state.advanceToNextPlayer()).toBe(0)
    })
  })
})
