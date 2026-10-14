// ============================================================
// Phase 27 · D24 —— 棋盘上的牌堆 / 弃牌堆张数
//
// 原状（`GameBoard.vue` 两处 `<span class="pile-count">0</span>`）：
// 牌堆与弃牌堆的数量是**字面量**。这不是「显示不准」，是「从不显示」——
// 打一整局，这两个数字都不会动一下。
//
// 这里钉两层，缺一层就会退回去：
//
//  ① **Store 的派生张数等于引擎真值**。走的是生产那条路
//     （`GameController.bindStore` → `StoreService.onChange`），
//     而不是测试自己调一句 `syncFromEngine`——后者测的是测试自己。
//  ② **组件把 props 显示出来**。断言写成「DOM 里的数字 === 传进去的数」，
//     而不是「DOM 里有个数字」：写死 0 也能满足后者。
//
// 每层都配一条「它会动」的对照：`0 === 0` 也绿，而「永远是 0」
// 恰好就是这里要修的那个毛病。
// ============================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { GameController } from '@/services/game-controller'
import { standard5pConfig } from '@source/modes/standard-5p'
import { ScriptedDecisionService } from '../helpers/game-env'
import { useGameStore } from '@/store/game-store'
import GameBoard from '@/components/game/GameBoard.vue'
import type { IUIDecisionService } from '@core/contracts/services.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'

// `process.cwd()` 而不是 `fileURLToPath(import.meta.url)`：
// vitest 里的 `import.meta.url` 不是 file: 协议，解析会直接炸。
const PROJECT_ROOT = process.cwd()

/**
 * 有轮次上限的一局
 *
 * `standard5pConfig` 的 `maxRounds` 是 100 —— 形态丁下 `startGame()` 只把
 * 循环**跑起来**就返回（欠账 D38），测试要是等整局结束，得先给这一局设个上限。
 */
const BOUNDED_5P = { ...standard5pConfig, maxRounds: 2 }

/**
 * 起一局绑了 Store 的真游戏
 *
 * 与 `views/game/index.vue` 走同一条路：`new GameController()` →
 * `bindStore` → `createGame` → `startGame`。
 * 不通过这两个私有字段偷看引擎——它们私有的意思是 UI 也不许看。
 */
async function createBoundGame(
  makeDecisions: (controller: GameController) => IUIDecisionService = () =>
    new ScriptedDecisionService(),
): Promise<{
  controller: GameController
  truth: () => { deck: number; discard: number }
}> {
  const controller = new GameController({ seed: 24 })
  controller.setDecisionService(makeDecisions(controller))
  controller.bindStore(store)
  await controller.createGame({ ...BOUNDED_5P })

  return {
    controller,
    truth: () => {
      const s = controller.getGameState()!
      return { deck: s.deck.length, discard: s.discardPile.length }
    },
  }
}

/** 等到条件成立（引擎在后台跑，断言前得让它先走到那一步） */
async function waitFor(cond: () => boolean, label: string, ms = 5000): Promise<void> {
  const deadline = Date.now() + ms
  while (!cond()) {
    if (Date.now() > deadline) throw new Error(`等不到：${label}`)
    await new Promise((r) => setTimeout(r, 0))
  }
}

/**
 * 第一次被问弃牌时**挂起**，之后照旧自动弃
 *
 * 形态丁下弃牌是引擎问出来的（欠账 D38）：UI 不再自己动手弃，
 * 它只是把「弃哪几张」答复回去。所以要走「UI 的弃牌入口」，
 * 得先让引擎真的挂一个弃牌提问在那儿。
 */
class FirstDiscardParks extends ScriptedDecisionService {
  private parked = false

  constructor(private readonly controller: GameController) {
    super()
  }

  override async askForDiscard(
    player: IPlayer,
    count: number,
    validCards: ICard[],
  ): Promise<ICard[]> {
    if (this.parked) return validCards.slice(0, count)
    this.parked = true
    return this.controller.askDiscard(player, count, validCards)
  }
}

/** 读 DOM 里两个 pile-count 的文字（顺序：牌堆、弃牌堆） */
function pileCounts(html: string): [string, string] {
  const found = [...html.matchAll(/class="pile-count">([^<]*)</g)].map((m) => m[1]!.trim())
  expect(found.length).toBe(2)
  return [found[0]!, found[1]!]
}

let store: ReturnType<typeof useGameStore>

beforeEach(() => {
  setActivePinia(createPinia())
  store = useGameStore()
})

// ═══════════════════════════════════════════
// ① Store 的派生张数 == 引擎真值
// ═══════════════════════════════════════════

describe('D24 · Store 里的牌堆 / 弃牌堆张数', () => {
  it('等于引擎真值 —— 且开局时牌堆不为空', async () => {
    const { truth } = await createBoundGame()

    expect(store.deckCount).toBe(truth().deck)
    // 关键的一条：`0 === 0` 也满足上一句，而「永远是 0」正是这里修的那个毛病
    expect(store.deckCount).toBeGreaterThan(0)
  })

  it('发牌之后跟着变小 —— 停在旧快照上的话这条会红', async () => {
    const { controller, truth } = await createBoundGame()
    const before = store.deckCount

    // `startGame()` 只把循环跑起来就返回，整局的结果走 `whenFinished()`
    await controller.startGame()
    await controller.whenFinished()

    // 先证明「这一刻真的少了一张以上」，否则下面那句可能只是两边都没动
    expect(truth().deck).toBeLessThan(before)
    expect(store.deckCount).toBe(truth().deck)
  })

  it('弃一张牌之后跟着变多 —— 走的就是 UI 的「弃牌」那个入口', async () => {
    const { controller, truth } = await createBoundGame((ctrl) => new FirstDiscardParks(ctrl))
    // 循环在后台跑，等它真的问出第一个弃牌提问
    await controller.startGame()
    await waitFor(() => controller.isAwaitingDiscard, '第一个弃牌提问')

    const before = truth().discard
    expect(store.discardCount).toBe(before)

    const count = controller.getAvailableActions().discardCount
    const hand = controller.getCurrentPlayer()!.handCards.map((c) => c.instanceId)
    expect(await controller.discardCards(hand.slice(0, count))).toBe(true)

    await waitFor(() => truth().discard > before, '弃牌堆变多')
    expect(store.discardCount).toBe(truth().discard)
  })
})

// ═══════════════════════════════════════════
// ② 把 props 显示出来
// ═══════════════════════════════════════════

describe('D24 · GameBoard 显示传入的张数', () => {
  it('DOM 里就是传进去的两个数', () => {
    const wrapper = mount(GameBoard, {
      props: { players: [], deckCount: 37, discardCount: 12 },
      global: { stubs: { PlayerSeat: true } },
    })

    expect(pileCounts(wrapper.html())).toEqual(['37', '12'])
  })

  it('props 变了 DOM 跟着变 —— 写死的话这一条立刻红', async () => {
    const wrapper = mount(GameBoard, {
      props: { players: [], deckCount: 40, discardCount: 0 },
      global: { stubs: { PlayerSeat: true } },
    })
    expect(pileCounts(wrapper.html())).toEqual(['40', '0'])

    await wrapper.setProps({ deckCount: 33, discardCount: 7 })
    expect(pileCounts(wrapper.html())).toEqual(['33', '7'])
  })

  it('接线还在：视图真的把两个数量传给了 GameBoard', () => {
    // 组件写得再对，没人传也是白搭——这条守的是那根线，
    // 与 Phase 26 里「不递候选就返回 null」是同一类守卫。
    const view = readFileSync(join(PROJECT_ROOT, 'src/views/game/index.vue'), 'utf8')

    expect(view).toMatch(/:deck-count="/)
    expect(view).toMatch(/:discard-count="/)
  })

  it('模板里不再有写死的 0', () => {
    const board = readFileSync(join(PROJECT_ROOT, 'src/components/game/GameBoard.vue'), 'utf8')

    expect(board).not.toMatch(/class="pile-count">0</)
  })

  it('不再保留「传进来但没人读」的 props', () => {
    // 原先那两个必填 props（当前阶段 / 当前行动玩家座次）一路传进来，
    // 组件一眼都没读过。「轮到谁」由 `isCurrentPlayer` 回答就够了。
    const board = readFileSync(join(PROJECT_ROOT, 'src/components/game/GameBoard.vue'), 'utf8')

    expect(board).not.toMatch(/currentPhase/)
    expect(board).not.toMatch(/currentPlayerIndex/)
  })
})
