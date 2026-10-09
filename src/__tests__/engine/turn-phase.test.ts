// ============================================================
// Phase 22 · 回合与阶段 —— D7 / D29 与「阶段事件」的现状
//
// D7（主公固定 0 号位）：
//   `assignRoles` 以前把整份身份一起 shuffle，主公坐在哪是随机的，
//   先手也就跟着随机。身份局的整个信息结构以主公为原点——
//   忠臣开局只知道主公是谁，反贼与内奸靠「从主公往下的座次」推断敌友。
//   座次一乱，胜负条件虽然仍成立，牌局却已经不是原来那个牌局。
//
// D29（两套跳过账本）：
//   `TurnManager.skippedPlayers`（按座次记「整回合跳过」）与
//   `player.shouldSkipPhases`（按阶段记）同时在写，而 `nextTurn` 读前者、
//   `executeTurn` 读后者。更要命的是被 `nextTurn` 跳过的玩家**根本没记进**
//   `playersActedThisRound`，于是本轮末尾又会被重新选中——
//   「跳过」实际表现为「延后」。
//
//   裁决：只留 `player.shouldSkipPhases` 一本账。跳过整个回合 =
//   把六个阶段全部记进这一本账，于是它照旧算「已行动」、
//   照旧能被 `mod.phaseSkippable` 否决。
//
// 阶段事件：
//   Phase 22 的决议是「维持现状」——被跳过的阶段整个 `continue` 掉，
//   连 Begin / End 都不发。这里不评价对错，只把它钉住：
//   决议变了，这条断言会红，人必须显式地改它。
// ============================================================

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import { GameBoot } from '@core/boot/game-boot'
import { SeededRandomService } from '@core/services/seeded-random'
import { EventCompiler } from '@core/event/event-compiler'
import { GamePhase, RoleType } from '@core/contracts/enums'
import { STANDARD_PHASE_ORDER } from '@source/base/constants'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { ISkill } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import {
  ScriptedDecisionService,
  SilentLoggerService,
  createTestEnv,
  type TestEnv,
} from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

const PROJECT_ROOT = process.cwd()

/** 20 颗种子——够多到「碰巧都在 0 号位」不可能，又不至于让单测变慢 */
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)

/**
 * 按种子起一局
 *
 * D7 必须用**会洗牌**的随机源：测试脚手架默认的 `IdentityRandomService`
 * 原序返回，主公本来就在数组第 0 位，用它断言「主公在 0 号位」是句废话。
 */
async function bootWithSeed(seed: number) {
  const boot = GameBoot.createStandard5P({
    loggerService: new SilentLoggerService(),
    randomService: new SeededRandomService(seed),
    decisionService: new ScriptedDecisionService(),
  })
  await boot.boot()
  return boot.getEngine()!
}

/**
 * 挂一组全局探针，统计各事件被发了几次
 *
 * 每个事件名单独注册一个探针技能，而不是一个技能挂一串名字——
 * 后者在「content 被调用时 ctx.event 是谁」上多一层假设。
 */
function probeEvents(owner: IPlayer, names: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const name of names) counts[name] = 0

  names.forEach((name, i) => {
    const skill: ISkill = {
      id: `probe-${name}-${i}`,
      name: '阶段探针',
      description: '',
      priority: 10,
      trigger: { global: [name] as never },
      content: async () => {
        counts[name] = (counts[name] ?? 0) + 1
      },
    }
    const handlers: CompiledHandler[] = new EventCompiler().compile(skill, owner)
    for (const h of handlers) {
      env.engine.eventDispatcher.eventTrigger.registerCompiled(h)
    }
  })

  return counts
}

/** 在指定事件上挂一个只做一件事的全局钩子 */
function hookOn(owner: IPlayer, event: string, body: () => void): void {
  const skill: ISkill = {
    id: `hook-${event}`,
    name: '回合钩子',
    description: '',
    priority: 10,
    trigger: { global: [event] as never },
    content: async () => {
      body()
    },
  }
  const handlers: CompiledHandler[] = new EventCompiler().compile(skill, owner)
  for (const h of handlers) {
    env.engine.eventDispatcher.eventTrigger.registerCompiled(h)
  }
}

/** 让指定玩家成为当前回合玩家，然后跑一个完整回合 */
async function runTurnFor(player: IPlayer): Promise<void> {
  env.engine.state.currentPlayerIndex = player.seatIndex
  await env.engine.phaseManager.executeTurn()
}

const PHASE_BEGIN_EVENTS = [
  'phasePreBegin',
  'phaseJudgeBegin',
  'phaseDrawBegin',
  'phaseUseBegin',
  'phaseDiscardBegin',
  'phasePostBegin',
]

// ── D7 · 主公固定 0 号位先手 ──

describe('D7 · 主公固定 0 号位', () => {
  it('换 20 颗种子，主公恒在 0 号位且身份公开', async () => {
    const seen: Array<{ seed: number; seat0: string; revealed: boolean }> = []

    for (const seed of SEEDS) {
      const engine = await bootWithSeed(seed)
      const lord = engine.state.players[0]!
      seen.push({ seed, seat0: lord.role ?? '未分配', revealed: lord.roleRevealed })
    }

    // 只列**不合规**的种子：全绿时输出为空，红时一眼看到是哪几颗出了问题
    expect(seen.filter((r) => r.seat0 !== RoleType.Aspect || !r.revealed)).toEqual([])
  })

  it('其余身份仍然洗牌 —— 不是「原序照抄」', async () => {
    const layouts = new Set<string>()

    for (const seed of SEEDS) {
      const engine = await bootWithSeed(seed)
      layouts.add(engine.state.players.slice(1).map((p) => p.role).join('|'))
    }

    // 只有主公被钉住；剩下四个座次若每次都一样，说明 shuffle 根本没跑
    expect(layouts.size).toBeGreaterThan(1)
  })

  it('开局先手是主公 —— 按身份找，不是按座次数字找', async () => {
    const engine = await bootWithSeed(7)
    engine.turnManager.startRound()

    const first = engine.turnManager.getCurrentPlayer()
    expect(first?.seatIndex).toBe(0)
    expect(first?.role).toBe(RoleType.Aspect)
  })

  it('主公不在场时先手退回第一个存活玩家', async () => {
    const engine = await bootWithSeed(7)
    const [lord, second] = engine.state.players
    engine.playerSystem.setAlive(lord!, false)

    engine.turnManager.startRound()

    expect(engine.turnManager.getCurrentPlayer()?.seatIndex).toBe(second!.seatIndex)
  })
})

// ── D29 · 「跳过」只有一本账 ──

describe('D29 · 跳过整个回合只写那一本账', () => {
  it('`skipTurn` 把六个阶段全部记进 `shouldSkipPhases`', () => {
    const [, victim] = env.players()
    env.engine.turnManager.skipTurn(victim!)

    expect(victim!.shouldSkipPhases).toHaveLength(STANDARD_PHASE_ORDER.length)
    expect(victim!.shouldSkipPhases).toEqual(
      expect.arrayContaining(STANDARD_PHASE_ORDER),
    )
  })

  it('走真实回合：六个阶段全跳过，但 turnStart / turnEnd 照发', async () => {
    const [player] = env.players()
    const counts = probeEvents(player!, [
      'turnStart',
      'turnEnd',
      'phaseDrawBegin',
      'phaseUseBegin',
    ])

    // 在 `turnStart` 上预约跳过——这是乐不思蜀那类规则真正写出来的形状：
    // 账本在回合开始后写，才不会被 `nextTurn` 的 `resetTurnState` 清掉。
    hookOn(player!, 'turnStart', () => {
      env.engine.turnManager.skipTurn(player!)
    })

    const handBefore = player!.handCards.length
    await runTurnFor(player!)

    // 阶段事件一个都不发
    expect(counts['phaseDrawBegin']).toBe(0)
    expect(counts['phaseUseBegin']).toBe(0)

    // 六个阶段各记了一笔「真的被跳过了」
    expect(player!.skippedPhases).toEqual(
      expect.arrayContaining(STANDARD_PHASE_ORDER),
    )

    // 摸牌阶段被跳过 → 手牌一张没多
    expect(player!.handCards.length).toBe(handBefore)

    // 回合本身还在：回合开始 / 结束事件照发，
    // 「每回合一次」的额度才有机会重置
    expect(counts['turnStart']).toBe(1)
    expect(counts['turnEnd']).toBe(1)
  })

  it('`nextTurn` 不再有「跳过」分支 —— 一轮走完每人恰好一次、按座次', () => {
    const [, victim] = env.players()
    env.engine.turnManager.startRound()
    // 这一笔在 `nextTurn` 选人时会被 `resetTurnState` 清掉（见 `skipTurn` 的注释），
    // 因此本条盯的不是「跳过有没有生效」，而是**账本只有一本**这件事本身：
    // 第二本账一旦回来，`nextTurn` 就会重新长出跳过分支，顺序立刻变形。
    env.engine.turnManager.skipTurn(victim!)

    const order: number[] = []
    let current = env.engine.turnManager.nextTurn()
    while (current) {
      order.push(current.seatIndex)
      current = env.engine.turnManager.nextTurn()
    }

    // 老行为是 [0, 2, 3, 4, 1]：被跳过的 1 号没记进 `playersActedThisRound`，
    // 本轮末尾又被人捞出来补了一个回合——「跳过」实际是「延后」。
    expect(order).toEqual([0, 1, 2, 3, 4])
  })

  describe('源码级：第二本账已经不在', () => {
    const SCAN_ROOTS = ['src/core', 'src/source', 'src/services']

    function walk(dir: string, out: string[] = []): string[] {
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return out
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

    /** 注释里提到旧名字不算数——要盯的是**代码**里还有没有它 */
    function hasRealReference(text: string, needle: RegExp): boolean {
      return text
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .some((line) => needle.test(line))
    }

    /**
     * 两个名字都要盯：
     * - `skippedPlayers` —— 那第二本账本身
     * - `shouldSkipPhase` —— 同一本账的第二个**读法**（不问 `mod.phaseSkippable`）
     */
    const GONE: Array<[string, RegExp]> = [
      // `shouldSkipPhase` 后面不许跟字母——否则 `shouldSkipPhases`（那本账本身）会被误伤
      ['skippedPlayers', /\bskippedPlayers\b/],
      ['shouldSkipPhase', /\bshouldSkipPhase(?![A-Za-z])/],
    ]

    it('第二本账与第二个读法都已从生产代码里消失', () => {
      const offenders: string[] = []

      for (const root of SCAN_ROOTS) {
        for (const file of walk(join(PROJECT_ROOT, root))) {
          const text = readFileSync(join(PROJECT_ROOT, file), 'utf8')
          for (const [label, needle] of GONE) {
            if (hasRealReference(text, needle)) offenders.push(`${file} → ${label}`)
          }
        }
      }

      expect(offenders).toEqual([])
    })
  })
})

// ── 阶段事件：维持现状，但把它钉住 ──

describe('阶段事件', () => {
  it('六个阶段各发一条事件，Begin / End 派生名可用', async () => {
    const [player] = env.players()
    const counts = probeEvents(player!, PHASE_BEGIN_EVENTS)

    await runTurnFor(player!)

    for (const name of PHASE_BEGIN_EVENTS) {
      // 包一层对象而不是 `expect(x, name)`：失败信息里要看得见是哪个阶段，
      // 而 `valid-expect` 只认单参数写法
      expect({ [name]: counts[name] }).toEqual({ [name]: 1 })
    }
  })

  it('被跳过的阶段连 Begin / End 都不发（现状，非目标）', async () => {
    const [player] = env.players()
    const counts = probeEvents(player!, PHASE_BEGIN_EVENTS)

    env.engine.playerSystem.skipPhases(player!, [GamePhase.PhaseUse])
    await runTurnFor(player!)

    expect(counts['phaseUseBegin']).toBe(0)
    // 对照：没被跳过的阶段照常发
    expect(counts['phaseDrawBegin']).toBe(1)
    expect(counts['phaseDiscardBegin']).toBe(1)
    expect(player!.skippedPhases).toContain(GamePhase.PhaseUse)
  })
})
