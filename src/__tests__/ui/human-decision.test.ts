// ============================================================
// Phase 27 · D34 —— 人类玩家的决策通道（HumanDecisionService）
//
// 这一层只做一件事：**按座位分流**。
// 它不是「把 UI 包装成一个决策服务」——引擎对**所有座位**提问，
// 除了人类那一位，其余都是 AI。把他们的问题也弹给人看，
// 等于让人替 AI 打牌。
//
// 因此这里钉两件事：
//
//  ① **分流本身**：同一个方法，人类座位必须走 UI 通道、
//     AI 座位必须走兜底，两边互不打扰。只测一边是不够的 ——
//     「所有提问都弹给 UI」在今天的手感和「全部替 AI 回答」一样软件上说得通。
//  ② **没有答案 = 死锁**：这些问题是在事件流水线被 pause 挂起时问出来的，
//     一个永不 resolve 的 Promise 会让整局卡死。
//     所以每条缺省答案都要能准时到达，并且**必须是合法的**
//     （弃牌要弃够张数、选英雄不能返回空 id）。
// ============================================================

import { describe, expect, it } from 'vitest'

import { HumanDecisionService } from '@/services/human-decision'
import type { DecisionChannel, HeroCandidate } from '@/services/human-decision'
import type { IUIDecisionService } from '@core/contracts/services.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { Shan, Tao } from '@source/cards/basic'
import { createTestEnv, giveCard } from '../helpers/game-env'

/** 兜底决策方的替身：记下每一次被调用，返回能让流程走下去的答复 */
class Recorder implements IUIDecisionService {
  readonly calls: Array<{ method: string; seatIndex: number }> = []
  readonly injections: string[] = []

  private note(method: string, player: IPlayer): void {
    this.calls.push({ method, seatIndex: player.seatIndex })
  }

  async askForCardPlay(player: IPlayer) {
    this.note('askForCardPlay', player)
    return null
  }
  async askForResponse(player: IPlayer) {
    this.note('askForResponse', player)
    return null
  }
  async askForTarget(player: IPlayer) {
    this.note('askForTarget', player)
    return []
  }
  async askForDiscard(player: IPlayer, count: number, validCards: ICard[]) {
    this.note('askForDiscard', player)
    return validCards.slice(0, count)
  }
  async askForEffectUse(player: IPlayer) {
    this.note('askForEffectUse', player)
    return null
  }
  async askForHeroSelect(player: IPlayer, candidates: HeroCandidate[]) {
    this.note('askForHeroSelect', player)
    return candidates[0]?.id ?? ''
  }
  notifyPlayer(player: IPlayer) {
    this.note('notifyPlayer', player)
  }
  notifyAll() {
    this.calls.push({ method: 'notifyAll', seatIndex: -1 })
  }
  async showGameResult() {
    this.calls.push({ method: 'showGameResult', seatIndex: -1 })
  }
  setCardBudget() {
    this.injections.push('budget')
  }
  setModQuery() {
    this.injections.push('modQuery')
  }
  setSkillRegistry() {
    this.injections.push('skillRegistry')
  }
}

/**
 * 兜底AUTO —— 答案必须在时限内到达
 *
 * 直接 `await` 一个永不 resolve 的 Promise，测试也会红（超时），
 * 但报的是「这条用例 5 秒没跑完」，读的人得自己想到是死锁。
 * 这里把那句话直接说出来。
 */
async function mustResolve<T>(promise: Promise<T>, what: string): Promise<T> {
  const late = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`${what} 一直没答复 —— 事件流水线会死锁在这里`)), 200)
  })
  return Promise.race([promise, late])
}

async function setup(channel?: DecisionChannel) {
  const env = await createTestEnv()
  const fallback = new Recorder()
  const service = new HumanDecisionService({ fallback, channel })

  return {
    service,
    fallback,
    human: env.players()[0]!,
    ai: env.players()[1]!,
  }
}

const HEROES: HeroCandidate[] = [
  { id: 'caocao', name: '曹操', title: '魏武帝', kingdom: 'wei' },
  { id: 'guanyu', name: '关羽', title: '美髯公', kingdom: 'shu' },
]

// ═══════════════════════════════════════════
// ① 按座位分流
// ═══════════════════════════════════════════

describe('D34 · 提问按座位分流', () => {
  it('轮到人类 —— 走 UI 通道，不惊动兜底', async () => {
    const fromChannel = Symbol('from-channel')
    let asked = 0
    const { service, fallback, human } = await setup({
      askForCardPlay: async () => {
        asked += 1
        return fromChannel as never
      },
    })

    const answer = await service.askForCardPlay(human, [])

    expect(answer).toBe(fromChannel)
    // 同一件事的反面：兜底一次都没被吵醒
    expect(fallback.calls).toEqual([])
    expect(asked).toBe(1)
  })

  it('轮到 AI —— 走兜底，UI 通道一次都不问', async () => {
    let asked = 0
    const { service, fallback, ai } = await setup({
      askForCardPlay: async () => {
        asked += 1
        return null
      },
    })

    await service.askForCardPlay(ai, [])

    expect(fallback.calls).toEqual([{ method: 'askForCardPlay', seatIndex: ai.seatIndex }])
    expect(asked).toBe(0)
  })

  it('六种提问都按这套规矩走 —— 逐个各问一遍', async () => {
    const { service, fallback, human, ai } = await setup({})
    // 座位决定了流向，因此同一个实例对着两个座位各问一遍，
    // 兜底只应看到 AI 那一份。
    await service.askForCardPlay(human, [])
    await service.askForResponse(human, '请出闪', [])
    await service.askForTarget(human, [], '请选择目标')
    await service.askForDiscard(human, 0, [])
    await service.askForEffectUse(human, [] as ISkill[], '是否发动')
    await service.askForHeroSelect(human, HEROES, 1)
    expect(fallback.calls).toEqual([])

    await service.askForCardPlay(ai, [])
    await service.askForResponse(ai, '请出闪', [])
    await service.askForTarget(ai, [], '请选择目标')
    await service.askForDiscard(ai, 0, [])
    await service.askForEffectUse(ai, [] as ISkill[], '是否发动')
    await service.askForHeroSelect(ai, HEROES, 1)

    expect(fallback.calls.map((c) => c.method)).toEqual([
      'askForCardPlay',
      'askForResponse',
      'askForTarget',
      'askForDiscard',
      'askForEffectUse',
      'askForHeroSelect',
    ])
    // 每一行要么来自 AI、要么本来就没有座位（notifyAll 那类）
    expect(fallback.calls.every((c) => c.seatIndex === ai.seatIndex)).toBe(true)
  })
})

// ═══════════════════════════════════════════
// ② 没有 UI 通道时不能挂，且答案必须合法
// ═══════════════════════════════════════════

describe('D34 · 缺省答案：不挂，且不越界', () => {
  it('各种询问都准时答复', async () => {
    const { service, human } = await setup()

    expect(await mustResolve(service.askForCardPlay(human, []), '出牌')).toBeNull()
    expect(await mustResolve(service.askForResponse(human, '请出闪', []), '响应')).toBeNull()
    expect(await mustResolve(service.askForTarget(human, [], '选目标'), '选目标')).toEqual([])
    expect(await mustResolve(service.askForEffectUse(human, [], '发动吗'), '发动技能')).toBeNull()
  })

  it('弃牌缺省要**弃够张数** —— 少弃一张手牌就还超上限', async () => {
    const { service, human } = await setup()
    for (const def of [Shan, Tao, Shan, Tao, Shan]) giveCard(human, def)

    const answer = await mustResolve(service.askForDiscard(human, 3, human.handCards), '弃牌')

    expect(answer.length).toBe(3)
    // 挑的必须是给出去的那几张里的，不能凭空造牌
    expect(answer.every((c) => human.handCards.includes(c))).toBe(true)
  })

  it('选英雄缺省不能返回空 id —— 那是「选了个不存在的英雄」', async () => {
    const { service, human } = await setup()

    const answer = await mustResolve(service.askForHeroSelect(human, HEROES, 1), '选英雄')

    expect(answer).toBe('caocao')
  })
})

// ═══════════════════════════════════════════
// ③ 三个查询口要转给兜底（AI 的眼睛）
// ═══════════════════════════════════════════

describe('D34 · 查询口转发', () => {
  it('额度 / Mod / 技能台账原样递给兜底', async () => {
    // 人类不需要它们，但兜底的 AI 需要：看不见额度就没有连弩（D8）、
    // 看不见 Mod 就算不出藤甲的加伤（D19）、没有台账威胁度一律为 0（D21）。
    const { service, fallback } = await setup()

    service.setCardBudget?.(undefined as never)
    service.setModQuery?.(undefined as never)
    service.setSkillRegistry?.(undefined as never)

    expect(fallback.injections).toEqual(['budget', 'modQuery', 'skillRegistry'])
  })
})
