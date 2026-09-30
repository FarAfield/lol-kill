// ============================================================
// 联盟杀 · ReplayEngine — 录像与回放
//
// 一份录像 = 种子 + 决策序列 +（重建对局所需的配置）一个都不能少：
//   种子    决定洗牌、身份、英雄候选
//   决策序列 决定每个人怎么打
//   配置    决定牌池与英雄池（不随录像走，按 `mode` 从内容层取）
//
// 用法：
// ```ts
// const bundle = await ReplayEngine.record(config, { seed: 42 })
// const again = await ReplayEngine.replay(bundle)   // 应当逐日志相同
// await ReplayEngine.expectSame(bundle, again)      // 不同就抛错
// ```
//
// 为什么不做「状态快照对比」而只在最外层比 —— 因为逐帧快照会把
// 引擎内部实现钉死在录像里（改个字段名就全废）；只比
// 「同一串输入 → 同一串输出」，内部重构照样通过。
// ============================================================

import { GameBoot } from '@core/boot/game-boot'
import { AIController } from '@core/services/ai-controller'
import { SeededRandomService, hashSeed, randomSeed } from '@core/services/seeded-random'
import type {
  GameStateSnapshot,
  IGameConfig,
  IGameResult,
} from '@core/contracts/game.interface'
import type { ILoggerService, IUIDecisionService } from '@core/contracts/services.interface'
import {
  DecisionRecorder,
  ReplayDecisionService,
  ReplayDivergenceError,
  type ReplayDecision,
} from './decision-recorder'
import { EventTrail } from './event-trail'

/** 录像格式版本——引擎换了结算顺序时提升它，旧录像体面地失效 */
export const REPLAY_VERSION = 1

/** 一份录像（可 JSON 序列化） */
export interface ReplayRecord {
  version: number
  /** 随机种子 */
  seed: number
  /** 游戏模式（用来取回同一份配置） */
  mode: string
  playerCount: number
  decisions: ReplayDecision[]
}

/** 录像 + 重建所需的配置 */
export interface ReplayBundle {
  record: ReplayRecord
  /**
   * 重建这局所需的配置（牌池 / 英雄池 / 规则）
   *
   * 它不属于录像本身——牌池属于规则而非某一局，应当由 `mode` 还原。
   * 这里保留引用纯属便利：进程内回放不必再去查一遍内容层。
   */
  config?: IGameConfig
  /**
   * 录下时的产物（事件流水 / 终局 / 结果）
   *
   * 它是**期望值**：回放完拿 `expectSame(bundle.expected, replayed)` 一比，
   * 过程与结局是否一致就有答案了。
   */
  expected: ReplayOutcome
}

/** 一次重演的产物 */
export interface ReplayOutcome {
  result: IGameResult
  /** 事件流水指纹——「谁在什么时候对谁做了什么」 */
  events: string[]
  /** 逐条日志指纹（不含 id 与时间戳——它们属于呈现层） */
  log: string[]
  /** 终局状态摘要：血量、存活、手牌、牌堆余量 */
  summary: string[]
  /** 消耗了多少条决策 */
  decisionsUsed: number
}

export interface ReplayRunOptions {
  /** 随机种子；不传则现场摇一颗 */
  seed?: number | string
  loggerService?: ILoggerService
  /**
   * 决策来源
   *
   * 缺省是一颗**确定性播种**的 AI：
   * 同种子跑两遍必须得到同一串决策，否则「复现」这句话没有意义。
   */
  decisions?: IUIDecisionService
}

/**
 * 日志指纹 —— 确定性比对的最小单位
 *
 * 刻意剔除 `id` 与 `timestamp`：前者是序号、后者是挂钟，
 * 两者都不该影响「这两局是不是同一局」的判断。
 */
function logFingerprint(state: GameStateSnapshot): string[] {
  return state.log.map(
    (entry) =>
      `${entry.round}|${entry.phase}|${entry.level}|${entry.message}` +
      `|${entry.sourcePlayerId ?? '-'}|${[...(entry.targetPlayerIds ?? [])].sort().join(',')}`,
  )
}

/** 终局摘要 */
function stateSummary(state: GameStateSnapshot): string[] {
  return [
    `round=${state.currentRound} deck=${state.deck.length} discard=${state.discardPile.length}`,
    ...state.players.map(
      (p) =>
        `${p.id}:alive=${p.alive},hp=${p.hp},hero=${p.heroes[0]?.id ?? '-'},hand=[${
          p.handCards.map((c) => c.id).sort().join(',')
        }]`,
    ),
  ]
}

export class ReplayEngine {
  /**
   * 录下一局
   *
   * @param config  对局配置
   * @param options 种子 / 日志 / 决策来源
   */
  static async record(config: IGameConfig, options: ReplayRunOptions = {}): Promise<ReplayBundle> {
    const seed = options.seed ?? randomSeed()
    const decisions =
      options.decisions ??
      new AIController({
        minDelay: 0,
        maxDelay: 0,
        logEnabled: false,
        // AI 单独一条流（见 AIController 的说明）——共用会打乱洗牌序列
        randomService: new SeededRandomService(hashSeed(`ai:${seed}`)),
      })

    const recorder = new DecisionRecorder(decisions)
    const boot = new GameBoot(config, {
      randomService: new SeededRandomService(seed),
      loggerService: options.loggerService,
      decisionService: recorder,
    })

    await boot.boot()
    this.attachAI(decisions, boot)
    const engine = boot.getEngine()!
    const trail = new EventTrail()
    // 录像里也要留下事件流水：回放时拿它当「过程一致」的判据，
    // 光比结果（谁赢了）太松——赢家一样的两局可能过程完全不同。
    trail.attach(engine)

    const result = await boot.runGameLoop()
    trail.detach()
    const state = boot.getState() as GameStateSnapshot

    return {
      record: {
        version: REPLAY_VERSION,
        seed: typeof seed === 'string' ? hashSeed(seed) : seed >>> 0,
        mode: config.mode,
        playerCount: config.playerCount,
        decisions: [...recorder.decisions],
      },
      config,
      expected: {
        result,
        events: [...trail.entries],
        log: logFingerprint(state),
        summary: stateSummary(state),
        decisionsUsed: recorder.decisions.length,
      },
    }
  }

  /**
   * 重演一份录像
   *
   * 每一步都先核对指纹，稍有不符就抛 `ReplayDivergenceError`——
   * 半途改口的回放比放不出来更糟。
   */
  static async replay(bundle: ReplayBundle, loggerService?: ILoggerService): Promise<ReplayOutcome> {
    const config = bundle.config
    if (!config) {
      throw new Error(
        'ReplayEngine.replay: 缺少 config，无法重建牌局（请提供 bundle.config 或按 mode 取回配置）',
      )
    }
    if (config.mode !== bundle.record.mode) {
      throw new Error(
        `ReplayEngine.replay: 模式不符（录像 ${bundle.record.mode} vs 配置 ${config.mode}）`,
      )
    }
    if (config.playerCount !== bundle.record.playerCount) {
      throw new Error(
        `ReplayEngine.replay: 人数不符（录像 ${bundle.record.playerCount} vs 配置 ${config.playerCount}）`,
      )
    }

    const player = new ReplayDecisionService(bundle.record.decisions)
    const boot = new GameBoot(config, {
      randomService: new SeededRandomService(bundle.record.seed),
      loggerService,
      decisionService: player,
    })

    await boot.boot()
    const engine = boot.getEngine()!
    const trail = new EventTrail()
    trail.attach(engine)

    const result = await boot.runGameLoop()
    trail.detach()
    const state = boot.getState() as GameStateSnapshot

    // 录像没走完 = 局面对不上。
    //
    // 这一步必须查：篡改「应答」（而不是请求）不会触发指纹校验——
    // 引擎照样一圈圈问下去，只是每一步都得到不同的答案。
    // 于是「回放成功」的假象会一直维持到最后一刻，而它放的其实是另一局。
    const left = bundle.record.decisions.length - player.consumed
    if (left > 0) {
      throw new ReplayDivergenceError(
        player.consumed,
        `录像还剩 ${left}/${bundle.record.decisions.length} 条决策没被问到——多半是某一步的应答把局面带偏了`,
      )
    }

    return {
      result,
      events: [...trail.entries],
      log: logFingerprint(state),
      summary: stateSummary(state),
      decisionsUsed: player.consumed,
    }
  }

  /**
   * 断言一次重演与录像一致
   *
   * 先比事件流水，再比终局与结果——流水是最硬的判据：
   * 结局一样的两局，过程可能完全不同。
   *
   * @throws Error 当流水、终局或结果与期望不符
   */
  static expectSame(expected: ReplayOutcome, actual: ReplayOutcome): void {
    if (expected.events.length !== actual.events.length) {
      throw new Error(
        `事件流水条数不一致：期望 ${expected.events.length} 条，实际 ${actual.events.length} 条`,
      )
    }
    for (let i = 0; i < expected.events.length; i++) {
      if (expected.events[i] !== actual.events[i]) {
        throw new Error(
          `第 ${i} 条事件不一致：\n    期望: ${expected.events[i]}\n    实际: ${actual.events[i]}`,
        )
      }
    }
    if (expected.log.length !== actual.log.length) {
      throw new Error(
        `日志条数不一致：期望 ${expected.log.length} 条，实际 ${actual.log.length} 条`,
      )
    }
    for (let i = 0; i < expected.log.length; i++) {
      if (expected.log[i] !== actual.log[i]) {
        throw new Error(
          `第 ${i} 条日志不一致：\n    期望: ${expected.log[i]}\n    实际: ${actual.log[i]}`,
        )
      }
    }
    if (expected.summary.join('\n') !== actual.summary.join('\n')) {
      throw new Error(
        `终局状态不一致：\n    期望: ${expected.summary.join(' / ')}\n    实际: ${actual.summary.join(' / ')}`,
      )
    }
    if (expected.result.winner !== actual.result.winner) {
      throw new Error(
        `胜者不一致：期望 ${expected.result.winner}，实际 ${actual.result.winner}`,
      )
    }
    if (expected.result.reason !== actual.result.reason) {
      throw new Error(
        `结束原因不一致：期望 ${expected.result.reason}，实际 ${actual.result.reason}`,
      )
    }
    if (expected.result.totalRounds !== actual.result.totalRounds) {
      throw new Error(
        `轮次不一致：期望 ${expected.result.totalRounds}，实际 ${actual.result.totalRounds}`,
      )
    }
  }

  /**
   * AI 要看得见局面才能决策
   *
   * 玩家是 `init()` 之后才存在的，因此注册只能发生在 `boot()` 之后。
   * 开局那次英雄选择因而走了 AI 的兜底分支（`candidates[0]`）——
   * 确定性的，录像里也如实记着。
   */
  private static attachAI(decisions: IUIDecisionService, boot: GameBoot): void {
    if (!(decisions instanceof AIController)) return
    const engine = boot.getEngine()
    if (!engine) return
    decisions.setStateAccessor(() => boot.getState() as GameStateSnapshot)
    decisions.registerPlayers(engine.state.players.map((p) => p.id))
  }
}
