// ============================================================
// Phase 27 · D38 —— 回合交接：引擎是唯一的推进者（形态丁）
//
// 原状（实测）：`startGame()` 之后停在 `phasePost`，连按 12 次
// 「结束阶段」，阶段与行动玩家**一次都没变**（始终 `phasePost` / `player_0`）。
//
// 两个根因互相掩盖：
//   ① 回合交接只写在 AI 自动那条路（`runGameLoop`）里，UI 那条
//      「推一步」的路在末阶段只是把 `phasePost` 原地重设一遍；
//   ② `start()` 一口气把第一个回合跑完，而**人就是主公、就是第一个玩家**，
//      于是唯一能交互的那一轮被吞掉。
//
// 顺带纠正一处诊断：既有登记写的是「人类的第一个回合是 AI 替他打的」。
// 按代码不是这样 —— `HumanDecisionService.askForCardPlay` 的兜底只对
// **非人类座位**成立，人走的是「没登记通道 → 返回 null」那一行，
// 结果是**出牌阶段被静默跳过**：一张牌都没出，回合就结束了。
// 这个区别决定了解法：不是把按钮接到决策服务上，而是让引擎在该停的地方停。
//
// 形态丁钉三件事：
//   ① `start()` 只开局 —— 停在人的出牌阶段等答案（端到端走完一圈的前提）；
//   ② 人在界面上给的答案真的打出去了，且**回合交到了下一位**；
//   ③ 「结束出牌」= 答复 `null`，连按下去回合确实前进。
//
// 另有一条死锁纪律（T3）：挂起的提问在重置会话时必须被答复 ——
// 一个永不 resolve 的 Promise 不报错、不红测试，只是整局静静地卡住。
// ============================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { GameController } from '@/services/game-controller'
import { HumanDecisionService } from '@/services/human-decision'
import { AutoDecisionService } from '@core/replay/auto-decision'
import { standard5pConfig } from '@source/modes/standard-5p'
import { GamePhase } from '@core/contracts/enums'
import type {
  CardPlayOption,
  CardPlayResult,
} from '@core/contracts/services.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { useGameStore } from '@/store/game-store'

const PROJECT_ROOT = process.cwd()

/** 人坐 0 号位 —— 与 `views/game/index.vue` 的 `HUMAN_SEAT` 同一个答案 */
const HUMAN_SEAT = 0

/**
 * 轮次上限压到 2
 *
 * `standard5pConfig` 写着 `maxRounds: 100`。形态丁下循环在后台跑，
 * 不设上限的话一局没人管就一路跑到第 100 轮。
 */
const BOUNDED_5P = { ...standard5pConfig, maxRounds: 2 }

/**
 * 兜底方（AI 那几位）—— 顺便记下**哪些座位被问过出牌**。
 *
 * 「回合交出去了」最硬的证据就是：人结束出牌之后，下一个被问出牌的是 1 号位。
 * 它不依赖 sleep，也不依赖「此刻刚好没跑过头」。
 */
class SeatRecorder extends AutoDecisionService {
  readonly askedSeats: number[] = []

  override async askForCardPlay(
    player: IPlayer,
    options: CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    this.askedSeats.push(player.seatIndex)
    return super.askForCardPlay(player, options)
  }
}

/** 一局「人在 0 号位、其余交给兜底」的真游戏 */
interface HumanSession {
  controller: GameController
  /** 每一次问人时挂起的那条 Promise（按提问顺序） */
  asked: Array<Promise<CardPlayResult | null>>
  /** 兜底方（非人类座位）被问出牌的顺序 */
  seats: number[]
}

async function startHumanGame(): Promise<HumanSession> {
  const controller = new GameController({ seed: 38 })
  const fallback = new SeatRecorder()
  const asked: Array<Promise<CardPlayResult | null>> = []

  controller.setDecisionService(
    new HumanDecisionService({
      humanSeatIndex: HUMAN_SEAT,
      fallback,
      channel: {
        // 人那一位被问出牌 → 挂起，等界面上的答案
        askForCardPlay: (req) => {
          const pending = controller.askCardPlay(req.player, req.options)
          asked.push(pending)
          return pending
        },
        askForDiscard: (req) =>
          controller.askDiscard(req.player, req.count, req.validCards),
      },
    }),
  )
  controller.bindStore(store)
  await controller.createGame({ ...BOUNDED_5P })
  await controller.startGame()

  return { controller, asked, seats: fallback.askedSeats }
}

/**
 * 等到条件成立 —— 期间如果引擎问弃牌，按缺省替他弃掉。
 *
 * 不这么做的话，测试自己就会成为那个死锁的制造者：
 * 弃牌提问悬在那里，循环永远走不到下一步。
 */
async function driveUntil(
  session: HumanSession,
  cond: () => boolean,
  label: string,
  ms = 5000,
): Promise<void> {
  const deadline = Date.now() + ms
  while (!cond()) {
    if (Date.now() > deadline) throw new Error(`等不到：${label}`)

    const actions = session.controller.getAvailableActions()
    if (actions.needDiscard) {
      const hand = session.controller.getCurrentPlayer()!.handCards.map((c) => c.instanceId)
      await session.controller.discardCards(hand.slice(0, actions.discardCount))
    }

    await new Promise((r) => setTimeout(r, 0))
  }
}

/** 答复「打一张牌」—— 牌与目标都只能从挂起提问给的选项里挑 */
async function answerWithFirstOption(
  session: HumanSession,
): Promise<{ cardId: string; targetIds: string[] }> {
  const options = session.controller.cardPlayOptions
  expect(options.length).toBeGreaterThan(0)

  // 优先挑一张「真的要点目标」的牌：不点目标的那些（比如某些锦囊）
  // 打出去也证明不了「界面上的选择被采纳了」。
  const option =
    options.find((o) => o.minTargets > 0 && o.validTargets.length > 0) ?? options[0]!

  const take = option.maxTargets > 0 ? option.maxTargets : option.minTargets
  const targetIds = option.validTargets.slice(0, take).map((p) => p.id)

  expect(await session.controller.playCard(option.card.instanceId, targetIds)).toBe(true)
  return { cardId: option.card.instanceId, targetIds }
}

/** 一条挂起的提问必须在时限内拿到答复 —— 否则就是一次事件栈死锁 */
async function mustResolve<T>(pending: Promise<T>, ms = 500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`${ms}ms 内这条提问没有被答复 —— 事件流水线会永远卡在这个 await 上`),
        ),
      ms,
    )
  })
  try {
    return await Promise.race([pending, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

let store: ReturnType<typeof useGameStore>

beforeEach(() => {
  setActivePinia(createPinia())
  store = useGameStore()
})

// ═══════════════════════════════════════════
// ① start() 只开局 —— 停在人的出牌阶段等答案
// ═══════════════════════════════════════════

describe('D38 · 开局之后引擎停在人的出牌阶段', () => {
  it('不是替他把第一个回合跑完 —— 提问挂着，人还没出过牌', async () => {
    const session = await startHumanGame()
    await driveUntil(session, () => session.controller.isAwaitingCardPlay, '人的出牌提问')

    const state = session.controller.getGameState()!

    // 停的就是出牌阶段，行动者就是 0 号位那一位
    expect(state.currentPhase).toBe(GamePhase.PhaseUse)
    expect(session.controller.getCurrentPlayer()!.seatIndex).toBe(HUMAN_SEAT)

    // 只问过一次，而且那一次**还没被答复** —— 它正悬在这儿等界面
    expect(session.asked).toHaveLength(1)
    expect(session.seats).toHaveLength(0)

    // 能打什么、能不能点「结束出牌」，都来自这个挂起的提问
    const actions = session.controller.getAvailableActions()
    expect(actions.playableCards.length).toBeGreaterThan(0)
    expect(actions.canEndPhase).toBe(true)
  })

  it('startGame() 不阻塞到整局结束 —— 循环还挂着，它早就返回了', async () => {
    const session = await startHumanGame()
    await driveUntil(session, () => session.controller.isAwaitingCardPlay, '人的出牌提问')

    // 循环正停在一个挂起的提问上，因此整局远没结束；
    // 而 `await startGame()` 上面那一行已经跑完了 —— 这就是不阻塞的证据。
    expect(session.controller.getGameState()!.finished).toBe(false)
    expect(session.controller.isGameOver).toBe(false)
  })
})

// ═══════════════════════════════════════════
// ② 端到端走完一圈
// ═══════════════════════════════════════════

describe('D38 · 人在界面上给的答案 → 牌打出去 → 回合交到下一位', () => {
  it('打出的那张牌真的离手了 —— 并且它去了该去的地方', async () => {
    const session = await startHumanGame()
    await driveUntil(session, () => session.controller.isAwaitingCardPlay, '人的出牌提问')

    const { cardId } = await answerWithFirstOption(session)

    await driveUntil(
      session,
      () =>
        !session.controller
          .getGameState()!
          .players[HUMAN_SEAT]!.handCards.some((c) => c.instanceId === cardId),
      '打出去的那张牌离开手牌',
    )

    const state = session.controller.getGameState()!
    const human = state.players[HUMAN_SEAT]!
    // 「离手」还不够 —— 它得真去了某个区域（弃牌堆 / 装备区），
    // 否则「手牌没了」可能只是别的地方把它弄丢了
    const landed = [...state.discardPile, ...human.equipCards].some(
      (c) => c.instanceId === cardId,
    )
    expect(landed).toBe(true)
  })

  it('出牌阶段结束 → 回合交到下一位 —— 这就是原本走不完的那一圈', async () => {
    const session = await startHumanGame()
    await driveUntil(session, () => session.controller.isAwaitingCardPlay, '人的出牌提问')

    await answerWithFirstOption(session)

    // 打完一张引擎会再问一次；没得打了就直接走完阶段。两种都要接住
    await driveUntil(
      session,
      () => session.controller.isAwaitingCardPlay || session.seats.length > 0,
      '出牌之后：再问一次，或者回合已经交出去',
    )
    // 还挂着提问 → 结束出牌；已经交出去了 → 这一句本来就答复不上，也没必要答复
    const ended = session.controller.endCardPlay()
    expect(ended || session.seats.length > 0).toBe(true)

    // 下一个被问出牌的是 1 号位 —— 原状是永远停在 0 号位
    await driveUntil(session, () => session.seats.length > 0, '回合交到下一位')
    expect(session.seats[0]).toBe(1)
  })

  it('按「结束出牌」之后回合确实前进 —— 原状是连按 12 次都停在同一个人', async () => {
    const session = await startHumanGame()

    // 原状按 12 次，阶段与行动玩家一次都没变（始终 `phasePost` / `player_0`）。
    // 现在按一次就够：引擎自己结束这个阶段，然后一路走下去。
    await driveUntil(session, () => session.controller.isAwaitingCardPlay, '人的出牌提问')
    expect(session.controller.endCardPlay()).toBe(true)

    // 交出去之后，其余四个座位依次被问到 —— 这才叫「一圈走完」，
    // 只换一个人（甚至只换一次）都还可能是在原地打转。
    await driveUntil(session, () => new Set(session.seats).size >= 4, '其余座位依次被问')
    expect(session.seats[0]).toBe(1)
    expect([...new Set(session.seats)].sort()).toEqual([1, 2, 3, 4])

    // 轮次号也跟着动了：原状是停在同一个人的同一个阶段上，它根本不动
    expect(session.controller.getGameState()!.currentRound).toBeGreaterThanOrEqual(2)
  })
})

// ═══════════════════════════════════════════
// ③ 「能打什么牌」只有一个来源
// ═══════════════════════════════════════════

describe('D38 · 界面上的可出牌列表只认挂起的提问', () => {
  it('就是挂起提问给的 options，一份不多一份不少', async () => {
    const session = await startHumanGame()
    await driveUntil(session, () => session.controller.isAwaitingCardPlay, '人的出牌提问')

    const options = session.controller.cardPlayOptions
    const listed = session.controller.getAvailableActions().playableCards

    // 先证明这一刻真的有牌可打：两边都空也算「相等」
    expect(options.length).toBeGreaterThan(0)
    expect(listed.map((c) => c.cardId)).toEqual(options.map((o) => o.card.instanceId))
  })

  it('没有挂起提问时一个都不给 —— 否则「能打什么」就还留着第二本账', async () => {
    const session = await startHumanGame()
    await driveUntil(session, () => session.controller.isAwaitingCardPlay, '人的出牌提问')

    session.controller.destroy()

    const actions = session.controller.getAvailableActions()
    expect(actions.playableCards).toEqual([])
    expect(actions.canEndPhase).toBe(false)
    expect(actions.needDiscard).toBe(false)
  })
})

// ═══════════════════════════════════════════
// ④ 死锁纪律：挂起的提问必须被答复
// ═══════════════════════════════════════════

describe('D38 · 重置会话时挂起的提问不悬着', () => {
  it('提问挂起时强制重置会话 → 提问被答复（缺省 = 结束出牌）', async () => {
    const session = await startHumanGame()
    await driveUntil(session, () => session.controller.isAwaitingCardPlay, '人的出牌提问')

    const pending = session.asked[0]!
    session.controller.destroy()

    // 悬着的 resolve 不报错、不红测试，只是那条 await 永远不返回；
    // 所以这里必须自己给它一个时限，把「没答复」变成一条红。
    const answer = await mustResolve(pending)
    expect(answer).toBeNull()
  })
})

// ═══════════════════════════════════════════
// ⑤ 只剩一条推进路径（源码护栏）
// ═══════════════════════════════════════════

describe('D38 · 推进只有一条路', () => {
  // 「推一步」那两个接口连同注释一起删干净：
  // 留一个「反正也没人用了」的兼容壳，等于两条推进路径继续并存。
  //
  // 两个名字是**拼**出来的而不是写成字面量：这样全仓搜那两个已删的接口名时，
  // 连这条护栏自己都不会被匹配到 —— 「删干净」的判定不需要留例外。
  const DELETED_ENGINE_STEP = 'next' + 'Phase'
  const DELETED_CONTROLLER_STEP = 'end' + 'Phase'

  const GUARDED = [
    'src/core/engine/game-engine.ts',
    'src/core/engine/phase-manager.ts',
    'src/services/game-controller.ts',
    'src/views/game/index.vue',
    'src/components/game/ActionButtons.vue',
  ]

  // 按文件展开成独立的用例：哪一份里又冒出来，名字上就能看出来
  it.each(GUARDED)('%s 里不再有「推一步」的接口', (rel) => {
    const src = readFileSync(join(PROJECT_ROOT, rel), 'utf8')

    expect(src).not.toContain(DELETED_ENGINE_STEP)
    expect(src).not.toContain(DELETED_CONTROLLER_STEP)
  })

  it('控制器上那个「结束阶段」的方法已经不存在', () => {
    const controller = new GameController({ seed: 38 })
    const asRecord = controller as unknown as Record<string, unknown>

    expect(asRecord[DELETED_CONTROLLER_STEP]).toBeUndefined()
    // 答复挂起提问的入口在（否则按钮无处可去）
    expect(typeof controller.endCardPlay).toBe('function')
    expect(typeof controller.playCard).toBe('function')
    controller.destroy()
  })

  it('出牌不再由控制器执行 —— 答复不了就是答复不了，不自己动手', async () => {
    const controller = new GameController({ seed: 38 })
    controller.bindStore(store)
    await controller.createGame({ ...BOUNDED_5P })

    // 引擎此刻没在问：不许悄悄自己出一张
    expect(await controller.playCard('不存在的牌', [])).toBe(false)
    expect(controller.endCardPlay()).toBe(false)
    expect(await controller.discardCards([])).toBe(false)

    controller.destroy()
  })

  it('界面把人的两种提问都登记上了 —— 不登记就等于人永远不出牌', () => {
    const src = readFileSync(
      join(PROJECT_ROOT, 'src/views/game/index.vue'),
      'utf8',
    )

    expect(src).toMatch(/askForCardPlay/)
    expect(src).toMatch(/askForDiscard/)
    // 旧的理由必须连同登记一起改掉：留着它，下一个人会照它再删一遍
    expect(src).not.toMatch(/刻意不登记/)
  })
})
