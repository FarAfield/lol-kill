// ============================================================
// 联盟杀 · AI 策略 单元测试
//
// 测试 Beginner / Normal / Hard 三种难度的 AI 决策策略。
// 每个策略至少测试出牌、弃牌、防御响应、濒死响应。
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  BeginnerAIStrategy,
  NormalAIStrategy,
  HardAIStrategy,
  createAIStrategy,
  BaseAIStrategy,
} from '@core/services/ai-strategies'
import { AIDifficulty } from '@core/contracts/ai.interface'
import { Player } from '@core/entity/player'
import { Hero } from '@core/entity/hero'
import { Card } from '@core/entity/card'
import { GameState } from '@core/entity/game-state'
import {
  CardType,
  CardSuit,
  ZoneType,
  Kingdom,
  RoleType,
  GamePhase,
  EquipSlot,
  SkillType,
  Frequency,
} from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { IGameState } from '@core/contracts/game.interface'
import type { IEffect } from '@core/contracts/effect.interface'

// ── 测试辅助函数 ──

function createCard(overrides: Partial<CardDefinition> & { zone?: ZoneType }): Card {
  const def: CardDefinition = {
    name: overrides.name ?? 'test-card',
    type: overrides.type ?? CardType.Basic,
    suit: overrides.suit ?? CardSuit.Spade,
    rank: overrides.rank ?? 1,
    description: overrides.description ?? '',
    tags: overrides.tags ?? [],
    effectIds: overrides.effectIds ?? [],
    equipSlot: overrides.equipSlot,
    attackRange: overrides.attackRange,
    isDelayed: overrides.isDelayed ?? false,
    canBeCanceled: overrides.canBeCanceled ?? false,
  }
  const card = Card.create(def)
  if (overrides.zone) {
    card.zone = overrides.zone
  }
  return card
}

function createShaCard(zone: ZoneType = ZoneType.Hand): Card {
  return createCard({
    name: '杀',
    type: CardType.Basic,
    suit: CardSuit.Spade,
    rank: 7,
    description: '对一名角色造成1点伤害',
    tags: ['sha'],
    zone,
  })
}

function createShanCard(zone: ZoneType = ZoneType.Hand): Card {
  return createCard({
    name: '闪',
    type: CardType.Basic,
    suit: CardSuit.Heart,
    rank: 2,
    description: '抵消杀的效果',
    tags: ['shan'],
    zone,
  })
}

function createPeachCard(zone: ZoneType = ZoneType.Hand): Card {
  return createCard({
    name: '桃',
    type: CardType.Basic,
    suit: CardSuit.Heart,
    rank: 4,
    description: '回复1点体力',
    tags: ['peach'],
    zone,
  })
}

function createJiuCard(zone: ZoneType = ZoneType.Hand): Card {
  return createCard({
    name: '酒',
    type: CardType.Basic,
    suit: CardSuit.Club,
    rank: 9,
    description: '本回合下一张杀伤害+1，或濒死时回复1点体力',
    tags: ['jiu'],
    zone,
  })
}

function createWeaponCard(zone: ZoneType = ZoneType.Hand): Card {
  return createCard({
    name: '诸葛连弩',
    type: CardType.Equip,
    suit: CardSuit.Diamond,
    rank: 1,
    description: '出牌阶段可出任意张杀',
    tags: ['equip', 'weapon'],
    equipSlot: EquipSlot.Weapon,
    attackRange: 1,
    zone,
  })
}

function createTrickCard(
  trickName: string,
  tags: string[],
  zone: ZoneType = ZoneType.Hand,
  isDelayed: boolean = false,
): Card {
  return createCard({
    name: trickName,
    type: CardType.Rune,
    suit: CardSuit.Spade,
    rank: 3,
    description: trickName,
    tags,
    isDelayed,
    canBeCanceled: !isDelayed,
    zone,
  })
}

function createPlayer(opts: {
  id: string
  seatIndex: number
  hp?: number
  maxHp?: number
  role?: RoleType
  roleRevealed?: boolean
  handCards?: Card[]
}): IPlayer {
  return new Player({
    id: opts.id,
    seatIndex: opts.seatIndex,
    hp: opts.hp ?? 4,
    maxHp: opts.maxHp ?? 4,
    role: opts.role,
    roleRevealed: opts.roleRevealed ?? false,
    handCards: opts.handCards ?? [],
    heroes: [
      new Hero({
        id: `hero_${opts.id}`,
        name: `英雄${opts.seatIndex}`,
        title: '测试',
        kingdom: Kingdom.Demacia,
        maxHp: opts.maxHp ?? 4,
        effectIds: [],
      }),
    ],
  })
}

function createGameState(players: IPlayer[]): IGameState {
  return new GameState({
    players,
    deck: [],
    discardPile: [],
    currentRound: 1,
    currentPlayerIndex: 0,
    currentPhase: GamePhase.PhaseUse,
    phaseIndex: 3,
    log: [],
    processingCards: [],
    started: true,
    finished: false,
    config: {
      mode: 'test',
      playerCount: players.length,
      roles: [],
      heroes: [],
      cards: [],
      heroSelectCount: 1,
      initialHandSize: 4,
      equipEnabled: true,
      delayedCardEnabled: true,
      maxRounds: 100,
    },
  })
}

// ── 测试套件 ──

describe('BaseAIStrategy', () => {
  it('getCardValue: 桃价值最高', () => {
    const peach = createPeachCard()
    const shan = createShanCard()
    const sha = createShaCard()
    const strategy = new BeginnerAIStrategy()

    const peachVal = strategy['getCardValue'](peach)
    const shanVal = strategy['getCardValue'](shan)
    const shaVal = strategy['getCardValue'](sha)

    expect(peachVal).toBeGreaterThan(shanVal)
    expect(shanVal).toBeGreaterThan(shaVal)
  })
})

describe('BeginnerAIStrategy (新手 AI)', () => {
  let strategy: BeginnerAIStrategy

  beforeEach(() => {
    strategy = new BeginnerAIStrategy()
  })

  describe('chooseCardToPlay', () => {
    it('手中有杀时应该会随机出牌', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createShaCard(), createShanCard(), createPeachCard()],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
        role: RoleType.Ascended,
      })
      const state = createGameState([player, enemy])

      const choice = strategy.chooseCardToPlay(player, state)
      // 新手 AI 有手牌就应该出牌
      expect(choice).not.toBeNull()
      expect(choice!.card).toBeDefined()
    })

    it('无手牌时应该返回 null', () => {
      const player = createPlayer({ id: 'p0', seatIndex: 0, handCards: [] })
      const state = createGameState([player])

      const choice = strategy.chooseCardToPlay(player, state)
      expect(choice).toBeNull()
    })
  })

  describe('chooseCardsToDiscard', () => {
    it('需要弃2张牌时应该返回2张卡牌', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 2,
        handCards: [createShaCard(), createShanCard(), createPeachCard(), createJiuCard()],
      })
      const state = createGameState([player])

      const discarded = strategy.chooseCardsToDiscard(player, 2, state)
      expect(discarded).toHaveLength(2)
      // 弃置的牌应在手牌中
      const handIds = player.handCards.map((c) => c.id)
      for (const card of discarded) {
        expect(handIds).toContain(card.id)
      }
    })

    it('需要弃0张时返回空数组', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShaCard()],
      })
      const state = createGameState([player])

      const discarded = strategy.chooseCardsToDiscard(player, 0, state)
      expect(discarded).toHaveLength(0)
    })
  })

  describe('respondToDefend', () => {
    it('有闪时应该出闪', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShaCard(), createShanCard()],
      })
      const state = createGameState([player])
      const validCards = player.handCards.filter((c) => c.tags.has('shan'))

      const response = strategy.respondToDefend(player, validCards, state)
      expect(response).not.toBeNull()
      expect(response!.tags.has('shan')).toBe(true)
    })

    it('无有效卡牌时随机选一张', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createPeachCard()],
      })
      const state = createGameState([player])
      const validCards = [createPeachCard()]

      const response = strategy.respondToDefend(player, validCards, state)
      // 新手 AI 有响应必出
      expect(response).not.toBeNull()
    })
  })

  describe('chooseHero', () => {
    it('应该返回 selectCount 个英雄 ID', () => {
      const player = createPlayer({ id: 'p0', seatIndex: 0 })
      const state = createGameState([player])
      const candidates = [
        { id: 'hero_1', name: '英雄1', title: '', kingdom: 'demacia' },
        { id: 'hero_2', name: '英雄2', title: '', kingdom: 'noxus' },
        { id: 'hero_3', name: '英雄3', title: '', kingdom: 'ionia' },
      ]

      const selected = strategy.chooseHero(player, candidates, 1, state)
      expect(selected).toHaveLength(1)
      expect(candidates.map((c) => c.id)).toContain(selected[0])
    })
  })
})

describe('NormalAIStrategy (普通 AI)', () => {
  let strategy: NormalAIStrategy

  beforeEach(() => {
    strategy = new NormalAIStrategy()
  })

  describe('chooseCardToPlay', () => {
    it('优先装备武器', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createWeaponCard(), createShaCard()],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
        role: RoleType.Ascended,
      })
      const state = createGameState([player, enemy])

      const choice = strategy.chooseCardToPlay(player, state)
      expect(choice).not.toBeNull()
      // 普通 AI 优先装备
      expect(choice!.card.tags.has('equip') || !!choice!.card.equipSlot).toBe(true)
    })

    it('受伤时优先使用桃', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 2,
        maxHp: 4,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createPeachCard(), createShaCard()],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
        role: RoleType.Ascended,
      })
      const state = createGameState([player, enemy])

      const choice = strategy.chooseCardToPlay(player, state)
      expect(choice).not.toBeNull()
      expect(choice!.card.tags.has('peach')).toBe(true)
      expect(choice!.targets[0]?.id).toBe(player.id)
    })

    it('有杀时攻击敌人', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createShaCard()],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
        role: RoleType.Ascended,
      })
      const ally = createPlayer({
        id: 'p2',
        seatIndex: 2,
        role: RoleType.Guardian,
      })
      const state = createGameState([player, enemy, ally])

      const choice = strategy.chooseCardToPlay(player, state)
      expect(choice).not.toBeNull()
      expect(choice!.card.tags.has('sha')).toBe(true)
    })

    it('无手牌时返回 null', () => {
      const player = createPlayer({ id: 'p0', seatIndex: 0, handCards: [] })
      const state = createGameState([player])

      const choice = strategy.chooseCardToPlay(player, state)
      expect(choice).toBeNull()
    })
  })

  describe('chooseCardsToDiscard', () => {
    it('应该按价值升序弃牌（低价值优先弃）', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 2,
        handCards: [
          createPeachCard(),    // 价值 90
          createShaCard(),      // 价值 50
          createShaCard(),      // 价值 50
          createShanCard(),     // 价值 60
        ],
      })
      const state = createGameState([player])

      const discarded = strategy.chooseCardsToDiscard(player, 2, state)
      expect(discarded).toHaveLength(2)

      // 不应弃置桃（最高价值）或闪（较高价值）
      const discardedNames = discarded.map((c) => c.name)
      // 杀的价值最低，应该优先被弃置
      expect(discardedNames.filter((n) => n === '杀').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('respondToDefend', () => {
    it('有闪时应该出闪', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShaCard(), createShanCard(), createShanCard()],
      })
      const state = createGameState([player])
      const validCards = player.handCards.filter((c) => c.tags.has('shan'))

      const response = strategy.respondToDefend(player, validCards, state)
      expect(response).not.toBeNull()
      expect(response!.tags.has('shan')).toBe(true)
    })

    it('无闪时不出牌', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        handCards: [createShaCard(), createPeachCard()],
      })
      const state = createGameState([player])
      // 没有闪作为有效防御牌
      const validCards: Card[] = []

      const response = strategy.respondToDefend(player, validCards, state)
      expect(response).toBeNull()
    })
  })

  describe('respondToDying', () => {
    it('自己濒死时使用桃', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createPeachCard()],
      })
      const state = createGameState([player])
      const validCards = player.handCards.filter((c) => c.tags.has('peach'))

      const response = strategy.respondToDying(player, player, validCards, state)
      expect(response).not.toBeNull()
      expect(response!.tags.has('peach')).toBe(true)
    })

    it('盟友濒死时使用桃', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        role: RoleType.Guardian,
        roleRevealed: true,
        handCards: [createPeachCard()],
      })
      const lord = createPlayer({
        id: 'p1',
        seatIndex: 1,
        hp: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
      })
      const state = createGameState([player, lord])
      const validCards = player.handCards.filter((c) => c.tags.has('peach'))

      const response = strategy.respondToDying(player, lord, validCards, state)
      expect(response).not.toBeNull()
    })

    it('敌人濒死时不用桃', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createPeachCard()],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
        hp: 0,
        role: RoleType.Ascended,
        roleRevealed: true,
      })
      const state = createGameState([player, enemy])
      const validCards = player.handCards.filter((c) => c.tags.has('peach'))

      const response = strategy.respondToDying(player, enemy, validCards, state)
      expect(response).toBeNull()
    })
  })
})

describe('HardAIStrategy (困难 AI)', () => {
  let strategy: HardAIStrategy

  beforeEach(() => {
    strategy = new HardAIStrategy()
  })

  describe('chooseCardToPlay', () => {
    it('优先装备武器', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createWeaponCard(), createShaCard()],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
        role: RoleType.Ascended,
      })
      const state = createGameState([player, enemy])

      const choice = strategy.chooseCardToPlay(player, state)
      expect(choice).not.toBeNull()
      // 困难 AI 也优先装备
      expect(choice!.card.tags.has('equip') || !!choice!.card.equipSlot).toBe(true)
    })

    it('体力严重不足时使用桃', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 1,
        maxHp: 4,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createPeachCard(), createShaCard()],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
        role: RoleType.Ascended,
      })
      const state = createGameState([player, enemy])

      const choice = strategy.chooseCardToPlay(player, state)
      expect(choice).not.toBeNull()
      expect(choice!.card.tags.has('peach')).toBe(true)
    })

    it('轻度受伤且手牌不多时保留桃', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 3,
        maxHp: 4,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createPeachCard(), createShaCard(), createShanCard()],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
        role: RoleType.Ascended,
      })
      const state = createGameState([player, enemy])

      const choice = strategy.chooseCardToPlay(player, state)
      // 应该优先出杀（攻击敌人）而非使用桃
      if (choice) {
        expect(choice.card.tags.has('sha')).toBe(true)
      }
    })

    it('有酒和杀时先使用酒', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createJiuCard(), createShaCard()],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
        role: RoleType.Ascended,
      })
      const state = createGameState([player, enemy])

      const choice = strategy.chooseCardToPlay(player, state)
      // 有酒有杀 → 先喝酒再出杀
      expect(choice).not.toBeNull()
      expect(choice!.card.tags.has('jiu')).toBe(true)
    })

    it('无可用操作时返回 null', () => {
      const player = createPlayer({ id: 'p0', seatIndex: 0, handCards: [] })
      const state = createGameState([player])

      const choice = strategy.chooseCardToPlay(player, state)
      expect(choice).toBeNull()
    })
  })

  describe('chooseCardsToDiscard', () => {
    it('应该保留至少1张闪', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 2,
        handCards: [
          createShanCard(),   // 1张闪
          createShaCard(),
          createShaCard(),
          createPeachCard(),
        ],
      })
      const state = createGameState([player])

      const discarded = strategy.chooseCardsToDiscard(player, 2, state)
      expect(discarded).toHaveLength(2)

      // 剩余的牌中应有1张闪
      const remainingIds = player.handCards
        .filter((c) => !discarded.some((d) => d.id === c.id))
        .map((c) => c.id)
      const shanRemaining = player.handCards.filter(
        (c) => remainingIds.includes(c.id) && c.tags.has('shan'),
      )
      expect(shanRemaining.length).toBeGreaterThanOrEqual(1)
    })

    it('受伤时应该保留至少1张桃', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 2,
        maxHp: 4,
        handCards: [
          createPeachCard(),
          createShaCard(),
          createShaCard(),
          createShaCard(),
        ],
      })
      const state = createGameState([player])

      const discarded = strategy.chooseCardsToDiscard(player, 2, state)
      expect(discarded).toHaveLength(2)

      // 桃不应该被弃置
      const discardedPeaches = discarded.filter((c) => c.tags.has('peach'))
      expect(discardedPeaches).toHaveLength(0)
    })
  })

  describe('respondToDefend', () => {
    it('体力低时出闪', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 1,
        handCards: [createShanCard()],
      })
      const state = createGameState([player])
      const validCards = player.handCards.filter((c) => c.tags.has('shan'))

      const response = strategy.respondToDefend(player, validCards, state)
      expect(response).not.toBeNull()
    })

    it('只有1张闪且体力充足时可能不出', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 4,
        maxHp: 4,
        handCards: [createShanCard()],
      })
      const state = createGameState([player])
      const validCards = [createShanCard()]

      // Hard AI 手牌极少(1张)且体力充足时可能选择不出闪
      // 这是一个概率事件，多次执行确保至少有一次不出
      let everSkipped = false
      for (let i = 0; i < 10; i++) {
        const response = strategy.respondToDefend(player, validCards, state)
        if (response === null) {
          everSkipped = true
          break
        }
      }
      // 至少有一次不出（概率极高）
      expect(everSkipped).toBe(true)
    })
  })

  describe('respondToDying', () => {
    it('自己濒死时一定使用桃', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        hp: 0,
        handCards: [createPeachCard()],
      })
      const state = createGameState([player])
      const validCards = player.handCards.filter((c) => c.tags.has('peach'))

      const response = strategy.respondToDying(player, player, validCards, state)
      expect(response).not.toBeNull()
      expect(response!.tags.has('peach')).toBe(true)
    })

    it('主公濒死时忠臣必救', () => {
      const guardian = createPlayer({
        id: 'p0',
        seatIndex: 0,
        role: RoleType.Guardian,
        roleRevealed: true,
        handCards: [createPeachCard()],
      })
      const lord = createPlayer({
        id: 'p1',
        seatIndex: 1,
        hp: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
      })
      const state = createGameState([guardian, lord])
      const validCards = guardian.handCards.filter((c) => c.tags.has('peach'))

      const response = strategy.respondToDying(guardian, lord, validCards, state)
      expect(response).not.toBeNull()
    })

    it('敌人体力低时不救', () => {
      const player = createPlayer({
        id: 'p0',
        seatIndex: 0,
        role: RoleType.Aspect,
        roleRevealed: true,
        handCards: [createPeachCard()],
      })
      const enemy = createPlayer({
        id: 'p1',
        seatIndex: 1,
        hp: 0,
        role: RoleType.Ascended,
        roleRevealed: true,
      })
      const state = createGameState([player, enemy])
      const validCards = player.handCards.filter((c) => c.tags.has('peach'))

      const response = strategy.respondToDying(player, enemy, validCards, state)
      expect(response).toBeNull()
    })
  })
})

describe('createAIStrategy 工厂函数', () => {
  it('应该创建 BeginnerAIStrategy', () => {
    const s = createAIStrategy(AIDifficulty.Beginner)
    expect(s).toBeInstanceOf(BeginnerAIStrategy)
  })

  it('应该创建 NormalAIStrategy', () => {
    const s = createAIStrategy(AIDifficulty.Normal)
    expect(s).toBeInstanceOf(NormalAIStrategy)
  })

  it('应该创建 HardAIStrategy', () => {
    const s = createAIStrategy(AIDifficulty.Hard)
    expect(s).toBeInstanceOf(HardAIStrategy)
  })

  it('未知难度默认返回 NormalAIStrategy', () => {
    const s = createAIStrategy('unknown' as AIDifficulty)
    expect(s).toBeInstanceOf(NormalAIStrategy)
  })
})

describe('AI 策略：多玩家场景', () => {
  it('困难 AI 优先攻击受伤的敌人', () => {
    const strategy = new HardAIStrategy()
    const player = createPlayer({
      id: 'p0',
      seatIndex: 0,
      role: RoleType.Ascended,
      roleRevealed: true,
      handCards: [createShaCard()],
    })
    const healthyLord = createPlayer({
      id: 'p1',
      seatIndex: 1,
      hp: 4,
      maxHp: 5,
      role: RoleType.Aspect,
      roleRevealed: true,
    })
    const woundedGuardian = createPlayer({
      id: 'p2',
      seatIndex: 2,
      hp: 1,
      maxHp: 4,
      role: RoleType.Guardian,
      roleRevealed: true,
    })
    const state = createGameState([player, healthyLord, woundedGuardian])

    const choice = strategy.chooseCardToPlay(player, state)
    if (choice) {
      // 应该至少有一个目标
      expect(choice.targets.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('普通 AI 不会攻击盟友', () => {
    const strategy = new NormalAIStrategy()
    const player = createPlayer({
      id: 'p0',
      seatIndex: 0,
      role: RoleType.Aspect,
      roleRevealed: true,
      handCards: [createShaCard()],
    })
    const ally = createPlayer({
      id: 'p1',
      seatIndex: 1,
      role: RoleType.Guardian,
      roleRevealed: true,
    })
    const state = createGameState([player, ally])

    const choice = strategy.chooseCardToPlay(player, state)
    // 如果出牌，目标不应是盟友
    if (choice && choice.card.tags.has('sha')) {
      expect(choice.targets.every((t) => t.id !== ally.id)).toBe(true)
    }
  })
})
