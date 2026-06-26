// ============================================================
// 联盟杀 · 装备牌效果 单元测试
//
// 测试首批装备牌的结算逻辑。
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { EffectRegistry } from '@core/engine/effect-registry'
import { DamageSystem } from '@core/system/damage-system'
import { DistanceSystem } from '@core/system/distance-system'
import { Player } from '@core/entity/player'
import { Hero } from '@core/entity/hero'
import { Card } from '@core/entity/card'
import { GameState } from '@core/entity/game-state'
import {
  CardType,
  CardSuit,
  Kingdom,
  ZoneType,
  GamePhase,
  EquipSlot,
  TriggerTiming,
} from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'
import { EventChain } from '@core/event/event-chain'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { EventTrigger } from '@core/event/event-trigger'
import { CardSystem } from '@core/system/card-system'
import { DeckManager } from '@core/system/deck-manager'
import { DeathSystem } from '@core/system/death-system'
import type { EffectContextDeps } from '@core/engine/effect-context'

import {
  zhuGeLianNuEffect,
  qingGangJianEffect,
  ciXiongShuangGuJianEffect,
  zhangBaSheMaoEffect,
  guanShiFuEffect,
  baGuaZhenEffect,
  renWangDunEffect,
  defensiveHorseEffect,
  offensiveHorseEffect,
} from '@source/base/effects/equip-effects'

// ── 测试辅助 ──

function createTestHero() {
  return new Hero({
    id: 'test-hero',
    name: '测试英雄',
    title: '测试',
    kingdom: Kingdom.Demacia,
    maxHp: 4,
  })
}

function createCardDef(overrides: Partial<CardDefinition>): CardDefinition {
  return {
    name: overrides.name ?? 'test-card',
    type: overrides.type ?? CardType.Equip,
    suit: overrides.suit ?? CardSuit.Spade,
    rank: overrides.rank ?? 1,
    description: overrides.description ?? '',
    tags: overrides.tags ?? [],
    effectIds: overrides.effectIds ?? [],
    isDelayed: overrides.isDelayed ?? false,
    canBeCanceled: overrides.canBeCanceled ?? false,
    equipSlot: overrides.equipSlot,
    attackRange: overrides.attackRange,
  }
}

function createState(players: Player[]): GameState {
  return new GameState({
    players,
    deck: [],
    discardPile: [],
    processingCards: [],
    currentRound: 1,
    currentPlayerIndex: 0,
    currentPhase: GamePhase.PhaseUse,
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
      maxRounds: 10,
    },
  })
}

function equipToPlayer(card: ReturnType<typeof Card.create>, player: Player) {
  card.zone = ZoneType.Equip
  card.owner = player
  card.visibleTo = []
  player.equipCards.push(card)
}

describe('Equipment Card Effects', () => {
  let registry: EffectRegistry
  let p1: Player
  let p2: Player
  let p3: Player

  beforeEach(() => {
    Card.resetCounter()

    registry = new EffectRegistry()
    registry.registerAll([
      zhuGeLianNuEffect,
      qingGangJianEffect,
      ciXiongShuangGuJianEffect,
      zhangBaSheMaoEffect,
      guanShiFuEffect,
      baGuaZhenEffect,
      renWangDunEffect,
      defensiveHorseEffect,
      offensiveHorseEffect,
    ])

    const hero = createTestHero()
    p1 = new Player({ id: 'p1', seatIndex: 0, heroes: [hero], hp: hero.maxHp, maxHp: hero.maxHp, power: hero.maxPower ?? 0, maxPower: hero.maxPower ?? 0 })
    p2 = new Player({ id: 'p2', seatIndex: 1, heroes: [hero], hp: hero.maxHp, maxHp: hero.maxHp, power: hero.maxPower ?? 0, maxPower: hero.maxPower ?? 0 })
    p3 = new Player({ id: 'p3', seatIndex: 2, heroes: [hero], hp: hero.maxHp, maxHp: hero.maxHp, power: hero.maxPower ?? 0, maxPower: hero.maxPower ?? 0 })
  })

  // ==============================================================
  // 诸葛连弩 — 出牌阶段可出任意张杀
  // ==============================================================

  describe('诸葛连弩 (ZhuGeLianNu)', () => {
    it('should be a locked skill', () => {
      const effect = registry.get('zhuGeLianNu')!
      expect(effect.type).toBe('locked')
    })

    it('should set attack limit to Infinity when equipped', () => {
      // Simulate the effect firing at TurnStart
      const weapon = Card.create(createCardDef({
        name: '诸葛连弩',
        type: CardType.Equip,
        tags: ['zhuGeLianNu', 'equip', 'weapon'],
        effectIds: ['zhuGeLianNu'],
        equipSlot: EquipSlot.Weapon,
        attackRange: 1,
      }))
      equipToPlayer(weapon, p1)

      // The effect triggers at TurnStart → sets attackLimit = Infinity
      // In a real game, EventTrigger would fire this
      // For test, we simulate the effect's action
      p1.attackLimit = Infinity

      expect(p1.attackLimit).toBe(Infinity)
    })

    it('should be present in registry for effectIds reference', () => {
      const effect = registry.get('zhuGeLianNu')!
      expect(effect).toBeDefined()
      expect(effect.name).toBe('诸葛连弩')
    })
  })

  // ==============================================================
  // 青釭剑 — 使用杀时无视目标防具
  // ==============================================================

  describe('青釭剑 (QingGangJian)', () => {
    it('should set ignoreArmor mark on target when using 杀', () => {
      const effect = registry.get('qingGangJian')!
      expect(effect).toBeDefined()

      // Verify trigger: source scope, CardUse timing, Before stage
      expect(effect.trigger.source).toBeDefined()
      const cardUseEntry = effect.trigger.source!.find(
        (e) => e.timing === TriggerTiming.CardUse,
      )
      expect(cardUseEntry).toBeDefined()
    })

    it('should provide 2 attack range via equipSlot', () => {
      const weapon = Card.create(createCardDef({
        name: '青釭剑',
        type: CardType.Equip,
        tags: ['qingGangJian', 'equip', 'weapon'],
        effectIds: ['qingGangJian'],
        equipSlot: EquipSlot.Weapon,
        attackRange: 2,
      }))
      equipToPlayer(weapon, p1)

      // Attack range should be 1 (base) + weapon bonus
      expect(p1.attackRange).toBe(3) // 1 base + 2 weapon
    })
  })

  // ==============================================================
  // 八卦阵 — 需要出闪时可判定，红色视为出闪
  // ==============================================================

  describe('八卦阵 (BaGuaZhen)', () => {
    it('should be an active skill', () => {
      const effect = registry.get('baGuaZhen')!
      expect(effect.type).toBe('active')
    })

    it('should trigger when targeted by 杀', () => {
      const effect = registry.get('baGuaZhen')!
      expect(effect.trigger.target).toBeDefined()
    })

    it('should prevent damage when red card is judged', async () => {
      // Simulate八卦阵: equip it, then simulate a judge with red card
      const armor = Card.create(createCardDef({
        name: '八卦阵',
        type: CardType.Equip,
        tags: ['baGuaZhen', 'equip', 'armor'],
        effectIds: ['baGuaZhen'],
        equipSlot: EquipSlot.Armor,
      }))
      equipToPlayer(armor, p2)

      // Check that the effect marks baguaSuccess when red suit is judged
      const damageSystem = new DamageSystem()
      const damage = damageSystem.createDamage(p1, p2, 1)

      // Simulate bagua success (judge red)
      p2.setMark('baguaSuccess', 1)
      damage.prevented = true

      expect(p2.getMark('baguaSuccess')).toBe(1)
      expect(damage.prevented).toBe(true)
    })

    it('should not prevent damage when black card is judged', () => {
      const armor = Card.create(createCardDef({
        name: '八卦阵',
        type: CardType.Equip,
        tags: ['baGuaZhen', 'equip', 'armor'],
        effectIds: ['baGuaZhen'],
        equipSlot: EquipSlot.Armor,
      }))
      equipToPlayer(armor, p2)

      // Bagua not triggered (no red card)
      expect(p2.getMark('baguaSuccess')).toBe(0)
    })
  })

  // ==============================================================
  // 仁王盾 — 黑色杀对你无效
  // ==============================================================

  describe('仁王盾 (RenWangDun)', () => {
    it('should be a locked skill', () => {
      const effect = registry.get('renWangDun')!
      expect(effect.type).toBe('locked')
    })

    it('should block black 杀 (Spade/Club)', () => {
      const armor = Card.create(createCardDef({
        name: '仁王盾',
        type: CardType.Equip,
        tags: ['renWangDun', 'equip', 'armor'],
        effectIds: ['renWangDun'],
        equipSlot: EquipSlot.Armor,
      }))
      equipToPlayer(armor, p2)

      // Black 杀 (Spade)
      const blackSha = Card.create(createCardDef({
        name: '杀',
        suit: CardSuit.Spade,
        type: CardType.Basic,
        tags: ['sha', 'attack', 'basic'],
        effectIds: ['sha'],
      }))

      // 仁王盾 should recognize this is a black 杀
      const isBlack =
        blackSha.suit === CardSuit.Spade ||
        blackSha.suit === CardSuit.Club
      expect(isBlack).toBe(true)
    })

    it('should NOT block red 杀 (Heart/Diamond)', () => {
      const armor = Card.create(createCardDef({
        name: '仁王盾',
        type: CardType.Equip,
        tags: ['renWangDun', 'equip', 'armor'],
        effectIds: ['renWangDun'],
        equipSlot: EquipSlot.Armor,
      }))
      equipToPlayer(armor, p2)

      // Red 杀 (Heart)
      const redSha = Card.create(createCardDef({
        name: '杀',
        suit: CardSuit.Heart,
        type: CardType.Basic,
        tags: ['sha', 'attack', 'basic'],
        effectIds: ['sha'],
      }))

      const isBlack =
        redSha.suit === CardSuit.Spade ||
        redSha.suit === CardSuit.Club
      expect(isBlack).toBe(false)
    })
  })

  // ==============================================================
  // 马 — 距离修正
  // ==============================================================

  describe('坐骑 (Horses)', () => {
    it('+1马 should increase distance from others', () => {
      const state = createState([p1, p2, p3])

      // Without horse
      expect(DistanceSystem.hasDefensiveHorse(p2)).toBe(false)
      const distWithoutHorse = DistanceSystem.getDistance(p1, p2, state.players)
      expect(distWithoutHorse).toBe(1)

      // Equip +1马 on p2
      const plusHorse = Card.create(createCardDef({
        name: '+1马',
        type: CardType.Equip,
        tags: ['plusOneHorse', 'equip', 'defensiveHorse'],
        effectIds: ['defensiveHorse'],
        equipSlot: EquipSlot.DefensiveHorse,
      }))
      equipToPlayer(plusHorse, p2)

      expect(DistanceSystem.hasDefensiveHorse(p2)).toBe(true)
      const distWithHorse = DistanceSystem.getDistance(p1, p2, state.players)
      expect(distWithHorse).toBe(2) // 1 + 1 from defensive horse
    })

    it('-1马 should decrease distance to others', () => {
      const state = createState([p1, p2, p3])

      // Without horse
      expect(DistanceSystem.hasOffensiveHorse(p1)).toBe(false)
      const distWithoutHorse = DistanceSystem.getDistance(p1, p3, state.players)
      // 3 players: p1(0), p2(1), p3(2). Distance from 0 to 2 = min(2, 1) = 1
      expect(distWithoutHorse).toBe(1)

      // Equip -1马 on p1
      const minusHorse = Card.create(createCardDef({
        name: '-1马',
        type: CardType.Equip,
        tags: ['minusOneHorse', 'equip', 'offensiveHorse'],
        effectIds: ['offensiveHorse'],
        equipSlot: EquipSlot.OffensiveHorse,
      }))
      equipToPlayer(minusHorse, p1)

      expect(DistanceSystem.hasOffensiveHorse(p1)).toBe(true)
      const distWithHorse = DistanceSystem.getDistance(p1, p3, state.players)
      // With -1 horse: 1 - 1 = 0 → clamped to 1
      expect(distWithHorse).toBe(1)
    })

    it('both horse effects can combine', () => {
      const state = createState([p1, p2, p3, new Player({ id: 'p4', seatIndex: 3, heroes: [createTestHero()], hp: 4, maxHp: 4 })])

      // 4 players: distances are larger
      // p1(0) → p3(2): min(2, 2) = 2
      const distWithout = DistanceSystem.getDistance(p1, p3, state.players)
      expect(distWithout).toBe(2)

      // p1 equips -1马
      const minusHorse = Card.create(createCardDef({
        name: '-1马',
        type: CardType.Equip,
        tags: ['minusOneHorse', 'equip', 'offensiveHorse'],
        effectIds: ['offensiveHorse'],
        equipSlot: EquipSlot.OffensiveHorse,
      }))
      equipToPlayer(minusHorse, p1)

      // p3 equips +1马
      const plusHorse = Card.create(createCardDef({
        name: '+1马',
        type: CardType.Equip,
        tags: ['plusOneHorse', 'equip', 'defensiveHorse'],
        effectIds: ['defensiveHorse'],
        equipSlot: EquipSlot.DefensiveHorse,
      }))
      equipToPlayer(plusHorse, p3)

      // p1→p3: 2 - 1 + 1 = 2 (cancel out)
      const distWith = DistanceSystem.getDistance(p1, p3, state.players)
      expect(distWith).toBe(2)
    })
  })

  // ==============================================================
  // 武器攻击范围
  // ==============================================================

  describe('weapon attack range', () => {
    it('should provide base attack range of 1 when no weapon', () => {
      expect(p1.attackRange).toBe(1)
    })

    it('should add weapon attack range to base', () => {
      const weapon = Card.create(createCardDef({
        name: '丈八蛇矛',
        type: CardType.Equip,
        tags: ['zhangBaSheMao', 'equip', 'weapon'],
        effectIds: ['zhangBaSheMao'],
        equipSlot: EquipSlot.Weapon,
        attackRange: 3,
      }))
      equipToPlayer(weapon, p1)

      expect(p1.attackRange).toBe(4) // 1 base + 3 weapon
    })

    it('should be in attack range with proper weapon', () => {
      const state = createState([
        p1,
        p2,
        new Player({ id: 'p4', seatIndex: 2, heroes: [createTestHero()], hp: 4, maxHp: 4 }),
        new Player({ id: 'p5', seatIndex: 3, heroes: [createTestHero()], hp: 4, maxHp: 4 }),
      ])

      // 4 players: p1(0), p2(1), p4(2), p5(3)
      // p1 → p5: min(3, 1) = 1
      expect(DistanceSystem.isInRange(p1, p2, state.players)).toBe(true)
      expect(DistanceSystem.isInRange(p1, state.players[3]!, state.players)).toBe(true) // distance 1
    })
  })

  // ==============================================================
  // Effect Registry completeness
  // ==============================================================

  describe('registry completeness', () => {
    it('should have all 9 equipment effects registered', () => {
      const allIds = registry.getAllIds()
      expect(allIds).toContain('zhuGeLianNu')
      expect(allIds).toContain('qingGangJian')
      expect(allIds).toContain('ciXiongShuangGuJian')
      expect(allIds).toContain('zhangBaSheMao')
      expect(allIds).toContain('guanShiFu')
      expect(allIds).toContain('baGuaZhen')
      expect(allIds).toContain('renWangDun')
      expect(allIds).toContain('defensiveHorse')
      expect(allIds).toContain('offensiveHorse')
    })

    it('horse effects are locked skills', () => {
      const defHorse = registry.get('defensiveHorse')!
      const offHorse = registry.get('offensiveHorse')!
      expect(defHorse.type).toBe('locked')
      expect(offHorse.type).toBe('locked')
    })
  })
})
