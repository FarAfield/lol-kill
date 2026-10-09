// ============================================================
// 联盟杀 · DeathSystem — 死亡处理与濒死求桃
//
// 处理完整的死亡流水线：
// - 检查濒死状态（hp <= 0）
// - 濒死求桃（自己/他人出桃）
// - 死亡结算（弃牌、身份公开、奖惩）
// - 检查胜利条件
//
// 死亡流水线:
//   玩家 HP ≤ 0
//     → checkDying (进入濒死状态)
//     → askForPeach (求桃，等待他人出桃)
//       → 有人出桃 → hp = 1 → 存活
//       → 无人出桃 → 死亡
//     → handleDeath (死亡结算)
//       → 弃置所有手牌/装备/判定牌
//       → 公开身份
//       → 奖惩（反贼死亡→击杀者摸3牌等）
//     → 胜负判定（由 `WinCondition` 承接，见 `GameEngine.checkGameOver`）
// ============================================================

import { RoleType } from '@core/contracts/enums'
import { REBEL_KILL_REWARD } from '@source/base/constants'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import type { CardSystem } from '@core/system/card-system'
import type { PlayerSystem } from '@core/system/player-system'

/**
 * 死亡系统
 *
 * 管理濒死求桃、死亡结算和胜利条件判断。
 *
 * 注意：实际游戏中的异步决策（出桃/不出桃）由 IUIDecisionService 处理。
 * 此系统提供流程框架，具体的玩家交互通过回调/钩子注入。
 */
/**
 * 奖惩标记 —— 「击杀反贼摸 3 张」
 *
 * 标记名写在常量里而不是两处各抄一遍字符串：`DeathSystem.handleReward`
 * 记账、`dieContent` 消费，两边一旦拼错，效果是**奖惩静默消失**，
 * 不报错、不红测试。
 */
export const REWARD_DRAW_MARK = 'rewardDraw'

/**
 * 惩罚标记 —— 「主公误杀忠臣 → 弃置所有牌」（欠账 D13）
 */
export const PENALTY_DISCARD_ALL_MARK = 'penaltyDiscardAll'

export class DeathSystem {
  /**
   * @param state        局面快照（只需要玩家列表）
   * @param playerSystem 存活 / 血量 / 标记的写入口
   * @param cardSystem   死者三区的清空也走它，理由见 `handleDeath`
   */
  constructor(
    private state: GameStateSnapshot,
    private playerSystem: PlayerSystem,
    private cardSystem?: CardSystem,
  ) {}

  // ── 濒死检查 ──

  /**
   * 检查玩家是否处于濒死状态。
   *
   * 条件: alive === true && hp <= 0
   *
   * @param player 要检查的玩家
   * @returns true = 处于濒死状态
   */
  checkDying(player: IPlayer): boolean {
    return player.alive && player.hp <= 0
  }

  /**
   * 获取当前所有濒死玩家。
   */
  getDyingPlayers(): IPlayer[] {
    return this.state.players.filter((p) => this.checkDying(p))
  }

  // ── 求桃 ──

  /**
   * 救活一名濒死角色——体力回到 1。
   *
   * 注意：这里是「回到 1」而不是「回复 1 点」。
   * 濒死时 hp ≤ 0（可能被溢出伤害打到负数），回复 1 点救不回来。
   *
   * 桃牌本身的移动由调用方通过 `discardCards()` 走 CardSystem，
   * 本方法只负责体力与标记。
   *
   * @param dyingPlayer 濒死角色
   * @param rescuer     出桃者（可选，用于记录谁救的）
   */
  rescue(dyingPlayer: IPlayer, rescuer?: IPlayer): void {
    this.playerSystem.resurrect(dyingPlayer, 1)
    if (rescuer) {
      this.playerSystem.setMark(dyingPlayer, 'savedBy', Number(rescuer.seatIndex))
    }
  }

  // ── 死亡结算 ──

  /**
   * 执行死亡结算。
   *
   * 步骤：
   * 1. 标记玩家为死亡
   * 2. 公开身份
   * 3. 弃置所有手牌、装备、判定牌
   * 4. 执行奖惩
   *
   * @param player 死亡玩家
   * @param killer 击杀者（造成致命伤害的玩家，可选）
   * @returns 弃置的所有卡牌
   */
  handleDeath(player: IPlayer, killer?: IPlayer): ICard[] {
    // 1. 标记死亡 —— 走 PlayerSystem：它是「这人还算不算在场」的唯一真值源
    this.playerSystem.setAlive(player, false)

    // 2. 公开身份
    this.playerSystem.revealRole(player)

    // 3. 清空三区
    //
    // 逐张走 CardSystem，而不是 `player.handCards = []`：后者只改了数组，
    // 牌自己的 `zone` / `owner` / `visibleTo` 还留在原地，而**装备变动通知
    // 永远不会发出**——死者的装备技会一直挂在台账上
    // （靠 skillGate 拦着才没发作，但「死了还持有技能」这件事本身是错的）。
    const allCards: ICard[] = [
      ...player.handCards,
      ...player.equipCards,
      ...player.judgeCards,
    ]

    if (this.cardSystem) {
      // 死亡弃牌不可被 `cardDiscardable` 拦下——人都没了，牌必须走
      for (const card of allCards) {
        this.cardSystem.moveToDiscard(card)
      }
    } else {
      // 没有 CardSystem 时（纯数据场景）至少别留下半身不遂的状态
      for (const card of allCards) {
        const owner = card.owner
        if (!owner) continue
        owner.handCards = owner.handCards.filter((c) => c.instanceId !== card.instanceId)
        owner.equipCards = owner.equipCards.filter((c) => c.instanceId !== card.instanceId)
        owner.judgeCards = owner.judgeCards.filter((c) => c.instanceId !== card.instanceId)
      }
    }

    // 4. 奖惩
    this.handleReward(player, killer)

    return allCards
  }

  /**
   * 奖惩机制。
   *
   * 当前规则（可扩展）：
   * - 任意角色杀死飞升者（反贼）→ 击杀者摸 3 张牌
   * - 天命星灵（主公）杀死守护者（忠臣）→ 主公弃置所有牌（**惩罚**，欠账 D13）
   *
   * **这里只判定并记账，不执行**。摸牌与弃牌都发生在 `dieContent`：
   * 它们要发事件、要能被 Mod 拦（`cardDiscardable`），那是内容层的事。
   * 奖惩张数 / 该不该罚属于规则判定，留在 system 层。
   *
   * @param deadPlayer 死亡玩家
   * @param killer     击杀者
   */
  handleReward(deadPlayer: IPlayer, killer?: IPlayer): void {
    if (!killer || !killer.alive) return

    // 飞升者（反贼）死亡 → 击杀者摸 3 张
    if (deadPlayer.role === RoleType.Ascended) {
      this.playerSystem.setMark(killer, REWARD_DRAW_MARK, REBEL_KILL_REWARD)
    }

    // 主公误杀忠臣 → 主公弃置所有牌
    //
    // 判定挂的是**双方身份**，不是「主公杀了人」：主公杀反贼是拿奖惩，
    // 杀内奸什么都没有，只有杀忠臣才是惩罚。
    if (
      killer.role === RoleType.Aspect &&
      deadPlayer.role === RoleType.Guardian
    ) {
      this.playerSystem.setMark(killer, PENALTY_DISCARD_ALL_MARK, 1)
    }

    // 潜伏者死亡的特殊处理（可在此扩展）
    if (deadPlayer.role === RoleType.Infiltrator) {
      // 潜伏者死亡无特殊奖惩（但影响胜利条件）
    }
  }

  // ── 胜利条件 ──
  //
  // 【D17 已结清 · 形态甲】胜负规则已经搬出去了，在
  // `src/core/system/win-condition.ts` —— 一个只吃 `{ players }` 的纯函数。
  //
  // 搬走的理由不是「代码太长」，而是**职责**：`DeathSystem` 做的是状态变更
  // （弃牌 / 公开身份 / 记奖惩），而「谁赢了」是规则。混在一起的代价是
  // 每验一条胜负规则都得先打完一局。
  //
  // 入口改在 `GameEngine.checkGameOver()`。

  /**
   * 检查是否所有玩家都死了（异常情况）。
   */
  checkAllDead(): boolean {
    return this.state.players.every((p) => !p.alive)
  }

  // ── 私有辅助 ──

  /**
   * 获取身份对应的中文名称。
   */
  static getRoleName(role: RoleType): string {
    switch (role) {
      case RoleType.Aspect:
        return '天命星灵'
      case RoleType.Guardian:
        return '守护者'
      case RoleType.Ascended:
        return '飞升者'
      case RoleType.Infiltrator:
        return '潜伏者'
    }
  }
}
