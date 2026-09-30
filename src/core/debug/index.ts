// ============================================================
// 联盟杀 · 可观测性（Phase 20）
//
// 这里的两样东西——事件嵌套树与 Mod 贡献链路——都不是游戏的一部分。
// 它们是贴在引擎上的**旁听者**：读得到一切，改不了任何东西。
//
// 因此目录名字叫 debug 而不是 engine：把它整个删掉，游戏照常跑，
// 只是排查问题的时候会瞎。这个性质必须一直成立——
// 一旦有哪条规则开始依赖这里的记录，它就不再是观测，而是逻辑，
// 而那时「关掉观测」这个动作就会改变游戏结果。
// ============================================================

export { EventTrace } from './event-trace'
export type { EventTraceNode, EventTraceExport, EventTraceStats } from './event-trace'
export { ModTrace } from './mod-trace'
export type { ModTraceQuery } from './mod-trace'
