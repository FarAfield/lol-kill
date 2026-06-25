// ============================================================
// 联盟杀 · DamageSystem — 伤害流水线
//
// 三国杀中伤害有独立的结算流程，与主事件链协同工作：
//
// 伤害来源确定 → 伤害值计算 → 属性判定(火/雷/普通/冰/毒)
//        │
//        ▼
//   BEFORE_DAMAGE ────────→ 技能拦截/转移 ("刚烈""天香")
//        │
//        ▼
//   DAMAGE_PREVENT ───────→ 伤害预防 (出闪/"倾国""八阵")
//        │
//        ▼
//   DAMAGE_MODIFY ────────→ 伤害值调整 ("古锭刀""藤甲"+1)
//        │
//        ▼
//   DAMAGE_APPLY ─────────→ 体力扣减
//        │
//        ▼
//   AFTER_DAMAGED ────────→ 受伤后触发 ("反馈""刚烈""遗计")
//        │
//        ▼
//   DAMAGE_COMPLETE
// ============================================================

import { DamageType } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'

/**
 * 伤害实例
 *
 * 描述一次伤害事件的完整数据。
 */
export interface DamageInstance {
  /** 伤害来源玩家（可为 undefined） */
  source?: IPlayer
  /** 伤害目标玩家 */
  target: IPlayer
  /** 基础伤害值 */
  baseAmount: number
  /** 当前伤害值（经过修改后） */
  currentAmount: number
  /** 伤害属性 */
  type: DamageType
  /** 造成伤害的卡牌 */
  card?: ICard
  /** 伤害是否被阻止 */
  prevented: boolean
  /** 伤害是否被转移 */
  transferred: boolean
  /** 转移目标（如果被转移） */
  transferredTo?: IPlayer
  /** 自定义扩展数据 */
  data: Record<string, unknown>
}

/**
 * 伤害流水线阶段
 */
export enum DamageStage {
  /** 伤害前（刚烈/天香等技能触发点） */
  Before = 'before',
  /** 伤害预防（出闪/倾国/八阵等） */
  Prevent = 'prevent',
  /** 伤害修改（古锭刀+1/藤甲+1等） */
  Modify = 'modify',
  /** 伤害应用（体力扣减） */
  Apply = 'apply',
  /** 受伤后（反馈/刚烈/遗计等触发点） */
  After = 'after',
  /** 伤害结算完成 */
  Complete = 'complete',
}

/**
 * 伤害流水线钩子
 *
 * 每个阶段的钩子可修改 DamageInstance。
 */
export type DamageHook = (damage: DamageInstance) => void | Promise<void>

/**
 * 伤害系统
 *
 * 管理完整的伤害流水线。
 * 技能系统通过注册钩子来参与各阶段的伤害结算。
 */
export class DamageSystem {
  /** 按阶段分组的钩子注册表 */
  private hooks: Map<DamageStage, DamageHook[]> = new Map()

  constructor() {
    // 初始化所有阶段的钩子数组
    for (const stage of Object.values(DamageStage)) {
      this.hooks.set(stage, [])
    }
  }

  /**
   * 注册伤害流水线钩子。
   *
   * @param stage  流水线阶段
   * @param hook   钩子函数
   */
  registerHook(stage: DamageStage, hook: DamageHook): void {
    this.hooks.get(stage)?.push(hook)
  }

  /**
   * 注销指定阶段的全部钩子。
   */
  clearHooks(stage?: DamageStage): void {
    if (stage) {
      this.hooks.set(stage, [])
    } else {
      for (const s of Object.values(DamageStage)) {
        this.hooks.set(s, [])
      }
    }
  }

  /**
   * 创建伤害实例。
   *
   * @param source      伤害来源
   * @param target      伤害目标
   * @param baseAmount  基础伤害值
   * @param type        伤害属性
   * @param card        造成伤害的卡牌（可选）
   * @param data        扩展数据（可选）
   */
  createDamage(
    source: IPlayer | undefined,
    target: IPlayer,
    baseAmount: number,
    type: DamageType = DamageType.Normal,
    card?: ICard,
    data?: Record<string, unknown>,
  ): DamageInstance {
    return {
      source,
      target,
      baseAmount,
      currentAmount: baseAmount,
      type,
      card,
      prevented: false,
      transferred: false,
      data: data ?? {},
    }
  }

  /**
   * 执行完整的伤害流水线。
   *
   * 顺序推进六个阶段：Before → Prevent → Modify → Apply → After → Complete
   *
   * @param damage 伤害实例
   * @returns 处理后的伤害实例（含最终结果）
   */
  async executePipeline(damage: DamageInstance): Promise<DamageInstance> {
    // ── Stage 1: Before (伤害前钩子) ──
    await this.runStage(DamageStage.Before, damage)
    if (damage.prevented) {
      return damage // 已被钩子阻止
    }

    // ── Stage 2: Prevent (伤害预防) ──
    await this.runStage(DamageStage.Prevent, damage)
    if (damage.prevented) {
      return damage // 已被闪/技能阻止
    }

    // ── Stage 3: Modify (伤害修改) ──
    await this.runStage(DamageStage.Modify, damage)

    // 伤害值不能为负数
    if (damage.currentAmount < 0) {
      damage.currentAmount = 0
    }

    // ── Stage 4: Apply (伤害应用) ──
    if (!damage.prevented && damage.currentAmount > 0) {
      // 若伤害被转移，伤害值作用于转移目标
      const actualTarget = damage.transferred ? damage.transferredTo! : damage.target

      // 清除转移标记内的伤害防止
      if (damage.transferred) {
        damage.prevented = false
      }

      await this.applyDamage(damage, actualTarget)
    }

    // ── Stage 5: After (受伤后) ──
    await this.runStage(DamageStage.After, damage)

    // ── Stage 6: Complete (完成) ──
    await this.runStage(DamageStage.Complete, damage)

    return damage
  }

  /**
   * 执行指定的流水线阶段。
   */
  private async runStage(stage: DamageStage, damage: DamageInstance): Promise<void> {
    const stageHooks = this.hooks.get(stage) ?? []
    for (const hook of stageHooks) {
      await hook(damage)
      // 如果在 Before/Prevent 阶段 damage 被阻止，停止执行后续钩子
      if (
        damage.prevented &&
        (stage === DamageStage.Before || stage === DamageStage.Prevent)
      ) {
        break
      }
    }
  }

  /**
   * 应用伤害——扣减目标体力。
   *
   * 此方法直接修改目标 HP。在完整流水线中，
   * 调用方应在 Apply 阶段后检查目标是否进入濒死状态。
   *
   * @param damage 伤害实例
   * @param target 实际承受伤害的目标
   */
  private async applyDamage(
    damage: DamageInstance,
    target: IPlayer,
  ): Promise<void> {
    target.hp = Math.max(0, target.hp - damage.currentAmount)
    damage.prevented = false // 标记伤害已应用
  }

  /**
   * 阻止伤害。
   *
   * 在 Prevent 阶段调用此方法可阻止伤害（例如出闪成功后可调用）。
   *
   * @param damage 伤害实例
   */
  preventDamage(damage: DamageInstance): void {
    damage.prevented = true
    damage.currentAmount = 0
  }

  /**
   * 转移伤害。
   *
   * 在 Before/Prevent 阶段调用此方法可将伤害转移给另一目标。
   *
   * @param damage   伤害实例
   * @param newTarget 新的伤害目标
   */
  transferDamage(damage: DamageInstance, newTarget: IPlayer): void {
    damage.transferred = true
    damage.transferredTo = newTarget
  }

  /**
   * 修改伤害值。
   *
   * @param damage 伤害实例
   * @param delta  变化量（正数为增加，负数为减少）
   */
  modifyDamage(damage: DamageInstance, delta: number): void {
    damage.currentAmount = Math.max(0, damage.currentAmount + delta)
  }

  /**
   * 根据卡牌标签推断伤害属性。
   *
   * @param card 卡牌
   * @returns 伤害属性
   */
  static getDamageTypeFromCard(card: ICard): DamageType {
    if (card.tags.has('fire')) return DamageType.Fire
    if (card.tags.has('thunder')) return DamageType.Thunder
    if (card.tags.has('ice')) return DamageType.Ice
    if (card.tags.has('poison')) return DamageType.Poison
    return DamageType.Normal
  }
}
