// ============================================================
// 联盟杀 · 基础枚举与常量定义
// ============================================================

/**
 * 卡牌花色
 */
export enum CardSuit {
  Spade = 'spade',
  Heart = 'heart',
  Club = 'club',
  Diamond = 'diamond',
  None = 'none',
}

/**
 * 卡牌大类
 */
export enum CardType {
  Basic = 'basic',
  Rune = 'rune',
  Talent = 'talent',
  Equip = 'equip',
}

/**
 * 卡牌所在区域
 */
export enum ZoneType {
  Deck = 'deck',
  Hand = 'hand',
  Equip = 'equip',
  Judge = 'judge',
  Discard = 'discard',
  Processing = 'processing',
}

/**
 * 卡牌点数（A–K）
 *
 * 与标准扑克牌点数对应：
 * - 1  = A (Ace)
 * - 11 = J (Jack)
 * - 12 = Q (Queen)
 * - 13 = K (King)
 */
export enum CardRank {
  A = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  J = 11,
  Q = 12,
  K = 13,
}

/**
 * 游戏阶段（全生命周期）
 *
 * 涵盖从游戏准备到结束的全部阶段。
 * 不同于仅包含回合内阶段的旧 PhaseType。
 */
export enum GamePhase {
  NotStarted = 'notStarted',     // 未开始
  Prepare = 'prepare',           // 游戏准备（选将、发牌）
  RoundStart = 'roundStart',     // 轮次开始
  PhasePre = 'phasePre',         // 回合准备阶段
  PhaseJudge = 'phaseJudge',     // 判定阶段
  PhaseDraw = 'phaseDraw',       // 摸牌阶段
  PhaseUse = 'phaseUse',         // 出牌阶段
  PhaseDiscard = 'phaseDiscard', // 弃牌阶段
  PhasePost = 'phasePost',       // 回合结束阶段
  RoundEnd = 'roundEnd',         // 轮次结束
  GameOver = 'gameOver',         // 游戏结束
}

/**
 * 触发阶段（相对于事件流水线的位置）
 *
 * TriggerStage 是 EventStatus 中「可以作为技能触发点」的子集。
 * 每个 TriggerStage 直接映射到同名 EventStatus 枚举值，
 * 并通过 `contracts/event-name.ts` 的 STAGE_SUFFIX 映射为事件名后缀。
 *
 * 事件主体（damage / useCard / phaseUse ...）见 `contracts/event-name.ts`，
 * 事件名 = 主体 + 阶段后缀。不再使用枚举表达时机 —— 时机是可扩展的字符串。
 *
 * 不可作为触发点的 EventStatus：
 * - Waiting / SkipCheck / Cancelled / Prevented / Completed
 *   → 这些是事件内部流转状态，技能不应挂载钩子。
 *
 * 映射关系与典型用法：
 * | TriggerStage | EventStatus  | 三国杀典型示例                     |
 * |------------|-------------|----------------------------------|
 * | Before     | Before      | "当你使用杀时"（卡牌生效前）        |
 * | Begin      | Begin       | "回合开始时"、"出牌阶段开始时"      |
 * | Prepare    | Prepare     | "指定目标后"（目标合法性校验完毕）   |
 * | Content    | Content     | "当你造成伤害时"（事件核心执行中）   |
 * | Prevent    | Prevent     | "当你受到伤害时"（响应窗口/伤害预防）|
 * | End        | End         | "使用杀结算完毕后"                  |
 * | After      | After       | "当你造成伤害后"、"当你受到伤害后"   |
 */
export type TriggerStage =
  | 'Before'
  | 'Begin'
  | 'Prepare'
  | 'Content'
  | 'Prevent'
  | 'End'
  | 'After'

/**
 * 技能类型
 */
export enum SkillType {
  Active = 'active',
  Passive = 'passive',
  Locked = 'locked',
  Limited = 'limited',
  Awaken = 'awaken',
}

/**
 * 身份 / 角色
 */
export enum RoleType {
  Aspect = 'aspect',
  Guardian = 'guardian',
  Ascended = 'ascended',
  Infiltrator = 'infiltrator',
}

/**
 * 事件流水线状态
 *
 * WAITING → SKIP_CHECK → (CANCELLED) → BEFORE → BEGIN
 *   → PREPARE → CONTENT → PREVENT → (PREVENTED) → END → AFTER → COMPLETED
 */
export enum EventStatus {
  Waiting = 'waiting',
  SkipCheck = 'skipCheck',
  Cancelled = 'cancelled',
  Before = 'before',
  Begin = 'begin',
  Prepare = 'prepare',
  Content = 'content',
  Prevent = 'prevent',
  Prevented = 'prevented',
  End = 'end',
  After = 'after',
  Completed = 'completed',
}

/**
 * 装备槽位
 *
 * 标准三国杀装备区共 5 个槽位：
 * - 武器：影响攻击范围
 * - 防具：提供防御效果
 * - 进攻马（-1 马）：计算与其他角色距离时 -1
 * - 防御马（+1 马）：其他角色计算与你距离时 +1
 * - 宝物：特殊装备（部分版本）
 */
export enum EquipSlot {
  Weapon = 'weapon',
  Armor = 'armor',
  OffensiveHorse = 'offensiveHorse',
  DefensiveHorse = 'defensiveHorse',
  Treasure = 'treasure',
}

/**
 * 势力
 */
export enum Kingdom {
  Demacia = 'demacia',
  Noxus = 'noxus',
  Ionia = 'ionia',
}

/**
 * 伤害属性
 */
export enum DamageType {
  Normal = 'normal',
  Fire = 'fire',
  Thunder = 'thunder',
  Ice = 'ice',
  Poison = 'poison',
}

/**
 * 技能发动频率
 */
export enum Frequency {
  Once = 'once',
  Unlimited = 'unlimited',
  OncePerTurn = 'oncePerTurn',
  OncePerRound = 'oncePerRound',
}

/**
 * 日志级别
 */
export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}
