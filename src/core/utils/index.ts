/**
 * 通用确定性 ID 生成器。
 *
 * 基于命名空间 + 递增计数器，保证：
 * - 相同顺序调用 → 完全相同的 ID 序列（支持 replay 复现）
 * - 可独立用于卡牌、事件等不同场景（通过不同 key 隔离）
 *
 * @example
 * const gen = new IdGenerator()
 * gen.next('card')     // "card_1"
 * gen.next('card')     // "card_2"
 * gen.next('evt')      // "evt_1"
 * gen.reset()          // 计数器归零
 * gen.next('card')     // "card_1"（重置后重复）
 */
export class IdGenerator {
  private _counters = new Map<string, number>()

  /** 为指定 key 生成下一个 ID（格式: "${key}_${seq}"） */
  next(key: string): string {
    const seq = (this._counters.get(key) ?? 0) + 1
    this._counters.set(key, seq)
    return `${key}_${seq}`
  }

  /** 重置全部计数器（重放前调用） */
  reset(): void {
    this._counters.clear()
  }
}
