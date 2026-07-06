// ============================================================
// 联盟杀 · EffectContext (SkillContext) 单元测试
//
// 验证效果上下文的所有受限写入操作。
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { EffectContext } from '@core/engine/effect-context'
import type { EffectContextDeps } from '@core/engine/effect-context'
import { EventChain } from '@core/event/event-chain'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { EventPauseManager } from '@core/event/event-pause-manager'
import { GameEvent } from '@core/event/game-event'
import { DeckManager } from '@core/system/deck-manager'
import { CardSystem } from '@core/system/card-system'
import { DamageSystem } from '@core/system/damage-system'
import { DeathSystem } from '@core/system/death-system'
import { Player } from '@core/entity/player'
import { Hero } from '@core/entity/hero'
import { Card } from '@core/entity/card'
import { GameState } from '@core/entity/game-state'
import {
  CardType,
  CardSuit,
  Kingdom,
  ZoneType,
  TriggerTiming,
  GamePhase,
} from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'

// ── 测试辅助 ──

function createTestHero() {
  return new Hero({
    id: 'test-hero',
    name: '测试英雄',
    title: '测试',
    kingdom: Kingdom.Demacia,
    maxHp: 4,
  })
}

function createCardDef(overrides: Partial<CardDefinition>): CardDefinition {
  return {
    name: overrides.name ?? 'test-card',
    type: overrides.type ?? CardType.Basic,
    suit: overrides.suit ?? CardSuit.Spade,
    rank: overrides.rank ?? 1,
    description: overrides.description ?? '',
    tags: overrides.tags ?? [],
    effectIds: overrides.effectIds ?? [],
    isDelayed: overrides.isDelayed ?? false,
    canBeCanceled: overrides.canBeCanceled ?? false,
    equipSlot: overrides.equipSlot,
    attackRange: overrides.attackRange,
  }
}

function createDeps(state: GameState): EffectContextDeps {
  return {
    state,
    eventChain: new EventChain(),
    eventDispatcher: new EventDispatcher(),
    pauseManager: new EventPauseManager(),
    deckManager: new DeckManager(state),
    cardSystem: new CardSystem(state),
    damageSystem: new DamageSystem(),
    deathSystem: new DeathSystem(state),
  }
}

describe('EffectContext (SkillContext)', () => {
  let state: GameState
  let deps: EffectContextDeps
  let player: Player
  let event: GameEvent

  beforeEach(() => {
    Card.resetCounter()
    state = new GameState()
    deps = createDeps(state)

    const hero = createTestHero()
    player = new Player({ id: 'player_0', seatIndex: 0, heroes: [hero], hp: hero.maxHp, maxHp: hero.maxHp, power: hero.maxPower ?? 0, maxPower: hero.maxPower ?? 0 })
    state.players = [player]

    event = new GameEvent({
      name: '测试事件',
      type: TriggerTiming.CardUse,
      source: player,
      player,
      targets: [],
      phase: GamePhase.PhaseUse,
      round: 1,
      turn: 0,
    })
  })

  // ── drawCards ──

  describe('drawCards', () => {
    it('应从牌堆抽取指定数量的牌并加入手牌', async () => {
      // 初始化牌堆
      const cardDef = createCardDef({ name: '测试牌' })
      deps.deckManager.initializeDeck(Array(10).fill(cardDef))

      const ctx = new EffectContext(event, player, [], deps)
      const drawn = await ctx.drawCards(3)

      expect(drawn).toHaveLength(3)
      expect(player.handCards).toHaveLength(3)
      for (const card of drawn) {
        expect(card.zone).toBe(ZoneType.Hand)
        expect(card.owner).toBe(player)
      }
    })

    it('牌堆不足时应尽可能抽取', async () => {
      const cardDef = createCardDef({ name: '测试牌' })
      deps.deckManager.initializeDeck([cardDef])

      const ctx = new EffectContext(event, player, [], deps)
      const drawn = await ctx.drawCards(5)

      // 牌堆只有1张 + 弃牌堆回收
      expect(drawn.length).toBeGreaterThanOrEqual(1)
      // 成功抽取的牌应在手牌中
      for (const card of drawn) {
        expect(card.zone).toBe(ZoneType.Hand)
      }
    })
  })

  // ── discardCards ──

  describe('discardCards', () => {
    it('应将指定卡牌从手牌移入弃牌堆', async () => {
      const cardDef = createCardDef({ name: '弃置测试' })
      const card = Card.create(cardDef)
      card.zone = ZoneType.Hand
      card.owner = player
      player.handCards.push(card)

      const ctx = new EffectContext(event, player, [], deps)
      await ctx.discardCards([card])

      // 卡牌应从手牌中移除
      expect(player.handCards).not.toContain(card)
    })

    it('应正确弃置多张牌', async () => {
      const cards = Array.from({ length: 3 }, (_, i) => {
        const c = Card.create(createCardDef({ name: `测试${i}` }))
        c.zone = ZoneType.Hand
        c.owner = player
        player.handCards.push(c)
        return c
      })

      const ctx = new EffectContext(event, player, [], deps)
      await ctx.discardCards(cards)

      for (const card of cards) {
        expect(player.handCards).not.toContain(card)
      }
    })
  })

  // ── recoverHp ──

  describe('recoverHp', () => {
    it('应回复指定点数的体力', async () => {
      player.hp = 1
      const ctx = new EffectContext(event, player, [], deps)
      await ctx.recoverHp(player, 2)

      expect(player.hp).toBe(3) // 1 + 2 = 3, maxHp = 4
    })

    it('回复不应超过体力上限', async () => {
      player.hp = 3
      const ctx = new EffectContext(event, player, [], deps)
      await ctx.recoverHp(player, 5)

      expect(player.hp).toBe(player.maxHp) // 不超过上限
    })
  })

  // ── transferCards ──

  describe('transferCards', () => {
    it('应将卡牌转移给目标玩家', async () => {
      const cardDef = createCardDef({ name: '转移测试' })
      const card = Card.create(cardDef)
      card.zone = ZoneType.Hand
      card.owner = player
      player.handCards.push(card)

      const target = new Player({ id: 'target', seatIndex: 1, heroes: [createTestHero()], hp: 4, maxHp: 4 })
      state.players.push(target)

      const ctx = new EffectContext(event, player, [], deps)
      await ctx.transferCards([card], target)

      // 转移后卡牌应属于目标
      expect(card.owner).toBe(target)
      expect(player.handCards).not.toContain(card)
    })
  })

  // ── obtainCards ──

  describe('obtainCards', () => {
    it('应将卡牌加入目标手牌', async () => {
      const cardDef = createCardDef({ name: '获得测试' })
      const card = Card.create(cardDef)
      card.zone = ZoneType.Discard

      const ctx = new EffectContext(event, player, [], deps)
      await ctx.obtainCards(player, [card])

      expect(card.zone).toBe(ZoneType.Hand)
      expect(card.owner).toBe(player)
      expect(player.handCards).toContain(card)
    })
  })

  // ── modifyMaxHp ──

  describe('modifyMaxHp', () => {
    it('应增加体力上限', async () => {
      const originalMaxHp = player.maxHp
      const ctx = new EffectContext(event, player, [], deps)
      await ctx.modifyMaxHp(player, 1)

      expect(player.maxHp).toBe(originalMaxHp + 1)
    })

    it('应减少体力上限并调整当前体力', async () => {
      player.maxHp = 4
      player.hp = 4
      const ctx = new EffectContext(event, player, [], deps)
      await ctx.modifyMaxHp(player, -1)

      expect(player.maxHp).toBe(3)
      expect(player.hp).toBe(3) // 当前体力不超过新上限
    })
  })

  // ── 上下文属性 ──

  describe('context properties', () => {
    it('应正确暴露 event, player, game', () => {
      const ctx = new EffectContext(event, player, [], deps)

      expect(ctx.event).toBe(event)
      expect(ctx.player).toBe(player)
      expect(ctx.game).toBe(state)
      expect(ctx.triggerCards).toEqual([])
    })

    it('应正确传递 triggerCards', () => {
      const card = Card.create(createCardDef({ name: '触发牌' }))
      const ctx = new EffectContext(event, player, [card], deps)

      expect(ctx.triggerCards).toHaveLength(1)
      expect(ctx.triggerCards[0]).toBe(card)
    })

    it('应正确传递 damageEvent', () => {
      const damageEvent = new GameEvent({
        name: '伤害事件',
        type: TriggerTiming.Damage,
        source: player,
      })
      const ctx = new EffectContext(event, player, [], deps, damageEvent)

      expect(ctx.damageEvent).toBe(damageEvent)
    })
  })
})
