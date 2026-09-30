// ============================================================
// PlayerSystem —— 玩家状态的唯一写入点
//
// 这里的每一条用例都对应一个「曾经散落在各处、且各写各的」的夹取规则。
// 它们单独看都很傻（谁不知道 hp 不能为负？），真正的价值在于：
// 这些规则**只有一个地方写着**，而这里是那个地方的守护绳。
// 哪天有人图省事在某个技能里写一句 `target.hp -= 2`，
// 类型不会报错、测试也可能照样过——但夹取规则就分叉了。
// 最后一组用例就是为此设的：它断言「实体上不存在这些方法」，
// 让「绕过系统层」这件事至少要在删掉一条测试时才会发生。
// ============================================================

import { describe, it, expect } from 'vitest'
import { Player } from '@core/entity/player'
import { PlayerSystem } from '@core/system/player-system'
import { RoleType } from '@core/contracts/enums'
import type { IHero } from '@core/contracts/hero.interface'
import type { IPlayer } from '@core/contracts/player.interface'

const ps = new PlayerSystem()

function makePlayer(overrides: Partial<IPlayer> = {}): Player {
  return new Player({
    id: 'p0',
    seatIndex: 0,
    hp: 4,
    maxHp: 4,
    ...overrides,
  })
}

function makeHero(id: string, maxHp: number, maxPower = 0): IHero {
  return { id: id as never, name: id, title: '', kingdom: 0 as never, maxHp, maxPower, effectIds: [] }
}

describe('PlayerSystem · 体力', () => {
  it('扣血返回实际扣减量，下限为 0', () => {
    const p = makePlayer({ hp: 4, maxHp: 4 })
    expect(ps.loseHp(p, 3)).toBe(3)
    expect(p.hp).toBe(1)
    // 打过头只掉到 0，返回值是**实际**掉的，不是要掉的
    expect(ps.loseHp(p, 99)).toBe(1)
    expect(p.hp).toBe(0)
  })

  it('扣血不判定死亡——hp 归零不等于 alive 翻假', () => {
    const p = makePlayer({ hp: 1, maxHp: 4 })
    ps.loseHp(p, 5)
    expect(p.hp).toBe(0)
    expect(p.alive).toBe(true)
    // 死亡是 DeathSystem 的事：两者分开，被救回来才不必撤销一次已发生的死亡
  })

  it('非正数扣血不动状态', () => {
    const p = makePlayer()
    expect(ps.loseHp(p, 0)).toBe(0)
    expect(ps.loseHp(p, -3)).toBe(0)
    expect(p.hp).toBe(4)
  })

  it('回血封顶在上限，且按**实际**涨幅记账', () => {
    const p = makePlayer({ hp: 3, maxHp: 4 })
    // 想回 5 只回得进 1——返回值必须是 1，否则日志会写出「回复了 5 点」
    expect(ps.recoverHp(p, 5)).toBe(1)
    expect(p.hp).toBe(4)
  })

  it('非正数回血不动状态', () => {
    const p = makePlayer({ hp: 2, maxHp: 4 })
    expect(ps.recoverHp(p, 0)).toBe(0)
    expect(ps.recoverHp(p, -2)).toBe(0)
    expect(p.hp).toBe(2)
  })

  it('濒死救活是「设为」而非「回复」——负血也要能救回来', () => {
    const p = makePlayer({ hp: -2, maxHp: 4 })
    // 溢出伤害把 hp 打到负数，此时 recoverHp(1) 只能到 -1，救不活
    ps.recoverHp(p, 1)
    expect(p.hp).toBe(-1)
    ps.resurrect(p, 1)
    expect(p.hp).toBe(1)
  })

  it('救活也不会越过上限', () => {
    const p = makePlayer({ hp: 0, maxHp: 2 })
    ps.resurrect(p, 99)
    expect(p.hp).toBe(2)
  })
})

describe('PlayerSystem · 上限变动连带裁剪', () => {
  it('上限下调时，当前体力跟着裁下来', () => {
    const p = makePlayer({ hp: 4, maxHp: 4 })
    ps.modifyMaxHp(p, -2)
    expect(p.maxHp).toBe(2)
    expect(p.hp).toBe(2)
  })

  it('上限下调不会把 hp 拉成负数', () => {
    const p = makePlayer({ hp: 3, maxHp: 3 })
    ps.modifyMaxHp(p, -10)
    expect(p.maxHp).toBe(0)
    expect(p.hp).toBe(0)
  })

  it('上限上调不越界——当前体力原地不动', () => {
    const p = makePlayer({ hp: 2, maxHp: 4 })
    ps.modifyMaxHp(p, 3)
    expect(p.maxHp).toBe(7)
    expect(p.hp).toBe(2)
  })

  it('setMaxHp 与 modifyMaxHp 遵守同一套裁剪', () => {
    const p = makePlayer({ hp: 4, maxHp: 4 })
    ps.setMaxHp(p, 1)
    expect(p.hp).toBe(1)
  })

  it('resetHp 把血与上限一起定下来并回满', () => {
    const p = makePlayer({ hp: 1, maxHp: 5 })
    ps.resetHp(p, 3)
    expect(p.maxHp).toBe(3)
    expect(p.hp).toBe(3)
  })
})

describe('PlayerSystem · 能量', () => {
  it('消耗能量返回实际消耗量，下限为 0', () => {
    const p = makePlayer({ power: 2, maxPower: 3 })
    expect(ps.consumePower(p, 1)).toBe(1)
    expect(p.power).toBe(1)
    expect(ps.consumePower(p, 10)).toBe(1)
    expect(p.power).toBe(0)
  })

  it('获得能量封顶在上限', () => {
    const p = makePlayer({ power: 2, maxPower: 3 })
    ps.gainPower(p, 5)
    expect(p.power).toBe(3)
  })

  it('能量上限下调时当前能量跟着裁', () => {
    const p = makePlayer({ power: 3, maxPower: 3 })
    ps.modifyMaxPower(p, -2)
    expect(p.maxPower).toBe(1)
    expect(p.power).toBe(1)
  })
})

describe('PlayerSystem · 选英雄', () => {
  it('选英雄一并定下体力与能量上限并回满', () => {
    const p = makePlayer({ hp: 0, maxHp: 0 })
    ps.chooseHeroes(p, [makeHero('h1', 4, 2)])
    expect(p.maxHp).toBe(4)
    expect(p.hp).toBe(4)
    expect(p.maxPower).toBe(2)
    expect(p.power).toBe(2)
  })

  it('主公加成挂在选英雄上——默认分配那条分支不会漏', () => {
    // 历史上 GameEngine.assignHeroes 把「+1 上限」抄了两遍（自选一份、
    // 默认一份），改一处就漏另一处。加成跟着英雄走才不存在这个岔路。
    const p = makePlayer({ role: RoleType.Aspect })
    ps.chooseHeroes(p, [makeHero('h1', 4)], 1)
    expect(p.maxHp).toBe(5)
    expect(p.hp).toBe(5)
  })

  it('英雄没有能量上限时按 0 处理', () => {
    const p = makePlayer()
    ps.chooseHeroes(p, [{ ...makeHero('h1', 3), maxPower: undefined }])
    expect(p.maxPower).toBe(0)
    expect(p.power).toBe(0)
  })

  it('空英雄列表不动血量', () => {
    const p = makePlayer({ hp: 4, maxHp: 4 })
    ps.chooseHeroes(p, [])
    expect(p.heroes).toEqual([])
    expect(p.hp).toBe(4)
  })
})

describe('PlayerSystem · 存活与身份', () => {
  it('setAlive 是「在场与否」的唯一真值源', () => {
    const p = makePlayer()
    ps.setAlive(p, false)
    expect(p.alive).toBe(false)
    ps.setAlive(p, true)
    expect(p.alive).toBe(true)
  })

  it('公开身份不可逆——只提供 reveal，不提供 hide', () => {
    const p = makePlayer()
    ps.revealRole(p)
    expect(p.roleRevealed).toBe(true)
    expect(typeof (ps as unknown as Record<string, unknown>).hideRole).toBe('undefined')
  })
})

describe('PlayerSystem · 标记', () => {
  it('读取不存在的标记返回 0', () => {
    expect(ps.getMark(makePlayer(), 'nope')).toBe(0)
  })

  it('增减标记返回新值', () => {
    const p = makePlayer()
    expect(ps.addMark(p, 'k')).toBe(1)
    expect(ps.addMark(p, 'k', 2)).toBe(3)
    expect(ps.getMark(p, 'k')).toBe(3)
  })

  it('清除后回到 0，而不是留下一个 0 值', () => {
    const p = makePlayer()
    ps.setMark(p, 'k', 5)
    ps.clearMark(p, 'k')
    expect(ps.getMark(p, 'k')).toBe(0)
    expect(p.marks.has('k')).toBe(false)
  })
})

describe('PlayerSystem · 回合追踪', () => {
  it('重置清掉本回合的攻击记录与阶段跳过', () => {
    const p = makePlayer()
    ps.markAttackUsed(p)
    p.shouldSkipPhases.push(1 as never)
    ps.resetTurnState(p)
    expect(p.usedAttackThisTurn).toBe(false)
    expect(p.attackLimit).toBe(1)
    expect(p.shouldSkipPhases).toEqual([])
    expect(p.skippedPhases).toEqual([])
  })

  it('markAttackUsed 只在账本上记一笔', () => {
    const p = makePlayer()
    expect(p.usedAttackThisTurn).toBe(false)
    ps.markAttackUsed(p)
    expect(p.usedAttackThisTurn).toBe(true)
  })
})

// ── 结构护栏 ──
//
// 这一组不测行为，测的是「没有别的路可走」。
// 删掉任意一个方法名，就等于宣布那条路重新开放——那应该是一个
// 需要有人拍板的决定，而不是顺手一加。

describe('状态变更收口 · 结构护栏', () => {
  /** 数值与标记类 —— 收编进 PlayerSystem（同名） */
  const movedToPlayerSystem = [
    'loseHp',
    'recoverHp',
    'modifyMaxHp',
    'consumePower',
    'gainPower',
    'modifyMaxPower',
    'chooseHeroes',
    'setMark',
    'addMark',
    'clearMark',
    'resetTurnState',
    'markAttackUsed',
  ]

  /**
   * 卡牌区域类 —— 收编进 CardSystem
   *
   * 注意它们是**换名收编**而不是原样搬过去：手牌的进出在 CardSystem 里
   * 叫 `obtainCard` / `discardCard`，判定区叫 `placeJudgeCard` / `finishJudge`。
   * 改名不是折腾——旧名字描述的是「数组怎么动」，新名字描述的是
   * 「牌到了哪个区域」，而后者的语义才包含 zone / owner / visibleTo 一起变。
   */
  const movedToCardSystem: Array<[oldName: string, newName: string]> = [
    ['addHandCards', 'obtainCard'],
    ['removeHandCards', 'discardCard'],
    ['equipCard', 'equipCard'],
    ['unEquipSlot', 'unequipCard'],
    ['addJudgeCard', 'placeJudgeCard'],
    ['removeJudgeCard', 'finishJudge'],
  ]

  it('Player 实体上不再有任何状态变更方法', () => {
    const p = makePlayer() as unknown as Record<string, unknown>
    const all = [...movedToPlayerSystem, ...movedToCardSystem.map(([old]) => old)]
    for (const name of all) {
      expect(typeof p[name], `Player.${name} 应当已被移除`).toBe('undefined')
    }
  })

  it('数值与标记类变更在 PlayerSystem 上有且只有一处实现', () => {
    const proto = PlayerSystem.prototype as unknown as Record<string, unknown>
    for (const name of movedToPlayerSystem) {
      expect(typeof proto[name], `PlayerSystem.${name} 应当存在`).toBe('function')
    }
  })

  it('PlayerSystem 里没有任何一处卡牌区域写入', () => {
    // 牌的 zone / owner / visibleTo 必须一起改，拆成两处就会出现
    // 「牌在手牌数组里、zone 却写着 Deck」这种半身不遂。
    const proto = PlayerSystem.prototype as unknown as Record<string, unknown>
    for (const [, newName] of movedToCardSystem) {
      expect(typeof proto[newName], `PlayerSystem 不应有 ${newName}`).toBe('undefined')
    }
  })

  it('Player 仍保留只读派生与查询——收口不是把读也砍了', () => {
    const p = makePlayer()
    expect(typeof p.getMark).toBe('function')
    expect(typeof p.getEquipInSlot).toBe('function')
    expect(typeof p.isDying).toBe('boolean')
    expect(typeof p.attackRange).toBe('number')
  })
})
