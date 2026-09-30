// ============================================================
// 联盟杀 · EventTrail — 事件流水（回放的「逐事件日志」）
//
// 「两局是不是同一局」最硬的判据是**事件流水**：谁在什么时候、
// 对谁、用了什么牌、造成多少伤害，一路记下来。
// 比结果（谁赢了）强得多——赢家一样的两局可能过程完全不同。
//
// 记录手段是 Phase 17 的全局钩子：这类监听不属于任何角色，
// 写成技能就得凭空指定一个持有者，而那个人一死监听就断了。
// ============================================================

import {
  EVENT_STAGE_SUFFIXES,
  EVENT_SUBJECTS,
  POINT_EVENT_NAMES,
  type EventName,
} from '@core/contracts/event-name'
import type { IGlobalHook } from '@core/event/global-hook'
import type { GameEngine } from '@core/engine/game-engine'

/**
 * 全部内置事件名（单发事件 + 主体 × 阶段后缀）
 *
 * 由两份清单现算，不手写——手写迟早会和 `event-name.ts` 走偏，
 * 而漏掉的事件名在回放里表现为「流水缺了一段」，极难察觉。
 */
export function allBuiltinEventNames(): EventName[] {
  const names: EventName[] = [...POINT_EVENT_NAMES]
  for (const subject of EVENT_SUBJECTS) {
    for (const suffix of EVENT_STAGE_SUFFIXES) {
      names.push(`${subject}${suffix}` as EventName)
    }
  }
  return names
}

/**
 * 事件流水记录器
 *
 * 挂满全部内置事件的全局钩子，把每条事件压成一行指纹。
 * 用完必须 `detach()`——一次性监听忘了摘就是幽灵钩子。
 */
export class EventTrail {
  readonly entries: string[] = []
  private hooks: IGlobalHook[] = []

  /** 挂上钩子 */
  attach(engine: GameEngine): void {
    for (const name of allBuiltinEventNames()) {
      this.hooks.push(
        engine.globalHooks.on(name, (ctx) => {
          const event = ctx.event
          if (!event) return
          this.entries.push(
            `${event.name}` +
              `|round=${ctx.game.currentRound}` +
              `|turn=${event.turn}` +
              `|src=${event.player?.id ?? '-'}` +
              `|dst=${event.targets.map((t) => t.id).sort().join(',')}` +
              `|cards=${event.cards.map((c) => c.instanceId).sort().join(',')}` +
              `|num=${event.num}`,
          )
        }),
      )
    }
  }

  /** 摘掉钩子 */
  detach(): void {
    for (const hook of this.hooks) hook.off()
    this.hooks = []
  }
}
