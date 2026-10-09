// ============================================================
// D3 / D4 —— 目标系统接进生产，距离真正生效
//
//   D3 `TargetSystem` 装配进了 GameEngine，但**零生产调用方**：
//      全部方法 `static`，只有测试在用。引擎里真正算目标的是
//      `PhaseManager.resolveTargetsForCard` —— 一份按牌型 if-else
//      堆出来的**副本**，与 TargetSystem 各写各的规则。
//   D4 那份副本里写着「简化处理，不计算距离」，
//      于是【杀】能指向场上任何活人，武器加的攻击范围毫无意义。
//
// 这两条是同一件事：副本不除，距离就永远进不来。
// 这里的用例因此不直接测 TargetSystem（那早就在测了），
// 而是测**引擎侧那份副本被换掉了**。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { TargetSystem } from '@core/system'
import { CardTag } from '@core/contracts/card-tag'
import { QingGangJian, MinusOneHorse, PlusOneHorse } from '@source/cards/equips'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { cardDef, createTestEnv, giveCard, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

/** 与 `src/source/cards/basic.ts` 的 sha 同 tags */
function sha(user: IPlayer): ICard {
  return giveCard(user, cardDef('sha', [CardTag.Strike, CardTag.Attack, CardTag.Basic]))
}

/**
 * 引擎侧的目标入口
 *
 * `getValidTargetsForCard` 是私有的——与 `boolean-mods.test.ts` 同一套做法：
 * 宁可断言私有方法，也不为了测试把内部实现改成 public。
 */
function engineTargetsFor(source: IPlayer, card: ICard): IPlayer[] {
  const pm = env.engine.phaseManager as unknown as {
    getValidTargetsForCard(p: IPlayer, c: ICard): IPlayer[]
  }
  return pm.getValidTargetsForCard(source, card)
}

describe('D3 · 副本已经消失 —— 引擎侧就是 TargetSystem', () => {
  it('两处算出来的目标列表完全一致', () => {
    const [source] = env.players()
    const card = sha(source!)

    expect(engineTargetsFor(source!, card).map((p) => p.id)).toEqual(
      TargetSystem.getAvailableTargets(source!, card, env.engine.state, env.engine.modQuery).map(
        (p) => p.id,
      ),
    )
  })

  it('桃园结义这类群体牌不再退化成「只有自己」', () => {
    const [source, other] = env.players()
    source!.hp = source!.maxHp - 1
    const taoYuan = giveCard(
      source!,
      cardDef('taoYuanJieYi', [
        CardTag.PeachGardenOath,
        CardTag.Trick,
        CardTag.Heal,
        CardTag.Aoe,
      ]),
    )

    expect(engineTargetsFor(source!, taoYuan).map((p) => p.id)).toContain(other!.id)
  })
})

describe('D4 · 距离与攻击范围真的参与筛选', () => {
  it('座次距离 2 的人默认打不到（攻击范围 1）', () => {
    const source = env.players()[0]!
    const far = env.players()[2]!
    const near = env.players()[1]!

    const ids = engineTargetsFor(source, sha(source)).map((p) => p.id)

    expect(ids).toContain(near.id)
    expect(ids).not.toContain(far.id)
  })

  it('装上攻击范围 2 的武器后就能打到 —— 武器不是摆设', () => {
    const source = env.players()[0]!
    const far = env.players()[2]!

    const sword = giveCard(source, QingGangJian as never)
    env.engine.cardSystem.equipCard(sword, source)

    const ids = engineTargetsFor(source, sha(source)).map((p) => p.id)

    expect(ids).toContain(far.id)
  })
})

describe('Phase 21 验收 · ±1 马影响可选目标', () => {
  /**
   * 机制本来就是通的：`equip-effects.ts` 把 `distanceTo` / `distanceFrom`
   * 挂在马自己的技能上，`DistanceSystem` 每次算距离都会读。
   * 缺的从来不是实现，是一条盯着它的断言——
   * 于是「马到底有没有生效」在验收表里一直是空的。
   */
  it('装 -1 马 → 我算到别人的距离 -1，原本够不着的人进了可选列表', () => {
    const source = env.players()[0]!
    const far = env.players()[2]!

    const before = engineTargetsFor(source, sha(source)).map((p) => p.id)
    expect(before).not.toContain(far.id)

    const horse = giveCard(source, MinusOneHorse as never)
    env.engine.cardSystem.equipCard(horse, source)

    expect(env.engine.getDistance(source, far)).toBe(1)
    expect(engineTargetsFor(source, sha(source)).map((p) => p.id)).toContain(far.id)
  })

  it('别人装 +1 马 → 我算到他的距离 +1，原本够得着的人退出了可选列表', () => {
    const source = env.players()[0]!
    const near = env.players()[1]!

    const before = engineTargetsFor(source, sha(source)).map((p) => p.id)
    expect(before).toContain(near.id)

    const horse = giveCard(near, PlusOneHorse as never)
    env.engine.cardSystem.equipCard(horse, near)

    expect(env.engine.getDistance(source, near)).toBe(2)
    expect(engineTargetsFor(source, sha(source)).map((p) => p.id)).not.toContain(near.id)
  })

  it('+1 马只挡别人，不影响自己出杀的距离', () => {
    const source = env.players()[0]!
    const near = env.players()[1]!
    const far = env.players()[2]!

    const horse = giveCard(source, PlusOneHorse as never)
    env.engine.cardSystem.equipCard(horse, source)

    // 自己那匹防御马不该让自己变远
    expect(env.engine.getDistance(source, near)).toBe(1)
    expect(env.engine.getDistance(source, far)).toBe(2)
  })
})

describe('Phase 21 · 规则内容：技能改写距离这条路是通的', () => {
  /**
   * Phase 21 剩的第三块是「规则**内容**」——马之外还有藤甲、技能改写
   * 距离等来源要不要走 Mod。盘点结论：
   *
   * | 来源 | 现值 | 在哪 |
   * |---|---|---|
   * | 武器攻击范围 | 已是 Mod | `mods/equip-mods.ts` `weaponRangeMod` |
   * | ±1 马 | 已是 Mod | `effects/equip-effects.ts`（跟着卡牌 effectIds） |
   * | 藤甲 | 已是 Mod（**伤害**不是距离，`damageTo`） | `mods/equip-mods.ts` `rattanArmorMod` |
   * | 武将技能改写距离 | **当前武将池 0 条** | —— |
   *
   * 武将技能这条不该「为了有而凑一个」（现有 10 个武将没有一个带距离技）。
   * 真正要钉住的是**机制**：一条带 `mod.distanceFrom` 的技能挂上去，
   * 可选目标必须跟着变。下面临时挂一条验证这条链路，
   * 将来任何武将写距离技都走同一条路。
   */
  it('挂一条 mod.distanceFrom 的技能 → 可选目标随之扩大', () => {
    const source = env.players()[0]!
    const far = env.players()[2]!

    expect(engineTargetsFor(source, sha(source)).map((p) => p.id)).not.toContain(far.id)

    env.engine.skillRegistry.register({
      id: 'test:farReach',
      name: '测试·远击',
      description: '测试用：距离 -1',
      mod: { distanceFrom: (value) => value - 1 },
    })
    env.engine.skillRegistry.attach(source, 'test:farReach')

    expect(env.engine.getDistance(source, far)).toBe(1)
    expect(engineTargetsFor(source, sha(source)).map((p) => p.id)).toContain(far.id)
  })

  it('技能卸掉以后距离回到原样 —— Mod 不留存量', () => {
    const source = env.players()[0]!
    const far = env.players()[2]!

    env.engine.skillRegistry.register({
      id: 'test:farReach2',
      name: '测试·远击2',
      description: '测试用：距离 -1',
      mod: { distanceFrom: (value) => value - 1 },
    })
    env.engine.skillRegistry.attach(source, 'test:farReach2')
    expect(env.engine.getDistance(source, far)).toBe(1)

    env.engine.skillRegistry.detach(source, 'test:farReach2')
    expect(env.engine.getDistance(source, far)).toBe(2)
  })
})
