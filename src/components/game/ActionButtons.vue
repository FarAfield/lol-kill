<template>
  <div class="action-buttons">
    <!-- 出牌阶段操作 -->
    <template v-if="phase === GamePhase.PhaseUse && isMyTurn">
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

      <!-- 结束出牌按钮 -->
      <n-button
        type="warning"
        size="small"
        :disabled="isProcessing"
        @click="$emit('end-phase')"
      >
        结束出牌
      </n-button>
    </template>

    <!-- 弃牌阶段操作 -->
    <template v-else-if="phase === GamePhase.PhaseDiscard && isMyTurn">
      <div v-if="needDiscard" class="discard-info">
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

      <n-button
        v-else
        type="warning"
        size="small"
        :disabled="isProcessing"
        @click="$emit('end-phase')"
      >
        结束弃牌
      </n-button>
    </template>

    <!-- 其他阶段：继续按钮 -->
    <template v-else-if="isMyTurn && canEndPhase">
      <n-button
        type="primary"
        size="small"
        :disabled="isProcessing"
        @click="$emit('end-phase')"
      >
        {{ nextPhaseLabel }}
      </n-button>
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
import { computed } from 'vue'
import { NButton, NSpace } from 'naive-ui'
import { GamePhase } from '@core/contracts/enums'

const props = defineProps<{
  /** 当前阶段 */
  phase: GamePhase
  /** 是否是当前玩家回合 */
  isMyTurn: boolean
  /** 是否可以结束当前阶段 */
  canEndPhase: boolean
  /** 是否可以确认出牌 */
  canPlayCard: boolean
  /** 当前是否有选中（卡牌或目标） */
  hasSelection: boolean
  /** 是否需要弃牌 */
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
  (e: 'end-phase'): void
}>()

// ── 阶段标签映射 ──
const PHASE_NEXT_LABELS: Record<string, string> = {
  [GamePhase.PhasePre]: '进入判定',
  [GamePhase.PhaseJudge]: '进入摸牌',
  [GamePhase.PhaseDraw]: '进入出牌',
  [GamePhase.PhasePost]: '结束回合',
  [GamePhase.RoundStart]: '开始回合',
  [GamePhase.RoundEnd]: '下一轮',
}

const nextPhaseLabel = computed(() => {
  return PHASE_NEXT_LABELS[props.phase] ?? '下一阶段'
})
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
