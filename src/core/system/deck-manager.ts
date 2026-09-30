// ============================================================
// 联盟杀 · DeckManager — 牌堆管理
//
// 负责牌堆的完整生命周期：
// - 初始化牌堆（根据游戏模式配置和卡牌模板）
// - 洗牌
// - 抽牌（自动回收弃牌堆）
// - 弃牌
// - 回收（弃牌堆 → 洗牌 → 牌堆）
// - 判定牌处理
// ============================================================

import { ZoneType } from '@core/contracts/enums'
import type { ICard, CardDefinition } from '@core/contracts/card.interface'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import type { IRandomService } from '@core/contracts/services.interface'
import { Card } from '@core/entity/card'
import { STANDARD_DECK_COMPOSITION } from '@source/base/constants'

/**
 * 牌堆管理器
 *
 * 管理牌堆、弃牌堆的卡牌流转。
 * 所有抽牌和弃牌操作通过此管理器执行，确保区域一致性。
 */
export class DeckManager {
  /**
   * 洗牌的随机源——**必填**
   *
   * 以前「不传就退回 Math.random」的分支被删掉了：那是一条
   * 「悄悄引入不确定性」的后门，牌堆顺序一旦不可复现，
   * 回放与批量回归测试就都失去意义。
   */
  private random: IRandomService

  /**
   * @param gameState 游戏全局状态
   * @param random    随机服务（必填）
   */
  constructor(
    private gameState: GameStateSnapshot,
    random: IRandomService,
  ) {
    this.random = random
  }

  // ── 初始化 ──

  /**
   * 根据卡牌模板和数量表初始化牌堆。
   *
   * 遍历 cardDefs，按 STANDARD_DECK_COMPOSITION 中定义的数量
   * 创建对应数量的 Card 实例并加入牌堆。
   *
   * @param cardDefs 可用卡牌模板（来自 source/cards/）
   */
  initializeDeck(cardDefs: CardDefinition[]): void {
    const deck: ICard[] = []

    for (const def of cardDefs) {
      // 配比表以卡牌 id 为键（与 source/cards/* 的 def.id 一致）
      const count = STANDARD_DECK_COMPOSITION[def.id] ?? 1
      for (let i = 0; i < count; i++) {
        const card = Card.create(def)
        card.zone = ZoneType.Deck
        deck.push(card)
      }
    }

    this.gameState.deck = deck
    this.gameState.discardPile = []
  }

  /**
   * 根据自定义数量表初始化牌堆。
   *
   * @param cardDefs      可用卡牌模板
   * @param composition   自定义数量表 { cardName: count }
   */
  initializeDeckCustom(
    cardDefs: CardDefinition[],
    composition: Record<string, number>,
  ): void {
    const deck: ICard[] = []

    for (const def of cardDefs) {
      const count = composition[def.name] ?? 1
      for (let i = 0; i < count; i++) {
        const card = Card.create(def)
        card.zone = ZoneType.Deck
        deck.push(card)
      }
    }

    this.gameState.deck = deck
    this.gameState.discardPile = []
  }

  // ── 洗牌 ──

  /** 洗牌——对牌堆执行随机排序。 */
  shuffle(): void {
    this.gameState.deck = this.random.shuffle(this.gameState.deck)
  }

  /**
   * 对弃牌堆洗牌（在回收前使用）。
   */
  private shuffleDiscardPile(): void {
    this.gameState.discardPile = this.random.shuffle(this.gameState.discardPile)
  }

  // ── 抽牌 ──

  /**
   * 从牌堆顶部抽取指定数量的卡牌。
   *
   * 若牌堆不足，自动回收弃牌堆（洗牌后移入牌堆）继续抽牌。
   * 若回收后仍不足，则返回实际能抽到的数量。
   *
   * **交接契约**：本方法只把牌从牌堆里摘出来（并标上 `zone = Hand` 这个
   * 「下一步该进手牌」的标记），**不负责**把它交到谁手里——`owner`、
   * 可见性、手牌数组都还没动。调用方必须紧接着过一次
   * `CardSystem.obtainCards()`，那才是完整的状态变更。
   *
   * 这个两步式是刻意的：摸牌数与「摸给谁」在引擎里由不同层决定，
   * 合进一处就得让牌堆知道玩家。但它是个陷阱——漏掉第二步不会报错，
   * 牌只是从此消失。因此三个调用点（发初始手牌 / 摸牌阶段 / 技能摸牌）
   * 都紧挨着写，任何一个都不许隔着重入点。
   *
   * @param count  期望抽牌数量
   * @returns      实际抽到的卡牌数组
   */
  draw(count: number): ICard[] {
    const drawn: ICard[] = []

    for (let i = 0; i < count; i++) {
      if (this.gameState.deck.length === 0) {
        if (!this.recycleDiscardPile()) {
          break // 无牌可抽
        }
      }

      const card = this.gameState.deck.pop()!
      card.zone = ZoneType.Hand
      drawn.push(card)
    }

    return drawn
  }

  /**
   * 从牌堆顶部抽一张判定牌。
   *
   * 判定牌在抽取后进入处理区，判定结束后进入弃牌堆。
   * 此方法仅负责抽取，判定后的流转由调用方处理。
   *
   * @returns 判定牌，若无牌可抽则返回 null
   */
  drawForJudge(): ICard | null {
    if (this.gameState.deck.length === 0) {
      if (!this.recycleDiscardPile()) {
        return null
      }
    }

    const card = this.gameState.deck.pop()!
    card.zone = ZoneType.Processing
    return card
  }

  /**
   * 从牌堆顶部查看一张牌（不改变牌堆状态）。
   *
   * @returns 牌堆顶部卡牌，若牌堆为空则返回 null
   */
  peekTop(): ICard | null {
    if (this.gameState.deck.length === 0) return null
    return this.gameState.deck[this.gameState.deck.length - 1]!
  }

  // ── 弃牌 ──
  //
  // 这里**没有** `discard()` / `discardOne()`。
  //
  // 它们原本只做两件事：把 `card.zone` 改成 Discard、push 进 `discardPile`。
  // 少了另外两件同样必须做的事——把牌从原持有者的 `handCards` 里摘掉、
  // 把 `owner` 清空。于是「弃一张手牌」之后，那张牌同时存在于
  // 弃牌堆和某人手牌里，且还记着旧主人：等弃牌堆被回收洗回牌堆，
  // 它会带着 `owner` 被摸给下一个玩家。
  //
  // Phase 19 把它们删了：弃牌一律走 `CardSystem.discardCard`，
  // 那里一次性改完 zone / 区域数组 / owner / 可见性。
  // 本类只管牌堆与弃牌堆这两个**公共区域**的进出，不碰任何人手里的牌。

  // ── 回收 ──

  /**
   * 回收弃牌堆：将弃牌堆洗牌后移入牌堆。
   *
   * 在三国杀中，牌堆耗尽时自动将弃牌堆洗匀形成新牌堆。
   *
   * @returns 是否成功回收（弃牌堆有牌可回收）
   */
  recycleDiscardPile(): boolean {
    if (this.gameState.discardPile.length === 0) return false

    // 先洗牌再移入
    this.shuffleDiscardPile()

    for (const card of this.gameState.discardPile) {
      card.zone = ZoneType.Deck
    }

    this.gameState.deck.push(...this.gameState.discardPile)
    this.gameState.discardPile = []

    return true
  }

  // ── 查询 ──

  /**
   * 牌堆剩余卡牌数。
   */
  get deckSize(): number {
    return this.gameState.deck.length
  }

  /**
   * 弃牌堆卡牌数。
   */
  get discardPileSize(): number {
    return this.gameState.discardPile.length
  }

  /**
   * 牌堆是否为空。
   */
  get isDeckEmpty(): boolean {
    return this.gameState.deck.length === 0
  }

  /**
   * 可用卡牌总数（牌堆 + 弃牌堆）。
   */
  get totalAvailable(): number {
    return this.gameState.deck.length + this.gameState.discardPile.length
  }

  /**
   * 获取牌堆副本（只读）。
   */
  getDeck(): readonly ICard[] {
    return this.gameState.deck
  }

  /**
   * 获取弃牌堆副本（只读）。
   */
  getDiscardPile(): readonly ICard[] {
    return this.gameState.discardPile
  }
}
