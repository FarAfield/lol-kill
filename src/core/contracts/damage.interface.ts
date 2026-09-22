// ============================================================
// 联盟杀 · 伤害数据接口
//
// 定义伤害实例和伤害流水线阶段的数据结构。
// DamageInstance 是伤害系统与事件系统之间的共享数据契约，
// 从 core/system/damage-system.ts 提取至此以消除 event.data['_damageInstance'] 暗线。
// ============================================================

import type { DamageType } from './enums'
import type { IPlayer } from './player.interface'
import type { ICard } from './card.interface'

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
