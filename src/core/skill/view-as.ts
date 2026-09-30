// ============================================================
// 联盟杀 · ViewAsService — 视作系统（Phase 16）
//
// 「这张牌是什么」与「这张牌能当什么用」是两件事。
// 前者在它被造出来时就定了；后者由技能在**每次被问**时回答：
//
//   关羽的红牌 → 杀（武圣）
//   赵云的杀   → 闪（龙胆）
//   两张手牌   → 杀（丈八蛇矛）
//
// 若技能的契约里没有这一层，这些技能就只能要么写死到卡牌判定里
// （`if (card.isRed && hero === '关羽')`），要么写在出牌阶段的某一处
// 分支里——两者都是「引擎认识内容」，而内容层应当是可插拔的。
//
// ── 虚拟牌的三个约定 ──
// 1. **不属于任何区域**。虚拟牌是视图，不是实体；真正被使用、
//    被弃置的是 `ICardView.baseCards`。区域的盈亏因此完全守恒。
// 2. **`viewAs` 必须给出 `id`**。用牌时以卡牌 id 作为事件名分发内容
//    （见 `useCardContent`），id 写错就是「打出去了但什么也没发生」。
// 3. **底牌只在自己的区域里挑**。`position`（默认手牌）划定范围，
//    因此一张视图要消耗的牌，必然属于它的主人。
// ============================================================

import type {
  CardViewQuery,
  ICardView,
  IViewAsContext,
  IViewAsService,
  ISkill,
  ISkillRegistry,
  SkillEnableContext,
  SkillPosition,
  SkillSelectCount,
} from '@core/contracts/skill.interface'
import type { CardDefinition, ICard } from '@core/contracts/card.interface'
import type { IModQuery } from '@core/contracts/mod.interface'
import type { IGameState } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { Card } from '@core/entity/card'

/**
 * ViewAsService 的依赖
 *
 * 三样都只读：账台（谁有什么技能）、Mod（让不让用）、状态（现在什么局面）。
 * 它自己不改任何东西——造出来的视图要等到有人真的打出它才产生变化。
 */
export interface ViewAsDeps {
  /** 全局状态 */
  state: IGameState
  /** 技能台账：候选技能从这里拿 */
  skillRegistry: ISkillRegistry
  /** Mod 查询口 */
  modQuery: IModQuery
}

/**
 * 视作服务
 */
export class ViewAsService implements IViewAsService {
  private deps: ViewAsDeps

  constructor(deps: ViewAsDeps) {
    this.deps = deps
  }

  /**
   * 列出此刻所有可用的视作结果
   *
   * 顺序是确定的：技能按持有顺序、**底牌在区域里的顺序**、同技能的
   * 选牌组合按字典序。UI 因此不会每次刷新都换一个排列，测试也能
   * 断言「第一个」是谁。
   */
  getViews(query: CardViewQuery): ICardView[] {
    const { player } = query
    if (!player.alive) return []

    const views: ICardView[] = []
    for (const skill of this.deps.skillRegistry.getSkills(player)) {
      if (!this.provides(skill, player, query)) continue
      views.push(...this.viewsOf(skill, player, query))
    }
    return views
  }

  // ── 内部 ──

  /**
   * 这条技能是否来回答这次查询
   *
   * 「能不能手动发动」已经有了答案——就是 `enable`。
   * 不写 `enable` 的技能没有手动入口，因此不在这里提供视作：
   * 它既不该出现在候选列表里，也不该回答 GUI 的询问。
   */
  private provides(skill: ISkill, player: IPlayer, query: CardViewQuery): boolean {
    if (!skill.viewAs) return false
    if (!skill.enable?.includes(query.usage)) return false
    // 额度：频率耗尽 / 限定技用过的技能不再提供答案
    if (!this.deps.skillRegistry.isAvailable(player, skill.id)) return false
    return true
  }

  /** 一条技能能造出哪些视图 */
  private viewsOf(skill: ISkill, player: IPlayer, query: CardViewQuery): ICardView[] {
    const viewAs = skill.viewAs
    if (!viewAs) return []

    const ctx = this.context(player, query)
    const pool = cardsIn(player, skill.position ?? ['h']).filter(
      (card) => skill.filterCard?.(card, ctx) ?? true,
    )

    const views: ICardView[] = []
    for (const combo of combinationsOf(pool, skill.selectCard ?? 1)) {
      const override = viewAs(combo[0]!, ctx, combo)
      if (!override) continue

      const card = Card.createVirtual(combo[0]!, override, combo, skill.id)
      if (query.requireTag && !card.tags.has(query.requireTag)) continue
      if (query.allow && !query.allow(card)) continue
      if (!this.usageAllowed(player, card, query.usage, query.event)) continue

      views.push({ card, baseCards: combo, skillId: skill.id, skillName: skill.name })
    }
    return views
  }

  /** 交给 `viewAs` / `filterCard` 的上下文 */
  private context(player: IPlayer, query: CardViewQuery): IViewAsContext {
    return {
      player,
      game: this.deps.state,
      mods: this.deps.modQuery,
      usage: query.usage,
    }
  }

  /**
   * 使用场景对应的 Mod 闸门
   *
   * 「你想变出来的这张牌，此刻让不让用」——虚拟牌同样要过这一关：
   * 「你不能打出【闪】」必须连「把杀当闪」也一起否掉，否则禁令
   * 会在视作技能面前失效。
   */
  private usageAllowed(
    player: IPlayer,
    card: ICard,
    usage: SkillEnableContext,
    event: CardViewQuery['event'],
  ): boolean {
    const mods = this.deps.modQuery
    if (usage === 'dying') return mods.cardSavable(player, card, event)
    if (usage === 'response') return mods.cardRespondable(player, card, event)
    return mods.cardEnabled(player, card, event)
  }
}

// ═══════════════════════════════════════════
// 纯函数助手
// ═══════════════════════════════════════════

/**
 * 视作某张牌 —— 生成一段 `viewAs` 的覆盖项
 *
 * 直接从卡牌定义取 id / type / tags，因此**内容分发与规则判定看到的
 * 就是那张牌本身**，而不是「名字像它的另一张牌」。
 *
 * ```ts
 * viewAs: () => viewLike(Sha, { name: '杀（武圣）' })
 * ```
 */
export function viewLike(
  def: CardDefinition,
  options?: { name?: string; description?: string },
): Partial<ICard> {
  return {
    id: def.id,
    name: options?.name ?? def.name,
    type: def.type,
    tags: new Set(def.tags),
    effectIds: [...def.effectIds],
    description: options?.description ?? def.description,
    equipSlot: def.equipSlot,
    attackRange: def.attackRange,
    isDelayed: def.isDelayed,
    canBeCanceled: def.canBeCanceled,
  }
}

/** 取视图里的虚拟牌本体 */
export function viewsToCards(views: readonly ICardView[]): ICard[] {
  return views.map((view) => view.card)
}

/** 按使用场景取一张/一组牌能视作什么（便利封装） */
export function cardViewsOf(
  service: IViewAsService,
  player: IPlayer,
  usage: SkillEnableContext,
  requireTag?: CardViewQuery['requireTag'],
): ICardView[] {
  return service.getViews({ player, usage, requireTag })
}

/**
 * `position` 指到的区域里的牌
 *
 * 默认 `['h']`——绝大多数视作看的是手牌。
 */
function cardsIn(player: IPlayer, positions: SkillPosition[]): ICard[] {
  const cards: ICard[] = []
  for (const position of positions) {
    if (position === 'h') cards.push(...player.handCards)
    else if (position === 'e') cards.push(...player.equipCards)
    else if (position === 'j') cards.push(...player.judgeCards)
  }
  return cards
}

/**
 * `selectCard` 归一化成区间
 *
 * 不写就是一张——「一张当一张」是最普遍的视作，
 * 不该每定义一个这样的技能都写一遍 `selectCard: 1`。
 */
export function selectRange(count: SkillSelectCount | undefined): {
  min: number
  max: number
} {
  if (count === undefined) return { min: 1, max: 1 }
  if (Array.isArray(count)) return { min: count[0], max: count[1] }
  return { min: count, max: count }
}

/**
 * 从 `pool` 里取 size 张的所有组合（无重复、保序、确定性）
 *
 * 多底牌的视作（丈八蛇矛：两张手牌当杀）靠它枚举。写成生成器是为了
 * 让调用方可以在中途停止——候选集合上百条时不必先造够全部。
 */
export function* combinations<T>(pool: readonly T[], size: number): Generator<T[]> {
  if (size <= 0 || size > pool.length) return

  const picked: T[] = []
  function* walk(start: number): Generator<T[]> {
    if (picked.length === size) {
      yield [...picked]
      return
    }
    // 剪枝：剩下的位置要留得够，不必走到数组尽头
    const remaining = size - picked.length
    for (let i = start; i <= pool.length - remaining; i += 1) {
      picked.push(pool[i]!)
      yield* walk(i + 1)
      picked.pop()
    }
  }

  yield* walk(0)
}

/**
 * 枚举 `min..max` 张的全部组合
 *
 * 按「代价小的先」输出：花一张就能办成的事不该排在花两张的后面。
 */
export function* combinationsOf<T>(
  pool: readonly T[],
  count: SkillSelectCount | undefined,
): Generator<T[]> {
  const { min, max } = selectRange(count)
  for (let size = min; size <= max; size += 1) {
    yield* combinations(pool, size)
  }
}
