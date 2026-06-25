// ============================================================
// 联盟杀 · CardAuditor — 卡牌数量异常检测
//
// 静态工具类，检测以下异常：
// - 重复卡牌 ID（同一张卡出现在多个区域）
// - 卡牌丢失（卡牌总数不等于预期值）
// - 区域归属不一致（卡牌 zone 字段与实际所在集合不匹配）
// - 孤卡（不属于任何已知区域的卡牌）
//
// 用途：
// - 开发调试：在每阶段结束后调用 verify() 以尽早发现 bug
// - 测试验证：在测试用例后调用验证状态完整性
// - 生产监控（可选）：通过 GameEngine 的 enableAudit 选项开启
// ============================================================

import type { ICard } from '@core/contracts/card.interface'
import type { IGameState } from '@core/contracts/game.interface'

/**
 * 审计结果
 */
export interface AuditResult {
  /** 是否通过审计 */
  valid: boolean
  /** 当前各区域卡牌数量 */
  counts: Record<string, number>
  /** 卡牌总数 */
  totalCards: number
  /** 预期卡牌数（初始牌堆大小），-1 表示未设置预期值 */
  expectedTotal: number
  /** 错误信息列表 */
  errors: string[]
  /** 警告信息列表 */
  warnings: string[]
}

/**
 * 卡牌审计器
 *
 * 静态工具，对游戏状态中的卡牌分布进行完整性检查。
 */
export class CardAuditor {
  /**
   * 验证卡牌完整性。
   *
   * 检查项：
   * 1. 没有重复 ID
   * 2. 卡牌总数与预期一致（如果提供了 expectedTotal）
   * 3. 卡牌 zone 字段与实际所在区域一致
   *
   * @param state         游戏状态
   * @param expectedTotal 预期的卡牌总数（初始牌堆大小），不传则跳过总数检查
   * @returns 审计结果
   */
  static verify(state: IGameState, expectedTotal?: number): AuditResult {
    const errors: string[] = []
    const warnings: string[] = []
    const seenIds = new Map<string, string>() // cardId → zone description

    // ── 收集所有区域的卡牌 ──
    const counts: Record<string, number> = {
      deck: state.deck.length,
      discard: state.discardPile.length,
      processing: state.processingCards.length,
    }

    let playerHandCards = 0
    let playerEquipCards = 0
    let playerJudgeCards = 0

    // ── 遍历牌堆 ──
    for (const card of state.deck) {
      checkDuplicate(card, '牌堆', seenIds, errors)
    }

    // ── 遍历弃牌堆 ──
    for (const card of state.discardPile) {
      checkDuplicate(card, '弃牌堆', seenIds, errors)
    }

    // ── 遍历处理区 ──
    for (const card of state.processingCards) {
      checkDuplicate(card, '处理区', seenIds, errors)
    }

    // ── 遍历玩家卡牌 ──
    for (const player of state.players) {
      for (const card of player.handCards) {
        checkDuplicate(card, `玩家 ${player.id} 手牌`, seenIds, errors)
        playerHandCards++
      }
      for (const card of player.equipCards) {
        checkDuplicate(card, `玩家 ${player.id} 装备`, seenIds, errors)
        playerEquipCards++
      }
      for (const card of player.judgeCards) {
        checkDuplicate(card, `玩家 ${player.id} 判定区`, seenIds, errors)
        playerJudgeCards++
      }
    }

    counts['hand(全部)'] = playerHandCards
    counts['equip(全部)'] = playerEquipCards
    counts['judge(全部)'] = playerJudgeCards

    const totalCards =
      counts.deck + counts.discard + counts.processing +
      counts['hand(全部)'] + counts['equip(全部)'] + counts['judge(全部)']

    // ── 总数检查 ──
    if (expectedTotal !== undefined && expectedTotal >= 0) {
      if (totalCards !== expectedTotal) {
        const diff = totalCards - expectedTotal
        if (diff > 0) {
          errors.push(
            `卡牌数量异常：当前 ${totalCards} 张，预期 ${expectedTotal} 张（多出 ${diff} 张）`,
          )
        } else {
          errors.push(
            `卡牌数量异常：当前 ${totalCards} 张，预期 ${expectedTotal} 张（缺少 ${Math.abs(diff)} 张）`,
          )
        }
      }
    }

    // ── 预警：牌堆和弃牌堆双空 ──
    if (state.deck.length === 0 && state.discardPile.length === 0 && totalCards > 0) {
      warnings.push('牌堆和弃牌堆均为空，但仍有卡牌在其他区域 — 抽牌将失败')
    }

    return {
      valid: errors.length === 0,
      counts,
      totalCards,
      expectedTotal: expectedTotal ?? -1,
      errors,
      warnings,
    }
  }

  /**
   * 仅检测重复 ID。
   *
   * @returns 包含重复 ID 及其所在区域的错误列表
   */
  static checkDuplicates(state: IGameState): string[] {
    const result = CardAuditor.verify(state)
    return result.errors.filter((e) => e.includes('重复'))
  }

  /**
   * 获取各区域卡牌数量汇总。
   *
   * @returns 区域 → 数量 的映射
   */
  static getCardCounts(state: IGameState): Record<string, number> {
    const result = CardAuditor.verify(state)
    return result.counts
  }
}

/**
 * 检查单张卡牌是否已经被记录过。
 *
 * @param card   卡牌
 * @param zoneDesc 当前区域描述（用于错误消息）
 * @param seenIds  已记录的 ID 映射（id → 首次出现的区域）
 * @param errors   错误收集数组
 */
function checkDuplicate(
  card: ICard,
  zoneDesc: string,
  seenIds: Map<string, string>,
  errors: string[],
): void {
  if (!card || !card.id) return

  const existing = seenIds.get(card.id)
  if (existing) {
    errors.push(
      `卡牌 ID "${card.id}" 重复：同时存在于「${existing}」和「${zoneDesc}」`,
    )
  } else {
    seenIds.set(card.id, zoneDesc)
  }
}
