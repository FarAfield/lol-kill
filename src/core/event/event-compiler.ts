// ============================================================
// 联盟杀 · EventCompiler — 事件编译器
//
// 将卡牌使用动作编译为可执行的游戏事件链。
//
// 职责：
//   1. 解析卡牌定义 → 查找关联的 Effect
//   2. 创建 CardUse 事件并挂载 EffectContext
//   3. 协调 Effect.content() 的执行
//   4. 处理卡牌使用后的区域流转（hand → processing → discard）
//
// 典型流程（使用杀）：
//   1. validateCardUse() — 校验合法性
//   2. compile() — 创建 CardUse 事件 + EffectContext
//   3. dispatch — 通过 EventDispatcher 执行
//   4. finishCardUse() — 卡牌进入弃牌堆
// ============================================================

import { TriggerTiming, ZoneType, GamePhase } from '@core/contracts/enums'
import type { IGameEvent } from '@core/contracts/event.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IGameState } from '@core/contracts/game.interface'
import type { IEffect } from '@core/contracts/effect.interface'
import { GameEvent } from './game-event'
import type { EventChain } from './event-chain'
import type { EventDispatcher } from './event-dispatcher'
import type { EffectRegistry } from '@core/engine/effect-registry'
import { EffectContext } from '@core/engine/effect-context'
import type { EffectContextDeps } from '@core/engine/effect-context'
import { TargetSystem } from '@core/system/target-system'

/**
 * 卡牌使用结果
 */
export interface CardUseResult {
  /** 是否成功 */
  success: boolean
  /** 错误信息（如果失败） */
  error?: string
  /** 创建的事件链 */
  events: IGameEvent[]
}

/**
 * EventCompiler — 事件编译器
 *
 * 将声明式卡牌数据翻译为运行时事件。
 */
export class EventCompiler {
  private registry: EffectRegistry
  private deps: EffectContextDeps

  constructor(registry: EffectRegistry, deps: EffectContextDeps) {
    this.registry = registry
    this.deps = deps
  }

  /**
   * 编译卡牌使用为事件并分发执行。
   *
   * 完整流程：
   * 1. 校验目标合法性
   * 2. 将卡牌移入处理区
   * 3. 创建 CardUse 事件并挂载 EffectContext
   * 4. 分发事件（触发效果钩子）
   * 5. 将卡牌移入弃牌堆
   *
   * @param card    要使用的卡牌
   * @param source  使用者
   * @param targets 目标列表
   * @returns 卡牌使用结果
   */
  async compile(
    card: ICard,
    source: IPlayer,
    targets: IPlayer[],
  ): Promise<CardUseResult> {
    const events: IGameEvent[] = []

    // ── Step 1: 校验目标合法性 ──
    const validation = TargetSystem.validateTargets(
      source,
      targets,
      card,
      this.deps.state,
    )

    if (!validation.valid) {
      return { success: false, error: validation.reason, events }
    }

    // ── Step 2: 将卡牌移入处理区 ──
    try {
      this.deps.cardSystem.useCard(card, source, targets)
    } catch (err) {
      return {
        success: false,
        error: `无法使用卡牌: ${(err as Error).message}`,
        events,
      }
    }

    // ── Step 3: 创建 CardUse 事件 ──
    const cardUseEvent = new GameEvent({
      name: `${source.hero?.name ?? source.id} 使用了 ${card.name}`,
      type: TriggerTiming.CardUse,
      source,
      player: source,
      targets,
      cards: [card],
      phase: this.deps.state.currentPhase,
      round: this.deps.state.currentRound,
      turn: source.seatIndex,
    })

    events.push(cardUseEvent)

    // ── Step 4: 挂载 EffectContext ──
    const effectContext = new EffectContext(
      cardUseEvent,
      source,
      [card],
      this.deps,
    )

    cardUseEvent.data['_effectContext'] = effectContext

    // ── Step 5: 分发事件 ──
    try {
      await this.deps.eventDispatcher.dispatch(
        cardUseEvent,
        this.deps.eventChain,
      )
    } catch (err) {
      return {
        success: false,
        error: `事件分发失败: ${(err as Error).message}`,
        events,
      }
    }

    // ── Step 6: 执行卡牌关联效果的内容 ──
    await this.executeCardEffects(card, source, effectContext, events)

    // ── Step 7: 将卡牌从处理区移入弃牌堆 ──
    try {
      this.deps.cardSystem.finishProcessing(card)
    } catch {
      // 卡牌可能已被其他效果移动，忽略错误
    }

    return { success: true, events }
  }

  /**
   * 创建一个待响应的卡牌使用事件（用于响应窗口）。
   *
   * 与 compile() 不同，此方法不执行效果内容，
   * 仅创建事件和上下文，供外部进一步处理。
   *
   * @param card    要使用的卡牌
   * @param source  使用者
   * @param targets 目标列表
   * @returns 事件和效果上下文
   */
  createCardUseEvent(
    card: ICard,
    source: IPlayer,
    targets: IPlayer[],
  ): { event: IGameEvent; context: EffectContext } {
    const event = new GameEvent({
      name: `${source.hero?.name ?? source.id} 使用了 ${card.name}`,
      type: TriggerTiming.CardUse,
      source,
      player: source,
      targets,
      cards: [card],
      phase: this.deps.state.currentPhase,
      round: this.deps.state.currentRound,
      turn: source.seatIndex,
    })

    const context = new EffectContext(event, source, [card], this.deps)
    event.data['_effectContext'] = context

    return { event, context }
  }

  /**
   * 执行卡牌关联效果的内容。
   *
   * 查找卡牌 effectIds 对应的 Effect，并按优先级依次执行其 content()。
   */
  private async executeCardEffects(
    card: ICard,
    source: IPlayer,
    context: EffectContext,
    events: IGameEvent[],
  ): Promise<void> {
    const effects = this.registry.getAll(card.effectIds)

    // 按优先级排序（高优先级先执行）
    const sorted = [...effects].sort((a, b) => b.priority - a.priority)

    for (const effect of sorted) {
      if (!effect.enabled) continue

      // filter 检查
      if (effect.filter && !effect.filter(context)) continue

      // 执行效果核心逻辑
      if (effect.content) {
        await effect.content(context)
      }

      // 更新 frequency 标记
      if (effect.frequency === 'once') {
        effect.usedThisRound = true
        effect.usedThisTurn = true
      } else if (effect.frequency === 'oncePerTurn') {
        effect.usedThisTurn = true
      } else if (effect.frequency === 'oncePerRound') {
        effect.usedThisRound = true
      }
    }
  }
}
