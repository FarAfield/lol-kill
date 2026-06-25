// ============================================================
// 联盟杀 · RoleSystem — 身份分配与查询
//
// 职责：
// - 根据游戏模式配置分配身份到玩家
// - 主公（天命星灵）固定在座位 0，身份公开
// - 其余身份随机分配，身份隐藏
// - 提供身份查询、公开、验证等方法
//
// 身份分布规则（三国杀标准）：
// | 人数 | 主公 | 忠臣 | 反贼 | 内奸 |
// |------|------|------|------|------|
// |  5人 |   1  |   1  |   2  |   1  |
// |  8人 |   1  |   2  |   4  |   1  |
// ============================================================

import { RoleType } from '@core/contracts/enums'
import { LORD_HP_BONUS } from '@source/base/constants'
import type { IPlayer } from '@core/contracts/player.interface'

/**
 * 身份分配结果
 */
export interface RoleAssignment {
  /** 分配后的玩家列表 */
  players: IPlayer[]
  /** 主公玩家（seatIndex 0） */
  lord: IPlayer
  /** 各身份对应的玩家列表 */
  roles: Map<RoleType, IPlayer[]>
}

/**
 * 身份管理系统
 *
 * 管理游戏开始时身份分配，以及游戏中身份查询与公开。
 *
 * 主公（Aspect）始终位于 seatIndex 0，其身份在游戏开始时公开。
 * 其余身份随机分配给其他座位，初始隐藏。
 *
 * 使用示例：
 * ```ts
 * const roleSystem = new RoleSystem()
 * const assignment = roleSystem.assignRoles(players, config.roles, randomService.shuffle)
 * // assignment.lord.roleRevealed === true
 * ```
 */
export class RoleSystem {
  // ── 身份分配 ──

  /**
   * 将身份列表分配给玩家。
   *
   * 规则：
   * - 主公（Aspect）固定分配给 seatIndex 0 的玩家
   * - 其余身份随机打乱后分配给剩余玩家
   * - 主公身份自动公开，其余隐藏
   * - 主公获得体力上限 +1 加成
   *
   * @param players  玩家列表（按座位顺序排列）
   * @param roles    身份列表（必须包含 1 个 Aspect）
   * @param shuffle  可选洗牌函数（用于随机化非主公身份分配）
   * @returns 分配结果
   * @throws 如果 roles 不包含 Aspect，或角色数量与玩家数量不匹配
   */
  assignRoles(
    players: IPlayer[],
    roles: RoleType[],
    shuffle?: <T>(array: T[]) => T[],
  ): RoleAssignment {
    // 验证
    this.validateAssignment(players, roles)

    const playerCount = players.length

    // 主公固定在座位 0
    const lordPlayer = players[0]!
    lordPlayer.role = RoleType.Aspect
    lordPlayer.roleRevealed = true
    // 主公体力上限加成
    lordPlayer.maxHp += LORD_HP_BONUS
    lordPlayer.hp = lordPlayer.maxHp

    // 剩余身份随机分配给其他玩家
    const remainingRoles = roles.filter((r) => r !== RoleType.Aspect)

    if (remainingRoles.length > 0) {
      const shuffledRoles = shuffle
        ? shuffle([...remainingRoles])
        : this.fisherYatesShuffle([...remainingRoles])

      for (let i = 1; i < playerCount; i++) {
        const roleIndex = i - 1
        if (roleIndex < shuffledRoles.length) {
          const player = players[i]!
          player.role = shuffledRoles[roleIndex]!
          player.roleRevealed = false
        }
      }
    }

    // 构建角色分组
    const roleMap = this.buildRoleMap(players)

    return {
      players,
      lord: lordPlayer,
      roles: roleMap,
    }
  }

  /**
   * 预定义身份分布。
   *
   * 根据玩家数量返回标准身份列表。
   * 可用于生成 IGameConfig.roles。
   *
   * @param playerCount 玩家数量
   * @returns 身份列表（数组顺序代表座位顺序，0 号位为 Aspect）
   */
  static getStandardRoles(playerCount: number): RoleType[] {
    switch (playerCount) {
      case 2:
        // 1v1 模式
        return [RoleType.Aspect, RoleType.Ascended]
      case 3:
        // 1主 + 1反 + 1内
        return [RoleType.Aspect, RoleType.Ascended, RoleType.Infiltrator]
      case 4:
        // 1主 + 1忠 + 2反
        return [
          RoleType.Aspect,
          RoleType.Guardian,
          RoleType.Ascended,
          RoleType.Ascended,
        ]
      case 5:
        // 1主 + 1忠 + 2反 + 1内
        return [
          RoleType.Aspect,
          RoleType.Guardian,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Infiltrator,
        ]
      case 6:
        // 1主 + 1忠 + 3反 + 1内
        return [
          RoleType.Aspect,
          RoleType.Guardian,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Infiltrator,
        ]
      case 7:
        // 1主 + 2忠 + 3反 + 1内
        return [
          RoleType.Aspect,
          RoleType.Guardian,
          RoleType.Guardian,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Infiltrator,
        ]
      case 8:
        // 1主 + 2忠 + 4反 + 1内
        return [
          RoleType.Aspect,
          RoleType.Guardian,
          RoleType.Guardian,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Ascended,
          RoleType.Infiltrator,
        ]
      default:
        throw new Error(
          `[RoleSystem] 不支持的玩家数量: ${playerCount}（支持 2-8 人）`,
        )
    }
  }

  // ── 身份查询 ──

  /**
   * 获取玩家身份对应的中文名称。
   */
  getRoleName(role: RoleType): string {
    return RoleSystem.getRoleNameStatic(role)
  }

  /**
   * 获取某玩家公开可见的身份。
   *
   * @param player 要查询的玩家
   * @returns 身份（如果已公开或玩家死亡），否则返回 undefined
   */
  getVisibleRole(player: IPlayer): RoleType | undefined {
    if (player.roleRevealed || !player.alive) {
      return player.role
    }
    return undefined
  }

  /**
   * 对指定玩家可见的身份列表。
   *
   * 规则：
   * - 自己的身份始终可见
   * - 主公的身份对所有玩家可见
   * - 死亡角色的身份对所有玩家可见
   * - 其余身份的 role 字段对外隐藏
   *
   * @param viewer  查看者
   * @param allPlayers 所有玩家列表
   * @returns 查看者可见的身份映射 (playerId → RoleType | undefined)
   */
  getVisibleRoles(
    viewer: IPlayer,
    allPlayers: IPlayer[],
  ): Map<string, RoleType | undefined> {
    const result = new Map<string, RoleType | undefined>()
    for (const player of allPlayers) {
      if (
        player.id === viewer.id || // 自己
        player.role === RoleType.Aspect || // 主公
        player.roleRevealed || // 已公开
        !player.alive // 已死亡
      ) {
        result.set(player.id, player.role)
      } else {
        result.set(player.id, undefined)
      }
    }
    return result
  }

  /**
   * 获取指定身份的所有存活玩家。
   */
  getAlivePlayersByRole(
    players: IPlayer[],
    role: RoleType,
  ): IPlayer[] {
    return players.filter((p) => p.role === role && p.alive)
  }

  /**
   * 获取指定身份的所有玩家（含死亡）。
   */
  getPlayersByRole(players: IPlayer[], role: RoleType): IPlayer[] {
    return players.filter((p) => p.role === role)
  }

  /**
   * 获取主公玩家。
   */
  getLord(players: IPlayer[]): IPlayer | undefined {
    return players.find((p) => p.role === RoleType.Aspect)
  }

  // ── 身份公开 ──

  /**
   * 公开指定玩家的身份。
   *
   * 通常在玩家死亡或特定技能效果时调用。
   */
  revealRole(player: IPlayer): void {
    player.roleRevealed = true
  }

  /**
   * 检查玩家身份是否已公开。
   */
  isRoleRevealed(player: IPlayer): boolean {
    return player.roleRevealed
  }

  // ── 分配前验证 ──

  /**
   * 验证身份分配是否合法。
   *
   * 检查：
   * - 玩家列表不为空
   * - 身份列表包含且仅包含 1 个 Aspect（主公）
   * - 身份数量与玩家数量匹配
   *
   * @throws 如果分配不合法
   */
  validateAssignment(players: IPlayer[], roles: RoleType[]): void {
    if (players.length === 0) {
      throw new Error('[RoleSystem] 玩家列表不能为空')
    }

    const aspectCount = roles.filter((r) => r === RoleType.Aspect).length
    if (aspectCount !== 1) {
      throw new Error(
        `[RoleSystem] 必须有恰好 1 个主公 (Aspect)，当前: ${aspectCount}`,
      )
    }

    if (roles.length !== players.length) {
      throw new Error(
        `[RoleSystem] 身份数量 (${roles.length}) 与玩家数量 (${players.length}) 不匹配`,
      )
    }
  }

  // ── 私有辅助 ──

  /**
   * 按身份分组玩家。
   */
  private buildRoleMap(players: IPlayer[]): Map<RoleType, IPlayer[]> {
    const map = new Map<RoleType, IPlayer[]>()
    for (const role of Object.values(RoleType)) {
      map.set(role, [])
    }
    for (const player of players) {
      if (player.role) {
        map.get(player.role)?.push(player)
      }
    }
    return map
  }

  /**
   * Fisher-Yates 洗牌算法。
   */
  private fisherYatesShuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j]!, array[i]!]
    }
    return array
  }

  // ── 静态工具 ──

  /**
   * 获取身份对应的中文名称。
   */
  static getRoleNameStatic(role: RoleType): string {
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
