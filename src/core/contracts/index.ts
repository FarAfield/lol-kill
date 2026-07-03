// ============================================================
// 联盟杀 · Contracts 统一导出
// ============================================================

// ── 基础类型别名 ──
export type {
  Position,
  CardId,
  PlayerId,
  SkillId,
  HeroId,
  EventId,
  Hp,
  Distance,
  LogEntry,
} from './types'

// ── 枚举 ──
export {
  CardSuit,
  CardType,
  CardRank,
  ZoneType,
  GamePhase,
  TriggerTiming,
  SkillType,
  RoleType,
  EventStatus,
  EquipSlot,
  Kingdom,
  DamageType,
  Frequency,
  LogLevel,
} from './enums'

export type { TriggerStage } from './enums'

// ── 事件接口 ──
export type {
  EventValues,
  IGameEvent,
  IEventContext,
  EventHook,
  EventHookRegistration,
} from './event.interface'

// ── 卡牌接口 ──
export type { ICard, CardDefinition } from './card.interface'

// ── 玩家接口 ──
export type { IPlayer } from './player.interface'

// ── 英雄接口 ──
export type { IHero } from './hero.interface'

// ── 效果接口（统一技能/卡牌效果） ──
export type {
  TriggerEntry,
  ITriggerCondition,
  IEffectContext,
  ITargetSelector,
  ICardSelector,
  IEffect,
} from './effect.interface'

// ── 游戏接口 ──
export type {
  IGameConfig,
  IGameState,
  IGameResult,
} from './game.interface'

// ── 编译效果 ├──
export type { CompiledHandler } from './compiled-handler'

// ── 效果上下文依赖 ──
export type { EffectContextDeps } from './effect-context-deps'

// ── 服务接口 ──
export type {
  IStoreService,
  ILoggerService,
  IRandomService,
  IUIDecisionService,
  CardPlayOption,
  CardPlayResult,
} from './services.interface'

// ── AI 接口 ──
export type {
  AICardChoice,
  IAIDecisionMaker,
  AIPlayerConfig,
  AIDecisionLog,
} from './ai.interface'

export { AIDifficulty } from './ai.interface'
