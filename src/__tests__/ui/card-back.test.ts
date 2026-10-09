// ============================================================
// Phase 27 · D25 —— 对手手牌画成卡背
//
// 原状：全仓没有 `CardBack`（Phase 0 删掉了，一直没重建），
// 对手的手牌只是一个写着「N 张」的标签——**一张牌都看不见**。
//
// 这里钉三层：
//
//  ① **画出来的张数 === 传进去的张数**（不是「有个卡背」）。
//  ② **张数会动**：0 张不画、加到 3 张画 3 张。写成常量也能满足①。
//  ③ **不收 `ICard[]`** —— 这是这条欠账真正容易走偏的地方：
//     把对手的真手牌递给卡背组件，组件就有了「顺便显示花色」的余地，
//     那等于给「对手有什么」开了第二个答案。
//
// 另外盯住它**真的被接进了座位组件**（写了不用，等于没写）。
// ============================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CardBack from '@/components/card/CardBack.vue'

const PROJECT_ROOT = process.cwd()

/** DOM 里有几张卡背 */
function backsRendered(html: string): number {
  return [...html.matchAll(/class="card-back"/g)].length
}

describe('D25 · 卡背画出的张数', () => {
  it('画出来的张数 === 传进去的张数', () => {
    const wrapper = mount(CardBack, { props: { count: 5 } })

    expect(backsRendered(wrapper.html())).toBe(5)
  })

  it('0 张就一张都不画 —— 写死几张的话这条会红', () => {
    const wrapper = mount(CardBack, { props: { count: 0 } })

    expect(backsRendered(wrapper.html())).toBe(0)
  })

  it('张数变了跟着变 —— 这是「它会动」的对照', async () => {
    const wrapper = mount(CardBack, { props: { count: 1 } })
    expect(backsRendered(wrapper.html())).toBe(1)

    await wrapper.setProps({ count: 3 })
    expect(backsRendered(wrapper.html())).toBe(3)
  })

  it('手牌太多时折成「+N」，但张数照样报得出来', async () => {
    const wrapper = mount(CardBack, { props: { count: 14, max: 10 } })

    // 只画 10 张，免得把座位撑爆
    expect(backsRendered(wrapper.html())).toBe(10)
    // 折起来的那 4 张不能就这么消失——`title` 里报的是真张数
    expect(wrapper.html()).toContain('+4')
    expect(wrapper.html()).toContain('14 张手牌')
  })
})

describe('D25 · 卡背不许碰真的手牌', () => {
  it('props 里没有 ICard —— 拿得到单张牌就守不住「暗牌」', () => {
    const src = readFileSync(join(PROJECT_ROOT, 'src/components/card/CardBack.vue'), 'utf8')

    expect(src).not.toMatch(/ICard/)
    expect(src).not.toMatch(/cards\s*:/)
    // 只有张数进得来
    expect(src).toMatch(/count:/)
  })
})

describe('D25 · 接线还在', () => {
  it('座位组件真的把对手手牌画成了卡背', () => {
    const seat = readFileSync(
      join(PROJECT_ROOT, 'src/components/game/PlayerSeat.vue'),
      'utf8',
    )

    expect(seat).toMatch(/import CardBack from/)
    expect(seat).toMatch(/<CardBack/)
    // 只给对手画：自己的手牌是明牌，走 `CardHand`
    expect(seat).toMatch(/<CardBack[\s\S]{0,80}v-if="!isHuman"/)
  })
})
