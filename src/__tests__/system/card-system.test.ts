// ============================================================
// 联盟杀 · CardSystem 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { CardSystem } from '@core/system/card-system'
import { GameState } from '@core/entity/game-state'
import { Player } from '@core/entity/player'
import { Card } from '@core/entity/card'
import { Hero } from '@core/entity/hero'
import { CardType, CardSuit, ZoneType, EquipSlot, Kingdom } from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'

// ── 测试用数据 ──

const basicCardDef: CardDefinition = {
  name: 'sha',
  type: CardType.Basic,
  suit: CardSuit.Spade,
  rank: 1,
  description: '杀',
  tags: ['sha'],
  effectIds: ['sha'],
  isDelayed: false,
  canBeCanceled: false,
}

const equipCardDef: CardDefinition = {
  name: 'zhuGeLianNu',
  type: CardType.Equip,
  suit: CardSuit.Spade,
  rank: 1,
  description: '诸葛连弩',
  tags: ['weapon'],
  effectIds: ['zhugeliannu'],
  equipSlot: EquipSlot.Weapon,
  attackRange: 2,
  isDelayed: false,
  canBeCanceled: false,
}

const delayedCardDef: CardDefinition = {
  name: 'leBuSiShu',
  type: CardType.Rune,
  suit: CardSuit.Heart,
  rank: 1,
  description: '乐不思蜀',
  tags: ['delayed', 'skip'],
  effectIds: ['lebushishu'],
  isDelayed: true,
  canBeCanceled: true,
}

const testHero = new Hero({
  id: 'test-hero',
  name: '测试英雄',
  title: '测试',
  kingdom: Kingdom.Demacia,
  maxHp: 4,
})

describe('CardSystem', () => {
  let state: GameState
  let system: CardSystem
  let player: Player

  beforeEach(() => {
    Card.resetCounter()
    state = new GameState()
    system = new CardSystem(state)

    player = Player.create('p1', 0, testHero)
    state.players = [player]
  })

  describe('moveCard', () => {
    it('should move card from Deck to Hand', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Deck
      state.deck.push(card)

      system.moveCard(card, ZoneType.Hand, player)

      expect(card.zone).toBe(ZoneType.Hand)
      expect(card.owner?.id).toBe(player.id)
      expect(player.handCards).toContain(card)
      expect(state.deck).not.toContain(card)
    })

    it('should move card from Hand to Discard', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Hand
      card.owner = player
      player.handCards.push(card)

      system.moveCard(card, ZoneType.Discard)

      expect(card.zone).toBe(ZoneType.Discard)
      expect(player.handCards).not.toContain(card)
      expect(state.discardPile).toContain(card)
    })

    it('should update visibility for Hand zone (only owner)', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Deck
      state.deck.push(card)

      system.moveCard(card, ZoneType.Hand, player)

      expect(card.visibleTo).toHaveLength(1)
      expect(card.visibleTo[0]!.id).toBe(player.id)
    })

    it('should update visibility for Equip zone (all players)', () => {
      const p2 = Player.create('p2', 1)
      state.players = [player, p2]

      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Deck
      state.deck.push(card)

      system.moveCard(card, ZoneType.Equip, player)

      expect(card.visibleTo.length).toBe(2)
    })
  })

  describe('useCard', () => {
    it('should move card from Hand to Processing', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Hand
      card.owner = player
      player.handCards.push(card)

      system.useCard(card, player)

      expect(card.zone).toBe(ZoneType.Processing)
      expect(player.handCards).not.toContain(card)
      expect(state.processingCards).toContain(card)
    })

    it('should throw if card is not in player hand', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Deck

      expect(() => system.useCard(card, player)).toThrow()
    })

    it('should throw if card belongs to another player', () => {
      const p2 = Player.create('p2', 1)
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Hand
      card.owner = p2

      expect(() => system.useCard(card, player)).toThrow()
    })
  })

  describe('discardCard', () => {
    it('should move card from Hand to Discard', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Hand
      card.owner = player
      player.handCards.push(card)

      system.discardCard(card, player)

      expect(card.zone).toBe(ZoneType.Discard)
      expect(player.handCards).not.toContain(card)
      expect(state.discardPile).toContain(card)
    })

    it('should discard multiple cards', () => {
      const card1 = Card.create(basicCardDef)
      const card2 = Card.create(basicCardDef)
      card1.zone = ZoneType.Hand
      card1.owner = player
      card2.zone = ZoneType.Hand
      card2.owner = player
      player.handCards = [card1, card2]

      system.discardCards([card1, card2], player)

      expect(player.handCards).toHaveLength(0)
      expect(state.discardPile).toHaveLength(2)
    })

    it('should throw if card is not owned by player', () => {
      const p2 = Player.create('p2', 1)
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Hand
      card.owner = p2

      expect(() => system.discardCard(card, player)).toThrow()
    })

    it('should throw if card is in Deck (cannot discard from deck)', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Deck

      expect(() => system.discardCard(card, player)).toThrow()
    })
  })

  describe('equipCard', () => {
    it('should move card from Hand to Equip', () => {
      const card = Card.create(equipCardDef)
      card.zone = ZoneType.Hand
      card.owner = player
      player.handCards.push(card)

      system.equipCard(card, player)

      expect(card.zone).toBe(ZoneType.Equip)
      expect(player.equipCards).toContain(card)
      expect(player.handCards).not.toContain(card)
    })

    it('should replace old equip in same slot', () => {
      const oldCard = Card.create(equipCardDef)
      oldCard.zone = ZoneType.Equip
      oldCard.owner = player
      player.equipCards.push(oldCard)

      const newCard = Card.create({
        ...equipCardDef,
        name: 'qingGangJian',
      })
      newCard.zone = ZoneType.Hand
      newCard.owner = player
      player.handCards.push(newCard)

      system.equipCard(newCard, player)

      expect(player.equipCards).toHaveLength(1)
      expect(player.equipCards[0]!.id).toBe(newCard.id)
      expect(state.discardPile).toHaveLength(1) // old equip discarded
    })

    it('should throw if non-equip card', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Hand
      card.owner = player
      player.handCards.push(card)

      expect(() => system.equipCard(card, player)).toThrow()
    })
  })

  describe('placeJudgeCard and finishJudge', () => {
    it('should place delayed card in judge area', () => {
      const card = Card.create(delayedCardDef)
      card.zone = ZoneType.Hand
      card.owner = player
      player.handCards.push(card)

      system.placeJudgeCard(card, player)

      expect(card.zone).toBe(ZoneType.Judge)
      expect(player.judgeCards).toContain(card)
      expect(player.handCards).not.toContain(card)
    })

    it('should throw if non-delayed card placed in judge area', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Hand
      card.owner = player

      expect(() => system.placeJudgeCard(card, player)).toThrow()
    })

    it('should finish judge and move to discard', () => {
      const card = Card.create(delayedCardDef)
      card.zone = ZoneType.Judge
      card.owner = player
      player.judgeCards.push(card)

      system.finishJudge(card, player)

      expect(card.zone).toBe(ZoneType.Discard)
      expect(player.judgeCards).not.toContain(card)
      expect(state.discardPile).toContain(card)
    })
  })

  describe('transferCard', () => {
    it('should transfer card from one player to another', () => {
      const p2 = Player.create('p2', 1)
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Hand
      card.owner = player
      player.handCards.push(card)

      system.transferCard(card, player, p2)

      expect(card.zone).toBe(ZoneType.Hand)
      expect(card.owner?.id).toBe(p2.id)
      expect(player.handCards).not.toContain(card)
      expect(p2.handCards).toContain(card)
    })

    it('should transfer multiple cards', () => {
      const p2 = Player.create('p2', 1)
      const card1 = Card.create(basicCardDef)
      const card2 = Card.create(basicCardDef)
      card1.zone = ZoneType.Hand
      card1.owner = player
      card2.zone = ZoneType.Hand
      card2.owner = player
      player.handCards = [card1, card2]

      system.transferCards([card1, card2], player, p2)

      expect(player.handCards).toHaveLength(0)
      expect(p2.handCards).toHaveLength(2)
    })
  })

  describe('obtainCard', () => {
    it('should move card to player hand', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Deck
      state.deck.push(card)

      system.obtainCard(card, player)

      expect(card.zone).toBe(ZoneType.Hand)
      expect(card.owner?.id).toBe(player.id)
      expect(player.handCards).toContain(card)
    })

    it('should obtain multiple cards', () => {
      const card1 = Card.create(basicCardDef)
      const card2 = Card.create(basicCardDef)
      card1.zone = ZoneType.Deck
      card2.zone = ZoneType.Deck

      system.obtainCards([card1, card2], player)

      expect(player.handCards).toHaveLength(2)
    })
  })

  describe('complete lifecycle', () => {
    it('Deck → Draw → Hand → Use → Processing → Discard', () => {
      const card = Card.create(basicCardDef)
      card.zone = ZoneType.Deck
      state.deck.push(card)

      // Deck → Hand
      system.moveCard(card, ZoneType.Hand, player)
      expect(card.zone).toBe(ZoneType.Hand)
      expect(player.handCards).toContain(card)

      // Hand → Processing (use)
      system.useCard(card, player)
      expect(card.zone).toBe(ZoneType.Processing)
      expect(state.processingCards).toContain(card)

      // Processing → Discard (finish)
      system.finishProcessing(card)
      expect(card.zone).toBe(ZoneType.Discard)
      expect(state.discardPile).toContain(card)
    })

    it('Deck → Draw → Hand → Equip', () => {
      const card = Card.create(equipCardDef)
      card.zone = ZoneType.Deck
      state.deck.push(card)

      system.moveCard(card, ZoneType.Hand, player)
      system.equipCard(card, player)

      expect(card.zone).toBe(ZoneType.Equip)
      expect(player.equipCards).toContain(card)
    })

    it('Hand → Judge → (判定结束) → Discard', () => {
      const card = Card.create(delayedCardDef)
      card.zone = ZoneType.Hand
      card.owner = player
      player.handCards.push(card)

      system.placeJudgeCard(card, player)
      expect(card.zone).toBe(ZoneType.Judge)

      system.finishJudge(card, player)
      expect(card.zone).toBe(ZoneType.Discard)
    })
  })
})
