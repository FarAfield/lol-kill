// ============================================================
// Phase 26 · 整局对局压力测试（D23 无死锁 / D22 难度标定）
//
// **这个文件不进日常门禁**（见 `vitest.config.ts` 的 exclude）。
//
// 原因是一个实测数字：一局 8 人全 AI 对局约 **52 秒**（5 人约 28 秒）。
// 慢的不是 AI 决策——一局里 AI 只被问 20–35 次牌——而是引擎的事件
// 分发与技能钩子遍历；注入不注入 Mod / 台账，耗时一模一样
// （27.667s vs 27.674s，测过）。因此「100 局」这种规模进日常门禁
// 会把一次全量从 34 秒拖到 80 分钟。
//
// 跑法：
//   npm run test:stress
//
// 想跑满验收里写的 100 局，把下面 `STRESS_GAMES` 改掉单独跑。
// ============================================================

import { describe, expect, it } from 'vitest'

import { GameBoot } from '@core/boot/game-boot'
import { AIController } from '@core/services/ai-controller'
import { AIDifficulty } from '@core/contracts/ai.interface'
import { RoleType } from '@core/contracts/enums'
import type { GameStateSnapshot, IGameConfig } from '@core/contracts/game.interface'
import type { IGameResult } from '@core/contracts/game.interface'
import { SeededRandomService, hashSeed } from '@core/services/seeded-random'
import { standard5pConfig } from '@source/modes/standard-5p'
import { standard8pConfig } from '@source/modes/standard-8p'
import { SilentLoggerService } from '../helpers/game-env'

/** 8 人局的局数（约 52s/局） */
const STRESS_GAMES = 8
/**
 * 难度标定的**对数**（一局跑两遍，见下）
 *
 * 实测：5 人 3 轮 ≈ 48s/局，5 轮 ≈ 55–60s/局；8 对 × 5 轮会顶破
 * 600s 超时（2026-10-08 试过，超时失败）。因此对数与轮次是互相顶着的：
 * 想多看几局，就得接受更短的局。这里取 4 对 × 4 轮 ≈ 7 分钟。
 */
const CALIBRATION_PAIRS = 4
/** 标定局的轮次上限 */
const CALIBRATION_ROUNDS = 4

/**
 * 跑一整局全 AI 对局
 *
 * 难度**按身份**分派，因此同一个 AIController 里可以一半 Hard
 * 一半 Beginner——标定要的就是这种同桌对照。
 */
async function playGame(
  config: IGameConfig,
  difficultyOf: (role: RoleType | undefined) => AIDifficulty,
  seed: number,
): Promise<IGameResult> {
  const ai = new AIController({
    defaultDifficulty: AIDifficulty.Normal,
    minDelay: 0,
    maxDelay: 0,
    logEnabled: false,
    randomService: new SeededRandomService(hashSeed(`ai:${seed}`)),
  })

  const boot = GameBoot.create(config, {
    loggerService: new SilentLoggerService(),
    randomService: new SeededRandomService(seed),
    decisionService: ai,
  })
  await boot.boot()

  const engine = boot.getEngine()!
  ai.setStateAccessor(() => boot.getState() as GameStateSnapshot)
  // 玩家 `init()` 之后才存在，注册只能发生在 boot 之后
  for (const player of engine.state.players) {
    ai.registerPlayer(player.id, difficultyOf(player.role))
  }
  ai.setCardBudget(engine.cardBudget)
  ai.setModQuery(engine.modQuery)
  ai.setSkillRegistry(engine.skillRegistry)

  return await engine.runGameLoop()
}

const isLordCamp = (role: RoleType | undefined) =>
  role === RoleType.Aspect || role === RoleType.Guardian

// ═══════════════════════════════════════════
// D23 · 8 人局 AI 对战无死锁、无异常
// ═══════════════════════════════════════════

describe('D23 · 8 人局全 AI 对局', () => {
  it(
    `${STRESS_GAMES} 局全部跑完：有结果、不超轮次、不抛异常`,
    async () => {
      const results: IGameResult[] = []

      for (let i = 0; i < STRESS_GAMES; i += 1) {
        // 三档难度轮换当庄，免得只覆盖一种决策风格
        const difficulty = [
          AIDifficulty.Beginner,
          AIDifficulty.Normal,
          AIDifficulty.Hard,
        ][i % 3]!

        const result = await playGame(
          { ...standard8pConfig, maxRounds: 2 },
          () => difficulty,
          1000 + i,
        )
        results.push(result)

        // 死锁的典型表现是**卡住不返回**，能被超时抓住；
        // 这里再钉住「返回的结果是完整的」——轮次有数、原因非空。
        expect(result.totalRounds).toBeGreaterThan(0)
        expect(result.totalRounds).toBeLessThanOrEqual(2)
        expect(typeof result.reason).toBe('string')
      }

      expect(results.length).toBe(STRESS_GAMES)
    },
    600_000,
  )
})

// ═══════════════════════════════════════════
// D22 · 三档难度标定
// ═══════════════════════════════════════════

describe('D22 · 难度标定（Hard 与 Beginner 同桌对照）', () => {
  it(
    '同一副牌两面打：Hard 阵营的胜场不少于 Beginner 阵营',
    async () => {
      const config: IGameConfig = { ...standard5pConfig, maxRounds: CALIBRATION_ROUNDS }

      // ── 为什么是「配对」而不是「两组各打若干局」──
      //
      // 每颗种子打**两遍**，两遍只有一处不同：主公阵营是 Hard 还是 Beginner。
      // 同一个 `seed` 意味着同一副身份、同一沓洗好的牌、同一批复原不了的第一手——
      // 「起手天胡」这种噪声在比较里自己抵消了，剩下的差异只能来自决策。
      // 两组各打若干局的做法做不到这点：那边差的可能是牌，不是脑子。
      //
      // 只看「主公阵营赢了几局」还会混进第二个偏差——**阵营本身有强弱**
      // （主公阵营要清两股敌人）。因此两边各跑一半，把阵营因素也抵消掉。
      let hardCampWins = 0
      let beginnerCampWins = 0
      let undecided = 0
      const lines: string[] = []

      for (let i = 0; i < CALIBRATION_PAIRS; i += 1) {
        const seed = 2000 + i

        // A：主公阵营 Hard，反贼阵营 Beginner
        const a = await playGame(
          config,
          (role) => (isLordCamp(role) ? AIDifficulty.Hard : AIDifficulty.Beginner),
          seed,
        )
        // B：同一颗种子，难度对调
        const b = await playGame(
          config,
          (role) => (isLordCamp(role) ? AIDifficulty.Beginner : AIDifficulty.Hard),
          seed,
        )

        for (const [tag, r, hardIsLordCamp] of [
          ['A', a, true],
          ['B', b, false],
        ] as const) {
          if (!r.winner) {
            undecided += 1
            lines.push(`  seed ${seed} ${tag}: 未分胜负（${r.reason}，${r.totalRounds} 轮）`)
            continue
          }
          // 赢的是主公阵营吗？再对照「Hard 站在哪一边」，就得出赢家是谁的阵营
          const lordCampWon = isLordCamp(r.winner as RoleType)
          const hardWon = lordCampWon === hardIsLordCamp
          if (hardWon) hardCampWins += 1
          else beginnerCampWins += 1
          lines.push(
            `  seed ${seed} ${tag}: ${hardWon ? 'Hard' : 'Beginner'} 阵营胜` +
              `（赢家 ${r.winner}，${r.totalRounds} 轮）`,
          )
        }
        // 逐对打印，而不是攒到最后一次：这个 suite 一跑就是十几分钟，
        // 中途超时也要能看见「已经打了多少、比分多少」。
        console.info(`[D22] seed ${seed} → Hard ${hardCampWins} : ${beginnerCampWins} Beginner（未分胜负 ${undecided}）`)
      }

      // 数字要看得见。断言只能回答「是/否」，而标定这事的结论是**一个区间**：
      // 差一局就翻面的比较，读的人有权知道有多脆。
      console.info(`\n[D22 标定] ${CALIBRATION_PAIRS} 对 x 2 共 ${CALIBRATION_PAIRS * 2} 局：\n${lines.join('\n')}`)

      expect(hardCampWins).toBeGreaterThanOrEqual(beginnerCampWins)
      // 「0 ≥ 0」也能绿，因此要求至少有几局真的打出了结果
      expect(hardCampWins + beginnerCampWins).toBeGreaterThan(0)
    },
    900_000,
  )
})
