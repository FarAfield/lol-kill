// ============================================================
// 联盟杀 · 回放（Replay）
//
// 一局 = 种子 + 决策序列。两者记下来，这局就能重新长出来。
// ============================================================

export {
  DecisionRecorder,
  ReplayDecisionService,
  ReplayDivergenceError,
  type DecisionKind,
  type ReplayDecision,
} from './decision-recorder'

export { EventTrail, allBuiltinEventNames } from './event-trail'
export { AutoDecisionService } from './auto-decision'

export {
  ReplayEngine,
  REPLAY_VERSION,
  type ReplayBundle,
  type ReplayOutcome,
  type ReplayRecord,
  type ReplayRunOptions,
} from './replay-engine'
