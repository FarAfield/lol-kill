import { describe, expect, it } from 'vitest'
import { GameState, createDefaultConfig } from '@core/entity/game-state'
import { Player } from '@core/entity/player'
import { Card } from '@core/entity/card'
import { CardTag } from '@core/contracts/card-tag'
import { CardRank, CardSuit, CardType, GamePhase, LogLevel } from '@core/contracts/enums'

function makeCard(id: string): Card {
  return Card.create({
    id,
    name: id,
    type: CardType.Basic,
    suit: CardSuit.None,
    rank: CardRank.A,
    description: '',
    tags: [CardTag.Basic],
    effectIds: [],
    isDelayed: false,
    canBeCanceled: false,
  })
}

function makePlayers(): Player[] {
  return [
    new Player({ id: 'p0', seatIndex: 0, hp: 4, maxHp: 4 }),
    new Player({ id: 'p1', seatIndex: 1, hp: 4, maxHp: 4 }),
    new Player({ id: 'p2', seatIndex: 2, hp: 4, maxHp: 4 }),
  ]
}

describe('GameState', () => {
  it('默认配置可创建', () => {
    const config = createDefaultConfig()
    expect(config.playerCount).toBe(5)
    expect(config.initialHandSize).toBe(4)
  })

  it('alivePlayers / aliveCount 只统计存活玩家', () => {
    const players = makePlayers()
    const state = new GameState({ players })
    expect(state.aliveCount).toBe(3)

    players[1].alive = false
    expect(state.aliveCount).toBe(2)
    expect(state.alivePlayers.map((p) => p.id)).toEqual(['p0', 'p2'])
  })

  it('create 初始化轮次与阶段', () => {
    const state = GameState.create(createDefaultConfig({ playerCount: 3 }))
    expect(state.currentRound).toBe(1)
    expect(state.currentPhase).toBe(GamePhase.NotStarted)
    expect(state.started).toBe(false)
  })

  it('advanceToNextPlayer 跳过已死亡玩家', () => {
    const players = makePlayers()
    players[1].alive = false
    const state = new GameState({ players })
    expect(state.advanceToNextPlayer()).toBe(2)
  })

  it('addLog 追加日志', () => {
    const state = new GameState({ players: makePlayers() })
    state.addLog({
      id: 'log_1',
      round: 1,
      phase: GamePhase.PhaseDraw,
      message: '摸牌',
      level: LogLevel.Info,
    })
    expect(state.log).toHaveLength(1)
  })

  it('addLog 自己盖 tick，调用方传不进时间', () => {
    const state = new GameState({ players: makePlayers() })
    state.addLog({
      id: 'log_1',
      round: 1,
      phase: GamePhase.PhaseDraw,
      message: '摸牌',
      level: LogLevel.Info,
    })
    // tick 是数字（逻辑刻度），且 id 未给时会自己发一个
    expect(typeof state.log[0]?.tick).toBe('number')
    state.addLog({ round: 1, phase: GamePhase.PhaseDraw, message: '第二行', level: LogLevel.Info })
    expect(state.log[1]?.id).toMatch(/^log_\d+$/)
  })

  it('toJSON 产出快照：数组为副本且含派生字段', () => {
    const players = makePlayers()
    const state = new GameState({ players, deck: [makeCard('c1')] })
    const snapshot = state.toJSON()

    expect(snapshot.players).not.toBe(state.players)
    expect(snapshot.aliveCount).toBe(3)
    expect(snapshot.alivePlayers).toHaveLength(3)
    expect(() => JSON.stringify(snapshot)).not.toThrow()
  })

  it('牌堆抽取与弃牌堆回收', () => {
    const state = new GameState({
      players: makePlayers(),
      deck: [makeCard('c1'), makeCard('c2')],
    })
    expect(state.drawFromDeck(2)).toHaveLength(2)
    expect(state.isDeckEmpty).toBe(true)

    state.discardCards([makeCard('c3')])
    expect(state.totalCardsAvailable).toBe(1)
    expect(state.recycleDiscardPile()).toBe(true)
    expect(state.isDeckEmpty).toBe(false)
  })

  it('startNewRound / markStarted / markFinished', () => {
    const state = GameState.create(createDefaultConfig())
    state.markStarted()
    expect(state.started).toBe(true)
    expect(state.currentPhase).toBe(GamePhase.Prepare)

    state.startNewRound()
    expect(state.currentRound).toBe(2)

    state.markFinished()
    expect(state.finished).toBe(true)
    expect(state.currentPhase).toBe(GamePhase.GameOver)
  })

  it('buildResult 汇总存活玩家与轮次', () => {
    const state = new GameState({ players: makePlayers(), currentRound: 3 })
    const result = state.buildResult(null, '测试结束')
    expect(result.survivingPlayers).toHaveLength(3)
    expect(result.totalRounds).toBe(3)
    expect(result.reason).toBe('测试结束')
  })
})
