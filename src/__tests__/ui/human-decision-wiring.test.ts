// ============================================================
// Phase 27 · D34 / D37 —— 决策服务这条线是否真的通到了引擎
//
// D34 的原状：全仓没有一处调用 `GameController.setDecisionService`。
// 后果比「弹窗不弹」严重——`EffectContext.waitForResponse` 进门一行
// `if (!this.deps.decisionService) return { confirmed: false }`，
// 于是【闪】【桃】【无懈】一律被拒：攻击必中、濒死必死。
//
// D37（本轮顺手挖出）：三个查询口（额度 / Mod / 技能台账）以前只由
// `GameBoot` 补发给决策服务。图形界面走的是 `GameController`，
// 那条路上的 AI 从头到尾都是睁眼瞎。
//
// 这里钉三层：
//  ① **源码层面**：线还在（并且只有一个构造出口——抄第二遍最容易漏）。
//  ② **走到引擎**：接上之后，「人」那一位的问题不进 UI 以外的任何地方，
//     其余座位照旧有人作答。
//  ③ **查询口确实送达**：两条启动路径都要送到（以前只有一条）。
// ============================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { GameController } from '@/services/game-controller'
import { HumanDecisionService } from '@/services/human-decision'
import { standard5pConfig } from '@source/modes/standard-5p'
import { RoleType } from '@core/contracts/enums'
import type { CardBudget } from '@core/skill/card-budget'
import type { IModQuery } from '@core/contracts/mod.interface'
import type { ISkillRegistry } from '@core/contracts/skill.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type {
  CardPlayOption,
  CardPlayResult,
  IUIDecisionService,
} from '@core/contracts/services.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import { createTestEnv } from '../helpers/game-env'

// `process.cwd()` 而不是 `fileURLToPath(import.meta.url)`：
// vitest 里的 `import.meta.url` 不是 file: 协议，解析会直接炸。
const PROJECT_ROOT = process.cwd()

const VIEW_PATH = join(PROJECT_ROOT, 'src/views/game/index.vue')

/**
 * 什么都答「不」，但把**谁被问过**与**收到过什么注入**记下来
 *
 * 记录的是座次与提示，这样「分流」这件事能被直接断言：
 * 某个座位一次都没出现 = 它的问题没到这儿。
 */
class Recorder implements IUIDecisionService {
  readonly asked: string[] = []
  readonly injected: string[] = []

  setCardBudget(_budget: CardBudget): void {
    this.injected.push('setCardBudget')
  }
  setModQuery(_modQuery: IModQuery): void {
    this.injected.push('setModQuery')
  }
  setSkillRegistry(_registry: ISkillRegistry): void {
    this.injected.push('setSkillRegistry')
  }

  async askForCardPlay(_player: IPlayer, _options: CardPlayOption[]): Promise<CardPlayResult | null> {
    return null
  }
  async askForResponse(player: IPlayer, prompt: string): Promise<ICard | null> {
    this.asked.push(`${player.seatIndex}:${prompt}`)
    return null
  }
  async askForTarget(): Promise<IPlayer[]> {
    return []
  }
  async askForEffectUse(): Promise<ISkill | null> {
    return null
  }
  async askForDiscard(_player: IPlayer, count: number, validCards: ICard[]): Promise<ICard[]> {
    return validCards.slice(0, count)
  }
  async askForHeroSelect(
    player: IPlayer,
    candidates: { id: string; name: string; title: string; kingdom: string }[],
  ): Promise<string> {
    this.asked.push(`${player.seatIndex}:选将`)
    return candidates[0]?.id ?? ''
  }
  notifyPlayer(): void {}
  notifyAll(): void {}
  async showGameResult(_result: { winner: RoleType | null; reason: string }): Promise<void> {}
}

/** 一条 `'座次:提示'` 记录里的座次 */
function seatOf(entry: string): number {
  return Number(entry.split(':')[0])
}

let piniaReady = false

beforeEach(() => {
  if (!piniaReady) {
    setActivePinia(createPinia())
    piniaReady = true
  }
})

// ═══════════════════════════════════════════
// ① 源码层面：线还在
// ═══════════════════════════════════════════

describe('D34 · 视图里的接线还在', () => {
  it('HumanDecisionService 插进了 GameController', () => {
    const view = readFileSync(VIEW_PATH, 'utf8')

    expect(view).toMatch(/new HumanDecisionService\(/)
    expect(view).toMatch(/setDecisionService\(/)
  })

  it('构造只有一个出口 —— 「再来一局」再抄一遍最容易把这句漏掉', () => {
    // 原状就是两处各自 `new GameController()`，第二处没装决策服务，
    // 于是第二局起又变回「一个不会防守的单机」。
    const view = readFileSync(VIEW_PATH, 'utf8')

    expect([...view.matchAll(/new GameController\(/g)].length).toBe(1)
  })

  it('AI 在 startGame 之前注册完 —— 晚一步，第一个回合里的 AI 就没脑可用', () => {
    const view = readFileSync(VIEW_PATH, 'utf8')

    const callAt = view.indexOf('registerAIPlayers(s.controller')
    const startAt = view.indexOf('await ctrl.startGame')

    expect(callAt).toBeGreaterThan(-1)
    expect(startAt).toBeGreaterThan(-1)
    expect(callAt).toBeLessThan(startAt)
  })

  it('useResponse 不再假装需要一个 controller', () => {
    const view = readFileSync(VIEW_PATH, 'utf8')

    expect(view).toMatch(/useResponse\(\)/)
    expect(view).not.toMatch(/useResponse\(\s*getController/)
  })
})

// ═══════════════════════════════════════════
// ② 走到引擎：按座位分流
// ═══════════════════════════════════════════

describe('D34 · 接上之后，问题按座位分头走', () => {
  it('人类那一位不进兜底 —— 分流的正是「让人替 AI 打牌」这件事', async () => {
    const recorder = new Recorder()
    await createTestEnv(new HumanDecisionService({ fallback: recorder }))

    const seats = recorder.asked.filter((e) => e.endsWith('选将')).map(seatOf)

    // 先证明兜底确实被问过，否则「不含 0」可能只是谁都没被问
    expect(seats.length).toBeGreaterThan(0)
    expect(seats).not.toContain(0)
  })

  it('对照：不加 HumanDecisionService，0 号座也会被问到', async () => {
    // 「里面没有 0」是一种很便宜的绿。这一条证明**是分流**把它挡住的，
    // 而不是那一场里压根没有人被问选将。
    const bare = new Recorder()
    await createTestEnv(bare)

    const seats = bare.asked.filter((e) => e.endsWith('选将')).map(seatOf)

    expect(seats).toContain(0)
  })

  it('默认人类坐 0 号座 —— 与视图里 humanPlayer 取的是同一个人', () => {
    const view = readFileSync(VIEW_PATH, 'utf8')

    expect(view).toMatch(/const HUMAN_SEAT = 0/)
    expect(view).toMatch(/humanSeatIndex:\s*HUMAN_SEAT/)
    expect(view).toMatch(/state\.players\[HUMAN_SEAT\]/)
  })
})

// ═══════════════════════════════════════════
// ③ 查询口确实送达（D37）
// ═══════════════════════════════════════════

describe('D37 · 三个查询口由引擎补给决策服务', () => {
  it('GameBoot 那条路（文字界面 / 压力测试）', async () => {
    const recorder = new Recorder()
    await createTestEnv(recorder)

    expect(recorder.injected).toEqual(['setCardBudget', 'setModQuery', 'setSkillRegistry'])
  })

  it('GameController 那条路（图形界面）—— 以前这一条是空的', async () => {
    const recorder = new Recorder()
    const ctrl = new GameController({ seed: 37 })
    ctrl.setDecisionService(recorder)
    ctrl.bindStore({
      syncFromEngine(): void {},
      reset(): void {},
    })
    await ctrl.createGame({ ...standard5pConfig })

    expect(recorder.injected).toEqual(['setCardBudget', 'setModQuery', 'setSkillRegistry'])
  })

  it('隔着 HumanDecisionService 也能送到 AI 手上 —— 转发断了的话这条会红', async () => {
    const aiSide = new Recorder()
    const ctrl = new GameController({ seed: 37 })
    ctrl.setDecisionService(new HumanDecisionService({ fallback: aiSide }))
    ctrl.bindStore({
      syncFromEngine(): void {},
      reset(): void {},
    })
    await ctrl.createGame({ ...standard5pConfig })

    expect(aiSide.injected).toEqual(['setCardBudget', 'setModQuery', 'setSkillRegistry'])
  })

  it('补发只写在引擎里 —— 启动器各自补一遍，漏一个就是一整类 AI 失明', () => {
    const engine = readFileSync(join(PROJECT_ROOT, 'src/core/engine/game-engine.ts'), 'utf8')
    const boot = readFileSync(join(PROJECT_ROOT, 'src/core/boot/game-boot.ts'), 'utf8')

    for (const port of ['setCardBudget', 'setModQuery', 'setSkillRegistry']) {
      expect(engine).toContain(`this.decisionService?.${port}`)
      expect(boot).not.toContain(`this.decisionService?.${port}`)
    }
  })
})
