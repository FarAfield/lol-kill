// ============================================================
// EventChain 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { EventChain } from '@core/event/event-chain'
import { GameEvent } from '@core/event/game-event'
import { TriggerTiming } from '@core/contracts/enums'
import type { IGameEvent } from '@core/contracts/event.interface'

function createTestEvent(name: string, type: TriggerTiming = TriggerTiming.CardUse): IGameEvent {
  return new GameEvent({ name, type })
}

describe('EventChain', () => {
  let chain: EventChain

  beforeEach(() => {
    chain = new EventChain()
  })

  describe('push / pop (LIFO order)', () => {
    it('should push and pop events in LIFO order', () => {
      const eventA = createTestEvent('A')
      const eventB = createTestEvent('B')

      chain.push(eventA)
      chain.push(eventB)

      expect(chain.pop()).toBe(eventB)
      expect(chain.pop()).toBe(eventA)
    })

    it('should return null when popping empty stack', () => {
      expect(chain.pop()).toBeNull()
    })

    it('should handle nested scenario: push A → push B → pop B → pop A', () => {
      const eventA = createTestEvent('A')
      const eventB = createTestEvent('B')

      chain.push(eventA)
      chain.push(eventB)

      const poppedB = chain.pop()
      expect(poppedB?.name).toBe('B')

      const poppedA = chain.pop()
      expect(poppedA?.name).toBe('A')

      expect(chain.isEmpty()).toBe(true)
    })
  })

  describe('peek', () => {
    it('should return top event without removing it', () => {
      const eventA = createTestEvent('A')
      const eventB = createTestEvent('B')

      chain.push(eventA)
      chain.push(eventB)

      expect(chain.peek()?.name).toBe('B')
      expect(chain.depth).toBe(2) // stack unchanged
      expect(chain.peek()?.name).toBe('B') // still B
    })

    it('should return null when peeking empty stack', () => {
      expect(chain.peek()).toBeNull()
    })
  })

  describe('isEmpty', () => {
    it('should return true for new chain', () => {
      expect(chain.isEmpty()).toBe(true)
    })

    it('should return false after push', () => {
      chain.push(createTestEvent('A'))
      expect(chain.isEmpty()).toBe(false)
    })

    it('should return true after push then pop', () => {
      chain.push(createTestEvent('A'))
      chain.pop()
      expect(chain.isEmpty()).toBe(true)
    })
  })

  describe('depth', () => {
    it('should return 0 for empty chain', () => {
      expect(chain.depth).toBe(0)
    })

    it('should increase with each push', () => {
      chain.push(createTestEvent('A'))
      expect(chain.depth).toBe(1)

      chain.push(createTestEvent('B'))
      expect(chain.depth).toBe(2)

      chain.push(createTestEvent('C'))
      expect(chain.depth).toBe(3)
    })

    it('should decrease with each pop', () => {
      chain.push(createTestEvent('A'))
      chain.push(createTestEvent('B'))
      chain.pop()
      expect(chain.depth).toBe(1)
    })
  })

  describe('getStack', () => {
    it('should return copy of stack', () => {
      const eventA = createTestEvent('A')
      const eventB = createTestEvent('B')

      chain.push(eventA)
      chain.push(eventB)

      const stack = chain.getStack()
      expect(stack).toHaveLength(2)
      expect(stack[0]).toBe(eventA)
      expect(stack[1]).toBe(eventB)

      // Modifying returned copy should not affect original
      stack.pop()
      expect(chain.depth).toBe(2)
    })
  })

  describe('getTop', () => {
    it('should return top N events', () => {
      chain.push(createTestEvent('A'))
      chain.push(createTestEvent('B'))
      chain.push(createTestEvent('C'))

      const top = chain.getTop(2)
      expect(top).toHaveLength(2)
      expect(top[0]?.name).toBe('B')
      expect(top[1]?.name).toBe('C')
    })
  })

  describe('clear', () => {
    it('should remove all events', () => {
      chain.push(createTestEvent('A'))
      chain.push(createTestEvent('B'))
      chain.clear()

      expect(chain.isEmpty()).toBe(true)
      expect(chain.depth).toBe(0)
      expect(chain.pop()).toBeNull()
    })
  })
})
