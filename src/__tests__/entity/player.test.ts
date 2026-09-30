// ============================================================
// Player 实体 —— 只测它**剩下**的东西：数据与派生只读量
//
// Phase 19 之前这里还测着 17 个变更方法（`loseHp` / `equipCard` /
// `setMark` …）。它们已经迁走：
//   数值与标记 → `PlayerSystem`（见 `__tests__/system/player-system.test.ts`）
//   卡牌区域   → `CardSystem`（见 `__tests__/system/card-system.test.ts`）
//
// 本文件保留的意义是钉住一条边界：**实体没有变更方法**。
// 最后那条「IPlayer 上没有写入口」的用例就是这条边界的哨兵——
// 谁再往实体上加一个 `setXxx`，它会立刻红。
// ============================================================

import { describe, expect, it } from 'vitest'
import { Player } from '@core/entity/player'
import { Hero } from '@core/entity/hero'
import { Card } from '@core/entity/card'
import { CardTag } from '@core/contracts/card-tag'
import { PlayerSystem } from '@core/system/player-system'
import { CardSystem } from '@core/system/card-system'
import {
  CardRank,
  CardSuit,
  CardType,
  EquipSlot,
  Kingdom,
  ZoneType,
} from '@core/contracts/enums'
import type { EquipSlot as EquipSlotType } from '@core/contracts/enums'

const system = new PlayerSystem()

function makeHero(maxHp: number, maxPower = 0): Hero {
  return new Hero({
    id: 'hero_test',
    name: '测试武将',
    title: '测试',
    kingdom: Kingdom.Demacia,
    maxHp,
    maxPower,
    effectIds: ['skill_test'],
  })
}

function makeEquip(id: string, slot: EquipSlotType, attackRange?: number): Card {
  return Card.create({
    id,
    name: id,
    type: CardType.Equip,
    suit: CardSuit.None,
    rank: CardRank.A,
    description: '',
    tags: [CardTag.Equip],
    effectIds: [],
    equipSlot: slot,
    attackRange,
    isDelayed: false,
    canBeCanceled: false,
  })
}

describe('Player', () => {
  it('默认构造：存活、体力为 0、标记为空', () => {
    const p = new Player({ id: 'p0', seatIndex: 0 })
    expect(p.alive).toBe(true)
    expect(p.hp).toBe(0)
    expect(p.maxHp).toBe(0)
    expect(p.getMark('anything')).toBe(0)
    expect(p.handSize).toBe(0)
  })

  it('batchCreate 生成连续座位与递增 ID', () => {
    const players = Player.batchCreate(3)
    expect(players.map((p) => p.seatIndex)).toEqual([0, 1, 2])
    expect(players.map((p) => p.id)).toEqual(['player_0', 'player_1', 'player_2'])
  })

  describe('派生状态（只读）', () => {
    it('isWounded / isDying 按体力判定', () => {
      const p = new Player({ id: 'p0', seatIndex: 0, hp: 4, maxHp: 4 })
      expect(p.isWounded).toBe(false)
      expect(p.isDying).toBe(false)

      system.loseHp(p, 2)
      expect(p.isWounded).toBe(true)
      expect(p.isDying).toBe(false)

      system.loseHp(p, 2)
      expect(p.isDying).toBe(true)

      system.setAlive(p, false)
      expect(p.isDying).toBe(false)
    })

    it('attackRange 为基础 1 加武器加成', () => {
      const p = new Player({ id: 'p0', seatIndex: 0 })
      expect(p.attackRange).toBe(1)
      // 装备区写入归 CardSystem；这里只关心派生量怎么读它
      p.equipCards.push(makeEquip('weapon', EquipSlot.Weapon, 3))
      expect(p.attackRange).toBe(4)
    })

    it('markAttackUsed 只写账本，不再回答「能不能」（D8 形态甲）', () => {
      const p = new Player({ id: 'p0', seatIndex: 0 })
      // 「本回合还能不能出杀」已从实体上摘掉：它要查 Mod 注册表，
      // 而 Player 是纯数据持有者。判定口是 `CardBudget.canPlay`。
      expect(p.usedAttackThisTurn).toBe(false)
      system.markAttackUsed(p)
      expect(p.usedAttackThisTurn).toBe(true)
      system.resetTurnState(p)
      expect(p.usedAttackThisTurn).toBe(false)
    })

    it('hero 取 heroes[0]，为空时返回 undefined', () => {
      const p = new Player({ id: 'p0', seatIndex: 0 })
      expect(p.hero).toBeUndefined()
      system.chooseHeroes(p, [makeHero(4)])
      expect(p.hero?.id).toBe('hero_test')
    })

    it('chooseHeroes 同步体力与能量', () => {
      const p = new Player({ id: 'p0', seatIndex: 0 })
      system.chooseHeroes(p, [makeHero(3, 2)])
      expect(p.maxHp).toBe(3)
      expect(p.hp).toBe(3)
      expect(p.maxPower).toBe(2)
      expect(p.power).toBe(2)
    })
  })

  describe('标记（只留读）', () => {
    it('getMark 读不到时返回 0；写入走 PlayerSystem', () => {
      const p = new Player({ id: 'p0', seatIndex: 0 })
      expect(p.getMark('rage')).toBe(0)
      system.setMark(p, 'rage', 3)
      expect(p.getMark('rage')).toBe(3)
      system.clearMark(p, 'rage')
      expect(p.getMark('rage')).toBe(0)
    })
  })

  describe('序列化', () => {
    it('toJSON 将 marks 转为普通对象，可被 JSON.stringify', () => {
      const p = new Player({ id: 'p0', seatIndex: 0, hp: 2, maxHp: 4 })
      system.setMark(p, 'rage', 2)

      const snapshot = p.toJSON()
      expect(snapshot.marks).toEqual({ rage: 2 })
      expect(snapshot.marks).not.toBeInstanceOf(Map)
      expect(() => JSON.stringify(snapshot)).not.toThrow()
      expect(snapshot.hp).toBe(2)
    })
  })

  // ── Phase 19 的边界哨兵 ──

  it('实体上没有任何变更方法——写入一律走 system/*', () => {
    const p = new Player({ id: 'p0', seatIndex: 0 })

    // 曾经挂在 Player 上的那一批，一个都不该还在
    for (const name of [
      'loseHp',
      'recoverHp',
      'modifyMaxHp',
      'consumePower',
      'gainPower',
      'modifyMaxPower',
      'addHandCards',
      'removeHandCards',
      'chooseHeroes',
      'equipCard',
      'unEquipSlot',
      'addJudgeCard',
      'removeJudgeCard',
      'setMark',
      'addMark',
      'clearMark',
      'resetTurnState',
      'markAttackUsed',
    ]) {
      expect((p as unknown as Record<string, unknown>)[name]).toBeUndefined()
    }
  })
})

// `Card.moveTo` 这类「改区域」的方法已从实体上删掉（Phase 19），
// 区域流转现在只有 `CardSystem` 一条路——下面这条走的就是它。
describe('Card 区域流转（走 CardSystem）', () => {
  it('进手牌 → 仅本人可见；进弃牌堆 → 谁都看不见', () => {
    const p = new Player({ id: 'p0', seatIndex: 0 })
    const other = new Player({ id: 'p1', seatIndex: 1 })
    const state = { deck: [], discardPile: [], processingCards: [], players: [p, other] } as never
    const cardSystem = new CardSystem(state)

    const card = makeEquip('w1', EquipSlot.Weapon, 1)
    cardSystem.obtainCard(card, p)
    expect(card.zone).toBe(ZoneType.Hand)
    expect(card.isVisibleTo(p)).toBe(true)
    expect(card.isVisibleTo(other)).toBe(false)

    cardSystem.discardCard(card, p)
    expect(card.zone).toBe(ZoneType.Discard)
    expect(card.visibleTo).toHaveLength(0)
  })
})
