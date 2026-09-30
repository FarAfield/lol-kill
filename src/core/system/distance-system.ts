// ============================================================
// 联盟杀 · DistanceSystem — 距离与攻击范围计算
//
// 基于座次环计算角色间的距离。**受双方的 Mod 影响**：
//
//   实际距离 = 座次距离 → `mod.distanceFrom`（来源方的 -1 马 / 技能）
//                       → `mod.distanceTo`  （目标方的 +1 马 / 技能）
//
// 攻击范围也一样：`mod.attackRange`（武器）。
//
// Phase 11 之前，马和武器是**硬编码**在这里的——每加一件装备就要改
// 引擎文件。现在本系统只负责算「座次环上的最短步数」这件事，
// 修正值由 `DistanceMods`（通常是 `ModQuery`）提供，没提供就是裸距离。
//
// 座位环示例 (8人):
//        0(主)
//    7        1
//  6            2
//    5        3
//        4
// ============================================================

import type { IPlayer } from '@core/contracts/player.interface'

/**
 * 距离 / 攻击范围的 Mod 查询接口
 *
 * 由 `ModQuery` 实现（结构化匹配，不必显式 implements）。
 * 刻意只声明这三个方法——本系统不该知道还有别的东西。
 */
export interface DistanceMods {
  /** 攻击范围：base 通常是 1 */
  attackRangeOf(player: IPlayer, base: number): number
  /** 我算到他人的距离修正（主体是 from） */
  distanceFromOf(from: IPlayer, to: IPlayer, base: number): number
  /** 他人算到我的距离修正（主体是 to） */
  distanceToOf(to: IPlayer, from: IPlayer, base: number): number
}

/**
 * 距离计算系统
 *
 * 纯计算——不修改任何游戏状态，也不认识任何一张具体的装备牌。
 */
export class DistanceSystem {
  /**
   * 计算两名玩家之间的座次基础距离。
   *
   * 基础距离 = 座位环上的最短步数。
   * 邻座距离为 1，对座（8人局）距离为 4。
   *
   * 公式: min(正向差, 反向差)，正向差 = (to.seatIndex - from.seatIndex + N) % N
   * 若正向差为 0（同一玩家），距离为 0（自己）。
   *
   * @param from    起点玩家
   * @param to      终点玩家
   * @param players 全部玩家列表（用于获取总人数）
   * @returns 座次基础距离
   */
  static getSeatDistance(from: IPlayer, to: IPlayer, players: IPlayer[]): number {
    if (from.id === to.id) return 0

    const totalPlayers = players.length
    if (totalPlayers <= 1) return 0

    const fromSeat = from.seatIndex
    const toSeat = to.seatIndex

    const clockwise = (toSeat - fromSeat + totalPlayers) % totalPlayers
    const counterClockwise = (fromSeat - toSeat + totalPlayers) % totalPlayers

    return Math.min(clockwise, counterClockwise)
  }

  /**
   * 计算两名玩家之间的实际距离。
   *
   * 实际距离 = 座次距离 → 来源方的 `distanceFrom` → 目标方的 `distanceTo`
   *
   * 距离不会小于 1（除非是同一个人——距离为 0）。
   *
   * @param from    起点玩家（计算者）
   * @param to      终点玩家（目标）
   * @param players 全部玩家列表
   * @param mods    Mod 查询口（省略则等于裸座次距离）
   * @returns 实际距离
   */
  static getDistance(
    from: IPlayer,
    to: IPlayer,
    players: IPlayer[],
    mods?: DistanceMods,
  ): number {
    if (from.id === to.id) return 0

    const seatDistance = this.getSeatDistance(from, to, players)
    if (seatDistance === 0) return 0

    let distance = seatDistance
    if (mods) {
      distance = mods.distanceFromOf(from, to, distance)
      distance = mods.distanceToOf(to, from, distance)
    }

    // 距离不能小于 1（除非是自己）
    return Math.max(1, distance)
  }

  /**
   * 获取玩家的攻击范围。
   *
   * @param player 玩家
   * @param mods   Mod 查询口（提供则可叠加武器 / 技能）
   * @returns 攻击范围
   */
  static getAttackRange(player: IPlayer, mods?: DistanceMods): number {
    const base = 1
    return mods ? mods.attackRangeOf(player, base) : base
  }

  /**
   * 判断目标是否在攻击范围内。
   *
   * @param source  攻击来源
   * @param target  攻击目标
   * @param players 全部玩家列表
   * @param mods    Mod 查询口
   * @returns true = 在攻击范围内
   */
  static isInRange(
    source: IPlayer,
    target: IPlayer,
    players: IPlayer[],
    mods?: DistanceMods,
  ): boolean {
    if (source.id === target.id) return false // 不能攻击自己（基础规则）
    const distance = this.getDistance(source, target, players, mods)
    const attackRange = this.getAttackRange(source, mods)
    return distance <= attackRange
  }

  /**
   * 获取所有在攻击范围内的玩家。
   *
   * @param source  攻击来源
   * @param players 全部玩家列表
   * @param mods    Mod 查询口
   * @returns 在攻击范围内的存活玩家数组
   */
  static getPlayersInRange(
    source: IPlayer,
    players: IPlayer[],
    mods?: DistanceMods,
  ): IPlayer[] {
    return players.filter(
      (p) => p.alive && p.id !== source.id && this.isInRange(source, p, players, mods),
    )
  }

  /**
   * 获取所有在指定距离内的玩家。
   *
   * @param source      起点玩家
   * @param maxDist     最大距离
   * @param players     全部玩家列表
   * @param mods        Mod 查询口
   * @param excludeSelf 是否排除自己
   * @returns 在距离内的存活玩家数组
   */
  static getPlayersWithinDistance(
    source: IPlayer,
    maxDist: number,
    players: IPlayer[],
    mods?: DistanceMods,
    excludeSelf: boolean = true,
  ): IPlayer[] {
    return players.filter((p) => {
      if (!p.alive) return false
      if (excludeSelf && p.id === source.id) return false
      return this.getDistance(source, p, players, mods) <= maxDist
    })
  }
}
