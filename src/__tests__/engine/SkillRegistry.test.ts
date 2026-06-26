// ============================================================
// 联盟杀 · SkillRegistry 单元测试
//
// 测试技能注册、加载英雄技能、启用/禁用效果。
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { SkillRegistry } from '@core/engine/skill-registry'
import { EffectRegistry } from '@core/engine/effect-registry'
import { EventTrigger } from '@core/event/event-trigger'
import { Player } from '@core/entity/player'
import { Hero } from '@core/entity/hero'
import {
  SkillType,
  TriggerTiming,
  Frequency,
  Kingdom,
} from '@core/contracts/enums'
import type { IEffect } from '@core/contracts/effect.interface'

// ── 测试辅助 ──

function createTestHero(effectIds: string[] = []) {
  return new Hero({
    id: 'test-hero',
    name: '测试英雄',
    title: '测试',
    kingdom: Kingdom.Demacia,
    maxHp: 4,
    effectIds,
  })
}

function createTestEffect(id: string, overrides?: Partial<IEffect>): IEffect {
  return {
    id,
    name: `效果_${id}`,
    description: '测试效果',
    type: overrides?.type ?? SkillType.Passive,
    priority: overrides?.priority ?? 10,
    frequency: overrides?.frequency ?? Frequency.Unlimited,
    trigger: overrides?.trigger ?? {
      source: [{ timing: TriggerTiming.TurnStart, stage: 'Begin' }],
    },
    filter: overrides?.filter,
    content: overrides?.content ?? (async () => {}),
    enabled: overrides?.enabled ?? true,
    usedThisTurn: false,
    usedThisRound: false,
  }
}

describe('SkillRegistry', () => {
  let effectRegistry: EffectRegistry
  let eventTrigger: EventTrigger
  let skillRegistry: SkillRegistry

  beforeEach(() => {
    effectRegistry = new EffectRegistry()
    eventTrigger = new EventTrigger()
    skillRegistry = new SkillRegistry(effectRegistry, eventTrigger)
  })

  // ── 效果注册 ──

  describe('registerPlayerEffects', () => {
    it('应为玩家注册单个效果', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const effect = createTestEffect('e1')
      effectRegistry.register(effect)

      const count = skillRegistry.registerPlayerEffects(player, [effect])

      expect(count).toBe(1)
      expect(skillRegistry.hasEffect('p1', 'e1')).toBe(true)
      expect(eventTrigger.count).toBeGreaterThan(0)
    })

    it('应为玩家批量注册多个效果', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const effects = [
        createTestEffect('e1'),
        createTestEffect('e2'),
        createTestEffect('e3'),
      ]
      effectRegistry.registerAll(effects)

      const count = skillRegistry.registerPlayerEffects(player, effects)

      expect(count).toBe(3)
      expect(skillRegistry.hasEffect('p1', 'e1')).toBe(true)
      expect(skillRegistry.hasEffect('p1', 'e2')).toBe(true)
      expect(skillRegistry.hasEffect('p1', 'e3')).toBe(true)
    })

    it('不应重复注册相同的效果', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const effect = createTestEffect('e1')
      effectRegistry.register(effect)

      skillRegistry.registerPlayerEffects(player, [effect])
      const count = skillRegistry.registerPlayerEffects(player, [effect])

      expect(count).toBe(0) // 第二次注册应跳过
      expect(skillRegistry.hasEffect('p1', 'e1')).toBe(true)
    })

    it('应为不同玩家注册相同的效果', () => {
      const p1 = new Player({ id: 'p1', seatIndex: 0 })
      const p2 = new Player({ id: 'p2', seatIndex: 1 })
      const effect = createTestEffect('e1')
      effectRegistry.register(effect)

      skillRegistry.registerPlayerEffects(p1, [effect])
      skillRegistry.registerPlayerEffects(p2, [effect])

      expect(skillRegistry.hasEffect('p1', 'e1')).toBe(true)
      expect(skillRegistry.hasEffect('p2', 'e1')).toBe(true)
      expect(skillRegistry.registeredCount).toBe(2)
    })
  })

  // ── 英雄技能加载 ──

  describe('loadHeroSkills', () => {
    it('应从英雄定义加载技能并注册', () => {
      const effect1 = createTestEffect('jianxiong')
      const effect2 = createTestEffect('hujia')
      effectRegistry.registerAll([effect1, effect2])

      const player = new Player({ id: 'p1', seatIndex: 0 })
      const hero = createTestHero(['jianxiong', 'hujia'])

      const count = skillRegistry.loadHeroSkills(player, hero)

      expect(count).toBe(2)
      expect(skillRegistry.hasEffect('p1', 'jianxiong')).toBe(true)
      expect(skillRegistry.hasEffect('p1', 'hujia')).toBe(true)
    })

    it('应跳过未在EffectRegistry中注册的效果ID', () => {
      const effect1 = createTestEffect('e1')
      effectRegistry.register(effect1)

      const player = new Player({ id: 'p1', seatIndex: 0 })
      const hero = createTestHero(['e1', 'not_registered'])

      const count = skillRegistry.loadHeroSkills(player, hero)

      expect(count).toBe(1) // 仅注册存在的效果
      expect(skillRegistry.hasEffect('p1', 'e1')).toBe(true)
    })

    it('英雄无效果时返回0', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const hero = createTestHero([])

      const count = skillRegistry.loadHeroSkills(player, hero)

      expect(count).toBe(0)
    })
  })

  // ── 批量加载 ──

  describe('loadAllHeroSkills', () => {
    it('应为所有玩家的英雄加载技能', () => {
      const e1 = createTestEffect('e1')
      const e2 = createTestEffect('e2')
      const e3 = createTestEffect('e3')
      effectRegistry.registerAll([e1, e2, e3])

      const p1 = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero(['e1', 'e2'])], hp: 4, maxHp: 4 })
      const p2 = new Player({ id: 'p2', seatIndex: 1, heroes: [createTestHero(['e3'])], hp: 4, maxHp: 4 })

      const total = skillRegistry.loadAllHeroSkills([p1, p2])

      expect(total).toBe(3)
      expect(skillRegistry.hasEffect('p1', 'e1')).toBe(true)
      expect(skillRegistry.hasEffect('p1', 'e2')).toBe(true)
      expect(skillRegistry.hasEffect('p2', 'e3')).toBe(true)
    })

    it('应跳过已死亡玩家', () => {
      const e1 = createTestEffect('e1')
      effectRegistry.register(e1)

      const p1 = new Player({ id: 'p1', seatIndex: 0, heroes: [createTestHero(['e1'])], hp: 4, maxHp: 4 })
      const p2 = new Player({ id: 'p2', seatIndex: 1, heroes: [createTestHero(['e1'])], hp: 4, maxHp: 4 })
      p2.alive = false

      const total = skillRegistry.loadAllHeroSkills([p1, p2])

      expect(total).toBe(1) // 仅 p1
    })
  })

  // ── 注销 ──

  describe('unregisterPlayer', () => {
    it('应注销玩家的所有效果', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const e1 = createTestEffect('e1')
      const e2 = createTestEffect('e2')
      effectRegistry.registerAll([e1, e2])
      skillRegistry.registerPlayerEffects(player, [e1, e2])

      expect(skillRegistry.registeredCount).toBe(2)

      skillRegistry.unregisterPlayer(player)

      expect(skillRegistry.registeredCount).toBe(0)
      expect(skillRegistry.hasEffect('p1', 'e1')).toBe(false)
      expect(skillRegistry.hasEffect('p1', 'e2')).toBe(false)
    })
  })

  describe('unregisterEffect', () => {
    it('应注销玩家的单个效果', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const e1 = createTestEffect('e1')
      const e2 = createTestEffect('e2')
      effectRegistry.registerAll([e1, e2])
      skillRegistry.registerPlayerEffects(player, [e1, e2])

      skillRegistry.unregisterEffect(player, 'e1')

      expect(skillRegistry.hasEffect('p1', 'e1')).toBe(false)
      expect(skillRegistry.hasEffect('p1', 'e2')).toBe(true)
      expect(skillRegistry.registeredCount).toBe(1)
    })
  })

  // ── 觉醒技启停 ──

  describe('enableEffect / disableEffect', () => {
    it('应启用觉醒技', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const awakenEffect = createTestEffect('awaken_skill', {
        type: SkillType.Awaken,
        enabled: false,
      })
      effectRegistry.register(awakenEffect)
      skillRegistry.registerPlayerEffects(player, [awakenEffect])

      const result = skillRegistry.enableEffect(player, 'awaken_skill')

      expect(result).toBe(true)
      expect(awakenEffect.enabled).toBe(true)
    })

    it('启用未注册的效果应失败', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const result = skillRegistry.enableEffect(player, 'not_registered')

      expect(result).toBe(false)
    })

    it('应禁用效果', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const effect = createTestEffect('e1', { enabled: true })
      effectRegistry.register(effect)
      skillRegistry.registerPlayerEffects(player, [effect])

      const result = skillRegistry.disableEffect(player, 'e1')

      expect(result).toBe(true)
      expect(effect.enabled).toBe(false)
    })
  })

  // ── 查询 ──

  describe('getPlayerEffectIds / getPlayerEffects', () => {
    it('应返回玩家已注册的效果ID列表', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const e1 = createTestEffect('e1')
      const e2 = createTestEffect('e2')
      effectRegistry.registerAll([e1, e2])
      skillRegistry.registerPlayerEffects(player, [e1, e2])

      const ids = skillRegistry.getPlayerEffectIds('p1')
      expect(ids).toContain('e1')
      expect(ids).toContain('e2')
    })

    it('应返回玩家已注册的效果实例', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const e1 = createTestEffect('e1')
      effectRegistry.register(e1)
      skillRegistry.registerPlayerEffects(player, [e1])

      const effects = skillRegistry.getPlayerEffects('p1')
      expect(effects).toHaveLength(1)
      expect(effects[0]!.id).toBe('e1')
    })
  })

  // ── 清空 ──

  describe('clear', () => {
    it('应清空所有注册', () => {
      const player = new Player({ id: 'p1', seatIndex: 0 })
      const effect = createTestEffect('e1')
      effectRegistry.register(effect)
      skillRegistry.registerPlayerEffects(player, [effect])

      skillRegistry.clear()

      expect(skillRegistry.registeredCount).toBe(0)
      expect(eventTrigger.count).toBe(0)
    })
  })
})
