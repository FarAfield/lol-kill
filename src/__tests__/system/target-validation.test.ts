// ============================================================
// D31 —— `TargetSystem.validateTargets` 接进生产
//
// 这条函数此前**零调用方**：它写得很完整（最少 / 最多目标数、
// 逐个比对可选列表、带 reason），但没人叫它，于是 Phase 21 的验收项
// 「出牌时非法目标被拒绝并给出原因」一直是个空头承诺。
//
// 「代码里有」和「跑得到」是两件事——本仓已为此登记过 6 条接线缺失
// （D3 / D4 / D11 / D12 / D15 / D16），这是第 7 条。
//
// 本文件只验**接线**与**拒绝的后果**，不重复 `target-system.test.ts`
// 已经钉住的那套规则细节。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { TargetSystem, TargetValidationError } from '@core/system'
import { Card } from '@core/entity/card'
import { ZoneType } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import { AutoDecisionService } from '@core/replay/auto-decision'
import { basicCards } from '@source/cards/basic'
import { trickCards } from '@source/cards/tricks'
import { equipCards } from '@source/cards/equips'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { cardDef, createTestEnv, giveCard, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

/** 与真实【杀】同 tags 的一张杀 */
function sha(user: IPlayer): ICard {
  return giveCard(user, cardDef('sha', [CardTag.Strike, CardTag.Attack, CardTag.Basic]))
}

describe('D31 · 非法目标会被拒绝，并且说出为什么', () => {
  it('超出攻击范围的目标 → 抛出带原因的错误', async () => {
    const source = env.players()[0]!
    const far = env.players()[2]!
    const card = sha(source)

    await expect(env.engine.useCard(source, card, [far])).rejects.toThrow(
      TargetValidationError,
    )

    // 拒绝必须发生在**移牌之前**：牌还在手牌，事件一次都没发
    expect(card.zone).toBe(ZoneType.Hand)
    expect(source.handCards).toContain(card)
    expect(far.hp).toBe(far.maxHp)
  })

  it('拒绝的原因能被读出来（UI 要拿它告诉玩家）', () => {
    const source = env.players()[0]!
    const far = env.players()[2]!

    const result = env.engine.validatePlay(source, sha(source), [far])

    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
    expect(result.reason).toContain('不是合法目标')
  })

  it('合法目标照常放行', async () => {
    const source = env.players()[0]!
    const near = env.players()[1]!

    expect(env.engine.validatePlay(source, sha(source), [near]).valid).toBe(true)
    await expect(env.engine.useCard(source, sha(source), [near])).resolves.toBeUndefined()
  })

  it('目标给多了 → 拒绝（最多只能选 N 个）', () => {
    const source = env.players()[0]!
    const [a, b] = env.players().slice(1)

    const result = env.engine.validatePlay(source, sha(source), [a!, b!])

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('最多只能选择 1 个目标')
  })

  it('目标给少了 → 拒绝（借刀杀人要 2 个）', () => {
    const source = env.players()[0]!
    const other = env.players()[1]!
    const borrowed = giveCard(source, cardDef('jieDaoShaRen', [CardTag.BorrowedBlade]))

    const result = env.engine.validatePlay(source, borrowed, [other])

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('至少需要选择 2 个目标')
  })
})

describe('D31 · 只对自己生效的牌不要求显式目标', () => {
  /**
   * 这是接线时撞出来的一个真洞：`getMinTargets` 把装备 / 酒 / 无中生有
   * 也算成「至少 1 个目标」，而各处的调用方一律传 `[]`——
   * 目标就是自己，写出来是冗余。照搬原判据会把每一次正常出牌都拒掉。
   */
  it('装备牌不传目标也能打出', async () => {
    const player = env.players()[0]!
    const weapon = giveCard(
      player,
      cardDef('zhuGeLianNu', [CardTag.Equip], { equipSlot: 'weapon' as never }),
    )

    expect(env.engine.validatePlay(player, weapon, []).valid).toBe(true)
    await expect(env.engine.useCard(player, weapon, [])).resolves.toBeUndefined()
  })

  it('酒不传目标也能打出', async () => {
    const player = env.players()[0]!
    const wine = giveCard(player, cardDef('jiu', [CardTag.Wine, CardTag.Boost]))

    expect(env.engine.validatePlay(player, wine, []).valid).toBe(true)
  })

  it('自标牌允许不传，但**不许**塞进别人', () => {
    const player = env.players()[0]!
    const other = env.players()[1]!
    const wine = giveCard(player, cardDef('jiu', [CardTag.Wine, CardTag.Boost]))

    expect(env.engine.validatePlay(player, wine, [other]).valid).toBe(false)
  })
})

describe('D31 · 目标数的两处口径必须一致', () => {
  /**
   * 【五谷丰登】曾经是「至少 1 个、至多 0 个」——一张无论如何都打不出去
   * 的牌。`getMinTargets` 与 `getMaxTargets` 各写各的表，
   * 这种自相矛盾在没人校验目标时看不出来（反正校验不跑）。
   */
  it('每一张真实卡牌：下限不超过上限', () => {
    const all = [...basicCards, ...trickCards, ...equipCards]
    const contradictions = all
      .map((def) => {
        const card = { ...def, tags: new Set(def.tags) } as unknown as ICard
        return {
          name: def.name,
          min: TargetSystem.getMinTargets(card),
          max: TargetSystem.getMaxTargets(card, env.players()[0]!),
        }
      })
      .filter((row) => row.min > row.max)

    expect(contradictions).toEqual([])
  })

  it('pickTargets：AOE 取 0 个，借刀杀人取 2 个，普通杀取 1 个', () => {
    const players = env.players()
    const source = players[0]!
    const pick = (card: ICard) =>
      TargetSystem.pickTargets({
        validTargets: players.slice(1),
        minTargets: TargetSystem.getMinTargets(card),
        maxTargets: TargetSystem.getMaxTargets(card, source),
      })

    const aoe = Card.create(cardDef('nanMan', [CardTag.BarbarianRaid, CardTag.Aoe]))
    const borrowed = Card.create(cardDef('jieDao', [CardTag.BorrowedBlade]))

    expect(pick(sha(source))).toHaveLength(1)
    expect(pick(aoe)).toHaveLength(0)
    expect(pick(borrowed)).toHaveLength(2)
  })

  it('自动决策服务不再给 AOE 塞一个目标', () => {
    const auto = new AutoDecisionService()
    const players = env.players()
    const source = players[0]!
    const aoe = Card.create(cardDef('nanMan', [CardTag.BarbarianRaid, CardTag.Aoe]))

    const result = auto.askForCardPlay(source, [
      {
        card: aoe,
        validTargets: players.slice(1),
        minTargets: TargetSystem.getMinTargets(aoe),
        maxTargets: TargetSystem.getMaxTargets(aoe, source),
      },
    ])

    // 同步返回的 Promise：这里直接断言它被满足后的形状
    return expect(result).resolves.toMatchObject({ targets: [] })
  })
})
