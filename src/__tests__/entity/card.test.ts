// ============================================================
// Card 实体 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { Card } from '@core/entity/card'
import type { CardDefinition } from '@core/contracts/card.interface'
import { CardType, CardSuit, ZoneType, EquipSlot } from '@core/contracts/enums'
import { Player } from '@core/entity/player'

// ── 测试辅助 ──

function createTestDef(overrides?: Partial<CardDefinition>): CardDefinition {
  return {
    name: '测试卡牌',
    type: CardType.Basic,
    suit: CardSuit.Spade,
    rank: 1,
    description: '测试用卡牌',
    tags: ['test', 'basic'],
    effectIds: ['test_effect'],
    isDelayed: false,
    canBeCanceled: false,
    ...overrides,
  }
}

function createTestPlayer(id: string = 'p1', seat: number = 0): Player {
  return new Player({ id, seatIndex: seat })
}

// ── 测试套件 ──

describe('Card', () => {
  beforeEach(() => {
    Card.resetCounter()
  })

  // ================================================================
  // 创建
  // ================================================================

  describe('create', () => {
    it('should create a Card from CardDefinition', () => {
      const def = createTestDef()
      const card = Card.create(def)

      expect(card).toBeInstanceOf(Card)
      expect(card.name).toBe('测试卡牌')
      expect(card.type).toBe(CardType.Basic)
      expect(card.suit).toBe(CardSuit.Spade)
      expect(card.rank).toBe(1)
      expect(card.description).toBe('测试用卡牌')
    })

    it('should generate a unique instance ID', () => {
      const def = createTestDef()
      const card1 = Card.create(def)
      const card2 = Card.create(def)

      expect(card1.id).not.toBe(card2.id)
      expect(card1.id).toContain('测试卡牌')
    })

    it('should accept a custom instance ID', () => {
      const def = createTestDef()
      const card = Card.create(def, 'custom_id_001')

      expect(card.id).toBe('custom_id_001')
    })

    it('should initialize runtime fields to defaults', () => {
      const def = createTestDef()
      const card = Card.create(def)

      expect(card.owner).toBeUndefined()
      expect(card.zone).toBe(ZoneType.Deck)
      expect(card.visibleTo).toEqual([])
      expect(card.virtual).toBe(false)
    })

    it('should convert tags array to Set', () => {
      const def = createTestDef({ tags: ['sha', 'attack'] })
      const card = Card.create(def)

      expect(card.tags).toBeInstanceOf(Set)
      expect(card.tags.has('sha')).toBe(true)
      expect(card.tags.has('attack')).toBe(true)
    })

    it('should copy effectIds array', () => {
      const def = createTestDef({ effectIds: ['eff1', 'eff2'] })
      const card = Card.create(def)

      expect(card.effectIds).toEqual(['eff1', 'eff2'])
      // Should be a different array reference
      expect(card.effectIds).not.toBe(def.effectIds)
    })

    it('should create an equip card with slot and attack range', () => {
      const def = createTestDef({
        name: '诸葛连弩',
        type: CardType.Equip,
        equipSlot: EquipSlot.Weapon,
        attackRange: 1,
      })
      const card = Card.create(def)

      expect(card.equipSlot).toBe(EquipSlot.Weapon)
      expect(card.attackRange).toBe(1)
    })

    it('should create a delayed rune card', () => {
      const def = createTestDef({
        name: '闪电',
        type: CardType.Rune,
        isDelayed: true,
        canBeCanceled: true,
      })
      const card = Card.create(def)

      expect(card.isDelayed).toBe(true)
      expect(card.canBeCanceled).toBe(true)
    })
  })

  describe('createInZone', () => {
    it('should create card in specified zone', () => {
      const def = createTestDef()
      const card = Card.createInZone(def, ZoneType.Hand)

      expect(card.zone).toBe(ZoneType.Hand)
    })
  })

  // ================================================================
  // 区域操作
  // ================================================================

  describe('moveTo', () => {
    it('should change zone', () => {
      const card = Card.create(createTestDef())
      card.moveTo(ZoneType.Hand)

      expect(card.zone).toBe(ZoneType.Hand)
    })

    it('should clear visibleTo when moved to Deck', () => {
      const player = createTestPlayer()
      const card = Card.create(createTestDef())
      card.visibleTo = [player]
      card.moveTo(ZoneType.Deck)

      expect(card.visibleTo).toEqual([])
    })

    it('should clear visibleTo when moved to Discard', () => {
      const player = createTestPlayer()
      const card = Card.create(createTestDef())
      card.visibleTo = [player]
      card.moveTo(ZoneType.Discard)

      expect(card.visibleTo).toEqual([])
    })

    it('should set visibleTo to owner only when moved to Hand', () => {
      const player = createTestPlayer()
      const card = Card.create(createTestDef())
      card.owner = player
      card.moveTo(ZoneType.Hand)

      expect(card.visibleTo).toEqual([player])
    })

    it('should set visibleTo to empty when moved to Hand without owner', () => {
      const card = Card.create(createTestDef())
      card.moveTo(ZoneType.Hand)

      expect(card.visibleTo).toEqual([])
    })

    it('should not clear visibleTo when moved to Equip', () => {
      const player = createTestPlayer()
      const card = Card.create(createTestDef())
      card.visibleTo = [player]
      card.moveTo(ZoneType.Equip)

      expect(card.visibleTo).toEqual([player])
    })
  })

  describe('moveToPlayer', () => {
    it('should set owner and move zone simultaneously', () => {
      const player = createTestPlayer()
      const card = Card.create(createTestDef())

      card.moveToPlayer(ZoneType.Hand, player)

      expect(card.owner).toBe(player)
      expect(card.zone).toBe(ZoneType.Hand)
      expect(card.visibleTo).toEqual([player])
    })
  })

  // ================================================================
  // 查询
  // ================================================================

  describe('hasTag', () => {
    it('should return true for existing tag', () => {
      const card = Card.create(createTestDef({ tags: ['sha', 'attack'] }))
      expect(card.hasTag('sha')).toBe(true)
      expect(card.hasTag('attack')).toBe(true)
    })

    it('should return false for non-existing tag', () => {
      const card = Card.create(createTestDef({ tags: ['sha'] }))
      expect(card.hasTag('shan')).toBe(false)
    })
  })

  describe('type checks', () => {
    it('should identify Basic cards', () => {
      const card = Card.create(createTestDef({ type: CardType.Basic }))
      expect(card.isBasic).toBe(true)
      expect(card.isEquip).toBe(false)
      expect(card.isRune).toBe(false)
    })

    it('should identify Equip cards', () => {
      const card = Card.create(createTestDef({ type: CardType.Equip, equipSlot: EquipSlot.Weapon }))
      expect(card.isEquip).toBe(true)
      expect(card.isBasic).toBe(false)
    })

    it('should identify Rune cards', () => {
      const card = Card.create(createTestDef({ type: CardType.Rune }))
      expect(card.isRune).toBe(true)
      expect(card.isBasic).toBe(false)
    })

    it('should identify delayed rune cards', () => {
      const card = Card.create(createTestDef({ type: CardType.Rune, isDelayed: true }))
      expect(card.isDelayedRune).toBe(true)

      const nonDelayed = Card.create(createTestDef({ type: CardType.Rune, isDelayed: false }))
      expect(nonDelayed.isDelayedRune).toBe(false)
    })
  })

  describe('isVisibleTo', () => {
    it('should return true when player is in visibleTo list', () => {
      const player = createTestPlayer()
      const card = Card.create(createTestDef())
      card.visibleTo = [player]

      expect(card.isVisibleTo(player)).toBe(true)
    })

    it('should return false when player is not in visibleTo list', () => {
      const player1 = createTestPlayer('p1', 0)
      const player2 = createTestPlayer('p2', 1)
      const card = Card.create(createTestDef())
      card.visibleTo = [player1]

      expect(card.isVisibleTo(player2)).toBe(false)
    })
  })

  describe('revealTo', () => {
    it('should update visibleTo list', () => {
      const player1 = createTestPlayer('p1', 0)
      const player2 = createTestPlayer('p2', 1)
      const card = Card.create(createTestDef())

      card.revealTo([player1, player2])

      expect(card.visibleTo).toEqual([player1, player2])
    })
  })

  // ================================================================
  // 基础属性不可变性
  // ================================================================

  describe('immutability', () => {
    it('should have readonly base properties', () => {
      const card = Card.create(createTestDef({ name: '杀' }))

      expect(card.name).toBe('杀')
      expect(card.id).toBeTruthy()
    })
  })

  // ================================================================
  // 序列化
  // ================================================================

  describe('toJSON', () => {
    it('should serialize tags as array', () => {
      const card = Card.create(createTestDef({ tags: ['sha', 'attack'] }))
      const json = card.toJSON()

      expect(Array.isArray(json.tags)).toBe(true)
      expect(json.tags).toContain('sha')
      expect(json.tags).toContain('attack')
    })

    it('should include all fields', () => {
      const card = Card.create(createTestDef())
      const json = card.toJSON()

      expect(json.id).toBe(card.id)
      expect(json.name).toBe(card.name)
      expect(json.type).toBe(card.type)
      expect(json.suit).toBe(card.suit)
      expect(json.rank).toBe(card.rank)
      expect(json.zone).toBe(card.zone)
      expect(json.virtual).toBe(card.virtual)
    })
  })

  // ================================================================
  // resetCounter
  // ================================================================

  describe('resetCounter', () => {
    it('should reset the instance counter', () => {
      const def = createTestDef()
      const card1 = Card.create(def)
      Card.resetCounter()
      const card2 = Card.create(def)

      // After reset, counter starts from 0, so IDs should have _0 suffix
      expect(card2.id).toContain('_0')
    })
  })
})
