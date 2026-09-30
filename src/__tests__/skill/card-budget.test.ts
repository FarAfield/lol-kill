// ============================================================
// D8 —— 杀的额度只有一个出口（形态甲）
//
// 症状（结清前）：
//   装上【诸葛连弩】→ 出牌阶段的选项说「可以无限出」（走 `mod.cardUsable`），
//   但 AI 问的是 `player.canAttack`，它算 `attackLimit > (usedAttackThisTurn ? 1 : 0)`
//   —— 一个不经过 Mod 注册表的算式，`attackLimit` 还停在 1，于是 AI 不肯出第二刀。
//   **同一件事，两个答案。**
//
// 形态甲的裁决：判定统一为「已用次数 < `mod.cardUsable`」，
// `usedAttackThisTurn` 降级为事实账本（技能 filter 继续读它），
// `Player.canAttack` 删除。
//
// 这里的用例因此分两组：
//   1. 行为：连弩在场与否，答案应该不一样，且**两处调用点答案一致**
//   2. 结构：全仓不再有第二处判定（源码级扫描）
// ============================================================

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import { CardTag } from '@core/contracts/card-tag'
import { ZoneType } from '@core/contracts/enums'
import { ZhuGeLianNu } from '@source/cards/equips'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { cardDef, createTestEnv, giveCard, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

const PROJECT_ROOT = process.cwd()

/** 与 `src/source/cards/basic.ts` 的 sha 同 tags */
function strike(user: IPlayer): ICard {
  return giveCard(user, cardDef('sha', [CardTag.Strike, CardTag.Attack, CardTag.Basic]))
}

/** 出牌阶段的选项里还有没有这张杀 */
function strikeInPlayableOptions(player: IPlayer, card: ICard): boolean {
  const pm = env.engine.phaseManager as unknown as {
    getPlayableCards(p: IPlayer, used: Map<string, number>): ICard[]
  }
  return pm
    .getPlayableCards(player, new Map())
    .some((c) => c.instanceId === card.instanceId)
}

describe('D8 · 额度判定的行为', () => {
  it('没出过杀 → 可以出', () => {
    const [player] = env.players()
    const card = strike(player!)

    expect(env.engine.cardBudget.canPlay(player!, card)).toBe(true)
    expect(strikeInPlayableOptions(player!, card)).toBe(true)
  })

  it('已出 1 张杀、无连弩 → 不可再出', () => {
    const [player] = env.players()
    const card = strike(player!)
    env.engine.playerSystem.markAttackUsed(player!)

    expect(env.engine.cardBudget.canPlay(player!, card)).toBe(false)
    expect(strikeInPlayableOptions(player!, card)).toBe(false)
  })

  it('已出 1 张杀、装了连弩 → 仍可出（这是 D8 的直接症状）', () => {
    const [player] = env.players()
    const card = strike(player!)
    const crossbow = giveCard(player!, ZhuGeLianNu as never)
    env.engine.cardSystem.equipCard(crossbow, player!)
    env.engine.playerSystem.markAttackUsed(player!)

    // 两处调用点必须给出**同一个**答案
    expect(env.engine.cardBudget.canPlay(player!, card)).toBe(true)
    expect(strikeInPlayableOptions(player!, card)).toBe(true)
  })

  it('回合重置后账本归零 → 又能出了', () => {
    const [player] = env.players()
    const card = strike(player!)
    env.engine.playerSystem.markAttackUsed(player!)
    env.engine.playerSystem.resetTurnState(player!)

    expect(player!.usedAttackThisTurn).toBe(false)
    expect(env.engine.cardBudget.canPlay(player!, card)).toBe(true)
  })

  it('虚拟杀与真杀共用同一份账本（武圣的红牌不是无限刀）', () => {
    const [player] = env.players()
    const real = strike(player!)
    const virtual = giveCard(
      player!,
      cardDef('wuShengSha', [CardTag.Strike, CardTag.Attack, CardTag.Basic]),
    )
    expect(virtual.zone).toBe(ZoneType.Hand)

    env.engine.playerSystem.markAttackUsed(player!)

    expect(env.engine.cardBudget.canPlay(player!, real)).toBe(false)
    expect(env.engine.cardBudget.canPlay(player!, virtual)).toBe(false)
  })
})

describe('D8 · 全仓不再有第二处判定（源码级）', () => {
  /**
   * 允许出现 `usedAttackThisTurn` 的**生产**文件
   *
   * 只允许两件事：声明/维护这本账，以及拿它当「已用次数」代入判定。
   * 不允许第二处自己拿它算出「能不能」。
   */
  const LEDGER_ONLY = new Set([
    'src/core/entity/player.ts', // 字段声明与快照
    'src/core/contracts/player.interface.ts', // 接口声明
    'src/core/system/player-system.ts', // markAttackUsed / resetTurnState
    'src/core/skill/card-budget.ts', // 唯一的判定：拿它当**已用次数**
    'src/source/heroes/skills/wu-skills.ts', // 克己的 filter：读的是事实，不是结论
  ])

  /** 只扫生产代码：测试里断言账本本身是无害的，风险从来在实现侧 */
  const SCAN_ROOTS = ['src/core', 'src/source', 'src/services', 'src/views', 'src/stores']

  function walk(dir: string, out: string[] = []): string[] {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return out // 目录不存在就跳过（例如还没有 stores/）
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(abs, out)
      } else if (/\.(ts|vue)$/.test(entry.name)) {
        out.push(relative(PROJECT_ROOT, abs).replace(/\\/g, '/'))
      }
    }
    return out
  }

  /** 注释里提到这个名字不算数——要盯的是**代码**里有没有第二处判定 */
  function hasRealReference(text: string): boolean {
    return text
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .some((line) => line.includes('usedAttackThisTurn'))
  }

  it('`usedAttackThisTurn` 只出现在账本与判定处，没有第三处拿它下结论', () => {
    const offenders: string[] = []

    for (const root of SCAN_ROOTS) {
      for (const file of walk(join(PROJECT_ROOT, root))) {
        if (LEDGER_ONLY.has(file)) continue
        if (hasRealReference(readFileSync(join(PROJECT_ROOT, file), 'utf8'))) {
          offenders.push(file)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('`canAttack` 已从玩家身上摘掉 —— 它曾是那个不经过 Mod 的第二答案', () => {
    const player = readFileSync(join(PROJECT_ROOT, 'src/core/entity/player.ts'), 'utf8')
    const contract = readFileSync(
      join(PROJECT_ROOT, 'src/core/contracts/player.interface.ts'),
      'utf8',
    )

    // 只看**声明**：注释里留着这个名字是为了说明它为什么消失
    expect(player).not.toContain('get canAttack(')
    expect(contract).not.toContain('readonly canAttack')
  })
})
