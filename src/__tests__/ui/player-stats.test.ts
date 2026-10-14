// ============================================================
// Phase · D41 —— 面板上那几个「要查规则才答得上来」的数
//
// 原状：座位面板只有体力与手牌数，而**攻击范围 / 手牌上限这两个数
// 根本不在快照里** —— 它们是规则层算出来的结果，装把武器、挂个技能
// 都会变。面板要么不显示，要么只能写一个常量，而常量在装上武器的
// 那一刻就是错的。
//
// 这里钉四层，缺一层就会退回去：
//
//  ① **Store 的派生值等于查询口的回答**。断言写成「一人一个数」，
//     而不是「有个数字」——写死 1 也能满足后者，而「永远是 1」
//     恰好就是这里要修的那个毛病。
//  ② **控制器把查询口递给了 Store**。两条启动顺序各测一遍：
//     历史上补发只写在一条路径上，另一条路上的界面永远是瞎的（D37）。
//  ③ **那个查询口问的是引擎，不是抄来的常量**。装上武器之后
//     面板上的数必须真的动一下——这一条是 ② 的牙齿。
//  ④ **组件把 props 显示出来**，且自己不再按装备槽位另算一份。
//
// 每层都配一条「它会动」的对照：`1 === 1` 也绿。
// ============================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { GameController } from '@/services/game-controller'
import { standard5pConfig } from '@source/modes/standard-5p'
import { QingGangJian } from '@source/cards/equips'
import { BASE_ATTACK_RANGE } from '@core/skill'
import { CardTag } from '@core/contracts/card-tag'
import { ScriptedDecisionService } from '../helpers/game-env'
import { useGameStore } from '@/store/game-store'
import PlayerSeat from '@/components/game/PlayerSeat.vue'
import type { IPlayerStatsQuery, UIPlayerInfo } from '@/store/game-store'
import type {
  CardPlayOption,
  CardPlayResult,
  IUIDecisionService,
} from '@core/contracts/services.interface'
import type { IPlayer } from '@core/contracts/player.interface'

// `process.cwd()` 而不是 `fileURLToPath(import.meta.url)`：
// vitest 里的 `import.meta.url` 不是 file: 协议，解析会直接炸。
const PROJECT_ROOT = process.cwd()

/** 有轮次上限的一局（循环不会自己停，得先给它设个上限） */
const BOUNDED_5P = { ...standard5pConfig, maxRounds: 2 }

/**
 * 牌堆里只有武器的那一局
 *
 * 配比表里青釭剑只有一张，所以把同一份定义重复登记 12 次——
 * 于是每人起手两张都是它，「谁手上有一把武器」这件事不再靠运气。
 */
const WEAPON_DECK_5P = {
  ...standard5pConfig,
  cards: Array.from({ length: 12 }, () => QingGangJian),
  initialHandSize: 2,
  maxRounds: 2,
}

/**
 * 第一次被问出牌时把手里那把武器装上，之后一律「结束出牌」
 *
 * 只装一次：装上之后攻击范围才有「变了 / 没变」可比，
 * 装两把就把「谁变了」这件事也搅浑了。
 */
class EquipFirstWeapon extends ScriptedDecisionService {
  private played = false

  override async askForCardPlay(
    _player: IPlayer,
    options: CardPlayOption[],
  ): Promise<CardPlayResult | null> {
    if (this.played) return null
    const weapon = options.find((o) => o.card.tags.has(CardTag.Equip))
    if (!weapon) return null

    this.played = true
    // 装备牌不设目标——目标数是 0，硬塞一个进去会让用牌校验把它打回来
    return { card: weapon.card, targets: [] }
  }
}

/** 起一局绑了 Store 的真游戏（与图形界面走同一条路） */
async function createBoundGame(
  config: typeof BOUNDED_5P = BOUNDED_5P,
  decisions: IUIDecisionService = new ScriptedDecisionService(),
): Promise<GameController> {
  const controller = new GameController({ seed: 24 })
  controller.setDecisionService(decisions)
  controller.bindStore(store)
  await controller.createGame(config)
  return controller
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
 * 只记录「查询口被递了几次、递的是什么」的 Store 替身
 *
 * 用它而不是真 Store，是因为要判的是**那根线有没有接上**——
 * 真 Store 里查询口是个私有 ref，接没接上从外面看不出来。
 */
class CapturingStore {
  readonly queries: (IPlayerStatsQuery | null)[] = []

  syncFromEngine(): void {}
  reset(): void {}
  setStatsQuery(query: IPlayerStatsQuery | null): void {
    this.queries.push(query)
  }
}

let store: ReturnType<typeof useGameStore>

beforeEach(() => {
  setActivePinia(createPinia())
  store = useGameStore()
})

// ═══════════════════════════════════════════
// ① Store 的派生值 == 查询口的回答
// ═══════════════════════════════════════════

describe('D41 · Store 面板数值来自查询口', () => {
  it('查询口给什么，面板数据就是什么 —— 一人一个数，不是共用常量', async () => {
    await createBoundGame()

    store.setStatsQuery({
      attackRange: (p) => p.seatIndex + 3,
      maxHandcard: (p) => 10 + p.seatIndex,
    })

    const seats = store.uiPlayers
    expect(seats.length).toBe(5)
    for (const seat of seats) {
      expect(seat.stats.attackRange).toBe(seat.seatIndex + 3)
      expect(seat.stats.maxHandcard).toBe(10 + seat.seatIndex)
    }
  })

  it('换个查询口，数跟着变 —— 只在开局抄一份的话这条会红', async () => {
    await createBoundGame()

    store.setStatsQuery({ attackRange: () => 1, maxHandcard: () => 1 })
    const before = store.uiPlayers.map((u) => u.stats.attackRange)
    expect(before.every((v) => v === 1)).toBe(true)

    store.setStatsQuery({ attackRange: () => 7, maxHandcard: () => 9 })
    const after = store.uiPlayers.map((u) => u.stats.attackRange)
    expect(after.every((v) => v === 7)).toBe(true)
  })

  it('没人注入时退回缺省 —— 缺一块比给个错的强', async () => {
    await createBoundGame()

    store.setStatsQuery(null)
    for (const seat of store.uiPlayers) {
      expect(seat.stats.attackRange).toBe(BASE_ATTACK_RANGE)
      expect(seat.stats.maxHandcard).toBe(seat.maxHp)
    }
  })
})

// ═══════════════════════════════════════════
// ② 控制器把查询口递给了 Store
// ═══════════════════════════════════════════

describe('D41 · 控制器把查询口递给 Store', () => {
  it('先绑 Store 再开局 —— 引擎出生之后补发一次', async () => {
    const fake = new CapturingStore()
    const controller = new GameController({ seed: 7 })
    controller.setDecisionService(new ScriptedDecisionService())
    controller.bindStore(fake)
    await controller.createGame(BOUNDED_5P)

    expect(fake.queries.length).toBe(1)
    expect(fake.queries[0]).not.toBeNull()
  })

  it('先开局再绑 Store —— 另一条顺序也补发，不是只写了一条路径', async () => {
    const fake = new CapturingStore()
    const controller = new GameController({ seed: 7 })
    controller.setDecisionService(new ScriptedDecisionService())
    await controller.createGame(BOUNDED_5P)
    controller.bindStore(fake)

    expect(fake.queries.length).toBe(1)
    expect(fake.queries[0]).not.toBeNull()
  })

  it('重开一局时先把旧的收走 —— 不留一条指向已弃引擎的活引用', async () => {
    const fake = new CapturingStore()
    const controller = new GameController({ seed: 7 })
    controller.setDecisionService(new ScriptedDecisionService())
    controller.bindStore(fake)
    await controller.createGame(BOUNDED_5P)
    await controller.createGame(BOUNDED_5P)

    expect(fake.queries).toContain(null)
    expect(fake.queries[fake.queries.length - 1]).not.toBeNull()
  })

  it(
    '那个查询口问的是引擎 —— 装上武器，面板上的数真的动了',
    async () => {
      const controller = await createBoundGame(WEAPON_DECK_5P, new EquipFirstWeapon())

      // 开局：谁都没装武器。这句同时也是 ③ 的起点——
      // 它单独看是绿的（写死 1 也绿），牙齿在下面那半句。
      expect(store.uiPlayers.length).toBe(5)
      expect(store.uiPlayers.every((u) => u.stats.attackRange === BASE_ATTACK_RANGE)).toBe(true)

      await controller.startGame()
      await waitFor(
        () => store.uiPlayers.some((u) => u.stats.attackRange > BASE_ATTACK_RANGE),
        '有人装上了武器',
      )

      const armed = store.uiPlayers.find((u) => u.stats.attackRange > BASE_ATTACK_RANGE)!
      // 与武器自己写的那个数一致：多算一格 / 少算一格这里都会红
      expect(armed.stats.attackRange).toBe(QingGangJian.attackRange)
      // 顺带证明它真的装着武器，而不是某个别的原因让数字变了
      expect(armed.equipCards.length).toBeGreaterThan(0)
    },
    15000,
  )
})

// ═══════════════════════════════════════════
// ③ 组件把 props 显示出来
// ═══════════════════════════════════════════

function playerInfo(over: Partial<UIPlayerInfo> = {}): UIPlayerInfo {
  return {
    id: 'p0',
    seatIndex: 0,
    name: '德莱厄斯',
    role: null,
    roleRevealed: false,
    alive: true,
    hp: 4,
    maxHp: 4,
    power: 0,
    maxPower: 0,
    hero: null,
    handCount: 3,
    equipCards: [],
    judgeCards: [],
    stats: { attackRange: BASE_ATTACK_RANGE, maxHandcard: 4 },
    isCurrentPlayer: false,
    isHuman: false,
    ...over,
  }
}

function seatOf(stats: { attackRange: number; maxHandcard: number }, maxHp = 4) {
  return mount(PlayerSeat, {
    props: {
      player: playerInfo({ stats, maxHp }),
      x: 0,
      y: 0,
      isCurrent: false,
      isHuman: false,
    },
  })
}

/** 读 DOM 里某个规则数值格子上的文字 */
function statText(html: string, name: string): string {
  const found = new RegExp(`data-stat="${name}"[^>]*>([^<]*)<`).exec(html)
  expect(found, `面板上没有 ${name} 这一格`).not.toBeNull()
  return found![1]!.trim()
}

describe('D41 · PlayerSeat 显示传入的规则数值', () => {
  it('DOM 里就是传进去的那两个数', () => {
    const html = seatOf({ attackRange: 3, maxHandcard: 6 }).html()

    expect(statText(html, 'attackRange')).toContain('3')
    expect(statText(html, 'maxHandcard')).toContain('6')
  })

  it('props 变了 DOM 跟着变 —— 写死的话这一条立刻红', async () => {
    const wrapper = seatOf({ attackRange: BASE_ATTACK_RANGE, maxHandcard: 4 })
    expect(statText(wrapper.html(), 'attackRange')).toContain(String(BASE_ATTACK_RANGE))

    await wrapper.setProps({
      player: playerInfo({ stats: { attackRange: 5, maxHandcard: 2 } }),
    })
    expect(statText(wrapper.html(), 'attackRange')).toContain('5')
    expect(statText(wrapper.html(), 'maxHandcard')).toContain('2')
  })

  it('被抬起来的那一个会高亮，没被抬的不高亮', () => {
    const plain = seatOf({ attackRange: BASE_ATTACK_RANGE, maxHandcard: 4 })
    expect(plain.find('[data-stat="attackRange"]').classes()).not.toContain('boosted')
    expect(plain.find('[data-stat="maxHandcard"]').classes()).not.toContain('boosted')

    const boosted = seatOf({ attackRange: BASE_ATTACK_RANGE + 2, maxHandcard: 6 })
    expect(boosted.find('[data-stat="attackRange"]').classes()).toContain('boosted')
    expect(boosted.find('[data-stat="maxHandcard"]').classes()).toContain('boosted')
  })
})

// ═══════════════════════════════════════════
// ④ 这两处不许自己再算一遍
// ═══════════════════════════════════════════

describe('D41 · 规则数值只有引擎一个答案', () => {
  it('Store 只问不算 —— 它不认识规则层，也不做规则查询', () => {
    const src = readFileSync(join(PROJECT_ROOT, 'src/store/game-store.ts'), 'utf8')

    expect(src).not.toMatch(/^import[^\n]*ModRegistry/m)
    expect(src).not.toMatch(/queryNumeric/)
    // 反过来的对照：它确实把活儿交给了查询口
    expect(src).toMatch(/query\.attackRange\(p\)/)
    expect(src).toMatch(/query\.maxHandcard\(p\)/)
  })

  it('座位组件读的是 Store 递下来的数 —— 不按装备槽位自己算', () => {
    const src = readFileSync(
      join(PROJECT_ROOT, 'src/components/game/PlayerSeat.vue'),
      'utf8',
    )

    expect(src).toMatch(/player\.stats\.attackRange/)
    expect(src).toMatch(/player\.stats\.maxHandcard/)
    expect(src).not.toMatch(/EquipSlot/)
    expect(src).not.toMatch(/equipCards\.find/)
  })

  it('基础攻击范围只有一个定义处 —— 别处一律去引它', () => {
    const files = [
      'src/core/skill/mod-query.ts',
      'src/store/game-store.ts',
      'src/components/game/PlayerSeat.vue',
    ]
    const definitions = files.filter((f) =>
      /export const BASE_ATTACK_RANGE\s*=\s*\d/.test(
        readFileSync(join(PROJECT_ROOT, f), 'utf8'),
      ),
    )

    expect(definitions).toEqual(['src/core/skill/mod-query.ts'])
  })

  it('接线还在：视图把 Store 派生的玩家列表递给了棋盘', () => {
    const view = readFileSync(join(PROJECT_ROOT, 'src/views/game/index.vue'), 'utf8')

    expect(view).toMatch(/:players="gameStore\.uiPlayers"/)
  })
})
