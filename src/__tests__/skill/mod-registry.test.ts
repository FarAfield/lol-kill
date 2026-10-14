// ============================================================
// Phase 11 验收：ModRegistry 数值修改器
//
// 清单 #1–#9 的对应 plus Phase 9 欠下的 #13（cardCancelable）。
//
// 走**真实引擎**（createTestEnv）而不是裸测注册表：历史上
// 「mod 注册了但从来没人查」「 mod 改的是另一个玩家的距离」
// 都是端到端跑一遍才发现的。
// ============================================================

import { describe, it, expect } from 'vitest'
import { createTestEnv, cardDef, giveCard } from '../helpers/game-env'
import { ModRegistry, ModPurityError } from '@core/skill/mod-registry'
import { canBeCountered } from '@core/event/cancel-chain'
import { GameEvent } from '@core/event/game-event'
import { Card } from '@core/entity/card'
import { DamageType, ZoneType } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import type { IModDefinition } from '@core/contracts/mod.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { TengJia, QingGangJian, PlusOneHorse, MinusOneHorse, ZhuGeLianNu } from '@source/cards/equips'
import { Sha, HuoSha, LeiSha } from '@source/cards/basic'

async function env() {
  return createTestEnv()
}

/** 给某人装上某个装备（走真实 CardSystem，保证 zone / owner 正确） */
function equip(
  engine: Awaited<ReturnType<typeof env>>['engine'],
  player: IPlayer,
  def: Parameters<typeof giveCard>[1],
): ICard {
  const card = giveCard(player, def)
  engine.cardSystem.equipCard(card, player)
  return card
}

/**
 * 让某个玩家受一次伤害，返回**结算后的伤害点数**
 *
 * 两点说明，都是踩过的坑：
 * - 断言读 `event.values.num`（伤害流水线定稿的数值），不能读血量差：
 *   `loseHp` 会把实际扣减裁到剩余体力，血量差最大只能等于当前体力。
    // 每次先把体力垫高并绕过濒死，否则前一发把人打死后
    // 后续伤害不再扣血，看不出 Mod 有没有生效。
 */
async function hit(
  engine: Awaited<ReturnType<typeof env>>['engine'],
  source: IPlayer,
  target: IPlayer,
  card?: ICard,
): Promise<number> {
  target.hp = 5
  target.alive = true
  const event = new GameEvent({
    name: 'damage',
    source,
    player: source,
    targets: [target],
    cards: card ? [card] : [],
    num: 1,
  })
  await engine.eventDispatcher.dispatch(event, engine.eventChain)
  target.hp = 5
  target.alive = true
  return event.values.num
}

describe('Phase 11 · ModRegistry 数值修改器', () => {
  // ── 伤害 ──

  it('注册 globalDamageFrom +1 → 全场任意人的伤害 +1', async () => {
    const { engine, players } = await env()
    const [a, b, victim] = players()

    expect(await hit(engine, a, victim)).toBe(1)

    engine.modRegistry.register({
      id: 'test:globalDamageFrom',
      mods: { globalDamageFrom: (v) => v + 1 },
    })

    expect(await hit(engine, a, victim)).toBe(2)
    // 换个来源也一样 —— global 不挑人
    expect(await hit(engine, b, victim)).toBe(2)
  })

  it('注册 damageFrom 且持有者为 A → 只有 A 的伤害 +1，B 的不变', async () => {
    const { engine, players } = await env()
    const [a, b, victim] = players()

    engine.modRegistry.register({
      id: 'test:damageFromA',
      owners: () => [a],
      mods: { damageFrom: (v) => v + 1 },
    })

    expect(await hit(engine, a, victim)).toBe(2)
    expect(await hit(engine, b, victim)).toBe(1)
  })

  it('藤甲 + 火杀 → 伤害 +1；藤甲 + 普通杀 → 不变', async () => {
    const { engine, players } = await env()
    const [a, victim] = players()

    const fire = giveCard(a, HuoSha)
    const plain = giveCard(a, Sha)

    // 装藤甲之前：火杀也是 1 点
    expect(await hit(engine, a, victim, fire)).toBe(1)

    equip(engine, victim, TengJia)

    expect(await hit(engine, a, victim, plain)).toBe(1)
    expect(await hit(engine, a, victim, fire)).toBe(2)
    // 受到的雷属性伤害不受藤甲影响（Mod 只认火）
    const thunder = giveCard(a, LeiSha)
    expect(await hit(engine, a, victim, thunder)).toBe(1)
  })

  it('damageTo 只看受伤方：换个人打藤甲之外的目标不受影响', async () => {
    const { engine, players } = await env()
    const [a, victim, other] = players()
    equip(engine, victim, TengJia)

    const fire = giveCard(a, HuoSha)
    expect(await hit(engine, a, other, fire)).toBe(1)
    expect(await hit(engine, a, victim, fire)).toBe(2)
  })

  // ── 距离与范围 ──

  it('-1 马 / +1 马：双向修正生效', async () => {
    const { engine, players } = await env()
    const [p0, p1, p2] = players()

    // 5 人局：0 与 2 座次距离 2
    expect(engine.getDistance(p0, p2)).toBe(2)

    // p0 装 -1 马 → 他算到别人 -1
    equip(engine, p0, MinusOneHorse)
    expect(engine.getDistance(p0, p2)).toBe(1)
    // 别人（p1）算到 p2 不受 p0 的马影响
    expect(engine.getDistance(p1, p2)).toBe(1) // 座次相邻本来就是 1
    expect(engine.getDistance(p2, p0)).toBe(2) // 反方向也不受影响

    // p2 装 +1 马 → 别人算到他 +1
    equip(engine, p2, PlusOneHorse)
    expect(engine.getDistance(p0, p2)).toBe(2) // -1 +1 抵消
    expect(engine.getDistance(p1, p2)).toBe(2) // 1 + 1
  })

  it('武器攻击范围：基础 1，青釭剑 → 2（以武器自己写的数为准）', async () => {
    const { engine, players } = await env()
    const [p0] = players()

    expect(engine.getAttackRange(p0)).toBe(1)
    equip(engine, p0, QingGangJian)
    // 青釭剑的定义写着「攻击范围 2」。早先是「基础 1 + 武器的数」，
    // 于是每张武器都凭空多出一格（欠账 D41 顺带修掉的那个 bug）。
    expect(engine.getAttackRange(p0)).toBe(2)
  })

  // ── 出牌次数 ──

  it('诸葛连弩 → 【杀】的使用次数为 Infinity，其它牌不受影响', async () => {
    const { engine, players } = await env()
    const [p0] = players()
    const sha = giveCard(p0, Sha)
    const trick = giveCard(p0, cardDef('nanManRuQin', [CardTag.Trick, CardTag.BarbarianRaid]))

    expect(engine.cardUsableCount(p0, sha)).toBe(1)

    equip(engine, p0, ZhuGeLianNu)
    expect(engine.cardUsableCount(p0, sha)).toBe(Infinity)
    expect(engine.cardUsableCount(p0, trick)).toBe(Infinity)
  })

  // ── 叠加 / 顺序 ──

  it('两个 +1 mod 同时存在 → base + 2（叠加正确）', async () => {
    const { engine, players } = await env()
    const [a, victim] = players()

    engine.modRegistry.register({
      id: 'test:+1a',
      owners: () => [a],
      mods: { damageFrom: (v) => v + 1 },
    })
    engine.modRegistry.register({
      id: 'test:+1b',
      owners: () => [a],
      mods: { damageFrom: (v) => v + 1 },
    })

    expect(await hit(engine, a, victim)).toBe(3)
  })

  it('顺序确定：按 priority 降序结算，与注册顺序无关', async () => {
    const build = (
      id: string,
      priority: number,
      fn: (v: number) => number,
      owner: IPlayer,
    ): IModDefinition => ({
      id,
      priority,
      owners: () => [owner],
      mods: { damageFrom: fn },
    })

    // 非交换运算：顺序不同结果就不同，能验出真正的结算次序
    const tenFold = (v: number) => v * 10
    const plusOne = (v: number) => v + 1

    // 注册顺序 1：低优先级先注册
    const first = await env()
    const [a1, victim1] = first.players()
    first.engine.modRegistry.register(build('test:low', 0, plusOne, a1))
    first.engine.modRegistry.register(build('test:high', 10, tenFold, a1))
    expect(await hit(first.engine, a1, victim1)).toBe(11) // (1*10)+1

    // 注册顺序 2：全新一局，反过来注册，结果必须一样
    const second = await env()
    const [a2, victim2] = second.players()
    second.engine.modRegistry.register(build('test:high', 10, tenFold, a2))
    second.engine.modRegistry.register(build('test:low', 0, plusOne, a2))
    expect(await hit(second.engine, a2, victim2)).toBe(11)
  })

  // ── 持有者失效 ──

  it('持有者死亡后其 mod 自动不再生效（无需清理代码）', async () => {
    const { engine, players } = await env()
    const [a, victim] = players()

    engine.modRegistry.register({
      id: 'test:mortal',
      owners: () => [a],
      mods: { damageFrom: (v) => v + 1 },
    })
    expect(await hit(engine, a, victim)).toBe(2)

    a.alive = false
    expect(await hit(engine, a, victim)).toBe(1)
    a.alive = true
  })

  it('卸下装备 → 下一次查询即不再命中', async () => {
    const { engine, players } = await env()
    const [p0, , p2] = players()

    const horse = equip(engine, p0, MinusOneHorse)
    expect(engine.getDistance(p0, p2)).toBe(1)

    engine.cardSystem.unequipCard(horse, p0)
    expect(engine.getDistance(p0, p2)).toBe(2)
  })

  // ── 纯函数约束 ──

  it('Mod 内修改 ctx.game → 抛 ModPurityError', async () => {
    const { engine, players } = await env()
    const [a, victim] = players()

    engine.modRegistry.register({
      id: 'test:impure',
      owners: () => [a],
      mods: {
        damageFrom: (v, ctx) => {
          // 往牌堆里塞一张 —— 典型的「顺手改状态」
          ctx.game.deck.push(Card.create(cardDef('smuggled', CardTag.Strike)))
          return v
        },
      },
    })

    await expect(hit(engine, a, victim)).rejects.toThrow(ModPurityError)
  })

  it('Mod 能通过只读代理读东西（读数不算违规）', async () => {
    const { engine, players } = await env()
    const [a, victim] = players()
    let seen = -1

    engine.modRegistry.register({
      id: 'test:reader',
      owners: () => [a],
      mods: {
        damageFrom: (v, ctx) => {
          seen = ctx.game.players.length
          // 只读不写：payload 取出来看一眼，原样返回
          void ctx.payload
          return v
        },
      },
    })

    expect(await hit(engine, a, victim)).toBe(1)
    expect(seen).toBe(players().length)
  })

  it('Mod 也能识别「自己是谁」—— owner 就是持有者', async () => {
    const { engine, players } = await env()
    const [a, victim] = players()
    let ownerSeen = ''

    engine.modRegistry.register({
      id: 'test:owner',
      owners: () => [a],
      mods: {
        damageFrom: (v, ctx) => {
          ownerSeen = `${ctx.owner?.id ?? '-'}/${ctx.player.id}`
          return v
        },
      },
    })

    await hit(engine, a, victim)
    expect(ownerSeen).toBe(`${a.id}/${a.id}`)
  })

  it('ModRegistry 自身：重复注册覆盖、注销生效', async () => {
    const registry = new ModRegistry()
    const one: IModDefinition = { id: 'dup', mods: { attackRange: () => 99 } }
    const two: IModDefinition = { id: 'dup', mods: { attackRange: (v) => v + 5 } }

    registry.register(one)
    registry.register(two)
    expect(registry.size).toBe(1)

    const { engine, players } = await env()
    const [p0] = players()
    expect(registry.queryNumeric('attackRange', 1, { player: p0, game: engine.state })).toBe(6)

    expect(registry.unregister('dup')).toBe(true)
    expect(registry.unregister('dup')).toBe(false)
    expect(registry.queryNumeric('attackRange', 1, { player: p0, game: engine.state })).toBe(1)
  })

  // ── 回合数值 ──

  it('maxHandcard / drawCount Mod 生效', async () => {
    const { engine, players } = await env()
    const [p0] = players()

    expect(engine.getMaxHandcard(p0)).toBe(p0.hp)

    engine.modRegistry.register({
      id: 'test:hand',
      owners: () => [p0],
      mods: { maxHandcard: (v) => v + 2 },
    })
    expect(engine.getMaxHandcard(p0)).toBe(p0.hp + 2)

    engine.modRegistry.register({
      id: 'test:draw',
      owners: () => [p0],
      mods: { drawCount: (v) => v + 1 },
    })
    expect(engine.modQuery.drawCount(p0)).toBe(3)
  })

  // ── 布尔否决（清单 #13）──

  it('cardCancelable 返回 false → 该锦囊不可被无懈可击', async () => {
    const { engine, players } = await env()
    const [p0, p1] = players()

    const trick = giveCard(p0, cardDef('nanManRuQin', [CardTag.Trick, CardTag.BarbarianRaid]))
    trick.zone = ZoneType.Processing

    const make = () =>
      new GameEvent({
        name: 'nanManRuQin',
        source: p0,
        player: p0,
        targets: [p1],
        cards: [trick],
        cancelable: true,
      })

    expect(canBeCountered(make())).toBe(true)

    engine.modRegistry.register({
      id: 'test:uncounterable',
      owners: () => [p0],
      mods: { cardCancelable: () => false },
    })

    expect(canBeCountered(make())).toBe(false)
  })

  it('Phase 10 的 extraDamage 通道与 Mod 并存（两者累加）', async () => {
    const { engine, players } = await env()
    const [a, victim] = players()

    engine.modRegistry.register({
      id: 'test:plusOne',
      owners: () => [a],
      mods: { damageFrom: (v) => v + 1 },
    })

    const event = new GameEvent({
      name: 'damage',
      source: a,
      player: a,
      targets: [victim],
      num: 1,
    })
    event.values.extraDamage = 1
    await engine.eventDispatcher.dispatch(event, engine.eventChain)

    expect(event.values.num).toBe(3) // 1 base + 1 mod + 1 extra
  })

  it('完整的一击：来源手续 + 受伤方易伤同时生效', async () => {
    const { engine, players } = await env()
    const [a, victim] = players()

    engine.modRegistry.register({
      id: 'test:strong',
      owners: () => [a],
      mods: { damageFrom: (v) => v + 1 },
    })
    engine.modRegistry.register({
      id: 'test:fragile',
      owners: () => [victim],
      mods: { damageTo: (v) => v + 1 },
    })

    const fire = giveCard(a, HuoSha)
    equip(engine, victim, TengJia)

    expect(await hit(engine, a, victim, fire)).toBe(4) // 1 + 1 + 1 + 藤甲火易伤 1
  })

  it('Mod 不认识的人和事都不掺和：damageTo 不会被算来源方的伤害里', async () => {
    const { engine, players } = await env()
    const [a, victim, other] = players()

    engine.modRegistry.register({
      id: 'test:victimOnly',
      owners: () => [victim],
      mods: { damageTo: (v) => v + 1 },
    })

    expect(await hit(engine, a, other)).toBe(1)
    expect(await hit(engine, a, victim)).toBe(2)
    expect(DamageType.Fire).toBe('fire')
  })
})
