// ============================================================
// 联盟杀 · 濒死结算
//
// 「濒死」是一个事件，它的默认内容就是**求桃**：
// 从濒死者自己开始按座次问一圈，谁愿意出桃。
// 有人出桃 → 救活；无人出桃 → 死亡结算。
//
// 把濒死做成事件而不是直接写在伤害里，是为了让技能能挂钩：
// 「他人濒死时」`dying`、`die` 这类时机才有落点。
// ============================================================

import type { EventContent } from '@core/event/content-registry'
import type { IPlayer } from '@core/contracts/player.interface'

/** 从事件数据里取濒死角色 */
function dyingPlayer(data: Record<string, unknown>): IPlayer | undefined {
  const value = data['dyingPlayer']
  if (value && typeof value === 'object' && 'alive' in value) {
    return value as IPlayer
  }
  return undefined
}

/**
 * 死亡事件 —— 奖惩在这里落地
 *
 * `DeathSystem.handleReward` 只负责**判定奖惩张数**并记进 `rewardDraw`
 * 标记（它是状态变更，属于 system 层）；真正把牌摸到手上发生在内容层。
 *
 * 早先这段链路缺了后半截：标记写上去了，全仓没有一个读它的地方，
 * 于是「击杀反贼摸三张」这条规则等于没写。这里就是那个消费方。
 */
export const dieContent: EventContent = async (ctx) => {
  const killer = ctx.event.source
  if (!killer || !killer.alive) return

  const count = ctx.getMark(killer, 'rewardDraw')
  if (count <= 0) return

  // 先清零再摸：摸牌会发 `gain` 事件，链上任何一环再去看这个标记
  // 都不该再看到「还欠三张」。
  ctx.setMark(killer, 'rewardDraw', 0)
  await ctx.drawCards(count)
}

export const dyingContent: EventContent = async (ctx) => {
  const target = dyingPlayer(ctx.event.data) ?? ctx.event.target
  if (!target) return

  // 已经死了（例如同一次结算里被处理过）→ 不再求桃
  if (!target.alive) return

  const killer = ctx.event.source
  await ctx.settleDying(target, killer)
}
