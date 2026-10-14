// ============================================================
// Phase · D39 —— 出牌阶段统一走 `useCard`
//
// 原状：`PhaseManager.doPhaseUse` 自己抄了一份用牌流程
// （移入处理区 → 发 useCard 事件 → 结算入弃牌堆），**不过目标校验**。
// `TargetSystem.validateTargets` 写得再完整，从这条路走出去的牌
// 一个字都不读它——「出牌时非法目标被拒绝」这条验收在出牌阶段一直落空。
//
// 抄一份还顺带埋了一个真 bug：那份内联实现无条件调
// `finishProcessing`，而它对**不在处理区**的牌是抛错的。装上武器的那一刻
// 牌已经在装备区，于是抛错 → 被 `catch { phaseEnded = true }` 吞掉 →
// **出牌阶段当场结束**：装完刀这一回合就再也打不出牌了。
//
// 这里钉三层，缺一层就会退回去：
//
//  ① **非法目标在出牌阶段真的被拒** —— 牌留在手牌、目标没掉血、
//     而且出牌阶段**没有**被静默结束（还会再问一次）。
//  ② **装完装备还能继续出牌** —— 那条内联实现当年就是在这里断的。
//  ③ **源码级**：出牌阶段不再自己发那个事件。
//
// 每层都配一条对照：被拒的牌「还在手上」也可能是压根没被选中，
// 所以非法目标那个测试同时钉了「用合法目标时它真的打出去了」。
// ============================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { Sha } from '@source/cards/basic'
import { QingGangJian, ZhuGeLianNu } from '@source/cards/equips'
import { createTestEnv, giveCard, ScriptedDecisionService } from '../helpers/game-env'
import type { CardPlayOption, CardPlayResult } from '@core/contracts/services.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'

// `process.cwd()` 而不是 `fileURLToPath(import.meta.url)`：
// vitest 里的 `import.meta.url` 不是 file: 协议，解析会直接炸。
const PROJECT_ROOT = process.cwd()

/**
 * 按脚本出牌的决策服务
 *
 * 每一步是一个「看着这一轮的候选，决定打哪张打谁」的函数；
 * 脚本走完就返回 `null`（结束出牌阶段）。
 *
 * 用函数而不是「预先点名的牌」是因为**非法目标只能在拿到候选那一刻才算
 * 出来**——谁不在 `validTargets` 里，取决于这一局的距离与装备，
 * 写死座次会在换一种牌堆顺序时突然变成合法目标。
 */
class ScriptedPlays extends ScriptedDecisionService {
  private steps: Array<(options: CardPlayOption[]) => CardPlayResult | null> = []

  push(step: (options: CardPlayOption[]) => CardPlayResult | null): void {
    this.steps.push(step)
  }

  override async askForCardPlay(
    player: IPlayer,
    options: CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    this.asked.push(`${player.id}:出牌阶段`)
    const step = this.steps.shift()
    return step ? step(options) : null
  }
}

/** 从这一轮的候选里按**实例**取那张牌（同名的牌可能有一大把） */
function optionOf(options: CardPlayOption[], card: ICard): CardPlayOption {
  const found = options.find((o) => o.card.instanceId === card.instanceId)
  expect(found, `候选里没有那张「${card.name}」`).toBeDefined()
  return found!
}

/** 跑完当前玩家的一个回合（`start()` 只开局，回合要自己发起） */
async function runOneTurn(engine: { start(): Promise<void> }): Promise<void> {
  await engine.start()
  // `engine` 到这一层还是 `TestEnv['engine']`；`phaseManager` 是它的公开成员
  await (engine as unknown as { phaseManager: { executeTurn(): Promise<boolean> } }).phaseManager.executeTurn()
}

// ═══════════════════════════════════════════
// ① 非法目标在出牌阶段真的被拒
// ═══════════════════════════════════════════

describe('D39 · 出牌阶段真的过目标校验', () => {
  it('挑一个不在合法目标里的人 —— 牌留在手牌、那人没掉血', async () => {
    const plays = new ScriptedPlays()
    const { engine, players } = await createTestEnv(plays)
    const [p0] = players()

    const sha = giveCard(p0, Sha)
    // 备一张非杀的可出牌：杀被拒后会被摘出候选，
    // 手里得还有别的东西，否则「还会再问一次」无从谈起。
    giveCard(p0, ZhuGeLianNu)

    let illegal: IPlayer | undefined
    plays.push((options) => {
      const option = optionOf(options, sha)
      illegal = engine.state.players.find(
        (p) => !option.validTargets.some((t) => t.id === p.id),
      )
      return { card: sha, targets: illegal ? [illegal] : [] }
    })
    plays.push(() => null)

    const hpBefore = new Map(engine.state.players.map((p) => [p.id, p.hp]))
    await runOneTurn(engine)

    // 先证明「真有一个非法目标被挑出来了」，否则下面两句可能只是没人被打
    expect(illegal).toBeDefined()

    expect(p0.handCards.some((c) => c.instanceId === sha.instanceId)).toBe(true)
    expect(illegal!.hp).toBe(hpBefore.get(illegal!.id))
  })

  it('被拒之后出牌阶段没有结束 —— 还会再问一次', async () => {
    const plays = new ScriptedPlays()
    const { engine, players } = await createTestEnv(plays)
    const [p0] = players()

    const sha = giveCard(p0, Sha)
    giveCard(p0, ZhuGeLianNu)

    plays.push((options) => {
      const option = optionOf(options, sha)
      const illegal = engine.state.players.find(
        (p) => !option.validTargets.some((t) => t.id === p.id),
      )
      return { card: sha, targets: illegal ? [illegal] : [] }
    })
    plays.push(() => null)

    await runOneTurn(engine)

    // 2 = 被拒一次 + 问第二次时答复「结束」。
    // 写成 1 就是说「阶段当场结束」——那正是那份内联实现干的事；
    // 写成很大一个数就是说「同一张牌被无限次选中又无限次被拒」。
    expect(plays.askCount(p0, '出牌阶段')).toBe(2)
    // 同一时刻也钉住「被拒的那张牌没被消耗掉」：否则「又被问了一次」
    // 可能只是它打出去了、换下一张接着问。
    expect(p0.handCards.some((c) => c.instanceId === sha.instanceId)).toBe(true)
  })

  it('对照：用合法目标时它真的打出去了 —— 不是「谁都没选中」', async () => {
    const plays = new ScriptedPlays()
    const { engine, players } = await createTestEnv(plays)
    const [p0] = players()

    const sha = giveCard(p0, Sha)

    let victim: IPlayer | undefined
    plays.push((options) => {
      const option = optionOf(options, sha)
      victim = option.validTargets[0]
      return { card: sha, targets: victim ? [victim] : [] }
    })
    plays.push(() => null)

    await runOneTurn(engine)

    expect(victim).toBeDefined()
    expect(victim!.hp).toBeLessThan(victim!.maxHp)
    expect(p0.handCards.some((c) => c.instanceId === sha.instanceId)).toBe(false)
  })
})

// ═══════════════════════════════════════════
// ② 装完装备还能继续出牌
// ═══════════════════════════════════════════

describe('D39 · 装上装备之后出牌阶段不再被掐断', () => {
  it('先装刀再出杀 —— 两件事都在同一个回合里发生了', async () => {
    const plays = new ScriptedPlays()
    const { engine, players } = await createTestEnv(plays)
    const [p0] = players()

    const blade = giveCard(p0, QingGangJian)
    const sha = giveCard(p0, Sha)

    // 第一步：装刀。装备牌不设目标。
    plays.push((options) => ({ card: optionOf(options, blade).card, targets: [] }))
    // 第二步：出杀，打一个此刻够得着的人
    let victim: IPlayer | undefined
    plays.push((options) => {
      const option = optionOf(options, sha)
      victim = option.validTargets[0]
      return { card: sha, targets: victim ? [victim] : [] }
    })
    plays.push(() => null)

    await runOneTurn(engine)

    // 刀真的在装备区（不是进了弃牌堆）
    expect(p0.equipCards.some((c) => c.instanceId === blade.instanceId)).toBe(true)
    // 杀也真的打出去了 —— 原状下装完刀那一抛就结束了整个阶段，这一句必红
    expect(victim).toBeDefined()
    expect(victim!.hp).toBeLessThan(victim!.maxHp)
    expect(plays.askCount(p0, '出牌阶段')).toBe(3)
  })
})

// ═══════════════════════════════════════════
// ③ 出牌阶段不再自己发那个事件
// ═══════════════════════════════════════════

describe('D39 · 用牌只有一条路', () => {
  it('出牌阶段调用的是注入进来的用牌入口', () => {
    const src = readFileSync(
      join(PROJECT_ROOT, 'src/core/engine/phase-manager.ts'),
      'utf8',
    )

    expect(src).toMatch(/this\.useCard\(player, result\.card, result\.targets\)/)
    // 那份内联实现留下来的痕迹：它曾自己建一个「用牌」事件再自己派发
    expect(src).not.toMatch(/cardUseEvent/)
  })

  it('引擎把那个入口递给了阶段管理器 —— 递的是本类唯一的用牌方法', () => {
    const src = readFileSync(join(PROJECT_ROOT, 'src/core/engine/game-engine.ts'), 'utf8')

    expect(src).toMatch(/useCard: \(player, card, targets\) =>/)
  })
})
