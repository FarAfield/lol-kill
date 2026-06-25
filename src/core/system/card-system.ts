// ============================================================
// 联盟杀 · CardSystem — 卡牌生命周期管理
//
// 管理卡牌在各区域间的流转：
// - 使用卡牌（hand → processing → discard/equip/judge）
// - 弃置卡牌（hand/equip → discard）
// - 装备卡牌（hand → equip）
// - 放置判定牌（hand → judge）
// - 卡牌转移（hand → 其他玩家 hand）
//
// 所有操作统一通过此系统执行，确保 zone / owner / visibleTo 一致。
// ============================================================

import { ZoneType } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { IGameState } from '@core/contracts/game.interface'

/**
 * 卡牌系统
 *
 * 管理卡牌区域间流转。所有区域变更必须通过此系统，
 * 以保持 zone、owner、visibleTo 三字段一致。
 */
export class CardSystem {
  constructor(private state: IGameState) {}

  // ── 区域移动基方法 ──

  /**
   * 将卡牌移动到指定区域，并可选更新所属玩家。
   *
   * 自动处理可见性：
   * - Deck → 不可见
   * - Discard → 不可见
   * - Hand → 仅 owner 可见
   * - Equip / Judge / Processing → 全员可见
   *
   * @param card    目标卡牌
   * @param toZone  目标区域
   * @param player  新的所属玩家（可选）
   */
  moveCard(card: ICard, toZone: ZoneType, player?: IPlayer): void {
    // 从原区域移除
    this.removeFromCurrentZone(card)

    // 设置新区域
    card.zone = toZone
    if (player) {
      card.owner = player
    }

    // 添加到新区域
    this.addToZone(card, toZone, player ?? card.owner)

    // 更新可见性
    this.updateVisibility(card, toZone)
  }

  /**
   * 从卡牌当前所在区域移除。
   */
  private removeFromCurrentZone(card: ICard): void {
    const zone = card.zone
    const owner = card.owner

    switch (zone) {
      case ZoneType.Hand:
        if (owner) {
          owner.handCards = owner.handCards.filter((c) => c.id !== card.id)
        }
        break
      case ZoneType.Equip:
        if (owner) {
          owner.equipCards = owner.equipCards.filter((c) => c.id !== card.id)
        }
        break
      case ZoneType.Judge:
        if (owner) {
          owner.judgeCards = owner.judgeCards.filter((c) => c.id !== card.id)
        }
        break
      case ZoneType.Deck:
        this.state.deck = this.state.deck.filter((c) => c.id !== card.id)
        break
      case ZoneType.Discard:
        this.state.discardPile = this.state.discardPile.filter((c) => c.id !== card.id)
        break
      case ZoneType.Processing:
        this.state.processingCards = this.state.processingCards.filter(
          (c) => c.id !== card.id,
        )
        break
    }
  }

  /**
   * 将卡牌添加到目标区域。
   */
  private addToZone(card: ICard, zone: ZoneType, player?: IPlayer): void {
    switch (zone) {
      case ZoneType.Hand:
        if (player) {
          player.handCards.push(card)
        }
        break
      case ZoneType.Equip:
        if (player) {
          // 装备区按 equipSlot 放置，替换同槽位旧装备
          if (card.equipSlot) {
            const oldEquip = player.getEquipInSlot(card.equipSlot)
            if (oldEquip) {
              player.equipCards = player.equipCards.filter((c) => c.id !== oldEquip.id)
              this.discardCard(oldEquip, player)
            }
          }
          player.equipCards.push(card)
        }
        break
      case ZoneType.Judge:
        if (player) {
          player.judgeCards.push(card)
        }
        break
      case ZoneType.Deck:
        this.state.deck.push(card)
        break
      case ZoneType.Discard:
        this.state.discardPile.push(card)
        break
      case ZoneType.Processing:
        this.state.processingCards.push(card)
        break
    }
  }

  /**
   * 更新卡牌可见性。
   */
  private updateVisibility(card: ICard, zone: ZoneType): void {
    switch (zone) {
      case ZoneType.Deck:
      case ZoneType.Discard:
        card.visibleTo = []
        break
      case ZoneType.Hand:
        card.visibleTo = card.owner ? [card.owner] : []
        break
      case ZoneType.Equip:
      case ZoneType.Judge:
      case ZoneType.Processing:
        card.visibleTo = [...this.state.players]
        break
    }
  }

  // ── 高级操作 ──

  /**
   * 使用卡牌——从手牌移入处理区。
   *
   * @param card    要使用的卡牌
   * @param source  使用卡牌的玩家
   * @param targets 卡牌目标（可选，供事件使用）
   */
  useCard(card: ICard, source: IPlayer, targets?: IPlayer[]): void {
    // 验证卡牌在来源玩家手牌区
    if (card.zone !== ZoneType.Hand || card.owner?.id !== source.id) {
      throw new Error(
        `CardSystem.useCard: card "${card.name}" (${card.id}) is not in ${source.id}'s hand`,
      )
    }

    this.moveCard(card, ZoneType.Processing, source)
  }

  /**
   * 弃置卡牌——从任意区域移入弃牌堆。
   *
   * @param card   要弃置的卡牌
   * @param player 弃置该牌的玩家（用于权限验证）
   */
  discardCard(card: ICard, player: IPlayer): void {
    // 只能弃置自己区域内的牌（手牌、装备、判定）
    const validZones: ZoneType[] = [ZoneType.Hand, ZoneType.Equip, ZoneType.Judge]
    if (!validZones.includes(card.zone)) {
      throw new Error(
        `CardSystem.discardCard: cannot discard card in ${card.zone} zone`,
      )
    }

    if (card.owner?.id !== player.id) {
      throw new Error(
        `CardSystem.discardCard: player ${player.id} does not own card "${card.name}"`,
      )
    }

    this.moveCard(card, ZoneType.Discard)
  }

  /**
   * 批量弃置卡牌。
   */
  discardCards(cards: ICard[], player: IPlayer): void {
    for (const card of cards) {
      this.discardCard(card, player)
    }
  }

  /**
   * 装备卡牌——从手牌移入装备区。
   *
   * 如果对应槽位已有装备，旧装备会被替换并移入弃牌堆。
   *
   * @param card   要装备的卡牌
   * @param player 装备者
   */
  equipCard(card: ICard, player: IPlayer): void {
    if (card.zone !== ZoneType.Hand || card.owner?.id !== player.id) {
      throw new Error(
        `CardSystem.equipCard: card "${card.name}" is not in ${player.id}'s hand`,
      )
    }

    if (!card.equipSlot) {
      throw new Error(
        `CardSystem.equipCard: card "${card.name}" has no equipSlot`,
      )
    }

    // 检查同槽位旧装备（addToZone 中已处理替换，此处额外检查）
    const oldEquip = player.getEquipInSlot(card.equipSlot)
    if (oldEquip) {
      // 旧装备移入弃牌堆（moveCard 会自动从装备区移除）
      this.moveCard(oldEquip, ZoneType.Discard)
    }

    this.moveCard(card, ZoneType.Equip, player)
  }

  /**
   * 卸下装备——从装备区移入手牌区（或弃牌堆）。
   *
   * @param card       要卸下的装备牌
   * @param player     装备者
   * @param toDiscard  是否直接弃置（默认 false = 回到手牌）
   */
  unequipCard(card: ICard, player: IPlayer, toDiscard: boolean = false): void {
    if (card.zone !== ZoneType.Equip || card.owner?.id !== player.id) {
      throw new Error(
        `CardSystem.unequipCard: card "${card.name}" is not in ${player.id}'s equip area`,
      )
    }

    const targetZone = toDiscard ? ZoneType.Discard : ZoneType.Hand
    this.moveCard(card, targetZone, player)
  }

  /**
   * 放置判定牌——将延时锦囊移入判定区。
   *
   * @param card   延时锦囊牌
   * @param player 被放置判定的玩家
   */
  placeJudgeCard(card: ICard, player: IPlayer): void {
    if (!card.isDelayed) {
      throw new Error(
        `CardSystem.placeJudgeCard: card "${card.name}" is not a delayed card`,
      )
    }

    // 延时锦囊可以来自手牌或处理区
    const validZones: ZoneType[] = [ZoneType.Hand, ZoneType.Processing]
    if (!validZones.includes(card.zone)) {
      throw new Error(
        `CardSystem.placeJudgeCard: card "${card.name}" is in invalid zone ${card.zone}`,
      )
    }

    this.moveCard(card, ZoneType.Judge, player)
  }

  /**
   * 判定结束——将判定牌从判定区移入弃牌堆。
   *
   * @param card   判定牌
   * @param player 判定区所属玩家
   */
  finishJudge(card: ICard, player: IPlayer): void {
    if (card.zone !== ZoneType.Judge || card.owner?.id !== player.id) {
      throw new Error(
        `CardSystem.finishJudge: card "${card.name}" is not in ${player.id}'s judge area`,
      )
    }

    this.moveCard(card, ZoneType.Discard)
  }

  /**
   * 卡牌转移——将卡牌从一个玩家转移给另一个玩家。
   *
   * 用于过河拆桥、顺手牵羊等效果。
   * 支持从手牌区、装备区、判定区转移。
   *
   * @param card       要转移的卡牌
   * @param fromPlayer 来源玩家
   * @param toPlayer   目标玩家
   * @param toZone     目标区域（默认为 Hand）
   */
  transferCard(
    card: ICard,
    fromPlayer: IPlayer,
    toPlayer: IPlayer,
    toZone: ZoneType = ZoneType.Hand,
  ): void {
    if (card.owner?.id !== fromPlayer.id) {
      throw new Error(
        `CardSystem.transferCard: card "${card.name}" is not owned by ${fromPlayer.id}`,
      )
    }

    const validZones: ZoneType[] = [ZoneType.Hand, ZoneType.Equip, ZoneType.Judge]
    if (!validZones.includes(card.zone)) {
      throw new Error(
        `CardSystem.transferCard: cannot transfer card in ${card.zone} zone`,
      )
    }

    this.moveCard(card, toZone, toPlayer)
  }

  /**
   * 批量转移卡牌。
   */
  transferCards(
    cards: ICard[],
    fromPlayer: IPlayer,
    toPlayer: IPlayer,
    toZone: ZoneType = ZoneType.Hand,
  ): void {
    for (const card of cards) {
      this.transferCard(card, fromPlayer, toPlayer, toZone)
    }
  }

  /**
   * 将卡牌从处理区移入弃牌堆（卡牌结算完毕）。
   */
  finishProcessing(card: ICard): void {
    if (card.zone !== ZoneType.Processing) {
      throw new Error(
        `CardSystem.finishProcessing: card "${card.name}" is not in processing zone`,
      )
    }
    this.moveCard(card, ZoneType.Discard)
  }

  /**
   * 获得卡牌——将卡牌移入玩家手牌区。
   *
   * 用于摸牌、顺手牵羊等场景。
   *
   * @param card   卡牌
   * @param player 获得卡牌的玩家
   */
  obtainCard(card: ICard, player: IPlayer): void {
    this.moveCard(card, ZoneType.Hand, player)
  }

  /**
   * 批量获得卡牌。
   */
  obtainCards(cards: ICard[], player: IPlayer): void {
    for (const card of cards) {
      this.obtainCard(card, player)
    }
  }
}
