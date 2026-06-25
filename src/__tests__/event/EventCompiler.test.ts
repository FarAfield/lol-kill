// ============================================================
// 联盟杀 · EventCompiler 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { EventCompiler } from '@core/event/event-compiler'
import { EventChain } from '@core/event/event-chain'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { EventTrigger } from '@core/event/event-trigger'
import { EffectRegistry } from '@core/engine/effect-registry'
import { EffectContext } from '@core/engine/effect-context'
import type { EffectContextDeps } from '@core/engine/effect-context'
import { DeckManager } from '@core/system/deck-manager'
import { CardSystem } from '@core/system/card-system'
import { DamageSystem } from '@core/system/damage-system'
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
  SkillType,
  TriggerTiming,
  Frequency,
} from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'
import type { IEffect } from '@core/contracts/effect.interface'

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

function createShaCard() {
  const def: CardDefinition = {
    name: '杀',
    type: CardType.Basic,
    suit: CardSuit.Spade,
    rank: 7,
    description: '杀',
    tags: ['sha', 'attack', 'basic'],
    effectIds: ['sha'],
    isDelayed: false,
    canBeCanceled: false,
  }
  return Card.create(def)
}

function createTaoCard() {
  const def: CardDefinition = {
    name: '桃',
    type: CardType.Basic,
    suit: CardSuit.Heart,
    rank: 3,
    description: '桃',
    tags: ['tao', 'heal', 'basic', 'dying'],
    effectIds: ['tao'],
    isDelayed: false,
    canBeCanceled: false,
  }
  return Card.create(def)
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

describe('EventCompiler', () => {
  let registry: EffectRegistry
  let state: GameState
  let deps: EffectContextDeps
  let compiler: EventCompiler
  let player1: Player
  let player2: Player

  beforeEach(() => {
    Card.resetCounter()

    registry = new EffectRegistry()

    // 创建测试英雄
    const hero = createTestHero()

    player1 = Player.create('p1', 0, hero)
    player2 = Player.create('p2', 1, hero)

    state = new GameState({
      players: [player1, player2],
      deck: [],
      discardPile: [],
      currentRound: 1,
      currentPlayerIndex: 0,
      currentPhase: GamePhase.PhaseUse,
      config: {
        mode: 'test',
        playerCount: 2,
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

  describe('compile — basic card use', () => {
    it('should successfully compile a card use', async () => {
      // Register a simple effect
      const testEffect: IEffect = {
        id: 'sha',
        name: '杀',
        description: '造成1点伤害',
        type: SkillType.Active,
        priority: 0,
        frequency: Frequency.Unlimited,
        trigger: {
          source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
        },
        content: async (ctx) => {
          if (ctx.event.targets[0]) {
            await ctx.damageTarget(ctx.event.targets[0]!, 1)
          }
        },
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }
      registry.register(testEffect)

      const shaCard = createShaCard()
      // Put card in player1's hand
      shaCard.zone = ZoneType.Hand
      shaCard.owner = player1
      shaCard.visibleTo = [player1]
      player1.handCards.push(shaCard)

      // Add players to state for TargetSystem distance calculation
      player2.hp = 4

      const result = await compiler.compile(shaCard, player1, [player2])

      expect(result.success).toBe(true)
      expect(result.events.length).toBeGreaterThan(0)
      // Card should be in discard after use
      expect(shaCard.zone).toBe(ZoneType.Discard)
      // Target should have taken 1 damage
      expect(player2.hp).toBe(3)
    })

    it('should fail if target validation fails', async () => {
      const shaCard = createShaCard()
      shaCard.zone = ZoneType.Hand
      shaCard.owner = player1
      shaCard.visibleTo = [player1]
      player1.handCards.push(shaCard)

      // Player cannot target themselves with 杀
      const result = await compiler.compile(shaCard, player1, [player1])

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should fail if card is not in source hand', async () => {
      const shaCard = createShaCard()
      // Card is in deck, not hand
      shaCard.zone = ZoneType.Deck

      const result = await compiler.compile(shaCard, player1, [player2])

      expect(result.success).toBe(false)
    })
  })

  describe('compile — card effects execution', () => {
    it('should execute card effects in priority order', async () => {
      const executionOrder: string[] = []

      const effect1: IEffect = {
        id: 'eff1',
        name: 'Effect 1',
        description: '',
        type: SkillType.Active,
        priority: 10,
        frequency: Frequency.Unlimited,
        trigger: { source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }] },
        content: async () => { executionOrder.push('eff1') },
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }

      const effect2: IEffect = {
        id: 'eff2',
        name: 'Effect 2',
        description: '',
        type: SkillType.Active,
        priority: 5,
        frequency: Frequency.Unlimited,
        trigger: { source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }] },
        content: async () => { executionOrder.push('eff2') },
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }

      registry.registerAll([effect1, effect2])

      const card = createShaCard()
      card.effectIds = ['eff1', 'eff2']
      card.zone = ZoneType.Hand
      card.owner = player1
      card.visibleTo = [player1]
      player1.handCards.push(card)

      await compiler.compile(card, player1, [player2])

      // Higher priority effect should execute first
      expect(executionOrder).toEqual(['eff1', 'eff2'])
    })

    it('should respect effect filters', async () => {
      let wasExecuted = false

      const effect: IEffect = {
        id: 'filtered-eff',
        name: 'Filtered',
        description: '',
        type: SkillType.Active,
        priority: 0,
        frequency: Frequency.Unlimited,
        trigger: { source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }] },
        filter: () => false, // Always filtered out
        content: async () => { wasExecuted = true },
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }

      registry.register(effect)

      const card = createShaCard()
      card.effectIds = ['filtered-eff']
      card.zone = ZoneType.Hand
      card.owner = player1
      card.visibleTo = [player1]
      player1.handCards.push(card)

      await compiler.compile(card, player1, [player2])

      expect(wasExecuted).toBe(false)
    })
  })

  describe('compile — 桃 (heal)', () => {
    it('should recover HP when using 桃', async () => {
      const taoEffect: IEffect = {
        id: 'tao',
        name: '桃',
        description: '回复1点体力',
        type: SkillType.Active,
        priority: 0,
        frequency: Frequency.Unlimited,
        trigger: { source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }] },
        content: async (ctx) => {
          const target = ctx.event.targets[0] ?? ctx.player
          await ctx.recoverHp(target, 1)
        },
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }
      registry.register(taoEffect)

      // Reduce HP first
      player1.hp = 2

      const taoCard = createTaoCard()
      taoCard.zone = ZoneType.Hand
      taoCard.owner = player1
      taoCard.visibleTo = [player1]
      player1.handCards.push(taoCard)

      const result = await compiler.compile(taoCard, player1, [player1])

      expect(result.success).toBe(true)
      expect(player1.hp).toBe(3)
    })
  })

  describe('compile — frequency tracking', () => {
    it('should mark oncePerTurn effects as used', async () => {
      const effect: IEffect = {
        id: 'once-per-turn',
        name: 'Once Per Turn',
        description: '',
        type: SkillType.Active,
        priority: 0,
        frequency: Frequency.OncePerTurn,
        trigger: { source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }] },
        content: async () => {},
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }
      registry.register(effect)

      const card = createShaCard()
      card.effectIds = ['once-per-turn']
      card.zone = ZoneType.Hand
      card.owner = player1
      card.visibleTo = [player1]
      player1.handCards.push(card)

      await compiler.compile(card, player1, [player2])

      expect(effect.usedThisTurn).toBe(true)
    })

    it('should mark once effects as fully used', async () => {
      const effect: IEffect = {
        id: 'once',
        name: 'Once',
        description: '',
        type: SkillType.Active,
        priority: 0,
        frequency: Frequency.Once,
        trigger: { source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }] },
        content: async () => {},
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }
      registry.register(effect)

      const card = createShaCard()
      card.effectIds = ['once']
      card.zone = ZoneType.Hand
      card.owner = player1
      card.visibleTo = [player1]
      player1.handCards.push(card)

      await compiler.compile(card, player1, [player2])

      expect(effect.usedThisTurn).toBe(true)
      expect(effect.usedThisRound).toBe(true)
    })
  })
})
