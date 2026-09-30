// ============================================================
// D5 / D6 —— 两处「同一个 tag 与自己重复」的条件
//
//   target-system.ts   tags.has(Heal) && tags.has(Heal)
//   phase-manager.ts   card.tags.has(Heal) || card.tags.has(Heal)
//
// 两处都是恒等式，等于只判了一次。可疑点在于**带 Heal 的牌不止一张**：
// 【桃】是 [Heal, Basic, Dying]，【桃园结义】是 [PeachGardenOath, Trick, Heal, Aoe]。
// 于是第二张被第一张的目标规则吃掉了——桃园结义「只能对自己用」。
//
// 本文件把两类的目标范围分别钉住，让「重复条件」这件事
// 不再只是一个肉眼看得见、机器却不会报错的坏味道。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { TargetSystem } from '@core/system'
import { CardTag } from '@core/contracts/card-tag'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { cardDef, createTestEnv, giveCard, type TestEnv } from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
})

// ── 工具 ──

/** 【桃】—— 与 `src/source/cards/basic.ts` 的 Tao 同 tags */
function peach(user: IPlayer): ICard {
  return giveCard(user, cardDef('tao', [CardTag.Heal, CardTag.Basic, CardTag.Dying]))
}

/**
 * 【桃园结义】—— 与 `src/source/cards/tricks.ts` 的 taoYuanJieYi 同 tags
 *
 * 它同时带 `Heal` 与 `Aoe`：这正是能抓住「重复条件」的那张牌。
 */
function peachGarden(user: IPlayer): ICard {
  return giveCard(
    user,
    cardDef('taoYuanJieYi', [
      CardTag.PeachGardenOath,
      CardTag.Trick,
      CardTag.Heal,
      CardTag.Aoe,
    ]),
  )
}

function targetsFor(source: IPlayer, card: ICard): IPlayer[] {
  return TargetSystem.getAvailableTargets(source, card, env.engine.state, env.engine.modQuery)
}

/**
 * 引擎侧的目标入口（`PhaseManager.getValidTargetsForCard`，私有）
 *
 * 与 `boolean-mods.test.ts` 同一套做法：宁可断言私有方法，
 * 也不为了测试把内部实现改成 public。
 */
function engineTargetsFor(source: IPlayer, card: ICard): IPlayer[] {
  const pm = env.engine.phaseManager as unknown as {
    getValidTargetsForCard(p: IPlayer, c: ICard): IPlayer[]
  }
  return pm.getValidTargetsForCard(source, card)
}

// ── 桃：自己（受伤时）或濒死角色 ──

describe('桃 —— [Heal, Basic, Dying]', () => {
  it('受伤时目标是自己', () => {
    const [source] = env.players()
    source.hp = source.maxHp - 1

    expect(targetsFor(source!, peach(source!)).map((p) => p.id)).toEqual([source!.id])
  })

  it('满血且无人濒死时没有合法目标', () => {
    const [source] = env.players()

    expect(targetsFor(source!, peach(source!))).toEqual([])
  })

  it('他人濒死时可以指向他（不只是自己）', () => {
    const [source, dying] = env.players()
    dying!.hp = 0

    expect(targetsFor(source!, peach(source!)).map((p) => p.id)).toContain(dying!.id)
  })
})

// ── 桃园结义：带 Heal，但不是桃 ──

describe('桃园结义 —— [PeachGardenOath, Trick, Heal, Aoe]', () => {
  it('不被桃的规则吃掉：目标不止自己', () => {
    const [source, other] = env.players()
    const ids = targetsFor(source!, peachGarden(source!)).map((p) => p.id)

    expect(ids).toContain(other!.id)
    expect(ids).not.toContain(source!.id)
  })

  it('受伤时同样不该退化成「只有自己」', () => {
    const [source, other] = env.players()
    source!.hp = source!.maxHp - 1

    // 这一条是重复条件的直接症状：桃那条分支按 `player.isWounded` 返回 [自己]，
    // 与「群体效果」完全相反。
    const ids = targetsFor(source!, peachGarden(source!)).map((p) => p.id)

    expect(ids).toContain(other!.id)
    expect(ids).not.toContain(source!.id)
  })

  it('目标数是 0 —— 群体牌不逐个选目标', () => {
    const [source] = env.players()

    expect(TargetSystem.getMinTargets(peachGarden(source!))).toBe(0)
    expect(TargetSystem.getMaxTargets(peachGarden(source!), source!)).toBe(0)
  })
})

// ── 引擎侧同一处笔误 ──
//
// 这一组原本盯的是 `PhaseManager.resolveTargetsForCard` —— 一份与
// TargetSystem 并存的**副本**。D3/D4 清偿时那份副本被删掉了，
// 引擎侧现在直接问 TargetSystem，所以这里改成断言「两处一致」：
// 副本不会再悄悄长回来。

describe('PhaseManager 的目标入口 —— 与 TargetSystem 同源', () => {
  it('桃：受伤时目标是自己', () => {
    const [source] = env.players()
    source!.hp = source!.maxHp - 1

    expect(engineTargetsFor(source!, peach(source!)).map((p) => p.id)).toEqual([source!.id])
  })

  it('桃园结义：不走桃那条分支', () => {
    const [source, other] = env.players()
    source!.hp = source!.maxHp - 1

    const ids = engineTargetsFor(source!, peachGarden(source!)).map((p) => p.id)

    expect(ids).toContain(other!.id)
  })
})
