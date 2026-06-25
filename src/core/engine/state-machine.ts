// ============================================================
// 联盟杀 · GameStateMachine — 游戏宏观状态机
//
// 管理游戏从"未开始"到"结束"的完整生命周期。
// 支持条件转移、通配符、非法转移回调以及转移前后钩子。
//
// 状态流转图:
//   NotStarted → Prepare → RoundStart → PhasePre → PhaseJudge
//                                                   → PhaseDraw
//                                                   → PhaseUse
//                                                   → PhaseDiscard
//                                         → PhasePost → RoundEnd
//                                         → GameOver (任意状态均可)
// ============================================================

import { GamePhase } from '@core/contracts/enums'
import type { IGameState } from '@core/contracts/game.interface'

// ── 类型定义 ──

/**
 * 转移规则
 *
 * 定义从一个状态可以转移到哪些目标状态，
 * 以及可选的转移条件。
 */
export interface TransitionRule {
  /** 目标状态 */
  to: GamePhase
  /** 转移条件（可选），返回 true 时允许转移 */
  condition?: (state: IGameState) => boolean
}

/**
 * 状态机生命周期钩子
 */
export interface StateMachineHooks {
  /**
   * 非法转移回调 — 当 transition() 被调用但目标状态不在允许列表中时触发。
   * 用于调试和日志记录，不阻止调用者的返回值。
   */
  onIllegalTransition?: (from: GamePhase, to: GamePhase, state: IGameState) => void

  /**
   * 转移前钩子 — 在实际修改 currentState 之前调用。
   * 支持异步，钩子完成后才会执行状态修改。
   */
  onBeforeTransition?: (from: GamePhase, to: GamePhase, state: IGameState) => void | Promise<void>

  /**
   * 转移后钩子 — 在 currentState 变更且写入历史记录之后调用。
   */
  onAfterTransition?: (from: GamePhase, to: GamePhase, state: IGameState) => void | Promise<void>
}

/**
 * 通配符键 — 用于注册"从任意状态均可转移"的规则。
 */
export const WILDCARD = Symbol('wildcard')

// ── 状态机实现 ──

export class GameStateMachine {
  /** 当前状态 */
  private current: GamePhase

  /** 状态 → 允许的转移规则 */
  private stateTransitions: Map<GamePhase, TransitionRule[]>

  /** 通配符转移规则（从任意状态均可适用） */
  private wildcardTransitions: TransitionRule[]

  /** 状态历史（含初始状态） */
  private history: GamePhase[]

  /** 生命周期钩子 */
  private hooks: StateMachineHooks

  /**
   * @param initialState 初始状态
   * @param hooks        可选的生命周期钩子
   */
  constructor(initialState: GamePhase, hooks?: StateMachineHooks) {
    this.current = initialState
    this.stateTransitions = new Map()
    this.wildcardTransitions = []
    this.history = [initialState]
    this.hooks = hooks ?? {}
  }

  // ── 状态注册 ──

  /**
   * 注册一个状态及其允许的转移目标。
   *
   * `state` 为 `WILDCARD` 符号时，注册的规则将应用于**所有**状态（通配符匹配）。
   *
   * @param state       源状态，或 WILDCARD 符号表示任意状态
   * @param transitions 允许转移到的目标状态（可附带条件）
   *
   * @example
   * // 简单注册
   * sm.registerState(GamePhase.PhaseUse, [GamePhase.PhaseDiscard, GamePhase.PhasePost])
   *
   * // 注册通配符：任意状态均可转到 GameOver
   * sm.registerState(WILDCARD, [GamePhase.GameOver])
   *
   * // 带条件的转移
   * sm.registerState(GamePhase.RoundEnd, [
   *   { to: GamePhase.RoundStart, condition: s => s.currentRound < s.config.maxRounds },
   *   { to: GamePhase.GameOver,   condition: s => s.currentRound >= s.config.maxRounds },
   * ])
   */
  registerState(
    state: GamePhase | typeof WILDCARD,
    transitions: (GamePhase | TransitionRule)[],
  ): void {
    const rules: TransitionRule[] = transitions.map((t) => {
      if (typeof t === 'string') {
        return { to: t as GamePhase }
      }
      return t
    })

    if (state === WILDCARD) {
      this.wildcardTransitions.push(...rules)
    } else {
      const existing = this.stateTransitions.get(state) ?? []
      this.stateTransitions.set(state, [...existing, ...rules])
    }
  }

  // ── 状态转移 ──

  /**
   * 尝试从当前状态转移到目标状态。
   *
   * 流程:
   * 1. 检查转移合法性（含条件判断）
   * 2. 不合法 → 触发 onIllegalTransition 回调 → 返回 false
   * 3. 合法   → 触发 onBeforeTransition → 修改状态 → 写入历史 → 触发 onAfterTransition → 返回 true
   *
   * @param to    目标状态
   * @param state 当前游戏状态（用于条件判断和钩子）
   * @returns 是否成功转移
   */
  async transition(to: GamePhase, state: IGameState): Promise<boolean> {
    if (!this.canTransition(to, state)) {
      this.hooks.onIllegalTransition?.(this.current, to, state)
      return false
    }

    const from = this.current

    await this.hooks.onBeforeTransition?.(from, to, state)

    this.current = to
    this.history.push(to)

    await this.hooks.onAfterTransition?.(from, to, state)

    return true
  }

  // ── 查询 ──

  /**
   * 检查是否可以从当前状态转移到目标状态。
   *
   * 匹配顺序:
   * 1. 检查当前状态专属的转移规则（含条件）
   * 2. 再检查通配符转移规则（含条件）
   * 3. 两项均无匹配 → 不可转移
   *
   * @param to    目标状态
   * @param state 游戏状态（条件判断用，可选）
   */
  canTransition(to: GamePhase, state?: IGameState): boolean {
    const specificRules = this.stateTransitions.get(this.current) ?? []
    const allRules = [...specificRules, ...this.wildcardTransitions]

    return allRules.some((rule) => {
      if (rule.to !== to) return false
      if (rule.condition && state) {
        return rule.condition(state)
      }
      return true
    })
  }

  /**
   * 获取当前状态下所有可用的转移目标。
   *
   * @param state 游戏状态（条件判断用，可选）
   */
  getAvailableTransitions(state?: IGameState): GamePhase[] {
    const specificRules = this.stateTransitions.get(this.current) ?? []
    const allRules = [...specificRules, ...this.wildcardTransitions]

    return allRules
      .filter((rule) => {
        if (rule.condition && state) {
          return rule.condition(state)
        }
        return true
      })
      .map((rule) => rule.to)
  }

  /** 当前状态 */
  get currentState(): GamePhase {
    return this.current
  }

  /**
   * 获取状态转移历史（只读副本）。
   * 包含初始状态。
   */
  getStateHistory(): readonly GamePhase[] {
    return [...this.history]
  }

  /**
   * 历史步数（含初始状态）
   */
  get historyLength(): number {
    return this.history.length
  }

  /**
   * 上一次状态（当前状态之前的状态）。
   * 仅在当前状态为初始状态时与 currentState 相同。
   */
  get previousState(): GamePhase {
    if (this.history.length < 2) return this.current
    return this.history[this.history.length - 2]!
  }

  // ── 生命周期 ──

  /**
   * 重置状态机到指定初始状态。
   * 清空历史记录。
   */
  reset(initialState: GamePhase): void {
    this.current = initialState
    this.history = [initialState]
  }

  /**
   * 设置（替换）生命周期钩子。
   */
  setHooks(hooks: StateMachineHooks): void {
    this.hooks = { ...this.hooks, ...hooks }
  }
}
