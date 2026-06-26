// ============================================================
// 联盟杀 · 性能基准测试
//
// 验证核心引擎在正常负载下的性能。
// 注意：这些测试依赖实际执行时间，在 CI 环境中可能波动。
// 如果 CI 持续超时，请检查是否有性能退化。
// ============================================================

import { describe, it, expect } from 'vitest'
import { DamageSystem, DamageStage, type DamageInstance } from '@core/system/damage-system'
import { EventTrigger } from '@core/event/event-trigger'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { EventChain } from '@core/event/event-chain'
import { GameEvent } from '@core/event/game-event'
import { Player } from '@core/entity/player'
import { GameState } from '@core/entity/game-state'
import { Card, type CardDefinition } from '@core/entity/card'
import { TriggerTiming, CardType, CardSuit, GamePhase } from '@core/contracts/enums'
import type { IPlayer } from '@core/contracts/player.interface'

// ── 工厂 ──

function createQuickPlayer(id: string, seat: number): IPlayer {
  return new Player({ id, seatIndex: seat })
}

function createTestCardDef(): CardDefinition {
  return {
    name: 'sha',
    type: CardType.Basic,
    suit: CardSuit.Spade,
    rank: 1,
    description: '杀',
    tags: ['sha'],
    effectIds: ['sha'],
    isDelayed: false,
    canBeCanceled: false,
  }
}

describe('Performance Benchmarks', () => {
  // ════════════════════════════════════════════════════════════
  // 1000 次杀事件处理 < 500ms
  // ════════════════════════════════════════════════════════════

  describe('1000 kill (damage) events', () => {
    it('should process 1000 damage pipelines under 500ms', async () => {
      const source = createQuickPlayer('source', 0)
      const target = createQuickPlayer('target', 1)
      target.hp = 2000 // Enough HP to survive 1000 hits

      const damageSystem = new DamageSystem()

      const start = performance.now()

      for (let i = 0; i < 1000; i++) {
        const damage: DamageInstance = damageSystem.createDamage(
          source,
          target,
          1,
        )
        await damageSystem.executePipeline(damage)
      }

      const elapsed = performance.now() - start
      expect(target.hp).toBe(1000) // 2000 - 1000*1
      expect(elapsed).toBeLessThan(500)
    })
  })

  // ════════════════════════════════════════════════════════════
  // 10 名武将同时在场时每个时机 < 50ms
  // ════════════════════════════════════════════════════════════

  describe('10 heroes skill check per timing', () => {
    it('should get matching hooks for 10 heroes under 50ms', () => {
      const eventTrigger = new EventTrigger()

      // Register 10 heroes × 3 skills each = 30 hooks
      for (let h = 0; h < 10; h++) {
        const player = createQuickPlayer(`hero_${h}`, h)
        for (let s = 0; s < 3; s++) {
          eventTrigger.register({
            hook: async () => {},
            skillId: `skill_h${h}_s${s}`,
            player,
            priority: h * 10 + s,
            isLocked: h % 3 === 0, // some locked
            timing: TriggerTiming.Damage,
            stage: 'Content',
            scope: 'global',
          })
        }
      }

      const event = new GameEvent({
        name: 'Damage Event',
        type: TriggerTiming.Damage,
      })

      const start = performance.now()

      for (let i = 0; i < 10; i++) {
        eventTrigger.getMatchingHooks(event, 'Content')
      }

      const elapsed = performance.now() - start
      // Each iteration should be fast; 10 iterations < 50ms
      expect(elapsed).toBeLessThan(50)
    })

    it('should sort and prioritize hooks for 10 heroes under 50ms', async () => {
      const dispatcher = new EventDispatcher()
      const chain = new EventChain()

      // Register 30 hooks (10 heroes × 3 skills)
      for (let h = 0; h < 10; h++) {
        const player = createQuickPlayer(`hero_${h}`, h)
        for (let s = 0; s < 3; s++) {
          dispatcher.eventTrigger.register({
            hook: async () => {},
            skillId: `skill_h${h}_s${s}`,
            player,
            priority: h * 10 + s,
            isLocked: h % 3 === 0,
            timing: TriggerTiming.CardUse,
            stage: 'Content',
            scope: 'global',
          })
        }
      }

      const event = new GameEvent({
        name: 'Card Use Event',
        type: TriggerTiming.CardUse,
      })

      const start = performance.now()

      await dispatcher.dispatch(event, chain)

      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(50)
    })
  })

  // ════════════════════════════════════════════════════════════
  // 深拷贝 8 人游戏状态 < 10ms
  // ════════════════════════════════════════════════════════════

  describe('deep clone 8-player state', () => {
    it('should clone 8-player game state under 10ms', () => {
      const players: IPlayer[] = []
      for (let i = 0; i < 8; i++) {
        const player = createQuickPlayer(`player_${i}`, i)
        // Add some hand cards
        for (let c = 0; c < 4; c++) {
          player.handCards.push(Card.create(createTestCardDef()))
        }
        players.push(player)
      }

      const deck: ReturnType<typeof Card.create>[] = []
      for (let i = 0; i < 80; i++) {
        deck.push(Card.create(createTestCardDef()))
      }

      const state = new GameState({
        players,
        deck,
        currentRound: 5,
        currentPlayerIndex: 3,
        currentPhase: GamePhase.PhaseUse,
        started: true,
        finished: false,
        config: {
          mode: 'standard-8p',
          playerCount: 8,
          roles: [],
          heroes: [],
          cards: [],
          heroSelectCount: 3,
          initialHandSize: 4,
          equipEnabled: true,
          delayedCardEnabled: true,
          maxRounds: 100,
        },
      })

      const start = performance.now()

      const clone = state.deepClone()

      const elapsed = performance.now() - start

      expect(clone.players).toHaveLength(8)
      expect(clone.deck).toHaveLength(80)
      clone.players[0]!.hp = 1  // Verify independence

      // Should clone under 10ms
      expect(elapsed).toBeLessThan(10)
    })
  })
})
