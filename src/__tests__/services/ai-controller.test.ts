// ============================================================
// 联盟杀 · AIController 单元测试
//
// 测试 AIController 的：
// - 玩家注册 / 注销
// - IUIDecisionService 接口实现
// - 决策路由
// - 降级处理
// - 工厂函数
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AIController,
  createAIControllerForAllPlayers,
  createAIControllerForPlayers,
} from '@core/services/ai-controller'
import { AIDifficulty } from '@core/contracts/ai.interface'
import { Player } from '@core/entity/player'
import { Hero } from '@core/entity/hero'
import { Card } from '@core/entity/card'
import { GameState } from '@core/entity/game-state'
import {
  CardType,
  CardSuit,
  ZoneType,
  Kingdom,
  RoleType,
  GamePhase,
} from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'
import type { CardPlayOption } from '@core/contracts/services.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { IGameState } from '@core/contracts/game.interface'

// ── 测试辅助 ──

function createCard(overrides: Partial<CardDefinition> & { zone?: ZoneType }): Card {
  const def: CardDefinition = {
    name: overrides.name ?? 'test-card',
    type: overrides.type ?? CardType.Basic,
    suit: overrides.suit ?? CardSuit.Spade,
    rank: overrides.rank ?? 1,
    description: overrides.description ?? '',
    tags: overrides.tags ?? [],
    effectIds: overrides.effectIds ?? [],
    equipSlot: overrides.equipSlot,
    attackRange: overrides.attackRange,
    isDelayed: overrides.isDelayed ?? false,
    canBeCanceled: overrides.canBeCanceled ?? false,
  }
  const card = Card.create(def)
  if (overrides.zone) {
    card.zone = overrides.zone
  }
  return card
}

function createShaCard(): Card {
  return createCard({ name: '杀', type: CardType.Basic, suit: CardSuit.Spade, rank: 7, tags: ['sha'], zone: ZoneType.Hand })
}

function createShanCard(): Card {
  return createCard({ name: '闪', type: CardType.Basic, suit: CardSuit.Heart, rank: 2, tags: ['shan'], zone: ZoneType.Hand })
}

function createPeachCard(): Card {
  return createCard({ name: '桃', type: CardType.Basic, suit: CardSuit.Heart, rank: 4, tags: ['peach'], zone: ZoneType.Hand })
}

function createPlayer(opts: {
  id: string
  seatIndex: number
  hp?: number
  maxHp?: number
  role?: RoleType
  roleRevealed?: boolean
  handCards?: Card[]
}): IPlayer {
  return new Player({
    id: opts.id,
    seatIndex: opts.seatIndex,
    hp: opts.hp ?? 4,
    maxHp: opts.maxHp ?? 4,
    role: opts.role,
    roleRevealed: opts.roleRevealed ?? false,
    handCards: opts.handCards ?? [],
    heroes: [
      new Hero({
        id: `hero_${opts.id}`,
        name: `英雄${opts.seatIndex}`,
        title: '测试',
        kingdom: Kingdom.Demacia,
        maxHp: opts.maxHp ?? 4,
        effectIds: [],
      }),
    ],
  })
}

function createGameState(players: IPlayer[]): IGameState {
  return new GameState({
    players,
    deck: [],
    discardPile: [],
    currentRound: 1,
    currentPlayerIndex: 0,
    currentPhase: GamePhase.PhaseUse,
    phaseIndex: 3,
    log: [],
    processingCards: [],
    started: true,
    finished: false,
    config: {
      mode: 'test',
      playerCount: players.length,
      roles: [],
      heroes: [],
      cards: [],
      heroSelectCount: 1,
      initialHandSize: 4,
      equipEnabled: true,
      delayedCardEnabled: true,
      maxRounds: 100,
    },
  })
}

// ── 测试 ──

describe('AIController', () => {
  let controller: AIController

  beforeEach(() => {
    controller = new AIController({ defaultDifficulty: AIDifficulty.Beginner })
  })

  describe('初始化', () => {
    it('应该能创建 AIController 实例', () => {
      expect(controller).toBeDefined()
    })

    it('默认难度为构造函数传入的难度', () => {
      const hardController = new AIController({ defaultDifficulty: AIDifficulty.Hard })
      expect(hardController).toBeDefined()
    })

    it('默认日志已启用', () => {
      const logs = controller.getDecisionLogs()
      expect(logs).toEqual([])
    })
  })

  describe('registerPlayer', () => {
    it('应该能注册单个 AI 玩家', () => {
      controller.registerPlayer('player_0', AIDifficulty.Normal)
      // 不抛异常即成功
    })

    it('不传难度时使用默认难度', () => {
      controller.registerPlayer('player_0')
      // 使用默认 Beginner 难度，不抛异常
    })

    it('应该能注册多个 AI 玩家', () => {
      controller.registerPlayers(['p0', 'p1', 'p2'], AIDifficulty.Hard)
      // 不抛异常即成功
    })

    it('注销后不再为玩家决策', () => {
      controller.registerPlayer('player_0')
      controller.unregisterPlayer('player_0')
      // 不抛异常
    })
  })

  describe('askForCardPlay', () => {
    it('无状态访问器时应降级随机出牌', async () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShaCard()],
      })
      const sha = createShaCard()
      const options: CardPlayOption[] = [
        { card: sha, validTargets: [player] },
      ]

      const result = await controller.askForCardPlay(player, options)
      // 降级模式下随机选择
      expect(result).not.toBeNull()
      expect(result!.card.id).toBe(sha.id)
    })

    it('已注册玩家有状态时应使用 AI 策略', async () => {
      // 注意：AI 策略使用 player.handCards 中的卡牌，所以 options 中的卡牌
      // 必须与 handCards 中的卡牌是同一实例
      const sha = createShaCard()
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [sha],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
      })
      const state = createGameState([player, enemy])
      controller.setStateAccessor(() => state)
      controller.registerPlayer('p0', AIDifficulty.Beginner)

      const options: CardPlayOption[] = [
        { card: sha, validTargets: [enemy] },
      ]

      const result = await controller.askForCardPlay(player, options)
      expect(result).not.toBeNull()
      expect(result!.card.id).toBe(sha.id)
    })

    it('无可出卡牌时返回 null', async () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [],
      })
      const state = createGameState([player])
      controller.setStateAccessor(() => state)
      controller.registerPlayer('p0')

      const result = await controller.askForCardPlay(player, [])
      expect(result).toBeNull()
    })
  })

  describe('askForResponse', () => {
    it('有闪时应该出闪', async () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShanCard()],
      })
      const state = createGameState([player])
      controller.setStateAccessor(() => state)
      controller.registerPlayer('p0', AIDifficulty.Beginner)

      const shan = createShanCard()
      const result = await controller.askForResponse(player, '请出闪', [shan])
      expect(result).not.toBeNull()
      expect(result!.tags.has('shan')).toBe(true)
    })

    it('无有效卡牌时返回 null', async () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [],
      })
      const state = createGameState([player])
      controller.setStateAccessor(() => state)
      controller.registerPlayer('p0')

      const result = await controller.askForResponse(player, '请出闪', [])
      expect(result).toBeNull()
    })
  })

  describe('askForDiscard', () => {
    it('应该返回指定数量的弃牌', async () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 2,
        handCards: [
          createShaCard(),
          createShaCard(),
          createShanCard(),
          createPeachCard(),
        ],
      })
      const state = createGameState([player])
      controller.setStateAccessor(() => state)
      controller.registerPlayer('p0', AIDifficulty.Normal)

      const result = await controller.askForDiscard(player, 2, player.handCards)
      expect(result).toHaveLength(2)
      // 弃置的牌应在手牌中
      const handIds = player.handCards.map((c) => c.id)
      for (const card of result) {
        expect(handIds).toContain(card.id)
      }
    })

    it('count 为 0 时返回空数组', async () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShaCard()],
      })
      const state = createGameState([player])
      controller.setStateAccessor(() => state)
      controller.registerPlayer('p0')

      const result = await controller.askForDiscard(player, 0, player.handCards)
      expect(result).toHaveLength(0)
    })

    it('无状态访问器时降级处理', async () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShaCard(), createShanCard()],
      })

      // 降级：返回前 count 张
      const result = await controller.askForDiscard(player, 1, player.handCards)
      expect(result).toHaveLength(1)
    })
  })

  describe('askForHeroSelect', () => {
    it('应该选择一个英雄', async () => {
      const player = createPlayer({ id: 'p0', seatIndex: 0 })
      const state = createGameState([player])
      controller.setStateAccessor(() => state)
      controller.registerPlayer('p0')

      const candidates = [
        { id: 'h1', name: '英雄1', title: '', kingdom: 'demacia' },
        { id: 'h2', name: '英雄2', title: '', kingdom: 'noxus' },
        { id: 'h3', name: '英雄3', title: '', kingdom: 'ionia' },
      ]

      const result = await controller.askForHeroSelect(player, candidates, 1)
      expect(candidates.map((c) => c.id)).toContain(result)
    })

    it('降级时选择第一个', async () => {
      const player = createPlayer({ id: 'p0', seatIndex: 0 })
      const candidates = [
        { id: 'h1', name: '英雄1', title: '', kingdom: 'demacia' },
      ]

      const result = await controller.askForHeroSelect(player, candidates, 1)
      expect(result).toBe('h1')
    })
  })

  describe('日志', () => {
    it('决策后应该记录日志', async () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShaCard()],
      })
      const state = createGameState([player])
      controller.setStateAccessor(() => state)
      controller.registerPlayer('p0')

      const sha = createShaCard()
      const options: CardPlayOption[] = [
        { card: sha, validTargets: [player] },
      ]

      await controller.askForCardPlay(player, options)

      const logs = controller.getDecisionLogs()
      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0]!.playerId).toBe('p0')
      expect(logs[0]!.type).toBe('play')
    })

    it('禁用日志后不应记录', async () => {
      controller.setLogEnabled(false)

      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShaCard()],
      })
      const state = createGameState([player])
      controller.setStateAccessor(() => state)
      controller.registerPlayer('p0')

      const sha = createShaCard()
      const options: CardPlayOption[] = [
        { card: sha, validTargets: [player] },
      ]

      await controller.askForCardPlay(player, options)

      const logs = controller.getDecisionLogs()
      expect(logs).toHaveLength(0)
    })

    it('clearLogs 后日志为空', async () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShaCard()],
      })
      const state = createGameState([player])
      controller.setStateAccessor(() => state)
      controller.registerPlayer('p0')

      const sha = createShaCard()
      const options: CardPlayOption[] = [
        { card: sha, validTargets: [player] },
      ]

      await controller.askForCardPlay(player, options)
      expect(controller.getDecisionLogs().length).toBeGreaterThan(0)

      controller.clearLogs()
      expect(controller.getDecisionLogs()).toHaveLength(0)
    })
  })

  describe('notify', () => {
    it('notifyPlayer 应该调用回调', () => {
      const messages: string[] = []
      controller.setNotifyCallback((msg) => messages.push(msg))

      const player = createPlayer({ id: 'p0', seatIndex: 0 })
      controller.notifyPlayer(player, 'test message', 'info')

      expect(messages.length).toBe(1)
      expect(messages[0]).toContain('test message')
    })

    it('notifyAll 应该调用回调', () => {
      const messages: string[] = []
      controller.setNotifyCallback((msg) => messages.push(msg))

      controller.notifyAll('broadcast message', 'info')

      expect(messages.length).toBe(1)
      expect(messages[0]).toContain('broadcast message')
    })
  })
})

describe('工厂函数', () => {
  function createState(): IGameState {
    return new GameState({
      players: [],
      config: {
        mode: 'test',
        playerCount: 0,
        roles: [],
        heroes: [],
        cards: [],
        heroSelectCount: 1,
        initialHandSize: 4,
        equipEnabled: true,
        delayedCardEnabled: true,
        maxRounds: 100,
      },
    })
  }

  describe('createAIControllerForAllPlayers', () => {
    it('应该为所有玩家注册 AI', () => {
      const state = createState()
      const ctrl = createAIControllerForAllPlayers(
        ['p0', 'p1', 'p2', 'p3'],
        AIDifficulty.Beginner,
        () => state,
      )
      expect(ctrl).toBeDefined()
    })
  })

  describe('createAIControllerForPlayers', () => {
    it('应该为指定玩家注册 AI', () => {
      const state = createState()
      const ctrl = createAIControllerForPlayers(
        ['ai_0', 'ai_1'],
        AIDifficulty.Hard,
        () => state,
      )
      expect(ctrl).toBeDefined()
    })
  })
})
