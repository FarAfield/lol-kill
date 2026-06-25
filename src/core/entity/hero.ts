// ============================================================
// 联盟杀 · Hero 实体
//
// 不区分「定义」与「实体」——英雄只有一个统一的 Hero 类。
// source/ 导入的英雄数据直接创建 Hero 实例。
// ============================================================

import { Kingdom } from '@core/contracts/enums'
import type { HeroId } from '@core/contracts/types'
import type { IHero } from '@core/contracts/hero.interface'

// ── 英雄实体 ──

export class Hero implements IHero {
  readonly id: HeroId
  readonly name: string
  readonly title: string
  readonly kingdom: Kingdom
  readonly maxHp: number
  readonly maxPower: number
  readonly effectIds: string[]

  constructor(data: {
    id: HeroId
    name: string
    title: string
    kingdom: Kingdom
    maxHp: number
    maxPower?: number
    effectIds?: string[]
  }) {
    this.id = data.id
    this.name = data.name
    this.title = data.title
    this.kingdom = data.kingdom
    this.maxHp = data.maxHp
    this.maxPower = data.maxPower ?? 0
    this.effectIds = data.effectIds ?? []
  }

  // ── 工厂方法 ──

  /**
   * 从简单数据对象创建 Hero 实例。
   *
   * @param data 英雄数据（来自 source/）
   */
  static create(data: {
    id: HeroId
    name: string
    title: string
    kingdom: Kingdom
    maxHp: number
    maxPower?: number
    effectIds?: string[]
  }): Hero {
    return new Hero(data)
  }

  // ── 查询 ──

  /**
   * 英雄是否有指定效果。
   */
  hasEffect(effectId: string): boolean {
    return this.effectIds.includes(effectId)
  }

  /**
   * 是否为指定势力。
   */
  isKingdom(kingdom: Kingdom): boolean {
    return this.kingdom === kingdom
  }

  // ── 序列化 ──

  /**
   * 将英雄序列化为纯对象。
   */
  toJSON(): IHero {
    return {
      id: this.id,
      name: this.name,
      title: this.title,
      kingdom: this.kingdom,
      maxHp: this.maxHp,
      maxPower: this.maxPower,
      effectIds: [...this.effectIds],
    }
  }
}
