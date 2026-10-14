// ============================================================
// 联盟杀 · LOL 换皮映射（欠账 D27）
//
// 引擎内部一律用**稳定 ID**（`sha` / `caocao` / `jianxiong`），
// 换皮只在**展示层**发生：把 ID 换成 LOL 的名字，规则和判定一个字都不动。
//
// 这个文件是「ID → LOL 名称」的**唯一答案**：
//
//   - 卡牌定义（`source/cards/*.ts`）、英雄定义、技能定义**保持三国杀名字不变**——
//     它们是引擎的数据，改了就等于让规则层背上一套皮肤。
//   - 展示层（组件 / Hook / Store 的派生值）从这里取名字，取不到就用原名兜底。
//
// 每条映射都留着 `sgs`（原来的三国杀名字），用途有两个：
//
//   1. 这张表自己就是一份「谁换成了谁」的对照表，不用再去翻定义文件。
//   2. 引擎递过来的**提问文案**是一整句中文（「南蛮入侵：是否出杀？」），
//      里面有牌名。要把它们也换掉，就得能从「原名」反查到「新名」。
//      反查靠的就是 `sgs`，而不是在展示层另抄一份牌名对照。
//
// `sgs` 与定义文件里的 `name` 必须一致 —— 一致性由测试盯着
// （`src/__tests__/ui/lol-theme.test.ts`）：定义里改名了，这里必须跟着改。
// ============================================================

/** 卡牌换皮 */
export interface LolCardTheme {
  /** 原（三国杀）牌名 —— 反查用，必须与卡牌定义的 `name` 一致 */
  sgs: string
  /** LOL 牌名 */
  name: string
  /** LOL 风味描述 */
  description: string
}

/** 英雄换皮 */
export interface LolHeroTheme {
  /** 原（三国杀）姓名 */
  sgs: string
  /** LOL 英雄名 */
  name: string
  /** LOL 称号 */
  title: string
  /** 一句风味描述 */
  flavor: string
}

/** 技能换皮 */
export interface LolSkillTheme {
  /** 原（三国杀）技能名 */
  sgs: string
  /** LOL 技能名 */
  name: string
}

// ── 基本牌 ──

export const LOL_CARD_THEMES: Readonly<Record<string, LolCardTheme>> = {
  sha: {
    sgs: '杀',
    name: '致命打击',
    description: '对攻击范围内的一名敌方英雄造成 1 点伤害，可被【闪现】规避',
  },
  huoSha: {
    sgs: '火杀',
    name: '燃焰打击',
    description: '带火焰属性的【致命打击】——防火装备挡不住，藤甲式的护甲反而会灼伤更重',
  },
  leiSha: {
    sgs: '雷杀',
    name: '雷霆打击',
    description: '带雷电属性的【致命打击】——伤害属性与【闪现】无关，只影响藤甲这类属性护甲',
  },
  shan: {
    sgs: '闪',
    name: '闪现',
    description: '瞬间位移，抵消一次【致命打击】或【箭雨】',
  },
  tao: {
    sgs: '桃',
    name: '治疗术',
    description: '回复 1 点生命值；濒死时可用于抢救自己或队友',
  },
  jiu: {
    sgs: '酒',
    name: '狂怒药剂',
    description: '出牌阶段饮用后，本回合下一张【致命打击】伤害 +1；濒死时饮用则回复 1 点生命',
  },

  // ── 锦囊 ──
  guoHeChaiQiao: {
    sgs: '过河拆桥',
    name: '破败之刃',
    description: '摧毁目标英雄区域内的一张牌（手牌、装备或判定）',
  },
  shunShouQianYang: {
    sgs: '顺手牵羊',
    name: '掠夺',
    description: '夺取距离 1 以内一名英雄区域内的一张牌',
  },
  wuZhongShengYou: {
    sgs: '无中生有',
    name: '补给箱',
    description: '开启补给，立刻摸 2 张牌',
  },
  nanManRuQin: {
    sgs: '南蛮入侵',
    name: '军团冲锋',
    description: '所有其他英雄各需打出一张【致命打击】，否则受到你造成的 1 点伤害',
  },
  wanJianQiFa: {
    sgs: '万箭齐发',
    name: '箭雨',
    description: '所有其他英雄各需打出一张【闪现】，否则受到你造成的 1 点伤害',
  },
  jueDou: {
    sgs: '决斗',
    name: '生死决斗',
    description: '与一名英雄正面对决：轮流出【致命打击】，先不出者受到对方造成的 1 点伤害',
  },
  wuXieKeJi: {
    sgs: '无懈可击',
    name: '法术护盾',
    description: '抵消一张锦囊牌的效果',
  },
  wuGuFengDeng: {
    sgs: '五谷丰登',
    name: '战利品分配',
    description: '亮出等同于存活英雄数的牌，从当前回合英雄开始依次各选一张',
  },
  taoYuanJieYi: {
    sgs: '桃园结义',
    name: '圣光祝福',
    description: '所有英雄各回复 1 点生命值',
  },
  jieDaoShaRen: {
    sgs: '借刀杀人',
    name: '幕后操控',
    description: '令一名装备武器的英雄对其攻击范围内你指定的英雄出【致命打击】，否则将其武器交给你',
  },
  leBuSiShu: {
    sgs: '乐不思蜀',
    name: '压制',
    description: '延时：判定阶段判定，若结果不为红桃，则跳过出牌阶段',
  },
  bingLiangCunDuan: {
    sgs: '兵粮寸断',
    name: '补给封锁',
    description: '延时：判定阶段判定，若结果不为梅花，则跳过摸牌阶段',
  },
  shanDian: {
    sgs: '闪电',
    name: '天罚雷霆',
    description: '延时：判定阶段判定，若结果为黑桃 2–9，则受到 3 点雷电伤害，否则移至下家判定区',
  },

  // ── 装备 ──
  zhuGeLianNu: {
    sgs: '诸葛连弩',
    name: '疾射火炮',
    description: '攻击范围 1。出牌阶段可以打出任意张【致命打击】',
  },
  qingGangJian: {
    sgs: '青釭剑',
    name: '最后的轻语',
    description: '攻击范围 2。出【致命打击】时无视目标防具',
  },
  ciXiongShuangGuJian: {
    sgs: '雌雄双股剑',
    name: '双生之刃',
    description: '攻击范围 2。对异性英雄出【致命打击】时，目标需弃一张牌，否则你摸一张牌',
  },
  zhangBaSheMao: {
    sgs: '丈八蛇矛',
    name: '巨蛇长矛',
    description: '攻击范围 3。可将 2 张手牌当作【致命打击】打出',
  },
  guanShiFu: {
    sgs: '贯石斧',
    name: '黑色切割者',
    description: '攻击范围 3。【致命打击】被【闪现】抵消后，可弃 2 张牌强制造成伤害',
  },
  baGuaZhen: {
    sgs: '八卦阵',
    name: '守护天使',
    description: '需要打出【闪现】时可以判定，若结果为红色则视为打出了【闪现】',
  },
  renWangDun: {
    sgs: '仁王盾',
    name: '女妖面纱',
    description: '黑色【致命打击】对你无效',
  },
  tengJia: {
    sgs: '藤甲',
    name: '日炎斗篷',
    description: '防具。你受到的火焰伤害 +1',
  },
  plusOneHorse: {
    sgs: '+1马',
    name: '疾行之靴',
    description: '其他英雄计算与你的距离时 +1',
  },
  minusOneHorse: {
    sgs: '-1马',
    name: '幽灵疾步',
    description: '你计算与其他英雄的距离时 -1',
  },
}

// ── 英雄：势力（魏 / 蜀 / 吴）已经分别是 Demacia / Noxus / Ionia ──

export const LOL_HERO_THEMES: Readonly<Record<string, LolHeroTheme>> = {
  caocao: {
    sgs: '曹操',
    name: '盖伦',
    title: '德玛西亚之力',
    flavor: '一个人扛起整支军队的男人：受的伤越多，还手越狠',
  },
  simayi: {
    sgs: '司马懿',
    name: '拉克丝',
    title: '光辉女郎',
    flavor: '光是她的语言——先束缚，再引爆，最后把战场照得通明',
  },
  xiahoudun: {
    sgs: '夏侯惇',
    name: '菲奥娜',
    title: '无双剑姬',
    flavor: '独目也能看清破绽，你砍我一刀，我还你一剑',
  },
  zhangliao: {
    sgs: '张辽',
    name: '赵信',
    title: '德邦总管',
    flavor: '一声令下便直取中军，从不给对手喘息的机会',
  },
  liubei: {
    sgs: '刘备',
    name: '斯维因',
    title: '诺克萨斯统领',
    flavor: '以谋略统御帝国：把手里的牌分给值得的人，换回整片疆土',
  },
  guanyu: {
    sgs: '关羽',
    name: '德莱厄斯',
    title: '诺克萨斯之手',
    flavor: '一柄巨斧走天下，凡挡路者，皆以断头台论处',
  },
  zhangfei: {
    sgs: '张飞',
    name: '德莱文',
    title: '荣耀行刑官',
    flavor: '飞斧不停、喝彩不断，出手越多越兴奋',
  },
  zhaoyun: {
    sgs: '赵云',
    name: '锐雯',
    title: '放逐之刃',
    flavor: '进可破阵、退可护身，一柄断刃攻守皆宜',
  },
  sunquan: {
    sgs: '孙权',
    name: '艾瑞莉娅',
    title: '刀锋舞者',
    flavor: '在攻与守之间不断取舍，每一次换牌都换来更好的局面',
  },
  lvmeng: {
    sgs: '吕蒙',
    name: '慎',
    title: '暮光之眼',
    flavor: '收敛锋芒、静待时机，忍到最后一刻才出手',
  },
  huangyueying: {
    sgs: '黄月英',
    name: '卡尔玛',
    title: '天启者',
    flavor: '工巧之心全用在锦囊上，每出一计，随手便又取一计',
  },
}

// ── 技能：三国杀技能名 → LOL 英雄的技能名 ──

export const LOL_SKILL_THEMES: Readonly<Record<string, LolSkillTheme>> = {
  jianxiong: { sgs: '奸雄', name: '德玛西亚正义' },
  hujia: { sgs: '护驾', name: '勇气' },
  fankui: { sgs: '反馈', name: '光之束缚' },
  guicai: { sgs: '鬼才', name: '透光奇点' },
  ganglie: { sgs: '刚烈', name: '夺命连刺' },
  tuxi: { sgs: '突袭', name: '无畏冲锋' },
  rende: { sgs: '仁德', name: '帝国视界' },
  wusheng: { sgs: '武圣', name: '诺克萨斯断头台' },
  paoxiao: { sgs: '咆哮', name: '旋转飞斧' },
  longdan: { sgs: '龙胆', name: '剑刃护壁' },
  zhiheng: { sgs: '制衡', name: '均衡打击' },
  keji: { sgs: '克己', name: '气合盾' },
  jizhi: { sgs: '集智', name: '灵光乍现' },
  qicai: { sgs: '奇才', name: '天启之咒' },
}

/**
 * 提问文案的整句替换表
 *
 * 引擎递过来的文案是一整句中文（「万箭齐发：是否出闪？」），
 * 里面既没有 ID 也没有统一的模板，只能整句换。
 * 换不了的（比如新加的牌）走下面的【】反查，再不行就原样显示。
 */
export const LOL_PROMPT_THEMES: Readonly<Record<string, string>> = {
  '是否出闪？': '是否打出【闪现】？',
  '南蛮入侵：是否出杀？': '军团冲锋：是否打出【致命打击】？',
  '万箭齐发：是否出闪？': '箭雨：是否打出【闪现】？',
  '决斗：是否出杀？': '生死决斗：是否打出【致命打击】？',
  '五谷丰登：选择一张牌': '战利品分配：选择一张牌',
}

/** 按原牌名反查换皮（供提问文案里的【】替换用） */
const CARD_THEME_BY_SGS: ReadonlyMap<string, LolCardTheme> = new Map(
  Object.values(LOL_CARD_THEMES).map((theme) => [theme.sgs, theme]),
)

/** 文案里写成【××】的牌名 */
const BRACKETED_CARD_NAME = /【([^】]+)】/g

// ── 展示层查名口 ──
//
// 全部「取不到就用原名兜底」：换皮是皮肤，缺一块不该让界面显示空白。

/**
 * 引擎文案里的**名字占位符**
 *
 * 引擎拼的整句（日志 / 提问 / 拒绝原因）里带着名字，而换皮表在展示层，
 * 引擎拿不到它——于是引擎改记占位符，把 ID 写在句子里（欠账 D40）。
 * 这里是**唯一**把它们换回名字的地方：日志进 `logStore` 的那一刻，
 * 提问文案进响应窗口的那一刻。
 *
 * 占位符带 ID 而不是「第几个人」，因此它穿过「引擎 → 决策服务 → 弹窗」
 * 这条只传字符串的管道之后，信息依然完整，不必再配一份结构化字段。
 */
const NAME_SLOT = /\{(hero|card):([^}]*)\}/g

/**
 * 把占位符换成人名 / 牌名
 *
 * 查不到换皮就退回 ID——换皮表被 `lol-theme.test.ts` 盯着必须盖满全部定义，
 * 因此退回分支只在「这个 id 压根不是英雄也不是卡牌」时出现
 * （比如没有英雄的座位，塞进去的本来就是座位 id）。
 */
export function resolveNameSlots(text: string): string {
  return text.replace(NAME_SLOT, (matched, kind: string, id: string) => {
    if (kind === 'hero') return lolHeroName(id, id)
    if (kind === 'card') return lolCardName(id, id)
    return matched
  })
}

/** 卡牌显示名 */
export function lolCardName(id: string, fallback: string): string {
  return LOL_CARD_THEMES[id]?.name ?? fallback
}

/** 卡牌显示描述 */
export function lolCardDescription(id: string, fallback: string): string {
  return LOL_CARD_THEMES[id]?.description ?? fallback
}

/** 英雄显示名 */
export function lolHeroName(id: string, fallback: string): string {
  return LOL_HERO_THEMES[id]?.name ?? fallback
}

/** 英雄显示称号 */
export function lolHeroTitle(id: string, fallback: string): string {
  return LOL_HERO_THEMES[id]?.title ?? fallback
}

/** 技能显示名 */
export function lolSkillName(id: string, fallback: string): string {
  return LOL_SKILL_THEMES[id]?.name ?? fallback
}

/**
 * 提问文案的显示文本
 *
 * 先整句查表，再把剩下的【××】按牌名反查替换掉
 * ——「是否使用【无懈可击】？」这类带前缀的文案就是这么换的。
 *
 * 中间还有一步：占位符先换成名字（欠账 D40）。顺序不能倒——
 * 占位符里可能就是个牌名 id，换出来的人名 / 牌名才轮到【】反查。
 */
export function lolPromptText(prompt: string): string {
  const whole = LOL_PROMPT_THEMES[prompt]
  if (whole) return whole

  return resolveNameSlots(prompt).replace(
    BRACKETED_CARD_NAME,
    (matched, inner: string) => {
      const theme = CARD_THEME_BY_SGS.get(inner)
      return theme ? `【${theme.name}】` : matched
    },
  )
}
