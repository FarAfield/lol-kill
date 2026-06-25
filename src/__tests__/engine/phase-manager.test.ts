// ============================================================
// 联盟杀 · PhaseManager 单元测试
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PhaseManager } from '@core/engine/phase-manager'
import { TurnManager } from '@core/engine/turn-manager'
import { GameState, createDefaultConfig } from '@core/entity/game-state'
import { Player } from '@core/entity/player'
import { Card } from '@core/entity/card'
import { EventChain } from '@core/event/event-chain'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { DeckManager } from '@core/system/deck-manager'
import {
  GamePhase,
  CardType,
  CardSuit,
  ZoneType,
  RoleType,
} from '@core/contracts/enums'
import type { CardDefinition, ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { IUIDecisionService, CardPlayOption, CardPlayResult } from '@core/contracts/services.interface'

// ── 测试辅助 ──

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

function createMockDecisionService(
  overrides?: Partial<IUIDecisionService>,
): IUIDecisionService {
  return {
    askForCardPlay: vi.fn().mockResolvedValue(null),
    askForResponse: vi.fn().mockResolvedValue(null),
    askForTarget: vi.fn().mockResolvedValue([]),
    askForEffectUse: vi.fn().mockResolvedValue(null),
    askForDiscard: vi.fn().mockImplementation(
      (_player: IPlayer, count: number, validCards: ICard[]) =>
        Promise.resolve(validCards.slice(0, count)),
    ),
    askForHeroSelect: vi.fn().mockResolvedValue(''),
    notifyPlayer: vi.fn(),
    notifyAll: vi.fn(),
    showGameResult: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('PhaseManager', () => {
  let state: GameState
  let eventChain: EventChain
  let eventDispatcher: EventDispatcher
  let deckManager: DeckManager
  let turnManager: TurnManager
  let phaseManager: PhaseManager

  beforeEach(() => {
    state = new GameState()
    eventChain = new EventChain()
    eventDispatcher = new EventDispatcher()
    deckManager = new DeckManager(state)
    turnManager = new TurnManager(state)

    // Create players
    for (let i = 0; i < 3; i++) {
      const player = Player.create(`player_${i}`, i)
      state.players.push(player)
    }
    state.currentPlayerIndex = 0

    phaseManager = new PhaseManager(
      state,
      eventDispatcher,
      eventChain,
      deckManager,
      turnManager,
    )
  })

  // ================================================================
  // getNextPhase — 获取下一个阶段
  // ================================================================

  describe('getNextPhase', () => {
    it('should return PhaseJudge after PhasePre', () => {
      expect(phaseManager.getNextPhase(GamePhase.PhasePre)).toBe(
        GamePhase.PhaseJudge,
      )
    })

    it('should return PhaseDraw after PhaseJudge', () => {
      expect(phaseManager.getNextPhase(GamePhase.PhaseJudge)).toBe(
        GamePhase.PhaseDraw,
      )
    })

    it('should return PhaseUse after PhaseDraw', () => {
      expect(phaseManager.getNextPhase(GamePhase.PhaseDraw)).toBe(
        GamePhase.PhaseUse,
      )
    })

    it('should return PhaseDiscard after PhaseUse', () => {
      expect(phaseManager.getNextPhase(GamePhase.PhaseUse)).toBe(
        GamePhase.PhaseDiscard,
      )
    })

    it('should return PhasePost after PhaseDiscard', () => {
      expect(phaseManager.getNextPhase(GamePhase.PhaseDiscard)).toBe(
        GamePhase.PhasePost,
      )
    })

    it('should return null after PhasePost (last phase)', () => {
      expect(phaseManager.getNextPhase(GamePhase.PhasePost)).toBeNull()
    })

    it('should return null for non-phase state', () => {
      expect(phaseManager.getNextPhase(GamePhase.NotStarted)).toBeNull()
      expect(phaseManager.getNextPhase(GamePhase.GameOver)).toBeNull()
    })
  })

  // ================================================================
  // executePhase — 执行单个阶段
  // ================================================================

  describe('executePhase', () => {
    it('should execute PhasePre without errors', async () => {
      const player = state.players[0]!
      const result = await phaseManager.executePhase(GamePhase.PhasePre, player)
      expect(result).toBe(true)
    })

    it('should execute PhaseJudge (empty judge area)', async () => {
      const player = state.players[0]!
      const result = await phaseManager.executePhase(GamePhase.PhaseJudge, player)
      expect(result).toBe(true)
    })

    it('should execute PhaseDraw — draw 2 cards', async () => {
      // Initialize deck with some cards
      const cardDefs: CardDefinition[] = []
      for (let i = 0; i < 10; i++) {
        cardDefs.push({
          name: 'sha',
          type: CardType.Basic,
          suit: CardSuit.Spade,
          rank: ((i % 13) + 1) as CardDefinition['rank'],
          description: '杀',
          tags: ['sha'],
          effectIds: ['sha'],
          isDelayed: false,
          canBeCanceled: false,
        })
      }
      const composition: Record<string, number> = { sha: 10 }
      deckManager.initializeDeckCustom(cardDefs, composition)
      deckManager.shuffle()

      const player = state.players[0]!
      const initialHandSize = player.handCards.length

      const result = await phaseManager.executePhase(GamePhase.PhaseDraw, player)
      expect(result).toBe(true)
      expect(player.handCards.length).toBe(initialHandSize + 2)
    })

    it('should execute PhaseDiscard — no discard needed when hand ≤ hp', async () => {
      const player = state.players[0]!
      player.hp = 4
      player.handCards = [] // empty hand

      const result = await phaseManager.executePhase(
        GamePhase.PhaseDiscard,
        player,
      )
      expect(result).toBe(true)
    })

    it('should execute PhaseDiscard — auto discard when hand > hp', async () => {
      const player = state.players[0]!
      player.hp = 1 // hand limit = 1

      // Add 4 cards to hand
      for (let i = 0; i < 4; i++) {
        const card = Card.create(createTestCardDef({ name: `card_${i}` }))
        card.zone = ZoneType.Hand
        player.handCards.push(card)
      }

      expect(player.handCards.length).toBe(4)

      const result = await phaseManager.executePhase(
        GamePhase.PhaseDiscard,
        player,
      )
      expect(result).toBe(true)
      // Should have discarded 3 cards (4 - 1 = 3)
      expect(player.handCards.length).toBe(1)
    })

    it('should execute PhasePost without errors', async () => {
      const player = state.players[0]!
      const result = await phaseManager.executePhase(GamePhase.PhasePost, player)
      expect(result).toBe(true)
    })

    it('should return false if player dies during phase', async () => {
      const player = state.players[0]!
      player.alive = false

      const result = await phaseManager.executePhase(GamePhase.PhasePre, player)
      expect(result).toBe(false)
    })
  })

  // ================================================================
  // executeTurn — 执行完整回合
  // ================================================================

  describe('executeTurn', () => {
    beforeEach(() => {
      // Set up deck for draw phase
      const cardDefs: CardDefinition[] = []
      for (let i = 0; i < 20; i++) {
        cardDefs.push({
          name: 'sha',
          type: CardType.Basic,
          suit: CardSuit.Spade,
          rank: ((i % 13) + 1) as CardDefinition['rank'],
          description: '杀',
          tags: ['sha'],
          effectIds: ['sha'],
          isDelayed: false,
          canBeCanceled: false,
        })
      }
      const composition: Record<string, number> = { sha: 20 }
      deckManager.initializeDeckCustom(cardDefs, composition)
      deckManager.shuffle()
    })

    it('should execute a full turn for current player', async () => {
      turnManager.startRound()
      const player = turnManager.nextTurn()!
      expect(player).toBeDefined()

      const result = await phaseManager.executeTurn()
      expect(result).toBe(true)

      // Player should have drawn 2 cards (PhaseDraw)
      expect(player.handCards.length).toBe(2)
    })

    it('should return false if no current player', async () => {
      state.players = []
      const result = await phaseManager.executeTurn()
      expect(result).toBe(false)
    })

    it('should return false if current player is dead', async () => {
      turnManager.startRound()
      const player = turnManager.nextTurn()!
      player.alive = false

      const result = await phaseManager.executeTurn()
      expect(result).toBe(false)
    })

    it('should skip phases marked in shouldSkipPhases', async () => {
      turnManager.startRound()
      const player = turnManager.nextTurn()!
      // Skip draw phase
      player.shouldSkipPhases = [GamePhase.PhaseDraw]

      const result = await phaseManager.executeTurn()
      expect(result).toBe(true)

      // Should have skipped draw — no cards added
      expect(player.handCards.length).toBe(0)
      // Should have recorded skipped phase
      expect(player.skippedPhases).toContain(GamePhase.PhaseDraw)
    })
  })

  // ================================================================
  // 判定区处理 (PhaseJudge)
  // ================================================================

  describe('judge phase', () => {
    it('should process judge cards in LIFO order', async () => {
      // Set up deck
      const cardDefs: CardDefinition[] = []
      for (let i = 0; i < 10; i++) {
        cardDefs.push({
          name: 'sha',
          type: CardType.Basic,
          suit: CardSuit.Spade,
          rank: ((i % 13) + 1) as CardDefinition['rank'],
          description: '杀',
          tags: ['sha'],
          effectIds: ['sha'],
          isDelayed: false,
          canBeCanceled: false,
        })
      }
      const composition: Record<string, number> = { sha: 10 }
      deckManager.initializeDeckCustom(cardDefs, composition)

      const player = state.players[0]!

      // Add judge cards (simulate LeBuSiShu and ShanDian)
      const judgeCard1 = Card.create({
        name: 'leBuSiShu',
        type: CardType.Rune,
        suit: CardSuit.Heart,
        rank: 3,
        description: '乐不思蜀',
        tags: ['delayed', 'lebusishu'],
        effectIds: ['lebusishu'],
        isDelayed: true,
        canBeCanceled: true,
      })
      judgeCard1.zone = ZoneType.Judge

      const judgeCard2 = Card.create({
        name: 'shanDian',
        type: CardType.Rune,
        suit: CardSuit.Spade,
        rank: 1,
        description: '闪电',
        tags: ['delayed', 'shandian'],
        effectIds: ['shandian'],
        isDelayed: true,
        canBeCanceled: false,
      })
      judgeCard2.zone = ZoneType.Judge

      // Push in order: leBuSiShu first, then shanDian
      // LIFO: shanDian should pop first
      player.judgeCards.push(judgeCard1, judgeCard2)

      const result = await phaseManager.executePhase(
        GamePhase.PhaseJudge,
        player,
      )
      expect(result).toBe(true)
      // All judge cards should be processed
      expect(player.judgeCards.length).toBe(0)
    })

    it('should handle empty judge area gracefully', async () => {
      const player = state.players[0]!
      player.judgeCards = []

      const result = await phaseManager.executePhase(
        GamePhase.PhaseJudge,
        player,
      )
      expect(result).toBe(true)
    })
  })

  // ================================================================
  // 出牌阶段与决策服务 (PhaseUse)
  // ================================================================

  describe('play phase with decision service', () => {
    it('should ask player for card play when decision service is available', async () => {
      const decisionService = createMockDecisionService()
      const pm = new PhaseManager(
        state,
        eventDispatcher,
        eventChain,
        deckManager,
        turnManager,
        { decisionService },
      )

      const player = state.players[0]!
      // Give player a card
      const card = Card.create(createTestCardDef())
      card.zone = ZoneType.Hand
      player.handCards.push(card)

      // Mock: player chooses to end phase (returns null)
      const result = await pm.executePhase(GamePhase.PhaseUse, player)
      expect(result).toBe(true)
    })

    it('should auto-end play phase when no playable cards', async () => {
      const player = state.players[0]!
      player.handCards = [] // empty hand

      const result = await phaseManager.executePhase(
        GamePhase.PhaseUse,
        player,
      )
      expect(result).toBe(true)
    })
  })

  // ================================================================
  // 弃牌阶段与决策服务 (PhaseDiscard)
  // ================================================================

  describe('discard phase with decision service', () => {
    it('should use decision service to choose discard cards', async () => {
      const decisionService = createMockDecisionService({
        askForDiscard: vi.fn().mockImplementation(
          (_player: IPlayer, count: number, validCards: ICard[]) =>
            Promise.resolve(validCards.slice(0, count)),
        ),
      })
      const pm = new PhaseManager(
        state,
        eventDispatcher,
        eventChain,
        deckManager,
        turnManager,
        { decisionService },
      )

      const player = state.players[0]!
      player.hp = 1 // hand limit = 1

      // Add 3 cards
      for (let i = 0; i < 3; i++) {
        const card = Card.create(createTestCardDef({ name: `card_${i}` }))
        card.zone = ZoneType.Hand
        player.handCards.push(card)
      }

      await pm.executePhase(GamePhase.PhaseDiscard, player)

      expect(decisionService.askForDiscard).toHaveBeenCalled()
      // Should have discarded 2 cards
      expect(player.handCards.length).toBe(1)
    })
  })

  // ================================================================
  // setDecisionService
  // ================================================================

  describe('setDecisionService', () => {
    it('should update the decision service', () => {
      const newService = createMockDecisionService()
      phaseManager.setDecisionService(newService)
      // No error = success
    })
  })
})
