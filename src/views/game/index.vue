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
        @end-play="handleEndPlay"
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
          :deck-count="gameStore.deckCount"
          :discard-count="gameStore.discardCount"
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
import { ref, shallowRef, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NSpace,
  NButton,
  NModal,
  NCard,
} from 'naive-ui'
import { useGameStore } from '@/store/game-store'
import { GameController } from '@/services/game-controller'
import { HumanDecisionService } from '@/services/human-decision'
import type { ResponseRequest } from '@/services/human-decision'
import { AIController } from '@core/services/ai-controller'
import { AIDifficulty } from '@core/contracts/ai.interface'
import { GamePhase, SkillType, LogLevel } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import type { IGameConfig } from '@core/contracts/game.interface'
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

/**
 * 人类坐哪个位。
 *
 * 全仓只有这一个答案：下面 `humanPlayer` 取的就是 `players[0]`，
 * `HumanDecisionService` 判「这个座位是不是人」时也读它。
 */
const HUMAN_SEAT = 0

/**
 * 一局所用的全部执行者。
 *
 * 控制器与 AI 兜底方**必须成对出生**：决策服务是 `createGame` 的入参，
 * 而 AI 要在 `createGame` 之后才注册得上（那时才有玩家 ID）。
 * 分成两个 ref 就会出现「换了控制器没换 AI」这种半新半旧的组合。
 */
interface GameSession {
  controller: GameController
  /** 其余座位的兜底决策方 */
  ai: AIController
}

// 用 shallowRef：ref 的 UnwrapRef 会剥掉类的私有成员，导致类型不匹配
const session = shallowRef<GameSession | null>(null)

// ── 欢迎弹窗 ──
const showWelcome = ref(true)

// ── 弃牌选择（弃牌阶段使用的独立选中状态） ──
const discardSelectedIds = ref<string[]>([])

// ── Controller getter（用于 hooks） ──
function getController(): GameController | null {
  return session.value?.controller ?? null
}

// ── Hooks ──
const cardPlay = useCardPlay(getController, () => gameStore)
const response = useResponse()
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

/**
 * 人类玩家信息。
 *
 * **依赖必须进门就挂**（欠账 D45）：引擎出生前这个 computed 也算过一次，
 * 那一次在 `if (!state) return null` 就早退了，**根本没碰到 Store**——
 * 于是它的依赖里只剩下 `session`，之后 Store 怎么变它都不重算，
 * 手牌区就永远是一块空白（`v-if="humanPlayer"` 一假到底）。
 *
 * 「早退的那一次没注册上依赖」是最难看出来的一种冻住：
 * 代码里明明读着 Store，读的那一行却从来没被执行过。
 */
const humanPlayer = computed(() => {
  const ctrl = getController()
  void ctrl?.revision
  const state = ctrl?.getGameState()
  if (!state) return null
  const human = state.players[HUMAN_SEAT]
  if (!human) return null
  const uiInfo = gameStore.uiPlayers.find((p) => p.id === human.id)
  return { ...human, isCurrentPlayer: uiInfo?.isCurrentPlayer ?? false }
})

/** 是否是人类玩家的回合 */
const isMyTurn = computed(() => {
  return humanPlayer.value?.isCurrentPlayer ?? false
})

/**
 * 此刻我能做什么。
 *
 * **响应式依赖挂在控制器的版本号上**（欠账 D45）——不是 `uiState`。
 *
 * 「引擎此刻是不是在问我」住在控制器里，是普通字段，Vue 看不见它。
 * 而引擎**提问时不推状态**：阶段入口那次同步发生在提问之前
 * （`executeTurn` 先写 `currentPhase` 再 `onPhaseSync`，提问是
 * `doPhaseUse` 里问出的）。所以靠 Store 同步去触发重算，
 * 界面就永远停在最后一次同步时的样子——没有按钮、没有可点的牌，
 * 只有一句「等待其他玩家操作…」，而引擎正悬着等这一位答复。
 *
 * 控制器在「提问挂起 / 答复 / 状态同步」三个时刻各报一次变更
 * （见 `GameController.revision`），这里读它，才算真的跟上了引擎。
 */
const availableActions = computed(() => {
  const ctrl = getController()
  void ctrl?.revision
  if (!ctrl) {
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
  return ctrl.getAvailableActions()
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

// ── 人类决策通道（D34 的插头）──
//
// 人那一位被问到时（`waitForResponse` → `HumanDecisionService` → 这里），
// 把问题摆到弹窗上，等他的手指。
//
// **不要把 `validCards` 拿去过一遍 `humanPlayer.handCards`**——
// 引擎给的候选里可能混着**虚拟牌**（`viewAs` 造出来充当【闪】的那一张），
// 它们压根不在手牌数组里。滤一遍就把它们滤没了，
// 于是「明明有闪却一张都点不到」（`response-inquiry.ts:70` 记的就是这件事）。
const responseCardPool = ref<ICard[]>([])

/** 弹窗上摆的那几张牌 */
const responseValidCards = computed<ICard[]>(() => responseCardPool.value)

async function askHumanResponse(req: ResponseRequest): Promise<ICard | null> {
  responseCardPool.value = [...req.validCards]

  const chosenId = await response.open({
    prompt: req.prompt,
    validCardIds: req.validCards.map((c) => c.instanceId),
    // 引擎没给倒计时就不限时：人在想，不该替他按秒表。
    // 反过来说，只要开了倒数，超时也必须答复（= 不出）——
    // 见 `useResponse.settleWith`，一条悬着的 Promise 就是一次事件栈死锁。
    timeoutMs: req.timeout && req.timeout > 0 ? req.timeout : 0,
    required: false,
  })

  responseCardPool.value = []
  if (!chosenId) return null
  return req.validCards.find((c) => c.instanceId === chosenId) ?? null
}

/**
 * 开一局所需的全部执行者。
 *
 * **这里必须装上决策服务**（欠账 D34）：引擎是全仓唯一的问题发起者，
 * 它问【闪】【桃】【无懈】时如果 `decisionService` 缺席，
 * `EffectContext.waitForResponse` 进门一行就返回「不响应」——
 * 攻击必中、濒死必死，界面上却看不出任何异常。
 *
 * 而装上之后也**不能把 UI 直接塞进去**：引擎对**所有座位**提问，
 * 除了 `HUMAN_SEAT` 那一位，其余都得交给 AI。`HumanDecisionService`
 * 干的就是这次分流。
 *
 * 开局与「再来一局」都走这一个出口：以前这两处各写了一遍构造，
 * 第二遍漏了这一句——第二局又变回一个不会防守的单机。
 */
function createSession(): GameSession {
  const ctrl = new GameController()
  // gameStore 满足 IGameStore 接口（同步 / 查询口 / 重置），直接绑定
  ctrl.bindStore(gameStore)

  const ai = new AIController({ defaultDifficulty: AIDifficulty.Normal })

  ctrl.setDecisionService(
    new HumanDecisionService({
      humanSeatIndex: HUMAN_SEAT,
      fallback: ai,
      channel: {
        askForResponse: askHumanResponse,
        //
        // **出牌与弃牌必须登记**（欠账 D38 形态丁）。
        //
        // 以前这两条**没有登记**，理由写的是「由按钮直接驱动」——
        // 那个理由只在旧的推进模型下才成立：那时 `start()` 会把第一个回合
        // 整轮跑完，UI 再拿一个「推一步」的接口去推。而那条路上根本没人
        // 写交回合，于是「按结束阶段永远停在同一个人」。
        //
        // 形态丁下引擎是唯一推进者：它在出牌阶段**挂起**等人答复，
        // 不登记 = 人的出牌阶段被静默跳过（缺省答案就是 `null`），
        // 他一张牌都打不出去，回合却被算作「已行动」。
        //
        // 登记之后按钮也不再「驱动」：它们只是把答案递回给这个挂起的提问
        // （`ctrl.playCard` / `ctrl.endCardPlay` / `ctrl.discardCards`）。
        askForCardPlay: (req) => ctrl.askCardPlay(req.player, req.options),
        askForDiscard: (req) =>
          ctrl.askDiscard(req.player, req.count, req.validCards),
      },
    }),
  )

  return { controller: ctrl, ai }
}

/**
 * 把 AI 注册到「不是人的那几个座位」上。
 *
 * 时机是有讲究的：必须在 `createGame` **之后**（那时才有玩家的 ID）、
 * `startGame` **之前**（否则第一个回合里 AI 还没有脑可用，一律降级随机）。
 */
function registerAIPlayers(ctrl: GameController, ai: AIController): void {
  const state = ctrl.getGameState()
  if (!state) return

  ai.setStateAccessor(() => ctrl.getGameState()!)
  ai.registerPlayers(
    state.players.filter((p) => p.seatIndex !== HUMAN_SEAT).map((p) => p.id),
    AIDifficulty.Normal,
  )
}

// ── 卡牌选择处理 ──

function handleSelectCard(cardId: string): void {
  // 挂着一个弃牌提问时，点手牌是「选要弃的那几张」
  if (isMyTurn.value && availableActions.value.needDiscard) {
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

/**
 * 「结束出牌」按钮 —— 给挂起的出牌提问答复 `null`。
 *
 * 它**不推进引擎**：引擎在出牌阶段的循环里问到 `null` 就自己结束这个阶段，
 * 然后一路走下去、把回合交给下一位（欠账 D38）。
 */
async function handleEndPlay(): Promise<void> {
  cardPlay.cancelSelection()
  discardSelectedIds.value = []
  getController()?.endCardPlay()
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

/**
 * 「确认弃牌」—— 答复挂起的弃牌提问。
 *
 * 与「结束出牌」同理：**它不执行弃牌、也不推进引擎**（欠账 D38）。
 * 弃哪几张由人点，弃这个动作由引擎在收到答复后做一次。
 */
async function handleConfirmDiscard(): Promise<void> {
  await getController()?.discardCards([...discardSelectedIds.value])
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
  const ctrl = getController()
  if (!ctrl) return

  const result = ctrl.checkGameOver()
  if (result) {
    gameResult.value = result
    gameOverPlayers.value = ctrl.getGameState()?.players ?? []
    showGameOver.value = true

    logStore.addLog({
      id: `log_gameover_${Date.now()}`,
      round: result.totalRounds,
      phase: GamePhase.GameOver,
      message: `游戏结束: ${result.reason}`,
      level: LogLevel.Info,
    })
  }
}

// ── 游戏流程 ──

async function handleStartGame(): Promise<void> {
  const ctrl = getController()
  if (!ctrl) return

  showWelcome.value = false
  gameStartTime.value = Date.now()
  logStore.clear()

  try {
    // 使用标准 5 人局配置初始化游戏
    const config: IGameConfig = { ...standard5pConfig }

    logStore.addLog({
      id: `log_init_${Date.now()}`,
      round: 0,
      phase: GamePhase.NotStarted,
      message: `正在初始化游戏 (模式: ${config.mode}, ${config.playerCount} 人局)...`,
      level: LogLevel.Info,
    })

    // 创建并初始化游戏引擎
    await ctrl.createGame(config)

    // AI 有了脑之后才能进第一个回合
    const s = session.value
    if (s) registerAIPlayers(s.controller, s.ai)

    logStore.addLog({
      id: `log_init_done_${Date.now()}`,
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
      round: 0,
      phase: GamePhase.NotStarted,
      message: `游戏初始化失败: ${err instanceof Error ? err.message : String(err)}`,
      level: LogLevel.Error,
    })
    // 初始化失败时重新显示欢迎弹窗
    showWelcome.value = true
  }
}

/**
 * 收掉一局的全部执行者。
 *
 * **卸载 / 路由离开 / 「再来一局」/ 重置会话 全部走这一个出口**——
 * 这几处以前各写一遍，第二遍漏掉某句就会留下半新半旧的组合
 * （D34 就是这么来的：开局装了决策服务，第二局忘了装）。
 *
 * 次序有讲究：**先把挂起的提问答复掉，再拆控制器**。
 * 一条永不 resolve 的 Promise 是一次事件栈死锁——不报错、不红测试，
 * 只是整局静静地卡住（欠账 D38 的死锁纪律）。
 * 答复由两端各自负责：控制器那两个（`askCardPlay` / `askDiscard`）在
 * `destroy()` 里按缺省交回，响应弹窗那个在这里按「不出」交回。
 */
function resetSession(): void {
  response.close()
  getController()?.destroy()
  session.value = null
  gameStore.reset()
  logStore.clear()
  animation.clearHistory()
}

function handleLeave(): void {
  resetSession()
  router.push('/')
}

/** 再来一局 */
async function handlePlayAgain(): Promise<void> {
  showGameOver.value = false
  gameResult.value = null
  gameOverPlayers.value = []
  resetSession()
  // 连同 AI 兜底方一起重建，走的是开局那一套唯一的出口
  session.value = createSession()
  await handleStartGame()
}

/** 返回大厅 */
function handleGoLobby(): void {
  showGameOver.value = false
  resetSession()
  router.push('/')
}

// ── 生命周期 ──
onMounted(() => {
  session.value = createSession()
})

onUnmounted(() => {
  resetSession()
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
