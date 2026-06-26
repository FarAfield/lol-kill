import { Kingdom } from '@core/contracts/enums'
import type { IHero } from '@core/contracts/hero.interface'

export class Hero implements IHero {
  readonly id: string
  readonly name: string
  readonly title: string
  readonly kingdom: Kingdom
  readonly maxHp: number
  readonly maxPower: number
  readonly effectIds: string[]
  readonly skins: Array<{ skinName: string; skinImage: string }>

  constructor(data: {
    id: string
    name: string
    title: string
    kingdom: Kingdom
    maxHp: number
    maxPower: number
    effectIds: string[]
    skins: Array<{ skinName: string; skinImage: string }>
  }) {
    this.id = data.id
    this.name = data.name
    this.title = data.title
    this.kingdom = data.kingdom
    this.maxHp = data.maxHp
    this.maxPower = data.maxPower
    this.effectIds = data.effectIds
    this.skins = data.skins ?? []
  }
  static create(data: {
    id: string
    name: string
    title: string
    kingdom: Kingdom
    maxHp: number
    maxPower: number
    effectIds: string[]
    skins: Array<{ skinName: string; skinImage: string }>
  }): Hero {
    return new Hero(data)
  }

  hasEffect(effectId: string): boolean {
    return this.effectIds.includes(effectId)
  }

  /**
   * 是否为指定势力。
   */
  isKingdom(kingdom: Kingdom): boolean {
    return this.kingdom === kingdom
  }
  toJSON(): IHero {
    return {
      id: this.id,
      name: this.name,
      title: this.title,
      kingdom: this.kingdom,
      maxHp: this.maxHp,
      maxPower: this.maxPower,
      effectIds: [...this.effectIds],
      skins: [...this.skins],
    }
  }
}
