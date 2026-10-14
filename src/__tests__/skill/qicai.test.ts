// ============================================================
// 黄月英 · 奇才 —— 本仓第一个「按牌型豁免距离」的技能（D43）
//
// 它曾经**写不出来**，不是内容没写，是引擎的接口给不出这个答案：
// 距离 Mod 只收 `(value, ctx, to)`，Mod 看到的是一串数字，
// 不知道这次算距离是为了打哪张牌。于是唯一的写法是「无条件把距离改小」，
// 而那等于把【杀】的攻击范围也一起放开——【奇才】并没有这个效果。
//
// 修法是让距离 Mod 的末尾带上 `card`。因此这里的断言分三层，
// 每层都必须**同时**证明「锦囊被豁免」与「杀没被豁免」：
//   ① 距离本身（带牌 / 不带牌 / 带杀）
//   ② 可选目标列表（顺手牵羊够到远处、杀够不到）
//   ③ 端到端打一张（真的拿到了牌；没有奇才的人打同一张会被拒）
//
// 只写①里的「锦囊距离变 1」是不够的：把奇才写成无条件改距离，
// 那条也会绿——真正会红的只有「杀的距离没变」那一条。
// ============================================================

import { describe, expect, it } from 'vitest'

import { TargetSystem } from '@core/system'
import { CardTag } from '@core/contracts/card-tag'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { Hero } from '@core/entity/hero'
import {
  HuangYueYing,
  LvMeng,
  LiuBei,
  GuanYu,
  ZhangFei,
  ZhaoYun,
} from '@source/heroes/standard'
import { allHeroSkills } from '@source/heroes/skills'
import { LOL_SKILL_THEMES } from '@source/theme/lol-mapping'
import {
  ScriptedDecisionService,
  createTestEnv,
  giveCard,
  cardDef,
  type TestEnv,
} from '../helpers/game-env'

/** 其余四名英雄固定，只换 0 号位——两局之间的差别就只有「有没有奇才」 */
const FILLER = [LiuBei, GuanYu, ZhangFei, ZhaoYun]

async function heroEnv(hero: Hero): Promise<TestEnv> {
  return createTestEnv<ScriptedDecisionService>(undefined, {
    heroes: [hero, ...FILLER],
    heroSelectCount: 1,
  })
}

/** 直接问引擎「这张牌能打谁」——与生产同一条路 */
function targetsFor(env: TestEnv, source: IPlayer, card: ICard): string[] {
  return TargetSystem.getAvailableTargets(
    source,
    card,
    env.engine.state,
    env.engine.modQuery,
  ).map((p) => p.id)
}

describe('【奇才】登记与换皮', () => {
  it('技能在册、挂在黄月英身上、有换皮名', () => {
    const skill = allHeroSkills.find((s) => s.id === 'qicai')
    expect(skill).toBeDefined()
    expect(HuangYueYing.effectIds).toContain('qicai')
    // 换皮表的 `sgs` 必须与技能真名一致，否则提问文案里的反查会静默失效
    expect(LOL_SKILL_THEMES['qicai']?.sgs).toBe(skill!.name)
    expect(LOL_SKILL_THEMES['qicai']?.name).toBe('天启之咒')
  })
})

describe('【奇才】① 距离本身', () => {
  it('用锦囊算距离 → 全场都是 1；用杀算 → 距离不变', async () => {
    const env = await heroEnv(HuangYueYing)
    const me = env.players()[0]!
    const far = env.players()[2]!

    expect(me.hero?.id).toBe('huangyueying')
    // 不带牌：裸座次距离，奇才不该掺和
    expect(env.engine.getDistance(me, far)).toBe(2)

    const snatch = giveCard(me, cardDef('shunShouQianYang', CardTag.Snatch))
    expect(env.engine.getDistance(me, far, snatch)).toBe(1)

    // 同一时刻同一对人，只因「算距离为了打哪张牌」不同，结果不同
    const sha = giveCard(me, cardDef('sha', CardTag.Strike))
    expect(env.engine.getDistance(me, far, sha)).toBe(2)
  })

  it('没有奇才的人：即使用锦囊算距离也不变（对照）', async () => {
    const env = await heroEnv(LvMeng)
    const me = env.players()[0]!
    const far = env.players()[2]!

    const snatch = giveCard(me, cardDef('shunShouQianYang', CardTag.Snatch))
    expect(env.engine.getDistance(me, far, snatch)).toBe(2)
  })
})

describe('【奇才】② 可选目标列表', () => {
  it('【顺手牵羊】够得到远处的人', async () => {
    const env = await heroEnv(HuangYueYing)
    const me = env.players()[0]!
    const far = env.players()[2]!

    const snatch = giveCard(me, cardDef('shunShouQianYang', CardTag.Snatch))
    expect(targetsFor(env, me, snatch)).toContain(far.id)
  })

  it('【杀】依然够不到 —— 奇才没有放开攻击范围（这是整套断言的牙齿）', async () => {
    const env = await heroEnv(HuangYueYing)
    const me = env.players()[0]!
    const near = env.players()[1]!
    const far = env.players()[2]!

    const sha = giveCard(me, cardDef('sha', CardTag.Strike))
    const ids = targetsFor(env, me, sha)

    expect(ids).toContain(near.id)
    expect(ids).not.toContain(far.id)
  })

  it('换一个没有奇才的英雄，同一张【顺手牵羊】就够不到（对照）', async () => {
    const env = await heroEnv(LvMeng)
    const me = env.players()[0]!
    const near = env.players()[1]!
    const far = env.players()[2]!

    const snatch = giveCard(me, cardDef('shunShouQianYang', CardTag.Snatch))
    const ids = targetsFor(env, me, snatch)

    expect(ids).toContain(near.id)
    expect(ids).not.toContain(far.id)
  })
})

describe('【奇才】③ 端到端打一张', () => {
  it('黄月英对远处的人用【顺手牵羊】→ 真的拿到那张牌', async () => {
    const env = await heroEnv(HuangYueYing)
    const me = env.players()[0]!
    const far = env.players()[2]!

    const loot = giveCard(far, cardDef('sha', CardTag.Strike))
    const snatch = giveCard(me, cardDef('shunShouQianYang', CardTag.Snatch))
    env.decisions.script(me, '选择要获得的牌', loot)

    await env.engine.useCard(me, snatch, [far])

    expect(me.handCards.some((c) => c.instanceId === loot.instanceId)).toBe(true)
    expect(far.handCards.some((c) => c.instanceId === loot.instanceId)).toBe(false)
  })

  it('没有奇才的人打同一张 —— 目标不合法，牌留在手里', async () => {
    const env = await heroEnv(LvMeng)
    const me = env.players()[0]!
    const far = env.players()[2]!

    const loot = giveCard(far, cardDef('sha', CardTag.Strike))
    const snatch = giveCard(me, cardDef('shunShouQianYang', CardTag.Snatch))

    // 点名错误的种类：「抛了」不算数，得是**目标不合法**被拒
    await expect(env.engine.useCard(me, snatch, [far])).rejects.toThrow(/不是合法目标/)

    // 被拒的牌没被吞掉，也没进弃牌堆
    expect(me.handCards.some((c) => c.instanceId === snatch.instanceId)).toBe(true)
    expect(far.handCards.some((c) => c.instanceId === loot.instanceId)).toBe(true)
  })
})
