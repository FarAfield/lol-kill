// ============================================================
// 联盟杀 · SeededRandomService — 确定性随机源
//
// 引擎里**唯一**合法的随机来源。
//
// 为什么必须存在：
// 「同一种子 → 同一局」是回放、复盘、AI 批量对局、回归测试的前提。
// 只要有任何一个角落偷偷用 `Math.random()`，这局就再也复现不出来，
// 而且错误往往表现为「偶发失败」——最难查的那种。
//
// 算法 mulberry32：32 位状态、单次乘法混合，周期足够一局游戏用，
// 且**状态可快照**（`snapshot()` / `restore()`），能存进存档。
// ============================================================

import type { IRandomService } from '@core/contracts/services.interface'

/** 不指定种子时的默认值——保证「忘了传种子」也是可复现的 */
export const DEFAULT_SEED = 0x5eed

/**
 * 字符串 → 32 位种子（FNV-1a）
 *
 * 让「房间号」「对局 id」这类字符串也能当种子用。
 */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * 生成一颗新种子——只在**开局**调用，不参与对局过程
 *
 * 对局过程一律走 `SeededRandomService`，只有「这一局用哪个种子」
 * 这个决定本身需要真随机。种子一旦定下来，整局就是确定的。
 */
export function randomSeed(): number {
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const buffer = new Uint32Array(1)
    cryptoObj.getRandomValues(buffer)
    return buffer[0]! >>> 0
  }
  // 兜底：挂钟只用来挑种子，不参与对局，因此不构成不确定性来源
  return (Date.now() ^ 0x9e3779b9) >>> 0
}

/**
 * 确定性随机服务
 *
 * 同一个种子 + 同一串调用 = 同一串结果，跨进程、跨版本都成立
 * （算法是这里写的，不依赖宿主实现）。
 */
export class SeededRandomService implements IRandomService {
  /** 这颗种子——写进回放记录，回放时原样重建 */
  readonly seed: number

  /** mulberry32 的 32 位状态（也是「随机数流」的位置） */
  private state: number

  /** uuid 的自增序号：uuid 不走随机流，避免污染洗牌序列 */
  private uuidSeq = 0

  /** 已经吐出多少个随机数——回放校验时用来确认两条流消耗一致 */
  private drawn = 0

  constructor(seed: number | string = DEFAULT_SEED) {
    this.seed = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0
    this.state = this.seed
  }

  /** 已吐出的随机数个数 */
  get calls(): number {
    return this.drawn
  }

  /**
   * 下一个 [0, 1) 随机数
   *
   * mulberry32：状态自增后做两轮乘法混合，最后归一化到 [0,1)。
   */
  next(): number {
    this.drawn++
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** [min, max] 闭区间内的随机整数 */
  nextInt(min: number, max: number): number {
    if (max <= min) return min
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** Fisher-Yates 洗牌，返回新数组（不改动入参） */
  shuffle<T>(array: readonly T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i)
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
  }

  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('SeededRandomService.pick: 不能从空数组里取元素')
    }
    return array[this.nextInt(0, array.length - 1)]!
  }

  pickN<T>(array: readonly T[], n: number): T[] {
    return this.shuffle(array).slice(0, Math.max(0, n))
  }

  /**
   * 唯一标识符
   *
   * 走自增序号而不是随机流：uuid 只要求「不撞车」，
   * 让它吃掉随机数会让「洗了几次牌」这种计数对不上。
   */
  uuid(): string {
    return `u${this.seed.toString(36)}_${++this.uuidSeq}`
  }

  /** 快照当前流位置（存档 / 回放校验） */
  snapshot(): number {
    return this.state
  }

  /** 恢复到某个流位置 */
  restore(state: number): void {
    this.state = state | 0
  }
}
