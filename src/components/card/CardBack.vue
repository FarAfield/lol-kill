<template>
  <!--
    卡背。**只吃一个张数**，不吃整叠真牌。

    对手的手牌是**暗牌**：把一叠真的卡牌对象递到这个组件里，
    组件就有了「顺便显示一下花色」的余地——那等于给「对手有什么」
    开了第二个答案（第一个答案是「没有」）。所以这里只收一个张数，
    一眼也看不到单张牌的任何信息。
    （下方那条源码级断言按模式匹配盯着这件事，所以这里不写出那个类型名。）
  -->
  <div class="card-back-stack" :class="`stack--${size}`" :title="title">
    <div v-for="i in shown" :key="i" class="card-back" :style="offsetOf(i)" />
    <span v-if="overflow > 0" class="overflow-badge">+{{ overflow }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** 要画几张卡背 —— 就是对手的手牌张数 */
  count: number
  /** 最多画几张。多出来的折成一个「+N」，免得手牌一多就把座位撑爆 */
  max?: number
  size?: 'small' | 'normal'
}>()

const DEFAULT_MAX = 10

const shown = computed(() =>
  Math.max(0, Math.min(props.count, props.max ?? DEFAULT_MAX)),
)

/** 折进「+N」里的那几张 */
const overflow = computed(() => Math.max(0, props.count - shown.value))

const title = computed(() => `${props.count} 张手牌`)

/**
 * 每张往右挪一点，堆出「一叠牌」的样子
 *
 * 用 `z-index` 而不是只挪位置：后画的盖住先画的，
 * 反过来（先画的盖住后画的）看起来就是朝另一边叠。
 */
function offsetOf(i: number): Record<string, string> {
  return { left: `${(i - 1) * 6}px`, zIndex: String(i) }
}
</script>

<style lang="less" scoped>
.card-back-stack {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 40px;
}

.card-back {
  position: absolute;
  top: 0;
  border-radius: 4px;
  border: 1px solid #3b4a6b;
  background: repeating-linear-gradient(
      45deg,
      #2c3e6b 0 4px,
      #35497f 4px 8px
    ),
    #2c3e6b;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  box-sizing: border-box;
}

.stack--normal .card-back {
  width: 28px;
  height: 40px;
}

.stack--small .card-back {
  width: 20px;
  height: 28px;
}

.overflow-badge {
  position: relative;
  margin-left: 2px;
  font-size: 10px;
  font-weight: 600;
  color: #33415c;
  background: rgba(255, 255, 255, 0.75);
  border-radius: 6px;
  padding: 0 3px;
}
</style>
