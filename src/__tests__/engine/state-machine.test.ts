// ============================================================
// GameStateMachine 单元测试
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GameStateMachine, WILDCARD } from '@core/engine/state-machine'
import type { TransitionRule, StateMachineHooks } from '@core/engine/state-machine'
import { GamePhase } from '@core/contracts/enums'
import type { IGameState } from '@core/contracts/game.interface'

// ── 测试辅助工具 ──

/**
 * 创建一个最小化的 IGameState mock，仅设置测试关心的字段。
 */
function createMockState(overrides: Partial<IGameState> = {}): IGameState {
  return {
    players: [],
    deck: [],
    discardPile: [],
    currentRound: 1,
    currentPlayerIndex: 0,
    currentPhase: GamePhase.NotStarted,
    phaseIndex: 0,
    log: [],
    config: {
      mode: 'standard-5p',
      playerCount: 5,
      roles: [],
      heroes: [],
      cards: [],
      heroSelectCount: 3,
      initialHandSize: 4,
      equipEnabled: true,
      delayedCardEnabled: true,
      maxRounds: 100,
    },
    started: false,
    finished: false,
    processingCards: [],
    ...overrides,
  }
}

// ── 测试套件 ──

describe('GameStateMachine', () => {
  let sm: GameStateMachine
  let mockState: IGameState

  beforeEach(() => {
    sm = new GameStateMachine(GamePhase.NotStarted)
    mockState = createMockState()
  })

  // ================================================================
  // 基础功能
  // ================================================================

  describe('construction', () => {
    it('should set the initial state', () => {
      expect(sm.currentState).toBe(GamePhase.NotStarted)
    })

    it('should record initial state in history', () => {
      expect(sm.getStateHistory()).toEqual([GamePhase.NotStarted])
      expect(sm.historyLength).toBe(1)
    })

    it('should have previousState equal to currentState when no transition has occurred', () => {
      expect(sm.previousState).toBe(GamePhase.NotStarted)
    })
  })

  // ================================================================
  // 正常状态转移
  // ================================================================

  describe('basic transition', () => {
    beforeEach(() => {
      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      sm.registerState(GamePhase.Prepare, [GamePhase.RoundStart])
      sm.registerState(GamePhase.RoundStart, [GamePhase.PhasePre])
    })

    it('should transition from NotStarted to Prepare', async () => {
      const result = await sm.transition(GamePhase.Prepare, mockState)
      expect(result).toBe(true)
      expect(sm.currentState).toBe(GamePhase.Prepare)
    })

    it('should transition through multiple states sequentially', async () => {
      await sm.transition(GamePhase.Prepare, mockState)
      expect(sm.currentState).toBe(GamePhase.Prepare)

      await sm.transition(GamePhase.RoundStart, mockState)
      expect(sm.currentState).toBe(GamePhase.RoundStart)

      await sm.transition(GamePhase.PhasePre, mockState)
      expect(sm.currentState).toBe(GamePhase.PhasePre)
    })

    it('should record history for each transition', async () => {
      await sm.transition(GamePhase.Prepare, mockState)
      await sm.transition(GamePhase.RoundStart, mockState)

      expect(sm.getStateHistory()).toEqual([
        GamePhase.NotStarted,
        GamePhase.Prepare,
        GamePhase.RoundStart,
      ])
      expect(sm.historyLength).toBe(3)
    })

    it('should track previousState correctly', async () => {
      await sm.transition(GamePhase.Prepare, mockState)
      expect(sm.previousState).toBe(GamePhase.NotStarted)

      await sm.transition(GamePhase.RoundStart, mockState)
      expect(sm.previousState).toBe(GamePhase.Prepare)
    })

    it('should return false when transitioning to an unregistered state', async () => {
      const result = await sm.transition(GamePhase.GameOver, mockState)
      expect(result).toBe(false)
      expect(sm.currentState).toBe(GamePhase.NotStarted) // unchanged
    })
  })

  // ================================================================
  // 条件转移
  // ================================================================

  describe('conditional transition', () => {
    beforeEach(() => {
      sm.registerState(GamePhase.RoundEnd, [
        {
          to: GamePhase.RoundStart,
          condition: (s: IGameState) => s.currentRound < s.config.maxRounds,
        },
        {
          to: GamePhase.GameOver,
          condition: (s: IGameState) => s.currentRound >= s.config.maxRounds,
        },
      ])
      // Set up initial state to RoundEnd for these tests
      sm.registerState(GamePhase.NotStarted, [GamePhase.RoundEnd])
    })

    it('should allow transition when condition is met', async () => {
      await sm.transition(GamePhase.RoundEnd, mockState)
      // currentRound=1, maxRounds=100 → should go to RoundStart
      const result = await sm.transition(GamePhase.RoundStart, mockState)
      expect(result).toBe(true)
      expect(sm.currentState).toBe(GamePhase.RoundStart)
    })

    it('should block transition when condition is not met', async () => {
      await sm.transition(GamePhase.RoundEnd, mockState)

      const maxedOutState = createMockState({ currentRound: 100 })
      // currentRound=100, maxRounds=100 → RoundStart condition (100 < 100) = false
      const result = await sm.transition(GamePhase.RoundStart, maxedOutState)
      expect(result).toBe(false)
    })

    it('should allow transition to GameOver when max rounds reached', async () => {
      await sm.transition(GamePhase.RoundEnd, mockState)

      const maxedOutState = createMockState({ currentRound: 100 })
      const result = await sm.transition(GamePhase.GameOver, maxedOutState)
      expect(result).toBe(true)
      expect(sm.currentState).toBe(GamePhase.GameOver)
    })

    it('should show only satisfied conditions in available transitions', async () => {
      await sm.transition(GamePhase.RoundEnd, mockState)

      const available = sm.getAvailableTransitions(mockState)
      expect(available).toContain(GamePhase.RoundStart)
      expect(available).not.toContain(GamePhase.GameOver)

      const maxedAvailable = sm.getAvailableTransitions(
        createMockState({ currentRound: 100 }),
      )
      expect(maxedAvailable).toContain(GamePhase.GameOver)
      expect(maxedAvailable).not.toContain(GamePhase.RoundStart)
    })
  })

  // ================================================================
  // 通配符转移 (WILDCARD)
  // ================================================================

  describe('wildcard transition', () => {
    beforeEach(() => {
      // Register normal transitions
      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      sm.registerState(GamePhase.Prepare, [GamePhase.RoundStart])
      sm.registerState(GamePhase.RoundStart, [GamePhase.PhasePre])

      // GameOver can be reached from ANY state via wildcard
      sm.registerState(WILDCARD, [GamePhase.GameOver])
    })

    it('should allow transition via wildcard from NotStarted', async () => {
      const result = await sm.transition(GamePhase.GameOver, mockState)
      expect(result).toBe(true)
      expect(sm.currentState).toBe(GamePhase.GameOver)
    })

    it('should allow transition via wildcard from a mid-game state', async () => {
      await sm.transition(GamePhase.Prepare, mockState)
      await sm.transition(GamePhase.RoundStart, mockState)

      const result = await sm.transition(GamePhase.GameOver, mockState)
      expect(result).toBe(true)
      expect(sm.currentState).toBe(GamePhase.GameOver)
    })

    it('should include wildcard transitions in available transitions', async () => {
      await sm.transition(GamePhase.Prepare, mockState)

      const available = sm.getAvailableTransitions()
      expect(available).toContain(GamePhase.RoundStart) // specific
      expect(available).toContain(GamePhase.GameOver) // wildcard
    })

    it('should support conditional wildcard transitions', async () => {
      sm.registerState(WILDCARD, [
        {
          to: GamePhase.GameOver,
          condition: (s: IGameState) => s.finished === true,
        },
      ])

      const finishedState = createMockState({ finished: true })
      const result = await sm.transition(GamePhase.GameOver, finishedState)
      expect(result).toBe(true)
    })

    it('should block conditional wildcard when condition is false', async () => {
      // Use a fresh state machine — the describe-level beforeEach already
      // registers an unconditional WILDCARD → GameOver, so we need a clean
      // instance to test a conditional-only wildcard.
      const freshSm = new GameStateMachine(GamePhase.NotStarted)
      freshSm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      freshSm.registerState(WILDCARD, [
        {
          to: GamePhase.GameOver,
          condition: (s: IGameState) => s.finished === true,
        },
      ])

      const result = await freshSm.transition(GamePhase.GameOver, mockState) // finished=false
      expect(result).toBe(false)
    })
  })

  // ================================================================
  // 非法转移回调
  // ================================================================

  describe('illegal transition callback', () => {
    it('should fire onIllegalTransition when transition is not allowed', async () => {
      const onIllegal = vi.fn()
      sm.setHooks({ onIllegalTransition: onIllegal })

      const result = await sm.transition(GamePhase.GameOver, mockState)
      expect(result).toBe(false)
      expect(onIllegal).toHaveBeenCalledOnce()
      expect(onIllegal).toHaveBeenCalledWith(
        GamePhase.NotStarted,
        GamePhase.GameOver,
        mockState,
      )
    })

    it('should NOT fire onIllegalTransition when transition succeeds', async () => {
      const onIllegal = vi.fn()
      sm.setHooks({ onIllegalTransition: onIllegal })
      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])

      await sm.transition(GamePhase.Prepare, mockState)
      expect(onIllegal).not.toHaveBeenCalled()
    })

    it('should fire for each illegal transition attempt', async () => {
      const onIllegal = vi.fn()
      sm.setHooks({ onIllegalTransition: onIllegal })

      await sm.transition(GamePhase.Prepare, mockState)
      await sm.transition(GamePhase.GameOver, mockState)
      await sm.transition(GamePhase.RoundStart, mockState)

      expect(onIllegal).toHaveBeenCalledTimes(3)
    })
  })

  // ================================================================
  // 转移钩子 (before / after)
  // ================================================================

  describe('transition hooks', () => {
    beforeEach(() => {
      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      sm.registerState(GamePhase.Prepare, [GamePhase.RoundStart])
    })

    it('should call onBeforeTransition before state changes', async () => {
      const callOrder: string[] = []
      sm.setHooks({
        onBeforeTransition: (_from, _to, _state) => {
          callOrder.push('before')
          // State should NOT have changed yet
          expect(sm.currentState).toBe(GamePhase.NotStarted)
        },
        onAfterTransition: (_from, _to, _state) => {
          callOrder.push('after')
        },
      })

      await sm.transition(GamePhase.Prepare, mockState)

      expect(callOrder).toEqual(['before', 'after'])
    })

    it('should call onAfterTransition after state changes', async () => {
      sm.setHooks({
        onAfterTransition: (_from, _to, _state) => {
          expect(sm.currentState).toBe(GamePhase.Prepare)
        },
      })

      await sm.transition(GamePhase.Prepare, mockState)
    })

    it('should provide correct from/to/state in hooks', async () => {
      const beforeHook = vi.fn()
      const afterHook = vi.fn()
      sm.setHooks({
        onBeforeTransition: beforeHook,
        onAfterTransition: afterHook,
      })

      await sm.transition(GamePhase.Prepare, mockState)

      expect(beforeHook).toHaveBeenCalledWith(
        GamePhase.NotStarted,
        GamePhase.Prepare,
        mockState,
      )
      expect(afterHook).toHaveBeenCalledWith(
        GamePhase.NotStarted,
        GamePhase.Prepare,
        mockState,
      )
    })

    it('should support async onBeforeTransition', async () => {
      const callOrder: string[] = []
      sm.setHooks({
        onBeforeTransition: async (_from, _to, _state) => {
          callOrder.push('before-start')
          await new Promise((r) => setTimeout(r, 10))
          callOrder.push('before-end')
        },
      })

      await sm.transition(GamePhase.Prepare, mockState)
      expect(callOrder).toEqual(['before-start', 'before-end'])
      expect(sm.currentState).toBe(GamePhase.Prepare)
    })

    it('should NOT call hooks on failed transition', async () => {
      const beforeHook = vi.fn()
      const afterHook = vi.fn()
      sm.setHooks({
        onBeforeTransition: beforeHook,
        onAfterTransition: afterHook,
      })

      await sm.transition(GamePhase.GameOver, mockState)

      expect(beforeHook).not.toHaveBeenCalled()
      expect(afterHook).not.toHaveBeenCalled()
    })
  })

  // ================================================================
  // canTransition 查询
  // ================================================================

  describe('canTransition', () => {
    beforeEach(() => {
      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      sm.registerState(GamePhase.Prepare, [GamePhase.RoundStart])
      sm.registerState(GamePhase.RoundEnd, [
        {
          to: GamePhase.RoundStart,
          condition: (s: IGameState) => s.currentRound < 100,
        },
        GamePhase.GameOver,
      ])
      sm.registerState(WILDCARD, [GamePhase.GameOver])
    })

    it('should return true for registered transition', () => {
      expect(sm.canTransition(GamePhase.Prepare)).toBe(true)
    })

    it('should return false for unregistered transition', () => {
      expect(sm.canTransition(GamePhase.PhaseUse)).toBe(false)
    })

    it('should return true for wildcard transition', () => {
      expect(sm.canTransition(GamePhase.GameOver)).toBe(true)
    })

    it('should return true when condition is satisfied', async () => {
      // Move to RoundEnd first
      sm.registerState(GamePhase.Prepare, [GamePhase.RoundEnd])
      await sm.transition(GamePhase.Prepare, mockState)
      await sm.transition(GamePhase.RoundEnd, mockState)

      expect(sm.canTransition(GamePhase.RoundStart, mockState)).toBe(true)
    })

    it('should return false when condition is not satisfied', async () => {
      sm.registerState(GamePhase.Prepare, [GamePhase.RoundEnd])
      await sm.transition(GamePhase.Prepare, mockState)
      await sm.transition(GamePhase.RoundEnd, mockState)

      const maxRoundsState = createMockState({ currentRound: 100 })
      expect(sm.canTransition(GamePhase.RoundStart, maxRoundsState)).toBe(false)
    })
  })

  // ================================================================
  // getAvailableTransitions
  // ================================================================

  describe('getAvailableTransitions', () => {
    beforeEach(() => {
      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      sm.registerState(GamePhase.PhaseUse, [
        GamePhase.PhaseDiscard,
        GamePhase.PhasePost,
      ])
      sm.registerState(WILDCARD, [GamePhase.GameOver])
    })

    it('should return all registered targets for current state', () => {
      const available = sm.getAvailableTransitions()
      expect(available).toContain(GamePhase.Prepare)
      expect(available).toContain(GamePhase.GameOver) // wildcard
      expect(available).toHaveLength(2)
    })

    it('should return targets for PhaseUse state', async () => {
      await sm.transition(GamePhase.Prepare, mockState)
      // Now in Prepare, let's register its transitions and move to PhaseUse
      sm.registerState(GamePhase.Prepare, [GamePhase.PhaseUse])
      await sm.transition(GamePhase.PhaseUse, mockState)

      const available = sm.getAvailableTransitions()
      expect(available).toContain(GamePhase.PhaseDiscard)
      expect(available).toContain(GamePhase.PhasePost)
      expect(available).toContain(GamePhase.GameOver) // wildcard
    })

    it('should return empty array when no transitions are registered', () => {
      const emptySm = new GameStateMachine(GamePhase.PhaseUse)
      expect(emptySm.getAvailableTransitions()).toEqual([])
    })
  })

  // ================================================================
  // reset
  // ================================================================

  describe('reset', () => {
    beforeEach(() => {
      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      sm.registerState(GamePhase.Prepare, [GamePhase.RoundStart])
    })

    it('should reset currentState and clear history', async () => {
      await sm.transition(GamePhase.Prepare, mockState)
      await sm.transition(GamePhase.RoundStart, mockState)

      sm.reset(GamePhase.NotStarted)

      expect(sm.currentState).toBe(GamePhase.NotStarted)
      expect(sm.historyLength).toBe(1)
      expect(sm.getStateHistory()).toEqual([GamePhase.NotStarted])
    })

    it('should preserve transition rules after reset', async () => {
      await sm.transition(GamePhase.Prepare, mockState)
      sm.reset(GamePhase.NotStarted)

      const result = await sm.transition(GamePhase.Prepare, mockState)
      expect(result).toBe(true)
    })
  })

  // ================================================================
  // 完整游戏流程
  // ================================================================

  describe('full game flow', () => {
    beforeEach(() => {
      // Register the complete game lifecycle
      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      sm.registerState(GamePhase.Prepare, [GamePhase.RoundStart])
      sm.registerState(GamePhase.RoundStart, [GamePhase.PhasePre])

      // PhasePre can branch to any phase
      sm.registerState(GamePhase.PhasePre, [
        GamePhase.PhaseJudge,
        GamePhase.PhaseDraw,
        GamePhase.PhaseUse,
      ])

      // Phase sequence
      sm.registerState(GamePhase.PhaseJudge, [GamePhase.PhaseDraw])
      sm.registerState(GamePhase.PhaseDraw, [GamePhase.PhaseUse])
      sm.registerState(GamePhase.PhaseUse, [GamePhase.PhaseDiscard])
      sm.registerState(GamePhase.PhaseDiscard, [GamePhase.PhasePost])
      sm.registerState(GamePhase.PhasePost, [GamePhase.RoundEnd])

      // Round end → next round OR game over
      sm.registerState(GamePhase.RoundEnd, [
        {
          to: GamePhase.RoundStart,
          condition: (s: IGameState) => s.currentRound < s.config.maxRounds,
        },
        { to: GamePhase.GameOver, condition: (s: IGameState) => s.finished },
      ])

      // Wildcard: any state → GameOver (e.g. lord dies mid-phase)
      sm.registerState(WILDCARD, [GamePhase.GameOver])
    })

    it('should complete the full game lifecycle', async () => {
      const state = createMockState()

      // NotStarted → Prepare
      expect(await sm.transition(GamePhase.Prepare, state)).toBe(true)
      expect(sm.currentState).toBe(GamePhase.Prepare)

      // Prepare → RoundStart
      expect(await sm.transition(GamePhase.RoundStart, state)).toBe(true)
      expect(sm.currentState).toBe(GamePhase.RoundStart)

      // RoundStart → PhasePre
      expect(await sm.transition(GamePhase.PhasePre, state)).toBe(true)
      expect(sm.currentState).toBe(GamePhase.PhasePre)

      // PhasePre → PhaseJudge
      expect(await sm.transition(GamePhase.PhaseJudge, state)).toBe(true)
      // PhaseJudge → PhaseDraw
      expect(await sm.transition(GamePhase.PhaseDraw, state)).toBe(true)
      // PhaseDraw → PhaseUse
      expect(await sm.transition(GamePhase.PhaseUse, state)).toBe(true)
      // PhaseUse → PhaseDiscard
      expect(await sm.transition(GamePhase.PhaseDiscard, state)).toBe(true)
      // PhaseDiscard → PhasePost
      expect(await sm.transition(GamePhase.PhasePost, state)).toBe(true)
      // PhasePost → RoundEnd
      expect(await sm.transition(GamePhase.RoundEnd, state)).toBe(true)

      // RoundEnd → next RoundStart (condition: round < maxRounds)
      expect(await sm.transition(GamePhase.RoundStart, state)).toBe(true)

      // Verify full history
      const history = sm.getStateHistory()
      expect(history).toEqual([
        GamePhase.NotStarted,
        GamePhase.Prepare,
        GamePhase.RoundStart,
        GamePhase.PhasePre,
        GamePhase.PhaseJudge,
        GamePhase.PhaseDraw,
        GamePhase.PhaseUse,
        GamePhase.PhaseDiscard,
        GamePhase.PhasePost,
        GamePhase.RoundEnd,
        GamePhase.RoundStart,
      ])
    })

    it('should transition to GameOver via wildcard from any phase', async () => {
      const state = createMockState()
      await sm.transition(GamePhase.Prepare, state)
      await sm.transition(GamePhase.RoundStart, state)
      await sm.transition(GamePhase.PhasePre, state)

      // In PhasePre, suddenly go to GameOver (lord died)
      const result = await sm.transition(GamePhase.GameOver, state)
      expect(result).toBe(true)
      expect(sm.currentState).toBe(GamePhase.GameOver)
    })

    it('should complete the game at RoundEnd when finished', async () => {
      const state = createMockState()
      // Walk through to RoundEnd
      await sm.transition(GamePhase.Prepare, state)
      await sm.transition(GamePhase.RoundStart, state)
      await sm.transition(GamePhase.PhasePre, state)
      await sm.transition(GamePhase.PhaseJudge, state)
      await sm.transition(GamePhase.PhaseDraw, state)
      await sm.transition(GamePhase.PhaseUse, state)
      await sm.transition(GamePhase.PhaseDiscard, state)
      await sm.transition(GamePhase.PhasePost, state)
      await sm.transition(GamePhase.RoundEnd, state)

      // Now at RoundEnd with finished=true
      const finishedState = createMockState({ finished: true })
      const result = await sm.transition(GamePhase.GameOver, finishedState)
      expect(result).toBe(true)
      expect(sm.currentState).toBe(GamePhase.GameOver)
    })

    it('should reject invalid phase transitions (e.g. PhaseUse → PhasePre)', async () => {
      const state = createMockState()
      await sm.transition(GamePhase.Prepare, state)
      await sm.transition(GamePhase.RoundStart, state)
      await sm.transition(GamePhase.PhasePre, state)
      await sm.transition(GamePhase.PhaseJudge, state)
      await sm.transition(GamePhase.PhaseDraw, state)
      await sm.transition(GamePhase.PhaseUse, state)

      // PhaseUse → PhasePre is NOT registered (going backwards)
      const result = await sm.transition(GamePhase.PhasePre, state)
      expect(result).toBe(false)
      expect(sm.currentState).toBe(GamePhase.PhaseUse) // unchanged
    })
  })

  // ================================================================
  // setHooks — partial overrides
  // ================================================================

  describe('setHooks', () => {
    it('should merge new hooks with existing ones', async () => {
      const beforeHook = vi.fn()
      const afterHook = vi.fn()
      const illegalHook = vi.fn()

      // Set initial hooks
      sm.setHooks({ onBeforeTransition: beforeHook, onIllegalTransition: illegalHook })

      // Later, add after hook — should keep before hook
      sm.setHooks({ onAfterTransition: afterHook })

      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      await sm.transition(GamePhase.Prepare, mockState)

      expect(beforeHook).toHaveBeenCalled()
      expect(afterHook).toHaveBeenCalled()

      // Also test that illegal still works
      await sm.transition(GamePhase.GameOver, mockState)
      expect(illegalHook).toHaveBeenCalled()
    })

    it('should override existing hooks', async () => {
      const firstHook = vi.fn()
      const secondHook = vi.fn()

      sm.setHooks({ onBeforeTransition: firstHook })
      sm.setHooks({ onBeforeTransition: secondHook })

      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      await sm.transition(GamePhase.Prepare, mockState)

      expect(firstHook).not.toHaveBeenCalled()
      expect(secondHook).toHaveBeenCalled()
    })
  })

  // ================================================================
  // constructor hooks
  // ================================================================

  describe('constructor hooks', () => {
    it('should accept hooks via constructor', async () => {
      const beforeHook = vi.fn()
      const sm2 = new GameStateMachine(GamePhase.NotStarted, {
        onBeforeTransition: beforeHook,
      })

      sm2.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      await sm2.transition(GamePhase.Prepare, mockState)

      expect(beforeHook).toHaveBeenCalled()
    })
  })

  // ================================================================
  // 边界情况
  // ================================================================

  describe('edge cases', () => {
    it('should allow self-transition if registered', async () => {
      sm.registerState(GamePhase.NotStarted, [GamePhase.NotStarted])
      const result = await sm.transition(GamePhase.NotStarted, mockState)
      expect(result).toBe(true)
      expect(sm.historyLength).toBe(2)
    })

    it('should block self-transition if not registered', async () => {
      const result = await sm.transition(GamePhase.NotStarted, mockState)
      expect(result).toBe(false)
    })

    it('should handle multiple transitions to the same state', async () => {
      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      sm.registerState(GamePhase.Prepare, [GamePhase.PhasePre])

      await sm.transition(GamePhase.Prepare, mockState)
      await sm.transition(GamePhase.PhasePre, mockState)

      expect(sm.historyLength).toBe(3)
      expect(sm.previousState).toBe(GamePhase.Prepare)
    })

    it('should return a defensive copy of history', () => {
      const history = sm.getStateHistory()
      // @ts-expect-error - testing defensive copy
      history.push(GamePhase.GameOver as never)
      expect(sm.historyLength).toBe(1) // original unchanged
    })

    it('should handle rapid transitions', async () => {
      sm.registerState(GamePhase.NotStarted, [GamePhase.Prepare])
      sm.registerState(GamePhase.Prepare, [GamePhase.RoundStart])
      sm.registerState(GamePhase.RoundStart, [GamePhase.PhasePre])

      const results = await Promise.all([
        sm.transition(GamePhase.Prepare, mockState),
        sm.transition(GamePhase.RoundStart, mockState),
        sm.transition(GamePhase.PhasePre, mockState),
      ])

      // At least the first transition should succeed
      expect(results[0]).toBe(true)
    })
  })
})
