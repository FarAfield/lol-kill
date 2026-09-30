// ============================================================
// 联盟杀 · 事件命名体系
//
// 事件名 = 事件主体 + 阶段后缀。新增一张需要新时机的卡牌，
// 只要写一个新字符串即可，不必改任何枚举 —— 这是本体系存在的唯一理由。
//
//   主体 damage  +  后缀 After  →  damageAfter（"当你造成伤害后"）
//   主体 useCard +  后缀 ''     →  useCard    （"当你使用牌时"，Content 阶段）
//   主体 phaseUse + 后缀 Begin  →  phaseUseBegin（"出牌阶段开始时"）
//
// 阶段后缀与流水线阶段（TriggerStage）一一对应：
//   Before → Before   Begin → Begin   Prepare → Prepare
//   Content →（空）    Prevent → Prevent   End → End   After → After
//
// 另有一类「单发事件」（point event）：名字本身已含完整语义
// （gameStart / turnStart / gameOver ...），不追加后缀，
// 且只在 Content 阶段结算一次 —— 它们没有"之前/之后"。
// ============================================================

import type { TriggerStage } from './enums'

/**
 * 单发事件 —— 名字自带完整语义，不追加阶段后缀
 *
 * 这类事件是「瞬时」的：游戏开始就是开始，回合结束就是结束，
 * 不存在"回合结束之前"。因此它们只在 Content 阶段结算一次。
 */
export const POINT_EVENT_NAMES = [
  // 全局
  'gameStart',
  'gameOver',
  'roundStart',
  'roundEnd',
  'turnStart',
  'turnEnd',
  // 卡牌
  'useCardToTarget',
  'useCardEffect',
  'respond',
  // 装备
  'equip',
  'unequip',
  // 伤害
  'damageSource',
] as const

/**
 * 可追加阶段后缀的事件主体
 *
 * 主体 × 后缀 = 完整事件名（见文件头说明）。
 */
export const EVENT_SUBJECTS = [
  // 回合内阶段
  'phasePre',
  'phaseJudge',
  'phaseDraw',
  'phaseUse',
  'phaseDiscard',
  'phasePost',
  // 卡牌
  'useCard',
  // 伤害 / 体力
  'damage',
  'loseHp',
  'recover',
  // 濒死 / 死亡
  'dying',
  'die',
  // 牌的流转
  'gain',
  'lose',
  // 判定
  'judge',
] as const

/** 单发事件名 */
export type PointEventName = (typeof POINT_EVENT_NAMES)[number]

/** 事件主体 */
export type EventSubject = (typeof EVENT_SUBJECTS)[number]

/** 流水线阶段对应的事件名后缀（Content 为空后缀——事件本体） */
export const EVENT_STAGE_SUFFIXES = [
  'Before',
  'Begin',
  'Prepare',
  '',
  'Prevent',
  'End',
  'After',
] as const

/** 流水线阶段对应的事件名后缀 */
export type EventStageSuffix = (typeof EVENT_STAGE_SUFFIXES)[number]

/**
 * 内置事件名 —— 事件主体与阶段后缀的笛卡尔积，加上单发事件
 *
 * 由 const 元组推导，保证「类型」与「运行时清单」同源，不会走偏。
 */
export type BuiltinEventName = PointEventName | `${EventSubject}${EventStageSuffix}`

/**
 * 事件名 —— 内置名保留自动补全，同时允许扩展包追加自定义事件名
 *
 * `string & {}` 是 TypeScript 中保留字面量补全的标准写法：
 * 写 `'damageAfter'` 会补全，写 `'myMod_event'` 也能通过编译。
 */
export type EventName = BuiltinEventName | (string & {})

/** 流水线阶段 → 事件名后缀 */
const STAGE_SUFFIX: Record<TriggerStage, EventStageSuffix> = {
  Before: 'Before',
  Begin: 'Begin',
  Prepare: 'Prepare',
  Content: '',
  Prevent: 'Prevent',
  End: 'End',
  After: 'After',
}

/** 单发事件集合（O(1) 查询） */
const POINT_EVENT_SET: ReadonlySet<string> = new Set(POINT_EVENT_NAMES)

/** 合法后缀集合（O(1) 查询） */
const SUFFIX_SET: ReadonlySet<string> = new Set(EVENT_STAGE_SUFFIXES)

/**
 * 该事件名是否为单发事件
 */
export function isPointEvent(name: EventName): boolean {
  return POINT_EVENT_SET.has(name)
}

/**
 * 该事件名是否为内置事件名（单发事件，或「主体 + 合法后缀」）
 *
 * 扩展包使用自定义事件名是**合法**的，本方法只用于测试与调试：
 * 拼错内置名（如 'damageEndd'）会静默失效，用它能在注册时抓出来。
 */
export function isBuiltinEventName(name: EventName): boolean {
  if (isPointEvent(name)) return true
  return EVENT_SUBJECTS.some(
    (subject) =>
      name.startsWith(subject) && SUFFIX_SET.has(name.slice(subject.length)),
  )
}

/**
 * 求事件在某流水线阶段的完整事件名
 *
 * 单发事件在任何阶段都返回自身（是否真正结算由 `matchesEventName` 判定）。
 */
export function eventNameAtStage(name: EventName, stage: TriggerStage): EventName {
  if (isPointEvent(name)) return name
  return `${name}${STAGE_SUFFIX[stage]}` as EventName
}

/**
 * 判断 handler 声明的事件名是否在「事件 + 阶段」下命中
 *
 * 单发事件只在 Content 阶段命中一次，避免同一个技能在一次事件里被触发 7 次。
 */
export function matchesEventName(
  handlerEvent: EventName,
  eventName: EventName,
  stage: TriggerStage,
): boolean {
  if (isPointEvent(eventName)) {
    return handlerEvent === eventName && stage === 'Content'
  }
  return handlerEvent === eventNameAtStage(eventName, stage)
}
