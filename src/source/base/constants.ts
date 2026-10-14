// ============================================================
// 联盟杀 · 游戏常量
// ============================================================

import { GamePhase } from '@core/contracts/enums'

// ── 卡牌与牌堆 ──

/** 标准牌堆总卡牌数 */
export const STANDARD_DECK_SIZE = 160

/** 初始手牌数（主公 +1） */
export const INITIAL_HAND_SIZE = 4

/** 摸牌阶段默认摸牌数 */
export const DEFAULT_DRAW_COUNT = 2

/** 手牌上限基数（= 当前体力值） */
export const HAND_LIMIT_BASE_HP = true

// ── 体力 ──

/** 默认体力上限 */
export const DEFAULT_MAX_HP = 4

/** 主公体力上限加成 */
export const LORD_HP_BONUS = 1

/** 体力上限最小值 */
export const MIN_HP = 0

/** 体力上限最大值 */
export const MAX_HP_CAP = 10

// ── 伤害 ──

/** 默认基础伤害值 */
export const DEFAULT_BASE_DAMAGE = 1

/** 酒加成伤害值 */
export const JIU_DAMAGE_BONUS = 1

// ── 距离与攻击 ──

/** 默认攻击范围（无武器时） */
export const DEFAULT_ATTACK_RANGE = 1

/** 默认每回合攻击次数上限 */
export const DEFAULT_ATTACK_LIMIT = 1

/** 进攻马（-1马）距离修正 */
export const OFFENSIVE_HORSE_BONUS = -1

/** 防御马（+1马）距离修正 */
export const DEFENSIVE_HORSE_BONUS = 1

// ── 回合与阶段 ──

/** 标准回合阶段顺序 */
export const STANDARD_PHASE_ORDER: GamePhase[] = [
  GamePhase.PhasePre,
  GamePhase.PhaseJudge,
  GamePhase.PhaseDraw,
  GamePhase.PhaseUse,
  GamePhase.PhaseDiscard,
  GamePhase.PhasePost,
]

/** 默认最大回合数（超过则平局） */
export const DEFAULT_MAX_ROUNDS = 100

// ── 身份 ──

/** 反贼死亡后击杀者摸牌数 */
export const REBEL_KILL_REWARD = 3

// ── 技能 ──

/** 技能嵌套最大深度（防止无限循环） */
export const MAX_SKILL_NEST_DEPTH = 20

/** 事件栈最大深度 */
export const MAX_EVENT_STACK_DEPTH = 50

// ── 响应与超时 ──

/** 玩家响应默认超时（毫秒） */
export const DEFAULT_RESPONSE_TIMEOUT = 30_000

/** AI 最小延迟（毫秒） */
export const AI_MIN_DELAY = 500

/** AI 最大延迟（毫秒） */
export const AI_MAX_DELAY = 2000

// ── 卡牌花色/点数分布（供 DeckManager 参考） ──

/** 标准牌堆中各卡牌类型的数量 */
export const STANDARD_DECK_COMPOSITION: Record<string, number> = {
  // 三种杀加起来仍是 30 张（原 `sha` 的总数），牌堆厚度不变
  sha: 22,
  huoSha: 5, // 火杀（藤甲 +1）
  leiSha: 3, // 雷杀
  shan: 15,
  tao: 8,
  jiu: 5,
  // 非延时锦囊
  guoHeChaiQiao: 4, // 过河拆桥
  shunShouQianYang: 3, // 顺手牵羊
  wuZhongShengYou: 4, // 无中生有
  nanManRuQin: 3, // 南蛮入侵
  wanJianQiFa: 1, // 万箭齐发
  jueDou: 3, // 决斗
  wuXieKeJi: 3, // 无懈可击
  wuGuFengDeng: 2, // 五谷丰登
  taoYuanJieYi: 1, // 桃园结义
  jieDaoShaRen: 2, // 借刀杀人
  // 延时锦囊
  leBuSiShu: 3, // 乐不思蜀
  bingLiangCunDuan: 2, // 兵粮寸断
  shanDian: 2, // 闪电
  // 装备
  zhuGeLianNu: 2, // 诸葛连弩
  qingGangJian: 1, // 青釭剑
  ciXiongShuangGuJian: 1, // 雌雄双股剑
  zhangBaSheMao: 1, // 丈八蛇矛
  guanShiFu: 1, // 贯石斧
  baGuaZhen: 2, // 八卦阵
  renWangDun: 1, // 仁王盾
  plusOneHorse: 3, // +1马
  minusOneHorse: 3, // -1马
}
