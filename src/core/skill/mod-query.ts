// ============================================================
// 联盟杀 · ModQuery — Mod 查询门面
//
// 注册表（ModRegistry）只提供「键 → 一串钩子」这种裸能力；
// 谁该当查询主体、base 是多少、几个钩子按什么顺序串起来，
// 这些**语义**属于本文件。
//
// 业务代码（EffectContext、DistanceSystem、PhaseManager …）
// 只认识 `IModQuery`，不直接摸注册表。
// ============================================================

import { DamageType } from '@core/contracts/enums'
import type {
  IModQuery,
  IModRegistry,
  DamageModPayload,
  ModContext,
} from '@core/contracts/mod.interface'
import type { IGameState } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ICard } from '@core/contracts/card.interface'
import type { IGameEvent } from '@core/contracts/event.interface'
import { CardTag } from '@core/contracts/card-tag'
import { DistanceSystem } from '@core/system/distance-system'
import { DEFAULT_DRAW_COUNT } from '@source/base/constants'

/** 攻击范围的基础值（赤手空拳够得着邻座） */
export const BASE_ATTACK_RANGE = 1

/**
 * 卡牌本回合可使用次数的默认值
 *
 * 杀一回合一张，其余无限。这是**规则**，不是 Mod——之所以放在这里是
 * 因为 nobody else 需要一个「默认卡使用次数」的概念；谁都能 `cardUsableOf`
 * 时传自己的 base 覆盖它。
 */
export function defaultCardUsable(card: ICard): number {
  return card.tags.has(CardTag.Strike) ? 1 : Infinity
}

/**
 * Mod 查询门面
 *
 * 每个方法做的事情都一样：构造上下文 → 问注册表 → 返回值。
 * 差别只在「谁是主体」和「base 是多少」——那正是规则本身。
 */
export class ModQuery implements IModQuery {
  constructor(
    private state: IGameState,
    private registry: IModRegistry,
  ) {}

  // ── 伤害 ──

  /**
   * 一次伤害的总管道
   *
   * 四个钩子依次作用（每一步看到的都是上一步的结果）：
   *   1. globalDamageFrom —— 任何人造成的伤害
   *   2. damageFrom       —— 来源方自己的加成／减免
   *   3. globalDamageTo   —— 任何人受到的伤害
   *   4. damageTo         —— 受伤方自己的易伤／抗性（藤甲、白银狮子…）
   *
   * 之所以把「来源」和「受伤方」分开两次查询，是为了让
   * `ctx.player` 在每个钩子里都等于「这次看的那一方」——
   * 否则 Mod 作者就得自己去解构 payload 猜「我」是谁。
   */
  damage(
    base: number,
    source: IPlayer | undefined,
    target: IPlayer,
    card: ICard | undefined,
    nature: DamageType = DamageType.Normal,
    event?: IGameEvent,
  ): number {
    const payload: DamageModPayload = { source, target, card, nature }

    let value = base
    const holder = source ?? target

    value = this.registry.queryNumeric(
      'globalDamageFrom',
      value,
      this.context(holder, event, payload),
      payload,
    )
    if (source) {
      value = this.registry.queryNumeric(
        'damageFrom',
        value,
        this.context(source, event, payload),
        payload,
      )
    }

    value = this.registry.queryNumeric(
      'globalDamageTo',
      value,
      this.context(target, event, payload),
      payload,
    )
    value = this.registry.queryNumeric(
      'damageTo',
      value,
      this.context(target, event, payload),
      payload,
    )

    return value
  }

  // ── 距离与范围 ──

  /** 攻击范围：base 1 起算（武器 Mod 往上加） */
  attackRange(player: IPlayer, event?: IGameEvent): number {
    return this.registry.queryNumeric(
      'attackRange',
      BASE_ATTACK_RANGE,
      this.context(player, event),
    )
  }

  /**
   * 两点实际距离 —— 座次距离经两侧 Mod 修正后的结果
   *
   * `card` 是「这次为什么要算距离」的那张牌：**只有带着它**，
   * 「使用锦囊无距离限制」这类技能才写得出来（否则 Mod 只能无条件改距离，
   * 把【杀】的范围也一起放开）。不带牌的场合（问「两人隔多远」）
   * 就是裸距离，Mod 收到的 `card` 为 undefined。
   */
  distance(from: IPlayer, to: IPlayer, card?: ICard): number {
    return DistanceSystem.getDistance(from, to, this.state.players, this, card)
  }

  /** 目标是否在我的攻击范围内（`card` 同上，给按牌型改范围的技能用） */
  inRange(from: IPlayer, to: IPlayer, card?: ICard): boolean {
    return DistanceSystem.isInRange(from, to, this.state.players, this, card)
  }

  // ── DistanceSystem 的回调入口 ──
  //
  // `DistanceMods` 要求的三个方法名带 `Of` 后缀——它们与上面的
  // `attackRange(player, event?)` 语义相同，只是不收 `event`。
  // 分开命名是为了保住调用方可读性：人写 SDK 时想着「范围」，
  // 系统回调时想着「把 Mod 结果给我」。
  //
  // 距离这两个额外收 `card`：它是「这次算距离为了打哪张牌」，
  // 【奇才】这类按牌型豁免距离的技能就靠它（欠账 D43）。

  /** @see DistanceMods.attackRangeOf */
  attackRangeOf(player: IPlayer, base: number): number {
    return this.registry.queryNumeric('attackRange', base, this.context(player))
  }

  /** @see DistanceMods.distanceFromOf */
  distanceFromOf(from: IPlayer, to: IPlayer, base: number, card?: ICard): number {
    return this.registry.queryNumeric('distanceFrom', base, this.context(from), to, card)
  }

  /** @see DistanceMods.distanceToOf */
  distanceToOf(to: IPlayer, from: IPlayer, base: number, card?: ICard): number {
    return this.registry.queryNumeric('distanceTo', base, this.context(to), from, card)
  }

  // ── 回合数值 ──

  /** 手牌上限：base 为当前体力 */
  maxHandcard(player: IPlayer, event?: IGameEvent): number {
    return this.registry.queryNumeric(
      'maxHandcard',
      player.hp,
      this.context(player, event),
    )
  }

  /** 体力上限：base 为玩家实体上的上限 */
  maxHp(player: IPlayer, event?: IGameEvent): number {
    return this.registry.queryNumeric('maxHp', player.maxHp, this.context(player, event))
  }

  /** 摸牌阶段的摸牌数 */
  drawCount(player: IPlayer, event?: IGameEvent): number {
    return this.registry.queryNumeric(
      'drawCount',
      DEFAULT_DRAW_COUNT,
      this.context(player, event),
    )
  }

  /** 一张牌本回合还能用几次（`Infinity` = 无限） */
  cardUsable(player: IPlayer, card: ICard, base?: number, event?: IGameEvent): number {
    const from = base ?? defaultCardUsable(card)
    return this.registry.queryNumeric('cardUsable', from, this.context(player, event), card)
  }

  /** 一张牌能选几个目标 */
  selectTarget(player: IPlayer, card: ICard, base: number, event?: IGameEvent): number {
    return this.registry.queryNumeric(
      'selectTarget',
      base,
      this.context(player, event),
      card,
    )
  }

  // ── 布尔否决 ──

  cardEnabled(player: IPlayer, card: ICard, event?: IGameEvent): boolean {
    return this.registry.queryBoolean('cardEnabled', true, this.context(player, event), card)
  }
  cardRespondable(player: IPlayer, card: ICard, event?: IGameEvent): boolean {
    return this.registry.queryBoolean(
      'cardRespondable',
      true,
      this.context(player, event),
      card,
    )
  }
  cardSavable(player: IPlayer, card: ICard, event?: IGameEvent): boolean {
    return this.registry.queryBoolean('cardSavable', true, this.context(player, event), card)
  }
  cardDiscardable(player: IPlayer, card: ICard, event?: IGameEvent): boolean {
    return this.registry.queryBoolean(
      'cardDiscardable',
      true,
      this.context(player, event),
      card,
    )
  }
  /** 这张牌能否被无懈可击（验收清单 #13 的落点） */
  cardCancelable(player: IPlayer, card: ICard, event?: IGameEvent): boolean {
    return this.registry.queryBoolean('cardCancelable', true, this.context(player, event), card)
  }
  targetEnabled(
    player: IPlayer,
    card: ICard,
    target: IPlayer,
    event?: IGameEvent,
  ): boolean {
    return this.registry.queryBoolean(
      'targetEnabled',
      true,
      this.context(player, event),
      card,
      target,
    )
  }
  targetInRange(
    player: IPlayer,
    card: ICard,
    target: IPlayer,
    event?: IGameEvent,
  ): boolean {
    return this.registry.queryBoolean(
      'targetInRange',
      true,
      this.context(player, event),
      card,
      target,
    )
  }
  skillEnabled(player: IPlayer, skillId: string, event?: IGameEvent): boolean {
    return this.registry.queryBoolean(
      'skillEnabled',
      true,
      this.context(player, event),
      skillId,
    )
  }
  phaseSkippable(
    player: IPlayer,
    phase: Parameters<IModQuery['phaseSkippable']>[1],
    event?: IGameEvent,
  ): boolean {
    return this.registry.queryBoolean(
      'phaseSkippable',
      true,
      this.context(player, event),
      phase,
    )
  }

  // ── TargetSystem 的回调入口 ──
  //
  // 与 `DistanceMods` 同理：`TargetMods` 只要求「这次的目标放不放行」，
  // 名字带 `Of` 以区别面向人写的 `targetEnabled(player, card, target, event?)`。

  /**
   * @see TargetMods.selectTargetOf
   *
   * 与其他 `*Of` 一样不收 `event`——`TargetMods` 是纯查询接口。
   * 少了它，`ModQuery` 就不满足 `TargetMods`，一旦被传给
   * `TargetSystem.validateTargets` 会在运行时崩（方法不存在）。
   */
  selectTargetOf(source: IPlayer, card: ICard, base: number): number {
    return this.selectTarget(source, card, base)
  }

  /** @see TargetMods.targetEnabledOf */
  targetEnabledOf(source: IPlayer, card: ICard, target: IPlayer): boolean {
    return this.targetEnabled(source, card, target)
  }

  /** @see TargetMods.targetInRangeOf */
  targetInRangeOf(source: IPlayer, card: ICard, target: IPlayer): boolean {
    return this.targetInRange(source, card, target)
  }

  // ── 内部 ──

  private context(
    player: IPlayer,
    event?: IGameEvent,
    payload?: DamageModPayload,
  ): ModContext {
    return {
      player,
      game: this.state,
      event,
      payload: payload ? { damage: payload } : undefined,
    }
  }
}
