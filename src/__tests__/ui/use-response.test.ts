// ============================================================
// Phase 27 · D35 —— useResponse 得能把**答案**带回来
//
// 原状：`open()` 返回 `void`。它把 `isOpen` 置成 true 就撒手了，
// 谁也不知道人什么时候按了确认。于是全仓没有一处会问它（欠账 D35），
// 也问不了——问了也拿不到回答。
//
// 这里钉的是「询问」这件事本身：
//
//  ① **没作答之前不 settle**。这条看着多余，但它恰恰是唯一能挡住
//     「返回值写死 null」的断言——写死也能过下面所有「等于某值」的测试。
//  ② **四条出路各自给出正确的答案**：确认出牌 / 取消 / 超时 / 被下一个窗口顶掉。
//     少一条，就有一条路径上的答案悬着——而一条悬着的 Promise
//     就是一次事件栈死锁（`waitForResponse` 是在流水线 pause 时问的）。
// ============================================================

import { describe, expect, it } from 'vitest'
import { useResponse } from '@/hooks/useResponse'
import type { UseResponseReturn } from '@/hooks/useResponse'

/** 开窗的最小配置 */
function config(overrides: Partial<Parameters<UseResponseReturn['open']>[0]> = {}) {
  return {
    prompt: '请出【闪】',
    validCardIds: ['dodge-1', 'dodge-2'],
    timeoutMs: 0,
    required: false,
    ...overrides,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 等一个答案，超时即失败
 *
 * 失败信息刻意说清楚后果：这条 await 挂在被 pause 的事件流水线上，
 * 它不回来，整局就停在那儿。
 */
async function mustResolve<T>(promise: Promise<T>, ms = 1000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`答案没按时到（${ms}ms）——那条 await 会把事件流水线永远钉住`)),
      ms,
    )
  })
  try {
    return await Promise.race([promise, guard])
  } finally {
    clearTimeout(timer!)
  }
}

// ═══════════════════════════════════════════
// ① 没作答之前不 settle
// ═══════════════════════════════════════════

describe('D35 · 问出口之后，答案要等人给', () => {
  it('开窗之后人家还在想 —— 立刻返回的话这条会红', async () => {
    const r = useResponse()

    let settled = false
    let value: string | null = '未定'
    const pending = r.open(config())
    void pending.then((v) => {
      settled = true
      value = v
    })

    await sleep(40)
    expect(settled).toBe(false)
    expect(value).toBe('未定')

    // 对照：作答之后它真的回来了，而且回的是人给的那张牌
    r.selectCard('dodge-2')
    r.confirm()
    expect(await mustResolve(pending)).toBe('dodge-2')
  })

  it('开窗后 isOpen 为真，答完之后为假 —— 写死 false 的话这条会红', async () => {
    const r = useResponse()
    expect(r.isOpen.value).toBe(false)

    const pending = r.open(config())
    expect(r.isOpen.value).toBe(true)

    r.confirm()
    await mustResolve(pending)
    expect(r.isOpen.value).toBe(false)
  })
})

// ═══════════════════════════════════════════
// ② 四条出路各自的答案
// ═══════════════════════════════════════════

describe('D35 · 四条出路', () => {
  it('确认：给出选中的那张牌', async () => {
    const r = useResponse()
    const pending = r.open(config())

    r.selectCard('dodge-2')
    r.confirm()

    expect(await mustResolve(pending)).toBe('dodge-2')
  })

  it('取消：给出 null（= 不出）', async () => {
    const r = useResponse()
    const pending = r.open(config())

    // 先选了再取消，答案必须是 null —— 选了不等于认了
    r.selectCard('dodge-1')
    r.cancel()

    expect(await mustResolve(pending)).toBeNull()
  })

  it('没选牌就确认：同样是 null，不能把手上一个虚空 id 交回去', async () => {
    const r = useResponse()
    const pending = r.open(config())

    r.confirm()

    expect(await mustResolve(pending)).toBeNull()
  })

  it('选了一**张不在候选里**的牌：open 之外的非法答案一律不收', async () => {
    const r = useResponse()
    const pending = r.open(config())

    r.selectCard('这张不在 validCardIds 里')
    expect(r.selectedCardId.value).toBeNull()

    r.confirm()
    expect(await mustResolve(pending)).toBeNull()
  })

  it('强制响应不给取消 —— 濒死求桃不能按「跳过」', async () => {
    const r = useResponse()
    const pending = r.open(config({ required: true }))

    expect(r.canCancel.value).toBe(false)
    r.cancel()

    // 还没 settle：强制的那道题还在等人回答，取消键按不动它
    await sleep(30)
    expect(r.isOpen.value).toBe(true)

    r.selectCard('dodge-1')
    r.confirm()
    expect(await mustResolve(pending)).toBe('dodge-1')
  })

  it('超时：自动按「不出」答复 —— 倒计时不该变成死锁', async () => {
    const r = useResponse()
    // interval 每 500ms 一跳，给个比它小的时限，等它第一跳就 settles
    const pending = r.open(config({ timeoutMs: 60 }))

    expect(await mustResolve(pending, 3000)).toBeNull()
    expect(r.isTimeout.value).toBe(true)
    expect(r.isOpen.value).toBe(false)
  })

  it('新窗口把旧的顶掉时，旧的那条也按「不出」答复', async () => {
    const r = useResponse()

    const stale = r.open(config())
    const fresh = r.open(config({ prompt: '请出【桃】' }))

    // 旧的那道题已经被放弃，但问它的人还在 await —— 必须给他一个答案
    expect(await mustResolve(stale)).toBeNull()

    r.selectCard('dodge-1')
    r.confirm()
    expect(await mustResolve(fresh)).toBe('dodge-1')
  })
})
