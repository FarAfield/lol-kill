// ============================================================
// Hero 实体 单元测试
// ============================================================

import { describe, it, expect } from 'vitest'
import { Hero } from '@core/entity/hero'
import { Kingdom } from '@core/contracts/enums'

// ── 测试套件 ──

describe('Hero', () => {
  // ================================================================
  // 创建
  // ================================================================

  describe('create', () => {
    it('should create a Hero with all properties', () => {
      const hero = Hero.create({
        id: 'caocao',
        name: '曹操',
        title: '魏武帝',
        kingdom: Kingdom.Demacia,
        maxHp: 4,
        effectIds: ['jianxiong', 'hujia'],
      })

      expect(hero).toBeInstanceOf(Hero)
      expect(hero.id).toBe('caocao')
      expect(hero.name).toBe('曹操')
      expect(hero.title).toBe('魏武帝')
      expect(hero.kingdom).toBe(Kingdom.Demacia)
      expect(hero.maxHp).toBe(4)
      expect(hero.effectIds).toEqual(['jianxiong', 'hujia'])
    })

    it('should default maxPower to 0', () => {
      const hero = Hero.create({
        id: 'liubei',
        name: '刘备',
        title: '蜀汉先主',
        kingdom: Kingdom.Noxus,
        maxHp: 4,
      })

      expect(hero.maxPower).toBe(0)
    })

    it('should accept custom maxPower', () => {
      const hero = Hero.create({
        id: 'test',
        name: '测试',
        title: '测试',
        kingdom: Kingdom.Ionia,
        maxHp: 3,
        maxPower: 2,
      })

      expect(hero.maxPower).toBe(2)
    })

    it('should default effectIds to empty array', () => {
      const hero = Hero.create({
        id: 'test',
        name: '测试',
        title: '测试',
        kingdom: Kingdom.Demacia,
        maxHp: 4,
      })

      expect(hero.effectIds).toEqual([])
    })

    it('should create via constructor directly', () => {
      const hero = new Hero({
        id: 'test',
        name: '测试',
        title: '测试',
        kingdom: Kingdom.Ionia,
        maxHp: 3,
      })

      expect(hero).toBeInstanceOf(Hero)
      expect(hero.maxHp).toBe(3)
    })
  })

  // ================================================================
  // 查询
  // ================================================================

  describe('hasEffect', () => {
    it('should return true for registered effect', () => {
      const hero = Hero.create({
        id: 'caocao',
        name: '曹操',
        title: '魏武帝',
        kingdom: Kingdom.Demacia,
        maxHp: 4,
        effectIds: ['jianxiong', 'hujia'],
      })

      expect(hero.hasEffect('jianxiong')).toBe(true)
      expect(hero.hasEffect('hujia')).toBe(true)
    })

    it('should return false for unregistered effect', () => {
      const hero = Hero.create({
        id: 'caocao',
        name: '曹操',
        title: '魏武帝',
        kingdom: Kingdom.Demacia,
        maxHp: 4,
        effectIds: ['jianxiong'],
      })

      expect(hero.hasEffect('wusheng')).toBe(false)
    })

    it('should return false when effectIds is empty', () => {
      const hero = Hero.create({
        id: 'test',
        name: '测试',
        title: '测试',
        kingdom: Kingdom.Ionia,
        maxHp: 4,
      })

      expect(hero.hasEffect('anything')).toBe(false)
    })
  })

  describe('isKingdom', () => {
    it('should return true for matching kingdom', () => {
      const hero = Hero.create({
        id: 'caocao',
        name: '曹操',
        title: '魏武帝',
        kingdom: Kingdom.Demacia,
        maxHp: 4,
      })

      expect(hero.isKingdom(Kingdom.Demacia)).toBe(true)
    })

    it('should return false for non-matching kingdom', () => {
      const hero = Hero.create({
        id: 'caocao',
        name: '曹操',
        title: '魏武帝',
        kingdom: Kingdom.Demacia,
        maxHp: 4,
      })

      expect(hero.isKingdom(Kingdom.Noxus)).toBe(false)
      expect(hero.isKingdom(Kingdom.Ionia)).toBe(false)
    })
  })

  // ================================================================
  // 不可变性
  // ================================================================

  describe('immutability', () => {
    it('should have readonly properties', () => {
      const hero = Hero.create({
        id: 'caocao',
        name: '曹操',
        title: '魏武帝',
        kingdom: Kingdom.Demacia,
        maxHp: 4,
      })

      expect(hero.id).toBe('caocao')
      expect(hero.name).toBe('曹操')
      // readonly properties cannot be reassigned at compile time
    })
  })

  // ================================================================
  // 序列化
  // ================================================================

  describe('toJSON', () => {
    it('should serialize all properties', () => {
      const hero = Hero.create({
        id: 'caocao',
        name: '曹操',
        title: '魏武帝',
        kingdom: Kingdom.Demacia,
        maxHp: 4,
        effectIds: ['jianxiong', 'hujia'],
      })

      const json = hero.toJSON()

      expect(json.id).toBe('caocao')
      expect(json.name).toBe('曹操')
      expect(json.title).toBe('魏武帝')
      expect(json.kingdom).toBe(Kingdom.Demacia)
      expect(json.maxHp).toBe(4)
      expect(json.maxPower).toBe(0)
      expect(json.effectIds).toEqual(['jianxiong', 'hujia'])
    })

    it('should return a defensive copy of effectIds', () => {
      const hero = Hero.create({
        id: 'test',
        name: '测试',
        title: '测试',
        kingdom: Kingdom.Ionia,
        maxHp: 4,
        effectIds: ['eff1'],
      })

      const json = hero.toJSON()
      json.effectIds.push('eff2')

      // Original should be unchanged
      expect(hero.effectIds).toEqual(['eff1'])
    })
  })
})
