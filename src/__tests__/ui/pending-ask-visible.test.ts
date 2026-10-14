// ============================================================
// 图文版「卡在第一回合」——引擎挂起的提问，界面必须看得见
//
// 症状：文字版跑得好好的（全员 AI，没人需要答复），
// 图文版一开局就停在第一个回合不动。
//
// 根因：**引擎提问的那一刻，没有任何东西推给 UI。**
//
// 形态丁下引擎是唯一推进者，它在出牌阶段挂起、等人答复。
// 而「引擎此刻是不是在问我」这个答案住在控制器里，是**普通字段**——
// Vue 看不见它。唯一能让它被看见的渠道是「引擎同步状态 → Store →
// 重算」，可偏偏**提问发生在两次同步之间**：
//
//   executeTurn():  currentPhase = PhaseUse → onPhaseSync()   ← 最后一次同步
//   executePhase(): await dispatch(阶段事件)
//   doPhaseUse():   await askForCardPlay(...)                 ← 提问挂起
//
// 于是界面停在最后一次同步时的样子：没有按钮、没有可点的牌、
// 只显示「等待其他玩家操作…」——而引擎正悬在那儿等这一位答复。
// 两边互相等，第一回合就这么卡死了（欠账 D45）。
//
// 本文件用 `watchEffect` 模拟渲染：它和组件的 render effect 一样，
// **只在依赖变了的时候重跑**。因此「提问挂起之后界面重算过没有」
// 这件事在这里是可以断言的——直接读一次 `getAvailableActions()`
// 是读不出这个 bug 的（computed 一读就重算，永远是新的）。
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { computed, nextTick, ref, shallowRef, watchEffect, type Ref } from 'vue'
import { GameController } from '@/services/game-controller'
import type { AvailableActions } from '@/services/game-controller'
import { HumanDecisionService } from '@/services/human-decision'
import { AutoDecisionService } from '@core/replay/auto-decision'
import { useGameStore } from '@/store/game-store'
import { useCardPlay } from '@/hooks/useCardPlay'
import { useSkill } from '@/hooks/useSkill'
import { standard5pConfig } from '@source/modes/standard-5p'

/** 人坐哪一位（与视图里的 `HUMAN_SEAT` 同一个答案） */
const HUMAN_SEAT = 0

/** 让引擎的那条异步链跑一会儿（它是纯 microtask，宏任务一让就跑完） */
async function settle(rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  await nextTick()
}

describe('引擎挂起的提问必须被界面看见（欠账 D45）', () => {
  let ctrl: GameController
  let session: ReturnType<typeof shallowRef<{ controller: GameController } | null>>
  let cardPlay: ReturnType<typeof useCardPlay>
  let skill: ReturnType<typeof useSkill>

  /** 视图里那个 computed 的一比一复刻（含它挂的那个响应式依赖） */
  let viewActions: Ref<AvailableActions>
  /** 渲染结果：只有「重算过」才会变 */
  let rendered: Ref<AvailableActions | null>
  let renderedCards: Ref<string[]>
  let renderedSkills: Ref<string[]>
  /** 界面上出现过哪些「当前玩家」——用来证明回合真的交出去了 */
  let seenSeats: number[]

  beforeEach(async () => {
    setActivePinia(createPinia())

    const store = useGameStore()
    ctrl = new GameController({ seed: 'd45-pending-ask' })
    ctrl.bindStore(store)

    session = shallowRef<{ controller: GameController } | null>(null)
    const getController = () => session.value?.controller ?? null

    cardPlay = useCardPlay(getController, () => store)
    skill = useSkill(getController)

    // ── 视图那个 computed 的一比一复刻 ──
    //
    // 依赖挂在哪里是**被测的东西本身**：视图读 `ctrl.revision`，
    // 这里就必须读同一个。写成「读 Store 再去看控制器」，
    // 等于拿改之前那份有 bug 的依赖当标准，怎么改都是绿的。
    viewActions = computed<AvailableActions>(() => {
      const c = getController()
      void c?.revision
      if (!c) {
        return {
          phase: 'NotStarted' as never,
          isMyTurn: false,
          playableCards: [],
          usableEffects: [],
          canEndPhase: false,
          isWaitingResponse: false,
          needDiscard: false,
          discardCount: 0,
        }
      }
      return c.getAvailableActions()
    })

    rendered = ref<AvailableActions | null>(null)
    renderedCards = ref<string[]>([])
    renderedSkills = ref<string[]>([])

    // 三个「渲染 effect」必须在开局**之前**注册好——
    // 它们要先拿到一份「那时候的正确值」，之后能不能跟上才是被测的东西。
    watchEffect(() => {
      rendered.value = viewActions.value
    })
    watchEffect(() => {
      renderedCards.value = cardPlay.playableCards.value.map((c) => c.cardId)
    })
    watchEffect(() => {
      renderedSkills.value = skill.availableSkills.value.map((s) => s.id)
    })

    // 普通数组：不进响应式，免得「边读边写」把自己又触发一遍
    seenSeats = []
    watchEffect(() => {
      const seat = store.uiState?.currentPlayerIndex
      if (seat !== undefined && seenSeats[seenSeats.length - 1] !== seat) {
        seenSeats.push(seat)
      }
    })

    // 只有**第一问**真的挂起 —— 那正是被测的东西。
    // 之后人的每一问都自动作答：否则循环绕回第二轮的同一位时又会挂起，
    // 断言就成了跟竞态赛跑（「按钮灭了没」取决于 AI 那几位跑得多快）。
    let cardPlayAsks = 0
    let discardAsks = 0

    ctrl.setDecisionService(
      new HumanDecisionService({
        humanSeatIndex: HUMAN_SEAT,
        // 其余座位交给不用动脑的自动方：本文件只关心人的那一问
        fallback: new AutoDecisionService(),
        channel: {
          askForCardPlay: (req) => {
            cardPlayAsks++
            return cardPlayAsks === 1
              ? ctrl.askCardPlay(req.player, req.options)
              : Promise.resolve(null)
          },
          askForDiscard: (req) => {
            discardAsks++
            return discardAsks === 1
              ? ctrl.askDiscard(req.player, req.count, req.validCards)
              : Promise.resolve(req.validCards.slice(0, req.count))
          },
        },
      }),
    )

    session.value = { controller: ctrl }

    await ctrl.createGame({ ...standard5pConfig })
    // 起循环：跑到人的出牌阶段就挂起
    await ctrl.startGame()
    await settle()
  })

  afterEach(() => {
    ctrl.destroy()
  })

  it('出牌提问挂起后，界面重算出「引擎在等我」', () => {
    // 先证明**提问确实挂着**（直接读控制器是有答案的）
    expect(ctrl.isAwaitingCardPlay).toBe(true)
    expect(ctrl.getAvailableActions().playableCards.length).toBeGreaterThan(0)

    // 再证明**界面也看见了**——卡在下面这两行就是 D45
    expect(rendered.value?.canEndPhase).toBe(true)
    expect(rendered.value?.playableCards.length).toBeGreaterThan(0)
  })

  it('出牌提问挂起后，手牌 hook 的可打列表跟着更新', () => {
    expect(renderedCards.value.length).toBeGreaterThan(0)
    // 对照：它给的不是「上一次算出来的那份」——
    // 与控制器此刻的答案逐一对得上，才叫真的跟上了。
    expect(renderedCards.value).toEqual(
      ctrl.getAvailableActions().playableCards.map((c) => c.cardId),
    )
  })

  it('出牌提问挂起后，技能面板不再是空的', () => {
    expect(renderedSkills.value.length).toBeGreaterThan(0)
  })

  it('答复之后界面跟着收掉按钮，弃牌提问也看得见，回合真的交出去了', async () => {
    // 对照上一组断言：按钮不是「恒亮」，答复完就该灭
    expect(rendered.value?.canEndPhase).toBe(true)

    expect(ctrl.endCardPlay()).toBe(true)
    await settle()

    // 提问没了 → 界面重算 → 按钮收掉
    expect(ctrl.isAwaitingCardPlay).toBe(false)
    expect(rendered.value?.canEndPhase).toBe(false)

    // 摸完牌手牌超上限，弃牌阶段也会挂一个提问 —— 它同样得被看见，
    // 否则人又卡在「点了牌没反应、按钮一个也没有」的弃牌阶段。
    // 这里不写 `if (isAwaitingDiscard)`：一写上，万一没挂起整段断言就静默消失，
    // 等于给这条断言开了个逃生口。弃牌提问在这里是必然发生的，就照必然的写。
    expect(ctrl.isAwaitingDiscard).toBe(true)
    expect(rendered.value?.needDiscard).toBe(true)

    const count = ctrl.getAvailableActions().discardCount
    const ids = (ctrl.getGameState()?.players[HUMAN_SEAT]?.handCards ?? [])
      .slice(0, count)
      .map((c) => c.instanceId)
    expect(await ctrl.discardCards(ids)).toBe(true)
    await settle()

    expect(rendered.value?.needDiscard).toBe(false)

    // 回合交出去了 —— 这才叫「走出了第一回合」。
    // 只看「当前玩家不是我」是不够的：AI 那几位跑得快，
    // 一眨眼就绕回来又轮到我，那样断言照样是绿的。
    expect(seenSeats.some((seat) => seat !== HUMAN_SEAT)).toBe(true)
  })
})

// ═══════════════════════════════════════════
// ⑥ 依赖挂在哪一处 —— 源码护栏
//
// 上面 4 条测的是「控制器报了变更、界面就会跟上」，
// 测不到**视图自己**挂的哪个依赖（本文件里那份是复刻）。
// 视图是唯一没被端到端盖住的一环，而它恰恰就是卡住的第一现场，
// 所以这里按源码盯住三处。
// ═══════════════════════════════════════════

describe('D45 · 三份 UI 代码的响应式依赖', () => {
  // 项目规矩：`import.meta.url` 在 vitest 里不是 `file:` 协议，一律用 cwd
  const PROJECT_ROOT = process.cwd()

  const GUARDED: Array<{ rel: string; pattern: RegExp }> = [
    { rel: 'src/views/game/index.vue', pattern: /void ctrl\?\.revision/ },
    { rel: 'src/hooks/useCardPlay.ts', pattern: /void ctrl\.revision/ },
    { rel: 'src/hooks/useSkill.ts', pattern: /void ctrl\.revision/ },
  ]

  it.each(GUARDED)('$rel 的依赖挂在控制器的版本号上', ({ rel, pattern }) => {
    const src = readFileSync(join(PROJECT_ROOT, rel), 'utf8')
    expect(src).toMatch(pattern)
  })

  it('视图不再把「状态同步」当成「提问挂起」的通知', () => {
    const src = readFileSync(join(PROJECT_ROOT, 'src/views/game/index.vue'), 'utf8')

    // 提问发生在两次状态同步之间，靠同步去触发重算就会漏掉它——
    // 这条护栏盯的就是别再把那个依赖写回来。
    expect(src).not.toMatch(/void uiState\.value/)
  })
})
