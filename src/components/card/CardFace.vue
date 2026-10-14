<template>
  <div class="card-face" :class="[`card-type--${cardTypeClass}`, { 'card--selected': selected }]">
    <!-- 左上角标：花色 + 点数 -->
    <div class="corner top-left">
      <span class="corner-rank" :class="suitColorClass">{{ rankDisplay }}</span>
      <span class="corner-suit" :class="suitColorClass">{{ suitSymbol }}</span>
    </div>

    <!-- 右下角标（倒置） -->
    <div class="corner bottom-right">
      <span class="corner-rank" :class="suitColorClass">{{ rankDisplay }}</span>
      <span class="corner-suit" :class="suitColorClass">{{ suitSymbol }}</span>
    </div>

    <!-- 中央内容 -->
    <div class="card-center">
      <!-- 类型图标区 -->
      <div class="type-icon">
        <span class="type-emoji">{{ typeIcon }}</span>
      </div>

      <!-- 卡牌名称（换皮后的名字，欠账 D27） -->
      <div class="card-name">{{ displayName }}</div>

      <!-- 装备槽位标识 -->
      <div v-if="card.equipSlot" class="equip-slot-tag">
        {{ equipSlotLabel }}
      </div>

      <!-- 攻击范围标识 -->
      <div v-if="card.attackRange" class="attack-range">
        范围 {{ card.attackRange }}
      </div>
    </div>

    <!-- 底部描述 -->
    <div class="card-description" v-if="displayDescription">
      {{ displayDescription }}
    </div>

    <!-- 延时标记 -->
    <div v-if="card.isDelayed" class="delayed-badge">
      <n-tag type="warning" size="tiny" round>延时</n-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NTag } from 'naive-ui'
import { CardSuit, CardType, EquipSlot } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import { CardTag } from '@core/contracts/card-tag'
import { lolCardDescription, lolCardName } from '@source/theme/lol-mapping'

const props = defineProps<{
  card: ICard
  selected?: boolean
  playable?: boolean
  size?: 'small' | 'normal' | 'large'
}>()

// ── 换皮（欠账 D27）──
//
// 卡面是**全仓唯一画牌名的地方**（手牌 / 装备 / 判定 / 响应弹窗都走这个组件），
// 所以换皮只准发生在这里：引擎那张牌的 `id` 是稳定 ID，`name` 是三国杀原名，
// 界面上显示的是查表换出来的 LOL 名。查不到就显示原名——皮肤缺一块，
// 也比显示空白强。
const displayName = computed(() => lolCardName(props.card.id, props.card.name))

const displayDescription = computed(() =>
  lolCardDescription(props.card.id, props.card.description),
)

// ── 花色符号 ──
const SUIT_SYMBOLS: Record<CardSuit, string> = {
  [CardSuit.Spade]: '♠',
  [CardSuit.Heart]: '♥',
  [CardSuit.Club]: '♣',
  [CardSuit.Diamond]: '♦',
  [CardSuit.None]: '',
}

const suitSymbol = computed(() => SUIT_SYMBOLS[props.card.suit] ?? '')

// ── 花色颜色 ──
const suitColorClass = computed(() => {
  if (props.card.suit === CardSuit.Heart || props.card.suit === CardSuit.Diamond) {
    return 'suit-red'
  }
  if (props.card.suit === CardSuit.None) {
    return 'suit-none'
  }
  return 'suit-black'
})

// ── 点数显示 ──
const RANK_LABELS: Record<number, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5',
  6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K',
}

const rankDisplay = computed(() => {
  return RANK_LABELS[props.card.rank] ?? String(props.card.rank)
})

// ── 卡牌类型 Class ──
const cardTypeClass = computed(() => {
  return props.card.type
})

// ── 类型图标 ──
const typeIcon = computed(() => {
  switch (props.card.type) {
    case CardType.Basic:
      // 根据 tag 细分
      if (props.card.tags.has(CardTag.Strike)) return '⚔️'
      if (props.card.tags.has(CardTag.Dodge)) return '🛡️'
      if (props.card.tags.has(CardTag.Heal)) return '🍑'
      if (props.card.tags.has(CardTag.Wine)) return '🍺'
      return '📜'
    case CardType.Rune:
      return '✨'
    case CardType.Talent:
      return '⭐'
    case CardType.Equip:
      if (props.card.equipSlot === EquipSlot.Weapon) return '🗡️'
      if (props.card.equipSlot === EquipSlot.Armor) return '🛡️'
      if (props.card.equipSlot === EquipSlot.OffensiveHorse) return '🐴'
      if (props.card.equipSlot === EquipSlot.DefensiveHorse) return '🐎'
      if (props.card.equipSlot === EquipSlot.Treasure) return '💎'
      return '🔧'
    default:
      return '🃏'
  }
})

// ── 装备槽位标签 ──
const equipSlotLabel = computed(() => {
  switch (props.card.equipSlot) {
    case EquipSlot.Weapon: return '武器'
    case EquipSlot.Armor: return '防具'
    case EquipSlot.OffensiveHorse: return '-1 马'
    case EquipSlot.DefensiveHorse: return '+1 马'
    case EquipSlot.Treasure: return '宝物'
    default: return ''
  }
})
</script>

<style lang="less" scoped>
// ── 通用卡牌样式 ──
.card-face {
  position: relative;
  width: 76px;
  height: 108px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
  background: #faf8f0;
  border: 2px solid #bbb;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }

  &.card--selected {
    transform: translateY(-12px);
    box-shadow: 0 8px 24px rgba(255, 215, 0, 0.5);
    border-color: #ffd700;
    border-width: 3px;
  }
}

// ── 类型边框颜色 ──
.card-type--basic {
  border-color: #c0392b;
  background: linear-gradient(180deg, #fef5f5, #faf0f0, #fef5f5);
}
.card-type--rune {
  border-color: #2471a3;
  background: linear-gradient(180deg, #f0f5fa, #eaf0f8, #f0f5fa);
}
.card-type--talent {
  border-color: #7d3c98;
  background: linear-gradient(180deg, #f8f0fa, #f3e8f7, #f8f0fa);
}
.card-type--equip {
  border-color: #1e8449;
  background: linear-gradient(180deg, #f0faf4, #e8f5ec, #f0faf4);
}

// ── 角标 ──
.corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
}

.top-left {
  top: 4px;
  left: 5px;
}

.bottom-right {
  bottom: 4px;
  right: 5px;
  transform: rotate(180deg);
}

.corner-rank {
  font-size: 15px;
  font-weight: 700;
}

.corner-suit {
  font-size: 10px;
  margin-top: -1px;
}

.suit-red {
  color: #c0392b;
}

.suit-black {
  color: #1a1a1a;
}

.suit-none {
  color: transparent;
  visibility: hidden;
}

// ── 中央区域 ──
.card-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
}

.type-emoji {
  font-size: 22px;
  line-height: 1;
}

.card-name {
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
  white-space: nowrap;
  text-align: center;
}

.equip-slot-tag {
  font-size: 9px;
  color: #1e8449;
  background: rgba(30, 132, 73, 0.1);
  padding: 0 4px;
  border-radius: 2px;
}

.attack-range {
  font-size: 9px;
  color: #c0392b;
  font-weight: 600;
}

// ── 描述 ──
.card-description {
  font-size: 8px;
  color: #555;
  text-align: center;
  line-height: 1.3;
  max-width: 62px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  margin-bottom: 2px;
}

// ── 延时标记 ──
.delayed-badge {
  position: absolute;
  top: 4px;
  right: 4px;
}
</style>
