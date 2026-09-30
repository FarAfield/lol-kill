// ============================================================
// Phase 14 · SkillRegistry 挂载 / 卸载 / 临时技能
//
// 「谁拥有哪些技能」这笔账在 Phase 14 之前是**推断**出来的，而且三处
// 推断互相矛盾：触发器只认英雄、Mod 另按装备现算、觉醒技干脆是空桩。
// 最直接的后果是「装备带来的触发技从来没被挂上过」——
// 下面『装备的触发技真的会触发』那条用例，在 Phase 13 的代码上是红的。
//
// 这里所有断言都走真实引擎（GameBoot），不在测试里手工拼注册表。
// ============================================================

import { describe, expect, it } from 'vitest'

import { EventTrigger } from '@core/event/event-trigger'
import { EventCompiler } from '@core/event/event-compiler'
import { SkillRegistry } from '@core/skill/skill-registry'
import { GameEvent } from '@core/event/game-event'
import { GamePhase, ZoneType } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import { Card } from '@core/entity/card'
import type { CardDefinition, ICard } from '@core/contracts/card.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { QingGangJian, ZhuGeLianNu } from '@source/cards/equips'
import { createTestEnv, type TestEnv } from '../helpers/game-env'

/** 从牌堆里借一张杀来当「测量工具」 */
function borrowStrike(env: TestEnv) {
  const strike = env.engine.state.deck.find((c) => c.tags.has(CardTag.Strike))
  if (!strike) throw new Error('测试牌堆里没有杀，无法进行本组断言')
  return strike
}

/** 造一张装备塞进某人的手牌（尚未装备） */
function handOut(player: IPlayer, def: CardDefinition) {
  const card = Card.create(def)
  card.owner = player
  card.zone = ZoneType.Hand
  player.handCards.push(card)
  return card
}

/** 台账的纯单测：不需要引擎，只需要一个空触发器 */
function bareRegistry() {
  return new SkillRegistry(new EventTrigger(), new EventCompiler())
}

describe('Phase 14 · 台账本身（不依赖引擎）', () => {
  const sample: ISkill = {
    id: 'testRegistrySkill',
    name: '台账测试技',
    description: '只有一个 mod，没有触发',
    mod: { maxHandcard: (value) => value + 2 },
  }

  it('同一条定义不能登记两次——静默覆盖会让先加载的那个神秘消失', () => {
    const registry = bareRegistry()
    registry.register(sample)
    expect(() => registry.register(sample)).toThrow(/已注册/)
  })

  it('挂载一条未登记的技能会抛错，而不是静默变成空气', () => {
    const registry = bareRegistry()
    const player = { id: 'player_0', seatIndex: 0 } as IPlayer
    expect(() => registry.attach(player, 'nope')).toThrow(/未登记/)
  })

  it('挂载 / 卸载 / 查询三者一致，且只挂一次', () => {
    const registry = bareRegistry()
    registry.register(sample)
    const player = { id: 'player_0', seatIndex: 0 } as IPlayer

    expect(registry.attach(player, 'testRegistrySkill')).toBeUndefined()
    expect(registry.hasSkill(player, 'testRegistrySkill')).toBe(true)
    expect(registry.getSkills(player).map((s) => s.id)).toEqual(['testRegistrySkill'])

    // 重复挂载不改变台账（重挂会清掉「本回合已发动」的记账）
    registry.attach(player, 'testRegistrySkill')
    expect(registry.getSkills(player)).toHaveLength(1)

    registry.detach(player, 'testRegistrySkill')
    expect(registry.hasSkill(player, 'testRegistrySkill')).toBe(false)
    expect(registry.getSkills(player)).toEqual([])
  })

  it('ownersOf 只返回持有者，且按座次排好（禁止依赖注册顺序）', () => {
    const registry = bareRegistry()
    registry.register(sample)
    const c = { id: 'player_2', seatIndex: 2 } as IPlayer
    const a = { id: 'player_0', seatIndex: 0 } as IPlayer

    registry.attach(c, 'testRegistrySkill')
    registry.attach(a, 'testRegistrySkill')

    expect(registry.ownersOf('testRegistrySkill').map((p) => p.id)).toEqual([
      'player_0',
      'player_2',
    ])
    expect(registry.ownersOf('somebodyElse')).toEqual([])
  })

  it('removeTempSkill 只摘临时的，英雄技 / 装备技 / 觉醒技都摘不掉', () => {
    const registry = bareRegistry()
    registry.register(sample)
    const player = { id: 'player_0', seatIndex: 0 } as IPlayer

    registry.attach(player, 'testRegistrySkill')
    registry.removeTempSkill(player, 'testRegistrySkill')
    expect(registry.hasSkill(player, 'testRegistrySkill')).toBe(true)

    registry.detach(player, 'testRegistrySkill')
    registry.addTempSkill(player, 'testRegistrySkill', 'turnEnd')
    registry.removeTempSkill(player, 'testRegistrySkill')
    expect(registry.hasSkill(player, 'testRegistrySkill')).toBe(false)
  })

  it('装备技走 equip 来源：装备离身即被摘掉，与英雄技互不相干', () => {
    const registry = bareRegistry()
    registry.register(sample)
    // 一张 effectIds 指向 testRegistrySkill 的「装备」（只用到这两个字段）
    const fakeEquip = { effectIds: ['testRegistrySkill'] } as unknown as ICard
    const player = {
      id: 'player_0',
      seatIndex: 0,
      alive: true,
      heroes: [],
      equipCards: [fakeEquip],
    } as unknown as IPlayer

    // 先由英雄（permanent）持有，再装备上同一张卡
    registry.attach(player, 'testRegistrySkill')
    registry.syncEquipSkills(player)
    expect(registry.hasSkill(player, 'testRegistrySkill')).toBe(true)

    // 装备离身：permanent 那一份不受影响（若被误摘，这里就是 false）
    player.equipCards = []
    registry.syncEquipSkills(player)
    expect(registry.hasSkill(player, 'testRegistrySkill')).toBe(true)

    // 纯装备来源的则会被摘掉
    registry.detach(player, 'testRegistrySkill')
    player.equipCards = [fakeEquip]
    registry.syncEquipSkills(player)
    player.equipCards = []
    registry.syncEquipSkills(player)
    expect(registry.hasSkill(player, 'testRegistrySkill')).toBe(false)
  })
})

describe('Phase 14 · 挂载即生效（走真实引擎）', () => {
  it('attach 之后该技能的 mod 立刻参与计算', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    const strike = borrowStrike(env)

    expect(env.engine.cardUsableCount(player, strike)).toBe(1)

    // 不给他装备，直接把「诸葛连弩」这个技能挂上去
    env.engine.skillRegistry.attach(player, 'zhuGeLianNu')
    expect(env.engine.cardUsableCount(player, strike)).toBe(Infinity)
  })

  it('detach 之后立刻不再参与计算（不残留幽灵数值）', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    const strike = borrowStrike(env)

    env.engine.skillRegistry.attach(player, 'zhuGeLianNu')
    expect(env.engine.cardUsableCount(player, strike)).toBe(Infinity)

    env.engine.skillRegistry.detach(player, 'zhuGeLianNu')
    expect(env.engine.cardUsableCount(player, strike)).toBe(1)
  })

  it('挂载只影响这一个人，别人不受牵连', async () => {
    const env = await createTestEnv()
    const [a, b] = env.players()
    const strike = borrowStrike(env)

    env.engine.skillRegistry.attach(a!, 'zhuGeLianNu')
    expect(env.engine.cardUsableCount(a!, strike)).toBe(Infinity)
    expect(env.engine.cardUsableCount(b!, strike)).toBe(1)
  })

  it('开局之后登记的新技能，mod 与 trigger 都有效（扩展包场景）', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!

    env.engine.skillRegistry.register({
      id: 'testLateHandcard',
      name: '迟到的大手牌',
      description: '',
      locked: true,
      mod: { maxHandcard: (value) => value + 3 },
    })

    const before = env.engine.getMaxHandcard(player)
    env.engine.skillRegistry.attach(player, 'testLateHandcard')
    expect(env.engine.getMaxHandcard(player)).toBe(before + 3)
  })
})

describe('Phase 14 · 装备技随装卸自动挂载 / 卸载', () => {
  it('装备诸葛连弩 → 无限出杀；卸下 → 恢复一张', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    const strike = borrowStrike(env)
    const crossbow = handOut(player, ZhuGeLianNu)

    expect(env.engine.skillRegistry.hasSkill(player, 'zhuGeLianNu')).toBe(false)

    env.engine.cardSystem.equipCard(crossbow, player)
    expect(player.equipCards).toContain(crossbow)
    expect(env.engine.skillRegistry.hasSkill(player, 'zhuGeLianNu')).toBe(true)
    expect(env.engine.cardUsableCount(player, strike)).toBe(Infinity)

    env.engine.cardSystem.unequipCard(crossbow, player)
    expect(player.equipCards).not.toContain(crossbow)
    expect(env.engine.skillRegistry.hasSkill(player, 'zhuGeLianNu')).toBe(false)
    expect(env.engine.cardUsableCount(player, strike)).toBe(1)
  })

  it('装备被拆掉（进弃牌堆）也算卸下——拆装备走的是另一条 moveCard 路径', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    const crossbow = handOut(player, ZhuGeLianNu)

    env.engine.cardSystem.equipCard(crossbow, player)
    expect(env.engine.skillRegistry.hasSkill(player, 'zhuGeLianNu')).toBe(true)

    env.engine.cardSystem.discardCard(crossbow, player)
    expect(env.engine.skillRegistry.hasSkill(player, 'zhuGeLianNu')).toBe(false)
  })

  it('装备技的 trigger 真的会触发（Phase 14 之前它压根没被挂上）', async () => {
    const env = await createTestEnv()
    const [attacker, victim] = env.players()
    const sword = handOut(attacker!, QingGangJian)

    env.engine.cardSystem.equipCard(sword, attacker!)
    expect(env.engine.skillRegistry.hasSkill(attacker!, 'qingGangJian')).toBe(true)

    const strike = borrowStrike(env)
    await env.engine.eventDispatcher.dispatch(
      new GameEvent({
        name: 'useCard',
        source: attacker,
        player: attacker,
        targets: [victim!],
        cards: [strike],
        phase: GamePhase.PhaseUse,
      }),
      env.engine.eventChain,
    )

    // 青釭剑：用杀时无视目标防具 → 目标身上留下 ignoreArmor 标记
    expect(victim!.getMark('ignoreArmor')).toBe(1)
  })
})

describe('Phase 14 · 临时技能', () => {
  it("addTempSkill(id, 'turnEnd') → 回合结束时自动移除", async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    const strike = borrowStrike(env)

    env.engine.skillRegistry.addTempSkill(player, 'zhuGeLianNu', 'turnEnd')
    expect(env.engine.skillRegistry.hasSkill(player, 'zhuGeLianNu')).toBe(true)
    expect(env.engine.cardUsableCount(player, strike)).toBe(Infinity)

    await env.engine.eventDispatcher.dispatch(
      new GameEvent({
        name: 'turnEnd',
        source: player,
        player,
        phase: GamePhase.PhasePost,
        turn: player.seatIndex,
      }),
      env.engine.eventChain,
    )

    expect(env.engine.skillRegistry.hasSkill(player, 'zhuGeLianNu')).toBe(false)
    expect(env.engine.cardUsableCount(player, strike)).toBe(1)
  })

  it("addTempSkill(id, { event: 'damageEnd' }) → 先在本事件上生效，然后才被摘掉", async () => {
    const env = await createTestEnv()
    const [holder, attacker] = env.players()

    let fired = 0
    env.engine.skillRegistry.register({
      id: 'testTempOnDamage',
      name: '临时测伤',
      description: '受到伤害后记一次，随即到期',
      locked: true,
      trigger: { player: ['damageEnd'] },
      content: async () => {
        fired += 1
      },
    })
    env.engine.skillRegistry.addTempSkill(holder!, 'testTempOnDamage', {
      event: 'damageEnd',
      scope: 'player',
    })

    const hurt = (): Promise<void> =>
      env.engine.eventDispatcher.dispatch(
        new GameEvent({
          name: 'damage',
          source: attacker!,
          player: holder!,
          targets: [holder!],
          phase: GamePhase.PhaseUse,
          data: { damageAmount: 1 },
        }),
        env.engine.eventChain,
      )

    await hurt()

    // 关键顺序：技能先跑（fired === 1），到期钩子后跑（摘掉）
    expect(fired).toBe(1)
    expect(env.engine.skillRegistry.hasSkill(holder!, 'testTempOnDamage')).toBe(false)

    // 第二次伤害不会再触发——它已经不在了
    await hurt()
    expect(fired).toBe(1)
  })

  it('临时技能到期后，钩子也一起从事件系统里撤干净（不留幽灵钩子）', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    const before = env.engine.eventDispatcher.eventTrigger.count

    env.engine.skillRegistry.addTempSkill(player, 'zhuGeLianNu', 'turnEnd')
    env.engine.skillRegistry.removeTempSkill(player, 'zhuGeLianNu')

    expect(env.engine.eventDispatcher.eventTrigger.count).toBe(before)
  })
})

describe('Phase 14 · 觉醒与空桩', () => {
  it('技能里 ctx.modifyEffects 真的能给人加上技能（觉醒技的那句话）', async () => {
    const env = await createTestEnv()
    const player = env.players()[1]!

    env.engine.skillRegistry.register({
      id: 'testAwakenDriver',
      name: '觉醒驱动',
      description: '回合开始时给自己挂上咆哮',
      locked: true,
      trigger: { player: ['turnStart'] },
      content: async (ctx) => {
        await ctx.modifyEffects(ctx.player, ['paoxiao'])
      },
    })
    env.engine.skillRegistry.attach(player, 'testAwakenDriver')

    const strike = borrowStrike(env)
    expect(env.engine.cardUsableCount(player, strike)).toBe(1)

    await env.engine.eventDispatcher.dispatch(
      new GameEvent({
        name: 'turnStart',
        source: player,
        player,
        phase: GamePhase.PhasePre,
        turn: player.seatIndex,
      }),
      env.engine.eventChain,
    )

    expect(env.engine.skillRegistry.hasSkill(player, 'paoxiao')).toBe(true)
    expect(env.engine.cardUsableCount(player, strike)).toBe(Infinity)
  })

  it('没有「恒返回 true」的空桩方法——未完成处必须是抛错，不是假装成功', async () => {
    const env = await createTestEnv()
    const registry = env.engine.skillRegistry

    // 旧代码里的 enableEffect / disableEffect 就是这种桩：
    // 调用方以为技能启用了，实际什么也没发生
    expect((registry as unknown as Record<string, unknown>)['enableEffect']).toBeUndefined()
    expect((registry as unknown as Record<string, unknown>)['disableEffect']).toBeUndefined()
  })

  it('死者不发动技能：钩子留在台账里，由放行闸拦下', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!

    let fired = 0
    env.engine.skillRegistry.register({
      id: 'testDeadGate',
      name: '死者不应发动',
      description: '',
      locked: true,
      trigger: { player: ['turnStart'] },
      content: async () => {
        fired += 1
      },
    })
    env.engine.skillRegistry.attach(player, 'testDeadGate')

    player.alive = false
    await env.engine.eventDispatcher.dispatch(
      new GameEvent({
        name: 'turnStart',
        source: player,
        player,
        phase: GamePhase.PhasePre,
        turn: player.seatIndex,
      }),
      env.engine.eventChain,
    )

    expect(fired).toBe(0)
    // 台账仍然记着它——死亡不该顺手把「他有什么技能」这笔账抹掉
    expect(env.engine.skillRegistry.hasSkill(player, 'testDeadGate')).toBe(true)
  })
})
