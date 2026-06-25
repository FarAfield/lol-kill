<template>
  <div class="phase-bar">
    <!-- 左侧：阶段流指示器 -->
    <div class="phase-flow">
      <div
        v-for="(phaseInfo, idx) in phaseFlowList"
        :key="phaseInfo.key"
        class="phase-step"
        :class="{
          active: phaseInfo.key === currentPhase,
          passed: phaseInfo.passed,
          upcoming: !phaseInfo.passed && phaseInfo.key !== currentPhase,
          skipped: phaseInfo.skipped,
        }"
      >
        <!-- 连接线 -->
        <div
          v-if="idx > 0"
          class="phase-connector"
          :class="{
            active: phaseInfo.passed || phaseInfo.key === currentPhase,
          }"
        />

        <!-- 阶段圆圈 -->
        <div class="phase-dot" :title="phaseInfo.label">
          <span class="dot-inner">{{ phaseInfo.icon }}</span>
        </div>

        <!-- 阶段标签 -->
        <div class="phase-label">
          <span>{{ phaseInfo.shortLabel }}</span>
        </div>
      </div>
    </div>

    <!-- 中间：轮次/存活信息 -->
    <div class="phase-info">
      <n-space align="center" :size="12">
        <n-tag size="small" round :bordered="false" type="info">
          第 {{ round }} 轮
        </n-tag>
        <n-tag size="small" round :bordered="false" type="warning">
          存活 {{ aliveCount }}/{{ totalCount }}
        </n-tag>
      </n-space>
    </div>

    <!-- 右侧：当前行动玩家 -->
    <div class="turn-info" v-if="currentPlayerName">
      <span class="turn-label">当前行动</span>
      <n-tag type="success" size="small" round>
        {{ currentPlayerName }}
      </n-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NSpace, NTag } from 'naive-ui'
import { GamePhase } from '@core/contracts/enums'

/** 阶段流步骤定义 */
interface PhaseStep {
  key: GamePhase
  label: string
  shortLabel: string
  icon: string
  isRoundPhase: boolean
}

const props = defineProps<{
  /** 当前阶段 */
  currentPhase: GamePhase
  /** 当前轮次 */
  round: number
  /** 存活玩家数 */
  aliveCount: number
  /** 总玩家数 */
  totalCount: number
  /** 当前行动玩家名称 */
  currentPlayerName?: string | null
  /** 本回合跳过的阶段 */
  skippedPhases?: GamePhase[]
}>()

// ── 阶段流定义 ──
const ALL_PHASE_STEPS: PhaseStep[] = [
  {
    key: GamePhase.PhasePre,
    label: '准备阶段',
    shortLabel: '准备',
    icon: '⚙️',
    isRoundPhase: true,
  },
  {
    key: GamePhase.PhaseJudge,
    label: '判定阶段',
    shortLabel: '判定',
    icon: '⚖️',
    isRoundPhase: true,
  },
  {
    key: GamePhase.PhaseDraw,
    label: '摸牌阶段',
    shortLabel: '摸牌',
    icon: '🎴',
    isRoundPhase: true,
  },
  {
    key: GamePhase.PhaseUse,
    label: '出牌阶段',
    shortLabel: '出牌',
    icon: '⚔️',
    isRoundPhase: true,
  },
  {
    key: GamePhase.PhaseDiscard,
    label: '弃牌阶段',
    shortLabel: '弃牌',
    icon: '🗑️',
    isRoundPhase: true,
  },
  {
    key: GamePhase.PhasePost,
    label: '结束阶段',
    shortLabel: '结束',
    icon: '🏁',
    isRoundPhase: true,
  },
]

/** 回合内阶段顺序 */
const ROUND_PHASE_ORDER: GamePhase[] = [
  GamePhase.PhasePre,
  GamePhase.PhaseJudge,
  GamePhase.PhaseDraw,
  GamePhase.PhaseUse,
  GamePhase.PhaseDiscard,
  GamePhase.PhasePost,
]

/** 带状态的阶段流列表 */
const phaseFlowList = computed(() => {
  const currentIdx = ROUND_PHASE_ORDER.indexOf(props.currentPhase)
  const skipped = new Set(props.skippedPhases ?? [])

  return ALL_PHASE_STEPS.map((step) => {
    const phaseIdx = ROUND_PHASE_ORDER.indexOf(step.key)
    const passed = currentIdx >= 0 && phaseIdx < currentIdx
    const isSkipped = skipped.has(step.key)

    return {
      ...step,
      passed,
      skipped: isSkipped,
    }
  })
})
</script>

<style lang="less" scoped>
.phase-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: linear-gradient(180deg, #16213e, #0f3460);
  border-bottom: 2px solid #533483;
  flex-shrink: 0;
  min-height: 44px;
  gap: 12px;
}

// ── 阶段流指示器 ──
.phase-flow {
  display: flex;
  align-items: center;
  gap: 0;
}

.phase-step {
  display: flex;
  align-items: center;
  position: relative;

  &.passed .phase-dot {
    background: #18a058;
    border-color: #18a058;
    box-shadow: 0 0 6px rgba(24, 160, 88, 0.3);
  }

  &.active .phase-dot {
    background: #2080f0;
    border-color: #2080f0;
    box-shadow: 0 0 10px rgba(32, 128, 240, 0.5);
    animation: pulse-dot 1.5s ease-in-out infinite;
  }

  &.upcoming .phase-dot {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.15);
  }

  &.skipped .phase-dot {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.08);
    opacity: 0.4;
  }
}

@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 6px rgba(32, 128, 240, 0.4); }
  50% { box-shadow: 0 0 14px rgba(32, 128, 240, 0.7); }
}

// 连接线
.phase-connector {
  width: 16px;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 2px;
  transition: background 0.3s;

  &.active {
    background: #18a058;
  }
}

// 阶段圆点
.phase-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  flex-shrink: 0;
}

.dot-inner {
  font-size: 12px;
  line-height: 1;
}

// 阶段标签
.phase-label {
  display: none; // 默认隐藏，hover 时显示
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 10px;
  color: #ccc;
  background: rgba(0, 0, 0, 0.8);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 10;
}

.phase-step:hover .phase-label {
  display: block;
}

.phase-step.active .phase-label {
  display: block;
  color: #2080f0;
  font-weight: 600;
}

// ── 中间信息 ──
.phase-info {
  flex: 1;
  display: flex;
  justify-content: center;
}

// ── 右侧回合信息 ──
.turn-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.turn-label {
  font-size: 12px;
  color: #999;
}
</style>
