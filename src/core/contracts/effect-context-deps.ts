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
import type { PlayerSystem } from '@core/system/player-system'
import type { DamageResolver } from '@core/system/damage-resolver'
import type { DeathSystem } from '@core/system/death-system'
import type { IModQuery } from './mod.interface'
import type { ISkillRegistry, IViewAsService } from './skill.interface'
import type { IUIDecisionService } from './services.interface'
import type { EventPauseManager } from '@core/event/event-pause-manager'
import type { EventTrigger } from '@core/event/event-trigger'

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
  /** 暂停管理器——等待玩家决策时挂起事件链 */
  pauseManager: EventPauseManager
  deckManager: DeckManager
  cardSystem: CardSystem
  /**
   * 玩家状态系统（Phase 19）—— 数值与标记的唯一写入点
   *
   * 内容层要改血量 / 写标记时，`EffectContext` 转交到这里。
   * 有了它，`IPlayer` 上就不再需要任何变更方法。
   */
  playerSystem: PlayerSystem
  /**
   * 伤害求解器（纯函数，无状态）
   *
   * Phase 10 起伤害是一条事件流水线，这里只留「算数值 / 扣血」的纯计算。
   */
  damageResolver: DamageResolver
  deathSystem: DeathSystem
  /**
   * Mod 查询口（只读）
   *
   * 「数值怎么算」的唯一答案来源。伤害内容、距离查询、
   * 阶段数值都从这里取——不许在某处自己 `if (装备了某某)`。
   */
  modQuery: IModQuery
  /**
   * 技能台账
   *
   * 技能要能增删自己：`ctx.modifyEffects(target, ['newSkill'])` 就是
   * 觉醒技获得新技能的那一句话。Phase 14 之前这里只写了一个 mark，
   * 没有任何人读它——觉醒技因此是纯装饰。
   */
  skillRegistry: ISkillRegistry
  /**
   * 视作服务（Phase 16）
   *
   * 内容的作者靠它问「这个人此刻能变出哪些牌」——响应征询、濒死求桃
   * 要把虚拟牌列进候选里，否则【龙胆】永远打不出闪、【酒】当不了桃。
   */
  viewAs: IViewAsService
  /**
   * 事件触发器
   *
   * Phase 17 起内容可以 `ctx.when('drawEnd')…` 挂一次性监听，
   * 监听要挂到它上面。与 `eventDispatcher` 分开列是因为
   * 后者在这里只用了 `dispatch` 一个方法（结构类型，避免循环依赖）。
   */
  eventTrigger: EventTrigger
  /** 决策服务（可选——纯引擎测试无 UI 时可不传） */
  decisionService?: IUIDecisionService
}
