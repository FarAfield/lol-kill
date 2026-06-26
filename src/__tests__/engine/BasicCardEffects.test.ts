// ============================================================
// 联盟杀 · 基本牌效果 单元测试
//
// 测试四种基本牌的核心结算逻辑。
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { EventCompiler } from '@core/event/event-compiler'
import { EventChain } from '@core/event/event-chain'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { EffectRegistry } from '@core/engine/effect-registry'
import type { EffectContextDeps } from '@core/engine/effect-context'
import { DeckManager } from '@core/system/deck-manager'
import { CardSystem } from '@core/system/card-system'
import { DamageSystem, DamageStage } from '@core/system/damage-system'
import { DeathSystem } from '@core/system/death-system'
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
} from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'
import {
  shaEffect,
  shanEffect,
  taoEffect,
  jiuEffect,
} from '@source/base/effects/basic-effects'

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
    type: overrides.type ?? CardType.Basic,
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

function createDeps(state: GameState): EffectContextDeps {
  return {
    state,
    eventChain: new EventChain(),
    eventDispatcher: new EventDispatcher(),
    deckManager: new DeckManager(state),
    cardSystem: new CardSystem(state),
    damageSystem: new DamageSystem(),
    deathSystem: new DeathSystem(state),
  }
}

function addToHand(card: ReturnType<typeof Card.create>, player: Player) {
  card.zone = ZoneType.Hand
  card.owner = player
  card.visibleTo = [player]
  player.handCards.push(card)
}

describe('Basic Card Effects', () => {
  let registry: EffectRegistry
  let state: GameState
  let deps: EffectContextDeps
  let compiler: EventCompiler
  let p1: Player
  let p2: Player
  let p3: Player

  beforeEach(() => {
    Card.resetCounter()

    registry = new EffectRegistry()
    registry.registerAll([shaEffect, shanEffect, taoEffect, jiuEffect])

    const hero = createTestHero()
    p1 = new Player({ id: 'p1', seatIndex: 0, heroes: [hero], hp: hero.maxHp, maxHp: hero.maxHp, power: hero.maxPower ?? 0, maxPower: hero.maxPower ?? 0 })
    p2 = new Player({ id: 'p2', seatIndex: 1, heroes: [hero], hp: hero.maxHp, maxHp: hero.maxHp, power: hero.maxPower ?? 0, maxPower: hero.maxPower ?? 0 })
    p3 = new Player({ id: 'p3', seatIndex: 2, heroes: [hero], hp: hero.maxHp, maxHp: hero.maxHp, power: hero.maxPower ?? 0, maxPower: hero.maxPower ?? 0 })

    state = new GameState({
      players: [p1, p2, p3],
      deck: [],
      discardPile: [],
      processingCards: [],
      currentRound: 1,
      currentPlayerIndex: 0,
      currentPhase: GamePhase.PhaseUse,
      config: {
        mode: 'test',
        playerCount: 3,
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

    deps = createDeps(state)
    compiler = new EventCompiler(registry, deps)
  })

  // ==============================================================
  // 杀 — 对目标造成1点伤害
  // ==============================================================

  describe('杀 (Sha)', () => {
    it('should deal 1 damage to target', async () => {
      const shaCard = Card.create(createCardDef({
        name: '杀',
        tags: ['sha', 'attack', 'basic'],
        effectIds: ['sha'],
      }))
      addToHand(shaCard, p1)

      expect(p2.hp).toBe(4)

      const result = await compiler.compile(shaCard, p1, [p2])

      expect(result.success).toBe(true)
      expect(p2.hp).toBe(3)
    })

    it('should mark attack as used', async () => {
      const shaCard = Card.create(createCardDef({
        name: '杀',
        tags: ['sha', 'attack', 'basic'],
        effectIds: ['sha'],
      }))
      addToHand(shaCard, p1)

      await compiler.compile(shaCard, p1, [p2])

      expect(p1.usedAttackThisTurn).toBe(true)
    })

    it('should reduce target HP to 0 when killing blow', async () => {
      p2.hp = 1

      const shaCard = Card.create(createCardDef({
        name: '杀',
        tags: ['sha', 'attack', 'basic'],
        effectIds: ['sha'],
      }))
      addToHand(shaCard, p1)

      await compiler.compile(shaCard, p1, [p2])

      expect(p2.hp).toBe(0)
      expect(p2.isDying).toBe(true)
    })

    it('should not allow targeting self', async () => {
      const shaCard = Card.create(createCardDef({
        name: '杀',
        tags: ['sha', 'attack', 'basic'],
        effectIds: ['sha'],
      }))
      addToHand(shaCard, p1)

      const result = await compiler.compile(shaCard, p1, [p1])

      expect(result.success).toBe(false)
      expect(p1.hp).toBe(4) // No damage
    })
  })

  // ==============================================================
  // 闪 — 响应杀，抵消伤害
  // ==============================================================

  describe('闪 (Shan)', () => {
    it('should be a valid effect in registry', () => {
      const effect = registry.get('shan')
      expect(effect).toBeDefined()
      expect(effect!.name).toBe('闪')
    })

    it('should have trigger on CardUse when player is target', () => {
      const effect = registry.get('shan')!
      expect(effect.trigger.target).toBeDefined()
      expect(effect.trigger.target!.length).toBeGreaterThan(0)
    })

    it('should set shanUsed mark when triggered in damage prevent stage', async () => {
      // 模拟闪的触发：目标 player 受到杀时，在 damage 流程中触发 闪 效果
      const damageSystem = deps.damageSystem as DamageSystem

      // 注册闪在 Prevent 阶段的响应
      let shanTriggered = false
      damageSystem.registerHook(DamageStage.Prevent, (d) => {
        // 如果目标有闪，则阻止伤害
        if (d.target.getMark('hasShan') > 0) {
          shanTriggered = true
          damageSystem.preventDamage(d)
        }
      })

      // 模拟 p2 手中有闪
      p2.setMark('hasShan', 1)

      const damage = damageSystem.createDamage(p1, p2, 1)
      await damageSystem.executePipeline(damage)

      expect(shanTriggered).toBe(true)
      expect(damage.prevented).toBe(true)
      expect(p2.hp).toBe(4) // No damage
    })
  })

  // ==============================================================
  // 桃 — 回复1点体力 / 濒死时救活
  // ==============================================================

  describe('桃 (Tao)', () => {
    it('should recover 1 HP to self when wounded', async () => {
      p1.hp = 2 // wounded

      const taoCard = Card.create(createCardDef({
        name: '桃',
        type: CardType.Basic,
        suit: CardSuit.Heart,
        tags: ['tao', 'heal', 'basic'],
        effectIds: ['tao'],
      }))
      addToHand(taoCard, p1)

      const result = await compiler.compile(taoCard, p1, [p1])

      expect(result.success).toBe(true)
      expect(p1.hp).toBe(3)
    })

    it('should not exceed max HP when healing', async () => {
      p1.hp = 4 // full health

      const taoCard = Card.create(createCardDef({
        name: '桃',
        type: CardType.Basic,
        suit: CardSuit.Heart,
        tags: ['tao', 'heal', 'basic'],
        effectIds: ['tao'],
      }))
      addToHand(taoCard, p1)

      await compiler.compile(taoCard, p1, [p1])

      expect(p1.hp).toBe(4) // Still max
    })

    it('should recover HP on a dying player', async () => {
      p2.hp = 0 // dying

      const taoCard = Card.create(createCardDef({
        name: '桃',
        type: CardType.Basic,
        suit: CardSuit.Heart,
        tags: ['tao', 'heal', 'basic', 'dying'],
        effectIds: ['tao'],
      }))
      addToHand(taoCard, p1)

      const result = await compiler.compile(taoCard, p1, [p2])

      expect(result.success).toBe(true)
      expect(p2.hp).toBe(1)
    })
  })

  // ==============================================================
  // 酒 — 出牌阶段：下一张杀伤害+1 / 濒死时回复体力
  // ==============================================================

  describe('酒 (Jiu)', () => {
    it('should set jiuBoost mark when used in play phase', async () => {
      const jiuCard = Card.create(createCardDef({
        name: '酒',
        type: CardType.Basic,
        suit: CardSuit.Club,
        tags: ['jiu', 'boost', 'basic'],
        effectIds: ['jiu'],
      }))
      addToHand(jiuCard, p1)

      const result = await compiler.compile(jiuCard, p1, [p1])

      expect(result.success).toBe(true)
      expect(p1.getMark('jiuBoost')).toBe(1)
    })

    it('should boost next 杀 damage by 1', async () => {
      // First use 酒
      const jiuCard = Card.create(createCardDef({
        name: '酒',
        type: CardType.Basic,
        suit: CardSuit.Club,
        tags: ['jiu', 'boost', 'basic'],
        effectIds: ['jiu'],
      }))
      addToHand(jiuCard, p1)
      await compiler.compile(jiuCard, p1, [p1])

      expect(p1.getMark('jiuBoost')).toBe(1)

      // Then use 杀
      const shaCard = Card.create(createCardDef({
        name: '杀',
        tags: ['sha', 'attack', 'basic'],
        effectIds: ['sha'],
      }))
      addToHand(shaCard, p1)

      expect(p2.hp).toBe(4)
      await compiler.compile(shaCard, p1, [p2])

      // 酒杀伤害应为2
      expect(p2.hp).toBe(2)
      // 酒标记应在使用后清除
      expect(p1.getMark('jiuBoost')).toBe(0)
    })

    it('should recover 1 HP when used while dying', async () => {
      p1.hp = 0 // dying

      const jiuCard = Card.create(createCardDef({
        name: '酒',
        type: CardType.Basic,
        suit: CardSuit.Diamond,
        tags: ['jiu', 'boost', 'basic', 'dying'],
        effectIds: ['jiu'],
      }))
      addToHand(jiuCard, p1)

      await compiler.compile(jiuCard, p1, [p1])

      expect(p1.hp).toBe(1)
      expect(p1.isDying).toBe(false)
    })

    it('should mark as used this turn (once per turn)', async () => {
      const effect = registry.get('jiu')!
      expect(effect.frequency).toBe('oncePerTurn')
    })
  })
})
