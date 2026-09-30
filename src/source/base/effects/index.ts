// ============================================================
// 联盟杀 · 装备效果统一导出
//
// 这里只剩**装备的被动能力**（青釭剑无视防具、八卦阵判定出闪 …）。
// 它们回答「在某时机额外做什么」，是技能（Trigger），不是内容。
//
// 卡牌的**使用效果**已迁到 `source/base/contents/`（Phase 7）——
// 那里回答「这张牌本身做什么」。
//
// 装备带来的**数值改动**在 `../mods/equip-mods.ts`（攻击范围、距离、
// 出杀次数、火焰易伤）。二者不要互相越界。
//
// 挂载与卸载不用这里操心：`CardSystem.moveCard` 一发现装备区有变动
// 就通知 `SkillRegistry.syncEquipSkills`，由它按装备区现状挂上 / 摘掉。
// 数值（Mod）与触发（Trigger）因此同时跟着装卸走。
// ============================================================

export {
  zhuGeLianNu,
  qingGangJian,
  ciXiongShuangGuJian,
  zhangBaSheMao,
  guanShiFu,
  baGuaZhen,
  renWangDun,
  defensiveHorse,
  offensiveHorse,
  equipEffects,
} from './equip-effects'
