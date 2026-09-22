// ============================================================
// 联盟杀 · DI 服务接口
//
// 定义引擎与外部世界（Store、日志、随机数、UI决策）之间的契约。
// 所有接口由外部实现（UI 层 / 测试 mock），通过 DI 容器注入引擎。
// ============================================================

import type { LogLevel, RoleType } from './enums'
import type { IGameState } from './game.interface'
import type { IPlayer } from './player.interface'
import type { ICard } from './card.interface'
import type { IEffect } from './effect.interface'

/**
 * 存储服务 — 单向同步引擎状态到外部存储（Pinia Store 等）。
 *
 * 引擎在每次状态变更后调用 syncGameState / syncPlayerState，
 * 外部存储据此更新 UI 响应式数据。
 * UI 不通过此接口修改引擎状态。
 */
export interface IStoreService {
  /** 同步完整游戏状态 */
  syncGameState(state: IGameState): void
  /** 同步单个玩家状态 */
  syncPlayerState(player: IPlayer): void
  /** 获取缓存的游戏状态快照 */
  getGameState(): Readonly<IGameState>
  /** 注册状态变更回调 */
  onChange(callback: (state: IGameState) => void): void
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
 * 随机服务 — 提供可替换的随机数源。
 *
 * 默认实现使用 Math.random()。
 * 测试中可注入确定性实现（如固定种子），确保可重复性。
 */
export interface IRandomService {
  /** Fisher-Yates 洗牌，返回新数组 */
  shuffle<T>(array: T[]): T[]
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
  askForEffectUse(player: IPlayer, effects: IEffect[], prompt: string): Promise<IEffect | null>
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
 * 卡牌出牌选项 — 包含可选卡牌及其合法目标
 */
export interface CardPlayOption {
  /** 可使用的卡牌 */
  card: ICard
  /** 该卡牌的合法目标列表 */
  validTargets: IPlayer[]
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
