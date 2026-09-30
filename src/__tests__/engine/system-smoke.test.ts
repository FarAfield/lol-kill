// ============================================================
// 最小化系统功能测试（Phase 12B）
//
// 前面每个 Phase 的验收测试都是「切一小块下来验」——伤害、无懈、
// 结算点各自有文件。这样能定位问题，但**证明不了它们拼起来还能转**。
//
// 这个文件只做一件事：把主干按真实顺序走一遍
//   开局 → 摸牌 → 出牌 → 响应 → 伤害 → 濒死 → 死亡 → 胜负
// 每一步只断言「这一步该发生的事发生了」，不重复别处已验过的细节。
//
// 全部走真实 GameBoot，不打 mock、不绕过事件系统。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { GameEvent } from '@core/event'
import { CardTag } from '@core/contracts/card-tag'
import { GamePhase, RoleType, ZoneType } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { createTestEnv, giveCard, cardDef, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

/** 一张杀 */
function sha(user: IPlayer): ICard {
  return giveCard(user, cardDef('sha', [CardTag.Strike, CardTag.Attack]))
}

/** 走一次伤害事件（绕过用牌，只验伤害之后的链路） */
async function hurt(source: IPlayer, target: IPlayer, num = 1): Promise<void> {
  await env.engine.eventDispatcher.dispatch(
    new GameEvent({ name: 'damage', source, player: source, targets: [target], num }),
    env.engine.eventChain,
  )
}

// ── 开局 ──

describe('开局', () => {
  it('5 人全部存活，各就各位', () => {
    const players = env.players()

    expect(players).toHaveLength(5)
    expect(players.every((p) => p.alive)).toBe(true)
    expect(players.every((p) => p.heroes.length > 0)).toBe(true)
    expect(players.every((p) => p.role !== undefined)).toBe(true)
    // 座次必须连续且唯一——回合顺序全靠它
    expect(players.map((p) => p.seatIndex)).toEqual([0, 1, 2, 3, 4])
  })

  it('每人发到初始手牌，且都在手牌区', () => {
    for (const p of env.players()) {
      expect(p.handCards.length).toBeGreaterThan(0)
      expect(p.handCards.every((c) => c.zone === ZoneType.Hand)).toBe(true)
    }
  })

  it('身份配置齐全（1 主公 + 反贼 + 1 内奸）', () => {
    const roles = env.players().map((p) => p.role)
    expect(roles.filter((r) => r === RoleType.Aspect)).toHaveLength(1)
    expect(roles.filter((r) => r === RoleType.Ascended).length).toBeGreaterThan(0)
    expect(roles.filter((r) => r === RoleType.Infiltrator)).toHaveLength(1)
  })
})

// ── 摸牌 ──

describe('摸牌阶段', () => {
  it('执行后手牌增加，牌堆相应减少', async () => {
    const [player] = env.players()
    const handBefore = player.handCards.length
    const deckBefore = env.engine.state.deck.length

    await env.engine.phaseManager.executePhase(GamePhase.PhaseDraw, player)

    expect(player.handCards.length).toBeGreaterThan(handBefore)
    expect(env.engine.state.deck.length).toBeLessThan(deckBefore)
  })
})

// ── 出牌 → 响应 → 伤害 ──

describe('出牌阶段', () => {
  it('编排「出杀打邻座」→ 目标未响应 → 掉 1 血，杀进弃牌堆', async () => {
    const [attacker, victim] = env.players()
    const card = sha(attacker)
    env.decisions.outCard(attacker, card, [victim.id])

    const hpBefore = victim.hp
    await env.engine.phaseManager.executePhase(GamePhase.PhaseUse, attacker)

    // 出牌阶段真的把牌打出去了（此前测试脚手架没实现 askForCardPlay，
    // 这一段在所有测试里都是静默跳过的）
    expect(env.decisions.askCount(attacker, '出牌阶段')).toBeGreaterThan(0)
    expect(victim.hp).toBe(hpBefore - 1)
    expect(card.zone).toBe(ZoneType.Discard)
  })

  it('目标手上有闪并打出 → 杀被抵消，不掉血', async () => {
    const [attacker, victim] = env.players()
    const card = sha(attacker)
    const shan = giveCard(victim, cardDef('shan', CardTag.Dodge))
    env.decisions.outCard(attacker, card, [victim.id])
    env.decisions.script(victim, '是否出闪', shan)

    const hpBefore = victim.hp
    await env.engine.phaseManager.executePhase(GamePhase.PhaseUse, attacker)

    expect(victim.hp).toBe(hpBefore)
    expect(shan.zone).toBe(ZoneType.Discard)
  })

  it('一回合只能用一张杀（第二张想打也打不出去）', async () => {
    const [attacker, victim] = env.players()
    const first = sha(attacker)
    const second = sha(attacker)
    // 两张都排队：第二张会被「本回合杀的额度已用完」挡下来
    env.decisions.outCard(attacker, first, [victim.id])
    env.decisions.outCard(attacker, second, [victim.id])

    const hpBefore = victim.hp
    await env.engine.phaseManager.executePhase(GamePhase.PhaseUse, attacker)

    expect(first.zone).toBe(ZoneType.Discard)
    expect(second.zone).toBe(ZoneType.Hand)
    expect(victim.hp).toBe(hpBefore - 1)
  })
})

// ── 濒死 → 死亡 ──

describe('濒死与死亡', () => {
  it('打到 0 血无人出桃 → 死亡，牌全部离手', async () => {
    const [attacker, victim] = env.players()
    victim.hp = 1

    const handCount = victim.handCards.length
    const discardBefore = env.engine.state.discardPile.length

    await hurt(attacker, victim, 1)

    expect(victim.alive).toBe(false)
    expect(victim.handCards).toHaveLength(0)
    expect(env.engine.state.alivePlayers).not.toContain(victim)
    // 死者持有的牌进弃牌堆——不能凭空消失
    expect(env.engine.state.discardPile.length).toBeGreaterThanOrEqual(
      discardBefore + handCount,
    )
  })

  it('打到 0 血有人出桃 → 救活，继续存活', async () => {
    const [attacker, victim, , saver] = env.players()
    victim.hp = 1
    env.decisions.script(saver, '濒死', giveCard(saver, cardDef('tao', CardTag.Heal)))

    await hurt(attacker, victim, 1)

    expect(victim.alive).toBe(true)
    expect(victim.hp).toBeGreaterThan(0)
  })
})

// ── 胜负 ──

describe('胜负判定', () => {
  it('全员存活时不结束', () => {
    expect(env.engine.checkGameOver()).toBeNull()
  })

  it('主公死亡 → 分出胜负', () => {
    const lord = env.players().find((p) => p.role === RoleType.Aspect)!
    lord.alive = false

    const result = env.engine.checkGameOver()
    expect(result).not.toBeNull()
    expect(result!.winner).not.toBe(RoleType.Aspect)
    expect(result!.survivingPlayers.length).toBeLessThan(5)
  })
})

// ── 一局跑完 ──

describe('完整对局', () => {
  it('5 人局能跑到终局（不崩、不无限循环）', async () => {
    const result = await env.engine.runGameLoop()

    expect(result).toBeTruthy()
    expect(result.totalRounds).toBeGreaterThan(0)
    expect(env.engine.state.finished).toBe(true)
  }, 30_000)

  it('对局结束后状态自洽：死者无牌、活者血量合法、牌不重复', async () => {
    await env.engine.runGameLoop()

    const state = env.engine.state

    const all = [
      ...state.deck,
      ...state.discardPile,
      ...state.processingCards,
      ...state.players.flatMap((p) => [...p.handCards, ...p.equipCards, ...p.judgeCards]),
    ]
    const ids = all.map((c) => c.instanceId)

    // 一张牌不能同时出现在两个区域 —— 实例身份串了会让整手牌凭空消失
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThan(0)

    const dead = state.players.filter((p) => !p.alive)
    const alive = state.players.filter((p) => p.alive)

    expect(dead.every((p) => p.handCards.length === 0)).toBe(true)
    expect(alive.every((p) => p.hp > 0 && p.hp <= p.maxHp)).toBe(true)
  }, 30_000)
})

// ── 确定性 ──

describe('确定性', () => {
  /** 跑同一套脚本，返回可比对的局面摘要 */
  async function playScripted(): Promise<string> {
    const e = await createTestEnv()
    const [attacker, victim] = e.players()
    const card = giveCard(attacker, cardDef('sha', [CardTag.Strike, CardTag.Attack]))
    e.decisions.outCard(attacker, card, [victim.id])

    victim.hp = 3
    await e.engine.phaseManager.executePhase(GamePhase.PhaseUse, attacker)

    return e.engine.state.players
      .map((p) => `${p.id}:${p.hp}:${p.alive ? 1 : 0}:${p.handCards.length}`)
      .join('|')
  }

  it('同一套输入跑两遍，局面完全一致', async () => {
    expect(await playScripted()).toBe(await playScripted())
  })
})
