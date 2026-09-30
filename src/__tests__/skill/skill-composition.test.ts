// ============================================================
// Phase 17 · 技能组合：`group` / `subSkill`
//
// 两件事，方向相反：
//
//   group    —— 「持有主技能 = 持有全组」，主技能一挂全组都来，一摘全组都走
//   subSkill —— 子技能是**独立定义**，主技能挂上去它也不来，要用自己挂
//
// 它们看着像一对，实则解决两个不同的问题：group 表达「一个技能的几半
// 分开写」，subSkill 表达「一个技能可以只给别人一半」。把它们做成同一
// 件事，后者就没法表达了。
//
// 台账之外的地方（触发器 / Mod）不该再推断一次持有关系，
// 因此这里的断言一半走引擎：挂上之后**真的会触发**。
// ============================================================

import { describe, expect, it } from 'vitest'

import { EventTrigger } from '@core/event/event-trigger'
import { EventCompiler } from '@core/event/event-compiler'
import { SkillRegistry } from '@core/skill/skill-registry'
import { GameEvent } from '@core/event/game-event'
import { GamePhase } from '@core/contracts/enums'
import type { ISkill } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { createTestEnv } from '../helpers/game-env'

/** 台账的纯单测：不需要引擎 */
function bareRegistry() {
  return new SkillRegistry(new EventTrigger(), new EventCompiler())
}

function fakePlayer(id: string): IPlayer {
  return { id, seatIndex: 0 } as IPlayer
}

// ═══════════════════════════════════════════
// group
// ═══════════════════════════════════════════

describe('Phase 17 · group：持有主技能 = 持有全组', () => {
  it('挂载主技能后，组内每条都进台账', () => {
    const registry = bareRegistry()
    registry.register({ id: 'a', name: 'a', description: '' })
    registry.register({ id: 'b', name: 'b', description: '' })
    registry.register({ id: 'main', name: '主', description: '', group: ['a', 'b'] })

    const player = fakePlayer('player_0')
    registry.attach(player, 'main')

    expect(registry.hasSkill(player, 'a')).toBe(true)
    expect(registry.hasSkill(player, 'b')).toBe(true)
    expect(registry.getSkills(player).map((s) => s.id)).toEqual(['main', 'a', 'b'])
  })

  it('摘掉主技能，组内跟着一起走——失去技能却还生效的幽灵最伤人', () => {
    const registry = bareRegistry()
    registry.register({ id: 'a', name: 'a', description: '' })
    registry.register({ id: 'main', name: '主', description: '', group: ['a'] })

    const player = fakePlayer('player_0')
    registry.attach(player, 'main')
    registry.detach(player, 'main')

    expect(registry.hasSkill(player, 'main')).toBe(false)
    expect(registry.hasSkill(player, 'a')).toBe(false)
    expect(registry.getSkills(player)).toEqual([])
  })

  it('组内技能若另有来路（自己挂着 / 英雄自带），主技能走了它还在', () => {
    const registry = bareRegistry()
    registry.register({ id: 'a', name: 'a', description: '' })
    registry.register({ id: 'main', name: '主', description: '', group: ['a'] })

    const player = fakePlayer('player_0')
    registry.attach(player, 'a') // 先自己挂上
    registry.attach(player, 'main')
    registry.detach(player, 'main')

    // 它是自己挂的，不是主技能带出来的——不该被顺手摘掉
    expect(registry.hasSkill(player, 'a')).toBe(true)
  })

  it('组里还能有组（递归展开）', () => {
    const registry = bareRegistry()
    registry.register({ id: 'c', name: 'c', description: '' })
    registry.register({ id: 'b', name: 'b', description: '', group: ['c'] })
    registry.register({ id: 'main', name: '主', description: '', group: ['b'] })

    const player = fakePlayer('player_0')
    registry.attach(player, 'main')

    expect(registry.getSkills(player).map((s) => s.id)).toEqual(['main', 'b', 'c'])

    // 摘最外层 → 整条链都走
    registry.detach(player, 'main')
    expect(registry.getSkills(player)).toEqual([])
  })

  it('互相引用的组不会把栈跑爆', () => {
    const registry = bareRegistry()
    registry.register({ id: 'x', name: 'x', description: '', group: ['y'] })
    registry.register({ id: 'y', name: 'y', description: '', group: ['x'] })

    const player = fakePlayer('player_0')
    expect(() => registry.attach(player, 'x')).not.toThrow()
    expect(registry.getSkills(player).map((s) => s.id).sort()).toEqual(['x', 'y'])
  })

  it('组内技能真的会触发（走真实引擎，不只看台账）', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    let fired = 0

    env.engine.skillRegistry.register({
      id: 'testGroupMember',
      name: '组内技能',
      description: '',
      locked: true,
      trigger: { player: ['drawEnd'] },
      content: async () => {
        fired += 1
      },
    })
    env.engine.skillRegistry.register({
      id: 'testGroupMain',
      name: '主技能',
      description: '',
      group: ['testGroupMember'],
    })

    // 只挂主技能，触发的却应该是组内那条
    env.engine.skillRegistry.attach(player, 'testGroupMain')
    await env.engine.eventDispatcher.dispatch(
      new GameEvent({
        name: 'drawEnd',
        source: player,
        player,
        phase: GamePhase.PhaseDraw,
      }),
      env.engine.eventChain,
    )

    expect(fired).toBe(1)

    // 摘掉主技能 → 组内那条也不再触发（不是「台账没了钩子还在」）
    env.engine.skillRegistry.detach(player, 'testGroupMain')
    await env.engine.eventDispatcher.dispatch(
      new GameEvent({
        name: 'drawEnd',
        source: player,
        player,
        phase: GamePhase.PhaseDraw,
      }),
      env.engine.eventChain,
    )
    expect(fired).toBe(1)
  })

  it('临时主技能到期时，组内技能跟着一起到期', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!

    env.engine.skillRegistry.register({
      id: 'testTempGroupMember',
      name: '临时的组内技能',
      description: '',
      trigger: { player: ['drawEnd'] },
    })
    env.engine.skillRegistry.register({
      id: 'testTempGroupMain',
      name: '临时的主技能',
      description: '',
      group: ['testTempGroupMember'],
    })

    env.engine.skillRegistry.addTempSkill(player, 'testTempGroupMain', 'turnEnd')
    expect(env.engine.skillRegistry.hasSkill(player, 'testTempGroupMember')).toBe(true)

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

    expect(env.engine.skillRegistry.hasSkill(player, 'testTempGroupMain')).toBe(false)
    expect(env.engine.skillRegistry.hasSkill(player, 'testTempGroupMember')).toBe(false)
  })

  /** 一个带着 `main` 这件装备的玩家（只用到 syncEquipSkills 需要的字段） */
  function equipedPlayer(): { player: IPlayer; unequip: () => void } {
    const fakeEquip = { effectIds: ['testEquipGroupMain'] } as never
    const player = {
      id: 'player_0',
      seatIndex: 0,
      alive: true,
      heroes: [],
      equipCards: [fakeEquip],
    } as unknown as IPlayer
    return { player, unequip: () => void (player.equipCards = []) }
  }

  it('装备带出来的主技能被卸下时，组内跟着一起走', () => {
    const registry = bareRegistry()
    registry.register({ id: 'testEquipGroupA', name: 'a', description: '' })
    registry.register({
      id: 'testEquipGroupMain',
      name: '主',
      description: '',
      equipSkill: true,
      group: ['testEquipGroupA'],
    })

    const { player, unequip } = equipedPlayer()
    registry.syncEquipSkills(player)
    expect(registry.hasSkill(player, 'testEquipGroupA')).toBe(true)

    unequip()
    registry.syncEquipSkills(player)
    expect(registry.hasSkill(player, 'testEquipGroupMain')).toBe(false)
    expect(registry.hasSkill(player, 'testEquipGroupA')).toBe(false)
  })

  it('主技能另有来路（英雄自带）时，组内那份不被装备对齐单独摘掉', () => {
    const registry = bareRegistry()
    registry.register({ id: 'testEquipGroupA', name: 'a', description: '' })
    registry.register({
      id: 'testEquipGroupMain',
      name: '主',
      description: '',
      equipSkill: true,
      group: ['testEquipGroupA'],
    })

    const { player, unequip } = equipedPlayer()
    // 英雄先自带主技能 → 组内技能由它带出来（permanent）
    registry.attach(player, 'testEquipGroupMain')
    registry.syncEquipSkills(player)

    // 卸下那件装备：主技能是英雄的，摘不掉；组内那份归主技能管，
    // 也不该被「装备区里没有它」这条规则单独摘掉
    unequip()
    registry.syncEquipSkills(player)
    expect(registry.hasSkill(player, 'testEquipGroupMain')).toBe(true)
    expect(registry.hasSkill(player, 'testEquipGroupA')).toBe(true)
  })
})

// ═══════════════════════════════════════════
// subSkill
// ═══════════════════════════════════════════

describe('Phase 17 · subSkill：独立定义，不随主技能挂载', () => {
  const parent: ISkill = {
    id: 'testParent',
    name: '父技能',
    description: '',
    priority: 7,
    trigger: { player: ['drawEnd'] },
    mod: { maxHandcard: (value) => value + 3 },
    subSkill: {
      give: {
        description: '给出一张牌',
        mod: { maxHandcard: (value) => value + 5 },
      },
      take: {},
    },
  }

  it('子技能登记成独立定义，id 是 <主技能>_<子技能>', () => {
    const registry = bareRegistry()
    registry.register(parent)

    expect(registry.get('testParent_give')?.name).toBe('父技能·give')
    // 没写的继承父技能
    expect(registry.get('testParent_take')?.priority).toBe(7)
    // 写了的覆盖
    expect(registry.get('testParent_give')?.mod).toBeDefined()
  })

  it('两个父技能的同名子技能不撞车', () => {
    const registry = bareRegistry()
    registry.register({ ...parent, id: 'p1' })
    registry.register({ ...parent, id: 'p2' })

    expect(registry.get('p1_give')).toBeDefined()
    expect(registry.get('p2_give')).toBeDefined()
    expect(() => registry.register({ ...parent, id: 'p1' })).toThrow(/已注册/)
  })

  it('挂主技能不会自动挂上子技能', () => {
    const registry = bareRegistry()
    registry.register(parent)
    const player = fakePlayer('player_0')

    registry.attach(player, 'testParent')
    expect(registry.hasSkill(player, 'testParent')).toBe(true)
    expect(registry.hasSkill(player, 'testParent_give')).toBe(false)
    expect(registry.hasSkill(player, 'testParent_take')).toBe(false)
  })

  it('子技能可以单独挂载（含 addTempSkill），且立刻生效', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!

    env.engine.skillRegistry.register({
      id: 'testSubParent',
      name: '父',
      description: '',
      mod: { maxHandcard: (value) => value + 3 },
      subSkill: { give: { mod: { maxHandcard: (value) => value + 5 } } },
    })

    const base = env.engine.getMaxHandcard(player)
    env.engine.skillRegistry.attach(player, 'testSubParent')
    // 父的 mod 生效，子的没有——子技能不随父技能挂载
    expect(env.engine.getMaxHandcard(player)).toBe(base + 3)

    env.engine.skillRegistry.attach(player, 'testSubParent_give')
    expect(env.engine.getMaxHandcard(player)).toBe(base + 3 + 5)

    // 临时挂载同样成立
    env.engine.skillRegistry.detach(player, 'testSubParent_give')
    env.engine.skillRegistry.addTempSkill(player, 'testSubParent_give', 'turnEnd')
    expect(env.engine.getMaxHandcard(player)).toBe(base + 3 + 5)
  })

  it('子技能自己的 trigger 会触发（挂着才算）', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    let fired = 0

    env.engine.skillRegistry.register({
      id: 'testSubTriggerParent',
      name: '父',
      description: '',
      subSkill: {
        watch: {
          trigger: { player: ['drawEnd'] },
          content: async () => {
            fired += 1
          },
        },
      },
    })

    const drawEnd = (): Promise<void> =>
      env.engine.eventDispatcher.dispatch(
        new GameEvent({
          name: 'drawEnd',
          source: player,
          player,
          phase: GamePhase.PhaseDraw,
        }),
        env.engine.eventChain,
      )

    // 只挂父技能：父技能自己没有 content，什么都不该发生
    env.engine.skillRegistry.attach(player, 'testSubTriggerParent')
    await drawEnd()
    expect(fired).toBe(0)

    env.engine.skillRegistry.attach(player, 'testSubTriggerParent_watch')
    await drawEnd()
    expect(fired).toBe(1)
  })

  it('父技能自己的 trigger / mod 不因子技能的存在而丢失', () => {
    const registry = bareRegistry()
    registry.register(parent)

    // 父技能仍是一条完整的定义（子技能摊平出去，不是取代父技能）
    expect(registry.get('testParent')?.trigger?.player).toEqual(['drawEnd'])
    expect(registry.get('testParent')?.subSkill).toBeUndefined()
  })
})
