// ============================================================
// 联盟杀 · HumanDecisionService — 人类玩家的决策通道
//
// **欠账 D34。** 它为什么存在：引擎只认 `IUIDecisionService` 一个口子，
// 而视图此前从不注入它。后果不是「弹窗不弹」这么温和——
// `EffectContext.waitForResponse`（`effect-context.ts:289`）进门第一行就是
// `if (!this.deps.decisionService) return { confirmed: false }`，
// 于是**每一次【闪】【桃】【无懈可击】都一律拒绝**：攻击必中、濒死必死。
//
// **为什么不能直接把 UI 塞进去当决策服务**：引擎对**所有座位**都提问。
// 除了人类的那一位，其余都是 AI——把他们的问题也弹给人看，
// 等于让那个人替 AI 打牌。所以这一层唯一的正事是**按座位分流**：
// 自己的座走 UI 通道，其余一律转给兜底的那个（AI / 自动决策）。
//
// **铁律：每个方法都必须有答案。** 这些问题是在事件流水线被 pause 挂起的
// 时候问出来的，一个永不 resolve 的 Promise 就是一次事件栈死锁。
// 因此 UI 通道是**可选**的：没登记就用缺省答案（拒绝 / 不出 / 自动弃前 N 张），
// 宁可「替他做了决定」，也不能「让整局卡住」。
//
// 用法（视图里）：
//   const service = new HumanDecisionService({
//     fallback: new AutoDecisionService(),
//     channel: { askForResponse, askForCardPlay, ... },   // 由各个 hook 提供
//   })
//   ctrl.setDecisionService(service)
// ============================================================

import type { RoleType } from '@core/contracts/enums'
import type { CardBudget } from '@core/skill/card-budget'
import type { IModQuery } from '@core/contracts/mod.interface'
import type { ISkillRegistry } from '@core/contracts/skill.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import type {
  CardPlayOption,
  CardPlayResult,
  IUIDecisionService,
} from '@core/contracts/services.interface'

/** 英雄选择候选（与 `IUIDecisionService.askForHeroSelect` 同形） */
export interface HeroCandidate {
  id: string
  name: string
  title: string
  kingdom: string
}

// ── 各个请求 ──
//
// 参数打包成一个对象而不是摊成一串位置参数：
// `askForTarget(player, candidates, prompt, min, max)` 这种签字，
// 读的人永远记不住第 4 个 `number` 是下限还是上限。

export interface CardPlayRequest {
  player: IPlayer
  /** 引擎给出的此刻可打的牌（含目标数与合法目标） */
  options: readonly CardPlayOption[]
}

export interface ResponseRequest {
  player: IPlayer
  prompt: string
  validCards: ICard[]
  timeout?: number
}

export interface TargetRequest {
  player: IPlayer
  candidates: IPlayer[]
  prompt: string
  minTargets?: number
  maxTargets?: number
}

export interface DiscardRequest {
  player: IPlayer
  count: number
  validCards: ICard[]
}

export interface EffectUseRequest {
  player: IPlayer
  effects: ISkill[]
  prompt: string
}

export interface HeroSelectRequest {
  player: IPlayer
  candidates: HeroCandidate[]
  selectCount: number
}

/**
 * UI 通道 —— 人类座位的提问会从这里出去。
 *
 * 全是可选的：**缺省答案接得住**，因此一个都没必要强塞。
 * 视图按需登记，登记几个就支持几种交互。
 */
export interface DecisionChannel {
  askForCardPlay?(req: CardPlayRequest): Promise<CardPlayResult | null>
  askForResponse?(req: ResponseRequest): Promise<ICard | null>
  askForTarget?(req: TargetRequest): Promise<IPlayer[]>
  askForDiscard?(req: DiscardRequest): Promise<ICard[]>
  askForEffectUse?(req: EffectUseRequest): Promise<ISkill | null>
  askForHeroSelect?(req: HeroSelectRequest): Promise<string>
}

export interface HumanDecisionOptions {
  /** 人类玩家的座位号（默认 0 —— 视图里 `is-human` 也是这么判的） */
  humanSeatIndex?: number
  /** 非人类座位的兜底决策方（AI / 自动决策） */
  fallback: IUIDecisionService
  /** UI 通道 */
  channel?: DecisionChannel
}

export class HumanDecisionService implements IUIDecisionService {
  private readonly humanSeatIndex: number
  private readonly fallback: IUIDecisionService
  private readonly channel: DecisionChannel

  constructor(options: HumanDecisionOptions) {
    this.humanSeatIndex = options.humanSeatIndex ?? 0
    this.fallback = options.fallback
    this.channel = options.channel ?? {}
  }

  /**
   * 这个座位是不是人。
   *
   * 判的是**座位**而不是「是不是当前行动者」：被问到的时候，
   * 出手的往往是别人——【杀】打过来，轮不到回合归属说话。
   */
  private isHuman(player: IPlayer): boolean {
    return player.seatIndex === this.humanSeatIndex
  }

  // ── 出牌 ──

  async askForCardPlay(
    player: IPlayer,
    options: CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    if (!this.isHuman(player)) return this.fallback.askForCardPlay(player, options)
    if (!this.channel.askForCardPlay) return null // 缺省：结束出牌阶段
    return this.channel.askForCardPlay({ player, options })
  }

  // ── 响应（出闪 / 出桃 / 无懈可击）──

  async askForResponse(
    player: IPlayer,
    prompt: string,
    validCards: ICard[],
    timeout?: number,
  ): Promise<ICard | null> {
    if (!this.isHuman(player)) {
      return this.fallback.askForResponse(player, prompt, validCards, timeout)
    }
    if (!this.channel.askForResponse) return null // 缺省：不响应
    return this.channel.askForResponse({ player, prompt, validCards, timeout })
  }

  // ── 选目标 ──

  async askForTarget(
    player: IPlayer,
    candidates: IPlayer[],
    prompt: string,
    minTargets?: number,
    maxTargets?: number,
  ): Promise<IPlayer[]> {
    if (!this.isHuman(player)) {
      return this.fallback.askForTarget(player, candidates, prompt, minTargets, maxTargets)
    }
    if (!this.channel.askForTarget) return [] // 缺省：不选（= 拒绝）
    return this.channel.askForTarget({ player, candidates, prompt, minTargets, maxTargets })
  }

  // ── 弃牌 ──

  async askForDiscard(
    player: IPlayer,
    count: number,
    validCards: ICard[],
  ): Promise<ICard[]> {
    if (!this.isHuman(player)) {
      return this.fallback.askForDiscard(player, count, validCards)
    }
    if (!this.channel.askForDiscard) {
      // 缺省必须**弃够张数**：少弃一张，手牌就超过上限，
      // 规则在那儿摆着，替他从前头挑是最不坏的选择。
      return validCards.slice(0, count)
    }
    return this.channel.askForDiscard({ player, count, validCards })
  }

  // ── 发动技能 ──

  async askForEffectUse(
    player: IPlayer,
    effects: ISkill[],
    prompt: string,
  ): Promise<ISkill | null> {
    if (!this.isHuman(player)) {
      return this.fallback.askForEffectUse(player, effects, prompt)
    }
    if (!this.channel.askForEffectUse) return null // 缺省：不发动
    return this.channel.askForEffectUse({ player, effects, prompt })
  }

  // ── 选英雄 ──

  async askForHeroSelect(
    player: IPlayer,
    candidates: HeroCandidate[],
    selectCount: number,
  ): Promise<string> {
    if (!this.isHuman(player)) {
      return this.fallback.askForHeroSelect(player, candidates, selectCount)
    }
    if (!this.channel.askForHeroSelect) {
      // 缺省不能返回空串——那是「选了一个不存在的英雄」，
      // 比「替他选第一个」糟得多。
      return candidates[0]?.id ?? ''
    }
    return this.channel.askForHeroSelect({ player, candidates, selectCount })
  }

  // ── 通知（不参与分流：一律告知两边）──

  notifyPlayer(player: IPlayer, message: string, level: 'info' | 'warn' | 'error'): void {
    if (this.isHuman(player)) return
    this.fallback.notifyPlayer(player, message, level)
  }

  notifyAll(message: string, level: 'info' | 'warn' | 'error'): void {
    this.fallback.notifyAll(message, level)
  }

  async showGameResult(result: { winner: RoleType | null; reason: string }): Promise<void> {
    await this.fallback.showGameResult(result)
  }

  // ── 三个可选查询口：原样转给兜底 ──
  //
  // AI 看不见【诸葛连弩】的额度加成（D8）、看不见藤甲的加伤（D19）、
  // 算不出威胁度（D21），三次都是栽在这个转发上。这里人类不需要它们，
  // 但**兜底的那个需要**——不转就等于把 AI 的眼睛蒙上。

  setCardBudget?(budget: CardBudget): void {
    this.fallback.setCardBudget?.(budget)
  }

  setModQuery?(modQuery: IModQuery): void {
    this.fallback.setModQuery?.(modQuery)
  }

  setSkillRegistry?(skillRegistry: ISkillRegistry): void {
    this.fallback.setSkillRegistry?.(skillRegistry)
  }
}
