<template>
  <div class="card-equip" :class="{ compact }">
    <div
      v-for="slot in equipSlots"
      :key="slot.key"
      class="equip-slot"
      :class="{ filled: slot.card !== null }"
    >
      <!-- 槽位标签 -->
      <div class="slot-label">{{ slot.label }}</div>

      <!-- 装备卡牌或空槽位 -->
      <div v-if="slot.card" class="slot-card">
        <CardFace :card="slot.card" size="small" />
      </div>
      <div v-else class="slot-empty">
        <span class="empty-icon">＋</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EquipSlot } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import CardFace from './CardFace.vue'

const props = defineProps<{
  equipCards: ICard[]
  compact?: boolean
}>()

interface EquipSlotInfo {
  key: EquipSlot
  label: string
  card: ICard | null
}

const equipSlots = computed<EquipSlotInfo[]>(() => {
  const slotOrder: Array<{ key: EquipSlot; label: string }> = [
    { key: EquipSlot.Weapon, label: '武器' },
    { key: EquipSlot.Armor, label: '防具' },
    { key: EquipSlot.OffensiveHorse, label: '-1' },
    { key: EquipSlot.DefensiveHorse, label: '+1' },
    { key: EquipSlot.Treasure, label: '宝' },
  ]

  return slotOrder.map((slot) => {
    const card = props.equipCards.find((c) => c.equipSlot === slot.key) ?? null
    return { ...slot, card }
  })
})
</script>

<style lang="less" scoped>
.card-equip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;

  &.compact {
    gap: 2px;

    .equip-slot {
      width: 36px;
      height: 50px;
    }

    .slot-label {
      font-size: 7px;
    }
  }
}

.equip-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 46px;

  &.filled {
    .slot-card {
      transform: scale(0.5);
      transform-origin: top center;
    }
  }
}

.slot-label {
  font-size: 9px;
  color: #999;
  white-space: nowrap;
}

.slot-empty {
  width: 32px;
  height: 44px;
  border: 1.5px dashed rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  color: rgba(255, 255, 255, 0.15);
  font-size: 14px;
}

.slot-card {
  // scale 由 .equip-slot.filled .slot-card 统一控制
}
</style>
