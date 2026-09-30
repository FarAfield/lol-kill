// ============================================================
// 联盟杀 · 装备内容（Phase 7.6）
//
// `equip` 事件的内容只有一个动作：把牌装到对应槽位。
//
// 注意区分两件事：
// - **装备这件事本身** → 这里是内容（Content）
// - **装备带来的被动能力**（青釭剑无视防具、诸葛连弩无出杀上限…）
//   → 那是技能（Trigger / Mod），在 `source/base/effects/equip-effects.ts`。
//     挂载与卸载不用这里操心：`CardSystem.moveCard` 一发现装备区有变动
//     就会通知 `SkillRegistry`，由它按装备区现状挂上 / 摘掉。
// ============================================================

import type { EventContent } from '@core/event/content-registry'

export const equipContent: EventContent = async (ctx) => {
  const card = ctx.event.card
  if (!card) return

  await ctx.equipCard(card)
}
