// ============================================================
// Phase 17 · 全局钩子 与 when() 一次性监听
//
// 两者都是「在某个时机做一件事」，区别只有一处——**有没有持有者**：
//
// |            | 全局钩子                  | when()                    |
// |------------|--------------------------|---------------------------|
// | 属于谁      | 不属于任何人（局 / 规则）  | 属于某个玩家              |
// | ctx.player  | 取自事件本身              | 恒是那个玩家              |
// | 死亡 / 封技 | 照样触发（它不是技能）     | 不触发                    |
// | 生命周期    | 手动 off()                | 常配 .once() 自动注销     |
//
// 最后两行是这两条用例存在的理由：**写反了就是幽灵钩子**——
// 「任意角色出牌时记一笔」会因为某个人的死而漏记，
// 「下次摸牌后多摸一张」会在人死了之后照发。
// ============================================================

import { describe, expect, it } from 'vitest'

import { GameEvent } from '@core/event/game-event'
import { whenOf } from '@core/event/when'
import { GamePhase } from '@core/contracts/enums'
import type { ISkillContext } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { createTestEnv, type TestEnv } from '../helpers/game-env'

/** 一次「谁在出牌」的事件（不引伤害，只当触发源） */
function drawEnd(env: TestEnv, player: IPlayer): Promise<void> {
  return env.engine.eventDispatcher.dispatch(
    new GameEvent({
      name: 'drawEnd',
      source: player,
      player,
      phase: GamePhase.PhaseDraw,
      round: env.engine.state.currentRound,
      turn: player.seatIndex,
    }),
    env.engine.eventChain,
  )
}

function useCard(env: TestEnv, player: IPlayer, target: IPlayer): Promise<void> {
  return env.engine.eventDispatcher.dispatch(
    new GameEvent({
      name: 'useCard',
      source: player,
      player,
      targets: [target],
      phase: GamePhase.PhaseUse,
      round: env.engine.state.currentRound,
      turn: player.seatIndex,
    }),
    env.engine.eventChain,
  )
}

// ═══════════════════════════════════════════
// 全局钩子
// ═══════════════════════════════════════════

describe('Phase 17 · 全局钩子', () => {
  it("on('useCard') → 任意角色出牌都会触发", async () => {
    const env = await createTestEnv()
    const [a, b, c] = env.players()
    const seen: string[] = []

    env.engine.globalHooks.on('useCard', (ctx) => {
      seen.push(ctx.player.id)
    })

    await useCard(env, a!, b!)
    await useCard(env, b!, c!)

    // 关键：钩子**不属于任何人**，两个人出牌它都记到了
    expect(seen).toEqual([a!.id, b!.id])
  })

  it('off() 之后不再触发', async () => {
    const env = await createTestEnv()
    const [a, b] = env.players()
    let fired = 0

    const hook = env.engine.globalHooks.on('useCard', () => {
      fired += 1
    })

    await useCard(env, a!, b!)
    expect(fired).toBe(1)

    hook.off()
    await useCard(env, a!, b!)
    expect(fired).toBe(1)

    // 重复 off 无害
    expect(() => hook.off()).not.toThrow()
    expect(env.engine.globalHooks.count).toBe(0)
  })

  it('off(id) 按编号注销；不存在的编号返回 false', async () => {
    const env = await createTestEnv()
    const hook = env.engine.globalHooks.on('drawEnd', () => {})

    expect(env.engine.globalHooks.ids).toContain(hook.id)
    expect(env.engine.globalHooks.off(hook.id)).toBe(true)
    expect(env.engine.globalHooks.off(hook.id)).toBe(false)
    expect(env.engine.globalHooks.off('__hook:9999')).toBe(false)
  })

  it('clear() 只清全局钩子，技能钩子一根不动', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!

    let skillFired = 0
    env.engine.skillRegistry.register({
      id: 'testHookNeighbour',
      name: '邻居技能',
      description: '',
      locked: true,
      trigger: { player: ['drawEnd'] },
      content: async () => {
        skillFired += 1
      },
    })
    env.engine.skillRegistry.attach(player, 'testHookNeighbour')

    let hookFired = 0
    env.engine.globalHooks.on('drawEnd', () => {
      hookFired += 1
    })

    await drawEnd(env, player)
    expect(hookFired).toBe(1)
    expect(skillFired).toBe(1)

    env.engine.globalHooks.clear()
    await drawEnd(env, player)
    expect(hookFired).toBe(1) // 钩子没了
    expect(skillFired).toBe(2) // 技能还在
  })

  it('持有者死亡不影响全局钩子——它不属于任何人', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    let fired = 0

    env.engine.globalHooks.on('drawEnd', () => {
      fired += 1
    })
    // 同一个玩家身上的 when() 监听作为对照
    let whenFired = 0
    whenOf(player, 'drawEnd', env.engine.eventDispatcher.eventTrigger)
      .then(() => {
        whenFired += 1
      })
      .finish()

    player.alive = false
    await drawEnd(env, player)

    expect(fired).toBe(1)
    expect(whenFired).toBe(0)
  })

  it('重开一局（台账 clear）不会把全局钩子一起抹掉', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    let fired = 0

    env.engine.globalHooks.on('drawEnd', () => {
      fired += 1
    })
    env.engine.skillRegistry.attach(player, 'zhuGeLianNu')

    env.engine.skillRegistry.clear()
    expect(env.engine.skillRegistry.hasSkill(player, 'zhuGeLianNu')).toBe(false)

    await drawEnd(env, player)
    expect(fired).toBe(1)
  })
})

// ═══════════════════════════════════════════
// when()
// ═══════════════════════════════════════════

describe('Phase 17 · when() 一次性监听', () => {
  it('.once() → 触发一次后自动注销', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    let fired = 0

    const handle = whenOf(player, 'drawEnd', env.engine.eventDispatcher.eventTrigger)
      .once()
      .then(() => {
        fired += 1
      })
      .finish()

    await drawEnd(env, player)
    await drawEnd(env, player)

    expect(fired).toBe(1)
    expect(handle.fired).toBe(1)
  })

  it('filter 不满足时不触发，也不消耗 once 的那一次', async () => {
    const env = await createTestEnv()
    const [a, b] = env.players()
    let fired = 0

    whenOf(a!, 'drawEnd', env.engine.eventDispatcher.eventTrigger)
      .filter((event) => event.player === a)
      .once()
      .then(() => {
        fired += 1
      })
      .finish()

    // 别人的摸牌：filter 挡下，次数不该被吃掉
    await drawEnd(env, b!)
    expect(fired).toBe(0)

    await drawEnd(env, a!)
    expect(fired).toBe(1)

    // once 已经用完
    await drawEnd(env, a!)
    expect(fired).toBe(1)
  })

  it('then 里拿到的 ctx 是能干活的（真的摸到了牌）', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    const before = player.handCards.length

    whenOf(player, 'drawEnd', env.engine.eventDispatcher.eventTrigger)
      .once()
      .then(async (ctx) => {
        await ctx.drawCards(2)
      })
      .finish()

    await drawEnd(env, player)
    expect(player.handCards.length).toBe(before + 2)
  })

  it('.finish() 之前什么都不生效——半句没写完的监听不该自己跑', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    let fired = 0

    whenOf(player, 'drawEnd', env.engine.eventDispatcher.eventTrigger).then(() => {
      fired += 1
    })

    await drawEnd(env, player)
    expect(fired).toBe(0)
  })

  it('handle.off() 可以提前摘掉它', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    let fired = 0

    const handle = whenOf(player, 'drawEnd', env.engine.eventDispatcher.eventTrigger)
      .then(() => {
        fired += 1
      })
      .finish()

    handle.off()
    await drawEnd(env, player)
    expect(fired).toBe(0)
  })

  it('监听归属于玩家：他死了就不再触发', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    let fired = 0

    whenOf(player, 'drawEnd', env.engine.eventDispatcher.eventTrigger)
      .then(() => {
        fired += 1
      })
      .finish()

    player.alive = false
    await drawEnd(env, player)
    expect(fired).toBe(0)
  })

  it('内容里写的 ctx.when(...) 与手工构造的是同一条监听', async () => {
    const env = await createTestEnv()
    const player = env.players()[0]!
    let fired = 0

    // 技能内容里挂监听：这是它真正的用法
    env.engine.skillRegistry.register({
      id: 'testWhenHost',
      name: '挂监听的技能',
      description: '',
      locked: true,
      trigger: { player: ['phaseUseBegin'] },
      content: async (ctx: ISkillContext) => {
        ctx
          .when('drawEnd')
          .filter((event) => event.player === ctx.player)
          .once()
          .then(() => {
            fired += 1
          })
          .finish()
      },
    })
    env.engine.skillRegistry.attach(player, 'testWhenHost')

    await env.engine.eventDispatcher.dispatch(
      new GameEvent({
        name: 'phaseUseBegin',
        source: player,
        player,
        phase: GamePhase.PhaseUse,
      }),
      env.engine.eventChain,
    )
    expect(fired).toBe(0) // 只是挂上了，还没到 drawEnd

    await drawEnd(env, player)
    expect(fired).toBe(1)

    await drawEnd(env, player)
    expect(fired).toBe(1) // once
  })
})
