// ============================================================
// 联盟杀 · WinCondition — 胜利条件判断
//
// 职责：
// - 根据当前存活玩家和身份分布判断游戏是否结束
// - 确定胜利方
// - 处理所有边界情况（潜伏者单挑、全部死亡等）
//
// 胜利条件（对应三国杀标准规则）：
//
// ┌──────────────┬──────────────────────────────────────────┐
// │ 胜利方        │ 条件                                      │
// ├──────────────┼──────────────────────────────────────────┤
// │ 天命星灵      │ 所有飞升者和潜伏者死亡                      │
// │ 守护者        │ 同天命星灵                                │
// │ 飞升者        │ 天命星灵死亡（且潜伏者未满足单挑条件）       │
// │ 潜伏者        │ 天命星灵死亡时，潜伏者是唯一存活的非主公角色  │
// └──────────────┴──────────────────────────────────────────┘
//
// 潜伏者特殊规则：
// - 潜伏者的目标是成为最后存活的角色
// - 如果潜伏者先死，之后主公再死 → 飞升者胜利（潜伏者失败）
// - 如果主公死时潜伏者存活且是唯一的非主公存活者 → 潜伏者胜利
// ============================================================

import { RoleType } from '@core/contracts/enums'
import type { IPlayer } from '@core/contracts/player.interface'
import type { IGameResult } from '@core/contracts/game.interface'

/**
 * 胜利条件检查结果
 */
export interface WinCheckResult {
  /** 游戏是否已结束 */
  gameOver: boolean
  /** 胜利方（游戏未结束时为 null） */
  winner: RoleType | null
  /** 胜利原因描述 */
  reason: string
}

/**
 * 胜利条件判断系统
 *
 * 独立于 DeathSystem，可单独测试。
 *
 * 使用示例：
 * ```ts
 * const winCondition = new WinCondition()
 * const result = winCondition.checkVictory(players, currentRound)
 * if (result.gameOver) {
 *   console.log(`游戏结束，${result.winner} 胜利: ${result.reason}`)
 * }
 * ```
 */
export class WinCondition {
  // ── 主入口 ──

  /**
   * 检查游戏是否满足任意一方的胜利条件。
   *
   * 按优先级检查：
   * 1. 异常状态（全部死亡等）
   * 2. 天命星灵 / 守护者胜利（所有敌对角色死亡）
   * 3. 飞升者 / 潜伏者胜利（天命星灵死亡）
   *
   * @param players      所有玩家列表
   * @param currentRound 当前回合数
   * @returns 胜利检查结果
   */
  checkVictory(players: IPlayer[], currentRound: number = 0): WinCheckResult {
    // ── 异常状态检查 ──
    const allDeadResult = this.checkAllDead(players)
    if (allDeadResult) return allDeadResult

    // ── 获取各身份存活状态 ──
    const lord = this.findLord(players)
    const rebels = this.findRebels(players)
    const spy = this.findSpy(players)
    const loyalists = this.findLoyalists(players)

    const lordAlive = lord?.alive ?? false
    const rebelsAlive = rebels.filter((p) => p.alive)
    const spyAlive = spy?.alive ?? false
    const allRebelsDead = rebelsAlive.length === 0
    const loyalistsAlive = loyalists.filter((p) => p.alive)

    // ── 场景 1: 天命星灵死亡 ──
    if (!lordAlive) {
      return this.handleLordDeath(players, spy)
    }

    // ── 场景 2: 所有飞升者和潜伏者死亡 → 天命星灵 / 守护者胜利 ──
    // 注意：只有当实际存在飞升者或潜伏者时才触发此条件
    const hasHostileRoles = rebels.length > 0 || spy !== undefined
    if (hasHostileRoles && allRebelsDead && !spyAlive) {
      return {
        gameOver: true,
        winner: RoleType.Aspect,
        reason: '所有飞升者和潜伏者已被消灭',
      }
    }

    // ── 场景 3: 仅剩飞升者和天命星灵/守护者 → 游戏继续 ──
    // （不属于任何胜利条件的情况）

    // ── 游戏继续 ──
    return {
      gameOver: false,
      winner: null,
      reason: '游戏继续',
    }
  }

  /**
   * 构建 IGameResult 对象。
   */
  buildGameResult(
    result: WinCheckResult,
    players: IPlayer[],
    currentRound: number,
  ): IGameResult {
    return {
      winner: result.winner,
      reason: result.reason,
      survivingPlayers: players.filter((p) => p.alive),
      totalRounds: currentRound,
      endedAt: Date.now(),
    }
  }

  // ── 内部场景处理 ──

  /**
   * 处理天命星灵死亡的胜利判断。
   *
   * 规则：
   * - 潜伏者存活 且 是唯一存活的非主公角色 → 潜伏者胜利
   * - 否则 → 飞升者胜利
   *
   * @param players 所有玩家
   * @param spy     潜伏者（可能不存在）
   */
  private handleLordDeath(
    players: IPlayer[],
    spy: IPlayer | undefined,
  ): WinCheckResult {
    // 检查潜伏者是否满足单挑胜利条件：
    // 潜伏者存活 且 潜伏者是唯一存活的非主公角色
    if (spy && spy.alive) {
      const nonLordAlive = players.filter(
        (p) => p.role !== RoleType.Aspect && p.alive,
      )
      if (nonLordAlive.length === 1 && nonLordAlive[0]!.id === spy.id) {
        return {
          gameOver: true,
          winner: RoleType.Infiltrator,
          reason: '潜伏者成功潜伏到最后，单挑胜利',
        }
      }
    }

    // 飞升者胜利
    return {
      gameOver: true,
      winner: RoleType.Ascended,
      reason: '天命星灵已被消灭',
    }
  }

  // ── 异常状态 ──

  /**
   * 检查是否所有玩家都已死亡（异常状态）。
   */
  private checkAllDead(players: IPlayer[]): WinCheckResult | null {
    if (players.length > 0 && players.every((p) => !p.alive)) {
      return {
        gameOver: true,
        winner: null,
        reason: '所有玩家均已死亡（异常平局）',
      }
    }
    return null
  }

  // ── 身份查找方法 ──

  /**
   * 查找天命星灵（主公）。
   */
  findLord(players: IPlayer[]): IPlayer | undefined {
    return players.find((p) => p.role === RoleType.Aspect)
  }

  /**
   * 查找所有飞升者（反贼）。
   */
  findRebels(players: IPlayer[]): IPlayer[] {
    return players.filter((p) => p.role === RoleType.Ascended)
  }

  /**
   * 查找潜伏者（内奸）。
   */
  findSpy(players: IPlayer[]): IPlayer | undefined {
    return players.find((p) => p.role === RoleType.Infiltrator)
  }

  /**
   * 查找所有守护者（忠臣）。
   */
  findLoyalists(players: IPlayer[]): IPlayer[] {
    return players.filter((p) => p.role === RoleType.Guardian)
  }

  /**
   * 获取存活玩家数量（按身份分组）。
   */
  getAliveCounts(
    players: IPlayer[],
  ): Map<RoleType, number> {
    const counts = new Map<RoleType, number>()
    for (const role of Object.values(RoleType)) {
      counts.set(role, 0)
    }
    for (const player of players) {
      if (player.alive && player.role) {
        counts.set(player.role, (counts.get(player.role) ?? 0) + 1)
      }
    }
    return counts
  }

  /**
   * 检查指定身份的玩家是否全部存活。
   */
  areAllAlive(players: IPlayer[], role: RoleType): boolean {
    const ofRole = players.filter((p) => p.role === role)
    if (ofRole.length === 0) return true // 没有该身份的玩家视为"全部存活"
    return ofRole.every((p) => p.alive)
  }

  /**
   * 检查指定身份的玩家是否全部死亡。
   */
  areAllDead(players: IPlayer[], role: RoleType): boolean {
    const ofRole = players.filter((p) => p.role === role)
    if (ofRole.length === 0) return true // 没有该身份的玩家视为"全部死亡"
    return ofRole.every((p) => !p.alive)
  }

  // ── 静态工具 ──

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

  /**
   * 获取胜利方对应的中文描述。
   */
  static getVictoryDescription(role: RoleType): string {
    switch (role) {
      case RoleType.Aspect:
        return '天命星灵阵营获胜'
      case RoleType.Guardian:
        return '守护者阵营获胜'
      case RoleType.Ascended:
        return '飞升者阵营获胜'
      case RoleType.Infiltrator:
        return '潜伏者获胜'
    }
  }
}
