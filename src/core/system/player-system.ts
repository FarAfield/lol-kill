// ============================================================
// 联盟杀 · PlayerSystem — 玩家状态的唯一写入点
//
// 在它之前，「改一个玩家的血」有四种写法散在各处：
//   · `target.loseHp(n)`      —— 伤害求解器
//   · `target.recoverHp(n)`   —— 技能上下文
//   · `player.hp = 1`         —— 濒死救活（死亡系统）
//   · `player.alive = false`  —— 死亡结算（死亡系统）
// 它们各自实现了自己的夹取规则。`recoverHp` 知道不能超过上限，
// 而濒死救活那句 `hp = 1` 不知道——它只是碰巧在 hp ≤ 0 时才被调用。
// 「碰巧成立」是最难守住的一类不变量：哪天有人在别处也写一句
// `hp = 1`，上限就被悄悄越过，而没有任何一行代码报错。
//
// ── 本系统负责的字段 ──
// | 字段                     | 夹取 / 连带规则                     |
// |--------------------------|-------------------------------------|
// | hp                       | 裁到 [0, maxHp]                     |
// | maxHp                    | 变化时同步裁剪 hp                   |
// | power / maxPower         | 同上                                |
// | alive / roleRevealed     | 死亡的公开面，只在这里翻            |
// | heroes                   | 换英雄 → 重算 maxHp / maxPower      |
// | marks                    | 技能计数器，统一入口便于观察         |
// | 回合追踪（杀的次数等）    | 每回合归零，不散落在各处写           |
//
// ── 它**不**负责的 ──
// 卡牌区域（handCards / equipCards / judgeCards）归 `CardSystem`：
// 一张牌的 `zone` / `owner` / `visibleTo` 必须一起改，拆成两处
// 就会出现「牌在手牌数组里、zone 却写着 Deck」这种半身不遂。
// 因此本系统里没有任何一处 `handCards.push`。
//
// 它是无状态的——不持有任何玩家引用，改谁由参数告诉它。
// 于是「改错了人」是调用方的错，而不是系统状态的错。
// ============================================================

import type { GamePhase } from '@core/contracts/enums'
import type { IHero } from '@core/contracts/hero.interface'
import type { IPlayer } from '@core/contracts/player.interface'

/**
 * 玩家系统
 *
 * 无状态：所有方法把目标玩家作为第一个参数。
 * 这样它可以在引擎、测试、回放里各建一份而不互相干扰。
 */
export class PlayerSystem {
  // ── 体力 ──

  /**
   * 扣减体力
   *
   * 下限为 0——**死亡不在这里判定**。hp 归零只是「该走濒死流程了」，
   * 真正把 `alive` 翻成 false 的是 `DeathSystem`；两者分开，
   * 「被救回来」才不必去撤销一次已经发生的死亡。
   *
   * 非正数一律不动状态（返回值也是 0）：否则日志会写出「受到 -3 点伤害」
   * 这种鬼话。收口之前这道防线只写在 `DamageResolver` 里，只护住伤害
   * 这一条路；现在它属于写入点本身，所有调用方都受同一条规则约束。
   *
   * @returns 实际扣减量
   */
  loseHp(player: IPlayer, amount: number): number {
    if (amount <= 0) return 0
    const previous = player.hp
    player.hp = Math.max(0, player.hp - amount)
    return previous - player.hp
  }

  /**
   * 回复体力
   *
   * 上限为 maxHp——「回满还多出来」的那部分不记账，
   * 否则日志会写出「回复了 3 点」而实际只涨了 1 点。
   *
   * @returns 实际回复量
   */
  recoverHp(player: IPlayer, amount: number): number {
    if (amount <= 0) return 0
    const previous = player.hp
    player.hp = Math.min(player.maxHp, player.hp + amount)
    return player.hp - previous
  }

  /**
   * 濒死救活 —— 体力**设为**指定值，而不是「回复」
   *
   * 濒死时 hp ≤ 0（溢出伤害能把它打到负数），「回复 1 点」救不回来。
   * 这是 `recoverHp` 与它唯一的差别，也是为什么必须单独成一个方法：
   * 写成 `recoverHp(player, 1 - player.hp)` 也能对，但读的人得先自己
   * 想明白「为什么要减一下」，而这种心算是 bug 温床。
   */
  resurrect(player: IPlayer, hp = 1): void {
    player.hp = Math.min(hp, player.maxHp)
  }

  /**
   * 增减体力上限
   *
   * 上限动完，当前体力要跟着裁——「上限降到 3」时还挂着 4 点血，
   * 界面上就会画出一个比血条还长的血量。
   */
  modifyMaxHp(player: IPlayer, delta: number): void {
    player.maxHp = Math.max(0, player.maxHp + delta)
    if (player.hp > player.maxHp) player.hp = player.maxHp
  }

  /**
   * 设置体力上限（换英雄 / 主公加成这类「直接给定」的场合）
   */
  setMaxHp(player: IPlayer, value: number): void {
    player.maxHp = Math.max(0, value)
    if (player.hp > player.maxHp) player.hp = player.maxHp
  }

  /** 体力与上限一起设定（选英雄后回满） */
  resetHp(player: IPlayer, maxHp: number): void {
    player.maxHp = Math.max(0, maxHp)
    player.hp = player.maxHp
  }

  // ── 能量 ──

  /**
   * 消耗能量
   *
   * @returns 实际消耗量
   */
  consumePower(player: IPlayer, amount: number): number {
    if (amount <= 0) return 0
    const previous = player.power
    player.power = Math.max(0, player.power - amount)
    return previous - player.power
  }

  /** 获得能量（不超过上限） */
  gainPower(player: IPlayer, amount: number): void {
    if (amount <= 0) return
    player.power = Math.min(player.maxPower, player.power + amount)
  }

  /** 增减能量上限，并同步裁剪当前能量 */
  modifyMaxPower(player: IPlayer, delta: number): void {
    player.maxPower = Math.max(0, player.maxPower + delta)
    if (player.power > player.maxPower) player.power = player.maxPower
  }

  // ── 英雄 ──

  /**
   * 选择英雄 —— 顺带把体力 / 能量上限与当前值一起定下来
   *
   * 主公的体力加成在这里加，而不是留在调用方：加成是「选完英雄之后」
   * 才成立的，跟着英雄走才不会漏掉默认分配那条分支
   * （`GameEngine.assignHeroes` 里曾经把「加成」抄了两遍，
   * 玩家自己选与默认分配各一份，改一处就会漏另一处）。
   *
   * @param lordBonus 主公（天命星灵）的体力上限加成
   */
  chooseHeroes(player: IPlayer, heroes: IHero[], lordBonus = 0): void {
    player.heroes = heroes

    const first = heroes[0]
    if (!first) return

    player.maxHp = Math.max(0, first.maxHp + lordBonus)
    player.hp = player.maxHp
    player.maxPower = first.maxPower ?? 0
    player.power = player.maxPower
  }

  // ── 存活与身份 ──

  /**
   * 设定身份 —— 开局分配身份的唯一入口
   *
   * 以前 `GameEngine.assignRoles` 直接写 `player.role = shuffled[i]`，
   * 顺手在同一段里写了 `maxHp += 主公加成`。后者既重复又写得过早：
   * 真正决定「体力上限是多少」的是 `chooseHeroes`（英雄基础值 + 主公加成），
   * 而它发生在分配英雄那一步。收口之后 `setRole` 只管角色本身。
   *
   * @param role 身份；`undefined` 表示尚未分配（旁观或延迟决定）
   */
  setRole(player: IPlayer, role?: IPlayer['role']): void {
    player.role = role
  }

  /**
   * 翻转存活标记
   *
   * 死亡与复活都走这里。它是「这个人还算不算在场」的唯一真值源：
   * 技能放行闸、胜利条件、座次遍历全读这一个字段。
   */
  setAlive(player: IPlayer, alive: boolean): void {
    player.alive = alive
  }

  /** 公开身份（死亡时自动公开，部分技能也会提前公开它） */
  revealRole(player: IPlayer): void {
    player.roleRevealed = true
  }

  // ── 标记 ──

  /**
   * 通用计数器
   *
   * 统一入口的意义不在于夹取（标记没有合法范围），而在于
   * 「谁改过标记」这件事有地方可查：调试时在这里打一个断点，
   * 所有写入都跑不掉。
   */
  getMark(player: IPlayer, key: string): number {
    return player.marks.get(key) ?? 0
  }

  setMark(player: IPlayer, key: string, value: number): void {
    player.marks.set(key, value)
  }

  addMark(player: IPlayer, key: string, delta = 1): number {
    const next = this.getMark(player, key) + delta
    player.marks.set(key, next)
    return next
  }

  clearMark(player: IPlayer, key: string): void {
    player.marks.delete(key)
  }

  // ── 回合追踪 ──

  /**
   * 重置回合内状态
   *
   * 与 `resetTurnState` 同义，只是收进系统层，让「每回合归零」
   * 这件事只有一个地方写着。
   */
  resetTurnState(player: IPlayer): void {
    player.usedAttackThisTurn = false
    player.attackLimit = 1
    player.shouldSkipPhases = []
    player.skippedPhases = []
  }

  /** 记录本回合已使用一次攻击 */
  markAttackUsed(player: IPlayer): void {
    player.usedAttackThisTurn = true
  }

  // ── 阶段跳过 ──
  //
  // 这一组是 Phase 19 收口的漏网。

  /**
   * 追加待跳过的阶段
   *
   * 乐不思蜀 / 兵粮寸断 / 克己这类「再跳过一个阶段」的追加都走这里。
   * 去重放在写入点内部，而不是每个调用方各 `Set` 一遍——
   * 「同一个阶段被记两次」会让 `skippedPhases` 多一条，而读它的地方
   * 是按 `includes` 判的，重复本身无害却会让调试看到假的增长。
   */
  skipPhases(player: IPlayer, phases: GamePhase[]): void {
    player.shouldSkipPhases = [...new Set([...player.shouldSkipPhases, ...phases])]
  }

  /**
   * 整体替换待跳过的阶段
   *
   * 与 {@link skipPhases} 分开：跳过**整个回合**（`TurnManager.skipTurn`）
   * 是「把这些阶段全部设为跳过」，语义上不是追加。调用方以前自己
   * `player.shouldSkipPhases = [...]` 绕过本系统。
   */
  setSkipPhases(player: IPlayer, phases: GamePhase[]): void {
    player.shouldSkipPhases = [...phases]
  }

  /**
   * 记一笔「这个阶段真的被跳过了」
   *
   * 与 `shouldSkipPhases` 的分工：前者是**计划**，这里是**已经发生**。
   * 分开的意义在于 `mod.phaseSkippable` 能否决计划——被否决的阶段
   * 照常执行，于是不会留下记录。
   */
  markPhaseSkipped(player: IPlayer, phase: GamePhase): void {
    player.skippedPhases.push(phase)
  }
}
