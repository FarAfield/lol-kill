// ============================================================
// D11 / D12 —— 死亡事件与奖惩的接线
//
// 两处的症状是一样的：账记了，没人看。
//
//   D11 `die` 事件名在册（`event-name.ts` 的 EVENT_SUBJECTS），
//       但全仓没有一处 emit 它 —— 「某人死亡时」这个时机
//       在无名杀里是最常用的挂钩点之一，这里等于不存在。
//   D12 `DeathSystem.handleReward` 把奖惩张数写进 `rewardDraw` 标记，
//       然后就没有然后了：没人读这个标记，也没人摸牌。
//
// 这两条其实是同一条链的两端：奖惩**就是** `die` 的第一条规则。
// 所以这里放在一起验——`die` 发出来了，`rewardDraw` 才有地方被消费。
//
// 用例一律派发真实的 `damage` 事件，走完整的
// damage → dying → settleDying → handleDeath 链，
// 而不是直接调 `handleDeath`：后者能证明函数写对了，
// 证明不了「伤害真的会走到它」。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { GameEvent } from '@core/event'
import { EventCompiler } from '@core/event/event-compiler'
import { RoleType } from '@core/contracts/enums'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { EventName } from '@core/contracts/event-name'
import type { ISkill } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { createTestEnv, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

/** 挂一个只在某事件上记一笔的探针技能 */
function probe(owner: IPlayer, event: EventName, seen: string[]): void {
  const skill: ISkill = {
    id: `probe-${event}`,
    name: '探针',
    description: '',
    priority: 10,
    trigger: { global: [event] },
    content: async () => {
      seen.push(event)
    },
  }
  const handlers: CompiledHandler[] = new EventCompiler().compile(skill, owner)
  for (const h of handlers) {
    env.engine.eventDispatcher.eventTrigger.registerCompiled(h)
  }
}

/** 派发一次真实伤害 */
async function damage(from: IPlayer, to: IPlayer, num: number): Promise<void> {
  await env.engine.eventDispatcher.dispatch(
    new GameEvent({ name: 'damage', source: from, player: from, targets: [to], num }),
    env.engine.eventChain,
  )
}

describe('D11 · `die` 事件真的会被发出', () => {
  it('无人出桃 → 死亡时挂 `die` 的钩子会响', async () => {
    const [a, b] = env.players()
    const seen: string[] = []
    probe(a!, 'die', seen)

    // 一击致命：血量必然归零，且脚本化决策不会出桃
    await damage(a!, b!, 99)

    expect(b!.alive).toBe(false)
    expect(seen).toContain('die')
  })

  it('没死的时候不该发 `die`', async () => {
    const [a, b] = env.players()
    const die: string[] = []
    probe(a!, 'die', die)

    await damage(a!, b!, 1)

    expect(b!.alive).toBe(true)
    expect(die).toHaveLength(0)
  })
})

describe('D12 · `rewardDraw` 有消费方', () => {
  it('击杀飞升者 → 击杀者真的摸牌，标记被清掉', async () => {
    const [a, b] = env.players()
    // 造一个「击杀飞升者」的场景：奖惩规则挂在死者身份上
    b!.role = RoleType.Ascended
    const before = a!.handCards.length

    await damage(a!, b!, 99)

    expect(b!.alive).toBe(false)
    // 奖惩写在标记上 → 被消费成手牌
    expect(a!.handCards.length).toBeGreaterThan(before)
    // 消费完要清零，否则下一次击杀会叠加成一坨
    expect(a!.marks.get('rewardDraw') ?? 0).toBe(0)
  })
})
