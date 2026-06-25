// ============================================================
// 联盟杀 · GameEngine 单元测试
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GameEngine } from '@core/engine/game-engine'
import { GameState, createDefaultConfig } from '@core/entity/game-state'
import { Player } from '@core/entity/player'
import { Hero } from '@core/entity/hero'
import { Card } from '@core/entity/card'
import {
  GamePhase,
  RoleType,
  CardType,
  CardSuit,
  Kingdom,
  ZoneType,
} from '@core/contracts/enums'
import type { IGameConfig } from '@core/contracts/game.interface'
import type { CardDefinition } from '@core/contracts/card.interface'
import type { IHero } from '@core/contracts/hero.interface'
import type { IRandomService } from '@core/contracts/services.interface'

// ── 测试辅助 ──

function createTestHero(overrides?: Partial<IHero>): IHero {
  return {
    id: overrides?.id ?? 'test_hero',
    name: overrides?.name ?? '测试英雄',
    title: overrides?.title ?? '测试',
    kingdom: overrides?.kingdom ?? Kingdom.Demacia,
    maxHp: overrides?.maxHp ?? 4,
    maxPower: overrides?.maxPower ?? 0,
    effectIds: overrides?.effectIds ?? [],
  }
}

function createTestCardDef(overrides?: Partial<CardDefinition>): CardDefinition {
  return {
    name: 'sha',
    type: CardType.Basic,
    suit: CardSuit.Spade,
    rank: 1,
    description: '杀',
    tags: ['sha'],
    effectIds: ['sha'],
    isDelayed: false,
    canBeCanceled: false,
    ...overrides,
  }
}

function createTestConfig(overrides?: Partial<IGameConfig>): IGameConfig {
  return {
    mode: 'test-3p',
    playerCount: 3,
    roles: [RoleType.Aspect, RoleType.Ascended, RoleType.Guardian],
    heroes: [createTestHero()],
    cards: [createTestCardDef()],
    heroSelectCount: 1,
    initialHandSize: 4,
    equipEnabled: true,
    delayedCardEnabled: true,
    maxRounds: 10,
    ...overrides,
  }
}

function createMockRandom(): IRandomService {
  return {
    shuffle: <T>(array: T[]): T[] => [...array],
    nextInt: (_min: number, max: number) => max,
    pick: <T>(array: T[]): T => array[0]!,
    pickN: <T>(array: T[], n: number): T[] => array.slice(0, n),
    uuid: () => `mock-${Date.now()}-${Math.random()}`,
  }
}

describe('GameEngine', () => {
  let engine: GameEngine

  beforeEach(() => {
    engine = new GameEngine({ randomService: createMockRandom() })
  })

  // ================================================================
  // 构造
  // ================================================================

  describe('construction', () => {
    it('should create all subsystems on construction', () => {
      expect(engine.state).toBeDefined()
      expect(engine.stateMachine).toBeDefined()
      expect(engine.eventChain).toBeDefined()
      expect(engine.eventDispatcher).toBeDefined()
      expect(engine.turnManager).toBeDefined()
      expect(engine.phaseManager).toBeDefined()
      expect(engine.deckManager).toBeDefined()
      expect(engine.cardSystem).toBeDefined()
      expect(engine.damageSystem).toBeDefined()
      expect(engine.distanceSystem).toBeDefined()
      expect(engine.targetSystem).toBeDefined()
      expect(engine.deathSystem).toBeDefined()
    })

    it('should start in NotStarted phase', () => {
      expect(engine.state.currentPhase).toBe(GamePhase.NotStarted)
      expect(engine.state.started).toBe(false)
      expect(engine.state.finished).toBe(false)
    })
  })

  // ================================================================
  // init — 初始化引擎
  // ================================================================

  describe('init', () => {
    it('should initialize the game state from config', async () => {
      const config = createTestConfig()

      await engine.init(config)

      expect(engine.state.started).toBe(true)
      expect(engine.state.config.mode).toBe('test-3p')
      expect(engine.state.players.length).toBe(3)
    })

    it('should create the correct number of players', async () => {
      const config = createTestConfig({ playerCount: 5 })
      await engine.init(config)

      expect(engine.state.players.length).toBe(5)
    })

    it('should assign roles to players', async () => {
      const config = createTestConfig({
        roles: [RoleType.Aspect, RoleType.Ascended, RoleType.Guardian],
      })
      await engine.init(config)

      const roles = engine.state.players.map((p) => p.role)
      expect(roles.filter((r) => r === RoleType.Aspect).length).toBe(1)
      expect(roles.filter((r) => r === RoleType.Ascended).length).toBe(1)
      expect(roles.filter((r) => r === RoleType.Guardian).length).toBe(1)
    })

    it('should reveal the Aspect (lord) role', async () => {
      const config = createTestConfig({
        roles: [RoleType.Aspect, RoleType.Ascended, RoleType.Guardian],
      })
      await engine.init(config)

      const lord = engine.state.players.find(
        (p) => p.role === RoleType.Aspect,
      )
      expect(lord).toBeDefined()
      expect(lord!.roleRevealed).toBe(true)
    })

    it('should give the lord +1 max HP', async () => {
      const config = createTestConfig({
        roles: [RoleType.Aspect, RoleType.Ascended, RoleType.Guardian],
        heroes: [{ ...createTestHero(), maxHp: 4 }],
      })
      // Make lord always get player 0 by fixing shuffle
      await engine.init(config)

      const lord = engine.state.players.find(
        (p) => p.role === RoleType.Aspect,
      )
      expect(lord).toBeDefined()
      expect(lord!.maxHp).toBe(5) // 4 + 1
      expect(lord!.hp).toBe(5)
    })

    it('should initialize the deck with cards', async () => {
      const config = createTestConfig({
        cards: [
          createTestCardDef({ name: 'sha' }),
          createTestCardDef({ name: 'shan' }),
          createTestCardDef({ name: 'tao' }),
        ],
      })
      await engine.init(config)

      expect(engine.state.deck.length).toBeGreaterThan(0)
    })

    it('should deal initial hands to all players', async () => {
      const config = createTestConfig({
        cards: Array.from({ length: 20 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
        initialHandSize: 4,
      })
      await engine.init(config)

      for (const player of engine.state.players) {
        if (player.alive) {
          expect(player.handCards.length).toBe(4)
        }
      }
    })

    it('should register all state machine transitions', async () => {
      const config = createTestConfig()
      await engine.init(config)

      // After init, state machine is at Prepare
      // Verify key transitions are registered from Prepare
      expect(
        engine.stateMachine.canTransition(GamePhase.RoundStart),
      ).toBe(true)
      // GameOver should be reachable via wildcard
      expect(
        engine.stateMachine.canTransition(GamePhase.GameOver),
      ).toBe(true)
    })

    it('should throw if start is called before init', async () => {
      await expect(engine.start()).rejects.toThrow(
        '[GameEngine] 游戏尚未初始化',
      )
    })
  })

  // ================================================================
  // start — 启动游戏
  // ================================================================

  describe('start', () => {
    it('should start and enter the first player turn', async () => {
      const config = createTestConfig({
        cards: Array.from({ length: 30 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
      })
      await engine.init(config)
      await engine.start()

      // Game should be in a proper phase
      expect(engine.state.started).toBe(true)
    })

    it('should have current phase within a valid range after start', async () => {
      const config = createTestConfig({
        cards: Array.from({ length: 30 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
      })
      await engine.init(config)
      await engine.start()

      // After starting, phase should be part of a turn or post-turn
      const { currentPhase } = engine.state
      expect([
        GamePhase.PhasePre,
        GamePhase.PhaseJudge,
        GamePhase.PhaseDraw,
        GamePhase.PhaseUse,
        GamePhase.PhaseDiscard,
        GamePhase.PhasePost,
      ]).toContain(currentPhase)
    })
  })

  // ── 快速结束配置（用于 runGameLoop 和查询测试） ──

  function createQuickGameConfig(): IGameConfig {
    return {
      mode: 'quick-test',
      playerCount: 2,
      roles: [RoleType.Aspect, RoleType.Ascended],
      heroes: [createTestHero({ maxHp: 1 })],
      cards: Array.from({ length: 10 }, (_, i) =>
        createTestCardDef({ name: `card_${i}` }),
      ),
      heroSelectCount: 1,
      initialHandSize: 0,
      equipEnabled: false,
      delayedCardEnabled: false,
      maxRounds: 1,
    }
  }

  // ================================================================
  // runGameLoop — 完整游戏循环
  // ================================================================

  describe('runGameLoop', () => {

    it('should run and return a game result', async () => {
      const config = createQuickGameConfig()
      await engine.init(config)
      await engine.start()

      const result = await engine.runGameLoop()

      expect(result).toBeDefined()
      expect(result.winner).toBeDefined()
      expect(result.reason).toBeDefined()
      expect(engine.state.finished).toBe(true)
    })

    it('should end when max rounds is reached', async () => {
      const config = createQuickGameConfig()
      config.maxRounds = 1
      await engine.init(config)
      await engine.start()

      const result = await engine.runGameLoop()

      expect(engine.state.finished).toBe(true)
    })
  })

  // ================================================================
  // nextPhase — 手动推进阶段
  // ================================================================

  describe('nextPhase', () => {
    it('should advance to next phase', async () => {
      const config = createTestConfig({
        cards: Array.from({ length: 20 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
      })
      await engine.init(config)

      // Set up a player at PhaseUse
      engine.state.currentPhase = GamePhase.PhaseUse
      engine.state.currentPlayerIndex = 0

      await engine.nextPhase()

      // Should be in PhaseDiscard now
      expect(engine.state.currentPhase).toBe(GamePhase.PhaseDiscard)
    })
  })

  // ================================================================
  // getCurrentPlayer / getState / isGameOver
  // ================================================================

  describe('queries', () => {
    it('getCurrentPlayer should return current player', async () => {
      const config = createTestConfig()
      await engine.init(config)

      const player = engine.getCurrentPlayer()
      expect(player).toBeDefined()
      expect(player!.seatIndex).toBe(0)
    })

    it('getState should return a snapshot', async () => {
      const config = createTestConfig()
      await engine.init(config)

      const snapshot = engine.getState()
      expect(snapshot.players.length).toBe(3)
      expect(snapshot.started).toBe(true)
    })

    it('isGameOver should return false initially', async () => {
      const config = createTestConfig()
      await engine.init(config)

      expect(engine.isGameOver).toBe(false)
    })

    it('isGameOver should return true after game ends', async () => {
      const config = createQuickGameConfig()
      await engine.init(config)
      await engine.start()
      await engine.runGameLoop()

      expect(engine.isGameOver).toBe(true)
    })
  })

  // ================================================================
  // 边界情况
  // ================================================================

  describe('edge cases', () => {
    it('should handle empty hero list', async () => {
      const config = createTestConfig({ heroes: [] })
      await engine.init(config)

      // Should not crash — players have no heroes
      expect(engine.state.players[0]!.heroes.length).toBe(0)
    })

    it('should handle empty card list', async () => {
      const config = createTestConfig({ cards: [] })
      await engine.init(config)

      expect(engine.state.deck.length).toBe(0)
    })

    it('should handle 8-player configuration', async () => {
      const config = createTestConfig({
        playerCount: 8,
        roles: [
          RoleType.Aspect,
          RoleType.Guardian,
          RoleType.Guardian,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Infiltrator,
        ],
        cards: Array.from({ length: 80 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
      })
      await engine.init(config)

      expect(engine.state.players.length).toBe(8)
      const roles = engine.state.players.map((p) => p.role)
      expect(roles.filter((r) => r === RoleType.Aspect).length).toBe(1)
      expect(roles.filter((r) => r === RoleType.Guardian).length).toBe(2)
      expect(roles.filter((r) => r === RoleType.Ascended).length).toBe(4)
      expect(roles.filter((r) => r === RoleType.Infiltrator).length).toBe(1)
    })

    it('should handle a new engine without calling init', () => {
      const freshEngine = new GameEngine()

      expect(freshEngine.state.currentPhase).toBe(GamePhase.NotStarted)
      expect(freshEngine.state.started).toBe(false)
      expect(freshEngine.getCurrentPlayer()).toBeUndefined()
    })

    it('should handle all players dead scenario without crashing', async () => {
      const engine = new GameEngine()
      const config = createQuickGameConfig()
      config.roles = [] // No roles → no normal victory triggers

      await engine.init(config)

      // Mark all players as dead (simulating abnormal mass-death scenario)
      engine.state.players.forEach((p) => {
        p.alive = false
      })

      // runGameLoop should end gracefully (not crash), even if it goes through
      // the checkGameOver path (vacuous "all enemies dead" → Aspect victory)
      const result = await engine.runGameLoop()
      expect(result).toBeDefined()
      expect(result.totalRounds).toBeGreaterThanOrEqual(0)
      // Game ends — the specific path depends on timing of round-complete check
    })
  })
})
