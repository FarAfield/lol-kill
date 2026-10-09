// ============================================================
// 联盟杀 · DI 服务接口
//
// 定义引擎与外部世界（Store、日志、随机数、UI决策）之间的契约。
// 所有接口由外部实现（UI 层 / 测试 mock），通过 DI 容器注入引擎。
// ============================================================

import type { CardBudget } from '@core/skill/card-budget'
import type { IModQuery } from './mod.interface'
import type { LogLevel, RoleType } from './enums'
import type { GameStateSnapshot } from './game.interface'
import type { IPlayer } from './player.interface'
import type { ICard } from './card.interface'
import type { ISkill, ISkillRegistry } from './skill.interface'

/**
 * 存储服务 — 单向同步引擎状态到外部存储（Pinia Store 等）。
 *
 * 引擎在每次状态变更后调用 syncGameState / syncPlayerState，
 * 外部存储据此更新 UI 响应式数据。
 * UI 不通过此接口修改引擎状态。
 */
export interface IStoreService {
  /** 同步完整游戏状态快照 */
  syncGameState(state: GameStateSnapshot): void
  /** 同步单个玩家状态 */
  syncPlayerState(player: IPlayer): void
  /** 获取缓存的游戏状态快照 */
  getGameState(): Readonly<GameStateSnapshot>
  /**
   * 注册状态变更回调，返回注销函数。
   *
   * Pinia Store 通过此回调自动更新响应式状态。
   */
  onChange(listener: (state: Readonly<GameStateSnapshot>) => void): () => void
  /** 取消注册状态变更回调 */
  offChange(listener: (state: Readonly<GameStateSnapshot>) => void): void
  /** 重置存储 */
  reset(): void
}

/**
 * 日志服务 — 记录引擎运行日志。
 *
 * 实现方可以是 console、文件、远程日志服务等。
 * 调试模式通过 LogLevel.Debug 控制输出。
 */
export interface ILoggerService {
  /** 通用日志记录 */
  log(message: string, level: LogLevel): void
  /** 调试级别日志（仅开发环境） */
  debug(message: string): void
  /** 信息级别日志 */
  info(message: string): void
  /** 警告级别日志 */
  warn(message: string): void
  /** 错误级别日志 */
  error(message: string): void
  /** 获取已记录的日志列表（调试用） */
  getLogs(): ReadonlyArray<{ message: string; level: LogLevel; timestamp: number }>
  /** 清除日志缓存 */
  clear(): void
}

/**
 * 随机服务 — 引擎唯一的随机来源。
 *
 * 引擎对它是**必填**的（GameEngine / DeckManager 都不接受缺省）：
 * 曾经「不传就退回 Math.random」的那条分支已经删除——那是一扇
 * 「悄悄引入不确定性」的后门，牌堆顺序一旦不可复现，回放与
 * 批量回归测试就都失去意义。
 *
 * 标准实现见 `core/services/seeded-random.ts`（mulberry32）：
 * 同一种子 + 同一串调用 = 同一串结果。
 */
export interface IRandomService {
  /** Fisher-Yates 洗牌，返回新数组（不改动入参） */
  shuffle<T>(array: readonly T[]): T[]
  /** 生成 [min, max] 范围内的随机整数 */
  nextInt(min: number, max: number): number
  /** 从数组中随机选取一个元素 */
  pick<T>(array: T[]): T
  /** 从数组中随机选取 n 个元素 */
  pickN<T>(array: T[], n: number): T[]
  /** 生成唯一标识符 */
  uuid(): string
}

/**
 * UI 决策服务 — 引擎向外部（玩家/AI）请求决策的抽象接口。
 *
 * 所有的 `askFor*` 方法返回 Promise，允许异步等待用户输入。
 * 实现方可以是：
 * - UI 弹窗（人类玩家）
 * - AI 策略（AI 玩家）
 * - 测试桩（自动化测试）
 *
 * 所有方法应支持超时（timeout 参数），超时后返回 null 或默认值。
 */
export interface IUIDecisionService {
  /**
   * 把出牌额度查询递给决策服务（可选）
   *
   * AI 在引擎**之前**就建好了（它要被当成决策服务先传进 `GameBoot`），
   * 因此只能在引擎就绪后由 `GameBoot` 补上这一步。
   * 少了它，AI 就看不见【诸葛连弩】这类额度加成（欠账 D8）。
   */
  setCardBudget?(budget: CardBudget): void

  /**
   * 把 Mod 查询口递给决策服务（可选）
   *
   * 与 `setCardBudget` 同一条理由、同一条注入路径。少了它，AI 评估
   * 「这张牌打这个人会掉几点血」时看不见任何防具与加减伤——
   * 藤甲挨火杀是 2 点，它一律按 1 点算（欠账 D19）。
   */
  setModQuery?(modQuery: IModQuery): void

  /**
   * 把技能台账递给决策服务（可选）
   *
   * AI 评估「谁最危险」要读技能定义上的 `ai.threaten`，而「谁有哪个技能」
   * 只有台账知道。缺了它，威胁度一律是 0（欠账 D21）。
   */
  setSkillRegistry?(skillRegistry: ISkillRegistry): void
  /** 询问玩家选择哪张牌出牌，并指定目标。返回 null 表示跳过 */
  askForCardPlay(player: IPlayer, options: CardPlayOption[]): Promise<CardPlayResult | null>
  /** 询问玩家是否响应（如是否出闪、是否出桃） */
  askForResponse(
    player: IPlayer,
    prompt: string,
    validCards: ICard[],
    timeout?: number,
  ): Promise<ICard | null>
  /** 询问玩家选择目标 */
  askForTarget(
    player: IPlayer,
    candidates: IPlayer[],
    prompt: string,
    minTargets?: number,
    maxTargets?: number,
  ): Promise<IPlayer[]>
  /** 询问玩家是否发动主动技能 */
  askForEffectUse(player: IPlayer, effects: ISkill[], prompt: string): Promise<ISkill | null>
  /** 询问玩家弃置哪些卡牌 */
  askForDiscard(player: IPlayer, count: number, validCards: ICard[]): Promise<ICard[]>
  /** 询问玩家选择英雄 */
  askForHeroSelect(
    player: IPlayer,
    candidates: { id: string; name: string; title: string; kingdom: string }[],
    selectCount: number,
  ): Promise<string>
  /** 通知单个玩家 */
  notifyPlayer(player: IPlayer, message: string, level: 'info' | 'warn' | 'error'): void
  /** 通知所有玩家 */
  notifyAll(message: string, level: 'info' | 'warn' | 'error'): void
  /** 展示游戏结果 */
  showGameResult(result: { winner: RoleType | null; reason: string }): Promise<void>
}

/**
 * 卡牌出牌选项 — 包含可选卡牌、其合法目标，以及该选几个
 *
 * `minTargets` / `maxTargets` 与合法目标**同一处**算出
 * （`TargetSystem`），一并递给决策方。少了它们，每个决策服务只能
 * 各自猜「取第一个」——于是 AOE 被塞进 1 个目标（它的上限是 0）、
 * 【借刀杀人】只拿到 1 个（它的下限是 2），而引擎那新装的目标校验
 * 会把这些出牌全判非法。
 */
export interface CardPlayOption {
  /** 可使用的卡牌 */
  card: ICard
  /** 该卡牌的合法目标列表 */
  validTargets: IPlayer[]
  /** 至少选几个目标（0 = 可以不选，如 AOE / 只对自己生效的牌） */
  minTargets: number
  /** 至多选几个目标（0 = 这张牌不设目标） */
  maxTargets: number
}

/**
 * 卡牌出牌结果 — 玩家选择的卡牌及目标
 */
export interface CardPlayResult {
  /** 选中的卡牌 */
  card: ICard
  /** 选中的目标 */
  targets: IPlayer[]
}
