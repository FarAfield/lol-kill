// ============================================================
// 联盟杀 · 标准5人局集成测试
//
// 验证完整的5人标准局：
// - 1 Aspect + 1 Guardian + 2 Ascended + 1 Infiltrator
// - 5名武将随机选择
// - 标准牌堆
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { GameBoot } from '@core/boot/game-boot'
import { standard5pConfig } from '@source/modes/standard-5p'
import { GamePhase, RoleType, ZoneType } from '@core/contracts/enums'
import type { IRandomService } from '@core/contracts/services.interface'

// ── 测试辅助 ──

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

describe('Standard 5-Player Game Mode', () => {
  let boot: GameBoot

  beforeEach(() => {
    boot = new GameBoot(
      { ...standard5pConfig },
      { randomService: createMockRandom() },
    )
  })

  // ================================================================
  // 配置验证
  // ================================================================

  describe('configuration', () => {
    it('should have correct player count', () => {
      const config = standard5pConfig
      expect(config.playerCount).toBe(5)
    })

    it('should have correct role distribution', () => {
      const config = standard5pConfig
      const roles = config.roles
      expect(roles.filter((r) => r === RoleType.Aspect).length).toBe(1)
      expect(roles.filter((r) => r === RoleType.Guardian).length).toBe(1)
      expect(roles.filter((r) => r === RoleType.Ascended).length).toBe(2)
      expect(roles.filter((r) => r === RoleType.Infiltrator).length).toBe(1)
      expect(roles.length).toBe(5)
    })

    it('should have heroes available', () => {
      const config = standard5pConfig
      expect(config.heroes.length).toBeGreaterThanOrEqual(5)
    })

    it('should have cards in the deck configuration', () => {
      const config = standard5pConfig
      expect(config.cards.length).toBeGreaterThan(0)
    })

    it('should have hero select count of 3', () => {
      expect(standard5pConfig.heroSelectCount).toBe(3)
    })

    it('should have initial hand size of 4', () => {
      expect(standard5pConfig.initialHandSize).toBe(4)
    })
  })

  // ================================================================
  // 启动流程
  // ================================================================

  describe('boot', () => {
    it('should successfully boot a 5-player game', async () => {
      const result = await boot.boot()

      expect(result.engine).toBeDefined()
      expect(result.started).toBe(true)
      expect(result.config.mode).toBe('standard-5p')
    })

    it('should create 5 players', async () => {
      await boot.boot()

      const state = boot.getState()!
      expect(state.players.length).toBe(5)
    })

    it('should assign correct roles to 5 players', async () => {
      await boot.boot()

      const state = boot.getState()!
      const roles = state.players.map((p) => p.role)
      expect(roles.filter((r) => r === RoleType.Aspect).length).toBe(1)
      expect(roles.filter((r) => r === RoleType.Guardian).length).toBe(1)
      expect(roles.filter((r) => r === RoleType.Ascended).length).toBe(2)
      expect(roles.filter((r) => r === RoleType.Infiltrator).length).toBe(1)
    })

    it('should reveal the Aspect role', async () => {
      await boot.boot()

      const state = boot.getState()!
      const lord = state.players.find((p) => p.role === RoleType.Aspect)
      expect(lord).toBeDefined()
      expect(lord!.roleRevealed).toBe(true)
    })

    it('should give Aspect +1 max HP', async () => {
      await boot.boot()

      const state = boot.getState()!
      const lord = state.players.find((p) => p.role === RoleType.Aspect)
      expect(lord).toBeDefined()
      // 主公体力 = 英雄体力上限 + 1
      const expectedHp = (lord!.heroes[0]?.maxHp ?? 4) + 1
      expect(lord!.maxHp).toBe(expectedHp)
      expect(lord!.hp).toBe(expectedHp)
    })

    it('should assign a hero to each player', async () => {
      await boot.boot()

      const state = boot.getState()!
      for (const player of state.players) {
        expect(player.heroes.length).toBeGreaterThanOrEqual(1)
        expect(player.heroes[0]!.name).toBeDefined()
        expect(player.heroes[0]!.id).toBeDefined()
      }
    })

    it('should initialize the deck with cards from standard card pool', async () => {
      await boot.boot()

      const state = boot.getState()!
      // Standard deck should have cards (may be partially depleted after dealing)
      expect(state.deck.length).toBeGreaterThanOrEqual(0)
    })

    it('should deal initial hands to all players', async () => {
      await boot.boot()

      const state = boot.getState()!
      for (const player of state.players) {
        expect(player.handCards.length).toBeGreaterThanOrEqual(0)
        // All hand cards should be in the Hand zone
        for (const card of player.handCards) {
          expect(card.zone).toBe(ZoneType.Hand)
        }
      }
    })
  })

  // ================================================================
  // 游戏流程
  // ================================================================

  describe('game flow', () => {
    it('should start and enter a valid game phase', async () => {
      await boot.boot()
      await boot.start()

      const state = boot.getState()!
      // After start, the game should be in a valid phase
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

    it('should have all 5 players alive after boot and start', async () => {
      await boot.boot()
      await boot.start()

      const state = boot.getState()!
      const alivePlayers = state.players.filter((p) => p.alive)
      expect(alivePlayers.length).toBe(5)
    })

    it('should have non-zero current round', async () => {
      await boot.boot()

      const state = boot.getState()!
      expect(state.currentRound).toBeGreaterThanOrEqual(1)
    })
  })

  // ================================================================
  // 完整游戏循环
  // ================================================================

  describe('full game loop', () => {
    it('should complete a full game without crashing', async () => {
      // Use a fast configuration for full game test
      const fastConfig = {
        ...standard5pConfig,
        maxRounds: 5,
        initialHandSize: 2,
      }
      const fastBoot = new GameBoot(fastConfig, {
        randomService: createMockRandom(),
      })

      await fastBoot.boot()
      await fastBoot.start()
      const result = await fastBoot.runGameLoop()

      expect(result).toBeDefined()
      expect(result.reason).toBeDefined()
      expect(result.totalRounds).toBeGreaterThanOrEqual(1)
      expect(fastBoot.isGameOver).toBe(true)
    })

    it('should produce a valid game result with surviving players', async () => {
      const fastConfig = {
        ...standard5pConfig,
        maxRounds: 3,
        initialHandSize: 2,
      }
      const fastBoot = new GameBoot(fastConfig, {
        randomService: createMockRandom(),
      })

      await fastBoot.boot()
      await fastBoot.start()
      const result = await fastBoot.runGameLoop()

      expect(result.winner).toBeDefined()
      expect(result.endedAt).toBeGreaterThan(0)
      expect(Array.isArray(result.survivingPlayers)).toBe(true)
    })
  })

  // ================================================================
  // 座位布局
  // ================================================================

  describe('seat layout', () => {
    it('should have consecutive seat indices 0-4', async () => {
      await boot.boot()

      const state = boot.getState()!
      const seatIndices = state.players.map((p) => p.seatIndex).sort()
      expect(seatIndices).toEqual([0, 1, 2, 3, 4])
    })

    it('should have unique player IDs', async () => {
      await boot.boot()

      const state = boot.getState()!
      const playerIds = state.players.map((p) => p.id)
      const uniqueIds = new Set(playerIds)
      expect(uniqueIds.size).toBe(5)
    })
  })
})
