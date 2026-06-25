// ============================================================
// 联盟杀 · TargetSystem 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { TargetSystem } from '@core/system/target-system'
import { Player } from '@core/entity/player'
import { Card } from '@core/entity/card'
import { Hero } from '@core/entity/hero'
import { GameState } from '@core/entity/game-state'
import { CardType, CardSuit, ZoneType, EquipSlot, Kingdom } from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'

// ── 创建英雄 ──
const testHero = new Hero({
  id: 'test-hero',
  name: '测试',
  title: '测试',
  kingdom: Kingdom.Demacia,
  maxHp: 4,
})

// ── 创建8人局玩家 ──
function create8Players(): Player[] {
  return Array.from({ length: 8 }, (_, i) => Player.create(`p${i}`, i, testHero))
}

// ── 卡牌工厂 ──
function createCard(def: Partial<CardDefinition> & { name: string; tags: string[] }): Card {
  return Card.create({
    type: CardType.Basic,
    suit: CardSuit.Spade,
    rank: 1,
    description: '',
    effectIds: [],
    isDelayed: false,
    canBeCanceled: false,
    ...def,
  })
}

describe('TargetSystem', () => {
  let state: GameState

  beforeEach(() => {
    Card.resetCounter()
    state = new GameState()
  })

  describe('getAvailableTargets — 杀', () => {
    it('should return adjacent players only (range 1)', () => {
      const players = create8Players()
      state.players = players

      const sha = createCard({ name: 'sha', tags: ['sha', 'attack'] })
      const targets = TargetSystem.getAvailableTargets(players[0]!, sha, state)

      // Only seat 1 and seat 7 are in range
      expect(targets).toHaveLength(2)
      expect(targets.map((p) => p.seatIndex).sort()).toEqual([1, 7])
    })

    it('should include more players with weapon', () => {
      const players = create8Players()
      state.players = players

      // Give player 0 a weapon with range 2
      const weaponDef: CardDefinition = {
        name: 'test-weapon',
        type: CardType.Equip,
        suit: CardSuit.Spade,
        rank: 1,
        description: '',
        tags: ['weapon'],
        effectIds: [],
        equipSlot: EquipSlot.Weapon,
        attackRange: 3,
        isDelayed: false,
        canBeCanceled: false,
      }
      const weapon = Card.create(weaponDef)
      weapon.zone = ZoneType.Equip
      players[0]!.equipCards.push(weapon)

      const sha = createCard({ name: 'sha', tags: ['sha', 'attack'] })
      const targets = TargetSystem.getAvailableTargets(players[0]!, sha, state)

      // Range = 1 + 3 = 4, should include seats 1,2,3,5,6,7
      expect(targets.length).toBeGreaterThan(2)
    })
  })

  describe('getAvailableTargets — 桃', () => {
    it('should target self when wounded', () => {
      const players = create8Players()
      state.players = players
      players[0]!.hp = 2 // wounded

      const tao = createCard({ name: 'tao', tags: ['tao', 'heal'] })
      const targets = TargetSystem.getAvailableTargets(players[0]!, tao, state)

      expect(targets).toHaveLength(1)
      expect(targets[0]!.id).toBe('p0')
    })

    it('should not target self when full HP', () => {
      const players = create8Players()
      state.players = players
      players[0]!.hp = 4 // full

      const tao = createCard({ name: 'tao', tags: ['tao', 'heal'] })
      const targets = TargetSystem.getAvailableTargets(players[0]!, tao, state)

      expect(targets).toHaveLength(0)
    })

    it('should target dying players', () => {
      const players = create8Players()
      state.players = players
      players[1]!.hp = 0 // dying
      players[0]!.hp = 4 // full hp (not wounded)

      const tao = createCard({ name: 'tao', tags: ['tao', 'heal'] })
      const targets = TargetSystem.getAvailableTargets(players[0]!, tao, state)

      // Should include the dying player (but not self since not wounded)
      expect(targets).toHaveLength(1)
      expect(targets[0]!.id).toBe('p1')
    })
  })

  describe('getAvailableTargets — 酒', () => {
    it('should only target self', () => {
      const players = create8Players()
      state.players = players

      const jiu = createCard({ name: 'jiu', tags: ['jiu', 'boost'] })
      const targets = TargetSystem.getAvailableTargets(players[0]!, jiu, state)

      expect(targets).toHaveLength(1)
      expect(targets[0]!.id).toBe('p0')
    })
  })

  describe('getAvailableTargets — 决斗', () => {
    it('should target any other player', () => {
      const players = create8Players()
      state.players = players

      const duel = createCard({ name: 'jueDou', tags: ['duel'] })
      const targets = TargetSystem.getAvailableTargets(players[0]!, duel, state)

      expect(targets).toHaveLength(7) // all others
      expect(targets.map((p) => p.id)).not.toContain('p0')
    })
  })

  describe('getAvailableTargets — AOE', () => {
    it('should target all other players regardless of distance', () => {
      const players = create8Players()
      state.players = players

      const aoe = createCard({ name: 'nanManRuQin', tags: ['aoe'] })
      const targets = TargetSystem.getAvailableTargets(players[0]!, aoe, state)

      expect(targets).toHaveLength(7)
    })
  })

  describe('validateTargets', () => {
    it('should validate legal target', () => {
      const players = create8Players()
      state.players = players

      const sha = createCard({ name: 'sha', tags: ['sha', 'attack'] })
      const result = TargetSystem.validateTargets(players[0]!, [players[1]!], sha, state)

      expect(result.valid).toBe(true)
    })

    it('should reject target out of range', () => {
      const players = create8Players()
      state.players = players

      const sha = createCard({ name: 'sha', tags: ['sha', 'attack'] })
      // Player at seat 4 is distance 4 away (base range is 1)
      const result = TargetSystem.validateTargets(players[0]!, [players[4]!], sha, state)

      expect(result.valid).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('should reject empty targets', () => {
      const players = create8Players()
      state.players = players

      const sha = createCard({ name: 'sha', tags: ['sha', 'attack'] })
      const result = TargetSystem.validateTargets(players[0]!, [], sha, state)

      expect(result.valid).toBe(false)
      expect(result.reason).toBe('未选择目标')
    })
  })
})
