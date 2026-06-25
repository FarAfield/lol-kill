<template>
  <div
    class="player-seat"
    :class="{
      'is-current': isCurrent,
      'is-dead': !player.alive,
      'is-human': isHuman,
      'is-targetable': isTargetable,
      'is-selected-target': isSelectedTarget,
      'is-hovered-target': isHoveredTarget,
    }"
    :style="seatStyle"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 身份标记 -->
    <div v-if="player.roleRevealed" class="role-badge">
      <n-tag :type="roleTagType" size="tiny" round>
        {{ roleLabel }}
      </n-tag>
    </div>

    <!-- 座位主体 -->
    <div class="seat-body">
      <!-- 体力值（勾玉） -->
      <div class="hp-display">
        <div
          v-for="i in player.maxHp"
          :key="i"
          class="hp-jewel"
          :class="{ lost: i > player.hp }"
          :title="`体力 ${Math.min(i, player.hp)}/${player.maxHp}`"
        >
          <span class="jewel-inner" />
        </div>
      </div>

      <!-- 英雄信息 -->
      <div class="hero-info">
        <div class="hero-avatar">
          <n-avatar
            :size="48"
            round
            :style="{
              background: heroGradient,
              filter: player.alive ? 'none' : 'grayscale(100%)',
            }"
          >
            {{ heroInitial }}
          </n-avatar>
        </div>
        <div class="hero-name">{{ player.name }}</div>
        <div class="hero-title" v-if="player.hero?.title">
          {{ player.hero.title }}
        </div>
      </div>

      <!-- 手牌数 / 装备标记 -->
      <div class="card-indicators">
        <div class="hand-badge">
          <n-tag size="small" round :type="player.handCount > 0 ? 'info' : 'default'">
            {{ isHuman ? `手牌 ×${player.handCount}` : `${player.handCount} 张` }}
          </n-tag>
        </div>

        <!-- 装备区 -->
        <CardEquip
          v-if="player.equipCards.length > 0"
          :equip-cards="player.equipCards"
          :compact="!isHuman"
        />

        <!-- 判定区 -->
        <CardJudge
          v-if="player.judgeCards.length > 0"
          :judge-cards="player.judgeCards"
          :compact="true"
        />
      </div>
    </div>

    <!-- 人类玩家手牌区（座位下方额外展示） -->
    <div v-if="isHuman && player.handCount > 0" class="human-hand-area">
      <!-- 手牌由父组件的 CardHand 处理，此处仅显示指示 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NAvatar, NTag } from 'naive-ui'
import { RoleType, Kingdom } from '@core/contracts/enums'
import type { UIPlayerInfo } from '@/store/game-store'
import CardEquip from '@/components/card/CardEquip.vue'
import CardJudge from '@/components/card/CardJudge.vue'

const props = defineProps<{
  player: UIPlayerInfo
  x: number
  y: number
  isCurrent: boolean
  isHuman: boolean
  /** 是否可作为出牌目标 */
  isTargetable?: boolean
  /** 是否已被选中为目标 */
  isSelectedTarget?: boolean
  /** 是否正被悬停 */
  isHoveredTarget?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-target', playerId: string): void
  (e: 'hover-target', playerId: string | null): void
}>()

// ── 座位定位 ──
const seatStyle = computed(() => ({
  left: `${props.x}%`,
  top: `${props.y}%`,
}))

// ── 身份标签 ──
const roleLabel = computed(() => {
  switch (props.player.role) {
    case RoleType.Aspect: return '天命星灵'
    case RoleType.Guardian: return '守护者'
    case RoleType.Ascended: return '飞升者'
    case RoleType.Infiltrator: return '潜伏者'
    default: return '?'
  }
})

const roleTagType = computed<'error' | 'success' | 'warning' | 'info' | 'default'>(() => {
  switch (props.player.role) {
    case RoleType.Aspect: return 'error'
    case RoleType.Guardian: return 'success'
    case RoleType.Ascended: return 'warning'
    case RoleType.Infiltrator: return 'info'
    default: return 'default'
  }
})

// ── 英雄头像 ──
const heroInitial = computed(() => {
  return props.player.hero?.name?.charAt(0) ?? props.player.name.charAt(0)
})

const heroGradient = computed(() => {
  const kingdom = props.player.hero?.kingdom
  switch (kingdom) {
    case Kingdom.Demacia:
      return 'linear-gradient(135deg, #1565C0, #42A5F5)'
    case Kingdom.Noxus:
      return 'linear-gradient(135deg, #B71C1C, #EF5350)'
    case Kingdom.Ionia:
      return 'linear-gradient(135deg, #2E7D32, #66BB6A)'
    default:
      return 'linear-gradient(135deg, #546E7A, #90A4AE)'
  }
})

// ── 目标选择方法 ──
function handleClick(): void {
  if (props.isTargetable && props.player.alive) {
    emit('select-target', props.player.id)
  }
}

function handleMouseEnter(): void {
  if (props.isTargetable && props.player.alive) {
    emit('hover-target', props.player.id)
  }
}

function handleMouseLeave(): void {
  emit('hover-target', null)
}
</script>

<style lang="less" scoped>
.player-seat {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 5;
  transition: filter 0.3s, opacity 0.3s;

  &.is-current {
    z-index: 8;
    .seat-body {
      border-color: #ffd700;
      box-shadow:
        0 0 12px rgba(255, 215, 0, 0.6),
        0 0 28px rgba(255, 215, 0, 0.25);
    }
  }

  &.is-dead {
    opacity: 0.5;
    filter: grayscale(70%);
  }

  // ── 目标选择状态 ──
  &.is-targetable {
    cursor: pointer;

    .seat-body {
      border-color: rgba(32, 128, 240, 0.5);
      box-shadow: 0 0 8px rgba(32, 128, 240, 0.3);
    }

    &:hover {
      z-index: 9;
      .seat-body {
        border-color: #2080f0;
        box-shadow: 0 0 16px rgba(32, 128, 240, 0.5);
        transform: scale(1.05);
      }
    }
  }

  &.is-selected-target {
    z-index: 10 !important;

    .seat-body {
      border-color: #d03050 !important;
      border-width: 3px;
      box-shadow:
        0 0 16px rgba(208, 48, 80, 0.6),
        0 0 32px rgba(208, 48, 80, 0.25) !important;
      animation: pulse-target 1s ease-in-out infinite;
    }
  }

  &.is-hovered-target {
    z-index: 9;
    .seat-body {
      border-color: #2080f0;
      box-shadow: 0 0 12px rgba(32, 128, 240, 0.4);
    }
  }
}

@keyframes pulse-target {
  0%, 100% { box-shadow: 0 0 12px rgba(208, 48, 80, 0.5), 0 0 24px rgba(208, 48, 80, 0.2); }
  50% { box-shadow: 0 0 20px rgba(208, 48, 80, 0.7), 0 0 36px rgba(208, 48, 80, 0.35); }
}

.role-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.seat-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.55);
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  backdrop-filter: blur(8px);
  min-width: 110px;
  transition: border-color 0.3s, box-shadow 0.3s;
}

// ── 体力勾玉 ──
.hp-display {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.hp-jewel {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #4caf50, #1b5e20);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 4px rgba(76, 175, 80, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;

  &.lost {
    background: radial-gradient(circle at 35% 35%, #555, #222);
    box-shadow: none;
    border-color: rgba(255, 255, 255, 0.1);
  }
}

// ── 英雄信息 ──
.hero-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hero-avatar {
  margin-bottom: 2px;
}

.hero-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  white-space: nowrap;
}

.hero-title {
  font-size: 10px;
  color: #aaa;
  white-space: nowrap;
}

// ── 卡牌指示器 ──
.card-indicators {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.hand-badge {
  font-size: 12px;
}

.human-hand-area {
  margin-top: 6px;
}
</style>
