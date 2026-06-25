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
//     → checkGameOver (检查胜利条件)
// ============================================================

import { RoleType } from '@core/contracts/enums'
import { REBEL_KILL_REWARD } from '@source/base/constants'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { IGameState } from '@core/contracts/game.interface'
import type { IGameResult } from '@core/contracts/game.interface'

/**
 * 死亡系统
 *
 * 管理濒死求桃、死亡结算和胜利条件判断。
 *
 * 注意：实际游戏中的异步决策（出桃/不出桃）由 IUIDecisionService 处理。
 * 此系统提供流程框架，具体的玩家交互通过回调/钩子注入。
 */
export class DeathSystem {
  constructor(private state: IGameState) {}

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
   * 濒死求桃——遍历所有存活玩家询问是否出桃。
   *
   * 在三国杀中，求桃从当前回合玩家开始，按回合顺序依次询问。
   * 任意一名玩家出桃后，濒死角色回复至 1 体力，求桃结束。
   *
   * 此方法接受一个回调函数 askPlayer，由调用方实现实际的
   * 玩家交互（UI 弹窗 / AI 决策）。
   *
   * @param dyingPlayer 濒死玩家
   * @param askPlayer   询问单个玩家是否出桃的回调
   *                    参数: (被询问的玩家)
   *                    返回: 选中的桃牌，或 null（不出）
   * @returns true = 有人出桃，濒死救活；false = 无人出桃，确认死亡
   */
  async askForPeach(
    dyingPlayer: IPlayer,
    askPlayer: (player: IPlayer) => Promise<ICard | null>,
  ): Promise<boolean> {
    // 从当前回合玩家开始，按座位顺序依次询问
    const startIndex = this.state.currentPlayerIndex
    const totalPlayers = this.state.players.length

    for (let i = 0; i < totalPlayers; i++) {
      const playerIndex = (startIndex + i) % totalPlayers
      const player = this.state.players[playerIndex]!

      if (!player.alive) continue // 死亡玩家不参与求桃

      const peach = await askPlayer(player)
      if (peach) {
        // 玩家使用了桃
        // 桃的效果：回复 1 点体力
        this.applyPeach(dyingPlayer, peach, player)
        return true
      }
    }

    return false
  }

  /**
   * 应用桃的效果——濒死角色回复至 1 体力。
   */
  private applyPeach(
    dyingPlayer: IPlayer,
    peach: ICard,
    sourcePlayer: IPlayer,
  ): void {
    // 桃进入弃牌堆
    // 注意：实际游戏中的卡牌移动由 CardSystem 处理，
    // 此处仅处理体力回复的逻辑
    dyingPlayer.hp = 1

    // 记录谁出了桃（供日志使用）
    dyingPlayer.setMark('savedBy', Number(sourcePlayer.seatIndex))
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
    // 1. 标记死亡
    player.alive = false

    // 2. 公开身份
    player.roleRevealed = true

    // 3. 收集所有区域的卡牌
    const allCards: ICard[] = [
      ...player.handCards,
      ...player.equipCards,
      ...player.judgeCards,
    ]

    // 清空玩家区域
    player.handCards = []
    player.equipCards = []
    player.judgeCards = []

    // 4. 奖惩
    this.handleReward(player, killer)

    return allCards
  }

  /**
   * 奖惩机制。
   *
   * 当前规则（可扩展）：
   * - 飞升者杀死飞升者 → 击杀者摸 3 张牌
   * - 任意角色杀死飞升者 → 击杀者摸 3 张牌（经典规则）
   *
   * @param deadPlayer 死亡玩家
   * @param killer     击杀者
   */
  handleReward(deadPlayer: IPlayer, killer?: IPlayer): void {
    if (!killer || !killer.alive) return

    // 飞升者死亡 → 击杀者奖惩
    if (deadPlayer.role === RoleType.Ascended) {
      // 飞升者杀死飞升者 → 摸3张牌
      killer.setMark('rewardDraw', REBEL_KILL_REWARD)
    }

    // 潜伏者死亡的特殊处理（可在此扩展）
    if (deadPlayer.role === RoleType.Infiltrator) {
      // 潜伏者死亡无特殊奖惩（但影响胜利条件）
    }
  }

  // ── 胜利条件 ──

  /**
   * 检查游戏是否结束，并返回结果。
   *
   * 胜利条件：
   * - 天命星灵（主公）死亡 → 飞升者胜利（潜伏者若存活且为最后一人则潜伏者胜）
   * - 所有飞升者和潜伏者死亡 → 天命星灵 + 守护者胜利
   *
   * @returns 游戏结果（如果游戏结束），null 表示游戏继续
   */
  checkGameOver(): IGameResult | null {
    const lord = this.state.players.find((p) => p.role === RoleType.Aspect)
    const rebels = this.state.players.filter(
      (p) => p.role === RoleType.Ascended,
    )
    const spy = this.state.players.find(
      (p) => p.role === RoleType.Infiltrator,
    )
    const loyalists = this.state.players.filter(
      (p) => p.role === RoleType.Guardian,
    )

    // 场景 1: 主公死亡
    if (lord && !lord.alive) {
      // 检查潜伏者是否存活且为唯一存活者
      const alivePlayers = this.state.players.filter((p) => p.alive)
      if (
        spy &&
        spy.alive &&
        alivePlayers.length === 1 &&
        alivePlayers[0]!.id === spy.id
      ) {
        // 潜伏者胜利
        return this.buildResult(RoleType.Infiltrator, '潜伏者成功潜伏到最后')
      }

      // 飞升者胜利
      return this.buildResult(RoleType.Ascended, '天命星灵已被消灭')
    }

    // 场景 2: 所有飞升者和潜伏者死亡
    const allRebelsDead = rebels.every((p) => !p.alive)
    const spyDead = !spy || !spy.alive

    if (allRebelsDead && spyDead) {
      return this.buildResult(
        RoleType.Aspect,
        '所有飞升者和潜伏者已被消灭',
      )
    }

    // 游戏继续
    return null
  }

  /**
   * 检查是否所有玩家都死了（异常情况）。
   */
  checkAllDead(): boolean {
    return this.state.players.every((p) => !p.alive)
  }

  // ── 私有辅助 ──

  /**
   * 构建游戏结果。
   */
  private buildResult(winner: RoleType, reason: string): IGameResult {
    return {
      winner,
      reason,
      survivingPlayers: this.state.players.filter((p) => p.alive),
      totalRounds: this.state.currentRound,
      endedAt: Date.now(),
    }
  }

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
