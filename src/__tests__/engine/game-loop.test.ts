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

// ============================================================
// 重开一局（欠账 D2）
//
// 「再来一局」在界面上是同一个引擎实例连着 `init()` 第二次——
// 引擎明确禁止替换 `GameState` 实例（子系统都持有它的引用），
// 于是重开全靠 `GameState.reset()` 与各子系统自己清场。
// 清漏一处就是幽灵：上一局的玩家还在座上、上一局的牌还在手里。
//
// 这类缺陷的症状是「第二局有 10 个人、手牌多一倍」，而单局用例
// （本文件上面那几条）一条都抓不到——它们只 boot 一次。
// ============================================================

describe('重开一局', () => {
  it('第二次 init() 之后没有幽灵玩家、也没有重号的牌', async () => {
    const boot = createBoot(7)
    const { engine, config } = await boot.boot()

    const first = engine.getState() as GameStateSnapshot
    const firstPlayers = [...first.players]
    const firstHands = firstPlayers.flatMap((p) => [...p.handCards])
    const firstTotal = countAllCards(first)

    // 对照：这些「第一局」的取样本身必须非空，否则下面的「没有翻倍」
    // 只是两个 0 在比大小。
    expect(firstPlayers.length).toBe(config.playerCount)
    expect(config.playerCount).toBeGreaterThan(1)
    expect(firstHands.length).toBeGreaterThan(0)
    expect(firstTotal).toBeGreaterThan(firstHands.length)

    await engine.init(config)
    const second = engine.getState() as GameStateSnapshot

    expect(second.players.length).toBe(config.playerCount)
    expect(countAllCards(second)).toBe(firstTotal)
    expect(hasDuplicateInstance(second)).toBe(false)

    // 上一局那批玩家与那批牌都退场了。
    // 比的是**对象**而不是 instanceId：id 生成器在 init 里归零，
    // 第二局的牌必然与第一局重号（`determinism.test.ts` 就靠这个），
    // 所以「号没重复」根本证明不了「牌是新的」。
    for (const p of firstPlayers) {
      expect(second.players).not.toContain(p)
    }
    for (const c of firstHands) {
      expect(second.players.flatMap((p) => [...p.handCards])).not.toContain(c)
    }
  })

  it('重开之后每人一名英雄、手牌不多不少、场上没有上一局的残留', async () => {
    const boot = createBoot(11)
    const { engine, config } = await boot.boot()
    await engine.init(config)

    const state = engine.getState() as GameStateSnapshot

    // `heroSelectCount` 是**候选**数（开局给人挑几个），落座只有一名。
    expect(config.heroSelectCount).toBeGreaterThan(1)

    for (const p of state.players) {
      expect(p.heroes).toHaveLength(1)
      expect(p.handCards).toHaveLength(config.initialHandSize)
      expect(p.equipCards).toHaveLength(0)
      expect(p.judgeCards).toHaveLength(0)
    }

    // 对照：初始手牌是**从牌堆里发出来的**，牌堆因此少了、弃牌堆还是空的。
    // 少了这句，「手牌数正好」也可能是「谁都没发到牌、两边都是 0」。
    expect(config.initialHandSize).toBeGreaterThan(0)
    expect(state.deck.length).toBeGreaterThan(0)
    expect(state.discardPile).toHaveLength(0)
  })

  it('技能台账与重开后的英雄对齐 —— 没有上一局的技能挂在人身上', async () => {
    const boot = createBoot(13)
    const { engine, config } = await boot.boot()
    await engine.init(config)

    const state = engine.getState() as GameStateSnapshot
    let expected = 0

    for (const p of state.players) {
      const fromHeroes = new Set(p.heroes.flatMap((h) => h.effectIds))
      const attached = engine.skillRegistry.getSkills(p).map((s) => s.id)

      // 台账不许比英雄多：多出来的那一个，就是上一局的英雄留下的。
      // 玩家的 id 是 `player_N`、每局重号，所以不清台账的话上一局的技能
      // 会稳稳挂在同一把钥匙上，界面上表现为「这局多了个不该有的技能」。
      for (const id of attached) {
        expect(fromHeroes, `${p.id} 挂着不该属于他的技能`).toContain(id)
      }
      // 也不许比英雄少，否则「多出来」那条只是因为两边都空。
      expect(attached.length).toBe(fromHeroes.size)
      expected += fromHeroes.size
    }

    // 对照：这一局确实有技能被挂上，不是全员光板。
    expect(expected).toBeGreaterThan(0)
    expect(engine.skillRegistry.attachedCount).toBe(expected)
  })

  it('重开之后这一局还能正常跑完', async () => {
    const boot = createBoot(23)
    const { engine, config } = await boot.boot()

    // 先把第一局跑掉，让引擎带着「打完一局」的残留状态再开一次
    await boot.runGameLoop()
    await engine.init(config)

    const result = await boot.runGameLoop()
    expect(result).toBeTruthy()
    expect(result.totalRounds).toBeGreaterThan(0)
  }, 60_000)
})
