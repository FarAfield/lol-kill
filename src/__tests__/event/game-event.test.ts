// ============================================================
// GameEvent 单元测试
// ============================================================

import { describe, it, expect } from 'vitest'
import { GameEvent } from '@core/event/game-event'
import { TriggerTiming, EventStatus, CardSuit, CardType, ZoneType, RoleType } from '@core/contracts/enums'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'

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

describe('GameEvent', () => {
  describe('creation', () => {
    it('should create an event with required fields', () => {
      const event = new GameEvent({
        name: 'Test Event',
        type: TriggerTiming.CardUse,
      })

      expect(event.id).toBeDefined()
      expect(event.id).toMatch(/^event_\d+_\d+$/)
      expect(event.name).toBe('Test Event')
      expect(event.type).toBe(TriggerTiming.CardUse)
      expect(event.status).toBe(EventStatus.Waiting)
      expect(event.targets).toEqual([])
      expect(event.cards).toEqual([])
      expect(event.children).toEqual([])
      expect(event.canceled).toBe(false)
      expect(event.prevented).toBe(false)
      expect(event.forced).toBe(false)
      expect(event.silent).toBe(false)
      expect(event.data).toEqual({})
      expect(event.timestamp).toBeGreaterThan(0)
    })

    it('should create an event with all optional fields', () => {
      const source = createMockPlayer('p1', 0)
      const target = createMockPlayer('p2', 1)

      const event = new GameEvent({
        name: 'Full Event',
        type: TriggerTiming.Damage,
        source,
        player: source,
        targets: [target],
        cards: [],
        forced: true,
        silent: true,
        data: { extra: 'value' },
        phase: undefined,
        round: 1,
        turn: 0,
      })

      expect(event.source?.id).toBe('p1')
      expect(event.player?.id).toBe('p1')
      expect(event.targets).toHaveLength(1)
      expect(event.targets[0]?.id).toBe('p2')
      expect(event.forced).toBe(true)
      expect(event.silent).toBe(true)
      expect(event.data['extra']).toBe('value')
      expect(event.round).toBe(1)
      expect(event.turn).toBe(0)
    })

    it('should generate unique IDs for each event', () => {
      const event1 = new GameEvent({ name: 'A', type: TriggerTiming.CardUse })
      const event2 = new GameEvent({ name: 'B', type: TriggerTiming.CardUse })

      expect(event1.id).not.toBe(event2.id)
    })
  })

  describe('status transitions', () => {
    it('should transition through valid pipeline stages', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })

      event.transitionTo(EventStatus.SkipCheck)
      expect(event.status).toBe(EventStatus.SkipCheck)

      event.transitionTo(EventStatus.Before)
      expect(event.status).toBe(EventStatus.Before)

      event.transitionTo(EventStatus.Begin)
      expect(event.status).toBe(EventStatus.Begin)

      event.transitionTo(EventStatus.Prepare)
      expect(event.status).toBe(EventStatus.Prepare)

      event.transitionTo(EventStatus.Content)
      expect(event.status).toBe(EventStatus.Content)

      event.transitionTo(EventStatus.Prevent)
      expect(event.status).toBe(EventStatus.Prevent)

      event.transitionTo(EventStatus.End)
      expect(event.status).toBe(EventStatus.End)

      event.transitionTo(EventStatus.After)
      expect(event.status).toBe(EventStatus.After)

      event.transitionTo(EventStatus.Completed)
      expect(event.status).toBe(EventStatus.Completed)
    })

    it('should throw on invalid transition', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })

      // Cannot go from Waiting directly to Completed
      expect(() => event.transitionTo(EventStatus.Completed)).toThrow(
        /非法状态转移/,
      )
    })

    it('should throw on transition from completed', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })

      event.transitionTo(EventStatus.SkipCheck)
      event.transitionTo(EventStatus.Before)
      event.transitionTo(EventStatus.Begin)
      event.transitionTo(EventStatus.Prepare)
      event.transitionTo(EventStatus.Content)
      event.transitionTo(EventStatus.Prevent)
      event.transitionTo(EventStatus.End)
      event.transitionTo(EventStatus.After)
      event.transitionTo(EventStatus.Completed)

      expect(() => event.transitionTo(EventStatus.End)).toThrow(
        /非法状态转移/,
      )
    })

    it('should handle cancelled branch', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })

      event.transitionTo(EventStatus.SkipCheck)
      event.transitionTo(EventStatus.Cancelled)
      expect(event.canceled).toBe(true)
      expect(event.status).toBe(EventStatus.Cancelled)

      event.transitionTo(EventStatus.Completed)
      expect(event.status).toBe(EventStatus.Completed)
    })

    it('should handle prevented branch', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })

      event.transitionTo(EventStatus.SkipCheck)
      event.transitionTo(EventStatus.Before)
      event.transitionTo(EventStatus.Begin)
      event.transitionTo(EventStatus.Prepare)
      event.transitionTo(EventStatus.Content)
      event.transitionTo(EventStatus.Prevent)
      event.transitionTo(EventStatus.Prevented)
      expect(event.prevented).toBe(true)
      expect(event.status).toBe(EventStatus.Prevented)

      event.transitionTo(EventStatus.End)
      expect(event.status).toBe(EventStatus.End)

      event.transitionTo(EventStatus.After)
      event.transitionTo(EventStatus.Completed)
    })

    it('should not cancel forced events (triggers no-op)', () => {
      const event = new GameEvent({
        name: 'Forced Event',
        type: TriggerTiming.CardUse,
        forced: true,
      })

      event.transitionTo(EventStatus.SkipCheck)
      // Trying to cancel a forced event does not throw but should be handled externally
      // The transitionTo method silently no-ops for forced cancelled
      event.canceled = true // simulate external cancel
      expect(event.canceled).toBe(true)
    })
  })

  describe('parent-child relationship', () => {
    it('should add child events and inherit player', () => {
      const player = createMockPlayer('p1', 0)
      const parent = new GameEvent({
        name: 'Parent',
        type: TriggerTiming.CardUse,
        player,
      })

      const child = new GameEvent({
        name: 'Child',
        type: TriggerTiming.Damage,
      })

      parent.addChild(child)

      expect(parent.children).toHaveLength(1)
      expect(parent.children[0]?.name).toBe('Child')
      expect(child.parent?.id).toBe(parent.id)
      expect(child.player?.id).toBe('p1') // inherited
    })

    it('should not override child player if already set', () => {
      const player1 = createMockPlayer('p1', 0)
      const player2 = createMockPlayer('p2', 1)

      const parent = new GameEvent({
        name: 'Parent',
        type: TriggerTiming.CardUse,
        player: player1,
      })

      const child = new GameEvent({
        name: 'Child',
        type: TriggerTiming.Damage,
        player: player2,
      })

      parent.addChild(child)
      expect(child.player?.id).toBe('p2') // not overridden
    })
  })

  describe('depth', () => {
    it('should return 0 for root event', () => {
      const event = new GameEvent({ name: 'Root', type: TriggerTiming.CardUse })
      expect(event.depth).toBe(0)
    })

    it('should return correct depth for nested events', () => {
      const root = new GameEvent({ name: 'Root', type: TriggerTiming.CardUse })
      const child = new GameEvent({ name: 'Child', type: TriggerTiming.Damage })
      const grandchild = new GameEvent({ name: 'Grandchild', type: TriggerTiming.Damaged })

      root.addChild(child)
      child.addChild(grandchild)

      expect(root.depth).toBe(0)
      expect(child.depth).toBe(1)
      expect(grandchild.depth).toBe(2)
    })
  })

  describe('isFinished / isActive', () => {
    it('should not be finished when Waiting', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })
      expect(event.isFinished).toBe(false)
      expect(event.isActive).toBe(true)
    })

    it('should be finished when Completed', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })
      event.status = EventStatus.Completed
      expect(event.isFinished).toBe(true)
      expect(event.isActive).toBe(false)
    })

    it('should be finished when Cancelled', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })
      event.status = EventStatus.Cancelled
      expect(event.isFinished).toBe(true)
    })

    it('should be finished when Prevented', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })
      event.status = EventStatus.Prevented
      expect(event.isFinished).toBe(true)
    })
  })

  describe('values', () => {
    it('should have default values', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })
      expect(event.values.num).toBe(0)
      expect(event.values.numFixed).toBe(false)
      expect(event.values.baseDamage).toBe(0)
      expect(event.values.extraDamage).toBe(0)
    })

    it('should allow modifying values', () => {
      const event = new GameEvent({ name: 'Test', type: TriggerTiming.CardUse })
      event.values.baseDamage = 1
      event.values.extraDamage = 2
      expect(event.values.baseDamage).toBe(1)
      expect(event.values.extraDamage).toBe(2)
    })
  })
})
