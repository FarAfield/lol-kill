<template>
  <div class="card-hand">
    <div
      class="hand-container"
      :style="{ height: containerHeight + 'px' }"
    >
      <div
        v-for="(card, idx) in cards"
        :key="card.id"
        class="hand-card-pos"
        :class="{
          'is-playable': playableCards.has(card.id),
          'is-selected': selectedCardId === card.id,
        }"
        :style="getPosStyle(idx, cards.length)"
        @click="handleCardClick(card.id)"
      >
        <div
          class="hand-card-rot"
          :style="getRotStyle(idx, cards.length)"
        >
          <CardFace
            :card="card"
            :selected="selectedCardId === card.id"
            :playable="playableCards.has(card.id)"
          />
        </div>
      </div>
    </div>
    <!-- 空手牌提示 -->
    <div v-if="cards.length === 0" class="empty-hand">
      <n-text depth="3">暂无手牌</n-text>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NText } from 'naive-ui'
import type { ICard } from '@core/contracts/card.interface'
import CardFace from './CardFace.vue'

const props = defineProps<{
  cards: ICard[]
  isMyTurn: boolean
  playableCards: Set<string>
}>()

const emit = defineEmits<{
  (e: 'select-card', cardId: string): void
}>()

const selectedCardId = ref<string | null>(null)

// 容器高度（给扇形留空间）
const containerHeight = computed(() => {
  const count = props.cards.length
  if (count <= 3) return 120
  if (count <= 6) return 130
  return 140
})

/**
 * 扇形排列：分离位置（translate）和旋转（rotate），
 * 确保 hover 抬起不影响水平位置和旋转。
 */
function getPosStyle(index: number, total: number): Record<string, string> {
  if (total === 0) return {}

  const cardWidth = 76
  const overlap = total > 7 ? 45 : total > 4 ? 35 : 20
  const totalWidth = (total - 1) * overlap + cardWidth
  const startX = -totalWidth / 2 + cardWidth / 2
  const xOffset = startX + index * overlap

  // 弧线 Y 偏移
  const t = total === 1 ? 0 : (index / (total - 1) - 0.5) * 2
  const radius = total * 6
  const yOffset = Math.abs(t) * radius

  return {
    transform: `translate(${xOffset}px, ${yOffset}px)`,
    zIndex: String(index + 1),
  }
}

function getRotStyle(index: number, total: number): Record<string, string> {
  if (total <= 1) return {}
  const maxRotation = Math.min(total * 2.5, 20)
  const t = (index / (total - 1) - 0.5) * 2
  const rotation = -t * maxRotation
  return { transform: `rotate(${rotation}deg)` }
}

function handleCardClick(cardId: string) {
  if (selectedCardId.value === cardId) {
    selectedCardId.value = null
  } else {
    selectedCardId.value = cardId
  }
  emit('select-card', cardId)
}
</script>

<style lang="less" scoped>
.card-hand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.hand-container {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
}

.hand-card-pos {
  position: absolute;
  bottom: 0;
  left: 50%;
  transition: transform 0.2s ease, filter 0.15s;

  // hover 仅添加垂直抬起，保留 X 偏移
  &:hover {
    transform: translateY(-10px) !important;
    z-index: 100 !important;

    .hand-card-rot {
      filter: brightness(1.15);
    }
  }

  &.is-selected {
    z-index: 99 !important;
    filter: brightness(1.1);

    .hand-card-rot {
      transform: translateY(-16px) rotate(0deg) !important;
      filter: brightness(1.2) drop-shadow(0 4px 12px rgba(255, 215, 0, 0.6));
    }
  }

  &.is-playable {
    cursor: pointer;
  }
}

.hand-card-rot {
  transform-origin: bottom center;
  transition: transform 0.2s ease, filter 0.15s;
}

.empty-hand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  min-width: 100px;
}
</style>
