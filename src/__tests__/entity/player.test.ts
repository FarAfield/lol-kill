// ============================================================
// Player 实体 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { Player } from '@core/entity/player'
import { Hero } from '@core/entity/hero'
import { Card } from '@core/entity/card'
import { GamePhase, Kingdom, ZoneType, EquipSlot, CardType, CardSuit, RoleType } from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'

// ── 测试辅助 ──

function createTestHero(overrides?: Partial<Parameters<typeof Hero.create>[0]>): Hero {
  return Hero.create({
    id: 'test_hero',
    name: '测试英雄',
    title: '测试',
    kingdom: Kingdom.Demacia,
    maxHp: 4,
    ...overrides,
  })
}

function createTestCardDef(overrides?: Partial<CardDefinition>): CardDefinition {
  return {
    name: '测试卡牌',
    type: CardType.Basic,
    suit: CardSuit.Spade,
    rank: 1,
    description: '测试',
    tags: ['test'],
    effectIds: [],
    isDelayed: false,
    canBeCanceled: false,
    ...overrides,
  }
}

function createWeaponCard(): Card {
  return Card.create({
    name: '测试武器',
    type: CardType.Equip,
    suit: CardSuit.Spade,
    rank: 1,
    description: '测试武器',
    tags: ['weapon'],
    effectIds: [],
    equipSlot: EquipSlot.Weapon,
    attackRange: 2,
    isDelayed: false,
    canBeCanceled: false,
  })
}

function createArmorCard(): Card {
  return Card.create({
    name: '测试防具',
    type: CardType.Equip,
    suit: CardSuit.Heart,
    rank: 2,
    description: '测试防具',
    tags: ['armor'],
    effectIds: [],
    equipSlot: EquipSlot.Armor,
    isDelayed: false,
    canBeCanceled: false,
  })
}

// ── 测试套件 ──

describe('Player', () => {
  beforeEach(() => {
    Card.resetCounter()
  })

  // ================================================================
  // 创建
  // ================================================================

  describe('create', () => {
    it('should create a Player with defaults', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })

      expect(player).toBeInstanceOf(Player)
      expect(player.id).toBe('p1')
      expect(player.seatIndex).toBe(0)
      expect(player.alive).toBe(true)
      expect(player.hp).toBe(4)
      expect(player.maxHp).toBe(4)
      expect(player.handCards).toEqual([])
      expect(player.equipCards).toEqual([])
      expect(player.judgeCards).toEqual([])
    })

    it('should inherit hero properties when hero provided', () => {
      const hero = createTestHero({ maxHp: 3 })
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [hero], hp: hero.maxHp, maxHp: hero.maxHp, power: hero.maxPower ?? 0, maxPower: hero.maxPower ?? 0 })

      expect(player.hp).toBe(3)
      expect(player.maxHp).toBe(3)
      expect(player.heroes).toEqual([hero])
    })

    it('should accept override properties', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, hp: 2, maxHp: 5, role: RoleType.Aspect, roleRevealed: true })

      expect(player.hp).toBe(2)
      expect(player.maxHp).toBe(5)
      expect(player.role).toBe(RoleType.Aspect)
      expect(player.roleRevealed).toBe(true)
    })

    it('should default to alive=true', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      expect(player.alive).toBe(true)
    })

    it('should initialize marks as empty Map', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      expect(player.marks).toBeInstanceOf(Map)
      expect(player.marks.size).toBe(0)
    })

    it('should default attackLimit to 1', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      expect(player.attackLimit).toBe(1)
      expect(player.usedAttackThisTurn).toBe(false)
    })
  })

  // ── 构造函数直接使用 ──

  describe('constructor', () => {
    it('should create player with full config', () => {
      const player = new Player({
        id: 'p2',
        seatIndex: 3,
        role: RoleType.Ascended,
        hp: 5,
        maxHp: 5,
        attackLimit: 2,
      })

      expect(player.id).toBe('p2')
      expect(player.seatIndex).toBe(3)
      expect(player.role).toBe(RoleType.Ascended)
      expect(player.hp).toBe(5)
      expect(player.attackLimit).toBe(2)
    })
  })

  // ================================================================
  // 体力操作
  // ================================================================

  describe('loseHp', () => {
    it('should decrease HP by specified amount', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero({ maxHp: 4 })], hp: 4, maxHp: 4 })
      const lost = player.loseHp(2)

      expect(lost).toBe(2)
      expect(player.hp).toBe(2)
    })

    it('should not decrease HP below 0', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero({ maxHp: 4 })], hp: 4, maxHp: 4 })
      const lost = player.loseHp(10)

      expect(lost).toBe(4)
      expect(player.hp).toBe(0)
    })

    it('should return 0 when HP is already 0', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      player.hp = 0
      const lost = player.loseHp(3)

      expect(lost).toBe(0)
      expect(player.hp).toBe(0)
    })
  })

  describe('recoverHp', () => {
    it('should increase HP by specified amount', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero({ maxHp: 4 })], hp: 4, maxHp: 4 })
      player.hp = 1
      const recovered = player.recoverHp(2)

      expect(recovered).toBe(2)
      expect(player.hp).toBe(3)
    })

    it('should not exceed maxHp', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero({ maxHp: 4 })], hp: 4, maxHp: 4 })
      player.hp = 3
      const recovered = player.recoverHp(5)

      expect(recovered).toBe(1)
      expect(player.hp).toBe(4)
    })

    it('should return 0 when already at maxHp', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero({ maxHp: 4 })], hp: 4, maxHp: 4 })
      const recovered = player.recoverHp(2)

      expect(recovered).toBe(0)
      expect(player.hp).toBe(4)
    })
  })

  describe('modifyMaxHp', () => {
    it('should increase maxHp', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero({ maxHp: 4 })], hp: 4, maxHp: 4 })
      player.modifyMaxHp(1)

      expect(player.maxHp).toBe(5)
    })

    it('should decrease maxHp', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero({ maxHp: 4 })], hp: 4, maxHp: 4 })
      player.modifyMaxHp(-1)

      expect(player.maxHp).toBe(3)
    })

    it('should cap current HP to new maxHp', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero({ maxHp: 4 })], hp: 4, maxHp: 4 })
      player.hp = 4
      player.modifyMaxHp(-2)

      expect(player.maxHp).toBe(2)
      expect(player.hp).toBe(2) // capped
    })

    it('should not allow negative maxHp', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero({ maxHp: 4 })], hp: 4, maxHp: 4 })
      player.modifyMaxHp(-10)

      expect(player.maxHp).toBe(0)
    })
  })

  // ================================================================
  // 能量操作
  // ================================================================

  describe('power', () => {
    it('should consume power', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      player.power = 3
      const consumed = player.consumePower(2)

      expect(consumed).toBe(2)
      expect(player.power).toBe(1)
    })

    it('should gain power up to maxPower', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      player.maxPower = 5
      player.power = 3
      player.gainPower(4)

      expect(player.power).toBe(5)
    })
  })

  // ================================================================
  // 查询
  // ================================================================

  describe('queries', () => {
    it('should report handSize correctly', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const card = Card.create(createTestCardDef())

      expect(player.handSize).toBe(0)

      player.handCards.push(card)
      expect(player.handSize).toBe(1)
    })

    it('should report isWounded when hp < maxHp', () => {
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero({ maxHp: 4 })], hp: 4, maxHp: 4 })

      expect(player.isWounded).toBe(false)

      player.hp = 3
      expect(player.isWounded).toBe(true)
    })

    it('should report isDying when hp <= 0 and alive', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })

      expect(player.isDying).toBe(false)

      player.hp = 0
      expect(player.isDying).toBe(true)

      player.alive = false
      expect(player.isDying).toBe(false)
    })

    it('should report attackRange with weapon', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      // No weapon: base range = 1
      expect(player.attackRange).toBe(1)

      // Equip weapon with attackRange = 2: total = 1 + 2 = 3
      const weapon = createWeaponCard()
      player.equipCards.push(weapon)
      expect(player.attackRange).toBe(3)
    })

    it('should return hero from heroes[0]', () => {
      const hero = createTestHero()
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [hero], hp: hero.maxHp, maxHp: hero.maxHp, power: hero.maxPower ?? 0, maxPower: hero.maxPower ?? 0 })

      expect(player.hero).toBe(hero)
    })

    it('should return undefined hero when heroes is empty', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      expect(player.hero).toBeUndefined()
    })
  })

  // ================================================================
  // 装备区操作
  // ================================================================

  describe('equipCard', () => {
    it('should add equipment to equipCards', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const weapon = createWeaponCard()

      const replaced = player.equipCard(weapon)

      expect(replaced).toBeUndefined()
      expect(player.equipCards).toContain(weapon)
    })

    it('should replace existing equipment in same slot', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const weapon1 = createWeaponCard()
      const weapon2 = Card.create({
        name: '新武器',
        type: CardType.Equip,
        suit: CardSuit.Club,
        rank: 5,
        description: '新武器',
        tags: ['weapon'],
        effectIds: [],
        equipSlot: EquipSlot.Weapon,
        attackRange: 3,
        isDelayed: false,
        canBeCanceled: false,
      })

      player.equipCard(weapon1)
      const replaced = player.equipCard(weapon2)

      expect(replaced).toBe(weapon1)
      expect(player.equipCards).toContain(weapon2)
      expect(player.equipCards).not.toContain(weapon1)
      expect(player.equipCards).toHaveLength(1)
    })

    it('should return undefined for card without equipSlot', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const basicCard = Card.create(createTestCardDef())

      const replaced = player.equipCard(basicCard)
      expect(replaced).toBeUndefined()
    })
  })

  describe('unequipSlot', () => {
    it('should remove equipment from specified slot', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const weapon = createWeaponCard()
      player.equipCards.push(weapon)

      const removed = player.unequipSlot(EquipSlot.Weapon)

      expect(removed).toBe(weapon)
      expect(player.equipCards).toHaveLength(0)
    })

    it('should return undefined when slot is empty', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const removed = player.unequipSlot(EquipSlot.Weapon)

      expect(removed).toBeUndefined()
    })

    it('should handle multiple equipment slots', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const weapon = createWeaponCard()
      const armor = createArmorCard()
      player.equipCards.push(weapon, armor)

      player.unequipSlot(EquipSlot.Weapon)

      expect(player.equipCards).toHaveLength(1)
      expect(player.equipCards[0]).toBe(armor)
    })
  })

  describe('getEquipInSlot', () => {
    it('should find equipment by slot', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const armor = createArmorCard()
      player.equipCards.push(armor)

      expect(player.getEquipInSlot(EquipSlot.Armor)).toBe(armor)
      expect(player.getEquipInSlot(EquipSlot.Weapon)).toBeUndefined()
    })
  })

  // ================================================================
  // 判定区操作
  // ================================================================

  describe('judge cards', () => {
    it('should add judge card', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const card = Card.create(createTestCardDef({ isDelayed: true }))

      player.addJudgeCard(card)
      expect(player.judgeCards).toContain(card)
    })

    it('should remove judge card by id', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const card = Card.create(createTestCardDef({ isDelayed: true }))

      player.addJudgeCard(card)
      const removed = player.removeJudgeCard(card.id)

      expect(removed).toBe(card)
      expect(player.judgeCards).toHaveLength(0)
    })

    it('should return undefined when removing non-existent judge card', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const removed = player.removeJudgeCard('nonexistent')

      expect(removed).toBeUndefined()
    })
  })

  // ================================================================
  // 标记操作
  // ================================================================

  describe('marks', () => {
    it('should get default mark value as 0', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      expect(player.getMark('damageThisTurn')).toBe(0)
    })

    it('should set and get mark value', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      player.setMark('damageThisTurn', 3)
      expect(player.getMark('damageThisTurn')).toBe(3)
    })

    it('should add to mark value', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      player.addMark('damageThisTurn')
      player.addMark('damageThisTurn', 2)
      expect(player.getMark('damageThisTurn')).toBe(3)
    })

    it('should clear mark', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      player.setMark('test', 5)
      player.clearMark('test')
      expect(player.getMark('test')).toBe(0)
    })
  })

  // ================================================================
  // 回合追踪
  // ================================================================

  describe('turn tracking', () => {
    it('should reset turn state', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      player.usedAttackThisTurn = true
      player.attackLimit = 3
      player.shouldSkipPhases = [GamePhase.PhaseUse]
      player.skippedPhases = [GamePhase.PhaseDraw]

      player.resetTurnState()

      expect(player.usedAttackThisTurn).toBe(false)
      expect(player.attackLimit).toBe(1)
      expect(player.shouldSkipPhases).toEqual([])
      expect(player.skippedPhases).toEqual([])
    })

    it('should mark attack used', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      player.markAttackUsed()
      expect(player.usedAttackThisTurn).toBe(true)
    })

    it('should report canAttack=true when attack not used', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      expect(player.canAttack).toBe(true)
    })

    it('should report canAttack=false when attack used with default limit', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      player.markAttackUsed()
      // Default limit = 1, and we've used 1 attack
      // canAttack returns: attackLimit > (usedAttackThisTurn ? 1 : 0) => 1 > 1 => false
      expect(player.canAttack).toBe(false)
    })
  })

  // ================================================================
  // 序列化
  // ================================================================

  describe('toJSON', () => {
    it('should serialize marks as plain object', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      player.setMark('test', 42)

      const json = player.toJSON()
      expect(json.marks).toEqual({ test: 42 })
    })

    it('should serialize all required fields', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const json = player.toJSON()

      expect(json.id).toBe('p1')
      expect(json.seatIndex).toBe(0)
      expect(json.alive).toBe(true)
      expect(json.hp).toBe(4)
      expect(typeof json.marks).toBe('object')
    })
  })

  // ================================================================
  // 边界情况
  // ================================================================

  describe('edge cases', () => {
    it('should handle player with maxHp=0', () => {
      const hero = createTestHero({ maxHp: 0 })
      const player = new Player({ id: 'p1', seatIndex: 0, heroes: [hero], hp: hero.maxHp, maxHp: hero.maxHp, power: hero.maxPower ?? 0, maxPower: hero.maxPower ?? 0 })
      expect(player.hp).toBe(0)
      expect(player.maxHp).toBe(0)
    })

    it('should handle multiple heroes (dual-hero mode)', () => {
      const hero1 = createTestHero({ id: 'h1', name: '英雄1' })
      const hero2 = createTestHero({ id: 'h2', name: '英雄2' })
      const player = new Player({
        id: 'p1',
        seatIndex: 0,
        heroes: [hero1, hero2],
        hp: 6,
        maxHp: 6,
      })

      expect(player.heroes).toHaveLength(2)
      expect(player.hero).toBe(hero1) // hero getter returns [0]
    })
  })
})
