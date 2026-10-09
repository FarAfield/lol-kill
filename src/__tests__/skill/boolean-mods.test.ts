// ============================================================
// Phase 12 验收：布尔否决器（IBooleanMods）与全系统接线
//
// Phase 11 只接了 `cardCancelable` 一个键，其余 8 个键当时
// 「注册得进去、查得到结果，但没人真的去查」——这正是历史上一再出现的
// 那类 bug：能力实现了，接线没接。
//
// 所以这里的每个用例都**从行为侧**验证，而不是断言 `modQuery.xxx(...) === false`：
// 断言查询接口只是证明注册表能算，证明不了「出闪那条路真的问过它」。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { GameEvent } from '@core/event'
import { EventCompiler } from '@core/event/event-compiler'
import { TargetSystem } from '@core/system'
import { CardTag } from '@core/contracts/card-tag'
import { GamePhase, ZoneType } from '@core/contracts/enums'
import type { IBooleanMods, IModDefinition } from '@core/contracts/mod.interface'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { EventName } from '@core/contracts/event-name'
import type { ISkill } from '@core/contracts/skill.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { createTestEnv, giveCard, cardDef, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

// ── 工具 ──

/**
 * 注册一条「只否决某件事」的 Mod
 *
 * `mods` 用计算属性名拼出来——九个键的签名都一样（`(value, ctx, ...args) => boolean`），
 * 逐个写一遍只会让测试变长，不会让它更准。
 */
function veto(
  id: string,
  owner: IPlayer,
  key: keyof IBooleanMods,
  result = false,
): void {
  env.engine.modRegistry.register({
    id,
    owners: () => [owner],
    mods: { [key]: () => result } as IModDefinition['mods'],
  })
}

/** 一张杀 */
function sha(user: IPlayer): ICard {
  return giveCard(user, cardDef('sha', [CardTag.Strike, CardTag.Attack]))
}

/** 一张闪 */
function dodge(user: IPlayer): ICard {
  return giveCard(user, cardDef('shan', CardTag.Dodge))
}

/** 一张桃 */
function peach(user: IPlayer): ICard {
  return giveCard(user, cardDef('tao', CardTag.Heal))
}

/**
 * 一张南蛮入侵（锦囊才会开无懈窗口）
 *
 * tag 对齐真实定义（`BarbarianRaid, Trick, Aoe`）：它是**群体牌**，
 * 不设目标。少了 `Aoe` 就会被 TargetSystem 当成「要选一个目标」的普通锦囊。
 */
function nanMan(user: IPlayer): ICard {
  return giveCard(user, cardDef('nanManRuQin', [CardTag.BarbarianRaid, CardTag.Trick, CardTag.Aoe]))
}

/** 一张无懈可击 */
function wuxie(user: IPlayer): ICard {
  return giveCard(
    user,
    cardDef('wuXieKeJi', [CardTag.Counter, CardTag.Trick, CardTag.Cancel, CardTag.Response]),
  )
}

/**
 * 出牌阶段的可选项 —— `PhaseManager` 里它是私有的
 *
 * 这里用类型断言取出来，而不是为了测试把它改成 public：
 * 「玩家眼前能点哪些牌」本来就该由 `GameController` 暴露给 UI，
 * 但在那之前，测试宁可断言私有方法，也不要放任一处不设防。
 */
function playableCards(player: IPlayer): ICard[] {
  const pm = env.engine.phaseManager as unknown as {
    getPlayableCards(p: IPlayer, used: Map<string, number>): ICard[]
  }
  return pm.getPlayableCards(player, new Map())
}

/** 注册一个「记录型」技能，触发时把事件名推进 log */
function recorder(owner: IPlayer, event: EventName, log: string[]): void {
  const effect: ISkill = {
    id: `probe-${event}`,
    name: '探针',
    description: '',
    priority: 10,
    trigger: { global: [event] },
    content: async () => {
      log.push(event)
    },
  }
  const handlers: CompiledHandler[] = new EventCompiler().compile(effect, owner)
  for (const h of handlers) {
    env.engine.eventDispatcher.eventTrigger.registerCompiled(h)
  }
}

// ── cardRespondable ──

describe('cardRespondable —— 响应的牌在「选项生成时」就被剔掉', () => {
  it('基线：手上有闪 → 被询问，杀被抵消', async () => {
    const [attacker, victim] = env.players()
    const card = sha(attacker)
    const shan = dodge(victim)
    env.decisions.script(victim, '是否出闪', shan)

    const before = victim.hp
    await env.engine.useCard(attacker, card, [victim])

    expect(env.decisions.askCount(victim, '是否出闪')).toBe(1)
    expect(victim.hp).toBe(before)
  })

  it('返回 false → 不问、不掉闪、直接吃伤害', async () => {
    const [attacker, victim] = env.players()
    const card = sha(attacker)
    const shan = dodge(victim)
    env.decisions.script(victim, '是否出闪', shan)

    veto('test:noRespond', victim, 'cardRespondable')

    const before = victim.hp
    await env.engine.useCard(attacker, card, [victim])

    // 关键是「根本没被问」：被封的牌不能先摆出来再判无效
    expect(env.decisions.askCount(victim, '是否出闪')).toBe(0)
    expect(victim.hp).toBe(before - 1)
    expect(shan.zone).toBe(ZoneType.Hand)
  })
})

// ── cardEnabled ──

describe('cardEnabled —— 被禁的牌不出现在出牌阶段的选项里', () => {
  it('基线：手上的牌默认都可出', () => {
    const [player] = env.players()
    const card = sha(player)

    expect(playableCards(player).map((c) => c.instanceId)).toContain(card.instanceId)
  })

  it('返回 false → 该牌从选项里消失（验收清单 #10）', () => {
    const [player] = env.players()
    const card = sha(player)
    const other = peach(player)

    // 「你不能使用或打出【杀】」——只封杀，不封桃
    env.engine.modRegistry.register({
      id: 'test:strikeBanned',
      owners: () => [player],
      mods: {
        cardEnabled: (value, _ctx, c) => (c.tags.has(CardTag.Strike) ? false : value),
      },
    })

    const ids = playableCards(player).map((c) => c.instanceId)
    expect(ids).not.toContain(card.instanceId)
    // 否决必须精确到「哪张牌」，不能顺手把整只手都禁了
    expect(ids).toContain(other.instanceId)
  })
})

// ── cardSavable ──

describe('cardSavable —— 濒死求桃', () => {
  it('基线：有人出桃 → 救活', async () => {
    const [attacker, victim, , saver] = env.players()
    victim.hp = 1
    const tao = peach(saver)
    env.decisions.script(saver, '濒死', tao)

    await env.engine.useCard(attacker, sha(attacker), [victim])

    expect(victim.alive).toBe(true)
    expect(tao.zone).toBe(ZoneType.Discard)
  })

  it('返回 false → 救不回来，桃留在手里', async () => {
    const [attacker, victim, , saver] = env.players()
    victim.hp = 1
    const tao = peach(saver)
    env.decisions.script(saver, '濒死', tao)

    veto('test:noSave', saver, 'cardSavable')

    await env.engine.useCard(attacker, sha(attacker), [victim])

    expect(victim.alive).toBe(false)
    expect(tao.zone).not.toBe(ZoneType.Discard)
  })
})

// ── cardCancelable ──

describe('cardCancelable —— 锦囊能否被无懈', () => {
  it('基线：手上有无懈 → 被询问', async () => {
    const [user, p1] = env.players()
    const counter = wuxie(p1)
    env.decisions.script(p1, '无懈可击', counter)

    await env.engine.useCard(user, nanMan(user), [])

    expect(env.decisions.askCount(p1, '无懈可击')).toBeGreaterThan(0)
  })

  it('返回 false → 无懈窗口根本不开（验收清单 #13）', async () => {
    const [user, p1] = env.players()
    const counter = wuxie(p1)
    env.decisions.script(p1, '无懈可击', counter)

    veto('test:noCancel', user, 'cardCancelable')

    await env.engine.useCard(user, nanMan(user), [])

    expect(env.decisions.askCount(p1, '无懈可击')).toBe(0)
    expect(counter.zone).toBe(ZoneType.Hand)
  })
})

// ── targetEnabled / targetInRange ──

describe('targetEnabled —— 目标合法性', () => {
  it('返回 false → 该玩家不在可选目标里', () => {
    const [source, near] = env.players()
    const card = sha(source)

    const before = TargetSystem.getAvailableTargets(
      source,
      card,
      env.engine.state,
      env.engine.modQuery,
    )
    expect(before.map((p) => p.id)).toContain(near.id)

    veto('test:untargetable', near, 'targetEnabled')

    const after = TargetSystem.getAvailableTargets(
      source,
      card,
      env.engine.state,
      env.engine.modQuery,
    )
    expect(after.map((p) => p.id)).not.toContain(near.id)
  })

  it('目标规则与否决互不干涉：远处的人本来就选不到，与 Mod 无关', () => {
    const source = env.players()[0]!
    const far = env.players()[2]!
    const card = sha(source)

    const targets = TargetSystem.getAvailableTargets(
      source,
      card,
      env.engine.state,
      env.engine.modQuery,
    )
    // 座次距离 2 > 攻击范围 1，本来就不在候选里
    expect(targets.map((p) => p.id)).not.toContain(far.id)
  })
})

// ── phaseSkippable ──

describe('phaseSkippable —— 阶段能否被跳过', () => {
  it('基线：带跳过标记 → 阶段不执行', async () => {
    const [player] = env.players()
    player.shouldSkipPhases.push(GamePhase.PhaseJudge)
    const log: string[] = []
    recorder(player, 'phaseJudge', log)

    await env.engine.phaseManager.executeTurn()

    expect(log).toEqual([])
  })

  it('返回 false → 带跳过标记也照常执行', async () => {
    const [player] = env.players()
    player.shouldSkipPhases.push(GamePhase.PhaseJudge)
    const log: string[] = []
    recorder(player, 'phaseJudge', log)

    veto('test:phaseForced', player, 'phaseSkippable')

    await env.engine.phaseManager.executeTurn()

    expect(log).toEqual(['phaseJudge'])
  })
})

// ── skillEnabled ──

describe('skillEnabled —— 技能被封', () => {
  /** 发一次伤害（不经过用牌，省掉目标与响应） */
  async function damageOnce(source: IPlayer, target: IPlayer): Promise<void> {
    target.hp = 5
    await env.engine.eventDispatcher.dispatch(
      new GameEvent({ name: 'damage', source, player: source, targets: [target], num: 1 }),
      env.engine.eventChain,
    )
  }

  it('基线：技能钩子会跑', async () => {
    const [source, victim] = env.players()
    const log: string[] = []
    recorder(source, 'damageBegin', log)

    await damageOnce(source, victim)

    expect(log).toEqual(['damageBegin'])
  })

  it('返回 false → 该技能的钩子一个都不匹配', async () => {
    const [source, victim] = env.players()
    const log: string[] = []
    recorder(source, 'damageBegin', log)

    env.engine.modRegistry.register({
      id: 'test:skillSealed',
      owners: () => [source],
      mods: {
        skillEnabled: (value, _ctx, skillId) =>
          skillId === 'probe-damageBegin' ? false : value,
      },
    })

    await damageOnce(source, victim)

    expect(log).toEqual([])
  })
})

// ── 否决语义本身 ──

describe('否决语义 —— 一票否决，且无法翻盘', () => {
  it('两个否决器并存，任一 false 即 false', async () => {
    const [attacker, victim] = env.players()
    const card = sha(attacker)
    const shan = dodge(victim)
    env.decisions.script(victim, '是否出闪', shan)

    veto('test:vetoA', victim, 'cardRespondable', true)
    veto('test:vetoB', victim, 'cardRespondable', false)

    const before = victim.hp
    await env.engine.useCard(attacker, card, [victim])

    expect(victim.hp).toBe(before - 1)
  })

  it('全部放行 → 不否决', async () => {
    const [attacker, victim] = env.players()
    const card = sha(attacker)
    const shan = dodge(victim)
    env.decisions.script(victim, '是否出闪', shan)

    veto('test:okA', victim, 'cardRespondable', true)
    veto('test:okB', victim, 'cardRespondable', true)

    const before = victim.hp
    await env.engine.useCard(attacker, card, [victim])

    expect(victim.hp).toBe(before)
  })

  it('true 无法被后面的 false 之外的人翻盘：已 false 就不再问后面的 Mod', () => {
    const [player] = env.players()
    const card = sha(player)
    const asked: string[] = []

    env.engine.modRegistry.register({
      id: 'test:first',
      priority: 100,
      owners: () => [player],
      mods: {
        cardEnabled: () => {
          asked.push('first')
          return false
        },
      },
    })
    env.engine.modRegistry.register({
      id: 'test:second',
      priority: 0,
      owners: () => [player],
      mods: {
        cardEnabled: () => {
          asked.push('second')
          return true
        },
      },
    })

    expect(env.engine.modQuery.cardEnabled(player, card)).toBe(false)
    // 第二个 Mod 根本没被调用——否则「返回 true」就成了翻盘
    expect(asked).toEqual(['first'])
  })
})

// ── 布尔与数值互不干扰 ──

describe('否决器与数值器', () => {
  it('同一条定义同时提供数值与布尔，两者各走各的', async () => {
    const [attacker, victim] = env.players()
    const card = sha(attacker)
    const shan = dodge(victim)
    env.decisions.script(victim, '是否出闪', shan)

    env.engine.modRegistry.register({
      id: 'test:mixed',
      owners: () => [victim],
      mods: {
        // 数值：受伤 +1
        damageTo: (value) => value + 1,
        // 布尔：闪不能用
        cardRespondable: () => false,
      },
    })

    victim.hp = 5
    const before = victim.hp
    await env.engine.useCard(attacker, card, [victim])

    expect(env.decisions.askCount(victim, '是否出闪')).toBe(0)
    expect(victim.hp).toBe(before - 2)
  })
})
