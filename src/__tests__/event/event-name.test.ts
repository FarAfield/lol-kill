// ============================================================
// 事件命名体系回归测试（Phase 5）
//
// 这个 Phase 的全部价值可以用一句话概括：
//   **新增一张需要新时机的卡牌，不许改引擎，只许写一个字符串。**
// 下面的测试全部围绕这一点，而不是围绕"某个枚举值还在不在"。
// ============================================================

import { describe, expect, it } from 'vitest'

import { GameBoot } from '@core/boot/game-boot'
import { collectEffects } from '@core/boot/effect-setup'
import { GameEvent } from '@core/event/game-event'
import { EventCompiler } from '@core/event/event-compiler'
import { EventTrigger } from '@core/event/event-trigger'
import { LogLevel } from '@core/contracts/enums'
import {
  eventNameAtStage,
  isBuiltinEventName,
  isPointEvent,
  matchesEventName,
  type EventName,
} from '@core/contracts/event-name'
import type { ISkill } from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type {
  ILoggerService,
  IRandomService,
} from '@core/contracts/services.interface'
import type { TriggerStage } from '@core/contracts/enums'

// ── 测试替身 ──

class SilentLoggerService implements ILoggerService {
  log(): void {}
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  getLogs(): ReadonlyArray<{ message: string; level: LogLevel; timestamp: number }> {
    return []
  }
  clear(): void {}
}

class IdentityRandomService implements IRandomService {
  private counter = 0
  shuffle<T>(array: T[]): T[] {
    return [...array]
  }
  nextInt(min: number): number {
    return min
  }
  pick<T>(array: T[]): T {
    return array[0]!
  }
  pickN<T>(array: T[], n: number): T[] {
    return array.slice(0, n)
  }
  uuid(): string {
    return `id-${this.counter++}`
  }
}

/** 5 人确定性对局 */
function createBoot(): GameBoot {
  return GameBoot.createStandard5P({
    loggerService: new SilentLoggerService(),
    randomService: new IdentityRandomService(),
  })
}

// ── 迁移对照表 ──

/**
 * 旧 `TriggerTiming` 枚举 → 新事件主体
 *
 * 这张表是迁移的**化石**：枚举已删除，但对照关系必须留下，
 * 否则没人知道 `cardUse` 现在叫什么。20 个旧值，一个都不能少。
 */
const LEGACY_TIMING_MIGRATION: ReadonlyArray<[legacy: string, subject: EventName]> = [
  ['gameStart', 'gameStart'],
  ['roundStart', 'roundStart'],
  ['turnStart', 'turnStart'],
  ['phasePre', 'phasePre'],
  ['phaseJudge', 'phaseJudge'],
  ['phaseDraw', 'phaseDraw'],
  ['phaseUse', 'phaseUse'],
  ['phaseDiscard', 'phaseDiscard'],
  ['phasePost', 'phasePost'],
  ['turnEnd', 'turnEnd'],
  ['roundEnd', 'roundEnd'],
  ['gameOver', 'gameOver'],
  ['cardUse', 'useCard'],
  ['cardTarget', 'useCardToTarget'],
  ['cardEffect', 'useCardEffect'],
  ['damage', 'damage'],
  ['damaged', 'damage'],
  ['judge', 'judge'],
  ['playerDying', 'dying'],
  ['playerDeath', 'die'],
]

// ── 测试 ──

describe('事件命名体系（Phase 5）', () => {
  it('阶段后缀：一个主体 × 七个阶段 = 七个触发点', () => {
    const expected: Array<[TriggerStage, EventName]> = [
      ['Before', 'damageBefore'],
      ['Begin', 'damageBegin'],
      ['Prepare', 'damagePrepare'],
      ['Content', 'damage'],
      ['Prevent', 'damagePrevent'],
      ['End', 'damageEnd'],
      ['After', 'damageAfter'],
    ]

    for (const [stage, name] of expected) {
      expect(eventNameAtStage('damage', stage)).toBe(name)
      // 只有对应的阶段才命中，其余阶段一律不命中（防止一个技能被触发七次）
      expect(matchesEventName(name, 'damage', stage)).toBe(true)
      for (const [otherStage, otherName] of expected) {
        if (otherStage === stage) continue
        expect(matchesEventName(otherName, 'damage', stage)).toBe(false)
      }
    }
  })

  it('单发事件：不加后缀，且只在 Content 阶段结算一次', () => {
    expect(isPointEvent('turnStart')).toBe(true)
    expect(eventNameAtStage('turnStart', 'End')).toBe('turnStart')

    expect(matchesEventName('turnStart', 'turnStart', 'Content')).toBe(true)
    expect(matchesEventName('turnStart', 'turnStart', 'Begin')).toBe(false)
    expect(matchesEventName('turnStart', 'turnStart', 'End')).toBe(false)
  })

  it('旧 TriggerTiming 的 20 个枚举值全部有对应事件名，无遗漏', () => {
    expect(LEGACY_TIMING_MIGRATION).toHaveLength(20)

    for (const [legacy, subject] of LEGACY_TIMING_MIGRATION) {
      expect(isBuiltinEventName(subject), `旧时机 ${legacy} → ${subject} 不是合法事件名`).toBe(true)
    }
  })

  it('内置事件名之外的自定义事件名同样合法（可扩展性的关键）', () => {
    // 编译期：自定义字符串可以赋给 EventName
    const custom: EventName = 'grievousWoundsTrigger'
    // 运行期：它不是内置名，但注册与匹配照常工作
    expect(isBuiltinEventName(custom)).toBe(false)
    expect(eventNameAtStage(custom, 'After')).toBe('grievousWoundsTriggerAfter')
    expect(matchesEventName('grievousWoundsTriggerAfter', custom, 'After')).toBe(true)
  })

  it('自定义事件名无需改动引擎即可挂载并被触发', async () => {
    const boot = createBoot()
    const { engine } = await boot.boot()
    const player: IPlayer = engine.state.players[0]!

    let fired = 0
    const customEffect: ISkill = {
      id: 'testCustomEventEffect',
      name: '自定义事件技',
      description: '监听一个引擎从未听说过的事件名',
      locked: true,
      trigger: { global: ['grievousWoundsTriggerAfter'] },
      content: async () => {
        fired += 1
      },
    }

    // 引擎核心没有任何一处知道这个事件名 —— 这正是要证明的
    engine.skillRegistry.register(customEffect)
    engine.skillRegistry.attach(player, customEffect.id)

    await engine.eventDispatcher.dispatch(
      new GameEvent({ name: 'grievousWoundsTrigger', player, source: player }),
      engine.eventChain,
    )

    expect(fired).toBe(1)
  })

  it('内容层声明的触发点全部是合法事件名（无遗留的旧时机写法）', () => {
    const declared: EventName[] = []

    for (const effect of collectEffects()) {
      const trigger = effect.trigger
      if (!trigger) continue
      for (const names of [trigger.player, trigger.source, trigger.target, trigger.global]) {
        if (names) declared.push(...names)
      }
    }

    expect(declared.length).toBeGreaterThan(0)
    for (const name of declared) {
      expect(isBuiltinEventName(name), `${name} 不是合法事件名`).toBe(true)
      // 命名规范：小写开头，禁止下划线 / 中划线 / 拼音缩写
      expect(name).toMatch(/^[a-z][a-zA-Z]*$/)
    }
  })

  it('同一个效果监听多个事件名时展开为多个 handler', () => {
    const compiler = new EventCompiler()
    const trigger = new EventTrigger()
    const player = { id: 'player_0' } as IPlayer

    const effect: ISkill = {
      id: 'testMultiTrigger',
      name: '多触发点',
      description: '',
      locked: true,
      trigger: { source: ['useCard', 'damageAfter'], target: ['damageEnd'] },
      content: async () => {},
    }

    trigger.registerCompiledBatch(compiler.compile(effect, player))

    expect(trigger.count).toBe(3)
    expect(trigger.getAllHandlers().map((h) => h.event).sort()).toEqual([
      'damageAfter',
      'damageEnd',
      'useCard',
    ])
  })
})
