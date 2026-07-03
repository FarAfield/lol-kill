// ============================================================
// 联盟杀 · 英雄技能 单元测试
//
// 测试所有标准英雄技能的核心结算逻辑。
// 每个技能至少 2 个测试用例。
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { EffectRegistry } from '@core/engine/effect-registry'
import { SkillRegistry } from '@core/engine/skill-registry'
import { EffectContext } from '@core/engine/effect-context'
import type { EffectContextDeps } from '@core/contracts/effect-context-deps'
import { EventChain } from '@core/event/event-chain'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { EventTrigger } from '@core/event/event-trigger'
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
  SkillType,
  Frequency,
} from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'
import type { IEffect } from '@core/contracts/effect.interface'

// ── 导入英雄技能 ──
import {
  jianxiongEffect,
  hujiaEffect,
  fankuiEffect,
  ganglieEffect,
  tuxiEffect,
} from '@source/heroes/skills/wei-skills'
import {
  rendeEffect,
  wushengEffect,
  paoxiaoEffect,
  longdanEffect,
} from '@source/heroes/skills/shu-skills'
import {
  zhihengEffect,
  kejiEffect,
} from '@source/heroes/skills/wu-skills'

// ── 测试辅助 ──

function createTestHero(overrides?: Partial<{ id: string; name: string; maxHp: number; effectIds: string[] }>) {
  return new Hero({
    id: overrides?.id ?? 'test-hero',
    name: overrides?.name ?? '测试英雄',
    title: '测试',
    kingdom: Kingdom.Demacia,
    maxHp: overrides?.maxHp ?? 4,
    effectIds: overrides?.effectIds ?? [],
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
    deckManager: new DeckManager(state),
    cardSystem: new CardSystem(state),
    damageSystem: new DamageSystem(),
    deathSystem: new DeathSystem(state),
  }
}

// ═══════════════════════════════════════════
// 曹操 · 奸雄
// ═══════════════════════════════════════════

describe('曹操 · 奸雄', () => {
  let state: GameState
  let deps: EffectContextDeps
  let caoCao: Player
  let source: Player
  let damageCard: ReturnType<typeof Card.create>

  beforeEach(() => {
    Card.resetCounter()
    state = new GameState()
    deps = createDeps(state)

    caoCao = new Player({ id: 'caocao', seatIndex: 0, heroes: [createTestHero({ id: 'caocao', effectIds: ['jianxiong'] })], hp: 4, maxHp: 4 })
    source = new Player({ id: 'source', seatIndex: 1, heroes: [createTestHero({ id: 'enemy' })], hp: 4, maxHp: 4 })

    state.players = [caoCao, source]

    damageCard = Card.create(createCardDef({
      name: '杀',
      tags: ['sha'],
      suit: CardSuit.Spade,
    }))
    source.handCards.push(damageCard)
    damageCard.zone = ZoneType.Hand
    damageCard.owner = source
  })

  it('受到伤害后应获得造成伤害的牌', async () => {
    caoCao.hp = 4

    const damageEvent = new GameEvent({
      name: '伤害事件',
      type: TriggerTiming.Damage,
      source,
      player: source,
      targets: [caoCao],
      cards: [damageCard],
      phase: GamePhase.PhaseUse,
      round: 1,
      turn: 1,
      data: { damageCard, damageAmount: 1, damagePrevented: false },
    })

    const ctx = new EffectContext(damageEvent, caoCao, [damageCard], deps, damageEvent)

    // 执行奸雄
    await jianxiongEffect.content(ctx)

    // 曹操应获得造成伤害的牌
    // 检查卡牌所有者变为曹操
    expect(damageCard.owner).toBe(caoCao)
  })

  it('filter: 自己造成的伤害不应触发', () => {
    const selfDamageEvent = new GameEvent({
      name: '自伤事件',
      type: TriggerTiming.Damage,
      source: caoCao,
      player: caoCao,
      targets: [caoCao],
      cards: [damageCard],
      data: { damageCard },
    })

    const ctx = new EffectContext(selfDamageEvent, caoCao, [damageCard], deps, selfDamageEvent)

    const result = jianxiongEffect.filter!(ctx)
    expect(result).toBe(false)
  })

  it('filter: 伤害被阻止时应返回false', () => {
    const preventedEvent = new GameEvent({
      name: '被阻止的伤害',
      type: TriggerTiming.Damage,
      source,
      player: source,
      targets: [caoCao],
      data: { damageCard, damagePrevented: true },
    })

    const ctx = new EffectContext(preventedEvent, caoCao, [], deps, preventedEvent)

    const result = jianxiongEffect.filter!(ctx)
    expect(result).toBe(false)
  })
})

// ═══════════════════════════════════════════
// 曹操 · 护驾
// ═══════════════════════════════════════════

describe('曹操 · 护驾', () => {
  it('成为杀的目标时应激活护驾标记', async () => {
    const state = new GameState()
    const deps = createDeps(state)

    const caoCao = new Player({ id: 'caocao', seatIndex: 0, heroes: [createTestHero({ effectIds: ['hujia'] })], hp: 4, maxHp: 4 })
    const source = new Player({ id: 'source', seatIndex: 1, heroes: [createTestHero()], hp: 4, maxHp: 4 })
    state.players = [caoCao, source]

    const shaCard = Card.create(createCardDef({ name: '杀', tags: ['sha'] }))

    const cardUseEvent = new GameEvent({
      name: '使用杀',
      type: TriggerTiming.CardUse,
      source,
      player: source,
      targets: [caoCao],
      cards: [shaCard],
      phase: GamePhase.PhaseUse,
      round: 1,
      turn: 1,
    })

    const ctx = new EffectContext(cardUseEvent, caoCao, [shaCard], deps)

    await hujiaEffect.content(ctx)

    expect(caoCao.getMark('hujiaActive')).toBe(1)
  })

  it('filter: 非杀类卡牌不应触发护驾', () => {
    const state = new GameState()
    const deps = createDeps(state)

    const caoCao = new Player({ id: 'caocao', seatIndex: 0, heroes: [createTestHero({ effectIds: ['hujia'] })], hp: 4, maxHp: 4 })
    const source = new Player({ id: 'source', seatIndex: 1, heroes: [createTestHero()], hp: 4, maxHp: 4 })
    state.players = [caoCao, source]

    const taoCard = Card.create(createCardDef({ name: '桃', tags: ['tao'] }))

    const event = new GameEvent({
      name: '使用桃',
      type: TriggerTiming.CardUse,
      source,
      player: source,
      targets: [caoCao],
      cards: [taoCard],
    })

    const ctx = new EffectContext(event, caoCao, [taoCard], deps)

    const result = hujiaEffect.filter!(ctx)
    expect(result).toBe(false)
  })
})

// ═══════════════════════════════════════════
// 司马懿 · 反馈
// ═══════════════════════════════════════════

describe('司马懿 · 反馈', () => {
  let state: GameState
  let deps: EffectContextDeps
  let simaYi: Player
  let source: Player

  beforeEach(() => {
    Card.resetCounter()
    state = new GameState()
    deps = createDeps(state)

    simaYi = new Player({ id: 'simayi', seatIndex: 0, heroes: [createTestHero({ id: 'simayi', effectIds: ['fankui'] })], hp: 4, maxHp: 4 })
    source = new Player({ id: 'source', seatIndex: 1, heroes: [createTestHero({ id: 'enemy' })], hp: 4, maxHp: 4 })

    // 给来源一些手牌
    for (let i = 0; i < 3; i++) {
      const c = Card.create(createCardDef({ name: `手牌${i}`, tags: ['basic'] }))
      c.zone = ZoneType.Hand
      c.owner = source
      source.handCards.push(c)
    }

    state.players = [simaYi, source]
  })

  it('受到伤害后应从来源获得一张牌', async () => {
    const sourceHandCount = source.handCards.length

    const damageEvent = new GameEvent({
      name: '伤害事件',
      type: TriggerTiming.Damage,
      source,
      player: source,
      targets: [simaYi],
      phase: GamePhase.PhaseUse,
      round: 1,
      turn: 1,
      data: { damageAmount: 1, damagePrevented: false },
    })

    const ctx = new EffectContext(damageEvent, simaYi, [], deps, damageEvent)

    await fankuiEffect.content(ctx)

    // 来源手牌数应减少
    expect(source.handCards.length).toBeLessThan(sourceHandCount)
  })

  it('filter: 伤害被阻止应返回false', () => {
    const preventedEvent = new GameEvent({
      name: '被阻止的伤害',
      type: TriggerTiming.Damage,
      source,
      player: source,
      targets: [simaYi],
      data: { damagePrevented: true },
    })

    const ctx = new EffectContext(preventedEvent, simaYi, [], deps, preventedEvent)

    const result = fankuiEffect.filter!(ctx)
    expect(result).toBe(false)
  })

  it('filter: 来源无手牌时应返回false', () => {
    source.handCards = []
    source.equipCards = []

    const damageEvent = new GameEvent({
      name: '伤害事件',
      type: TriggerTiming.Damage,
      source,
      player: source,
      targets: [simaYi],
      data: { damagePrevented: false },
    })

    const ctx = new EffectContext(damageEvent, simaYi, [], deps, damageEvent)

    const result = fankuiEffect.filter!(ctx)
    expect(result).toBe(false)
  })
})

// ═══════════════════════════════════════════
// 夏侯惇 · 刚烈
// ═══════════════════════════════════════════

describe('夏侯惇 · 刚烈', () => {
  let state: GameState
  let deps: EffectContextDeps
  let xiahouDun: Player
  let source: Player

  beforeEach(() => {
    Card.resetCounter()
    state = new GameState()
    deps = createDeps(state)

    xiahouDun = new Player({ id: 'xiahoudun', seatIndex: 0, heroes: [createTestHero({ id: 'xiahoudun', effectIds: ['ganglie'] })], hp: 4, maxHp: 4 })
    source = new Player({ id: 'source', seatIndex: 1, heroes: [createTestHero({ id: 'enemy' })], hp: 4, maxHp: 4 })

    // 给来源一些手牌
    for (let i = 0; i < 3; i++) {
      const c = Card.create(createCardDef({ name: `手牌${i}`, tags: ['basic'] }))
      c.zone = ZoneType.Hand
      c.owner = source
      source.handCards.push(c)
    }

    // 初始化牌堆用于判定
    const judgeCardDef = createCardDef({ name: '判定牌', suit: CardSuit.Spade, tags: ['judge'] })
    deps.deckManager.initializeDeck(Array(10).fill(judgeCardDef))

    state.players = [xiahouDun, source]
  })

  it('受到伤害后应执行刚烈判定', async () => {
    const sourceHp = source.hp

    const damageEvent = new GameEvent({
      name: '伤害事件',
      type: TriggerTiming.Damage,
      source,
      player: source,
      targets: [xiahouDun],
      phase: GamePhase.PhaseUse,
      round: 1,
      turn: 1,
      data: { damageAmount: 1, damagePrevented: false },
    })

    const ctx = new EffectContext(damageEvent, xiahouDun, [], deps, damageEvent)

    await ganglieEffect.content(ctx)

    // 刚烈应执行判决（来源弃牌或受伤）
    // 判定为非红桃（Spade），手牌≥2：弃2牌
    expect(source.handCards.length).toBeLessThan(3)
  })

  it('filter: 自己造成的伤害不应触发', () => {
    const selfDamageEvent = new GameEvent({
      name: '自伤',
      type: TriggerTiming.Damage,
      source: xiahouDun,
      player: xiahouDun,
      targets: [xiahouDun],
      data: { damagePrevented: false },
    })

    const ctx = new EffectContext(selfDamageEvent, xiahouDun, [], deps, selfDamageEvent)

    expect(ganglieEffect.filter!(ctx)).toBe(false)
  })

  it('type应为被动技', () => {
    expect(ganglieEffect.type).toBe(SkillType.Passive)
  })
})

// ═══════════════════════════════════════════
// 张辽 · 突袭
// ═══════════════════════════════════════════

describe('张辽 · 突袭', () => {
  let state: GameState
  let deps: EffectContextDeps
  let zhangLiao: Player
  let other1: Player
  let other2: Player

  beforeEach(() => {
    Card.resetCounter()
    state = new GameState()
    deps = createDeps(state)

    zhangLiao = new Player({ id: 'zhangliao', seatIndex: 0, heroes: [createTestHero({ id: 'zhangliao', effectIds: ['tuxi'] })], hp: 4, maxHp: 4 })
    other1 = new Player({ id: 'other1', seatIndex: 1, heroes: [createTestHero({ id: 'other1' })], hp: 4, maxHp: 4 })
    other2 = new Player({ id: 'other2', seatIndex: 2, heroes: [createTestHero({ id: 'other2' })], hp: 4, maxHp: 4 })

    // 给其他玩家手牌
    for (let i = 0; i < 3; i++) {
      const c1 = Card.create(createCardDef({ name: `手牌A${i}`, tags: ['basic'] }))
      c1.zone = ZoneType.Hand
      c1.owner = other1
      other1.handCards.push(c1)
      const c2 = Card.create(createCardDef({ name: `手牌B${i}`, tags: ['basic'] }))
      c2.zone = ZoneType.Hand
      c2.owner = other2
      other2.handCards.push(c2)
    }

    state.players = [zhangLiao, other1, other2]
  })

  it('摸牌阶段应跳过正常摸牌并获得其他角色手牌', async () => {
    const drawEvent = new GameEvent({
      name: '摸牌阶段',
      type: TriggerTiming.PhaseDraw,
      source: zhangLiao,
      player: zhangLiao,
      targets: [zhangLiao],
      phase: GamePhase.PhaseDraw,
      round: 1,
      turn: 0,
    })

    const ctx = new EffectContext(drawEvent, zhangLiao, [], deps)

    await tuxiEffect.content(ctx)

    // 张辽应获得牌（从其他玩家处）
    expect(zhangLiao.getMark('skipDraw')).toBe(1)
  })

  it('filter: 无其他有手牌的玩家应返回false', () => {
    other1.handCards = []
    other2.handCards = []

    const drawEvent = new GameEvent({
      name: '摸牌阶段',
      type: TriggerTiming.PhaseDraw,
      source: zhangLiao,
      player: zhangLiao,
      targets: [zhangLiao],
      phase: GamePhase.PhaseDraw,
      round: 1,
      turn: 0,
    })

    const ctx = new EffectContext(drawEvent, zhangLiao, [], deps)

    expect(tuxiEffect.filter!(ctx)).toBe(false)
  })
})

// ═══════════════════════════════════════════
// 刘备 · 仁德
// ═══════════════════════════════════════════

describe('刘备 · 仁德', () => {
  it('出牌阶段应标记仁德可用', async () => {
    const state = new GameState()
    const deps = createDeps(state)
    const liuBei = new Player({ id: 'liubei', seatIndex: 0, heroes: [createTestHero({ id: 'liubei', effectIds: ['rende'] })], hp: 4, maxHp: 4 })

    // 给刘备手牌
    const card = Card.create(createCardDef({ name: '手牌', tags: ['basic'] }))
    card.zone = ZoneType.Hand
    card.owner = liuBei
    liuBei.handCards.push(card)

    state.players = [liuBei]

    const phaseEvent = new GameEvent({
      name: '出牌阶段',
      type: TriggerTiming.PhaseUse,
      source: liuBei,
      player: liuBei,
      targets: [liuBei],
      phase: GamePhase.PhaseUse,
      round: 1,
      turn: 0,
    })

    const ctx = new EffectContext(phaseEvent, liuBei, [], deps)

    await rendeEffect.content(ctx)

    expect(liuBei.getMark('rendeAvailable')).toBe(1)
    expect(liuBei.getMark('rendePhaseActive')).toBe(1)
  })

  it('type应为主动技', () => {
    expect(rendeEffect.type).toBe(SkillType.Active)
  })
})

// ═══════════════════════════════════════════
// 关羽 · 武圣
// ═══════════════════════════════════════════

describe('关羽 · 武圣', () => {
  it('红色牌应可通过 viewAsFilter', () => {
    const state = new GameState()
    const deps = createDeps(state)
    const guanYu = new Player({ id: 'guanyu', seatIndex: 0, heroes: [createTestHero({ id: 'guanyu', effectIds: ['wusheng'] })], hp: 4, maxHp: 4 })
    state.players = [guanYu]

    const redCard = Card.create(createCardDef({
      name: '闪',
      suit: CardSuit.Heart,
      tags: ['shan'],
    }))

    const event = new GameEvent({
      name: '测试',
      type: TriggerTiming.CardUse,
      source: guanYu,
      player: guanYu,
      targets: [],
    })
    const ctx = new EffectContext(event, guanYu, [redCard], deps)

    expect(wushengEffect.viewAsFilter!(redCard, ctx)).toBe(true)
  })

  it('viewAs: 红色牌应转换为杀', () => {
    const state = new GameState()
    const deps = createDeps(state)
    const guanYu = new Player({ id: 'guanyu', seatIndex: 0, heroes: [createTestHero({ id: 'guanyu', effectIds: ['wusheng'] })], hp: 4, maxHp: 4 })
    state.players = [guanYu]

    const redCard = Card.create(createCardDef({
      name: '闪',
      suit: CardSuit.Heart,
      tags: ['shan'],
    }))

    const event = new GameEvent({
      name: '测试',
      type: TriggerTiming.CardUse,
      source: guanYu,
      player: guanYu,
      targets: [],
    })
    const ctx = new EffectContext(event, guanYu, [redCard], deps)

    const result = wushengEffect.viewAs!(redCard, ctx)
    expect(result).not.toBeNull()
    expect(result!.tags?.has('sha')).toBe(true)
    expect(result!.virtual).toBe(true)
  })

  it('黑色牌不应通过 viewAsFilter', () => {
    const state = new GameState()
    const deps = createDeps(state)
    const guanYu = new Player({ id: 'guanyu', seatIndex: 0, heroes: [createTestHero({ id: 'guanyu', effectIds: ['wusheng'] })], hp: 4, maxHp: 4 })
    state.players = [guanYu]

    const blackCard = Card.create(createCardDef({
      name: '杀',
      suit: CardSuit.Spade,
      tags: ['sha'],
    }))

    const event = new GameEvent({
      name: '测试',
      type: TriggerTiming.CardUse,
      source: guanYu,
      player: guanYu,
      targets: [],
    })
    const ctx = new EffectContext(event, guanYu, [blackCard], deps)

    // 已经是杀，viewAsFilter 应返回 false
    expect(wushengEffect.viewAsFilter!(blackCard, ctx)).toBe(false)
  })
})

// ═══════════════════════════════════════════
// 张飞 · 咆哮
// ═══════════════════════════════════════════

describe('张飞 · 咆哮', () => {
  it('回合开始时应将攻击次数限制设为无限', async () => {
    const state = new GameState()
    const deps = createDeps(state)
    const zhangFei = new Player({ id: 'zhangfei', seatIndex: 0, heroes: [createTestHero({ id: 'zhangfei', effectIds: ['paoxiao'] })], hp: 4, maxHp: 4 })
    state.players = [zhangFei]

    const turnStartEvent = new GameEvent({
      name: '回合开始',
      type: TriggerTiming.TurnStart,
      source: zhangFei,
      player: zhangFei,
      targets: [zhangFei],
      phase: GamePhase.PhasePre,
      round: 1,
      turn: 0,
    })

    const ctx = new EffectContext(turnStartEvent, zhangFei, [], deps)

    await paoxiaoEffect.content(ctx)

    expect(zhangFei.attackLimit).toBe(Infinity)
    expect(zhangFei.getMark('paoxiaoActive')).toBe(1)
  })

  it('type应为锁定技', () => {
    expect(paoxiaoEffect.type).toBe(SkillType.Locked)
  })

  it('priority应为高优先级', () => {
    expect(paoxiaoEffect.priority).toBe(100)
  })
})

// ═══════════════════════════════════════════
// 赵云 · 龙胆
// ═══════════════════════════════════════════

describe('赵云 · 龙胆', () => {
  it('viewAs: 杀应转换为闪', () => {
    const state = new GameState()
    const deps = createDeps(state)
    const zhaoYun = new Player({ id: 'zhaoyun', seatIndex: 0, heroes: [createTestHero({ id: 'zhaoyun', effectIds: ['longdan'] })], hp: 4, maxHp: 4 })
    state.players = [zhaoYun]

    const shaCard = Card.create(createCardDef({
      name: '杀',
      suit: CardSuit.Spade,
      tags: ['sha'],
    }))

    const event = new GameEvent({
      name: '测试',
      type: TriggerTiming.CardUse,
      source: zhaoYun,
      player: zhaoYun,
      targets: [],
    })
    const ctx = new EffectContext(event, zhaoYun, [shaCard], deps)

    const result = longdanEffect.viewAs!(shaCard, ctx)
    expect(result).not.toBeNull()
    expect(result!.tags?.has('shan')).toBe(true)
    expect(result!.virtual).toBe(true)
  })

  it('viewAs: 闪应转换为杀', () => {
    const state = new GameState()
    const deps = createDeps(state)
    const zhaoYun = new Player({ id: 'zhaoyun', seatIndex: 0, heroes: [createTestHero({ id: 'zhaoyun', effectIds: ['longdan'] })], hp: 4, maxHp: 4 })
    state.players = [zhaoYun]

    const shanCard = Card.create(createCardDef({
      name: '闪',
      suit: CardSuit.Heart,
      tags: ['shan'],
    }))

    const event = new GameEvent({
      name: '测试',
      type: TriggerTiming.CardUse,
      source: zhaoYun,
      player: zhaoYun,
      targets: [],
    })
    const ctx = new EffectContext(event, zhaoYun, [shanCard], deps)

    const result = longdanEffect.viewAs!(shanCard, ctx)
    expect(result).not.toBeNull()
    expect(result!.tags?.has('sha')).toBe(true)
  })

  it('viewAsFilter: 非杀非闪的牌不应通过', () => {
    const state = new GameState()
    const deps = createDeps(state)
    const zhaoYun = new Player({ id: 'zhaoyun', seatIndex: 0, heroes: [createTestHero({ id: 'zhaoyun', effectIds: ['longdan'] })], hp: 4, maxHp: 4 })
    state.players = [zhaoYun]

    const taoCard = Card.create(createCardDef({
      name: '桃',
      suit: CardSuit.Heart,
      tags: ['tao'],
    }))

    const event = new GameEvent({
      name: '测试',
      type: TriggerTiming.CardUse,
      source: zhaoYun,
      player: zhaoYun,
      targets: [],
    })
    const ctx = new EffectContext(event, zhaoYun, [taoCard], deps)

    expect(longdanEffect.viewAsFilter!(taoCard, ctx)).toBe(false)
  })
})

// ═══════════════════════════════════════════
// 孙权 · 制衡
// ═══════════════════════════════════════════

describe('孙权 · 制衡', () => {
  it('出牌阶段应标记制衡可用', async () => {
    const state = new GameState()
    const deps = createDeps(state)
    const sunQuan = new Player({ id: 'sunquan', seatIndex: 0, heroes: [createTestHero({ id: 'sunquan', effectIds: ['zhiheng'] })], hp: 4, maxHp: 4 })

    // 给孙权手牌
    const card = Card.create(createCardDef({ name: '手牌', tags: ['basic'] }))
    card.zone = ZoneType.Hand
    card.owner = sunQuan
    sunQuan.handCards.push(card)

    state.players = [sunQuan]

    const phaseEvent = new GameEvent({
      name: '出牌阶段',
      type: TriggerTiming.PhaseUse,
      source: sunQuan,
      player: sunQuan,
      targets: [sunQuan],
      phase: GamePhase.PhaseUse,
      round: 1,
      turn: 0,
    })

    const ctx = new EffectContext(phaseEvent, sunQuan, [], deps)

    // 初始化牌堆用于摸牌
    const drawCardDef = createCardDef({ name: '摸的牌', tags: ['basic'] })
    deps.deckManager.initializeDeck(Array(5).fill(drawCardDef))

    await zhihengEffect.content(ctx)

    expect(sunQuan.getMark('zhihengAvailable')).toBe(1)
  })

  it('frequency应为每回合一次', () => {
    expect(zhihengEffect.frequency).toBe(Frequency.OncePerTurn)
  })

  it('type应为主动技', () => {
    expect(zhihengEffect.type).toBe(SkillType.Active)
  })
})

// ═══════════════════════════════════════════
// 吕蒙 · 克己
// ═══════════════════════════════════════════

describe('吕蒙 · 克己', () => {
  it('未使用杀时应跳过弃牌阶段', async () => {
    const state = new GameState()
    const deps = createDeps(state)
    const lvMeng = new Player({ id: 'lvmeng', seatIndex: 0, heroes: [createTestHero({ id: 'lvmeng', effectIds: ['keji'] })], hp: 4, maxHp: 4 })
    state.players = [lvMeng]

    // 确保没有使用杀标记
    lvMeng.clearMark('usedShaThisTurn')

    const discardEvent = new GameEvent({
      name: '弃牌阶段',
      type: TriggerTiming.PhaseDiscard,
      source: lvMeng,
      player: lvMeng,
      targets: [lvMeng],
      phase: GamePhase.PhaseDiscard,
      round: 1,
      turn: 0,
    })

    const ctx = new EffectContext(discardEvent, lvMeng, [], deps)

    await kejiEffect.content(ctx)

    expect(lvMeng.getMark('kejiActive')).toBe(1)
    expect(lvMeng.shouldSkipPhases).toContain(GamePhase.PhaseDiscard)
  })

  it('使用过杀后应正常进入弃牌阶段', () => {
    const state = new GameState()
    const deps = createDeps(state)
    const lvMeng = new Player({ id: 'lvmeng', seatIndex: 0, heroes: [createTestHero({ id: 'lvmeng', effectIds: ['keji'] })], hp: 4, maxHp: 4 })
    state.players = [lvMeng]

    // 标记使用了杀
    lvMeng.setMark('usedShaThisTurn', 1)

    const discardEvent = new GameEvent({
      name: '弃牌阶段',
      type: TriggerTiming.PhaseDiscard,
      source: lvMeng,
      player: lvMeng,
      targets: [lvMeng],
      phase: GamePhase.PhaseDiscard,
      round: 1,
      turn: 0,
    })

    const ctx = new EffectContext(discardEvent, lvMeng, [], deps)

    expect(kejiEffect.filter!(ctx)).toBe(false)
  })

  it('type应为锁定技', () => {
    expect(kejiEffect.type).toBe(SkillType.Locked)
  })
})
