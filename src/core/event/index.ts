// ============================================================
// 联盟杀 · Event 模块统一导出
// ============================================================

// ── EventChain (LIFO 栈) ──
export { EventChain } from './event-chain'

// ── GameEvent (事件实体) ──
export { GameEvent } from './game-event'
export type { GameEventOptions } from './game-event'

// ── EventDispatcher (AOP 流水线) ──
export { EventDispatcher } from './event-dispatcher'
export type { EventDispatcherOptions } from './event-dispatcher'

// ── EventTrigger (触发匹配) ──
export { EventTrigger } from './event-trigger'

// ── EventPauseManager (暂停/恢复) ──
export { EventPauseManager } from './event-pause-manager'
export type { PauseState } from './event-pause-manager'

// ── PriorityManager (优先级排序) ──
export { PriorityManager, sortHandlers } from './priority-manager'

// ── EventCompiler (事件编译) ──
export { EventCompiler } from './event-compiler'
