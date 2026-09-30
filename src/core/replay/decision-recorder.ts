// ============================================================
// 联盟杀 · 决策录制 / 重放
//
// 一局游戏 = 一颗种子 + 一串玩家决策。
//
// 种子决定「洗出的牌序、身份、英雄候选」；决策决定「每个人怎么打」。
// 两者记下来，这局就能在任何时候、任何机器上重新长出来——
// 无论是复盘、观战、反作弊还是「刚改了引擎，老局面还跑得一样吗」。
//
// 录制：`DecisionRecorder` 包住真正的决策服务，把每次询问与应答记成一条
//        `ReplayDecision`。它自己不做任何决定。
// 重放：`ReplayDecisionService` 按序取用这批决策。它也不做决定——
//        **每一步都先核对「问的是不是同一个问题」**（指纹校验），
//        对不上立刻抛 `ReplayDivergenceError`，而不是凑合着继续跑。
//        凑合出来的回放比放不出来更有害：它会让你以为改坏了的东西没坏。
// ============================================================

import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import type {
  CardPlayOption,
  CardPlayResult,
  IUIDecisionService,
} from '@core/contracts/services.interface'

/** 决策种类 */
export type DecisionKind =
  | 'cardPlay'
  | 'response'
  | 'target'
  | 'effectUse'
  | 'discard'
  | 'heroSelect'

/**
 * 一条被录下来的决策
 *
 * 只存**可跨局复现的标识**：卡牌记 instanceId、玩家记座位 id、
 * 英雄与技能记定义 id。实体引用一局一换，存档里留不住。
 */
export interface ReplayDecision {
  kind: DecisionKind
  playerId: string
  /** 请求指纹 —— 回放时用它确认「问的是同一个问题」 */
  request: string
  /** 应答 —— 空数组表示放弃 / 跳过 */
  response: string[]
}

/**
 * 回放与录像对不上
 *
 * 这不是「重放失败」，而是**引擎行为变了**：同一串输入长出了不同的局面。
 */
export class ReplayDivergenceError extends Error {
  constructor(
    readonly step: number,
    message: string,
  ) {
    super(`回放发散（第 ${step} 条决策）：${message}`)
    this.name = 'ReplayDivergenceError'
  }
}

// ── 指纹构造 ──
// 候选集一律**排序后**拼接：备受关注的是「有哪些选项」，
// 而不是它们的排列顺序——后者不过是 Map 迭代顺序的副产品。

function cardIds(cards: readonly ICard[]): string {
  return cards
    .map((c) => c.instanceId)
    .sort()
    .join(',')
}

function playerIds(players: readonly IPlayer[]): string {
  return players
    .map((p) => p.id)
    .sort()
    .join(',')
}

function requestOf(kind: DecisionKind, playerId: string, detail: string): string {
  return `${kind}|${playerId}|${detail}`
}

// ============================================================
// 录制
// ============================================================

/**
 * 决策录制器 —— 包住一个真实决策服务，原样转发并记录
 *
 * 它必须**完全透明**：录了和不录，对局进展一模一样。
 * 因此全部逻辑就是「先问里面的，再把问答写下来」。
 */
export class DecisionRecorder implements IUIDecisionService {
  readonly decisions: ReplayDecision[] = []

  constructor(private readonly inner: IUIDecisionService) {}

  async askForCardPlay(
    player: IPlayer,
    options: CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    const result = await this.inner.askForCardPlay(player, options)
    this.decisions.push({
      kind: 'cardPlay',
      playerId: player.id,
      request: requestOf(
        'cardPlay',
        player.id,
        options
          .map((o) => `${o.card.instanceId}:${playerIds(o.validTargets)}`)
          .sort()
          .join(';'),
      ),
      response: result
        ? [result.card.instanceId, ...result.targets.map((t) => t.id)]
        : [],
    })
    return result
  }

  async askForResponse(
    player: IPlayer,
    prompt: string,
    validCards: ICard[],
    timeout?: number,
  ): Promise<ICard | null> {
    const card = await this.inner.askForResponse(player, prompt, validCards, timeout)
    this.decisions.push({
      kind: 'response',
      playerId: player.id,
      request: requestOf('response', player.id, `${prompt}|${cardIds(validCards)}`),
      response: card ? [card.instanceId] : [],
    })
    return card
  }

  async askForTarget(
    player: IPlayer,
    candidates: IPlayer[],
    prompt: string,
    minTargets?: number,
    maxTargets?: number,
  ): Promise<IPlayer[]> {
    const targets = await this.inner.askForTarget(
      player,
      candidates,
      prompt,
      minTargets,
      maxTargets,
    )
    this.decisions.push({
      kind: 'target',
      playerId: player.id,
      request: requestOf('target', player.id, `${prompt}|${playerIds(candidates)}`),
      response: targets.map((t) => t.id),
    })
    return targets
  }

  async askForEffectUse(
    player: IPlayer,
    effects: ISkill[],
    prompt: string,
  ): Promise<ISkill | null> {
    const effect = await this.inner.askForEffectUse(player, effects, prompt)
    this.decisions.push({
      kind: 'effectUse',
      playerId: player.id,
      request: requestOf(
        'effectUse',
        player.id,
        `${prompt}|${effects.map((e) => e.id).sort().join(',')}`,
      ),
      response: effect ? [effect.id] : [],
    })
    return effect
  }

  async askForDiscard(
    player: IPlayer,
    count: number,
    validCards: ICard[],
  ): Promise<ICard[]> {
    const cards = await this.inner.askForDiscard(player, count, validCards)
    this.decisions.push({
      kind: 'discard',
      playerId: player.id,
      request: requestOf('discard', player.id, `${count}|${cardIds(validCards)}`),
      response: cards.map((c) => c.instanceId),
    })
    return cards
  }

  async askForHeroSelect(
    player: IPlayer,
    candidates: { id: string; name: string; title: string; kingdom: string }[],
    selectCount: number,
  ): Promise<string> {
    const heroId = await this.inner.askForHeroSelect(player, candidates, selectCount)
    this.decisions.push({
      kind: 'heroSelect',
      playerId: player.id,
      request: requestOf(
        'heroSelect',
        player.id,
        `${selectCount}|${candidates.map((c) => c.id).sort().join(',')}`,
      ),
      response: heroId ? [heroId] : [],
    })
    return heroId
  }

  notifyPlayer(player: IPlayer, message: string, level: 'info' | 'warn' | 'error'): void {
    this.inner.notifyPlayer(player, message, level)
  }

  notifyAll(message: string, level: 'info' | 'warn' | 'error'): void {
    this.inner.notifyAll(message, level)
  }

  async showGameResult(result: { winner: unknown; reason: string }): Promise<void> {
    await this.inner.showGameResult(result as never)
  }
}

// ============================================================
// 重放
// ============================================================

/**
 * 按录像重演的决策服务
 *
 * 逐个取出录好的应答。每一步都对三件事做校验：
 * 决策种类、询问对象、请求指纹——少一道校验，「跑完了」就可能
 * 只是巧合（少回答一步、回答给错的人，局面照样能推进）。
 */
export class ReplayDecisionService implements IUIDecisionService {
  private cursor = 0

  constructor(private readonly decisions: readonly ReplayDecision[]) {}

  /** 已消费的决策条数 */
  get consumed(): number {
    return this.cursor
  }

  /** 录像是否已被读完 */
  get exhausted(): boolean {
    return this.cursor >= this.decisions.length
  }

  private take(kind: DecisionKind, playerId: string, request: string): string[] {
    const step = this.cursor
    const decision = this.decisions[step]
    if (!decision) {
      throw new ReplayDivergenceError(
        step,
        `录像里没有第 ${step} 条决策了（引擎多问了一次：${kind} / ${playerId}）`,
      )
    }
    if (decision.kind !== kind) {
      throw new ReplayDivergenceError(
        step,
        `决策种类不符：录像 ${decision.kind} vs 实际 ${kind}`,
      )
    }
    if (decision.playerId !== playerId) {
      throw new ReplayDivergenceError(
        step,
        `被询问的人不符：录像 ${decision.playerId} vs 实际 ${playerId}`,
      )
    }
    if (decision.request !== request) {
      throw new ReplayDivergenceError(
        step,
        `问的不是同一个问题\n    录像: ${decision.request}\n    实际: ${request}`,
      )
    }
    this.cursor++
    return decision.response
  }

  async askForCardPlay(
    player: IPlayer,
    options: CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    const request = requestOf(
      'cardPlay',
      player.id,
      options
        .map((o) => `${o.card.instanceId}:${playerIds(o.validTargets)}`)
        .sort()
        .join(';'),
    )
    const response = this.take('cardPlay', player.id, request)
    if (response.length === 0) return null

    const [cardId, ...targetIds] = response
    const option = options.find((o) => o.card.instanceId === cardId)
    // 候选里找不到这张牌：不是「玩家改主意」，而是**局面已经不是录像里的那个**
    if (!option) {
      throw new ReplayDivergenceError(
        this.cursor - 1,
        `录像要打出的牌 ${cardId} 不在候选里（候选: ${cardIds(options.map((o) => o.card))}）`,
      )
    }

    const targets = option.validTargets.filter((t) => targetIds.includes(t.id))
    return { card: option.card, targets }
  }

  async askForResponse(
    player: IPlayer,
    prompt: string,
    validCards: ICard[],
  ): Promise<ICard | null> {
    const request = requestOf('response', player.id, `${prompt}|${cardIds(validCards)}`)
    const response = this.take('response', player.id, request)
    if (response.length === 0) return null

    const card = validCards.find((c) => c.instanceId === response[0])
    if (!card) {
      throw new ReplayDivergenceError(
        this.cursor - 1,
        `录像要响应的牌 ${response[0]} 不在候选里`,
      )
    }
    return card
  }

  async askForTarget(
    player: IPlayer,
    candidates: IPlayer[],
    prompt: string,
  ): Promise<IPlayer[]> {
    const request = requestOf('target', player.id, `${prompt}|${playerIds(candidates)}`)
    const response = this.take('target', player.id, request)
    return candidates.filter((c) => response.includes(c.id))
  }

  async askForEffectUse(
    player: IPlayer,
    effects: ISkill[],
    prompt: string,
  ): Promise<ISkill | null> {
    const request = requestOf(
      'effectUse',
      player.id,
      `${prompt}|${effects.map((e) => e.id).sort().join(',')}`,
    )
    const response = this.take('effectUse', player.id, request)
    if (response.length === 0) return null
    return effects.find((e) => e.id === response[0]) ?? null
  }

  async askForDiscard(
    player: IPlayer,
    count: number,
    validCards: ICard[],
  ): Promise<ICard[]> {
    const request = requestOf('discard', player.id, `${count}|${cardIds(validCards)}`)
    const response = this.take('discard', player.id, request)
    return validCards.filter((c) => response.includes(c.instanceId))
  }

  async askForHeroSelect(
    player: IPlayer,
    candidates: { id: string; name: string; title: string; kingdom: string }[],
    selectCount: number,
  ): Promise<string> {
    const request = requestOf(
      'heroSelect',
      player.id,
      `${selectCount}|${candidates.map((c) => c.id).sort().join(',')}`,
    )
    const response = this.take('heroSelect', player.id, request)
    return response[0] ?? candidates[0]?.id ?? ''
  }

  notifyPlayer(): void {}
  notifyAll(): void {}
  async showGameResult(): Promise<void> {}
}
