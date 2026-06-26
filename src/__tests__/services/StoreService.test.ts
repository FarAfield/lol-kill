// ============================================================
// 联盟杀 · StoreService 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { StoreService } from '@core/services/store-service'
import { GameState, createDefaultConfig } from '@core/entity/game-state'
import { Player } from '@core/entity/player'
import { GamePhase, RoleType } from '@core/contracts/enums'
import type { IGameState } from '@core/contracts/game.interface'

// ── 测试辅助 ──

function createTestState(overrides?: Partial<IGameState>): IGameState {
  const config = createDefaultConfig({
    playerCount: 4,
    roles: [RoleType.Aspect, RoleType.Guardian, RoleType.Ascended, RoleType.Infiltrator],
  })

  const players = [
    new Player({ id: 'p0', seatIndex: 0 }),
    new Player({ id: 'p1', seatIndex: 1 }),
    new Player({ id: 'p2', seatIndex: 2 }),
    new Player({ id: 'p3', seatIndex: 3 }),
  ]

  return new GameState({
    config,
    players,
    started: true,
    finished: false,
    currentRound: 1,
    currentPlayerIndex: 0,
    currentPhase: GamePhase.PhaseUse,
    ...overrides,
  }).snapshot()
}

// ── 测试 ──

describe('StoreService', () => {
  let storeService: StoreService

  beforeEach(() => {
    storeService = new StoreService()
  })

  describe('syncGameState', () => {
    it('应该存储游戏状态快照', () => {
      const state = createTestState()
      storeService.syncGameState(state)

      const stored = storeService.getGameState()
      expect(stored).toBeDefined()
      expect(stored.players.length).toBe(4)
      expect(stored.currentRound).toBe(1)
      expect(stored.currentPhase).toBe(GamePhase.PhaseUse)
    })

    it('应该同步每个玩家的状态', () => {
      const state = createTestState()
      storeService.syncGameState(state)

      const playerState = storeService.getPlayerState('p0')
      expect(playerState).toBeDefined()
      expect(playerState!.id).toBe('p0')
      expect(playerState!.seatIndex).toBe(0)
    })

    it('应该触发 onChange 回调', () => {
      const state = createTestState()
      let callbackCalled = false
      let callbackState: Readonly<IGameState> | null = null

      storeService.onChange((s) => {
        callbackCalled = true
        callbackState = s
      })

      storeService.syncGameState(state)

      expect(callbackCalled).toBe(true)
      expect(callbackState).toBeDefined()
      expect(callbackState!.currentRound).toBe(1)
    })

    it('多次 syncGameState 应该正确更新状态', () => {
      const state1 = createTestState({ currentRound: 1 })
      const state2 = createTestState({ currentRound: 2 })

      storeService.syncGameState(state1)
      expect(storeService.getGameState().currentRound).toBe(1)

      storeService.syncGameState(state2)
      expect(storeService.getGameState().currentRound).toBe(2)
    })
  })

  describe('getGameState', () => {
    it('未同步时应该抛出异常', () => {
      expect(() => {
        storeService.getGameState()
      }).toThrow(/尚未初始化/)
    })

    it('getGameStateSafe 未同步时应该返回 null', () => {
      const safe = storeService.getGameStateSafe()
      expect(safe).toBeNull()
    })
  })

  describe('syncPlayerState', () => {
    it('应该能同步单个玩家状态', () => {
      const player = new Player({ id: 'test_player', seatIndex: 5 })
      player.hp = 2
      player.maxHp = 4

      storeService.syncPlayerState(player)
      const stored = storeService.getPlayerState('test_player')

      expect(stored).toBeDefined()
      expect(stored!.hp).toBe(2)
      expect(stored!.maxHp).toBe(4)
    })
  })

  describe('onChange / offChange', () => {
    it('应该能取消注册回调', () => {
      const state = createTestState()
      let callCount = 0

      const callback = () => {
        callCount++
      }

      storeService.onChange(callback)
      storeService.syncGameState(state)
      expect(callCount).toBe(1)

      storeService.offChange(callback)
      storeService.syncGameState(state)
      expect(callCount).toBe(1) // 不应再增加
    })

    it('多个回调应该都被触发', () => {
      const state = createTestState()
      let countA = 0
      let countB = 0

      storeService.onChange(() => { countA++ })
      storeService.onChange(() => { countB++ })

      storeService.syncGameState(state)

      expect(countA).toBe(1)
      expect(countB).toBe(1)
    })
  })

  describe('reset', () => {
    it('reset 后应该清空所有状态', () => {
      const state = createTestState()
      storeService.syncGameState(state)
      expect(storeService.getGameStateSafe()).not.toBeNull()

      storeService.reset()
      expect(storeService.getGameStateSafe()).toBeNull()

      // reset 后 getGameState() 应该抛出异常
      expect(() => {
        storeService.getGameState()
      }).toThrow(/尚未初始化/)
    })

    it('reset 后 onChange 回调不应再被触发', () => {
      const state = createTestState()
      let callCount = 0

      storeService.onChange(() => { callCount++ })
      storeService.syncGameState(state)
      expect(callCount).toBe(1)

      // reset 后 onChange 回调被清空
      storeService.reset()

      // 重新同步新状态
      storeService.syncGameState(createTestState({ currentRound: 2 }))
      expect(callCount).toBe(1) // 回调已清空，不应触发
    })
  })
})
