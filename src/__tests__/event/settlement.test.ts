// ============================================================
// 结算点回归测试（Phase 8）
//
// 「暂停 + 按座次轮询 + 插入」三要素。这个 Phase 之前：
// - 座次顺序靠每张牌各自写 `for (const p of seatOrderFrom(...))`，
//   规则和「已问过的人别再问」各写各的；
// - **濒死求桃根本没有实现**——hp 打到 0 就那么放着，角色既不死也不被救。
//
// 下面的测试一半是 SettlementRunner 的纯单元测试（可编程询问器），
// 一半是走真实引擎的端到端测试。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { SettlementRunner, seatOrderFrom, seatDistance } from '@core/event'
import type { ResponseOption } from '@core/event'
import { CardTag } from '@core/contracts/card-tag'
import { ZoneType } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { createTestEnv, giveCard, cardDef, type TestEnv } from '../helpers/game-env'

const OPTION: ResponseOption = { kind: 'card', label: '出一张牌' }

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

// ── SettlementRunner 单元 ──

describe('SettlementRunner', () => {
  it('座次轮询：从起点下家开始，绕一圈回来', async () => {
    const [, , p2] = env.players()
    const order: number[] = []

    const runner = new SettlementRunner(async (player) => {
      order.push(player.seatIndex)
      return null
    })

    await runner.run({
      id: 'seatOrder',
      responders: () => seatOrderFrom(env.players(), p2),
      optionsFor: () => [OPTION],
      prompt: () => '问',
      onRespond: () => {},
    })

    // 5 人局从 2 号位起：[3, 4, 0, 1]
    expect(order).toEqual([3, 4, 0, 1])
  })

  it('acted 去重：已响应的人不会被再问一次', async () => {
    const p3 = env.players()[3]!
    const asked: string[] = []

    const runner = new SettlementRunner(async (player) => {
      asked.push(player.id)
      return player.id === p3.id ? OPTION : null
    })

    const result = await runner.run({
      id: 'acted',
      responders: () => seatOrderFrom(env.players(), env.players()[2]!),
      optionsFor: () => [OPTION],
      prompt: () => '问',
      onRespond: () => {},
    })

    expect(result.responses).toHaveLength(1)
    expect(result.responses[0]!.player.id).toBe(p3.id)
    expect(asked.filter((id) => id === p3.id)).toHaveLength(1)
  })

  it('无人响应 → 只轮询一轮，所有人都算未响应', async () => {
    const runner = new SettlementRunner(async () => null)

    const result = await runner.run({
      id: 'nobody',
      responders: () => env.players(),
      optionsFor: () => [OPTION],
      prompt: () => '问',
      onRespond: () => {},
    })

    expect(result.responses).toHaveLength(0)
    expect(result.unanswered).toHaveLength(env.players().length)
    expect(result.rounds).toBe(1)
    expect(result.stoppedEarly).toBe(false)
  })

  it('拿不出牌的人也要走 onUnanswered（南蛮里就是挨伤害）', async () => {
    const p1 = env.players()[1]!
    const asked: string[] = []
    const punished: string[] = []

    const runner = new SettlementRunner(async (player) => {
      asked.push(player.id)
      return null
    })

    await runner.run({
      id: 'noOptionStillPunished',
      responders: () => env.players(),
      // p1 手上没有能打的牌
      optionsFor: (player) => (player.id === p1.id ? [] : [OPTION]),
      prompt: () => '问',
      onRespond: () => {},
      onUnanswered: (player) => {
        punished.push(player.id)
      },
    })

    // p1 没被问（问了也是白问），但一样承担了代价
    expect(asked).not.toContain(p1.id)
    expect(punished).toContain(p1.id)
  })

  it('stopOnFirstResponse：有人响应后立刻关闭窗口，后面的人不再被问', async () => {
    const [, , p2] = env.players()
    const asked: string[] = []

    const runner = new SettlementRunner(async (player) => {
      asked.push(player.id)
      return player.id === p2.id ? OPTION : null
    })

    const result = await runner.run({
      id: 'firstOnly',
      responders: () => env.players(),
      optionsFor: () => [OPTION],
      prompt: () => '问',
      onRespond: () => {},
      stopOnFirstResponse: true,
    })

    expect(asked).toEqual([env.players()[0]!.id, env.players()[1]!.id, p2.id])
    expect(result.stoppedEarly).toBe(true)
  })

  it('oncePerPlayer: false → 放弃的人会在别人出手后被再问一次', async () => {
    const [p1, p2] = env.players()
    const asked: string[] = []

    const runner = new SettlementRunner(async (player) => {
      asked.push(player.id)
      return player.id === p1.id ? OPTION : null
    })

    const result = await runner.run({
      id: 'reopen',
      responders: () => [p1, p2],
      optionsFor: () => [OPTION],
      prompt: () => '问',
      onRespond: () => {},
      // 连环窗口：别人出手后，此前放弃的人可以改主意
      oncePerPlayer: false,
    })

    // p1 响应过一次就结束；p2 第一轮放弃，第二轮被再问
    expect(asked.filter((id) => id === p1.id)).toHaveLength(1)
    expect(asked.filter((id) => id === p2.id)).toHaveLength(2)
    expect(result.rounds).toBe(2)
  })

  it('轮询必然收敛：轮数不超过「参与人数 + 1」', async () => {
    const runner = new SettlementRunner(async () => OPTION)

    const result = await runner.run({
      id: 'converge',
      responders: () => env.players(),
      optionsFor: () => [OPTION],
      prompt: () => '问',
      onRespond: () => {},
      oncePerPlayer: false,
    })

    // 第一轮全员响应 → 第二轮全员已 acted → 收敛
    expect(result.rounds).toBeLessThanOrEqual(env.players().length + 1)
  })
})

// ── 座次工具 ──

describe('座次工具', () => {
  it('seatOrderFrom 含自己 / 不含自己', () => {
    const p0 = env.players()[0]!
    const withSelf = seatOrderFrom(env.players(), p0, true).map((p) => p.seatIndex)
    const withoutSelf = seatOrderFrom(env.players(), p0).map((p) => p.seatIndex)
    expect(withSelf).toEqual([0, 1, 2, 3, 4])
    expect(withoutSelf).toEqual([1, 2, 3, 4])
  })

  it('seatDistance 顺时针环绕', () => {
    expect(seatDistance(0, 3, 5)).toBe(3)
    expect(seatDistance(4, 1, 5)).toBe(2) // 4 → 0 → 1
    expect(seatDistance(2, 2, 5)).toBe(0)
  })
})

// ── 濒死求桃 ──

describe('濒死求桃', () => {
  /** 让 attacker 用一张杀把 victim 打到濒死 */
  function strikeFatal(attacker: IPlayer, victim: IPlayer): ICard {
    victim.hp = 1
    return giveCard(attacker, cardDef('sha', CardTag.Strike))
  }

  it('有人出桃 → 救活，体力回到 1', async () => {
    const [attacker, victim, , saver] = env.players()
    const sha = strikeFatal(attacker, victim)

    const peach = giveCard(saver, cardDef('tao', CardTag.Heal))
    env.decisions.script(saver, '濒死', peach)

    await env.engine.useCard(attacker, sha, [victim])

    expect(victim.hp).toBe(1)
    expect(victim.alive).toBe(true)
    expect(peach.zone).toBe(ZoneType.Discard)
  })

  it('求桃从濒死者自己开始，按座次往下问', async () => {
    const [attacker, victim, p2] = env.players()
    const sha = strikeFatal(attacker, victim)

    // 濒死者自己手上也有桃，但选择不出——这样他一定会被问到，
    // 从而能验证「从他自己开始」
    giveCard(victim, cardDef('tao', CardTag.Heal))

    const peach = giveCard(p2, cardDef('tao', CardTag.Heal))
    env.decisions.script(p2, '濒死', peach)

    await env.engine.useCard(attacker, sha, [victim])

    const peachAsks = env.decisions.asked.filter((a) => a.includes('濒死'))
    expect(peachAsks.length).toBeGreaterThanOrEqual(2) // victim → p2 出桃即停
    expect(peachAsks[0]!.startsWith(`${victim.id}:`)).toBe(true)
    expect(peachAsks[1]!.startsWith(`${p2.id}:`)).toBe(true)
  })

  it('一个桃就够 —— 后面的人不再被问', async () => {
    const [attacker, victim, saver, p3] = env.players()
    const sha = strikeFatal(attacker, victim)

    const peach = giveCard(saver, cardDef('tao', CardTag.Heal))
    env.decisions.script(saver, '濒死', peach)

    await env.engine.useCard(attacker, sha, [victim])

    expect(victim.hp).toBe(1)
    expect(env.decisions.askCount(p3, '濒死')).toBe(0)
  })

  it('无人出桃 → 死亡结算：身份公开、手牌进弃牌堆', async () => {
    const [attacker, victim] = env.players()
    const sha = strikeFatal(attacker, victim)
    const owned = giveCard(victim, cardDef('sha', CardTag.Strike))

    await env.engine.useCard(attacker, sha, [victim])

    expect(victim.alive).toBe(false)
    expect(victim.roleRevealed).toBe(true)
    expect(owned.zone).toBe(ZoneType.Discard)
    expect(victim.handCards).toHaveLength(0)
  })
})

// ── 无懈可击窗口 ──

describe('无懈可击窗口', () => {
  /** 一张带 Trick 标签的南蛮入侵（锦囊才会被开窗口） */
  function nanMan(user: IPlayer): ICard {
    return giveCard(user, cardDef('nanManRuQin', [CardTag.Trick, CardTag.BarbarianRaid]))
  }

  /**
   * 一张无懈可击
   *
   * 它自己也是**锦囊**（Trick 标签与真实牌定义一致），所以打出它同样
   * 会开一层新窗口 —— Phase 9 的链式抵消就建立在这上面。
   */
  function wuxie(player: IPlayer): ICard {
    return giveCard(
      player,
      cardDef('wuXieKeJi', [
        CardTag.Counter,
        CardTag.Trick,
        CardTag.Cancel,
        CardTag.Response,
      ]),
    )
  }

  it('1 张无懈 → 锦囊被抵消，无人受伤', async () => {
    const [user, p1, p2, p3] = env.players()
    const card = nanMan(user)

    const counter = wuxie(p1)
    env.decisions.script(p1, '无懈可击', counter)

    const before = env.players().map((p) => p.hp)
    await env.engine.useCard(user, card, [])

    expect(p2.hp).toBe(before[2])
    expect(p3.hp).toBe(before[3])
    expect(counter.zone).toBe(ZoneType.Discard)
  })

  it('2 张无懈 → 抵消抵消，锦囊照常生效', async () => {
    const [user, p1, p2, p3] = env.players()
    const card = nanMan(user)

    const first = wuxie(p1)
    const second = wuxie(p3)
    env.decisions.script(p1, '无懈可击', first)
    env.decisions.script(p3, '无懈可击', second)

    const before = env.players().map((p) => p.hp)
    await env.engine.useCard(user, card, [])

    expect(p2.hp).toBe(before[2]! - 1)
  })

  it('开窗后有人出手 → 问询上移一层，在新的一层里重新按座次问', async () => {
    const [user, p1, p2] = env.players()
    const card = nanMan(user)

    // p1 会出无懈；p2 手上也有，但一直选择不出
    const counter = wuxie(p1)
    wuxie(p2)
    env.decisions.script(p1, '无懈可击', counter)

    await env.engine.useCard(user, card, [])

    // Phase 9 起，p1 出手后本层就关闭了；问询改为「是否抵消 p1 这张无懈」，
    // 从 p1 的下家重新绕一圈——p2 在这一层被问到（不是在同一层被重复问）。
    expect(env.decisions.askCount(p1, '无懈可击')).toBe(1)
    expect(env.decisions.askCount(p2, '无懈可击')).toBe(1)
  })

  it('基本牌不开窗口（无懈可击只针对锦囊）', async () => {
    const [user, p1, victim] = env.players()
    const sha = giveCard(user, cardDef('sha', CardTag.Strike))
    wuxie(p1)

    const before = victim.hp
    await env.engine.useCard(user, sha, [victim])

    expect(env.decisions.askCount(p1, '无懈可击')).toBe(0)
    expect(victim.hp).toBe(before - 1)
  })
})

// ── 决斗：单人结算点的序列 ──

describe('决斗', () => {
  it('目标出杀后反过来问使用者，使用者不出则使用者扣血', async () => {
    const [user, victim] = env.players()
    const duel = giveCard(user, cardDef('jueDou', [CardTag.Trick, CardTag.Duel]))

    const strike = giveCard(victim, cardDef('sha', CardTag.Strike))
    env.decisions.script(victim, '决斗', strike)

    const beforeUser = user.hp
    const beforeVictim = victim.hp

    await env.engine.useCard(user, duel, [victim])

    expect(user.hp).toBe(beforeUser - 1)
    expect(victim.hp).toBe(beforeVictim)
    expect(strike.zone).toBe(ZoneType.Discard)
  })
})
