<template>
  <div class="skill-panel" :class="{ collapsed: isCollapsed }">
    <!-- 面板标题栏 -->
    <div class="panel-header" @click="toggleCollapse">
      <span class="panel-title">
        <span class="title-icon">⚡</span>
        技能
      </span>
      <n-tag v-if="activeSkills.length > 0" type="info" size="tiny" round>
        {{ activeSkills.length }}
      </n-tag>
      <span class="collapse-arrow" :class="{ expanded: !isCollapsed }">▼</span>
    </div>

    <!-- 技能列表 -->
    <div v-show="!isCollapsed" class="panel-content">
      <!-- 主动技区域 -->
      <div v-if="activeSkills.length > 0" class="skill-section">
        <div class="section-label">主动技</div>
        <div
          v-for="skill in activeSkills"
          :key="skill.id"
          class="skill-item"
          :class="{
            usable: skill.usable && skill.enabled,
            disabled: !skill.usable || !skill.enabled,
            activating: isActivatingSkill(skill.id),
          }"
          @click="handleActivate(skill)"
        >
          <div class="skill-header">
            <span
              class="skill-type-dot"
              :style="{ background: skill.typeColor }"
            />
            <span class="skill-name">{{ skill.name }}</span>
            <n-tag
              :type="skill.usable && skill.enabled ? 'info' : 'default'"
              size="tiny"
              :bordered="false"
            >
              {{ skill.typeLabel }}
            </n-tag>
          </div>
          <div class="skill-desc" v-if="skill.description">
            {{ skill.description }}
          </div>
          <div v-if="skill.type === 'limited' && (skill.usedThisRound || skill.usedThisTurn)" class="skill-used-mark">
            已使用
          </div>
        </div>
      </div>

      <!-- 被动/锁定技区域 -->
      <div v-if="passiveSkills.length > 0" class="skill-section">
        <div class="section-label">被动 / 锁定技</div>
        <div
          v-for="skill in passiveSkills"
          :key="skill.id"
          class="skill-item passive"
        >
          <div class="skill-header">
            <span
              class="skill-type-dot"
              :style="{ background: skill.typeColor }"
            />
            <span class="skill-name">{{ skill.name }}</span>
            <n-tag
              :type="skill.type === 'locked' ? 'warning' : 'success'"
              size="tiny"
              :bordered="false"
            >
              {{ skill.typeLabel }}
            </n-tag>
          </div>
          <div class="skill-desc" v-if="skill.description">
            {{ skill.description }}
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="activeSkills.length === 0 && passiveSkills.length === 0" class="empty-skills">
        <n-text depth="3">暂无技能</n-text>
      </div>
    </div>

    <!-- 触发通知 Toast -->
    <Transition name="notify-slide">
      <div
        v-if="triggerNotification"
        class="trigger-notification"
        :class="triggerNotification.type"
        @click="dismissNotification"
      >
        <span class="notify-icon">
          {{ triggerNotification.type === 'locked' ? '🔒' : '✨' }}
        </span>
        <span class="notify-text">
          {{ triggerNotification.typeLabel }}
          <strong>{{ triggerNotification.skillName }}</strong>
          触发
        </span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NTag, NText } from 'naive-ui'
import { SkillType } from '@core/contracts/enums'
import type { SkillUIInfo } from '@/hooks/useSkill'

const props = defineProps<{
  /** 主动技列表 */
  activeSkills: SkillUIInfo[]
  /** 被动/锁定技列表 */
  passiveSkills: SkillUIInfo[]
  /** 正在发动的技能 ID */
  activatingSkillId: string | null
  /** 触发通知 */
  triggerNotification: {
    skillName: string
    type: SkillType
    typeLabel: string
    timestamp: number
  } | null
}>()

const emit = defineEmits<{
  (e: 'activate', effectId: string): void
  (e: 'dismiss-notification'): void
}>()

// ── 状态 ──
const isCollapsed = ref(false)

// ── 方法 ──

function toggleCollapse(): void {
  isCollapsed.value = !isCollapsed.value
}

function isActivatingSkill(skillId: string): boolean {
  return props.activatingSkillId === skillId
}

function handleActivate(skill: SkillUIInfo): void {
  if (!skill.usable || !skill.enabled) return
  if (props.activatingSkillId) return // 正在发动其他技能
  emit('activate', skill.id)
}

function dismissNotification(): void {
  emit('dismiss-notification')
}
</script>

<style lang="less" scoped>
.skill-panel {
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  overflow: hidden;
  position: relative;

  &.collapsed {
    .panel-header {
      border-bottom: none;
    }
  }
}

// ── 面板标题栏 ──
.panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #e0e0e0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.title-icon {
  font-size: 14px;
}

.collapse-arrow {
  font-size: 10px;
  color: #999;
  transition: transform 0.2s;

  &.expanded {
    transform: rotate(0deg);
  }

  :not(.expanded) & {
    transform: rotate(-90deg);
  }
}

// ── 面板内容 ──
.panel-content {
  max-height: 320px;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
  }
}

// ── 分区 ──
.skill-section {
  margin-bottom: 6px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  padding: 4px 4px 6px;
  letter-spacing: 0.5px;
}

// ── 技能项 ──
.skill-item {
  padding: 6px 8px;
  border-radius: 6px;
  margin-bottom: 2px;
  transition: background 0.15s, transform 0.1s;
  border: 1px solid transparent;

  &.usable {
    cursor: pointer;

    &:hover {
      background: rgba(32, 128, 240, 0.1);
      border-color: rgba(32, 128, 240, 0.25);
      transform: translateX(2px);
    }
  }

  &.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &.activating {
    background: rgba(32, 128, 240, 0.15);
    border-color: rgba(32, 128, 240, 0.4);
    animation: pulse-activate 1s ease-in-out infinite;
  }

  &.passive {
    cursor: default;
  }
}

@keyframes pulse-activate {
  0%, 100% { box-shadow: 0 0 0 0 rgba(32, 128, 240, 0.3); }
  50% { box-shadow: 0 0 8px 2px rgba(32, 128, 240, 0.15); }
}

.skill-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.skill-type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skill-name {
  font-size: 12px;
  font-weight: 600;
  color: #e0e0e0;
  flex: 1;
}

.skill-desc {
  font-size: 10px;
  color: #999;
  margin-top: 3px;
  padding-left: 14px;
  line-height: 1.4;
}

.skill-used-mark {
  font-size: 9px;
  color: #d03050;
  margin-top: 2px;
  padding-left: 14px;
}

// ── 空状态 ──
.empty-skills {
  display: flex;
  justify-content: center;
  padding: 20px;
}

// ── 触发通知 Toast ──
.trigger-notification {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
  z-index: 20;
  cursor: pointer;

  &.locked {
    border-color: rgba(240, 160, 32, 0.4);
  }

  &.passive {
    border-color: rgba(24, 160, 88, 0.4);
  }
}

.notify-icon {
  font-size: 14px;
}

.notify-text {
  font-size: 12px;
  color: #e0e0e0;

  strong {
    color: #fff;
  }
}

// ── 通知动画 ──
.notify-slide-enter-active,
.notify-slide-leave-active {
  transition: all 0.3s ease;
}

.notify-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}

.notify-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>
