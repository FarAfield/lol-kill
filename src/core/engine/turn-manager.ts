// ============================================================
// 联盟杀 · TurnManager — 回合与轮次管理
//
// 管理游戏的回合顺序和轮次推进。
//
// 职责：
// - startRound()  — 开始新的一轮，重置为第一个玩家
// - nextTurn()    — 切换到下一位存活玩家
// - getCurrentPlayer() — 获取当前行动玩家
// - skipTurn()    — 跳过玩家回合（乐不思蜀等）
// - 自动跳过死亡玩家
// ============================================================

import { GamePhase, RoleType } from '@core/contracts/enums'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { PlayerSystem } from '@core/system/player-system'
import { STANDARD_PHASE_ORDER } from '@source/base/constants'

/**
 * 回合管理器
 *
 * 负责管理轮次（Round）和回合（Turn）的推进。
 *
 * 轮次（Round）：所有存活玩家依次行动一次 = 一轮
 * 回合（Turn）：单个玩家的完整行动（准备→判定→摸牌→出牌→弃牌→结束）
 *
 * 基本流程：
 *   startRound() → nextTurn() × N → 所有玩家行动完 → startRound()
 */
export class TurnManager {
  /** 当前轮次中已经行动过的玩家索引集合 */
  private playersActedThisRound: Set<number> = new Set()

  /**
   * 玩家状态系统 —— 「每回合归零」那几笔账的写入口（Phase 19）
   *
   * 无状态，因此这里自建一份即可，不必由引擎注入。
   */
  private playerSystem = new PlayerSystem()

  constructor(private state: GameStateSnapshot) {}

  // ── 轮次操作 ──

  /**
   * 开始新的一轮。
   *
   * 先手固定给主公（欠账 D7 的另一半）。`assignRoles` 已经把主公钉在 0 号位，
   * 这里**仍然按身份找**而不是直接写 `currentPlayerIndex = 0`：
   * 「谁先手」的依据是身份，不是座次数字——座次只是身份今天恰好落在那儿。
   * 主公已死（或本局没有主公）才退回第一个存活玩家。
   */
  startRound(): void {
    this.state.currentRound++
    this.playersActedThisRound.clear()

    const lord = this.state.players.find(
      (p) => p.alive && p.role === RoleType.Aspect,
    )
    const firstAlive = lord ?? this.state.players.find((p) => p.alive)

    this.state.currentPlayerIndex = firstAlive?.seatIndex ?? 0
    this.state.currentPhase = GamePhase.RoundStart
  }

  /**
   * 推进到下一个存活玩家的回合。
   *
   * 按座位顺序循环，自动跳过死亡玩家。
   * 如果所有存活玩家都已行动过，返回 undefined（调用方应开始新轮次）。
   *
   * @returns 下一个行动玩家，若无玩家可行动则返回 undefined
   */
  nextTurn(): IPlayer | undefined {
    const playerCount = this.state.players.length
    if (playerCount === 0) return undefined

    // 检查是否所有存活玩家都已在本轮行动
    const alivePlayers = this.state.alivePlayers
    if (alivePlayers.length === 0) return undefined

    const allActed = alivePlayers.every((p) =>
      this.playersActedThisRound.has(p.seatIndex),
    )

    if (allActed) {
      // 本轮结束，所有存活玩家均已行动
      return undefined
    }

    // ── 先检查当前玩家是否还未行动 ──
    // 场景：startRound() 将 currentPlayerIndex 设为第一个存活玩家，
    // 该玩家尚未被返回过，应当作为第一个回合的持有者。
    const currentPlayer = this.state.players[this.state.currentPlayerIndex]
    if (
      currentPlayer?.alive &&
      !this.playersActedThisRound.has(currentPlayer.seatIndex)
    ) {
      this.playersActedThisRound.add(currentPlayer.seatIndex)
      this.playerSystem.resetTurnState(currentPlayer)
      this.state.currentPhase = GamePhase.PhasePre
      return currentPlayer
    }

    // ── 找到下一个存活且未行动的玩家 ──
    for (let i = 1; i <= playerCount; i++) {
      const nextIndex =
        (this.state.currentPlayerIndex + i) % playerCount
      const nextPlayer = this.state.players[nextIndex]

      if (!nextPlayer?.alive) continue
      if (this.playersActedThisRound.has(nextIndex)) continue

      // 找到下一个行动玩家
      this.state.currentPlayerIndex = nextIndex
      this.playersActedThisRound.add(nextIndex)

      // 重置该玩家的回合状态
      this.playerSystem.resetTurnState(nextPlayer)

      // 设置当前阶段为回合准备阶段
      this.state.currentPhase = GamePhase.PhasePre

      return nextPlayer
    }

    // 理论上不会到这里，但安全返回
    return undefined
  }

  /**
   * 获取当前行动玩家。
   *
   * @returns 当前玩家，如果无存活玩家则返回 undefined
   */
  getCurrentPlayer(): IPlayer | undefined {
    const player = this.state.players[this.state.currentPlayerIndex]
    if (player?.alive) return player
    return undefined
  }

  // ── 跳过回合 ──

  /**
   * 跳过指定玩家的整个回合。
   *
   * 在三国杀中，乐不思蜀等效果会使玩家跳过整个回合或部分阶段。
   *
   * **「跳过」只有一本账**（欠账 D29）：`player.shouldSkipPhases`。
   * 以前这里还另写一份 `TurnManager.skippedPlayers`（按座次记「整回合跳过」），
   * 于是 `nextTurn` 与 `executeTurn` 各有一份答案——前者在 `nextTurn` 里把人跳过去，
   * 后者在阶段循环里再跳一次，而且被 `nextTurn` 跳过的玩家根本没记进
   * `playersActedThisRound`，本轮末尾又会被重新选中，「跳过」实际是「延后」。
   *
   * 现在跳过整个回合 = 把六个阶段全部记进那一本账。于是：
   * - 该玩家本轮照旧算「已行动」，不会在轮末被再捞回来；
   * - `turnStart` / `turnEnd` 照发，「每回合一次」的额度照旧重置；
   * - `mod.phaseSkippable` 那道否决照旧生效（跳过整个回合也能被否决掉）。
   *
   * **什么时候写才有效**：这一本账在 `nextTurn` 选人时会被 `resetTurnState` 清掉，
   * 所以「跳过下一个回合」这种**跨回合预约**不成立——要跳过谁，得在他自己的
   * 回合已经开始之后写（乐不思蜀正是这样：判定阶段写，出牌阶段读）。
   * 真需要跨回合生效的规则，应当挂在 `turnStart` 上，而不是指望这本账活到那时。
   *
   * @param player 要跳过的玩家
   */
  skipTurn(player: IPlayer): void {
    this.playerSystem.setSkipPhases(player, [...STANDARD_PHASE_ORDER])
  }

  /**
   * 跳过当前玩家的指定阶段。
   *
   * 例如乐不思蜀 → 跳过出牌阶段。
   * 注意：这不等同于跳过整个回合（skipTurn），而是跳过部分阶段。
   *
   * @param phases 要跳过的阶段列表
   */
  skipPhases(player: IPlayer, phases: GamePhase[]): void {
    // 去重在 PlayerSystem 内部做——以前那句 `Set` 去重就写在这儿，
    // 于是「同一个阶段被记两次怎么处理」这条规则也跟着住在调用方。
    this.playerSystem.skipPhases(player, phases)
  }

  //
  // 这里曾经还有一个 `shouldSkipPhase(phase)`，读 `player.shouldSkipPhases.includes(phase)`
  // —— 它是「这个阶段跳不跳」的**第二个答案**，而且零调用方：
  // `PhaseManager.executeTurn` 自己读同一本账，并且多问一道 `mod.phaseSkippable`。
  // 于是被 `phaseSkippable` 否决掉的阶段，在这个方法看来「还是要跳」。
  // 随 D29 一并删除：答案只能有一个，且它得是带否决的那一个。

  // ── 查询 ──

  /**
   * 当前轮次是否已结束（所有存活玩家均已行动）。
   */
  get isRoundComplete(): boolean {
    const alivePlayers = this.state.alivePlayers
    if (alivePlayers.length === 0) return true
    return alivePlayers.every((p) =>
      this.playersActedThisRound.has(p.seatIndex),
    )
  }

  //
  // 这里曾经还有三个对外成员：一个「已行动玩家列表」、一个「未行动玩家列表」、
  // 以及一个把「已行动」集合清空的 `reset()`（欠账 D33）——三者**零调用方**。
  //
  // 前两个是「谁本轮动过」的**第二个答案**：这本账真正的拥有者是
  // `playersActedThisRound`，`isRoundComplete`（`runGameLoop` 在读）已经给出了
  // 「本轮动完没有」这一个结论；再开两个出口，就等于允许有人拿着列表自己
  // 推一遍轮次，而那套推法不带 `alive` 的即时性（列表是快照，有人中途死了
  // 它不会变）。删掉，需要列表的人去问 `isRoundComplete` + `alivePlayers`。
  //
  // `reset()` 更该删：它清的是**跨局**的账，而本类的账每局都随实例重建
  // （`GameEngine.init()` 不换实例，但 `startRound()` 每次都 `clear()`），
  // 留着它就等于宣称「新的一局可以不走 startRound」，那局一开始就少了
  // 「先手归主公」这一步。

  /**
   * 当前回合数（即 currentRound）。
   */
  get currentRound(): number {
    return this.state.currentRound
  }
}
