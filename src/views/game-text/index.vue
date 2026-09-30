<template>
  <div class="game-text-page">
    <!-- Header -->
    <div class="header">
      <h1>🎴 联盟杀 · 文字调试版</h1>
      <div class="controls">
        <n-button
          v-if="!gameRunning && !gameFinished"
          type="primary"
          :loading="loading"
          :disabled="loading"
          @click="startGame"
        >
          开始游戏
        </n-button>
        <n-button
          v-if="gameFinished"
          type="primary"
          @click="startGame"
        >
          再来一局
        </n-button>
        <n-button @click="goHome" :disabled="loading">
          返回主页
        </n-button>
      </div>
    </div>

    <div class="main-content">
      <!-- Game State Panel -->
      <div v-if="gameStarted || gameFinished" class="state-panel">
        <div class="summary-bar">
          <span class="badge round">第 {{ uiState?.round ?? 0 }} 轮</span>
          <span class="badge phase">{{ phaseLabel }}</span>
          <span class="badge player">当前玩家: {{ currentPlayerName || '—' }}</span>
          <span class="badge alive">存活: {{ aliveCount }}/{{ totalPlayers }}</span>
        </div>

        <!-- Player List -->
        <div class="player-list">
          <div
            v-for="p in players"
            :key="p.id"
            class="player-card"
            :class="{ dead: !p.alive, current: p.isCurrentPlayer }"
          >
            <div class="p-header">
              <span class="p-name">{{ p.hero?.name ?? p.name }}</span>
              <span class="p-title">{{ p.hero?.title ?? '' }}</span>
              <span v-if="p.roleRevealed" class="p-role">
                {{ roleLabel(p.role) }}
              </span>
              <span class="p-seat">#{{ p.seatIndex + 1 }}</span>
            </div>
            <div class="p-stats">
              <span class="stat hp">❤️ {{ p.hp }}/{{ p.maxHp }}</span>
              <span class="stat hand">🃏 {{ p.handCount }}张</span>
              <span v-if="p.maxPower > 0" class="stat power">⚡ {{ p.power }}/{{ p.maxPower }}</span>
              <span v-if="!p.alive" class="stat dead-mark">💀 已阵亡</span>
            </div>
            <div v-if="p.equipCards.length > 0" class="p-equip">
              <span v-for="eq in p.equipCards" :key="eq.instanceId" class="equip-tag">
                [{{ eq.name }}]
              </span>
            </div>
            <div v-if="p.judgeCards.length > 0" class="p-judge">
              🎯 判定区:
              <span v-for="jc in p.judgeCards" :key="jc.instanceId" class="judge-tag">
                {{ jc.name }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Not Started State -->
      <div v-if="!gameStarted && !gameRunning && !gameFinished" class="welcome">
        <div class="welcome-content">
          <h2>🎮 文字调试模式</h2>
          <p class="desc">所有玩家默认由 AI 控制自动进行</p>
          <p class="desc">支持标准5人局，日志实时输出便于排查问题</p>
          <p class="hint">点击「开始游戏」启动对局</p>
        </div>
      </div>

      <!-- Running Indicator -->
      <div v-if="gameRunning && !gameStarted" class="loading-indicator">
        <span>⏳ 游戏运行中...</span>
      </div>

      <!-- Game Over -->
      <div v-if="gameFinished" class="game-over-banner">
        🏆 游戏结束
      </div>
    </div>

    <!-- Game Log -->
    <div class="log-section">
      <GameLog
        :max-height="450"
        :show-toolbar="true"
        :show-footer="true"
        :max-entries="1000"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/store/game-store'
import { useLogStore } from '@/store/log-store'
import GameLog from '@/components/game/GameLog.vue'
import { GameBoot } from '@core/boot/game-boot'
import { AIController } from '@core/services/ai-controller'
import { AIDifficulty } from '@core/contracts/ai.interface'
import { GamePhase, LogLevel, RoleType } from '@core/contracts/enums'
import { standard5pConfig } from '@source/modes/standard-5p'

// ── Router / Store ──
const router = useRouter()
const gameStore = useGameStore()
const logStore = useLogStore()

// ── State ──
const loading = ref(false)
const gameRunning = ref(false)
const gameStarted = ref(false)
const gameFinished = ref(false)

// ── Derived State ──
const uiState = computed(() => gameStore.uiState)
const phaseLabel = computed(() => gameStore.phaseLabel)
const players = computed(() => gameStore.uiPlayers)
const aliveCount = computed(() => gameStore.aliveCount)
const totalPlayers = computed(() => gameStore.uiState?.totalPlayers ?? 0)

const currentPlayerName = computed(() => {
  const cp = players.value.find((p) => p.isCurrentPlayer)
  return cp?.hero?.name ?? (cp ? `玩家${cp.seatIndex + 1}` : null)
})

// ── Role Labels ──
function roleLabel(role: RoleType | null | undefined): string {
  const labels: Record<string, string> = {
    [RoleType.Aspect]: '👑 天命星灵',
    [RoleType.Guardian]: '🛡️ 守护者',
    [RoleType.Ascended]: '⚔️ 飞升者',
    [RoleType.Infiltrator]: '🗡️ 潜伏者',
  }
  return role ? (labels[role] ?? role) : ''
}

// ── Navigation ──
function goHome(): void {
  gameStore.reset()
  logStore.clear()
  router.push('/')
}

// ── Phase Name (Chinese) ──
function phaseName(phase: GamePhase): string {
  const names: Partial<Record<GamePhase, string>> = {
    [GamePhase.NotStarted]: '未开始',
    [GamePhase.Prepare]: '准备',
    [GamePhase.RoundStart]: '轮次开始',
    [GamePhase.PhasePre]: '准备阶段',
    [GamePhase.PhaseJudge]: '判定阶段',
    [GamePhase.PhaseDraw]: '摸牌阶段',
    [GamePhase.PhaseUse]: '出牌阶段',
    [GamePhase.PhaseDiscard]: '弃牌阶段',
    [GamePhase.PhasePost]: '结束阶段',
    [GamePhase.RoundEnd]: '轮次结束',
    [GamePhase.GameOver]: '游戏结束',
  }
  return names[phase] ?? phase
}

// ── Game Start ──
async function startGame(): Promise<void> {
  if (loading.value) return
  loading.value = true

  try {
    // ── 1. Cleanup previous game ──
    gameStore.reset()
    logStore.clear()
    gameStarted.value = false
    gameFinished.value = false

    // ── 2. Create AI controller ──
    const aiController = new AIController({
      defaultDifficulty: AIDifficulty.Normal,
    })

    // ── 3. Create GameBoot (don't pass storeService — it creates its own) ──
    const gameBoot = GameBoot.createStandard5P({
      decisionService: aiController,
    })
    const storeService = gameBoot.getStoreService()

    // Store state tracking for change detection logging
    let lastRound = 0
    let lastPhase: GamePhase = GamePhase.NotStarted
    let lastPlayerIdx = -1
    let lastAliveCount = -1

    // ── 4. Bridge StoreService → Pinia (with change detection logging) ──
    storeService.onChange((state) => {
      gameStore.syncFromEngine(state)

      // Detect and log round transitions
      if (state.currentRound !== lastRound) {
        const prev = lastRound
        lastRound = state.currentRound
        if (prev > 0) {
          logStore.addLog({
            id: `log_round_${Date.now()}_${state.currentRound}`,
            round: state.currentRound,
            phase: state.currentPhase,
            message: `--- 第 ${state.currentRound} 轮 ---`,
            level: LogLevel.Info,
          })
        }
      }

      // Detect and log phase transitions
      if (state.currentPhase !== lastPhase) {
        lastPhase = state.currentPhase
        logStore.addLog({
          id: `log_phase_${Date.now()}`,
          round: state.currentRound,
          phase: state.currentPhase,
          message: `[${phaseName(state.currentPhase)}]`,
          level: LogLevel.Debug,
        })
      }

      // Detect and log player changes
      if (state.currentPlayerIndex !== lastPlayerIdx) {
        lastPlayerIdx = state.currentPlayerIndex
        const player = state.players[state.currentPlayerIndex]
        if (player) {
          const heroName = player.heroes[0]?.name ?? `玩家${player.seatIndex + 1}`
          logStore.addLog({
            id: `log_turn_${Date.now()}`,
            round: state.currentRound,
            phase: state.currentPhase,
            message: `▶ 回合开始 — ${heroName} (❤️${player.hp}/${player.maxHp})`,
            level: LogLevel.Info,
          })
        }
      }

      // Detect deaths
      const alive = state.players.filter(p => p.alive).length
      if (lastAliveCount >= 0 && alive < lastAliveCount) {
        const deadPlayers = state.players.filter(p => !p.alive)
        for (const dp of deadPlayers) {
          const inLog = logStore.entries.some(e => e.message.includes(dp.id) && e.message.includes('死亡'))
          if (!inLog) {
            logStore.addLog({
              id: `log_death_${Date.now()}_${dp.id}`,
              round: state.currentRound,
              phase: state.currentPhase,
              message: `💀 ${dp.heroes[0]?.name ?? dp.id} 已阵亡`,
              level: LogLevel.Warn,
            })
          }
        }
      }
      lastAliveCount = alive
    })

    // ── 5. Boot (init engine) ──
    await gameBoot.boot()

    // ── 6. Register AI players ──
    const initState = gameBoot.getState()!
    const playerIds = initState.players.map((p) => p.id)
    aiController.setStateAccessor(() => gameBoot.getState()!)
    aiController.registerPlayers(playerIds, AIDifficulty.Normal)

    // ── 7. Log init info ──
    logStore.addLog({
      id: `log_init_${Date.now()}`,
      round: 0,
      phase: GamePhase.Prepare,
      message: `🎮 游戏初始化完成 — ${standard5pConfig.mode}，${initState.players.length} 名玩家，全部由 AI 控制`,
      level: LogLevel.Info,
    })
    for (const p of initState.players) {
      const hero = p.heroes[0]
      logStore.addLog({
        id: `log_hero_${p.id}_${Date.now()}`,
        round: 0,
        phase: GamePhase.Prepare,
        message: `  #${p.seatIndex + 1} ${hero?.name ?? '?'} (${p.roleRevealed ? roleLabel(p.role) : '身份隐藏'}) ❤️${p.hp}/${p.maxHp} 🃏${p.handCards.length}张`,
        level: LogLevel.Debug,
      })
    }

    // Initial state sync
    storeService.syncGameState(gameBoot.getEngine()!.getState())

    gameStarted.value = true
    gameRunning.value = true

    // ── 8. Run game loop ──
    logStore.addLog({
      id: `log_run_${Date.now()}`,
      round: 1,
      phase: GamePhase.RoundStart,
      message: '🎮 游戏开始',
      level: LogLevel.Info,
    })

    // kick off the game loop — this runs async and blocks until game ends
    // but yields to event loop between turns, so Vue reactivity updates in between
    // runGameLoop() checks if phase is Prepare and calls start() internally
    const result = await gameBoot.runGameLoop()

    // ── 9. Game Over ──
    gameFinished.value = true
    gameRunning.value = false

    logStore.addLog({
      id: `log_end_${Date.now()}`,
      round: result.totalRounds,
      phase: GamePhase.GameOver,
      message: `🏆 游戏结束 — ${result.reason}（共 ${result.totalRounds} 轮）`,
      level: LogLevel.Info,
    })

    // Final sync
    if (gameBoot.getEngine()) {
      storeService.syncGameState(gameBoot.getEngine()!.getState())
    }

  } catch (err) {
    console.error('[TextGame] 游戏运行失败:', err)
    logStore.addLog({
      id: `log_error_${Date.now()}`,
      round: 0,
      phase: GamePhase.GameOver,
      message: `❌ 游戏运行失败: ${err instanceof Error ? err.message : String(err)}`,
      level: LogLevel.Error,
    })
    gameRunning.value = false
    gameFinished.value = true
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="less">
.game-text-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0d1117;
  color: #c9d1d9;
  font-family: 'Courier New', 'Consolas', 'Source Han Mono', monospace;
  overflow: hidden;
}

// ── Header ──
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;

  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #58a6ff;
  }

  .controls {
    display: flex;
    gap: 8px;
  }
}

// ── Main Content ──
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #30363d;
    border-radius: 3px;
  }
}

// ── Summary Bar ──
.summary-bar {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 13px;

  .badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;

    &.round { background: #1f6feb22; color: #58a6ff; }
    &.phase { background: #23863622; color: #3fb950; }
    &.player { background: #9e6a0322; color: #d29922; }
    &.alive { background: #da363322; color: #f85149; }
  }
}

// ── Player List ──
.player-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.player-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 13px;
  transition: border-color 0.2s;

  &.current {
    border-color: #58a6ff;
    background: #1f6feb11;
  }

  &.dead {
    opacity: 0.6;
    border-color: #484f58;
  }

  .p-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;

    .p-name {
      font-weight: 700;
      color: #e6edf3;
      font-size: 14px;
    }
    .p-title {
      color: #8b949e;
      font-size: 12px;
    }
    .p-role {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 3px;
      font-weight: 600;
    }
    .p-seat {
      color: #484f58;
      font-size: 11px;
      margin-left: auto;
    }
  }

  .p-stats {
    display: flex;
    gap: 12px;
    margin-bottom: 2px;

    .stat {
      font-size: 12px;
    }
    .hp { color: #f85149; }
    .hand { color: #d2a8ff; }
    .power { color: #79c0ff; }
    .dead-mark { color: #484f58; }
  }

  .p-equip {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;

    .equip-tag {
      font-size: 11px;
      color: #d29922;
      background: #9e6a0322;
      padding: 0 4px;
      border-radius: 2px;
    }
  }

  .p-judge {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
    font-size: 11px;
    color: #f0883e;

    .judge-tag {
      background: #f0883e22;
      padding: 0 4px;
      border-radius: 2px;
    }
  }
}

// ── Welcome ──
.welcome {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;

  .welcome-content {
    text-align: center;

    h2 {
      font-size: 28px;
      color: #58a6ff;
      margin-bottom: 16px;
    }

    .desc {
      font-size: 15px;
      color: #8b949e;
      margin: 4px 0;
    }

    .hint {
      margin-top: 24px;
      font-size: 16px;
      color: #3fb950;
      animation: pulse 2s ease-in-out infinite;
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// ── Loading ──
.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 18px;
  color: #58a6ff;
}

// ── Game Over ──
.game-over-banner {
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  color: #d29922;
  padding: 12px;
  background: #9e6a0311;
  border: 1px solid #9e6a0344;
  border-radius: 6px;
  margin-top: 8px;
}

// ── Log Section ──
.log-section {
  flex-shrink: 0;
  border-top: 1px solid #30363d;
  background: #0d1117;
  height: 200px;
  overflow: hidden;
}
</style>
