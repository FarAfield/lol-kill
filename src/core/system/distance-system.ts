// ============================================================
// 联盟杀 · DistanceSystem — 距离与攻击范围计算
//
// 基于座次环计算角色间的距离，考虑装备（+1马/-1马/武器）
// 及技能影响。
//
// 座位环示例 (8人):
//        0(主)
//    7        1
//  6            2
//    5        3
//        4
//
// 距离计算: min(正向距离, 反向距离)，正向距离 = (to - from + N) % N
// ============================================================

import { EquipSlot, ZoneType } from '@core/contracts/enums'
import type { IPlayer } from '@core/contracts/player.interface'

/**
 * 距离计算系统
 *
 * 纯计算——不修改任何游戏状态。
 * 所有方法均为无副作用函数。
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
   * 实际距离 = 基础座次距离 + 起点进攻马修正 + 终点防御马修正 + 技能修正
   *
   * 修正规则：
   * - 进攻马（-1马）：起点计算与其他角色距离时 -1
   * - 防御马（+1马）：其他角色计算与终点距离时 +1
   *
   * 距离不会小于 1（除非是同一个人——距离为 0）。
   *
   * @param from    起点玩家（计算者）
   * @param to      终点玩家（目标）
   * @param players 全部玩家列表
   * @returns 实际距离
   */
  static getDistance(from: IPlayer, to: IPlayer, players: IPlayer[]): number {
    if (from.id === to.id) return 0

    const seatDistance = this.getSeatDistance(from, to, players)
    if (seatDistance === 0) return 0

    let distance = seatDistance

    // 起点进攻马：-1
    if (DistanceSystem.hasOffensiveHorse(from)) {
      distance -= 1
    }

    // 终点防御马：+1
    if (DistanceSystem.hasDefensiveHorse(to)) {
      distance += 1
    }

    // 技能修正（通过 marks 系统传递）
    // 有技能效果的玩家可以在 marks 中设置 'distanceModifier' 标记
    const fromModifier = from.marks.get('distanceModifier') ?? 0
    const toModifier = to.marks.get('distanceDefenseModifier') ?? 0
    distance += fromModifier
    distance += toModifier

    // 距离不能小于 1（除非是自己）
    return Math.max(1, distance)
  }

  /**
   * 获取玩家的攻击范围。
   *
   * 攻击范围 = 基础 1 + 武器装备的 attackRange
   *
   * @param player 玩家
   * @returns 攻击范围
   */
  static getAttackRange(player: IPlayer): number {
    const weapon = player.equipCards.find(
      (c) => c.equipSlot === EquipSlot.Weapon && c.zone === ZoneType.Equip,
    )
    const baseRange = 1
    const weaponBonus = weapon?.attackRange ?? 0
    return baseRange + weaponBonus
  }

  /**
   * 判断目标是否在攻击范围内。
   *
   * @param source  攻击来源
   * @param target  攻击目标
   * @param players 全部玩家列表
   * @returns true = 在攻击范围内
   */
  static isInRange(source: IPlayer, target: IPlayer, players: IPlayer[]): boolean {
    if (source.id === target.id) return false // 不能攻击自己（基础规则）
    const distance = this.getDistance(source, target, players)
    const attackRange = this.getAttackRange(source)
    return distance <= attackRange
  }

  /**
   * 判断玩家是否装备了进攻马（-1马）。
   */
  static hasOffensiveHorse(player: IPlayer): boolean {
    return player.equipCards.some(
      (c) =>
        c.equipSlot === EquipSlot.OffensiveHorse &&
        c.zone === ZoneType.Equip,
    )
  }

  /**
   * 判断玩家是否装备了防御马（+1马）。
   */
  static hasDefensiveHorse(player: IPlayer): boolean {
    return player.equipCards.some(
      (c) =>
        c.equipSlot === EquipSlot.DefensiveHorse &&
        c.zone === ZoneType.Equip,
    )
  }

  /**
   * 获取所有在攻击范围内的玩家。
   *
   * @param source  攻击来源
   * @param players 全部玩家列表
   * @returns 在攻击范围内的存活玩家数组
   */
  static getPlayersInRange(source: IPlayer, players: IPlayer[]): IPlayer[] {
    return players.filter(
      (p) => p.alive && p.id !== source.id && this.isInRange(source, p, players),
    )
  }

  /**
   * 获取所有在指定距离内的玩家。
   *
   * @param source   起点玩家
   * @param maxDist  最大距离
   * @param players  全部玩家列表
   * @param excludeSelf 是否排除自己
   * @returns 在距离内的存活玩家数组
   */
  static getPlayersWithinDistance(
    source: IPlayer,
    maxDist: number,
    players: IPlayer[],
    excludeSelf: boolean = true,
  ): IPlayer[] {
    return players.filter((p) => {
      if (!p.alive) return false
      if (excludeSelf && p.id === source.id) return false
      return this.getDistance(source, p, players) <= maxDist
    })
  }
}
