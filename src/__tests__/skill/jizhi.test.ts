// ============================================================
// 黄月英 · 集智 —— 补上那个「名字早写在注释里、本体一直没有」的英雄
//
// `src/source/heroes/standard.ts` 的文件头多年来写着
// 「Ionia / 吴 (3): 孙权、吕蒙、黄月英」，而 `standardHeroes` 里只有前两个。
// 这是「文档承诺了、代码没兑现」——比「压根没写」更难发现，因为
// 读注释的人以为它在。
//
// 这里钉三层：
//   ① 英雄与技能**登记齐全**（在册、有换皮、势力与体力对得上）
//   ② 集智真的会摸牌，且**只对非延时锦囊**生效
//   ③ 每条都配「它会动」的对照——用同一个英雄打一张**不是**锦囊的牌，
//      以及用**没有集智**的英雄打同一张锦囊，两次都不该摸。
//
// 「手牌数不变」这种断言天生软（0 − 0 也成立），所以一律同时看
// **牌堆有没有少一张**：摸牌只能从牌堆里来。
// ============================================================

import { describe, expect, it } from 'vitest'

import { GameBoot } from '@core/boot/game-boot'
import { Kingdom } from '@core/contracts/enums'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard, CardDefinition } from '@core/contracts/card.interface'
import { standard5pConfig } from '@source/modes/standard-5p'
import { HuangYueYing, LvMeng, standardHeroes, heroesByKingdom } from '@source/heroes/standard'
import { allHeroSkills } from '@source/heroes/skills'
import { GuoHeChaiQiao } from '@source/cards/tricks'
import { Sha } from '@source/cards/basic'
import { LOL_HERO_THEMES, LOL_SKILL_THEMES } from '@source/theme/lol-mapping'
import {
  ScriptedDecisionService,
  SilentLoggerService,
  IdentityRandomService,
  giveCard,
} from '../helpers/game-env'

/** 起一局**人人都是这个英雄**的 5 人局 */
async function oneHeroEnv(hero: (typeof standardHeroes)[number]) {
  const decisions = new ScriptedDecisionService()
  const boot = GameBoot.create(
    { ...standard5pConfig, heroes: [hero], heroSelectCount: 1, maxRounds: 2 },
    {
      loggerService: new SilentLoggerService(),
      randomService: new IdentityRandomService(),
      decisionService: decisions,
    },
  )
  await boot.boot()
  const engine = boot.getEngine()!
  return { engine, decisions, players: () => engine.state.players }
}

type Env = Awaited<ReturnType<typeof oneHeroEnv>>

/** 让 `me` 用一张牌打 `target`，返回手牌数与牌堆数的变化 */
async function useAndMeasure(
  engine: Env['engine'],
  me: IPlayer,
  def: CardDefinition,
  target: IPlayer,
): Promise<{ handDelta: number; deckDelta: number; card: ICard }> {
  const card = giveCard(me, def)
  const handBefore = me.handCards.length
  const deckBefore = engine.state.deck.length

  await engine.useCard(me, card, [target])

  return {
    handDelta: me.handCards.length - handBefore,
    deckDelta: engine.state.deck.length - deckBefore,
    card,
  }
}

// ═══════════════════════════════════════════
// ① 登记齐全
// ═══════════════════════════════════════════

describe('黄月英 · 登记', () => {
  it('她在标准英雄名单里，也在吴国那组里', () => {
    expect(standardHeroes.map((h) => h.id)).toContain('huangyueying')
    expect(heroesByKingdom[Kingdom.Ionia].map((h) => h.id)).toContain('huangyueying')
  })

  it('3 血、吴势力、挂着集智 —— 技能本体真的存在', () => {
    expect(HuangYueYing.maxHp).toBe(3)
    expect(HuangYueYing.kingdom).toBe(Kingdom.Ionia)
    expect(HuangYueYing.effectIds).toContain('jizhi')

    const skill = allHeroSkills.find((s) => s.id === 'jizhi')
    expect(skill, '集智没有注册进技能表').toBeDefined()
    expect(skill!.name).toBe('集智')
  })

  it('换皮表盖住了她与她的技能', () => {
    expect(LOL_HERO_THEMES['huangyueying']?.sgs).toBe('黄月英')
    expect(LOL_HERO_THEMES['huangyueying']?.name).toBe('卡尔玛')
    expect(LOL_SKILL_THEMES['jizhi']?.sgs).toBe('集智')
    expect(LOL_SKILL_THEMES['jizhi']?.name).toBe('灵光乍现')
  })
})

// ═══════════════════════════════════════════
// ② 集智真的会摸牌
// ═══════════════════════════════════════════

describe('集智 · 用一张非延时锦囊后摸一张', () => {
  it('用【过河拆桥】→ 手牌数不变，牌堆少一张', async () => {
    const env: Env = await oneHeroEnv(HuangYueYing)
    const players = env.players()
    const me = players[0]!
    const target = players[1]!

    const { handDelta, deckDelta, card } = await useAndMeasure(
      env.engine,
      me,
      GuoHeChaiQiao,
      target,
    )

    // 拆桥自己离手（−1），集智摸一张（+1）——净变化是 0；
    // 而那一张只能从牌堆里来，所以牌堆必须少了正好 1 张。
    expect(handDelta).toBe(0)
    expect(deckDelta).toBe(-1)
    expect(me.handCards.some((c) => c.instanceId === card.instanceId)).toBe(false)
  })

  it('对照：没有集智的英雄用同一张牌 → 手牌少一张、牌堆不动', async () => {
    const env: Env = await oneHeroEnv(LvMeng)
    const players = env.players()
    const me = players[0]!
    const target = players[1]!

    const { handDelta, deckDelta } = await useAndMeasure(
      env.engine,
      me,
      GuoHeChaiQiao,
      target,
    )

    expect(handDelta).toBe(-1)
    expect(deckDelta).toBe(0)
  })

  it('对照：黄月英用【杀】→ 不摸（杀不是锦囊）', async () => {
    const env: Env = await oneHeroEnv(HuangYueYing)
    const players = env.players()
    const me = players[0]!
    const target = players[1]!

    const { handDelta, deckDelta } = await useAndMeasure(env.engine, me, Sha, target)

    expect(handDelta).toBe(-1)
    expect(deckDelta).toBe(0)
  })

  it('摸的那张进了手牌（不是凭空少了一张牌堆）', async () => {
    const env: Env = await oneHeroEnv(HuangYueYing)
    const players = env.players()
    const me = players[0]!
    const target = players[1]!

    const handBefore = me.handCards.map((c) => c.instanceId)
    const { card } = await useAndMeasure(env.engine, me, GuoHeChaiQiao, target)
    const handAfter = me.handCards.map((c) => c.instanceId)

    // 拆桥走了，多出来的那张不是它自己
    const gained = handAfter.filter((id) => !handBefore.includes(id))
    expect(gained).toHaveLength(1)
    expect(gained[0]).not.toBe(card.instanceId)
  })
})
