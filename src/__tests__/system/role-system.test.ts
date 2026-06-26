// ============================================================
// 联盟杀 · RoleSystem 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { RoleSystem } from '@core/system/role-system'
import { Player } from '@core/entity/player'
import { RoleType } from '@core/contracts/enums'
import type { RoleAssignment } from '@core/system/role-system'

describe('RoleSystem', () => {
  let roleSystem: RoleSystem

  beforeEach(() => {
    roleSystem = new RoleSystem()
  })

  // ── getStandardRoles ──

  describe('getStandardRoles', () => {
    it('should return correct distribution for 5 players', () => {
      const roles = RoleSystem.getStandardRoles(5)
      expect(roles).toHaveLength(5)
      expect(roles[0]).toBe(RoleType.Aspect) // 主公在位置 0
      const counts = countRoles(roles)
      expect(counts.get(RoleType.Aspect)).toBe(1)
      expect(counts.get(RoleType.Guardian)).toBe(1)
      expect(counts.get(RoleType.Ascended)).toBe(2)
      expect(counts.get(RoleType.Infiltrator)).toBe(1)
    })

    it('should return correct distribution for 8 players', () => {
      const roles = RoleSystem.getStandardRoles(8)
      expect(roles).toHaveLength(8)
      expect(roles[0]).toBe(RoleType.Aspect) // 主公在位置 0
      const counts = countRoles(roles)
      expect(counts.get(RoleType.Aspect)).toBe(1)
      expect(counts.get(RoleType.Guardian)).toBe(2)
      expect(counts.get(RoleType.Ascended)).toBe(4)
      expect(counts.get(RoleType.Infiltrator)).toBe(1)
    })

    it('should throw for unsupported player count', () => {
      expect(() => RoleSystem.getStandardRoles(1)).toThrow()
      expect(() => RoleSystem.getStandardRoles(9)).toThrow()
    })
  })

  // ── assignRoles ──

  describe('assignRoles', () => {
    function createPlayers(count: number): Player[] {
      return Array.from({ length: count }, (_, i) =>
        new Player({ id: `p${i}`, seatIndex: i }),
      )
    }

    it('should assign lord to seat 0 and reveal their role', () => {
      const players = createPlayers(5)
      const roles = [...RoleSystem.getStandardRoles(5)]
      // 注意：getStandardRoles 已经把 Aspect 放在索引 0
      // 但 assignRoles 会固定将 Aspect 分配给 seat 0 玩家，
      // 然后将剩余角色随机打乱分配给其他玩家

      const assignment = roleSystem.assignRoles(players, roles)

      // 主公在座位 0
      expect(assignment.lord.id).toBe('p0')
      expect(assignment.lord.seatIndex).toBe(0)
      expect(assignment.lord.role).toBe(RoleType.Aspect)
      expect(assignment.lord.roleRevealed).toBe(true)
    })

    it('should give lord HP bonus', () => {
      const players = createPlayers(5)
      const roles = RoleSystem.getStandardRoles(5)
      const baseMaxHp = players[0]!.maxHp

      roleSystem.assignRoles(players, roles)

      // 主公体力上限应 +1
      expect(players[0]!.maxHp).toBe(baseMaxHp + 1)
      expect(players[0]!.hp).toBe(players[0]!.maxHp)
    })

    it('should hide roles for non-lord players', () => {
      const players = createPlayers(8)
      const roles = RoleSystem.getStandardRoles(8)

      roleSystem.assignRoles(players, roles)

      for (let i = 1; i < players.length; i++) {
        expect(players[i]!.roleRevealed).toBe(false)
      }
    })

    it('should assign exactly one role per player', () => {
      const players = createPlayers(8)
      const roles = RoleSystem.getStandardRoles(8)

      roleSystem.assignRoles(players, roles)

      for (const player of players) {
        expect(player.role).toBeDefined()
        expect([
          RoleType.Aspect,
          RoleType.Guardian,
          RoleType.Ascended,
          RoleType.Infiltrator,
        ]).toContain(player.role)
      }
    })

    it('should throw when no Aspect in roles', () => {
      const players = createPlayers(3)
      const roles = [RoleType.Guardian, RoleType.Ascended, RoleType.Infiltrator]

      expect(() => roleSystem.assignRoles(players, roles)).toThrow(
        '必须有恰好 1 个主公',
      )
    })

    it('should throw when role count does not match player count', () => {
      const players = createPlayers(5)
      const roles = RoleSystem.getStandardRoles(8) // 8 roles for 5 players

      expect(() => roleSystem.assignRoles(players, roles)).toThrow(
        '不匹配',
      )
    })

    it('should throw when multiple Aspects in roles', () => {
      const players = createPlayers(3)
      const roles = [RoleType.Aspect, RoleType.Aspect, RoleType.Ascended]

      expect(() => roleSystem.assignRoles(players, roles)).toThrow(
        '必须有恰好 1 个主公',
      )
    })

    it('should build role map correctly', () => {
      const players = createPlayers(5)
      const roles = RoleSystem.getStandardRoles(5)

      const assignment = roleSystem.assignRoles(players, roles)

      expect(assignment.roles.get(RoleType.Aspect)).toHaveLength(1)
      expect(assignment.roles.get(RoleType.Guardian)).toHaveLength(1)
      expect(assignment.roles.get(RoleType.Ascended)).toHaveLength(2)
      expect(assignment.roles.get(RoleType.Infiltrator)).toHaveLength(1)
    })

    it('should use provided shuffle function', () => {
      const players = createPlayers(5)
      const roles = RoleSystem.getStandardRoles(5)

      let shuffleCalled = false
      const customShuffle = <T>(arr: T[]): T[] => {
        shuffleCalled = true
        // Reverse the array for deterministic testing
        return [...arr].reverse()
      }

      const assignment = roleSystem.assignRoles(players, roles, customShuffle)

      expect(shuffleCalled).toBe(true)
      // Other players should have roles assigned
      for (let i = 1; i < players.length; i++) {
        expect(players[i]!.role).toBeDefined()
      }
    })

    it('should work with minimum 2 players (1v1)', () => {
      const players = createPlayers(2)
      const roles = RoleSystem.getStandardRoles(2)

      const assignment = roleSystem.assignRoles(players, roles)

      expect(assignment.lord.id).toBe('p0')
      expect(assignment.lord.role).toBe(RoleType.Aspect)
      expect(players[1]!.role).toBe(RoleType.Ascended)
    })
  })

  // ── 身份查询 ──

  describe('getVisibleRole', () => {
    it('should return role if revealed', () => {
      const player = new Player({ id: 'p1', seatIndex: 1, role: RoleType.Ascended, roleRevealed: true })
      expect(roleSystem.getVisibleRole(player)).toBe(RoleType.Ascended)
    })

    it('should return role if player is dead', () => {
      const player = new Player({ id: 'p1', seatIndex: 1, role: RoleType.Ascended, alive: false, roleRevealed: false })
      expect(roleSystem.getVisibleRole(player)).toBe(RoleType.Ascended)
    })

    it('should return undefined if role is hidden and alive', () => {
      const player = new Player({ id: 'p1', seatIndex: 1, role: RoleType.Ascended, roleRevealed: false, alive: true })
      expect(roleSystem.getVisibleRole(player)).toBeUndefined()
    })
  })

  describe('getVisibleRoles', () => {
    it('should show all roles to lord', () => {
      const roles = RoleSystem.getStandardRoles(5)
      const players = Array.from({ length: 5 }, (_, i) =>
        new Player({ id: `p${i}`, seatIndex: i }),
      )
      roleSystem.assignRoles(players, roles)

      const lord = players[0]!
      const visible = roleSystem.getVisibleRoles(lord, players)

      // 主公看到自己的身份
      expect(visible.get('p0')).toBe(RoleType.Aspect)
      // 主公不应该看到隐藏的身份（其他角色身份未公开）
      // Note: 主公始终看到自己的身份；其他玩家的隐藏身份对主公也不可见
      // 但是主公身份始终公开，所有人都能看到主公
      for (let i = 1; i < players.length; i++) {
        // 隐藏身份对其他玩家不可见
        // 但在这个函数中，player.id === viewer.id 的检查只对 viewer 自己
        // 其他玩家如果 roleRevealed 为 false 且不是 Aspect，则返回 undefined
        expect(visible.get(`p${i}`)).toBeUndefined()
      }
    })

    it('should hide hidden roles from other players', () => {
      const roles = RoleSystem.getStandardRoles(5)
      const players = Array.from({ length: 5 }, (_, i) =>
        new Player({ id: `p${i}`, seatIndex: i }),
      )
      roleSystem.assignRoles(players, roles)

      const p1 = players[1]!
      const visible = roleSystem.getVisibleRoles(p1, players)

      // p1 看到自己
      expect(visible.get('p1')).toBe(p1.role)
      // p1 看到主公
      expect(visible.get('p0')).toBe(RoleType.Aspect)
      // p1 看不到其他隐藏角色
      // p2, p3, p4 身份均隐藏且未死亡
      expect(visible.get('p2')).toBeUndefined()
      expect(visible.get('p3')).toBeUndefined()
      expect(visible.get('p4')).toBeUndefined()
    })

    it('should show dead players roles', () => {
      const players = Array.from({ length: 5 }, (_, i) =>
        new Player({ id: `p${i}`, seatIndex: i }),
      )
      const roles = RoleSystem.getStandardRoles(5)
      roleSystem.assignRoles(players, roles)

      // p2 死亡
      players[2]!.alive = false

      const p1 = players[1]!
      const visible = roleSystem.getVisibleRoles(p1, players)

      // 死亡的 p2 身份应该可见
      // (死亡触发角色公开在 DeathSystem 中处理，此处仅测试 getVisibleRoles 的逻辑)
      // 注意：根据实现，!player.alive 也会返回身份
      // 但实际游戏中 roleRevealed 会在死亡时被设为 true
      expect(visible.get('p2')).toBeDefined()
    })
  })

  describe('getAlivePlayersByRole', () => {
    it('should return only alive players of specified role', () => {
      const p1 = new Player({ id: 'p1', seatIndex: 0, role: RoleType.Aspect, alive: true })
      const p2 = new Player({ id: 'p2', seatIndex: 1, role: RoleType.Ascended, alive: true })
      const p3 = new Player({ id: 'p3', seatIndex: 2, role: RoleType.Ascended, alive: false })
      const p4 = new Player({ id: 'p4', seatIndex: 3, role: RoleType.Ascended, alive: true })

      const alive = roleSystem.getAlivePlayersByRole(
        [p1, p2, p3, p4],
        RoleType.Ascended,
      )
      expect(alive).toHaveLength(2)
      expect(alive.map((p) => p.id)).toEqual(['p2', 'p4'])
    })
  })

  describe('getLord', () => {
    it('should return the lord player', () => {
      const players = Array.from({ length: 5 }, (_, i) =>
        new Player({ id: `p${i}`, seatIndex: i }),
      )
      const roles = RoleSystem.getStandardRoles(5)
      roleSystem.assignRoles(players, roles)

      const lord = roleSystem.getLord(players)
      expect(lord).toBeDefined()
      expect(lord!.role).toBe(RoleType.Aspect)
      expect(lord!.id).toBe('p0')
    })

    it('should return undefined if no lord', () => {
      const players = [
        new Player({ id: 'p1', seatIndex: 0, role: RoleType.Ascended }),
      ]
      expect(roleSystem.getLord(players)).toBeUndefined()
    })
  })

  // ── 身份公开 ──

  describe('revealRole', () => {
    it('should set roleRevealed to true', () => {
      const player = new Player({ id: 'p1', seatIndex: 1, role: RoleType.Ascended, roleRevealed: false })
      roleSystem.revealRole(player)
      expect(player.roleRevealed).toBe(true)
    })
  })

  describe('isRoleRevealed', () => {
    it('should return true when role is revealed', () => {
      const player = new Player({ id: 'p1', seatIndex: 1, role: RoleType.Ascended, roleRevealed: true })
      expect(roleSystem.isRoleRevealed(player)).toBe(true)
    })

    it('should return false when role is not revealed', () => {
      const player = new Player({ id: 'p1', seatIndex: 1, role: RoleType.Ascended, roleRevealed: false })
      expect(roleSystem.isRoleRevealed(player)).toBe(false)
    })
  })

  // ── getRoleName ──

  describe('getRoleName', () => {
    it('should return Chinese names for all roles', () => {
      expect(roleSystem.getRoleName(RoleType.Aspect)).toBe('天命星灵')
      expect(roleSystem.getRoleName(RoleType.Guardian)).toBe('守护者')
      expect(roleSystem.getRoleName(RoleType.Ascended)).toBe('飞升者')
      expect(roleSystem.getRoleName(RoleType.Infiltrator)).toBe('潜伏者')
    })
  })
})

// ── Helper ──

function countRoles(roles: RoleType[]): Map<RoleType, number> {
  const counts = new Map<RoleType, number>()
  for (const role of roles) {
    counts.set(role, (counts.get(role) ?? 0) + 1)
  }
  return counts
}
