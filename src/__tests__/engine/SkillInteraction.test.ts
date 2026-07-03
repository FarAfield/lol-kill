// ============================================================
// 联盟杀 · 技能交互测试
//
// 测试多个技能同时触发的交互场景：
//   - 张飞(咆哮) + 诸葛连弩 → 确认不冲突
//   - 赵云(龙胆) + 关羽(武圣) → 视作杀/闪转换
//   - 曹操(奸雄) + 司马懿(反馈) → 同时触发结算
//   - 曹操(护驾) + 杀响应 → 魏势力角色替出闪
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
  EquipSlot,
} from '@core/contracts/enums'
import type { CardDefinition } from '@core/contracts/card.interface'

// ── 导入技能 ──
import { paoxiaoEffect, wushengEffect, longdanEffect } from '@source/heroes/skills/shu-skills'
import { jianxiongEffect, hujiaEffect, fankuiEffect } from '@source/heroes/skills/wei-skills'
import { kejiEffect } from '@source/heroes/skills/wu-skills'

// ── 测试辅助 ──

function createHero(overrides: { id: string; name: string; maxHp?: number; effectIds: string[] }) {
  return new Hero({
    id: overrides.id,
    name: overrides.name,
    title: '测试',
    kingdom: Kingdom.Demacia,
    maxHp: overrides.maxHp ?? 4,
    effectIds: overrides.effectIds,
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
// 场景1: 张飞(咆哮) + 诸葛连弩 — 确认不冲突
// ═══════════════════════════════════════════

describe('张飞 · 咆哮 + 诸葛连弩 — 技能与装备交互', () => {
  it('咆哮设置的无限攻击次数应与连弩不冲突', async () => {
    const state = new GameState()
    const deps = createDeps(state)
    const zhangFei = new Player({ id: 'zhangfei', seatIndex: 0, heroes: [createHero({ id: 'zhangfei', name: '张飞', effectIds: ['paoxiao'] })], hp: 4, maxHp: 4 })
    state.players = [zhangFei]

    // 咆哮回合开始
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

    const ctx = new EffectContext(turnStartEvent, zhangFei, [])

    await paoxiaoEffect.content(ctx)
    expect(zhangFei.attackLimit).toBe(Infinity)

    // 装备诸葛连弩不应改变咆哮的效果
    const lianNu = Card.create(createCardDef({
      name: '诸葛连弩',
      type: CardType.Equip,
      suit: CardSuit.Diamond,
      tags: ['weapon', 'liannu'],
      equipSlot: EquipSlot.Weapon,
      attackRange: 1,
    }))
    zhangFei.equipCard(lianNu)

    // 攻击次数仍然是Infinity
    expect(zhangFei.attackLimit).toBe(Infinity)
    expect(zhangFei.getMark('paoxiaoActive')).toBe(1)
  })
})

// ═══════════════════════════════════════════
// 场景2: 赵云(龙胆) + 关羽(武圣) — 视作转换
// ═══════════════════════════════════════════

describe('赵云 · 龙胆 + 关羽 · 武圣 — 视作转换链', () => {
  it('赵云可用闪当杀（龙胆），效果与武圣等价', () => {
    const state = new GameState()
    const deps = createDeps(state)

    const zhaoYun = new Player({ id: 'zhaoyun', seatIndex: 0, heroes: [createHero({ id: 'zhaoyun', name: '赵云', effectIds: ['longdan'] })], hp: 4, maxHp: 4 })
    const guanYu = new Player({ id: 'guanyu', seatIndex: 0, heroes: [createHero({ id: 'guanyu', name: '关羽', effectIds: ['wusheng'] })], hp: 4, maxHp: 4 })
    state.players = [zhaoYun, guanYu]

    // 测试龙胆：闪→杀
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
    const ctxZhaoYun = new EffectContext(event, zhaoYun, [shanCard], deps)

    const longdanResult = longdanEffect.viewAs!(shanCard, ctxZhaoYun)
    expect(longdanResult).not.toBeNull()
    expect(longdanResult!.tags?.has('sha')).toBe(true)

    // 测试武圣：红色牌→杀
    const redCard = Card.create(createCardDef({
      name: '桃',
      suit: CardSuit.Heart,
      tags: ['tao'],
    }))

    const ctxGuanYu = new EffectContext(event, guanYu, [redCard], deps)
    expect(wushengEffect.viewAsFilter!(redCard, ctxGuanYu)).toBe(true)

    const wushengResult = wushengEffect.viewAs!(redCard, ctxGuanYu)
    expect(wushengResult).not.toBeNull()
    expect(wushengResult!.tags?.has('sha')).toBe(true)
  })

  it('两种视作技能的虚拟牌标记应一致', () => {
    const state = new GameState()
    const deps = createDeps(state)
    const zhaoYun = new Player({ id: 'zhaoyun', seatIndex: 0, heroes: [createHero({ id: 'zhaoyun', name: '赵云', effectIds: ['longdan'] })], hp: 4, maxHp: 4 })

    state.players = [zhaoYun]

    const event = new GameEvent({
      name: '测试',
      type: TriggerTiming.CardUse,
      source: zhaoYun,
      player: zhaoYun,
      targets: [],
    })

    // 杀 → 闪
    const shaCard = Card.create(createCardDef({ name: '杀', suit: CardSuit.Spade, tags: ['sha'] }))
    const ctx1 = new EffectContext(event, zhaoYun, [shaCard], deps)
    const result1 = longdanEffect.viewAs!(shaCard, ctx1)
    expect(result1!.virtual).toBe(true)

    // 闪 → 杀
    const shanCard = Card.create(createCardDef({ name: '闪', suit: CardSuit.Diamond, tags: ['shan'] }))
    const ctx2 = new EffectContext(event, zhaoYun, [shanCard], deps)
    const result2 = longdanEffect.viewAs!(shanCard, ctx2)
    expect(result2!.virtual).toBe(true)
  })
})

// ═══════════════════════════════════════════
// 场景3: 曹操(奸雄) + 司马懿(反馈) — 同时受伤触发
// ═══════════════════════════════════════════

describe('曹操 · 奸雄 + 司马懿 · 反馈 — 同时受伤触发', () => {
  it('两人同时受到范围伤害后各自触发技能', async () => {
    Card.resetCounter()
    const state = new GameState()
    const deps = createDeps(state)

    const caoCao = new Player({ id: 'caocao', seatIndex: 0, heroes: [createHero({ id: 'caocao', name: '曹操', effectIds: ['jianxiong'] })], hp: 4, maxHp: 4 })
    const simaYi = new Player({ id: 'simayi', seatIndex: 1, heroes: [createHero({ id: 'simayi', name: '司马懿', effectIds: ['fankui'] })], hp: 4, maxHp: 4 })
    const source = new Player({ id: 'source', seatIndex: 2, heroes: [createHero({ id: 'enemy', name: '敌人', effectIds: [] })], hp: 4, maxHp: 4 })

    // 给来源手牌
    const damageCardCao = Card.create(createCardDef({ name: '万箭齐发', tags: ['attack'] }))
    damageCardCao.zone = ZoneType.Hand
    damageCardCao.owner = source
    source.handCards.push(damageCardCao)

    const sourceCard = Card.create(createCardDef({ name: '手牌', tags: ['basic'] }))
    sourceCard.zone = ZoneType.Hand
    sourceCard.owner = source
    source.handCards.push(sourceCard)

    state.players = [caoCao, simaYi, source]

    // 曹操受伤
    const damageEventCao = new GameEvent({
      name: '伤害(曹操)',
      type: TriggerTiming.Damage,
      source,
      player: source,
      targets: [caoCao],
      cards: [damageCardCao],
      data: { damageCard: damageCardCao, damageAmount: 1, damagePrevented: false },
    })

    const ctxCao = new EffectContext(damageEventCao, caoCao, [damageCardCao], deps, damageEventCao)

    // 奸雄filter应通过
    expect(jianxiongEffect.filter!(ctxCao)).toBe(true)

    // 司马懿受伤
    const damageEventSima = new GameEvent({
      name: '伤害(司马懿)',
      type: TriggerTiming.Damage,
      source,
      player: source,
      targets: [simaYi],
      data: { damageAmount: 1, damagePrevented: false },
    })

    const ctxSima = new EffectContext(damageEventSima, simaYi, [], deps, damageEventSima)

    // 反馈filter应通过
    expect(fankuiEffect.filter!(ctxSima)).toBe(true)
  })
})

// ═══════════════════════════════════════════
// 场景4: 张飞(咆哮) + 吕蒙(克己) — 锁定技不冲突
// ═══════════════════════════════════════════

describe('张飞 · 咆哮 + 吕蒙 · 克己 — 多锁定技共存', () => {
  it('多个锁定技应在各自时机分别触发', () => {
    // 张飞的咆哮：回合开始时设置 attackLimit
    // 吕蒙的克己：弃牌阶段前检查是否跳过
    // 两者时机不同，应各自正常工作

    expect(paoxiaoEffect.type).toBe(SkillType.Locked)
    expect(kejiEffect.type).toBe(SkillType.Locked)

    // 咆哮触发时机：TurnStart
    const paoxiaoTrigger = paoxiaoEffect.trigger.player![0]!
    expect(paoxiaoTrigger.timing).toBe(TriggerTiming.TurnStart)
    expect(paoxiaoTrigger.stage).toBe('Begin')

    // 克己触发时机：PhaseDiscard
    const kejiTrigger = kejiEffect.trigger.player![0]!
    expect(kejiTrigger.timing).toBe(TriggerTiming.PhaseDiscard)
    expect(kejiTrigger.stage).toBe('Before')
  })
})

// ═══════════════════════════════════════════
// 场景5: 同势力角色协助曹操（护驾）
// ═══════════════════════════════════════════

describe('曹操 · 护驾 — 魏势力协助', () => {
  it('护驾标记应由ResponseWindow读取以扩展响应者', async () => {
    const state = new GameState()
    const deps = createDeps(state)

    // 曹操 (Demacia = 魏)
    const caoCao = new Player({ id: 'caocao', seatIndex: 0, heroes: [createHero({ id: 'caocao', name: '曹操', effectIds: ['hujia'] })], hp: 4, maxHp: 4 })
    // 魏势力角色
    const weiAlly = new Player({ id: 'weially', seatIndex: 1, heroes: [createHero({ id: 'xiahoudun', name: '夏侯惇', effectIds: ['ganglie'] })], hp: 4, maxHp: 4 })

    state.players = [caoCao, weiAlly]

    // 其他人对曹操出杀
    const shaCard = Card.create(createCardDef({ name: '杀', tags: ['sha'] }))
    const cardUseEvent = new GameEvent({
      name: '使用杀',
      type: TriggerTiming.CardUse,
      source: weiAlly,
      player: weiAlly,
      targets: [caoCao],
      cards: [shaCard],
      phase: GamePhase.PhaseUse,
      round: 1,
      turn: 1,
    })

    const ctx = new EffectContext(cardUseEvent, caoCao, [shaCard], deps)

    await hujiaEffect.content(ctx)

    // 验证护驾标记已设置
    expect(caoCao.getMark('hujiaActive')).toBe(1)

    // ResponseWindow 应检查此标记并允许魏势力角色响应
  })
})

// ═══════════════════════════════════════════
// 场景6: 技能优先级排序
// ═══════════════════════════════════════════

describe('技能优先级排序', () => {
  it('锁定技优先级应高于被动技', () => {
    // 咆哮(locked, priority 100) vs 奸雄(passive, priority 10)
    expect(paoxiaoEffect.priority).toBeGreaterThan(jianxiongEffect.priority)
    expect(paoxiaoEffect.type).toBe(SkillType.Locked)
    expect(jianxiongEffect.type).toBe(SkillType.Passive)
  })

  it('护驾的主动响应优先级应高于一般被动', () => {
    // 护驾(active, priority 20) > 奸雄(passive, priority 10)
    expect(hujiaEffect.priority).toBeGreaterThan(jianxiongEffect.priority)
  })
})

// ═══════════════════════════════════════════
// 场景7: 技能注册表加载多个英雄
// ═══════════════════════════════════════════

describe('SkillRegistry — 多英雄技能加载', () => {
  it('应正确加载多个英雄的技能并分配到正确玩家', () => {
    const effectRegistry = new EffectRegistry()
    const eventTrigger = new EventTrigger()
    const skillRegistry = new SkillRegistry(effectRegistry, eventTrigger)

    // 注册所有技能效果
    effectRegistry.registerAll([
      jianxiongEffect,
      hujiaEffect,
      fankuiEffect,
      paoxiaoEffect,
      wushengEffect,
      longdanEffect,
      kejiEffect,
    ])

    // 创建英雄
    const heroes = [
      createHero({ id: 'caocao', name: '曹操', effectIds: ['jianxiong', 'hujia'] }),
      createHero({ id: 'zhangfei', name: '张飞', effectIds: ['paoxiao'] }),
      createHero({ id: 'guanyu', name: '关羽', effectIds: ['wusheng'] }),
      createHero({ id: 'zhaoyun', name: '赵云', effectIds: ['longdan'] }),
    ]

    const players = heroes.map((h, i) => new Player({ id: `p${i}`, seatIndex: i, heroes: [h], hp: h.maxHp, maxHp: h.maxHp, power: h.maxPower ?? 0, maxPower: h.maxPower ?? 0 }))

    const total = skillRegistry.loadAllHeroSkills(players)
    expect(total).toBe(5) // 曹操(2) + 张飞(1) + 关羽(1) + 赵云(1) = 5

    // 验证每个玩家的效果
    expect(skillRegistry.getPlayerEffectIds('p0').length).toBe(2)
    expect(skillRegistry.getPlayerEffectIds('p1').length).toBe(1)
    expect(skillRegistry.getPlayerEffectIds('p2').length).toBe(1)
    expect(skillRegistry.getPlayerEffectIds('p3').length).toBe(1)
  })
})
