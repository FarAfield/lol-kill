// ============================================================
// 联盟杀 · ResponseWindow — 弹窗式响应询问
//
// 封装了「暂停事件栈 + 等待玩家决策」的 Promise 模式。
// 用于需要玩家做出选择的场景：
//   - "是否出闪？" → 响应杀
//   - "是否出桃？" → 濒死求桃
//   - "是否使用无懈可击？" → 锦囊响应
//   - "选择卡牌弃置" → 弃牌阶段
//   - "是否发动技能？" → 技能发动询问
//
// 使用流程:
//   1. EventDispatcher 创建 ResponseWindow
//   2. 事件栈暂停，等待玩家响应
//   3. UI 层显示弹窗
//   4. 玩家做出选择后，调用 respond() 恢复事件栈
//   5. 事件继续结算
// ============================================================

import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IEffect } from '@core/contracts/effect.interface'

/**
 * 响应类型枚举
 */
export enum ResponseType {
  /** 出牌响应（杀 → 闪、南蛮 → 杀、万箭 → 闪） */
  PlayCard = 'playCard',
  /** 使用技能响应 */
  UseEffect = 'useEffect',
  /** 选择卡牌 */
  SelectCards = 'selectCards',
  /** 选择目标 */
  SelectTargets = 'selectTargets',
  /** 确认/取消 */
  Confirm = 'confirm',
  /** 自定义 */
  Custom = 'custom',
}

/**
 * 响应窗口选项
 */
export interface ResponseWindowOptions {
  /** 响应类型 */
  responseType: ResponseType
  /** 响应者 */
  player: IPlayer
  /** 提示文本 */
  prompt: string
  /** 可选卡牌列表 */
  validCards?: ICard[]
  /** 最少选择卡牌数 */
  minCards?: number
  /** 最多选择卡牌数 */
  maxCards?: number
  /** 可选目标列表 */
  validTargets?: IPlayer[]
  /** 最少选择目标数 */
  minTargets?: number
  /** 最多选择目标数 */
  maxTargets?: number
  /** 可选效果列表（技能发动询问） */
  validEffects?: IEffect[]
  /** 超时时间（ms），0 表示不超时 */
  timeout?: number
  /** 是否允许取消（不出牌/不响应） */
  cancelable?: boolean
  /** 触发此响应的来源事件名称 */
  sourceEventName?: string
  /** 自定义数据 */
  data?: Record<string, unknown>
}

/**
 * 响应结果
 */
export interface ResponseResult {
  /** 是否已响应（ false 表示取消/不出） */
  responded: boolean
  /** 选择的卡牌 */
  cards: ICard[]
  /** 选择的目标 */
  targets: IPlayer[]
  /** 选择的效果 */
  effect: IEffect | null
  /** 响应时是否超时 */
  timedOut: boolean
  /** 自定义响应数据 */
  data?: Record<string, unknown>
}

/**
 * ResponseWindow — 响应窗口
 *
 * 代表一个待处理的玩家决策点。
 * 内部使用 Promise 管理异步等待。
 */
export class ResponseWindow {
  /** 窗口唯一标识 */
  readonly id: string

  /** 响应选项 */
  readonly options: ResponseWindowOptions

  /** Promise resolve 回调 */
  private _resolve: ((result: ResponseResult) => void) | null = null

  /** Promise reject 回调 */
  private _reject: ((error: Error) => void) | null = null

  /** 是否已响应 */
  private _resolved: boolean = false

  /** 是否已取消 */
  private _cancelled: boolean = false

  /** 超时计时器 */
  private _timeoutTimer: ReturnType<typeof setTimeout> | null = null

  /** 创建时间戳 */
  readonly createdAt: number

  constructor(options: ResponseWindowOptions) {
    this.id = `rw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.options = options
    this.createdAt = Date.now()
  }

  /**
   * 等待玩家响应
   *
   * @returns Promise<ResponseResult> — 玩家响应后 resolve
   */
  awaitResponse(): Promise<ResponseResult> {
    return new Promise<ResponseResult>((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject

      // 设置超时
      if (this.options.timeout && this.options.timeout > 0) {
        this._timeoutTimer = setTimeout(() => {
          if (!this._resolved) {
            const timeoutResult: ResponseResult = {
              responded: false,
              cards: [],
              targets: [],
              effect: null,
              timedOut: true,
            }
            this._resolve!(timeoutResult)
            this._resolved = true
          }
        }, this.options.timeout)
      }
    })
  }

  /**
   * 玩家做出响应
   *
   * @param result - 部分响应结果（未指定的字段使用默认值）
   */
  respond(result: Partial<ResponseResult>): void {
    if (this._resolved) return

    this._resolved = true
    this.clearTimer()

    const fullResult: ResponseResult = {
      responded: result.responded ?? true,
      cards: result.cards ?? [],
      targets: result.targets ?? [],
      effect: result.effect ?? null,
      timedOut: result.timedOut ?? false,
      data: result.data,
    }

    this._resolve!(fullResult)
  }

  /**
   * 玩家取消/不响应
   */
  cancel(): void {
    if (this._resolved) return

    this._resolved = true
    this._cancelled = true
    this.clearTimer()

    const cancelResult: ResponseResult = {
      responded: false,
      cards: [],
      targets: [],
      effect: null,
      timedOut: false,
    }

    this._resolve!(cancelResult)
  }

  /**
   * 强制拒绝（出现错误时）
   */
  reject(error: Error): void {
    if (this._resolved) return

    this._resolved = true
    this.clearTimer()
    this._reject!(error)
  }

  /**
   * 是否已响应
   */
  get resolved(): boolean {
    return this._resolved
  }

  /**
   * 是否已取消
   */
  get cancelled(): boolean {
    return this._cancelled
  }

  /**
   * 距离创建时间的毫秒数
   */
  get elapsed(): number {
    return Date.now() - this.createdAt
  }

  // ── 私有方法 ──

  private clearTimer(): void {
    if (this._timeoutTimer) {
      clearTimeout(this._timeoutTimer)
      this._timeoutTimer = null
    }
  }
}

/**
 * ResponseWindowFactory — 响应窗口工厂
 *
 * 封装常见的响应窗口创建模式。
 */
export class ResponseWindowFactory {
  /**
   * 创建「出牌响应」窗口
   *
   * 典型场景: 被杀 → 询问是否出闪
   */
  static createDefendWindow(
    player: IPlayer,
    validCards: ICard[],
    options?: Partial<ResponseWindowOptions>,
  ): ResponseWindow {
    return new ResponseWindow({
      responseType: ResponseType.PlayCard,
      player,
      prompt: options?.prompt ?? '请选择要打出的牌',
      validCards,
      minCards: 1,
      maxCards: 1,
      cancelable: true,
      timeout: options?.timeout,
      ...options,
    })
  }

  /**
   * 创建「濒死求桃」窗口
   */
  static createDyingWindow(
    player: IPlayer,
    dyingPlayer: IPlayer,
    validCards: ICard[],
    options?: Partial<ResponseWindowOptions>,
  ): ResponseWindow {
    return new ResponseWindow({
      responseType: ResponseType.PlayCard,
      player,
      prompt: options?.prompt ?? `${dyingPlayer.id} 处于濒死状态，是否使用桃/酒？`,
      validCards,
      minCards: 0,
      maxCards: 1,
      cancelable: true,
      timeout: options?.timeout,
      ...options,
    })
  }

  /**
   * 创建「技能发动询问」窗口
   */
  static createEffectWindow(
    player: IPlayer,
    effects: IEffect[],
    options?: Partial<ResponseWindowOptions>,
  ): ResponseWindow {
    return new ResponseWindow({
      responseType: ResponseType.UseEffect,
      player,
      prompt: options?.prompt ?? '是否发动技能？',
      validEffects: effects,
      cancelable: true,
      timeout: options?.timeout,
      ...options,
    })
  }

  /**
   * 创建「选择卡牌」窗口
   *
   * 典型场景: 弃牌阶段、过河拆桥选择目标牌
   */
  static createCardSelectWindow(
    player: IPlayer,
    validCards: ICard[],
    minCards: number,
    maxCards: number,
    options?: Partial<ResponseWindowOptions>,
  ): ResponseWindow {
    return new ResponseWindow({
      responseType: ResponseType.SelectCards,
      player,
      prompt: options?.prompt ?? `请选择 ${minCards}-${maxCards} 张牌`,
      validCards,
      minCards,
      maxCards,
      cancelable: false,
      timeout: options?.timeout,
      ...options,
    })
  }

  /**
   * 创建「选择目标」窗口
   */
  static createTargetSelectWindow(
    player: IPlayer,
    validTargets: IPlayer[],
    minTargets: number,
    maxTargets: number,
    options?: Partial<ResponseWindowOptions>,
  ): ResponseWindow {
    return new ResponseWindow({
      responseType: ResponseType.SelectTargets,
      player,
      prompt: options?.prompt ?? `请选择 ${minTargets}-${maxTargets} 个目标`,
      validTargets,
      minTargets,
      maxTargets,
      cancelable: true,
      timeout: options?.timeout,
      ...options,
    })
  }
}
