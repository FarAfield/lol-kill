// ============================================================
// Phase 27 · D36 —— 技能面板的数据得是引擎给的
//
// 原状（`hooks/useSkill.ts` 读 `player.heroes.flatMap(h => h.effectIds)`）：
// 一串裸 id。于是 `name` 就是 id、`description` 是空串、`type` 一律 `Passive`
// ——`activeSkills`（只收 Active / Limited）因此**恒为空数组**，面板永远是空白的。
//
// 这里钉三层：
//
//  ① **技能定义来自 `SkillRegistry`**：有真名、真描述、真类型。
//  ② **`usable` 由 `enable` 与当前上下文判定，不是恒真**。
//     判据的反例是【咆哮】（锁定技、没有 `enable`）：它**看得见但点不了**。
//  ③ `usable` 会跟着上下文动 —— 出牌阶段为真、回合结束之后为假。
//
// 「恒真」和「恒空」这两个原状都长得像「通过」：`true` 是绿的、
// `[]` 也是绿的。所以每一条都配了对照。
//
// **取样时机**：让决策服务在**它被问出牌的那一刻**当场取样——
// 那一刻引擎正停在出牌阶段（`PhaseManager` 的 while 循环里），
// `getAvailableActions()` 给的就是出牌阶段此刻的答案。
//
// 形态丁之后（D38 结清）连「跑完第一个回合」这件事本身也变了：
// `start()` 只开局，回合一律由 `runGameLoop()` 推进，而整局的结果走
// `controller.whenFinished()`。取样时机不变——它问的就是「被问到的那一刻」。
// ============================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { GameController } from '@/services/game-controller'
import { standard5pConfig } from '@source/modes/standard-5p'
import { standardHeroes } from '@source/heroes/standard'
import { ScriptedDecisionService } from '../helpers/game-env'
import { useGameStore } from '@/store/game-store'
import { useSkill } from '@/hooks/useSkill'
import { SkillType } from '@core/contracts/enums'
import type { CardPlayOption, CardPlayResult } from '@core/contracts/services.interface'
import type { IPlayer } from '@core/contracts/player.interface'

const PROJECT_ROOT = process.cwd()

/**
 * 轮次上限压到 2
 *
 * `standard5pConfig` 写着 `maxRounds: 100`。形态丁下 `startGame()` 只把循环
 * 跑起来就返回（欠账 D38），这里要等整局结束（`whenFinished`），
 * 不设上限就会一直跑到第 100 轮。
 */
const MAX_ROUNDS = 2

/** 只有关羽的一局：他带【武圣】（主动技，`enable: [phaseUse, response]`） */
const GUANYU_ONLY = {
  ...standard5pConfig,
  maxRounds: MAX_ROUNDS,
  heroes: standardHeroes.filter((h) => h.id === 'guanyu'),
  heroSelectCount: 1,
}

/** 只有张飞的一局：他带【咆哮】（锁定技，**没有** `enable`） */
const ZHANGFEI_ONLY = {
  ...standard5pConfig,
  maxRounds: MAX_ROUNDS,
  heroes: standardHeroes.filter((h) => h.id === 'zhangfei'),
  heroSelectCount: 1,
}

/**
 * 在「被问出牌」的那一刻当场取样
 *
 * 那一刻引擎正停在出牌阶段（`PhaseManager` 的 while 循环里），
 * 于是 `getAvailableActions()` 给的就是**出牌阶段此刻**的答案。
 */
class PhaseUseSampler extends ScriptedDecisionService {
  readonly samples: Array<{ playerId: string; usable: string[] }> = []

  constructor(private readonly controller: GameController) {
    super()
  }

  override async askForCardPlay(
    player: IPlayer,
    _options: CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    this.samples.push({
      playerId: player.id,
      usable: this.controller.getAvailableActions(player.id).usableEffects,
    })
    // 一张都不打：这一局只为看面板，不为分胜负
    return null
  }
}

/**
 * 起一局并跑到终局，同时收集每一次「被问出牌」那一刻的取样
 *
 * 跑完整局而不是只跑第一个回合：`startGame()` 之后回合是在循环里推进的，
 * 「回合结束之后不可用」那条断言需要这一局真的走完。
 */
async function playOneTurn(
  config: typeof GUANYU_ONLY,
): Promise<{ controller: GameController; samples: PhaseUseSampler['samples'] }> {
  const controller = new GameController({ seed: 36 })
  const sampler = new PhaseUseSampler(controller)
  controller.setDecisionService(sampler)
  controller.bindStore(store)
  await controller.createGame(config)
  await controller.startGame()
  await controller.whenFinished()

  return { controller, samples: sampler.samples }
}

let store: ReturnType<typeof useGameStore>

beforeEach(() => {
  setActivePinia(createPinia())
  store = useGameStore()
})

// ═══════════════════════════════════════════
// ① 技能定义来自 SkillRegistry
// ═══════════════════════════════════════════

describe('D36 · 技能面板拿到的是真技能定义', () => {
  it('名字不是 id、描述不是空串 —— 这是原状最显眼的两个特征', async () => {
    const { controller } = await playOneTurn(GUANYU_ONLY)

    // 断言落在**面板**上（`useSkill`），不是 `controller.getPlayerSkills()`：
    // 后者只要 `SkillRegistry` 是对的就不会错，而原状坏的正是面板那一层——
    // 它拿着真 id 却把 id 当名字显示。
    const skills = useSkill(() => controller).availableSkills.value

    expect(skills.length).toBeGreaterThan(0)

    for (const skill of skills) {
      // 原状：`{ id, name: id, description: '' }`
      expect(skill.name).not.toBe('')
      expect(skill.name).not.toBe(skill.id)
      expect(skill.description).not.toBe('')
    }
  })

  it('类型不是一律 Passive —— 一律 Passive 的话面板上一个按钮都没有', async () => {
    const { controller } = await playOneTurn(GUANYU_ONLY)
    const skills = useSkill(() => controller).availableSkills.value

    expect(skills.length).toBeGreaterThan(0)
    // 【武圣】写着 `enable: [phaseUse, response]` → 主动技
    expect(skills.some((s) => s.type === SkillType.Active)).toBe(true)
  })

  it('activeSkills 不再恒为空数组 —— 原状就是这个空数组', async () => {
    const { controller } = await playOneTurn(GUANYU_ONLY)
    const { activeSkills } = useSkill(() => controller)

    expect(activeSkills.value.length).toBeGreaterThan(0)
    // 面板上显示的是**换皮之后**的名字（欠账 D27：换皮发生在
    // `ISkill` → `SkillUIInfo` 这道边界上）。写死 '武圣' 过了，
    // 就等于面板其实没换皮——那时这条会红。
    expect(activeSkills.value[0]!.name).toBe('诺克萨斯断头台')
  })

  it('面板上的技能集合与引擎给的完全一致 —— 面板不许自己另算一份', async () => {
    const { controller } = await playOneTurn(GUANYU_ONLY)
    const player = controller.getCurrentPlayer()!

    const fromEngine = controller.getPlayerSkills(player.id).map((s) => s.id).sort()
    const onPanel = useSkill(() => controller)
      .availableSkills.value.map((s) => s.id)
      .sort()

    expect(onPanel).toEqual(fromEngine)
    // 对照：两边都空也算相等，所以先证明这一刻真有技能
    expect(fromEngine.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════
// ② usable 由 enable 判定，不是恒真
// ═══════════════════════════════════════════

describe('D36 · usable 跟着技能自己写的 enable 走', () => {
  it('出牌阶段确实被问到了 —— 没问到的话下面两条都是空跑', async () => {
    const { samples } = await playOneTurn(GUANYU_ONLY)

    expect(samples.length).toBeGreaterThan(0)
  })

  it('【武圣】在出牌阶段可用（它自己写着 enable: [phaseUse]）', async () => {
    const { samples } = await playOneTurn(GUANYU_ONLY)

    for (const sample of samples) {
      expect(sample.usable).toContain('wusheng')
    }
  })

  it('【咆哮】看得见但点不了 —— 「恒真」的反例', async () => {
    const { controller, samples } = await playOneTurn(ZHANGFEI_ONLY)
    const player = controller.getCurrentPlayer()!

    // 先证明它**在面板上**：这一条排除了「只是没显示出来」这种假通过
    expect(controller.getPlayerSkills(player.id).map((s) => s.id)).toContain('paoxiao')

    // 再证明它**不可发动**：锁定技自己没有 `enable`，不该出现在可用列表里。
    // 旧实现（`hero.effectIds` 一把梭）会给它 `usable: true`。
    expect(samples.length).toBeGreaterThan(0)
    for (const sample of samples) {
      expect(sample.usable).not.toContain('paoxiao')
    }
  })

  it('回合结束之后【武圣】就不可用了 —— usable 会动，不是个常量', async () => {
    const { controller, samples } = await playOneTurn(GUANYU_ONLY)
    const player = controller.getCurrentPlayer()!

    // 出牌阶段：可用（上一句已断言，这里再确认一次取样非空）
    expect(samples[0]!.usable).toContain('wusheng')

    // 同一个玩家、同一个技能，回合已经结束（停在 phasePost）：不可用
    const after = controller.getAvailableActions(player.id)
    expect(after.phase).not.toBe('phaseUse')
    expect(after.usableEffects).not.toContain('wusheng')
  })
})

// ═══════════════════════════════════════════
// ③ 接线还在
// ═══════════════════════════════════════════

describe('D36 · 接线与源码护栏', () => {
  it('面板不再把 id 当名字、不再一律判成被动技', () => {
    const src = readFileSync(join(PROJECT_ROOT, 'src/hooks/useSkill.ts'), 'utf8')

    expect(src).not.toMatch(/^\s*name: id,/m)
    expect(src).not.toMatch(/^\s*type: SkillType\.Passive,/m)
    // 真值源：`ctrl.getPlayerSkills()`（`SkillRegistry`），不是英雄牌上的裸 id
    expect(src).toMatch(/getPlayerSkills/)
    expect(src).not.toMatch(/hero\.effectIds|h\.effectIds/)
  })

  it('controller 那条链路上不再有 flatMap(effectIds) 的旧答案', () => {
    const src = readFileSync(
      join(PROJECT_ROOT, 'src/services/game-controller.ts'),
      'utf8',
    )

    expect(src).not.toMatch(/flatMap\(\(h\) => h\.effectIds\)/)
    expect(src).toMatch(/skillRegistry\.getSkills/)
  })
})
