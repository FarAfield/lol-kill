// ============================================================
// 联盟杀 · AutoDecisionService — 无脑但有定式的自动玩家
//
// 回放与批量模拟需要一个「不要动脑」的决策源：它不评估局面，
// 只按固定规则应答（能出就出第一张、目标取第一个、弃牌弃前面几张）。
//
// 它存在的理由是**快**：AI 每问一次都要扫一遍手牌与目标，
// 一局 8 人局要问几百次；而回放关心的是「同一串决策能不能复现同一局」，
// 决策本身好不好根本不重要。
//
// 代价是它比 AI 更容易把局面带向极端（人人猛攻），
// 因此它适合做**回归**，不适合做平衡性验证。
// ============================================================

import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import type {
  CardPlayOption,
  CardPlayResult,
  IUIDecisionService,
} from '@core/contracts/services.interface'

export class AutoDecisionService implements IUIDecisionService {
  /** 出牌：取第一张「有合法目标」的牌；都不挑目标就取第一张 */
  async askForCardPlay(
    _player: IPlayer,
    options: CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    if (options.length === 0) return null
    const option = options.find((o) => o.validTargets.length > 0) ?? options[0]!
    return { card: option.card, targets: option.validTargets.slice(0, 1) }
  }

  /** 响应：有牌就出第一张 */
  async askForResponse(
    _player: IPlayer,
    _prompt: string,
    validCards: ICard[],
  ): Promise<ICard | null> {
    return validCards[0] ?? null
  }

  /** 选目标：取前 minTargets 个 */
  async askForTarget(
    _player: IPlayer,
    candidates: IPlayer[],
    _prompt: string,
    minTargets = 1,
  ): Promise<IPlayer[]> {
    return candidates.slice(0, Math.max(minTargets, 1))
  }

  /** 发动技能：一律不发动（技能往往需要额外的交互编排） */
  async askForEffectUse(): Promise<ISkill | null> {
    return null
  }

  /** 弃牌：弃前面几张 */
  async askForDiscard(
    _player: IPlayer,
    count: number,
    validCards: ICard[],
  ): Promise<ICard[]> {
    return validCards.slice(0, count)
  }

  /** 选英雄：取第一个候选 */
  async askForHeroSelect(
    _player: IPlayer,
    candidates: { id: string }[],
  ): Promise<string> {
    return candidates[0]?.id ?? ''
  }

  notifyPlayer(): void {}
  notifyAll(): void {}
  async showGameResult(): Promise<void> {}
}
