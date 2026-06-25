<!--
  联盟杀 · GameLog — 游戏日志组件

  实时显示游戏日志，支持：
  - CTT 风格彩色日志（伤害红色、回复绿色、卡牌蓝色等）
  - 日志级别过滤
  - 自动滚动到底部
  - 日志条目数量限制显示
-->
<template>
  <div class="game-log">
    <!-- 顶部工具栏 -->
    <div class="log-toolbar">
      <span class="log-title">📋 游戏日志</span>
      <div class="log-filters">
        <n-button
          v-for="f in availableFilters"
          :key="f.key"
          size="tiny"
          :type="activeFilter === f.key ? 'primary' : 'default'"
          :secondary="activeFilter !== f.key"
          quaternary
          @click="setFilter(f.key)"
        >
          {{ f.label }}
        </n-button>
      </div>
    </div>

    <!-- 日志列表 -->
    <div ref="scrollContainerRef" class="log-scroll">
      <n-scrollbar ref="scrollbarRef" :style="{ maxHeight: `${maxHeight}px` }">
        <TransitionGroup name="log-item" tag="div" class="log-list">
          <div
            v-for="entry in filteredEntries"
            :key="entry.id"
            class="log-entry"
            :style="{ borderLeftColor: getColor(entry.colorCategory) }"
          >
            <!-- 时间戳 -->
            <span class="log-time">{{ formatTime(entry.timestamp) }}</span>

            <!-- 轮次标记 -->
            <span class="log-round">R{{ entry.round }}</span>

            <!-- 颜色类别标记 -->
            <span
              class="log-category-tag"
              :style="{
                background: getColor(entry.colorCategory),
                color: '#fff',
              }"
            >
              {{ getLabel(entry.colorCategory) }}
            </span>

            <!-- 日志消息 -->
            <span class="log-message" :style="{ color: getColor(entry.colorCategory) }">
              {{ entry.message }}
            </span>
          </div>
        </TransitionGroup>

        <!-- 空状态 -->
        <n-empty
          v-if="filteredEntries.length === 0"
          description="暂无日志"
          size="small"
          class="log-empty"
        />
      </n-scrollbar>
    </div>

    <!-- 底部状态栏 -->
    <div class="log-footer">
      <span class="log-count">
        共 {{ filteredEntries.length }} / {{ totalCount }} 条
      </span>
      <n-button
        size="tiny"
        quaternary
        :disabled="filteredEntries.length === 0"
        @click="scrollToBottom"
      >
        ⬇ 最新
      </n-button>
      <n-button
        size="tiny"
        quaternary
        :disabled="filteredEntries.length === 0"
        @click="clearLogs"
      >
        🗑️ 清空
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { NButton, NScrollbar, NEmpty } from 'naive-ui'
import { useLogStore } from '@/store/log-store'
import type { LogColorCategory } from '@/store/log-store'
import { getLogCategoryColor, getLogCategoryLabel } from '@/store/log-store'
import { LogLevel } from '@core/contracts/enums'

// ── Props ──
const props = withDefaults(
  defineProps<{
    /** 最大高度（px） */
    maxHeight?: number
    /** 是否显示工具栏 */
    showToolbar?: boolean
    /** 是否显示底部状态栏 */
    showFooter?: boolean
    /** 最大显示条目数 */
    maxEntries?: number
  }>(),
  {
    maxHeight: 200,
    showToolbar: true,
    showFooter: true,
    maxEntries: 200,
  },
)

// ── Store ──
const logStore = useLogStore()

// ── Refs ──
const scrollContainerRef = ref<HTMLElement | null>(null)
const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null)

// ── 过滤器 ──
type FilterKey = 'all' | LogColorCategory | LogLevel

const activeFilter = ref<FilterKey>('all')

const availableFilters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'card', label: '卡牌' },
  { key: 'damage', label: '伤害' },
  { key: 'heal', label: '回复' },
  { key: 'skill', label: '技能' },
  { key: 'death', label: '死亡' },
  { key: 'system', label: '系统' },
]

function setFilter(key: FilterKey): void {
  activeFilter.value = key
}

// ── 过滤后的日志 ──
const filteredEntries = computed(() => {
  let list = logStore.coloredEntries

  const filter = activeFilter.value
  if (filter === 'all') {
    // 不过滤
  } else if (typeof filter === 'string' && filter in LogLevel) {
    list = list.filter((e) => e.level === filter)
  } else {
    list = list.filter((e) => e.colorCategory === filter)
  }

  // 限制显示数量
  return list.slice(-props.maxEntries)
})

const totalCount = computed(() => logStore.count)

// ── 自动滚动 ──
function scrollToBottom(): void {
  nextTick(() => {
    const container = scrollContainerRef.value
    if (container) {
      const scrollEl = container.querySelector('.n-scrollbar-container')
      if (scrollEl) {
        ;(scrollEl as HTMLElement).scrollTop = (scrollEl as HTMLElement).scrollHeight
      }
    }
  })
}

// 日志更新时自动滚动
watch(
  () => filteredEntries.value.length,
  () => {
    scrollToBottom()
  },
)

// ── 清空 ──
function clearLogs(): void {
  logStore.clear()
}

// ── 辅助 ──
function getColor(category: LogColorCategory): string {
  return getLogCategoryColor(category)
}

function getLabel(category: LogColorCategory): string {
  return getLogCategoryLabel(category)
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
</script>

<style lang="less" scoped>
.game-log {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 12px;
}

// ── 工具栏 ──
.log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.log-title {
  font-weight: 600;
  color: #ccc;
  font-size: 12px;
}

.log-filters {
  display: flex;
  gap: 2px;
}

// ── 滚动容器 ──
.log-scroll {
  flex: 1;
  overflow: hidden;
}

.log-list {
  padding: 4px 0;
}

// ── 日志条目 ──
.log-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px 2px 6px;
  margin: 1px 4px;
  border-left: 3px solid transparent;
  border-radius: 0 4px 4px 0;
  background: rgba(255, 255, 255, 0.02);
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }
}

.log-time {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 10px;
  color: #666;
  flex-shrink: 0;
  width: 64px;
}

.log-round {
  font-size: 10px;
  color: #555;
  background: rgba(255, 255, 255, 0.08);
  padding: 0 4px;
  border-radius: 3px;
  flex-shrink: 0;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.log-category-tag {
  font-size: 9px;
  padding: 0 4px;
  border-radius: 2px;
  flex-shrink: 0;
  line-height: 16px;
  font-weight: 500;
}

.log-message {
  color: #ccc;
  line-height: 1.4;
  word-break: break-all;
}

// ── 空状态 ──
.log-empty {
  padding: 24px 0;
}

// ── 底部 ──
.log-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.log-count {
  font-size: 10px;
  color: #666;
}

// ── 列表动画 ──
.log-item-enter-active {
  transition: all 0.3s ease;
}

.log-item-leave-active {
  transition: all 0.2s ease;
}

.log-item-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.log-item-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.log-item-move {
  transition: transform 0.2s ease;
}
</style>
