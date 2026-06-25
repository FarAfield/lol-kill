<template>
  <div class="player-info" v-if="player">
    <!-- 英雄区域 -->
    <div class="hero-section">
      <n-avatar :size="56" round :style="{ background: heroGradient }">
        {{ heroInitial }}
      </n-avatar>
      <div class="hero-text">
        <div class="hero-name">{{ player.name }}</div>
        <div class="hero-title" v-if="player.hero?.title">
          {{ player.hero.title }}
        </div>
        <div class="hero-kingdom">
          <n-tag :type="kingdomTagType" size="tiny" round>
            {{ kingdomLabel }}
          </n-tag>
        </div>
      </div>
    </div>

    <n-divider style="margin: 8px 0" />

    <!-- 体力与能量 -->
    <div class="stats">
      <div class="stat-row">
        <span class="stat-label">体力</span>
        <div class="hp-bar">
          <div
            v-for="i in player.maxHp"
            :key="'hp' + i"
            class="hp-dot"
            :class="{ lost: i > player.hp }"
          />
        </div>
        <span class="stat-value">{{ player.hp }}/{{ player.maxHp }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">能量</span>
        <div class="power-bar">
          <div
            v-for="i in player.maxPower"
            :key="'pow' + i"
            class="power-dot"
            :class="{ lost: i > player.power }"
          />
        </div>
        <span class="stat-value">{{ player.power }}/{{ player.maxPower }}</span>
      </div>
    </div>

    <n-divider style="margin: 8px 0" />

    <!-- 手牌数 -->
    <div class="card-stats">
      <div class="card-stat">
        <n-text depth="3">手牌</n-text>
        <n-text>{{ player.handCount }}</n-text>
      </div>
      <div class="card-stat">
        <n-text depth="3">装备</n-text>
        <n-text>{{ player.equipCards.length }}</n-text>
      </div>
    </div>

    <!-- 装备区详情 -->
    <div v-if="player.equipCards.length > 0" class="equip-detail">
      <div
        v-for="card in player.equipCards"
        :key="card.id"
        class="equip-item"
      >
        <n-tag size="tiny" :bordered="false">
          {{ card.name }}
        </n-tag>
      </div>
    </div>
  </div>

  <div v-else class="player-info empty">
    <n-text depth="3">无玩家信息</n-text>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NAvatar, NTag, NDivider, NText } from 'naive-ui'
import { Kingdom } from '@core/contracts/enums'
import type { UIPlayerInfo } from '@/store/game-store'

const props = defineProps<{
  player: UIPlayerInfo | null
}>()

const heroInitial = computed(() => {
  return props.player?.hero?.name?.charAt(0) ?? props.player?.name?.charAt(0) ?? '?'
})

const heroGradient = computed(() => {
  const kingdom = props.player?.hero?.kingdom
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

const kingdomLabel = computed(() => {
  switch (props.player?.hero?.kingdom) {
    case Kingdom.Demacia: return '德玛西亚'
    case Kingdom.Noxus: return '诺克萨斯'
    case Kingdom.Ionia: return '艾欧尼亚'
    default: return '未知'
  }
})

const kingdomTagType = computed<'info' | 'error' | 'success' | 'default'>(() => {
  switch (props.player?.hero?.kingdom) {
    case Kingdom.Demacia: return 'info'
    case Kingdom.Noxus: return 'error'
    case Kingdom.Ionia: return 'success'
    default: return 'default'
  }
})
</script>

<style lang="less" scoped>
.player-info {
  padding: 12px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 8px;
  min-width: 180px;

  &.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100px;
  }
}

.hero-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-text {
  display: flex;
  flex-direction: column;
}

.hero-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.hero-title {
  font-size: 11px;
  color: #aaa;
  margin-bottom: 2px;
}

.hero-kingdom {
  margin-top: 2px;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 12px;
  color: #999;
  width: 28px;
}

.hp-bar,
.power-bar {
  display: flex;
  gap: 3px;
}

.hp-dot,
.power-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.hp-dot {
  background: radial-gradient(circle at 35% 35%, #4caf50, #1b5e20);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 3px rgba(76, 175, 80, 0.5);

  &.lost {
    background: #333;
    box-shadow: none;
    border-color: rgba(255, 255, 255, 0.1);
  }
}

.power-dot {
  background: radial-gradient(circle at 35% 35%, #9c27b0, #4a148c);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 3px rgba(156, 39, 176, 0.5);

  &.lost {
    background: #333;
    box-shadow: none;
    border-color: rgba(255, 255, 255, 0.1);
  }
}

.stat-value {
  font-size: 12px;
  color: #ccc;
}

.card-stats {
  display: flex;
  justify-content: space-around;
}

.card-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  gap: 2px;
}

.equip-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.equip-item {
  font-size: 12px;
}
</style>
