// ============================================================
// 联盟杀 · 阶段定义
//
// 定义游戏各阶段的基础数据：阶段名称、描述、所属时机等。
// ============================================================

import { GamePhase } from '@core/contracts/enums'
import type { EventName } from '@core/contracts/event-name'

/**
 * 阶段描述信息
 */
export interface PhaseInfo {
  /** 阶段 */
  phase: GamePhase
  /** 中文名称 */
  name: string
  /** 描述 */
  description: string
  /** 该阶段对应的事件主体 */
  event: EventName
  /** 是否为回合内阶段 */
  isInTurn: boolean
}

/**
 * 全部阶段定义
 */
export const PHASE_DEFINITIONS: PhaseInfo[] = [
  {
    phase: GamePhase.NotStarted,
    name: '未开始',
    description: '游戏尚未开始',
    event: 'gameStart',
    isInTurn: false,
  },
  {
    phase: GamePhase.Prepare,
    name: '游戏准备',
    description: '选将、分配身份、发初始手牌',
    event: 'gameStart',
    isInTurn: false,
  },
  {
    phase: GamePhase.RoundStart,
    name: '轮次开始',
    description: '新的一轮开始',
    event: 'roundStart',
    isInTurn: false,
  },
  {
    phase: GamePhase.PhasePre,
    name: '准备阶段',
    description: '回合开始前的准备',
    event: 'phasePre',
    isInTurn: true,
  },
  {
    phase: GamePhase.PhaseJudge,
    name: '判定阶段',
    description: '处理判定区的延时锦囊',
    event: 'phaseJudge',
    isInTurn: true,
  },
  {
    phase: GamePhase.PhaseDraw,
    name: '摸牌阶段',
    description: '从牌堆摸两张牌',
    event: 'phaseDraw',
    isInTurn: true,
  },
  {
    phase: GamePhase.PhaseUse,
    name: '出牌阶段',
    description: '使用手牌的主要阶段',
    event: 'phaseUse',
    isInTurn: true,
  },
  {
    phase: GamePhase.PhaseDiscard,
    name: '弃牌阶段',
    description: '手牌数超过体力上限时需弃牌',
    event: 'phaseDiscard',
    isInTurn: true,
  },
  {
    phase: GamePhase.PhasePost,
    name: '结束阶段',
    description: '回合结束时的清理工作',
    event: 'phasePost',
    isInTurn: true,
  },
  {
    phase: GamePhase.RoundEnd,
    name: '轮次结束',
    description: '一轮结束，检查胜利条件',
    event: 'roundEnd',
    isInTurn: false,
  },
  {
    phase: GamePhase.GameOver,
    name: '游戏结束',
    description: '游戏结束，显示结果',
    event: 'gameOver',
    isInTurn: false,
  },
]

/**
 * 按 phase 快速查询 PhaseInfo
 */
export const PHASE_INFO_MAP: Map<GamePhase, PhaseInfo> = new Map(
  PHASE_DEFINITIONS.map((p) => [p.phase, p]),
)

/**
 * 获取阶段中文名称
 */
export function getPhaseName(phase: GamePhase): string {
  return PHASE_INFO_MAP.get(phase)?.name ?? phase
}
