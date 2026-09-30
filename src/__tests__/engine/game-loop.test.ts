// ============================================================
// 完整对局回归测试
//
//  invariants（不变量）比断言具体数值更能抓住引擎级缺陷：
//  卡牌总数守恒这一条，就能抓出「卡牌实例身份被当成定义 id」这类
//  会让整手牌凭空消失的错误。
// ============================================================

import { describe, expect, it } from 'vitest'

import { GameBoot } from '@core/boot/game-boot'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import {
  SilentLoggerService,
  SeededRandomService,
} from '../helpers/game-env'

/** 统计全场景卡牌总数（牌堆 + 弃牌堆 + 处理区 + 所有玩家区域）。 */
function countAllCards(state: GameStateSnapshot): number {
  let n = state.deck.length + state.discardPile.length + state.processingCards.length
  for (const p of state.players) {
    n += p.handCards.length + p.equipCards.length + p.judgeCards.length
  }
  return n
}

/** 每张牌的 instanceId 必须全局唯一。 */
function hasDuplicateInstance(state: GameStateSnapshot): boolean {
  const seen = new Set<string>()
  for (const c of [
    ...state.deck,
    ...state.discardPile,
    ...state.processingCards,
    ...state.players.flatMap((p) => [...p.handCards, ...p.equipCards, ...p.judgeCards]),
  ]) {
    if (seen.has(c.instanceId)) return true
    seen.add(c.instanceId)
  }
  return false
}

function createBoot(seed?: number): GameBoot {
  return GameBoot.createStandard5P({
    loggerService: new SilentLoggerService(),
    randomService: new SeededRandomService(seed),
  })
}

describe('完整对局', () => {
  it('5 人局可自动跑完 100 轮不抛异常', async () => {
    const boot = createBoot()
    const result = await boot.run()

    expect(result).toBeTruthy()
    expect(result.totalRounds).toBeGreaterThan(0)
  }, 30_000)

  it('对局全程卡牌总数守恒', async () => {
    const boot = createBoot()
    const { engine } = await boot.boot()
    const total = countAllCards(engine.getState() as GameStateSnapshot)

    expect(total).toBeGreaterThan(0)

    await boot.runGameLoop()
    expect(countAllCards(engine.getState() as GameStateSnapshot)).toBe(total)
  }, 30_000)

  it('卡牌实例身份全局唯一（同种卡牌不共享 id）', async () => {
    const boot = createBoot()
    const { engine } = await boot.boot()

    expect(hasDuplicateInstance(engine.getState() as GameStateSnapshot)).toBe(false)
  })

  it('同一种子产出完全相同的开局', async () => {
    const a = createBoot(42)
    const b = createBoot(42)

    const sa = (await a.boot()).engine.getState() as GameStateSnapshot
    const sb = (await b.boot()).engine.getState() as GameStateSnapshot

    expect(sa.players.map((p) => p.heroes[0]?.id)).toEqual(sb.players.map((p) => p.heroes[0]?.id))
    expect(sa.players.map((p) => p.role)).toEqual(sb.players.map((p) => p.role))

    // Phase 18 之后卡牌 id 生成器每局归零（`GameEngine.init()` 里 `Card.resetIdGenerator()`），
    // 因此连 instanceId 都可以逐位比对——不再有「跨局自增」这笔欠账。
    expect(sa.players.map((p) => p.handCards.map((c) => c.instanceId))).toEqual(
      sb.players.map((p) => p.handCards.map((c) => c.instanceId)),
    )
    expect(sa.deck.map((c) => c.instanceId)).toEqual(sb.deck.map((c) => c.instanceId))
  })
})
