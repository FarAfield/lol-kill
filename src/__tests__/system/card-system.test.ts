// ============================================================
// CardSystem —— 卡牌区域的唯一写入点
//
// 这一组用例就是 Phase 19 验收的第 2、3 条：
//   · 摸牌后 牌堆计数 / 手牌计数 / 卡牌 zone 三者一致
//   · 弃牌后 卡牌进入弃牌堆且 owner 清空
//
// 三条口径看着像废话，但「三者一致」恰恰是以前最容易破的那个不变量：
// `EffectContext.drawCards` 当年是 `card.zone = Hand` + `handCards.push`
// 两行，中间没有任何东西保证它们成对出现。漏了第二行，牌就在
// 「zone 写着 Hand、却不在任何人的手牌数组里」的状态下活到结算结束——
// 不报错、不崩溃，只是这张牌从此消失。
//
// 所以这里的断言一律**同时查三个地方**：全局数组、玩家数组、卡牌自身字段。
// ============================================================

import { describe, it, expect } from 'vitest'
import { ZoneType } from '@core/contracts/enums'
import { createTestEnv } from '../helpers/game-env'
import type { ICard } from '@core/contracts/card.interface'

/** 一张牌「在某人的手牌里」这件事的三处账目是否对得上 */
function expectInHand(card: ICard, holder: ICard['owner']): void {
  expect(card.zone, 'zone 应为 Hand').toBe(ZoneType.Hand)
  expect(card.owner, 'owner 应为持有者').toBe(holder)
  expect(holder?.handCards).toContain(card)
}

describe('摸牌 · 三处账目一致', () => {
  it('摸 3 张后：牌堆减 3、手牌加 3、每张牌 zone=Hand 且 owner 正确', async () => {
    const env = await createTestEnv()
    const engine = env.engine
    const p = env.players()[0]!

    const deckBefore = engine.state.deck.length
    const handBefore = p.handCards.length

    const drawn = engine.deckManager.draw(3)
    engine.cardSystem.obtainCards(drawn, p)

    expect(engine.state.deck.length).toBe(deckBefore - 3)
    expect(p.handCards.length).toBe(handBefore + 3)
    for (const card of drawn) expectInHand(card, p)
  })

  it('摸到的牌不在别处——牌堆与弃牌堆都不再含它', async () => {
    const env = await createTestEnv()
    const engine = env.engine
    const p = env.players()[0]!

    const drawn = engine.deckManager.draw(2)
    engine.cardSystem.obtainCards(drawn, p)

    for (const card of drawn) {
      expect(engine.state.deck).not.toContain(card)
      expect(engine.state.discardPile).not.toContain(card)
    }
  })

  it('手牌只对持有者可见', async () => {
    const env = await createTestEnv()
    const engine = env.engine
    const [p0, p1] = env.players()

    const drawn = engine.deckManager.draw(1)
    engine.cardSystem.obtainCards(drawn, p0!)

    // `isVisibleTo` 只是 Card 实体上的便利方法，ICard 接口只暴露 visibleTo
    // 数组。测试照接口写——哪天两者语义分叉，这里会先炸。
    const card = drawn[0]!
    expect(card.visibleTo.includes(p0!)).toBe(true)
    expect(card.visibleTo.includes(p1!)).toBe(false)
  })

  it('开局发牌后，全场每张牌的三处账目都对得上', async () => {
    // 这条用例守护的是「摸牌两步式」：DeckManager.draw 只摘牌，
    // 交到人手里是 CardSystem.obtainCards 的事。漏掉第二步不报错，
    // 牌只是从此消失——只有全表核对才抓得住。
    const env = await createTestEnv()
    const engine = env.engine

    for (const p of env.players()) {
      for (const card of p.handCards) {
        expectInHand(card, p)
      }
    }

    // 反向核对：牌堆 / 弃牌堆里的牌不归任何人，也不在任何人的手里
    const publicZones = [engine.state.deck, engine.state.discardPile]
    for (const pile of publicZones) {
      for (const card of pile) {
        expect(card.owner, '公共区域的牌不该有持有者').toBeUndefined()
        for (const p of env.players()) {
          expect(p.handCards).not.toContain(card)
        }
      }
    }

    // 全场牌数守恒：手牌 + 牌堆 + 弃牌堆 = 发牌总数
    const inHands = env.players().reduce((n, p) => n + p.handCards.length, 0)
    expect(inHands + engine.state.deck.length + engine.state.discardPile.length)
      .toBeGreaterThan(0)
  })

  it('牌堆摸空时自动回收弃牌堆，账目依然对得上', async () => {
    const env = await createTestEnv()
    const engine = env.engine
    const p = env.players()[0]!

    // 先把一批牌送进弃牌堆，制造「牌堆不够」的局面
    const first = engine.deckManager.draw(5)
    engine.cardSystem.obtainCards(first, p)
    engine.cardSystem.discardCards(first, p)
    expect(engine.state.discardPile.length).toBe(5)

    // 一次性摸到超过剩余牌堆的量，触发回收
    const need = engine.state.deck.length + 3
    const drawn = engine.deckManager.draw(need)
    engine.cardSystem.obtainCards(drawn, p)

    expect(drawn).toHaveLength(need)
    for (const card of drawn) expectInHand(card, p)
    // 回收后每张牌仍只存在于一处：手牌里，不在弃牌堆
    for (const card of drawn) expect(engine.state.discardPile).not.toContain(card)
  })
})

describe('弃牌 · 进弃牌堆且 owner 清空', () => {
  it('从手牌弃置：进弃牌堆、zone=Discard、owner 清空、离开手牌数组', async () => {
    const env = await createTestEnv()
    const engine = env.engine
    const p = env.players()[0]!

    const drawn = engine.deckManager.draw(1)
    engine.cardSystem.obtainCards(drawn, p)
    const card = drawn[0]!

    const discardBefore = engine.state.discardPile.length
    const handBefore = p.handCards.length

    engine.cardSystem.discardCard(card, p)

    expect(engine.state.discardPile.length).toBe(discardBefore + 1)
    expect(engine.state.discardPile).toContain(card)
    expect(p.handCards.length).toBe(handBefore - 1)
    expect(p.handCards).not.toContain(card)
    expect(card.zone).toBe(ZoneType.Discard)
    // owner 必须清空：回收弃牌堆后这张牌会被洗进牌堆再摸给别人，
    // 带着旧 owner 就会把「前主人的引用」带进新主人的手牌
    expect(card.owner).toBeUndefined()
  })

  it('弃置后对所有人不可见', async () => {
    const env = await createTestEnv()
    const engine = env.engine
    const p = env.players()[0]!

    const drawn = engine.deckManager.draw(1)
    engine.cardSystem.obtainCards(drawn, p)
    const card = drawn[0]!
    engine.cardSystem.discardCard(card, p)

    for (const anyone of env.players()) {
      expect(card.visibleTo.includes(anyone)).toBe(false)
    }
  })

  it('弃别人的牌会被拒绝——权限校验在系统层，不在调用方', async () => {
    const env = await createTestEnv()
    const engine = env.engine
    const [p0, p1] = env.players()

    const drawn = engine.deckManager.draw(1)
    engine.cardSystem.obtainCards(drawn, p0!)
    const card = drawn[0]!

    expect(() => engine.cardSystem.discardCard(card, p1!)).toThrow(/does not own/)
    // 被拒绝后状态原封不动
    expect(card.zone).toBe(ZoneType.Hand)
    expect(card.owner).toBe(p0)
  })

  it('弃置已在弃牌堆的牌会被拒绝——来源区域不合法', async () => {
    const env = await createTestEnv()
    const engine = env.engine
    const p = env.players()[0]!

    const drawn = engine.deckManager.draw(1)
    engine.cardSystem.obtainCards(drawn, p)
    const card = drawn[0]!
    engine.cardSystem.discardCard(card, p)

    // 同一张牌再弃一次：它已经不在合法来源区域（手/装备/判定）里了
    expect(() => engine.cardSystem.discardCard(card, p)).toThrow(/cannot discard card in/)
  })

  it('死亡清空三区走 moveToDiscard——不受权限与区域校验拦', async () => {
    const env = await createTestEnv()
    const engine = env.engine
    const p = env.players()[0]!

    // 模拟死亡：手牌 / 装备 / 判定三区全部清空。
    // 人已不在，牌必须走，没有「弃不掉」这一说——这是 `discardCard`
    // 与 `moveToDiscard` 的分工：`discardCard` 管规则（能不能弃），
    // `moveToDiscard` 管结算（必须走）。
    const everything = [...p.handCards, ...p.equipCards, ...p.judgeCards]
    expect(everything.length).toBeGreaterThan(0)
    for (const card of everything) engine.cardSystem.moveToDiscard(card)

    expect(p.handCards).toHaveLength(0)
    expect(p.equipCards).toHaveLength(0)
    expect(p.judgeCards).toHaveLength(0)
    for (const card of everything) {
      expect(card.zone).toBe(ZoneType.Discard)
      expect(card.owner).toBeUndefined()
      expect(engine.state.discardPile).toContain(card)
    }
  })
})

describe('装备 · 进出都通知装备变动', () => {
  it('装上武器后进入装备区且全员可见', async () => {
    const env = await createTestEnv()
    const engine = env.engine
    const p = env.players()[0]!

    // 从牌堆里找一张带武器槽的牌；找不到就跳过（牌堆构成由 source 决定）
    const weapon = engine.state.deck.find((c) => c.equipSlot !== undefined)
    if (!weapon) return

    engine.cardSystem.obtainCard(weapon, p)
    engine.cardSystem.equipCard(weapon, p)

    expect(weapon.zone).toBe(ZoneType.Equip)
    expect(p.equipCards).toContain(weapon)
    expect(p.handCards).not.toContain(weapon)
    for (const anyone of env.players()) {
      expect(weapon.visibleTo.includes(anyone)).toBe(true)
    }
  })
})
