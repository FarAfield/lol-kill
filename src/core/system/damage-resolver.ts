// ============================================================
// 联盟杀 · DamageResolver — 伤害数值与扣血
//
// Phase 10 之前这里叫 `DamageSystem`，自带一套六段流水线
// （Before/Prevent/Modify/Apply/After/Complete）和钩子注册表，
// 与主事件链**平行**运行。后果是：
//   1. 技能拦伤害要注册 DamageHook，「防止伤害类技能永远无效」
//      （EffectContext.damageTarget 先跑完流水线把血扣了，才去 dispatch 事件）
//   2. 伤害值有两个真值源（DamageInstance.currentAmount 与 event.num）
//
// 现在伤害**就是**一个普通事件 `damage`，走标准七阶段流水线：
//
//   damageBefore  转移目标 / 取消伤害 / 写 extraDamage（Mod，Phase 11）
//   damageBegin   数值定稿
//   damage        Content：扣血（本文件是唯一写入点）+ 濒死结算
//   damageEnd     受伤后触发（反馈 / 刚烈 / 奸雄）
//   damageAfter   完全结算后（追伤）
//
// 本类因此**降级为纯函数**：不持有状态、不持有钩子、不认识事件。
// 它只回答两个问题：最终伤害是多少？扣完还剩多少血？
// ============================================================

import { DamageType } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { CardTag } from '@core/contracts/card-tag'
import type { PlayerSystem } from '@core/system/player-system'

/**
 * 伤害求解器
 *
 * 数值计算仍是纯静态的——没有注册表，也不认识事件。
 * 需要"改伤害"的技能不要来这里注册，去写 `damageBefore` 的 Trigger
 * 并把增量写进 `event.values.extraDamage`。
 *
 * 唯一不纯的是 `applyDamage`：它要真的把血扣掉，而「怎么扣」是
 * `PlayerSystem` 的事（裁到 0 为止、不越上限）。因此它被做成实例方法
 * 并持有一个 `PlayerSystem`——**这是有意的**：扣血若留在这里自己算，
 * 「HP 的夹取规则」就有了第二份实现。
 */
export class DamageResolver {
  constructor(private playerSystem: PlayerSystem) {}
  /**
   * 从卡牌标签推断伤害属性
   *
   * 一张牌同时有多个属性标签时按「火 > 雷 > 冰 > 毒」取第一个，
   * 保证结果确定（不依赖 Set 迭代顺序）。
   */
  static damageTypeOf(card: ICard): DamageType {
    if (card.tags.has(CardTag.Fire)) return DamageType.Fire
    if (card.tags.has(CardTag.Thunder)) return DamageType.Thunder
    if (card.tags.has(CardTag.Ice)) return DamageType.Ice
    if (card.tags.has(CardTag.Poison)) return DamageType.Poison
    return DamageType.Normal
  }

  /**
   * 最终伤害值
   *
   * `base` 是基础值，`extra` 是各方（Mod / 技能 / 装备）累加的增量。
   * 下限为 0——「伤害 -1」没有意义，也不允许变成回血。
   *
   * @param base  基础伤害
   * @param extra 增量（可为负）
   */
  static resolveAmount(base: number, extra: number): number {
    return Math.max(0, base + extra)
  }

  /**
   * 扣减体力 —— **伤害结算的唯一写入点**
   *
   * 只有 `damage` 事件的内容（source/base/contents/damage-content.ts）会调用它。
   * 技能 / 卡牌 / 系统一律走 `ctx.damageTarget()` 发事件，不许直接碰 HP。
   *
   * @param target 受伤者
   * @param amount 伤害值
   * @returns 实际扣减量（HP 不会低于 0）
   */
  applyDamage(target: IPlayer, amount: number): number {
    if (amount <= 0) return 0
    return this.playerSystem.loseHp(target, amount)
  }
}
