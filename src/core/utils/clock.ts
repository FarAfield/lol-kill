// ============================================================
// 联盟杀 · 逻辑时钟
//
// 引擎内部但凡需要一个「时间」，一律取这里的递增刻度，不取挂钟。
//
// 为什么：事件的 `timestamp`、结算结果的 `endedAt` 一旦用 `Date.now()`，
// 两局同一过程就会产生两份不一样的档案——diff 里全是噪声，
// 「回放是否与录像一致」也就无法用逐字节比对来验证。
//
// 呈现层（UI 日志的墙上时间）照旧用 `Date.now()`：那是给人看的，
// 不进状态，也不参与确定性比对。
// ============================================================

/**
 * 单调递增的逻辑时钟
 *
 * `next()` 返回的数只在**同一局内**有意义，局与局之间从 0 重新开始。
 */
export class LogicalClock {
  private tickValue = 0

  /** 下一个刻度（从 1 开始） */
  next(): number {
    return ++this.tickValue
  }

  /** 当前刻度 */
  get now(): number {
    return this.tickValue
  }

  /** 归零——每局开局调用一次 */
  reset(): void {
    this.tickValue = 0
  }
}

/**
 * 引擎全局时钟
 *
 * `GameEvent` 这类到处 new 的对象够不着 GameState，只能读模块级单例；
 * 由 `GameEngine.init()` 在开局时 `reset()`，于是每一局的刻度序列都从 1 开始。
 */
export const gameClock = new LogicalClock()
