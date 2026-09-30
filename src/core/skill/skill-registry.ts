// ============================================================
// 联盟杀 · SkillRegistry — 技能台账
//
// 「谁拥有哪些技能」这笔账只有一份，记在这里。
//
// 在它之前，引擎里同时存在三种互相矛盾的持有者推断：
//   · 触发器 —— 只有英雄技能被编译成钩子（装备技的 `trigger` 从没挂上过）
//   · Mod    —— 按「英雄写着它 / 装备带着它」两条线索每次现算
//   · 觉醒技 —— `enableEffect()` 返回 `true`，然后什么也没做
// 后果是「装备带来的触发技根本不会触发」，而没有任何测试能发现它。
//
// ── 三种来源，各有各的退场方式 ──
// | 来源      | 谁挂上                 | 谁摘掉                        |
// |-----------|------------------------|-------------------------------|
// | permanent | 英雄 / 觉醒 / attach   | 只有显式 detach               |
// | equip     | 装备区出现了这张牌     | 牌离开装备区                  |
// | temp      | addTempSkill           | 到期事件 / removeTempSkill    |
//
// 摘掉 = 从 EventTrigger 撤钩子 + 从台账划掉两件事。
// **Mod 不需要摘**：它的持有者由 `ownersOf()` 每次现算，
// 台账一变，下一次查询的结果自然就变了。
//
// 死者的技能不在这里摘——钩子留在原地，由引擎注入的 `skillGate`
// 拦下（见 `GameEngine.registerSkillGate`）。摘掉容易，复活时
// 记得挂回去难；而「记不住」正是这一类 bug 的唯一成因。
// ============================================================

import type {
  FrequencyScope,
  ISkill,
  ISkillRegistry,
  ISkillRuntimeState,
  TempSkillDuration,
} from '@core/contracts/skill.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { EventName } from '@core/contracts/event-name'
import type { CompiledHandler } from '@core/contracts/compiled-handler'
import type { EventCompiler } from '@core/event/event-compiler'
import type { EventTrigger } from '@core/event/event-trigger'
import {
  convertMarkKey,
  createSkillRuntimeState,
  skillMarkKey,
  withinFrequency,
} from '@core/skill/skill-runtime'
import { expandSubSkills, skillFrequency } from '@core/skill/skill-utils'
import { PlayerSystem } from '@core/system/player-system'

/** 挂载来源（决定谁能把它摘掉） */
type SkillSource = 'permanent' | 'equip' | 'temp'

/** 规范化后的到期条件 */
interface Expiry {
  event: EventName
  scope: 'player' | 'global'
}

/** 一次挂载 */
interface Attachment {
  source: SkillSource
  /** 这次挂载注册的钩子：技能自己的 + （临时的）到期钩子 */
  handlers: CompiledHandler[]
  /**
   * 这条技能在这个玩家身上的运行时状态
   *
   * 挂在**挂载记录**上而不是钩子上：一条技能展开出 N 个钩子，
   * 但「本回合发动了几次」只能有一个答案。
   * 摘掉技能时它随之消失——重新挂上就是一条干净的技能。
   */
  runtime: ISkillRuntimeState
  expiry?: Expiry
  /**
   * 它是被哪个主技能的 `group` 带出来的
   *
   * 「持有主技能等价于持有组内全部技能」因此是一条**派生**挂载：
   * 主技能被摘时它跟着走，而装备对齐不该单独摘它
   * （它不是装备区里那张牌直接带来的）。
   */
  groupOwner?: string
}

/** 一个玩家的台账 */
interface PlayerEntry {
  player: IPlayer
  attached: Map<string, Attachment>
}

/**
 * 到期钩子的优先级 —— 恒低于任何技能
 *
 * 临时技能必须先在到期事件上生效一次，然后才被摘掉。
 * 「下次受到伤害时…」这类效果，若先摘后触发，就永远发动不了。
 */
const EXPIRY_PRIORITY = -1000

/** 到期钩子的技能 id（仅用于识别，不对应任何真实技能） */
function expirySkillId(playerId: string, skillId: string): string {
  return `__expire:${playerId}:${skillId}`
}

function resolveExpiry(until: TempSkillDuration): Expiry {
  return typeof until === 'string' ? { event: until, scope: 'player' } : until
}

/**
 * 台账选项
 */
export interface SkillRegistryOptions {
  /**
   * 每登记一条定义时回调一次
   *
   * 引擎用它把新技能的 `mod` 补进 `ModRegistry`。没有它的话，
   * 开局之后才登记的技能会「触发技有效、数值修正无效」——
   * 一半生效的 bug 比完全不生效难查得多。
   */
  onRegister?: (def: ISkill) => void
  /**
   * 玩家状态系统 —— 台账写标记（转换技态 / 技能计数）的出口
   *
   * 不传就自建一份：`PlayerSystem` 是无状态的，多建一份不会不一致。
   */
  playerSystem?: PlayerSystem
}

/**
 * SkillRegistry — 技能台账
 *
 * 依赖都由引擎注入：
 * - `eventTrigger`：钩子挂进去，技能才接上事件流水线
 * - `compiler`：把一条 `ISkill` 翻译成若干钩子
 *
 * 它不认识 `GameState`，也不需要——「谁拥有」由调用方告诉它，
 * 「拥有到什么时候」由 `sync` / 到期钩子自己算。
 */
export class SkillRegistry implements ISkillRegistry {
  /** 技能定义表（全局） */
  private defs = new Map<string, ISkill>()
  /** 台账：playerId → 持有记录 */
  private ledger = new Map<string, PlayerEntry>()

  private options: SkillRegistryOptions
  private playerSystem: PlayerSystem

  constructor(
    private eventTrigger: EventTrigger,
    private compiler: EventCompiler,
    options?: SkillRegistryOptions,
  ) {
    this.options = options ?? {}
    this.playerSystem = options?.playerSystem ?? new PlayerSystem()
  }

  // ── 定义 ──

  /**
   * 登记一条技能定义
   *
   * 重复 id 抛错而不是覆盖：两个扩展包抢同一个技能名是**装配错误**，
   * 静默覆盖会让先加载的那个神秘消失。
   *
   * 子技能（`subSkill`）在这里被**摊平成独立定义**，id 是
   * `<主技能>_<子技能>`。它们不随主技能自动挂载——「给某人挂一个
   * 子技能」是常态（临时获得「XX·出牌阶段」这类），而自动挂载
   * 会把「只想用一半」的场景搞坏。要用就显式 `attach` / `addTempSkill`。
   */
  register(def: ISkill): void {
    for (const entry of expandSubSkills(def)) this.registerOne(entry)
  }

  private registerOne(def: ISkill): void {
    if (this.defs.has(def.id)) {
      throw new Error(`SkillRegistry: 技能 "${def.id}" 已注册，不能重复登记`)
    }
    this.defs.set(def.id, def)
    this.options.onRegister?.(def)
  }

  registerAll(defs: Iterable<ISkill>): void {
    for (const def of defs) this.register(def)
  }

  /** 按 id 取定义 */
  get(id: string): ISkill | undefined {
    return this.defs.get(id)
  }

  /** 该定义是否已登记 */
  has(id: string): boolean {
    return this.defs.has(id)
  }

  /** 全部定义 */
  getAll(): ISkill[] {
    return [...this.defs.values()]
  }

  get size(): number {
    return this.defs.size
  }

  // ── 挂载 / 卸载 ──

  attach(player: IPlayer, skillId: string): void {
    this.attachAs(player, skillId, 'permanent')
  }

  /**
   * 觉醒：永久获得，且不可回退
   *
   * 重复的觉醒调用是空操作——觉醒条件在整局中会被反复检查，
   * 若不去重，每次都会重置一次挂载（连带清掉已用的频率额度）。
   */
  awakenSkill(player: IPlayer, skillId: string): void {
    if (this.hasSkill(player, skillId)) return
    this.attachAs(player, skillId, 'permanent')

    // 觉醒过的标记：觉醒技是一次性的，且**不可回退**。
    // 重复调用在上一行就被挡住了，所以这里的赋值只会发生一次。
    const att = this.ledger.get(player.id)?.attached.get(skillId)
    if (att) att.runtime.awakened = true
  }

  detach(player: IPlayer, skillId: string): void {
    this.detachEntry(player, skillId)
  }

  addTempSkill(player: IPlayer, skillId: string, until: TempSkillDuration): void {
    this.attachAs(player, skillId, 'temp', resolveExpiry(until))
  }

  /** 提前结束临时技能；不是临时的（英雄技 / 装备技 / 觉醒技）则不动 */
  removeTempSkill(player: IPlayer, skillId: string): void {
    if (this.ledger.get(player.id)?.attached.get(skillId)?.source !== 'temp') return
    this.detachEntry(player, skillId)
  }

  // ── 查询 ──

  /**
   * 某人当前的技能列表
   *
   * **按挂载顺序返回，不排序。** 这个顺序是有语义的：
   * 主技能先入台账，它的 `group` 成员跟着进来，于是列表天然是
   * 「主技能在前、派生在后」；再往后是英雄技 → 装备技 → 临时技。
   * 它会一路传到 `{@link ViewAsService}` 的候选列表上去。
   *
   * 确定性由**台账是 Map** 这件事保证：Map 的遍历顺序就是插入顺序，
   * 而挂载序列本身是确定的（引擎每局的 sync 顺序固定）。
   * 这里刻意不做字母排序——排序会让 `main` 掉到 `a` / `b` 后面，
   * 把「主在前」这层语义抹掉。Phase 18 要治理的是 `Set` / `Object.keys`
   * 那种未被规格承诺的顺序，Map 的插入序不在此列。
   */
  getSkills(player: IPlayer): ISkill[] {
    const entry = this.ledger.get(player.id)
    if (!entry) return []

    const skills: ISkill[] = []
    for (const id of entry.attached.keys()) {
      const def = this.defs.get(id)
      if (def) skills.push(def)
    }
    return skills
  }

  hasSkill(player: IPlayer, skillId: string): boolean {
    return this.ledger.get(player.id)?.attached.has(skillId) ?? false
  }

  /**
   * 某技能此刻的持有者 —— 交给 `ModRegistry` 当 `owners`
   *
   * 每次查询现算，因此「失去技能」这件事对 Mod 来说是零代码：
   * 台账一改，下一次 `queryNumeric` 就不带这个人了。
   *
   * 按座次排序：`ModRegistry` 内部还会再排一次，这里排序是为了
   * 让 `ownersOf` 本身的输出可预测（测试与调试会直接读它）。
   */
  ownersOf(skillId: string): IPlayer[] {
    const owners: IPlayer[] = []
    for (const entry of this.ledger.values()) {
      if (entry.attached.has(skillId)) owners.push(entry.player)
    }
    return owners.sort((a, b) => a.seatIndex - b.seatIndex)
  }

  /** 台账里的挂载总数（调试 / 测试用） */
  get attachedCount(): number {
    let total = 0
    for (const entry of this.ledger.values()) total += entry.attached.size
    return total
  }

  // ── 运行时状态（Phase 15）──

  /**
   * 此刻还能不能发动
   *
   * 只回答**额度**问题：频率有没有耗尽、限定技是不是用过了。
   * 不回答 `filter`——那是「这个局面适不适合」，不是「还有没有次数」。
   *
   * `usable` 写成函数时要读局面才能算，这里没有事件上下文，
   * 因此**只检查常量形式**；函数形式留给 `EventCompiler` 在执行那一刻判。
   */
  isAvailable(player: IPlayer, skillId: string): boolean {
    const def = this.defs.get(skillId)
    const att = this.ledger.get(player.id)?.attached.get(skillId)
    if (!def || !att) return false

    if (!withinFrequency(att.runtime, skillFrequency(def))) return false

    const usable = def.usable
    if (typeof usable === 'number' && att.runtime.usedCount >= usable) return false

    return true
  }

  /** 清零某一档频率的记账（转交 EventTrigger，钩子与状态都在它那儿） */
  resetFrequency(scope: FrequencyScope): void {
    this.eventTrigger.resetFrequency(scope)
  }

  /** 转换技当前态（0 或 1；没挂这个技能就是 0） */
  getConvertState(player: IPlayer, skillId: string): number {
    return this.ledger.get(player.id)?.attached.get(skillId)?.runtime.convertState ?? 0
  }

  /**
   * 翻转转换技的态
   *
   * 写入两个地方：台账里的 `convertState`（真值）与玩家的 mark（镜像，
   * 给 Mod 和 UI 读——Mod 是纯函数，够不着台账）。
   *
   * `convertible` 写成函数时在这里被调用一次，参数是最新的态，
   * 于是「阳态摸一张 / 阴态弃一张」这类差异就是这一行回调的事。
   */
  flipConvertState(player: IPlayer, skillId: string): number {
    const def = this.defs.get(skillId)
    const att = this.ledger.get(player.id)?.attached.get(skillId)
    if (!def || !att) {
      throw new Error(
        `SkillRegistry: ${player.id} 未持有技能 "${skillId}"，无法翻转其态`,
      )
    }

    const next = att.runtime.convertState === 0 ? 1 : 0
    att.runtime.convertState = next
    this.playerSystem.setMark(player, convertMarkKey(skillId), next)
    if (typeof def.convertible === 'function') def.convertible(player, next)
    return next
  }

  /** 觉醒技是否已觉醒 */
  isAwakened(player: IPlayer, skillId: string): boolean {
    return this.ledger.get(player.id)?.attached.get(skillId)?.runtime.awakened ?? false
  }

  // ── 标记（Phase 15）──

  addMark(player: IPlayer, skillId: string, delta = 1): number {
    return this.playerSystem.addMark(player, skillMarkKey(skillId), delta)
  }

  countMark(player: IPlayer, skillId: string): number {
    return player.getMark(skillMarkKey(skillId))
  }

  clearMark(player: IPlayer, skillId: string): void {
    this.playerSystem.clearMark(player, skillMarkKey(skillId))
  }

  /**
   * 按 `ISkill.markClear` 清掉该清的标记
   *
   * 不传 scope = 全清。没写 `markClear` 的技能永不清——
   * 标记本来就该跨回合累积（如「已发动过几次」这类计数）。
   */
  clearMarks(player: IPlayer, scope?: 'turnEnd' | 'roundEnd'): void {
    for (const def of this.getSkills(player)) {
      if (scope && def.markClear !== scope) continue
      this.clearMark(player, def.id)
    }
  }

  // ── 与局面对齐 ──

  /**
   * 把某个玩家的台账与现状对齐
   *
   * 幂等：已经挂载的不会被重新挂载（否则每对齐一次就清掉一次
   * 「本回合已发动」的记账，频率限制会失效）。
   *
   * @returns 本次新挂载的技能数
   */
  sync(player: IPlayer): number {
    if (!player.alive) return 0

    let count = 0
    for (const hero of player.heroes) {
      for (const skillId of hero.effectIds) {
        if (this.attachAs(player, skillId, 'permanent')) count++
      }
    }
    return count + this.syncEquipSkills(player)
  }

  syncAll(players: Iterable<IPlayer>): number {
    let count = 0
    for (const player of players) count += this.sync(player)
    return count
  }

  /**
   * 装备技：装备区有什么就挂什么，没有的摘掉
   *
   * 只动 `source === 'equip'` 的挂载——英雄自带的同名技能
   * 不会因为卸下装备而被一起摘掉。
   */
  syncEquipSkills(player: IPlayer): number {
    const desired = new Set<string>()
    for (const card of player.equipCards) {
      for (const id of card.effectIds) {
        if (this.defs.has(id)) desired.add(id)
      }
    }

    const entry = this.ledger.get(player.id)
    if (entry) {
      // 先快照再删：`detachEntry` 会改动这张 Map，边遍历边删会漏掉条目
      for (const id of Array.from(entry.attached.keys())) {
        const att = entry.attached.get(id)
        // `groupOwner` 的那份是主技能带出来的，归主技能管：
        // 这里单独摘它会让「持有主技能 = 持有全组」这句话悄悄失效。
        if (att?.groupOwner) continue
        if (att?.source === 'equip' && !desired.has(id)) {
          this.detachEntry(player, id)
        }
      }
    }

    let count = 0
    // 排序后再挂载：`desired` 是个 Set，插入顺序取决于装备区的遍历顺序。
    // 显式排序让「先挂哪个技能」与 Set 的实现无关（Phase 18）。
    for (const id of [...desired].sort()) {
      if (this.attachAs(player, id, 'equip')) count++
    }
    return count
  }

  // ── 重置 ──

  /**
   * 清空台账与它注册的钩子（重新开局时调用，定义保留）
   *
   * 逐条 `detachEntry` 撤，**不用** `eventTrigger.clear()`：
   * 后者会把不属于台账的钩子一起抹掉——全局钩子（Phase 17）与
   * 一次性监听挂在同一个触发器上，重开一局不该连它们一起清。
   */
  clear(): void {
    for (const entry of Array.from(this.ledger.values())) {
      for (const id of Array.from(entry.attached.keys())) {
        this.detachEntry(entry.player, id)
      }
    }
    this.ledger.clear()
  }

  // ── 内部 ──

  /**
   * 挂载一条技能
   *
   * 已挂载时返回 false —— 三种来源共用同一个 key，
   * 后到的不能覆盖先到的（否则卸装备会带走英雄技能）。
   *
   * `group` 里的技能**跟着一起挂**：持有主技能等价于持有组内全部技能。
   * 递归展开（组里还可以有组），用 `visited` 兜住互相引用的环——
   * 两条技能互为组员时，没有它就会栈溢出。
   */
  private attachAs(
    player: IPlayer,
    skillId: string,
    source: SkillSource,
    expiry?: Expiry,
    groupOwner?: string,
    visited: Set<string> = new Set(),
  ): boolean {
    const def = this.defs.get(skillId)
    if (!def) {
      throw new Error(
        `SkillRegistry: 技能 "${skillId}" 未登记，无法挂载给 ${player.id}`,
      )
    }

    const entry = this.entryFor(player)
    if (entry.attached.has(skillId)) return false
    if (visited.has(skillId)) return false
    visited.add(skillId)

    // 纯 Mod 技能（如咆哮）编译不出钩子——**照样记进台账**：
    // 它的生效靠 `ownersOf`，不靠钩子。以前只在有钩子时才记账，
    // 于是「谁拥有它」这笔账对纯 Mod 技能是缺失的。
    const runtime = createSkillRuntimeState()
    const handlers = this.compiler.compile(def, player, runtime)
    if (expiry) handlers.push(this.compileExpiry(player, skillId, expiry))

    this.eventTrigger.registerCompiledBatch(handlers)
    entry.attached.set(skillId, { source, handlers, runtime, expiry, groupOwner })

    for (const memberId of def.group ?? []) {
      this.attachAs(player, memberId, source, expiry, skillId, visited)
    }
    return true
  }

  private detachEntry(player: IPlayer, skillId: string): boolean {
    const entry = this.ledger.get(player.id)
    const att = entry?.attached.get(skillId)
    if (!entry || !att) return false

    // 组内技能跟着主技能一起走——它们是这条挂载派生出来的，
    // 主技能没了它们还留着，就是「失去了技能却还生效」的幽灵。
    // 先快照再删：`detachEntry` 会改动这张 Map。
    const derived = Array.from(entry.attached.entries())
      .filter(([, other]) => other.groupOwner === skillId)
      .map(([id]) => id)

    // 按**对象身份**撤，不按 id 撤：到期钩子的 skillId 是合成的，
    // 拿 id 去过滤会把它漏在 EventTrigger 里变成幽灵钩子。
    const doomed = new Set(att.handlers)
    this.eventTrigger.unregisterBy((handler) => doomed.has(handler))

    entry.attached.delete(skillId)
    if (entry.attached.size === 0) this.ledger.delete(player.id)

    for (const id of derived) this.detachEntry(player, id)
    return true
  }

  /**
   * 临时技能的到期钩子
   *
   * 做成一条真正的钩子而不是「每回合末扫一遍」，是为了让
   * `until: { event: 'damageEnd' }` 这种精确到期条件无需引擎配合——
   * 事件流水线自己会在那个时机把它叫起来。
   */
  private compileExpiry(
    player: IPlayer,
    skillId: string,
    expiry: Expiry,
  ): CompiledHandler {
    return {
      event: expiry.event,
      scope: expiry.scope,
      skillId: expirySkillId(player.id, skillId),
      playerId: player.id,
      priority: EXPIRY_PRIORITY,
      isLocked: true,
      frequency: 'unlimited',
      // 到期钩子不对应任何真技能，给它一份一次性状态免得误改别处的计数。
      // 频率是 `unlimited`，这份状态永远不会被读。
      runtime: createSkillRuntimeState(),
      execute: async () => {
        this.removeTempSkill(player, skillId)
      },
    }
  }

  private entryFor(player: IPlayer): PlayerEntry {
    let entry = this.ledger.get(player.id)
    if (!entry) {
      entry = { player, attached: new Map() }
      this.ledger.set(player.id, entry)
    }
    return entry
  }
}
