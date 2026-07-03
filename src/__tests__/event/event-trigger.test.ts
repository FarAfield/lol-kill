// ============================================================
// EventTrigger 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { EventTrigger } from '@core/event/event-trigger'
import { EventCompiler } from '@core/event/event-compiler'
import { TriggerTiming, SkillType, Frequency } from '@core/contracts/enums'
import { GameEvent } from '@core/event/game-event'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
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

function createMockHandler(overrides: Partial<CompiledHandler> = {}): CompiledHandler {
  return {
    timing: overrides.timing ?? TriggerTiming.CardUse,
    stage: overrides.stage ?? 'Content',
    scope: overrides.scope ?? 'source',
    skillId: overrides.skillId ?? 'skill_test',
    playerId: overrides.playerId ?? 'p0',
    priority: overrides.priority ?? 0,
    isLocked: overrides.isLocked ?? false,
    frequency: overrides.frequency ?? Frequency.Unlimited,
    enabled: overrides.enabled ?? true,
    usedThisTurn: overrides.usedThisTurn ?? false,
    usedThisRound: overrides.usedThisRound ?? false,
    execute: overrides.execute ?? (async () => {}),
  }
}

describe('EventTrigger', () => {
  let trigger: EventTrigger
  let player: IPlayer
  let compiler: EventCompiler

  beforeEach(() => {
    trigger = new EventTrigger()
    player = createMockPlayer('p1', 0)
    compiler = new EventCompiler()
  })

  describe('registerCompiled', () => {
    it('should register a handler', () => {
      const handler = createMockHandler()
      trigger.registerCompiled(handler)
      expect(trigger.count).toBe(1)
    })

    it('should register multiple handlers', () => {
      trigger.registerCompiled(createMockHandler({ skillId: 'a' }))
      trigger.registerCompiled(createMockHandler({ skillId: 'b' }))
      expect(trigger.count).toBe(2)
    })
  })

  describe('registerCompiledBatch', () => {
    it('should register handlers in batch', () => {
      trigger.registerCompiledBatch([
        createMockHandler({ skillId: 'a' }),
        createMockHandler({ skillId: 'b' }),
        createMockHandler({ skillId: 'c' }),
      ])
      expect(trigger.count).toBe(3)
    })
  })

  describe('getMatchingHandlers', () => {
    it('should match handlers by timing and stage', () => {
      trigger.registerCompiled(
        createMockHandler({
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

      const matches = trigger.getMatchingHandlers(event, 'Content')
      expect(matches).toHaveLength(1)
      expect(matches[0]?.skillId).toBe('matched')
    })

    it('should not match handlers with different timing', () => {
      trigger.registerCompiled(
        createMockHandler({
          skillId: 'damage_handler',
          timing: TriggerTiming.Damage,
          stage: 'Content',
          scope: 'global',
        }),
      )

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
      })

      const matches = trigger.getMatchingHandlers(event, 'Content')
      expect(matches).toHaveLength(0)
    })

    it('should not match handlers with different stage', () => {
      trigger.registerCompiled(
        createMockHandler({
          skillId: 'before_handler',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'global',
        }),
      )

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
      })

      const matches = trigger.getMatchingHandlers(event, 'Content')
      expect(matches).toHaveLength(0)
    })

    it('should match source scope when playerId matches event.source', () => {
      const p1 = createMockPlayer('p1', 0)
      trigger.registerCompiled(
        createMockHandler({
          skillId: 'source_skill',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'source',
          playerId: p1.id,
        }),
      )

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p1,
      })

      const matches = trigger.getMatchingHandlers(event, 'Before')
      expect(matches).toHaveLength(1)
    })

    it('should match source scope only when playerId matches event.source', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.registerCompiled(
        createMockHandler({
          skillId: 'source_skill',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'source',
          playerId: p1.id,
        }),
      )

      // p1 is event.source → matches
      const event1 = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p1,
        player: p2,
      })

      const matches1 = trigger.getMatchingHandlers(event1, 'Before')
      expect(matches1).toHaveLength(1)

      // p1 is only event.player (NOT event.source) → should NOT match source scope
      const event2 = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p2,
        player: p1,
      })

      const matches2 = trigger.getMatchingHandlers(event2, 'Before')
      expect(matches2).toHaveLength(0)
    })

    it('should match player scope when playerId matches event.player', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.registerCompiled(
        createMockHandler({
          skillId: 'player_skill',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'player',
          playerId: p1.id,
        }),
      )

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p2,
        player: p1,
      })

      const matches = trigger.getMatchingHandlers(event, 'Before')
      expect(matches).toHaveLength(1)
    })

    it('should not match player scope when playerId is only event.source', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.registerCompiled(
        createMockHandler({
          skillId: 'player_skill',
          timing: TriggerTiming.CardUse,
          stage: 'Before',
          scope: 'player',
          playerId: p1.id,
        }),
      )

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: p1,
        player: p2,
      })

      const matches = trigger.getMatchingHandlers(event, 'Before')
      expect(matches).toHaveLength(0)
    })

    it('should match target scope when playerId is in event.targets', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.registerCompiled(
        createMockHandler({
          skillId: 'target_skill',
          timing: TriggerTiming.CardTarget,
          stage: 'Before',
          scope: 'target',
          playerId: p1.id,
        }),
      )

      const event = new GameEvent({
        name: 'Target Players',
        type: TriggerTiming.CardTarget,
        source: p2,
        targets: [p1],
      })

      const matches = trigger.getMatchingHandlers(event, 'Before')
      expect(matches).toHaveLength(1)
    })

    it('should not match target scope when playerId is not in targets', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)
      const p3 = createMockPlayer('p3', 2)

      trigger.registerCompiled(
        createMockHandler({
          skillId: 'target_skill',
          timing: TriggerTiming.CardTarget,
          stage: 'Before',
          scope: 'target',
          playerId: p1.id,
        }),
      )

      const event = new GameEvent({
        name: 'Target Players',
        type: TriggerTiming.CardTarget,
        source: p2,
        targets: [p3],
      })

      const matches = trigger.getMatchingHandlers(event, 'Before')
      expect(matches).toHaveLength(0)
    })

    it('should always match global scope', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.registerCompiled(
        createMockHandler({
          skillId: 'global_skill',
          timing: TriggerTiming.Damage,
          stage: 'After',
          scope: 'global',
          playerId: p1.id,
        }),
      )

      const event = new GameEvent({
        name: 'Damage',
        type: TriggerTiming.Damage,
        source: p2,
        targets: [createMockPlayer('p3', 2)],
      })

      const matches = trigger.getMatchingHandlers(event, 'After')
      expect(matches).toHaveLength(1)
    })
  })

  describe('unregister', () => {
    it('should unregister all handlers for a skill', () => {
      trigger.registerCompiled(createMockHandler({ skillId: 'a' }))
      trigger.registerCompiled(createMockHandler({ skillId: 'a', stage: 'Before' }))
      trigger.registerCompiled(createMockHandler({ skillId: 'b' }))

      trigger.unregister('a')
      expect(trigger.count).toBe(1)

      const all = trigger.getAllHandlers()
      expect(all[0]?.skillId).toBe('b')
    })
  })

  describe('unregisterAll', () => {
    it('should unregister all handlers for a player', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      trigger.registerCompiled(createMockHandler({ skillId: 'a', playerId: p1.id }))
      trigger.registerCompiled(createMockHandler({ skillId: 'b', playerId: p1.id }))
      trigger.registerCompiled(createMockHandler({ skillId: 'c', playerId: p2.id }))

      trigger.unregisterAll(p1)
      expect(trigger.count).toBe(1)

      const all = trigger.getAllHandlers()
      expect(all[0]?.skillId).toBe('c')
    })
  })

  describe('clear', () => {
    it('should remove all registrations', () => {
      trigger.registerCompiled(createMockHandler({ skillId: 'a' }))
      trigger.registerCompiled(createMockHandler({ skillId: 'b' }))
      trigger.clear()
      expect(trigger.count).toBe(0)
    })
  })

  describe('compile & register through EventCompiler', () => {
    it('should register source triggers from an effect via compiler', () => {
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

      const handlers = compiler.compile(effect, player)
      trigger.registerCompiledBatch(handlers)
      expect(trigger.count).toBe(1)

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: player,
      })

      const matches = trigger.getMatchingHandlers(event, 'Before')
      expect(matches).toHaveLength(1)
      expect(matches[0]?.skillId).toBe('test_effect')
    })

    it('should register global triggers from an effect via compiler', () => {
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

      const handlers = compiler.compile(effect, player)
      trigger.registerCompiledBatch(handlers)

      const event = new GameEvent({
        name: 'Damage',
        type: TriggerTiming.Damage,
        source: createMockPlayer('p2', 1),
      })

      const matches = trigger.getMatchingHandlers(event, 'After')
      expect(matches).toHaveLength(1)
    })

    it('should register target triggers from an effect via compiler', () => {
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

      const handlers = compiler.compile(effect, player)
      trigger.registerCompiledBatch(handlers)

      const event = new GameEvent({
        name: 'Target',
        type: TriggerTiming.CardTarget,
        source: createMockPlayer('p2', 1),
        targets: [player],
      })

      const matches = trigger.getMatchingHandlers(event, 'Before')
      expect(matches).toHaveLength(1)
    })

    it('should register handlers for all four scopes', () => {
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

      const handlers = compiler.compile(effect, player)
      trigger.registerCompiledBatch(handlers)
      expect(trigger.count).toBe(4)
    })

    it('should set isLocked from effect type', () => {
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

      const handlers = compiler.compile(effect, player)
      trigger.registerCompiledBatch(handlers)

      const event = new GameEvent({
        name: 'Use Sha',
        type: TriggerTiming.CardUse,
        source: player,
      })

      const matches = trigger.getMatchingHandlers(event, 'Before')
      expect(matches).toHaveLength(1)
      expect(matches[0]?.isLocked).toBe(true)
    })
  })

  describe('unregisterBy', () => {
    it('should unregister handlers matching predicate', () => {
      trigger.registerCompiled(createMockHandler({ skillId: 'a', priority: 1 }))
      trigger.registerCompiled(createMockHandler({ skillId: 'b', priority: 1 }))
      trigger.registerCompiled(createMockHandler({ skillId: 'c', priority: 100 }))

      trigger.unregisterBy((handler) => handler.priority <= 1)
      expect(trigger.count).toBe(1)
      expect(trigger.getAllHandlers()[0]?.skillId).toBe('c')
    })
  })
})
