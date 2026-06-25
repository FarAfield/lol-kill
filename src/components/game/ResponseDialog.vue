<template>
  <n-modal
    v-model:show="visible"
    :closable="canCancel"
    :mask-closable="false"
    preset="card"
    title="响应"
    :style="{ width: '420px' }"
    @update:show="handleClose"
  >
    <div class="response-dialog">
      <!-- 提示文本 -->
      <div class="response-prompt">
        <span class="prompt-icon">{{ promptIcon }}</span>
        <span class="prompt-text">{{ prompt }}</span>
      </div>

      <!-- 附加说明 -->
      <div v-if="description" class="response-desc">
        {{ description }}
      </div>

      <!-- 倒计时 -->
      <div v-if="remainingSeconds >= 0" class="countdown-bar">
        <div class="countdown-track">
          <div
            class="countdown-fill"
            :class="{ urgent: remainingSeconds <= 5 }"
            :style="{ width: countdownProgress + '%' }"
          />
        </div>
        <span class="countdown-text" :class="{ urgent: remainingSeconds <= 5 }">
          {{ remainingSeconds }}s
        </span>
      </div>

      <!-- 可选卡牌展示 -->
      <div class="response-cards">
        <div v-if="validCards.length === 0" class="no-cards">
          <n-text depth="3">没有可用的响应卡牌</n-text>
        </div>

        <div v-else class="cards-grid">
          <div
            v-for="card in validCards"
            :key="card.id"
            class="response-card-wrapper"
            :class="{
              selected: selectedCardId === card.id,
              disabled: isDisabled,
            }"
            @click="handleSelectCard(card.id)"
          >
            <CardFace
              :card="card"
              :selected="selectedCardId === card.id"
            />
            <div class="card-check" v-if="selectedCardId === card.id">
              <n-icon size="20" color="#18a058">
                <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/></svg>
              </n-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="response-actions">
        <n-space justify="end" :size="12">
          <n-button
            v-if="canCancel"
            size="medium"
            @click="handleCancel"
          >
            不出
          </n-button>
          <n-button
            type="primary"
            size="medium"
            :disabled="isRequired && !selectedCardId"
            @click="handleConfirm"
          >
            {{ confirmLabel }}
          </n-button>
        </n-space>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  NModal,
  NButton,
  NText,
  NSpace,
  NIcon,
} from 'naive-ui'
import type { ICard } from '@core/contracts/card.interface'
import CardFace from '@/components/card/CardFace.vue'

const props = defineProps<{
  /** 是否显示 */
  visible: boolean
  /** 提示文本 */
  prompt: string
  /** 附加说明 */
  description?: string
  /** 可选卡牌列表 */
  validCards: ICard[]
  /** 当前选中的卡牌 ID */
  selectedCardId: string | null
  /** 是否可以取消 */
  canCancel: boolean
  /** 是否必须响应 */
  isRequired: boolean
  /** 剩余秒数 */
  remainingSeconds: number
  /** 倒计时进度 */
  countdownProgress: number
  /** 是否禁用交互 */
  isDisabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-card', cardId: string): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'close'): void
}>()

// ── 派生状态 ──

/** 提示图标 */
const promptIcon = computed(() => {
  const p = props.prompt
  if (p.includes('闪')) return '🛡️'
  if (p.includes('桃')) return '🍑'
  if (p.includes('无懈')) return '✨'
  if (p.includes('杀')) return '⚔️'
  return '📜'
})

/** 确认按钮标签 */
const confirmLabel = computed(() => {
  if (!props.selectedCardId) return '不出'
  const card = props.validCards.find((c) => c.id === props.selectedCardId)
  if (!card) return '确认'
  return `打出 ${card.name}`
})

// ── 方法 ──

function handleSelectCard(cardId: string): void {
  if (props.isDisabled) return
  emit('select-card', cardId)
}

function handleConfirm(): void {
  emit('confirm')
}

function handleCancel(): void {
  emit('cancel')
}

function handleClose(show: boolean): void {
  if (!show) {
    emit('close')
  }
}
</script>

<style lang="less" scoped>
.response-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// ── 提示文本 ──
.response-prompt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(83, 52, 131, 0.15), rgba(15, 52, 96, 0.15));
  border: 1px solid rgba(83, 52, 131, 0.3);
  border-radius: 8px;
}

.prompt-icon {
  font-size: 28px;
}

.prompt-text {
  font-size: 18px;
  font-weight: 600;
  color: #e0e0e0;
}

// ── 附加说明 ──
.response-desc {
  font-size: 13px;
  color: #999;
  padding: 0 4px;
  line-height: 1.5;
}

// ── 倒计时 ──
.countdown-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.countdown-track {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.countdown-fill {
  height: 100%;
  background: linear-gradient(90deg, #18a058, #36ad6a);
  border-radius: 3px;
  transition: width 0.5s linear;

  &.urgent {
    background: linear-gradient(90deg, #d03050, #e88080);
  }
}

.countdown-text {
  font-size: 14px;
  font-weight: 600;
  color: #18a058;
  min-width: 36px;
  text-align: right;

  &.urgent {
    color: #d03050;
    animation: pulse-text 0.5s ease-in-out infinite alternate;
  }
}

@keyframes pulse-text {
  from { opacity: 1; }
  to { opacity: 0.5; }
}

// ── 卡牌选择 ──
.response-cards {
  min-height: 80px;
}

.no-cards {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.cards-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.response-card-wrapper {
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.15s, box-shadow 0.15s;

  &:hover:not(.disabled) {
    transform: translateY(-4px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }

  &.selected {
    transform: translateY(-6px);
    box-shadow: 0 8px 20px rgba(24, 160, 88, 0.4);

    :deep(.card-face) {
      border-color: #18a058 !important;
      border-width: 3px;
    }
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.card-check {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 28px;
  height: 28px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 5;
}

// ── 操作按钮 ──
.response-actions {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
