// ============================================================
// 联盟杀 · useResponse — 响应窗口状态 Hook
//
// 管理响应窗口（如"请出闪"、"请出桃"、"无懈可击询问"）的交互状态。
//
// 用法：
//   const response = useResponse()
//   const answer = await response.open({ prompt, validCardIds, timeoutMs, required })
//   // 期间玩家可能 selectCard / confirm / cancel / 超时
//   // answer === null 表示「不出」
// ============================================================

import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

/** 响应窗口配置 */
export interface ResponseWindowConfig {
  /** 提示文本，如 "请出闪" */
  prompt: string
  /** 可选卡牌 ID 列表 */
  validCardIds: string[]
  /** 倒计时（毫秒），0 表示不限时 */
  timeoutMs: number
  /** 是否为强制响应（濒死求桃等不能跳过） */
  required: boolean
  /** 附加说明 */
  description?: string
}

/** useResponse 返回类型 */
export interface UseResponseReturn {
  // ── 状态 ──
  /** 窗口是否打开 */
  isOpen: Ref<boolean>
  /** 当前提示文本 */
  prompt: Ref<string>
  /** 附加说明 */
  description: Ref<string>
  /** 可选卡牌 ID 列表 */
  validCardIds: Ref<string[]>
  /** 当前选中的卡牌 ID（null = 不出） */
  selectedCardId: Ref<string | null>
  /** 是否可以取消（非强制响应时可取消） */
  canCancel: Ref<boolean>
  /** 是否强制响应 */
  isRequired: Ref<boolean>
  /** 剩余时间（秒），-1 表示不限时 */
  remainingSeconds: Ref<number>
  /** 倒计时进度 (0-100) */
  countdownProgress: ComputedRef<number>
  /** 是否已超时 */
  isTimeout: Ref<boolean>

  // ── 方法 ──
  /**
   * 打开响应窗口，并**等问题的答案**。
   *
   * @returns 选中的卡牌 ID；`null` 表示不出（取消 / 超时）
   *
   * 为什么必须返回 Promise：问这个问题的地方，事件流水线已经被 pause 挂起了。
   * 一个取不回答案的窗口，等于让整局卡在那个 await 上。
   * 2026-10-09 之前这个函数不返回任何东西——于是全仓没有一处会问它
   * （欠账 D34 / D35）。
   */
  open(config: ResponseWindowConfig): Promise<string | null>
  /** 选中一张卡牌 */
  selectCard(cardId: string | null): void
  /**
   * 确认响应（打出选中的牌）
   *
   * 同步就够了：这里只是把答案交给悬着的那条 Promise，并不碰引擎。
   */
  confirm(): void
  /** 取消响应（不出牌） */
  cancel(): void
  /** 关闭窗口（超时自动取消） */
  close(): void
}

/**
 * 响应窗口 Hook。
 *
 * 管理"请出闪"/"请出桃"/"无懈可击询问"等响应式交互的完整流程：
 * 1. 引擎触发响应窗口 → `const answer = await open(config)`（答案可能是 null）
 * 2. 玩家选牌 / 选不出 / 超时
 * 3. 确认 / 取消 / 超时 → settle → `open()` 的那条 Promise 带着答案返回
 *
 * 注意第 3 步：**不要把答案再交给 `GameController.respondToWindow`。**
 * 那个方法（实测 `game-controller.ts:275`）只做了一句 `syncToStore()`，
 * 什么也没真答复，2026-10-09 之前这套弹窗就是死在这条路上。
 *
 * 这个 hook 因此**不持有 controller**：它只负责「把人的答案带回来」，
 * 答给谁由调用它的那一层（`HumanDecisionService`）决定。
 * 以前它接一个 controller getter 却一眼没读过——一个没人读的形参，
 * 与当年 `GameBoard` 那两个没人读的 props 是同一回事。
 */
export function useResponse(): UseResponseReturn {
  // ── 响应式状态 ──
  const isOpen = ref(false)
  const prompt = ref('')
  const description = ref('')
  const validCardIds = ref<string[]>([])
  const selectedCardId = ref<string | null>(null)
  const canCancel = ref(true)
  const isRequired = ref(false)
  const remainingSeconds = ref(-1)
  const isTimeout = ref(false)
  const totalTimeoutMs = ref(0)

  let timerHandle: ReturnType<typeof setInterval> | null = null
  let startTimestamp = 0
  /**
   * 「这局问题的答案交给谁」
   *
   * 窗口被顶掉 / 关闭 / 超时时也必须答复（一律 `null` = 不出）：
   * 悬着的 resolve 没人用不报错、不红测试，只是那条 await 永远不返回。
   */
  let settle: ((cardId: string | null) => void) | null = null

  /** 答复并把窗口关上 */
  function settleWith(cardId: string | null): void {
    const resolve = settle
    settle = null
    cleanup()
    isOpen.value = false
    resolve?.(cardId)
  }

  /**
   * 顶掉上一个还悬着的问题
   *
   * 新窗口把旧的闭掉时，旧的那个 Promise 也必须答复（按「不出」）——
   * 悬着的 resolve 不报错、不红测试，只是那条 await 永远不返回。
   */
  function discardStalePromise(): void {
    const stale = settle
    settle = null
    stale?.(null)
    cleanup()
    isOpen.value = false
  }

  // ── 派生状态 ──

  /** 倒计时进度 (0-100) */
  const countdownProgress = computed(() => {
    if (totalTimeoutMs.value <= 0 || remainingSeconds.value < 0) return 100
    const total = totalTimeoutMs.value / 1000
    return Math.round((remainingSeconds.value / total) * 100)
  })

  // ── 方法 ──

  /** 打开响应窗口并等待玩家答复 */
  function open(config: ResponseWindowConfig): Promise<string | null> {
    discardStalePromise()

    return new Promise<string | null>((resolve) => {
      settle = resolve

      isOpen.value = true
      prompt.value = config.prompt
      description.value = config.description ?? ''
      validCardIds.value = config.validCardIds
      selectedCardId.value = null
      canCancel.value = !config.required
      isRequired.value = config.required
      isTimeout.value = false
      totalTimeoutMs.value = config.timeoutMs

      // 启动倒计时
      if (config.timeoutMs > 0) {
        remainingSeconds.value = Math.ceil(config.timeoutMs / 1000)
        startTimestamp = Date.now()

        timerHandle = setInterval(() => {
          const elapsed = Date.now() - startTimestamp
          const remaining = Math.max(0, config.timeoutMs - elapsed)
          remainingSeconds.value = Math.ceil(remaining / 1000)

          if (remaining <= 0) {
            isTimeout.value = true
            // 超时自动取消
            handleTimeout()
          }
        }, 500)
      } else {
        remainingSeconds.value = -1
      }
    })
  }

  /** 超时处理 */
  function handleTimeout(): void {
    if (timerHandle) {
      clearInterval(timerHandle)
      timerHandle = null
    }
    // 超时 = 不出牌
    selectedCardId.value = null
    settleWith(null)
  }

  /** 选中一张卡牌 */
  function selectCard(cardId: string | null): void {
    if (!isOpen.value) return
    if (cardId !== null && !validCardIds.value.includes(cardId)) return
    selectedCardId.value = cardId
  }

  /** 确认响应（打出选中的牌） */
  function confirm(): void {
    if (!isOpen.value) return
    settleWith(selectedCardId.value)
  }

  /** 取消响应（不出牌） */
  function cancel(): void {
    if (!isOpen.value) return
    if (isRequired.value) return // 强制响应不可取消
    settleWith(null)
  }

  /**
   * 关闭窗口（= 不出）
   *
   * `ResponseDialog` 的 `@close` 直接绑在这里，因此它等价于「我不要出」。
   */
  function close(): void {
    if (isOpen.value) settleWith(null)
    else cleanup()
  }

  /** 清理计时器 */
  function cleanup(): void {
    if (timerHandle) {
      clearInterval(timerHandle)
      timerHandle = null
    }
  }

  return {
    // 状态
    isOpen,
    prompt,
    description,
    validCardIds,
    selectedCardId,
    canCancel,
    isRequired,
    remainingSeconds,
    countdownProgress,
    isTimeout,

    // 方法
    open,
    selectCard,
    confirm,
    cancel,
    close,
  }
}
