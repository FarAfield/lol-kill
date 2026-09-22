<template>
  <div class="game-board">
    <!-- 毛毡纹理背景 -->
    <div class="felt-bg" />

    <!-- 中央区域：牌堆 + 弃牌堆 -->
    <div class="center-area">
      <div class="deck-zone">
        <div class="deck-pile">
          <n-tag type="info" size="small" round>牌堆</n-tag>
          <span class="pile-count">0</span>
        </div>
      </div>
      <div class="discard-zone">
        <div class="discard-pile">
          <n-tag size="small" round>弃牌堆</n-tag>
          <span class="pile-count">0</span>
        </div>
      </div>
    </div>

    <!-- 玩家座位 -->
    <PlayerSeat
      v-for="player in positionedPlayers"
      :key="player.id"
      :player="player"
      :x="player.x"
      :y="player.y"
      :is-current="player.isCurrentPlayer"
      :is-human="player.seatIndex === 0"
      :is-targetable="validTargetIds.has(player.id)"
      :is-selected-target="selectedTargetIds.includes(player.id)"
      :is-hovered-target="hoveredTargetId === player.id"
      @select-target="(id: string) => $emit('select-target', id)"
      @hover-target="(id: string | null) => $emit('hover-target', id)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NTag } from 'naive-ui'
import type { UIPlayerInfo } from '@/store/game-store'
import PlayerSeat from './PlayerSeat.vue'

interface PositionedPlayer extends UIPlayerInfo {
  x: number
  y: number
}

const props = withDefaults(defineProps<{
  players: UIPlayerInfo[]
  currentPhase: string
  currentPlayerIndex: number
  /** 合法目标 ID 集合（用于高亮可选目标） */
  validTargetIds?: Set<string>
  /** 已选中的目标 ID 列表 */
  selectedTargetIds?: string[]
  /** 悬停的目标 ID */
  hoveredTargetId?: string | null
}>(), {
  validTargetIds: () => new Set<string>(),
  selectedTargetIds: () => [],
  hoveredTargetId: null,
})

const emit = defineEmits<{
  (e: 'select-target', playerId: string): void
  (e: 'hover-target', playerId: string | null): void
}>()

/**
 * 椭圆座位布局计算：
 * 8 个座位围绕椭圆排列，座位 0 在底部中央（人类玩家）。
 *
 * 角度分布（从右侧开始逆时针）：
 *   0: -90° (底部中央)
 *   1: -45° (右下)
 *   2: 0°   (正右)
 *   3: 45°  (右上)
 *   4: 90°  (顶部中央)
 *   5: 135° (左上)
 *   6: 180° (正左)
 *   7: 225° (左下)
 *
 * 返回百分比坐标（相对父容器），便于响应式缩放。
 */
const positionedPlayers = computed<PositionedPlayer[]>(() => {
  const count = props.players.length
  if (count === 0) return []

  // 椭圆参数（百分比坐标）
  const cx = 50 // 中心 X
  const cy = 48 // 中心 Y（略微偏上给手牌区留空间）
  const rx = 38 // 水平半轴
  const ry = 32 // 垂直半轴

  // 不同人数使用不同的起始角度和角度偏移
  const getPositions = (n: number): Array<{ x: number; y: number }> => {
    const positions: Array<{ x: number; y: number }> = []

    // 座位 0 始终在底部中央
    // 角度从顶部开始偏移
    const startAngle = -Math.PI / 2 // -90° = 顶部

    for (let i = 0; i < n; i++) {
      // seatIndex 0 在底部 = startAngle + π = 90° (bottom)
      const seatIndex = i
      // Map seatIndex to angle: seat 0 = bottom (90°), going counter-clockwise
      const angle = startAngle + Math.PI - (2 * Math.PI * seatIndex) / n

      const x = cx + rx * Math.cos(angle)
      const y = cy + ry * Math.sin(angle)

      positions.push({ x, y })
    }
    return positions
  }

  const positions = getPositions(count)

  return props.players
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((player, i) => ({
      ...player,
      x: positions[i]?.x ?? 50,
      y: positions[i]?.y ?? 50,
    }))
})
</script>

<style lang="less" scoped>
.game-board {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.felt-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, #1b5e20 0%, #0d3b0f 40%, #0a1f0a 100%),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.008) 2px,
      rgba(255, 255, 255, 0.008) 4px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.005) 2px,
      rgba(255, 255, 255, 0.005) 4px
    );
  border-radius: 8px;
}

.center-area {
  position: absolute;
  left: 50%;
  top: 48%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 24px;
  z-index: 10;
}

.deck-zone,
.discard-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.deck-pile,
.discard-pile {
  width: 80px;
  height: 110px;
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  backdrop-filter: blur(4px);
}

.pile-count {
  font-size: 18px;
  font-weight: bold;
  color: #ccc;
}
</style>
