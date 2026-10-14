// ============================================================
// Phase 16 验收 · viewAs 视作系统
//
// 「这张牌是什么」与「这张牌能当什么用」是两件事。前者造牌时就定了，
// 后者要由技能**每次被问**时回答。在 Phase 16 之前，引擎里根本没有
// 「问」这个动作——`viewAs` 是一个写上去不报错、也没人读的字段。
//
// 本组用例盯的是四条最容易写漏的：
//
// 1. **虚拟牌打出去了却什么都不发生**：只覆盖 `tags` 不覆盖 `id`，
//    内容分发按 `card.id` 找 `useCardContent`，找不到 → 静默无事发生。
// 2. **响应窗口看不到虚拟牌**：赵云手里有杀却打不出闪，因为闪的候选
//    只从 `handCards` 里挑。【龙胆】能响应【杀】全靠这一条。
// 3. **出杀额度被视作绕过**：武圣拿每张红牌当杀，如果额度按底牌 id
//    记账，「每回合一张杀」这条规则在技能面前整体失效。
// 4. **虚拟牌被当成实体**：把虚拟牌塞进手牌数组，区域的盈亏就不守恒了。
//
// 命名：全部英文语义，禁止拼音（code-standards.md §6.1）。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { CardSuit, GamePhase, ZoneType } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import { longdan, wusheng } from '@source/heroes/skills/shu-skills'
import { zhangBaSheMao } from '@source/base/effects/equip-effects'
import { ScriptedDecisionService, cardDef, createTestEnv, giveCard, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
  // 开局发的手牌是随机的，会让「有几个视作」这类计数断言随牌堆漂移。
  // 每条用例自己造牌，因此先清空——要数的是技能的产物，不是发牌的运气。
  for (const player of env.players()) player.handCards.length = 0
})

/**
 * 把一条技能挂到指定玩家身上（走真实台账）
 *
 * 标准局启动时已经把 `source/` 全部技能登记过了，重复登记会抛错；
 * 这里按「没登记过才登记」处理，于是内置技能与测试造的技能能走同一条路。
 */
function attach(def: ISkill, player: IPlayer): void {
  const registry = env.engine.skillRegistry
  if (!registry.get(def.id)) registry.register(def)
  registry.attach(player, def.id)
}

/** 出牌阶段能视作什么 */
function viewsFor(player: IPlayer) {
  return env.engine.viewAs.getViews({ player, usage: GamePhase.PhaseUse })
}

/** 响应窗口能视作什么 */
function responsesFor(player: IPlayer, tag: (typeof CardTag)[keyof typeof CardTag]) {
  return env.engine.viewAs.getViews({ player, usage: 'response', requireTag: tag })
}

/**
 * 出牌阶段的可选项
 *
 * `getPlayableCards` 目前是私有的：它本该由 `GameController` 暴露给 UI。
 * 在那之前测试宁可断言私有方法，也不为它开一个公共口子。
 */
function playableCards(player: IPlayer, used: Map<string, number>): ICard[] {
  const pm = env.engine.phaseManager as unknown as {
    getPlayableCards(p: IPlayer, used: Map<string, number>): ICard[]
  }
  return pm.getPlayableCards(player, used)
}

/** 一张红色非杀的牌（武圣的原料） */
function redCard(player: IPlayer): ICard {
  return giveCard(player, cardDef('redFiller', [], { suit: CardSuit.Heart, name: '红牌' }))
}

/** 一张黑色非杀的牌（武圣不该碰它） */
function blackCard(player: IPlayer): ICard {
  return giveCard(player, cardDef('blackFiller', [], { suit: CardSuit.Spade, name: '黑牌' }))
}

/** 一张杀 */
function strikeCard(player: IPlayer): ICard {
  return giveCard(player, cardDef('sha', [CardTag.Strike, CardTag.Attack]))
}

/** 一张闪 */
function dodgeCard(player: IPlayer): ICard {
  return giveCard(player, cardDef('shan', CardTag.Dodge))
}

/**
 * 记录型决策服务
 *
 * `ScriptedDecisionService` 只记「问了什么」，记不下「候选里有什么」——
 * 而「响应窗口里有没有虚拟闪」恰恰是本次验收的核心之一。
 */
class RecordingDecisions extends ScriptedDecisionService {
  readonly seen: ICard[][] = []

  override async askForResponse(
    player: IPlayer,
    prompt: string,
    validCards: ICard[],
  ): Promise<ICard | null> {
    this.seen.push([...validCards])
    return super.askForResponse(player, prompt, validCards)
  }
}

// ═══════════════════════════════════════════
// 基线
// ═══════════════════════════════════════════

describe('Phase 16 · 基线', () => {
  it('没有 viewAs 技能时，视作列表为空', () => {
    const [player] = env.players()
    redCard(player!)
    expect(viewsFor(player!)).toHaveLength(0)
  })

  it('只写了 viewAs 却没写 enable → 不提供视作（没有手动入口）', () => {
    const [player] = env.players()
    redCard(player!)
    attach(
      {
        id: 'testNoEntry',
        name: '无入口',
        description: '',
        viewAs: () => ({ id: 'sha', tags: new Set([CardTag.Strike]) }),
      },
      player!,
    )
    expect(viewsFor(player!)).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════
// 武圣 —— 一张当一张
// ═══════════════════════════════════════════

describe('Phase 16 · 武圣（红色牌当杀）', () => {
  it('红色手牌可作为【杀】使用', () => {
    const [player] = env.players()
    const card = redCard(player!)
    attach(wusheng, player!)

    const views = viewsFor(player!)
    expect(views).toHaveLength(1)
    expect(views[0]!.card.tags.has(CardTag.Strike)).toBe(true)
    expect(views[0]!.baseCards.map((c) => c.instanceId)).toEqual([card.instanceId])
  })

  it('视作结果带的是【杀】的 id —— 否则打出去了却 dispatch 不到杀的内容', () => {
    const [player] = env.players()
    redCard(player!)
    attach(wusheng, player!)

    // 只写 `tags` 的话，这张牌**名字像**杀但 id 还是底牌的，
    // 内容分发查 `useCardContent['sha']` 时查的就是别的键。
    expect(viewsFor(player!)[0]!.card.id).toBe('sha')
  })

  it('黑色牌不参与武圣', () => {
    const [player] = env.players()
    blackCard(player!)
    attach(wusheng, player!)

    expect(viewsFor(player!)).toHaveLength(0)
  })

  it('虚拟牌不属于任何区域 —— 底牌仍在手牌里', () => {
    const [player] = env.players()
    const card = redCard(player!)
    attach(wusheng, player!)

    const view = viewsFor(player!)! [0]!
    expect(view.card.virtual).toBe(true)
    expect(view.card.viewedFrom).toEqual([card.instanceId])
    // 视作只是「看」，没有任何一张牌离开手牌
    expect(player!.handCards.map((c) => c.instanceId)).toContain(card.instanceId)
    expect(card.zone).toBe(ZoneType.Hand)
  })
})

// ═══════════════════════════════════════════
// 龙胆 —— 响应窗口里的视作
// ═══════════════════════════════════════════

describe('Phase 16 · 龙胆（杀当闪）', () => {
  it('响应窗口能问出虚拟闪', () => {
    const [victim] = env.players()
    strikeCard(victim!)
    attach(longdan, victim!)

    const views = responsesFor(victim!, CardTag.Dodge)
    expect(views).toHaveLength(1)
    expect(views[0]!.card.tags.has(CardTag.Dodge)).toBe(true)
    expect(views[0]!.card.id).toBe('shan')
  })

  it('双面视作按 usage 分流 —— 出牌阶段给杀那一面，响应时给闪那一面', () => {
    const [player] = env.players()
    const asDodgeMaterial = strikeCard(player!)
    const asStrikeMaterial = dodgeCard(player!)
    attach(longdan, player!)

    // 被要求出闪：拿【杀】变出来的那一面
    const responses = responsesFor(player!, CardTag.Dodge)
    expect(responses).toHaveLength(1)
    expect(responses[0]!.baseCards[0]!.instanceId).toBe(asDodgeMaterial.instanceId)

    // 出牌阶段：拿【闪】变出来的那一面；【杀】在这里毫无变化
    const plays = viewsFor(player!)
    expect(plays).toHaveLength(1)
    expect(plays[0]!.card.tags.has(CardTag.Strike)).toBe(true)
    expect(plays[0]!.baseCards[0]!.instanceId).toBe(asStrikeMaterial.instanceId)
  })

  it('响应征询的可选牌列表里包含虚拟牌（清单 #15）', async () => {
    const decisions = new RecordingDecisions()
    env = await createTestEnv(decisions)

    const [attacker, victim] = env.players()
    const shaCard = strikeCard(attacker!)
    const asDodge = strikeCard(victim!)
    attach(longdan, victim!)

    // 不指定应答：我们要看的不是「有没有出闪」，而是「有没有得选」
    await env.engine.useCard(attacker!, shaCard, [victim!])

    const asked = decisions.seen.find((cards) => cards.length > 0)
    expect(asked).toBeDefined()
    expect(asked!.map((c) => c.instanceId)).toContain(
      `virtual:longdan:${asDodge.instanceId}`,
    )
    // 受害者手里那张杀本身也在候选里——它是底牌，不是候选
    expect(asked!.some((c) => c.virtual)).toBe(true)
  })

  it('出掉虚拟闪 → 消耗的是底牌那张杀', async () => {
    const [attacker, victim] = env.players()
    const shaCard = strikeCard(attacker!)
    const asDodge = strikeCard(victim!)
    attach(longdan, victim!)

    const view = env.engine.viewAs.getViews({
      player: victim!,
      usage: 'response',
      requireTag: CardTag.Dodge,
    })[0]!
    env.decisions.script(victim!, '是否出闪', view.card)

    const before = victim!.hp
    await env.engine.useCard(attacker!, shaCard, [victim!])

    // 闪掉了 → 没掉血；底牌（那张杀）进了弃牌堆
    expect(victim!.hp).toBe(before)
    expect(asDodge.zone).toBe(ZoneType.Discard)
    expect(victim!.handCards.map((c) => c.instanceId)).not.toContain(asDodge.instanceId)
  })
})

// ═══════════════════════════════════════════
// 丈八蛇矛 —— 两张当一张
// ═══════════════════════════════════════════

describe('Phase 16 · 丈八蛇矛（两张手牌当杀）', () => {
  it('两张手牌的所有组合都被枚举到', () => {
    const [player] = env.players()
    const a = redCard(player!)
    const b = blackCard(player!)
    const c = redCard(player!)
    attach(zhangBaSheMao, player!)

    const views = viewsFor(player!)
    expect(views).toHaveLength(3)

    const pairs = views.map((v) => v.baseCards.map((k) => k.instanceId).sort())
    for (const expected of [
      [a.instanceId, b.instanceId],
      [a.instanceId, c.instanceId],
      [b.instanceId, c.instanceId],
    ]) {
      expect(pairs).toContainEqual([...expected].sort())
    }
  })

  it('只有一张手牌时凑不出两张', () => {
    const [player] = env.players()
    redCard(player!)
    attach(zhangBaSheMao, player!)

    expect(viewsFor(player!)).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════
// 虚拟牌的身份与额度
// ═══════════════════════════════════════════

describe('Phase 16 · 虚拟牌的身份与额度', () => {
  it('同一条视作每次问到都是同一个身份（可推导，不靠发号）', () => {
    const [player] = env.players()
    redCard(player!)
    attach(wusheng, player!)

    const first = viewsFor(player!)[0]!.card.instanceId
    const second = viewsFor(player!)[0]!.card.instanceId
    expect(first).toBe(second)
    expect(first.startsWith('virtual:wusheng:')).toBe(true)
  })

  it('不同技能 / 不同底牌不会撞上同一个身份', () => {
    const [player] = env.players()
    const a = redCard(player!)
    const b = redCard(player!)
    attach(wusheng, player!)

    const ids = viewsFor(player!).map((v) => v.card.instanceId)
    expect(new Set(ids).size).toBe(2)
    expect(a.instanceId).not.toBe(b.instanceId)
  })

  it('虚拟杀与真杀共用同一个出杀额度（否则每回合一张杀形同虚设）', () => {
    const [player] = env.players()
    redCard(player!)
    const real = strikeCard(player!)
    attach(wusheng, player!)

    // 已经用过一次杀 → 虚拟杀同样不该出现在选项里。
    //
    // 账本现在**只有一份**：`player.usedAttackThisTurn`（D8 形态甲）。
    // 以前出牌阶段自己按「额度键」另记一份流水，与 AI / UI 读的那份
    // 不是一个数。判定统一之后，这里也必须记到同一本账上。
    env.engine.playerSystem.markAttackUsed(player!)
    const options = playableCards(player!, new Map())
    expect(options.some((c) => c.virtual)).toBe(false)
    expect(options.some((c) => c.instanceId === real.instanceId)).toBe(false)
  })

  it('出牌阶段的候选列表里出现虚拟牌（与真牌排在一起）', () => {
    const [player] = env.players()
    redCard(player!)
    attach(wusheng, player!)

    expect(playableCards(player!, new Map()).filter((c) => c.virtual)).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════
// 守恒
// ═══════════════════════════════════════════

describe('Phase 16 · 区域守恒', () => {
  it('弃掉一张虚拟牌 → 进去的是底牌，虚拟牌不占任何区域', () => {
    const [player] = env.players()
    const card = redCard(player!)
    attach(wusheng, player!)

    const view = viewsFor(player!)[0]!
    env.engine.cardSystem.discardCard(view.card, player!)

    expect(card.zone).toBe(ZoneType.Discard)
    expect(player!.handCards.map((c) => c.instanceId)).not.toContain(card.instanceId)
    expect(player!.handCards.map((c) => c.instanceId)).not.toContain(view.card.instanceId)
    // 虚拟牌只改了个标记，从没进过任何区域数组
    expect(view.card.zone).toBe(ZoneType.Discard)
  })

  it('视作不影响牌堆总数 —— 问一百次也不会多出一张牌', () => {
    const [player] = env.players()
    redCard(player!)
    attach(wusheng, player!)

    const countCards = () =>
      env.engine.state.deck.length +
      env.engine.state.discardPile.length +
      env.engine.state.processingCards.length +
      env.engine.state.players.reduce(
        (sum, p) => sum + p.handCards.length + p.equipCards.length + p.judgeCards.length,
        0,
      )

    const before = countCards()
    for (let i = 0; i < 100; i += 1) viewsFor(player!)
    expect(countCards()).toBe(before)
  })
})

// ═══════════════════════════════════════════
// 武圣 · 端到端（欠账 D1）
//
// 上面那一组只断言「视作列表是什么样子」，从没把虚拟杀真的打出去。
// 「列表里有」与「打出去会掉血」之间隔着三层：内容分发按 `card.id` 找
// 杀、底牌要真的从手牌进弃牌堆、伤害要走 `damage` 事件而不是就地改 hp。
// 这三层任何一层断了，视作列表依旧漂漂亮亮——这正是这条欠账存在的原因。
// ═══════════════════════════════════════════

describe('武圣 · 端到端（打出虚拟杀 → 目标真的掉血）', () => {
  it('红牌当杀打出去 → 目标掉 1 血，底牌进弃牌堆', async () => {
    const [attacker, victim] = env.players()
    const base = redCard(attacker!)
    attach(wusheng, attacker!)

    const view = viewsFor(attacker!)! [0]!
    const hpBefore = victim!.hp

    // 受害者手里没牌，出不了闪 —— 要验的是伤害本身，不是响应窗口
    await env.engine.useCard(attacker!, view.card, [victim!])

    expect(victim!.hp).toBe(hpBefore - 1)
    // 消耗的是底牌那张红牌，不是凭空冒出来的虚拟牌
    expect(base.zone).toBe(ZoneType.Discard)
    expect(attacker!.handCards.map((c) => c.instanceId)).not.toContain(base.instanceId)
    // 虚拟牌自己从不占任何区域
    expect(attacker!.handCards.map((c) => c.instanceId)).not.toContain(view.card.instanceId)
  })

  it('反例：没有武圣时同一张红牌打出去不掉血', async () => {
    const [attacker, victim] = env.players()
    const base = redCard(attacker!)

    const hpBefore = victim!.hp
    await env.engine.useCard(attacker!, base, [victim!])

    // 它只是「一张红牌」，没有任何内容认得它 ——
    // 于是牌照常进弃牌堆，可**一点伤害也没有**。
    expect(victim!.hp).toBe(hpBefore)
    expect(base.zone).toBe(ZoneType.Discard)
  })

  it('对方有闪时要得到闪 —— 伤害不是硬写上去的', async () => {
    const [attacker, victim] = env.players()
    redCard(attacker!)
    const dodge = dodgeCard(victim!)
    attach(wusheng, attacker!)

    env.decisions.script(victim!, '是否出闪', dodge)
    const hpBefore = victim!.hp

    await env.engine.useCard(attacker!, viewsFor(attacker!)! [0]!.card, [victim!])

    expect(victim!.hp).toBe(hpBefore)
    expect(dodge.zone).toBe(ZoneType.Discard)
  })

  it('造成伤害走的是 damage 事件 —— 事件树上查得到', async () => {
    const [attacker, victim] = env.players()
    redCard(attacker!)
    attach(wusheng, attacker!)

    env.engine.setObservability({ trace: true })
    await env.engine.useCard(attacker!, viewsFor(attacker!)! [0]!.card, [victim!])

    // 少了这一条，「hp 少了一点」也可能只是有人就地改了个数字，
    // 而闪、濒死、奖惩这些挂在 damage 上的东西一个都不会发生。
    const trace = env.engine.eventTrace.flatten().map((n) => n.name)
    expect(trace).toContain('damage')
    // 对照：事件树不是空的，`toContain` 才有意义
    expect(trace.length).toBeGreaterThan(1)
  })
})
