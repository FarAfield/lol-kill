# 联盟杀 · 代码规范

> **项目定位**：一个规则正确的纯 TypeScript 卡牌游戏引擎，Web 界面是它的一个消费者，不是主体。
> 底层规则体系为《三国杀》，主题包装为英雄联盟。规则正确性优先于功能数量，引擎可测试性优先于开发便利。

本文档是项目的**唯一架构权威**。任何与本文冲突的历史文档、注释、代码，以本文为准。

---

## 1. 分层架构

```
src/
├── core/                 # 纯 TS 引擎 —— 零视图依赖、零副作用、可独立测试
│   ├── contracts/        # 接口定义（IEffect, ICard, IPlayer, IGameEvent, IGameState...）
│   ├── engine/           # 主控：GameEngine、状态机、回合/阶段、效果上下文、注册表
│   ├── event/            # 事件系统：EventChain、EventDispatcher、EventTrigger
│   ├── system/           # 规则子系统：牌堆、卡牌流转、伤害、距离、目标、死亡
│   ├── entity/           # 数据类：Player、Card、Hero、GameState
│   ├── services/         # 引擎侧服务：StoreService、AIController、随机数
│   └── boot/             # 装配根：GameBoot（唯一允许组装全局对象的地方）
│
├── source/               # 静态数据 —— 纯对象，不含逻辑，不含 import core 之外的东西
│   ├── heroes/           # 英雄 + 技能效果定义
│   ├── cards/            # 卡牌 + 卡牌效果定义
│   ├── modes/            # 游戏模式配置（5 人局 / 8 人局）
│   └── base/             # 规则常量、阶段定义、通用效果
│
├── services/             # GameController —— UI 调用引擎的唯一入口
├── store/                # Pinia 响应式状态（只读镜像，UI 消费）
├── views/ components/ hooks/   # Vue 视图层
└── router/
```

### 分层依赖方向（单向，不可逆）

```
views / components / hooks
        ↓
   services/GameController          ← 唯一边界
        ↓
   core/boot/GameBoot               ← 唯一装配点
        ↓
   core/engine → core/event → core/system → core/entity → core/contracts
        ↓
   core/services/StoreService ──→ store/（Pinia）──→ Vue 响应式
```

---

## 2. 数据流向

```
┌──────────────────────────────────────────────────────────┐
│ UI (Vue)                                                 │
│   用户点击「出杀」                                         │
│        │                                                 │
│        ▼  playCard(cardId, targetIds)                     │
│   GameController            ← UI 只发意图，不含规则判断     │
└────────┼─────────────────────────────────────────────────┘
         │  ═══════════ 边界：以下禁止 import Vue ═══════════
         ▼
   GameEngine
         │  创建 IGameEvent，推入 EventChain
         ▼
   EventDispatcher ──→ EventTrigger 查询匹配的 Effect
         │                    │
         │                    ▼
         │             EffectContext（受限读写）
         │                    │
         │                    ▼
         │             system/* 执行实际状态变更
         ▼
   GameState（内存纯对象，非响应式，单一真值源）
         │
         ▼  syncGameState(snapshot)
   StoreService ──→ Pinia Store ──→ Vue 重新渲染
```

**四条铁律**：

1. **状态只有一个真值源**：`GameState` 是内存纯对象。Pinia Store 是它的**只读镜像**，UI 绝不写 Store 中的游戏数据。
2. **状态变更只能经由事件**：禁止任何地方直接 `player.hp -= 1` 或 `card.zone = X`。
3. **UI 不认识引擎内部**：视图层禁止 import `core/event`、`core/engine`、`core/system`，只能 import `services/GameController` 和 `core/contracts`（类型）。
4. **Core 不认识 UI**：core 层禁止 import `vue`、`pinia`、`vue-router`、`naive-ui`，禁止触碰 `window` / `document` / `localStorage`。

---

## 3. 核心设计思路

### 3.1 事件驱动与「后发先至」

三国杀结算的核心规则是**后发先至**：最新插入的结算请求优先处理。典型场景是 A 对 B 用锦囊，C 打出无懈可击，D 再打出一张无懈可击抵消 C 的——先结算 D 的。

因此事件系统必须是一个真正的 **LIFO 栈**，且必须支持**在任意时刻插入新事件并立即优先结算**，而不是"把新事件排到队尾"。

当前实现的 LIFO 语义不完整（子事件只在 Content 阶段后被统一处理），重构目标见 `refactor-plan.md` Phase 3。

### 3.2 结算点（Settlement Point）模型

> 这是引擎最核心的抽象，取代"线性遍历 stage"的旧模型。

每个事件拥有若干**结算点**。事件推进到结算点时**暂停**，向所有相关玩家按**座次顺序**征询响应，直到无人再插入响应，才继续推进。

```
事件: 使用【杀】 A → B
  结算点1「指定目标后」   → 询问全场：是否使用【无懈可击】？
  结算点2「生效前」       → 询问全场：是否插入技能？
  结算点3「响应」         → 询问 B：是否出【闪】？
  结算点4「结算完毕后」   → 询问全场：是否触发受伤后技能？
```

**三个必须同时成立的要素**：

| 要素 | 说明 |
|------|------|
| 暂停 | 到达结算点，事件链冻结，等待外部决策 |
| 轮询 | 从当前行动玩家开始，按座次顺时针依次询问；可多轮，直到一轮内无人响应 |
| 插入 | 响应产生的**新事件**压栈并**立即完整结算**，然后回到原结算点重新轮询 |

三者缺一不可。缺「插入」就无法实现无懈可击；缺「轮询」就无法实现南蛮入侵；缺「暂停」就无法等待人类玩家。

### 3.3 数据驱动的 Effect

卡牌效果、装备效果、武将技能**全部**是同一个东西：`IEffect`。

- 卡牌和英雄不持有逻辑，只持有 `effectIds: string[]`
- 所有 `IEffect` 注册在全局 `EffectRegistry`
- 引擎启动时由 `GameBoot` 统一装配（**这是当前最大的缺口，见重构计划 Phase 1**）

加一个新武将 = 在 `source/heroes/` 加数据 + 在 `source/heroes/skills/` 加 Effect，引擎零改动。

### 3.4 依赖注入

引擎不自己 new 任何外部服务，全部由外部注入：

| 服务 | 职责 | 必须注入 |
|------|------|---------|
| `IRandomService` | 洗牌、判定 | ✅ 强制（禁用 Math.random） |
| `ILoggerService` | 日志 | ✅ 强制 |
| `IUIDecisionService` | 玩家/AI 决策 | ✅ 强制 |
| `IStoreService` | 状态同步 | 可选（无 UI 时为 no-op） |

**`IRandomService` 必须可 seed**。这决定了游戏能否复现，进而决定回放和确定性测试是否成立。

### 3.5 确定性

给定相同的种子 + 相同的决策序列，游戏必须产出完全相同的结果。这是硬性要求，不是优化项。

推论：
- 引擎内禁止 `Math.random()`、`Date.now()` 参与任何影响游戏状态的逻辑（`Date.now()` 仅可用于日志时间戳）
- 禁止依赖 `Object.keys()` / `Set` 迭代顺序做规则判断
- 容器遍历一律显式排序

---

## 4. 规则分层

引擎内的规则按稳定性分三层，改动时必须认清自己在改哪层：

| 层 | 内容 | 举例 | 变更频率 |
|----|------|------|---------|
| **核心层** | 结算机制本身 | 事件栈、结算点、伤害流水线、区域流转 | 极低 |
| **规则层** | 三国杀通用规则 | 距离、攻击范围、弃牌阶段、濒死求桃、胜负判定 | 低 |
| **内容层** | 具体卡牌与技能 | 杀、闪、奸雄、武圣 | 高 |

**核心层不为规则层开后门，规则层不为内容层开后门。** 如果发现"某个武将技能必须改引擎才能实现"，说明分层被破坏了，应当先修分层。

---

## 5. 开发守则

### 必须做

1. **状态变更走事件**：`player.hp`、`card.zone`、`player.handCards` 等只能通过 `system/*` 修改。
2. **Effect 必须幂等安全**：同一时机可能被反复检查，`filter` / `isAvailable` 不得有副作用。
3. **优先级交给 PriorityManager**：禁止在回调里自行判断执行顺序。
4. **响应必须可取消**：被无懈可击或技能取消后，子事件标记 canceled 并跳过结算。
5. **距离计算统一走 DistanceSystem**：禁止技能内自行算距离。
6. **卡牌流转统一走 CardSystem**：禁止直接改 `card.zone`。
7. **每加一个卡牌/技能，必须配套单元测试。**
8. **禁用 `any`**：全部使用 contracts 中定义的类型。

### 禁止做

1. 在 `core/` 下 import 任何视图库或触碰浏览器 API。
2. 在视图层 import `core/event`、`core/engine`、`core/system`。
3. 在引擎内使用 `Math.random()`。
4. 直接读写 Pinia Store 中的游戏数据（只能读）。
5. 提交空的 try/catch 或 `catch {}`——异常要么处理，要么向上抛，要么记日志。
6. 提交 `return true` 的空实现桩（如 `enableEffect`）。未完成的功能要么不写，要么显式 `throw new Error('NotImplemented')`。
7. 在 `source/` 下写逻辑——那里只能是纯数据。

---

## 6. 命名约定

| 项目 | 约定 | 示例 |
|------|------|------|
| 文件 | `kebab-case` | `damage-system.ts`、`game-engine.ts` |
| 类 / 接口 | PascalCase，接口以 `I` 开头 | `GameEngine`、`IPlayer`、`IEffectContext` |
| 函数 / 变量 | camelCase | `drawCards()`、`currentPhase` |
| 常量 / 枚举值 | UPPER_SNAKE_CASE | `DEFAULT_DRAW_COUNT` |
| Vue 组件 | PascalCase | `GameBoard.vue`、`CardHand.vue` |
| Pinia Store | `use` 前缀 | `useGameStore`、`useLogStore` |
| 测试文件 | `<被测对象>.test.ts` | `damage-system.test.ts` |

---

## 7. 测试策略

| 类型 | 范围 | 位置 |
|------|------|------|
| 单元 | 单个类 / 纯函数 | `src/__tests__/**` |
| 集成 | 多张卡牌 + 多技能协同 | `src/__tests__/engine/**` |
| 对局 | 完整 5 人 / 8 人局跑到底 | `src/__tests__/modes/**` |
| E2E | 页面可交互 | `e2e/**` |

**规则**：

- 测试必须注入**带种子的** `IRandomService`，禁止依赖真实随机
- 断言规则行为（"出闪后伤害被抵消"），而不是实现细节（"调用了某某方法"）
- 集成测试必须走 `GameBoot` 完整装配路径，**不许在测试里手工拼装引擎**——否则会重复"零件能转、整机没接线"的问题

---

## 8. 当前已知偏离

以下条目当前代码**违反**了本规范，是重构要消灭的目标。清单随重构推进删除。

| # | 偏离 | 位置 |
|---|------|------|
| 1 | Effect 从未注册，技能系统空转 | `GameEngine` / `GameBoot` |
| 2 | `rebindState()` 后依赖未更新，EffectContext 操作废弃 state | `game-engine.ts` |
| 3 | 伤害双轨制：先扣血再发事件 | `effect-context.ts` / `damage-system.ts` |
| 4 | 大量直接改状态，绕过事件与 CardSystem | 多处 |
| 5 | 随机不可 seed | `game-engine.ts` / `game-boot.ts` |
| 6 | 空实现桩：`enableEffect` / `modifyEffects` | `skill-registry.ts` / `effect-context.ts` |
