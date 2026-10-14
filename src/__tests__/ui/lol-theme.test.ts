// ============================================================
// Phase 27 · D27 —— LOL 换皮
//
// 换皮的规矩只有一条：**引擎内部一律用稳定 ID，只在展示层替换名字**。
// 于是这个文件钉的是两头：
//
//  ① **换皮表是全的**。卡牌 / 英雄 / 技能有多少个，表里就得有多少条；
//     每条的 `sgs`（原名）还得与定义里的 `name` 对得上——
//     对不上，提问文案里的【】反查就会悄悄失效。
//  ② **换皮真的发生在展示层，而且只发生在展示层**。
//     卡面 / 座位 / 面板显示 LOL 名，**引擎真值仍是三国杀名**
//     （同一时刻两边都取一次值，比较的是同名不同层）。
//
// 「等于某个值」这类断言天生软：`'盖伦' === '盖伦'` 也绿。
// 所以每条都配了「它会动」的对照：换一张牌 / 换一个英雄，
// 显示的名字要跟着变——写死一个名字是过不了对照的。
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { GameController } from '@/services/game-controller'
import { standard5pConfig } from '@source/modes/standard-5p'
import { standardHeroes, CaoCao, GuanYu } from '@source/heroes/standard'
import { basicCards } from '@source/cards/basic'
import { trickCards } from '@source/cards/tricks'
import { equipCards } from '@source/cards/equips'
import { allHeroSkills } from '@source/heroes/skills'
import {
  LOL_CARD_THEMES,
  LOL_HERO_THEMES,
  LOL_SKILL_THEMES,
  lolPromptText,
} from '@source/theme/lol-mapping'
import { ScriptedDecisionService } from '../helpers/game-env'
import { useGameStore } from '@/store/game-store'
import { useSkill } from '@/hooks/useSkill'
import { useResponse } from '@/hooks/useResponse'
import CardFace from '@/components/card/CardFace.vue'
import { Card } from '@core/entity/card'
import { Sha, Shan } from '@source/cards/basic'
import { BaGuaZhen } from '@source/cards/equips'

// `process.cwd()` 而不是 `fileURLToPath(import.meta.url)`：
// vitest 里的 `import.meta.url` 不是 file: 协议，解析会直接炸。
const PROJECT_ROOT = process.cwd()

/** 全仓卡牌定义（真值源：换皮表必须把它盖满） */
const ALL_CARD_DEFS = [...basicCards, ...trickCards, ...equipCards]

/** 有轮次上限、只有一个英雄的一局 */
function oneHeroGame(hero: (typeof standardHeroes)[number]) {
  return {
    ...standard5pConfig,
    maxRounds: 2,
    heroes: [hero],
    heroSelectCount: 1,
  }
}

/** 读一个目录下所有源码（只看两层，够用） */
function sourceOf(dir: string): string {
  let out = ''
  for (const entry of readdirSync(join(PROJECT_ROOT, dir))) {
    const full = join(PROJECT_ROOT, dir, entry)
    if (statSync(full).isDirectory()) {
      for (const sub of readdirSync(full)) {
        out += readFileSync(join(full, sub), 'utf8')
      }
    } else {
      out += readFileSync(full, 'utf8')
    }
  }
  return out
}

let store: ReturnType<typeof useGameStore>

beforeEach(() => {
  setActivePinia(createPinia())
  store = useGameStore()
})

// ═══════════════════════════════════════════
// ① 换皮表是全覆盖的
// ═══════════════════════════════════════════

describe('D27 · 换皮表盖住了全部定义', () => {
  it('每张卡牌都有换皮，且表里的原名与卡牌定义一致', () => {
    for (const def of ALL_CARD_DEFS) {
      const theme = LOL_CARD_THEMES[def.id]
      expect(theme, `卡牌 ${def.id} 没有换皮`).toBeDefined()
      expect(theme!.sgs).toBe(def.name)
      expect(theme!.name).not.toBe('')
    }
  })

  it('换皮名 ≠ 原名 —— 照抄原名的话这条会红', () => {
    for (const def of ALL_CARD_DEFS) {
      expect(LOL_CARD_THEMES[def.id]!.name).not.toBe(def.name)
    }
  })

  it('每个英雄都有换皮，且表里的原名与英雄定义一致', () => {
    for (const hero of standardHeroes) {
      const theme = LOL_HERO_THEMES[hero.id]
      expect(theme, `英雄 ${hero.id} 没有换皮`).toBeDefined()
      expect(theme!.sgs).toBe(hero.name)
      expect(theme!.name).not.toBe(hero.name)
      expect(theme!.title).not.toBe('')
    }
  })

  it('每个技能都有换皮，且表里的原名与技能定义一致', () => {
    for (const skill of allHeroSkills) {
      const theme = LOL_SKILL_THEMES[skill.id]
      expect(theme, `技能 ${skill.id} 没有换皮`).toBeDefined()
      expect(theme!.sgs).toBe(skill.name)
      expect(theme!.name).not.toBe(skill.name)
    }
  })
})

// ═══════════════════════════════════════════
// ② 卡面显示的是换过的名字
// ═══════════════════════════════════════════

/** 读卡面上那一格牌名（描述里会引用别的牌，所以只取名字那一格） */
function cardNameOf(html: string): string {
  const found = /class="card-name">([^<]*)</.exec(html)
  expect(found, '卡面上没有牌名那一格').not.toBeNull()
  return found![1]!.trim()
}

describe('D27 · 卡面', () => {
  it('杀 → 致命打击：卡面上不再出现三国杀的牌名', () => {
    const wrapper = mount(CardFace, { props: { card: Card.create(Sha) } })
    const html = wrapper.html()

    expect(cardNameOf(html)).toBe('致命打击')
    expect(html).not.toContain('杀')
  })

  it('换一张牌，名字跟着变 —— 写死一个名字的话这条立刻红', async () => {
    const wrapper = mount(CardFace, { props: { card: Card.create(Sha) } })
    expect(cardNameOf(wrapper.html())).toBe('致命打击')

    await wrapper.setProps({ card: Card.create(Shan) })
    expect(cardNameOf(wrapper.html())).toBe('闪现')
  })

  it('描述也是换过的那句 —— 里面引用别的牌时用的是新名', () => {
    const wrapper = mount(CardFace, { props: { card: Card.create(BaGuaZhen) } })
    const html = wrapper.html()

    expect(html).toContain('【闪现】')
    expect(html).not.toContain('【闪】')
  })
})

// ═══════════════════════════════════════════
// ③ 英雄名：Store 派生出 LOL 名，引擎真值不动
// ═══════════════════════════════════════════

describe('D27 · 座位上的英雄名', () => {
  async function bootWith(hero: (typeof standardHeroes)[number]): Promise<GameController> {
    const controller = new GameController({ seed: 27 })
    controller.setDecisionService(new ScriptedDecisionService())
    controller.bindStore(store)
    await controller.createGame(oneHeroGame(hero))
    return controller
  }

  it('Store 派生的名字是 LOL 名（关羽 → 德莱厄斯）', async () => {
    await bootWith(GuanYu)

    expect(store.uiPlayers[0]!.name).toBe('德莱厄斯')
    expect(store.uiPlayers[0]!.hero!.title).toBe('诺克萨斯之手')
  })

  it('同一时刻引擎真值仍是三国杀名 —— 换皮没有倒流进引擎', async () => {
    const controller = await bootWith(GuanYu)
    const engineHero = controller.getGameState()!.players[0]!.heroes[0]!

    // 这两句是一组：显示层换了、数据层没换。少取一边就成了句废话。
    expect(engineHero.name).toBe('关羽')
    expect(store.uiPlayers[0]!.name).not.toBe(engineHero.name)
  })

  it('换个英雄名字跟着变（曹操 → 盖伦）—— 这是「它会动」的对照', async () => {
    await bootWith(GuanYu)
    expect(store.uiPlayers[0]!.name).toBe('德莱厄斯')

    await bootWith(CaoCao)
    expect(store.uiPlayers[0]!.name).toBe('盖伦')
  })
})

// ═══════════════════════════════════════════
// ④ 技能面板
// ═══════════════════════════════════════════

describe('D27 · 技能面板上的技能名', () => {
  it('面板给的是 LOL 技能名（武圣 → 诺克萨斯断头台）', async () => {
    const controller = new GameController({ seed: 27 })
    controller.setDecisionService(new ScriptedDecisionService())
    controller.bindStore(store)
    await controller.createGame(oneHeroGame(GuanYu))

    const skills = useSkill(() => controller).availableSkills.value
    expect(skills.length).toBeGreaterThan(0)

    // id 仍然是稳定 ID（引擎据此判定），名字才是换过皮的那个
    expect(skills.map((s) => s.id)).toContain('wusheng')
    expect(skills.find((s) => s.id === 'wusheng')!.name).toBe('诺克萨斯断头台')
    expect(skills.some((s) => s.name === '武圣')).toBe(false)
  })
})

// ═══════════════════════════════════════════
// ⑤ 提问文案
// ═══════════════════════════════════════════

describe('D27 · 响应弹窗的提问文案', () => {
  it('整句换掉：万箭齐发 → 箭雨', () => {
    expect(lolPromptText('万箭齐发：是否出闪？')).toBe('箭雨：是否打出【闪现】？')
  })

  it('带前缀的整句里，【】中的牌名也换 —— 反查失效的话这条会红', () => {
    expect(lolPromptText('张三：是否使用【无懈可击】？')).toBe(
      '张三：是否使用【法术护盾】？',
    )
  })

  it('窗口显示的文案是换过的那句', async () => {
    const r = useResponse()
    const pending = r.open({
      prompt: '万箭齐发：是否出闪？',
      validCardIds: [],
      timeoutMs: 0,
      required: false,
    })

    expect(r.prompt.value).toBe('箭雨：是否打出【闪现】？')

    r.cancel()
    await pending
  })
})

// ═══════════════════════════════════════════
// ⑥ 边界：换皮只许出现在展示层
// ═══════════════════════════════════════════

describe('D27 · 换皮没有渗进引擎与定义层', () => {
  it('引擎与决策服务不认识换皮表', () => {
    // 换皮渗进引擎的后果不是「显示错了」，而是规则层背上了一套皮肤：
    // 以后改名字要考虑判定，改判定要考虑名字。
    expect(sourceOf('src/core')).not.toMatch(/theme\/lol-mapping/)
    expect(sourceOf('src/services')).not.toMatch(/theme\/lol-mapping/)
  })

  it('卡牌 / 英雄 / 技能定义都还是三国杀的名字', () => {
    // 定义层改名而换皮表的 `sgs` 没跟上，提问文案的反查就会静默失效，
    // 所以这两层必须各留各的名字。
    expect(sourceOf('src/source/cards')).not.toMatch(/theme\/lol-mapping/)
    expect(sourceOf('src/source/heroes')).not.toMatch(/theme\/lol-mapping/)
    expect(readFileSync(join(PROJECT_ROOT, 'src/source/cards/basic.ts'), 'utf8')).toMatch(
      /name: '杀'/,
    )
  })
})
