// ============================================================
// Phase 23 —— 濒死、死亡与奖惩（D11 / D12 / D13 / D14）
//
// 四条债里有两条的症状是一样的：账记了，没人看。
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
// 另两条是 Phase 23 剩下的：
//   D13 主公误杀忠臣 → 弃置所有牌（未实现）
//   D14 濒死 → 有人出桃 → 存活且 hp = 1（机制在，没有断言）
//
// 用例一律派发真实的 `damage` 事件，走完整的
// damage → dying → settleDying → handleDeath 链，
// 而不是直接调 `handleDeath`：后者能证明函数写对了，
// 证明不了「伤害真的会走到它」。
//
// **测试里的牌必须是真的牌**（欠账 D32）：桃用 `Tao`、武器用 `ZhuGeLianNu`，
// 不在测试里手搓 tag 集合——tag 一错，牌就落进另一条分支，
// 而你看到的失败信息会指向完全不相干的地方。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { GameEvent } from '@core/event'
import { EventCompiler } from '@core/event/event-compiler'
import { RoleType } from '@core/contracts/enums'
import { Tao } from '@source/cards/basic'
import { ZhuGeLianNu } from '@source/cards/equips'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { EventName } from '@core/contracts/event-name'
import type { ICard } from '@core/contracts/card.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { createTestEnv, giveCard, type TestEnv } from '../helpers/game-env'

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

// ── D14 · 濒死求桃的**成功**路径 ──
//
// 失败的那一头（无人出桃 → 死亡）早就验过了（`damage-pipeline.test.ts:297`）。
// 缺的正是这一头：有人出桃 → 存活且 hp = 1。机制一直在跑，没有断言盯着它，
// 于是「救活了但 hp 是 0 / 是 3 / 人还是死了」这类回归根本不会红。

describe('D14 · 濒死 → 有人出桃 → 存活', () => {
  /**
   * 用一个「谁都不该被奖惩牵连」的击杀组合：反贼杀内奸。
   *
   * 主公杀忠臣会触发 D13 的惩罚弃牌、杀反贼会触发 D12 的摸牌奖惩——
   * 那两笔账混进来，这里断言的「桃有没有生效」就说不清了。
   */
  function bystanderKill(): { attacker: IPlayer; victim: IPlayer; saver: IPlayer } {
    const players = env.players()
    return { attacker: players[2]!, victim: players[4]!, saver: players[2]! }
  }

  it('他人出桃 → 濒死者存活且 hp = 1', async () => {
    const { attacker, victim, saver } = bystanderKill()
    const peach = giveCard(saver, Tao)
    env.decisions.script(saver, '濒死', peach)

    await damage(attacker, victim, 99)

    expect(victim.alive).toBe(true)
    // 濒死时 hp ≤ 0（溢出伤害能把它打到负数），救回来必然是 1，不是「回复 1 点」
    expect(victim.hp).toBe(1)
  })

  it('桃真的被打出去了 —— 离手且进了弃牌堆', async () => {
    const { attacker, victim, saver } = bystanderKill()
    const peach = giveCard(saver, Tao)
    env.decisions.script(saver, '濒死', peach)

    await damage(attacker, victim, 99)

    expect(saver.handCards.some((c) => c.instanceId === peach.instanceId)).toBe(false)
    expect(
      env.engine.state.discardPile.some((c) => c.instanceId === peach.instanceId),
    ).toBe(true)
    // 也不该卡在处理区
    expect(env.engine.state.processingCards.some((c) => c.instanceId === peach.instanceId)).toBe(
      false,
    )
  })

  it('自救也算 —— 轮到自己时自己手里的桃能用', async () => {
    const { attacker, victim } = bystanderKill()
    const peach = giveCard(victim, Tao)
    env.decisions.script(victim, '濒死', peach)

    await damage(attacker, victim, 99)

    expect(victim.alive).toBe(true)
    expect(victim.hp).toBe(1)
  })

  it('被救活就不该发 `die`', async () => {
    const { attacker, victim, saver } = bystanderKill()
    giveCard(saver, Tao)
    env.decisions.script(saver, '濒死', saver.handCards[saver.handCards.length - 1]!)

    const seen: string[] = []
    probe(attacker, 'die', seen)

    await damage(attacker, victim, 99)

    expect(victim.alive).toBe(true)
    expect(seen).toHaveLength(0)
  })

  it('濒死但没到 0 血 —— 根本不会进入求桃', async () => {
    const { attacker, victim } = bystanderKill()
    const asked = env.decisions.askCount(victim, '濒死')

    await damage(attacker, victim, 1)

    expect(victim.alive).toBe(true)
    expect(env.decisions.askCount(victim, '濒死')).toBe(asked)
  })
})

// ── D13 · 主公误杀忠臣 → 主公弃置所有牌 ──

describe('D13 · 主公误杀忠臣的惩罚', () => {
  /**
   * 测试局的身份（`IdentityRandomService` 原序）：
   * 0 主公 / 1 忠臣 / 2、3 反贼 / 4 内奸。
   */
  it('主公杀死忠臣 → 主公的手牌与装备全部弃置', async () => {
    const lord = env.players()[0]!
    const guardian = env.players()[1]!

    expect(lord.role).toBe(RoleType.Aspect)
    expect(guardian.role).toBe(RoleType.Guardian)

    const weapon = giveCard(lord, ZhuGeLianNu)
    env.engine.cardSystem.equipCard(weapon, lord)
    const held: ICard[] = [...lord.handCards, ...lord.equipCards]
    expect(held.length).toBeGreaterThan(0)

    await damage(lord, guardian, 99)

    expect(guardian.alive).toBe(false)
    expect(lord.handCards).toHaveLength(0)
    expect(lord.equipCards).toHaveLength(0)

    // 不是「凭空消失」——牌要真的进了弃牌堆
    const discard = env.engine.state.discardPile.map((c) => c.instanceId)
    for (const card of held) {
      expect(discard).toContain(card.instanceId)
    }

    // 惩罚标记消费完要清零
    expect(lord.marks.get('penaltyDiscardAll') ?? 0).toBe(0)
  })

  it('对照：反贼杀死忠臣 → 不惩罚', async () => {
    const rebel = env.players()[2]!
    const guardian = env.players()[1]!
    const before = rebel.handCards.length

    await damage(rebel, guardian, 99)

    expect(guardian.alive).toBe(false)
    // 反贼杀忠臣既不是奖惩也不是惩罚，手牌原封不动
    expect(rebel.handCards.length).toBe(before)
    expect(rebel.marks.get('penaltyDiscardAll') ?? 0).toBe(0)
  })

  it('对照：主公杀死反贼 → 拿奖惩而不是惩罚', async () => {
    const lord = env.players()[0]!
    const rebel = env.players()[2]!
    const before = lord.handCards.length

    await damage(lord, rebel, 99)

    expect(rebel.alive).toBe(false)
    // 奖惩是摸牌，所以手牌只会变多
    expect(lord.handCards.length).toBeGreaterThan(before)
    expect(lord.marks.get('penaltyDiscardAll') ?? 0).toBe(0)
  })
})

// ═══════════════════════════════════════════
// D30 · 「全员死亡」只有一个答案
//
// 这条兜底原先由游戏循环自己数存活人数，而 `DeathSystem` 上那个
// 同义方法零调用方 ——「什么叫没人了」因此有两处各写一遍。
// 现在循环统一问 `DeathSystem`。
// ═══════════════════════════════════════════

describe('D30 · 全员死亡的判定收口到 DeathSystem', () => {
  it('全员存活 / 部分阵亡 / 全员阵亡三种局面判得清', () => {
    const all = env.players()
    const kill = (p: IPlayer): void => env.engine.playerSystem.setAlive(p, false)

    expect(all.length).toBeGreaterThan(1)
    expect(env.engine.deathSystem.checkAllDead()).toBe(false)

    kill(all[0]!)
    expect(env.engine.deathSystem.checkAllDead()).toBe(false)

    for (const p of all) kill(p)
    expect(env.engine.deathSystem.checkAllDead()).toBe(true)
  })

  it('全员阵亡 → 循环结束而不是原地空转', async () => {
    for (const p of env.players()) env.engine.playerSystem.setAlive(p, false)

    const result = await env.engine.runGameLoop()
    expect(result.survivingPlayers).toHaveLength(0)
    // 全员阵亡时胜负规则（`WinCondition` 场景一）会先给出结论，
    // 这里只钉住「循环一定收得了尾」——兜底分支防的是 `continue` 死循环。
    expect(result.reason).toBeTruthy()
  })

  it('胜负规则给不出结论时，兜底分支自己收尾', async () => {
    // `WinCondition` 会在兜底之前先被问到（轮次结束就查一次），
    // 所以想单独验这条兜底，得先把胜负规则摘掉。
    const engine = env.engine as unknown as { checkGameOver: () => unknown }
    const original = env.engine.checkGameOver
    engine.checkGameOver = () => null
    try {
      for (const p of env.players()) env.engine.playerSystem.setAlive(p, false)
      const result = await env.engine.runGameLoop()
      expect(result.reason).toBe('所有玩家已死亡')
      expect(result.winner).toBeNull()
    } finally {
      engine.checkGameOver = original
    }
  })

  it('源码级：循环里不再自己数存活人数 —— 只问 DeathSystem', () => {
    const src = readFileSync(join(process.cwd(), 'src/core/engine/game-engine.ts'), 'utf8')

    // 「没人了」的答案在 `DeathSystem` 里，引擎不许再抄一份判据。
    expect(src).not.toMatch(/aliveCount\s*===\s*0/)
    // 也必须有真的调用方，否则上一条只是因为两边都不存在才通过的。
    expect(src).toMatch(/deathSystem\.checkAllDead\(\)/)
  })
})
