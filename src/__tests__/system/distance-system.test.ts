// ============================================================
// 联盟杀 · DistanceSystem 单元测试
// ============================================================

import { describe, it, expect } from 'vitest'
import { DistanceSystem } from '@core/system/distance-system'
import { Player } from '@core/entity/player'
import { Card } from '@core/entity/card'
import { EquipSlot, ZoneType, CardType, CardSuit } from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'

// ── 创建测试玩家 ──

function createPlayers(count: number): Player[] {
  const players: Player[] = []
  for (let i = 0; i < count; i++) {
    players.push(Player.create(`p${i}`, i))
  }
  return players
}

// ── 创建装备卡 ──

function createEquip(slot: EquipSlot, attackRange?: number): ReturnType<typeof Card.create> {
  const def: CardDefinition = {
    name: `test-${slot}`,
    type: CardType.Equip,
    suit: CardSuit.Spade,
    rank: 1,
    description: 'test',
    tags: ['equip'],
    effectIds: ['test'],
    equipSlot: slot,
    attackRange: attackRange ?? 0,
    isDelayed: false,
    canBeCanceled: false,
  }
  const card = Card.create(def)
  card.zone = ZoneType.Equip
  return card
}

describe('DistanceSystem', () => {
  describe('getSeatDistance', () => {
    it('should return 0 for same player', () => {
      const players = createPlayers(8)
      expect(DistanceSystem.getSeatDistance(players[0]!, players[0]!, players)).toBe(0)
    })

    it('should return 1 for adjacent seats', () => {
      const players = createPlayers(8)
      expect(DistanceSystem.getSeatDistance(players[0]!, players[1]!, players)).toBe(1)
      expect(DistanceSystem.getSeatDistance(players[1]!, players[0]!, players)).toBe(1)
    })

    it('should return 1 for circular adjacent (seat 0 and last seat)', () => {
      const players = createPlayers(8)
      expect(DistanceSystem.getSeatDistance(players[0]!, players[7]!, players)).toBe(1)
    })

    it('should return 2 for 2 seats apart', () => {
      const players = createPlayers(8)
      expect(DistanceSystem.getSeatDistance(players[0]!, players[2]!, players)).toBe(2)
      expect(DistanceSystem.getSeatDistance(players[2]!, players[0]!, players)).toBe(2)
    })

    it('should return 4 for opposite seats in 8-player game', () => {
      const players = createPlayers(8)
      expect(DistanceSystem.getSeatDistance(players[0]!, players[4]!, players)).toBe(4)
    })

    it('should return 2 for opposite seats in 4-player game', () => {
      const players = createPlayers(4)
      expect(DistanceSystem.getSeatDistance(players[0]!, players[2]!, players)).toBe(2)
    })

    it('should handle 5-player game correctly', () => {
      const players = createPlayers(5)
      // 0 → 1 = 1
      expect(DistanceSystem.getSeatDistance(players[0]!, players[1]!, players)).toBe(1)
      // 0 → 3 = min(3, 2) = 2
      expect(DistanceSystem.getSeatDistance(players[0]!, players[3]!, players)).toBe(2)
      // 0 → 4 = min(4, 1) = 1
      expect(DistanceSystem.getSeatDistance(players[0]!, players[4]!, players)).toBe(1)
    })
  })

  describe('getDistance', () => {
    it('should be the same as seat distance without modifiers', () => {
      const players = createPlayers(8)
      const dist = DistanceSystem.getDistance(players[0]!, players[2]!, players)
      expect(dist).toBe(2)
    })

    it('should reduce distance with offensive horse (-1 horse)', () => {
      const players = createPlayers(8)
      // Give player 0 an offensive horse
      const horse = createEquip(EquipSlot.OffensiveHorse)
      players[0]!.equipCards.push(horse)

      // Seat distance from 0 to 2 = 2, with -1 horse = 1
      const dist = DistanceSystem.getDistance(players[0]!, players[2]!, players)
      expect(dist).toBe(1)
    })

    it('should increase distance with defensive horse (+1 horse)', () => {
      const players = createPlayers(8)
      // Give player 1 a defensive horse
      const horse = createEquip(EquipSlot.DefensiveHorse)
      players[1]!.equipCards.push(horse)

      // Seat distance from 0 to 1 = 1, with +1 horse on target = 2
      const dist = DistanceSystem.getDistance(players[0]!, players[1]!, players)
      expect(dist).toBe(2)
    })

    it('should not reduce distance below 1 (except self)', () => {
      const players = createPlayers(8)
      // Give player 0 an offensive horse
      const horse = createEquip(EquipSlot.OffensiveHorse)
      players[0]!.equipCards.push(horse)

      // Adjacent player is already distance 1, -1 should still be 1
      const dist = DistanceSystem.getDistance(players[0]!, players[1]!, players)
      expect(dist).toBe(1)
    })

    it('should consider distance modifier marks', () => {
      const players = createPlayers(8)
      // Skill that reduces distance by 1
      players[0]!.setMark('distanceModifier', -1)

      const dist = DistanceSystem.getDistance(players[0]!, players[2]!, players)
      expect(dist).toBe(1) // 2 - 1 = 1
    })

    it('should consider distance defense modifier marks', () => {
      const players = createPlayers(8)
      players[1]!.setMark('distanceDefenseModifier', 1)

      const dist = DistanceSystem.getDistance(players[0]!, players[1]!, players)
      expect(dist).toBe(2) // 1 + 1 = 2
    })
  })

  describe('getAttackRange', () => {
    it('should return 1 for player without weapon', () => {
      const players = createPlayers(1)
      expect(DistanceSystem.getAttackRange(players[0]!)).toBe(1)
    })

    it('should return weapon attackRange + 1', () => {
      const players = createPlayers(1)
      const weapon = createEquip(EquipSlot.Weapon, 2) // range 2 weapon
      players[0]!.equipCards.push(weapon)

      expect(DistanceSystem.getAttackRange(players[0]!)).toBe(3) // 1 base + 2 weapon
    })

    it('should only count equipped weapons (zone === Equip)', () => {
      const players = createPlayers(1)
      const weapon = createEquip(EquipSlot.Weapon, 3)
      weapon.zone = ZoneType.Hand // In hand, not equipped
      players[0]!.handCards.push(weapon)

      expect(DistanceSystem.getAttackRange(players[0]!)).toBe(1) // base only
    })
  })

  describe('isInRange', () => {
    it('adjacent player should be in range (range=1)', () => {
      const players = createPlayers(8)
      expect(DistanceSystem.isInRange(players[0]!, players[1]!, players)).toBe(true)
    })

    it('player 2 seats away should be out of range (range=1)', () => {
      const players = createPlayers(8)
      expect(DistanceSystem.isInRange(players[0]!, players[2]!, players)).toBe(false)
    })

    it('player 2 seats away should be in range with weapon', () => {
      const players = createPlayers(8)
      const weapon = createEquip(EquipSlot.Weapon, 2)
      players[0]!.equipCards.push(weapon)

      expect(DistanceSystem.isInRange(players[0]!, players[2]!, players)).toBe(true)
    })

    it('cannot target self', () => {
      const players = createPlayers(8)
      expect(DistanceSystem.isInRange(players[0]!, players[0]!, players)).toBe(false)
    })
  })

  describe('getPlayersInRange', () => {
    it('should return all players in range', () => {
      const players = createPlayers(8)
      // Player 0 with base range 1
      const inRange = DistanceSystem.getPlayersInRange(players[0]!, players)
      // Adjacent: seat 1 and seat 7
      expect(inRange).toHaveLength(2)
      expect(inRange.map((p) => p.seatIndex)).toContain(1)
      expect(inRange.map((p) => p.seatIndex)).toContain(7)
    })
  })

  describe('getPlayersWithinDistance', () => {
    it('should return players within specified distance', () => {
      const players = createPlayers(8)
      const within2 = DistanceSystem.getPlayersWithinDistance(players[0]!, 2, players)
      // Seats 1, 2, 6, 7 — 4 players within distance 2
      expect(within2).toHaveLength(4)
    })

    it('should exclude self by default', () => {
      const players = createPlayers(8)
      const within2 = DistanceSystem.getPlayersWithinDistance(players[0]!, 2, players)
      expect(within2.map((p) => p.id)).not.toContain('p0')
    })
  })

  describe('horse helpers', () => {
    it('should detect offensive horse', () => {
      const players = createPlayers(1)
      expect(DistanceSystem.hasOffensiveHorse(players[0]!)).toBe(false)

      const horse = createEquip(EquipSlot.OffensiveHorse)
      players[0]!.equipCards.push(horse)
      expect(DistanceSystem.hasOffensiveHorse(players[0]!)).toBe(true)
    })

    it('should detect defensive horse', () => {
      const players = createPlayers(1)
      expect(DistanceSystem.hasDefensiveHorse(players[0]!)).toBe(false)

      const horse = createEquip(EquipSlot.DefensiveHorse)
      players[0]!.equipCards.push(horse)
      expect(DistanceSystem.hasDefensiveHorse(players[0]!)).toBe(true)
    })
  })
})
