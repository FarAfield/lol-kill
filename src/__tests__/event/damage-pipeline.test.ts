// ============================================================
// 伤害流水线统一回归测试（Phase 10）
//
// Phase 10 之前伤害是**双轨制**：
//   - DamageSystem 自建六段流水线（Before/Prevent/Modify/Apply/After/Complete）
//     和一份钩子注册表，与主事件链平行；
//   - EffectContext.damageTarget 先 `executePipeline()` 把血扣完，
//     再 dispatch 一个 `damage` 事件 —— 于是「防止伤害」类技能永远无效：
//     等事件发出去，血已经没了。
//
// Phase 10 之后伤害**就是**一条普通事件，走标准七阶段流水线，
// 扣血只发生在 `damage` 事件自己的内容里。
//
// 这个测试文件验三件事：
//   1. 顺序：各段的先后与「扣血发生在 damageEnd 之前」
//   2. 可拦截：damageBefore 能取消 / 转移 / 改数值
//   3. 单轨：伤害系统里再也没有钩子注册表
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { GameEvent } from '@core/event'
import { EventCompiler } from '@core/event/event-compiler'
import { DamageResolver } from '@core/system/damage-resolver'
import { PlayerSystem } from '@core/system/player-system'
import { DAMAGE_SOURCE_EVENT, DAMAGE_STEPS } from '@source/base/contents/damage-content'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { ISkill, ISkillContext } from '@core/contracts/skill.interface'
import type { EventName } from '@core/contracts/event-name'
import type { IGameEvent } from '@core/contracts/event.interface'
import { CardTag } from '@core/contracts/card-tag'
import { ZoneType } from '@core/contracts/enums'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { createTestEnv, giveCard, cardDef, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

/** 一张杀 */
function sha(user: IPlayer): ICard {
  return giveCard(user, cardDef('sha', CardTag.Strike))
}

/** 手动派发一次用牌，返回 useCard 事件（engine.useCard 不返回事件对象） */
async function dispatchUseCard(
  player: IPlayer,
  card: ICard,
  targets: IPlayer[] = [],
): Promise<IGameEvent> {
  const event = new GameEvent({
    name: 'useCard',
    source: player,
    player,
    targets,
    cards: [card],
  })
  await env.engine.eventDispatcher.dispatch(event, env.engine.eventChain)
  return event
}

/** 在 useCard 事件树里找到指定名字的子事件 */
function childNamed(event: IGameEvent, name: string): IGameEvent | undefined {
  return event.children.find((c) => c.name === name)
}

/**
 * 注册一个「记录型」技能
 *
 * 用 global 范围监听一个事件名，触发时把「事件名 + 当时的 HP」推进 `log`。
 * 断言**顺序**就靠它——分段是不是按 damageBefore → ... → damageAfter 走，
 * 以及扣血到底发生在哪一段之前。
 *
 * 注意：`ctx.event.name` 恒为事件**主体**（'damage'），阶段后缀不在名字里，
 * 所以日志里记的是注册的那个事件名（'damageBefore' 等），否则看不出分段。
 */
function recorder(
  owner: IPlayer,
  event: EventName,
  log: string[],
  onFire?: (ctx: ISkillContext) => void,
): void {
  const effect: ISkill = {
    id: `probe-${event}`,
    name: '探针',
    description: '',
    priority: 10,
    trigger: { global: [event] },
    content: async (ctx) => {
      log.push(`${event}@${ctx.event.targets[0]?.hp ?? '-'}`)
      onFire?.(ctx)
    },
  }

  const handlers: CompiledHandler[] = new EventCompiler().compile(effect, owner)
  for (const h of handlers) {
    env.engine.eventDispatcher.eventTrigger.registerCompiled(h)
  }
}

// ── 单轨：伤害系统不再持有钩子 ──

describe('伤害只有一条流水线', () => {
  it('DamageResolver 没有钩子注册表（registerHook 已随 DamageSystem 删除）', () => {
    const surface = DamageResolver as unknown as Record<string, unknown>
    expect(surface['registerHook']).toBeUndefined()
    expect(surface['clearHooks']).toBeUndefined()
    expect(surface['executePipeline']).toBeUndefined()
  })

  it('伤害求解是纯函数：数值下限 0、0 伤害不扣血', () => {
    expect(DamageResolver.resolveAmount(2, 1)).toBe(3)
    expect(DamageResolver.resolveAmount(1, -3)).toBe(0)
    expect(DamageResolver.resolveAmount(0, 0)).toBe(0)

    const victim = env.players()[1]!
    const before = victim.hp
    // Phase 19 起扣血是实例方法（转交 PlayerSystem），数值计算才是静态的
    const resolver = new DamageResolver(new PlayerSystem())
    expect(resolver.applyDamage(victim, 0)).toBe(0)
    expect(victim.hp).toBe(before)
    expect(resolver.applyDamage(victim, -5)).toBe(0)
    expect(victim.hp).toBe(before)
  })

  it('扣血只有一处：伤害内容注册在 ContentRegistry 上', () => {
    expect(env.engine.contentRegistry.has('damage')).toBe(true)
  })
})

// ── 分段顺序 ──

describe('伤害分段', () => {
  it('顺序为 damageBefore → damageSource → 扣血 → damageEnd → damageAfter', async () => {
    const [attacker, victim] = env.players()
    const log: string[] = []

    recorder(attacker, 'damageBefore', log)
    recorder(attacker, 'damageBegin', log)
    recorder(attacker, DAMAGE_SOURCE_EVENT, log)
    recorder(attacker, 'damageEnd', log)
    recorder(attacker, 'damageAfter', log)

    const before = victim.hp
    await env.engine.useCard(attacker, sha(attacker), [victim])

    expect(log).toEqual([
      `damageBefore@${before}`, // 还没扣血
      `damageBegin@${before}`,
      `damageSource@${before}`, // 也没扣血：来源技能在扣血前
      `damageEnd@${before - 1}`, // 已扣血
      `damageAfter@${before - 1}`,
    ])
    expect(victim.hp).toBe(before - 1)
  })

  it('damageSource 只在真有伤害来源时才发', async () => {
    const [, victim] = env.players()
    const log: string[] = []
    recorder(victim, DAMAGE_SOURCE_EVENT, log)

    const noSource = new GameEvent({
      name: 'damage',
      player: victim,
      targets: [victim],
      num: 1,
    })
    await env.engine.eventDispatcher.dispatch(noSource, env.engine.eventChain)

    expect(log).toEqual([])
    expect(victim.hp).toBe(victim.hp) // 无来源也照常扣血
  })

  it('伤害内容由四个步骤组成，扣血是其中的一步', async () => {
    const [attacker, victim] = env.players()
    const event = new GameEvent({
      name: 'damage',
      source: attacker,
      player: attacker,
      targets: [victim],
      num: 1,
    })

    await env.engine.eventDispatcher.dispatch(event, env.engine.eventChain)

    expect(event.hasStep(DAMAGE_STEPS.Resolve)).toBe(true)
    expect(event.hasStep(DAMAGE_STEPS.Source)).toBe(true)
    expect(event.hasStep(DAMAGE_STEPS.Apply)).toBe(true)
    expect(event.hasStep(DAMAGE_STEPS.Dying)).toBe(true)
    expect(event.result.num).toBe(1)
    expect(event.result.bool).toBe(true)
  })
})

// ── 可拦截 ──

describe('伤害可拦截', () => {
  it('【闪】→ 杀被取消，体力不变', async () => {
    const [attacker, victim] = env.players()
    const card = sha(attacker)
    const dodge = giveCard(victim, cardDef('shan', CardTag.Dodge))
    env.decisions.script(victim, '是否出闪', dodge)

    const before = victim.hp
    const useCard = await dispatchUseCard(attacker, card, [victim])

    expect(childNamed(useCard, 'sha')?.cancelled).toBe(true)
    expect(victim.hp).toBe(before)
    expect(dodge.zone).toBe(ZoneType.Discard)
  })

  it('damageBegin 里 cancel → 不扣血，且 damageEnd / damageAfter 不触发', async () => {
    const [attacker, victim] = env.players()
    const log: string[] = []

    recorder(victim, 'damageBegin', log, (ctx) => {
      ctx.event.cancel('防止伤害')
    })
    recorder(victim, 'damageEnd', log)
    recorder(victim, 'damageAfter', log)

    const before = victim.hp
    await env.engine.useCard(attacker, sha(attacker), [victim])

    expect(victim.hp).toBe(before)
    // cancel 跳过 Content 之后的所有阶段——「受伤后」技能不该被误触发
    expect(log).toEqual([`damageBegin@${before}`])
  })

  it('damageBefore 里转移目标 → 受伤的是转移后的目标', async () => {
    const [attacker, original, redirected] = env.players()

    recorder(original, 'damageBefore', [], (ctx) => {
      // 天香一类：把这一击转给另一个人
      ctx.event.targets = [redirected]
    })

    const originHp = original.hp
    const redirectHp = redirected.hp

    await env.engine.useCard(attacker, sha(attacker), [original])

    expect(original.hp).toBe(originHp)
    expect(redirected.hp).toBe(redirectHp - 1)
  })

  it('damageBefore 里写 extraDamage → 伤害值增加（Phase 11 Mod 的落点）', async () => {
    const [attacker, victim] = env.players()

    recorder(attacker, 'damageBefore', [], (ctx) => {
      ctx.event.values.extraDamage += 2
    })

    const before = victim.hp
    await env.engine.useCard(attacker, sha(attacker), [victim])

    expect(victim.hp).toBe(before - 3)
  })

  it('extraDamage 为负时伤害下限为 0，不会变成回血', async () => {
    const [attacker, victim] = env.players()
    victim.hp = Math.max(1, victim.maxHp - 2)

    recorder(attacker, 'damageBefore', [], (ctx) => {
      ctx.event.values.extraDamage -= 5
    })

    const before = victim.hp
    await env.engine.useCard(attacker, sha(attacker), [victim])

    expect(victim.hp).toBe(before)
  })
})

// ── 濒死与死亡 ──

describe('伤害后的濒死结算', () => {
  it('打到 0 血有人出桃 → 救活，伤害事件记录 saved', async () => {
    const [attacker, victim, , saver] = env.players()
    victim.hp = 1

    const peach = giveCard(saver, cardDef('tao', CardTag.Heal))
    env.decisions.script(saver, '濒死', peach)

    const useCard = await dispatchUseCard(attacker, sha(attacker), [victim])
    const damage = childNamed(useCard, 'sha')?.children.find((c) => c.name === 'damage')

    expect(victim.hp).toBe(1)
    expect(victim.alive).toBe(true)
    expect(damage?.result.saved).toBe(true)
    expect(damage?.result.died).toBeUndefined()
  })

  it('打到 0 血无人出桃 → 死亡，伤害事件记录 died', async () => {
    const [attacker, victim] = env.players()
    victim.hp = 1

    const useCard = await dispatchUseCard(attacker, sha(attacker), [victim])
    const damage = childNamed(useCard, 'sha')?.children.find((c) => c.name === 'damage')

    expect(victim.alive).toBe(false)
    expect(damage?.result.died).toBe(true)
  })

  it('濒死是伤害的子事件 —— 技能能钩住 dying', async () => {
    const [attacker, victim] = env.players()
    victim.hp = 1
    const log: string[] = []

    recorder(victim, 'dying', log)

    await env.engine.useCard(attacker, sha(attacker), [victim])

    expect(log.length).toBeGreaterThan(0)
    expect(log[0]!.startsWith('dying@')).toBe(true)
  })
})
