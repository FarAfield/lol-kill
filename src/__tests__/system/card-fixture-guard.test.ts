// ============================================================
// 测试卡牌真值源护栏（欠账 D32）
//
// 测试造牌的口子是 `cardDef(id, tags)`，tag 原本由调用方手搓。
// 手搓的那串 tag 一旦与 `src/source/cards/*` 里的真定义差一个，
// 那张牌就**不是那张牌**：
//
//   - 南蛮入侵少 `Aoe`   → 从「群体锦囊」变成「要选目标的普通锦囊」；
//   - 桃少 `Basic`       → 进不了桃的目标规则，连自己都不是合法目标；
//   - 无中生有少 `Draw`  → 同上。
//
// 而它**不报错**——牌照造、照打，只是静默落进 `TargetSystem` 的
// 另一个分支。D31 把 `validateTargets` 接进生产的那天，一次性红了
// 22 条既有用例，全是这么撞上的（当时逐条对齐了一遍，可下次新增
// 用例还会再撞一次）。
//
// **修法不是「再把 tag 抄对一遍」**，而是让漂移在结构上不可能：
// `cardDef` 只要能在真牌表里查到这个 id，整张定义都取自真牌，
// 传进来的 tag 直接不用。下面这组用例钉住的就是这个契约。
// ============================================================

import { describe, expect, it } from 'vitest'

import { CardSuit } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import type { CardDefinition } from '@core/entity/card'
import { basicCards } from '@source/cards/basic'
import { trickCards } from '@source/cards/tricks'
import { equipCards } from '@source/cards/equips'
import { cardDef } from '../helpers/game-env'

/** 真值源：`source/cards/*` 里登记过的卡牌定义 */
const REAL_DEFS: readonly CardDefinition[] = [...basicCards, ...trickCards, ...equipCards]
const REAL_BY_ID: ReadonlyMap<string, CardDefinition> = new Map(
  REAL_DEFS.map((def) => [def.id, def]),
)

describe('测试卡牌真值源护栏（欠账 D32）', () => {
  it('真牌一律取自真定义 —— 手搓的 tag 一概不算数', () => {
    // 这是这条护栏的核心：故意喂一串**错的** tag 进去，
    // 出来的仍必须是真牌那一份。「写对了才通过」没有牙齿，
    // 「写错了也通过」才叫收口。
    const wrong = [CardTag.Heal, CardTag.Dying]
    for (const real of REAL_DEFS) {
      const made = cardDef(real.id, wrong as never)
      expect(
        [...made.tags].sort(),
        `${real.id} 应当整张取自真定义`,
      ).toEqual([...real.tags].sort())
      expect(made.name).toBe(real.name)
      expect(made.type).toBe(real.type)
      expect(made.effectIds).toEqual(real.effectIds)
    }
  })

  it('合成牌没有真身可对齐 —— 仍按手搓的 tag 造', () => {
    const made = cardDef('redFiller', [CardTag.Strike], { suit: CardSuit.Heart })

    expect(REAL_BY_ID.has('redFiller')).toBe(false)
    expect([...made.tags]).toEqual([CardTag.Strike])
    expect(made.suit).toBe(CardSuit.Heart)
  })

  it('覆盖项在真牌之上照旧生效 —— 换花色不必重写整张牌', () => {
    const made = cardDef('sha', [], { suit: CardSuit.Heart, name: '红杀' })

    expect(made.suit).toBe(CardSuit.Heart)
    expect(made.name).toBe('红杀')
    // 该从真定义来的那部分一个字都没丢
    expect([...made.tags]).toEqual([...REAL_BY_ID.get('sha')!.tags])
    expect(made.effectIds).toEqual(REAL_BY_ID.get('sha')!.effectIds)
  })

  it('护栏没写空：真牌表非空，且杀 / 闪 / 桃 / 酒都在里面', () => {
    // 「全都一致」也可能是「一张牌都没扫到」。这几句是它的牙齿。
    expect(REAL_DEFS.length).toBeGreaterThanOrEqual(20)
    for (const id of ['sha', 'shan', 'tao', 'jiu']) {
      expect(REAL_BY_ID.has(id), `真牌表里应当有 ${id}`).toBe(true)
    }
  })
})
