<!--
  联盟杀 · GameOverDialog — 游戏结束弹窗

  显示：
  - 胜利/失败方
  - 所有角色身份公开
  - 游戏统计（轮数、存活数等）
  - "再来一局" 和 "返回大厅" 按钮
-->
<template>
  <n-modal
    :show="visible"
    :closable="false"
    :mask-closable="false"
    preset="card"
    :style="{ width: '520px' }"
    title=""
    role="dialog"
    aria-modal="true"
  >
    <div class="game-over-dialog">
      <!-- 胜利标题 -->
      <div class="result-header">
        <div class="result-icon">{{ isVictory ? '🏆' : '💀' }}</div>
        <h2 class="result-title" :class="isVictory ? 'text-victory' : 'text-defeat'">
          {{ resultTitle }}
        </h2>
        <p class="result-reason">{{ reason }}</p>
      </div>

      <!-- 身份公开面板 -->
      <div class="reveal-section">
        <h3 class="section-title">身份公开</h3>
        <div class="role-reveal-grid">
          <div
            v-for="player in revealedPlayers"
            :key="player.id"
            class="role-reveal-card"
            :class="{
              'is-dead': !player.alive,
              'is-human': player.isHuman,
            }"
          >
            <!-- 英雄头像 -->
            <n-avatar
              :size="40"
              round
              :style="{ background: getKingdomGradient(player.kingdom) }"
            >
              {{ player.name.charAt(0) }}
            </n-avatar>

            <!-- 玩家信息 -->
            <div class="reveal-info">
              <div class="reveal-name">
                {{ player.name }}
                <n-tag v-if="player.isHuman" size="tiny" type="info" round>你</n-tag>
              </div>
              <div class="reveal-hero-name" v-if="player.heroName">
                {{ player.heroName }}
              </div>
            </div>

            <!-- 身份标签 -->
            <n-tag :type="getRoleTagType(player.role)" size="small" round>
              {{ getRoleLabel(player.role) }}
            </n-tag>

            <!-- 存活状态 -->
            <div class="reveal-status">
              <span v-if="player.alive" class="status-alive">存活</span>
              <span v-else class="status-dead">阵亡</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 游戏统计 -->
      <div class="stats-section">
        <h3 class="section-title">本局统计</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ stats.totalRounds }}</div>
            <div class="stat-label">总轮数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ stats.aliveCount }} / {{ stats.totalPlayers }}</div>
            <div class="stat-label">存活人数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ stats.playerName }}</div>
            <div class="stat-label">{{ stats.playerRole }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ formatDuration(stats.durationMs) }}</div>
            <div class="stat-label">游戏时长</div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions-section">
        <n-space justify="center" :size="12">
          <n-button
            type="primary"
            size="large"
            @click="handlePlayAgain"
          >
            🔄 再来一局
          </n-button>
          <n-button
            size="large"
            @click="handleGoLobby"
          >
            🏠 返回大厅
          </n-button>
        </n-space>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  NModal,
  NButton,
  NSpace,
  NTag,
  NAvatar,
} from 'naive-ui'
import { RoleType, Kingdom } from '@core/contracts/enums'
import type { IGameResult } from '@core/contracts/game.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import { lolHeroName, lolHeroTitle } from '@source/theme/lol-mapping'

// ── Props ──
const props = defineProps<{
  /** 是否显示 */
  visible: boolean
  /** 游戏结果（来自引擎） */
  result: IGameResult | null
  /** 玩家列表（含身份信息） */
  players: IPlayer[]
  /** 人类玩家 ID */
  humanPlayerId?: string
  /** 游戏开始时间戳（计算时长） */
  gameStartTime?: number
}>()

const emit = defineEmits<{
  (e: 'play-again'): void
  (e: 'go-lobby'): void
}>()

// ── 胜利判定 ──
const humanPlayer = computed(() =>
  props.players.find((p) => p.id === props.humanPlayerId),
)

const humanRole = computed(() => humanPlayer.value?.role ?? null)

/** 人类玩家的英雄显示名（换皮，欠账 D27） */
const humanHeroName = computed(() => {
  const hero = humanPlayer.value?.heroes[0]
  return hero ? lolHeroName(hero.id, hero.name) : '你'
})

const winnerRole = computed(() => props.result?.winner ?? null)

/**
 * 人类玩家是否胜利。
 * 判断规则：
 * - 主公(Aspect)胜利 → 守护者(Guardian)也胜利
 * - 飞升者(Ascended)胜利 → 所有飞升者胜利
 * - 潜伏者(Infiltrator)胜利 → 仅潜伏者胜利
 */
const isVictory = computed(() => {
  if (!winnerRole.value || !humanRole.value) return false

  // 主公和守护者同阵营
  if (winnerRole.value === RoleType.Aspect) {
    return humanRole.value === RoleType.Aspect || humanRole.value === RoleType.Guardian
  }

  // 同一阵营即胜利
  return humanRole.value === winnerRole.value
})

const resultTitle = computed(() => {
  if (isVictory.value) return '胜利！'
  if (!winnerRole.value) return '游戏结束'
  return '失败'
})

const reason = computed(() => {
  return props.result?.reason ?? ''
})

// ── 身份公开列表 ──
interface RevealedPlayer {
  id: string
  name: string
  heroName: string
  role: RoleType
  alive: boolean
  isHuman: boolean
  kingdom: Kingdom
}

const revealedPlayers = computed<RevealedPlayer[]>(() => {
  return props.players.map((p) => {
    const hero = p.heroes[0]
    return {
      id: p.id,
      // 换皮（欠账 D27）：这一列是直接拿引擎的 `IPlayer` 拼的，
      // 没走 Store 那道派生，所以在这里查表——查的还是同一张表。
      name: hero ? lolHeroName(hero.id, hero.name) : `玩家${p.seatIndex + 1}`,
      heroName: hero ? lolHeroTitle(hero.id, hero.title) : '',
      role: p.role ?? RoleType.Ascended,
      alive: p.alive,
      isHuman: p.id === props.humanPlayerId,
      kingdom: hero?.kingdom ?? Kingdom.Demacia,
    }
  })
})

// ── 游戏统计 ──
const stats = computed(() => {
  const result = props.result

  return {
    totalRounds: result?.totalRounds ?? 0,
    aliveCount: props.players.filter((p) => p.alive).length,
    totalPlayers: props.players.length,
    playerName: humanHeroName.value,
    playerRole: getRoleLabel(humanRole.value),
    durationMs: props.gameStartTime
      ? Date.now() - props.gameStartTime
      : 0,
  }
})

// ── 事件处理 ──
function handlePlayAgain(): void {
  emit('play-again')
}

function handleGoLobby(): void {
  emit('go-lobby')
}

// ── 辅助函数 ──

function getRoleLabel(role: RoleType | null): string {
  switch (role) {
    case RoleType.Aspect: return '天命星灵'
    case RoleType.Guardian: return '守护者'
    case RoleType.Ascended: return '飞升者'
    case RoleType.Infiltrator: return '潜伏者'
    default: return '未知'
  }
}

function getRoleTagType(role: RoleType): 'error' | 'success' | 'warning' | 'info' {
  switch (role) {
    case RoleType.Aspect: return 'error'
    case RoleType.Guardian: return 'success'
    case RoleType.Ascended: return 'warning'
    case RoleType.Infiltrator: return 'info'
    default: return 'info'
  }
}

function getKingdomGradient(kingdom: Kingdom): string {
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
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '--'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}分${seconds}秒`
  }
  return `${seconds}秒`
}
</script>

<style lang="less" scoped>
.game-over-dialog {
  padding: 8px 0;
}

// ── 结果标题 ──
.result-header {
  text-align: center;
  padding: 16px 0 20px;
}

.result-icon {
  font-size: 56px;
  line-height: 1.2;
  margin-bottom: 8px;
  animation: result-icon-bounce 600ms ease-out;
}

@keyframes result-icon-bounce {
  0% { transform: scale(0); }
  50% { transform: scale(1.3); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

.result-title {
  font-size: 28px;
  margin: 0 0 8px;
  font-weight: 800;
}

.text-victory {
  color: #ffd700;
  text-shadow: 0 0 16px rgba(255, 215, 0, 0.5);
}

.text-defeat {
  color: #c0392b;
  text-shadow: 0 0 12px rgba(192, 57, 43, 0.5);
}

.result-reason {
  margin: 0;
  font-size: 14px;
  color: #999;
}

// ── 身份公开 ──
.reveal-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #aaa;
  margin: 0 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.role-reveal-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.role-reveal-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  &.is-dead {
    opacity: 0.55;
  }

  &.is-human {
    border-color: rgba(255, 215, 0, 0.3);
    background: rgba(255, 215, 0, 0.06);
  }
}

.reveal-info {
  flex: 1;
  min-width: 0;
}

.reveal-name {
  font-size: 14px;
  font-weight: 600;
  color: #eee;
  display: flex;
  align-items: center;
  gap: 6px;
}

.reveal-hero-name {
  font-size: 11px;
  color: #888;
  margin-top: 1px;
}

.reveal-status {
  font-size: 11px;
  flex-shrink: 0;
}

.status-alive {
  color: #2ecc71;
}

.status-dead {
  color: #888;
}

// ── 统计 ──
.stats-section {
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.stat-item {
  text-align: center;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #ffd700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 11px;
  color: #888;
}

// ── 操作按钮 ──
.actions-section {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
