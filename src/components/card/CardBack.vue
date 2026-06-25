<template>
  <div class="card-back" :class="[`card-type--${cardTypeClass}`]">
    <div class="back-pattern">
      <div class="back-center">
        <!-- 联盟杀 Logo 占位 -->
        <div class="back-logo">联盟杀</div>
      </div>
      <div class="back-border-inner" />
    </div>
    <!-- 花色 + 点数 占位（对手不可见真实数值） -->
    <div class="back-corner top-left">
      <span class="back-dot" />
    </div>
    <div class="back-corner bottom-right">
      <span class="back-dot" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CardType } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'

const props = defineProps<{
  card: ICard
  size?: 'small' | 'normal'
}>()

const cardTypeClass = computed(() => {
  return props.card.type
})
</script>

<style lang="less" scoped>
.card-back {
  position: relative;
  width: 76px;
  height: 108px;
  border-radius: 6px;
  cursor: default;
  user-select: none;
  box-sizing: border-box;
  overflow: hidden;
  border: 2px solid #555;
}

// 类型颜色
.card-type--basic {
  background: linear-gradient(135deg, #8b0000, #b22222, #8b0000);
  border-color: #6b0000;
}
.card-type--rune {
  background: linear-gradient(135deg, #1a5276, #2471a3, #1a5276);
  border-color: #154360;
}
.card-type--talent {
  background: linear-gradient(135deg, #512e5f, #6c3483, #512e5f);
  border-color: #3d1e4a;
}
.card-type--equip {
  background: linear-gradient(135deg, #145a32, #1e8449, #145a32);
  border-color: #0e3d21;
}

.back-pattern {
  position: absolute;
  inset: 4px;
  border-radius: 3px;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 3px,
      rgba(255, 255, 255, 0.03) 3px,
      rgba(255, 255, 255, 0.03) 6px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 3px,
      rgba(255, 255, 255, 0.03) 3px,
      rgba(255, 255, 255, 0.03) 6px
    );
}

.back-center {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.back-logo {
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 1px;
  transform: rotate(-45deg);
}

.back-border-inner {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  position: absolute;
}

.back-corner {
  position: absolute;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;

  &.top-left {
    top: 4px;
    left: 4px;
  }

  &.bottom-right {
    bottom: 4px;
    right: 4px;
    transform: rotate(180deg);
  }
}

.back-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}
</style>
