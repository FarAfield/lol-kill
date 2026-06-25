// ============================================================
// 联盟杀 · DeckManager 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { DeckManager } from '@core/system/deck-manager'
import { GameState } from '@core/entity/game-state'
import { Card } from '@core/entity/card'
import { CardType, CardSuit, ZoneType } from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'

// ── 测试用卡牌模板 ──

const shaDef: CardDefinition = {
  name: 'sha',
  type: CardType.Basic,
  suit: CardSuit.None,
  rank: 1,
  description: '杀',
  tags: ['sha'],
  effectIds: ['sha'],
  isDelayed: false,
  canBeCanceled: false,
}

const shanDef: CardDefinition = {
  name: 'shan',
  type: CardType.Basic,
  suit: CardSuit.None,
  rank: 1,
  description: '闪',
  tags: ['shan'],
  effectIds: ['shan'],
  isDelayed: false,
  canBeCanceled: false,
}

const taoDef: CardDefinition = {
  name: 'tao',
  type: CardType.Basic,
  suit: CardSuit.None,
  rank: 1,
  description: '桃',
  tags: ['tao'],
  effectIds: ['tao'],
  isDelayed: false,
  canBeCanceled: false,
}

// 自定义数量表
const testComposition: Record<string, number> = {
  sha: 5,
  shan: 3,
  tao: 2,
}

describe('DeckManager', () => {
  let state: GameState
  let manager: DeckManager

  beforeEach(() => {
    state = new GameState()
    manager = new DeckManager(state)
    Card.resetCounter()
  })

  describe('initializeDeck', () => {
    it('should create deck from card definitions and composition table', () => {
      manager.initializeDeckCustom([shaDef, shanDef, taoDef], testComposition)

      expect(state.deck.length).toBe(10) // 5 + 3 + 2
      expect(state.discardPile.length).toBe(0)

      const shaCards = state.deck.filter((c) => c.name === 'sha')
      expect(shaCards.length).toBe(5)

      const shanCards = state.deck.filter((c) => c.name === 'shan')
      expect(shanCards.length).toBe(3)

      const taoCards = state.deck.filter((c) => c.name === 'tao')
      expect(taoCards.length).toBe(2)
    })

    it('should set all cards zone to Deck', () => {
      manager.initializeDeckCustom([shaDef, shanDef, taoDef], testComposition)

      for (const card of state.deck) {
        expect(card.zone).toBe(ZoneType.Deck)
      }
    })
  })

  describe('shuffle', () => {
    it('should shuffle the deck', () => {
      manager.initializeDeckCustom([shaDef, shanDef, taoDef], testComposition)

      // Record initial order
      const initialIds = state.deck.map((c) => c.id)

      // Shuffle multiple times — should be different at least once
      let different = false
      for (let i = 0; i < 10; i++) {
        manager.shuffle()
        const newIds = state.deck.map((c) => c.id)
        if (JSON.stringify(initialIds) !== JSON.stringify(newIds)) {
          different = true
          break
        }
      }
      expect(different).toBe(true)
    })

    it('should preserve all cards after shuffle', () => {
      manager.initializeDeckCustom([shaDef, shanDef, taoDef], testComposition)

      const beforeCount = state.deck.length
      manager.shuffle()
      expect(state.deck.length).toBe(beforeCount)
    })
  })

  describe('draw', () => {
    beforeEach(() => {
      manager.initializeDeckCustom([shaDef, shanDef, taoDef], testComposition)
    })

    it('should draw the requested number of cards', () => {
      const drawn = manager.draw(3)
      expect(drawn.length).toBe(3)
      expect(state.deck.length).toBe(7) // 10 - 3
    })

    it('should set drawn cards zone to Hand', () => {
      const drawn = manager.draw(3)
      for (const card of drawn) {
        expect(card.zone).toBe(ZoneType.Hand)
      }
    })

    it('should draw from the top (LIFO: last drawn = top of deck)', () => {
      // The deck is initialized in order; card at highest index is top
      const topCard = state.deck[state.deck.length - 1]
      const drawn = manager.draw(1)
      expect(drawn[0]!.id).toBe(topCard!.id)
    })

    it('should return empty array when drawing from empty deck with no discard', () => {
      manager.draw(10) // Empty the deck
      expect(state.deck.length).toBe(0)

      const drawn = manager.draw(1)
      expect(drawn.length).toBe(0)
    })
  })

  describe('discard and recycle', () => {
    beforeEach(() => {
      manager.initializeDeckCustom([shaDef, shanDef, taoDef], testComposition)
    })

    it('should add cards to discard pile', () => {
      const cards = manager.draw(3)
      manager.discard(cards)
      expect(state.discardPile.length).toBe(3)
      for (const card of cards) {
        expect(card.zone).toBe(ZoneType.Discard)
      }
    })

    it('should recycle discard pile into deck when deck is empty', () => {
      // Draw all cards
      const allCards = manager.draw(10)
      expect(state.deck.length).toBe(0)

      // Discard 5 of them
      manager.discard(allCards.slice(0, 5))
      expect(state.discardPile.length).toBe(5)

      // Now recycle
      const success = manager.recycleDiscardPile()
      expect(success).toBe(true)
      expect(state.deck.length).toBe(5)
      expect(state.discardPile.length).toBe(0)

      // All recycled cards should be in Deck zone
      for (const card of state.deck) {
        expect(card.zone).toBe(ZoneType.Deck)
      }
    })

    it('should return false when recycling empty discard pile', () => {
      expect(state.discardPile.length).toBe(0)
      expect(manager.recycleDiscardPile()).toBe(false)
    })

    it('should auto-recycle when drawing from empty deck', () => {
      // Draw all cards
      const cards = manager.draw(10)
      // Discard some
      manager.discard(cards.slice(0, 3))

      // Draw remaining (should auto-recycle)
      const drawn = manager.draw(5)
      // Should have drawn at most 3 recycled + 0 remaining
      expect(drawn.length).toBeGreaterThan(0)
    })

    it('should discard a single card', () => {
      const [card] = manager.draw(1)
      manager.discardOne(card!)
      expect(state.discardPile.length).toBe(1)
    })
  })

  describe('drawForJudge', () => {
    beforeEach(() => {
      manager.initializeDeckCustom([shaDef, shanDef, taoDef], testComposition)
    })

    it('should draw a card for judgment', () => {
      const card = manager.drawForJudge()
      expect(card).not.toBeNull()
      expect(card!.zone).toBe(ZoneType.Processing)
      expect(state.deck.length).toBe(9)
    })

    it('should return null when no cards available', () => {
      manager.draw(10)
      const card = manager.drawForJudge()
      expect(card).toBeNull()
    })
  })

  describe('query methods', () => {
    beforeEach(() => {
      manager.initializeDeckCustom([shaDef, shanDef, taoDef], testComposition)
    })

    it('should report correct deck size', () => {
      expect(manager.deckSize).toBe(10)
      manager.draw(3)
      expect(manager.deckSize).toBe(7)
    })

    it('should report correct discard pile size', () => {
      expect(manager.discardPileSize).toBe(0)
      const cards = manager.draw(2)
      manager.discard(cards)
      expect(manager.discardPileSize).toBe(2)
    })

    it('should report correct total available cards', () => {
      expect(manager.totalAvailable).toBe(10)
      const cards = manager.draw(3)
      manager.discard(cards)
      expect(manager.totalAvailable).toBe(10) // 7 deck + 3 discard
    })

    it('should report isDeckEmpty correctly', () => {
      expect(manager.isDeckEmpty).toBe(false)
      manager.draw(10)
      expect(manager.isDeckEmpty).toBe(true)
    })
  })

  // ================================================================
  // 边界情况：牌堆耗尽与自动回收
  // ================================================================

  describe('edge cases: deck exhaustion', () => {
    it('should auto-recycle discard pile when deck is exhausted during draw', () => {
      // Initialize a small deck (5 sha)
      manager.initializeDeckCustom([shaDef], { sha: 5 })
      manager.shuffle()

      // Draw all 5 cards
      const drawn = manager.draw(5)
      expect(drawn).toHaveLength(5)
      expect(manager.deckSize).toBe(0)

      // Discard 3 of them
      manager.discard(drawn.slice(0, 3))
      expect(manager.discardPileSize).toBe(3)

      // Draw 2 more — triggers recycle (discard→deck, shuffle), then draw succeeds
      const moreDrawn = manager.draw(2)
      expect(moreDrawn).toHaveLength(2)
      expect(manager.deckSize).toBe(1) // 3 recycled - 2 drawn = 1 remaining
    })

    it('should handle draw when both deck and discard are empty', () => {
      manager.initializeDeckCustom([shaDef], { sha: 2 })
      manager.shuffle()

      // Draw all cards
      manager.draw(2)
      expect(manager.deckSize).toBe(0)

      // No discard pile to recycle → draw should return empty array
      const drawn = manager.draw(3)
      expect(drawn.length).toBe(0)
    })

    it('should recycle during drawForJudge when deck is empty', () => {
      manager.initializeDeckCustom([shaDef], { sha: 2 })

      // Draw all cards
      manager.draw(2)
      expect(manager.deckSize).toBe(0)

      // Put one card into discard for recycling
      const card = Card.create(shaDef)
      manager.discardOne(card)
      expect(manager.discardPileSize).toBe(1)

      // drawForJudge should trigger recycle and succeed
      const judgeCard = manager.drawForJudge()
      expect(judgeCard).toBeDefined()
      expect(manager.deckSize).toBe(0) // recycled 1, drew 1
    })
  })
})
