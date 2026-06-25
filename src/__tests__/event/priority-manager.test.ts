// ============================================================
// PriorityManager 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { PriorityManager, sortHooks } from '@core/event/priority-manager'
import { TriggerTiming } from '@core/contracts/enums'
import type { EventHookRegistration } from '@core/contracts/event.interface'
import type { IPlayer } from '@core/contracts/player.interface'

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
    skillId: overrides.skillId ?? 'skill_default',
    player: overrides.player ?? createMockPlayer('p0', 0),
    priority: overrides.priority ?? 0,
    isLocked: overrides.isLocked ?? false,
    timing: overrides.timing ?? TriggerTiming.CardUse,
    stage: overrides.stage ?? 'Content',
    scope: overrides.scope ?? 'source',
  }
}

describe('sortHooks', () => {
  it('should sort by priority (higher first)', () => {
    const hooks = [
      createMockRegistration({ skillId: 'low', priority: 1 }),
      createMockRegistration({ skillId: 'high', priority: 10 }),
      createMockRegistration({ skillId: 'mid', priority: 5 }),
    ]

    const sorted = sortHooks(hooks)
    expect(sorted[0]?.skillId).toBe('high')
    expect(sorted[1]?.skillId).toBe('mid')
    expect(sorted[2]?.skillId).toBe('low')
  })

  it('should prioritize locked skills over non-locked', () => {
    const hooks = [
      createMockRegistration({ skillId: 'normal_high', priority: 100, isLocked: false }),
      createMockRegistration({ skillId: 'locked_low', priority: 1, isLocked: true }),
    ]

    const sorted = sortHooks(hooks)
    expect(sorted[0]?.skillId).toBe('locked_low')
    expect(sorted[1]?.skillId).toBe('normal_high')
  })

  it('should deduplicate by skillId (keep highest priority)', () => {
    const hooks = [
      createMockRegistration({ skillId: 'same', priority: 5 }),
      createMockRegistration({ skillId: 'same', priority: 10 }),
      createMockRegistration({ skillId: 'same', priority: 1 }),
    ]

    const sorted = sortHooks(hooks, true)
    expect(sorted).toHaveLength(1)
    expect(sorted[0]?.priority).toBe(10) // highest priority kept
  })

  it('should not deduplicate when deduplication is disabled', () => {
    const hooks = [
      createMockRegistration({ skillId: 'same', priority: 5 }),
      createMockRegistration({ skillId: 'same', priority: 10 }),
    ]

    const sorted = sortHooks(hooks, false)
    expect(sorted).toHaveLength(2)
  })

  it('should maintain stable order for equal priority', () => {
    const hooks = [
      createMockRegistration({ skillId: 'a', priority: 5 }),
      createMockRegistration({ skillId: 'b', priority: 5 }),
    ]

    const sorted = sortHooks(hooks)
    expect(sorted[0]?.skillId).toBe('a')
    expect(sorted[1]?.skillId).toBe('b')
  })

  it('should return empty array for empty input', () => {
    expect(sortHooks([])).toEqual([])
  })
})

describe('PriorityManager', () => {
  let manager: PriorityManager

  beforeEach(() => {
    manager = new PriorityManager()
  })

  describe('prioritize', () => {
    it('should sort and deduplicate hooks', () => {
      const hooks = [
        createMockRegistration({ skillId: 'b', priority: 5 }),
        createMockRegistration({ skillId: 'a', priority: 10 }),
        createMockRegistration({ skillId: 'b', priority: 3 }),
      ]

      const result = manager.prioritize(hooks)
      expect(result).toHaveLength(2)
      expect(result[0]?.skillId).toBe('a') // highest priority
      expect(result[1]?.skillId).toBe('b') // deduped, highest kept
    })
  })

  describe('sortBySeatOrder', () => {
    it('should sort by seat order when priority is equal', () => {
      const hooks = [
        createMockRegistration({
          skillId: 'seat_2',
          priority: 5,
          player: createMockPlayer('p2', 2),
        }),
        createMockRegistration({
          skillId: 'seat_0',
          priority: 5,
          player: createMockPlayer('p0', 0),
        }),
        createMockRegistration({
          skillId: 'seat_1',
          priority: 5,
          player: createMockPlayer('p1', 1),
        }),
      ]

      const result = manager.sortBySeatOrder(hooks)
      expect(result[0]?.skillId).toBe('seat_0')
      expect(result[1]?.skillId).toBe('seat_1')
      expect(result[2]?.skillId).toBe('seat_2')
    })

    it('should prioritize locked skills over seat order', () => {
      const hooks = [
        createMockRegistration({
          skillId: 'normal_seat0',
          priority: 5,
          isLocked: false,
          player: createMockPlayer('p0', 0),
        }),
        createMockRegistration({
          skillId: 'locked_seat7',
          priority: 5,
          isLocked: true,
          player: createMockPlayer('p7', 7),
        }),
      ]

      const result = manager.sortBySeatOrder(hooks)
      expect(result[0]?.skillId).toBe('locked_seat7')
    })
  })

  describe('groupByPlayer', () => {
    it('should group hooks by player id', () => {
      const p1 = createMockPlayer('p1', 0)
      const p2 = createMockPlayer('p2', 1)

      const hooks = [
        createMockRegistration({ skillId: 's1', player: p1 }),
        createMockRegistration({ skillId: 's2', player: p1 }),
        createMockRegistration({ skillId: 's3', player: p2 }),
      ]

      const groups = manager.groupByPlayer(hooks)
      expect(groups.size).toBe(2)
      expect(groups.get('p1')).toHaveLength(2)
      expect(groups.get('p2')).toHaveLength(1)
    })
  })

  describe('prioritizeNoDedup', () => {
    it('should sort without deduplicating', () => {
      const hooks = [
        createMockRegistration({ skillId: 'same', priority: 3 }),
        createMockRegistration({ skillId: 'same', priority: 5 }),
      ]

      const result = manager.prioritizeNoDedup(hooks)
      expect(result).toHaveLength(2)
      expect(result[0]?.priority).toBe(5)
    })
  })
})
