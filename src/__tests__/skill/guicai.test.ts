// ============================================================
// 【鬼才】改判回归测试（D44）
//
// 改判是「一件事被两个发起方各写一遍」的典型受害者：
// 判定有两条发起路径（判定阶段、内容层自己翻牌），两条路径往事件里
// 放的键**同名不同义**——于是技能换掉的到底是「翻出来的那张」还是
// 「延时锦囊自己」，取决于这次是谁发起的判定。
//
// 这里全部走真实引擎（起局 → dispatch 延时锦囊 → 看结果），
// 断言落在**结果**上而不是「有没有调用某个函数」：
// 改判生效与否的唯一可观测后果，就是延时锦囊按哪张牌的花色生效。
// ============================================================

import { describe, expect, it } from 'vitest'

import { GameEvent } from '@core/event/game-event'
import { EventChain } from '@core/event/event-chain'
import { CardSuit, CardRank, ZoneType, GamePhase } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import { Card } from '@core/entity/card'
import type { CardDefinition } from '@core/contracts/card.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import {
  createTestEnv,
  giveCard,
  cardDef,
  ScriptedDecisionService,
  type TestEnv,
} from '../helpers/game-env'
import { SimaYi, LiuBei, GuanYu, ZhangFei, ZhaoYun } from '@source/heroes/standard'

/** 局里必须有会改判的那个英雄，否则这条链路根本走不到 */
const WITH_GUICAI = [SimaYi, LiuBei, GuanYu, ZhangFei, ZhaoYun]

interface JudgeRun {
  /** 改判前牌堆顶那张 —— 也就是「本来该生效的那张」 */
  top: ICard
  /** 目标有没有被跳过出牌阶段 */
  skipped: boolean
}

async function guicaiEnv(hand?: CardDefinition): Promise<{
  env: TestEnv
  simaYi: IPlayer
  victim: IPlayer
  replacement: ICard | null
}> {
  const env = await createTestEnv<ScriptedDecisionService>(undefined, { heroes: WITH_GUICAI })
  const simaYi = env.players().find((p) => p.hero?.id === 'simayi')!
  const victim = env.players().find((p) => p.id !== simaYi.id)!

  // 改判取 `handCards[0]`，因此手牌要**只剩**这一张才谈得上确定
  simaYi.handCards.length = 0
  const replacement = hand ? giveCard(simaYi, hand) : null

  return { env, simaYi, victim, replacement }
}

async function runLeBuSiShu(env: TestEnv, victim: IPlayer): Promise<JudgeRun> {
  const deck = env.engine.state.deck
  const top = deck[deck.length - 1]!

  const event = new GameEvent({
    name: 'leBuSiShu',
    source: victim,
    player: victim,
    targets: [victim],
  })
  await env.engine.eventDispatcher.dispatch(event, new EventChain())

  return { top, skipped: victim.shouldSkipPhases.includes(GamePhase.PhaseUse) }
}

describe('【鬼才】改判', () => {
  it('局里认得出司马懿，且他手上有牌时改判链路才会走', async () => {
    const { env, simaYi } = await guicaiEnv(cardDef('sha', CardTag.Strike, { suit: CardSuit.Spade }))

    // 「找得到司马懿」本身要断言：英雄池一旦不含他，下面所有断言都是废话
    expect(simaYi.hero?.id).toBe('simayi')
    expect(simaYi.handCards).toHaveLength(1)
    expect(env.players()).toHaveLength(5)
  })

  it('打出一张红桃 → 判定按红桃生效，不跳过出牌阶段', async () => {
    const { env, victim, simaYi, replacement } = await guicaiEnv(
      cardDef('tao', CardTag.Heal, { suit: CardSuit.Heart }),
    )

    const run = await runLeBuSiShu(env, victim)

    expect(run.skipped).toBe(false)
    // 顶上来的那张进了弃牌堆，不是留在手里
    expect(replacement!.zone).toBe(ZoneType.Discard)
    expect(simaYi.handCards).toHaveLength(1)
    expect(simaYi.handCards[0]).not.toBe(replacement)
  })

  it('打出一张黑桃 → 判定按黑桃生效，跳过出牌阶段（同一张顶牌，只因手牌不同而结果相反）', async () => {
    const { env, victim } = await guicaiEnv(
      cardDef('sha', CardTag.Strike, { suit: CardSuit.Spade }),
    )

    const run = await runLeBuSiShu(env, victim)

    expect(run.skipped).toBe(true)
  })

  it('换下来的原判定牌进了司马懿手里（是「换」不是「改」）', async () => {
    const { env, victim, simaYi, replacement } = await guicaiEnv(
      cardDef('sha', CardTag.Strike, { suit: CardSuit.Spade }),
    )

    const run = await runLeBuSiShu(env, victim)

    expect(simaYi.handCards.some((c) => c.instanceId === run.top.instanceId)).toBe(true)
    expect(simaYi.handCards.some((c) => c.instanceId === replacement!.instanceId)).toBe(false)
    // 顺带证明「顶上来的那张」与「被换下来的那张」不是同一张——
    // 否则「换」只是把同一张牌挪了个位置，改判等于没发生
    expect(run.top.instanceId).not.toBe(replacement!.instanceId)
  })

  /**
   * 判定有两条发起路径，改判必须在**两条**上都生效
   *
   * 上面几条走的是「内容层自己翻牌」（直接 dispatch 延时锦囊）；
   * 这一条走真实回合（`executeTurn` → 判定阶段），覆盖的是另一条。
   * 两条路曾经各有一份收尾逻辑，只有判定阶段那份写全了——
   * 内容层那份直接 `finishProcessing`，改判一挪牌就抛错。
   */
  it('真实判定阶段里改判同样生效（内容层翻牌之外的另一条路）', async () => {
    const { env, victim } = await guicaiEnv(
      cardDef('tao', CardTag.Heal, { suit: CardSuit.Heart }),
    )
    const user = env.players().find((p) => p.id !== victim.id && p.hero?.id !== 'simayi')!

    // 把判定结果钉成黑桃：不改判的话乐不思蜀必定生效（跳过出牌）
    const probe = Card.create(
      cardDef('judgeProbe', [], { suit: CardSuit.Spade, rank: CardRank.A }) as CardDefinition,
    )
    env.engine.state.deck.push(probe)

    const leBu = giveCard(user, cardDef('leBuSiShu', [], { isDelayed: true }) as CardDefinition)
    await env.engine.useCard(user, leBu, [victim])
    expect(victim.judgeCards.map((c) => c.instanceId)).toContain(leBu.instanceId)

    env.engine.state.currentPlayerIndex = victim.seatIndex
    await env.engine.phaseManager.executeTurn()

    // 判定被换成红桃 → 不跳过；若改判没生效，这里会是 true
    expect(victim.shouldSkipPhases.includes(GamePhase.PhaseUse)).toBe(false)
    // 结算完不留残渣：延时牌进了弃牌堆、处理区清空
    expect(env.engine.state.discardPile.map((c) => c.instanceId)).toContain(leBu.instanceId)
    expect(env.engine.state.processingCards).toHaveLength(0)
  })

  it('没有手牌时改判不发生：结果仍按翻出来的那张', async () => {
    const { env, victim } = await guicaiEnv()

    const run = await runLeBuSiShu(env, victim)

    // 期望值由**顶牌**给出而不是写死：乐不思蜀是「非红桃才跳过」，
    // 写死 true 的话，顶牌恰好是红桃那天这条就假绿了
    expect(run.skipped).toBe(run.top.suit !== CardSuit.Heart)
  })
})
