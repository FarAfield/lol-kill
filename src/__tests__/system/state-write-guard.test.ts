// ============================================================
// 状态变更收口 · 源码结构护栏（2026-09-30 重写）
//
// **追因**：Phase 19 的验收是一条 grep——
//
//   grep -rn "\.hp -=\|\.zone =\|handCards.push\|handCards.splice" src/core
//
// 它当时打勾通过了，但 **D9 / D10 全部从它的指缝里漏过去**。原因很具体：
// 这条模式只认四种写法，而「直接改状态」的写法远不止四种。见下。
//
// **这条模式漏掉的写法**（逐条对照，一条不多一条不少）：
//
// 1. 赋值 `x.hp = …` —— D9 的 `player.hp = player.maxHp` 正是这个（`=` 不在模式里，
//    模式只认 `-=`）
// 2. 复合赋值 `+=` —— D9 的 `player.maxHp += LORD_HP_BONUS`（模式只认 `-=`）
// 3. `++` / `--` —— 自增自减完全不在视野
// 4. 整体替换数组 `x.shouldSkipPhases = [...]` —— D10 的两处正是这个；
//    模式只认 `handCards.push` / `handCards.splice` 两种调用，不认 `=` 到数组字段
// 5. 换了个字段名就不认 —— 模式只盯 `handCards`，`equipCards` / `judgeCards` /
//    `shouldSkipPhases` / `skippedPhases` / `heroes` 一概不管
// 6. 数组变更器只认两个 —— `pop` / `shift` / `unshift` / `reverse` / `sort` /
//    `fill` / `copyWithin` 全是漏网，其中 `sort` / `reverse` 是原地改
// 7. `marks` 的 Map 写入（`.marks.set/delete/clear`）不认 —— 标记是重要的账本
// 8. 卡牌三件套不全 —— 只认 `zone`，漏了 `owner` / `visibleTo`
// 9. 范围只到 `src/core`，内容层 `src/source` 完全没进视野
//    —— D10 里 `delayed-contents.ts` / `wu-skills.ts` 两处正是因此一直没上榜
//
// 另有一条**假阳性**：`\.zone =` 会命中比较 `card.zone === ZoneType.X`。
// 既漏又噪，等于这条护栏在自欺。
//
// **本文件做什么**：把上面这些写法一次性收进来，并且**真正跑起来**——
// 它是一条测试，每次 `npm run test` 都会执行，而不是写在文档里等人手工 ps。
//
// **为什么要有 BASELINE**：护栏变严之后，历史上积累的漏网会一次性冒头。
// 本轮只结清 D9 / D10，其余（见 BASELINE 备注）按要求**只登记、不动手**。
// 因此这里用「已知漏网基线」而不是写到全绿：新增一处直写会立刻红，
// 修好一处而忘记删基线也会红——两种方向都不会静默过去。
// ============================================================

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// ── 扫描范围 ──

const PROJECT_ROOT = process.cwd()

/** 扫描根目录 —— 比原来多覆盖了内容层与 UI 层 */
const SCAN_ROOTS = [
  'src/core',
  'src/source',
  'src/services',
  'src/hooks',
  'src/store',
  'src/components',
]

/** 这两个目录**就是**唯一的写入点，它们是标准答案而非违规 */
const SYSTEM_DIR = '/system/'

/** 标量 / 引用字段：任何直接赋值都算绕过 */
const VALUE_FIELDS = [
  'hp',
  'maxHp',
  'power',
  'maxPower',
  'alive',
  'role',
  'roleRevealed',
  'heroes',
  'usedAttackThisTurn',
  'attackLimit',
  'zone',
  'owner',
  'visibleTo',
]

/** 数组字段：整体替换与原地变更器都算绕过 */
const ARRAY_FIELDS = [
  'handCards',
  'equipCards',
  'judgeCards',
  'shouldSkipPhases',
  'skippedPhases',
  'heroes',
  'visibleTo',
]

/** 原地改一个数组的所有方法 —— 「两个」是不够的 */
const ARRAY_MUTATORS = [
  'push',
  'pop',
  'splice',
  'shift',
  'unshift',
  'reverse',
  'sort',
  'fill',
  'copyWithin',
]

interface Violation {
  file: string
  line: number
  text: string
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      // 测试自己不扫——里面满是为了造局面而做的直接写入
      if (entry.name === '__tests__') continue
      walk(full, out)
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full)
    }
  }
}

/** 注释里的示例写法不是真的写入（`* player.hp = 1` 这种教学句式） */
function isCommentLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')
}

/**
 * 实体构造函数里 `this.x = data.x` 是**由数据造一个实体**，不是改现场状态
 *
 * 这条放行窄到只剩下这一种形状：`this.<字段>` 后紧跟 `data.`。
 * 任何把 `this` 换成变量、把 `data.x` 换成表达式的写法都照旧被抓。
 */
function isEntityHydration(file: string, line: string): boolean {
  return (
    file.includes('/core/entity/') &&
    new RegExp(`^\\s*this\\.(${[...VALUE_FIELDS, ...ARRAY_FIELDS].join('|')})\\s*=\\s*data\\.`).test(
      line,
    )
  )
}

const VALUE_ASSIGN = new RegExp(
  `\\.(${VALUE_FIELDS.join('|')})\\s*(=(?!=)|\\+=|-=|\\*=|\\+\\+|--)`,
)
const ARRAY_REPLACE = new RegExp(`\\.(${ARRAY_FIELDS.join('|')})\\s*(=(?!=)|\\+=)`)
const ARRAY_MUTATE = new RegExp(
  `\\.(${ARRAY_FIELDS.join('|')})\\s*\\.\\s*(${ARRAY_MUTATORS.join('|')})\\s*\\(`,
)
const MARKS_WRITE = /\.marks\s*\.\s*(set|delete|clear)\s*\(/

/**
 * 判定一行源码是不是「绕过写入点直接改状态」
 *
 * 从扫描器里抽出来是为了能被测：这条模式是被漏了好几次才改对的，
 * 「哪里改坏了」必须有一眼可见的断点，而不是埋在文件遍历里。
 *
 * @param line 源码行
 * @param file 所属文件（`entity/` 下的构造函数 hydration 有放行）
 */
function matchWritable(line: string, file = ''): boolean {
  if (isCommentLine(line)) return false
  if (isEntityHydration(file, line)) return false
  return (
    VALUE_ASSIGN.test(line) ||
    ARRAY_REPLACE.test(line) ||
    ARRAY_MUTATE.test(line) ||
    MARKS_WRITE.test(line)
  )
}

function scanFile(absPath: string): Violation[] {
  const file = relative(PROJECT_ROOT, absPath).replace(/\\/g, '/')
  if (file.includes(SYSTEM_DIR)) return []

  const found: Violation[] = []
  const lines = readFileSync(absPath, 'utf8').split('\n')

  lines.forEach((line, i) => {
    if (matchWritable(line, file)) {
      found.push({ file, line: i + 1, text: line.trim() })
    }
  })

  return found
}

function scanAll(): Violation[] {
  const files: string[] = []
  for (const root of SCAN_ROOTS) walk(join(PROJECT_ROOT, root), files)
  return files.flatMap(scanFile)
}

// ── 已知漏网基线 ──
//
// 每消除一处，就从这里删掉一条（少删一条测试会红——这是故意的，
// 它逼着「修好了」这件事被显式登记）。

interface KnownLeak {
  file: string
  /** 该文件上仍存在的绕过字段；全部消失后整条记录删除 */
  fields: string[]
  /** §3.1 欠账编号；没有编号的写明「本轮新发现」 */
  debt: string
}

// D9（`game-engine.ts` 的 role / roleRevealed / maxHp / hp）已于 2026-09-30 结清并删除。
// D10（五处阶段跳过直写）已于 2026-09-30 全部结清并删除；只剩下面新发现的一条。
const BASELINE: KnownLeak[] = [
  {
    file: 'src/core/entity/card.ts',
    fields: ['visibleTo'],
    debt: 'D28 本轮新发现：`Card.revealTo` 是实体上的变更方法且零调用方',
  },
]

function key(v: Violation, field: string): string {
  return `${v.file}|${field}`
}

/** 一条违规行里命中的字段 */
function fieldsIn(v: Violation): string[] {
  const hit = (list: string[]): string[] =>
    list.filter((f) => new RegExp(`\\.${f}\\b`).test(v.text))
  return [...new Set([...hit(VALUE_FIELDS), ...hit(ARRAY_FIELDS)])]
}

describe('状态变更收口 · 结构护栏（源码级）', () => {
  it('system/ 之外不允许存在直接状态写入 —— 已知漏网仅限基线', () => {
    const violations = scanAll()
    const actual = new Set<string>()
    for (const v of violations) {
      for (const f of fieldsIn(v)) actual.add(key(v, f))
    }

    const expected = new Set<string>()
    for (const leak of BASELINE) {
      for (const f of leak.fields) expected.add(`${leak.file}|${f}`)
    }

    const unexpected = [...actual].filter((k) => !expected.has(k)).sort()
    const stale = [...expected].filter((k) => !actual.has(k)).sort()

    expect(
      unexpected,
      '以下位置存在未登记的直接状态写入 —— 请改走 PlayerSystem / CardSystem，或显式登记进 BASELINE',
    ).toEqual([])

    expect(
      stale,
      'BASELINE 里记的漏网已经不复存在 —— 说明它被修好了，请删掉对应条目',
    ).toEqual([])
  })

  it('护栏本身没写窄：九种写法每一种都能命中', () => {
    // 这条用例盯着**扫描器自己**。上面那条之所以能长期全绿却什么也没抓住，
    // 就是因为原来的模式太窄；没有这条，同样的事会以更隐蔽的样子重演。
    const cases: Array<[form: string, source: string]> = [
      ['赋值', 'p.hp = 3'],
      ['复合赋值', 'p.maxHp += 1'],
      ['自增', 'p.hp++'],
      ['数组整体替换', 'p.shouldSkipPhases = [GamePhase.PhaseUse]'],
      ['数组成员变更', 'p.judgeCards.push(card)'],
      ['原地排序', 'p.equipCards.sort()'],
      ['标记写入', "p.marks.set('key', 1)"],
      ['卡牌持有者', 'card.owner = player'],
      ['卡牌可见性', 'card.visibleTo = players'],
    ]

    for (const [form, source] of cases) {
      expect(matchWritable(source), `${form} 应当被判为直接写入：${source}`).toBe(true)
    }
  })

  it('假阳性已修掉：`===` 比较不再被当成写入', () => {
    // 旧模式 `\.zone =` 会把 `card.zone === ZoneType.Hand` 认成写入，
    // 于是护栏长期处于「既漏又噪」的状态。
    expect(matchWritable('if (card.zone === ZoneType.Hand) return')).toBe(false)
    expect(matchWritable('return player.hp === 0')).toBe(false)
  })

  it('实体由数据构造不算写入 —— 但换成别的对象也不算放行', () => {
    expect(
      matchWritable('    this.hp = data.hp ?? 0', 'src/core/entity/player.ts'),
    ).toBe(false)
    // 同一行若出现在别处，就是实打实的绕过
    expect(matchWritable('    this.hp = data.hp ?? 0', 'src/core/engine/game-engine.ts')).toBe(
      true,
    )
  })
})
