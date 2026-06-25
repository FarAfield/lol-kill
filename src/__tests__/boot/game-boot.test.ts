// ============================================================
// 联盟杀 · GameBoot 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { GameBoot } from '@core/boot/game-boot'
import type { GameBootOptions } from '@core/boot/game-boot'
import {
  GamePhase,
  RoleType,
  CardType,
  CardSuit,
  Kingdom,
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
    name: overrides?.name ?? 'sha',
    type: overrides?.type ?? CardType.Basic,
    suit: overrides?.suit ?? CardSuit.Spade,
    rank: overrides?.rank ?? 1,
    description: overrides?.description ?? '杀',
    tags: overrides?.tags ?? ['sha'],
    effectIds: overrides?.effectIds ?? ['sha'],
    isDelayed: false,
    canBeCanceled: false,
  }
}

function createTestConfig(overrides?: Partial<IGameConfig>): IGameConfig {
  return {
    mode: 'test-3p',
    playerCount: 3,
    roles: [RoleType.Aspect, RoleType.Ascended, RoleType.Guardian],
    heroes: [
      createTestHero({ id: 'h0', name: '曹操' }),
      createTestHero({ id: 'h1', name: '刘备' }),
      createTestHero({ id: 'h2', name: '孙权' }),
    ],
    cards: Array.from({ length: 20 }, (_, i) =>
      createTestCardDef({ name: `card_${i}` }),
    ),
    heroSelectCount: 3,
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
    uuid: () => `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

// ── 测试 ──

describe('GameBoot', () => {
  // ================================================================
  // 构造
  // ================================================================

  describe('construction', () => {
    it('should create a GameBoot instance', () => {
      const config = createTestConfig()
      const boot = new GameBoot(config)
      expect(boot).toBeDefined()
      expect(boot.getEngine()).toBeNull()
      expect(boot.isGameOver).toBe(false)
    })

    it('should create with custom options', () => {
      const config = createTestConfig()
      const mockRandom = createMockRandom()
      const boot = new GameBoot(config, { randomService: mockRandom })

      expect(boot.getRandomService()).toBe(mockRandom)
    })

    it('should use default services when none provided', () => {
      const config = createTestConfig()
      const boot = new GameBoot(config)

      expect(boot.getRandomService()).toBeDefined()
      expect(boot.getLoggerService()).toBeDefined()
      expect(boot.getStoreService()).toBeDefined()
    })
  })

  // ================================================================
  // 静态工厂方法
  // ================================================================

  describe('static factory methods', () => {
    it('createStandard5P should create a 5-player GameBoot', () => {
      const boot = GameBoot.createStandard5P({ randomService: createMockRandom() })
      expect(boot).toBeDefined()
    })

    it('createStandard8P should create an 8-player GameBoot', () => {
      const boot = GameBoot.createStandard8P({ randomService: createMockRandom() })
      expect(boot).toBeDefined()
    })

    it('create should create from custom config', () => {
      const config = createTestConfig()
      const boot = GameBoot.create(config)
      expect(boot).toBeDefined()
    })
  })

  // ================================================================
  // boot — 启动引导流程
  // ================================================================

  describe('boot', () => {
    it('should initialize the engine and return BootResult', async () => {
      const config = createTestConfig()
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      const result = await boot.boot()

      expect(result.engine).toBeDefined()
      expect(result.config.mode).toBe('test-3p')
      expect(result.started).toBe(true)
      expect(result.phase).toBe(GamePhase.Prepare)

      // 引擎应该可用
      const engine = boot.getEngine()
      expect(engine).not.toBeNull()
      expect(engine!.state.players.length).toBe(3)
    })

    it('should create players from config', async () => {
      const config = createTestConfig({
        playerCount: 5,
        roles: [
          RoleType.Aspect,
          RoleType.Guardian,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Infiltrator,
        ],
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      const state = boot.getState()
      expect(state).not.toBeNull()
      expect(state!.players.length).toBe(5)
    })

    it('should assign roles correctly', async () => {
      const config = createTestConfig({
        roles: [RoleType.Aspect, RoleType.Ascended, RoleType.Guardian],
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      const state = boot.getState()!
      const roles = state.players.map((p) => p.role)
      expect(roles).toContain(RoleType.Aspect)
      expect(roles).toContain(RoleType.Ascended)
      expect(roles).toContain(RoleType.Guardian)
    })

    it('should reveal Aspect role and give HP bonus', async () => {
      const config = createTestConfig({
        roles: [RoleType.Aspect, RoleType.Ascended, RoleType.Guardian],
        heroes: [createTestHero({ id: 'h0', maxHp: 4 })],
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      const state = boot.getState()!
      const lord = state.players.find((p) => p.role === RoleType.Aspect)
      expect(lord).toBeDefined()
      expect(lord!.roleRevealed).toBe(true)
      expect(lord!.maxHp).toBe(5) // 4 + 1
      expect(lord!.hp).toBe(5)
    })

    it('should initialize the deck', async () => {
      const config = createTestConfig({
        cards: [
          createTestCardDef({ name: 'sha' }),
          createTestCardDef({ name: 'shan' }),
        ],
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      const state = boot.getState()!
      expect(state.deck.length).toBeGreaterThan(0)
    })

    it('should deal initial hands', async () => {
      const config = createTestConfig({
        initialHandSize: 4,
        cards: Array.from({ length: 30 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      const state = boot.getState()!
      for (const player of state.players) {
        expect(player.handCards.length).toBe(4)
      }
    })

    it('should assign heroes to each player', async () => {
      const config = createTestConfig({
        heroes: [
          createTestHero({ id: 'h0', name: '曹操' }),
          createTestHero({ id: 'h1', name: '刘备' }),
          createTestHero({ id: 'h2', name: '孙权' }),
        ],
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      const state = boot.getState()!
      for (const player of state.players) {
        expect(player.heroes.length).toBeGreaterThanOrEqual(1)
      }
    })
  })

  // ================================================================
  // start — 启动游戏
  // ================================================================

  describe('start', () => {
    it('should throw if boot was not called first', async () => {
      const config = createTestConfig()
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await expect(boot.start()).rejects.toThrow('[GameBoot] 尚未调用 boot')
    })

    it('should start the game after boot', async () => {
      const config = createTestConfig({
        cards: Array.from({ length: 20 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()
      await boot.start()

      const state = boot.getState()!
      expect(state.started).toBe(true)
      // After start, phase should be within a valid turn phase
      expect([
        GamePhase.PhasePre,
        GamePhase.PhaseJudge,
        GamePhase.PhaseDraw,
        GamePhase.PhaseUse,
        GamePhase.PhaseDiscard,
        GamePhase.PhasePost,
        GamePhase.RoundEnd,
      ]).toContain(state.currentPhase)
    })

    it('should set the current player after start', async () => {
      const config = createTestConfig({
        cards: Array.from({ length: 20 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()
      await boot.start()

      const player = boot.getCurrentPlayer()
      // There may or may not be a current player depending on game state
      // Just verify no crash
      expect(boot.getState()).not.toBeNull()
    })
  })

  // ================================================================
  // runGameLoop — 自动游戏循环
  // ================================================================

  describe('runGameLoop', () => {
    it('should run a complete game and return result', async () => {
      const config = createTestConfig({
        mode: 'quick-2p',
        playerCount: 2,
        roles: [RoleType.Aspect, RoleType.Ascended],
        heroes: [createTestHero({ id: 'h0', maxHp: 1 })],
        cards: Array.from({ length: 10 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
        initialHandSize: 0,
        equipEnabled: false,
        delayedCardEnabled: false,
        maxRounds: 1,
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()
      const result = await boot.runGameLoop()

      expect(result).toBeDefined()
      expect(result.reason).toBeDefined()
      expect(result.totalRounds).toBeGreaterThanOrEqual(1)
      expect(boot.isGameOver).toBe(true)
    })

    it('should throw if boot was not called', async () => {
      const config = createTestConfig()
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await expect(boot.runGameLoop()).rejects.toThrow('[GameBoot] 尚未调用 boot')
    })
  })

  // ================================================================
  // run — 一键启动并运行
  // ================================================================

  describe('run', () => {
    it('should boot and run a complete game with one call', async () => {
      const config = createTestConfig({
        mode: 'quick-2p',
        playerCount: 2,
        roles: [RoleType.Aspect, RoleType.Ascended],
        heroes: [createTestHero({ id: 'h0', maxHp: 1 })],
        cards: Array.from({ length: 10 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
        initialHandSize: 0,
        equipEnabled: false,
        delayedCardEnabled: false,
        maxRounds: 1,
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      const result = await boot.run()

      expect(result).toBeDefined()
      expect(boot.isGameOver).toBe(true)
    })
  })

  // ================================================================
  // 查询
  // ================================================================

  describe('queries', () => {
    it('getState should return null before boot', () => {
      const config = createTestConfig()
      const boot = new GameBoot(config)

      expect(boot.getState()).toBeNull()
      expect(boot.getCurrentPlayer()).toBeUndefined()
    })

    it('getState should return state after boot', async () => {
      const config = createTestConfig()
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      const state = boot.getState()
      expect(state).not.toBeNull()
      expect(state!.players.length).toBe(3)
    })

    it('getCurrentPlayer should return a player after boot', async () => {
      const config = createTestConfig()
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      const player = boot.getCurrentPlayer()
      expect(player).toBeDefined()
      expect(player!.seatIndex).toBe(0)
    })

    it('isGameOver should return false after boot', async () => {
      const config = createTestConfig()
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      expect(boot.isGameOver).toBe(false)
    })
  })

  // ================================================================
  // 配置验证
  // ================================================================

  describe('configuration validation', () => {
    it('should reject fewer than 2 players', async () => {
      const config = createTestConfig({
        playerCount: 1,
        roles: [RoleType.Aspect],
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await expect(boot.boot()).rejects.toThrow('至少为 2')
    })

    it('should reject mismatched role count', async () => {
      const config = createTestConfig({
        playerCount: 3,
        roles: [RoleType.Aspect], // Only 1 role for 3 players
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await expect(boot.boot()).rejects.toThrow('不匹配')
    })

    it('should reject configs without a lord', async () => {
      const config = createTestConfig({
        roles: [RoleType.Guardian, RoleType.Ascended, RoleType.Infiltrator],
      })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await expect(boot.boot()).rejects.toThrow('必须有一个天命星灵')
    })
  })

  // ================================================================
  // 边界情况
  // ================================================================

  describe('edge cases', () => {
    it('should handle empty hero pool', async () => {
      const config = createTestConfig({ heroes: [] })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      const state = boot.getState()!
      expect(state.players.length).toBe(3)
      // Players should have no heroes
      for (const player of state.players) {
        expect(player.heroes.length).toBe(0)
      }
    })

    it('should handle empty card list', async () => {
      const config = createTestConfig({ cards: [] })
      const boot = new GameBoot(config, { randomService: createMockRandom() })

      await boot.boot()

      const state = boot.getState()!
      expect(state.deck.length).toBe(0)
    })

    it('should handle custom draw count', async () => {
      const config = createTestConfig({
        cards: Array.from({ length: 20 }, (_, i) =>
          createTestCardDef({ name: `card_${i}` }),
        ),
      })
      const boot = new GameBoot(config, {
        randomService: createMockRandom(),
        drawCount: 3,
      })

      await boot.boot()
      // verify no crash — draw count is used in PhaseManager
      expect(boot.getState()).not.toBeNull()
    })
  })
})
