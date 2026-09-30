// ============================================================
// 联盟杀 · 标准版英雄数据
//
// 首批 10 名标准英雄，分布于三大势力：
//   Demacia / 魏 (4): 曹操、司马懿、夏侯惇、张辽
//   Noxus  / 蜀 (3): 刘备、关羽、张飞、赵云
//   Ionia  / 吴 (3): 孙权、吕蒙、黄月英
//
// 实际使用三国杀武将名称作为 ID 和数据基础。
// 技能本体在 `@source/heroes/skills/*`（按势力分文件），
// 由 `collectEffects()` 汇总后交给引擎注册。
// ============================================================

import { Kingdom } from '@core/contracts/enums'
import { Hero } from '@core/entity/hero'

// ── Demacia（魏 / 德玛西亚） ──

/** 曹操 — 魏武帝 · 奸雄/护驾 */
export const CaoCao: Hero = Hero.create({
  id: 'caocao',
  name: '曹操',
  title: '魏武帝',
  kingdom: Kingdom.Demacia,
  maxHp: 4,
  effectIds: ['jianxiong', 'hujia'],
})

/** 司马懿 — 狼顾之鬼 · 反馈/鬼才 */
export const SimaYi: Hero = Hero.create({
  id: 'simayi',
  name: '司马懿',
  title: '狼顾之鬼',
  kingdom: Kingdom.Demacia,
  maxHp: 3,
  effectIds: ['fankui', 'guicai'],
})

/** 夏侯惇 — 独目苍狼 · 刚烈 */
export const XiahouDun: Hero = Hero.create({
  id: 'xiahoudun',
  name: '夏侯惇',
  title: '独目苍狼',
  kingdom: Kingdom.Demacia,
  maxHp: 4,
  effectIds: ['ganglie'],
})

/** 张辽 — 前将军 · 突袭 */
export const ZhangLiao: Hero = Hero.create({
  id: 'zhangliao',
  name: '张辽',
  title: '前将军',
  kingdom: Kingdom.Demacia,
  maxHp: 4,
  effectIds: ['tuxi'],
})

// ── Noxus（蜀 / 诺克萨斯） ──

/** 刘备 — 蜀汉先主 · 仁德 */
export const LiuBei: Hero = Hero.create({
  id: 'liubei',
  name: '刘备',
  title: '蜀汉先主',
  kingdom: Kingdom.Noxus,
  maxHp: 4,
  effectIds: ['rende'],
})

/** 关羽 — 武圣 · 武圣 */
export const GuanYu: Hero = Hero.create({
  id: 'guanyu',
  name: '关羽',
  title: '武圣',
  kingdom: Kingdom.Noxus,
  maxHp: 4,
  effectIds: ['wusheng'],
})

/** 张飞 — 万夫莫敌 · 咆哮 */
export const ZhangFei: Hero = Hero.create({
  id: 'zhangfei',
  name: '张飞',
  title: '万夫莫敌',
  kingdom: Kingdom.Noxus,
  maxHp: 4,
  effectIds: ['paoxiao'],
})

/** 赵云 — 常山赵子龙 · 龙胆 */
export const ZhaoYun: Hero = Hero.create({
  id: 'zhaoyun',
  name: '赵云',
  title: '常山赵子龙',
  kingdom: Kingdom.Noxus,
  maxHp: 4,
  effectIds: ['longdan'],
})

// ── Ionia（吴 / 艾欧尼亚） ──

/** 孙权 — 紫髯碧眼 · 制衡 */
export const SunQuan: Hero = Hero.create({
  id: 'sunquan',
  name: '孙权',
  title: '紫髯碧眼',
  kingdom: Kingdom.Ionia,
  maxHp: 4,
  effectIds: ['zhiheng'],
})

/** 吕蒙 — 白衣渡江 · 克己 */
export const LvMeng: Hero = Hero.create({
  id: 'lvmeng',
  name: '吕蒙',
  title: '白衣渡江',
  kingdom: Kingdom.Ionia,
  maxHp: 4,
  effectIds: ['keji'],
})

// ── 汇总导出 ──

/** 标准版全部英雄 */
export const standardHeroes: Hero[] = [
  // Demacia
  CaoCao,
  SimaYi,
  XiahouDun,
  ZhangLiao,
  // Noxus
  LiuBei,
  GuanYu,
  ZhangFei,
  ZhaoYun,
  // Ionia
  SunQuan,
  LvMeng,
]

/** 按势力分组的英雄 */
export const heroesByKingdom: Record<Kingdom, Hero[]> = {
  [Kingdom.Demacia]: [CaoCao, SimaYi, XiahouDun, ZhangLiao],
  [Kingdom.Noxus]: [LiuBei, GuanYu, ZhangFei, ZhaoYun],
  [Kingdom.Ionia]: [SunQuan, LvMeng],
}
