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

// ── 事件命名 ──
export {
  POINT_EVENT_NAMES,
  EVENT_SUBJECTS,
  EVENT_STAGE_SUFFIXES,
  isPointEvent,
  isBuiltinEventName,
  eventNameAtStage,
  matchesEventName,
} from './event-name'
export type {
  EventName,
  BuiltinEventName,
  PointEventName,
  EventSubject,
  EventStageSuffix,
} from './event-name'

// ── 事件接口 ──
export type {
  EventValues,
  EventResult,
  EventStepHandler,
  GameEventInit,
  IEventRunner,
  IGameEvent,
  IEventContext,
  TriggerScope,
} from './event.interface'

// ── Mod（数值 / 布尔修改器）──
export type {
  DamageModPayload,
  ModContext,
  NumericModArgsMap,
  BooleanModArgsMap,
  NumericMod,
  BooleanMod,
  INumericMods,
  IBooleanMods,
  IModDefinition,
  IModRegistry,
  IModQuery,
} from './mod.interface'

// ── 卡牌接口 ──
export type { ICard, CardDefinition } from './card.interface'
export { CardTag } from './card-tag'
export type { CardTagValue } from './card-tag'

// ── 玩家接口 ──
export type { IPlayer, PlayerState, PlayerSnapshot } from './player.interface'

// ── 英雄接口 ──
export type { IHero } from './hero.interface'

// ── 技能接口（Phase 13 起的新契约）──
export type {
  SkillEnableContext,
  SkillFrequency,
  SkillPosition,
  SkillSelectCount,
  ISkillTriggerCondition,
  ResponseRequest,
  EffectResponse,
  ISkillContext,
  ISkillIntro,
  ISkillResult,
  ISkillAi,
  ISkill,
  TempSkillDuration,
  ISkillRegistry,
  IViewAsContext,
  IViewAsService,
  ICardView,
  CardViewQuery,
} from './skill.interface'

// ── 旧效果别名（已废弃，指向上面的新契约）──
export type { ITriggerCondition, IEffectContext, IEffect } from './effect.interface'

// ── 游戏接口 ──
export type {
  IGameConfig,
  IGameState,
  GameStateSnapshot,
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
