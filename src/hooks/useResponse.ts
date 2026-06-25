// ============================================================
// 联盟杀 · useResponse — 响应窗口状态 Hook
//
// 管理响应窗口（如"请出闪"、"请出桃"、"无懈可击询问"）的交互状态。
//
// 用法：
//   const response = useResponse(controllerGetter, storeGetter)
//   response.open(prompt, validCardIds, timeoutMs)
//   response.selectCard(cardId)     // 选中要打出的牌
//   response.confirm()              // 确认响应
//   response.cancel()               // 不出/跳过
// ============================================================

import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { GameController } from '@/services/game-controller'

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
  /** 打开响应窗口 */
  open(config: ResponseWindowConfig): void
  /** 选中一张卡牌 */
  selectCard(cardId: string | null): void
  /** 确认响应（打出选中的牌） */
  confirm(): Promise<void>
  /** 取消响应（不出牌） */
  cancel(): Promise<void>
  /** 关闭窗口（超时自动取消） */
  close(): void
}

/**
 * 响应窗口 Hook。
 *
 * 管理"请出闪"/"请出桃"/"无懈可击询问"等响应式交互的完整流程：
 * 1. 引擎触发响应窗口 → open(config)
 * 2. 玩家选择卡牌或跳过
 * 3. 确认 → controller.respondToWindow(cardId)
 *
 * @param controllerGetter 获取 GameController 实例的函数
 */
export function useResponse(
  controllerGetter: () => GameController | null,
): UseResponseReturn {
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

  // ── 派生状态 ──

  /** 倒计时进度 (0-100) */
  const countdownProgress = computed(() => {
    if (totalTimeoutMs.value <= 0 || remainingSeconds.value < 0) return 100
    const total = totalTimeoutMs.value / 1000
    return Math.round((remainingSeconds.value / total) * 100)
  })

  // ── 方法 ──

  /** 打开响应窗口 */
  function open(config: ResponseWindowConfig): void {
    close() // 先关闭旧窗口

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
  }

  /** 超时处理 */
  function handleTimeout(): void {
    if (timerHandle) {
      clearInterval(timerHandle)
      timerHandle = null
    }
    // 超时 = 不出牌
    selectedCardId.value = null
    // 异步取消（不阻塞超时回调）
    cancel().catch(() => {
      // 超时取消错误可忽略
    })
  }

  /** 选中一张卡牌 */
  function selectCard(cardId: string | null): void {
    if (!isOpen.value) return
    if (cardId !== null && !validCardIds.value.includes(cardId)) return
    selectedCardId.value = cardId
  }

  /** 确认响应 */
  async function confirm(): Promise<void> {
    if (!isOpen.value) return

    cleanup()

    const ctrl = controllerGetter()
    if (ctrl) {
      try {
        await ctrl.respondToWindow(selectedCardId.value)
      } catch (err) {
        console.error('[useResponse] 响应确认失败:', err)
      }
    }

    isOpen.value = false
  }

  /** 取消响应 */
  async function cancel(): Promise<void> {
    if (!isOpen.value) return
    if (isRequired.value) return // 强制响应不可取消

    cleanup()

    const ctrl = controllerGetter()
    if (ctrl) {
      try {
        await ctrl.respondToWindow(null)
      } catch (err) {
        console.error('[useResponse] 响应取消失败:', err)
      }
    }

    isOpen.value = false
  }

  /** 关闭窗口 */
  function close(): void {
    cleanup()
    isOpen.value = false
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
