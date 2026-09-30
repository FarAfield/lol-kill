// ============================================================
// Phase 13 验收：`ISkill` 新契约
//
// 三条验收各有gtt一份在这里：
//
// 1. 全部技能用新契约重写 —— 遍历**真实装配的全集**逐个检查结构，
//    而不是抽几个样本。写错事件名（'damageEndd'）不会报错，
//    只会静默失效，所以第三个用例专门抓它。
// 2. `mod` 字段与 `IModDefinition.mods` 类型一致 —— 用**类型层**断言：
//    两边一旦不再互相同构，本文件编译不过，测试 stage 根本到不了。
// 3. trigger 事件名映射无遗漏 —— 对照 Phase 5 的事件名表逐个验。
//
// 另外补了契约新增能力的的行为验证（filter2 / cost / usable /
// 频率复位），因为「字段加上了」和「真的按那个语义跑」是两件事。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { GameEvent } from '@core/event'
import { EventCompiler } from '@core/event/event-compiler'
import { ModRegistry } from '@core/skill/mod-registry'
import { registerSkillMods } from '@core/skill/skill-mods'
import {
  aiValueOf,
  expandSubSkills,
  isLockedSkill,
  isManualSkill,
  skillFrequency,
  skillPriority,
} from '@core/skill/skill-utils'
import { GamePhase } from '@core/contracts/enums'
import { isBuiltinEventName } from '@core/contracts/event-name'
import type { IModDefinition } from '@core/contracts/mod.interface'
import type { ISkill, ISkillTriggerCondition } from '@core/contracts/skill.interface'
import { CardTag } from '@core/contracts/card-tag'
import { allHeroSkills } from '@source/heroes/skills'
import { equipEffects } from '@source/base/effects'
import { createTestEnv, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

// ═══════════════════════════════════════════
// 类型层验收：mod 字段一致
// ═══════════════════════════════════════════

/** 两个类型是否完全同构 */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

describe('Phase 13 · ISkill 契约', () => {
  it('`ISkill.mod` 与 `IModDefinition.mods` 是同一个类型', () => {
    // 这一行之所以值钱：如果有人给任一侧加/删键，字段类型就不再是同一个，
    // `_same` 会被推成 false，`true` 赋不进去，**本文件编译失败**。
    // 用运行时断言是验不到的——映射过去的那一刻信息已经丢了。
    const same: MutuallyAssignable<NonNullable<ISkill['mod']>, IModDefinition['mods']> = true
    expect(same).toBe(true)
  })

  it('旧名字 `IEffect` 仍然指向新契约', () => {
    // 存量代码 / 文档还在写 IEffect；它是 ISkill 的别名，
    // 两边必须同构，否则 migration 迁移到一半会静默分裂成两套契约。
    type IEffect = import('@core/contracts/effect.interface').IEffect
    const same: MutuallyAssignable<IEffect, ISkill> = true
    expect(same).toBe(true)
  })

  // ═══════════════════════════════════════════
  // 迁移完整性
  // ═══════════════════════════════════════════

  it('所有已注册技能都写成了新契约（不再有 type / frequency 旧字段）', () => {
    const all = [...allHeroSkills, ...equipEffects]
    expect(all.length).toBeGreaterThan(0)

    for (const skill of all) {
      const legacy = skill as unknown as { type?: unknown }
      expect(legacy.type, `${skill.id} 仍在用旧的 type 字段`).toBeUndefined()
      expect(skill.description.length).toBeGreaterThan(0)
    }
  })

  it('trigger 里的事件名全部落在 Phase 5 的映射表内（零遗漏 / 零笔误）', () => {
    const all = [...allHeroSkills, ...equipEffects]

    for (const skill of all) {
      const trigger = skill.trigger as ISkillTriggerCondition | undefined
      if (!trigger) continue

      for (const scope of ['player', 'source', 'target', 'global'] as const) {
        for (const name of trigger[scope] ?? []) {
          expect(
            isBuiltinEventName(name),
            `${skill.id}.trigger.${scope} 里的 "${name}" 不是合法事件名（笔误？）`,
          ).toBe(true)
        }
      }
    }
  })

  it('每个技能至少要做一件事（content / mod / viewAs 三者有其一）', () => {
    for (const skill of [...allHeroSkills, ...equipEffects]) {
      const doesSomething =
        skill.content !== undefined ||
        skill.mod !== undefined ||
        skill.viewAs !== undefined
      expect(doesSomething, `${skill.id} 什么都没做`).toBe(true)
    }
  })

  it('装备技都标了 equipSkill，英雄技能都没有', () => {
    for (const skill of equipEffects) {
      expect(skill.equipSkill, `${skill.id} 未标记 equipSkill`).toBe(true)
    }
    for (const skill of allHeroSkills) {
      expect(skill.equipSkill, `${skill.id} 不该是装备技`).toBeUndefined()
    }
  })

  // ═══════════════════════════════════════════
  // 兼容读取
  // ═══════════════════════════════════════════

  it('classification 布尔位取代了旧的 type 枚举', () => {
    const locked: ISkill = { id: 'a', name: 'a', description: '', locked: true }
    const plain: ISkill = { id: 'b', name: 'b', description: '' }

    expect(isLockedSkill(locked)).toBe(true)
    expect(isLockedSkill(plain)).toBe(false)

    // 锁定技不进「可手动点」的候选列表
    const withEnable: ISkill = { id: 'c', name: 'c', description: '', enable: [GamePhase.PhaseUse] }
    const lockedWithEnable: ISkill = {
      id: 'd',
      name: 'd',
      description: '',
      locked: true,
      enable: [GamePhase.PhaseUse],
    }
    expect(isManualSkill(withEnable)).toBe(true)
    expect(isManualSkill(lockedWithEnable)).toBe(false)
    expect(isManualSkill(plain)).toBe(false)
  })

  it('频率与优先级有确定缺省值', () => {
    const bare: ISkill = { id: 'x', name: 'x', description: '' }
    expect(skillFrequency(bare)).toBe('unlimited')
    expect(skillPriority(bare)).toBe(0)

    const once: ISkill = { id: 'y', name: 'y', description: '', frequency: 'oncePerPhase' }
    expect(skillFrequency(once)).toBe('oncePerPhase')
  })

  it('子技能继承父技能字段，且与父技能一起摊平返回', () => {
    const [only] = expandSubSkills({ id: 'p', name: 'P', description: '' })
    expect(only?.id).toBe('p')

    const expanded = expandSubSkills({
      id: 'p',
      name: 'P',
      description: '',
      priority: 7,
      trigger: { global: ['turnStart'] },
      subSkill: {
        heal: { description: '回血' },
        draw: { priority: 9 },
      },
    })

    // 父技能仍在列表里——它是独立定义，有自己的 trigger / mod
    expect(expanded).toHaveLength(3)
    expect(expanded.map((s) => s.id).sort()).toEqual(['p', 'p_draw', 'p_heal'])
    // 没写的继承父技能
    const heal = expanded.find((s) => s.id === 'p_heal')!
    expect(heal.priority).toBe(7)
    expect(heal.trigger?.global).toEqual(['turnStart'])
    // 写了的覆盖
    expect(expanded.find((s) => s.id === 'p_draw')!.priority).toBe(9)
    // 父子双方的 subSkill 都不该带下来，否则展开会无限套娃
    expect(heal.subSkill).toBeUndefined()
    expect(expanded.find((s) => s.id === 'p')!.subSkill).toBeUndefined()
  })

  it('AI 估值优先读 ai.result，没有才退回 priority', () => {
    const [player] = env.players()

    const scored: ISkill = {
      id: 's',
      name: 's',
      description: '',
      priority: 2,
      ai: { order: 1, result: { player: () => 99 } },
    }
    const plain: ISkill = { id: 't', name: 't', description: '', priority: 5 }

    expect(aiValueOf(scored, player)).toBe(99)
    expect(aiValueOf(plain, player)).toBe(5)
  })

  // ═══════════════════════════════════════════
  // mod 真的进了 ModRegistry
  // ═══════════════════════════════════════════

  it('技能的 mod 会注册进 ModRegistry，并随持有者自动失效', () => {
    const [holder] = env.players()
    const registry = new ModRegistry()

    const registered = registerSkillMods(registry, [modSkill], (id) =>
      id === 'test:modSkill' ? [holder] : [],
    )
    expect(registered).toBe(1)

    const strike = {
      tags: new Set([CardTag.Strike]),
    } as never

    expect(registry.queryNumeric('cardUsable', 1, baseCtx(env), strike)).toBe(Infinity)

    // 持有者阵亡 → 同一条 Mod 下次查询自动不命中，无需任何清理代码
    holder.alive = false
    expect(registry.queryNumeric('cardUsable', 1, baseCtx(env), strike)).toBe(1)
    holder.alive = true
  })

  // ═══════════════════════════════════════════
  // 编译器：新字段真的按语义跑
  // ═══════════════════════════════════════════

  it('没有 trigger 的技能不产生任何钩子（纯 mod / viewAs 不进流水线）', () => {
    const handlers = new EventCompiler().compile(modSkill, env.players()[0]!)
    expect(handlers).toHaveLength(0)
  })

  it('filter2 是充分条件：定义了就必须为 true', async () => {
    let fired = 0
    const order: string[] = []
    const skill: ISkill = {
      id: 'testFilter2',
      name: 'filter2',
      description: '',
      trigger: { global: ['turnStart'] },
      filter: () => {
        order.push('filter')
        return true
      },
      filter2: () => {
        order.push('filter2')
        return false
      },
      content: async () => {
        fired += 1
      },
    }

    await fire(env, skill)
    expect(fired).toBe(0)
    expect(order).toEqual(['filter', 'filter2'])
  })

  it('cost 在 content 之前执行', async () => {
    const order: string[] = []
    const skill: ISkill = {
      id: 'testCost',
      name: 'cost',
      description: '',
      trigger: { global: ['turnStart'] },
      cost: async () => {
        order.push('cost')
      },
      content: async () => {
        order.push('content')
      },
    }

    await fire(env, skill)
    expect(order).toEqual(['cost', 'content'])
  })

  it('content 抛错时不计入次数（发动失败不扣额度）', async () => {
    let attempts = 0
    const skill: ISkill = {
      id: 'testFail',
      name: 'fail',
      description: '',
      frequency: 'oncePerTurn',
      usable: 1,
      trigger: { global: ['turnStart'] },
      content: async () => {
        attempts += 1
        throw new Error('boom')
      },
    }

    const trigger = env.engine.eventDispatcher.eventTrigger
    trigger.registerCompiledBatch(
      new EventCompiler().compile(skill, env.players()[0]!),
    )

    await expect(fireRaw(env)).rejects.toThrow('boom')
    expect(attempts).toBe(1)

    // 同一回合再问：额度没被上一次失败的发动吃掉
    await expect(fireRaw(env)).rejects.toThrow('boom')
    expect(attempts).toBe(2)
  })

  it('usable 额度用完就不再发动', async () => {
    let fired = 0
    const skill: ISkill = {
      id: 'testUsable',
      name: 'usable',
      description: '',
      trigger: { global: ['turnStart'] },
      usable: 2,
      content: async () => {
        fired += 1
      },
    }

    const trigger = env.engine.eventDispatcher.eventTrigger
    trigger.registerCompiledBatch(
      new EventCompiler().compile(skill, env.players()[0]!),
    )

    await fireRaw(env)
    await fireRaw(env)
    await fireRaw(env)
    expect(fired).toBe(2)
  })

  it('oncePerTurn 在回合边界真的复位（不是退化成整局一次）', async () => {
    let fired = 0
    const skill: ISkill = {
      id: 'testOncePerTurn',
      name: 'oncePerTurn',
      description: '',
      frequency: 'oncePerTurn',
      trigger: { global: ['turnStart'] },
      content: async () => {
        fired += 1
      },
    }

    const trigger = env.engine.eventDispatcher.eventTrigger
    trigger.registerCompiledBatch(
      new EventCompiler().compile(skill, env.players()[0]!),
    )

    await fireRaw(env)
    await fireRaw(env)
    expect(fired).toBe(1)

    // PhaseManager.executeTurn 在每个回合开头做的那件事
    trigger.resetFrequency('turn')
    await fireRaw(env)
    expect(fired).toBe(2)
  })

  it('oncePerPhase 在阶段边界复位', async () => {
    let fired = 0
    const skill: ISkill = {
      id: 'testOncePerPhase',
      name: 'oncePerPhase',
      description: '',
      frequency: 'oncePerPhase',
      trigger: { global: ['turnStart'] },
      content: async () => {
        fired += 1
      },
    }

    const trigger = env.engine.eventDispatcher.eventTrigger
    trigger.registerCompiledBatch(
      new EventCompiler().compile(skill, env.players()[0]!),
    )

    await fireRaw(env)
    await fireRaw(env)
    expect(fired).toBe(1)

    trigger.resetFrequency('phase')
    await fireRaw(env)
    expect(fired).toBe(2)
  })
})

// ── 测试夹具 ──

const modSkill: ISkill = {
  id: 'test:modSkill',
  name: '测试 Mod',
  description: '',
  mod: {
    cardUsable: (value, _ctx, card) =>
      card.tags.has(CardTag.Strike) ? Infinity : value,
  },
}

function baseCtx(testEnv: TestEnv) {
  return {
    player: testEnv.players()[0]!,
    game: testEnv.engine.state,
  }
}

/** 挂上一个临时技能并把 `turnStart` 跑一遍 */
async function fire(testEnv: TestEnv, skill: ISkill): Promise<void> {
  const trigger = testEnv.engine.eventDispatcher.eventTrigger
  trigger.registerCompiledBatch(
    new EventCompiler().compile(skill, testEnv.players()[0]!),
  )
  await fireRaw(testEnv)
}

async function fireRaw(testEnv: TestEnv): Promise<void> {
  const player = testEnv.players()[0]!
  const event = new GameEvent({
    name: 'turnStart',
    source: player,
    player,
    phase: GamePhase.PhasePre,
    round: testEnv.engine.state.currentRound,
    turn: player.seatIndex,
  })
  await testEnv.engine.eventDispatcher.dispatch(event, testEnv.engine.eventChain)
}
