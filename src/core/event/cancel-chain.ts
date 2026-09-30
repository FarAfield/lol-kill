// ============================================================
// 联盟杀 · CancelChain — 无懈可击链式抵消（后发先至）
//
// 规则：一张锦囊生效前，从使用者的下家起按座次问「是否使用无懈可击」。
// 一旦有人使用，问询就**上移一层**：新的问题不再是「是否抵消这张锦囊」，
// 而是「是否抵消刚才那张无懈」。层层嵌套，直到某一层无人响应为止。
//
//   T 南蛮入侵（cancelDepth 0）
//     └ 层 1：问 T → C 出无懈 W1（cancelDepth 1）
//         └ 层 2：问 W1 → D 出无懈 W2（cancelDepth 2）
//             └ 层 3：问 W2 → 无人响应
//                 → W2 生效，抵消 W1
//                 → W1 被抵消，不再抵消 T
//                 → T 照常结算
//
// 关键：**每张无懈都是一条真正的 `useCard` 事件**。
// 它不是「给原事件记个数」，而是压进 LIFO 栈后立刻完整结算，
// 因此层级天然正确 —— 这就是「后发先至」：
// 最后打出的那张最先结算，抵消它上面那张。
//
// 只问一层是本模块的设计边界：更深的层由那张无懈自己的
// `useCard` 内容再调一次 `openCancelChain` 打开。事件嵌套
// 代替了手写递归，栈就是链。
// ============================================================

import type { IGameEvent } from '@core/contracts/event.interface'
import type { ISkillContext } from '@core/contracts/skill.interface'
import type { ICard } from '@core/contracts/card.interface'
import { CardTag } from '@core/contracts/card-tag'
import { helpers } from './content-helpers'
import { cardOptions, handOptions, settle } from './response-inquiry'
import { seatOrderFrom } from './settlement'

/**
 * 抵消链层数上限（防御性）
 *
 * 真正的边界是 `IEventRunner.maxDepth`（默认 20）；每层抵消消耗
 * 两层嵌套（useCard + 卡牌事件），因此 8 层对弈已绰绰有余。
 * 兜住的是「互相抵消」这类规则漏洞导致的无限加深。
 */
export const MAX_CANCEL_CHAIN = 8

/** `event.data` 里放「被抵消事件」的键 */
export const COUNTER_TARGET_KEY = 'counterTarget'
/** `event.data` 里放询问文案的键 */
export const COUNTER_LABEL_KEY = 'counterLabel'
/** `event.result` 里放抵消链（按打出先后）的键 */
export const COUNTER_CHAIN_KEY = 'counters'

/** 一次开窗的结果 */
export interface CancelChainResult {
  /** 打出的无懈事件，按**打出先后**排列（第 0 个最先打出） */
  counters: IGameEvent[]
  /** 目标最终是否被抵消 */
  cancelled: boolean
  /** 本层之下还有多少层（等于 counters 长度） */
  depth: number
}

/**
 * 抵消守卫
 *
 * 返回 `false` = 「这张不许被无懈」；返回 `undefined`/`true` = 不干预。
 * Phase 11 的 `ModRegistry` 会把 `mod.cardCancelable`（验收清单 #13）
 * 接到这里，届时无需改动本文件。
 */
export type CancelGuard = (
  event: IGameEvent,
  card: ICard | undefined,
) => boolean | undefined

const cancelGuards: CancelGuard[] = []

/**
 * 注册一个抵消守卫，返回注销函数
 */
export function registerCancelGuard(guard: CancelGuard): () => void {
  cancelGuards.push(guard)
  return () => {
    const index = cancelGuards.indexOf(guard)
    if (index >= 0) cancelGuards.splice(index, 1)
  }
}

/** 清空全部守卫（测试 / 重开用） */
export function clearCancelGuards(): void {
  cancelGuards.length = 0
}

/**
 * 判断一个值是不是事件（用于从 `data` 里安全取出 `counterTarget`）
 */
export function isGameEventLike(value: unknown): value is IGameEvent {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<IGameEvent>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.cancel === 'function' &&
    typeof candidate.transitionTo === 'function'
  )
}

/**
 * 该事件此刻能否被无懈可击抵消
 *
 * 四道关：结构性标记 → 强制事件 → 已终态 → 卡牌自身 / 守卫。
 * 任何一道不过，窗口就不开——而不是开了再白问一圈。
 */
export function canBeCountered(event: IGameEvent): boolean {
  if (!event.cancelable) return false
  if (event.forced) return false
  if (event.isTerminal) return false

  const card = event.card
  if (card && card.canBeCanceled === false) return false

  for (const guard of cancelGuards) {
    if (guard(event, card) === false) return false
  }

  return true
}

/** 从事件结果里读出它下面挂着的抵消链 */
function readChain(event: IGameEvent): IGameEvent[] {
  const chain = event.result[COUNTER_CHAIN_KEY]
  if (!Array.isArray(chain)) return []
  return chain.filter(isGameEventLike)
}

/**
 * 开**一层**无懈可击窗口
 *
 * 只负责问「是否抵消 `target` 这一件事」；有人打出无懈，就把它
 * 变成一条真正的 `useCard` 事件并立即完整结算——那条事件自己的内容
 * 会再开下一层窗口。所以调用方拿到结果时，整条链已经结算完毕。
 *
 * @param ctx    事件上下文（`ctx.event` 应为 `target` 或它的祖先）
 * @param target 被抵消的事件
 * @param label  询问文案里显示的名字
 */
export async function openCancelChain(
  ctx: ISkillContext,
  target: IGameEvent,
  label: string,
): Promise<CancelChainResult> {
  const nothing: CancelChainResult = {
    counters: [],
    cancelled: target.cancelled,
    depth: 0,
  }

  // 不可抵消 / 链已到上限 → 一个字都不问
  if (!canBeCountered(target)) return nothing
  if (target.cancelDepth >= MAX_CANCEL_CHAIN) return nothing

  const h = helpers(ctx)
  // 轮询起点：被抵消事件发起者的下家。
  // 第 2 层起就是「上一张无懈的使用者」的下家——这正是官方规则里
  // 「每次抵消都重新从使用者下家问起」。
  const anchor = target.player ?? target.source ?? ctx.player

  let played: IGameEvent | undefined

  await settle(ctx, {
    id: `counter:${target.name}#${target.cancelDepth}`,

    responders: () => seatOrderFrom(ctx.game.players, anchor).filter((p) => p.alive),

    // 只有无懈可击能进这个窗口——杀、闪、桃都不是这里的答案。
    // 能不能用则交给 `mod.cardRespondable`：被封了响应的无懈不该出现在选项里。
    //
    // 虚拟牌同样要能进：今天还没有「把 X 当无懈」的技能，但窗口不该
    // 因为「恰好没人这么定义」而对视作结果关上门——那是一处静默的
    // 「定义了也不生效」。
    optionsFor: (player) => [
      ...handOptions(player, CardTag.Counter, undefined, (card) =>
        ctx.mods.cardRespondable(player, card, ctx.event),
      ),
      ...cardOptions(
        ctx
          .cardViews({ player, usage: 'response', requireTag: CardTag.Counter, event: ctx.event })
          .map((view) => view.card),
      ),
    ],

    prompt: () => `${label}：是否使用【无懈可击】？`,

    // 一人出手，问询就上移一层，本层不再问下去
    stopOnFirstResponse: true,

    onRespond: async (player, option) => {
      const card = option.card
      if (!card) return

      // 用牌有代价：先离手，免得更深的窗口里又摸到同一张
      await h.discard([card])

      played = await ctx.event.trigger('useCard', {
        source: player,
        player,
        cards: [card],
        cancelable: true,
        cancelDepth: target.cancelDepth + 1,
        data: {
          [COUNTER_TARGET_KEY]: target,
          [COUNTER_LABEL_KEY]: label,
        },
      })
    },
  })

  if (!played) return nothing

  // 更深几层的链由那张无懈自己记下来，这里拼成完整一条
  const counters = [played, ...readChain(played)]
  ctx.event.result[COUNTER_CHAIN_KEY] = counters

  return { counters, cancelled: target.cancelled, depth: counters.length }
}
