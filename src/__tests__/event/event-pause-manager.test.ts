// ============================================================
// EventPauseManager 单元测试
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { EventPauseManager } from '@core/event/event-pause-manager'

describe('EventPauseManager', () => {
  let manager: EventPauseManager

  beforeEach(() => {
    vi.useFakeTimers()
    manager = new EventPauseManager()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('pause / resume', () => {
    it('should pause and resolve on resume', async () => {
      const pausePromise = manager.pause('test reason')
      expect(manager.isPaused).toBe(true)
      expect(manager.currentReason).toBe('test reason')

      manager.resume()
      await expect(pausePromise).resolves.toBeUndefined()
      expect(manager.isPaused).toBe(false)
    })

    it('should track pause depth with nested pauses', async () => {
      const p1 = manager.pause('first')
      const p2 = manager.pause('second')

      expect(manager.pauseDepth).toBe(2)

      manager.resume() // resolves p2
      await expect(p2).resolves.toBeUndefined()
      expect(manager.pauseDepth).toBe(1)
      expect(manager.currentReason).toBe('first')

      manager.resume() // resolves p1
      await expect(p1).resolves.toBeUndefined()
      expect(manager.pauseDepth).toBe(0)
    })

    it('should not throw when resuming empty stack', () => {
      expect(() => manager.resume()).not.toThrow()
    })
  })

  describe('resumeAll', () => {
    it('should resolve all nested pauses', async () => {
      const p1 = manager.pause('first')
      const p2 = manager.pause('second')
      const p3 = manager.pause('third')

      manager.resumeAll()

      await expect(p1).resolves.toBeUndefined()
      await expect(p2).resolves.toBeUndefined()
      await expect(p3).resolves.toBeUndefined()
      expect(manager.isPaused).toBe(false)
    })
  })

  describe('cancel', () => {
    it('should cancel the current pause', async () => {
      const pausePromise = manager.pause('test')
      expect(manager.isPaused).toBe(true)

      manager.cancel('user cancelled')
      await expect(pausePromise).rejects.toThrow('user cancelled')
      expect(manager.isPaused).toBe(false)
    })

    it('should not throw when cancelling empty stack', () => {
      expect(() => manager.cancel()).not.toThrow()
    })
  })

  describe('cancelAll', () => {
    it('should cancel all nested pauses', async () => {
      const p1 = manager.pause('first')
      const p2 = manager.pause('second')

      manager.cancelAll('shutdown')

      await expect(p1).rejects.toThrow('shutdown')
      await expect(p2).rejects.toThrow('shutdown')
      expect(manager.isPaused).toBe(false)
    })
  })

  describe('timeout', () => {
    it('should auto-resume after timeout', async () => {
      const pausePromise = manager.pause('timeout test', 100)
      expect(manager.isPaused).toBe(true)

      vi.advanceTimersByTime(100)

      await expect(pausePromise).resolves.toBeUndefined()
      expect(manager.isPaused).toBe(false)
    })

    it('should not auto-resume if manually resumed before timeout', async () => {
      const pausePromise = manager.pause('timeout test', 100)

      vi.advanceTimersByTime(50)
      manager.resume()

      await expect(pausePromise).resolves.toBeUndefined()
    })

    it('should use default timeout', async () => {
      const mgr = new EventPauseManager({ defaultTimeout: 200 })

      const pausePromise = mgr.pause('default timeout test')
      expect(mgr.isPaused).toBe(true)

      vi.advanceTimersByTime(200)

      await expect(pausePromise).resolves.toBeUndefined()
      expect(mgr.isPaused).toBe(false)
    })
  })

  describe('allowNested option', () => {
    it('should auto-resume previous pause when nested is disabled', () => {
      const mgr = new EventPauseManager({ allowNested: false })

      const p1 = mgr.pause('first')
      expect(mgr.pauseDepth).toBe(1)

      const p2 = mgr.pause('second')
      // p1 should be auto-resumed
      expect(mgr.pauseDepth).toBe(1)
    })
  })

  describe('getAllReasons', () => {
    it('should return all pause reasons', () => {
      manager.pause('reason1')
      manager.pause('reason2')

      const reasons = manager.getAllReasons()
      expect(reasons).toEqual(['reason1', 'reason2'])
    })
  })

  describe('reset', () => {
    it('should cancel all pauses and clear stack', async () => {
      const pausePromise = manager.pause('test')
      manager.reset()
      // The pause promise is rejected by reset; catch it to avoid unhandled rejection
      await expect(pausePromise).rejects.toThrow('EventPauseManager reset')
      expect(manager.isPaused).toBe(false)
      expect(manager.pauseDepth).toBe(0)
    })
  })
})
