// ============================================================
// D40 · 引擎自己拼的那几句文案也要换皮
//
// 换皮（D27）做完之后还剩半句没换：界面上的卡牌 / 英雄 / 技能名是 LOL 的，
// 可**引擎自己拼的整句**里仍然是三国杀的名字——日志的「关羽回复了 2 点体力」、
// 濒死求桃的提问、目标非法的拒绝原因。换皮表在展示层，引擎拿不到它，
// 于是这几句谁也换不掉。
//
// 正解**不是**让引擎去查表（那等于让规则层背上一套皮肤），
// 而是**引擎只记 ID**：句子里写占位符，名字由展示层在边界上补。
//
// 这个文件钉四层：
//
//   ① 占位符 → 名字（`resolveNameSlots`，全仓唯一出口）
//   ② 引擎真值里只剩 ID：起一局真打一张桃，看进 `state.log` 的那句
//   ③ 提问文案：濒死那句问出去的是 ID，弹窗上显示的是 LOL 名
//   ④ 源码级：引擎不许再拼姓名，也不许 import 换皮表
//
// 「等于某个值」这类断言天生软——`'德莱厄斯' === '德莱厄斯'` 也绿——
// 所以每条都配了「它会动」的对照（换个英雄 / 换个 id，名字要跟着变），
// 以及「扫到了 N 处」的对照（「没有不一致」也可能是「一处都没扫到」）。
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { GameEvent } from '@core/event'
import { GamePhase, LogLevel } from '@core/contracts/enums'
import type { IPlayer } from '@core/contracts/player.interface'
import { Tao } from '@source/cards/basic'
import { lolHeroName, lolPromptText, resolveNameSlots } from '@source/theme/lol-mapping'
import { useLogStore } from '@/store/log-store'
import { createTestEnv, giveCard, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  setActivePinia(createPinia())
  env = await createTestEnv()
})

/** 派发一次真实伤害 */
async function damage(from: IPlayer, to: IPlayer, num: number): Promise<void> {
  await env.engine.eventDispatcher.dispatch(
    new GameEvent({ name: 'damage', source: from, player: from, targets: [to], num }),
    env.engine.eventChain,
  )
}

/** 递归读一个目录下的全部 .ts（展示层与引擎层的源码级断言共用） */
function sourceOf(dir: string): string {
  let out = ''
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (full.endsWith('.ts')) out += readFileSync(full, 'utf8')
    }
  }
  walk(join(process.cwd(), dir))
  return out
}

/** 读单个源文件 */
function fileOf(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), 'utf8')
}

// ═══════════════════════════════════════════
// ① 占位符 → 名字
// ═══════════════════════════════════════════

describe('D40 · 占位符换成 LOL 名', () => {
  it('英雄占位符 → 英雄名（关羽 → 德莱厄斯）', () => {
    expect(resolveNameSlots('{hero:guanyu} 回复了 2 点体力')).toBe(
      '德莱厄斯 回复了 2 点体力',
    )
  })

  it('卡牌占位符 → 牌名（桃 → 治疗术）', () => {
    expect(resolveNameSlots('是否打出【{card:tao}】？')).toBe('是否打出【治疗术】？')
  })

  it('一句里有好几个占位符时逐个换 —— 写死一个名字的话这条立刻红', () => {
    expect(resolveNameSlots('{hero:guanyu} 对 {hero:caocao} 使用 {card:sha}')).toBe(
      '德莱厄斯 对 盖伦 使用 致命打击',
    )
  })

  it('换个 id 名字跟着变 —— 这是「它会动」的对照', () => {
    expect(resolveNameSlots('{hero:caocao}')).toBe('盖伦')
    expect(resolveNameSlots('{hero:guanyu}')).toBe('德莱厄斯')
    expect(resolveNameSlots('{hero:caocao}')).not.toBe(resolveNameSlots('{hero:guanyu}'))
  })

  it('查不到换皮的 id 退回 id 本身 —— 不许换成空白或 undefined', () => {
    expect(resolveNameSlots('{hero:seat-9}')).toBe('seat-9')
    expect(resolveNameSlots('{card:not-a-card}')).toBe('not-a-card')
  })

  it('没有占位符的句子原样返回（视图自己写的那几句不受影响）', () => {
    const text = '🎮 游戏初始化完成 —— 5 名玩家'
    expect(resolveNameSlots(text)).toBe(text)
  })
})

// ═══════════════════════════════════════════
// ② 引擎进游戏状态的日志里只剩 ID
// ═══════════════════════════════════════════

describe('D40 · 引擎只记 ID', () => {
  /**
   * 真打一张桃 —— 桃的内容会调 `ctx.recoverHp`，那是引擎唯一一处
   * 往游戏状态里写日志的地方。不直接调 `recoverHp`：那样能证明函数写对了，
   * 证明不了「用一张桃真的会走到它」。
   */
  async function playTaoOnSelf(): Promise<{ healer: IPlayer; message: string }> {
    const healer = env.players()[1]!

    // 先掉一点血：满血时桃没有合法目标，用不出去
    await damage(env.players()[0]!, healer, 1)
    expect(healer.hp).toBeLessThan(healer.maxHp)

    const peach = giveCard(healer, Tao)
    const before = env.engine.state.log.length
    await env.engine.useCard(healer, peach, [healer])

    const added = env.engine.state.log.slice(before)
    const healLog = added.find((e) => e.message.includes('回复了'))
    expect(healLog, '用桃之后日志里没有回复那一句').toBeDefined()

    return { healer, message: healLog!.message }
  }

  it('日志里是占位符，不是三国杀的姓名', async () => {
    const { healer, message } = await playTaoOnSelf()

    expect(message).toContain(`{hero:${healer.hero!.id}}`)
    expect(message).not.toContain(healer.hero!.name)
  })

  it('同一个人，展示层拼出来的是 LOL 名 —— 两头都取一次值', async () => {
    const { healer, message } = await playTaoOnSelf()

    // 这两句是一组：引擎真值是 ID，显示值是 LOL 名。少取一边就成了句废话。
    expect(message).toContain(`{hero:${healer.hero!.id}}`)
    expect(resolveNameSlots(message)).toContain(lolHeroName(healer.hero!.id, healer.hero!.id))
    // 换皮没倒流进引擎：引擎那句里没有 LOL 名
    expect(message).not.toContain(lolHeroName(healer.hero!.id, healer.hero!.id))
  })

  it('它确实会动：给另一个英雄用桃，日志里的 id 跟着变', async () => {
    const first = await playTaoOnSelf()

    env = await createTestEnv()
    const other = env.players()[3]!
    await damage(env.players()[2]!, other, 1)
    const peach = giveCard(other, Tao)
    const before = env.engine.state.log.length
    await env.engine.useCard(other, peach, [other])
    const added = env.engine.state.log.slice(before)
    const message = added.find((e) => e.message.includes('回复了'))!.message

    expect(message).toContain(`{hero:${other.hero!.id}}`)
    // 「两次都写着同一个 id」也会让上一条通过，所以这里要求两个 id 不同
    expect(other.hero!.id).not.toBe(first.healer.hero!.id)
  })
})

// ═══════════════════════════════════════════
// ③ 濒死求桃的提问文案
// ═══════════════════════════════════════════

describe('D40 · 提问文案里的名字', () => {
  /**
   * 打出一次致命伤害，把濒死那句提问捞出来（去掉「谁被问」的前缀）
   *
   * 濒死者手里得先有一张桃：求桃窗口只在「真有人出得起桃」时才开，
   * 一个人都没有的话压根不会问——那样就捞不到这句文案。
   */
  async function dyingPrompt(seat: number): Promise<{ victim: IPlayer; raw: string }> {
    const players = env.players()
    const victim = players[seat]!
    giveCard(victim, Tao)

    await damage(players[(seat + 3) % players.length]!, victim, 99)

    const asked = env.decisions.asked.filter((entry) => entry.includes('濒死'))
    expect(asked.length, '濒死了却没人被问').toBeGreaterThan(0)

    const raw = asked[0]!.slice(asked[0]!.indexOf(':') + 1)
    return { victim, raw }
  }

  it('引擎问出去的那句里是占位符，不是姓名', async () => {
    const { victim, raw } = await dyingPrompt(4)

    expect(victim.hero).toBeDefined()
    expect(raw).toContain(`{hero:${victim.hero!.id}}`)
    expect(raw).not.toContain(victim.hero!.name)
    // 牌名也一样：不是「桃」这两个字，是它的定义 id
    expect(raw).toContain('{card:tao}')
    expect(raw).not.toMatch(/出桃/)
  })

  it('弹窗上显示的是 LOL 名与 LOL 牌名', async () => {
    const { victim, raw } = await dyingPrompt(4)
    const shown = lolPromptText(raw)

    expect(shown).toContain(lolHeroName(victim.hero!.id, victim.hero!.id))
    expect(shown).not.toContain(victim.hero!.name)
    // 桃 → 治疗术，且保留【】——界面上的牌名一律带框
    expect(shown).toContain('【治疗术】')
    expect(shown).not.toContain('【桃】')
  })

  it('它确实会动：换一个濒死者，问出去的 id 与显示的名字都跟着变', async () => {
    const first = await dyingPrompt(4)

    env = await createTestEnv()
    const second = await dyingPrompt(3)

    // 「两次都写着同一个 id」也会让前两条通过，所以这里要求两个 id 不同
    expect(second.victim.hero!.id).not.toBe(first.victim.hero!.id)
    expect(lolPromptText(second.raw)).not.toBe(lolPromptText(first.raw))
    expect(second.raw).toContain(`{hero:${second.victim.hero!.id}}`)
  })
})

// ═══════════════════════════════════════════
// ④ 展示层的边界：日志进 Store 的那一刻换皮
// ═══════════════════════════════════════════

describe('D40 · 日志 Store 是换皮的边界', () => {
  it('引擎那句占位符文案，进 Store 之后是 LOL 名', () => {
    const logStore = useLogStore()

    logStore.addLog({
      id: 'log-1',
      round: 1,
      phase: GamePhase.PhaseUse,
      message: '{hero:guanyu} 回复了 2 点体力',
      level: LogLevel.Info,
    })

    expect(logStore.entries[0]!.message).toBe('德莱厄斯 回复了 2 点体力')
    expect(logStore.coloredEntries[0]!.message).toBe('德莱厄斯 回复了 2 点体力')
  })

  it('批量进来的也换（`addLogs` 与 `addLog` 不许各写一套）', () => {
    const logStore = useLogStore()

    logStore.addLogs([
      {
        id: 'log-2',
        round: 1,
        phase: GamePhase.PhaseUse,
        message: '{hero:zhaoyun} 回复了 1 点体力',
        level: LogLevel.Info,
      },
    ])

    expect(logStore.entries[0]!.message).toBe('锐雯 回复了 1 点体力')
  })

  it('视图自己写的那句没有占位符 —— 原样进、原样出', () => {
    const logStore = useLogStore()

    logStore.addLog({
      id: 'log-3',
      round: 0,
      phase: GamePhase.Prepare,
      message: '🎮 游戏初始化完成 —— 5 名玩家',
      level: LogLevel.Info,
    })

    expect(logStore.entries[0]!.message).toBe('🎮 游戏初始化完成 —— 5 名玩家')
  })
})

// ═══════════════════════════════════════════
// ⑤ 源码级：换皮没有倒流进引擎
// ═══════════════════════════════════════════

describe('D40 · 引擎不拼姓名、也不认识换皮表', () => {
  it('引擎层不再出现姓名 —— 一律走占位符', () => {
    const core = sourceOf('src/core')

    expect(core).not.toMatch(/hero\??\.name/)
    expect(core).not.toMatch(/heroes\[0\]\.name/)

    // 对照：占位符的两个出口真的被用上了，
    // 否则上一条只是因为「两边都不存在」才通过的。
    expect(fileOf('src/core/engine/effect-context.ts')).toMatch(/heroSlot\(/)
    expect(fileOf('src/core/engine/effect-context.ts')).toMatch(/cardSlot\(/)
    expect(fileOf('src/core/system/target-system.ts')).toMatch(/heroSlot\(/)
  })

  it('引擎不 import 换皮表', () => {
    const core = sourceOf('src/core')

    expect(core).not.toMatch(/^import[^\n]*lol-mapping/m)
    // 对照：那张表确实存在
    expect(sourceOf('src/source/theme')).toMatch(/export function resolveNameSlots/)
  })

  it('占位符的解析只有一处 —— 展示层不许各写一份', () => {
    // 日志进 Store 时换一次（`log-store`），提问进窗口时换一次
    // （`useResponse`），但两处调的是同一个函数。
    expect(fileOf('src/store/log-store.ts')).toMatch(/resolveNameSlots\(/)
    expect(fileOf('src/hooks/useResponse.ts')).toMatch(/lolPromptText\(/)
    // 换皮表之外不许再出现第二个解析实现
    const theme = sourceOf('src/source/theme')
    expect(theme.match(/export function resolveNameSlots/g)).toHaveLength(1)
  })
})
