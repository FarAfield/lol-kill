// ============================================================
// Phase 15 验收 · 技能属性矩阵
//
// `locked` / `forced` / `limited` / `awaken` / `convertible` / `frequency`
// 在 Phase 13 只是**字段**——写上去不报错，也没有人读。这一组用例
// 验的是「写了之后真的按那个语义跑」。
//
// 三条在这个 Phase 之前是错的，各有一条用例盯着：
//
// 1. **限定技能过轮复活**：旧判据是 `usedThisRound`，而它在轮次边界
//    被 `resetFrequency('round')` 清零——限定技于是变成「每轮一次」。
// 2. **「每回合限一次」其实是「每事件限一次」**：计数长在 CompiledHandler
//    上，一条技能监听两个事件就有两份互不干涉的计数。
// 3. **觉醒技是空桩**：`ctx.modifyEffects` 只写一个没人读的 mark。
//
// 命名：全部英文语义，禁止拼音（code-standards.md §6.1）。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { GameEvent } from '@core/event/game-event'
import { EventCompiler } from '@core/event/event-compiler'
import { SkillRegistry } from '@core/skill/skill-registry'
import { EventTrigger } from '@core/event/event-trigger'
import {
  isDeclinableSkill,
  isForcedSkill,
  isManualSkill,
  shouldPrompt,
} from '@core/skill/skill-utils'
import { convertMarkKey } from '@core/skill/skill-runtime'
import { GamePhase } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import { HardAIStrategy } from '@core/services/ai-strategies'
import type { EventName } from '@core/contracts/event-name'
import type { ISkill } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { createTestEnv, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

/** 只为查工具函数造一个最小技能 */
function skill(partial: Partial<ISkill> & { id: string }): ISkill {
  return { name: partial.id, description: '', ...partial }
}

/** 把一条技能登记 + 挂到 0 号玩家身上（走真实台账） */
function attachSkill(def: ISkill): IPlayer {
  const registry = env.engine.skillRegistry
  registry.register(def)
  const player = env.players()[0]!
  registry.attach(player, def.id)
  return player
}

/** 发一条裸事件（不带卡牌、不带内容，只为把钩子叫起来） */
async function fire(name: EventName): Promise<void> {
  const player = env.players()[0]!
  const event = new GameEvent({
    name,
    source: player,
    player,
    phase: GamePhase.PhasePre,
    round: env.engine.state.currentRound,
    turn: player.seatIndex,
  })
  await env.engine.eventDispatcher.dispatch(event, env.engine.eventChain)
}

// ═══════════════════════════════════════════
// 限定技 —— 整局一次
// ═══════════════════════════════════════════

describe('Phase 15 · 限定技（limited）', () => {
  it('一局只能发动一次，第二次 isAvailable === false', async () => {
    let fired = 0
    const player = attachSkill(
      skill({
        id: 'testLimited',
        limited: true,
        trigger: { global: ['turnStart'] },
        content: async () => {
          fired += 1
        },
      }),
    )

    expect(env.engine.skillRegistry.isAvailable(player, 'testLimited')).toBe(true)

    await fire('turnStart')
    expect(fired).toBe(1)
    expect(env.engine.skillRegistry.isAvailable(player, 'testLimited')).toBe(false)

    await fire('turnStart')
    expect(fired).toBe(1)
  })

  it('过了一个轮次也不会复活（判据是永不清零的 usedCount）', async () => {
    let fired = 0
    attachSkill(
      skill({
        id: 'testLimitedAcrossRounds',
        limited: true,
        trigger: { global: ['turnStart'] },
        content: async () => {
          fired += 1
        },
      }),
    )

    await fire('turnStart')
    expect(fired).toBe(1)

    // 旧实现在这里会复活：它记的是 usedThisRound，而这一行正好把它清掉
    env.engine.skillRegistry.resetFrequency('round')
    await fire('turnStart')
    expect(fired).toBe(1)
  })
})

// ═══════════════════════════════════════════
// 频率 —— 按技能算，不按钩子算
// ═══════════════════════════════════════════

describe('Phase 15 · 频率（frequency）', () => {
  it('同一条技能监听两个事件时，“每回合一次”仍然只算一次', async () => {
    let fired = 0
    attachSkill(
      skill({
        id: 'testSharedQuota',
        frequency: 'oncePerTurn',
        trigger: { global: ['turnStart', 'phaseUseBegin'] },
        content: async () => {
          fired += 1
        },
      }),
    )

    await fire('turnStart')
    expect(fired).toBe(1)

    // 旧实现在这里会再放一次：两个事件名 = 两个 handler = 两份计数
    await fire('phaseUseBegin')
    expect(fired).toBe(1)

    env.engine.skillRegistry.resetFrequency('turn')
    await fire('phaseUseBegin')
    expect(fired).toBe(2)
  })

  it('oncePerTurn 在第二回合可以再次发动', async () => {
    let fired = 0
    const player = attachSkill(
      skill({
        id: 'testOncePerTurnAgain',
        frequency: 'oncePerTurn',
        trigger: { global: ['turnStart'] },
        content: async () => {
          fired += 1
        },
      }),
    )

    await fire('turnStart')
    expect(env.engine.skillRegistry.isAvailable(player, 'testOncePerTurnAgain')).toBe(false)

    env.engine.skillRegistry.resetFrequency('turn')
    expect(env.engine.skillRegistry.isAvailable(player, 'testOncePerTurnAgain')).toBe(true)

    await fire('turnStart')
    expect(fired).toBe(2)
  })

  it('usable 数额度用完即止，且 content 抛错不扣额度', async () => {
    let fired = 0
    attachSkill(
      skill({
        id: 'testUsable',
        usable: 2,
        trigger: { global: ['turnStart'] },
        content: async () => {
          fired += 1
        },
      }),
    )

    await fire('turnStart')
    await fire('turnStart')
    await fire('turnStart')
    expect(fired).toBe(2)

    // 失败的那次不该算进去（错误会一路抛到 dispatch 外面，这里只关心记账）
    let attempted = 0
    attachSkill(
      skill({
        id: 'testUsableFailure',
        usable: 1,
        trigger: { global: ['turnStart'] },
        content: async () => {
          attempted += 1
          throw new Error('发动失败')
        },
      }),
    )
    await fire('turnStart').catch(() => undefined)
    expect(attempted).toBe(1)
    expect(env.engine.skillRegistry.isAvailable(env.players()[0]!, 'testUsableFailure')).toBe(
      true,
    )
  })
})

// ═══════════════════════════════════════════
// 锁定技 / 强制技 —— 不可拒绝
// ═══════════════════════════════════════════

describe('Phase 15 · 锁定技与强制技', () => {
  const locked = skill({ id: 'testLocked', locked: true })
  const forced = skill({ id: 'testForced', forced: true })
  const optional = skill({ id: 'testOptional' })

  it('两者都不可拒绝，普通技可以', () => {
    expect(isForcedSkill(locked)).toBe(true)
    expect(isForcedSkill(forced)).toBe(true)
    expect(isDeclinableSkill(locked)).toBe(false)
    expect(isDeclinableSkill(optional)).toBe(true)
  })

  it('UI 不弹确认：强制技默认不弹，普通技默认弹', () => {
    // 问了又不许拒绝是自相矛盾
    expect(shouldPrompt(locked)).toBe(false)
    expect(shouldPrompt(forced)).toBe(false)
    expect(shouldPrompt(optional)).toBe(true)
    // 显式声明优先
    expect(shouldPrompt(skill({ id: 'x', popup: true, locked: true }))).toBe(true)
  })

  it('AI 拿不到锁定技的“否决权”——它不进任何可选列表', async () => {
    // 主动列表走 isManualSkill
    expect(isManualSkill(locked)).toBe(false)
    expect(isManualSkill(skill({ id: 'y', enable: [GamePhase.PhaseUse] }))).toBe(true)

    // 响应列表走 isDeclinableSkill：只有锁定技时，AI 无从“选择不发动”
    const ai = new HardAIStrategy()
    const answer = ai.respondWithEffect(env.players()[0]!, [locked], env.engine.state)
    expect(answer).toBeNull()
  })
})

// ═══════════════════════════════════════════
// 觉醒技 —— 永久获得，不可回退
// ═══════════════════════════════════════════

describe('Phase 15 · 觉醒技（awaken）', () => {
  function setupAwaken() {
    const registry = env.engine.skillRegistry
    registry.register(skill({ id: 'testAwakenedSkill', description: '觉醒后获得的技能' }))

    let awakenCount = 0
    registry.register(
      skill({
        id: 'testAwakenSource',
        awaken: true,
        trigger: { player: ['turnStart'] },
        filter: (ctx) => ctx.player.hp <= 1,
        content: async (ctx) => {
          awakenCount += 1
          await ctx.awakenSkill(ctx.player, 'testAwakenedSkill')
        },
      }),
    )
    const player = env.players()[0]!
    registry.attach(player, 'testAwakenSource')
    return { registry, player, count: () => awakenCount }
  }

  it('条件满足后 hasSkill(newSkill) === true', async () => {
    const { registry, player } = setupAwaken()
    expect(registry.hasSkill(player, 'testAwakenedSkill')).toBe(false)

    player.hp = 1
    await fire('turnStart')

    expect(registry.hasSkill(player, 'testAwakenedSkill')).toBe(true)
    expect(registry.isAwakened(player, 'testAwakenSource')).toBe(true)
  })

  it('条件不满足就不觉醒（filter 是真的在挡）', async () => {
    const { registry, player } = setupAwaken()
    player.hp = 4
    await fire('turnStart')
    expect(registry.hasSkill(player, 'testAwakenedSkill')).toBe(false)
  })

  it('不可回退：装备对齐与临时技能到期都摘不掉它', async () => {
    const { registry, player, count } = setupAwaken()
    player.hp = 1
    await fire('turnStart')

    registry.syncEquipSkills(player)
    registry.removeTempSkill(player, 'testAwakenedSkill')
    expect(registry.hasSkill(player, 'testAwakenedSkill')).toBe(true)

    // 觉醒本身是一次性的：再满足条件也不会再走一遍
    await fire('turnStart')
    expect(count()).toBe(1)
  })
})

// ═══════════════════════════════════════════
// 转换技 —— 两态切换
// ═══════════════════════════════════════════

describe('Phase 15 · 转换技（convertible）', () => {
  it('状态可翻转，且反映到玩家 mark 上（Mod 靠 mark 读态）', () => {
    const registry = new SkillRegistry(new EventTrigger(), new EventCompiler())
    registry.register(skill({ id: 'testConvertible', convertible: true }))
    // 用真玩家而不是字面量对象：mark 要写进 player.marks
    const player = env.players()[0]!
    registry.attach(player, 'testConvertible')

    expect(registry.getConvertState(player, 'testConvertible')).toBe(0)
    expect(registry.flipConvertState(player, 'testConvertible')).toBe(1)
    expect(registry.getConvertState(player, 'testConvertible')).toBe(1)
    expect(player.getMark(convertMarkKey('testConvertible'))).toBe(1)
    expect(registry.flipConvertState(player, 'testConvertible')).toBe(0)
  })

  it('翻转时执行 convertible 回调，两态的 content 读到不同的态', async () => {
    const seen: number[] = []
    const flips: number[] = []
    const player = attachSkill(
      skill({
        id: 'testConvertContent',
        convertible: (_player, state) => {
          flips.push(state)
        },
        trigger: { global: ['turnStart'] },
        content: async (ctx) => {
          seen.push(ctx.skillState?.convertState ?? -1)
        },
      }),
    )

    await fire('turnStart')
    env.engine.skillRegistry.flipConvertState(player, 'testConvertContent')
    await fire('turnStart')

    expect(seen).toEqual([0, 1])
    expect(flips).toEqual([1])
  })

  it('两态的 mod 也不同（Mod 是纯函数，从玩家 mark 上读态）', async () => {
    const player = attachSkill(
      skill({
        id: 'testConvertMod',
        convertible: true,
        mod: {
          cardUsable: (value, ctx, card) =>
            card.tags.has(CardTag.Strike) &&
            ctx.player.getMark(convertMarkKey('testConvertMod')) === 1
              ? Infinity
              : value,
        },
      }),
    )

    const strike = env.engine.state.deck.find((c) => c.tags.has(CardTag.Strike))
    expect(strike).toBeDefined()

    // 态 0：不加成
    expect(env.engine.cardUsableCount(player, strike!)).toBe(1)

    env.engine.skillRegistry.flipConvertState(player, 'testConvertMod')
    // 态 1：无限出杀
    expect(env.engine.cardUsableCount(player, strike!)).toBe(Infinity)
  })
})

// ═══════════════════════════════════════════
// 标记 —— 计数与按需清零
// ═══════════════════════════════════════════

describe('Phase 15 · 标记（mark）', () => {
  it('addMark(2) → countMark() === 2，clearMark 归零', () => {
    const registry = new SkillRegistry(new EventTrigger(), new EventCompiler())
    registry.register(skill({ id: 'testMark', mark: true }))
    const player = env.players()[0]!
    registry.attach(player, 'testMark')

    expect(registry.addMark(player, 'testMark', 2)).toBe(2)
    expect(registry.countMark(player, 'testMark')).toBe(2)
    registry.addMark(player, 'testMark')
    expect(registry.countMark(player, 'testMark')).toBe(3)

    registry.clearMark(player, 'testMark')
    expect(registry.countMark(player, 'testMark')).toBe(0)
  })

  it('没写 markClear 的标记跨回合累积，写了 turnEnd 的才在回合末清', async () => {
    const registry = env.engine.skillRegistry
    registry.register(skill({ id: 'testMarkPersistent', mark: true }))
    registry.register(skill({ id: 'testMarkPerTurn', mark: true, markClear: 'turnEnd' }))
    const player = env.players()[0]!
    registry.attach(player, 'testMarkPersistent')
    registry.attach(player, 'testMarkPerTurn')

    registry.addMark(player, 'testMarkPersistent', 2)
    registry.addMark(player, 'testMarkPerTurn', 2)

    // 直接调一次边界清理 = PhaseManager.executeTurn 在回合末做的那件事
    registry.clearMarks(player, 'turnEnd')
    expect(registry.countMark(player, 'testMarkPerTurn')).toBe(0)
    expect(registry.countMark(player, 'testMarkPersistent')).toBe(2)
  })

  it('走一个真实回合，回合末确实清掉了 turnEnd 标记', async () => {
    const registry = env.engine.skillRegistry
    registry.register(skill({ id: 'testMarkInRealTurn', mark: true, markClear: 'turnEnd' }))

    env.engine.turnManager.startRound()
    const player = env.engine.turnManager.nextTurn() ?? env.players()[0]!
    registry.attach(player, 'testMarkInRealTurn')
    registry.addMark(player, 'testMarkInRealTurn', 2)

    await env.engine.phaseManager.executeTurn()

    expect(registry.countMark(player, 'testMarkInRealTurn')).toBe(0)
  })
})
