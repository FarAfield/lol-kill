// ============================================================
// EventDispatcher 单元测试
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { EventChain } from '@core/event/event-chain'
import { GameEvent } from '@core/event/game-event'
import { EventStatus, TriggerTiming } from '@core/contracts/enums'
import type { IGameEvent } from '@core/contracts/event.interface'

describe('EventDispatcher', () => {
  let dispatcher: EventDispatcher
  let chain: EventChain
  const stagesVisited: string[] = []

  beforeEach(() => {
    chain = new EventChain()
    dispatcher = new EventDispatcher({
      onStageChange: (_event, stage) => {
        stagesVisited.push(stage)
      },
    })
    stagesVisited.length = 0
  })

  describe('basic pipeline', () => {
    it('should process an event through all pipeline stages', async () => {
      const event = new GameEvent({
        name: 'Test Event',
        type: TriggerTiming.CardUse,
      })

      await dispatcher.dispatch(event, chain)

      // Should have traversed all stages in order
      expect(stagesVisited).toEqual([
        'Before',
        'Begin',
        'Prepare',
        'Content',
        'Prevent',
        'End',
        'After',
      ])
      expect(event.status).toBe(EventStatus.Completed)
    })

    it('should end with Completed status', async () => {
      const event = new GameEvent({
        name: 'Test Event',
        type: TriggerTiming.CardUse,
      })

      await dispatcher.dispatch(event, chain)
      expect(event.status).toBe(EventStatus.Completed)
    })

    it('should pop event from chain after completion', async () => {
      const event = new GameEvent({
        name: 'Test Event',
        type: TriggerTiming.CardUse,
      })

      await dispatcher.dispatch(event, chain)
      expect(chain.isEmpty()).toBe(true)
    })

    it('should not double-push if event is already on top of chain', async () => {
      const event = new GameEvent({
        name: 'Test Event',
        type: TriggerTiming.CardUse,
      })

      chain.push(event) // pre-push
      expect(chain.depth).toBe(1)

      await dispatcher.dispatch(event, chain)
      expect(chain.isEmpty()).toBe(true)
      expect(event.status).toBe(EventStatus.Completed)
    })
  })

  describe('hooks execution', () => {
    it('should execute registered hooks at the right stage', async () => {
      const beforeHook = vi.fn()
      const contentHook = vi.fn()
      const afterHook = vi.fn()

      dispatcher.eventTrigger.registerCompiled({
        execute: beforeHook,
        skillId: 'before_skill',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Before',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      dispatcher.eventTrigger.registerCompiled({
        execute: contentHook,
        skillId: 'content_skill',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      dispatcher.eventTrigger.registerCompiled({
        execute: afterHook,
        skillId: 'after_skill',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'After',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      const event = new GameEvent({
        name: 'Test Event',
        type: TriggerTiming.CardUse,
      })

      await dispatcher.dispatch(event, chain)

      expect(beforeHook).toHaveBeenCalledTimes(1)
      expect(contentHook).toHaveBeenCalledTimes(1)
      expect(afterHook).toHaveBeenCalledTimes(1)
    })

    it('should execute hooks in priority order', async () => {
      const executionOrder: string[] = []

      dispatcher.eventTrigger.registerCompiled({
        execute:async () => { executionOrder.push('low') },
        skillId: 'low_priority',
        playerId: 'any',
        priority: 1,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      dispatcher.eventTrigger.registerCompiled({
        execute:async () => { executionOrder.push('mid') },
        skillId: 'mid_priority',
        playerId: 'any',
        priority: 5,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      dispatcher.eventTrigger.registerCompiled({
        execute:async () => { executionOrder.push('high') },
        skillId: 'high_priority',
        playerId: 'any',
        priority: 10,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      const event = new GameEvent({
        name: 'Test Event',
        type: TriggerTiming.CardUse,
      })

      await dispatcher.dispatch(event, chain)
      expect(executionOrder).toEqual(['high', 'mid', 'low'])
    })

    it('should not execute hooks when stage has no matching hooks', async () => {
      const hook = vi.fn()
      dispatcher.eventTrigger.registerCompiled({
        hook,
        skillId: 'damage_only',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.Damage, // different timing
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      const event = new GameEvent({
        name: 'Card Use Event',
        type: TriggerTiming.CardUse,
      })

      await dispatcher.dispatch(event, chain)
      expect(hook).not.toHaveBeenCalled()
    })
  })

  describe('cancelled branch', () => {
    it('should route to Cancelled when event.canceled is set before SkipCheck', async () => {
      const event = new GameEvent({
        name: 'Cancellable Event',
        type: TriggerTiming.CardUse,
      })

      // Simulate external cancellation (无懈可击-style):
      // Set canceled before the dispatcher reaches SkipCheck
      // We do this by pre-setting canceled on the event
      event.canceled = true

      await dispatcher.dispatch(event, chain)

      // Should be cancelled and completed
      expect(event.canceled).toBe(true)
      expect(event.status).toBe(EventStatus.Completed)
    })

    it('should not enter Content stage when cancelled', async () => {
      const contentHook = vi.fn()
      dispatcher.eventTrigger.registerCompiled({
        execute:contentHook,
        skillId: 'content_skill',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      const event = new GameEvent({
        name: 'Cancellable Event',
        type: TriggerTiming.CardUse,
      })
      event.canceled = true

      await dispatcher.dispatch(event, chain)

      expect(contentHook).not.toHaveBeenCalled()
    })
  })

  describe('prevented branch', () => {
    it('should handle prevented events', async () => {
      const event = new GameEvent({
        name: 'Preventable Event',
        type: TriggerTiming.CardUse,
      })

      // Hook at Prevent stage that prevents the event
      dispatcher.eventTrigger.registerCompiled({
        execute:async (evt) => {
          evt.prevented = true
        },
        skillId: 'preventer',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Prevent',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      await dispatcher.dispatch(event, chain)

      // Should go through Prevented branch and complete
      expect(event.prevented).toBe(true)
      expect(event.status).toBe(EventStatus.Completed)
    })

    it('should still visit End and After stages when prevented', async () => {
      const event = new GameEvent({
        name: 'Preventable Event',
        type: TriggerTiming.CardUse,
      })

      dispatcher.eventTrigger.registerCompiled({
        execute:async (evt) => {
          evt.prevented = true
        },
        skillId: 'preventer',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Prevent',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      await dispatcher.dispatch(event, chain)

      // Prevented sub-flow should visit End and After
      expect(stagesVisited).toContain('End')
      expect(stagesVisited).toContain('After')
    })
  })

  describe('forced events', () => {
    it('should complete normally for forced events', async () => {
      const event = new GameEvent({
        name: 'Forced Event',
        type: TriggerTiming.CardUse,
        forced: true,
      })

      await dispatcher.dispatch(event, chain)
      expect(event.status).toBe(EventStatus.Completed)
    })

    it('should not cancel forced events even if canceled is set', async () => {
      const event = new GameEvent({
        name: 'Forced Event',
        type: TriggerTiming.CardUse,
        forced: true,
      })
      event.canceled = true // try to cancel

      await dispatcher.dispatch(event, chain)

      // Forced events skip the cancellation check, so they complete normally
      expect(event.status).toBe(EventStatus.Completed)
    })
  })

  describe('nested events', () => {
    it('should process child events pushed during Content phase (LIFO)', async () => {
      const executionOrder: string[] = []

      const eventA = new GameEvent({
        name: 'Parent Event',
        type: TriggerTiming.CardUse,
      })

      // Hook that pushes a child event during Content
      dispatcher.eventTrigger.registerCompiled({
        execute:async (_evt) => {
          executionOrder.push('A_Content')

          // Create and push a child event to chain
          const eventB = new GameEvent({
            name: 'Child Event',
            type: TriggerTiming.Damage,
          })

          // Register a hook for the child
          dispatcher.eventTrigger.registerCompiled({
            execute:async () => {
              executionOrder.push('B_Content')
            },
            skillId: 'child_hook',
            playerId: 'any',
            priority: 0,
            isLocked: false,
            timing: TriggerTiming.Damage,
            stage: 'Content',
            scope: 'global',
          })

          chain.push(eventB)
        },
        skillId: 'parent_hook',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      await dispatcher.dispatch(eventA, chain)

      // Child (B) should process before parent (A) continues — LIFO
      expect(executionOrder).toEqual(['A_Content', 'B_Content'])
      expect(eventA.status).toBe(EventStatus.Completed)
      // Chain should be empty
      expect(chain.isEmpty()).toBe(true)
    })

    it('should link child events to parent', async () => {
      const eventA = new GameEvent({
        name: 'Parent Event',
        type: TriggerTiming.CardUse,
      })

      dispatcher.eventTrigger.registerCompiled({
        execute:async (_evt) => {
          const eventB = new GameEvent({
            name: 'Child Event',
            type: TriggerTiming.Damage,
          })
          chain.push(eventB)
        },
        skillId: 'parent_hook',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      await dispatcher.dispatch(eventA, chain)

      // Child should be linked as child of parent
      expect(eventA.children).toHaveLength(1)
      expect(eventA.children[0]?.name).toBe('Child Event')
      expect(eventA.children[0]?.parent?.id).toBe(eventA.id)
    })

    it('should process deeply nested events', async () => {
      const order: string[] = []

      const eventA = new GameEvent({ name: 'A', type: TriggerTiming.CardUse })

      dispatcher.eventTrigger.registerCompiled({
        execute:async (_evt) => {
          order.push('A')
          const eventB = new GameEvent({ name: 'B', type: TriggerTiming.Damage })

          dispatcher.eventTrigger.registerCompiled({
            execute:async (_e) => {
              order.push('B')
              const eventC = new GameEvent({ name: 'C', type: TriggerTiming.Damaged })
              chain.push(eventC)
            },
            skillId: 'hook_b',
            playerId: 'any',
            priority: 0,
            isLocked: false,
            timing: TriggerTiming.Damage,
            stage: 'Content',
            scope: 'global',
          })

          chain.push(eventB)
        },
        skillId: 'hook_a',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      await dispatcher.dispatch(eventA, chain)

      // LIFO: C before B, B before A continuation
      expect(order).toEqual(['A', 'B'])
      expect(chain.isEmpty()).toBe(true)
    })
  })

  describe('maxDepth', () => {
    it('should throw when exceeding max depth via parent chain nesting', async () => {
      const dispatcherLimited = new EventDispatcher({ maxDepth: 1 })

      // Build a parent chain: event1 (depth 0) → event2 (depth 1) → event3 (depth 2)
      // maxDepth=1 means depth 1 is allowed, depth 2 should throw
      const rootEvent = new GameEvent({
        name: 'Root Event',
        type: TriggerTiming.CardUse,
      })

      const childEvent = new GameEvent({
        name: 'Child Event',
        type: TriggerTiming.CardUse,
        parent: rootEvent,
      })

      // event3 has parent chain: rootEvent → childEvent → event3 (depth=2)
      const event3 = new GameEvent({
        name: 'Event 3',
        type: TriggerTiming.CardUse,
        parent: childEvent,
      })

      // dispatch event as if it were triggered; depth 2 >= maxDepth 1
      await expect(dispatcherLimited.dispatch(event3, chain)).rejects.toThrow(
        /事件嵌套深度超过上限/,
      )
    })

    it('should not throw when parent chain depth is within limit', async () => {
      const dispatcherLenient = new EventDispatcher({ maxDepth: 3 })

      const rootEvent = new GameEvent({
        name: 'Root Event',
        type: TriggerTiming.CardUse,
      })

      const childEvent = new GameEvent({
        name: 'Child Event',
        type: TriggerTiming.CardUse,
        parent: rootEvent,
      })

      // depth = 1 (parent is rootEvent), maxDepth=3 → should not throw
      await dispatcherLenient.dispatch(childEvent, chain)
      expect(childEvent.status).toBe(EventStatus.Completed)
    })
  })

  describe('dispatchAll', () => {
    it('should dispatch all events in chain until empty', async () => {
      const event1 = new GameEvent({
        name: 'Event 1',
        type: TriggerTiming.CardUse,
      })

      const event2 = new GameEvent({
        name: 'Event 2',
        type: TriggerTiming.Damage,
      })

      chain.push(event1)
      chain.push(event2)

      await dispatcher.dispatchAll(chain)

      expect(chain.isEmpty()).toBe(true)
      expect(event1.status).toBe(EventStatus.Completed)
      expect(event2.status).toBe(EventStatus.Completed)
    })
  })

  describe('error handling', () => {
    it('should throw by default when hook throws', async () => {
      dispatcher.eventTrigger.registerCompiled({
        execute:async () => {
          throw new Error('Hook error')
        },
        skillId: 'failing_hook',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      const event = new GameEvent({
        name: 'Test Event',
        type: TriggerTiming.CardUse,
      })

      await expect(dispatcher.dispatch(event, chain)).rejects.toThrow('Hook error')
    })

    it('should continue when continueOnError is true', async () => {
      const onError = vi.fn()
      const dispatcherLenient = new EventDispatcher({
        continueOnError: true,
        onError,
      })

      dispatcherLenient.eventTrigger.registerCompiled({
        execute:async () => {
          throw new Error('Hook error')
        },
        skillId: 'failing_hook',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      const event = new GameEvent({
        name: 'Test Event',
        type: TriggerTiming.CardUse,
      })

      // Should not throw
      await dispatcherLenient.dispatch(event, chain)
      expect(onError).toHaveBeenCalled()
      expect(event.status).toBe(EventStatus.Completed)
    })
  })

  describe('onHandlerExecute callback', () => {
    it('should call onHandlerExecute for each hook', async () => {
      const onHandlerExecute = vi.fn()
      const dispatcherWithCallback = new EventDispatcher({ onHandlerExecute })

      dispatcherWithCallback.eventTrigger.registerCompiled({
        execute:async () => {},
        skillId: 'test_skill',
        playerId: 'any',
        priority: 0,
        isLocked: false,
        timing: TriggerTiming.CardUse,
        stage: 'Content',
        scope: 'global',
        frequency: 'unlimited' as const,
        enabled: true,
        usedThisTurn: false,
        usedThisRound: false,
      })

      const event = new GameEvent({
        name: 'Test Event',
        type: TriggerTiming.CardUse,
      })

      await dispatcherWithCallback.dispatch(event, chain)
      expect(onHandlerExecute).toHaveBeenCalledTimes(1)
    })
  })
})
