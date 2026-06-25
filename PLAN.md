# 联盟杀 · 分阶段开发计划

> **总览**: 本文档将整个项目拆解为可独立验证的开发步骤。每一步包含：实现内容、涉及文件、依赖项、验证方法和完成标准。
>
> **核心原则**: 引擎优先 → 数据驱动 → UI 后置 → 渐进扩展

---

## 目录

- [Phase 0: 项目基础设施](#phase-0-项目基础设施)
- [Phase 1: 核心接口与类型定义](#phase-1-核心接口与类型定义)
- [Phase 2: 事件系统 (LIFO 栈)](#phase-2-事件系统-lifo-栈)
- [Phase 3: 状态机](#phase-3-状态机)
- [Phase 4: 实体与数据模型](#phase-4-实体与数据模型)
- [Phase 5: 游戏子系统](#phase-5-游戏子系统)
- [Phase 6: 回合与阶段管理](#phase-6-回合与阶段管理)
- [Phase 7: 基础卡牌效果](#phase-7-基础卡牌效果)
- [Phase 8: 技能系统](#phase-8-技能系统)
- [Phase 9: 角色与胜利条件](#phase-9-角色与胜利条件)
- [Phase 10: GameController 桥接层](#phase-10-gamecontroller-桥接层)
- [Phase 11: AI 系统](#phase-11-ai-系统)
- [Phase 12: UI - 游戏桌面](#phase-12-ui---游戏桌面)
- [Phase 13: UI - 玩家交互](#phase-13-ui---玩家交互)
- [Phase 14: UI - 游戏流程与动画](#phase-14-ui---游戏流程与动画)
- [Phase 15: 完整游戏模式](#phase-15-完整游戏模式)
- [Phase 16: 测试覆盖与优化](#phase-16-测试覆盖与优化)
- [Phase 17: 网络对战 (远期)](#phase-17-网络对战-远期)

---

## Phase 0: 项目基础设施

### Step 0.1 — 创建完整目录结构

按照 `CLAUDE.md` 定义的目录结构，创建所有空目录和占位文件。

**创建目录**:
```
core/contracts/
core/engine/
core/event/
core/system/
core/entity/
core/services/
core/boot/
source/heroes/
source/cards/
source/modes/
source/base/
store/
hooks/
services/
utils/
```

**验证**: `find src -type d | sort` 输出与设计一致

---

### Step 0.2 — 修复现有测试

当前测试 `src/__tests__/App.spec.ts` 期望 `"You did it!"` 但 [views/home/index.vue](src/views/home/index.vue) 显示 `"1123"`。修复测试以匹配当前状态。

**涉及文件**:
- 修改: `src/__tests__/App.spec.ts`

**验证**: `npm run test:unit` 全部通过

---

### Step 0.3 — 配置路径别名

配置 `@/` 映射到 `src/`，`@core/` 映射到 `src/core/`，`@source/` 映射到 `src/source/`。

**涉及文件**:
- 修改: `tsconfig.app.json` (paths)
- 修改: `vite.config.ts` (resolve.alias)

**验证**: 在 `src/main.ts` 中使用 `import { } from '@core/contracts/index'`，确认 `npm run type-check` 无报错

---

## Phase 1: 核心接口与类型定义 ✅

### Step 1.1 — 定义基础枚举与常量

定义游戏中所有枚举：卡牌花色、卡牌大类(CardType)、区域标识(ZoneType)、游戏阶段(GamePhase)、触发时机(TriggerTiming, 不含Before/After后缀, 改用TriggerStage)、技能类型(SkillType)、身份类型(RoleType)、事件状态(EventStatus)、装备槽位(EquipSlot)、势力(Kingdom)、伤害属性(DamageType+冰+毒)、技能频率(Frequency)、日志级别(LogLevel)。

**创建文件**:
- `src/core/contracts/enums.ts`

```ts
// 关键枚举:
export enum CardSuit { Spade, Heart, Club, Diamond }
export enum CardType { Basic, Trick, Equip }
export enum ZoneType { Deck, Hand, Equip, Judge, Discard, Processing }
export enum PhaseType { Prepare, Judge, Draw, Play, Discard, End }
export enum TriggerTiming { /* 全部触发时机 */ }
export enum SkillType { Active, Passive, Locked, Limited, Awaken }
export enum RoleType { Lord, Loyalist, Rebel, Spy }
```

**验证**:
- 所有枚举值唯一、无遗漏
- 与 `CLAUDE.md` 描述的触发时机清单一致
- `npm run type-check` 通过

---

### Step 1.2 — 定义核心接口

定义所有核心数据结构的 TypeScript 接口。

**创建文件**:
-  — , , , , ,  等基础类型
-  — (source/player均Optional), , , , (含TriggerStage)
-  — 统一(不含独立ICardDefinition, 基础字段+运行时字段合一)
-  — , (含power/maxPower/heroes[]/marks/shouldSkipPhases)
-  — 统一(不含独立IHeroDefinition, 含maxHp/maxPower/effectIds)
-  — 统一效果系统(替换旧ISkill, 卡牌与英雄共用), , , , , 
-  — , , (使用GamePhase)
-  — 统一导出

**关键接口设计**:
```ts
// ISkillContext — 技能执行上下文（受限访问接口）
interface ISkillContext {
  event: IGameEvent
  player: IPlayer           // 技能持有者
  game: IGameState          // 只读游戏状态
  triggerCard?: ICard       // 触发此技能的卡牌
  damageEvent?: IGameEvent  // 如果是伤害触发
  
  // 受限写入
  drawCards(count: number): Promise<ICard[]>
  discardCards(cards: ICard[]): Promise<void>
  damageTarget(target: IPlayer, amount: number): Promise<void>
  recoverHp(target: IPlayer, amount: number): Promise<void>
  // ... 其他受限操作
}
```

**验证**:
- 所有接口编译无错误
- 接口之间引用正确（`IPlayer` 引用 `IHero`，`IHero` 引用 `ISkill` 等）
- `npm run type-check` 通过
- 审查：确认所有接口满足 `CLAUDE.md` 中各系统的需求

---

### 关键设计决策

1. **触发时机不含Before/After**: 由('Before'|'Content'|'After')表达相对位置, 避免事件类型自身的语义混淆
2. **统一Effect系统**: 卡牌技能、装备效果、英雄技能全部使用, 由全局EffectRegistry管理, 卡牌/英雄通过引用
3. **合并定义/实体**: 不区分/或/, 统一为单一接口, 运行时字段以默认值初始化
4. **事件参与者Optional**: 和均可为空, 解决闪电等系统事件无明确来源的问题
5. **阶段全生命周期**: 覆盖prepare→roundStart→...→gameOver, 替代仅含回合内阶段的旧PhaseType

### Step 1.3 — 定义 DI 服务接口 + AI 接口

**创建文件**:
-  — , , , , , 
-  — (AI决策器), 枚举, , 

定义依赖注入的服务接口，作为引擎与外部（Store、AI、UI）的契约。

**创建文件**:
- `src/core/contracts/services.interface.ts`

```ts
interface IStoreService {
  syncGameState(state: IGameState): void
  syncPlayerState(player: IPlayer): void
  // ...
}

interface ILoggerService {
  log(message: string, level: LogLevel): void
}

interface IRandomService {
  shuffle<T>(array: T[]): T[]
  nextInt(min: number, max: number): number
}

interface IUIDecisionService {
  askForCardUse(player: IPlayer, options: CardUseOption[]): Promise<CardUseResult>
  askForResponse(player: IPlayer, prompt: string, validCards: ICard[]): Promise<ICard | null>
  askForTarget(player: IPlayer, candidates: IPlayer[]): Promise<IPlayer>
  // ...
}
```

**验证**:
- 编译通过
- 接口抽象度合适（不包含 UI 或引擎实现细节）

---

## Phase 2: 事件系统 (LIFO 栈)

> **优先级: 🔴 最高** — 事件系统是整个引擎的脊梁，所有其他功能依赖它。

### Step 2.1 — 实现 EventChain (LIFO 栈)

**创建文件**:
- `src/core/event/event-chain.ts`

功能:
- `push(event: IGameEvent): void` — 推入事件到栈顶
- `pop(): IGameEvent | null` — 弹出栈顶事件
- `peek(): IGameEvent | null` — 查看栈顶
- `isEmpty(): boolean`
- `getStack(): IGameEvent[]` — 获取完整栈（调试用）

**验证**:
- 单元测试: `EventChain.test.ts`
  - 测试 push/pop 顺序 (LIFO)
  - 测试嵌套场景: push A → push B → pop (B) → pop (A)
  - 测试空栈 pop 返回 null
  - 测试 peek 不改变栈状态

---

### Step 2.2 — 实现游戏事件 (GameEvent)

**创建文件**:
- `src/core/event/game-event.ts`

```ts
class GameEvent implements IGameEvent {
  id: string
  name: string
  type: TriggerTiming
  source: IPlayer            // 事件来源
  targets: IPlayer[]         // 事件目标
  card?: ICard               // 关联卡牌
  parent?: IGameEvent        // 父事件（嵌套）
  children: IGameEvent[]     // 子事件
  
  // 流水线状态
  status: EventStatus        // WAITING → ... → COMPLETED
  canceled: boolean
  prevented: boolean
  
  // 事件携带的自定义数据
  data: Record<string, any>
}
```

**验证**:
- 单元测试: `GameEvent.test.ts`
  - 测试事件创建、父子关联
  - 测试状态流转合法性

---

### Step 2.3 — 实现 EventDispatcher (AOP 流水线)

**创建文件**:
- `src/core/event/event-dispatcher.ts`

实现流水线各阶段的分发逻辑:
```ts
class EventDispatcher {
  async dispatch(event: IGameEvent, hooks: SkillHook[]): Promise<void> {
    // WAITING → SKIP_CHECK → (CANCELLED) → BEFORE → BEGIN
    //   → PREPARE → CONTENT → PREVENT → (PREVENTED) → END → AFTER → COMPLETED
  }
}
```

**验证**:
- 单元测试: `EventDispatcher.test.ts`
  - 测试每一阶段都被正确调用
  - 测试 canceled 事件跳过 CONTENT 等阶段
  - 测试 prevented 事件走 PREVENTED 分支
  - 测试嵌套事件: A 的 CONTENT 中触发 B → B 完整结算 → A 继续

---

### Step 2.4 — 实现 EventTrigger (触发匹配)

**创建文件**:
- `src/core/event/event-trigger.ts`

功能:
- 注册技能监听器 `register(skill: ISkill, player: IPlayer): void`
- 匹配触发: 当事件发生时，找到所有匹配的 skill
- 按优先级排序结果

**验证**:
- 单元测试: `EventTrigger.test.ts`
  - 注册技能 → 触发事件 → 验证匹配结果
  - 多技能同时匹配 → 验证优先级排序
  - 测试 player/global/target 三种触发范围

---

### Step 2.5 — 实现 EventPauseManager 与 ResponseWindow

**创建文件**:
- `src/core/event/event-pause-manager.ts`
- `src/core/event/response-window.ts`

功能:
- `pause(reason: string): Promise<void>` — 暂停事件栈
- `resume(): void` — 恢复执行
- `ResponseWindow`: 封装暂停 + 等待决策的 Promise

**验证**:
- 单元测试: `EventPauseManager.test.ts`
  - 暂停 → 验证栈停止 → 恢复 → 验证继续
  - 嵌套暂停/恢复
- 单元测试: `ResponseWindow.test.ts`
  - 创建窗口 → resolve Promise → 验证结果

---

### Step 2.6 — 实现 PriorityManager

**创建文件**:
- `src/core/event/priority-manager.ts`

功能:
- 对同时机的技能按 `priority` 排序
- 锁定技优先于非锁定技
- 同名技能去重

**验证**:
- 单元测试: `PriorityManager.test.ts`
  - 不同 priority 排序
  - 锁定技优先
  - 去重逻辑

---

## Phase 3: 状态机

### Step 3.1 — 实现 GameStateMachine

**创建文件**:
- `src/core/engine/state-machine.ts`

功能:
- 状态注册: `registerState(state, transitions)`
- 状态转移: `transition(to, condition?)`
- 通配符 `*`: 匹配任意转移
- 非法转移回调
- 转移前后钩子

**验证**:
- 单元测试: `GameStateMachine.test.ts`
  - 正常状态转移
  - 条件转移（满足/不满足条件）
  - 通配符匹配
  - 非法转移 → 回调触发
  - 完整游戏流程: NotStarted → PrepareGame → ROUND_START → PHASE_PREPARE → ... → GAME_OVER

---

## Phase 4: 实体与数据模型

### Step 4.1 — 实现 Card 实体

**创建文件**:
- `src/core/entity/card.ts`

```ts
class Card implements ICard {
  id: string
  name: string
  type: CardType
  subType: CardSubType
  suit: CardSuit
  rank: number           // 1-13 (A-K)
  owner?: IPlayer        // 当前所属玩家
  zone: ZoneType         // 当前所在区域
  visibleTo: Set<IPlayer> // 对哪些玩家可见
  effect: ICardEffect    // 卡牌效果定义
}
```

**验证**:
- 单元测试: `Card.test.ts`
  - 创建卡牌 → 验证属性
  - 区域转移 → `moveTo(zone)` → 验证 zone 变更
  - 可见性控制

---

### Step 4.2 — 实现 Player 实体

**创建文件**:
- `src/core/entity/player.ts`

```ts
class Player implements IPlayer {
  id: string
  name: string
  seatIndex: number        // 座位号 (0-N)
  hero?: IHero
  hp: number
  maxHp: number
  hand: ICard[]            // 手牌
  equipArea: Map<EquipSlot, ICard>  // 装备区
  judgeArea: ICard[]       // 判定区
  skills: ISkill[]         // 当前有效技能
  role?: RoleType
  alive: boolean
}
```

**验证**:
- 单元测试: `Player.test.ts`
  - 创建玩家 → 装备武器 → 验证攻击范围
  - HP 变更（不能超过 maxHp/低于0除外）
  - 死亡标记

---

### Step 4.3 — 实现 Hero 实体

**创建文件**:
- `src/core/entity/hero.ts`

```ts
class Hero implements IHero {
  id: string
  name: string
  title: string
  maxHp: number          // 默认体力上限
  skills: ISkill[]       // 技能列表
  kingdom: Kingdom       // 势力
  gender: Gender
}
```

**验证**:
- 单元测试: `Hero.test.ts`
  - 从定义创建 Hero → 技能注册

---

### Step 4.4 — 实现 GameState

**创建文件**:
- `src/core/entity/game-state.ts`

```ts
class GameState implements IGameState {
  players: IPlayer[]
  deck: ICard[]           // 牌堆
  discardPile: ICard[]    // 弃牌堆
  currentRound: number
  currentPlayerIndex: number
  currentPhase: PhaseType
  stateMachine: GameStateMachine
  eventChain: EventChain
  log: LogEntry[]
  config: IGameConfig
}
```

**验证**:
- 单元测试: `GameState.test.ts`
  - 初始化状态 → 验证默认值
  - 回合推进 → currentPlayerIndex 更新

---

### Step 4.5 — 实现基础 Source 数据

创建第一批游戏数据文件。

**创建文件**:
- `src/source/base/phases.ts` — 阶段定义
- `src/source/base/triggers.ts` — 触发时机枚举值
- `src/source/base/constants.ts` — 游戏常量（起始手牌数、HP 上限等）
- `src/source/cards/basic.ts` — 4张基本牌定义（杀、闪、桃、酒）
- `src/source/cards/tricks.ts` — 锦囊牌定义（首批: 过河拆桥、顺手牵羊、无中生有、南蛮入侵、万箭齐发、决斗、无懈可击）
- `src/source/cards/equips.ts` — 装备牌定义（首批: 诸葛连弩等基础武器）
- `src/source/heroes/standard.ts` — 标准版武将数据（首批: 刘备、关羽、张飞、曹操、孙权等 8-10 名）
- `src/source/modes/standard-5p.ts` — 标准5人局配置
- `src/source/modes/standard-8p.ts` — 标准8人局配置

**Source 数据格式**:
```ts
// src/source/heroes/standard.ts
export const CaoCao: IHeroDefinition = {
  id: 'caocao',
  name: '曹操',
  title: '魏武帝',
  kingdom: 'wei',
  maxHp: 4,
  gender: 'male',
  skills: ['jianxiong', 'hujia'],  // 技能 ID 引用
}

// src/source/cards/basic.ts
export const Sha: ICardDefinition = {
  id: 'sha',
  name: '杀',
  type: CardType.Basic,
  subType: 'sha',
  description: '对一名角色造成1点伤害',
}
```

**验证**:
- `npm run type-check` 通过
- 数据格式与 `ICardDefinition` / `IHeroDefinition` 接口一致
- 手动审查: 卡牌花色/点数分布合理

---

## Phase 5: 游戏子系统

### Step 5.1 — 实现 DeckManager (牌堆管理)

**创建文件**:
- `src/core/system/deck-manager.ts`

功能:
- 初始化牌堆（根据游戏模式配置）
- 洗牌
- 抽牌 `draw(count)`
- 弃牌 `discard(cards)`
- 回收: 弃牌堆 → 洗牌 → 牌堆（弃牌堆不足时触发）
- 判定牌处理

**验证**:
- 单元测试: `DeckManager.test.ts`
  - 初始化标准牌堆 → 验证数量 (160张减去初始手牌)
  - 抽牌 → 手牌增加, 牌堆减少
  - 弃牌堆回收 → 洗牌后牌堆恢复
  - 多次抽牌至牌堆耗尽 → 自动回收

---

### Step 5.2 — 实现 CardSystem (卡牌生命周期)

**创建文件**:
- `src/core/system/card-system.ts`

功能:
- `moveCard(card, fromZone, toZone)` — 卡牌区域间移动
- `useCard(card, source, targets)` — 使用卡牌（hand → processing）
- `discardCard(card, player)` — 弃置卡牌（hand → discard）
- `equipCard(card, player)` — 装备卡牌
- `judgeCard(card, player)` — 放置判定牌
- `transferCard(card, fromPlayer, toPlayer, zone)` — 卡牌转移（过河拆桥等）

**验证**:
- 单元测试: `CardSystem.test.ts`
  - 完整生命周期: Deck → Draw → Hand → Use → Processing → Discard
  - 装备: Hand → Equip
  - 判定: Hand → Judge → (判定结束) → Discard
  - 过河拆桥: Hand → Processing → 目标 Hand → 目标 Discard

---

### Step 5.3 — 实现 DistanceSystem (距离计算)

**创建文件**:
- `src/core/system/distance-system.ts`

功能:
- `getDistance(from, to, state)` — 计算座次距离
- `getAttackRange(player)` — 计算攻击范围（基础1 + 武器加成）
- `isInRange(source, target, state)` — 判断是否在攻击范围内
- 考虑进攻马/防御马/技能影响

**验证**:
- 单元测试: `DistanceSystem.test.ts`
  - 邻座距离 = 1
  - 对座距离（4人局）= 2
  - 8人局各座位距离矩阵验证
  - 武器+进攻马 → 攻击范围扩大
  - 防御马 → 被攻击距离 +1

---

### Step 5.4 — 实现 TargetSystem (目标选择)

**创建文件**:
- `src/core/system/target-system.ts`

功能:
- `validateTargets(source, targets, card, state)` — 校验目标合法性
- `getAvailableTargets(source, card, state)` — 获取可选目标列表
- 考虑: 距离限制、卡牌限制（杀不能对自己）、技能影响

**验证**:
- 单元测试: `TargetSystem.test.ts`
  - 杀 → 可选目标 = 攻击范围内的其他角色
  - 桃 → 可选目标 = 自己（受伤时）/ 濒死角色
  - 顺手牵羊 → 距离1内的角色有手牌/装备
  - 无懈可击 → 任意锦囊牌结算中的目标

---

### Step 5.5 — 实现 DamageSystem (伤害流水线)

**创建文件**:
- `src/core/system/damage-system.ts`

实现完整的伤害流水线:
```
确定来源和属性 → BEFORE_DAMAGE → DAMAGE_PREVENT → DAMAGE_MODIFY
  → DAMAGE_APPLY (扣减体力) → AFTER_DAMAGED → DAMAGE_COMPLETE
```

**验证**:
- 单元测试: `DamageSystem.test.ts`
  - 基本伤害: 来源 → 目标, 1点伤害 → 目标 HP-1
  - 属性伤害: 火杀 → 火属性伤害 → 藤甲受伤+1
  - 伤害预防: 闪响应 → 伤害被阻止
  - 伤害转移: 天香 → 伤害转移给他人
  - 伤害修改: 古锭刀 → 手牌为空时伤害+1

---

### Step 5.6 — 实现 DeathSystem (死亡处理)

**创建文件**:
- `src/core/system/death-system.ts`

功能:
- `checkDying(player)` — 检查濒死状态
- `askForPeach(dyingPlayer)` — 濒死求桃（自己/他人）
- `handleDeath(player)` — 死亡结算（弃牌、身份公开、奖惩）
- `checkGameOver(state)` — 检查胜利条件

**验证**:
- 单元测试: `DeathSystem.test.ts`
  - HP 降至 0 → 进入濒死状态
  - 求桃成功 → HP 恢复 → 存活
  - 求桃失败 → 死亡 → 身份公开 → 奖惩
  - 反贼死亡 → 击杀者摸3牌
  - 主公死亡 → 游戏结束

---

## Phase 6: 回合与阶段管理

### Step 6.1 — 实现 TurnManager

**创建文件**:
- `src/core/engine/turn-manager.ts`

功能:
- `startRound()` — 开始新的一轮
- `nextTurn()` — 切换到下一位存活玩家
- `getCurrentPlayer()` — 获取当前行动玩家
- `skipTurn(player)` — 跳过回合（乐不思蜀）

**验证**:
- 单元测试: `TurnManager.test.ts`
  - 按座位顺序切换回合
  - 跳过死亡玩家
  - 乐不思蜀 → 跳过出牌阶段

---

### Step 6.2 — 实现 PhaseManager

**创建文件**:
- `src/core/engine/phase-manager.ts`

实现6个阶段的具体逻辑:
- **准备阶段**: 触发 `phasePrepare` 事件
- **判定阶段**: 依次处理判定区卡牌（后进先出）
- **摸牌阶段**: 摸2张牌（可被技能修改）
- **出牌阶段**: 玩家主动出牌的主要阶段
- **弃牌阶段**: 手牌数 > 体力上限时弃牌
- **结束阶段**: 触发 `phaseEnd` 事件，弃置回合内标记

**验证**:
- 单元测试: `PhaseManager.test.ts`
  - 完整阶段流转
  - 判定区有闪电 → 先判定闪电
  - 摸牌阶段摸2张
  - 出牌后可主动结束
  - 弃牌阶段: 手牌数 > HP → 强制弃牌

---

### Step 6.3 — 实现 GameEngine 初始化

**创建文件**:
- `src/core/engine/game-engine.ts`

将状态机、事件系统、子系统和阶段管理串联起来。

```ts
class GameEngine {
  state: GameState
  eventChain: EventChain
  eventDispatcher: EventDispatcher
  stateMachine: GameStateMachine
  turnManager: TurnManager
  phaseManager: PhaseManager
  
  // 子系统
  deckManager: DeckManager
  cardSystem: CardSystem
  damageSystem: DamageSystem
  distanceSystem: DistanceSystem
  targetSystem: TargetSystem
  deathSystem: DeathSystem
  
  async init(config: IGameConfig): Promise<void>
  async start(): Promise<void>
  async nextPhase(): Promise<void>
}
```

**验证**:
- 集成测试: `GameEngine.test.ts`
  - 初始化引擎 → 创建牌堆 → 分配角色 → 分配武将 → 发初始手牌
  - 启动游戏 → 进入主公回合准备阶段
  - 完整一个回合的流程（无卡牌操作）

---

## Phase 7: 基础卡牌效果

### Step 7.1 — 实现 EventCompiler (事件编译)

**创建文件**:
- `src/core/event/event-compiler.ts`

将卡牌效果定义编译为可执行事件:

```ts
class EventCompiler {
  compile(cardEffect: ICardEffect, source: IPlayer, targets: IPlayer[]): IGameEvent[]
}
```

**验证**:
- 单元测试: `EventCompiler.test.ts`
  - 编译"使用杀" → 生成完整事件链（指定目标→杀事件→伤害事件）
  - 编译"使用桃" → 生成回复事件

---

### Step 7.2 — 实现基本牌效果

实现4张基本牌的核心逻辑:

| 卡牌 | 效果逻辑 |
|------|---------|
| 杀   | 对目标造成1点伤害（可被闪响应） |
| 闪   | 响应杀，抵消伤害 |
| 桃   | 回复1点体力 / 濒死时救活 |
| 酒   | 出牌阶段: 本回合下一张杀伤害+1 / 濒死时回复1点体力 |

**创建文件**:
- `src/core/system/effects/basic-effects.ts`

**验证**:
- 单元测试: `BasicCardEffects.test.ts`
  - 杀 → 目标出闪 → 伤害抵消
  - 杀 → 目标无闪 → 扣1血
  - 桃 → 回复1血
  - 桃 → 救活濒死角色
  - 酒 + 杀 → 伤害为2

---

### Step 7.3 — 实现非延时锦囊效果

实现首批锦囊牌效果:

| 锦囊 | 效果 |
|------|------|
| 过河拆桥 | 弃置目标角色区域内一张牌 |
| 顺手牵羊 | 获得目标角色区域内一张牌 |
| 无中生有 | 摸2张牌 |
| 南蛮入侵 | 所有其他角色需出杀，否则扣血 |
| 万箭齐发 | 所有其他角色需出闪，否则扣血 |
| 决斗 | 与目标轮流出杀，先不出者扣血 |
| 无懈可击 | 抵消一张锦囊牌效果 |
| 五谷丰登 | 亮出X张牌，依次选一张 |
| 桃园结义 | 所有角色回复1点体力 |
| 借刀杀人 | 目标对其攻击范围内另一角色出杀，否则给你武器 |

**创建文件**:
- `src/core/system/effects/trick-effects.ts`

**验证**:
- 单元测试: `TrickCardEffects.test.ts` — 每种锦囊至少2个测试用例
  - 过河拆桥 → 指定目标手牌/装备/判定区 → 弃置
  - 南蛮入侵 → 每人依次响应 → 不出杀者扣血
  - 无懈可击 → 嵌套事件 → 抵消目标锦囊

---

### Step 7.4 — 实现装备牌效果

| 装备 | 效果 |
|------|------|
| 诸葛连弩 | 出牌阶段可出任意张杀 |
| 青釭剑 | 使用杀时无视目标防具 |
| 雌雄双股剑 | 对异性出杀时，目标需弃牌或让你摸牌 |
| 丈八蛇矛 | 可将2张手牌当杀使用 |
| 贯石斧 | 杀被闪抵消后可弃2张牌强制命中 |
| 八卦阵 | 需要出闪时可判定 |
| 仁王盾 | 黑色杀对你无效 |
| +1马 | 其他角色计算与你的距离+1 |
| -1马 | 你计算与其他角色的距离-1 |

**创建文件**:
- `src/core/system/effects/equip-effects.ts`

**验证**:
- 单元测试: `EquipCardEffects.test.ts`
  - 装备诸葛连弩 → 可以出多张杀
  - 装备八卦阵 → 需要出闪时先判定 → 红色则视为出闪
  - 马 → 距离计算变化

---

## Phase 8: 技能系统

### Step 8.1 — 实现 SkillContext (技能上下文)

**创建文件**:
- `src/core/engine/skill-context.ts`

SkillContext 是 `ISkillContext` 的实现，提供技能所能调用的所有受限操作。它是引擎与技能逻辑之间的安全边界。

**验证**:
- 单元测试: `SkillContext.test.ts`
  - 验证所有操作通过事件系统执行
  - 验证操作权限（不能跨回合修改等）

---

### Step 8.2 — 实现技能加载与注册

**创建文件**:
- `src/core/engine/skill-registry.ts`

功能:
- 从 Hero 定义加载技能
- 注册到 EventTrigger
- 觉醒技的启用/禁用

**验证**:
- 单元测试: `SkillRegistry.test.ts`
  - 加载武将 → 技能注册 → 触发匹配

---

### Step 8.3 — 实现首批武将技能

选择 8 名标准版武将，实现其技能作为第一批。

| 武将 | 技能 | 类型 | 效果 |
|------|------|------|------|
| 曹操 | 奸雄 | 被动 | 受到伤害后获得造成伤害的牌 |
| 曹操 | 护驾 | 主动 | 需要出闪时可令魏势力角色出闪 |
| 刘备 | 仁德 | 主动 | 出牌阶段可将手牌交给其他角色 |
| 关羽 | 武圣 | 主动 | 可将红色牌当杀使用 |
| 张飞 | 咆哮 | 锁定 | 出牌阶段可出任意张杀 |
| 赵云 | 龙胆 | 主动 | 可将杀当闪、闪当杀使用 |
| 马超 | 马术 | 锁定 | 计算距离时始终-1 |
| 马超 | 铁骑 | 主动 | 使用杀时可判定，红色不可闪 |
| 黄月英 | 集智 | 被动 | 使用非延时锦囊后摸1张牌 |
| 黄月英 | 奇才 | 锁定 | 使用锦囊无距离限制 |
| 孙权 | 制衡 | 主动 | 出牌阶段弃X张牌摸X张牌 |
| 吕蒙 | 克己 | 锁定 | 出牌阶段未出/弃杀则跳过弃牌 |

**创建文件**:
- `src/source/heroes/skills/wei-skills.ts` — 魏国武将技能
- `src/source/heroes/skills/shu-skills.ts` — 蜀国武将技能
- `src/source/heroes/skills/wu-skills.ts` — 吴国武将技能
- `src/source/heroes/skills/index.ts` — 技能总导出

**验证**:
- 每个技能至少 2 个单元测试:
  - 曹操·奸雄: 受到杀伤害 → 获得该杀
  - 关羽·武圣: 红色牌 → 可以当杀使用
  - 张飞·咆哮: 出牌阶段 → 可以出多张杀
  - 马超·铁骑: 出杀判定红色 → 无法用闪响应
  - 吕蒙·克己: 未出杀 → 跳过弃牌阶段
  - 等等

---

### Step 8.4 — 技能交互测试

测试多个技能同时触发的交互场景:
- 马超(铁骑) vs 曹操(奸雄) → 铁骑杀曹操，红色判定命中，奸雄获得杀
- 张飞(咆哮) + 诸葛连弩 → 确认不冲突
- 赵云(龙胆) + 关羽(武圣) → 闪当杀使用

**验证**:
- 集成测试: `SkillInteraction.test.ts`

---

## Phase 9: 角色与胜利条件

### Step 9.1 — 实现角色分配系统

**创建文件**:
- `src/core/system/role-system.ts`

功能:
- 根据游戏模式分配身份
- 主公身份公开，其余隐藏
- 身份查询

**验证**:
- 单元测试: `RoleSystem.test.ts`
  - 5人局: 1主 + 1忠 + 2反 + 1内
  - 8人局: 1主 + 2忠 + 4反 + 1内
  - 主公总是玩家0

---

### Step 9.2 — 实现胜利条件判断

**创建文件**:
- `src/core/system/win-condition.ts`

胜利条件:
- 主公胜利: 所有反贼和内奸死亡
- 忠臣胜利: 同主公
- 反贼胜利: 主公死亡
- 内奸胜利: 主公最后死亡（内奸是最后存活的非主公角色）

**验证**:
- 单元测试: `WinCondition.test.ts`
  - 全部反贼死亡 → 主公/忠臣/内奸继续
  - 主公死亡且内奸存活 → 反贼胜利（内奸失败）
  - 主公死亡且仅剩内奸 → 内奸胜利
  - 内奸先死+主公后死 → 反贼胜利

---

## Phase 10: GameController 桥接层

### Step 10.1 — 实现 DI 容器

**创建文件**:
- `src/core/services/di-container.ts`

轻量级依赖注入容器:
```ts
class DIContainer {
  register<T>(token: string, instance: T): void
  resolve<T>(token: string): T
}
```

**验证**:
- 单元测试: `DIContainer.test.ts`
  - 注册/解析
  - 重复注册报错
  - 解析未注册 token 报错

---

### Step 10.2 — 实现 StoreService 与 Pinia Store 同步

**创建文件**:
- `src/core/services/store-service.ts` — IStoreService 实现
- `src/store/game-store.ts` — Pinia Store

功能:
- 引擎 GameState → Pinia Store（单向同步）
- 仅同步 UI 需要的数据（手牌数、HP、装备、阶段等）
- UI 不直接修改 Store 中的游戏数据

**验证**:
- 单元测试: `StoreService.test.ts`
  - 状态变更 → Store 同步 → Vue 响应式更新

---

### Step 10.3 — 实现 GameController

**创建文件**:
- `src/services/game-controller.ts`

UI 与引擎的唯一交互入口:
```ts
class GameController {
  async createGame(config: IGameConfig): Promise<void>
  async startGame(): Promise<void>
  async playCard(cardId: string, targetIds: string[]): Promise<void>
  async respondToWindow(response: any): Promise<void>
  async endPhase(): Promise<void>
  
  // 状态查询
  getGameState(): Readonly<IGameState>
  getCurrentPlayer(): Readonly<IPlayer>
  getAvailableActions(): Action[]
}
```

**验证**:
- 集成测试: `GameController.test.ts`
  - 创建游戏 → 开始 → 进入主公回合准备阶段
  - 主公摸牌 → 出牌阶段 → 出杀 → 流程正确

---

## Phase 11: AI 系统

### Step 11.1 — 实现 AI 决策框架

**创建文件**:
- `src/core/services/ai-controller.ts`
- `src/core/services/ai-strategies.ts`

AI 采用策略模式:
```ts
interface IAIDecisionMaker {
  chooseCardToPlay(hand: ICard[], state: IGameState): CardChoice | null
  chooseTarget(card: ICard, state: IGameState): IPlayer | null
  respondToSha(state: IGameState): ICard | null     // 是否出闪
  respondToPeach(dying: IPlayer, state: IGameState): boolean  // 是否出桃
  chooseCardToDiscard(hand: ICard[], count: number): ICard[]
}
```

**验证**:
- 单元测试: `AIController.test.ts`
  - AI 手中有杀 → 选择出杀
  - AI 需要出闪 → 手中有闪 → 出闪
  - AI 被南蛮入侵 → 手中有杀 → 出杀
  - AI 弃牌阶段 → 弃置价值最低的牌

---

### Step 11.2 — 实现 AI 难度分级

| 难度 | 策略 |
|------|------|
| 新手 | 随机出牌，有响应必出 |
| 普通 | 基本战术（优先出杀、保留闪桃） |
| 困难 | 考虑身份、手牌管理、距离控制 |

**验证**:
- 集成测试: `AIDifficulty.test.ts`
  - 新手 AI 随机操作 → 游戏可正常进行
  - 困难 AI 倾向于攻击主公（如果是反贼）

---

## Phase 12: UI - 游戏桌面

### Step 12.1 — 实现基础布局组件

**创建文件**:
- `src/views/game/index.vue` — 游戏主页面
- `src/components/game/GameBoard.vue` — 游戏桌面（绿色毛毡背景）
- `src/components/game/PlayerSeat.vue` — 单个玩家座位
- `src/components/game/PlayerInfo.vue` — 玩家信息面板

功能:
- 8人座位的环形/椭圆形布局
- 当前行动玩家高亮
- 体力值显示（勾玉）
- 手牌数和装备区可视化

**验证**: Playwright E2E 测试
- 打开游戏页面 → 显示8个座位
- 当前玩家座位有高亮边框
- HP 显示正确

---

### Step 12.2 — 实现卡牌渲染组件

**创建文件**:
- `src/components/card/CardFace.vue` — 单张卡牌正面
- `src/components/card/CardBack.vue` — 卡牌背面（对手手牌）
- `src/components/card/CardHand.vue` — 手牌区（扇形排列）
- `src/components/card/CardEquip.vue` — 装备区展示
- `src/components/card/CardJudge.vue` — 判定区展示

**验证**: Playwright E2E 测试
- 手牌以扇形排列显示
- 对手手牌显示为卡背
- 装备区正确显示已装备卡牌

---

### Step 12.3 — 实现卡牌样式

为所有卡牌类型创建对应的视觉样式。

**创建文件**:
- `src/components/card/CardFace.vue` 中实现:
  - 基本牌: 红色边框 + 类型图标
  - 锦囊牌: 蓝色边框 + 类型图标
  - 装备牌: 绿色边框 + 类型图标
  - 花色和点数角标
  - 卡牌名称和描述

**验证**: 视觉审查
- 所有卡牌类型可区分
- 花色和点数清晰可见

---

## Phase 13: UI - 玩家交互

### Step 13.1 — 实现手牌操作

**创建文件**:
- `src/hooks/useCardPlay.ts` — 出牌逻辑 Hook

功能:
- 点击手牌 → 高亮选中
- 选中卡牌后 → 高亮可选目标
- 点击目标 → 确认出牌
- 右键取消选择
- 拖动卡牌到目标（可选）

**验证**: Playwright E2E 测试
- 点击杀 → 可选目标高亮 → 点击目标 → 杀成功打出
- 点击桃 → 仅自己可选（受伤时）

---

### Step 13.2 — 实现响应窗口 UI

**创建文件**:
- `src/components/game/ResponseDialog.vue`
- `src/hooks/useResponse.ts`

功能:
- "请出闪" 弹窗 → 手中闪高亮 → 点击出闪 / 取消不出
- "请出桃" 弹窗 → 手中桃高亮 → 点击出桃
- 倒计时自动选择（多人在线时）
- 无懈可击询问阶段

**验证**: Playwright E2E 测试
- 被杀时弹出"请出闪" → 点击闪 → 伤害抵消
- 濒死时弹出"请出桃" → 不使用 → 进入死亡判定

---

### Step 13.3 — 实现技能发动 UI

**创建文件**:
- `src/components/game/SkillPanel.vue`
- `src/hooks/useSkill.ts`

功能:
- 可用技能列表（高亮可发动技能）
- 点击技能 → 发动（如果是主动技）
- 被动/锁定技自动触发提示
- 技能发动动画

**验证**: Playwright E2E 测试
- 曹操受到伤害 → 奸雄自动触发提示
- 刘备出牌阶段 → 仁德按钮可用 → 点击 → 选择目标和卡牌

---

### Step 13.4 — 实现阶段操作 UI

**创建文件**:
- `src/components/game/PhaseBar.vue`
- `src/components/game/ActionButtons.vue`

功能:
- 出牌阶段: 「出牌」「结束出牌」按钮
- 弃牌阶段: 「选择弃牌」提示，选中卡牌弃置
- 当前阶段指示器

**验证**: Playwright E2E 测试
- 进入出牌阶段 → 显示"结束出牌"按钮
- 点击结束 → 进入弃牌阶段
- 选择卡牌 → 弃置

---

## Phase 14: UI - 游戏流程与动画

### Step 14.1 — 实现游戏日志

**创建文件**:
- `src/components/game/GameLog.vue`
- `src/store/log-store.ts`

功能:
- 实时显示游戏日志（谁出了什么牌，谁受到伤害等）
- 日志滚动查看历史
- CTT 风格的彩色日志（伤害红色，回复绿色）

**验证**: Playwright E2E 测试
- 出牌后日志中出现对应记录
- 日志随时间增长可滚动

---

### Step 14.2 — 实现卡牌动画

**创建文件**:
- `src/hooks/useAnimation.ts`
- `src/components/game/CardAnimation.vue`

动画效果:
- 摸牌: 牌堆 → 手牌（滑动）
- 出牌: 手牌 → 目标（飞行）
- 弃牌: 手牌 → 弃牌堆（翻转缩小）
- 伤害: 目标座位抖动
- 死亡: 角色灰度化

**验证**: 视觉审查
- 出杀: 卡牌从手牌飞向目标
- 受到伤害: 玩家座位红色闪烁

---

### Step 14.3 — 实现游戏结束画面

**创建文件**:
- `src/components/game/GameOverDialog.vue`

功能:
- 显示胜利方和失败方
- 公开所有身份
- 显示游戏统计
- 「再来一局」「返回大厅」按钮

**验证**: Playwright E2E 测试
- 主公死亡 → 出现游戏结束弹窗
- 显示反贼胜利
- 点击再来一局 → 重新开始

---

## Phase 15: 完整游戏模式 ✅

> **实施日期**: 2025-06-25
> **测试**: 77 个新测试，全部通过

### Step 15.1 — 实现 GameBoot 引导流程 ✅

**创建文件**:
- `src/core/boot/game-boot.ts`

完整启动流程:
```
GameBoot.create(config)
  → 验证配置（玩家数/身份/主公）
  → 初始化默认服务（随机/日志/存储）
  → 创建 GameEngine 并注入服务
  → engine.init(config) → 分配角色/英雄/手牌
  → engine.start() → 进入第一个回合
```

**GameBoot 类提供的功能**:
- `GameBoot.createStandard5P()` / `GameBoot.createStandard8P()` — 标准模式快捷创建
- `GameBoot.create(config)` — 自定义配置创建
- `boot()` — 启动引导（init）
- `start()` — 开始第一个回合
- `runGameLoop()` — 完整 AI 自动游戏循环
- `run()` — 一键 boot + start + runGameLoop
- 配置验证（玩家数、身份匹配、主公检查）

**验证**: 单元测试 29 个
- `GameBoot.test.ts`: 完整启动流程 → 游戏可正常进行到主公回合准备阶段
- 覆盖：构造/工厂方法/boot/start/runGameLoop/run/查询/配置验证/边界情况

---

### Step 15.2 — 实现标准5人局 ✅

配置并验证完整的5人标准局:
- 1主1忠2反1内
- 5名武将随机选择
- 标准牌堆

**创建文件**:
- `src/__tests__/modes/standard-5p.test.ts`

**验证**: 集成测试 22 个
- 配置验证（玩家数/身份分布/英雄池/卡牌池/英雄选择数/初始手牌）
- 启动流程（创建5人局/身份分配/主公公开/HP加成/英雄分配/牌堆初始化/初始手牌）
- 游戏流程（start 后进入有效阶段/全部存活/轮次正常）
- 完整游戏循环（完整对局无崩溃/有效结果含存活玩家）
- 座位布局（连续座次/唯一ID）

---

### Step 15.3 — 实现标准8人局 ✅

配置并验证完整的8人标准局:
- 1主2忠4反1内
- 8名武将随机选择
- 标准牌堆

**创建文件**:
- `src/__tests__/modes/standard-8p.test.ts`

**验证**: 集成测试 26 个
- 配置验证（玩家数/身份分布/英雄池/卡牌池/装备/延时卡牌/最大轮次）
- 启动流程（创建8人局/身份分配/主公公开/HP加成/英雄分配/牌堆初始化/初始手牌）
- 游戏流程（start 后进入有效阶段/全部存活/首位玩家）
- 完整游戏循环（完整对局无崩溃/有效结果）
- 座位布局（0-7连续/唯一ID）
- 距离系统（环形距离）
- 工厂方法（createStandard8P 快捷创建）
- 与5人局对比（牌堆/初始手牌数）

---

## Phase 16: 测试覆盖与优化

### Step 16.1 — 性能优化

- 事件栈深度监控（防范无限嵌套）
- 卡牌数量异常检测
- 大型游戏状态快照与恢复

**验证**:
- 性能测试: 1000次杀事件处理 < 500ms
- 技能检查: 10名武将同时在场时每个时机 < 50ms

---

### Step 16.2 — 边界测试

| 场景 | 预期行为 |
|------|---------|
| 牌堆耗尽 | 弃牌堆自动洗牌回收 |
| 连续濒死 | 每次濒死独立求桃 |
| 技能嵌套过深 | 检测并报错，不超过 20 层 |
| 无懈可击嵌套 | 正确层层结算 |
| 全部玩家死亡 | 异常结束并报错 |
| 回合内玩家死亡 | 回合立即结束 |

**验证**: 每个场景一个单元测试

---

### Step 16.3 — 完整回放测试

实现游戏日志回放功能（用于调试和测试）:
- 每步操作记录到日志
- 日志可序列化
- 回放模式: 读取日志 → 重建游戏状态 → 逐步重现

**验证**: 
- 完整一局游戏 → 记录日志 → 回放 → 状态一致

---

### Step 16.4 — 代码审查与文档

- 所有公共 API 的 JSDoc 注释
- 引擎内部文档（扩展指南）
- CLAUDE.md 与实现一致性审查
- README.md 更新

---

## Phase 17: 网络对战 (远期)

> ⚠️ 此阶段的详细步骤待 Phase 16 完成后根据实际情况制定。

### 概览

- WebSocket 实时通信
- 房间系统（创建/加入/观战）
- 游戏同步（服务器权威 vs P2P）
- 断线重连
- 计时器与托管

**依赖**: Phase 0-16 全部完成且稳定

---

## 进度追踪表

| Phase | 步骤数 | 状态 | 开始日期 | 完成日期 |
|-------|--------|------|---------|---------|
| 0     | 3      | ⬜   | —       | —       |
| 1     | 3      | ✅   | 2025-06-24 | 2025-06-24 |
| 2     | 6      | ✅   | 2025-06-24 | 2025-06-24 |
| 3     | 1      | ✅   | 2025-06-24 | 2025-06-24 |
| 4     | 5      | ✅   | 2025-06-24 | 2025-06-24 |
| 5     | 6      | ⬜   | —       | —       |
| 6     | 3      | ⬜   | —       | —       |
| 7     | 4      | ⬜   | —       | —       |
| 8     | 4      | ✅   | 2025-06-24 | 2025-06-24 |
| 9     | 2      | ⬜   | —       | —       |
| 10    | 3      | ⬜   | —       | —       |
| 11    | 2      | ✅   | 2025-06-25 | 2025-06-25 |
| 12    | 3      | ⬜   | —       | —       |
| 13    | 4      | ⬜   | —       | —       |
| 14    | 3      | ⬜   | —       | —       |
| 15    | 3      | ✅   | 2025-06-25 | 2025-06-25 |
| 16    | 4      | ✅   | 2026-06-25 | 2026-06-25 |
| 17    | TBD    | ⬜   | —       | —       |

> 状态: ⬜ 未开始 | 🟡 进行中 | ✅ 已完成

---

## 关键架构决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 事件驱动 | LIFO 栈 | 精确模拟三国杀"后发先至"结算规则 |
| 引擎/UI分离 | Core 层纯 TS | 可独立测试，不依赖浏览器环境 |
| 状态同步 | Pinia Store + StoreService | 保持引擎纯净 + Vue 响应式优势 |
| 技能定义 | 声明式数据 | 易于扩展新武将，减少代码修改 |
| DI 容器 | 自实现轻量版 | 避免引入额外依赖，满足项目需求 |
| AI 框架 | 策略模式 | 便于扩展 AI 难度和行为风格 |
| 测试策略 | Vitest + Playwright | 引擎单元测试 + UI E2E 测试全覆盖 |
