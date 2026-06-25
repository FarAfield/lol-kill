// ============================================================
// EventTrigger 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { EventTrigger } from '@core/event/event-trigger'
import { TriggerTiming, SkillType, Frequency } from '@core/contracts/enums'
import { GameEvent } from '@core/event/game-event'
import type { EventHookRegistration } from '@core/contracts/event.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { IEffect } from '@core/contracts/effect.interface'

function createMockPlayer(id: string, seatIndex: number): IPlayer {
  return {
    id,
    seatIndex,
    alive: true,
    hp: 4,
    maxHp: 4,
    power: 0,
    maxPower: 0,
    handCards: [],
    equipCards: [],
    judgeCards: [],
    heroes: [],
    role: undefined,
    roleRevealed: false,
    usedAttackThisTurn: false,
    attackLimit: 1,
    shouldSkipPhases: [],
    skippedPhases: [],
    marks: new Map(),
  }
}

function createMockRegistration(overrides: Partial<EventHookRegistration> = {}): EventHookRegistration {
  return {
    hook: async () => {},
    skillId: overrides.skillId ?? 'skill_test',
    player: overrides.player ?? createMockPlayer('p0', 0),
    priority: overrides.priority ?? 0,
    isLocked: overrides.isLocked ?? false,
    timing: overrides.timing ?? TriggerTiming.CardUse,
    stage: overrides.stage ?? 'Content',
    scope: overrides.scope ?? 'source',
  }
}

describe('EventTrigger', () => {
  let trigger: EventTrigger
  let player: IPlayer

  beforeEach(() => {
    trigger = new EventTrigger()
    player = createMockPlayer('p1', 0)
  })

  describe('register', () => {
    it('should register a hook', () => {
      const reg = createMockRegistration()
      trigger.register(reg)
      expect(trigger.count).toBe(1)
    })

    it('should register multiple hooks', () => {
      trigger.register(createMockRegistration({ skillId: 'a' }))
      trigger.register(createMockRegistration({ skillId: 'b' }))
      expect(trigger.count).toBe(2)
    })
  })

  describe('registerBatch', () => {
    it('should register hooks in batch', () => {
      trigger.registerBatch([
        createMockRegistration({ skillId: 'a' }),
        createMockRegistration({ skillId: 'b' }),
        createMockRegistration({ skillId: 'c' }),
      ])
      expect(trigger.count).toBe(3)
    })
  })

  describe('getMatchingHooks', () => {
    it('should match hooks by timing and stage', () => {
      trigger.register(
        createMockRegistration({
          skillId: 'matched',
          timing: TriggerTiming.CardUse,
          stage: 'Content',
          scope: 'global',
        }),
      )

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
      })

      const matches = trigger.getMatchingHooks(event, 'Content')
      expect(matches).toHaveLength(1)
      expect(matches[0]?.skillId).toBe('matched')
    })

    it('should not match hooks with different timing', () => {
      trigger.register(
        createMockRegistration({
          skillId: 'damage_hook',
          timing: TriggerTiming.Damage,
          stage: 'Content',
          scope: 'global',
        }),
      )

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
      })

      const matches = trigger.getMatchingHooks(event, 'Content')
      expect(matches).toHaveLength(0)
    })

    it('should not match hooks with different stage', () => {
      trigger.register(
        createMockRegistration({
          skillId: 'before_hook',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'global',
        }),
      )

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
      })

      const matches = trigger.getMatchingHooks(event, 'Content')
      expect(matches).toHaveLength(0)
    })

    it('should match source scope when player is event source', () => {
      const p1 = createMockPlayer('p1', 0)
      trigger.register(
        createMockRegistration({
          skillId: 'source_skill',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'source',
          player: p1,
        }),
      )

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p1,
      })

      const matches = trigger.getMatchingHooks(event, 'Before')
      expect(matches).toHaveLength(1)
    })

    it('should match source scope only when player is event.source', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.register(
        createMockRegistration({
          skillId: 'source_skill',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'source',
          player: p1,
        }),
      )

      // p1 is event.source → matches
      const event1 = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p1,
        player: p2, // driver is different
      })

      const matches1 = trigger.getMatchingHooks(event1, 'Before')
      expect(matches1).toHaveLength(1)

      // p1 is only event.player (NOT event.source) → should NOT match source scope
      const event2 = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p2,
        player: p1, // driver only, not source
      })

      const matches2 = trigger.getMatchingHooks(event2, 'Before')
      expect(matches2).toHaveLength(0)
    })

    it('should match player scope when player is event.player (driver)', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.register(
        createMockRegistration({
          skillId: 'player_skill',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'player',
          player: p1,
        }),
      )

      // p1 is event.player (driver) → matches
      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p2, // actual doer is different
        player: p1, // driver
      })

      const matches = trigger.getMatchingHooks(event, 'Before')
      expect(matches).toHaveLength(1)
    })

    it('should not match player scope when player is only event.source', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.register(
        createMockRegistration({
          skillId: 'player_skill',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'player',
          player: p1,
        }),
      )

      // p1 is event.source but NOT event.player → should NOT match player scope
      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p1,
        player: p2,
      })

      const matches = trigger.getMatchingHooks(event, 'Before')
      expect(matches).toHaveLength(0)
    })

    it('should not match source scope when player is neither source nor driver', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.register(
        createMockRegistration({
          skillId: 'source_skill',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'source',
          player: p1,
        }),
      )

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p2,
        player: p2,
      })

      const matches = trigger.getMatchingHooks(event, 'Before')
      expect(matches).toHaveLength(0)
    })

    it('should match target scope when player is in targets', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.register(
        createMockRegistration({
          skillId: 'target_skill',
          timing: TriggerTiming.CardTarget,
          stage: 'Before',
          scope: 'target',
          player: p1,
        }),
      )

      const event = new GameEvent({
        name: 'Target Players',
        type: TriggerTiming.CardTarget,
        source: p2,
        targets: [p1],
      })

      const matches = trigger.getMatchingHooks(event, 'Before')
      expect(matches).toHaveLength(1)
    })

    it('should not match target scope when player is not in targets', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)
      const p3 = createMockPlayer('p3', 2)

      trigger.register(
        createMockRegistration({
          skillId: 'target_skill',
          timing: TriggerTiming.CardTarget,
          stage: 'Before',
          scope: 'target',
          player: p1,
        }),
      )

      const event = new GameEvent({
        name: 'Target Players',
        type: TriggerTiming.CardTarget,
        source: p2,
        targets: [p3],
      })

      const matches = trigger.getMatchingHooks(event, 'Before')
      expect(matches).toHaveLength(0)
    })

    it('should always match global scope', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.register(
        createMockRegistration({
          skillId: 'global_skill',
          timing: TriggerTiming.Damage,
          stage: 'After',
          scope: 'global',
          player: p1,
        }),
      )

      // Event driven by p2, targeting p3 — global still matches
      const event = new GameEvent({
        name: 'Damage',
        type: TriggerTiming.Damage,
        source: p2,
        targets: [createMockPlayer('p3', 2)],
      })

      const matches = trigger.getMatchingHooks(event, 'After')
      expect(matches).toHaveLength(1)
    })
  })

  describe('unregister', () => {
    it('should unregister all hooks for a skill', () => {
      trigger.register(createMockRegistration({ skillId: 'a' }))
      trigger.register(createMockRegistration({ skillId: 'a', stage: 'Before' }))
      trigger.register(createMockRegistration({ skillId: 'b' }))

      trigger.unregister('a')
      expect(trigger.count).toBe(1)

      const all = trigger.getAllRegistrations()
      expect(all[0]?.skillId).toBe('b')
    })
  })

  describe('unregisterAll', () => {
    it('should unregister all hooks for a player', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.register(createMockRegistration({ skillId: 'a', player: p1 }))
      trigger.register(createMockRegistration({ skillId: 'b', player: p1 }))
      trigger.register(createMockRegistration({ skillId: 'c', player: p2 }))

      trigger.unregisterAll(p1)
      expect(trigger.count).toBe(1)

      const all = trigger.getAllRegistrations()
      expect(all[0]?.skillId).toBe('c')
    })
  })

  describe('clear', () => {
    it('should remove all registrations', () => {
      trigger.register(createMockRegistration({ skillId: 'a' }))
      trigger.register(createMockRegistration({ skillId: 'b' }))
      trigger.clear()
      expect(trigger.count).toBe(0)
    })
  })

  describe('registerEffect', () => {
    it('should register source triggers from an effect', () => {
      const effect: IEffect = {
        id: 'test_effect',
        name: 'Test Effect',
        description: 'A test effect',
        type: SkillType.Active,
        priority: 10,
        frequency: Frequency.Unlimited,
        trigger: {
          source: [{ timing: TriggerTiming.CardUse, stage: 'Before' }],
        },
        content: async () => {},
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }

      trigger.registerEffect({ effect, player })
      expect(trigger.count).toBe(1)

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: player,
      })

      const matches = trigger.getMatchingHooks(event, 'Before')
      expect(matches).toHaveLength(1)
      expect(matches[0]?.skillId).toBe('test_effect')
    })

    it('should register global triggers from an effect', () => {
      const effect: IEffect = {
        id: 'global_effect',
        name: 'Global Effect',
        description: 'Triggers on any damage',
        type: SkillType.Passive,
        priority: 0,
        frequency: Frequency.Unlimited,
        trigger: {
          global: [{ timing: TriggerTiming.Damage, stage: 'After' }],
        },
        content: async () => {},
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }

      trigger.registerEffect({ effect, player })

      const event = new GameEvent({
        name: 'Damage',
        type: TriggerTiming.Damage,
        source: createMockPlayer('p2', 1),
      })

      const matches = trigger.getMatchingHooks(event, 'After')
      expect(matches).toHaveLength(1)
    })

    it('should register target triggers from an effect', () => {
      const effect: IEffect = {
        id: 'target_effect',
        name: 'Target Effect',
        description: 'Triggers when targeted',
        type: SkillType.Passive,
        priority: 0,
        frequency: Frequency.Unlimited,
        trigger: {
          target: [{ timing: TriggerTiming.CardTarget, stage: 'Before' }],
        },
        content: async () => {},
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }

      trigger.registerEffect({ effect, player })

      const event = new GameEvent({
        name: 'Target',
        type: TriggerTiming.CardTarget,
        source: createMockPlayer('p2', 1),
        targets: [player],
      })

      const matches = trigger.getMatchingHooks(event, 'Before')
      expect(matches).toHaveLength(1)
    })

    it('should register triggers from all four scopes', () => {
      const effect: IEffect = {
        id: 'multi_scope',
        name: 'Multi Scope',
        description: 'Multiple scopes',
        type: SkillType.Passive,
        priority: 0,
        frequency: Frequency.Unlimited,
        trigger: {
          player: [{ timing: TriggerTiming.TurnStart, stage: 'Begin' }],
          source: [{ timing: TriggerTiming.CardUse, stage: 'Before' }],
          global: [{ timing: TriggerTiming.Damage, stage: 'After' }],
          target: [{ timing: TriggerTiming.CardTarget, stage: 'Before' }],
        },
        content: async () => {},
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }

      trigger.registerEffect({ effect, player })
      expect(trigger.count).toBe(4)
    })

    it('should respect isLocked from effect type', () => {
      const effect: IEffect = {
        id: 'locked_effect',
        name: 'Locked Effect',
        description: 'A locked effect',
        type: SkillType.Locked,
        priority: 5,
        frequency: Frequency.Unlimited,
        trigger: {
          source: [{ timing: TriggerTiming.CardUse, stage: 'Before' }],
        },
        content: async () => {},
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      }

      trigger.registerEffect({ effect, player })

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: player,
      })

      const matches = trigger.getMatchingHooks(event, 'Before')
      expect(matches).toHaveLength(1)
      expect(matches[0]?.isLocked).toBe(true)
    })
  })

  describe('unregisterBy', () => {
    it('should unregister hooks matching predicate', () => {
      trigger.register(createMockRegistration({ skillId: 'a', priority: 1 }))
      trigger.register(createMockRegistration({ skillId: 'b', priority: 1 }))
      trigger.register(createMockRegistration({ skillId: 'c', priority: 100 }))

      trigger.unregisterBy((reg) => reg.priority <= 1)
      expect(trigger.count).toBe(1)
      expect(trigger.getAllRegistrations()[0]?.skillId).toBe('c')
    })
  })
})
