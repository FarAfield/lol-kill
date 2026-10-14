// ============================================================
// 图文版的第一回合 —— 挂载**真实视图**走一遍
//
// 为什么非要挂真视图：卡住的第一现场就是它。
// 「控制器报了变更、界面就会跟上」那件事另有专测
// （`pending-ask-visible.test.ts`），但那份测的是复刻出来的 computed；
// 视图自己挂的哪个依赖、手牌区那句 `v-if` 有没有被算出来，
// 只有真挂载才看得见 —— 这两个地方各卡住过一次（欠账 D45）。
//
// 走法照着人来：开局 → 出牌提问挂起 → 点「结束出牌」→ 弃牌提问挂起
// → 选够张数 → 「确认弃牌」→ 回合交出去。
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import GameView from '@/views/game/index.vue'
import { useGameStore } from '@/store/game-store'

/** 让引擎那条异步链跑完（纯 microtask，宏任务一让就跑到底） */
async function drain(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((r) => setTimeout(r, 0))
    await nextTick()
  }
}

function bodyText(): string {
  return document.body.textContent ?? ''
}

function clickButton(label: string): void {
  const btn = Array.from(document.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(label),
  )
  expect(btn, `界面上应该有「${label}」按钮`).toBeTruthy()
  btn!.click()
}

describe('图文版视图：开局走得出第一回合（欠账 D45）', () => {
  let wrapper: VueWrapper
  let store: ReturnType<typeof useGameStore>
  let deckBefore: number

  beforeAll(async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { path: '/game', component: GameView },
      ],
    })

    wrapper = mount(GameView, {
      global: { plugins: [pinia, router] },
      attachTo: document.body,
    })
    store = useGameStore()
    await nextTick()

    clickButton('开始游戏')
    await drain()
    deckBefore = store.deckCount
  }, 30_000)

  afterAll(() => {
    wrapper.unmount()
  })

  it('人的手牌摆上了桌面 —— 空白的手牌区就是第二处冻住', () => {
    // `humanPlayer` 那个 computed 早退的那一次没碰到 Store，
    // 于是它只认 `session`：引擎跑起来了，手牌区却一假到底。
    expect(document.querySelectorAll('.hand-card-pos').length).toBeGreaterThan(0)
  })

  it('引擎挂起的出牌提问，界面上有回应：可打的牌被标出来、「结束出牌」亮着', () => {
    expect(document.querySelectorAll('.hand-card-pos.is-playable').length).toBeGreaterThan(0)
    expect(bodyText()).toContain('结束出牌')
  })

  it('点「结束出牌」→ 弃牌提问同样看得见，回合真的交出去了', async () => {
    clickButton('结束出牌')
    await drain()

    // 摸完牌手牌多半超上限，弃牌阶段还会再挂一问 ——
    // 它看不见的话，人就卡在「点了牌没反应、按钮一个也没有」的弃牌阶段。
    const need = bodyText().match(/需弃置\s*(\d+)\s*张牌/)
    if (need) {
      const cards = Array.from(document.querySelectorAll('.hand-card-pos'))
      for (let i = 0; i < Number(need[1]); i++) {
        ;(cards[i] as HTMLElement).click()
        await nextTick()
      }
      clickButton('确认弃牌')
      await drain()
    }

    // 牌堆少了 = 引擎真的往前走了（别人的回合在跑）。
    // 只看「当前玩家不是我」是不行的：AI 那几位跑得快，
    // 一眨眼又绕回来轮到我，那样断言照样是绿的。
    expect(store.deckCount).toBeLessThan(deckBefore)
  }, 30_000)
})
