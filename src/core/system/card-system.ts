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
import type { GameStateSnapshot } from '@core/contracts/game.interface'

/**
 * 卡牌系统选项
 */
export interface CardSystemOptions {
  /**
   * 装备区发生增减时通知（涉及到的玩家，可能两个人：失去者与获得者）
   *
   * 装备技「装备时自动获得、卸下时自动失去」全靠这一声通知——
   * 挂在 `moveCard` 上而不是挂在 `equipCard` / `unequipCard` 上，
   * 是因为**拆装备、牵走装备走的也是 moveCard**，
   * 只在两个入口喊一声的话，那些路径会静默漏掉。
   */
  onEquipmentChange?: (players: IPlayer[]) => void
}

/**
 * 卡牌系统
 *
 * 管理卡牌区域间流转。所有区域变更必须通过此系统，
 * 以保持 zone、owner、visibleTo 三字段一致。
 */
export class CardSystem {
  private options: CardSystemOptions

  constructor(private state: GameStateSnapshot, options?: CardSystemOptions) {
    this.options = options ?? {}
  }

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
    // 流转前先把「从哪来、原来归谁」记下来——下面会改掉这两个字段
    const fromZone = card.zone
    const previousOwner = card.owner

    // 从原区域移除
    this.removeFromCurrentZone(card)

    // 设置新区域
    card.zone = toZone
    if (player) {
      card.owner = player
    } else if (toZone === ZoneType.Deck || toZone === ZoneType.Discard) {
      // 公共区域无持有者——否则回收弃牌堆后，这张牌会把旧 owner 带进新主人的手牌
      card.owner = undefined
    }

    // 添加到新区域
    this.addToZone(card, toZone, player ?? card.owner)

    // 更新可见性
    this.updateVisibility(card, toZone)

    if (fromZone === ZoneType.Equip || toZone === ZoneType.Equip) {
      this.notifyEquipmentChange(previousOwner, card.owner)
    }
  }

  /**
   * 通知装备区变动
   *
   * 进出装备区都算，两头的持有者都要通知：
   * 旧主人要摘掉装备技，新主人要挂上。
   */
  private notifyEquipmentChange(...candidates: (IPlayer | undefined)[]): void {
    const affected: IPlayer[] = []
    for (const player of candidates) {
      if (player && !affected.includes(player)) affected.push(player)
    }
    if (affected.length > 0) this.options.onEquipmentChange?.(affected)
  }

  /**
   * 虚拟牌的底牌 —— 移动一张牌之前，先把它换成真正该动的那几张
   *
   * 虚拟牌（`viewAs` 造出来的视图）**不属于任何区域**：它没有物理实体，
   * 真正被使用与弃置的是 `viewedFrom` 指向的底牌。于是每个「移动一张牌」
   * 的入口都要先做这一步翻译——用虚拟牌的人以为他在用这张视图，
   * 动了的是那几张真牌。
   *
   * 翻译放在这里是刻意的：本系统是唯一个能改区域的地方，出牌、
   * 响应出闪、濒死出桃走的都是这几个出口，因此翻译天然处处生效，
   * 内容层不需要知道「虚拟牌」这件事的存在。
   *
   * @returns 底牌；空数组表示这就是一张普通的真实卡牌
   */
  private baseCardsOf(card: ICard): ICard[] {
    if (!card.virtual || !card.viewedFrom?.length) return []

    return card.viewedFrom
      .map((instanceId) => this.findCard(instanceId))
      .filter((found): found is ICard => found !== undefined)
  }

  /** 按实例 id 找一张牌（全区域扫描） */
  private findCard(instanceId: string): ICard | undefined {
    const seen: ICard[] = [
      ...this.state.deck,
      ...this.state.discardPile,
      ...this.state.processingCards,
    ]
    for (const player of this.state.players) {
      seen.push(...player.handCards, ...player.equipCards, ...player.judgeCards)
    }
    return seen.find((card) => card.instanceId === instanceId)
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
          owner.handCards = owner.handCards.filter((c) => c.instanceId !== card.instanceId)
        }
        break
      case ZoneType.Equip:
        if (owner) {
          owner.equipCards = owner.equipCards.filter((c) => c.instanceId !== card.instanceId)
        }
        break
      case ZoneType.Judge:
        if (owner) {
          owner.judgeCards = owner.judgeCards.filter((c) => c.instanceId !== card.instanceId)
        }
        break
      case ZoneType.Deck:
        this.state.deck = this.state.deck.filter((c) => c.instanceId !== card.instanceId)
        break
      case ZoneType.Discard:
        this.state.discardPile = this.state.discardPile.filter((c) => c.instanceId !== card.instanceId)
        break
      case ZoneType.Processing:
        this.state.processingCards = this.state.processingCards.filter(
          (c) => c.instanceId !== card.instanceId,
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
              player.equipCards = player.equipCards.filter((c) => c.instanceId !== oldEquip.instanceId)
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
   * 只负责区域流转（手牌 → 处理区）。目标属于事件数据，不由牌堆系统持有。
   *
   * @param card   要使用的卡牌
   * @param source 使用卡牌的玩家
   */
  useCard(card: ICard, source: IPlayer): void {
    // 虚拟牌：真正流转的是底牌，视图本身只跟着改个区域标记供 UI / 日志读，
    // 但**不进任何区域数组**——区域的盈亏只由真牌决定。
    const bases = this.baseCardsOf(card)
    if (bases.length > 0) {
      for (const base of bases) this.useCard(base, source)
      card.zone = ZoneType.Processing
      return
    }

    // 验证卡牌在来源玩家手牌区
    if (card.zone !== ZoneType.Hand || card.owner?.id !== source.id) {
      throw new Error(
        `CardSystem.useCard: card "${card.name}" (${card.instanceId}) is not in ${source.id}'s hand`,
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
    // 打出一张虚拟闪 / 虚拟桃：丢的是它消耗的那张真牌
    const bases = this.baseCardsOf(card)
    if (bases.length > 0) {
      for (const base of bases) this.discardCard(base, player)
      card.zone = ZoneType.Discard
      return
    }

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
   * 无条件送进弃牌堆 —— 给「不该被拒绝的弃牌」用
   *
   * `discardCard` 会校验来源区域与持有者，还会过 `cardDiscardable`，
   * 那是**规则**：「这张牌能不能被弃」。而死亡清空三区是**结算**，
   * 不是规则——人都没了，牌必须走，没有「弃不掉」这一说。
   *
   * 以前死亡结算是直接 `player.handCards = []`，牌的 `zone` / `owner`
   * 原地不动，装备变动通知也不发：死者的装备技会一直挂在台账上。
   */
  moveToDiscard(card: ICard): void {
    this.moveCard(card, ZoneType.Discard)
  }

  /**
   * 装备卡牌——从手牌（或处理区）移入装备区。
   *
   * 走完整用牌流程时，装备牌会先被移入处理区再触发 `equip` 事件，
   * 因此处理区与手牌一样是合法来源。
   *
   * 如果对应槽位已有装备，旧装备会被替换并移入弃牌堆。
   *
   * @param card   要装备的卡牌
   * @param player 装备者
   */
  equipCard(card: ICard, player: IPlayer): void {
    const validSourceZones: ZoneType[] = [ZoneType.Hand, ZoneType.Processing]
    if (!validSourceZones.includes(card.zone) || card.owner?.id !== player.id) {
      throw new Error(
        `CardSystem.equipCard: card "${card.name}" is not in ${player.id}'s hand or processing area`,
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
    const bases = this.baseCardsOf(card)
    if (bases.length > 0) {
      // 虚拟牌结算完毕 = 它消耗的真牌离手进弃牌堆。
      // 正常情况下它们此刻都在处理区（useCard 刚把它们放进去）；
      // 其余区域也算数——无论是从哪里被端出来的，用了就不该还回去。
      const removable: ZoneType[] = [
        ZoneType.Processing,
        ZoneType.Hand,
        ZoneType.Equip,
        ZoneType.Judge,
      ]
      for (const base of bases) {
        if (removable.includes(base.zone)) this.moveCard(base, ZoneType.Discard)
      }
      card.zone = ZoneType.Discard
      return
    }

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

  /**
   * 把一张牌摆上处理区——判定翻牌这类「先亮出来，稍后再弃」的场合
   *
   * 判定牌不是任何人打出来的，因此不走 `useCard`（后者要求牌在自己手里）。
   * 单独开一个口子是为了让「放进处理区」也过一遍 `moveCard`：
   * 可见性要设为全员可见，否则刚翻开的判定牌对别人不可见。
   */
  moveToProcessing(card: ICard, player: IPlayer): void {
    this.moveCard(card, ZoneType.Processing, player)
  }
}
