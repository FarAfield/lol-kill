// ============================================================
// 联盟杀 · WinCondition — 胜负判定（纯函数）
//
// 欠账 D17 的形态甲：胜负规则从 `DeathSystem` 里**抽出来**，成为
// 可以直接喂状态单测的纯函数。
//
// 抽出来的理由不是「代码太长」，而是**职责**：
//   - `DeathSystem` 做的是**状态变更**（弃牌、公开身份、记奖惩）；
//   - 「谁赢了」是**规则**，它不该依赖任何系统实例，也不该有副作用。
// 混在一起的直接后果是：想验一条胜负规则，得先打完一局。
//
// 身份一律用引擎标识：Aspect / Guardian / Ascended / Infiltrator。
// 「主公 / 忠臣 / 反贼 / 内奸」是三国杀语汇，只在展示层换皮时出现。
// ============================================================

import { RoleType } from '@core/contracts/enums'
import type { IPlayer } from '@core/contracts/player.interface'

/**
 * 判定输入 —— 只要「谁是啥身份、还活着吗」
 *
 * 刻意不收 `GameStateSnapshot`：胜负与牌堆、阶段、日志一概无关，
 * 喂一个最小快照才能让那 9 种终局写成**纯函数单测**。
 */
export interface WinSnapshot {
  players: ReadonlyArray<Pick<IPlayer, 'role' | 'alive'>>
}

/** 终局的性质 —— 平局 / 流局不是死亡触发的，但接口上必须有位置 */
export type EndgameKind =
  /** 某阵营达成胜利条件 */
  | 'victory'
  /** 无人达成（如全员死亡） */
  | 'draw'
  /** 达到轮次上限，打不动了 */
  | 'exhausted'

export interface WinOutcome {
  /** 是否已分出结果 */
  over: boolean
  kind: EndgameKind
  /**
   * 获胜阵营
   *
   * 复数是因为有「天命星灵 + 守护者同胜」这种两条命绑在一起的阵营。
   */
  winners: RoleType[]
  /** 写进 `IGameResult.winner` 的那个 —— 阵营代表 */
  winner: RoleType | null
  reason: string
}

/** 未分出胜负 */
export const NOT_OVER: WinOutcome = {
  over: false,
  kind: 'victory',
  winners: [],
  winner: null,
  reason: '',
}

/** 平局 / 流局的构造口 —— 非死亡触发的终局从这里出 */
export function stalemate(kind: 'draw' | 'exhausted', reason: string): WinOutcome {
  return { over: true, kind, winners: [], winner: null, reason }
}

/**
 * 判定终局
 *
 * 规则（与搬迁前 `DeathSystem.checkGameOver` 逐条一致）：
 *   - Aspect（天命星灵）死亡：
 *       - 若 Infiltrator（潜伏者）是场上唯一存活者 → Infiltrator 胜
 *       - 否则 → Ascended（飞升者）胜
 *   - Ascended 与 Infiltrator 全部死亡 → Aspect + Guardian 胜
 *   - 其余 → 未结束
 *
 * 边界（沿用搬迁前的行为，不在此偷偷改规则）：
 *   - 局面里没有 Aspect → 只看第二条
 *   - 局面里没有 Infiltrator → `spyDead` 为真，等于不卡这条
 */
export function evaluate(snapshot: WinSnapshot): WinOutcome {
  const players = snapshot.players

  const lord = players.find((p) => p.role === RoleType.Aspect)
  const rebels = players.filter((p) => p.role === RoleType.Ascended)
  const spy = players.find((p) => p.role === RoleType.Infiltrator)

  // ── 场景一：天命星灵死亡 ──
  if (lord && !lord.alive) {
    const alivePlayers = players.filter((p) => p.alive)

    // 潜伏者活到最后一人 —— 这是它唯一的胜利方式
    if (
      spy &&
      spy.alive &&
      alivePlayers.length === 1 &&
      alivePlayers[0]!.role === RoleType.Infiltrator
    ) {
      return {
        over: true,
        kind: 'victory',
        winners: [RoleType.Infiltrator],
        winner: RoleType.Infiltrator,
        reason: '潜伏者成功潜伏到最后',
      }
    }

    return {
      over: true,
      kind: 'victory',
      winners: [RoleType.Ascended],
      winner: RoleType.Ascended,
      reason: '天命星灵已被消灭',
    }
  }

  // ── 场景二：飞升者与潜伏者全灭 ──
  const allRebelsDead = rebels.every((p) => !p.alive)
  const spyDead = !spy || !spy.alive

  if (allRebelsDead && spyDead) {
    return {
      over: true,
      kind: 'victory',
      winners: [RoleType.Aspect, RoleType.Guardian],
      // 代表写 Aspect：`IGameResult.winner` 只有一个位置，
    // 而守护者与天命星灵同胜，是同一条战线的两端。
      winner: RoleType.Aspect,
      reason: '所有飞升者和潜伏者已被消灭',
    }
  }

  return NOT_OVER
}
