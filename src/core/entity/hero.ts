import type { HeroId } from '@core/contracts/types'
import { Kingdom } from '@core/contracts/enums'
import type { IHero, HeroSkin } from '@core/contracts/hero.interface'

/**
 * 英雄实体
 *
 * 英雄是纯只读数据：一旦创建不再变更。
 * 构造参数即 `IHero`，`maxPower` / `skins` 可省略。
 */
export class Hero implements IHero {
  readonly id: HeroId
  readonly name: string
  readonly title: string
  readonly kingdom: Kingdom
  readonly maxHp: number
  readonly maxPower: number
  readonly effectIds: string[]
  readonly skins: HeroSkin[]

  constructor(data: IHero) {
    this.id = data.id
    this.name = data.name
    this.title = data.title
    this.kingdom = data.kingdom
    this.maxHp = data.maxHp
    this.maxPower = data.maxPower ?? 0
    this.effectIds = [...data.effectIds]
    this.skins = [...(data.skins ?? [])]
  }

  static create(data: IHero): Hero {
    return new Hero(data)
  }

  /** 是否拥有指定效果 */
  hasEffect(effectId: string): boolean {
    return this.effectIds.includes(effectId)
  }

  /** 是否为指定势力 */
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
