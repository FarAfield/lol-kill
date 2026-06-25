// ============================================================
// 联盟杀 · EffectRegistry — 全局效果注册表
//
// 管理所有 IEffect 实例的注册与查找。
// 卡牌和英雄通过 effectIds 引用此注册表中的效果。
//
// 使用方式：
//   1. 在游戏启动时，将所有效果定义注册到 EffectRegistry
//   2. 当卡牌被使用或英雄技能触发时，通过 ID 查找对应效果
//   3. EventTrigger 从 EffectRegistry 获取效果并注册钩子
// ============================================================

import type { IEffect } from '@core/contracts/effect.interface'

/**
 * EffectRegistry — 全局效果注册表
 *
 * 以 effect.id 为键存储所有 IEffect 实例。
 * 提供注册、查询、批量加载等操作。
 */
export class EffectRegistry {
  /** 效果映射表 */
  private effects: Map<string, IEffect> = new Map()

  /**
   * 注册单个效果。
   *
   * @param effect 效果实例
   * @throws 如果相同 ID 的效果已存在
   */
  register(effect: IEffect): void {
    if (this.effects.has(effect.id)) {
      throw new Error(
        `EffectRegistry: 效果 "${effect.id}" 已存在，不能重复注册`,
      )
    }
    this.effects.set(effect.id, effect)
  }

  /**
   * 批量注册效果。
   *
   * @param effects 效果数组
   */
  registerAll(effects: IEffect[]): void {
    for (const effect of effects) {
      this.register(effect)
    }
  }

  /**
   * 获取指定 ID 的效果。
   *
   * @param id 效果 ID
   * @returns 效果实例，不存在时返回 undefined
   */
  get(id: string): IEffect | undefined {
    return this.effects.get(id)
  }

  /**
   * 批量获取效果。
   *
   * @param ids 效果 ID 数组
   * @returns 存在且对应的效果数组（不存在的 ID 会被跳过）
   */
  getAll(ids: string[]): IEffect[] {
    return ids.map((id) => this.effects.get(id)).filter(
      (e): e is IEffect => e !== undefined,
    )
  }

  /**
   * 检查效果是否已注册。
   */
  has(id: string): boolean {
    return this.effects.has(id)
  }

  /**
   * 注销效果。
   *
   * @param id 效果 ID
   * @returns 是否成功注销
   */
  unregister(id: string): boolean {
    return this.effects.delete(id)
  }

  /**
   * 清空全部注册。
   */
  clear(): void {
    this.effects.clear()
  }

  /**
   * 获取所有已注册效果的数组。
   */
  getAllEffects(): IEffect[] {
    return [...this.effects.values()]
  }

  /**
   * 获取所有效果 ID。
   */
  getAllIds(): string[] {
    return [...this.effects.keys()]
  }

  /**
   * 已注册效果的数量。
   */
  get size(): number {
    return this.effects.size
  }
}
