// ============================================================
// Phase 20 · 日志与可观测性
//
// 三条验收各管一段：
//   · 事件树能导出                 —— 排查「为什么伤害只有 1 点」时唯一可靠的线索
//   · Mod 链路看得清每个修改器的贡献 —— 「我以为它生效了」最常见的来源
//   · 观测不影响确定性              —— 一旦破了，开着日志就复现不出线上那一局，
//                                    而那恰恰是最需要复现的时刻
//
// 最后一条看着像句废话（观测怎么会改变结果？），但实现方式里埋着
// 至少三个能让它破掉的陷阱，这里逐条钉死：
//   1. 用 `Date.now()` 当时间戳        → 两次回放天然不同
//   2. 记录时调用 `gameClock.next()`   → 观测把逻辑时钟往前拨，后续事件整体错位
//   3. 追踪端抛错冒泡进流水线          → 观测失败变成结算失败
// ============================================================

import { describe, expect, it } from 'vitest'

import { GameBoot } from '@core/boot/game-boot'
import { SeededRandomService } from '@core/services/seeded-random'
import { Player } from '@core/entity/player'
import { GameState } from '@core/entity/game-state'
import { ModRegistry } from '@core/skill/mod-registry'
import { ModQuery } from '@core/skill/mod-query'
import { ModTrace } from '@core/debug/mod-trace'
import { EventTrace } from '@core/debug/event-trace'
import { AutoDecisionService } from '@core/replay'
import { GamePhase, LogLevel } from '@core/contracts/enums'
import type { IGameConfig } from '@core/contracts/game.interface'
import type { IModDefinition } from '@core/contracts/mod.interface'
import type { ICard } from '@core/contracts/card.interface'
import { standard5pConfig } from '@source/modes/standard-5p'
import { SilentLoggerService } from '../helpers/game-env'

/** 5 人局压到 2 轮——跑满会让单测从秒级变成分钟级 */
function fivePFast(): IGameConfig {
  return { ...standard5pConfig, maxRounds: 2 }
}

/** 起一局，按开关决定要不要记录，返回跑完之后的引擎 */
async function runGame(options: {
  seed: number
  trace?: boolean
  mods?: boolean
}): Promise<NonNullable<ReturnType<GameBoot['getEngine']>>> {
  const boot = new GameBoot(fivePFast(), {
    randomService: new SeededRandomService(options.seed),
    loggerService: new SilentLoggerService(),
    decisionService: new AutoDecisionService(),
  })
  await boot.boot()
  const engine = boot.getEngine()!
  // boot() 里已经 init 过并清过一次记录，此时开开关才不会把开局那段漏掉
  engine.setObservability({ trace: options.trace ?? false, mods: options.mods ?? false })
  await boot.runGameLoop()
  return engine
}

function stateOf(...players: Player[]): GameState {
  return new GameState({ players })
}

/** 建一条「数值 +N」的 Mod，持有者默认是查询主体 */
function numericMod(
  id: string,
  key: string,
  fn: (value: number) => number,
  extra: Partial<IModDefinition> = {},
): IModDefinition {
  return {
    id,
    mods: { [key]: fn } as IModDefinition['mods'],
    owners: (ctx) => [ctx.player],
    ...extra,
  }
}

// ── 验收 1 ──

describe('验收 1 · 一局结束后可导出完整事件树', () => {
  it('导出的 JSON 能 parse，带根节点与统计', async () => {
    const engine = await runGame({ seed: 2026, trace: true })
    const raw = engine.exportEventTrace()

    expect(() => JSON.parse(raw)).not.toThrow()

    const doc = JSON.parse(raw)
    expect(doc.version).toBe(1)
    expect(Array.isArray(doc.roots)).toBe(true)
    expect(doc.roots.length).toBeGreaterThan(0)
    expect(doc.stats.nodes).toBeGreaterThan(0)
    // 终态三者之和等于节点总数——没有节点被漏记，也没有人被记两次
    expect(doc.stats.completed + doc.stats.cancelled + doc.stats.prevented).toBe(
      doc.stats.nodes,
    )
  })

  it('每个节点都有名字、参与者与结算姿态', async () => {
    const engine = await runGame({ seed: 77, trace: true })
    const nodes = engine.eventTrace.flatten()

    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      expect(typeof node.name).toBe('string')
      expect(node.name.length).toBeGreaterThan(0)
      expect(Array.isArray(node.targetIds)).toBe(true)
      expect(Array.isArray(node.cardIds)).toBe(true)
      expect(typeof node.num).toBe('number')
      expect(typeof node.status).toBe('string')
      // 阶段序列必须非空——一条事件至少走过一个阶段
      expect(node.stages.length).toBeGreaterThan(0)
    }
  })

  it('嵌套关系成立：深度逐层 +1', async () => {
    const engine = await runGame({ seed: 314, trace: true })
    type Node = ReturnType<EventTrace['flatten']>[number]

    const walk = (node: Node, expectedDepth: number) => {
      expect(node.depth).toBe(expectedDepth)
      for (const child of node.children) walk(child, expectedDepth + 1)
    }
    for (const root of engine.eventTrace.rootNodes) walk(root, 0)
  })

  it('render() 给出可读的树形文本', async () => {
    const engine = await runGame({ seed: 5, trace: true })
    const text = engine.eventTrace.render()
    expect(text.split('\n').length).toBeGreaterThan(1)
  })

  it('关着的时候什么都不记——观测必须与不存在等价', async () => {
    const engine = await runGame({ seed: 2026, trace: false })
    expect(engine.eventTrace.enabled).toBe(false)
    expect(engine.eventTrace.flatten()).toHaveLength(0)
    expect(engine.exportEventTrace()).toContain('"nodes":0')
  })
})

// ── 验收 2 ──

describe('验收 2 · Mod 调试日志能看清每个修改器的贡献', () => {
  it('逐个修改器留下 before → after', () => {
    const p0 = new Player({ id: 'p0', seatIndex: 0, hp: 4, maxHp: 4 })

    const registry = new ModRegistry()
    const trace = new ModTrace()
    trace.enabled = true
    registry.trace = trace

    registry.registerAll([
      numericMod('m_add1', 'maxHandcard', (v) => v + 1),
      numericMod('m_double', 'maxHandcard', (v) => v * 2),
      numericMod('m_noop', 'maxHandcard', (v) => v),
    ])

    const query = new ModQuery(stateOf(p0), registry)
    expect(query.maxHandcard(p0)).toBe(10) // (4 + 1) * 2

    const record = trace.forHook('maxHandcard')[0]!
    expect(record.info.base).toBe(4)
    expect(record.result).toBe(10)
    expect(record.changed).toBe(true)

    // 三步都在，且每一步的改变量都对得上——这才是「看清每个修改器的贡献」
    const byId = new Map(record.steps.map((s) => [s.modId, s]))
    expect(byId.get('m_add1')).toMatchObject({ before: 4, after: 5, changed: true })
    expect(byId.get('m_double')).toMatchObject({ before: 5, after: 10, changed: true })
    expect(byId.get('m_noop')).toMatchObject({ before: 10, after: 10, changed: false })
  })

  it('没参与的写清原因：持有者阵亡 / filter 未过', () => {
    const p0 = new Player({ id: 'p0', seatIndex: 0, hp: 4, maxHp: 4 })
    const p1 = new Player({ id: 'p1', seatIndex: 1, hp: 4, maxHp: 4 })
    p1.alive = false

    const registry = new ModRegistry()
    const trace = new ModTrace()
    trace.enabled = true
    registry.trace = trace

    registry.registerAll([
      // 持有者已阵亡 → 自动失效
      {
        id: 'm_dead',
        mods: { maxHandcard: (v: number) => v + 5 } as IModDefinition['mods'],
        owners: () => [p1],
      },
      // 持有者是本人，但 filter 不通过
      {
        id: 'm_filtered',
        mods: { maxHandcard: (v: number) => v + 5 } as IModDefinition['mods'],
        owners: (ctx) => [ctx.player],
        filter: () => false,
      },
    ])

    const query = new ModQuery(stateOf(p0, p1), registry)
    expect(query.maxHandcard(p0)).toBe(4)

    const record = trace.forHook('maxHandcard')[0]!
    const reasons = new Map(record.steps.map((s) => [s.modId, s.skippedReason]))
    expect(reasons.get('m_dead')).toBe('owner-dead')
    expect(reasons.get('m_filtered')).toBe('filtered-out')
    expect(record.changed).toBe(false)
  })

  it('布尔否决一旦 false，后面的人拿到 short-circuited', () => {
    const p0 = new Player({ id: 'p0', seatIndex: 0, hp: 4, maxHp: 4 })

    const registry = new ModRegistry()
    const trace = new ModTrace()
    trace.enabled = true
    registry.trace = trace

    registry.registerAll([
      {
        id: 'b_deny',
        mods: { cardEnabled: () => false } as IModDefinition['mods'],
        owners: (ctx) => [ctx.player],
        priority: 10,
      },
      {
        id: 'b_after',
        mods: { cardEnabled: () => true } as IModDefinition['mods'],
        owners: (ctx) => [ctx.player],
        priority: 1,
      },
    ])

    const query = new ModQuery(stateOf(p0), registry)
    expect(query.cardEnabled(p0, { tags: new Set() } as unknown as ICard)).toBe(false)

    const record = trace.forHook('cardEnabled')[0]!
    const step = record.steps.find((s) => s.modId === 'b_after')
    expect(step?.skippedReason).toBe('short-circuited')
  })

  it('render() 把链路写成能直接读的文本', () => {
    const p0 = new Player({ id: 'p0', seatIndex: 0, hp: 4, maxHp: 4 })

    const registry = new ModRegistry()
    const trace = new ModTrace()
    trace.enabled = true
    registry.trace = trace
    registry.registerAll([
      numericMod('m_add1', 'maxHandcard', (v) => v + 1),
      numericMod('m_skipped', 'maxHandcard', (v) => v + 9, { filter: () => false }),
    ])

    const query = new ModQuery(stateOf(p0), registry)
    query.maxHandcard(p0)

    const text = trace.render(trace.queries[0]!)
    expect(text).toContain('base=4')
    expect(text).toContain('m_add1')
    expect(text).toContain('4 → 5')
    expect(text).toContain('skip: filtered-out')
    expect(text).toContain('= 5')
  })

  it('关着的时候不记录任何查询，但 Mod 照旧生效', () => {
    const p0 = new Player({ id: 'p0', seatIndex: 0, hp: 4, maxHp: 4 })

    const registry = new ModRegistry()
    const trace = new ModTrace()
    registry.trace = trace // 挂上但不开
    registry.registerAll([numericMod('m_add1', 'maxHandcard', (v) => v + 1)])
    const query = new ModQuery(stateOf(p0), registry)

    expect(query.maxHandcard(p0)).toBe(5)
    expect(trace.queries).toHaveLength(0)
  })

  it('追踪端抛错不影响计算——观测失败不该让一次查询崩掉', () => {
    const p0 = new Player({ id: 'p0', seatIndex: 0, hp: 4, maxHp: 4 })

    const registry = new ModRegistry()
    registry.trace = {
      enabled: true,
      onQueryBegin() {
        throw new Error('boom')
      },
      onContribution() {
        throw new Error('boom')
      },
      onQueryEnd() {
        throw new Error('boom')
      },
    }
    registry.registerAll([numericMod('m_add1', 'maxHandcard', (v) => v + 1)])
    const query = new ModQuery(stateOf(p0), registry)

    // 追踪端是个彻底的旁观者：它炸了，游戏该怎么算还怎么算
    expect(() => query.maxHandcard(p0)).not.toThrow()
    expect(query.maxHandcard(p0)).toBe(5)
  })
})

// ── 验收 3 ──

describe('验收 3 · 日志不影响确定性', () => {
  it('同一种子：开着观测跑两遍，导出同一份事件树', async () => {
    const a = await runGame({ seed: 999, trace: true, mods: true })
    const b = await runGame({ seed: 999, trace: true, mods: true })

    expect(a.exportEventTrace()).toBe(b.exportEventTrace())
  })

  it('同一种子：关着与开着是同一局', async () => {
    // 整套验收的核心。观测一旦改变结果，「开着日志复现线上那一局」
    // 就成了不可能——而那正是最需要复现的时刻。
    const off = await runGame({ seed: 4242, trace: false })
    const on = await runGame({ seed: 4242, trace: true, mods: true })

    expect(on.getState().currentRound).toBe(off.getState().currentRound)
    expect(on.getState().players.map((p) => `${p.id}:${p.hp}:${p.alive}`)).toEqual(
      off.getState().players.map((p) => `${p.id}:${p.hp}:${p.alive}`),
    )
    expect(on.getState().deck.length).toBe(off.getState().deck.length)
    // 连游戏日志都逐条相同（tick 也对齐）
    expect(on.getState().log.map((e) => `${e.id}|${e.tick}|${e.message}`)).toEqual(
      off.getState().log.map((e) => `${e.id}|${e.tick}|${e.message}`),
    )
  })

  it('换种子 → 不同的事件树', async () => {
    const a = await runGame({ seed: 1, trace: true })
    const b = await runGame({ seed: 2, trace: true })
    expect(a.exportEventTrace()).not.toBe(b.exportEventTrace())
  })

  it('日志的时间戳是逻辑刻度，不是墙上时间', async () => {
    const engine = await runGame({ seed: 8 })
    const entries = engine.getState().log

    for (const entry of entries) {
      expect(typeof entry.tick).toBe('number')
      // 逻辑时钟每局从 0 归零、每次只 +1；挂钟不可能是这种量级
      expect(entry.tick).toBeGreaterThanOrEqual(0)
      expect(entry.tick).toBeLessThan(1_000_000)
      // 状态里的条目不该带墙钟——那是呈现层的事
      expect((entry as { timestamp?: number }).timestamp).toBeUndefined()
    }
  })

  it('GameState.addLog 自己盖章，调用方传不进时间', () => {
    const p0 = new Player({ id: 'p0', seatIndex: 0 })
    const gs = new GameState({ players: [p0] })

    gs.addLog({
      round: 1,
      phase: GamePhase.PhaseDraw,
      message: '摸牌',
      level: LogLevel.Info,
    })

    const entry = gs.log[0]!
    expect(typeof entry.tick).toBe('number')
    expect(entry.id).toMatch(/^log_\d+$/)
  })
})
