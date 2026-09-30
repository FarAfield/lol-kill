// ============================================================
// D15 / D16 —— 判定与延时锦囊的接线
//
// 断链的位置在 2026-09-30 被定位得很具体：
//
//   1. 延时锦囊打出时，`useCardContent` 放进判定区后**直接 return**
//      （这是对的，延时牌要等到目标的判定阶段）
//   2. 到了判定阶段，`doPhaseJudge` 翻一张牌、发一条叫 **`judge`** 的事件
//   3. 而内容注册表里**没有 `judge` 这个键** —— 三份内容注册在
//      `leBuSiShu` / `bingLiangCunDuan` / `shanDian` 名下，没有任何人以这三个名字发过事件
//   4. 于是延时锦囊表现为「进判定区，下一轮静默消失」
//
// 这里的用例全部**走真实回合**（`executeTurn`），而不是直接 dispatch 某个内容名——
// 后者能证明内容写对了，证明不了「判定阶段真的会调到它」。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { GamePhase, CardSuit, CardRank } from '@core/contracts/enums'
import { EventCompiler } from '@core/event/event-compiler'
import type { CardDefinition, ICard } from '@core/contracts/card.interface'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { ISkill } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { Card } from '@core/entity/card'
import { cardDef, createTestEnv, giveCard, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

// ── 工具 ──

/** 一张放在判定区的延时锦囊（走真实的使用流程） */
async function putDelayed(
  user: IPlayer,
  victim: IPlayer,
  id: 'leBuSiShu' | 'bingLiangCunDuan' | 'shanDian',
): Promise<ICard> {
  const card = giveCard(
    user,
    cardDef(id, [], { isDelayed: true }) as CardDefinition,
  )
  await env.engine.useCard(user, card, [victim])
  return card
}

/**
 * 把下一张判定牌换成指定的花色 / 点数
 *
 * `DeckManager.drawForJudge()` 从牌堆**末尾** `pop()`，所以塞到队尾即可。
 */
function stackJudgeResult(suit: CardSuit, rank: CardRank): ICard {
  const card = Card.create(
    cardDef('judgeProbe', [], { suit, rank }) as CardDefinition,
  )
  env.engine.state.deck.push(card)
  return card
}

/** 让指定玩家成为当前回合玩家，然后跑一个回合 */
async function runTurnFor(player: IPlayer): Promise<void> {
  env.engine.state.currentPlayerIndex = player.seatIndex
  await env.engine.phaseManager.executeTurn()
}

/** 挂一个只做一件事的全局钩子技能（用于模拟改判） */
function hookSkill(owner: IPlayer, event: string, body: (ctx: unknown) => void): void {
  const skill: ISkill = {
    id: `probe-${event}`,
    name: '探针',
    description: '',
    priority: 10,
    trigger: { global: [event] as never },
    content: async (ctx) => {
      body(ctx)
    },
  }
  const handlers: CompiledHandler[] = new EventCompiler().compile(skill, owner)
  for (const h of handlers) {
    env.engine.eventDispatcher.eventTrigger.registerCompiled(h)
  }
}

describe('D15 · 延时锦囊在判定阶段真正生效', () => {
  it('乐不思蜀：判定非红桃 → 跳过出牌阶段', async () => {
    const [user, victim] = env.players()
    const leBu = await putDelayed(user!, victim!, 'leBuSiShu')
    expect(victim!.judgeCards.map((c) => c.instanceId)).toContain(leBu.instanceId)

    stackJudgeResult(CardSuit.Spade, CardRank.A)
    await runTurnFor(victim!)

    expect(victim!.shouldSkipPhases).toContain(GamePhase.PhaseUse)
    // 判定结束后延时牌离开判定区
    expect(victim!.judgeCards).toHaveLength(0)
  })

  it('乐不思蜀：判定红桃 → 不跳过（对照）', async () => {
    const [user, victim] = env.players()
    await putDelayed(user!, victim!, 'leBuSiShu')

    stackJudgeResult(CardSuit.Heart, CardRank.A)
    await runTurnFor(victim!)

    expect(victim!.shouldSkipPhases).not.toContain(GamePhase.PhaseUse)
  })

  it('兵粮寸断：判定非梅花 → 跳过摸牌阶段', async () => {
    const [user, victim] = env.players()
    await putDelayed(user!, victim!, 'bingLiangCunDuan')

    stackJudgeResult(CardSuit.Heart, CardRank.Five)
    await runTurnFor(victim!)

    expect(victim!.shouldSkipPhases).toContain(GamePhase.PhaseDraw)
  })

  it('闪电：判定黑桃 2–9 → 受到 3 点伤害', async () => {
    const [user, victim] = env.players()
    await putDelayed(user!, victim!, 'shanDian')
    const before = victim!.hp

    stackJudgeResult(CardSuit.Spade, CardRank.Five)
    await runTurnFor(victim!)

    expect(victim!.hp).toBe(before - 3)
  })

  it('闪电：判定非黑桃 2–9 → 不受伤，且传给下家判定区', async () => {
    const [user, victim] = env.players()
    const shanDian = await putDelayed(user!, victim!, 'shanDian')
    const next = env.players()[2]!
    const before = victim!.hp

    stackJudgeResult(CardSuit.Heart, CardRank.K)
    await runTurnFor(victim!)

    expect(victim!.hp).toBe(before)
    expect(next.judgeCards.map((c) => c.instanceId)).toContain(shanDian.instanceId)
  })

  it('判定牌用完后进弃牌堆 —— 不出两张牌', async () => {
    const [user, victim] = env.players()
    const leBu = await putDelayed(user!, victim!, 'leBuSiShu')
    const judgeProbe = stackJudgeResult(CardSuit.Spade, CardRank.A)
    const deckAtTurnStart = env.engine.state.deck.length
    await runTurnFor(victim!)

    // 牌堆只少 3 张：1 张被判定翻掉 + 摸牌阶段的 2 张（DEFAULT_DRAW_COUNT=2）。
    // 早先这里写的是「牌堆不变」，那是把摸牌阶段忘掉了。
    expect(env.engine.state.deck.length).toBe(deckAtTurnStart - 3)

    // 判定的两张牌都进了弃牌堆，且没有卡在处理区。
    // 不写「弃牌堆 +2」是因为整个回合跑完还会有弃牌阶段的弃牌混进来。
    const inDiscard = env.engine.state.discardPile.map((c) => c.instanceId)
    expect(inDiscard).toContain(leBu.instanceId)
    expect(inDiscard).toContain(judgeProbe.instanceId)
    expect(env.engine.state.processingCards).toHaveLength(0)
  })
})

describe('D16 · 改判有一个能被挂住的时机', () => {
  it('在 judge 上改 `judgeResultCard` 会改变延时锦囊的结果', async () => {
    const [user, victim] = env.players()
    await putDelayed(user!, victim!, 'leBuSiShu')

    // 原本判定为黑桃 → 应当跳过出牌阶段；
    // 改判把结果换成红桃 → 于是跳过被取消。
    stackJudgeResult(CardSuit.Spade, CardRank.A)

    // 走 giveCard 而不是手工 push：改判顶上来的牌是一张**手牌**，
    // owner / zone / handCards 三处都得对上，缺一处后面的收尾就会认不出它。
    const replacement = giveCard(
      victim!,
      cardDef('replaceProbe', [], { suit: CardSuit.Heart, rank: CardRank.Two }) as CardDefinition,
    )

    hookSkill(victim!, 'judgeBegin', (raw) => {
      const ctx = raw as { event: { data: Record<string, unknown> } }
      ctx.event.data['judgeResultCard'] = replacement
    })

    await runTurnFor(victim!)

    expect(victim!.shouldSkipPhases).not.toContain(GamePhase.PhaseUse)
  })
})
