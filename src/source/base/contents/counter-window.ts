// ============================================================
// 联盟杀 · 无懈窗口内容（驱动入口）
//
// 链式抵消的**机制**在 `core/event/cancel-chain.ts`（与牌无关）；
// 这里只是把它挂成一个可被事件系统直接驱动的内容，供
// 测试与扩展包单独开一次窗口。
//
// 正常使用不需要它：每张锦囊的 `useCard` 内容会自己开窗。
// ============================================================

import {
  COUNTER_LABEL_KEY,
  COUNTER_TARGET_KEY,
  isGameEventLike,
  openCancelChain,
} from '@core/event/cancel-chain'
import type { EventContent } from '@core/event/content-registry'

/**
 * 开一次无懈可击窗口
 *
 * `data.counterTarget` 指定被抵消的事件，`data.counterLabel` 指定文案。
 */
export const counterWindowContent: EventContent = async (ctx) => {
  const target = ctx.event.data[COUNTER_TARGET_KEY]
  if (!isGameEventLike(target)) return

  await openCancelChain(
    ctx,
    target,
    String(ctx.event.data[COUNTER_LABEL_KEY] ?? '锦囊'),
  )
}
