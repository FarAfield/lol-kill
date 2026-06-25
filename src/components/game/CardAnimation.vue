<!--
  联盟杀 · CardAnimation — 卡牌动画覆盖层

  渲染飞行卡牌、座位特效等动画覆盖层。
  叠加在 GameBoard 上方，使用 position:absolute 定位。

  动画效果：
  - 摸牌：牌堆 → 玩家手牌区（滑动 + 旋转）
  - 出牌：手牌 → 目标（抛物线飞行）
  - 弃牌：手牌 → 弃牌堆（翻转缩小）
  - 伤害：目标座位抖动 + 伤害数字飘出
  - 回复：目标座位绿色光晕
  - 死亡：灰色光晕扩散
  - 技能：发光扩散
-->
<template>
  <div class="card-animation-overlay" aria-hidden="true">
    <!-- 飞行的卡牌 -->
    <TransitionGroup name="flying-card" tag="div" class="flying-cards-layer">
      <div
        v-for="anim in flyingAnims"
        :key="anim.id"
        class="flying-card"
        :class="[`flying--${anim.type}`]"
        :style="getFlyingCardStyle(anim)"
      >
        <div class="flying-card-inner">
          <span class="flying-card-icon">{{ getAnimIcon(anim.type) }}</span>
        </div>
      </div>
    </TransitionGroup>

    <!-- 座位特效层（抖动、闪烁等） -->
    <div class="seat-effects-layer">
      <div
        v-for="anim in seatEffectAnims"
        :key="anim.id"
        class="seat-effect"
        :class="[`effect--${anim.type}`]"
        :style="getSeatEffectStyle(anim)"
      >
        <!-- 伤害数字 -->
        <span
          v-if="anim.type === 'damage' && anim.amount"
          class="damage-number"
          :style="{ animationDuration: `${anim.duration}ms` }"
        >
          -{{ anim.amount }}
        </span>

        <!-- 回复数字 -->
        <span
          v-if="anim.type === 'heal' && anim.amount"
          class="heal-number"
          :style="{ animationDuration: `${anim.duration}ms` }"
        >
          +{{ anim.amount }}
        </span>

        <!-- 死亡特效 -->
        <div v-if="anim.type === 'death'" class="death-ripple">
          <div class="ripple-ring" />
          <span class="death-text">阵亡</span>
        </div>

        <!-- 技能特效 -->
        <div v-if="anim.type === 'skill'" class="skill-burst">
          <span class="skill-name">{{ anim.skillName }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AnimationType, AnimationState } from '@/hooks/useAnimation'

// ── Props ──
const props = defineProps<{
  /** 所有动画状态 */
  animations: AnimationState[]
  /** 座位位置映射（playerId → {x, y} 百分比坐标） */
  seatPositions?: Map<string, { x: number; y: number }>
  /** 牌堆位置（百分比坐标，默认中央偏上） */
  deckPosition?: { x: number; y: number }
  /** 弃牌堆位置（百分比坐标，默认中央偏下偏右） */
  discardPosition?: { x: number; y: number }
}>()

// ── 默认位置 ──
const defaultDeckPos = { x: 42, y: 48 }
const defaultDiscardPos = { x: 58, y: 48 }

const deckPos = computed(() => props.deckPosition ?? defaultDeckPos)
const discardPos = computed(() => props.discardPosition ?? defaultDiscardPos)

// ── 需要飞行的动画类型 ──
const FLYING_TYPES: Set<AnimationType> = new Set(['draw', 'play', 'discard', 'equip'])

/** 需要渲染飞行卡牌的动画 */
const flyingAnims = computed(() =>
  props.animations.filter(
    (a) =>
      a.status === 'playing' &&
      FLYING_TYPES.has(a.type),
  ),
)

// ── 需要座位特效的动画类型 ──
const SEAT_EFFECT_TYPES: Set<AnimationType> = new Set(['damage', 'heal', 'death', 'skill'])

/** 需要渲染座位特效的动画 */
const seatEffectAnims = computed(() =>
  props.animations.filter(
    (a) =>
      a.status === 'playing' &&
      SEAT_EFFECT_TYPES.has(a.type),
  ),
)

// ── 飞行卡牌样式计算 ──
function getFlyingCardStyle(anim: AnimationState): Record<string, string> {
  const progress = anim.progress

  // 确定起点和终点
  let fromX = 50, fromY = 50
  let toX = 50, toY = 50

  switch (anim.type) {
    case 'draw': {
      // 牌堆 → 玩家座位
      fromX = deckPos.value.x
      fromY = deckPos.value.y
      const seat = anim.playerId
        ? props.seatPositions?.get(anim.playerId)
        : undefined
      toX = seat?.x ?? 50
      toY = seat?.y ?? 80
      break
    }

    case 'play': {
      // 来源玩家 → 目标玩家
      const fromSeat = anim.fromPlayerId
        ? props.seatPositions?.get(anim.fromPlayerId)
        : undefined
      const toSeat = anim.targetPlayerId
        ? props.seatPositions?.get(anim.targetPlayerId)
        : undefined
      fromX = fromSeat?.x ?? 50
      fromY = fromSeat?.y ?? 80
      toX = toSeat?.x ?? 50
      toY = toSeat?.y ?? 50
      break
    }

    case 'discard': {
      // 玩家座位 → 弃牌堆
      const seat = anim.playerId
        ? props.seatPositions?.get(anim.playerId)
        : undefined
      fromX = seat?.x ?? 50
      fromY = seat?.y ?? 80
      toX = discardPos.value.x
      toY = discardPos.value.y
      break
    }

    case 'equip': {
      // 手牌区 → 装备区（本地）
      const seat = anim.playerId
        ? props.seatPositions?.get(anim.playerId)
        : undefined
      fromX = seat?.x ?? 50
      fromY = (seat?.y ?? 80) + 5
      toX = seat?.x ?? 50
      toY = (seat?.y ?? 80) - 2
      break
    }
  }

  // 插值 + 抛物线
  const easeInOut = progress < 0.5
    ? 2 * progress * progress
    : -1 + (4 - 2 * progress) * progress

  const currentX = fromX + (toX - fromX) * easeInOut
  const currentY = fromY + (toY - fromY) * easeInOut

  // 抛物线偏移（仅 play 类型有弧线）
  const arcHeight = anim.type === 'play' ? -12 * Math.sin(progress * Math.PI) : 0
  const arcX = anim.type === 'play' ? 0 : 0

  const finalY = currentY + arcHeight
  const finalX = currentX + arcX

  // 旋转（discard 翻转）
  const rotation = anim.type === 'discard'
    ? `${progress * 180}deg`
    : anim.type === 'play'
      ? `${Math.sin(progress * Math.PI * 2) * 8}deg`
      : '0deg'

  // 缩放
  const scale = anim.type === 'discard'
    ? `${1 - progress * 0.3}`
    : anim.type === 'draw'
      ? `${0.5 + progress * 0.5}`
      : '1'

  // 透明度
  const opacity = anim.type === 'discard'
    ? `${1 - progress * 0.6}`
    : '1'

  return {
    left: `${finalX}%`,
    top: `${finalY}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}) scale(${scale})`,
    opacity,
  }
}

/** 获取座位特效的定位样式 */
function getSeatEffectStyle(anim: AnimationState): Record<string, string> {
  const playerId = anim.type === 'damage' || anim.type === 'heal' || anim.type === 'death'
    ? anim.targetPlayerId
    : anim.playerId

  const seat = playerId
    ? props.seatPositions?.get(playerId)
    : undefined

  return {
    left: `${seat?.x ?? 50}%`,
    top: `${seat?.y ?? 50}%`,
  }
}

/** 动画类型图标 */
function getAnimIcon(type: AnimationType): string {
  switch (type) {
    case 'draw': return '🃏'
    case 'play': return '⚔️'
    case 'discard': return '🗑️'
    case 'equip': return '🔧'
    default: return '🃏'
  }
}
</script>

<style lang="less" scoped>
.card-animation-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
}

// ── 飞行卡牌层 ──
.flying-cards-layer {
  position: absolute;
  inset: 0;
}

.flying-card {
  position: absolute;
  will-change: transform, opacity, left, top;
  z-index: 55;
}

.flying-card-inner {
  width: 40px;
  height: 56px;
  border-radius: 4px;
  background: linear-gradient(135deg, #faf8f0, #e8e4d0);
  border: 2px solid rgba(180, 160, 120, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.3);
}

.flying-card-icon {
  font-size: 18px;
}

// 类型微调
.flying--draw .flying-card-inner {
  border-color: rgba(52, 152, 219, 0.7);
  box-shadow: 0 4px 16px rgba(52, 152, 219, 0.4);
}

.flying--play .flying-card-inner {
  border-color: rgba(231, 76, 60, 0.7);
  box-shadow: 0 4px 16px rgba(231, 76, 60, 0.4);
}

.flying--discard .flying-card-inner {
  border-color: rgba(149, 165, 166, 0.7);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.flying--equip .flying-card-inner {
  border-color: rgba(46, 204, 113, 0.7);
  box-shadow: 0 4px 16px rgba(46, 204, 113, 0.4);
}

// ── 列表动画 ──
.flying-card-enter-active {
  transition: opacity 0.15s ease;
}

.flying-card-leave-active {
  transition: opacity 0.2s ease;
}

.flying-card-enter-from,
.flying-card-leave-to {
  opacity: 0;
}

// ── 座位特效层 ──
.seat-effects-layer {
  position: absolute;
  inset: 0;
}

.seat-effect {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 60;
  pointer-events: none;
}

// ── 伤害数字 ──
.damage-number {
  display: block;
  font-size: 28px;
  font-weight: 900;
  color: #e74c3c;
  text-shadow:
    0 0 8px rgba(231, 76, 60, 0.6),
    0 2px 4px rgba(0, 0, 0, 0.5);
  animation: float-up-damage 700ms ease-out forwards;
  pointer-events: none;
}

@keyframes float-up-damage {
  0% {
    opacity: 1;
    transform: translateY(0) scale(0.5);
  }
  20% {
    opacity: 1;
    transform: translateY(-20px) scale(1.3);
  }
  100% {
    opacity: 0;
    transform: translateY(-60px) scale(0.8);
  }
}

// ── 回复数字 ──
.heal-number {
  display: block;
  font-size: 28px;
  font-weight: 900;
  color: #2ecc71;
  text-shadow:
    0 0 8px rgba(46, 204, 113, 0.6),
    0 2px 4px rgba(0, 0, 0, 0.5);
  animation: float-up-heal 600ms ease-out forwards;
  pointer-events: none;
}

@keyframes float-up-heal {
  0% {
    opacity: 1;
    transform: translateY(0) scale(0.5);
  }
  20% {
    opacity: 1;
    transform: translateY(-15px) scale(1.2);
  }
  100% {
    opacity: 0;
    transform: translateY(-50px) scale(0.7);
  }
}

// ── 死亡特效 ──
.death-ripple {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100px;
  height: 100px;
}

.ripple-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid rgba(192, 57, 43, 0.7);
  animation: ripple-expand 800ms ease-out forwards;
}

@keyframes ripple-expand {
  0% {
    transform: scale(0.3);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.death-text {
  font-size: 20px;
  font-weight: 900;
  color: #c0392b;
  text-shadow:
    0 0 12px rgba(192, 57, 43, 0.8),
    0 2px 6px rgba(0, 0, 0, 0.7);
  z-index: 2;
  animation: death-text-fade 800ms ease-out forwards;
}

@keyframes death-text-fade {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  30% {
    opacity: 1;
    transform: scale(1.2);
  }
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
}

// ── 技能特效 ──
.skill-burst {
  display: flex;
  align-items: center;
  justify-content: center;
}

.skill-name {
  font-size: 16px;
  font-weight: 700;
  color: #9b59b6;
  text-shadow:
    0 0 10px rgba(155, 89, 182, 0.6),
    0 2px 4px rgba(0, 0, 0, 0.5);
  padding: 4px 12px;
  border-radius: 16px;
  background: rgba(155, 89, 182, 0.15);
  border: 1px solid rgba(155, 89, 182, 0.4);
  animation: skill-glow 500ms ease-out forwards;
}

@keyframes skill-glow {
  0% {
    opacity: 0;
    transform: scale(0.5);
    box-shadow: 0 0 20px rgba(155, 89, 182, 0.8);
  }
  30% {
    opacity: 1;
    transform: scale(1.1);
    box-shadow: 0 0 30px rgba(155, 89, 182, 0.6);
  }
  100% {
    opacity: 0.8;
    transform: scale(1);
    box-shadow: 0 0 5px rgba(155, 89, 182, 0.2);
  }
}

// ── 伤害抖动效果（父组件通过 class 触发） ──
// 使用方式：在 PlayerSeat 上通过条件添加 .seat-shake 类
:global(.seat-shake) {
  animation: seat-shake 400ms ease-out;
}

@keyframes seat-shake {
  0%, 100% { transform: translate(-50%, -50%); }
  10% { transform: translate(calc(-50% - 6px), -50%); }
  20% { transform: translate(calc(-50% + 6px), -50%); }
  30% { transform: translate(calc(-50% - 4px), -50%); }
  40% { transform: translate(calc(-50% + 4px), -50%); }
  50% { transform: translate(calc(-50% - 2px), -50%); }
  60% { transform: translate(calc(-50% + 2px), -50%); }
  70% { transform: translate(calc(-50% - 1px), -50%); }
}

// ── 回复光晕效果 ──
:global(.seat-heal-glow) {
  animation: heal-glow 500ms ease-out;
}

@keyframes heal-glow {
  0% { box-shadow: 0 0 0 rgba(46, 204, 113, 0); }
  50% { box-shadow: 0 0 24px rgba(46, 204, 113, 0.6); }
  100% { box-shadow: 0 0 0 rgba(46, 204, 113, 0); }
}

// ── 黑色渐变死亡 ──
:global(.seat-death-fade) {
  animation: death-fade 800ms ease-out forwards;
}

@keyframes death-fade {
  0% { filter: grayscale(0%); opacity: 1; }
  100% { filter: grayscale(100%); opacity: 0.5; }
}
</style>
