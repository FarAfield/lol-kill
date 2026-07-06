// ============================================================
// PriorityManager 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { PriorityManager, sortHandlers } from '@core/event/priority-manager'
import { TriggerTiming, Frequency } from '@core/contracts/enums'
import type { CompiledHandler } from '@core/contracts/compiled-handler'

function createMockHandler(overrides: Partial<CompiledHandler> = {}): CompiledHandler {
  return {
    timing: overrides.timing ?? TriggerTiming.CardUse,
    stage: overrides.stage ?? 'Content',
    scope: overrides.scope ?? 'source',
    skillId: overrides.skillId ?? 'skill_default',
    playerId: overrides.playerId ?? 'p0',
    priority: overrides.priority ?? 0,
    isLocked: overrides.isLocked ?? false,
    frequency: overrides.frequency ?? Frequency.Unlimited,
    usedThisTurn: overrides.usedThisTurn ?? false,
    usedThisRound: overrides.usedThisRound ?? false,
    execute: overrides.execute ?? (async () => {}),
  }
}

describe('sortHandlers', () => {
  it('should sort by priority (higher first)', () => {
    const handlers = [
      createMockHandler({ skillId: 'low', priority: 1 }),
      createMockHandler({ skillId: 'high', priority: 10 }),
      createMockHandler({ skillId: 'mid', priority: 5 }),
    ]

    const sorted = sortHandlers(handlers)
    expect(sorted[0]?.skillId).toBe('high')
    expect(sorted[1]?.skillId).toBe('mid')
    expect(sorted[2]?.skillId).toBe('low')
  })

  it('should prioritize locked skills over non-locked', () => {
    const handlers = [
      createMockHandler({ skillId: 'normal_high', priority: 100, isLocked: false }),
      createMockHandler({ skillId: 'locked_low', priority: 1, isLocked: true }),
    ]

    const sorted = sortHandlers(handlers)
    expect(sorted[0]?.skillId).toBe('locked_low')
    expect(sorted[1]?.skillId).toBe('normal_high')
  })

  it('should deduplicate by skillId (keep highest priority)', () => {
    const handlers = [
      createMockHandler({ skillId: 'same', priority: 5 }),
      createMockHandler({ skillId: 'same', priority: 10 }),
      createMockHandler({ skillId: 'same', priority: 1 }),
    ]

    const sorted = sortHandlers(handlers, true)
    expect(sorted).toHaveLength(1)
    expect(sorted[0]?.priority).toBe(10)
  })

  it('should not deduplicate when deduplication is disabled', () => {
    const handlers = [
      createMockHandler({ skillId: 'same', priority: 5 }),
      createMockHandler({ skillId: 'same', priority: 10 }),
    ]

    const sorted = sortHandlers(handlers, false)
    expect(sorted).toHaveLength(2)
  })

  it('should maintain stable order for equal priority', () => {
    const handlers = [
      createMockHandler({ skillId: 'a', priority: 5 }),
      createMockHandler({ skillId: 'b', priority: 5 }),
    ]

    const sorted = sortHandlers(handlers)
    expect(sorted[0]?.skillId).toBe('a')
    expect(sorted[1]?.skillId).toBe('b')
  })

  it('should return empty array for empty input', () => {
    expect(sortHandlers([])).toEqual([])
  })
})

describe('PriorityManager', () => {
  let manager: PriorityManager

  beforeEach(() => {
    manager = new PriorityManager()
  })

  describe('prioritize', () => {
    it('should sort and deduplicate handlers', () => {
      const handlers = [
        createMockHandler({ skillId: 'b', priority: 5 }),
        createMockHandler({ skillId: 'a', priority: 10 }),
        createMockHandler({ skillId: 'b', priority: 3 }),
      ]

      const result = manager.prioritize(handlers)
      expect(result).toHaveLength(2)
      expect(result[0]?.skillId).toBe('a')
      expect(result[1]?.skillId).toBe('b')
    })
  })

  describe('sortBySeatOrder', () => {
    it('should sort by seat order when priority is equal', () => {
      const playerSeats = new Map<string, number>([
        ['p2', 2],
        ['p0', 0],
        ['p1', 1],
      ])

      const handlers = [
        createMockHandler({ skillId: 'seat_2', priority: 5, playerId: 'p2' }),
        createMockHandler({ skillId: 'seat_0', priority: 5, playerId: 'p0' }),
        createMockHandler({ skillId: 'seat_1', priority: 5, playerId: 'p1' }),
      ]

      const result = manager.sortBySeatOrder(handlers, playerSeats)
      expect(result[0]?.skillId).toBe('seat_0')
      expect(result[1]?.skillId).toBe('seat_1')
      expect(result[2]?.skillId).toBe('seat_2')
    })

    it('should prioritize locked skills over seat order', () => {
      const playerSeats = new Map<string, number>([
        ['p0', 0],
        ['p7', 7],
      ])

      const handlers = [
        createMockHandler({ skillId: 'normal_seat0', priority: 5, isLocked: false, playerId: 'p0' }),
        createMockHandler({ skillId: 'locked_seat7', priority: 5, isLocked: true, playerId: 'p7' }),
      ]

      const result = manager.sortBySeatOrder(handlers, playerSeats)
      expect(result[0]?.skillId).toBe('locked_seat7')
    })
  })

  describe('groupByPlayer', () => {
    it('should group handlers by player id', () => {
      const handlers = [
        createMockHandler({ skillId: 's1', playerId: 'p1' }),
        createMockHandler({ skillId: 's2', playerId: 'p1' }),
        createMockHandler({ skillId: 's3', playerId: 'p2' }),
      ]

      const groups = manager.groupByPlayer(handlers)
      expect(groups.size).toBe(2)
      expect(groups.get('p1')).toHaveLength(2)
      expect(groups.get('p2')).toHaveLength(1)
    })
  })

  describe('prioritizeNoDedupe', () => {
    it('should sort without deduplicating', () => {
      const handlers = [
        createMockHandler({ skillId: 'same', priority: 3 }),
        createMockHandler({ skillId: 'same', priority: 5 }),
      ]

      const result = manager.prioritizeNoDedupe(handlers)
      expect(result).toHaveLength(2)
      expect(result[0]?.priority).toBe(5)
    })
  })
})
