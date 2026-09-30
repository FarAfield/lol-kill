// ============================================================
// 联盟杀 · ModRegistry — 数值 / 布尔修改器注册表
//
// Mod 是「这个数字是多少」「这件事允不允许」的唯一答案来源。
// 它必须满足四条约束，每一条都由代码强制，不是约定：
//
// 1. **纯函数** —— `ctx.game` 交给 Mod 之前会被包成只读代理，
//    任何写入 / 删除都抛 `ModPurityError`。
// 2. **随持有者自动失效** —— 每次查询都用 `def.owners(ctx)` **现算**持有者，
//    并过滤掉已死亡者。死亡 / 卸下装备 / 失去技能都不需要清理代码。
// 3. **不可被无懈可击** —— Mod 不参与事件流水线，压根没有「被响应」这一步。
// 4. **顺序确定性** —— priority 降序 → 距当前玩家的座次距离升序 →
//    持有者座次 → 持有者 id → 定义 id。禁止依赖注册顺序。
// ============================================================

import type {
  IModDefinition,
  IModRegistry,
  ModContext,
  NumericModArgsMap,
  BooleanModArgsMap,
} from '@core/contracts/mod.interface'
import type {
  IModTraceSink,
  ModContribution,
  ModQueryInfo,
  ModSkipReason,
} from '@core/contracts/trace.interface'
import type { IPlayer } from '@core/contracts/player.interface'

/**
 * Mod  purity 违规
 *
 * 在 Mod 里改游戏状态时抛出。这个错误**不该被捕获**——它代表某个 Mod
 * 作者在「只能读」的地方写了东西，属于实现 bug。
 */
export class ModPurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModPurityError'
  }
}

/**
 * 不需要「持有者»匹配」的钩子
 *
 * 名字以 `global` 打头：它仍然有持有者（决定活性），但不要求持有者是
 * 本次事件的某一方——「无论谁造成伤害都 +1」。
 */
const GLOBAL_KEYS: ReadonlySet<string> = new Set([
  'globalDamageFrom',
  'globalDamageTo',
])

/**
 * 「我 OR 目标»都算数」的钩子
 *
 * 「这个目标合不合法」既能由使用者的技能决定，也能由目标自己的技能决定
 * （你不能选我 / 我不能选你），因此两方都放行。
 */
const EITHER_PARTY_KEYS: ReadonlySet<string> = new Set([
  'targetEnabled',
  'targetInRange',
])

/** 一次查询中的候选：一条定义 × 一个持有者 */
interface ModCandidate {
  def: IModDefinition
  owner?: IPlayer
}

/** 座次环上两点间的最短步数（用于 Mod 排序的参考距离） */
function seatSpan(from: number, to: number, total: number): number {
  if (total <= 0) return 0
  const forward = (to - from + total) % total
  const backward = (from - to + total) % total
  return Math.min(forward, backward)
}

/**
 * 只读代理
 *
 * 深代理会遇到的坑：
 * - **Map / Set 不能代理**：内部方法（`.get` / `.has`）在 Proxy receiver 上会抛
 *   "incompatible receiver"。玩家 `marks` 是 Map，原样放行。
 * - **玩家对象不能代理**：否则 Mod 里 `payload.target === ctx.player`
 *   这种身份比较会失效。同理，凡是出现在 `passthrough` 里的对象都放行。
 *
 * 剩下的普通对象与数组一律深代理：写、删都抛错。
 */
function readonlyView<T extends object>(
  target: T,
  passthrough: (value: unknown) => boolean,
  label: string,
): T {
  const cache = new WeakMap<object, unknown>()

  const wrap = (value: unknown): unknown => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
      return value
    }
    if (typeof value === 'function') return value
    if (value instanceof Map || value instanceof Set) return value
    if (passthrough(value)) return value

    const cached = cache.get(value as object)
    if (cached !== undefined) return cached

    const proxy = new Proxy(value as object, {
      get: (t, prop, receiver) => wrap(Reflect.get(t, prop, receiver)),
      set: (_t, prop) => {
        throw new ModPurityError(
          `[Mod] ${label}: 试图修改 ${String(prop)}。Mod 必须是纯函数，只读不写。`,
        )
      },
      deleteProperty: (_t, prop) => {
        throw new ModPurityError(
          `[Mod] ${label}: 试图删除 ${String(prop)}。Mod 必须是纯函数，只读不写。`,
        )
      },
    })
    cache.set(value as object, proxy)
    return proxy
  }

  return wrap(target) as T
}

/**
 * Mod 注册表
 */
export class ModRegistry implements IModRegistry {
  private defs = new Map<string, IModDefinition>()

  /**
   * Mod 追踪端（可观测性侧信道）
   *
   * 缺省不接。接了之后每次查询会把「base → 每个修改器 → result」这条路
   * 摊给它。**它不参与计算**：拿不到 writable 的上下文，返回值也没人读。
   * 关闭时查询路径上只多一次 `?.enabled` 判断。
   */
  trace?: IModTraceSink

  /** 注册一条定义（同名重复会覆盖并告警） */
  register(def: IModDefinition): void {
    if (this.defs.has(def.id)) {
      console.warn(`[ModRegistry] Mod 重复注册，后者覆盖前者: ${def.id}`)
    }
    this.defs.set(def.id, def)
  }

  registerAll(defs: Iterable<IModDefinition>): void {
    for (const def of defs) this.register(def)
  }

  unregister(id: string): boolean {
    return this.defs.delete(id)
  }

  clear(): void {
    this.defs.clear()
  }

  get size(): number {
    return this.defs.size
  }

  /** 已注册的定义清单（按注册顺序） */
  list(): IModDefinition[] {
    return [...this.defs.values()]
  }

  // ── 查询 ──

  queryNumeric<K extends keyof NumericModArgsMap>(
    key: K,
    base: number,
    ctx: ModContext,
    ...args: NumericModArgsMap[K]
  ): number {
    const trace = this.trace?.enabled ? this.trace : undefined
    const info = trace
      ? {
          key: key as string,
          playerId: ctx.player.id,
          base,
          eventId: ctx.event?.id,
        }
      : undefined
    this.emitBegin(trace, info)

    let value = base
    const name = key as string
    const skip = trace ? this.skipperFor(name, trace) : undefined

    for (const { def, owner } of this.candidates(name, ctx, args, skip)) {
      const fn = (def.mods as Record<string, ((...a: unknown[]) => number) | undefined>)[name]
      if (typeof fn !== 'function') continue

      const before = value
      value = fn(value, this.contextFor(ctx, owner), ...args)
      if (trace) {
        this.emitContribution(trace, name, def.id, owner?.id, before, value, value !== before)
      }
    }

    this.emitEnd(trace, info, value)
    return value
  }

  queryBoolean<K extends keyof BooleanModArgsMap>(
    key: K,
    base: boolean,
    ctx: ModContext,
    ...args: BooleanModArgsMap[K]
  ): boolean {
    const trace = this.trace?.enabled ? this.trace : undefined
    const info = trace
      ? { key: key as string, playerId: ctx.player.id, base, eventId: ctx.event?.id }
      : undefined
    this.emitBegin(trace, info)

    let value = base
    const name = key as string
    const skip = trace ? this.skipperFor(name, trace) : undefined

    for (const { def, owner } of this.candidates(name, ctx, args, skip)) {
      const fn = (def.mods as Record<string, ((...a: unknown[]) => boolean) | undefined>)[name]
      if (typeof fn !== 'function') continue

      // 已 false 就不再往下问：布尔是否决语义，一票否决之后没有翻盘
      if (!value) {
        if (trace) {
          this.emitContribution(
            trace,
            name,
            def.id,
            owner?.id,
            value,
            value,
            false,
            'short-circuited',
          )
        }
        this.emitEnd(trace, info, false)
        return false
      }

      const before = value
      value = fn(value, this.contextFor(ctx, owner), ...args)
      if (trace) {
        this.emitContribution(trace, name, def.id, owner?.id, before, value, value !== before)
      }
    }

    this.emitEnd(trace, info, value)
    return value
  }

  // ── 追踪转发 ──
  //
  // 三个转发方法一律吞掉异常：追踪端是观察者，不是计算的一环。
  // 「因为日志记不下去导致一次伤害查询崩了」是任何引擎都承受不起的失败模式。
  // 同理，对象字面量只在 `trace` 存在时才构造——关着追踪的时候，
  // 查询路径上不该多出任何一次分配（距离计算在一局里会跑几千次）。

  private emitBegin(trace: IModTraceSink | undefined, info: ModQueryInfo | undefined): void {
    if (!trace || !info) return
    try {
      trace.onQueryBegin(info)
    } catch {
      // 观测失败不参与计算
    }
  }

  private emitEnd(
    trace: IModTraceSink | undefined,
    info: ModQueryInfo | undefined,
    result: number | boolean,
  ): void {
    if (!trace || !info) return
    try {
      trace.onQueryEnd(info, result)
    } catch {
      // 同上
    }
  }

  private emitContribution(
    trace: IModTraceSink,
    key: string,
    modId: string,
    ownerId: string | undefined,
    before: number | boolean,
    after: number | boolean,
    changed: boolean,
    skippedReason?: ModSkipReason,
  ): void {
    try {
      trace.onContribution({ key, modId, ownerId, before, after, changed, skippedReason })
    } catch {
      // 同上
    }
  }

  /**
   * 构造「为什么没参与」的回传入口
   *
   * 只在开着追踪时才建——关闭时 `candidates` 拿到 undefined，
   * 分支连进去都不用进。
   */
  private skipperFor(key: string, trace: IModTraceSink) {
    return (modId: string, ownerId: string | undefined, reason: ModSkipReason): void => {
      trace.onContribution({
        key,
        modId,
        ownerId,
        before: 0,
        after: 0,
        changed: false,
        skippedReason: reason,
      } satisfies ModContribution)
    }
  }

  // ── 内部 ──

  /**
   * 本次查询的全部候选，已排好序
   *
   * @param skip 「这一条没能参与」的回传入口；不传就不记录跳过原因。
   *   多数调用方不需要它，不该为了记录而多分配一个数组。
   */
  private candidates(
    key: string,
    ctx: ModContext,
    args: readonly unknown[],
    skip?: (modId: string, ownerId: string | undefined, reason: ModSkipReason) => void,
  ): ModCandidate[] {
    const raw: ModCandidate[] = []

    for (const def of this.defs.values()) {
      const fn = (def.mods as Record<string, unknown>)[key]
      if (typeof fn !== 'function') continue

      if (def.owners) {
        let owners: IPlayer[] = []
        try {
          owners = def.owners(ctx as ModContext) ?? []
        } catch (error) {
          throw new ModPurityError(
            `[Mod] ${def.id}: owners() 抛错（${String(error)}）。它必须是纯函数。`,
          )
        }
        for (const owner of owners) {
          // ★ 持有者死亡 → 自动失效。这是「不需要手动清理」的全部秘密
          if (!owner.alive) {
            skip?.(def.id, owner.id, 'owner-dead')
            continue
          }
          if (!this.matches(key, owner, ctx, args)) {
            skip?.(def.id, owner.id, 'owner-not-involved')
            continue
          }
          raw.push({ def, owner })
        }
      } else {
        // 全局 Mod：没有持有者，也因此不受生死影响
        raw.push({ def })
      }
    }

    const filtered = raw.filter(({ def, owner }) => {
      if (!def.filter) return true
      const passed = def.filter(this.contextFor(ctx, owner)) === true
      if (!passed) skip?.(def.id, owner?.id, 'filtered-out')
      return passed
    })

    return this.sort(filtered, ctx)
  }

  /**
   * 持有者是否对得上本次查询
   *
   * 默认是「持有者 == 查询主体」；`global*` 不做限制；
   * `target*` 允许「使用者或目标」任一方持有。
   */
  private matches(
    key: string,
    owner: IPlayer,
    ctx: ModContext,
    args: readonly unknown[],
  ): boolean {
    if (GLOBAL_KEYS.has(key)) return true
    if (owner.id === ctx.player.id) return true
    if (EITHER_PARTY_KEYS.has(key)) {
      const target = args[1]
      return typeof target === 'object' && target !== null
        ? (target as IPlayer).id === owner.id
        : false
    }
    return false
  }

  /**
   * 排序 —— 禁止依赖注册顺序
   *
   * priority 降序 → 距当前玩家座次距离升序 → 持有者座次 → 持有者 id → 定义 id
   */
  private sort(list: ModCandidate[], ctx: ModContext): ModCandidate[] {
    const total = ctx.game.players.length
    const reference = this.referenceIndex(ctx)

    return list.sort((a, b) => {
      const pa = a.def.priority ?? 0
      const pb = b.def.priority ?? 0
      if (pa !== pb) return pb - pa

      const da = seatSpan(a.owner?.seatIndex ?? reference, reference, total)
      const db = seatSpan(b.owner?.seatIndex ?? reference, reference, total)
      if (da !== db) return da - db

      const sa = a.owner?.seatIndex ?? -1
      const sb = b.owner?.seatIndex ?? -1
      if (sa !== sb) return sa - sb

      const oa = a.owner?.id ?? ''
      const ob = b.owner?.id ?? ''
      if (oa !== ob) return oa < ob ? -1 : 1

      return a.def.id < b.def.id ? -1 : a.def.id > b.def.id ? 1 : 0
    })
  }

  /** 排序参照点：当前行动玩家（不在回合中时退回查询主体） */
  private referenceIndex(ctx: ModContext): number {
    const index = ctx.game.currentPlayerIndex
    if (typeof index === 'number' && index >= 0) return index
    return ctx.player.seatIndex
  }

  /**
   * 组装交给 Mod 函数的上下文
   *
   * `game` 换成只读代理（每个持有者一份说明文本，出错时能指名是哪个 Mod）。
   */
  private contextFor(ctx: ModContext, owner?: IPlayer): ModContext {
    const label = owner ? `${ctx.player.id}/${owner.id}` : ctx.player.id
    const passthrough = (value: unknown): boolean =>
      (ctx.game.players as readonly unknown[]).includes(value)

    return {
      player: ctx.player,
      owner,
      game: readonlyView(ctx.game, passthrough, label),
      event: ctx.event,
      payload: ctx.payload,
    }
  }
}
