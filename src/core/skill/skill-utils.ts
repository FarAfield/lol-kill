// ============================================================
// 联盟杀 · 技能兼容读取
//
// `ISkill` 用布尔矩阵（locked / limited / awaken …）描述分类，
// 但**尚未迁移**的旧定义还在用 `type: SkillType`（单值枚举）。
// `EventCompiler` 必须同时读懂两套写法，本文件就是那一层薄薄的适配。
//
// 刻意不 import `ISkill`：一旦引入就会形成
// `skill-utils → effect.interface → skill.interface` 的环，
// 而且所有判别都退化成「先看有没有 type」的两分支。
// 这里改用**局部结构类型**读旧字段——编译器只关心它认得的那两个字符串，
// 环也就不存在了。等旧定义迁完，删掉这几个函数即可。
// ============================================================

import type { IPlayer } from '@core/contracts/player.interface'
import type { ISkill, SkillFrequency } from '@core/contracts/skill.interface'

/**
 * 旧定义的两个字段
 *
 * 只声明需要读的部分。旧对象既是 `ISkill` 又带这两个属性，
 * 断言到这里读值是安全的——写不到、也删不掉别的字段。
 */
interface LegacySkillFields {
  type?: string
  frequency?: string
}

/** 四种频率里，旧枚举没有 `oncePerPhase`（见文件内的映射表） */
const LEGACY_FREQUENCY: Readonly<Record<string, SkillFrequency>> = {
  once: 'once',
  unlimited: 'unlimited',
  oncePerTurn: 'oncePerTurn',
  oncePerRound: 'oncePerRound',
}

function legacy(skill: ISkill): LegacySkillFields {
  return skill as LegacySkillFields
}

// ── 分类 ──

/**
 * 是否锁定技
 *
 * 新写法：`locked: true`。旧写法：`type: 'locked'`。
 * 锁定技不会被询问「是否发动」，满足条件直接生效。
 */
export function isLockedSkill(skill: ISkill): boolean {
  return skill.locked === true || legacy(skill).type === 'locked'
}

/** 是否限定技（整局一次） */
export function isLimitedSkill(skill: ISkill): boolean {
  return skill.limited === true || legacy(skill).type === 'limited'
}

/** 是否觉醒技 */
export function isAwakenSkill(skill: ISkill): boolean {
  return skill.awaken === true || legacy(skill).type === 'awaken'
}

// ── 频率与权重 ──

/**
 * 归一化频率
 *
 * 旧枚举只有四种，新契约多一个 `oncePerPhase`。
 * 认不出来的值一律退回 `unlimited`——**宁可多发动也不要静默失效**：
 * 频率写错时，排查一次多余发动远比排查「技能为什么不生效」便宜。
 *
 * 限定技与觉醒技**天然是整局一次**，没写 `frequency` 时按 `once` 处理。
 * 这一句就是「限定技一局只能放一次」的全部实现：
 * `once` 判的是永不清零的 `usedCount`，所以过多少轮都复不了活。
 */
export function skillFrequency(skill: ISkill): SkillFrequency {
  if (skill.frequency) return skill.frequency
  if (isLimitedSkill(skill) || isAwakenSkill(skill)) return 'once'

  const old = legacy(skill).frequency
  if (old && old in LEGACY_FREQUENCY) return LEGACY_FREQUENCY[old]!
  return 'unlimited'
}

/**
 * 是否强制技 —— 锁定技与强制技的合称
 *
 * 两者都不可拒绝，区别只在**要不要给提示**：
 * - `locked` 锁定技：满足条件直接生效，连提示都没有
 * - `forced` 强制技：不可拒绝，但要让玩家看见发生了什么
 *
 * 对引擎来说它们是一件事：**都不进「要不要发动」的决策**。
 */
export function isForcedSkill(skill: ISkill): boolean {
  return isLockedSkill(skill) || skill.forced === true
}

/**
 * 是否可以被玩家拒绝
 *
 * UI 用它决定弹不弹确认框，AI 用它决定要不要走「选一个技能」这条路。
 * 强制技两者都不该出现——它已经发动了，问一句是多余的。
 */
export function isDeclinableSkill(skill: ISkill): boolean {
  return !isForcedSkill(skill)
}

/**
 * 是否手动发动技
 *
 * 新契约里「能手动点」不再是一个 `type`，而是有没有声明 `enable`。
 * 锁定技即使写了 `enable` 也不算——它由引擎自动跑，不进候选列表。
 */
export function isManualSkill(skill: ISkill): boolean {
  if (isLockedSkill(skill)) return false
  return (skill.enable?.length ?? 0) > 0
}

/**
 * 发动前要不要弹确认
 *
 * `popup` 显式写了就以它为准；没写则**默认非强制技才问**——
 * 强制技弹确认是自相矛盾：问了也不许拒绝。
 */
export function shouldPrompt(skill: ISkill): boolean {
  return skill.popup ?? isDeclinableSkill(skill)
}

/** 同时机优先级（缺省 0） */
export function skillPriority(skill: ISkill): number {
  return skill.priority ?? 0
}

/**
 * AI 对这个技能的估值
 *
 * 优先用 `ai.result.player`；没写就退回 priority。
 * 新契约的好处在这里兑现了：估值是**数据**，不是需要强行凑出
 * 一个 `ISkillContext` 才能调用的回调函数——AI 在「要不要发动」
 * 这一步本来就没有事件上下文。
 */
export function aiValueOf(skill: ISkill, player: IPlayer): number {
  const result = skill.ai?.result?.player
  return typeof result === 'function' ? result(player) : skillPriority(skill)
}

/**
 * 以**别人**为目标时这条技能值多少
 *
 * 与 `aiValueOf` 是一对：同一个技能对「自己」和「某个目标」的价值
 * 不是一回事——【仁德】给自己是 0 分，给快死的盟友很值钱。
 * 没写就退回 0（「没有额外意见」），而不是退回升序噪声。
 */
export function aiTargetValueOf(skill: ISkill, player: IPlayer, target: IPlayer): number {
  return skill.ai?.result?.target?.(player, target) ?? 0
}

/**
 * AI 的考虑顺序（数字越大越先考虑）
 *
 * **不是** `skillPriority`：后者是「同一时机上谁的钩子先结算」，
 * 是引擎的事；`ai.order` 是「AI 脑子里先盘算哪个技能」。
 * 混用会让调 AI 手感的人无意中改动结算顺序。
 */
export function aiOrderOf(skill: ISkill): number {
  return skill.ai?.order ?? 0
}

/**
 * 这条技能让它的主人有多危险
 *
 * 写在技能定义上（`ai.threaten`），而不是让 AI 背一份「哪个武将厉害」
 * 的名单——那份名单迟早和技能定义脱节，且每加一个武将都要改 AI。
 */
export function threatenOf(skill: ISkill): number {
  return skill.ai?.threaten ?? 0
}

/**
 * 发动这条技能会暴露多少身份信息
 *
 * 身份未明的人（内奸、没亮身份的反贼）靠藏活着，发动一个一眼
 * 能认出来的技能等于自报家门。`expose` 就是这个代价，由 AI 在
 * 「要不要发动」时扣掉，而不是写死「不许用」。
 */
export function exposeOf(skill: ISkill): number {
  return skill.ai?.expose ?? 0
}

// ── 视作 ──

/**
 * 是否为「视作」技能
 *
 * 判断依据是存在 `viewAs`（或其旧名 `viewAsFilter`），而不是有没有
 * `trigger`——视作技能压根不需要时机，它回答的是「这张牌能当什么」。
 */
export function isViewAsSkill(skill: ISkill): boolean {
  const s = skill as ISkill & { filterCard?: unknown; viewAsFilter?: unknown }
  return (
    typeof skill.viewAs === 'function' ||
    typeof skill.filterCard === 'function' ||
    typeof s.viewAsFilter === 'function'
  )
}

/** 子技能 id 的连接符 —— `主技能_子技能`（如 `benevolence_give`） */
export const SUB_SKILL_SEPARATOR = '_'

/**
 * 展开一条技能为「父 + 子」的扁平列表
 *
 * 子技能只写差异字段，其余继承父技能。返回的每个元素都是**完整** ISkill，
 * 便于统一登记 / 统一注册 mod / 统一编译，不需要调用方再自己 merge。
 *
 * 子技能的 `id` 取 `父_子`：不重标号的话，不同技能的同名子技能
 * （两个武将都有 `give`）会在注册表里撞车。
 *
 * 父技能**仍在列表里**（去掉了 `subSkill` 字段，免得展开无限套娃）——
 * 它是独立的定义，有自己的 `trigger` / `mod`。
 *
 * 子技能**不随父技能自动挂载**：它只是被登记成一条独立定义，
 * 谁想用谁自己 `attach` / `addTempSkill`。Phase 17 之前它们是父技能的
 * 附属品，于是「给某人挂一个子技能」这件常见的事根本没法表达。
 *
 * @returns 没有子技能时返回 `[skill]` 本身
 */
export function expandSubSkills(skill: ISkill): ISkill[] {
  // 显式按名字排序，不依赖 `Object.entries` 的枚举顺序：
  // 子技能的顺序会变成注册顺序，进而变成台账里的挂载顺序，
  // 而「先挂谁」不该由对象字面量里键的书写顺序来决定。
  const entries = Object.entries(skill.subSkill ?? {}).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )
  if (entries.length === 0) return [skill]

  const parent = { ...skill }
  delete parent.subSkill

  return [
    parent,
    ...entries.map(([name, partial]) => ({
      ...parent,
      ...partial,
      id: `${skill.id}${SUB_SKILL_SEPARATOR}${name}`,
      name: partial.name ?? `${skill.name}·${name}`,
      description: partial.description ?? skill.description,
    })),
  ]
}
