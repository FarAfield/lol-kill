// ============================================================
// 联盟杀 · 技能运行时状态 —— 纯函数层
//
// 「一个玩家的一个技能，此刻用了几次、在哪个态」这笔账的**规则**。
// 状态的**存放**在 `SkillRegistry` 的挂载记录里，本文件只负责算。
//
// 之所以要单独拆出来：频率判定有三个地方要用，且必须是同一套答案——
//   · EventTrigger  收集钩子时决定「这条还该不该跑」
//   · EventCompiler 发动完之后记账
//   · SkillRegistry 对外回答 `isAvailable`（UI / AI 要问）
// 三处各写一份 switch，迟早会有一处漏掉 `oncePerPhase`。
//
// 全部是纯函数：进一个 state，出一个判断 / 一个新 state。
// ============================================================

import type {
  FrequencyScope,
  ISkillRuntimeState,
  SkillFrequency,
} from '@core/contracts/skill.interface'

/**
 * 技能标记的命名空间前缀
 *
 * 标记存进 `player.marks`，而那个 Map 是全局的一层命名空间——
 * 不加前缀的话，技能标记会和引擎自己的记账（如 `_pendingAddEffects`）撞车。
 */
const MARK_PREFIX = 'skillMark'

/** 技能标记在 `player.marks` 里的键 */
export function skillMarkKey(skillId: string): string {
  return `${MARK_PREFIX}:${skillId}`
}

/**
 * 转换技当前态在 `player.marks` 里的键
 *
 * 态的真值只有一处：**台账里的 `ISkillRuntimeState.convertState`**。
 * 这里写进 marks 的那一份是**镜像**，唯一写入点是
 * `SkillRegistry.flipConvertState`，供 Mod 与 UI 读——
 * Mod 是纯函数，拿不到台账，只能从玩家身上读到态。
 */
export function convertMarkKey(skillId: string): string {
  return `${MARK_PREFIX}:convert:${skillId}`
}

/** 新建一份运行时状态 */
export function createSkillRuntimeState(): ISkillRuntimeState {
  return {
    usedCount: 0,
    usedThisTurn: 0,
    usedThisRound: 0,
    usedThisPhase: 0,
    awakened: false,
    convertState: 0,
  }
}

/**
 * 这一档频率此刻还放不放行
 *
 * 三档各自独立，互不清零：`oncePerTurn` 只看本回合。
 * `once`（整局一次）判的是**永不清零**的 `usedCount`——
 * 这也是限定技正确的判据：限定技不该因为过了一轮就复活。
 */
export function withinFrequency(
  state: ISkillRuntimeState,
  frequency: SkillFrequency,
): boolean {
  switch (frequency) {
    case 'once':
      return state.usedCount === 0
    case 'oncePerTurn':
      return state.usedThisTurn === 0
    case 'oncePerRound':
      return state.usedThisRound === 0
    case 'oncePerPhase':
      return state.usedThisPhase === 0
    case 'unlimited':
    default:
      return true
  }
}

/** 把本次发动记到频率计数上 */
export function markFrequencyUsed(
  state: ISkillRuntimeState,
  frequency: SkillFrequency,
): void {
  // 每一次发动都进 `usedCount`：它是限定技与 `usable` 的判据，
  // 与频率是什么档无关——`unlimited` 也要记，否则 `usable: 3` 永远拦不住。
  state.usedCount++

  switch (frequency) {
    case 'once':
      state.usedThisTurn++
      state.usedThisRound++
      state.usedThisPhase++
      break
    case 'oncePerTurn':
      state.usedThisTurn++
      break
    case 'oncePerRound':
      state.usedThisRound++
      break
    case 'oncePerPhase':
      state.usedThisPhase++
      break
    case 'unlimited':
    default:
      break
  }
}

/** 在某个时间边界上清零对应的一档 */
export function resetFrequencyOf(
  state: ISkillRuntimeState,
  scope: FrequencyScope,
): void {
  if (scope === 'phase') state.usedThisPhase = 0
  if (scope === 'turn') state.usedThisTurn = 0
  if (scope === 'round') state.usedThisRound = 0
}
