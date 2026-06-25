// ============================================================
// 联盟杀 · Replay System 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { LogSerializer, type GameReplayData } from '@core/services/log-serializer'
import { ReplayEngine } from '@core/engine/replay-engine'
import { GameState } from '@core/entity/game-state'
import { GamePhase, LogLevel } from '@core/contracts/enums'
import type { LogEntry } from '@core/contracts/types'

// ── 工厂 ──

function createTestLogEntry(overrides?: Partial<LogEntry>): LogEntry {
  return {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    round: 1,
    phase: GamePhase.PhaseUse,
    message: '测试日志',
    level: LogLevel.Info,
    ...overrides,
  }
}

function createTestState(overrides?: Partial<Parameters<typeof GameState.restore>[0]>): GameState {
  return GameState.restore({
    players: [],
    deck: [],
    discardPile: [],
    currentRound: 1,
    currentPlayerIndex: 0,
    currentPhase: GamePhase.PhasePre,
    phaseIndex: 0,
    log: [],
    config: {
      mode: 'test',
      playerCount: 0,
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
  })
}

describe('Replay System', () => {
  // ================================================================
  // LogSerializer
  // ================================================================

  describe('LogSerializer', () => {
    beforeEach(() => {
      // No global state to reset
    })

    describe('serializeLogs / deserializeLogs', () => {
      it('should serialize and deserialize logs losslessly', () => {
        const logs: LogEntry[] = [
          createTestLogEntry({ message: '第一步' }),
          createTestLogEntry({ message: '第二步', round: 2 }),
          createTestLogEntry({ message: '第三步', phase: GamePhase.PhaseDraw }),
        ]

        const json = LogSerializer.serializeLogs(logs)
        expect(typeof json).toBe('string')
        expect(json).toContain('第一步')

        const deserialized = LogSerializer.deserializeLogs(json)
        expect(deserialized).toHaveLength(3)
        expect(deserialized[0]!.message).toBe('第一步')
        expect(deserialized[1]!.round).toBe(2)
        expect(deserialized[2]!.phase).toBe(GamePhase.PhaseDraw)
      })

      it('should produce valid parseable JSON', () => {
        const logs = [createTestLogEntry()]
        const json = LogSerializer.serializeLogs(logs)

        // Should not throw
        const parsed = JSON.parse(json)
        expect(Array.isArray(parsed)).toBe(true)
      })

      it('should throw on invalid JSON', () => {
        expect(() => LogSerializer.deserializeLogs('not json')).toThrow()
      })

      it('should throw on non-array JSON', () => {
        expect(() => LogSerializer.deserializeLogs('{"key": "value"}')).toThrow(
          /不是数组格式/,
        )
      })
    })

    describe('createReplayData', () => {
      it('should create complete replay data', () => {
        const initialState = createTestState({ currentRound: 1 })
        const finalState = createTestState({ currentRound: 10, finished: true })
        const logs = [createTestLogEntry(), createTestLogEntry()]

        const replay = LogSerializer.createReplayData(
          initialState,
          logs,
          finalState,
          '测试结束',
        )

        expect(replay.version).toBe(LogSerializer.VERSION)
        expect(replay.mode).toBe('test')
        expect(replay.logs).toHaveLength(2)
        expect(replay.result).toBe('测试结束')
        expect(replay.initialState.currentRound).toBe(1)
        expect(replay.finalState.currentRound).toBe(10)
      })
    })

    describe('serializeReplay / deserializeReplay', () => {
      it('should round-trip replay data', () => {
        const initialState = createTestState()
        const finalState = createTestState({ finished: true })
        const replay = LogSerializer.createReplayData(
          initialState,
          [createTestLogEntry({ message: '唯一日志' })],
          finalState,
          '平局',
        )

        const json = LogSerializer.serializeReplay(replay)
        const restored = LogSerializer.deserializeReplay(json)

        expect(restored.version).toBe(replay.version)
        expect(restored.logs).toHaveLength(1)
        expect(restored.logs[0]!.message).toBe('唯一日志')
        expect(restored.result).toBe('平局')
      })

      it('should throw on incompatible version', () => {
        const replay = LogSerializer.createReplayData(
          createTestState(),
          [],
          createTestState(),
          'ok',
        )
        ;(replay as any).version = 999

        const json = LogSerializer.serializeReplay(replay)
        expect(() => LogSerializer.deserializeReplay(json)).toThrow(/版本/)
      })
    })

    describe('compareLogs', () => {
      it('should return true for identical logs', () => {
        const logs = [createTestLogEntry({ message: 'A' })]

        const json = LogSerializer.serializeLogs(logs)
        const restored = LogSerializer.deserializeLogs(json)

        expect(LogSerializer.compareLogs(logs, restored)).toBe(true)
      })

      it('should return false for different lengths', () => {
        const a = [createTestLogEntry()]
        const b = [createTestLogEntry(), createTestLogEntry()]
        expect(LogSerializer.compareLogs(a, b)).toBe(false)
      })

      it('should return false for different content', () => {
        const a = [createTestLogEntry({ message: 'A' })]
        const b = [createTestLogEntry({ message: 'B' })]
        expect(LogSerializer.compareLogs(a, b)).toBe(false)
      })
    })
  })

  // ================================================================
  // ReplayEngine
  // ================================================================

  describe('ReplayEngine', () => {
    it('should start with initial state from replay data', () => {
      const initialState = createTestState({ currentRound: 1 })
      const replay: GameReplayData = {
        version: 1,
        mode: 'test',
        playerCount: 0,
        totalRounds: 1,
        result: 'ok',
        initialState,
        logs: [],
        finalState: createTestState(),
        createdAt: Date.now(),
      }

      const engine = ReplayEngine.fromReplayData(replay)
      const state = engine.getCurrentState()
      expect(state.currentRound).toBe(1)
    })

    it('should step forward through each log entry', () => {
      const initialState = createTestState()
      const logs = [
        createTestLogEntry({ message: 'Step 1', round: 1 }),
        createTestLogEntry({ message: 'Step 2', round: 2 }),
        createTestLogEntry({ message: 'Step 3', round: 3 }),
      ]

      const replay = LogSerializer.createReplayData(
        initialState,
        logs,
        createTestState(),
        'done',
      )

      const engine = ReplayEngine.fromReplayData(replay)
      expect(engine.hasNext).toBe(true)
      expect(engine.totalSteps).toBe(3)

      const step1 = engine.stepForward()
      expect(step1).toBeDefined()
      expect(step1!.log.message).toBe('Step 1')
      expect(step1!.index).toBe(0)

      const step2 = engine.stepForward()
      expect(step2!.log.message).toBe('Step 2')
      expect(step2!.index).toBe(1)

      const step3 = engine.stepForward()
      expect(step3!.log.message).toBe('Step 3')
      expect(step3!.index).toBe(2)

      // No more steps
      expect(engine.hasNext).toBe(false)
      expect(engine.isFinished).toBe(true)
      expect(engine.stepForward()).toBeNull()
    })

    it('should handle empty logs', () => {
      const initialState = createTestState()
      const replay = LogSerializer.createReplayData(
        initialState,
        [],
        createTestState(),
        'empty',
      )

      const engine = ReplayEngine.fromReplayData(replay)
      expect(engine.totalSteps).toBe(0)
      expect(engine.hasNext).toBe(false)
      expect(engine.isFinished).toBe(true)
      expect(engine.stepForward()).toBeNull()
    })

    it('should jump to a specific step', () => {
      const initialState = createTestState()
      const logs = Array.from({ length: 10 }, (_, i) =>
        createTestLogEntry({ message: `Log ${i}`, round: i + 1 }),
      )

      const replay = LogSerializer.createReplayData(
        initialState,
        logs,
        createTestState(),
        'done',
      )

      const engine = ReplayEngine.fromReplayData(replay)
      const step = engine.jumpTo(5)
      expect(step).toBeDefined()
      expect(step!.index).toBe(5)
      expect(step!.log.message).toBe('Log 5')
    })

    it('should reset to initial state', () => {
      const initialState = createTestState({ currentRound: 1 })
      const logs = [createTestLogEntry(), createTestLogEntry()]

      const replay = LogSerializer.createReplayData(
        initialState,
        logs,
        createTestState(),
        'done',
      )

      const engine = ReplayEngine.fromReplayData(replay)
      expect(engine.currentStep).toBe(0)
      engine.stepForward()
      engine.stepForward()
      expect(engine.isFinished).toBe(true)

      engine.reset()
      expect(engine.currentStep).toBe(0)
      expect(engine.hasNext).toBe(true)
      expect(engine.getCurrentState().currentRound).toBe(1)
    })

    it('should replay all steps to completion', () => {
      const initialState = createTestState()
      const logs = Array.from({ length: 5 }, (_, i) =>
        createTestLogEntry({ message: `Event ${i}` }),
      )

      const replay = LogSerializer.createReplayData(
        initialState,
        logs,
        createTestState(),
        'done',
      )

      const engine = ReplayEngine.fromReplayData(replay)
      const finalState = engine.replayAll()

      expect(engine.isFinished).toBe(true)
      expect(finalState).toBeDefined()
    })

    it('should verify replay consistency', () => {
      const logs = [createTestLogEntry(), createTestLogEntry()]
      const initialState = createTestState()
      const finalState = createTestState()
      finalState.log.push(...logs)

      const replay = LogSerializer.createReplayData(
        initialState,
        logs,
        finalState,
        'ok',
      )

      const engine = ReplayEngine.fromReplayData(replay)
      engine.replayAll()

      const result = engine.verifyReplay()
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})
