// ============================================================
// 卡牌标签 —— 封闭集合
//
// 标签是「一张牌具备哪些语义」的声明，供引擎做规则判断（能否选为目标、
// 伤害属性、是否 AOE、能否用于响应等）。
//
// 规则：
// - 一律英文语义命名，禁止拼音（见 code-standards.md §6.1）
// - 引擎与内容层一律引用 `CardTag.X`，禁止硬编码字符串字面量
// ============================================================

export const CardTag = {
  // ── 类别 ──
  Basic: 'basic',
  Trick: 'trick',
  Equip: 'equip',
  /** 延时类锦囊（进入判定区） */
  Delayed: 'delayed',

  // ── 装备槽位 ──
  Weapon: 'weapon',
  Armor: 'armor',
  /** 进攻马（-1 马） */
  OffensiveHorse: 'offensiveHorse',
  /** 防御马（+1 马） */
  DefensiveHorse: 'defensiveHorse',
  Treasure: 'treasure',

  // ── 基本牌 ──
  /** 杀 */
  Strike: 'strike',
  /** 闪 */
  Dodge: 'dodge',
  /** 桃 */
  Heal: 'heal',
  /** 酒 */
  Wine: 'wine',

  // ── 锦囊：具体牌 ──
  /** 过河拆桥 */
  Dismantle: 'dismantle',
  /** 顺手牵羊 */
  Snatch: 'snatch',
  /** 无中生有 */
  SomethingFromNothing: 'somethingFromNothing',
  /** 南蛮入侵 */
  BarbarianRaid: 'barbarianRaid',
  /** 万箭齐发 */
  ArrowBarrage: 'arrowBarrage',
  /** 决斗 */
  Duel: 'duel',
  /** 无懈可击 */
  Counter: 'counter',
  /** 五谷丰登 */
  BountifulHarvest: 'bountifulHarvest',
  /** 桃园结义 */
  PeachGardenOath: 'peachGardenOath',
  /** 借刀杀人 */
  BorrowedBlade: 'borrowedBlade',
  /** 乐不思蜀 */
  SkipPlayPhase: 'skipPlayPhase',
  /** 兵粮寸断 */
  SkipDrawPhase: 'skipDrawPhase',
  /** 闪电 */
  Lightning: 'lightning',

  // ── 装备：具体牌 ──
  /** 诸葛连弩 */
  RepeatingCrossbow: 'repeatingCrossbow',
  /** 青釭剑 */
  BlueSteelBlade: 'blueSteelBlade',
  /** 雌雄双股剑 */
  TwinBlades: 'twinBlades',
  /** 丈八蛇矛 */
  SerpentSpear: 'serpentSpear',
  /** 贯石斧 */
  StoneAxe: 'stoneAxe',
  /** 八卦阵 */
  EightTrigrams: 'eightTrigrams',
  /** 仁王盾 */
  BenevolentShield: 'benevolentShield',
  /** 藤甲（火焰伤害 +1） */
  RattanArmor: 'rattanArmor',

  // ── 通用语义 ──
  /** 属于攻击类牌 */
  Attack: 'attack',
  /** 可用于响应 */
  Response: 'response',
  /** 造成伤害 */
  Damage: 'damage',
  /** 提供防御 */
  Defense: 'defense',
  /** 摸牌类效果 */
  Draw: 'draw',
  /** 增益类（如酒） */
  Boost: 'boost',
  /** 抵消类（无懈可击） */
  Cancel: 'cancel',
  /** 濒死可用 */
  Dying: 'dying',
  /** 群体效果 */
  Aoe: 'aoe',
  /** 影响所有角色 */
  All: 'all',
  /** 仅能以自己为目标 */
  SelfOnly: 'selfOnly',
  /** 跳过阶段 */
  SkipPhase: 'skipPhase',

  // ── 伤害属性 ──
  Fire: 'fire',
  Ice: 'ice',
  Thunder: 'thunder',
  Poison: 'poison',
} as const

/** 卡牌标签联合类型 */
export type CardTagValue = (typeof CardTag)[keyof typeof CardTag]
