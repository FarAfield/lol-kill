// ============================================================
// 联盟杀 · 触发时机定义
//
// 定义所有触发时机及默认的触发阶段。
// ============================================================

import { TriggerTiming } from '@core/contracts/enums'
import type { TriggerStage } from '@core/contracts/enums'

/**
 * 触发时机描述
 */
export interface TriggerTimingInfo {
  /** 时机 */
  timing: TriggerTiming
  /** 中文名称 */
  name: string
  /** 描述 */
  description: string
  /** 默认触发阶段 */
  defaultStage: TriggerStage
  /** 分类 */
  category: 'global' | 'phase' | 'card' | 'damage' | 'judge' | 'death'
}

/**
 * 全部触发时机定义
 */
export const TRIGGER_TIMING_DEFINITIONS: TriggerTimingInfo[] = [
  // ── 全局 ──
  {
    timing: TriggerTiming.GameStart,
    name: '游戏开始时',
    description: '游戏开始',
    defaultStage: 'Begin',
    category: 'global',
  },
  {
    timing: TriggerTiming.RoundStart,
    name: '轮次开始时',
    description: '新的一轮开始',
    defaultStage: 'Begin',
    category: 'global',
  },
  {
    timing: TriggerTiming.TurnStart,
    name: '回合开始时',
    description: '一名角色的回合开始',
    defaultStage: 'Begin',
    category: 'global',
  },

  // ── 回合内阶段 ──
  {
    timing: TriggerTiming.PhasePre,
    name: '准备阶段',
    description: '回合准备阶段',
    defaultStage: 'Begin',
    category: 'phase',
  },
  {
    timing: TriggerTiming.PhaseJudge,
    name: '判定阶段',
    description: '判定阶段开始',
    defaultStage: 'Begin',
    category: 'phase',
  },
  {
    timing: TriggerTiming.PhaseDraw,
    name: '摸牌阶段',
    description: '摸牌阶段开始',
    defaultStage: 'Begin',
    category: 'phase',
  },
  {
    timing: TriggerTiming.PhaseUse,
    name: '出牌阶段',
    description: '出牌阶段开始',
    defaultStage: 'Begin',
    category: 'phase',
  },
  {
    timing: TriggerTiming.PhaseDiscard,
    name: '弃牌阶段',
    description: '弃牌阶段开始',
    defaultStage: 'Begin',
    category: 'phase',
  },
  {
    timing: TriggerTiming.PhasePost,
    name: '结束阶段',
    description: '回合结束阶段',
    defaultStage: 'Begin',
    category: 'phase',
  },

  // ── 回合 / 轮次 / 游戏结束 ──
  {
    timing: TriggerTiming.TurnEnd,
    name: '回合结束时',
    description: '一名角色的回合结束',
    defaultStage: 'Begin',
    category: 'global',
  },
  {
    timing: TriggerTiming.RoundEnd,
    name: '轮次结束时',
    description: '一轮结束',
    defaultStage: 'Begin',
    category: 'global',
  },
  {
    timing: TriggerTiming.GameOver,
    name: '游戏结束时',
    description: '游戏结束',
    defaultStage: 'Begin',
    category: 'global',
  },

  // ── 卡牌 ──
  {
    timing: TriggerTiming.CardUse,
    name: '使用卡牌时',
    description: '一名角色使用一张卡牌',
    defaultStage: 'Content',
    category: 'card',
  },
  {
    timing: TriggerTiming.CardTarget,
    name: '卡牌指定目标时',
    description: '卡牌指定目标后',
    defaultStage: 'Prepare',
    category: 'card',
  },
  {
    timing: TriggerTiming.CardEffect,
    name: '卡牌生效时',
    description: '卡牌效果执行',
    defaultStage: 'Content',
    category: 'card',
  },

  // ── 伤害 ──
  {
    timing: TriggerTiming.Damage,
    name: '造成伤害时',
    description: '一名角色造成伤害',
    defaultStage: 'Content',
    category: 'damage',
  },
  {
    timing: TriggerTiming.Damaged,
    name: '受到伤害时',
    description: '一名角色受到伤害',
    defaultStage: 'Prevent',
    category: 'damage',
  },

  // ── 判定 ──
  {
    timing: TriggerTiming.Judge,
    name: '判定时',
    description: '判定牌生效前',
    defaultStage: 'Content',
    category: 'judge',
  },

  // ── 死亡 ──
  {
    timing: TriggerTiming.PlayerDying,
    name: '濒死时',
    description: '一名角色进入濒死状态',
    defaultStage: 'Content',
    category: 'death',
  },
  {
    timing: TriggerTiming.PlayerDeath,
    name: '死亡时',
    description: '一名角色死亡',
    defaultStage: 'Content',
    category: 'death',
  },
]

/**
 * 按 timing 快速查询 TriggerTimingInfo
 */
export const TRIGGER_TIMING_INFO_MAP: Map<TriggerTiming, TriggerTimingInfo> = new Map(
  TRIGGER_TIMING_DEFINITIONS.map((t) => [t.timing, t]),
)

/**
 * 获取时机中文名称
 */
export function getTimingName(timing: TriggerTiming): string {
  return TRIGGER_TIMING_INFO_MAP.get(timing)?.name ?? timing
}
