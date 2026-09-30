// ============================================================
// 联盟杀 · Event 模块统一导出
// ============================================================

// ── EventChain (LIFO 栈) ──
export { EventChain } from './event-chain'

// ── GameEvent (事件实体) ──
export { GameEvent, MAX_STEP_ITERATIONS } from './game-event'
export type { GameEventOptions } from './game-event'

// ── EventDispatcher (AOP 流水线) ──
export { EventDispatcher } from './event-dispatcher'
export type { EventDispatcherOptions } from './event-dispatcher'

// ── EventTrigger (触发匹配) ──
export { EventTrigger } from './event-trigger'

// ── EventPauseManager (按事件粒度暂停/恢复) ──
export { EventPauseManager } from './event-pause-manager'
export type { PauseState } from './event-pause-manager'

// ── 事件错误类型 ──
export {
  EventError,
  EventNestingError,
  EventStepOverflowError,
  EventRunnerMissingError,
  EventTransitionError,
  EventSettlementOverflowError,
} from './errors'

// ── PriorityManager (优先级排序) ──
export { PriorityManager, sortHandlers } from './priority-manager'

// ── EventCompiler (事件编译) ──
export { EventCompiler } from './event-compiler'

// ── 全局钩子（不属于任何人的监听）──
export { GlobalHookRegistry } from './global-hook'
export type { GlobalHookFn, GlobalHookOptions, IGlobalHook } from './global-hook'

// ── when() 构造器（一次性监听）──
export { WhenBuilder, whenOf } from './when'

// ── ContentRegistry (事件默认处理器) ──
export { ContentRegistry } from './content-registry'
export type { EventContent, ContentEntry } from './content-registry'

// ── 内容写作助手 ──
export { helpers } from './content-helpers'
export type { ContentHelpers } from './content-helpers'

// ── 结算点（暂停 + 座次轮询 + 插入） ──
export { SettlementRunner, seatOrderFrom, seatDistance } from './settlement'
export type {
  ResponseOption,
  ResponseAsker,
  SettlementPoint,
  SettlementResponse,
  SettlementResult,
} from './settlement'

// ── 响应征询 ──
export { cardOptions, handOptions, createAsker, settle } from './response-inquiry'

// ── 无懈可击链式抵消（后发先至） ──
export {
  openCancelChain,
  canBeCountered,
  registerCancelGuard,
  clearCancelGuards,
  isGameEventLike,
  MAX_CANCEL_CHAIN,
  COUNTER_TARGET_KEY,
  COUNTER_LABEL_KEY,
  COUNTER_CHAIN_KEY,
} from './cancel-chain'
export type { CancelChainResult, CancelGuard } from './cancel-chain'
