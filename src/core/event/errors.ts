// ============================================================
// 联盟杀 · 事件系统错误类型
//
// 事件系统过去用裸 `new Error('[EventDispatcher] ...')` 抛错，
// 调用方只能靠字符串匹配区分，无法精确捕获。
// 这里定义带类型的错误，让「嵌套过深」「步骤失控」可被单独 catch。
// ============================================================

/** 事件系统错误基类 */
export class EventError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
    // 继承内置 Error 时修复原型链（TS 编译到 ES5 也安全）
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * 事件嵌套深度超过上限
 *
 * 通常意味着效果之间形成了互相触发的环（A 触发 B，B 又触发 A）。
 */
export class EventNestingError extends EventError {
  constructor(
    readonly eventName: string,
    readonly depth: number,
    readonly maxDepth: number,
  ) {
    super(
      `[Event] 事件嵌套深度超过上限 (${maxDepth}): ${eventName} (actual: ${depth})`,
    )
  }
}

/**
 * 步骤机迭代次数超过上限
 *
 * 步骤机是循环而非递归（不会爆栈），但没有出口的 `goto` 会空转，
 * 因此用迭代预算兜底。
 */
export class EventStepOverflowError extends EventError {
  constructor(
    readonly eventName: string,
    readonly iterations: number,
  ) {
    super(
      `[Event] 步骤机迭代超过上限 (${iterations}): ${eventName}` +
        ` —— 检查是否存在无出口的 goto 循环`,
    )
  }
}

/**
 * 事件未挂载运行器时尝试触发子事件
 *
 * `event.trigger()` 需要把子事件交给调度器执行。
 * 若事件尚未进入调度（例如在测试中直接 `new GameEvent()`），则无法触发。
 */
export class EventRunnerMissingError extends EventError {
  constructor(readonly eventName: string) {
    super(
      `[Event] 事件「${eventName}」尚未进入调度，无法 trigger 子事件` +
        ` —— 请通过 EventDispatcher.dispatch() 驱动该事件`,
    )
  }
}

/**
 * 结算点轮询轮数超过上限
 *
 * 结算点每轮都会重新询问尚未响应的玩家。正常情况轮数 ≤ 参与人数 + 1
 * （每轮至少有此前放弃的玩家转为响应，或无人响应而结束）。
 * 触顶意味着 `optionsFor` 恒返回非空且玩家「响应」却没有被记入 acted。
 */
export class EventSettlementOverflowError extends EventError {
  constructor(
    readonly pointId: string,
    readonly rounds: number,
    readonly responderCount: number,
  ) {
    super(
      `[Event] 结算点轮询超过上限 (${rounds} 轮 / ${responderCount} 人): ${pointId}` +
        ` —— 检查 onRespond 是否漏记 acted，或 optionsFor 是否恒非空`,
    )
  }
}

/**
 * 非法的事件状态转移
 */
export class EventTransitionError extends EventError {
  constructor(
    readonly eventName: string,
    readonly eventId: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(
      `[Event] 非法状态转移: ${from} → ${to} (event: ${eventName}, id: ${eventId})`,
    )
  }
}
