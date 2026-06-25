// ============================================================
// ResponseWindow 单元测试
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ResponseWindow, ResponseWindowFactory, ResponseType } from '@core/event/response-window'
import type { IPlayer } from '@core/contracts/player.interface'
import type { IEffect } from '@core/contracts/effect.interface'
import { SkillType, Frequency, TriggerTiming } from '@core/contracts/enums'

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

describe('ResponseWindow', () => {
  let player: IPlayer

  beforeEach(() => {
    vi.useFakeTimers()
    player = createMockPlayer('p1', 0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('awaitResponse / respond', () => {
    it('should resolve with response when respond() is called', async () => {
      const window = new ResponseWindow({
        responseType: ResponseType.PlayCard,
        player,
        prompt: 'Test prompt',
      })

      const responsePromise = window.awaitResponse()
      expect(window.resolved).toBe(false)

      window.respond({ responded: true, cards: [], targets: [] })
      const result = await responsePromise

      expect(result.responded).toBe(true)
      expect(window.resolved).toBe(true)
    })

    it('should use default values for missing response fields', async () => {
      const window = new ResponseWindow({
        responseType: ResponseType.PlayCard,
        player,
        prompt: 'Test prompt',
      })

      const responsePromise = window.awaitResponse()
      window.respond({})

      const result = await responsePromise
      expect(result.responded).toBe(true)
      expect(result.cards).toEqual([])
      expect(result.targets).toEqual([])
      expect(result.effect).toBeNull()
      expect(result.timedOut).toBe(false)
    })

    it('should not resolve twice', async () => {
      const window = new ResponseWindow({
        responseType: ResponseType.PlayCard,
        player,
        prompt: 'Test prompt',
      })

      const responsePromise = window.awaitResponse()
      window.respond({ responded: true })
      window.respond({ responded: false }) // should be ignored

      const result = await responsePromise
      expect(result.responded).toBe(true) // first response wins
    })
  })

  describe('cancel', () => {
    it('should resolve with responded=false', async () => {
      const window = new ResponseWindow({
        responseType: ResponseType.PlayCard,
        player,
        prompt: 'Test prompt',
        cancelable: true,
      })

      const responsePromise = window.awaitResponse()
      window.cancel()

      const result = await responsePromise
      expect(result.responded).toBe(false)
      expect(window.cancelled).toBe(true)
    })
  })

  describe('reject', () => {
    it('should reject the promise', async () => {
      const window = new ResponseWindow({
        responseType: ResponseType.PlayCard,
        player,
        prompt: 'Test prompt',
      })

      const responsePromise = window.awaitResponse()
      window.reject(new Error('Something went wrong'))

      await expect(responsePromise).rejects.toThrow('Something went wrong')
    })
  })

  describe('timeout', () => {
    it('should auto-resolve with timedOut=true after timeout', async () => {
      const window = new ResponseWindow({
        responseType: ResponseType.PlayCard,
        player,
        prompt: 'Test prompt',
        timeout: 1000,
      })

      const responsePromise = window.awaitResponse()

      vi.advanceTimersByTime(1000)

      const result = await responsePromise
      expect(result.timedOut).toBe(true)
      expect(result.responded).toBe(false)
    })

    it('should not timeout if responded before timeout', async () => {
      const window = new ResponseWindow({
        responseType: ResponseType.PlayCard,
        player,
        prompt: 'Test prompt',
        timeout: 1000,
      })

      const responsePromise = window.awaitResponse()

      vi.advanceTimersByTime(500)
      window.respond({ responded: true })

      const result = await responsePromise
      expect(result.timedOut).toBe(false)
      expect(result.responded).toBe(true)
    })
  })

  describe('elapsed', () => {
    it('should track elapsed time', () => {
      const window = new ResponseWindow({
        responseType: ResponseType.PlayCard,
        player,
        prompt: 'Test prompt',
      })

      const initial = window.elapsed
      vi.advanceTimersByTime(100)
      expect(window.elapsed).toBeGreaterThanOrEqual(initial + 100)
    })
  })

  describe('id', () => {
    it('should generate unique IDs', () => {
      const w1 = new ResponseWindow({ responseType: ResponseType.PlayCard, player, prompt: 'p1' })
      const w2 = new ResponseWindow({ responseType: ResponseType.PlayCard, player, prompt: 'p2' })

      expect(w1.id).not.toBe(w2.id)
    })
  })
})

describe('ResponseWindowFactory', () => {
  let player: IPlayer

  beforeEach(() => {
    player = createMockPlayer('p1', 0)
  })

  it('should create defend window', () => {
    const window = ResponseWindowFactory.createDefendWindow(player, [])
    expect(window.options.responseType).toBe(ResponseType.PlayCard)
    expect(window.options.cancelable).toBe(true)
    expect(window.options.minCards).toBe(1)
    expect(window.options.maxCards).toBe(1)
  })

  it('should create dying window', () => {
    const dying = createMockPlayer('p2', 1)
    const window = ResponseWindowFactory.createDyingWindow(player, dying, [])
    expect(window.options.responseType).toBe(ResponseType.PlayCard)
    expect(window.options.prompt).toContain('p2')
  })

  it('should create effect window', () => {
    const effect: IEffect = {
      id: 'e1',
      name: 'Test Effect',
      description: '',
      type: SkillType.Active,
      priority: 0,
      frequency: Frequency.Unlimited,
      trigger: { source: [{ timing: TriggerTiming.CardUse, stage: 'Before' }] },
      content: async () => {},
      enabled: true,
      usedThisTurn: false,
      usedThisRound: false,
    }

    const window = ResponseWindowFactory.createEffectWindow(player, [effect])
    expect(window.options.responseType).toBe(ResponseType.UseEffect)
    expect(window.options.validEffects).toHaveLength(1)
  })

  it('should create card select window', () => {
    const window = ResponseWindowFactory.createCardSelectWindow(player, [], 1, 3)
    expect(window.options.responseType).toBe(ResponseType.SelectCards)
    expect(window.options.minCards).toBe(1)
    expect(window.options.maxCards).toBe(3)
    expect(window.options.cancelable).toBe(false)
  })

  it('should create target select window', () => {
    const window = ResponseWindowFactory.createTargetSelectWindow(player, [], 1, 2)
    expect(window.options.responseType).toBe(ResponseType.SelectTargets)
    expect(window.options.minTargets).toBe(1)
    expect(window.options.maxTargets).toBe(2)
    expect(window.options.cancelable).toBe(true)
  })
})
