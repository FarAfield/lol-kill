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

### 3.3 数据驱动的技能

卡牌效果、装备效果、武将技能**全部**是同一个东西：`ISkill`（旧为 `IEffect`，迁移中）。

- 卡牌和英雄不持有逻辑，只持有 `effectIds: string[]`
- 所有 `ISkill` 注册在全局 `SkillRegistry`
- 引擎启动时由 `GameBoot` 统一装配（**这是当前最大的缺口，见重构计划 Phase 3**）

加一个新武将 = 在 `source/heroes/` 加数据 + 在 `source/heroes/skills/` 加技能，引擎零改动。

### 3.4 三种扩展机制的分工

> 设计参考无名杀。它之所以能支撑上千武将，关键在于把「改数值」和「走流程」拆成两套机制。

| 机制 | 回答的问题 | 特征 |
|------|-----------|------|
| **Mod（修改器）** | 这个数值**怎么算**？这个动作**能不能做**？ | 纯函数、无副作用、自动叠加、随持有者生死自动失效、不可被无懈、不可询问玩家 |
| **Trigger（触发器）** | 流程**怎么走**？要不要**问玩家**？ | 可交互、可取消、可被无懈、有优先级与座次 |
| **Content（事件处理器）** | 这个事件**本身**做什么？ | 事件的默认行为，一张卡牌一张脸 |

**判断准则：能用 Mod 表达的一律用 Mod，不要用 Trigger。**

反例（禁止）：
```ts
// ❌ 用触发器做数值修改 —— 要自己处理优先级、取消、AI 询问
trigger: { global: ['damageBegin'] },
content: async (ctx) => { ctx.event.num += 1 }
```

正例：
```ts
// ✅ 用修改器
mod: { globalDamageFrom: (v) => v + 1 }
```

### 3.5 Mod 的四条硬约束

1. **纯函数**：只读 `ctx`，不改状态、不发事件、不询问玩家。dev 模式下 `ctx.game` 被冻结，违反即抛错。
2. **随持有者自动失效**：`ModRegistry` 只遍历持有该 mod 且存活的玩家。玩家死亡 / 失去技能 / 卸下装备时无需手动清理。
3. **不可被无懈可击**：这是锁定技的规则要求，也让 Mod 实现不必处理取消逻辑。
4. **调用顺序确定且可复现**：`priority` 降序 → 同优先级按座次升序 → 同座次按 `mod.id` 字典序。**禁止依赖注册顺序。**

### 3.6 事件命名

> 已落地（Phase 5）。唯一定义处：`core/contracts/event-name.ts`。

事件名 = **事件主体 + 阶段后缀**，是字符串而不是枚举 —— **新增一个时机不许改引擎**。

```
主体 damage  ×  后缀 After  →  damageAfter      // "当你造成伤害后"
主体 useCard ×  后缀 ''     →  useCard          // "当你使用牌时"（Content 阶段）
主体 phaseUse × 后缀 Begin  →  phaseUseBegin    // "出牌阶段开始时"
```

**后缀表**（与流水线 `TriggerStage` 一一对应，Content 为空后缀即事件本体）：

| 流水线阶段 | Before | Begin | Prepare | Content | Prevent | End | After |
|-----------|--------|-------|---------|---------|---------|-----|-------|
| 后缀 | `Before` | `Begin` | `Prepare` | （空） | `Prevent` | `End` | `After` |

**单发事件**（point event）：名字已含完整语义，不加后缀，且**只在 Content 阶段结算一次**——「游戏开始」没有"之前/之后"。
`gameStart` / `gameOver` / `roundStart` / `roundEnd` / `turnStart` / `turnEnd` / `useCardToTarget` / `useCardEffect` / `respond` / `equip` / `unequip`。

规则：

1. **监听写全名**：`trigger: { target: ['damageAfter'] }`，主体与后缀都写在字符串里，不再有 `{ timing, stage }` 对象。
2. **发射写主体**：`new GameEvent({ name: 'damage' })`，后缀由流水线在推进到各阶段时派生，事件对象上不存"当前事件名"。
3. **命中判定**走 `matchesEventName(handlerEvent, eventName, stage)`，禁止各模块自己拼字符串 —— 单发事件的"只结算一次"这条规则就靠它兜底。
4. **自定义事件名合法**：`type EventName = BuiltinEventName | (string & {})`。内置名保留自动补全，扩展包可以写任意新名字，引擎零改动。
5. 类型与运行时清单同源：内置名由 `EVENT_SUBJECTS` × `EVENT_STAGE_SUFFIXES` + `POINT_EVENT_NAMES` 推导，不会走偏。

### 3.7 事件生命周期与步骤机

> 已落地（Phase 6）。实现：`core/event/game-event.ts` + `core/event/event-dispatcher.ts`。

一个事件有**两套互相独立的状态**，混用是历史 bug 的主要来源：

| 概念 | 字段 | 含义 | 谁改 |
|------|------|------|------|
| 流水线状态 | `status` / `stage` | 事件在 7 阶段流水线上的位置 | 只有 `EventDispatcher` |
| 内容状态 | `finished` / `step` | 事件自身「内容」跑完没有 | 内容（步骤）自己 |

**状态机**：主链 `waiting → skipCheck → before → begin → prepare → content → prevent → end → after → completed`。
额外允许「任意非终态 → 终态」（`cancelled` / `prevented`）——这是「事件在任意位置被无懈可击」的前提。
非法转移抛 `EventTransitionError`，不静默。

**步骤机**：事件的内容由若干**步骤**组成，`addStep(n, fn)` 注册，`runSteps()` 在 Content 阶段由调度器驱动。

```ts
event.addStep(0, (e) => { e.result.bool = checkHit(); })
event.addStep(1, async (e) => { if (e.result.bool) await e.trigger('damage') })
event.addStep(2, (e) => { if (needsRetry(e)) e.goto(0); else e.finish() })
```

- 步骤顺序执行，处理器**可以是 async**，逐个 `await`
- `goto(n)` 跳转：会抑制自动前进，所以 `goto(0)` 在步骤 0 内形成循环是合法的
- `runSteps()` 是**迭代**实现，循环不递归 → `goto` 循环不会爆栈；但无出口的循环会空转，因此有迭代预算 `MAX_STEP_ITERATIONS = 256`，超过抛 `EventStepOverflowError`
- 没有注册步骤时步骤机自然结束，**不终止事件**（`finished = true`，`status` 仍在流水线上）

**两个收尾手段语义不同，不要混**：

| 手段 | 剩余步骤 | 后续阶段（Prevent/End/After） | 适用 |
|------|---------|------------------------|------|
| `finish()` | 跳过 | **照常执行** | 内容提前完成，但后续技能该触发还得触发 |
| `cancel(reason?)` | 跳过 | **全部跳过**，直接进终态 | 被无懈可击 / 被闪抵消 |

`cancel()` 对 `forced` 事件是空操作——强制事件不可取消。

**子事件**：`trigger(name, data)` 创建子事件、`addChild` 挂到父节点、交给运行器调度并 **await 完成后父事件才继续**。
子事件继承父事件的 `player` / `phase` / `round` / `turn` / `runner`。

- 运行器（`IEventRunner`）由 `EventDispatcher` 在调度期注入，结算结束后解绑；未注入时 `trigger()` 抛 `EventRunnerMissingError`，绝不静默失败
- 嵌套深度超过 `maxDepth`（默认 20）抛 `EventNestingError` —— 互相触发的效果环在这里被拦下

**错误类型**（`core/event/errors.ts`，全部继承 `EventError`）：
`EventNestingError` / `EventStepOverflowError` / `EventRunnerMissingError` / `EventTransitionError`。
一律抛类型化错误，禁止裸 `new Error('[EventDispatcher] ...')`。

**便捷访问**（都是视图，不是第二份数据）：
`target` ≡ `targets[0]`；`card` ≡ `cards[0]`；`num` ≡ `values.num`（读写同一份）；`depth` 由 `parent` 链推导；`result` 为 `EventResult`，可写 `bool` / `cards` / `targets` / `num` 及任意自定义字段。

**暂停粒度是单个事件**：`pauseManager.pause(eventId, reason, timeout)` / `resume(eventId)`。
一个事件等玩家决策时只阻塞它自己，同链上的其它事件不受影响。

### 3.8 事件内容（Content）与卡牌

> 已落地（Phase 7）。实现：`core/event/content-registry.ts` + `source/base/contents/`。

**Content 是事件的默认行为**，与「谁在用这张牌」无关；**Trigger（技能）是某人在某时机额外做的事**。同一个事件两者都会跑，互不覆盖。

**卡牌内容以卡牌 id 作为事件名**：

```
useCard 事件（用牌总入口）
  └─ trigger(卡牌 id)   →  'sha' / 'guoHeChaiQiao' / 'leBuSiShu' ...
```

所以**新增一张牌 = 在 `source/base/contents/index.ts` 加一条 `[id, content]`，引擎零改动**。

规则：

1. **挂载时机**：Content 阶段先跑事件自带的步骤机；**没有步骤**时才把 `ContentRegistry` 里的 content 挂成 step 0。调用方自带步骤的事件不会被默认内容覆盖。
2. **内容只做流程**：问决策、发子事件、改区域。数值修改一律交给 Mod（§3.4），时机挂钩一律交给 Trigger。
3. **用牌唯一入口是 `GameEngine.useCard(player, card, targets)`**。控制器、AI、测试走同一条路径，禁止各自拼 `useCard` 事件。
4. **新增目录 `source/base/contents/` 取代 `source/base/effects/`**：卡牌不再是「带 content 的 Effect」，而是「一个事件内容」。英雄技能仍然留在 `source/heroes/skills/`（它们本质是 Trigger）。

### 3.9 结算点（Settlement Point）

> 已落地（Phase 8）。实现：`core/event/settlement.ts` + `core/event/response-inquiry.ts`。

「什么时候把话筒交给别人」由结算点回答。三要素缺一不可：

| 要素 | 落地 |
|------|------|
| **暂停** | 轮询期间事件不往下走，`await` 玩家 / AI 的选择 |
| **座次轮询** | 从指定角色起按座次依次询问，且**座次在窗口开启时快照一次** |
| **插入** | 响应本身是一条新事件，压进 LIFO 栈后立即完整结算（后发先至） |

```ts
await settle(ctx, {
  id: 'nanManRuQin',
  responders: () => h.seatOrderFrom(ctx.player).filter((p) => p.alive),
  optionsFor: (p) => handOptions(p, CardTag.Strike),
  prompt: () => '南蛮入侵：是否出杀？',
  onRespond: async (_p, opt) => { if (opt.card) await h.discard([opt.card]) },
  onUnanswered: async (p) => { await h.damage(p, 1) },
})
```

规则：

1. **拿不出牌 ≠ 跳过**。`optionsFor` 返回空数组时不询问，但**仍然走** `onUnanswered`——南蛮入侵里「手上没杀」正是要挨伤害的那种人。
2. **`acted` 记已响应者**；`oncePerPlayer`（默认 true）时放弃者同样记入，保证一轮收敛。设为 `false` 即连环窗口（无懈可击）：别人出手后此前放弃的人可以改主意。
3. **`stopOnFirstResponse`** 用于「一个就够」的场景（濒死求桃）。
4. 轮数上限 = 参与人数 + 3。`acted` 必然增长，所以正常轮数 ≤ 人数 + 1，上限只是防御性兜底（`EventSettlementOverflowError`）。
5. **同优先级的 handler 按距事件发起者的座次差升序**——顺时针是「多人同时触发」的默认裁决规则，也保证结果不依赖注册顺序。

**已有的结算点**：南蛮入侵 / 万箭齐发（AOE）、决斗（单人点的序列）、濒死求桃（`stopOnFirstResponse`）、无懈可击窗口（`oncePerPlayer: false`）。

### 3.10 卡牌身份与所有权

一张牌有两层身份，**混用会静默损坏牌局**：

| 字段 | 含义 | 唯一性 | 用途 |
|------|------|--------|------|
| `id` | **定义 id**（`sha` / `shan` / `zhuGeLianNu`） | ❌ 全场 30 张杀都叫 `sha` | 配表查表、皮肤、规则分类 |
| `instanceId` | **实例 id**（`sha_21`） | ✅ 全局唯一 | **一切实例级比较** |

铁律：

1. **任何 `find` / `filter` / `indexOf` / Vue `:key` 只要是在找「这一张牌」，一律用 `instanceId`。** 用 `id` 会导致一次弃杀把手里所有杀一起抹掉。
2. **所有权随区域走**：`Hand` / `Equip` / `Judge` 有持有者；`Deck` / `Discard` 是公共区域，`moveCard` 进入时必须清空 `owner`——否则弃牌堆回收后，旧主人会跟着牌一起被发到新主人手里。
3. 区域流转**只能**通过 `CardSystem.moveCard()`，禁止直接 push/splice 玩家的手牌数组。

### 3.11 依赖注入

引擎不自己 new 任何外部服务，全部由外部注入：

| 服务 | 职责 | 必须注入 |
|------|------|---------|
| `IRandomService` | 洗牌、判定 | ✅ 强制（禁用 Math.random） |
| `ILoggerService` | 日志 | ✅ 强制 |
| `IUIDecisionService` | 玩家/AI 决策 | ✅ 强制 |
| `IStoreService` | 状态同步 | 可选（无 UI 时为 no-op） |

**`IRandomService` 必须可 seed**。这决定了游戏能否复现，进而决定回放和确定性测试是否成立。

### 3.12 确定性

给定相同的种子 + 相同的决策序列，游戏必须产出完全相同的结果。这是硬性要求，不是优化项。

推论：
- 引擎内禁止 `Math.random()`、`Date.now()` 参与任何影响游戏状态的逻辑（`Date.now()` 仅可用于日志时间戳）
- 禁止依赖 `Object.keys()` / `Set` 迭代顺序做规则判断
- 容器遍历要么显式排序，要么依赖**规格承诺的顺序**（`Map` / 数组的插入序）；
  两者都不许依赖 `Set` / `Object.keys` 那种「碰巧如此」的顺序

**排序之前先问一句：这个顺序有没有语义。**

`SkillRegistry.getSkills` 是个反例：它按台账插入序返回，因此列表天然是
「主技能在前、组内派生在后」。曾一度改成按 id 字母排序以求「显式」，
结果 `main` 掉到 `a` / `b` 后面，把「主在前」这层语义抹掉了。
插入序本身就是确定的（挂载序列固定），排序反而是画蛇添足——
**显式排序是为了消除不确定性，不是为了让顺序变得好看。**

### 3.13 无懈可击抵消链（后发先至）

「后发先至」不是靠数奇偶实现的，而是靠**每张无懈都是一条真事件**：

```
T 南蛮入侵（cancelDepth 0）
  └ 层 1：问 T        → C 出无懈 W1（cancelDepth 1）
      └ 层 2：问 W1   → D 出无懈 W2（cancelDepth 2）
          └ 层 3：问 W2 → 无人响应
              → W2 生效，抵消 W1
              → W1 被抵消，不再抵消 T
              → T 照常结算
```

铁律：

1. **抵消目标用 `data.counterTarget` 显式传递**，禁止用「父事件的父事件」去猜。一层抵消实际消耗两层嵌套（`useCard` + 卡牌事件），靠树结构推算必然指错人。
2. **只开一层窗口**。更深的层由那张无懈自己的 `useCard` 内容再调 `openCancelChain()` 打开——事件嵌套代替手写递归，**栈就是链**。
3. **一层只接受一张无懈**（`stopOnFirstResponse`）。有人出手，问询立刻上移一层，并从**那张无懈的使用者**的下家重新绕一圈。
4. `event.cancelable` 只表示「这类事件会征询无懈」；此刻能否真被抵消一律问 `canBeCountered()`。新增否决条件请走 `registerCancelGuard()`（Phase 11 的 `mod.cardCancelable` 就接在这儿），不要往 `canBeCountered()` 里塞特例。
5. 事件必须自己声明 `cancelable: true` 才可能被抵消。构造测试事件时忘了这一项，无懈会静默失效。

### 3.14 伤害流水线

伤害**不是**一套平行流水线，它就是一条普通事件，走标准七阶段：

```
damageBefore  转移目标 / cancel 掉伤害 / 写 extraDamage（Mod 落点）
damageBegin   最后一道拦截
┌ damage（Content，步骤机四步）
│   1 Resolve  num = base + extra，下限 0
│   2 Source   发 damageSource 子事件（烈弓一类"来源相关"技能）
│   3 Apply    唯一扣血点 —— ctx.applyDamage() → DamageResolver.applyDamage()
│   4 Dying    hp ≤ 0 → 发 dying 子事件求桃
└
damageEnd     受伤后触发（反馈 / 刚烈 / 奸雄）
damageAfter   完全结算后（追伤）
```

铁律：

1. **扣血只有一处**：`DamageResolver.applyDamage()`，且只有 `damage` 事件的内容会调它。
   技能 / 卡牌 / 系统一律走 `ctx.damageTarget()` 发事件，禁止直接写 `player.hp`。
2. **伤害点数只有一个真值源 `event.values.num`**：进来装基础值，`Resolve` 步之后是最终值。
   `baseDamage` 仅供事后回溯，不参与计算——不要再去读它算伤害。
3. **「防止伤害」= `event.cancel()`**（在 `damageBefore` / `damageBegin`）。
   cancel 会跳过 Content 之后的全部阶段，所以「受伤后」的技能不会被误触发。
   直接置 `event.prevented = true` 只跳过扣血，后续阶段照常——**这不是防止伤害**。
4. **`damageSource` 是单发子事件**，不是阶段名（`damage` + 后缀推不出来）。
   它只在真有伤害来源时才发，且位于「数值定稿后、扣血前」。
5. **伤害事件要挂到发起方事件树上**（`EffectContext.damageTarget` 里 `parent: this.event` + `addChild`）。
   事件树要能读出 `sha → damage → dying`，技能靠它追溯来源。
6. `DamageResolver` 是纯函数集合：没有实例状态、没有注册表。要改伤害请在 `damageBefore` 写 `values.extraDamage`。

---

### 3.15 Mod（数值修改器）

「所有杀伤害 +1」「藤甲遇火伤 +1」「诸葛连弩无限出杀」这类**数值怎么算**的规则，
一律写进 `ModRegistry`，不要塞进 Content 的步骤机里。Mod 与流程分离是这套引擎能撑住
上千武将的关键。

铁律：

1. **Mod 必须是纯函数**：只读 `ctx`，不改状态、不发事件、不询问玩家。
   违反会在 `ModPurityError` 处炸掉（dev 模式对 `ctx.game` 做只读代理）。
   只读不算违规——`ctx.game.players.length` 这种读数是允许的。
2. **归属用 `owners()` 惰性求值，不要写死持有者字段。**
   装备类 Mod 的持有者随装卸变化；惰性求值让「卸下装备 → 下次查询自然查不到」成立，
   全程零清理代码。玩家死亡同理（`owners` 过滤掉不存活的）。
3. **结算顺序只能是 `priority` 降序 → 座次升序 → `mod.id` 字典序**，
   禁止依赖注册顺序。写测试时用**非交换运算**（`×10` 与 `+1`）才能验出真实次序，
   `+1` 和 `+1` 怎么排结果都一样，测不出东西。
4. **Mod 不可被无懈可击**（锁定技类效果不可响应），所以 Mod 实现里不需要处理取消逻辑。
5. **数值与布尔共用一个 `mods` 对象**（`INumericMods & IBooleanMods`），
   `queryNumeric` / `queryBoolean` 只是取不同 key。不要为了「类型更纯」拆成两个注册表——
   一个「藤甲」既要 `damageTo` 又要 `cardEnabled`。
6. **测 Mod 别用「血量差」断言。** `applyDamage` 会把实际扣减裁到剩余体力，
   人被打死后读到的就是「还能扣多少」而不是「伤害是多少」。
   要测伤害数值就读事件结算后的 `values.num`，或先把血垫高。

---

### 3.16 技能契约（`ISkill`）

Phase 13 起所有技能（英雄 + 装备）用 `core/contracts/skill.interface.ts` 的
`ISkill` 描述。`IEffect` 只剩一个 `@deprecated` 别名，不要再往里加东西。

**分类是布尔矩阵，不是单值枚举**

一个技能可以同时是 `locked` + `limited` + `awaken`。旧契约的
`type: SkillType` 只能二选一，表达不了这类组合，因此被废弃。

**三条机制各管一段，不要混着写**

| 字段组 | 回答的问题 | 什么时候跑 |
|--------|-----------|-----------|
| `trigger` + `filter` + `cost` + `content` | 某个时机额外做什么 | 事件流水线里 |
| `mod` | 这个数字是多少 / 这件事允不允许 | **每次查询**，不在流水线里 |
| `viewAs` + `filterCard` + `position` + `selectCard` | 这张牌能当什么用 | 出牌合法性检查时 |

判断归属的问法是：**「会不会改变某个数值？」** 会 → `mod`；不会 → `content`。
写反的代价是技能静默失效——例如把「出杀无次数限制」写成
「`turnStart` 时把某个字段改成 Infinity」，得盼着那个字段正好落在
engine 这次会读的管道上（历史上的咆哮就是这么死的：
它写的是 `attackLimit`，而 `PhaseManager` 读的是 `modQuery.cardUsable`）。

**数值改动的归属分界线**

```
会改数值吗？
├─ 任何带这个特征的东西都会 → source/base/mods/equip-mods.ts（按槽位 / tag 通用）
├─ 只有这一张牌会         → 该牌技能自己的 mod
└─ 不会改数值，是时机反应 → 该牌技能的 trigger + content
```

两处都写会让同一次查询命中两条（距离 +2 而没人知道为什么）。

**执行顺序固定为**：`filter → filter2 → frequency → usable → cost → content → 记账`

- `cost` 在 `content` **之前**：代价先付，效果后做
- 记账在**最后**：`content` 抛错则不计入次数——发动失败不该扣额度

**频率必须有人复位**

`oncePerTurn` 不是「引擎会自己知道」的东西：必须有人在每个回合边界调用
`EventTrigger.resetFrequency('turn')`，否则它退化成「整局一次」。
`phase` / `round` 同理，调用点分别在 `PhaseManager.executePhase`
和 `GameEngine.beginRound`。

**技能里不许用 `Math.random()`**（见 §3.12 确定性）。需要「随便挑一张」时
按固定顺序取（手牌第一张 / 座次升序），不要引随机。

### 3.17 技能台账（`SkillRegistry`）

Phase 14 起，「谁拥有哪些技能」只有一份账：`core/skill/skill-registry.ts`。
**定义**（全局的 `ISkill`）与**持有者**（按人的挂载）都记在那里，触发技与
`mod` 都以它为准。不要在别处再推断一次持有者——历史上三处推断互相矛盾，
直接导致装备的触发技从来没被挂上过。

**三种挂载来源，各有各的退场方式**

| 来源 | 谁挂上 | 谁摘掉 |
|------|-------|-------|
| `permanent` | 英雄 / 觉醒 / `attach` | 只有显式 `detach` |
| `equip` | 装备区出现这张牌 | 牌离开装备区（含被拆、被牵走） |
| `temp` | `addTempSkill(id, until)` | 到期事件 / `removeTempSkill` |

**挂载只认 `skillId`，不认卡牌**：`attach(player, 'zhuGeLianNu')` 与
「装备诸葛连弩」是两件事，前者不必有牌。反过来，装备区的变动由
`CardSystem.moveCard` 通知 `syncEquipSkills` 自动对齐——**不要**在
`equipCard` / `unequipCard` 里手写挂载，那两条路径之外还有拆装备和牵装备。

**Mod 不需要手动摘**：`ownersOf()` 每次现算，台账一改下一次查询就变了。
这是「失去技能」零清理代码的全部秘密，别写成 `detach` 时顺手 `unregister` 一个 mod。

**死者不摘钩子**：由引擎注入的 `skillGate` 拦（`!player.alive → false`）。
摘掉容易，复活时记得挂回去难。

**空桩一律不留**：未完成处 `throw new Error('NotImplemented')`。
历史上的 `enableEffect()` / `disableEffect()` 返回 `true` 却什么都不做，
比直接抛错坏得多——调用方以为成了。

---

### 3.18 技能属性矩阵（`ISkillRuntimeState`）

技能的分类属性（`locked` / `forced` / `limited` / `awaken` / `convertible`）
与频率（`frequency`）在 Phase 15 之前只是**字段**——写上去不报错，也没人读。
现在它们各自在一个环节被问一句：

| 属性 | 谁问 | 问到什么 |
|------|------|---------|
| `locked` / `forced` | `isForcedSkill` → AI 候选 / UI 确认框 | 不可拒绝，因此**不进**任何可选列表 |
| `limited` / `awaken` | `skillFrequency` → `'once'` | 整局一次，判据是永不清零的 `usedCount` |
| `frequency` | `EventTrigger.getMatchingHandlers` | 额度用完的钩子**不被收集** |
| `usable` | `EventCompiler` 的执行体 | 要读局面，只能在执行的那一刻算 |
| `convertible` | `flipConvertState` | 态翻 0/1；Mod 从玩家 mark 上读 |
| `mark` / `markClear` | `addMark` / `clearMarks` | 边界由引擎统一清，技能不必记得 |

三条硬约束：

**运行时状态挂在「玩家 × 技能」，不挂在钩子上。**
一条技能监听 N 个事件就编译出 N 个 `CompiledHandler`，它们必须共用同一份
`ISkillRuntimeState`，否则「每回合限一次」会退化成「每个事件各限一次」。

**频率判定只有一处实现**（`core/skill/skill-runtime.ts`）。
收集钩子、执行后记账、对外回答 `isAvailable` 三处都调它——
三处各写一份 switch，迟早有一处漏掉 `oncePerPhase`。

**限定技的判据是 `usedCount`，不是 `usedThisRound`。**
后者在轮次边界被清零，限定技过一轮就能复活（Phase 15 修掉的真 bug）。

---

### 3.19 视作（`viewAs` / 虚拟牌）

「这张牌是什么」与「这张牌能当什么用」是两件事。前者造牌时就定了，
后者由 `ViewAsService`（`core/skill/view-as.ts`）**每次被问**时枚举。

四条硬约束：

**`viewAs` 必须给出 `id`，且一律走 `viewLike(CardDef, {...})`。**
内容分发按 `card.id` 找 `useCardContent`；只覆盖 `tags` 的虚拟牌
只是「名字像杀」的另一张牌——打出去了却 dispatch 不到杀的内容。

**虚拟牌不属于任何区域。** 它是视图，不是实体。真正被使用与弃置的是
`ICardView.baseCards`。翻译放在 `CardSystem` 的三个移动入口
（`useCard` / `discardCard` / `finishProcessing`）——出牌、响应、
结算走的都是这几个出口，内容层因此不需要知道虚拟牌的存在。

**虚拟牌的 `instanceId` 是推导出来的**（`virtual:<skillId>:<底牌id...>`），
不用自增发号器。否则出牌阶段每刷新一次候选列表，同一条视作就换一个 id，
UI 的选中项、测试编排好的应答全对不上号。

**双面视作由 `ctx.usage` 分流。** 一张【杀】既是「可以打出去的杀」也是
「被杀时当闪的原料」，两面同时摆出来就会在出牌阶段冒出「闪」、
在响应窗口冒出「杀」——两条都是错的。

**额度按「当什么用」记，不按「叫什么」记**（`cardUsageKey()`）。
带 `CardTag.Strike` 的牌共用「出杀」这一个键；否则每张红牌都自带一次
出杀额度，「每回合一张杀」在武圣面前整体失效。

---

### 3.20 技能组合（`group` / `subSkill`）

两个字段方向相反，**别把它们做成同一件事**：

| | `group` | `subSkill` |
|---|---|---|
| 语义 | 持有主技能 = 持有全组 | 子技能是**独立定义** |
| 挂载 | 挂主技能时**递归**带上全组 | 不随主技能挂载，要谁有就对谁 `attach` |
| 卸载 | 摘主技能时全组跟着走 | 各挂各的 |
| 用途 | 「一个技能的两半分开写」 | 「一个技能只给别人一半」 |

三条硬约束：

**组内挂载是派生的。** 台账记 `groupOwner`，因此它不参与装备区对齐
（装备对齐只看装备区里有没有那张牌）。否则「英雄自带主技能 + 恰好穿着
同名牌」时，卸下装备会让组内技能神秘消失。

**子技能登记时就被摊平**（`expandSubSkills` 返回 `[父, ...子]`，id 是
`<主技能>_<子技能>`）。父技能仍是独立定义——它有自己的 `trigger` / `mod`，
不该被子技能「吃掉」。展开只做一次（在 `SkillRegistry.register`），
`registerSkillMods` 不再重复展开，否则同一个子技能的 Mod 会被登记两遍。

**展开要防环。** 两条技能互为组员是合法的写法，没有 `visited` 就是栈溢出。

---

### 3.21 全局钩子与 `when()` 一次性监听

两者都是「在某个时机做一件事」，区别只有一处——**有没有持有者**：

| | 全局钩子（`GlobalHookRegistry`） | `when()` |
|---|---|---|
| 属于谁 | 不属于任何人（局 / 规则） | 属于某个玩家 |
| `ctx.player` | 取自事件本身 | 恒是那个玩家 |
| 死亡 / 封技 | 照样触发 | 不触发 |
| 生命周期 | 手动 `off()` | 常配 `.once()` 自动注销 |

三条硬约束：

**没有持有者的钩子要标 `ownerless`。** 否则两件事都会错：`ctx.player`
按 `handler.playerId` 找不到人 → 整条 handler 被跳过（静默失效）；
它还会被技能放行闸拦下，于是「封了某人的技能」连监听一起封了。

**`.once()` 先摘后跑。** 注销发生在 `then` 之前：`then` 里再触发同一事件
不会重入，`then` 抛错也不会留下一条已废未摘的钩子。

**`SkillRegistry.clear()` 不许用 `eventTrigger.clear()`。** 后者会把不属于
台账的钩子一起抹掉。重开一局该清的是「谁拥有哪些技能」，不是「这个局
装了哪些监听」。

---

### 3.22 确定性随机

**引擎里只有一条随机流，且必须由外部注入。** `GameEngine` / `DeckManager`
都把 `IRandomService` 列为必填——曾经「不传就退回 `Math.random()`」的那条
分支已经删除。那是一条悄悄引入不确定性的后门：牌堆顺序一旦不可复现，
回放与批量回归测试就都失去意义。

**同一种子 + 同一串调用 = 同一串结果。** 标准实现是
`core/services/seeded-random.ts`（mulberry32），状态可 `snapshot()` /
`restore()`，能写进存档。

**不同用途各开一条流，不要共用。** AI 的「拟人思考延迟」和「几张牌差不多
好时随机挑一张」都吃随机数，而**回放时没有 AI 参与**。共用一条流的话两边
消耗次数不同，整条洗牌序列都会错位。AI 拿自己那条（由种子派生）。

**跨局累积的计数器必须能归零。** 卡牌实例号（`Card.resetIdGenerator()`）
与逻辑时钟（`gameClock.reset()`）都在 `GameEngine.init()` 里归零。不归零
的话第二局的牌会接着上一局的尾巴编号——局面一模一样，可 id 全都对不上。

**引擎内部的时间一律取逻辑刻度，不取挂钟。** 事件的 `timestamp`、结算的
`endedAt` 一旦用 `Date.now()`，两局同一过程就会产生两份不一样的档案。
呈现层（UI 日志的「几点几分」）照旧用挂钟：它不进状态，也不参与比对。

---

### 3.23 回放

一份录像 = **种子 + 决策序列**。种子决定洗牌 / 身份 / 英雄候选，决策决定
每个人怎么打；两者记下来，这局就能在任何机器上重新长出来。

**录像里存标识，不存引用。** 卡牌记 `instanceId`、玩家记座位 id、英雄与
技能记定义 id——实体引用一局一换，存档里留不住。

**每一步都先核对指纹再作答。** 决策种类、被问的人、候选集，三者任一不符
就抛 `ReplayDivergenceError`。少一道校验，「跑完了」就可能只是巧合。

**录像没走完 = 局面对不上。** 篡改**应答**（而不是请求）不会触发指纹校验：
引擎照样一圈圈问下去，只是每一步都得到不同的答案，最后照样「跑完了」——
放出来的却是另一局。因此「还剩 N 条决策没被问到」本身就是发散信号。

**比的是过程，不是结局。** 事件流水（`EventTrail`，挂在 §3.21 的全局钩子上）
比「谁赢了」硬得多：赢家一样的两局，过程可能完全不同。

---

### 3.24 状态变更收口

**一个字段只有一个写入点。** 玩家数值、标记与回合追踪 → `PlayerSystem`；
卡牌区域 → `CardSystem`。实体（`Player` / `Card`）只持有数据与只读派生，
**不提供任何变更方法**——接口层也不承诺写入能力，于是类型系统就是第一道护栏。

**夹取规则属于写入点，不属于调用方。** 「hp 不能为负」「回血不能超过上限」
「上限下调时当前值跟着裁」「非正数不动状态」这些只在 `PlayerSystem` 里写一遍。
放在调用方，就意味着每一条路都要各自记得判一次——漏一条就是分叉。

**零引用的写入方法一律删。** `Player` 上曾有 10 个方法生产代码里没人调用，
只在测试里被用。它们是系统层的重复实现，绕过 `zone` / `owner` / `visibleTo`
同步与装备变动通知。判定标准不是「现在有没有人用」，而是
**「存在这条路」本身会不会诱导后来者**——会，就删。不留「以后可能用得上」。

**卡牌的 `zone` / 区域数组 / `owner` / `visibleTo` 必须一起改。** 拆成两处就会出现
「牌在手牌数组里、zone 却写着 Deck」这种半身不遂。`CardSystem.moveCard` 是唯一出口，
所有移动（含虚拟牌翻译、装备变动通知）都从它过一遍。

**删完之后要有测试记住「不许再加回来」。** `player-system.test.ts` 末尾的结构护栏
断言 `Player` 上不存在那批方法、断言 `PlayerSystem` 里没有卡牌区域写入。
它们不测行为，测的是「没有别的路可走」。

---

### 3.25 日志与可观测性

**一条日志有两个「时间」，别混。** 状态里的日志只带 `tick`（本局第几步，
由 `GameState.addLog` 盖）；「现在几点几分」是呈现层的事，由 `logStore` 在进入
显示时补。让调用方**传不进**时间，这条规则就从「记得遵守」变成「不可能违反」——
否则每次比对两局都得额外记得剔除时间戳，忘一次就是一次假阳性。

**观测是彻底的旁观者。** 追踪端抛错一律在引擎侧吞掉：
「因为树记不下去导致整局崩了」是任何引擎都承受不起的失败模式。
同理，记录时只读 `gameClock.now`，绝不调用 `next()`——观测把逻辑时钟往前拨一格，
后面所有事件的时间戳就整体错位一格，而且错得非常隐蔽。

**关着的观测必须与不存在等价。** 「开关」不是「记完之后丢弃」，
而是从一开始就不往下走。因此诊断信息用回调传出而非返回额外数组：
关着的调用方不该为一份自己不要的信息多分配一个对象。

**任何会被写进可比对外延的自增量，都得在开局归零清单里。**
清单要集中（`GameEngine.init()` 的同一段），不能散在各文件的 `resetXxx()` 里——
散着就会漏。本轮就漏了一个：`GameEvent.resetIdGenerator()` 写好了却没人调用，
导致「开着观测跑两遍」反而比不开时对不上。

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
9. **数值修改一律用 Mod**：任何「+1 / -1 / 翻倍 / 设为无穷」类的效果必须写成 `mod`，禁止在 `trigger` 的 `content` 里改事件数值。
10. **Mod 必须是纯函数**：不得修改 `ctx` 中任何对象，不得发事件，不得调用 `waitForResponse`。
11. **禁止依赖 Mod 的注册顺序**：需要保证顺序时用 `priority` 显式声明。
12. **实例级比较一律用 `instanceId`**：见 §3.7。用 `id`（定义 id）做 `find` / `filter` / `:key` 是 bug。

### 禁止做

1. 在 `core/` 下 import 任何视图库或触碰浏览器 API。
2. 在视图层 import `core/event`、`core/engine`、`core/system`。
3. 在引擎内使用 `Math.random()`。
4. 直接读写 Pinia Store 中的游戏数据（只能读）。
5. 提交空的 try/catch 或 `catch {}`——异常要么处理，要么向上抛，要么记日志。
6. 提交 `return true` 的空实现桩（如 `enableEffect`）。未完成的功能要么不写，要么显式 `throw new Error('NotImplemented')`。
7. 在 `source/` 下写逻辑——那里只能是纯数据。
8. **使用拼音或中文命名任何标识符**（详见 §6.1）。注释可以中文，代码必须英文。
9. 提交无 `test` 覆盖的新规则逻辑（单元或集成，按重构计划对应 Phase 补齐）。
10. **绕过 `CardSystem` 直接改卡牌区域或玩家手牌数组**（见 §3.7）。

---

## 6. 命名约定

### 6.1 强制：一律英文语义命名，禁止拼音与中文

> **这是硬性规则，不是风格偏好。** 引擎内核是要被复用、被扩展、被他人阅读的公共代码，拼音命名会直接摧毁可读性。

适用范围与要求：

| 层 | 路径 | 要求 |
|----|------|------|
| **引擎内核** | `src/core/**` | **绝对禁止**拼音 / 中文标识符。变量、函数、类、接口、类型、枚举成员、类字段、方法名、文件名，全部英文语义。 |
| 桥接层 / 视图层 | `src/services`、`src/store`、`src/views`、`src/components`、`src/hooks` | 同上，禁止拼音标识符。 |
| 内容层 | `src/source/**` | 数据 `id` 使用英文语义（如 `strike` / `dodge` / `heal`），**不使用** `sha` / `shan` / `tao` 这类拼音。`name` / `title` / `description` 等展示文本保留中文。 |

具体禁止与对照：

| 禁止（拼音） | 使用（英文） |
|-------------|-------------|
| `sha` / `shan` / `tao` / `jiu` | `strike` / `dodge` / `heal` / `wine` |
| `wuxie` / `nanman` / `wanjian` | `counter` / `barbarianInvasion` / `rainOfArrows` |
| `caocao` / `guanyu` / `jianxiong` / `wusheng` | `caesar` … 或英文化的英雄/技能 ID（见 Phase 27 换皮映射表） |
| `shunshou` / `guohe` / `wuzhong` | 按卡牌效果语义命名 |
| `tengjia` / `gudingdao` / `zhugeliannu` | `vineArmor` / `blackBlade` / `repeatingCrossbow` |

补充规则：

- **缩写要通用**：`hp` / `maxHp` / `id` / `ctx` / `num` 这类业界通用缩写可用；自创缩写不可用。
- **布尔量用 is/has/can/should 前缀**：`isWounded`、`hasMark`、`canAttack`、`shouldSkip`。
- **不要用无意义后缀**：禁止 `data1` / `temp2` / `obj` 这类命名。
- **枚举成员用 PascalCase 语义值**：`CardType.Equip` 而非 `CardType.Zhuangbei`。
- **注释可以是中文，标识符必须英文。**

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
- 测试替身（logger / random / 决策服务 / `giveCard` / `cardDef`）一律从 `src/__tests__/helpers/game-env.ts` 取，
  **不要在测试文件里另抄一份**。抄的那份会漏实现接口方法，而它的目录又可能不在类型检查范围内
- 走 `tsconfig.vitest.json` 时记住：**TS 的 `*` 只匹配文件、不递归子目录**。
  `include` / `exclude` 要写 `**/*`，否则 `__tests__/xxx/` 下的文件会被静默漏掉
- 决策服务桩若要表达「一回合内出多张牌」，用**队列**而不是「一人一张」。
  出牌阶段是 while 循环，单槽会被后一次调用静默覆盖，剧本和跑出来的对不上

---

## 8. 当前已知偏离

> **重构前基线**（2026-09-22，`node_modules` 就位后首次实跑）：
> `npm run type-check` → 60+ 错误 exit 2；`npm run test:unit` → 789 个测试 / 315 失败。
>
> **Phase 1 完成后**（2026-09-22）：`type-check` → 0 错误；`npm run test` → 34 用例全通过；`npm run build` → 通过。
>
>
> **Phase 3 / 4 / 4B 完成后**（2026-09-23）：`npm run verify` → 43 用例全通过；5 人局可自动跑完 100 轮；技能第一次真正生效。
>
> **Phase 5 完成后**（2026-09-23）：`npm run verify` → 50 用例全通过；事件名体系落地，新增时机零引擎改动。
>
> **Phase 6 完成后**（2026-09-23）：`npm run verify` → 74 用例全通过；`GameEvent` 具备步骤机 / `trigger` 子事件 / 类型化错误；暂停粒度收敛到单个事件。
>
> **Phase 7 完成后**（2026-09-23）：`npm run verify` → **98 用例全通过**，`type-check` 0 错，`build` 通过；`npm run lint` 存量问题 53 → 29。卡牌行为第一次由 `ContentRegistry` 驱动（22 张牌各有集成测试），新增一张牌引擎零改动。
>
> **Phase 8 完成后**（2026-09-23）：`npm run verify` → **116 用例全通过**；`type-check` 0 错，`build` 通过，lint 28。结算点三要素落地；**濒死求桃从「完全没实现」变成可救可死**；无懈可击的连环抵消（奇偶定胜负）可跑通。
>
> **Phase 9 完成后**（2026-09-23）：130 用例全通过。每张无懈都是真 `useCard` 事件，事件嵌套代替递归；修掉 `GameEvent.trigger()` 一律继承父事件 `player` 的 bug。
>
> **Phase 10 完成后**（2026-09-23）：144 用例全通过。删 `DamageSystem`，伤害就是一条普通事件；防伤 = `cancel()` 而不是 `prevented`。
>
> **Phase 11 完成后**（2026-09-24）：164 用例全通过，lint 27。`ModRegistry` / `ModQuery` 落地；顺手修掉 `getTargetsForDelayedCard` 拿卡牌名比玩家对象的真 bug。
>
> **Phase 12 完成后**（2026-09-24）：182 用例全通过。`IBooleanMods` 九个键全部接线；修掉三件事——`ModQuery` 漏 `selectTargetOf`、**测试工程根本没被类型检查覆盖**（`include` 的 `*` 不递归子目录）、`ScriptedDecisionService` 漏实现接口 7 个方法（出牌阶段在所有测试里都是静默跳过）。
>
> **Phase 12B 完成后**（2026-09-24）：196 用例全通过，`type-check` 0 错，`build` 通过，**oxlint 0 / eslint 0**。死代码与过时注释清零；新增对局级最小化系统功能测试（开局 → 摸牌 → 出牌 → 响应 → 伤害 → 濒死 → 死亡 → 胜负 → 确定性）。
>
> **Phase 13 完成后**（2026-09-24）：**214 用例全通过**，`type-check` / `oxlint` / `eslint` 全 0，`build` 通过。`ISkill` 新契约落地，`IEffect` 退化为别名；修掉五个真问题——**`oncePerTurn` 从未复位（实为整局一次）、咆哮从未生效、克己从未生效、连弩/±1 马各写了两份 Mod、技能里用 `Math.random()`**。
>
> **Phase 14 完成后**（2026-09-24）：**233 用例全通过**。「谁拥有哪些技能」由三套互相矛盾的推断合成一张台账；装备带来的触发技第一次真的会触发。
>
> **Phase 15 完成后**（2026-09-24）：**250 用例全通过**，`type-check` / `oxlint` / `eslint` 全 0，`build` 通过。属性矩阵全部落地；修掉三个真问题——**限定技过一轮就复活（判据错用了会被清零的 `usedThisRound`）、「每回合限一次」实为「每事件限一次」、运行时状态长在钩子上**。拼音清零：`zhuanhuanji` → `convertible`。
>
> **Phase 16 完成后**（2026-09-28）：**268 用例全通过**，`type-check` / `oxlint` / `eslint` 全 0，`build` 通过。视作系统落地；修掉四个真问题——**虚拟牌只覆盖 `tags` 导致打出去了却 dispatch 不到内容、响应窗口看不到虚拟牌（龙胆的杀当闪打不出去）、出杀额度按底牌记导致「每回合一张杀」被武圣绕过、虚拟牌被当成实体塞进区域**。
>
> **Phase 17 完成后**（2026-09-28）：**296 用例全通过**，`type-check` / `oxlint` / `eslint` 全 0，`build` 通过。技能组合与一次性监听落地；修掉三个真问题——**无持有者的钩子因 `playerId` 查不到人而被整条跳过（且被技能放行闸误拦）、`expandSubSkills` 只返回子技能导致父技能自己的 mod / trigger 从未登记、子技能的 Mod 被登记两遍**。
>
> **Phase 18 完成后**（2026-09-28）：**313 用例全通过**，`type-check` / `oxlint` / `eslint` 全 0，`build` 通过。确定性随机与回放落地，`src/core` 里再没有 `Math.random`；修掉三个真问题——**卡牌实例号跨局自增导致同种子也复现不出同一局、AI 与牌堆共用一条随机流（回放时没有 AI，消耗次数不同会打乱洗牌序列）、篡改应答不会触发指纹校验于是「回放跑完了」是个假信号**。

以下条目当前代码**违反**了本规范，是重构要消灭的目标。清单随重构推进删除。

| # | 偏离 | 位置 | 负责 Phase |
|---|------|------|-----------|
| 1 | ~~契约层与实体层不同步~~ | `contracts/player.interface.ts` | ✅ 1 |
| 2 | ~~315 个测试失败~~（旧测试已全部作废） | `src/__tests__/**` | ✅ 1 |
| 3 | ~~`CardDefinition` 未从 entity 导出~~ | `entity/card.ts` | ✅ 1 |
| 4 | ~~Effect 从未注册，技能系统空转~~ | `GameEngine` / `GameBoot` | ✅ 3 |
| 5 | ~~`rebindState()` 后依赖未更新~~（已删除 `rebindState`） | `game-engine.ts` | ✅ 4 |
| 12 | ~~卡牌实例身份误用定义 id~~ | 全局 | ✅ 4B |
| 13 | ~~牌堆配比表按中文 name 查表~~ | `deck-manager.ts` | ✅ 4B |
| 14 | ~~卡牌效果的 `content` 无调用点~~（卡牌已迁到 `ContentRegistry`，按卡牌 id 触发） | 全局 | ✅ 7 |
| 15 | ~~**无 `viewAs` 调用点**：武圣/龙胆等转换技只存了定义~~ | `CardSystem` | ✅ 16 |
| 16 | `Card` / `GameEvent` 的 ID 生成器是全局自增、跨局不重置 | `entity/card.ts` | 18 |
| 6 | 伤害双轨制：先扣血再发事件 | `effect-context.ts` / `damage-system.ts` | 10 |
| 7 | **无 Mod 修改器机制**，全局数值效果无处安放 | 全局缺口 | 11–12 |
| 8 | ~~事件名是 20 个枚举，无法扩展~~（`TriggerTiming` 已删除） | `contracts/event-name.ts` | ✅ 5 |
| 9 | 大量直接改状态，绕过事件与 CardSystem | 多处 | 19 |
| 10 | 随机不可 seed | `game-engine.ts` / `game-boot.ts` | 18 |
| 11 | ~~空实现桩：`enableEffect` / `modifyEffects`~~（两个文件已删，台账重写） | `core/skill/skill-registry.ts` | ✅ 14 |
| 17 | **内容层 id 仍是拼音**（`jianxiong` / `paoxiao` / `sha` …，约 400 处），违反 §6.1 | `src/source/**` + 引用它们的测试 | 27 |
