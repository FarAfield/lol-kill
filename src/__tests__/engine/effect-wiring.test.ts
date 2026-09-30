// ============================================================
// 效果装配回归测试（Phase 3 + Phase 4）
//
// 这是重构以来**第一个真正的功能性测试**：它验证的不是某个零件能转，
// 而是「英雄技能确实接进了真实对局的事件流」。
//
// 走 GameBoot 完整路径，禁止在测试内手工拼装注册表。
// ============================================================

import { describe, expect, it } from 'vitest'

import { GameBoot } from '@core/boot/game-boot'
import { GameEvent } from '@core/event/game-event'
import { GamePhase, LogLevel, RoleType, ZoneType } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import type { IGameConfig } from '@core/contracts/game.interface'
import type {
  ILoggerService,
  IRandomService,
} from '@core/contracts/services.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { Card } from '@core/entity/card'
import { CaoCao, ZhangFei } from '@source/heroes/standard'
import { basicCards } from '@source/cards/basic'

// ── 测试替身 ──

/** 恒等随机服务：洗牌原序返回，让英雄/牌堆分配可预测。 */
class IdentityRandomService implements IRandomService {
  private counter = 0
  shuffle<T>(array: T[]): T[] {
    return [...array]
  }
  nextInt(min: number, _max: number): number {
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

/** 静默日志服务：避免测试输出刷屏。 */
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

// ── 对局构造 ──

/**
 * 构造 2 人确定性对局：player_0 = 张飞（咆哮），player_1 = 曹操（奸雄）。
 */
function createBoot(): GameBoot {
  const config: IGameConfig = {
    mode: 'test-wiring',
    playerCount: 2,
    roles: [RoleType.Aspect, RoleType.Infiltrator],
    // 恒等洗牌下顺序即分配顺序
    heroes: [ZhangFei, CaoCao],
    cards: basicCards,
    heroSelectCount: 1,
    initialHandSize: 4,
    equipEnabled: false,
    delayedCardEnabled: false,
    maxRounds: 5,
  }

  return GameBoot.create(config, {
    randomService: new IdentityRandomService(),
    loggerService: new SilentLoggerService(),
  })
}

/** 构造并驱动一个 TurnStart 事件（与 PhaseManager.executeTurn 中的一致）。 */
async function dispatchTurnStart(
  engine: NonNullable<ReturnType<GameBoot['getEngine']>>,
  player: IPlayer,
): Promise<void> {
  const event = new GameEvent({
    name: 'turnStart',
    source: player,
    player,
    phase: GamePhase.PhasePre,
    round: engine.state.currentRound,
    turn: player.seatIndex,
  })
  await engine.eventDispatcher.dispatch(event, engine.eventChain)
}

// ── 测试 ──

describe('效果装配（Phase 3 装配根 + Phase 4 单一真值源）', () => {
  it('启动后英雄技能确实注册进事件系统', async () => {
    const boot = createBoot()
    const { engine } = await boot.boot()

    expect(engine.eventDispatcher.eventTrigger.count).toBeGreaterThan(0)
    expect(engine.skillRegistry.hasSkill(engine.state.players[0]!, 'paoxiao')).toBe(true)
    expect(engine.skillRegistry.hasSkill(engine.state.players[1]!, 'jianxiong')).toBe(true)
    // 技能只挂在持有者身上：张飞没有奸雄，曹操没有咆哮
    expect(engine.skillRegistry.hasSkill(engine.state.players[0]!, 'jianxiong')).toBe(false)
    expect(engine.skillRegistry.hasSkill(engine.state.players[1]!, 'paoxiao')).toBe(false)
  })

  it('单一真值源：state 全生命周期只有一个实例', async () => {
    const boot = createBoot()
    const { engine } = await boot.boot()

    const before = engine.state
    await engine.init(engine.state.config)
    expect(engine.state).toBe(before)
  })

  it('咆哮：张飞出杀无次数限制，别人仍是一回合一张', async () => {
    const boot = createBoot()
    const { engine } = await boot.boot()

    const zhangFei = engine.state.players[0]!
    const caoCao = engine.state.players[1]!

    expect(zhangFei.heroes[0]?.id).toBe('zhangfei')

    const strike = Card.create(
      basicCards.find((def) => def.tags.includes(CardTag.Strike))!,
    )

    // 锁定技不需要等到「回合开始」那一刻——它是每次查询都要回答的数字。
    // 断言打在这儿而不是 `player.attackLimit`，因为后者没有任何地方读：
    // `PhaseManager.getPlayableCards` 走的是 `modQuery.cardUsable`。
    expect(engine.cardUsableCount(zhangFei, strike)).toBe(Infinity)
    expect(engine.cardUsableCount(caoCao, strike)).toBe(1)
  })

  it('奸雄：曹操受到伤害后获得造成伤害的牌', async () => {
    const boot = createBoot()
    const { engine } = await boot.boot()

    const zhangFei = engine.state.players[0]!
    const caoCao = engine.state.players[1]!

    // 拿出一张杀放进弃牌堆，模拟「已打出并结算的杀」
    const strike = engine.state.deck.find((c) => c.tags.has(CardTag.Strike))
    expect(strike).toBeDefined()
    strike!.zone = ZoneType.Discard
    engine.state.discardPile.push(strike!)

    const handBefore = caoCao.handCards.length

    const damageEvent = new GameEvent({
      name: 'damage',
      source: zhangFei,
      player: zhangFei,
      targets: [caoCao],
      cards: [strike!],
      phase: GamePhase.PhaseUse,
      round: engine.state.currentRound,
      data: { damageAmount: 1, damageCard: strike! },
    })
    await engine.eventDispatcher.dispatch(damageEvent, engine.eventChain)

    expect(caoCao.handCards).toContain(strike)
    expect(caoCao.handCards.length).toBe(handBefore + 1)
  })

  it('技能只绑定到持有者：曹操的回合开始不会触发张飞的咆哮', async () => {
    const boot = createBoot()
    const { engine } = await boot.boot()

    const zhangFei = engine.state.players[0]!
    const caoCao = engine.state.players[1]!

    await dispatchTurnStart(engine, caoCao)

    expect(zhangFei.attackLimit).toBe(1)
    expect(caoCao.attackLimit).toBe(1)
  })
})
