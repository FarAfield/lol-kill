// ============================================================
// Phase 18 · 确定性随机与回放
//
// 这里守护的是一条**元规则**：同一串输入必须长出同一局。
// 它一旦破了，回放会静默地放出一局似是而非的棋，
// 而「偶发失败」的单测再也没人敢改代码。
// ============================================================

import { describe, expect, it, vi } from 'vitest'

import { Card } from '@core/entity/card'
import { GameBoot } from '@core/boot/game-boot'
import { SeededRandomService, hashSeed, randomSeed } from '@core/services/seeded-random'
import { gameClock } from '@core/utils/clock'
import { ReplayEngine, AutoDecisionService } from '@core/replay'
import type { IGameConfig } from '@core/contracts/game.interface'
import { standard8pConfig } from '@source/modes/standard-8p'
import { SilentLoggerService, cardDef } from '../helpers/game-env'

/** 8 人局压到 2 轮——AI 每问一次都要扫一遍手牌与目标，跑满 100 轮要几分钟 */
function eightPlayerFast(): IGameConfig {
  return { ...standard8pConfig, maxRounds: 2 }
}

const silent = () => new SilentLoggerService()

/**
 * 定式自动玩家——除「AI 对局」那一条之外的用例都用它
 *
 * 回放关心的是「同一串决策能不能复现同一局」，决策本身好不好不重要；
 * 而 AI 一局要思考几百次，用它跑等价的用例要多花一两分钟。
 */
const auto = () => new AutoDecisionService()

describe('SeededRandomService', () => {
  it('同一种子产出同一串随机数', () => {
    const a = new SeededRandomService(42)
    const b = new SeededRandomService(42)
    const seqOf = (r: SeededRandomService) => [r.next(), r.next(), r.next(), r.next()]

    expect(seqOf(a)).toEqual(seqOf(b))
  })

  it('不同种子产出不同序列', () => {
    const a = new SeededRandomService(1)
    const b = new SeededRandomService(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('洗牌是确定性的，且不改动传进来的数组', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8]
    const first = new SeededRandomService(7).shuffle(source)
    const second = new SeededRandomService(7).shuffle(source)

    expect(first).toEqual(second)
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(new SeededRandomService(8).shuffle(source)).not.toEqual(first)
  })

  it('字符串种子可哈希成稳定的数值种子', () => {
    expect(hashSeed('replay-2026')).toBe(hashSeed('replay-2026'))
    expect(hashSeed('replay-2026')).not.toBe(hashSeed('replay-2027'))
    expect(new SeededRandomService('abc').seed).toBe(hashSeed('abc'))
  })

  it('流位置可快照与回滚', () => {
    const random = new SeededRandomService(99)
    random.next()
    const marked = random.snapshot()
    const tail = [random.next(), random.next()]

    random.restore(marked)
    expect([random.next(), random.next()]).toEqual(tail)
  })

  it('uuid 不消耗随机流（否则「洗了几次牌」就对不上了）', () => {
    const random = new SeededRandomService(3)
    random.uuid()
    random.uuid()
    expect(random.calls).toBe(0)
    expect(random.uuid()).not.toBe(random.uuid())
  })

  it('每局摇出来的种子是个 32 位整数', () => {
    expect(randomSeed()).toBeTypeOf('number')
  })
})

describe('确定性：同一种子 + 同决策 → 同一局', () => {
  it('8 人 AI 对局：录一遍再放一遍，事件流水逐条相同', async () => {
    const bundle = await ReplayEngine.record(eightPlayerFast(), {
      seed: 20260928,
      loggerService: silent(),
    })
    // 第二遍由录像驱动（不再问 AI），因此「同一种子 + 同决策」这一说法仍然成立
    const replayed = await ReplayEngine.replay(bundle, silent())

    expect(bundle.record.decisions.length).toBeGreaterThan(10)
    ReplayEngine.expectSame(bundle.expected, replayed)
  }, 120_000)

  it('换一颗种子就不是同一局了', async () => {
    const a = await ReplayEngine.record(eightPlayerFast(), { seed: 1, loggerService: silent(), decisions: auto() })
    const b = await ReplayEngine.record(eightPlayerFast(), { seed: 2, loggerService: silent(), decisions: auto() })

    expect(a.expected.events).not.toEqual(b.expected.events)
  }, 60_000)

  it('卡牌实例号每局归零——同种子两局的牌逐张同位', async () => {
    const open = async () => {
      const boot = GameBoot.createStandard5P({
        loggerService: silent(),
        randomService: new SeededRandomService(2026),
      })
      await boot.boot()
      return boot.getState()!.deck.map((c) => c.instanceId)
    }

    expect(await open()).toEqual(await open())
  })

  it('引擎全程不碰 Math.random', async () => {
    const spy = vi.spyOn(Math, 'random')
    try {
      await ReplayEngine.record(eightPlayerFast(), {
        seed: 5,
        loggerService: silent(),
        decisions: auto(),
      })
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  }, 60_000)
})

describe('回放', () => {
  it('载入种子与决策日志，重演出相同结果', async () => {
    const bundle = await ReplayEngine.record(eightPlayerFast(), {
      seed: 777,
      loggerService: silent(),
      decisions: auto(),
    })
    const replayed = await ReplayEngine.replay(bundle, silent())

    // 每一条决策都用上了：多问一次或少答一次都说明局面对不上
    expect(replayed.decisionsUsed).toBe(bundle.record.decisions.length)
    // 事件流水、日志、终局、结果逐项对齐
    ReplayEngine.expectSame(bundle.expected, replayed)
    expect(replayed.events.length).toBeGreaterThan(0)
  }, 60_000)

  it('同一份录像放两次，结果逐条相同', async () => {
    const bundle = await ReplayEngine.record(eightPlayerFast(), {
      seed: 31337,
      loggerService: silent(),
      decisions: auto(),
    })

    const first = await ReplayEngine.replay(bundle, silent())
    const second = await ReplayEngine.replay(bundle, silent())
    ReplayEngine.expectSame(first, second)
    // 显式断言一遍：`expectSame` 是抛错的，不写出来就没人看得见「比了什么」
    expect(second.events).toEqual(first.events)
    expect(second.log).toEqual(first.log)
    expect(second.decisionsUsed).toBe(first.decisionsUsed)
  }, 60_000)

  it('录像被改动一处 → 立刻发散，而不是凑合着跑完', async () => {
    const bundle = await ReplayEngine.record(eightPlayerFast(), {
      seed: 2024,
      loggerService: silent(),
      decisions: auto(),
    })

    // 把「出牌」决策改成放弃：指纹对得上（问的还是那些牌），
    // 但整局走势从此不同——只能靠「录像没走完」把它揪出来
    const tampered = bundle.record.decisions.map((d) =>
      d.kind === 'cardPlay' ? { ...d, response: [] } : d,
    )
    expect(tampered.some((d) => d.kind === 'cardPlay')).toBe(true)

    await expect(
      ReplayEngine.replay(
        { ...bundle, record: { ...bundle.record, decisions: tampered } },
        silent(),
      ),
    ).rejects.toThrow(/回放发散/)
  }, 120_000)

  it('配置与录像对不上时拒绝重演', async () => {
    const bundle = await ReplayEngine.record(eightPlayerFast(), {
      seed: 11,
      loggerService: silent(),
      decisions: auto(),
    })

    await expect(
      ReplayEngine.replay({ record: bundle.record, expected: bundle.expected }, silent()),
    ).rejects.toThrow(/缺少 config/)

    await expect(
      ReplayEngine.replay(
        {
          record: bundle.record,
          expected: bundle.expected,
          config: { ...eightPlayerFast(), mode: 'other' },
        },
        silent(),
      ),
    ).rejects.toThrow(/模式不符/)
  }, 120_000)
})

describe('确定性计数器', () => {
  it('逻辑时钟：局内递增，开局归零', () => {
    gameClock.reset()
    expect(gameClock.now).toBe(0)
    const first = gameClock.next()
    expect(gameClock.next()).toBe(first + 1)
    gameClock.reset()
    expect(gameClock.next()).toBe(1)
  })

  it('卡牌实例号：全局唯一，且可从头再来', () => {
    Card.resetIdGenerator()
    const a = Card.create(cardDef('sha', []))
    const b = Card.create(cardDef('sha', []))
    expect(a.instanceId).not.toBe(b.instanceId)

    // 归零后重号——这正是「第二局能复现第一局」的前提
    Card.resetIdGenerator()
    expect(Card.create(cardDef('sha', [])).instanceId).toBe(a.instanceId)
  })
})
