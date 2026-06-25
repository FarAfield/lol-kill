// ============================================================
// 联盟杀 · DeathSystem 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { DeathSystem } from '@core/system/death-system'
import { Player } from '@core/entity/player'
import { Card } from '@core/entity/card'
import { Hero } from '@core/entity/hero'
import { GameState } from '@core/entity/game-state'
import { RoleType, ZoneType, CardType, CardSuit, Kingdom } from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'

const testHero = new Hero({
  id: 'test-hero',
  name: '测试',
  title: '测试',
  kingdom: Kingdom.Demacia,
  maxHp: 4,
})

function createPeachCard(): Card {
  const def: CardDefinition = {
    name: 'tao',
    type: CardType.Basic,
    suit: CardSuit.Heart,
    rank: 1,
    description: '桃',
    tags: ['tao', 'heal'],
    effectIds: ['tao'],
    isDelayed: false,
    canBeCanceled: false,
  }
  return Card.create(def)
}

describe('DeathSystem', () => {
  let state: GameState
  let deathSystem: DeathSystem

  beforeEach(() => {
    Card.resetCounter()
    state = new GameState()
    deathSystem = new DeathSystem(state)
  })

  describe('checkDying', () => {
    it('should return true for alive player with hp <= 0', () => {
      const player = Player.create('p1', 0)
      player.hp = 0
      expect(deathSystem.checkDying(player)).toBe(true)
    })

    it('should return false for alive player with hp > 0', () => {
      const player = Player.create('p1', 0)
      player.hp = 3
      expect(deathSystem.checkDying(player)).toBe(false)
    })

    it('should return false for dead player with hp <= 0', () => {
      const player = Player.create('p1', 0)
      player.alive = false
      player.hp = 0
      expect(deathSystem.checkDying(player)).toBe(false)
    })
  })

  describe('getDyingPlayers', () => {
    it('should return all dying players', () => {
      const p1 = Player.create('p1', 0)
      const p2 = Player.create('p2', 1)
      const p3 = Player.create('p3', 2)
      p1.hp = 0
      p2.hp = 3
      p3.hp = 0
      state.players = [p1, p2, p3]

      const dying = deathSystem.getDyingPlayers()
      expect(dying).toHaveLength(2)
      expect(dying.map((p) => p.id)).toContain('p1')
      expect(dying.map((p) => p.id)).toContain('p3')
    })
  })

  describe('askForPeach', () => {
    it('should save dying player when someone uses a peach', async () => {
      const p1 = Player.create('p1', 0) // dying
      const p2 = Player.create('p2', 1)
      p1.hp = 0
      state.players = [p1, p2]
      state.currentPlayerIndex = 0

      // p1 uses peach on themselves
      const peach = createPeachCard()
      const askPlayer = async (player: Player): Promise<Card | null> => {
        if (player.id === 'p1') return peach
        return null
      }

      const saved = await deathSystem.askForPeach(p1, askPlayer)

      expect(saved).toBe(true)
      expect(p1.hp).toBe(1) // Saved to 1 HP
    })

    it('should return false when no one uses a peach', async () => {
      const p1 = Player.create('p1', 0)
      const p2 = Player.create('p2', 1)
      p1.hp = 0
      state.players = [p1, p2]

      const askPlayer = async (_player: Player): Promise<Card | null> => {
        return null // Nobody uses peach
      }

      const saved = await deathSystem.askForPeach(p1, askPlayer)

      expect(saved).toBe(false)
      expect(p1.hp).toBe(0) // Still dying
    })

    it('should skip dead players when asking for peach', async () => {
      const p1 = Player.create('p1', 0) // dying
      const p2 = Player.create('p2', 1)
      p2.alive = false // dead
      const p3 = Player.create('p3', 2)
      p1.hp = 0
      state.players = [p1, p2, p3]

      const askedPlayers: string[] = []
      const askPlayer = async (player: Player): Promise<Card | null> => {
        askedPlayers.push(player.id)
        return null
      }

      await deathSystem.askForPeach(p1, askPlayer)

      // p2 (dead) should not be asked
      expect(askedPlayers).not.toContain('p2')
    })
  })

  describe('handleDeath', () => {
    it('should mark player as dead', () => {
      const player = Player.create('p1', 0)
      const card1 = createPeachCard()
      card1.zone = ZoneType.Hand
      card1.owner = player
      player.handCards = [card1]

      const discarded = deathSystem.handleDeath(player)

      expect(player.alive).toBe(false)
      expect(player.handCards).toHaveLength(0)
      expect(player.equipCards).toHaveLength(0)
      expect(player.judgeCards).toHaveLength(0)
      expect(discarded).toHaveLength(1)
    })

    it('should reveal role on death', () => {
      const player = Player.create('p1', 0, testHero, {
        role: RoleType.Ascended,
      })
      expect(player.roleRevealed).toBe(false)

      deathSystem.handleDeath(player)

      expect(player.roleRevealed).toBe(true)
    })

    it('should discard all cards from all zones', () => {
      const player = Player.create('p1', 0)
      const handCard = createPeachCard()
      handCard.zone = ZoneType.Hand
      handCard.owner = player

      const equipCard = Card.create({
        name: 'weapon',
        type: CardType.Equip,
        suit: CardSuit.Spade,
        rank: 1,
        description: '',
        tags: ['weapon'],
        effectIds: [],
        isDelayed: false,
        canBeCanceled: false,
      })
      equipCard.zone = ZoneType.Equip
      equipCard.owner = player

      player.handCards = [handCard]
      player.equipCards = [equipCard]

      const discarded = deathSystem.handleDeath(player)

      expect(discarded).toHaveLength(2)
      expect(player.handCards).toHaveLength(0)
      expect(player.equipCards).toHaveLength(0)
    })
  })

  describe('checkGameOver', () => {
    function createPlayerWithRole(id: string, seat: number, role: RoleType, alive: boolean): Player {
      return Player.create(id, seat, testHero, { role, alive })
    }

    it('should return null when game is ongoing', () => {
      state.players = [
        createPlayerWithRole('p0', 0, RoleType.Aspect, true),
        createPlayerWithRole('p1', 1, RoleType.Guardian, true),
        createPlayerWithRole('p2', 2, RoleType.Ascended, true),
        createPlayerWithRole('p3', 3, RoleType.Ascended, true),
        createPlayerWithRole('p4', 4, RoleType.Infiltrator, true),
      ]

      const result = deathSystem.checkGameOver()
      expect(result).toBeNull()
    })

    it('should return Ascended victory when lord dies', () => {
      state.players = [
        createPlayerWithRole('p0', 0, RoleType.Aspect, false), // dead lord
        createPlayerWithRole('p1', 1, RoleType.Guardian, true),
        createPlayerWithRole('p2', 2, RoleType.Ascended, true),
        createPlayerWithRole('p3', 3, RoleType.Ascended, true),
      ]

      const result = deathSystem.checkGameOver()
      expect(result).not.toBeNull()
      expect(result!.winner).toBe(RoleType.Ascended)
    })

    it('should return Infiltrator victory when spy is last alive after lord dies', () => {
      state.players = [
        createPlayerWithRole('p0', 0, RoleType.Aspect, false), // dead lord
        createPlayerWithRole('p1', 1, RoleType.Guardian, false),
        createPlayerWithRole('p2', 2, RoleType.Ascended, false),
        createPlayerWithRole('p3', 3, RoleType.Infiltrator, true), // last alive
      ]

      const result = deathSystem.checkGameOver()
      expect(result).not.toBeNull()
      expect(result!.winner).toBe(RoleType.Infiltrator)
    })

    it('should return Aspect victory when all rebels and spy are dead', () => {
      state.players = [
        createPlayerWithRole('p0', 0, RoleType.Aspect, true),
        createPlayerWithRole('p1', 1, RoleType.Guardian, true),
        createPlayerWithRole('p2', 2, RoleType.Ascended, false),
        createPlayerWithRole('p3', 3, RoleType.Ascended, false),
        createPlayerWithRole('p4', 4, RoleType.Infiltrator, false),
      ]

      const result = deathSystem.checkGameOver()
      expect(result).not.toBeNull()
      expect(result!.winner).toBe(RoleType.Aspect)
    })
  })

  describe('handleReward', () => {
    it('should set reward mark when rebel is killed', () => {
      const rebel = Player.create('rebel', 1, testHero, { role: RoleType.Ascended })
      const killer = Player.create('killer', 0, testHero)

      deathSystem.handleReward(rebel, killer)

      expect(killer.getMark('rewardDraw')).toBe(3)
    })

    it('should not set reward if killer is dead', () => {
      const rebel = Player.create('rebel', 1, testHero, { role: RoleType.Ascended })
      const killer = Player.create('killer', 0, testHero)
      killer.alive = false

      deathSystem.handleReward(rebel, killer)

      expect(killer.getMark('rewardDraw')).toBe(0)
    })
  })

  describe('getRoleName', () => {
    it('should return Chinese names for roles', () => {
      expect(DeathSystem.getRoleName(RoleType.Aspect)).toBe('天命星灵')
      expect(DeathSystem.getRoleName(RoleType.Guardian)).toBe('守护者')
      expect(DeathSystem.getRoleName(RoleType.Ascended)).toBe('飞升者')
      expect(DeathSystem.getRoleName(RoleType.Infiltrator)).toBe('潜伏者')
    })
  })

  // ================================================================
  // 边界情况
  // ================================================================

  describe('edge cases: consecutive near-death', () => {
    it('should treat each near-death event as independent peach-asking', async () => {
      // Setup: 3 players, p0 and p1 both near death, p2 is alive
      const p0 = Player.create('p0', 0, testHero)
      const p1 = Player.create('p1', 1, testHero)
      const p2 = Player.create('p2', 2, testHero)

      // Both p0 and p1 are near death
      p0.hp = 0
      p1.hp = 0

      const state = new GameState({
        players: [p0, p1, p2],
        currentPlayerIndex: 0,
      })
      const deathSystem = new DeathSystem(state)

      // Verify both are detected as dying
      expect(deathSystem.checkDying(p0)).toBe(true)
      expect(deathSystem.checkDying(p1)).toBe(true)
      expect(deathSystem.checkDying(p2)).toBe(false)

      // Check getDyingPlayers returns both
      const dying = deathSystem.getDyingPlayers()
      expect(dying).toHaveLength(2)
    })

    it('should not reset a saved player when another player continues dying', async () => {
      const p0 = Player.create('p0', 0, testHero)
      const p1 = Player.create('p1', 1, testHero)
      const p2 = Player.create('p2', 2, testHero)

      p0.hp = 0
      p1.hp = 0

      const state = new GameState({
        players: [p0, p1, p2],
        currentPlayerIndex: 0,
      })
      const deathSystem = new DeathSystem(state)

      let askCount = 0
      const peach = createPeachCard()

      // p0 saved by p2
      const savedP0 = await deathSystem.askForPeach(p0, async (player) => {
        askCount++
        if (player.id === 'p2' && askCount <= 3) return peach
        return null
      })
      expect(savedP0).toBe(true)
      expect(p0.hp).toBe(1)

      // p1 not saved → dies
      const savedP1 = await deathSystem.askForPeach(p1, async () => null)
      expect(savedP1).toBe(false)

      // p0 should still be at 1 hp (not re-affected)
      expect(p0.hp).toBe(1)
    })
  })

  describe('edge cases: all players dead', () => {
    it('should detect all players dead as abnormal end', () => {
      const players = [
        createDeadPlayer('p0', 0),
        createDeadPlayer('p1', 1),
        createDeadPlayer('p2', 2),
      ]
      const state = new GameState({ players })
      const deathSystem = new DeathSystem(state)

      expect(deathSystem.checkAllDead()).toBe(true)
    })

    it('should handle all-dead players gracefully without crashing', () => {
      const players = [
        createDeadPlayer('p0', 0),
        createDeadPlayer('p1', 1),
      ]
      const state = new GameState({ players, currentPlayerIndex: 0 })
      const deathSystem = new DeathSystem(state)

      // checkAllDead() detects the all-dead state
      expect(deathSystem.checkAllDead()).toBe(true)

      // checkGameOver() vacuously treats all-dead-no-roles as "all enemies dead"
      // → Aspect victory. This is an abnormal edge case that GameEngine.runGameLoop
      // handles separately (checking aliveCount === 0 before calling checkGameOver).
      const result = deathSystem.checkGameOver()
      expect(result).toBeDefined()
      expect(result!.winner).toBe(RoleType.Aspect)
    })
  })
})

/**
 * Helper: create a dead player for testing.
 */
function createDeadPlayer(id: string, seat: number) {
  const player = Player.create(id, seat, testHero)
  player.alive = false
  return player
}
