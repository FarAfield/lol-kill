// ============================================================
// 联盟杀 · 伤害内容（Phase 10）
//
// 「伤害」是一件普通事件，它的默认内容就是这条文件：
//
//   damageBefore  转移目标 / 取消伤害 / 写 extraDamage（Mod，Phase 11）
//   damageBegin   最后一道拦截（数值尚未定稿）
//   ┌ damage（Content，本文件，步骤机）
//   │   step 1  数值定稿：num = base + extra，下限 0
//   │   step 2  damageSource 子事件（烈弓一类"伤害来源相关"技能）
//   │   step 3  实际扣血 —— 全流程唯一一处写 player.hp
//   │   step 4  濒死 → 求桃 → 死亡结算
//   └
//   damageEnd     受伤后触发（反馈 / 刚烈 / 奸雄）
//   damageAfter   完全结算后（追伤）
//
// 为什么用步骤机而不是直线代码：每一步都能被内容外部观测与改写
// （`event.hasStep(3)`、`event.goto(...)`），将来「转移伤害后重新走一遍
// 伤害来源判定」这类规则不必再拆函数。
//
// 与之配套的两条铁律：
//   1. 扣血只在 step 3，且只通过 `ctx.applyDamage()`（→ DamageResolver）
//   2. 「防止伤害」= 在 damageBefore / damageBegin 里 `event.cancel()`
//      ——cancel 会跳过 Content 之后的全部阶段，因此 damageEnd / damageAfter
//      不会误触发。直接置 `prevented = true` 只跳过扣血，后续阶段照常。
// ============================================================

import type { EventContent } from '@core/event/content-registry'
import { DamageType } from '@core/contracts/enums'
import { DamageResolver } from '@core/system/damage-resolver'

/** 步骤编号——写死在常量里，便于测试与外部改写时引用 */
export const DAMAGE_STEPS = {
  /** 数值定稿（base + extra → num） */
  Resolve: 1,
  /** 伤害来源相关技能 */
  Source: 2,
  /** 扣血 */
  Apply: 3,
  /** 濒死结算 */
  Dying: 4,
} as const

/** 伤害来源子事件名（单发事件，见 contracts/event-name.ts） */
export const DAMAGE_SOURCE_EVENT = 'damageSource'

export const damageContent: EventContent = async (ctx) => {
  const event = ctx.event

  // 伤害目标可以在 damageBefore 被转移技能改写，因此每一步都重新读
  const target = () => event.target

  // ── step 1：数值定稿 ──
  //
  // 伤害点数只有一个真值源：`values.num`。进来时它装的是**基础值**，
  // 出去时是**最终值**；`baseDamage` 只是留个底，方便事后回溯
  // （「原本 1 点，被加成到 3 点」）。
  //
  // 三步合成 Pipeline：Mod（装备/技能的数值修正）→ extraDamage
  // （damageBefore 阶段技能临时写的增量）→ 下限 0。
  // Mod 走 `ctx.mods.damage()` 而不自己 if 装备，因此藤甲要区分
  // 火属性伤害这种规则，只存在于 `source/base/mods/` 一处。
  event.addStep(DAMAGE_STEPS.Resolve, () => {
    const base = event.values.num
    event.values.baseDamage = base

    const victim = target()
    const card = event.card
    const nature =
      event.nature ?? (card ? DamageResolver.damageTypeOf(card) : DamageType.Normal)

    const modified = victim
      ? ctx.mods.damage(base, event.source, victim, card, nature, event)
      : base

    event.values.num = DamageResolver.resolveAmount(modified, event.values.extraDamage)
  })

  // ── step 2：伤害来源相关技能 ──
  //
  // 单独一个子事件而不是复用 damageBegin，是因为「来源相关」要在
  // 数值定稿之后、扣血之前，且只有真的有来源时才发。
  event.addStep(DAMAGE_STEPS.Source, async () => {
    if (!event.source) return
    await event.trigger(DAMAGE_SOURCE_EVENT, {
      source: event.source,
      player: event.source,
      targets: event.targets,
      cards: event.cards,
    })
  })

  // ── step 3：实际扣血 ──
  event.addStep(DAMAGE_STEPS.Apply, async () => {
    const victim = target()
    if (!victim || !victim.alive) {
      event.result.bool = false
      event.result.num = 0
      return
    }

    // 被 prevent 标记过（区别于 cancel）：不扣血，但后续阶段照常
    if (event.prevented) {
      event.result.bool = false
      event.result.num = 0
      return
    }

    const amount = event.values.num
    const actual = await ctx.applyDamage(victim, amount)

    event.result.num = actual
    event.result.bool = actual > 0
    // 记录真正受伤的人——转移伤害后它不等于最初的 targets[0]
    event.result.targets = [victim]
    event.result.damaged = actual
  })

  // ── step 4：濒死结算 ──
  //
  // 放在伤害内容里而不是调用方（Phase 10 之前写在 EffectContext.damageTarget），
  // 因为「任何来源的伤害都要能求桃」——只有走事件的伤害才有统一路径。
  //
  // 发 `dying` 子事件而不是直接调 settleDying：濒死本身要能被技能挂钩
  // （「他人濒死时」时机），直接调函数就没人拦得住了。
  event.addStep(DAMAGE_STEPS.Dying, async () => {
    const victim = target()
    if (!victim || !victim.alive) return
    if (victim.hp > 0) return

    await event.trigger('dying', {
      source: event.source,
      targets: [victim],
      data: { dyingPlayer: victim },
    })

    // 求桃结果回写到伤害事件上，供「造成伤害后」的技能读取
    event.result.saved = victim.alive
    if (!victim.alive) {
      event.result.died = true
    }
  })
}
