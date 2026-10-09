// ============================================================
// 联盟杀 · 蜀国（Noxus）武将技能
//
// 包含：
//   刘备 — 仁德 (主动)
//   关羽 — 武圣 (视作)
//   张飞 — 咆哮 (锁定 / Mod)
//   赵云 — 龙胆 (视作)
//
// Phase 13 最大的变化在这里：**修改器类技能不该有 content**。
// 旧版咆哮挂在 `turnStart` 上把 `player.attackLimit` 改成 Infinity ——
// 那是一条真实存在的死路：`PhaseManager.getPlayableCards` 查的是
// `modQuery.cardUsable`，从来不看 `attackLimit`。也就是说
// 张飞在真实对局里一回合只能出一张杀，技能写了却没生效。
// 现在它写成 `mod.cardUsable`，与诸葛连弩走同一条管道。
// ============================================================

import { CardSuit, GamePhase } from '@core/contracts/enums'
import type { ISkill } from '@core/contracts/skill.interface'
import type { ICard } from '@core/contracts/card.interface'
import { CardTag } from '@core/contracts/card-tag'
import { viewLike } from '@core/skill/view-as'
import { Sha, Shan } from '@source/cards/basic'

/** 红色牌 = 红桃 / 方块 */
function isRed(card: ICard): boolean {
  return card.suit === CardSuit.Heart || card.suit === CardSuit.Diamond
}

// ═══════════════════════════════════════════
// 刘备 · 仁德
// 出牌阶段，你可以将任意张手牌交给其他角色。
// 当你于此阶段内以此法交出第二张手牌时，你回复1点体力。
// ═══════════════════════════════════════════

export const rende: ISkill = {
  id: 'rende',
  name: '仁德',
  description: '出牌阶段可将手牌交给其他角色；每阶段交出≥2张时回复1点体力。',

  priority: 10,
  frequency: 'oncePerTurn',
  enable: [GamePhase.PhaseUse],
  trigger: { player: ['phaseUseBegin'] },

  filter: (ctx) => ctx.player.alive && ctx.player.handCards.length > 0,

  /**
   * 标记本阶段可用
   *
   * 真正的「选牌 → 给谁」由 UI 驱动，`askForCardSelection` 之后
   * 再落成事件；这里只负责让界面知道这个技能此刻能点。
   */
  content: async (ctx) => {
    ctx.setMark(ctx.player, 'rendeAvailable', 1)
    ctx.setMark(ctx.player, 'rendePhaseActive', 1)
  },

  // 给牌是一眼能看懂的站队动作：身份还没亮的人（内奸、没翻面的反贼）
  // 用它等于自报家门。代价记在 `expose` 上，由 AI 在「要不要发动」
  // 时自己权衡——不是写死「不许用」。
  ai: { order: 5, expose: 2 },
}

// ═══════════════════════════════════════════
// 关羽 · 武圣
// 你可以将一张红色牌当【杀】使用或打出。
// ═══════════════════════════════════════════

export const wusheng: ISkill = {
  id: 'wusheng',
  name: '武圣',
  description: '你可以将一张红色牌当【杀】使用或打出。',

  // 「使用或打出」：出牌阶段能主动用，被要求出杀时也能拿来应答。
  // 两个场合都写在 `enable` 里，视作服务才会在这两处回答。
  enable: [GamePhase.PhaseUse, 'response'],

  // 手牌里的红色牌，任意张（发动一次视作一张）
  position: ['h'],
  selectCard: 1,

  filterCard: (card) => !card.tags.has(CardTag.Strike) && isRed(card),

  // `viewLike(Sha)` 而不是手写一个「像杀的对象」：id / type / tags /
  // effectIds 全部照抄【杀】的定义，于是内容分发、花色判定看到的
  // 就是【杀】本身。只写 `tags` 的话那张牌打出去了却 dispatch 不到
  // 杀的内容——它只是**名字像**杀的另一张牌。
  viewAs: (card) =>
    isRed(card)
      ? viewLike(Sha, {
          name: '杀（武圣）',
          description: `关羽将 ${card.name} 当【杀】使用`,
        })
      : null,

  ai: { order: 4, result: { target: (p, t) => (t.isWounded ? 2 : 1) } },
}

// ═══════════════════════════════════════════
// 张飞 · 咆哮
// 锁定技，你使用【杀】无次数限制。
// ═══════════════════════════════════════════

/**
 * 咆哮 —— 纯 Mod，没有 `content` 也不需要 `trigger`
 *
 * 「能不能出」不是某时机会发生的事，而是一个每次查询都要回答的数字：
 * 出牌阶段每次列可出的牌时都会问 `cardUsable`，它答 Infinity。
 *
 * 反过来写成「在某时机把某个字段改成 Infinity」，就得盼着那个字段
 * 正好落在 engine 这次会读的管道上——脆弱，而且错了还看不出来。
 */
export const paoxiao: ISkill = {
  id: 'paoxiao',
  name: '咆哮',
  description: '锁定技，你使用【杀】无次数限制。',

  locked: true,
  priority: 100,

  mod: {
    cardUsable: (value, _ctx, card) => (card.tags.has(CardTag.Strike) ? Infinity : value),
  },

  ai: { order: 8, threaten: 3 },
}

// ═══════════════════════════════════════════
// 赵云 · 龙胆
// 你可以将一张【杀】当【闪】使用或打出，
// 或将一张【闪】当【杀】使用或打出。
// ═══════════════════════════════════════════

export const longdan: ISkill = {
  id: 'longdan',
  name: '龙胆',
  description: '你可以将【杀】当【闪】、【闪】当【杀】使用或打出。',

  // 龙胆的价值几乎全在被【杀】指着的时候——出牌阶段「把闪当杀」
  // 远不如响应时「把杀当闪」常见，但两个场合都得能问到它。
  enable: [GamePhase.PhaseUse, 'response'],

  position: ['h'],
  selectCard: 1,

  filterCard: (card) => card.tags.has(CardTag.Strike) || card.tags.has(CardTag.Dodge),

  /**
   * 双面视作 —— 该给哪一面由 `ctx.usage` 决定
   *
   * 一张【杀】既是「出牌阶段可以打出去的杀」，也是「被杀时可以用来
   * 当闪的原料」。两面同时摆出来就乱了：出牌阶段会冒出一个「闪」
   * 选项，响应窗口会冒出一个「杀」选项——两条都是错的。
   *
   * 所以哪一面成立要看**此刻在问什么**：`response` 问的是闪那一面，
   * 出牌阶段问的是杀那一面。这正是 `IViewAsContext.usage` 存在的理由。
   */
  viewAs: (card, ctx) => {
    if (ctx.usage === 'response') {
      return card.tags.has(CardTag.Strike)
        ? viewLike(Shan, {
            name: '闪（龙胆）',
            description: `赵云将 ${card.name} 当【闪】使用`,
          })
        : null
    }
    return card.tags.has(CardTag.Dodge)
      ? viewLike(Sha, {
          name: '杀（龙胆）',
          description: `赵云将 ${card.name} 当【杀】使用`,
        })
      : null
  },

  ai: { order: 6 },
}

// ── 汇总导出 ──

export const shuSkills: ISkill[] = [rende, wusheng, paoxiao, longdan]
