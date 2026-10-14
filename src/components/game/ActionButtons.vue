<template>
  <div class="action-buttons">
    <!--
      按钮的开关不再是「现在是哪个阶段」——形态丁下引擎是唯一推进者，
      回合内没有提问的阶段（准备 / 判定 / 摸牌 / 结束）它**不会停**，
      那时候摆一个「继续」按钮，按下去也没有可推的东西（欠账 D38）。

      所以这里只看一件事：**引擎此刻是不是正挂着我的一个提问**。
      挂出牌提问 → 出牌 / 结束出牌；挂弃牌提问 → 弃牌。
    -->
    <template v-if="canEndPhase">
      <!-- 出牌按钮 -->
      <n-button
        v-if="canPlayCard"
        type="primary"
        size="small"
        :disabled="!canPlayCard || isProcessing"
        @click="$emit('confirm-play')"
      >
        <template #icon>
          <span class="btn-icon">⚔️</span>
        </template>
        出牌
      </n-button>

      <!-- 取消选择按钮 -->
      <n-button
        v-if="hasSelection"
        size="small"
        @click="$emit('cancel-selection')"
      >
        取消
      </n-button>

      <!-- 结束出牌按钮 —— 按下去就是给那个挂起的提问答复 null -->
      <n-button
        type="warning"
        size="small"
        :disabled="isProcessing"
        @click="$emit('end-play')"
      >
        结束出牌
      </n-button>
    </template>

    <!-- 弃牌提问：只在手牌超上限时才会被问到 -->
    <template v-else-if="needDiscard">
      <div class="discard-info">
        <span class="discard-hint">
          需弃置 <strong>{{ discardCount }}</strong> 张牌
          <span class="selected-hint" v-if="selectedDiscardCount > 0">
            (已选 {{ selectedDiscardCount }})
          </span>
        </span>

        <n-space :size="8">
          <n-button
            v-if="hasSelection"
            size="small"
            @click="$emit('cancel-selection')"
          >
            取消
          </n-button>

          <n-button
            type="primary"
            size="small"
            :disabled="selectedDiscardCount < discardCount"
            @click="$emit('confirm-discard')"
          >
            确认弃牌
          </n-button>
        </n-space>
      </div>
    </template>

    <!-- 非当前玩家：等待提示 -->
    <template v-else-if="!isMyTurn && isPlaying">
      <div class="waiting-indicator">
        <span class="waiting-dot" />
        <span class="waiting-text">等待其他玩家操作...</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NButton, NSpace } from 'naive-ui'

defineProps<{
  /** 是否是当前玩家回合 */
  isMyTurn: boolean
  /**
   * 引擎此刻是不是正挂着我的一个**出牌**提问。
   *
   * 它是「结束出牌」按钮的开关。名字沿用了旧的 `canEndPhase`，
   * 含义却换过了：不再回答「现在是某个阶段」，只回答「引擎在不在等我」。
   */
  canEndPhase: boolean
  /** 是否可以确认出牌 */
  canPlayCard: boolean
  /** 当前是否有选中（卡牌或目标） */
  hasSelection: boolean
  /** 引擎此刻是不是正挂着我的一个**弃牌**提问 */
  needDiscard: boolean
  /** 需要弃置的数量 */
  discardCount: number
  /** 已选中的弃牌数量 */
  selectedDiscardCount: number
  /** 是否正在处理操作 */
  isProcessing: boolean
  /** 游戏是否进行中 */
  isPlaying: boolean
}>()

defineEmits<{
  (e: 'confirm-play'): void
  (e: 'confirm-discard'): void
  (e: 'cancel-selection'): void
  /** 结束出牌 —— 给挂起的出牌提问答复 null */
  (e: 'end-play'): void
}>()
</script>

<style lang="less" scoped>
.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.btn-icon {
  font-size: 14px;
  line-height: 1;
}

// ── 弃牌信息 ──
.discard-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.discard-hint {
  font-size: 13px;
  color: #e0e0e0;

  strong {
    color: #f0a020;
    font-size: 15px;
  }
}

.selected-hint {
  color: #18a058;
  font-size: 12px;
}

// ── 等待指示器 ──
.waiting-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
}

.waiting-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f0a020;
  animation: pulse-wait 1s ease-in-out infinite;
}

@keyframes pulse-wait {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.1); }
}

.waiting-text {
  font-size: 12px;
  color: #999;
}
</style>
