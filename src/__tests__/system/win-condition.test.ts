// ============================================================
// D17 —— 胜负判定抽成纯函数（形态甲）
//
// 搬迁前，「谁赢了」写在 `DeathSystem.checkGameOver` 里：
// 它是一个**系统实例方法**，验一条规则得先打完一局（`system-smoke.test.ts`
// 那两条就是这么写的，于是只能覆盖两条路径）。
//
// 形态甲把它抽成 `WinCondition.evaluate(snapshot)` —— 纯函数，
// 直接喂状态。这里因此能把 **9 种终局**逐个钉住，而不用真打一局。
//
// 用例一律**不启动引擎**，只喂 `{ players: [{ role, alive }] }`。
// ============================================================

import { describe, expect, it } from 'vitest'

import { RoleType } from '@core/contracts/enums'
import {
  evaluate,
  stalemate,
  type WinSnapshot,
} from '@core/system/win-condition'

/** 一行写一个玩家：`A0` = 活着的天命星灵，`x1` = 死了的飞升者 */
function snap(...specs: string[]): WinSnapshot {
  const roleOf: Record<string, RoleType> = {
    A: RoleType.Aspect,
    G: RoleType.Guardian,
    S: RoleType.Ascended,
    I: RoleType.Infiltrator,
  }

  return {
    players: specs.map((spec) => {
      const alive = spec[0] === 'o'
      const role = roleOf[spec[1]!]
      if (!role) throw new Error(`未知身份代号：${spec}`)
      return { role, alive }
    }),
  }
}

describe('D17 · 9 种终局（纯函数）', () => {
  it('1. 全员存活 → 未结束', () => {
    expect(evaluate(snap('oA', 'oG', 'oS', 'oS', 'oI')).over).toBe(false)
  })

  it('2. 天命星灵死亡 → 飞升者胜', () => {
    const r = evaluate(snap('xA', 'oG', 'oS', 'oI'))

    expect(r.over).toBe(true)
    expect(r.winner).toBe(RoleType.Ascended)
    expect(r.winners).toEqual([RoleType.Ascended])
  })

  it('3. 天命星灵死亡 + 潜伏者是唯一存活者 → 潜伏者胜', () => {
    const r = evaluate(snap('xA', 'xG', 'xS', 'xS', 'oI'))

    expect(r.winner).toBe(RoleType.Infiltrator)
    expect(r.reason).toContain('潜伏')
  })

  it('4. 天命星灵死亡 + 潜伏者活着但还有别人 → 仍是飞升者胜', () => {
    // 潜伏者只有「活到最后一人」这一条胜利路径，多一个人就不算数
    const r = evaluate(snap('xA', 'xG', 'oS', 'oI'))

    expect(r.winner).toBe(RoleType.Ascended)
  })

  it('5. 飞升者与潜伏者全灭 → 天命星灵 + 守护者同胜', () => {
    const r = evaluate(snap('oA', 'oG', 'xS', 'xS', 'xI'))

    expect(r.winners).toEqual([RoleType.Aspect, RoleType.Guardian])
    expect(r.winner).toBe(RoleType.Aspect)
  })

  it('6. 局面里没有潜伏者 → 只看飞升者是否全灭', () => {
    expect(evaluate(snap('oA', 'oG', 'xS', 'xS')).winner).toBe(RoleType.Aspect)
    expect(evaluate(snap('oA', 'oG', 'oS', 'xS')).over).toBe(false)
  })

  it('7. 局面里没有天命星灵 → 只看第二条', () => {
    expect(evaluate(snap('oG', 'xS', 'xI')).winner).toBe(RoleType.Aspect)
    expect(evaluate(snap('oG', 'oS', 'xI')).over).toBe(false)
  })

  it('8. 飞升者全灭但潜伏者还活着 → 未结束（他要撑到最后一人）', () => {
    expect(evaluate(snap('oA', 'oG', 'xS', 'xS', 'oI')).over).toBe(false)
  })

  it('9. 全员死亡 → 仍按第一条判（飞升者胜），不是平局', () => {
    // 这是搬迁前就有的行为：全员死亡时 `checkGameOver` 走的是
    // 「主公死了 → 飞升者胜」那条。平局只在**引擎**侧
    // （`aliveCount === 0` 的兜底分支）才出现，不在胜负规则里。
    const r = evaluate(snap('xA', 'xG', 'xS', 'xI'))

    expect(r.over).toBe(true)
    expect(r.winner).toBe(RoleType.Ascended)
  })
})

describe('D17 · 平局 / 流局在接口上有位置', () => {
  it('非死亡触发的终局能被表达（本轮不参与 evaluate）', () => {
    expect(stalemate('draw', '所有玩家已死亡')).toEqual({
      over: true,
      kind: 'draw',
      winners: [],
      winner: null,
      reason: '所有玩家已死亡',
    })

    expect(stalemate('exhausted', '达到最大轮次数').kind).toBe('exhausted')
  })
})

// ── 生产落点 ──
//
// 上面 10 条验的是纯函数本身。这一组验的是**引擎真的在用这个函数**——
// 「代码里有」和「跑得到」是两件事（本轮 6 条接线缺失全是后者）。

describe('D17 · 生产落点：引擎的胜负入口就是它', () => {
  it('引擎判出来的结果与纯函数一致（搬迁前后行为不变）', async () => {
    const { createTestEnv } = await import('../helpers/game-env')
    const env = await createTestEnv()

    // 未分出胜负时两边都答 null / over=false
    expect(env.engine.checkGameOver()).toBeNull()
    expect(evaluate(env.engine.state).over).toBe(false)

    // 杀死天命星灵 → 两边都答「飞升者胜」
    const lord = env.players().find((p) => p.role === RoleType.Aspect)!
    lord.alive = false

    const fromEngine = env.engine.checkGameOver()
    const fromPure = evaluate(env.engine.state)

    expect(fromEngine).not.toBeNull()
    expect(fromEngine!.winner).toBe(fromPure.winner)
    expect(fromEngine!.reason).toBe(fromPure.reason)
  })
})
