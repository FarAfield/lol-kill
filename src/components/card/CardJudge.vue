<template>
  <div class="card-judge" :class="{ compact, empty: judgeCards.length === 0 }">
    <div v-if="judgeCards.length > 0" class="judge-label">判定区</div>
    <div class="judge-cards">
      <div
        v-for="card in judgeCards"
        :key="card.id"
        class="judge-card-wrapper"
      >
        <CardFace :card="card" size="small" />
        <!-- 延时标记 -->
        <span v-if="card.isDelayed" class="delayed-dot" title="延时生效" />
      </div>
    </div>
    <div v-if="judgeCards.length === 0 && !compact" class="judge-empty-text">
      暂无判定牌
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ICard } from '@core/contracts/card.interface'
import CardFace from './CardFace.vue'

defineProps<{
  judgeCards: ICard[]
  compact?: boolean
}>()
</script>

<style lang="less" scoped>
.card-judge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  &.compact {
    .judge-card-wrapper {
      transform: scale(0.5);
      transform-origin: center center;
    }
  }
}

.judge-label {
  font-size: 10px;
  color: #f0a020;
  font-weight: 600;
}

.judge-cards {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.judge-card-wrapper {
  position: relative;
  transform: scale(0.65);
  transform-origin: top center;
}

.delayed-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f0a020;
  border: 1px solid #fff;
}

.judge-empty-text {
  font-size: 10px;
  color: #666;
}
</style>
