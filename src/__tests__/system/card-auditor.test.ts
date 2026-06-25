// ============================================================
// 联盟杀 · CardAuditor 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { CardAuditor } from '@core/system/card-auditor'
import { GameState } from '@core/entity/game-state'
import { Card, type CardDefinition } from '@core/entity/card'
import { CardType, CardSuit } from '@core/contracts/enums'

// ── 工厂 ──

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

describe('CardAuditor', () => {
  beforeEach(() => {
    Card.resetCounter()
  })

  describe('verify — clean state', () => {
    it('should pass for an empty state', () => {
      const state = new GameState()
      const result = CardAuditor.verify(state)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.totalCards).toBe(0)
    })

    it('should pass for a state with cards only in deck', () => {
      const state = new GameState()
      state.deck = [
        Card.create(createTestCardDef({ name: 'sha' })),
        Card.create(createTestCardDef({ name: 'shan', tags: ['shan'] })),
        Card.create(createTestCardDef({ name: 'tao', tags: ['tao'] })),
      ]

      const result = CardAuditor.verify(state)
      expect(result.valid).toBe(true)
      expect(result.counts.deck).toBe(3)
      expect(result.totalCards).toBe(3)
    })

    it('should pass with cards spread across multiple zones', () => {
      const state = new GameState()
      state.deck = [
        Card.create(createTestCardDef({ name: 'sha' })),
        Card.create(createTestCardDef({ name: 'shan', tags: ['shan'] })),
      ]
      state.discardPile = [
        Card.create(createTestCardDef({ name: 'tao', tags: ['tao'] })),
      ]

      const result = CardAuditor.verify(state)
      expect(result.valid).toBe(true)
      expect(result.counts.deck).toBe(2)
      expect(result.counts.discard).toBe(1)
      expect(result.totalCards).toBe(3)
    })
  })

  describe('verify — duplicate detection', () => {
    it('should detect duplicate card in deck and discard', () => {
      const state = new GameState()
      const card = Card.create(createTestCardDef({ name: 'sha' }))
      state.deck = [card]
      state.discardPile = [card] // same card object in two places

      const result = CardAuditor.verify(state)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('重复'))).toBe(true)
    })

    it('should detect duplicate card across two players', () => {
      const state = new GameState()
      const card = Card.create(createTestCardDef({ name: 'sha' }))
      // Mock player-like objects
      const player1 = {
        id: 'p0',
        handCards: [card],
        equipCards: [],
        judgeCards: [],
      } as any
      const player2 = {
        id: 'p1',
        handCards: [card], // same card
        equipCards: [],
        judgeCards: [],
      } as any
      state.players = [player1, player2]

      const result = CardAuditor.verify(state)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('重复'))).toBe(true)
    })
  })

  describe('verify — expected total', () => {
    it('should pass when total matches expected', () => {
      const state = new GameState()
      state.deck = [
        Card.create(createTestCardDef({ name: 'sha' })),
        Card.create(createTestCardDef({ name: 'shan', tags: ['shan'] })),
      ]

      const result = CardAuditor.verify(state, 2)
      expect(result.valid).toBe(true)
    })

    it('should fail when total exceeds expected', () => {
      const state = new GameState()
      state.deck = [
        Card.create(createTestCardDef({ name: 'sha' })),
        Card.create(createTestCardDef({ name: 'shan', tags: ['shan'] })),
        Card.create(createTestCardDef({ name: 'tao', tags: ['tao'] })),
      ]

      const result = CardAuditor.verify(state, 2)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('多出'))).toBe(true)
    })

    it('should fail when total is below expected', () => {
      const state = new GameState()
      state.deck = [
        Card.create(createTestCardDef({ name: 'sha' })),
      ]

      const result = CardAuditor.verify(state, 3)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('缺少'))).toBe(true)
    })
  })

  describe('verify — warnings', () => {
    it('should warn when deck and discard are both empty but cards exist elsewhere', () => {
      const state = new GameState()
      const card = Card.create(createTestCardDef({ name: 'sha' }))
      state.deck = []
      state.discardPile = []
      state.processingCards = [card]

      const result = CardAuditor.verify(state)
      // No errors (no duplicates), but warnings about empty draw sources
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some((w) => w.includes('牌堆和弃牌堆均为空'))).toBe(true)
    })
  })

  describe('checkDuplicates', () => {
    it('should return only duplicate errors', () => {
      const state = new GameState()
      const card = Card.create(createTestCardDef({ name: 'sha' }))
      state.deck = [card]
      state.discardPile = [card]

      const duplicates = CardAuditor.checkDuplicates(state)
      expect(duplicates.length).toBeGreaterThan(0)
      expect(duplicates.every((e) => e.includes('重复'))).toBe(true)
    })

    it('should return empty array for clean state', () => {
      const state = new GameState()
      state.deck = [Card.create(createTestCardDef({ name: 'sha' }))]

      const duplicates = CardAuditor.checkDuplicates(state)
      expect(duplicates).toHaveLength(0)
    })
  })

  describe('getCardCounts', () => {
    it('should return correct zone counts', () => {
      const state = new GameState()
      state.deck = [
        Card.create(createTestCardDef({ name: 'sha' })),
        Card.create(createTestCardDef({ name: 'sha' })),
        Card.create(createTestCardDef({ name: 'sha' })),
      ]
      state.discardPile = [
        Card.create(createTestCardDef({ name: 'shan', tags: ['shan'] })),
      ]

      const counts = CardAuditor.getCardCounts(state)
      expect(counts.deck).toBe(3)
      expect(counts.discard).toBe(1)
    })
  })
})
