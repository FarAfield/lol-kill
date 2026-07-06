// ============================================================
// 联盟杀 · EventCompiler 单元测试
//
// 测试 compile(effect, player) 编译方法。
// ============================================================

import { describe, it, expect } from 'vitest'
import { EventCompiler } from '@core/event/event-compiler'
import { Player } from '@core/entity/player'
import {
  SkillType,
  TriggerTiming,
  Frequency,
} from '@core/contracts/enums'
import type { IEffect } from '@core/contracts/effect.interface'

function createPlayer(id: string): Player {
  return new Player({ id, seatIndex: 0 })
}

function createEffect(id: string, overrides?: Partial<IEffect>): IEffect {
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
    content: overrides?.content ?? (async () => {}),
    filter: overrides?.filter,
    isAvailable: overrides?.isAvailable,
  }
}

describe('EventCompiler.compile(effect, player)', () => {
  const compiler = new EventCompiler()
  const player = createPlayer('p1')

  it('应为 source trigger 产出 1 个 handler', () => {
    const effect = createEffect('e1', {
      trigger: { source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }] },
    })

    const handlers = compiler.compile(effect, player)
    expect(handlers).toHaveLength(1)
    expect(handlers[0]?.timing).toBe(TriggerTiming.CardUse)
    expect(handlers[0]?.stage).toBe('Content')
    expect(handlers[0]?.scope).toBe('source')
    expect(handlers[0]?.skillId).toBe('e1')
    expect(handlers[0]?.playerId).toBe('p1')
  })

  it('应为四种 scope 各产出 1 个 handler', () => {
    const effect = createEffect('e2', {
      trigger: {
        player: [{ timing: TriggerTiming.TurnStart, stage: 'Begin' }],
        source: [{ timing: TriggerTiming.CardUse, stage: 'Content' }],
        target: [{ timing: TriggerTiming.CardTarget, stage: 'Before' }],
        global: [{ timing: TriggerTiming.Damage, stage: 'After' }],
      },
    })

    const handlers = compiler.compile(effect, player)
    expect(handlers).toHaveLength(4)
  })

  it('effect 无 trigger 时应返回空数组', () => {
    const effect = createEffect('e3', { trigger: {} as any })
    const handlers = compiler.compile(effect, player)
    expect(handlers).toHaveLength(0)
  })

  it('handler 应携带正确的元信息', () => {
    const effect = createEffect('locked_skill', {
      type: SkillType.Locked,
      priority: 100,
      frequency: Frequency.OncePerTurn,
    })

    const handlers = compiler.compile(effect, player)
    expect(handlers).toHaveLength(1)
    expect(handlers[0]?.isLocked).toBe(true)
    expect(handlers[0]?.priority).toBe(100)
    expect(handlers[0]?.frequency).toBe(Frequency.OncePerTurn)
    expect(handlers[0]?.usedThisTurn).toBe(false)
    expect(handlers[0]?.usedThisRound).toBe(false)
  })

  it('handler.execute 应调用 effect.content', async () => {
    let executed = false
    const effect = createEffect('e4', {
      content: async () => { executed = true },
    })

    const handlers = compiler.compile(effect, player)
    const mockCtx = { event: {} as any, player, game: {} as any, triggerCards: [] } as any

    await handlers[0]!.execute(mockCtx)
    expect(executed).toBe(true)
  })

  it('handler.execute 应跳过 isAvailable 返回 false 的效果', async () => {
    let executed = false
    const effect = createEffect('e5', {
      isAvailable: () => false,
      content: async () => { executed = true },
    })

    const handlers = compiler.compile(effect, player)
    const mockCtx = { event: {} as any, player, game: {} as any, triggerCards: [] } as any

    await handlers[0]!.execute(mockCtx)
    expect(executed).toBe(false)
  })

  it('handler.execute 应执行 effect.filter', async () => {
    let filterCalled = false
    const effect = createEffect('e6', {
      filter: () => { filterCalled = true; return true },
    })

    const handlers = compiler.compile(effect, player)
    const mockCtx = { event: {} as any, player, game: {} as any, triggerCards: [] } as any

    await handlers[0]!.execute(mockCtx)
    expect(filterCalled).toBe(true)
  })

  it('handler.execute filter 返回 false 时应跳过 content', async () => {
    let executed = false
    const effect = createEffect('e7', {
      filter: () => false,
      content: async () => { executed = true },
    })

    const handlers = compiler.compile(effect, player)
    const mockCtx = { event: {} as any, player, game: {} as any, triggerCards: [] } as any

    await handlers[0]!.execute(mockCtx)
    expect(executed).toBe(false)
  })

  it('handler.execute 应更新 handler 的 frequency 标记', async () => {
    const effect = createEffect('e8', {
      frequency: Frequency.OncePerTurn,
    })

    const handlers = compiler.compile(effect, player)
    expect(handlers[0]?.usedThisTurn).toBe(false)
    const mockCtx = { event: {} as any, player, game: {} as any, triggerCards: [] } as any

    await handlers[0]!.execute(mockCtx)
    expect(handlers[0]?.usedThisTurn).toBe(true)
  })

  it('once 频率的效果执行后应标记为已使用', async () => {
    const effect = createEffect('e9', {
      frequency: Frequency.Once,
    })

    const handlers = compiler.compile(effect, player)
    const mockCtx = { event: {} as any, player, game: {} as any, triggerCards: [] } as any

    expect(handlers[0]?.usedThisRound).toBe(false)
    expect(handlers[0]?.usedThisTurn).toBe(false)

    await handlers[0]!.execute(mockCtx)
    expect(handlers[0]?.usedThisRound).toBe(true)
    expect(handlers[0]?.usedThisTurn).toBe(true)
  })
})
