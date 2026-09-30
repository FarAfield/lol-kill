// ============================================================
// 联盟杀 · StoreService — IStoreService 实现
//
// 负责将引擎的纯内存 GameState 同步到 Pinia Store，
// 作为引擎（纯 TS）与 UI（Vue 响应式）之间的桥接。
//
// 设计原则：
// - 单向同步：引擎 → Store（UI 不直接修改 Store 中的游戏数据）
// - 浅拷贝安全：同步时创建数据的只读副本
// - 可替换：通过 DI 容器注入，便于测试
// ============================================================

import type { IStoreService } from '@core/contracts/services.interface'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'

/**
 * StoreService — 引擎状态 → Pinia Store 同步桥接
 *
 * 在 GameEngine 每次状态变更后调用 syncGameState，
 * 将最新的游戏状态推送到 Pinia Store 供 UI 组件消费。
 */
export class StoreService implements IStoreService {
  private gameState: Readonly<GameStateSnapshot> | null = null
  private playerStates: Map<string, Readonly<IPlayer>> = new Map()
  private onChangeCallbacks: Array<(state: Readonly<GameStateSnapshot>) => void> = []

  /**
   * 同步完整游戏状态。
   *
   * 引擎在以下时机调用：
   * - init() 完成后
   * - start() 后
   * - 每个阶段推进后
   * - 任何事件结算完成后
   *
   * @param state 游戏状态快照
   */
  syncGameState(state: GameStateSnapshot): void {
    // 浅拷贝确保 UI 侧拿到的是稳定快照
    this.gameState = Object.freeze({
      ...state,
      players: state.players.map((p) => ({ ...p })),
    })

    // 同步每个玩家
    for (const player of state.players) {
      this.syncPlayerState(player)
    }

    // 触发变更回调
    this.notifyChange()
  }

  /**
   * 同步单个玩家状态。
   *
   * @param player 玩家实体
   */
  syncPlayerState(player: IPlayer): void {
    this.playerStates.set(player.id, Object.freeze({ ...player }))
  }

  /**
   * 获取当前游戏状态（只读）。
   */
  getGameState(): Readonly<GameStateSnapshot> {
    if (!this.gameState) {
      throw new Error('[StoreService] 游戏状态尚未初始化，请先调用 syncGameState()')
    }
    return this.gameState
  }

  /**
   * 安全获取游戏状态（不抛异常）。
   */
  getGameStateSafe(): Readonly<GameStateSnapshot> | null {
    return this.gameState
  }

  /**
   * 获取指定玩家的状态快照。
   */
  getPlayerState(playerId: string): Readonly<IPlayer> | undefined {
    return this.playerStates.get(playerId)
  }

  /**
   * 注册状态变更回调。
   *
   * Pinia Store 可以注册此回调以自动更新响应式状态。
   */
  onChange(callback: (state: Readonly<GameStateSnapshot>) => void): () => void {
    this.onChangeCallbacks.push(callback)
    return () => this.offChange(callback)
  }

  /**
   * 取消注册状态变更回调。
   */
  offChange(callback: (state: Readonly<GameStateSnapshot>) => void): void {
    this.onChangeCallbacks = this.onChangeCallbacks.filter((cb) => cb !== callback)
  }

  /**
   * 重置所有状态（新游戏开始时调用）。
   */
  reset(): void {
    this.gameState = null
    this.playerStates.clear()
    this.onChangeCallbacks = []
  }

  // ── 私有方法 ──

  /**
   * 通知所有注册的变更回调。
   */
  private notifyChange(): void {
    if (!this.gameState) return
    for (const callback of this.onChangeCallbacks) {
      try {
        callback(this.gameState)
      } catch (err) {
        console.error('[StoreService] onChange callback error:', err)
      }
    }
  }
}
