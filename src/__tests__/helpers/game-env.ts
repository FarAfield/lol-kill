// ============================================================
// 测试脚手架
//
// 每个 Phase 的验收测试都要「走真实引擎」才能暴露问题——
// 历史上「卡牌效果注册了但从未被调用」「求桃根本没实现」
// 都是靠端到端跑一遍才发现的。这里把那套替身集中起来，避免每个
// 测试文件各抄一份。
// ============================================================

import { GameBoot } from '@core/boot/game-boot'
import { Card } from '@core/entity/card'
import { TargetSystem } from '@core/system/target-system'
import { CardSuit, CardRank, ZoneType, type LogLevel } from '@core/contracts/enums'
import type { CardDefinition, ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type {
  ILoggerService,
  IRandomService,
  IUIDecisionService,
  CardPlayOption,
  CardPlayResult,
} from '@core/contracts/services.interface'
import type { ISkill } from '@core/contracts/skill.interface'

export class SilentLoggerService implements ILoggerService {
  log(): void {}
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  getLogs(): ReadonlyArray<{ message: string; level: LogLevel; timestamp: number }> {
    return []
  }
  clear(): void {}
}

/** 不做随机：洗牌原序、取牌取头——让断言可复现 */
export class IdentityRandomService implements IRandomService {
  private counter = 0
  shuffle<T>(array: T[]): T[] {
    return [...array]
  }
  nextInt(min: number): number {
    return min
  }
  pick<T>(array: T[]): T {
    return array[0]!
  }
  pickN<T>(array: T[], n: number): T[] {
    return array.slice(0, n)
  }
  uuid(): string {
    return `id-${this.counter++}`
  }
}

/**
 * 可编程决策服务
 *
 * 默认「什么都不出」，测试按 `${playerId}:${promptSnippet}` 指定应答。
 * 所有询问都会记进 `asked`，因此**询问顺序**也能被断言——
 * 座次轮询这条规则正是靠它验证的。
 */
export class ScriptedDecisionService implements IUIDecisionService {
  private answers = new Map<string, ICard | null>()
  /** 按「第几次被问」应答：`player + 提示片段 → 第 n 次 → 牌` */
  private nthAnswers = new Map<string, Map<number, ICard | null>>()
  /**
   * 出牌阶段剧本：玩家 → 想打的牌**队列**（打出一张即出队）
   *
   * 用队列而不是「一人一张」：出牌阶段是 while 循环，同一个玩家
   * 一回合内可能被问好几次；只存一张的话后一次 `outCard` 会静默
   * 覆盖前一次，写出来的剧本和跑出来的完全不是一回事。
   */
  private playAnswers = new Map<string, Array<{ card: ICard; targetIds?: string[] }>>()
  readonly asked: string[] = []

  script(player: IPlayer, promptSnippet: string, card: ICard | null): void {
    this.answers.set(`${player.id}:${promptSnippet}`, card)
  }

  /**
   * 编排某人**在出牌阶段**打哪张牌、打谁
   *
   * 与 `script` 分开是因为出牌决策的参数不是「提示文案 + 候选牌」，
   * 而是「一组 { 牌, 合法目标 }」。多次调用按调用顺序排队。
   */
  outCard(player: IPlayer, card: ICard, targetIds?: string[]): void {
    const queue = this.playAnswers.get(player.id) ?? []
    queue.push({ card, targetIds })
    this.playAnswers.set(player.id, queue)
  }

  /**
   * 指定某人**第 n 次**被问到时的应答（n 从 0 起，按该玩家匹配该提示的询问序号）
   *
   * 无懈可击的抵消链里同一个玩家会被问好几次（每一层一次），
   * 而各层的提示文案都含「无懈可击」——只有按顺序编排才能表达
   * 「第一层放弃、第二层出牌」这种剧本。
   */
  scriptNth(
    player: IPlayer,
    promptSnippet: string,
    nth: number,
    card: ICard | null,
  ): void {
    const key = `${player.id}:${promptSnippet}`
    let bucket = this.nthAnswers.get(key)
    if (!bucket) {
      bucket = new Map()
      this.nthAnswers.set(key, bucket)
    }
    bucket.set(nth, card)
  }

  /** 某个玩家被问过几次（按提示片段过滤） */
  askCount(player: IPlayer, promptSnippet: string): number {
    return this.asked.filter(
      (entry) => entry.startsWith(`${player.id}:`) && entry.includes(promptSnippet),
    ).length
  }

  private resolve(player: IPlayer, prompt: string): ICard | null {
    this.asked.push(`${player.id}:${prompt}`)

    // 按顺序编排的应答优先——它们表达的是「第几次被问」这种剧本
    for (const [key, bucket] of this.nthAnswers) {
      const [playerId, ...rest] = key.split(':')
      const snippet = rest.join(':')
      if (playerId !== player.id || !prompt.includes(snippet)) continue

      const occurrence =
        this.asked.filter(
          (entry) => entry.startsWith(`${player.id}:`) && entry.includes(snippet),
        ).length - 1

      if (bucket.has(occurrence)) return bucket.get(occurrence)!
    }

    for (const [key, card] of this.answers) {
      const snippet = key.split(':').slice(1).join(':')
      if (key.startsWith(`${player.id}:`) && prompt.includes(snippet)) {
        return card
      }
    }
    return null
  }

  async askForResponse(
    player: IPlayer,
    prompt: string,
    validCards: ICard[],
  ): Promise<ICard | null> {
    const chosen = this.resolve(player, prompt)
    if (chosen && validCards.some((c) => c.instanceId === chosen.instanceId)) {
      return chosen
    }
    return null
  }

  /**
   * 出牌决策 —— 出牌阶段唯一的入口
   *
   * 之前这里**根本没有实现**，`PhaseManager.doPhaseUse` 一调就抛 TypeError，
   * 而它外面包着 `try { … } catch { phaseEnded = true }`——
   * 于是出牌阶段在所有测试里都是「静默跳过」，从没被真正跑过。
   * 补上之后 `outCard` 才能表达「回合内打出某张牌打某人」。
   */
  async askForCardPlay(
    player: IPlayer,
    options: CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    this.asked.push(`${player.id}:出牌阶段`)

    const queue = this.playAnswers.get(player.id)
    if (!queue || queue.length === 0) return null

    const wanted = queue[0]!
    const option = options.find((o) => o.card.instanceId === wanted.card.instanceId)
    if (!option) return null

    // 剧本里点名要打谁就按名字筛；没点名就按这张牌的目标数规则取
    // （AOE 取 0 个、借刀杀人取 2 个）——「取一个」只是多数牌的巧合。
    const targets = wanted.targetIds
      ? option.validTargets.filter((p) => wanted.targetIds!.includes(p.id))
      : TargetSystem.pickTargets(option)

    // 打出去就出队，否则出牌阶段的 while 循环会无限重复同一张牌
    queue.shift()
    return { card: option.card, targets }
  }

  async askForDiscard(_player: IPlayer, count: number, validCards: ICard[]): Promise<ICard[]> {
    // 默认弃最前面的几张（确定性优先，不引入随机）
    return validCards.slice(0, count)
  }

  async askForTarget(
    _player: IPlayer,
    candidates: IPlayer[],
    _prompt: string,
    minTargets = 1,
  ): Promise<IPlayer[]> {
    // 默认取前 minTargets 个：确定性优先，不引入随机
    return candidates.slice(0, Math.max(minTargets, 1))
  }
  async askForCardSelection(): Promise<ICard[]> {
    return []
  }
  async askForEffectUse(): Promise<ISkill | null> {
    return null
  }
  async askForHeroSelect(
    _player: IPlayer,
    candidates: { id: string }[],
  ): Promise<string> {
    return candidates[0]?.id ?? ''
  }
  notifyPlayer(): void {}
  notifyAll(): void {}
  async showGameResult(): Promise<void> {}

  async askForConfirmation(): Promise<boolean> {
    return false
  }
  async notify(): Promise<void> {}
}

/**
 * 线性同余伪随机 —— 同一种子必得同一局
 *
 * 真正的实现已经搬进 `@core/services/seeded-random`（mulberry32），
 * 测试与引擎共用同一个，免得「测试能复现、线上复现不了」。
 */
export { SeededRandomService } from '@core/services/seeded-random'

/** 构造一张卡牌定义 */
export function cardDef(
  id: string,
  tags: string | string[],
  extra: Partial<CardDefinition> = {},
): CardDefinition {
  return {
    id,
    name: id,
    type: 'basic' as never,
    suit: CardSuit.None,
    rank: CardRank.A,
    description: '',
    tags: (Array.isArray(tags) ? tags : [tags]) as never,
    effectIds: [],
    isDelayed: false,
    canBeCanceled: true,
    ...extra,
  }
}

/** 造一张牌塞进某玩家手牌 */
export function giveCard(player: IPlayer, def: CardDefinition): ICard {
  const card = Card.create(def)
  card.zone = ZoneType.Hand
  card.owner = player
  player.handCards.push(card)
  return card
}

export interface TestEnv<D extends IUIDecisionService = ScriptedDecisionService> {
  engine: NonNullable<ReturnType<GameBoot['getEngine']>>
  /** 传进来的那个决策服务本身——用它自己的类型，便于读它自己的观测字段 */
  decisions: D
  players(): IPlayer[]
}

/**
 * 起一局标准 5 人局
 *
 * @param decisions 可选的决策替身——需要观察「问了什么 / 候选里有什么」
 *   的测试（Phase 16 的视作窗口就是这样）自己塞一个子类进来。
 *   不传则用 `ScriptedDecisionService`，于是 `env.decisions.answers`
 *   这类字段仍然可直接读。
 */
export async function createTestEnv<D extends IUIDecisionService = ScriptedDecisionService>(
  decisions?: D,
): Promise<TestEnv<D>> {
  const service = (decisions ?? new ScriptedDecisionService()) as D
  const boot = GameBoot.createStandard5P({
    loggerService: new SilentLoggerService(),
    randomService: new IdentityRandomService(),
    decisionService: service,
  })
  await boot.boot()
  const engine = boot.getEngine()!
  return { engine, decisions: service, players: () => engine.state.players }
}
