// ============================================================
// 联盟杀 · ReplayEngine — 游戏回放引擎
//
// 从序列化的游戏日志重建游戏状态并逐步回放。
//
// 功能：
// - 从 GameReplayData 加载录像
// - stepForward() — 逐步前进
// - jumpTo(step) — 跳转到指定步骤
// - getCurrentState() — 获取当前步骤的游戏状态
//
// 限制：
// - 仅支持前向回放（forward-only），不支持后退
// - 不支持交互式操作（纯回放，不执行引擎逻辑）
//
// 用法：
//   const replay = ReplayEngine.fromReplayData(replayData)
//   while (replay.hasNext) {
//     const state = replay.stepForward()
//   }
// ============================================================

import { GameState } from '@core/entity/game-state'
import type { GameReplayData } from '@core/services/log-serializer'
import type { IGameState } from '@core/contracts/game.interface'
import type { LogEntry } from '@core/contracts/types'

/**
 * 回放步骤信息
 */
export interface ReplayStep {
  /** 步骤序号（从 0 开始） */
  index: number
  /** 对应的日志条目 */
  log: LogEntry
  /** 该步骤时的游戏状态快照 */
  state: IGameState
}

/**
 * 游戏回放引擎
 *
 * 基于 GameReplayData 重建游戏过程，逐步回放。
 * 每个步骤对应一条日志条目。
 *
 * 当前仅支持前向回放。不支持反向跳转（需要状态快照历史栈）。
 */
export class ReplayEngine {
  /** 录像数据 */
  readonly replayData: GameReplayData

  /** 当前步骤序号（-1 表示尚未开始） */
  private currentIndex: number

  /** 当前游戏状态 */
  private currentState: IGameState

  /**
   * @param replayData 录像数据
   */
  constructor(replayData: GameReplayData) {
    this.replayData = replayData
    this.currentIndex = -1
    // 从初始状态开始
    this.currentState = GameState.restore(replayData.initialState)
  }

  /**
   * 从 GameReplayData 创建回放引擎。
   *
   * @param replayData 录像数据
   */
  static fromReplayData(replayData: GameReplayData): ReplayEngine {
    return new ReplayEngine(replayData)
  }

  /**
   * 获取当前游戏状态。
   */
  getCurrentState(): Readonly<IGameState> {
    return this.currentState.snapshot()
  }

  /**
   * 获取总步骤数。
   */
  get totalSteps(): number {
    return this.replayData.logs.length
  }

  /**
   * 获取当前步骤序号（0-based）。
   */
  get currentStep(): number {
    return Math.max(0, this.currentIndex)
  }

  /**
   * 是否还有更多步骤。
   */
  get hasNext(): boolean {
    return this.currentIndex + 1 < this.replayData.logs.length
  }

  /**
   * 是否已到达最后一步。
   */
  get isFinished(): boolean {
    return this.currentIndex >= this.replayData.logs.length - 1
  }

  /**
   * 前进一步。
   *
   * 应用下一条日志对应的状态变更。
   * 注意：由于日志不包含完整的状态差异，
   * 此方法主要推进 currentIndex 并返回当前日志条目。
   * 实际的状态重建需要结合具体的日志语义。
   *
   * @returns 当前步骤的信息，如果已结束则返回 null
   */
  stepForward(): ReplayStep | null {
    if (!this.hasNext) return null

    this.currentIndex++
    const log = this.replayData.logs[this.currentIndex]!

    // 更新状态中的回合/阶段信息（从日志中提取）
    if (log.round && log.round !== this.currentState.currentRound) {
      ;(this.currentState as any).currentRound = log.round
    }
    if (log.phase) {
      ;(this.currentState as any).currentPhase = log.phase
    }

    // 将日志条目追加到当前状态
    this.currentState.log.push(log)

    return {
      index: this.currentIndex,
      log,
      state: this.currentState.snapshot(),
    }
  }

  /**
   * 跳转到指定步骤。
   *
   * 从第一步开始重新回放到目标步骤。
   * 对于长跳转，建议使用 seekForward（从头开始）。
   *
   * @param step 目标步骤序号（0-based）
   * @returns 目标步骤的信息，如果序号无效则返回 null
   */
  jumpTo(step: number): ReplayStep | null {
    if (step < 0 || step >= this.replayData.logs.length) return null
    if (step < this.currentIndex) {
      // 反向跳转：重置并从头回放
      this.reset()
    }

    while (this.currentIndex < step && this.hasNext) {
      this.stepForward()
    }

    return this.currentIndex === step
      ? {
          index: this.currentIndex,
          log: this.replayData.logs[this.currentIndex]!,
          state: this.currentState.snapshot(),
        }
      : null
  }

  /**
   * 回放所有步骤到结束。
   *
   * @returns 最终状态
   */
  replayAll(): IGameState {
    while (this.hasNext) {
      this.stepForward()
    }
    return this.currentState.snapshot()
  }

  /**
   * 重置回放到初始状态。
   */
  reset(): void {
    this.currentIndex = -1
    this.currentState = GameState.restore(this.replayData.initialState)
  }

  /**
   * 验证回放结果与预期最终状态一致。
   *
   * 比较日志数量、回合数和状态摘要。
   *
   * @returns 验证结果
   */
  verifyReplay(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 日志数量一致
    if (this.currentState.log.length !== this.replayData.finalState.log.length) {
      errors.push(
        `日志数量不一致: 回放 ${this.currentState.log.length} vs 预期 ${this.replayData.finalState.log.length}`,
      )
    }

    // 最终回合数一致
    if (this.currentState.currentRound !== this.replayData.totalRounds) {
      errors.push(
        `最终回合不一致: 回放 ${this.currentState.currentRound} vs 预期 ${this.replayData.totalRounds}`,
      )
    }

    // 存活玩家数一致（可在回放全部完成后调用）
    if (this.currentState.aliveCount > 0) {
      const expectedAlive = this.replayData.finalState.players.filter(
        (p) => p.alive,
      ).length
      if (this.currentState.aliveCount !== expectedAlive) {
        errors.push(
          `存活玩家数不一致: 回放 ${this.currentState.aliveCount} vs 预期 ${expectedAlive}`,
        )
      }
    }

    return { valid: errors.length === 0, errors }
  }
}
