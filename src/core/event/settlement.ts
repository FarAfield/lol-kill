// ============================================================
// 联盟杀 · SettlementPoint — 结算点（暂停 + 座次轮询 + 插入）
//
// 对齐无名杀 `event.chooseToRespond` 的三要素：
//   1. **暂停**：轮询期间事件不往下走，等玩家/AI 作出选择
//   2. **座次轮询**：从指定角色起按座次依次询问，不是随机也不是注册顺序
//   3. **插入**：响应本身是一条新事件，压进 LIFO 栈后立即完整结算（后发先至）
//
// 结算点是**显式开启**的：由事件内容（Content）在需要询问众人时开一个。
// 与步骤机的关系：步骤机决定「事件自己先做什么」，结算点决定
// 「什么时候把话筒交给别人」。
//
// 用法：
// ```ts
// await settle(ctx, {
//   id: 'nanManRuQin',
//   responders: () => seatOrderFrom(alive, user),
//   optionsFor: (p) => cardOptions(p.handCards, CardTag.Strike, '出杀'),
//   prompt: () => '南蛮入侵：是否出杀？',
//   onRespond: async (p, opt) => { await h.discard([opt.card!]) },
//   onUnanswered: async (p) => { await h.damage(p, 1) },
// })
// ```
// ============================================================

import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import { EventSettlementOverflowError } from './errors'

/**
 * 一次响应窗口里玩家可以作出的选择
 *
 * 目前只有卡牌能真正被选中（`kind: 'skill'` 要等 Phase 13 的技能契约）；
 * 但类型从一开始就留成带 kind 的联合，届时不必改签名。
 */
export interface ResponseOption {
  kind: 'card' | 'skill' | 'pass'
  /** `kind === 'card'` 时的卡牌 */
  card?: ICard
  /** `kind === 'skill'` 时的技能 id */
  skillId?: string
  /** 展示文案 */
  label: string
}

/**
 * 询问函数 —— 把「问一个玩家」这件事从结算点里抽出去
 *
 * 返回 `null` 表示放弃响应。
 * 由 `response-inquiry.ts` 的 `createAsker(ctx)` 提供实现。
 */
export type ResponseAsker = (
  player: IPlayer,
  options: ResponseOption[],
  prompt: string,
) => Promise<ResponseOption | null>

/**
 * 结算点
 *
 * 一个结算点 = 一次「轮一圈问大家」的窗口。
 */
export interface SettlementPoint {
  /** 标识（报错与日志用） */
  readonly id: string

  /** 询问文案 */
  prompt(player: IPlayer): string

  /**
   * 参与轮询的玩家，**已按座次排好**
   *
   * 座次在窗口开启的那一刻确定一次，之后的轮询不再重算——
   * 否则中途有人死亡会导致顺序漂移。
   */
  responders(): IPlayer[]

  /**
   * 该玩家可以作出的选择
   *
   * 返回空数组 = 这个人**拿不出东西**，直接按「未响应」处理
   * （触发 `onUnanswered`，但不再去问他——问了也是白问）。
   *
   * 这条很关键：南蛮入侵里「手上没杀」正是要挨伤害的那种人，
   * 不能因为拿不出牌就跳过他。
   */
  optionsFor(player: IPlayer): ResponseOption[]

  /** 玩家作出选择后调用（可 await，内部可发子事件） */
  onRespond(player: IPlayer, option: ResponseOption): Promise<void> | void

  /**
   * 玩家**放弃**响应后调用
   *
   * 南蛮入侵里这就是「不出杀 → 扣血」。
   * 注意：无可选项（optionsFor 为空）时**不**调用它。
   */
  onUnanswered?(player: IPlayer): Promise<void> | void

  /**
   * 放弃是否算「处理过」（默认 true）
   *
   * - `true`：每人在本结算点最多参与一次。南蛮、决斗、求桃都是这个语义。
   * - `false`：本轮有人响应就再轮询一轮，放弃过的人会被重新询问。
   *   这是**无懈可击的连环窗口**需要的——别人打出无懈后，
   *   此前放弃的人可能现在愿意反制。设置此项时 `onUnanswered`
   *   必须能承受重复调用（通常就是不设它）。
   */
  oncePerPlayer?: boolean

  /**
   * 有人响应后立即关闭窗口（默认 false）
   *
   * 濒死求桃：一个桃就够了，不必问完一圈。
   */
  stopOnFirstResponse?: boolean
}

/** 一次成功的响应 */
export interface SettlementResponse {
  player: IPlayer
  option: ResponseOption
}

/** 结算点的执行结果 */
export interface SettlementResult {
  /** 作出过响应的玩家（按响应先后） */
  responses: SettlementResponse[]
  /** 放弃响应的玩家 */
  unanswered: IPlayer[]
  /** 实际轮询轮数 */
  rounds: number
  /** 是否因 `stopOnFirstResponse` 提前关闭 */
  stoppedEarly: boolean
}

/**
 * 结算点执行器
 *
 * 轮询循环（对齐无名杀）：
 * ```
 * do {
 *   changed = false
 *   for (player of roster) {
 *     if (acted.has(player)) continue        // 已响应者不再问
 *     option = await ask(player, optionsFor(player))
 *     if (option) { acted.add; onRespond(); changed = true }
 *     else        { onUnanswered(); if (oncePerPlayer) acted.add }
 *   }
 * } while (changed)                          // 本轮有人响应 → 再开一轮
 * ```
 */
export class SettlementRunner {
  constructor(private readonly ask: ResponseAsker) {}

  async run(point: SettlementPoint): Promise<SettlementResult> {
    // 座次在窗口开启时快照一次
    const roster = point.responders()
    const oncePerPlayer = point.oncePerPlayer !== false

    // 轮数上限：每轮至少有此前放弃的人转为响应，或无人响应而结束。
    // 因此正常轮数 ≤ 人数 + 1，多给 2 轮余量吸收边界情况。
    const maxRounds = roster.length + 3

    const acted = new Set<string>()
    const responses: SettlementResponse[] = []
    const unanswered: IPlayer[] = []

    let rounds = 0
    let changed = true
    let stoppedEarly = false

    while (changed) {
      changed = false
      rounds += 1

      if (rounds > maxRounds) {
        throw new EventSettlementOverflowError(point.id, rounds, roster.length)
      }

      for (const player of roster) {
        // 中途死亡 / 已响应 → 跳过
        if (!player.alive || acted.has(player.id)) continue

        const options = point.optionsFor(player)
        // 拿不出东西 → 不询问，直接按未响应处理（南蛮里就是挨伤害）
        const option =
          options.length > 0
            ? await this.ask(player, options, point.prompt(player))
            : null

        if (option && option.kind !== 'pass') {
          acted.add(player.id)
          responses.push({ player, option })
          await point.onRespond(player, option)
          changed = true

          if (point.stopOnFirstResponse) {
            stoppedEarly = true
            return { responses, unanswered, rounds, stoppedEarly }
          }
          continue
        }

        unanswered.push(player)
        await point.onUnanswered?.(player)
        if (oncePerPlayer) acted.add(player.id)
      }
    }

    return { responses, unanswered, rounds, stoppedEarly }
  }
}

// ── 座次工具 ──

/**
 * 从某人开始的座次顺序
 *
 * @param players  全部玩家（已按 seatIndex 排好）
 * @param from     起点
 * @param includeSelf 是否包含起点自己
 */
export function seatOrderFrom(
  players: readonly IPlayer[],
  from: IPlayer,
  includeSelf = false,
): IPlayer[] {
  if (players.length === 0) return []

  const total = players.length
  const start = from.seatIndex
  const steps = includeSelf ? total : total - 1
  const ordered: IPlayer[] = []

  for (let k = 0; k < steps; k += 1) {
    const offset = includeSelf ? k : k + 1
    const player = players[(start + offset) % total]
    if (player) ordered.push(player)
  }

  return ordered
}

/**
 * 座次差 —— 从 `fromSeat` 顺时针走到 `toSeat` 要走几步
 *
 * 同优先级 handler 的排序依据（谁离当前行动者近谁先）。
 */
export function seatDistance(
  fromSeat: number,
  toSeat: number,
  total: number,
): number {
  if (total <= 0) return 0
  return ((toSeat - fromSeat) % total + total) % total
}
