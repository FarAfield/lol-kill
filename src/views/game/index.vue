<template>
  <div class="game-page">
    <!-- 顶部状态栏：阶段流 + 操作按钮 -->
    <div class="top-bar">
      <PhaseBar
        :current-phase="gamePhase"
        :round="uiState?.round ?? 0"
        :alive-count="uiState?.aliveCount ?? 0"
        :total-count="uiState?.totalPlayers ?? 0"
        :current-player-name="currentPlayerName"
      />
      <ActionButtons
        :phase="gamePhase"
        :is-my-turn="isMyTurn"
        :can-end-phase="availableActions.canEndPhase"
        :can-play-card="cardPlay.canConfirm.value"
        :has-selection="!!cardPlay.selectedCardId.value"
        :need-discard="availableActions.needDiscard"
        :discard-count="availableActions.discardCount"
        :selected-discard-count="discardSelectedIds.length"
        :is-processing="cardPlay.isPlaying.value || skill.isActivating.value"
        :is-playing="gameStore.isPlaying"
        @confirm-play="handleConfirmPlay"
        @confirm-discard="handleConfirmDiscard"
        @cancel-selection="handleCancelAll"
        @end-phase="handleEndPhase"
      />
      <div class="top-right-actions">
        <n-button size="tiny" type="error" secondary @click="handleLeave">
          退出
        </n-button>
      </div>
    </div>

    <!-- 主区域：桌面 + 技能面板 -->
    <div class="main-area">
      <!-- 游戏桌面 -->
      <div class="board-wrapper">
        <GameBoard
          :players="gameStore.uiPlayers"
          :current-phase="uiState?.phase ?? ''"
          :current-player-index="uiState?.currentPlayerIndex ?? 0"
          :valid-target-ids="cardPlay.validTargetIds.value"
          :selected-target-ids="cardPlay.selectedTargetIds.value"
          :hovered-target-id="cardPlay.hoveredTargetId.value"
          @select-target="handleSelectTarget"
          @hover-target="handleHoverTarget"
        />
        <!-- 动画覆盖层 -->
        <CardAnimation
          :animations="animation.allAnimations.value"
          :seat-positions="animation.seatPositions.value"
        />
      </div>

      <!-- 右侧技能面板 -->
      <div class="side-panel">
        <SkillPanel
          :active-skills="skill.activeSkills.value"
          :passive-skills="skill.passiveSkills.value"
          :activating-skill-id="skill.activatingSkillId.value"
          :trigger-notification="skillNotification"
          @activate="handleActivateSkill"
          @dismiss-notification="skill.clearNotification()"
        />
      </div>
    </div>

    <!-- 底栏：手牌区 + 日志 -->
    <div class="bottom-bar">
      <div class="hand-area">
        <CardHand
          v-if="humanPlayer"
          :cards="humanPlayer.handCards"
          :is-my-turn="isMyTurn"
          :playable-cards="playableCardIds"
          @select-card="handleSelectCard"
        />
      </div>
      <div class="log-panel">
        <GameLog
          :max-height="150"
          :show-toolbar="false"
          :show-footer="false"
          :max-entries="80"
        />
      </div>
    </div>

    <!-- 响应窗口弹窗 -->
    <ResponseDialog
      :visible="response.isOpen.value"
      :prompt="response.prompt.value"
      :description="response.description.value"
      :valid-cards="responseValidCards"
      :selected-card-id="response.selectedCardId.value"
      :can-cancel="response.canCancel.value"
      :is-required="response.isRequired.value"
      :remaining-seconds="response.remainingSeconds.value"
      :countdown-progress="response.countdownProgress.value"
      :is-disabled="response.isTimeout.value"
      @select-card="handleResponseSelectCard"
      @confirm="response.confirm()"
      @cancel="response.cancel()"
      @close="response.close()"
    />

    <!-- 未开始游戏时显示欢迎弹窗 -->
    <n-modal v-model:show="showWelcome" :closable="false" :mask-closable="false">
      <n-card title="联盟杀" style="width: 480px">
        <n-space vertical :size="12">
          <p>欢迎来到联盟杀！使用三国杀规则，英雄联盟角色主题。</p>
          <n-space justify="end">
            <n-button type="primary" @click="handleStartGame">开始游戏</n-button>
          </n-space>
        </n-space>
      </n-card>
    </n-modal>

    <!-- 游戏结束弹窗 -->
    <GameOverDialog
      :visible="showGameOver"
      :result="gameResult"
      :players="gameOverPlayers"
      :human-player-id="humanPlayer?.id"
      :game-start-time="gameStartTime"
      @play-again="handlePlayAgain"
      @go-lobby="handleGoLobby"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NSpace,
  NButton,
  NModal,
  NCard,
} from 'naive-ui'
import { useGameStore } from '@/store/game-store'
import { GameController } from '@/services/game-controller'
import { GamePhase, SkillType, LogLevel } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import type { IGameConfig, IGameResult } from '@core/contracts/game.interface'
import { standard5pConfig } from '@source/modes/standard-5p'
import GameBoard from '@/components/game/GameBoard.vue'
import CardHand from '@/components/card/CardHand.vue'
import PhaseBar from '@/components/game/PhaseBar.vue'
import ActionButtons from '@/components/game/ActionButtons.vue'
import ResponseDialog from '@/components/game/ResponseDialog.vue'
import SkillPanel from '@/components/game/SkillPanel.vue'
import GameLog from '@/components/game/GameLog.vue'
import CardAnimation from '@/components/game/CardAnimation.vue'
import GameOverDialog from '@/components/game/GameOverDialog.vue'
import { useCardPlay } from '@/hooks/useCardPlay'
import { useResponse } from '@/hooks/useResponse'
import { useSkill } from '@/hooks/useSkill'
import { useAnimation } from '@/hooks/useAnimation'
import { useLogStore } from '@/store/log-store'

const router = useRouter()
const gameStore = useGameStore()

// ── GameController 实例 ──
const controller = ref<GameController | null>(null)

// ── 欢迎弹窗 ──
const showWelcome = ref(true)

// ── 弃牌选择（弃牌阶段使用的独立选中状态） ──
const discardSelectedIds = ref<string[]>([])

// ── Controller getter（用于 hooks） ──
function getController(): GameController | null {
  return (controller.value ?? null) as GameController | null
}
// ── Hooks ──
const cardPlay = useCardPlay(getController, () => gameStore)
const response = useResponse(getController)
const skill = useSkill(getController)
const animation = useAnimation()
const logStore = useLogStore()

// ── 游戏结束时状态 ──
const showGameOver = ref(false)
const gameResult = ref<import('@core/contracts/game.interface').IGameResult | null>(null)
const gameOverPlayers = ref<import('@core/contracts/player.interface').IPlayer[]>([])
const gameStartTime = ref<number>(0)

// ── 派生状态 ──
const uiState = computed(() => gameStore.uiState)
const gamePhase = computed(() => uiState.value?.phase ?? GamePhase.NotStarted)

const currentPlayerName = computed(() => {
  const cp = gameStore.uiPlayers.find((p) => p.isCurrentPlayer)
  if (!cp) return null
  return cp.hero?.name ?? `玩家 ${cp.seatIndex + 1}`
})

/** 人类玩家信息 */
const humanPlayer = computed(() => {
  const state = controller.value?.getGameState()
  if (!state) return null
  const human = state.players[0]
  if (!human) return null
  const uiInfo = gameStore.uiPlayers.find((p) => p.id === human.id)
  return { ...human, isCurrentPlayer: uiInfo?.isCurrentPlayer ?? false }
})

/** 是否是人类玩家的回合 */
const isMyTurn = computed(() => {
  return humanPlayer.value?.isCurrentPlayer ?? false
})

const availableActions = computed(() => {
  if (!controller.value) {
    return {
      phase: GamePhase.NotStarted,
      isMyTurn: false,
      playableCards: [],
      usableEffects: [],
      canEndPhase: false,
      isWaitingResponse: false,
      needDiscard: false,
      discardCount: 0,
    }
  }
  return controller.value.getAvailableActions()
})

const playableCardIds = computed(() => {
  return new Set(availableActions.value.playableCards.map((c) => c.cardId))
})

// ── 技能通知（转换为 SkillPanel 期望的格式） ──
const skillNotification = computed(() => {
  const n = skill.lastTriggerNotification.value
  if (!n) return null
  return {
    skillName: n.skillName,
    type: n.type,
    typeLabel: getSkillTypeLabel(n.type),
    timestamp: n.timestamp,
  }
})

function getSkillTypeLabel(type: SkillType): string {
  const labels: Record<string, string> = {
    [SkillType.Active]: '主动技',
    [SkillType.Passive]: '被动技',
    [SkillType.Locked]: '锁定技',
    [SkillType.Limited]: '限定技',
    [SkillType.Awaken]: '觉醒技',
  }
  return labels[type] ?? type
}

// ── 响应窗口卡牌列表（从 humanPlayer 的手牌中筛选） ──
const responseValidCards = computed<ICard[]>(() => {
  const human = humanPlayer.value
  if (!human) return []
  const ids = new Set(response.validCardIds.value)
  return human.handCards.filter((c) => ids.has(c.id))
})

// ── 卡牌选择处理 ──

function handleSelectCard(cardId: string): void {
  // 弃牌阶段特殊处理
  if (gamePhase.value === GamePhase.PhaseDiscard && isMyTurn.value && availableActions.value.needDiscard) {
    handleDiscardSelect(cardId)
    return
  }
  cardPlay.selectCard(cardId)
}

function handleSelectTarget(targetId: string): void {
  cardPlay.selectTarget(targetId)
}

function handleHoverTarget(targetId: string | null): void {
  cardPlay.hoverTarget(targetId)
}

async function handleConfirmPlay(): Promise<void> {
  await cardPlay.confirmPlay()
  checkGameOverStatus()
}

async function handleEndPhase(): Promise<void> {
  cardPlay.cancelSelection()
  discardSelectedIds.value = []
  await controller.value?.endPhase()
  checkGameOverStatus()
}

function handleCancelAll(): void {
  cardPlay.cancelSelection()
  discardSelectedIds.value = []
}

// ── 弃牌处理 ──

function handleDiscardSelect(cardId: string): void {
  const idx = discardSelectedIds.value.indexOf(cardId)
  if (idx >= 0) {
    discardSelectedIds.value = discardSelectedIds.value.filter((id) => id !== cardId)
  } else {
    const maxDiscard = availableActions.value.discardCount
    if (discardSelectedIds.value.length < maxDiscard) {
      discardSelectedIds.value = [...discardSelectedIds.value, cardId]
    }
  }
}

async function handleConfirmDiscard(): Promise<void> {
  await controller.value?.discardCards([...discardSelectedIds.value])
  discardSelectedIds.value = []
  checkGameOverStatus()
}

// ── 响应处理 ──

function handleResponseSelectCard(cardId: string): void {
  response.selectCard(cardId)
}

// ── 技能处理 ──

async function handleActivateSkill(effectId: string): Promise<void> {
  // 主动技发动 — 可能需要进一步选择目标和卡牌
  // 当前阶段：直接将选中的目标/卡牌传入
  await skill.activateSkill(
    effectId,
    cardPlay.selectedTargetIds.value.length > 0
      ? [...cardPlay.selectedTargetIds.value]
      : [],
    [],
  )
  checkGameOverStatus()
}

// ── 游戏结束检测 ──

/** 检查游戏是否结束，若结束则显示结果弹窗 */
function checkGameOverStatus(): void {
  const ctrl = controller.value
  if (!ctrl) return

  const result = ctrl.checkGameOver()
  if (result) {
    gameResult.value = result
    gameOverPlayers.value = ctrl.getGameState()?.players ?? []
    showGameOver.value = true

    logStore.addLog({
      id: `log_gameover_${Date.now()}`,
      timestamp: Date.now(),
      round: result.totalRounds,
      phase: GamePhase.GameOver,
      message: `游戏结束: ${result.reason}`,
      level: LogLevel.Info,
    })
  }
}

// ── 游戏流程 ──

async function handleStartGame(): Promise<void> {
  const ctrl = controller.value
  if (!ctrl) return

  showWelcome.value = false
  gameStartTime.value = Date.now()
  logStore.clear()

  try {
    // 使用标准 5 人局配置初始化游戏
    const config: IGameConfig = { ...standard5pConfig }

    logStore.addLog({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      round: 0,
      phase: GamePhase.NotStarted,
      message: `正在初始化游戏 (模式: ${config.mode}, ${config.playerCount} 人局)...`,
      level: LogLevel.Info,
    })

    // 创建并初始化游戏引擎
    await ctrl.createGame(config)

    logStore.addLog({
      id: `log_${Date.now() + 1}`,
      timestamp: Date.now(),
      round: 0,
      phase: GamePhase.Prepare,
      message: `游戏初始化完成 — ${config.playerCount} 名玩家就绪，开始第一回合`,
      level: LogLevel.Info,
    })

    // 启动游戏：进入第一个玩家的回合
    await ctrl.startGame()

    // 启动后检查游戏状态
    checkGameOverStatus()
  } catch (err) {
    console.error('[GameView] 游戏初始化失败:', err)
    logStore.addLog({
      id: `log_error_${Date.now()}`,
      timestamp: Date.now(),
      round: 0,
      phase: GamePhase.NotStarted,
      message: `游戏初始化失败: ${err instanceof Error ? err.message : String(err)}`,
      level: LogLevel.Error,
    })
    // 初始化失败时重新显示欢迎弹窗
    showWelcome.value = true
  }
}

function handleLeave(): void {
  controller.value?.destroy()
  gameStore.reset()
  logStore.clear()
  router.push('/')
}

/** 再来一局 */
async function handlePlayAgain(): Promise<void> {
  showGameOver.value = false
  gameResult.value = null
  gameOverPlayers.value = []
  logStore.clear()
  animation.clearHistory()
  // 清理上一局状态并重新初始化
  controller.value?.destroy()
  gameStore.reset()
  // 重新创建 controller 并绑定 store
  const ctrl = new GameController()
  ctrl.bindStore(gameStore as unknown as { syncFromEngine: (s: never) => void; reset: () => void })
  controller.value = ctrl
  await handleStartGame()
}

/** 返回大厅 */
function handleGoLobby(): void {
  showGameOver.value = false
  controller.value?.destroy()
  gameStore.reset()
  logStore.clear()
  animation.clearHistory()
  router.push('/')
}

// ── 生命周期 ──
onMounted(() => {
  const ctrl = new GameController()
  // gameStore 满足 IGameStore 接口（syncFromEngine / reset），直接绑定
  ctrl.bindStore(gameStore as unknown as { syncFromEngine: (s: never) => void; reset: () => void })
  controller.value = ctrl
})

onUnmounted(() => {
  controller.value?.destroy()
})
</script>

<style lang="less" scoped>
.game-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a2e;
  color: #e0e0e0;
  overflow: hidden;
}

// ── 顶部栏 ──
.top-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: linear-gradient(180deg, #16213e, #0f3460);
  border-bottom: 2px solid #533483;
  flex-shrink: 0;
  min-height: 44px;

  > :first-child {
    flex: 1;
  }
}

.top-right-actions {
  flex-shrink: 0;
}

// ── 主区域 ──
.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.board-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.side-panel {
  width: 200px;
  flex-shrink: 0;
  border-left: 1px solid rgba(83, 52, 131, 0.3);
  padding: 8px;
  overflow-y: auto;
}

// ── 底栏 ──
.bottom-bar {
  display: flex;
  flex-shrink: 0;
  border-top: 2px solid #533483;
  background: linear-gradient(0deg, #16213e, #0f3460);
}

.hand-area {
  flex: 1;
  padding: 8px 16px;
  min-height: 140px;
}

.log-panel {
  width: 280px;
  border-left: 1px solid #533483;
  flex-shrink: 0;
}
</style>
