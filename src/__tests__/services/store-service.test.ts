import { describe, expect, it, vi } from 'vitest'
import { StoreService } from '@core/services/store-service'
import { GameState } from '@core/entity/game-state'
import { Player } from '@core/entity/player'
import type { GameStateSnapshot } from '@core/contracts/game.interface'

/**
 * 构造状态快照。
 *
 * StoreService 契约要求传入 `GameStateSnapshot`（纯数据），
 * 而非 `GameState` 实例——后者派生字段是原型 getter，展开会丢失。
 */
function makeSnapshot(): GameStateSnapshot {
  return new GameState({
    players: [
      new Player({ id: 'p0', seatIndex: 0, hp: 4, maxHp: 4 }),
      new Player({ id: 'p1', seatIndex: 1, hp: 4, maxHp: 4 }),
    ],
  }).snapshot()
}

describe('StoreService', () => {
  it('未同步时 getGameState 抛错，getGameStateSafe 返回 null', () => {
    const service = new StoreService()
    expect(service.getGameStateSafe()).toBeNull()
    expect(() => service.getGameState()).toThrow('尚未初始化')
  })

  it('syncGameState 后可读到快照并缓存玩家状态', () => {
    const service = new StoreService()
    service.syncGameState(makeSnapshot())

    expect(service.getGameState().aliveCount).toBe(2)
    expect(service.getPlayerState('p0')?.id).toBe('p0')
  })

  it('onChange 返回注销函数，注销后不再收到通知', () => {
    const service = new StoreService()
    const listener = vi.fn<(snapshot: GameStateSnapshot) => void>()

    const unsubscribe = service.onChange(listener)
    service.syncGameState(makeSnapshot())
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    service.syncGameState(makeSnapshot())
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('offChange 可注销指定回调', () => {
    const service = new StoreService()
    const listener = vi.fn<(snapshot: GameStateSnapshot) => void>()
    service.onChange(listener)
    service.offChange(listener)
    service.syncGameState(makeSnapshot())
    expect(listener).not.toHaveBeenCalled()
  })

  it('回调内部抛错不影响其它回调', () => {
    const service = new StoreService()
    const bad = vi.fn<(snapshot: GameStateSnapshot) => void>(() => {
      throw new Error('listener error')
    })
    const good = vi.fn<(snapshot: GameStateSnapshot) => void>()
    service.onChange(bad)
    service.onChange(good)

    expect(() => service.syncGameState(makeSnapshot())).not.toThrow()
    expect(good).toHaveBeenCalledTimes(1)
  })

  it('reset 清空状态与回调', () => {
    const service = new StoreService()
    const listener = vi.fn<(snapshot: GameStateSnapshot) => void>()
    service.onChange(listener)
    service.syncGameState(makeSnapshot())
    expect(listener).toHaveBeenCalledTimes(1)

    service.reset()
    expect(service.getGameStateSafe()).toBeNull()
    expect(service.getPlayerState('p0')).toBeUndefined()

    // 重置后回调已注销，后续同步不再通知
    service.syncGameState(makeSnapshot())
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
