# 《联盟杀》在线卡牌游戏 · 引擎架构文档

供开发者与 AI 助手参考，描述引擎设计、模块划分、数据流向及关键机制。

> **游戏规则说明**: 本项目采用《三国杀》标准卡牌游戏规则体系，以英雄联盟（League of Legends）角色为主题进行重新包装。下文使用「联盟杀」作为项目名称，「三国杀」指代底层规则体系。

---

## 技术栈

| 层级       | 技术                   |
| ---------- | ---------------------- |
| 核心引擎   | TypeScript（纯逻辑，零依赖） |
| 视图层     | Vue 3 + Pinia + Naive UI |
| 构建工具   | Vite                   |
| 测试       | Vitest (单元) + Playwright (E2E) |

---

## 目录结构

```
core/               # 纯 TS 引擎，零视图依赖，零副作用
├── contracts/      # 全部接口定义（IEvent, ISkill, ICard, IPlayer, IGameState...）
├── engine/         # 游戏主控、状态机、技能上下文、效果解析器
├── event/          # 事件系统（LIFO 栈）— 所有结算的核心通道
├── system/         # 游戏子系统（牌堆、伤害、距离、目标选择、死亡处理）
├── entity/         # 纯数据类（Player, Card, Hero, Skill, Game）
├── services/       # DI 容器、服务注册表、决策抽象
└── boot/           # 启动引导、Source 动态加载

source/             # 静态游戏资源（声明式数据，不包含逻辑）
├── heroes/         # 武将技能定义
├── cards/          # 卡牌效果定义
├── modes/          # 游戏模式配置（标准场、3v3、1v1 等）
└── base/           # 阶段定义、规则常量、触发时机枚举

assets/             # 静态资源（图片、字体、音频等）
components/         # Vue 可复用组件
hooks/              # Vue 自定义钩子（useGame, useCard, usePlayer...）
router/             # Vue 路由配置
store/              # Pinia 响应式状态（gameStore, playerStore, cardStore...）
services/           # GameController 等——UI 调用引擎的唯一入口
views/              # Vue 页面
utils/              # 纯工具函数
```

---

## 核心数据流向

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (Vue 3)                                       │
│  views → components → hooks → services/GameController   │
│                              ↓                          │
│  ═══════════════════ 边界 ════════════════════════════  │
│                              ↓                          │
│  Core Layer (Pure TS)                                   │
│  GameEngine → EventDispatcher → EventChain(LIFO)        │
│                  → EventTrigger → 技能 content           │
│                  → ISkillContext（受限读写接口）         │
│                              ↓                          │
│  数据持久化: IStoreService (DI) → Pinia Store → Vue 响应式 │
│  游戏数据:   GameState (内存纯对象，非响应式)            │
└─────────────────────────────────────────────────────────┘
```

**核心原则**:
1. Core 层绝不 import Vue / Pinia / Router 或任何 UI 库
2. UI 层通过 `services/GameController` 与引擎交互，不直接引用 `core/event` 或 `core/engine`
3. 所有游戏状态修改必须通过事件系统
4. GameState 是纯内存对象（高性能），通过 StoreService 同步到 Pinia 供 UI 消费

---

## 事件系统 (核心机制)

### EventChain — LIFO 事件栈

三国杀结算的核心规则是「后发先至」——最新触发的事件优先结算。EventChain 使用后进先出（LIFO）栈精确模拟这一规则。

**完整流水线阶段**:

```
                    触发事件
                       │
                       ▼
              ┌── WAITING ──────────→ (等待玩家输入/选择)
              │        │
              ▼        ▼
      SKIP_CHECK ──→ CANCELLED ──→ (被无懈可击/技能取消)
              │
              ▼
           BEFORE ────────────────→ (技能前置钩子："当你使用杀时...")
              │
              ▼
           BEGIN ─────────────────→ (事件正式开始)
              │
              ▼
    ┌─── PREPARE ────────────────→ (目标选择、距离检查、合法性校验)
    │        │
    │        ▼
    │    CONTENT ────────────────→ (事件核心内容执行)
    │        │
    │        ▼
    │    PREVENT ────────────────→ (伤害预防、闪避响应窗口)
    │        │
    │        ▼
    │    PREVENTED ──────────────→ (事件被阻止的分支)
    │        │
    │        ▼
    │      END ──────────────────→ (事件结束标记)
    │        │
    │        ▼
    │     AFTER ─────────────────→ (技能后置钩子："当你造成伤害后...")
    │        │
    │        ▼
    └── COMPLETED ───────────────→ (事件彻底完成)

嵌套示例:
  事件A(BEGIN) → 事件A触发事件B → B进入栈顶
  → B 完整结算 → B出栈 → A继续CONTENT → A完成
```

### 触发时机 (Trigger Timing)

以下枚举定义在 `source/base/triggers.ts`，是技能触发的基础：

| 分类       | 时机                                                                 |
| ---------- | -------------------------------------------------------------------- |
| 回合阶段   | `phaseBegin`, `phasePrepare`, `phaseJudge`, `phaseDraw`, `phasePlay`, `phaseDiscard`, `phaseEnd` |
| 卡牌使用   | `cardUseBefore`, `cardUse`, `cardUseAfter`, `cardTargetSpecify`, `cardTargetSpecified`, `cardEffect` |
| 伤害结算   | `damageBefore`, `damage`, `damageAfter`, `damaged`, `damagedAfter`   |
| 判定       | `judgeBefore`, `judge`, `judgeAfter`                                 |
| 死亡       | `playerDying`, `playerDeath`, `playerDeadAfter`                      |
| 全局       | `gameStart`, `gameOver`, `roundStart`, `roundEnd`, `turnStart`, `turnEnd` |

### 事件暂停与响应窗口

- `EventPauseManager`: 暂停事件栈，等待异步操作（如玩家选择卡牌/目标）
- `ResponseWindow`: 弹窗式询问（如"是否出闪？"），暂停栈等待玩家输入
- `PriorityManager`: 同时机多技能按优先级排序执行（锁定技 > 普通技 > 可选的技能）

---

## 状态机

### GameStateMachine

```
                    ┌─────────────────────────────────────┐
                    │           游戏宏观状态机              │
                    │                                     │
  NotStarted ──→ PrepareGame ──→ ROUND_START             │
                                      │                   │
                                      ▼                   │
              ┌─────────── PHASE_PREPARE ──────────┐      │
              │              │                      │      │
              ▼              ▼                      ▼      │
        PHASE_JUDGE    PHASE_DRAW    PHASE_PLAY  PHASE_DISCARD
              │              │                      │      │
              └──────────────┴──────────────────────┘      │
                                      │                   │
                                      ▼                   │
                                PHASE_END ──→ ROUND_END   │
                                      │                   │
                    GAME_OVER ←───────┘                   │
                    (主公死亡 / 全部反贼死亡 / 等)          │
                    └─────────────────────────────────────┘
```

**特性**:
- 条件转移：同一状态可根据条件跳转到不同目标
- 通配符 `*`：监听任意状态转移
- 非法转移回调：捕获异常状态跳转，便于调试
- 可扩展：游戏模式可通过配置添加自定义阶段

---

## 卡牌与区域系统

### 区域 (Zones)

三国杀中卡牌分布在多个区域，区域间流转是核心机制：

| 区域         | 标识        | 说明                                |
| ------------ | ----------- | ----------------------------------- |
| 牌堆         | `deck`      | 未使用的卡牌，抽牌来源              |
| 手牌区       | `hand`      | 玩家持有的手牌，对其他玩家不可见    |
| 装备区       | `equip`     | 玩家已装备的武器/防具/马            |
| 判定区       | `judge`     | 延时类锦囊（乐不思蜀/兵粮寸断/闪电）|
| 弃牌堆       | `discard`   | 已使用/弃置的卡牌                   |
| 处理区       | `processing`| 正在结算中的卡牌（临时区域）        |

### 卡牌生命周期

```
创建(Card.create) → 牌堆(deck) → 手牌(hand) → 处理区(processing)
                                    ↑              │
                                    │    ┌─────────┼──────────┐
                                    │    ▼         ▼          ▼
                                    │  装备区   判定区     弃牌堆
                                    │  (equip)  (judge)   (discard)
                                    │              │         │
                                    └──────────────┴─────────┘
                                        (洗牌: 弃牌堆 → 牌堆)
```

### 卡牌类型体系

```
Card (抽象基类)
├── BasicCard (基本牌)
│   ├── Sha (杀)         — 对目标造成伤害
│   ├── Shan (闪)        — 响应杀，避免伤害
│   ├── Tao (桃)         — 回复体力
│   └── Jiu (酒)         — 濒死回复/伤害+1
├── TrickCard (锦囊牌)
│   ├── ImmediateTrick (非延时锦囊)
│   │   ├── GuoHeChaiQiao (过河拆桥)
│   │   ├── ShunShouQianYang (顺手牵羊)
│   │   ├── WuZhongShengYou (无中生有)
│   │   ├── WuGuFengDeng (五谷丰登)
│   │   ├── TaoYuanJieYi (桃园结义)
│   │   ├── NanManRuQin (南蛮入侵)
│   │   ├── WanJianQiFa (万箭齐发)
│   │   ├── WuXieKeJi (无懈可击)
│   │   ├── JieDaoShaRen (借刀杀人)
│   │   └── JueDou (决斗)
│   └── DelayedTrick (延时锦囊)
│       ├── LeBuSiShu (乐不思蜀)
│       ├── BingLiangCunDuan (兵粮寸断)
│       └── ShanDian (闪电)
└── EquipCard (装备牌)
    ├── Weapon (武器)    — 攻击范围+特效
    ├── Armor (防具)     — 防御效果
    ├── OffensiveHorse (+1马 / 进攻马)
    └── DefensiveHorse (-1马 / 防御马)
```

---

## 伤害流水线

伤害在三国杀中有独立的结算流程，与主事件链协同工作：

```
伤害来源确定 → 伤害值计算 → 属性判定(火/雷/普通)
       │
       ▼
  BEFORE_DAMAGE ────────→ 技能拦截/转移 ("刚烈""天香")
       │
       ▼
  DAMAGE_PREVENT ───────→ 伤害预防 ("八阵""倾国"出闪)
       │
       ▼
  DAMAGE_MODIFY ────────→ 伤害值调整 ("古锭刀""藤甲"+1)
       │
       ▼
  DAMAGE_APPLY ─────────→ 体力扣减
       │
       ▼
  AFTER_DAMAGED ────────→ 受伤后触发 ("反馈""刚烈""遗计")
       │
       ▼
  DAMAGE_COMPLETE
```

---

## 技能系统

### 技能分类

| 类型     | 标识       | 说明                                           | 示例                   |
| -------- | ---------- | ---------------------------------------------- | ---------------------- |
| 主动技   | `active`   | 玩家主动选择时机发动                           | 武圣(关羽)、奇袭(张辽) |
| 被动技   | `passive`  | 满足条件自动触发，玩家可选择是否发动           | 反馈(司马懿)、刚烈(夏侯惇) |
| 锁定技   | `locked`   | 满足条件强制触发，不可取消                     | 马术(马超)、飞影(公孙瓒) |
| 限定技   | `limited`  | 每局游戏只能发动一次                           | 乱武(贾诩)、涅盘(庞统) |
| 觉醒技   | `awaken`   | 满足条件自动触发，获得新技能/失去旧技能/体力上限变化 | 魂姿(孙策) |

### 技能定义结构

```ts
interface Skill {
  id: string                    // 唯一标识
  name: string                  // 技能名称
  description: string           // 描述文本
  type: SkillType               // active | passive | locked | limited | awaken
  priority: number              // 同时机优先级（越高越先执行）
  frequency: 'once' | 'unlimited' | 'oncePerTurn' | 'oncePerRound'
  
  // 触发条件
  trigger: {
    player?: TriggerTiming[]    // 自身触发时机
    global?: TriggerTiming[]    // 全局触发时机
    target?: TriggerTiming[]    // 作为目标时触发
  }
  
  // 发动条件
  filter?: (context: ISkillContext) => boolean
  
  // 目标选择（主动技）
  selectTarget?: (context: ISkillContext) => TargetSelector
  
  // 卡牌选择（需要弃牌/展示牌时）
  selectCard?: (context: ISkillContext) => CardSelector
  
  // 技能核心逻辑
  content: (context: ISkillContext) => Promise<void>
  
  // 状态标记
  enabled?: boolean             // 是否可用（觉醒技初始禁用）
  usedThisTurn?: boolean        // 本回合是否已使用
  usedThisRound?: boolean       // 本轮是否已使用
}
```

---

## 角色与身份系统

### 身份配置 (标准8人场)

| 身份   | 数量 | 胜利条件                         |
| ------ | ---- | -------------------------------- |
| 主公   | 1    | 消灭所有反贼和内奸               |
| 忠臣   | 2    | 与主公相同，保护主公存活         |
| 反贼   | 4    | 消灭主公                         |
| 内奸   | 1    | 消灭所有其他角色，最后单挑主公   |

### 身份公开规则
- 主公身份在游戏开始时公开
- 其他身份在角色死亡时公开
- 反贼杀死反贼时，击杀者摸3张牌（奖惩机制）

---

## 距离与范围

```
座位环 (8人):
       0(主)
   7        1
 6            2
   5        3
       4

距离计算: (座位差 + 总人数) % 总人数，取 min(正向, 反向)
基础攻击范围: 1
武器攻击范围: 武器牌标注值 (1-5)
进攻马 (-1马): 与其他角色距离 -1
防御马 (+1马): 与其他角色距离 +1
```

`DistanceSystem` 负责计算任意两角色间的实时距离。

---

## 核心类总览

| 类                    | 模块            | 职责                                               |
| --------------------- | --------------- | -------------------------------------------------- |
| `GameEngine`          | engine/         | 游戏主控，协调所有子系统                           |
| `GameStateMachine`    | engine/         | 宏观状态机，管理游戏阶段流转                       |
| `TurnManager`         | engine/         | 回合管理，控制当前行动角色                         |
| `PhaseManager`        | engine/         | 阶段管理，控制回合内阶段切换                       |
| `EventChain`          | event/          | 事件链（LIFO 栈），管理事件嵌套与顺序              |
| `EventCompiler`       | event/          | 事件编译器，解析技能/卡牌定义生成事件              |
| `EventDispatcher`     | event/          | 事件调度器，AOP 流水线实现                         |
| `EventPauseManager`   | event/          | 暂停/恢复事件栈执行（等待玩家输入）                |
| `EventTrigger`        | event/          | 事件触发器管理器，注册和匹配触发时机               |
| `PriorityManager`     | event/          | 同时机多技能优先级排序                             |
| `ResponseWindow`      | event/          | 弹窗式询问接口，暂停栈等待玩家决策                 |
| `CardSystem`          | system/         | 卡牌生命周期管理（移动/使用/弃置/判定/装备）       |
| `DamageSystem`        | system/         | 伤害流水线（来源→修改→预防→应用→后置）             |
| `DistanceSystem`      | system/         | 距离与攻击范围计算                                 |
| `TargetSystem`        | system/         | 目标合法性校验与筛选                               |
| `DeathSystem`         | system/         | 濒死求桃、死亡结算、奖惩                           |
| `DeckManager`         | system/         | 牌堆管理（洗牌/发牌/回收）                         |
| `Player`              | entity/         | 玩家实体（身份/体力/手牌/装备/技能）               |
| `Card`                | entity/         | 卡牌实体（类型/花色/点数/效果）                    |
| `Hero`                | entity/         | 武将实体（名称/体力上限/技能列表）                 |
| `Skill`               | entity/         | 技能数据定义                                       |
| `GameState`           | entity/         | 游戏全局状态（回合/阶段/存活玩家/牌堆）            |
| `GameController`      | services/       | UI ↔ 引擎桥接层（适配器模式）                     |
| `AIController`        | services/       | AI 决策逻辑（策略模式）                            |

---

## 开发守则

1. **所有状态修改必须通过事件** — 禁止直接操作 Player / Card 对象属性
2. **技能监听器必须幂等** — 同一技能可能在同一时机被多次检查，filter 确保只执行一次
3. **优先级统一管理** — 通过 `PriorityManager`，不要在回调内自行判断执行顺序
4. **响应窗口必须可取消** — 被无懈可击等取消后，子事件应标记 `canceled` 并跳过结算
5. **引擎与 UI 分离** — 视图层不直接引用 `core/event`、`core/engine`、`core/system`
6. **资源文件规范** — `source/` 下所有导出均为纯数据对象：`{ id, name, ... }`
7. **区域流转使用 CardSystem** — 禁止手动修改卡牌所属区域
8. **距离计算统一使用 DistanceSystem** — 禁止技能内自行计算距离
9. **测试覆盖** — 每增加一个技能/卡牌，必须对应增加单元测试
10. **类型安全** — 禁用 `any`，全部使用接口定义的类型

---

## 命名约定

| 项目         | 约定                                       | 示例                                    |
| ------------ | ------------------------------------------ | --------------------------------------- |
| 文件命名     | `kebab-case`                               | `damage-system.ts`, `game-engine.ts`    |
| 类/接口      | PascalCase，接口以 `I` 开头                | `GameEngine`, `IPlayer`, `ISkillContext` |
| 函数/变量    | camelCase                                  | `drawCards()`, `currentPhase`           |
| 常量/枚举    | UPPER_SNAKE_CASE                           | `PHASE_PREPARE`, `TRIGGER_CARD_USE`     |
| Vue 组件     | PascalCase                                 | `GameBoard.vue`, `CardHand.vue`         |
| Pinia Store  | `use` 前缀 + camelCase                     | `useGameStore`, `usePlayerStore`        |
