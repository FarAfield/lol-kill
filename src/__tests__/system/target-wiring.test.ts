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
import { QingGangJian } from '@source/cards/equips'
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
