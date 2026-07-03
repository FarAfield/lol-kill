// ============================================================
// 联盟杀 · EffectContextDeps — EffectContext 依赖项
//
// 提取为独立文件以避免 EventDispatcher 与 EffectContext 之间的循环依赖。
// EventDispatcher 和 EffectContext 都引用此接口，但彼此不直接引用。
// ============================================================

import type { IGameState } from './game.interface'
import type { IGameEvent } from './event.interface'
import type { EventChain } from '@core/event/event-chain'
import type { DeckManager } from '@core/system/deck-manager'
import type { CardSystem } from '@core/system/card-system'
import type { DamageSystem } from '@core/system/damage-system'
import type { DeathSystem } from '@core/system/death-system'
import type { IUIDecisionService } from './services.interface'

/**
 * EffectContext 依赖项
 *
 * 包含 EffectContext 所需的全部游戏子系统和状态。
 * 由 GameEngine 构建，注入到 EventDispatcher 中，
 * EventDispatcher 在执行 CompiledHandler 时据此创建 EffectContext。
 */
export interface EffectContextDeps {
  state: IGameState
  eventChain: EventChain
  /** Dispatch 函数（EffectContext.emit 等内部调用），结构类型避免循环依赖 */
  eventDispatcher: { dispatch(event: IGameEvent, chain: EventChain): Promise<void> }
  deckManager: DeckManager
  cardSystem: CardSystem
  damageSystem: DamageSystem
  deathSystem: DeathSystem
  /** 决策服务（可选——纯引擎测试无 UI 时可不传） */
  decisionService?: IUIDecisionService
}
