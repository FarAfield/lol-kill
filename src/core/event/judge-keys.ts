// ============================================================
// 判定事件的数据键
//
// 一次判定里有两张牌，且**只有**「翻出来的那张」是判定结果：
//   1. 延时牌自己（乐不思蜀 / 兵粮寸断 / 闪电）——它挂在判定区等待；
//   2. 从牌堆顶翻出来的那张 —— 判定结果由它的花色点数决定。
//
// 曾经这两个东西靠两个键区分，而两个键在**不同的发起方手里含义相反**：
// 判定阶段（`PhaseManager`）把延时牌放在一个键、结果牌放在另一个键，
// 内容层自己翻牌（`EffectContext.judge`）却把结果牌放在前一个键上。
// 于是【鬼才】读那个键取「判定牌」时，在真实判定流程里拿到的是
// **延时牌**——改判改错了对象，原判定牌还被当成「换下来的」摸进了手牌。
//
// 现在只保留一个键，含义固定为「本次判定结果牌」，并且读写都走这里的
// 两个函数——生产者与消费者不各抄字符串，拼错就静默失效的坑从结构上没了。
// ============================================================

import type { ICard } from '@core/contracts/card.interface'

/** 判定事件里「本次判定结果牌」的唯一键 */
export const JUDGE_RESULT_CARD_KEY = 'judgeResultCard'

/** 读本次判定的结果牌；还没有结果（或压根不是判定事件）时给 undefined */
export function judgeResultCardOf(event: {
  data?: Record<string, unknown>
}): ICard | undefined {
  return event.data?.[JUDGE_RESULT_CARD_KEY] as ICard | undefined
}

/** 改写本次判定的结果牌（改判专用出口） */
export function setJudgeResultCard(
  event: { data?: Record<string, unknown> },
  card: ICard,
): void {
  if (!event.data) return
  event.data[JUDGE_RESULT_CARD_KEY] = card
}
