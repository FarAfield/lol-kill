// ============================================================
// ContentRegistry 回归测试（Phase 7）
//
// 这个 Phase 的全部价值可以用一句话概括：
//   **卡牌行为不再挂在某个玩家身上，而是「事件名 → 默认处理器」；
//     新增一张牌 = 加一个内容条目，引擎零改动。**
//
// 下面的测试全部走真实引擎（GameBoot + engine.useCard），
// 而不是直接调内容函数——因为历史上「卡牌效果注册了但从未被调用」
// 正是靠这种端到端测试才暴露的。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

//
// 测试替身（logger / random / 可编程决策服务）与 giveCard / cardDef
// 一律用 ../helpers/game-env 的共享版本——早先这里抄了一整套，
// 那份副本漏实现了 IUIDecisionService 的 7 个方法，
// 而它所在的目录当时又不在类型检查范围内，谁也没发现。
import { GameEvent } from '@core/event/game-event'
import { EventChain } from '@core/event/event-chain'
import { CardTag } from '@core/contracts/card-tag'
import { ZoneType } from '@core/contracts/enums'
import type { EventContent } from '@core/event/content-registry'
import type { EventName } from '@core/contracts/event-name'
import type { IPlayer } from '@core/contracts/player.interface'
import {
  createTestEnv,
  giveCard,
  cardDef,
  ScriptedDecisionService,
  type TestEnv,
} from '../helpers/game-env'

// ── 测试环境 ──

let env: TestEnv
let engine: TestEnv['engine']
let decisions: ScriptedDecisionService

beforeEach(async () => {
  env = await createTestEnv()
  engine = env.engine
  decisions = env.decisions
})

function players(): IPlayer[] {
  return engine.state.players
}

// ── 注册表本身 ──

describe('ContentRegistry 基础设施', () => {
  it('引擎启动后卡牌内容已装载', () => {
    const registry = engine.contentRegistry
    expect(registry.has('useCard')).toBe(true)
    expect(registry.has('sha')).toBe(true)
    expect(registry.has('tao')).toBe(true)
    expect(registry.has('jiu')).toBe(true)
    expect(registry.has('guoHeChaiQiao')).toBe(true)
    expect(registry.has('equip')).toBe(true)
    expect(registry.size).toBeGreaterThan(10)
  })

  it('同名重复注册会覆盖且告警', () => {
    const registry = engine.contentRegistry
    const warn = console.warn
    const messages: string[] = []
    console.warn = (m: string) => messages.push(m)

    const first = () => {}
    const second = () => {}
    registry.register('testDup', first)
    registry.register('testDup', second)

    console.warn = warn
    expect(registry.get('testDup')).toBe(second)
    expect(messages.some((m) => m.includes('testDup'))).toBe(true)
  })

  it('内容只在事件没有自带步骤时挂载（不覆盖调用方的步骤机）', async () => {
    const player = players()[0]!
    const event = new GameEvent({ name: 'sha', source: player, player })
    event.addStep(0, (e) => {
      e.result.customMarker = 'from-caller'
    })

    await engine.eventDispatcher.dispatch(event, new EventChain())

    // 调用方的步骤赢了，sha 的默认内容没有覆盖它
    expect(event.result['customMarker']).toBe('from-caller')
  })

  it('自定义事件名不改引擎即可注册并触发（新增一张牌的成本）', async () => {
    const registry = engine.contentRegistry
    let ran = 0
    registry.register('myCustomCard', () => {
      ran += 1
    })

    const player = players()[0]!
    const event = new GameEvent({ name: 'myCustomCard' as EventName, source: player, player })
    await engine.eventDispatcher.dispatch(event, new EventChain())

    expect(ran).toBe(1)
  })
})

// ── 基本牌（7.1）──

describe('基本牌', () => {
  it('【杀】未出闪 → 目标扣 1 点体力，并记录已出杀', async () => {
    const [attacker, victim] = players()
    const sha = giveCard(attacker, cardDef('sha', CardTag.Strike))
    const before = victim.hp

    await engine.useCard(attacker, sha, [victim])

    expect(victim.hp).toBe(before - 1)
    expect(attacker.usedAttackThisTurn).toBe(true)
  })

  it('【杀】目标出闪 → 不扣血，闪进弃牌堆', async () => {
    const [attacker, victim] = players()
    const sha = giveCard(attacker, cardDef('sha', CardTag.Strike))
    const dodge = giveCard(victim, cardDef('shan', CardTag.Dodge))
    decisions.script(victim, '是否出闪', dodge)

    const before = victim.hp
    await engine.useCard(attacker, sha, [victim])

    expect(victim.hp).toBe(before)
    expect(dodge.zone).toBe(ZoneType.Discard)
  })

  it('【杀】酒杀 +1 伤害，且只加成一次', async () => {
    const [attacker, victim] = players()

    const jiu = giveCard(attacker, cardDef('jiu', CardTag.Wine))
    await engine.useCard(attacker, jiu, [])
    expect(attacker.getMark('jiuBoost')).toBe(1)

    const sha = giveCard(attacker, cardDef('sha', CardTag.Strike))
    const before = victim.hp
    await engine.useCard(attacker, sha, [victim])

    expect(victim.hp).toBe(before - 2)
    expect(attacker.getMark('jiuBoost')).toBe(0)
  })

  it('【桃】对自己使用回复 1 点体力', async () => {
    const player = players()[0]!
    player.hp = Math.max(1, player.maxHp - 2)
    // 真实定义是 `[Heal, Basic, Dying]` —— 只给 `Heal` 的话它进不了
    // 桃的目标规则，会落到「默认：距离 1 的其他角色」，自己反而不是合法目标
    const tao = giveCard(player, cardDef('tao', [CardTag.Heal, CardTag.Basic]))
    const before = player.hp

    await engine.useCard(player, tao, [player])

    expect(player.hp).toBe(before + 1)
  })

  it('【闪】作为响应打出时取消父事件（防止伤害 = cancel）', async () => {
    const [attacker, victim] = players()
    const shan = giveCard(victim, cardDef('shan', CardTag.Dodge))

    const damage = new GameEvent({
      name: 'damage',
      source: attacker,
      player: attacker,
      targets: [victim],
    })
    // 响应发生在事件结算过程中，因此用步骤机在 Content 阶段打出闪
    damage.addStep(0, async (e) => {
      await e.trigger('shan', { cards: [shan] })
    })

    await engine.eventDispatcher.dispatch(damage, new EventChain())

    expect(damage.isTerminal).toBe(true)
    // Phase 10：防止伤害统一表达为 cancel —— 它会跳过 Content 之后的
    // 全部阶段，因此 damageEnd / damageAfter 的技能不会被误触发
    expect(damage.cancelled).toBe(true)
  })
})

// ── 锦囊（7.2 – 7.4）──

describe('锦囊牌', () => {
  it('【无中生有】摸 2 张', async () => {
    const player = players()[0]!
    const card = giveCard(
      player,
      cardDef('wuZhongShengYou', [CardTag.SomethingFromNothing, CardTag.Draw]),
    )
    const before = player.handCards.length

    await engine.useCard(player, card, [])

    // 打出 -1，摸 +2
    expect(player.handCards.length).toBe(before + 1)
  })

  it('【过河拆桥】弃置目标区域一张牌', async () => {
    const [user, victim] = players()
    const target = giveCard(victim, cardDef('sha', CardTag.Strike))
    const card = giveCard(user, cardDef('guoHeChaiQiao', CardTag.Dismantle))
    decisions.script(user, '选择要弃置的牌', target)

    await engine.useCard(user, card, [victim])

    expect(target.zone).toBe(ZoneType.Discard)
    expect(victim.handCards.some((c) => c.instanceId === target.instanceId)).toBe(false)
  })

  it('【顺手牵羊】把目标的牌拿到自己手上', async () => {
    const [user, victim] = players()
    const target = giveCard(victim, cardDef('sha', CardTag.Strike))
    const card = giveCard(user, cardDef('shunShouQianYang', CardTag.Snatch))
    decisions.script(user, '选择要获得的牌', target)

    await engine.useCard(user, card, [victim])

    expect(user.handCards.some((c) => c.instanceId === target.instanceId)).toBe(true)
    expect(victim.handCards.some((c) => c.instanceId === target.instanceId)).toBe(false)
  })

  it('【南蛮入侵】按座次询问，不出杀者受到 1 点伤害', async () => {
    const user = players()[0]!
    const card = giveCard(user, cardDef('nanManRuQin', [CardTag.BarbarianRaid, CardTag.Aoe]))

    // 让 2 号位出杀，其余放弃
    const responder = players()[1]!
    const strike = giveCard(responder, cardDef('sha', CardTag.Strike))
    decisions.script(responder, '南蛮入侵', strike)

    const before = players().map((p) => p.hp)
    await engine.useCard(user, card, [])

    expect(players()[1]!.hp).toBe(before[1]) // 出了杀
    expect(players()[2]!.hp).toBe(before[2]! - 1) // 没出
    expect(players()[3]!.hp).toBe(before[3]! - 1)
    expect(players()[0]!.hp).toBe(before[0]) // 使用者不受影响
  })

  it('【万箭齐发】按座次询问，不出闪者受到 1 点伤害', async () => {
    const user = players()[0]!
    const card = giveCard(user, cardDef('wanJianQiFa', [CardTag.ArrowBarrage, CardTag.Aoe]))
    const before = players().map((p) => p.hp)

    await engine.useCard(user, card, [])

    expect(players()[2]!.hp).toBe(before[2]! - 1)
    expect(players()[0]!.hp).toBe(before[0])
  })

  it('【决斗】目标先出杀；不出者受到 1 点伤害', async () => {
    const [user, victim] = players()
    const card = giveCard(user, cardDef('jueDou', CardTag.Duel))

    const beforeVictim = victim.hp
    const beforeUser = user.hp
    await engine.useCard(user, card, [victim])

    // 双方都不出杀 → 目标先顶不住
    expect(victim.hp).toBe(beforeVictim - 1)
    expect(user.hp).toBe(beforeUser)
  })

  it('【决斗】目标出得起杀 → 反过来问使用者', async () => {
    const [user, victim] = players()
    const card = giveCard(user, cardDef('jueDou', CardTag.Duel))
    const strike = giveCard(victim, cardDef('sha', CardTag.Strike))
    decisions.script(victim, '决斗', strike)

    const beforeUser = user.hp
    await engine.useCard(user, card, [victim])

    expect(user.hp).toBe(beforeUser - 1)
  })

  it('【桃园结义】所有存活角色各回复 1 点', async () => {
    const user = players()[0]!
    for (const p of players()) p.hp = Math.max(1, p.maxHp - 2)
    const before = players().map((p) => p.hp)
    const card = giveCard(
      user,
      cardDef('taoYuanJieYi', [CardTag.PeachGardenOath, CardTag.Heal, CardTag.Aoe]),
    )

    await engine.useCard(user, card, [])

    players().forEach((p, i) => {
      expect(p.hp).toBe(before[i]! + 1)
    })
  })

  it('【五谷丰登】亮出牌并按座次分完，没人要的进弃牌堆', async () => {
    const user = players()[0]!
    const card = giveCard(
      user,
      cardDef('wuGuFengDeng', [CardTag.BountifulHarvest, CardTag.Draw]),
    )
    const aliveCount = engine.state.alivePlayers.length
    const handBefore = engine.state.alivePlayers.reduce((n, p) => n + p.handCards.length, 0)

    await engine.useCard(user, card, [])

    // 亮出 N 张分给 N 名存活角色，只有五谷丰登自己离开了手牌
    const handAfter = engine.state.alivePlayers.reduce((n, p) => n + p.handCards.length, 0)
    expect(handAfter).toBe(handBefore + aliveCount - 1)
  })

  it('【借刀杀人】目标不出杀 → 交出武器', async () => {
    const [user, victim, third] = players()
    const weapon = giveCard(victim, cardDef('zhuGeLianNu', CardTag.Weapon, { equipSlot: 'weapon' as never }))
    victim.equipCards.push(weapon)
    victim.handCards = victim.handCards.filter((c) => c.instanceId !== weapon.instanceId)
    weapon.zone = ZoneType.Equip

    const card = giveCard(user, cardDef('jieDaoShaRen', CardTag.BorrowedBlade))
    await engine.useCard(user, card, [victim, third])

    expect(user.handCards.some((c) => c.instanceId === weapon.instanceId)).toBe(true)
  })

  it('【无懈可击】抵消指定事件', async () => {
    const [user, victim] = players()
    const counter = giveCard(user, cardDef('wuXieKeJi', CardTag.Counter))

    // Phase 9 起：事件必须自己声明 cancelable 才能被无懈，
    // 「能不能被抵消」不再只看有没有 counterTarget
    const targetEvent = new GameEvent({
      name: 'guoHeChaiQiao',
      source: victim,
      player: victim,
      targets: [user],
      cancelable: true,
    })

    const counterEvent = new GameEvent({
      name: 'wuXieKeJi',
      source: user,
      player: user,
      cards: [counter],
      data: { counterTarget: targetEvent },
    })
    await engine.eventDispatcher.dispatch(counterEvent, new EventChain())

    expect(targetEvent.cancelled).toBe(true)
  })
})

// ── 装备与延时锦囊（7.5 / 7.6）──

describe('装备与延时锦囊', () => {
  it('【装备】使用后进入装备区而不是弃牌堆', async () => {
    const player = players()[0]!
    const weapon = giveCard(
      player,
      cardDef('zhuGeLianNu', CardTag.Equip, { equipSlot: 'weapon' as never }),
    )

    await engine.useCard(player, weapon, [])

    expect(weapon.zone).toBe(ZoneType.Equip)
    expect(player.equipCards.some((c) => c.instanceId === weapon.instanceId)).toBe(true)
  })

  it('【延时锦囊】使用后进入目标判定区，不立即结算', async () => {
    const [user, victim] = players()
    const delayed = giveCard(
      user,
      cardDef('leBuSiShu', CardTag.Delayed, { isDelayed: true }),
    )
    const beforeHp = victim.hp

    await engine.useCard(user, delayed, [victim])

    expect(delayed.zone).toBe(ZoneType.Judge)
    expect(victim.judgeCards.some((c) => c.instanceId === delayed.instanceId)).toBe(true)
    expect(victim.hp).toBe(beforeHp)
  })

  it('【乐不思蜀】判定非红桃 → 目标跳过出牌阶段', async () => {
    const player = players()[1]!
    const event = new GameEvent({
      name: 'leBuSiShu',
      source: player,
      player,
      targets: [player],
    })

    await engine.eventDispatcher.dispatch(event, new EventChain())

    expect(player.shouldSkipPhases).toContain('phaseUse')
  })
})

// ── 与技能体系的分工 ──

describe('Content 与 Trigger 的分工', () => {
  it('卡牌行为不依赖持有者 —— 谁用都一样', async () => {
    const [a, b] = players()
    const effectIds = new Set<string>()

    // 记录一次用牌过程中，内容是否被触发（而非某个玩家的技能）
    const probe: EventContent = (ctx) => {
      ctx.event.result['probedBy'] = ctx.player.id
      effectIds.add(ctx.player.id)
    }
    engine.contentRegistry.register('probeCard', probe)

    // `SelfOnly`：这是一张只用来观察「内容被谁触发」的探测牌，
    // 不设目标。缺了它就会被当成「要选一个距离 1 的目标」的普通牌。
    const cardForA = giveCard(a, cardDef('probeCard', [CardTag.Basic, CardTag.SelfOnly]))
    await engine.useCard(a, cardForA, [])
    const cardForB = giveCard(b, cardDef('probeCard', [CardTag.Basic, CardTag.SelfOnly]))
    await engine.useCard(b, cardForB, [])

    // 同一个内容被两个不同玩家触发 —— 证明它挂在事件上而不是玩家上
    expect(effectIds.size).toBe(2)
  })
})
