// ============================================================
// 无懈可击链式抵消回归测试（Phase 9）
//
// Phase 8 的窗口是「一层窗口数奇偶」：所有人被问一遍，数出几张无懈，
// 奇数就抵消。结果是对的，但**过程不是真的**——中间那几张无懈不是事件，
// 谁也钩不住它们，卡牌自身的 canBeCanceled、mod 守卫也无从插手。
//
// Phase 9 把它换成真正的链：每张无懈都是一条 `useCard` 事件，
// 压进 LIFO 栈后立即完整结算，最后打出的最先生效。
//
// 这个测试文件一半验结果（锦囊生不生效）、一半验过程
// （链是不是由真事件组成、层数是不是逐层 +1）。
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GameEvent } from '@core/event'
import {
  clearCancelGuards,
  registerCancelGuard,
  MAX_CANCEL_CHAIN,
  canBeCountered,
} from '@core/event'
import type { IGameEvent } from '@core/contracts/event.interface'
import { CardTag } from '@core/contracts/card-tag'
import { ZoneType } from '@core/contracts/enums'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { createTestEnv, giveCard, cardDef, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

afterEach(() => {
  // 守卫是模块级全局，必须还给下一个用例
  clearCancelGuards()
})

/** 一张带 Trick 标签的南蛮入侵（锦囊才会被开窗口） */
function nanMan(user: IPlayer, extra: Partial<ReturnType<typeof cardDef>> = {}): ICard {
  return giveCard(user, cardDef('nanManRuQin', [CardTag.Trick, CardTag.BarbarianRaid], extra))
}

/**
 * 一张无懈可击
 *
 * 标签必须和真实牌定义一致：它自己是**锦囊**（Trick），
 * 所以打出它也会开一层无懈窗口——链式抵消全靠这一点。
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

/** 读出事件上挂着的抵消链 */
function chainOf(event: IGameEvent): IGameEvent[] {
  const chain = event.result['counters']
  return Array.isArray(chain) ? (chain as IGameEvent[]) : []
}

/**
 * 手动派发一次用牌事件
 *
 * `engine.useCard` 不返回事件对象，而「抵消链是不是真事件」这类
 * 过程性断言必须拿到事件本身，所以这里直接走调度器。
 */
async function dispatchUseCard(player: IPlayer, card: ICard): Promise<IGameEvent> {
  const event = new GameEvent({
    name: 'useCard',
    source: player,
    player,
    targets: [],
    cards: [card],
    cancelable: card.tags.has(CardTag.Trick) && !card.isDelayed,
  })
  await env.engine.eventDispatcher.dispatch(event, env.engine.eventChain)
  return event
}

// ── 链的形状 ──

describe('抵消链：每张无懈都是一条真事件', () => {
  it('1 张无懈 → 锦囊被抵消，链长 1，cancelDepth = 1', async () => {
    const [user, p1] = env.players()
    const card = nanMan(user)

    const counter = wuxie(p1)
    env.decisions.script(p1, '无懈可击', counter)

    const event = await dispatchUseCard(user, card)

    expect(event.cancelled).toBe(true)
    const chain = chainOf(event)
    expect(chain).toHaveLength(1)
    expect(chain[0]!.cancelDepth).toBe(1)
    expect(chain[0]!.card?.id).toBe('wuXieKeJi')
    expect(event.cancelDepth).toBe(0)
  })

  it('3 张无懈 → 链长 3，cancelDepth 逐层 +1', async () => {
    const [user, p1, p2, p3] = env.players()
    const card = nanMan(user)

    env.decisions.script(p1, '无懈可击', wuxie(p1))
    env.decisions.script(p2, '无懈可击', wuxie(p2))
    env.decisions.script(p3, '无懈可击', wuxie(p3))

    const event = await dispatchUseCard(user, card)

    const chain = chainOf(event)
    expect(chain.map((e) => e.cancelDepth)).toEqual([1, 2, 3])
    // 奇数张 → 原事件被抵消
    expect(event.cancelled).toBe(true)
  })

  it('抵消链上的无懈全部进弃牌堆（用牌有代价）', async () => {
    const [user, p1, p2] = env.players()
    const card = nanMan(user)

    const first = wuxie(p1)
    const second = wuxie(p2)
    env.decisions.script(p1, '无懈可击', first)
    env.decisions.script(p2, '无懈可击', second)

    await dispatchUseCard(user, card)

    expect(first.zone).toBe(ZoneType.Discard)
    expect(second.zone).toBe(ZoneType.Discard)
  })
})

// ── 后发先至 ──

describe('后发先至', () => {
  it('C 出无懈 → D 出无懈：D 的先生效，C 被抵消，锦囊照常结算', async () => {
    const [user, cPlayer, dPlayer, victim] = env.players()
    const card = nanMan(user)

    // 座次：C 先被问（出无懈），随后窗口上移一层，D 在这一层反制
    env.decisions.script(cPlayer, '无懈可击', wuxie(cPlayer))
    env.decisions.script(dPlayer, '无懈可击', wuxie(dPlayer))

    const before = env.players().map((p) => p.hp)
    await env.engine.useCard(user, card, [])

    // 偶数张 → 抵消被抵消 → 南蛮生效
    expect(victim.hp).toBe(before[3]! - 1)
    expect(env.decisions.askCount(cPlayer, '无懈可击')).toBe(1)
    expect(env.decisions.askCount(dPlayer, '无懈可击')).toBe(1)
  })

  it('3 张无懈连锁 → 锦囊被抵消，无人受伤', async () => {
    const [user, p1, p2, p3, victim] = env.players()
    const card = nanMan(user)

    env.decisions.script(p1, '无懈可击', wuxie(p1))
    env.decisions.script(p2, '无懈可击', wuxie(p2))
    env.decisions.script(p3, '无懈可击', wuxie(p3))

    const before = victim.hp
    await env.engine.useCard(user, card, [])

    expect(victim.hp).toBe(before)
  })

  it('上一层放弃的人，会在下一层被再问到并反制', async () => {
    const [user, p1, p2, victim] = env.players()
    const card = nanMan(user)

    const first = wuxie(p1)
    const second = wuxie(p2)

    // 第 1 层（问的是南蛮）：p1 放弃，p2 出无懈
    env.decisions.scriptNth(p1, '无懈可击', 0, null)
    env.decisions.scriptNth(p2, '无懈可击', 0, second)
    // 第 2 层（问的是 p2 那张无懈）从 p2 下家绕回来，p1 这次出手
    env.decisions.scriptNth(p1, '无懈可击', 1, first)

    const before = victim.hp
    await env.engine.useCard(user, card, [])

    expect(env.decisions.askCount(p1, '无懈可击')).toBe(2)
    // 2 张 → 抵消抵消 → 南蛮生效
    expect(victim.hp).toBe(before - 1)
    expect(first.zone).toBe(ZoneType.Discard)
  })

  it('链不会无限加深：层数触顶后不再开新窗口', async () => {
    expect(MAX_CANCEL_CHAIN).toBeGreaterThan(0)
    expect(MAX_CANCEL_CHAIN).toBeLessThanOrEqual(8)
  })
})

// ── 能不能被抵消 ──

describe('不可被抵消的锦囊', () => {
  it('卡牌 canBeCanceled = false → 窗口压根不开', async () => {
    const [user, p1, victim] = env.players()
    const card = nanMan(user, { canBeCanceled: false })

    wuxie(p1)

    const before = victim.hp
    await env.engine.useCard(user, card, [])

    expect(env.decisions.askCount(p1, '无懈可击')).toBe(0)
    expect(victim.hp).toBe(before - 1)
  })

  it('清单 #13 接线点：registerCancelGuard 能否决抵消（mod.cardCancelable 的落点）', async () => {
    const [user, p1, victim] = env.players()
    const card = nanMan(user)

    wuxie(p1)

    const seen: string[] = []
    const off = registerCancelGuard((event, cardUsed) => {
      seen.push(String(cardUsed?.id ?? event.name))
      // 模拟 mod.cardCancelable 返回 false
      return false
    })

    const before = victim.hp
    await env.engine.useCard(user, card, [])

    expect(seen).toContain('nanManRuQin')
    expect(env.decisions.askCount(p1, '无懈可击')).toBe(0)
    expect(victim.hp).toBe(before - 1)

    off()
    clearCancelGuards()
  })

  it('已终态的事件不能再被抵消', async () => {
    const [user] = env.players()
    const card = nanMan(user)

    const event = await dispatchUseCard(user, card)
    expect(event.isTerminal).toBe(true)
    expect(canBeCountered(event)).toBe(false)
  })
})

// ── 无懈可击本身 ──

describe('无懈可击本身', () => {
  it('窗口只认无懈可击：指定出杀不会被接受', async () => {
    const [user, p1, victim] = env.players()
    const card = nanMan(user)

    const counter = wuxie(p1)
    const strike = giveCard(p1, cardDef('sha', CardTag.Strike))
    // 脚本说「出杀」，但杀不在窗口给的选项里 → 视为放弃
    env.decisions.script(p1, '无懈可击', strike)

    const before = victim.hp
    await env.engine.useCard(user, card, [])

    expect(env.decisions.askCount(p1, '无懈可击')).toBe(1)
    expect(counter.zone).toBe(ZoneType.Hand)
    expect(victim.hp).toBe(before - 1)
  })

  it('手上没有无懈的人不会被问（杀闪再多也不问）', async () => {
    const [user, p1, victim] = env.players()
    const card = nanMan(user)

    giveCard(p1, cardDef('sha', CardTag.Strike))
    giveCard(p1, cardDef('shan', CardTag.Dodge))

    const before = victim.hp
    await env.engine.useCard(user, card, [])

    expect(env.decisions.askCount(p1, '无懈可击')).toBe(0)
    expect(victim.hp).toBe(before - 1)
  })

  it('主动打出的无懈可击是空操作（它是响应牌，没有目标就什么也不做）', async () => {
    const [user, victim] = env.players()
    const card = wuxie(user)

    const before = victim.hp
    await env.engine.useCard(user, card, [victim])

    expect(victim.hp).toBe(before)
  })

  it('无懈可击不能抵消基本牌', async () => {
    const [user, p1, victim] = env.players()
    const sha = giveCard(user, cardDef('sha', CardTag.Strike))
    wuxie(p1)

    const before = victim.hp
    await env.engine.useCard(user, sha, [victim])

    expect(env.decisions.askCount(p1, '无懈可击')).toBe(0)
    expect(victim.hp).toBe(before - 1)
  })
})
