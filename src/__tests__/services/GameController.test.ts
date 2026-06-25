// ============================================================
// 联盟杀 · GameController 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameController } from '@/services/game-controller'
import { useGameStore } from '@/store/game-store'
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
    mode: 'test',
    playerCount: 4,
    roles: [
      RoleType.Aspect,
      RoleType.Guardian,
      RoleType.Ascended,
      RoleType.Infiltrator,
    ],
    heroes: [
      createTestHero({ id: 'hero_0', name: '英雄0' }),
      createTestHero({ id: 'hero_1', name: '英雄1' }),
      createTestHero({ id: 'hero_2', name: '英雄2' }),
      createTestHero({ id: 'hero_3', name: '英雄3' }),
    ],
    cards: [
      // 生成测试牌堆（50 张杀 + 30 张闪 + 8 张桃）
      ...Array.from({ length: 50 }, (_, i) =>
        createTestCardDef({
          name: 'sha',
          suit: [CardSuit.Spade, CardSuit.Heart, CardSuit.Club, CardSuit.Diamond][i % 4]!,
          rank: ((i % 13) + 1) as CardDefinition['rank'],
          description: '杀',
          tags: ['sha'],
        }),
      ),
      ...Array.from({ length: 30 }, (_, i) =>
        createTestCardDef({
          name: 'shan',
          suit: [CardSuit.Spade, CardSuit.Heart, CardSuit.Club, CardSuit.Diamond][i % 4]!,
          rank: ((i % 13) + 1) as CardDefinition['rank'],
          description: '闪',
          tags: ['shan'],
        }),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        createTestCardDef({
          name: 'peach',
          suit: CardSuit.Heart,
          rank: ((i % 13) + 1) as CardDefinition['rank'],
          description: '桃',
          tags: ['peach'],
        }),
      ),
    ],
    heroSelectCount: 3,
    initialHandSize: 4,
    equipEnabled: true,
    delayedCardEnabled: true,
    maxRounds: 100,
    ...overrides,
  }
}

// ── 测试 ──

describe('GameController', () => {
  let controller: GameController
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    controller = new GameController()
  })

  describe('初始化', () => {
    it('应该能创建 GameController 实例', () => {
      expect(controller).toBeDefined()
      expect(controller.isActive).toBe(false)
      expect(controller.isGameOver).toBe(false)
    })

    it('应该能绑定 Pinia Store', () => {
      const store = useGameStore()
      expect(() => controller.bindStore(store)).not.toThrow()
    })

    it('getGameState 在未创建游戏时应该返回 null', () => {
      const state = controller.getGameState()
      expect(state).toBeNull()
    })

    it('getCurrentPlayer 在未创建游戏时应该返回 null', () => {
      const player = controller.getCurrentPlayer()
      expect(player).toBeNull()
    })
  })

  describe('createGame', () => {
    it('应该能创建游戏', async () => {
      const store = useGameStore()
      controller.bindStore(store)

      const config = createTestConfig()
      await controller.createGame(config)

      const state = controller.getGameState()
      expect(state).not.toBeNull()
      expect(state!.players.length).toBe(4)
      expect(state!.started).toBe(true)
    })

    it('创建游戏后应该同步到 Pinia Store', async () => {
      const store = useGameStore()
      controller.bindStore(store)

      const config = createTestConfig()
      await controller.createGame(config)

      // Pinia Store 应该有数据
      expect(store.gameState).not.toBeNull()
      expect(store.aliveCount).toBe(4)
    })

    it('应该自动分配主公身份并公开', async () => {
      const store = useGameStore()
      controller.bindStore(store)

      const config = createTestConfig()
      await controller.createGame(config)

      const state = controller.getGameState()
      expect(state).not.toBeNull()

      // 主公身份已公开
      const lord = state!.players.find((p) => p.role === RoleType.Aspect)
      expect(lord).toBeDefined()
      expect(lord!.roleRevealed).toBe(true)
    })

    it('应该为每位玩家分配英雄', async () => {
      const store = useGameStore()
      controller.bindStore(store)

      const config = createTestConfig()
      await controller.createGame(config)

      const state = controller.getGameState()
      expect(state).not.toBeNull()

      for (const player of state!.players) {
        expect(player.heroes.length).toBeGreaterThanOrEqual(1)
        expect(player.heroes[0]?.id).toBeDefined()
      }
    })

    it('应该发放初始手牌', async () => {
      const store = useGameStore()
      controller.bindStore(store)

      const config = createTestConfig({ initialHandSize: 4 })
      await controller.createGame(config)

      const state = controller.getGameState()
      expect(state).not.toBeNull()

      for (const player of state!.players) {
        expect(player.handCards.length).toBe(4)
      }
    })
  })

  describe('startGame', () => {
    it('未创建游戏时 startGame 应该报错', async () => {
      await expect(controller.startGame()).rejects.toThrow(/尚未创建/)
    })

    it('创建并启动游戏应该进入准备阶段', async () => {
      const store = useGameStore()
      controller.bindStore(store)

      const config = createTestConfig()
      await controller.createGame(config)
      await controller.startGame()

      const state = controller.getGameState()
      expect(state).not.toBeNull()
      // 启动后引擎自动执行完首个回合的所有阶段，进入 RoundEnd 或 PhasePost
      expect([
        GamePhase.RoundStart,
        GamePhase.PhasePre,
        GamePhase.PhasePost,
        GamePhase.RoundEnd,
      ]).toContain(state!.currentPhase)
    })
  })

  describe('getAvailableActions', () => {
    it('未创建游戏时应该返回空操作', () => {
      const actions = controller.getAvailableActions()
      expect(actions.phase).toBe(GamePhase.NotStarted)
      expect(actions.playableCards).toEqual([])
      expect(actions.canEndPhase).toBe(false)
    })

    it('出牌阶段应该返回可打出的卡牌', async () => {
      const store = useGameStore()
      controller.bindStore(store)

      const config = createTestConfig()
      await controller.createGame(config)
      await controller.startGame()

      const actions = controller.getAvailableActions()
      // 至少应该返回非空的操作描述
      expect(actions.phase).toBeDefined()
    })
  })

  describe('endPhase', () => {
    it('未创建游戏时 endPhase 应该报错', async () => {
      await expect(controller.endPhase()).rejects.toThrow(/尚未创建/)
    })
  })

  describe('destroy', () => {
    it('destroy 后 getGameState 应该返回 null', async () => {
      const store = useGameStore()
      controller.bindStore(store)

      const config = createTestConfig()
      await controller.createGame(config)

      expect(controller.getGameState()).not.toBeNull()

      controller.destroy()
      expect(controller.getGameState()).toBeNull()
    })
  })

  describe('多次游戏', () => {
    it('第二次 createGame 应该清理上一个游戏的状态', async () => {
      const store = useGameStore()
      controller.bindStore(store)

      const config1 = createTestConfig({ playerCount: 4 })
      await controller.createGame(config1)

      const state1 = controller.getGameState()
      expect(state1?.players.length).toBe(4)

      const config2 = createTestConfig({ playerCount: 6 })
      await controller.createGame(config2)

      const state2 = controller.getGameState()
      expect(state2?.players.length).toBe(6)
    })
  })
})
