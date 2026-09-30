// ============================================================
// GameEvent 生命周期回归测试（Phase 6）
//
// 这个 Phase 的全部价值可以用一句话概括：
//   **一个事件的「内容」有明确的生命周期控制手段，且失控时是抛错而不是卡死。**
// 下面的测试覆盖步骤机（goto / finish / cancel）、子事件（trigger）、
// 嵌套深度保护，以及按事件粒度的暂停。
// ============================================================

import { describe, expect, it } from 'vitest'

import { GameEvent, MAX_STEP_ITERATIONS } from '@core/event/game-event'
import { EventChain } from '@core/event/event-chain'
import { EventDispatcher } from '@core/event/event-dispatcher'
import { EventPauseManager } from '@core/event/event-pause-manager'
import {
  EventNestingError,
  EventRunnerMissingError,
  EventStepOverflowError,
  EventTransitionError,
} from '@core/event/errors'
import { EventStatus } from '@core/contracts/enums'
import type { EventName } from '@core/contracts/event-name'
import type { IPlayer } from '@core/contracts/player.interface'

// ── 测试替身 ──

function fakePlayer(id: string): IPlayer {
  return { id } as unknown as IPlayer
}

function makeEvent(name: EventName, overrides: Partial<{ forced: boolean }> = {}): GameEvent {
  const player = fakePlayer('p1')
  return new GameEvent({
    name,
    source: player,
    player,
    forced: overrides.forced ?? false,
  })
}

/** 无 deps 的裸调度器——只跑流水线与步骤机，不执行任何效果 */
function makeDispatcher(maxDepth = 20): EventDispatcher {
  return new EventDispatcher({ maxDepth })
}

/** 记录流水线经过的阶段 */
function stageRecorder() {
  const stages: string[] = []
  return {
    stages,
    dispatcher: new EventDispatcher({
      onStageChange: (_event, stage) => stages.push(stage),
    }),
  }
}

// ── 步骤机 ──

describe('GameEvent 步骤机', () => {
  it('goto(0) 能形成循环且不爆栈，配合 finish 出口退出', async () => {
    const event = makeEvent('useCard')
    let counter = 0

    event.addStep(0, (_e) => {
      counter += 1
      if (counter >= 5) {
        _e.finish()
        return
      }
      // 回到步骤 0 —— 迭代实现，不会递归爆栈
      _e.goto(0)
    })
    event.addStep(1, () => {
      throw new Error('步骤 1 不应被执行')
    })

    await event.runSteps()

    expect(counter).toBe(5)
    expect(event.finished).toBe(true)
  })

  it('无出口的 goto 循环不会静默卡死，而是抛 EventStepOverflowError', async () => {
    const event = makeEvent('useCard')
    event.addStep(0, (e) => e.goto(0))

    await expect(event.runSteps()).rejects.toBeInstanceOf(EventStepOverflowError)
    // 迭代次数有预算，不会无限执行
    expect(MAX_STEP_ITERATIONS).toBeGreaterThan(0)
  })

  it('步骤顺序执行；finish() 后剩余步骤不执行', async () => {
    const event = makeEvent('useCard')
    const executed: number[] = []

    event.addStep(0, () => {
      executed.push(0)
    })
    event.addStep(1, () => {
      executed.push(1)
      event.finish()
    })
    event.addStep(2, () => {
      executed.push(2)
    })

    await event.runSteps()

    expect(executed).toEqual([0, 1])
    expect(event.finished).toBe(true)
  })

  it('没有注册步骤时 runSteps 自然结束，且不终止事件', async () => {
    const event = makeEvent('turnStart')
    await event.runSteps()
    expect(event.finished).toBe(true)
    expect(event.isTerminal).toBe(false)
  })

  it('步骤可以是异步的，按顺序 await', async () => {
    const event = makeEvent('useCard')
    const executed: number[] = []

    event.addStep(0, async () => {
      await Promise.resolve()
      executed.push(0)
    })
    event.addStep(1, async () => {
      await Promise.resolve()
      executed.push(1)
    })

    await event.runSteps()
    expect(executed).toEqual([0, 1])
  })
})

// ── 取消 ──

describe('GameEvent 取消', () => {
  it('cancel() 后剩余步骤与后续阶段都不执行，直接进入终态', async () => {
    const { stages, dispatcher } = stageRecorder()
    const event = makeEvent('useCard')
    const executed: number[] = []

    event.addStep(0, () => {
      executed.push(0)
      event.cancel('被无懈可击')
    })
    event.addStep(1, () => {
      executed.push(1)
    })

    await dispatcher.dispatch(event, new EventChain())

    expect(executed).toEqual([0])
    expect(event.cancelled).toBe(true)
    expect(event.cancelReason).toBe('被无懈可击')
    expect(event.finished).toBe(true)
    expect(event.status).toBe(EventStatus.Completed)
    // 在 Content 阶段被取消 → Prevent / End / After 都不该出现
    expect(stages).not.toContain('End')
    expect(stages).not.toContain('After')
  })

  it('强制事件（forced）不可取消', async () => {
    const event = makeEvent('damage', { forced: true })
    event.cancel('尝试取消')
    expect(event.cancelled).toBe(false)
    expect(event.isTerminal).toBe(false)
  })

  it('调度前手工置 cancelled 也会被 SkipCheck 拦下', async () => {
    const event = makeEvent('useCard')
    event.cancelled = true

    await makeDispatcher().dispatch(event, new EventChain())

    expect(event.status).toBe(EventStatus.Completed)
    expect(event.cancelled).toBe(true)
  })

  it('finish() 只跳过剩余步骤，End / After 阶段照常执行', async () => {
    const { stages, dispatcher } = stageRecorder()
    const event = makeEvent('useCard')

    event.addStep(0, () => {
      event.finish()
    })

    await dispatcher.dispatch(event, new EventChain())

    expect(event.finished).toBe(true)
    expect(event.cancelled).toBe(false)
    expect(stages).toContain('End')
    expect(stages).toContain('After')
    expect(event.status).toBe(EventStatus.Completed)
  })
})

// ── 子事件 ──

describe('GameEvent.trigger 子事件', () => {
  it('子事件结算完毕后父事件才继续', async () => {
    const dispatcher = makeDispatcher()
    const chain = new EventChain()
    const order: string[] = []

    const parent = makeEvent('useCard')
    parent.addStep(0, async () => {
      order.push('parent:0:before')
      await parent.trigger('damage')
      order.push('parent:0:after')
    })
    parent.addStep(1, () => {
      order.push('parent:1')
    })

    await dispatcher.dispatch(parent, chain)

    expect(order).toEqual(['parent:0:before', 'parent:0:after', 'parent:1'])
    expect(parent.children).toHaveLength(1)
    expect(parent.children[0]!.name).toBe('damage')
    expect(parent.children[0]!.status).toBe(EventStatus.Completed)
  })

  it('子事件继承父事件的 player / round / turn，并挂到父节点', async () => {
    const dispatcher = makeDispatcher()
    const parent = makeEvent('useCard')
    parent.round = 3
    parent.turn = 2

    parent.addStep(0, async () => {
      await parent.trigger('damage', { targets: [fakePlayer('p2')] })
    })

    await dispatcher.dispatch(parent, new EventChain())

    const child = parent.children[0]!
    expect(child.parent).toBe(parent)
    expect(child.player).toBe(parent.player)
    expect(child.round).toBe(3)
    expect(child.turn).toBe(2)
    expect(child.depth).toBe(1)
  })

  it('未进入调度的事件调 trigger 抛 EventRunnerMissingError', async () => {
    const orphan = makeEvent('useCard')
    await expect(orphan.trigger('damage')).rejects.toBeInstanceOf(
      EventRunnerMissingError,
    )
  })

  it('嵌套深度超过上限抛 EventNestingError，而不是静默', async () => {
    const dispatcher = makeDispatcher(3)

    // 手工构造一条深度链：root(depth 0) → mid(1) → leaf(2)
    const root = makeEvent('useCard')
    const mid = new GameEvent({ name: 'damage', parent: root })
    const leaf = new GameEvent({ name: 'damage', parent: mid })
    const tooDeep = new GameEvent({ name: 'damage', parent: leaf })

    expect(leaf.depth).toBe(2)
    expect(tooDeep.depth).toBe(3)

    // depth 2 < 3 —— 允许调度
    await dispatcher.dispatch(leaf, new EventChain())
    expect(leaf.status).toBe(EventStatus.Completed)

    // depth 3 >= 3 —— 抛错
    await expect(
      dispatcher.dispatch(tooDeep, new EventChain()),
    ).rejects.toBeInstanceOf(EventNestingError)

    // trigger 自身也做同样的守卫
    leaf.runner = dispatcher
    await expect(leaf.trigger('damage')).rejects.toBeInstanceOf(EventNestingError)
  })

  it('调度结束后解绑运行器，事件不能再 trigger', async () => {
    const dispatcher = makeDispatcher()
    const event = makeEvent('turnStart')
    await dispatcher.dispatch(event, new EventChain())

    expect(event.runner).toBeUndefined()
    await expect(event.trigger('damage')).rejects.toBeInstanceOf(
      EventRunnerMissingError,
    )
  })
})

// ── 状态机 ──

describe('GameEvent 状态机', () => {
  it('非法状态转移抛 EventTransitionError', () => {
    const event = makeEvent('useCard')
    // waiting → after 不是合法推进
    expect(() => event.transitionTo(EventStatus.After)).toThrow(EventTransitionError)
  })

  it('任意阶段都能直接进入终态（无懈可击窗口）', () => {
    const event = makeEvent('useCard')
    event.transitionTo(EventStatus.SkipCheck)
    event.transitionTo(EventStatus.Before)
    event.transitionTo(EventStatus.Cancelled)
    expect(event.isTerminal).toBe(true)
    expect(event.cancelled).toBe(true)
  })

  it('进入终态后 finished 为 true', () => {
    const event = makeEvent('useCard')
    event.transitionTo(EventStatus.SkipCheck)
    event.transitionTo(EventStatus.Before)
    event.transitionTo(EventStatus.Completed)
    expect(event.finished).toBe(true)
  })
})

// ── 便捷访问 ──

describe('GameEvent 便捷访问', () => {
  it('target / card 是 targets / cards 的首元素视图', () => {
    const p2 = fakePlayer('p2')
    const event = new GameEvent({
      name: 'damage',
      targets: [p2],
      cards: [{ id: 'sha' } as never],
    })
    expect(event.target).toBe(p2)
    expect(event.card).toBeDefined()
    expect(event.targets).toHaveLength(1)
  })

  it('num 与 values.num 是同一个真值源', () => {
    const event = makeEvent('damage')
    event.num = 3
    expect(event.values.num).toBe(3)
    event.values.num = 5
    expect(event.num).toBe(5)
  })

  it('result 可写入任意自定义结果字段', () => {
    const event = makeEvent('judge')
    event.result = { bool: true, num: 2, customField: 'ok' }
    expect(event.result.bool).toBe(true)
    expect(event.result['customField']).toBe('ok')
  })

  it('player 缺省时继承 source', () => {
    const source = fakePlayer('src')
    const event = new GameEvent({ name: 'turnStart', source })
    expect(event.player).toBe(source)
  })
})

// ── 暂停粒度 ──

describe('EventPauseManager 按事件粒度暂停', () => {
  it('暂停 A 事件不影响 B 事件，可分别恢复', async () => {
    const manager = new EventPauseManager()

    const pauseA = manager.pause('evt-a', '等待 A 决策')
    const pauseB = manager.pause('evt-b', '等待 B 决策')

    expect(manager.isPaused('evt-a')).toBe(true)
    expect(manager.isPaused('evt-b')).toBe(true)
    expect(manager.pauseDepth).toBe(2)

    manager.resume('evt-a')
    await pauseA

    expect(manager.isPaused('evt-a')).toBe(false)
    expect(manager.isPaused('evt-b')).toBe(true)

    manager.resume('evt-b')
    await pauseB
    expect(manager.isPaused()).toBe(false)
  })

  it('getPendingEventIds 按暂停顺序返回等待中的事件', () => {
    const manager = new EventPauseManager()
    manager.pause('evt-1', 'r1').catch(() => {})
    manager.pause('evt-2', 'r2').catch(() => {})
    expect(manager.getPendingEventIds()).toEqual(['evt-1', 'evt-2'])
  })
})

// ── 事件链 ──

describe('EventChain', () => {
  it('是纯 LIFO 栈，size 反映当前深度', () => {
    const chain = new EventChain()
    const a = makeEvent('turnStart')
    const b = makeEvent('useCard')

    expect(chain.size).toBe(0)
    chain.push(a)
    chain.push(b)
    expect(chain.size).toBe(2)
    expect(chain.peek()).toBe(b)
    expect(chain.pop()).toBe(b)
    expect(chain.peek()).toBe(a)
    expect(chain.pop()).toBe(a)
    expect(chain.isEmpty()).toBe(true)
  })
})

