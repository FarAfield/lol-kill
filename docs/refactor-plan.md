# 联盟杀 · 引擎重构计划（v2）

> 配套文档：[代码规范](./code-standards.md)  
> 参考实现：[无名杀 noname](https://github.com/libnoname/noname) —— 目前开源三国杀实现中扩展生态最成熟的一个，本计划的事件模型、技能模型、`mod` 修改器模型均对齐它的设计。  
> 原则：**先让它能编译能测，再让它跑起来，再让规则正确，最后才谈界面。**

## 全局约束（适用于所有 Phase）

1. **命名一律英文语义，禁止拼音 / 中文标识符。** 引擎内核（`src/core/**`）为硬性禁止，内容层 `src/source/**` 的 `id` 同样使用英文（`strike` 而非 `sha`）。展示文本（`name` / `title` / `description`）保留中文。对照表见 `code-standards.md` §6.1。
2. **实现方式简洁高效。** 能用纯函数就不用类，能用一层抽象就不用两层。每个 Phase 结束时应比开始时**代码更少或持平**，而不是更多。
3. **不照搬无名杀的命名与结构。** 无名杀只作为**机制参考**（事件阶段后缀、`mod` 修改器、`viewAs`、`when()` 等思路），具体命名与模块划分按 TypeScript 的类型系统与现代工程习惯重新设计——例如无名杀用字符串拼事件名，本项目用 `EventName = BuiltinEventName | (string & {})` 保住类型安全；无名杀挂全局 `lib.skill`，本项目用显式注册表 + 依赖注入。
4. **测试随 Phase 增量补充。** 旧测试全部作废；每个 Phase 的验收清单即该 Phase 要写的测试，不留欠账到下个 Phase。
5. **每个 Phase 独立可验收。** 未通过验收不得进入下一 Phase。

---

## 本次修订说明

v1 计划是基于静态阅读写的。本次装好 `node_modules` 后实跑验证，结论有重大变化，所以整体重写：

1. **项目当前编译不过**（60+ TS 错误），**789 个测试中 315 个失败**。v1 计划完全没有覆盖这件事——它不是重构，是抢救，必须排在最前面。
2. **参考无名杀后发现一个架构级缺口**：现有设计只有「触发器（trigger）」，没有「修改器（mod）」。这直接导致「所有杀伤害 +1」这类全局效果无处安放。这是本计划新增的核心部分（组 D）。
3. `TriggerTiming`（17 个枚举）× `TriggerStage`（7 个）× 4 scope 的组合方式**无法扩展**——新增一张卡牌如果需要新时机，就得改枚举。改为无名杀式的「事件名 + 阶段后缀」字符串方案。

---

## 0. 基线实测数据

> 执行时间 2026-09-22，环境 node v22.22.2 / npm 10.9.7 / vitest 4.1.9

| 指标                   | README 声明 | 实测                                                |
| -------------------- | --------- | ------------------------------------------------- |
| 单元测试                 | 904 个，全通过 | **789 个，315 失败 / 474 通过**                         |
| 测试文件                 | —         | **36 个，20 失败**                                    |
| `npm run type-check` | —         | **60+ 错误，exit 2**                                 |
| 技能是否生效               | —         | **否**，`EffectRegistry` / `SkillRegistry` 生产代码零实例化 |

### 失败根因分类（已定位，非猜测）

| 根因                                         | 影响的错误数   | 说明                                                                                                                                                     |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **契约层与实体层不同步**                             | ~35      | `IPlayer` 接口是纯数据（零方法），但 `Player` 类实现了 `setMark/getMark/isWounded/isDying/getEquipInSlot/hero/markAttackUsed` 等 12 个成员，而消费方按 `IPlayer` 取类型 → 全部报 TS2339 |
| **`CardDefinition` 未从 entity 导出**          | 3        | `src/source/cards/*.ts` 从 `@core/entity/card` 导入，但该模块只 `import type` 未 `export`                                                                        |
| **`Card.resetCounter()` 不存在**              | 20 个测试文件 | 实体上是 `resetIdGenerator()`，20 个测试的 `beforeEach` 调 `resetCounter` → 整个文件挂掉。这是 315 个失败测试中的绝大部分                                                            |
| **`IGameState` 缺 `aliveCount`**            | 1        | `trick-effects.ts:348`                                                                                                                                 |
| **`IStoreService` 缺 `onChange`**           | 3        | `views/game-text/index.vue`                                                                                                                            |
| **`HeroDefinition` 必填字段缺失**                | 10       | `source/heroes/standard.ts` 未给 `maxPower` / `skins`                                                                                                    |
| **`GameController` 类型不匹配**                 | 1        | `views/game/index.vue` 用对象字面量赋值 `GameController`                                                                                                       |
| **`IHero` → `Record<string, unknown>` 断言** | 1        | `hooks/useSkill.ts:213`                                                                                                                                |

**结论**：315 个失败里绝大多数是「测试脚手架调了不存在的方法」，不是逻辑错误。修掉契约层 + 一个方法别名，基线大概率能回到接近全绿。**但这不代表规则是对的**——那 474 个通过的测试验证的是零件，整机仍然没接线。

---

## 1. 目标架构

### 1.1 与无名杀的对应表

| 无名杀                                                                  | 本项目的目标模块                             | 状态           |
| -------------------------------------------------------------------- | ------------------------------------ | ------------ |
| `lib.skill[name]` 技能定义对象                                             | `core/skill/skill-registry.ts`       | 存在，需重构契约     |
| `skill.trigger: {player/source/target/global: EventName[]}`          | 同构，改为字符串事件名                          | 存在，需换命名体系    |
| `skill.filter / filter2 / check / cost / content`                    | 同构字段                                 | 部分存在         |
| **`skill.mod` 修改器**                                                  | **`core/skill/mod-registry.ts`**     | **不存在，本次新建** |
| `lib.element.Content[eventName]` 事件默认处理器                             | **`core/event/content-registry.ts`** | **不存在，本次新建** |
| `game.globalEventHandlers` 全局钩子                                      | **`core/event/global-hook.ts`**      | 不存在          |
| `player.when()` 一次性临时监听                                              | `addTempSkill()`                     | 不存在          |
| `player.addMark/countMark/removeMark/clearMark`                      | `Player.marks`                       | 存在，接口未声明     |
| `player.addSkill/removeSkill/changeSkills`                           | `SkillRegistry.attach/detach`        | 存在空桩         |
| `convertible` 转换技                                                    | 状态机字段                                | 不存在          |
| `equipSkill` 装备技                                                     | 装备区联动                                | 不存在          |
| `viewAs / filterCard / position / selectCard`                        | `IEffect.viewAs`                     | 部分存在         |
| `ai.order / ai.result.player / ai.result.target / threaten / expose` | `aiValue / aiCard / aiTarget`        | 部分存在         |
| `event.goto(step)` / `event.finish()` / `event.cancel()`             | `EventPauseManager`                  | 语义不完整        |

### 1.2 分层（新增 `core/skill/`）

```
src/
├── core/
│   ├── contracts/     纯类型，零实现
│   ├── entity/        Player / Card / Hero / GameState（数据 + 自身不变量）
│   ├── system/        状态变更唯一入口（CardSystem / PlayerSystem / DamageSystem / ...）
│   ├── event/         EventBus + EventStack + ContentRegistry + 结算点 + 响应征询
│   ├── skill/         ★ 新增：SkillRegistry / ModRegistry / TriggerIndex / TempSkill
│   ├── engine/        GameEngine / PhaseManager / TurnManager
│   ├── services/      StoreService / AIController / RandomService / LoggerService
│   └── boot/          GameBoot —— 唯一装配点
├── source/            纯数据（卡牌 / 英雄 / 技能 / 模式），可外部扩展
├── services/          GameController —— UI 唯一入口
└── views/ components/ hooks/ store/
```

依赖方向不变，仍为单向：`views → GameController → GameBoot → engine → event/skill → system → entity → contracts`。

### 1.3 三种扩展机制的分工

> 这是整个重构中最重要的设计决策。无名杀之所以能支撑上千个武将，是因为它把「改数值」和「走流程」拆成了两套机制。

| 机制                 | 回答的问题                     | 特征                                    | 例                         |
| ------------------ | ------------------------- | ------------------------------------- | ------------------------- |
| **Mod（修改器）**       | 这个数值**怎么算**？这个动作**能不能做**？ | 纯函数、无副作用、自动叠加、随持有者生死自动失效、不可被无懈、不可询问玩家 | 所有杀伤害+1、藤甲火伤+1、手牌上限+2、-1马 |
| **Trigger（触发器）**   | 流程**怎么走**？要不要**问玩家**？     | 可交互、可取消、可被无懈、有优先级与座次                  | 奸雄（受伤后拿牌）、无懈可击、濒死求桃       |
| **Content（事件处理器）** | 这个事件**本身**做什么？            | 事件的默认行为，一张卡牌一张脸                       | 杀的结算流程、南蛮入侵的轮询            |

**判断准则**：能用 Mod 表达的一律用 Mod，不要用 Trigger。Mod 不需要处理优先级、座次、取消、AI 询问，复杂度低一个数量级。

---

## 2. 扩展能力验收清单

> **这份清单是本次重构的总验收标准。** 本表的 28 条与 Phase 数无关（Phase 是 29 个执行单元，见 §3）。  
> 组 D 结束后（Phase 11–17，已于 2026-09-28 完成），下列每一个效果都必须能在 `source/` 里用**不超过 15 行**代码实现，  
> **零引擎改动**。做不到就说明架构没到位。
>
> **2026-09-30 首次逐条勾选**（此前一个勾都没有）。判据分三档：
>
> - ✅ **实装** —— `source/` 里有真实技能/装备在用
> - 🟡 **接线就绪** —— 消费方已在生产路径上，只差一条 ≤15 行的定义
> - ⬜ **机制已通** —— 测试里用 ≤15 行实现过并断言通过，但 `source/` 无落点
>
> 「实测行数」计的是**非空非注释行**。清单的口径是「能不能 ≤15 行实现」，  
> 因此三档都算达标；区别在于证据强度，不在达标与否。

| #  | 效果                   | 应使用机制                                 | 目标    | 状态 | 落点 / 证据                                                                                                                    | 实测行数             |
| -- | -------------------- | ------------------------------------- | ----- | -- | -------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1  | 所有【杀】造成的伤害 +1（全局）    | `mod.globalDamageFrom`                | 5 行   | ⬜  | 机制：`mod-registry.test.ts:73-87`（注册一条即全场生效）。`source/` 无落点                                                                   | 3                |
| 2  | **你**使用的【杀】伤害 +1     | `mod.damageFrom`                      | 5 行   | ⬜  | 机制：`mod-registry.test.ts:89-100`（只有持有者的伤害 +1，别人不变）。`source/` 无落点                                                           | 3                |
| 3  | 你受到的**火焰**伤害 +1（藤甲）  | `mod.damageTo`                        | 6 行   | ✅  | `source/base/mods/equip-mods.ts:68-75` `rattanArmorMod`                                                                    | 7                |
| 4  | 你的攻击范围 +1（武器）        | `mod.attackRange`                     | 4 行   | ✅  | `source/base/mods/equip-mods.ts:48-58` `weaponRangeMod`（一张表覆盖所有武器）                                                         | 8                |
| 5  | 你计算与其他角色距离时 -1（-1 马） | `mod.distanceFrom`                    | 4 行   | ✅  | `source/base/effects/equip-effects.ts:279-288` `offensiveHorse`                                                            | 6                |
| 6  | 其他角色计算与你距离时 +1（+1 马） | `mod.distanceTo`                      | 4 行   | ✅  | `source/base/effects/equip-effects.ts:263-272` `defensiveHorse`                                                            | 6                |
| 7  | 你的手牌上限 +2            | `mod.maxHandcard`                     | 4 行   | 🟡 | 消费方已接线：`phase-manager.ts:438`（弃牌阶段读它）。机制：`mod-registry.test.ts:342-355`。`source/` 无定义侧落点                                   | —                |
| 8  | 你每回合可多使用一张【杀】（诸葛连弩）  | `mod.cardUsable`                      | 6 行   | ✅  | `equip-effects.ts:58-70` `zhuGeLianNu`；同管道的第二例 `shu-skills.ts:111-124` `paoxiao`                                           | 4 / 6            |
| 9  | 你的【杀】不受距离限制          | `mod.targetInRange`                   | 5 行   | 🟡 | 消费方已接线：`phase-manager.ts:556`。机制：`boolean-mods.test.ts:238-260`                                                            | —                |
| 10 | 你不能成为【杀】的目标          | `mod.targetEnabled`                   | 5 行   | 🟡 | 消费方已接线：`phase-manager.ts:555`。机制：`boolean-mods.test.ts:238-260`（注释明写「验收清单 #10」）                                            | —                |
| 11 | 你不能使用或打出【闪】          | `mod.cardEnabled` + `cardRespondable` | 6 行   | 🟡 | `cardEnabled` 消费方已接线：`phase-manager.ts:616`；`cardRespondable` 见 `response-inquiry.ts:46`。机制：`boolean-mods.test.ts:116,150` | —                |
| 12 | 你的【闪】不能被用来救人         | `mod.cardSavable`                     | 4 行   | 🟡 | 消费方已接线：`effect-context.ts:179`（求桃窗口）、`view-as.ts:151`。`source/` 无定义侧落点                                                     | —                |
| 13 | 你的锦囊牌不能被【无懈可击】抵消     | `mod.cardCancelable`                  | 4 行   | 🟡 | 消费方已接线：`game-engine.ts:384`（守卫）。机制：`boolean-mods.test.ts:211-235`                                                          | —                |
| 14 | 红色手牌可以当作【杀】使用（武圣）    | `viewAs` + `filterCard`               | 10 行  | ✅  | `source/heroes/skills/shu-skills.ts:67-95` `wusheng`                                                                       | 10（含注释 29）       |
| 15 | 【杀】可以当作【闪】打出（龙胆）     | `viewAs`                              | 8 行   | ✅  | `shu-skills.ts:132-174` `longdan`                                                                                          | 20（双向各一面，单面约 10） |
| 16 | 每当你受到伤害后，摸一张牌        | `trigger: {player: 'damageEnd'}`      | 10 行  | ⬜  | `damageAfter` + `target` 方向已实装：`wei-skills.ts:43 / 115 / 193`（奸雄/反馈/刚烈）。换成 `drawCards(1)` 即本条                              | 4（参照反馈）          |
| 17 | 每当你造成伤害后，获得伤害来源一张手牌  | `trigger: {source: 'damageEnd'}`      | 12 行  | ⬜  | `source` 方向已实装：`equip-effects.ts:83,165`（`useCardBefore` / `damagePrevent`）。与 `damageAfter` 的组合尚无用例                        | —                |
| 18 | 限定技：整局只能发动一次         | `limited: true`                       | 1 行字段 | ⬜  | 属性已实现，测试：`skill-attributes.test.ts:78-128`（含「过一轮也不复活」）。`source/` 无落点                                                       | 1                |
| 19 | 觉醒技：体力 ≤ 1 时永久获得新技能  | `awaken` + `addSkill`                 | 12 行  | ⬜  | 属性已实现，测试：`skill-attributes.test.ts:258-317`（含「不可回退」）。`source/` 无落点                                                         | ~12              |
| 20 | 转换技：阴阳两态切换           | `convertible: true`                   | 15 行  | ⬜  | 属性已实现，测试：`skill-attributes.test.ts:318-387`（两态的 content 与 mod 都不同）。`source/` 无落点                                           | ~15              |
| 21 | 锁定技：满足条件强制发动，不可拒绝    | `locked: true`                        | 1 行字段 | ✅  | `shu-skills.ts:116`（咆哮）、`:75`（武圣不是）、`wu-skills.ts:75`（克己）、`equip-effects.ts:64,232,269,285`                                | 1                |
| 22 | 装备技：装备时获得，卸下时自动失效    | `equipSkill: true`                    | 1 行字段 | ✅  | `equip-effects.ts` 九张装备全部带（`:63,81,105,146,164,195,231,268,284`）                                                           | 1                |
| 23 | 临时技能：获得一个持续到回合结束的技能  | `addTempSkill(id, 'turnEnd')`         | 2 行   | ⬜  | API 已实现，测试：`skill-registry.test.ts:262-341`（含「不留幽灵钩子」）。`source/` 无落点                                                       | 2                |
| 24 | 每回合限一次 / 每轮限一次       | `frequency: 'oncePerTurn'`            | 1 行字段 | ✅  | `shu-skills.ts:42`（仁德）、`wei-skills.ts:198,244`（刚烈/突袭）、`wu-skills.ts:28`（制衡）                                                | 1                |
| 25 | 标记：用计数器记录技能状态        | `mark: true` + `addMark/countMark`    | 6 行   | ✅  | 写入走 `ctx.setMark`：`equip-effects.ts:91,214,244`、`shu-skills.ts:55-56`、`wei-skills.ts:104,255`、`wu-skills.ts:37`            | 1–2              |
| 26 | 子技能：一个技能拆成多个内聚模块     | `subSkill` / `group`                  | 结构字段  | ⬜  | 已实现并测试：`skill-composition.test.ts`（递归展开、单独 `attach`、随主技能摘除）。`source/` 无武将使用                                                | 结构字段             |
| 27 | 一次性监听：下次摸牌时触发一次后自动注销 | `when('drawEnd').once()`              | 6 行   | ⬜  | API 已实现（`core/event/when.ts`、`effect-context.ts:516`），测试：`global-hook.test.ts:186-310`。`source/` 无落点                       | 6                |
| 28 | 全局钩子：任意角色使用牌时记录日志    | `globalHook.on('useCard')`            | 6 行   | ⬜  | API 已实现（`core/event/global-hook.ts`），测试：`global-hook.test.ts`。`source/` 无落点                                                | 6                |

**汇总**：✅ 实装 **11** 条 ｜ 🟡 接线就绪 **6** 条 ｜ ⬜ 机制已通 **11** 条 ｜ 不达标 **0** 条。

> 11 条「机制已通」里，**5 条（#18 / #19 / #20 / #23 / #26）是属性与 API 都已到位、  
> 只差一个用它的武将**——它们不是架构缺口，是内容缺口。  
> 真正的架构缺口一个也没有：每一条都能在 `source/` 里用 ≤15 行、零引擎改动地实现。

---

## 3. 进度总表

**状态列口径（2026-09-30 统一）**：此前 ✅ 散落在 Phase 号与目标列之间、位置与含义都不固定，  
现在收进独立的状态列，判定只看正文验收项：

| 状态     | 判定依据                                         |
| ------ | -------------------------------------------- |
| ✅ 完成   | 正文验收项全部 `[x]`                                |
| 🟡 进行中 | 验收项部分 `[x]`，**或**产物已写就但未接进生产路径（含「内容已就绪、欠事件」） |
| ⬜ 未开始  | 本 Phase 名下无任何落地产物                            |

| #   | 状态 | Phase                                  | 目标                                        | 依赖     | 预估   |
| --- | -- | -------------------------------------- | ----------------------------------------- | ------ | ---- |
|     |    | **组 A · 抢救基线**                         |                                           |        |      |
| 1   | ✅  | 契约层与实体层对齐                              | 消除 60+ TS 错误                              | —      | 1d   |
| 2   | ✅  | 测试脚手架修复与基线固化（**已跳过**）                  | 789 测试回到可控状态                              | 1      | 1d   |
|     |    | **组 B · 让引擎活起来**                       |                                           |        |      |
| 3   | ✅  | 建立装配根                                  | Effect/Skill 第一次真正生效                      | 2      | 1d   |
| 4   | 🟡 | 单一真值源                                  | 消灭 `rebindState` 依赖失效                     | 3      | 0.5d |
| 4B  | ✅  | 卡牌实例身份                                 | 卡牌总数守恒 + `instanceId` 全局唯一                | 4      | 插入   |
|     |    | **组 C · 事件内核 noname 化**                |                                           |        |      |
| 5   | ✅  | 事件命名体系改造                               | `TriggerTiming` → 事件名 + 阶段后缀              | 4      | 1d   |
| 6   | ✅  | `GameEvent` 重写                         | 支持 step / goto / cancel / finish / result | 5      | 1d   |
| 7   | ✅  | `ContentRegistry` 事件处理器                | 卡牌效果迁出 Effect 体系                          | 6      | 3d   |
| 8   | ✅  | 结算点与响应征询                               | 按座次轮询 + 插入 + 暂停                           | 6      | 3d   |
| 9   | ✅  | 无懈可击链式抵消                               | 后发先至完整实现                                  | 8      | 1d   |
| 10  | ✅  | 伤害流水线统一                                | 消灭双轨制                                     | 7, 9   | 1d   |
|     |    | **组 D · 技能与扩展系统（核心）**                  |                                           |        |      |
| 11  | ✅  | `ModRegistry` 数值修改器                    | 清单 #1–#9                                  | 10     | 2d   |
| 12  | ✅  | `ModRegistry` 布尔否决器与接线                 | 清单 #10–#13                                | 11     | 2d   |
| 12B | ✅  | 代码整理与最小化系统功能测试                         | 主干清零 + 对局级验证                              | 12     | 0.5d |
| 13  | ✅  | `ISkill` 新契约                           | 对齐无名杀技能定义                                 | 12B    | 1d   |
| 14  | ✅  | `SkillRegistry` 挂载 / 卸载 / 临时技能         | 清单 #22 #23                                | 13     | 2d   |
| 15  | ✅  | 技能属性矩阵                                 | 清单 #18–#21 #24 #25                        | 14     | 2d   |
| 16  | ✅  | `viewAs` 视作系统                          | 清单 #14 #15                                | 13     | 1.5d |
| 17  | ✅  | `group` / `subSkill` / 全局钩子 / `when()` | 清单 #26 #27 #28                            | 14     | 1.5d |
|     |    | **组 E · 地基**                           |                                           |        |      |
| 18  | ✅  | 确定性随机与回放                               | 同种子完全复现                                   | 4      | 1d   |
| 19  | ✅  | 状态变更收口 `PlayerSystem`                  | 消灭直接改属性                                   | 4      | 1.5d |
| 20  | ✅  | 日志与可观测性                                | 结构化事件日志                                   | 6      | 1d   |
|     |    | **组 F · 规则补全**                         |                                           |        |      |
| 21  | 🟡 | 距离与目标合法性                               | 全部走 DistanceSystem                        | 12, 19 | 1.5d |
| 22  | 🟡 | 回合与阶段                                  | 杀上限、跳过阶段、主公 0 号位                          | 19     | 2d   |
| 23  | 🟡 | 濒死、死亡与奖惩                               | 按座次求桃、奖惩摸牌                                | 8, 22  | 2d   |
| 24  | ✅ | 判定与延时锦囊                                | 乐/兵/闪电生效                                  | 7, 21  | 1.5d |
| 25  | ✅ | 胜负判定                                   | 四种身份胜利条件                                  | 23     | 1d   |
|     |    | **组 G · AI 与 UI**                      |                                           |        |      |
| 26  | 🟡 | AI 适配新契约                               | `ai.order` / `threaten` / AI 认识 Mod       | 15, 21 | 2d   |
| 27  | ⬜  | UI 接线与 LOL 换皮                          | 界面反映真实状态 + 主题映射                           | 25     | 3d   |


> ⬜ 未开始 ｜ 🟡 进行中 ｜ ✅ 完成

**合计 29 个执行单元**（编号 1–27，加执行中新插入的 **4B** 与 **12B**）：  
**✅ 23 ｜ 🟡 5 ｜ ⬜ 1**（2026-09-30 欠账清偿后：24、25 转 ✅）。

> **数量口径（三处曾互不一致，现统一）**
>
> - **29** = 本表执行单元数（编号 1–27 + 4B + 12B）。其中的 **27** 是**编号数**——不含两个插入 Phase，所以编号止于 27 而单元数是 29。
> - **28** = §2「扩展能力验收清单」的条目数，与 Phase 数**无关**，不要混用。
> - 4B 与 12B 是执行中发现的阻断项/整理项，没有占用新编号，因此编号仍止于 27。

**🟡 的五项，欠的都是什么**（详见各组正文与 §3.1 欠账登记）：

| #  | 卡在哪                                                                       |
| -- | ------------------------------------------------------------------------- |
| 4  | 只欠一条测试：`init()` 两次后无幽灵玩家、无重复卡牌                                            |
| 21 | **只剩距离规则的完整翻新**：`TargetSystem` 已进生产、距离与攻击范围已生效（D3 / D4 结清）。剩余的是规则**内容**——马的距离修正、藤甲、技能改写距离等，见下方「Phase 21 还剩什么」 |
| 22 | 主公固定 0 号位未做（D7）；两套跳过账本并存（D29，只登记）                                        |
| 23 | 主公误杀忠臣弃牌未实现（D13）；濒死求桃成功路径无断言（D14）；`die` 与 `rewardDraw` 已结清          |
| 26 | 三档难度在位但**从未标定**；AI 不认识 Mod（额度那条已随 D8 修好）、不会 `viewAs`、无 `ai.order` / `threaten` |
| 4  | 只欠一条测试：`init()` 两次后无幽灵玩家、无重复卡牌                                            |

### 3.0 Phase 21 还剩什么（D3 / D4 结清后重新评估）

> 任务书要求：T3 的第 5、6 条做完后**重新评估**，不要预先承诺 1.5d。评估如下。

**本轮已经拿走的**（D3 / D4，原以为是 Phase 21 的主体）：

| 原状 | 现在 |
|---|---|
| `TargetSystem` 零生产调用方，引擎里另有一份按牌型 if-else 的副本 | 副本删除，`PhaseManager` 直接调 `TargetSystem`（`target-wiring.test.ts` 钉住「两处答案一致」） |
| 「简化处理，不计算距离」，【杀】能指向任何活人 | 走 `DistanceSystem.isInRange`，武器 `attackRange` 经 Mod 生效（装刀前后目标列表会变） |
| `game-controller` 里还留着第三份目标规则（杀看距离、桃看自己……） | 删掉，改调 `GameEngine.getValidTargets` |
| `IModQuery` 声明不全，类型上看不出它能当 `DistanceMods & TargetMods` | 补齐六个 `...Of` 方法 |

**还剩三块，都不是「重写距离」**：

1. **一条接线**：`TargetSystem.validateTargets` **零调用方**（新发现 → **D31**）。
   `GameEngine.useCard` 不校验目标，因此验收项「出牌时非法目标被拒绝并给出原因」仍未达成。
   这是纯接线，函数早已写好。
2. **一条断言**：验收项「-1 马 / +1 马影响可选目标」——机制**已通**
   （`equip-effects.ts:271,287` 注册了 `distanceTo` / `distanceFrom`，`DistanceSystem` 会读），
   但没有任何断言钉住「可选目标因马而变」。
3. **规则内容本身**：马之外还有藤甲、技能改写距离等来源是否需要走 Mod。
   这才是 Phase 21 的正题，本轮**未动**，也不在本轮范围。

**结论**：Phase 21 从「把距离系统接起来」降级为
**补一条接线 + 补一条断言 + 做规则内容**。原估 1.5d 的口径偏大，需重估。

### 3.1 欠账登记（2026-09-30 全仓清点）

正文里散落的 `[ ]`、各组「现状」表里的 ❌ / ⚠️、以及核对中新发现的漏网，  
统一登记在这里，**每条都有归属 Phase 与代码证据**。登记不等于开工——  
这里只回答「还欠什么」，不改动任何 Phase 的范围与顺序。

**性质一栏的口径**

| 性质          | 含义                            |
| ----------- | ----------------------------- |
| 接线缺失        | 代码写好了、也注册了，但**没有任何生产调用方**会走到它 |
| 未实现         | 这条逻辑压根没写                      |
| 测试欠账        | 逻辑大概率是对的，但没有断言盯着它             |
| 设计未定        | 有能跑的替代品，但与计划里的形态不一致，需先决议      |
| Phase 19 漏网 | Phase 19 的状态收口没覆盖到的直接写属性      |
| 疑似笔误        | 重复条件，怀疑漏写了第二个 tag             |

| 编号  | 归属 | 欠什么                                                                 | 性质           | 证据                                                                                                                   |
| --- | -- | ------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| D1  | 16 | 武圣「打出 → 真的造成伤害」的端到端用例                                               | 测试欠账         | `view-as.test.ts:148` 只断言视作列表；同路径端到端由龙胆用例覆盖（`:246`）                                                                  |
| D2  | 4  | `init()` 连续两次后无幽灵玩家、无重复卡牌的断言                                        | 测试欠账         | `game-loop.test.ts:69` 只校验单次 boot；`determinism.test.ts:225` 只测生成器本身                                                  |
| ~D3~ ✅ **2026-09-30 结清** | 21 | `TargetSystem` **零生产调用方** | 接线缺失 | 副本已除：`PhaseManager.getValidTargetsForCard` 原先是一份按牌型 if-else 堆出来的**平行实现**，与 `TargetSystem` 各写各的规则；现在它直接调 `TargetSystem.getAvailableTargets(player, card, state, modQuery)`。顺带把 `IModQuery` 补上 `attackRangeOf` / `distanceFromOf` / `distanceToOf` / `selectTargetOf` / `targetEnabledOf` / `targetInRangeOf` —— 实现早就在 `ModQuery` 上，接口没声明，于是类型上「看不出」它能当 `DistanceMods & TargetMods`，两个系统只能被测试单独喂具体类。`GameEngine` 里两个零读取的实例字段（`distanceSystem` / `targetSystem`）一并删除。断言见 `src/__tests__/system/target-wiring.test.ts` |
| ~D4~ ✅ **2026-09-30 结清** | 21 | 出牌候选目标不计算距离与攻击范围 | 接线缺失 | 那句「简化处理，不计算距离」随副本一起删除。现在【杀】的目标由 `DistanceSystem.isInRange` 决定，武器 `attackRange` 经 `equip-mods.ts` 的 Mod 进入计算——**装刀前后目标列表会变**（这是本次新增的断言，也是此前唯一能证明武器有效的证据）。另补 `TargetSystem` 缺的装备分支：原先装备牌会落到「默认：距离 1 的其他角色」，即把武器装到别人身上 |
| ~D5~ ✅ **2026-09-30 结清** | 21 | `tags.has(CardTag.Heal) && tags.has(CardTag.Heal)` 重复条件 | 疑似笔误 | **原意已判定：第二个 tag 本该是 `CardTag.Basic`**。依据：项目 tag 约定是「具体牌 tag + 类别 tag」（杀 `Strike+Attack`、闪 `Dodge+Defense`、酒 `Wine+Boost`），桃是 `[Heal, Basic, Dying]`；且 `Heal` 并非桃独有——【桃园结义】是 `[PeachGardenOath, Trick, Heal, Aoe]`，只判 `Heal` 会把群体牌塞进桃的目标规则。已改为 `Heal && Basic`，断言见 `src/__tests__/system/target-system.test.ts` |
| ~D6~ ✅ **2026-09-30 结清** | 21 | `card.tags.has(CardTag.Heal) \|\| card.tags.has(CardTag.Heal)` 重复条件 | 疑似笔误 | 同上：这是同一条分支在 `PhaseManager.resolveTargetsForCard` 里的**副本**，同样区分不出桃与桃园结义。已改为 `Heal && Basic`，与 `TargetSystem` 判据对齐，断言同上 |
| D7  | 22 | 主公固定 0 号位先手                                                         | 未实现          | `game-engine.ts:797-815` 把主公也一起 shuffle 了                                                                            |
| ~D8~ ✅ **2026-09-30 结清（形态甲）** | 22 | 杀的额度**两套并存** | 设计未定 → 已裁决 | 判定收口到 `CardBudget.canPlay`（新增 `src/core/skill/card-budget.ts`）：`已用次数 < modQuery.cardUsable`。**迁移完的调用点**：`phase-manager.ts:643`（出牌选项）、`ai-strategies.ts:454,609,620`（AI，经 `createAIStrategy` 注入）、`game-controller.ts:576`（UI）。**已删除**：`Player.canAttack` / `IPlayer.canAttack`——它算的是 `attackLimit > (usedAttackThisTurn ? 1 : 0)`，一个不经过 Mod 注册表的算式，连弩装上去以后与出牌选项给出相反答案。`usedAttackThisTurn` 降级为事实账本（克己的 filter 继续读它），不再回答「能不能」。**注入路径**：`GameBoot.boot()` → `decisionService.setCardBudget(engine.cardBudget)`（AI 先于引擎出生，只能事后补）。**第二处判定已消失**：源码级扫描见 `src/__tests__/skill/card-budget.test.ts` |
| ~D9~ ✅ **2026-09-30 结清** | 19 / 22 | `assignRoles` 直接改 `maxHp` / `hp` | Phase 19 漏网 | 改为 `playerSystem.setRole` + `revealRole`（新增 `setRole`：此前 `role` 根本没有写入口）；主公加成那两句**删掉**——它是空转：`maxHp` 此刻还是 0（英雄未分配），写完立刻被下一步 `chooseHeroes(player, [hero], LORD_HP_BONUS)` 整体覆盖 |
| ~D10~ ✅ **2026-09-30 结清** | 19 / 22 | `shouldSkipPhases` 绕过 `PlayerSystem` 直写数组 | Phase 19 漏网 | 实测**五处**（原登记只列三处，漏了 `phase-manager.ts:162 skippedPhases.push` 与 `turn-manager` 的第二处）。新增 `PlayerSystem.setSkipPhases` / `skipPhases` / `markPhaseSkipped`，并在 `ISkillContext` 加 `ctx.skipPhases` 给内容层用。生产调用方：`turn-manager.ts:172,192`、`phase-manager.ts:163`、`delayed-contents.ts:24,35`、`wu-skills.ts:85` |
| ~D11~ ✅ **2026-09-30 结清** | 23 | `die` 事件名在册、**全仓无 emit 点** | 接线缺失 | `EffectContext.settleDying` 在 `handleDeath` 之后 `emit({ name: 'die', source: killer, targets: [player] })`。死亡**结算**留在 `DeathSystem`（那是状态变更），**通知**走事件——奖惩、连环、遗计这类规则从此有地方挂。断言见 `src/__tests__/system/death-event.test.ts` |
| ~D12~ ✅ **2026-09-30 结清** | 23 | `rewardDraw` 记了账、**没人读** | 接线缺失 | 消费方是新增的 `dieContent`（`dying-content.ts`，注册为 `contents/index.ts` 的 `die` 键）：读标记 → 清零 → `ctx.drawCards(n)`。先清零再摸，因为摸牌会发 `gain` 事件，链上任何一环回头看这个标记都不该再看到「还欠三张」。断言同上 |
| D13 | 23 | 主公误杀忠臣 → 弃置所有牌                                                      | 未实现          | `handleReward` 无此分支                                                                                                  |
| D14 | 23 | 濒死 → 有人出桃 → 存活且 `hp = 1` 的用例                                        | 测试欠账         | 验收项仍 `[ ]`；机制走 `settleDying`，尚无断言                                                                                    |
| ~D15~ ✅ **2026-09-30 结清** | 24 | `judge` 之后缺一次「以延时牌 `id` 触发子事件」的接线 | 接线缺失 | `doPhaseJudge` 现在建一条以 `judgeCard.id` 为名的子事件并 dispatch，与「普通牌以卡牌 id 找内容」同一套路，只是发起方换成判定阶段。**两个坑**：① 不能写 `judgeEvent.trigger(...)`——`dispatch` 的 `finally` 已解绑 runner，必须自己「建子事件 + 认父 + 派发」；② 延时牌要先 `moveToProcessing` 离开判定区，否则闪电想把它放到下家判定区时会被 `placeJudgeCard` 的 zone 校验挡下。断言见 `src/__tests__/event/delayed-trick.test.ts`（7 条，全部走真实回合） |
| ~D16~ ✅ **2026-09-30 结清** | 24 | 改判技能（鬼才）没有可挂的时机 | 接线缺失（依赖 D15） | `doPhaseJudge` 现在从**事件**读回 `data.judgeResultCard` 而不是用局部变量，于是 `judgeBegin` 上换掉它就能改判（测试里挂一个 `judgeBegin` 钩子把黑桃换成红桃，乐不思蜀的跳过随之取消）。被顶掉的那张与顶上来的那张都要收尾：前者还在处理区，后者来自**手牌**——必须走 `discardCard` 而不是只改 zone，否则它会留在 `handCards` 里，弃牌阶段再扫一遍就撞上「弃牌堆里的牌不能再弃」 |
| ~D17~ ✅ **2026-09-30 结清（形态甲）** | 25 | 统一的 `WinCondition` | 设计未定 → 已裁决 | 新增 `src/core/system/win-condition.ts`：**纯函数** `evaluate(snapshot) -> { over, kind, winners, winner, reason }`，只吃 `{ players: [{ role, alive }] }`，与牌堆 / 阶段 / 日志无关。`DeathSystem.checkGameOver` 与 `buildResult` 已删除——`DeathSystem` 现在只管死亡结算，入口改到 **`GameEngine.checkGameOver()`**（`game-engine.ts:657`）。**生产调用方**：`game-engine.ts:593,635`（回合后 / 轮次后各查一次）、`game-controller.ts:516`（UI 逐步推进时主动查）。身份一律用引擎标识 Aspect / Guardian / Ascended / Infiltrator，三国杀语汇不进引擎。**9 种终局 + 1 条一致性断言**见 `src/__tests__/system/win-condition.test.ts`（不启动引擎，直接喂快照）。**行为未变**：`system-smoke.test.ts` 两条胜负用例改调新入口后仍绿；平局 / 流局在接口上有 `kind: 'draw' | 'exhausted'` 的位置（本轮不实现其判定） |
| D18 | 25 | 9 种终局场景各一个测试                                                        | 测试欠账         | 现有覆盖仅 `system-smoke.test.ts:176-181` 两条路径                                                                            |
| D19 | 26 | AI 不认识 Mod                                                          | 未实现          | `ai-strategies.ts` 全文无 `modQuery` / `queryNumeric`；`:143` 读 `player.attackLimit`                                     |
| D20 | 26 | AI 不会用 `viewAs`                                                     | 未实现          | 策略层无 `getViews` 调用                                                                                                   |
| D21 | 26 | `ai.order` / `ai.result` / `threaten` / `expose`                    | 未实现          | 身份判断散在 `isAlly` / `shouldHeal`（`ai-strategies.ts:66-88`）                                                             |
| D22 | 26 | 三档难度**从未标定**                                                        | 未实现          | `:329` / `:568` 在位，`createAIStrategy` 于 `:951` 分派；无标定数据                                                              |
| D23 | 26 | 8 人局 AI 对战 100 局无死锁、无异常                                             | 测试欠账         | 验收项仍 `[ ]`                                                                                                           |
| D24 | 27 | `GameBoard` 牌堆 / 弃牌堆计数硬编码 `0`                                       | 未实现          | `GameBoard.vue:11` 与 `:17`                                                                                           |
| D25 | 27 | `CardBack.vue` 未重建                                                  | 未实现          | 全仓无 `CardBack` 引用                                                                                                    |
| D26 | 27 | `ResponseDialog` / `SkillPanel` 数据来源待核                              | 待核           | 本轮未逐条核对                                                                                                              |
| D27 | 27 | `source/theme/lol-mapping.ts` 未建                                    | 未实现          | `src/source/theme/` 不存在                                                                                              |
| **D28** | 19 | `Card.revealTo()` 是**实体上的状态变更方法**，且零调用方                        | 接线缺失         | `src/core/entity/card.ts:218`。Phase 19 的判定标准是「零引用的写入方法一律删」，这条当时没被扫到——旧 grep 模式里没有 `visibleTo`。**本轮只登记，不动手** |
| **D31** | 21 | `TargetSystem.validateTargets` **零调用方** —— 出牌时非法目标不会被拒绝 | 接线缺失 | `src/core/system/target-system.ts:61`；`GameEngine.useCard`（`game-engine.ts:680`）不校验目标。「代码里有」和「跑得到」又是一次两件事：校验函数写得很完整（最少/最多目标数、逐个比对可选列表、带 reason），但没人叫它，于是 Phase 21 验收项「出牌时非法目标被拒绝并给出原因」至今不成立。**只登记，不动手**（属 Phase 21 正题） |
| **D30** | 25 | `DeathSystem.checkAllDead()` **零调用方** | 接线缺失 | `death-system.ts:188`。D17 搬迁时顺带发现：它与胜负判定同住一处，却没有任何生产调用方——「全员死亡」这条兜底分支写在 `GameEngine.runGameLoop`（`aliveCount === 0`）里，自己算的。**只登记，不动手** |
| **D29** | 19 / 22 | 「跳过」这件事有两套账本：`TurnManager.skippedPlayers`（`Set<number>`，按座次记跳过**整回合**的人）与 `player.shouldSkipPhases`（按阶段） | 设计未定 | `turn-manager.ts:35`。`skipTurn` 同时写这两份（`:168` 写 Set、`:172` 写阶段列表），而读完 Set 跳过整回合后（`nextTurn:102,111,122`）那份阶段列表也照样生效——两条路径做的是同一件事。**外在行为看起来正常，但「谁决定跳过」有两个答案**。**只登记，不动手** |

**按性质汇总**（截至 2026-09-30 本轮收尾）：

| 性质          | 条数     | 编号                                              |
| ----------- | ------ | ----------------------------------------------- |
| 接线缺失        | 3      | **D28**, **D30**, **D31**（D3 / D4 / D11 / D12 / D15 / D16 本轮结清） |
| 未实现         | 9      | D7, D13, D19, D20, D21, D22, D24, D25, D27      |
| 测试欠账        | 5      | D1, D2, D14, D18, D23                           |
| 设计未定        | 1      | ~~D8~~ ~~D17~~ 已结清；**D29**                     |
| Phase 19 漏网 | 0      | ~~D9~~ ~~D10~~ 已结清                              |
| 疑似笔误        | 0      | ~~D5~~ ~~D6~~ 已结清                               |
| 待核          | 1      | D26                                             |
| **合计**      | **27** | 原 27 − 已结清 12（D3–D6 / D8–D12 / D15–D17）+ 新登记 4（D28 / D29 / D30 / D31） |

**已结清 12 条**（2026-09-30）：D3、D4、D5、D6、D8、D9、D10、D11、D12、D15、D16、D17。
为此新增 **44 条**断言、7 个测试文件：
`target-system.test.ts` 8、`state-write-guard.test.ts` 4、`delayed-trick.test.ts` 7、
`death-event.test.ts` 3、`target-wiring.test.ts` 4、`card-budget.test.ts` 7、`win-condition.test.ts` 11。
全量用例 **363 → 407**（24 → 31 个文件），无一条被改写或跳过。

### 3.2 Phase 19 那条验收为什么没抓到 D9 / D10（追因）

> 「验收通过了」和「验收有效」是两件事。这次出问题的是后者。

Phase 19 的验收第 1 条是一条 grep 结构护栏：

```
grep -rn "\.hp -=\|\.zone =\|handCards.push\|handCards.splice" src/core   # 在 system/ 外应无结果
```

它当时打勾通过，**而 D9 / D10 全部从它的指缝里漏掉了**。逐条对比：

| #  | 漏掉的写法                                    | 例子                                                              |
| -- | ---------------------------------------- | --------------------------------------------------------------- |
| 1  | **赋值** `=` —— 模式只认 `-=`                  | D9 的 `player.hp = player.maxHp`                                 |
| 2  | **复合赋值** `+=` —— 模式只认 `-=`                | D9 的 `player.maxHp += LORD_HP_BONUS`                            |
| 3  | **自增自减** `++` / `--`                      | 完全不在视野                                                           |
| 4  | **整体替换数组** `x.shouldSkipPhases = [...]`    | D10 的两处；模式只认 `handCards.push` / `.splice` 两种调用                   |
| 5  | **换个字段名就不认**                              | 模式只盯 `handCards`；`equipCards` / `judgeCards` / `shouldSkipPhases` / `skippedPhases` / `heroes` 一概不管 |
| 6  | **数组变更器只认两个**                              | `pop` / `shift` / `unshift` / `reverse` / `sort` / `fill` / `copyWithin` 全是漏网，其中 `sort` / `reverse` 是**原地**改 |
| 7  | **`marks` 的 Map 写入**                      | `.marks.set/delete/clear` 不认 —— 标记是重要账本                         |
| 8  | **卡牌三件套不全**                                | 只认 `zone`，漏了 `owner` / `visibleTo` —— D28（`Card.revealTo`）正是因此到今天才现形 |
| 9  | **扫描范围只到 `src/core`**                     | 内容层 `src/source` 完全没进视野；D10 里 `delayed-contents.ts` / `wu-skills.ts` 两处因此一直没上榜 |

另有一条**假阳性**：`\.zone =` 会把比较 `card.zone === ZoneType.Hand` 认成写入。
既漏又噪，等于这条护栏在自欺。

**补全后的护栏**：`src/__tests__/system/state-write-guard.test.ts`。
它是**一条会跑的测试**（每次 `npm run test` 执行），而不是写在文档里等人手工敲一遍：

- 覆盖上表全部 9 类写法；假阳性已修掉（`===` 不再命中）；
- 扫描范围扩到 `src/core` + `src/source` + `src/services` + `src/hooks` + `src/store` + `src/components`；
- 放行的只有两种：`system/`（那**就是**写入点）与实体构造函数里 `this.x = data.x` 形式的 hydration；
- 用**已知漏网基线**（`BASELINE`）而不是暂时全绿：新增直写会红，修好却忘了删基线也会红——
  两个方向都不会静默过去。这就是 D9 / D10 结清时护栏**先变红**、删掉条目才转绿的原因；
- 另有三条用例盯着**扫描器本身**（九种写法各能命中、`===` 不误报、entity 放行不扩散到其他文件），
  防止这条护栏被人「写窄」后再次失效。

**重跑结果**：结清前 11 处 → 结清后仅剩 1 处（D28，登记不动手）。
顺带查出 D29（跳过这件事有两套并存账本），同样只登记。

---

## 4. Phase 详解

---

### 组 A · 抢救基线

---

## Phase 1 — 契约层与实体层对齐

**目标**：`npm run type-check` 零错误；旧测试全部作废；引擎内核拼音命名清零。

**问题**：`core/contracts/*.interface.ts` 是纯数据接口，`core/entity/*.ts` 实现了大量方法但接口未声明，消费方按接口取类型 → 全量 TS2339。

### 1.0 旧测试作废

- 删除 `src/__tests__/**`（全部）、`e2e/**`、`playwright.config.ts`
- `package.json` 移除 `test:e2e`，新增 `test`（`vitest run`）与 `verify`（`type-check` + `test`）
- 后续每个 Phase 按自己的验收清单补写测试，不留欠账

### 1.1 改动表

| 文件                                     | 改动                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `core/contracts/player.interface.ts`   | 拆为 `PlayerState`（纯数据）+ `IPlayer extends PlayerState`（数据 + 行为）+ `PlayerSnapshot`（序列化输出）。`IPlayer` 补齐 `Player` 类已有的 12 个成员 |
| `core/entity/player.ts`                | `implements IPlayer`；`toJSON(): PlayerSnapshot`                                                                          |
| `core/entity/card.ts`                  | 追加 `export type { CardDefinition }`                                                                                      |
| `core/contracts/game.interface.ts`     | `IGameState` 增加 `readonly alivePlayers: IPlayer[]`、`readonly aliveCount: number`                                         |
| `core/entity/game-state.ts`            | `toJSON()` 输出补齐上述两字段（getter 已存在）                                                                                         |
| `core/contracts/services.interface.ts` | `IStoreService` 增加 `onChange` / `offChange`（`StoreService` 已实现，契约未声明）                                                    |
| `core/contracts/hero.interface.ts`     | `maxPower` / `skins` 改为可选                                                                                                |
| `src/hooks/useSkill.ts`                | 消除非法的 `IHero → Record<string, unknown>` 断言                                                                               |
| `src/views/game/index.vue`             | `ref<GameController>` 改为 `shallowRef<GameController>`（Vue `UnwrapRef` 会剥掉类的私有成员导致类型不匹配）                                  |

### 1.2 拼音命名清零

扫描 `src/core/**` 全部标识符，按 `code-standards.md` §6.1 对照表改为英文语义命名，同步更新全部引用方。

**验收**

- [x] `npm run type-check` exit 0，零错误输出（实测：60+ → 0）
- [x] `Player` 类显式声明 `implements IPlayer` 且编译通过
- [x] `toJSON()` 返回值可被 `JSON.stringify` 序列化且不含 `Map`
- [x] `src/core/**` 无拼音标识符（人工复核 + grep 关键表）
- [x] `src/__tests__` 与 `e2e/` 已删除，`npm run verify` 可运行
- [x] 补写 Phase 1 回归测试：Player / GameState / StoreService（34 个用例全绿）

**实测结果（2026-09-22）**

- `npm run type-check` → exit 0
- `npm run test` → 3 文件 / 34 用例全通过
- `npm run build` → exit 0（仅 chunk 体积告警）

**实际落地与计划的差异**

1. `CardTag` 常量化：`src/core` 内 47 处拼音标签魔法字符串（`'sha'`/`'shan'`/`'fire'` 等）收敛为 `core/contracts/card-tag.ts` 的 `CardTag` 字面量联合类型，`ICard.tags` 由 `Set<string>` 收紧为 `Set<CardTag>`。这是拼音清零的副产物，但顺带消灭了一整类拼写错误。
2. `IGameState` 拆为 `IGameState`（含行为）+ `GameStateSnapshot`（纯数据）：原计划只加两个 getter，实际发现 `Readonly<IGameState>` 作为跨层传输类型语义混乱（UI 拿到的是快照却带着引擎方法签名）。所有只读消费方（AI、distance/target、store、controller）改消费 `GameStateSnapshot`。
3. `GameController` 的辅助函数（`isPlayerWounded` / `getAlivePlayers` / `canPlayerAttack`）没有保留——`IPlayer` 补齐方法后直接调用实例方法即可，包一层只是噪音。

**风险**：`IPlayer` 加方法后，任何把 `IPlayer` 当纯数据用的地方（如 Pinia store 的响应式包装）可能出现类型冲突。若冲突，store 层改用 `PlayerSnapshot`。（本 Phase 未触发：`game-store.ts` 已切到 `GameStateSnapshot`）

---

## Phase 2 — ~~存量模块的契约回归测试~~ → 已跳过

**决定：不做，直接进 Phase 3。**

**理由**：本 Phase 原本要给 10 个存量模块写「现状刻画测试」。但这些模块恰好是 Phase 5（事件内核）与 Phase 10（伤害流水线）要**推翻重写**的对象。给即将被删除的行为写回归测试，唯一作用是证明「改动前后行为一致」——而这里「一致」正是我们不想要的。投入产出比为负。

**替代策略（已采用）**：**测试跟着「可运行路径」走，而不是跟着文件走。**  
只有当某个 Phase 造出了一条能从外部观察到结果的路径时，才在那个 Phase 补测试：

| Phase   | 出现的可运行路径              | 补的测试                                      |
| ------- | --------------------- | ----------------------------------------- |
| 1       | 实体可独立构造               | `player` / `game-state` / `store-service` |
| **3+4** | **技能接进事件流 + 完整对局可跑完** | **`effect-wiring` / `game-loop`**         |
| 5–9     | 事件命名与结算点成型            | 事件流的插入 / 取消 / 轮询                          |
| 10      | 单一伤害流水线               | 伤害各段可拦截                                   |
| 11–17   | Mod / 技能契约            | 扩展能力验收清单（28 条）                            |

**准则**：写能观察**结果**的测试（技能生效了吗、牌守恒了吗），而不是写能观察**实现**的测试（内部方法被调了吗）。前者在重构后依然成立，后者每次重构都要重写。

**验收**

- [x] `package.json` 有 `test` / `verify` 脚本
- [x] 无 `catch {}` 与空 `it('')`
- [x] 测试里不出现拼音标识符（与生产代码同标准）

---

### 组 B · 让引擎活起来

---

## Phase 3 — 建立装配根

**目标**：让技能系统第一次真正接入对局。

**问题**：`EffectRegistry` / `SkillRegistry` 在全项目生产代码中零实例化（只有 `__tests__` 里手工 new 过）；`EventTrigger.handlers` 恒为空数组；`damageSystem.registerHook()` 零调用。

**改动**

| 文件                               | 改动                                                                 |
| -------------------------------- | ------------------------------------------------------------------ |
| 新增 `core/boot/effect-setup.ts`   | 集中装配：`createEffectRegistry()` 注册 `source/base/effects/*` 全部 Effect |
| `core/boot/game-boot.ts`         | 启动时创建 `EffectRegistry`、`EventCompiler`、`SkillRegistry`             |
| `core/boot/game-boot.ts`         | 分配英雄后调用 `skillRegistry.loadAllHeroSkills(players)`                 |
| `core/engine/game-engine.ts`     | 构造函数接收外部注入的 `eventTrigger` / `skillRegistry`，不再内部 `new`            |
| `core/event/event-dispatcher.ts` | 增加 `setDeps(deps)`                                                 |
| `core/engine/game-engine.ts`     | `rebindState()` 中同步调用 `eventDispatcher.setDeps(...)`               |

**验收**（必须走 `GameBoot` 完整路径，禁止测试内手工拼装）

- [x] 启动后断言已注册 handler 数 > 0 → `eventTrigger.count`
- [x] 曹操受到伤害后获得造成伤害的牌（奸雄）
- [x] 张飞回合开始时攻击次数变无限（咆哮）
- [x] 技能只绑定持有者（曹操回合开始不触发张飞咆哮）
- [x] 上述写入 `src/__tests__/engine/effect-wiring.test.ts`
- [x] 关羽用红色牌当【杀】使用成功（武圣）  
  → **2026-09-30 结清**：原文的阻断条件「当前无 viewAs 调用点」已不成立——`viewAs` 有两个生产调用点  
  （`phase-manager.ts:641` 出牌选项、`effect-context.ts:390` 响应征询），武圣已实装  
  （`src/source/heroes/skills/shu-skills.ts:67`，`viewLike(Sha, …)`），单测在  
  `src/__tests__/skill/view-as.test.ts:148`。虚拟牌打出后由 `CardSystem.baseCardsOf`  
  翻译成底牌再移动（`card-system.ts:118`），因此内容分发拿到的是真正的 `sha` 键。  
  **残余**：武圣名下只有视作层断言，没有「打出 → 真的造成伤害」的端到端用例；  
  同路径的端到端覆盖由龙胆用例提供（`view-as.test.ts:246`）。→ 见 §3.1 欠账登记 D1

**实测结果（2026-09-23）**：技能第一次真正生效。`game-loop` 完整 5 人局跑到 100 轮上限、45ms、无异常。

**落地方式与计划的差异**

1. **装配位置在 `GameEngine` 内，不在 `GameBoot`**。计划写的是 GameBoot 创建 Registry 再注入引擎，但 `EventTrigger` 由 `EventDispatcher` 持有、而 Dispatcher 由引擎创建，会出现「先有鸡还是先有蛋」。且 `GameController` 是第二个引擎构造点（它绕过 GameBoot 直接 `new GameEngine`），把装配放外部必然漏掉这一处。最终：`GameEngine` 构造时自建 `EffectRegistry` + `EventCompiler` + `SkillRegistry`，内容由 `GameEngineOptions.effects` 注入（默认 `collectEffects()`）。**任何构造引擎的路径都不可能忘记装配。**
2. **新增 `core/boot/effect-setup.ts`**：唯一的内容装载点，负责把 `source/` 的效果数据交给引擎。引擎核心不 import 具体卡牌/技能包，只认 `IEffect[]`——将来做扩展包只改这一个文件。
3. **卡牌效果的 content 目前仍不会执行**。注册表里放了卡牌 Effect（供后续 viewAs / ContentRegistry 查询），但没有任何调用点会把它们绑到玩家身上。**真正让「每张牌生效」要等 Phase 9 `ContentRegistry`。**

**风险**：装配后大量「因为不生效才通过」的测试会暴露真实缺陷。这是预期内的——实际上是本次最大的收获，见 Phase 4B。

---

## Phase 4 — 单一真值源

**目标**：`GameState` 全生命周期只有一个实例。

**问题**：`init()` 中 `this.state = GameState.create(config)` 替换对象，`rebindState()` 重建 8 个子系统，但 `EventDispatcher.deps` 仍是构造时捕获的旧引用 → `EffectContext` 操作的是被废弃的空 `GameState`。


**改动**

- [x] 新增 `GameState.reset(config)` 原地重置，`init()` 改为调用它
- [x] 删除 `rebindState()`，子系统只在构造函数创建一次
- [x] **不需要 `setDeps()`**：deps 只在构造时绑定一次，而 `state` 再也不会被替换，因此依赖永不过期。少一个 setter 就少一个可以忘记调用的地方。
- [x] `init()` 开头调用 `skillRegistry.clear()`，避免二次 init 残留旧钩子

**验收**

- [x] `grep -n "this.state =" core/engine/game-engine.ts` 无结果
- [x] 测试：`init()` 两次后 `engine.state` 仍是同一引用
- [ ] 测试：连续 `init()` 两次后无幽灵玩家、无重复卡牌  
  → **2026-09-30 复核：仍欠，且 Phase 18 没有顺手补掉它**（不写测试，按欠账登记）。  
  性质上它现在**应当成立**：`GameState.reset` 把 `players` / `deck` / `discardPile` 全部置空  
  （`game-state.ts:107-109`），`init()` 又归零了卡牌与事件的 id 生成器（`game-engine.ts:475-477`），  
  所以「幽灵玩家」与「跨局重号」两条都不该发生。但**没有一条断言在盯着它**——  
  现有的覆盖是间接的：`game-loop.test.ts:69` 只校验单次 boot 无重号，  
  `determinism.test.ts:225` 只校验生成器本身可归零，两者都没做「同一个 engine 连着 `init()` 两次」。  
  → 见 §3.1 欠账登记 D2

---

## Phase 4B — 卡牌实例身份（验证 Phase 3/4 时发现的阻断项）

> 插队执行：不修这个，任何超过一个回合的对局都无法运行，Phase 3/4 的成果也无法验证。

**问题（两个独立缺陷，都表现为「手牌凭空消失 / 卡牌认错主人」）**

| # | 缺陷                                                                                                                                                                           | 位置                                                                                                           |
| - | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1 | **`Card.id` 是定义 id，不是实例 id**。30 张杀的 `id` 全是 `sha`。而所有区域流转都用 `c.id !== card.id` 做身份比较 → 弃掉一张杀，会把手里**所有杀**一起从 `handCards` 抹掉（它们的 `owner` 还在，从此成为幽灵牌）。唯一的 `instanceId` 只在一处被用到。 | `card-system.ts` / `player.ts` / `phase-manager.ts` / `game-controller.ts` / `ai-controller.ts` / 3 个 Vue 组件 |
| 2 | **牌堆配比表按 `def.name`（中文）查表，而表是按 `def.id`（拼音）建的** → 每种牌只造 1 张，牌堆只有 4 张牌                                                                                                        | `deck-manager.ts:64`                                                                                         |

**改动**

- 全部**实例身份**比较从 `c.id` 切到 `c.instanceId`（core 6 处 + services/AI 4 处 + hooks 2 处 + 组件 3 个 + 内容层技能 4 处）
- `moveCard()` 在进入 `Deck` / `Discard` 时清空 `owner`——公共区域无持有者，否则回收弃牌堆后旧 owner 会被带进新主人的手牌
- `doPhaseDraw` / `dealInitialHands` 无条件设置 owner（原来 `if (!card.owner)` 会放过回收牌）
- `STANDARD_DECK_COMPOSITION[def.id]`
- Vue 的 `:key="card.id"` 全部改 `instanceId`（原本会产生重复 key）

**验收**

- [x] `npm run test` 全绿
- [x] `game-loop.test.ts`：对局全程**卡牌总数守恒**（这条不变量能直接抓住本缺陷）
- [x] `game-loop.test.ts`：全场景 `instanceId` 无重复

---

### 组 C · 事件内核 noname 化

---

## Phase 5 — 事件命名体系改造

**目标**：事件名可扩展，不必改枚举就能加新卡牌。

**问题**：`TriggerTiming` 是 17 个成员的枚举，`TriggerStage` 是 7 个字符串字面量联合。新增一张需要新时机的卡牌就必须改枚举并全量回归。

**改动**

```ts
// core/contracts/event-name.ts
/** 单发事件：名字自带完整语义，不加后缀，只在 Content 阶段结算一次 */
export const POINT_EVENT_NAMES = ['gameStart', 'gameOver', /* ... */] as const

/** 可追加阶段后缀的事件主体 */
export const EVENT_SUBJECTS = ['phaseUse', 'useCard', 'damage', /* ... */] as const

/** 阶段后缀（Content 为空后缀=事件本体） */
export const EVENT_STAGE_SUFFIXES = ['Before','Begin','Prepare','','Prevent','End','After'] as const

export type BuiltinEventName =
  | PointEventName
  | `${EventSubject}${EventStageSuffix}`

/** 自定义事件名合法，内置名保留自动补全 */
export type EventName = BuiltinEventName | (string & {})
```

- 新增 `core/contracts/event-name.ts`（`eventNameAtStage` / `matchesEventName` / `isBuiltinEventName`）
- **删除** `TriggerTiming` 枚举（不保留 `@deprecated` —— 全量迁移已完成，留着就是让人继续用）
- **删除** `TriggerEntry`；`ITriggerCondition` 四个字段改为 `EventName[]`
- **删除** `source/base/triggers.ts`（`TRIGGER_TIMING_DEFINITIONS` 全项目零引用，是死代码）
- `CompiledHandler` 的 `timing` + `stage` 合并为 `event: EventName`
- 迁移全部发射点（phase-manager / game-engine / effect-context / game-controller）与内容层声明

**验收**

- [x] `grep -rn "TriggerTiming" src` 零结果（枚举已删除，不是"只剩映射表"）
- [x] 自定义事件名可通过类型检查，且**不改一行引擎代码**就能注册、匹配、触发
- [x] 测试：旧枚举全部 20 个值都有对应事件名，无遗漏（`LEGACY_TIMING_MIGRATION` 化石表，见 `src/__tests__/event/event-name.test.ts`）
- [x] 测试：内容层全部 trigger 声明都是合法事件名（防止旧写法复活）

**实测结果（2026-09-23）**：`npm run verify` 6 文件 / 50 用例全绿，`npm run build-only` exit 0。

**落地方式与计划的差异**

1. **枚举直接删除，不做 deprecated 过渡。** 计划写的是"标记 `@deprecated` + 迁移映射表"，但 20 个旧值的迁移在本 Phase 一次性做完了（脚本批量替换 + type-check 兜底）。保留一个没人再调用的映射表，只会让下一个 Phase 的人以为还有代码在用旧时机。迁移对照关系改为**测试里的化石表** `LEGACY_TIMING_MIGRATION`——它同样能防回归，但不进生产代码。
2. **`Before` 与 `Begin` 没有合并成同一个后缀。** 原计划的 `BuiltinEventName` 清单里只有 `damageBegin`，没有 `damageBefore`。但现有流水线把两者当作不同阶段（【无懈可击】挂在 Before，【闪】挂在 Prevent），合并会让一个技能在一次事件里被触发两次。后缀因此与 7 个阶段**一一对应**，语义零损失。
3. **引入「单发事件」概念。** `turnStart` 这类名字如果走通用后缀规则，会在 7 个阶段各命中一次（一个技能被触发 7 次）。规则是：单发事件不加后缀，且只在 Content 阶段结算。这条约束封装在 `matchesEventName()` 里，各模块不得自己拼字符串。
4. **`Old TriggerTiming` 的 `Damaged` 与 `Damage` 合并为 `damage`。** "造成伤害后" 与 "受到伤害后" 的区别由 `source` / `target` 监听范围表达，不需要两个事件主体——无名杀也是这么做的。
5. **事件对象的中文显示名被移除。** 原先 `new GameEvent({ name: '回合开始' })`，现在 `name` 是事件名（`'turnStart'`）。展示层文案属于 Phase 27 换皮范围，不该由引擎塞在事件对象上。

---

## Phase 6 — `GameEvent` 重写 ✅

**目标**：对齐无名杀的事件对象能力。

**已落地**（`core/event/game-event.ts`）

```ts
export class GameEvent implements IGameEvent {
  // ── 参与者 ──
  player?: IPlayer      // 事件驱动者（未显式传入时继承 source）
  source?: IPlayer      // 实际执行者
  get target()          // ≡ targets[0]，视图不是副本
  targets: IPlayer[]
  get card()            // ≡ cards[0]
  cards: ICard[]
  get num() / set num() // ≡ values.num，数值只有一个真值源
  nature?: DamageType

  // ── 两套状态，互不混用 ──
  status: EventStatus   // 流水线位置（只有调度器改）
  stage: TriggerStage
  finished: boolean     // 内容跑完没有（内容自己改）
  step: number
  cancelled: boolean
  prevented: boolean
  result: EventResult   // { bool?, cards?, targets?, num?, [k: string]: unknown }

  // ── 事件树 ──
  parent?: IGameEvent
  children: IGameEvent[]
  runner?: IEventRunner // 调度期注入，结算后解绑
  get depth()

  // ── 步骤机 ──
  addStep(step: number, handler: EventStepHandler): void
  hasStep(step: number): boolean
  goto(step: number): void          // 跳转，抑制自动前进 → goto(0) 可成环
  next(): Promise<void>             // 执行当前步骤并推进
  runSteps(): Promise<void>         // 迭代驱动，由调度器在 Content 阶段调用
  finish(): void                    // 跳过剩余步骤（End/After 照常）
  cancel(reason?: string): void     // 跳过剩余步骤 + 后续阶段，直接进终态

  // ── 子事件 ──
  trigger(name: EventName, data?: Omit<GameEventInit, 'name'>): Promise<IGameEvent>
}
```

配套落地：

- `core/event/errors.ts`：`EventNestingError` / `EventStepOverflowError` / `EventRunnerMissingError` / `EventTransitionError`，全部继承 `EventError`
- `EventDispatcher implements IEventRunner`：Content 阶段驱动 `runSteps()`；调度期注入 `event.runner`，结算后解绑；`event.stage` 逐阶段更新（此前一直是初始值的 bug）
- 状态机：主链相邻推进 **+** 「任意非终态 → 终态」（无懈可击的前提），非法转移抛 `EventTransitionError`
- `EventChain`：`depth` → `size`，保持纯 LIFO 栈
- `EventPauseManager`：`pause(eventId, reason, timeout)` / `resume(eventId)` / `isPaused(eventId)` / `getPendingEventIds()`，暂停粒度是单个事件
- `canceled` 统一为 `cancelled`（对齐无名杀拼写），`isFinished` → `isTerminal`

**验收**（`src/__tests__/event/game-event.test.ts`，24 例）

- [x] 测试：`goto(0)` 能形成循环且不爆栈，计数到 5 后 `finish()` 退出
- [x] 测试：`cancel()` 后剩余步骤不执行，`finished === true`，且 End / After 阶段不执行
- [x] 测试：`trigger()` 子事件结算完毕后父事件才继续
- [x] 测试：嵌套深度上限，超限抛 `EventNestingError`（`dispatch` 与 `trigger` 两条入口都守）
- [x] 测试：无出口的 `goto` 循环抛 `EventStepOverflowError`
- [x] 测试：`finish()` 跳过剩余步骤但 End / After 照常执行
- [x] 测试：`forced` 事件不可取消
- [x] 测试：调度结束后解绑运行器，未调度事件 `trigger` 抛 `EventRunnerMissingError`
- [x] 测试：暂停粒度到单个事件（暂停 A 不影响 B）

**与计划的三处偏差**（已写入 `code-standards.md` §3.7）

1. **`acted` 去重改为迭代预算**。计划写「配合 `acted` 去重」，但「同一步骤第 N 次执行算不算重复」依赖效果语义，引擎无法替效果判断。改为：`runSteps()` 迭代实现（不爆栈）+ `MAX_STEP_ITERATIONS = 256` 预算，超限抛 `EventStepOverflowError`。效果要循环就得自己给出口。
2. **`finish()` 不终止事件**。计划里 `finish()` 描述为「结束事件」，实际拆成两个语义：`finish()` 只跳过剩余步骤（End/After 照常），`cancel()` 才终止整条流水线。否则「内容提前完成但要有受伤后技能」这类需求无法实现。
3. **`num` 不是新字段**。`EventValues.num` 已经存在，再加一个 `num` 会出现两个真值源；`num` 做成 `values.num` 的读写视图。

**为后续 Phase 留下的接口**（不需要再改内核）

- Phase 9 `ContentRegistry`：卡牌效果编译成 `addStep(n, fn)` 注册即可，步骤机已经能跑
- Phase 10 伤害单轨：伤害改为 `damage` 事件的步骤机内容，删双轨制
- Phase 11–12 Mod：只读 `values` / `result`，不触碰步骤机

---

## Phase 7 — `ContentRegistry` 事件处理器 ✅

**目标**：把卡牌效果从「Effect + TriggerStage」迁到「事件名 → 默认处理器」（对齐无名杀 `lib.element.Content`）。

**已落地**

- `core/event/content-registry.ts`（新）：`Map<EventName, EventContent>`，`register/registerAll/get/has/unregister/names/size/clear`。同名重复注册覆盖并告警（两个扩展包抢同一张牌的信号）。
- `core/event/content-helpers.ts`（新）：`player.damage()/draw(n)/discard(cards)/judge()/recover(n)/gain(cards)/lose(cards)/equip(card)` 等薄封装，供内容层调用，避免每张牌各写一遍样板。
- `source/base/contents/`（新目录，替代 `source/base/effects/`）：
  | 文件                    | 覆盖                                                                |
  | --------------------- | ----------------------------------------------------------------- |
  | `use-card-content.ts` | 用牌总入口：区域流转 → 发 `useCard` 事件 → 以卡牌 id 触发子事件 → 结算入弃牌堆               |
  | `basic-contents.ts`   | 杀 / 闪 / 桃 / 酒                                                     |
  | `trick-contents.ts`   | 决斗 / 顺手牵羊 / 过河拆桥 / 南蛮入侵 / 万箭齐发 / 桃园结义 / 五谷丰登 / 无中生有 / 借刀杀人 / 无懈可击 |
  | `delayed-contents.ts` | 乐不思蜀 / 兵粮寸断 / 闪电                                                  |
  | `equip-contents.ts`   | 武器 / 防具 / 马                                                       |
- 引擎新增 `GameEngine.useCard(player, card, targets)` 作为**唯一用牌入口**，`GameController` 与测试共用同一条路径（此前控制器自己拼事件、自己 finishProcessing，与引擎是两套逻辑）。
- 调度器：Content 阶段**先跑事件自带步骤**，没有步骤时才把 ContentRegistry 的内容挂成 step 0。所以「默认内容」与「调用方自带步骤机」不会互相覆盖。

**关键设计决策**

1. **卡牌内容用卡牌 id 作为事件名**（`'sha'` / `'guoHeChaiQiao'`）。新增一张牌 = 在 `contents/index.ts` 加一个条目，引擎零改动。
2. **Content 与 Trigger 分工**：Content = 这张牌本身做什么（与谁在用无关）；Trigger = 某人在某时机额外做什么（技能）。同一事件两者都会跑。
3. **`CardSystem.equipCard` 放宽区域校验**：此前只允许手牌 → 装备区，但处理区（刚打出、未结算）的装备牌无法装备。现在允许 `Hand | Processing` 且归使用者所有。

**验收**（`src/__tests__/event/content-registry.test.ts`，24 例全绿）

- [x] 【杀】完整流程：指定目标 → 询问闪 → 命中 / 未命中 → 伤害结算；酒杀 +1 且只加成一次
- [x] 【桃】对自己使用回复 1 点
- [x] 【决斗】双方轮流出杀，先不出者扣血
- [x] 【南蛮入侵】【万箭齐发】按座次询问，不出者扣血（杀 / 闪两种响应）
- [x] 【过河拆桥】弃置目标区域一张牌；【顺手牵羊】获得之
- [x] 【无中生有】摸 2 张；【桃园结义】全场各回复 1；【五谷丰登】按座次分牌
- [x] 【借刀杀人】目标不出杀 → 交出武器
- [x] 【无懈可击】抵消指定事件；【闪】作为响应打出抵消父事件
- [x] 【装备】进装备区而非弃牌堆；【延时锦囊】进判定区不立即结算；【乐不思蜀】判定非红桃 → 跳过出牌阶段
- [x] 卡牌行为不依赖持有者 —— 谁用都一样
- [x] 自定义事件名不改引擎即可注册并触发（新增一张牌的成本）

---

## Phase 8 — 结算点与响应征询 ✅

**目标**：把「暂停 + 按座次轮询 + 插入」三要素做成一等公民。

**已落地**

- `core/event/settlement.ts`（新）：`SettlementPoint` 契约 + `SettlementRunner` 轮询循环 + `seatOrderFrom` / `seatDistance` 座次工具。
- `core/event/response-inquiry.ts`（新）：`cardOptions` / `handOptions` 选项构造、`createAsker(ctx)`（把询问接到 `waitForResponse`）、`settle(ctx, point)` 一键开启结算点。
- `core/event/errors.ts`：新增 `EventSettlementOverflowError`（防御性轮数上限）。
- `IEffectContext.settleDying(player, killer?)`（新）：濒死求桃 + 死亡结算。**此前求桃完全没有实现**——hp 打到 0 就那么放着，角色既不死也不被救。
- `DeathSystem.rescue()`（替换原私有 `applyPeach` 与从未被调用的 `askForPeach`）：体力回到 1 并记录救人者。
- `source/base/contents/dying-content.ts`（新）：`dying` 事件的内容就是求桃，因此「他人濒死时」这类技能时机才有落点。
- `source/base/contents/counter-window.ts`（新）：无懈可击窗口，**奇偶定抵消**，`oncePerPlayer: false` 的连环窗口。锦囊牌在 `useCardContent` 里统一开窗口。
- AOE（南蛮 / 万箭）与决斗改为走结算点，不再各自手写 `for` 循环。
- `PriorityManager.sortBySeatDistance`：同优先级按**距事件发起者的座次差**升序，dispatcher 的 `executeHandlers` 已接入。

**关键设计决策**

1. **结算点由内容显式开启**，而不是由 `dispatch` 隐式驱动。与计划里的 `event.currentPoint` 写法不同——见下方「与计划的偏差」。
2. **拿不出牌 ≠ 跳过**。`optionsFor` 返回空数组时不询问，但仍然走 `onUnanswered`。南蛮入侵里「手上没杀」正是要挨伤害的那种人，早期版本因为跳过他们导致 AOE 完全不结算。
3. **座次在窗口开启时快照一次**，中途有人死亡不会让顺序漂移。
4. `acted` 记「已响应者」；`oncePerPlayer`（默认 true）时放弃者同样记入，保证一轮收敛。`false` 用于无懈连环窗口——别人出手后此前放弃的人可以改主意。
5. 轮数上限 `人数 + 3`。由于 `acted` 必然增长，正常轮数 ≤ 人数 + 1，上限是防御性兜底。


**验收**（`src/__tests__/event/settlement.test.ts`，18 例全绿）

- [x] 座次轮询：5 人局从 2 号位起顺序为 `[3,4,0,1]`；`seatDistance` 顺时针环绕
- [x] `acted` 去重：已响应者不会被再问
- [x] 无人响应 → 只轮询一轮，全员计入未响应
- [x] 拿不出牌的人也走 `onUnanswered`
- [x] `stopOnFirstResponse`：求桃一个就够，后面的人不再被问
- [x] `oncePerPlayer: false`：放弃者会在别人出手后被再问一次
- [x] 轮询必然收敛（轮数 ≤ 人数 + 1）
- [x] 【南蛮入侵】从行动者下家起按座次询问，不出杀者扣血
- [x] 濒死求桃：从濒死者自己开始按座次，有人出桃则体力回到 1
- [x] 无人出桃 → 死亡结算（身份公开、手牌进弃牌堆）
- [x] 【决斗】目标出杀后反过来问使用者，先不出者扣血
- [x] 无懈窗口：1 张抵消 / 2 张抵消抵消 / 放弃者被重新询问 / 基本牌不开窗口

**与计划的两处偏差**

1. **`dispatch` 没有重写**。计划里写的是 `while (!event.finished) { await event.next(); ... }`，让调度器驱动结算点。实际落地是**内容在需要时显式开启结算点**（`settle(ctx, point)`）——这更接近无名杀真实做法（`event.chooseToRespond` 由内容调用），也避免把「什么时候该问谁」这个纯规则问题塞进调度器。三要素（暂停 / 座次 / 插入）一样不缺。
2. **`ISettlementPoint.getResponders(state)` 改为无参 `responders()`**。结算点由内容构造，闭包里已经拿到了 ctx，再传 state 是重复。

---

## Phase 9 — 无懈可击链式抵消 ✅

**目标**：完整实现「后发先至」。

**已落地**

- `core/event/cancel-chain.ts`（新）：`openCancelChain()` / `canBeCountered()` / `registerCancelGuard()` / `isGameEventLike()`，以及 `COUNTER_TARGET_KEY` 等常量。
- 契约层 `IGameEvent` + `GameEventInit` 新增 `cancelable`（是否开窗口）与 `cancelDepth`（抵消链层级）。
- `GameEvent.trigger()` 修正：**尊重显式传入的 `player`**（原来一律继承父事件）。打出无懈的是响应者，不是被响应事件的发起者——这条决定了「从谁的下家开始轮询」。
- `GameEngine.useCard()` 建事件时按卡牌标签打 `cancelable`；`useCardContent` 再据此开一层窗口。
- `useCardContent` 把 `counterTarget` / `counterLabel` 传给它触发的卡牌事件——丢了的话无懈就找不到该抵消谁。
- `wuXieKeJiContent` 改为先过 `canBeCountered()` 再 `cancel()`：不带目标是空操作，目标不可抵消也是空操作。
- `counter-window.ts` 瘦身为驱动入口（真正的机制进了 `core/event/`）。
- 测试脚手架新增 `scriptNth(player, snippet, nth, card)`：同一个玩家在抵消链里会被问好几次，而各层提示文案都含「无懈可击」，只有按**询问序号**编排才能写「第一层放弃、第二层出牌」这种剧本。

**关键设计决策**

1. **每张无懈都是一条真正的 `useCard` 事件**，不是给原事件记个数。它压进 LIFO 栈后立刻完整结算，所以层级天然正确——最后打出的最先结算，抵消它上面那张。
2. **只问一层，不写递归**。更深的层由那张无懈自己的 `useCard` 内容再调一次 `openCancelChain` 打开。事件嵌套代替了手写递归，**栈就是链**。
3. **一层只接受一张无懈**（`stopOnFirstResponse: true`）。有人出手，问询就上移一层：新问题是「是否抵消刚才那张无懈」，从**那张无懈的使用者**的下家重新绕一圈。这正是官方规则。此前放弃的人会在新一层被再问到——「后发先至」的反制机会就在那儿。
4. `cancelable` 只表示「这类事件会征询无懈」；此刻能否真被抵消由 `canBeCountered()` 四道关判定：结构性标记 → `forced` → 已终态 → 卡牌 `canBeCanceled` + 守卫。
5. **`registerCancelGuard` 是 `mod.cardCancelable` 的落点**（验收清单 #13）。Phase 11 的 `ModRegistry` 注册一个守卫即可，无需改动本文件——这是提前埋好的接线点，不是待补的债。

**验收**（`src/__tests__/event/cancel-chain.test.ts`，14 例全绿）

- [x] C 出无懈 → D 出无懈：**D 的先生效**，C 被抵消，锦囊正常结算
- [x] 三张无懈连锁 → 锦囊被抵消，无人受伤
- [x] 抵消链由真事件组成：`cancelDepth` 逐层 `[1,2,3]`，链上的牌全部进弃牌堆
- [x] `canBeCanceled = false` → 窗口压根不开
- [x] `registerCancelGuard` 能否决抵消（`mod.cardCancelable` 接线点）
- [x] 已终态的事件不能再被抵消
- [x] 无懈可击本身不能被无懈可击以外的牌响应（指定出杀不被接受；手上只有杀闪的人根本不被问）
- [x] 主动打出的无懈可击是空操作；无懈不能抵消基本牌
- [x] 上一层放弃的人会在下一层被再问到并反制

**与计划的两处偏差**

1. **抵消目标用 `data.counterTarget` 显式传递**，而不是计划里写的「`target.cancel()` 其父事件的父事件」。事件树里「父事件的父事件」随嵌套结构漂移（一层抵消其实消耗两层嵌套：`useCard` + 卡牌事件），显式传引用才不会指错人。
2. **链的形状由事件嵌套表达，不另外维护栈深度计数**。`cancelDepth` 只是**观测用**的层级编号（写进 `result.counters` 供调试与扩展包读取），真正决定语义的是「谁取消了谁」这条引用链。这比计划里「按栈深度奇偶判定」更直白：奇偶只是结果，不是机制。

---

## Phase 10 — 伤害流水线统一 ✅

**目标**：伤害只有一条流水线，顺序正确。

**问题**

1. `DamageSystem` 自建 `DamageStage` 六段流水线，与 `TriggerStage` 平行互不相通
2. `EffectContext.damageTarget` 先 `executePipeline()`（血已扣完）再 `dispatch()` 事件 → 防止伤害类技能永远无效

**改动**

- 删除 `core/system/damage-system.ts`（连同 `DamageStage` / `DamageInstance` / `DamageHook` / `registerHook`）
- 新增 `core/system/damage-resolver.ts`：`DamageResolver` 全是静态方法，只做「算数值」与「扣血」，不持有状态与钩子
- 伤害改为纯事件，走标准七阶段流水线：

| 事件             | 能做什么                           | 例        |
| -------------- | ------------------------------ | -------- |
| `damageBefore` | 转移目标、取消伤害、写 `extraDamage`      | 天香、闪     |
| `damageBegin`  | 数值定稿前的最后一次拦截                   | —        |
| `damageSource` | 伤害来源相关技能（单发子事件）                | 烈弓       |
| `damage`       | Content：步骤机（定稿 → 来源 → 扣血 → 濒死） | —        |
| `damageEnd`    | 受伤后触发                          | 反馈、刚烈、奸雄 |
| `damageAfter`  | 完全结算后                          | 追伤       |

- 新增 `source/base/contents/damage-content.ts`，步骤机四步（常量 `DAMAGE_STEPS`）：  
  `Resolve(1)` 数值定稿 → `Source(2)` 发 `damageSource` 子事件 → `Apply(3)` 唯一扣血点 → `Dying(4)` 发 `dying` 子事件求桃
- 「防止伤害」统一表达为在 `damageBefore` / `damageBegin` 阶段 `event.cancel()`  
  ——cancel 跳过 Content 之后的所有阶段，因此 `damageEnd` / `damageAfter` 不会被误触发
- 【闪】由「置 `parent.prevented`」改为 `parent.cancel('闪')`

**与计划的两处偏差**

1. `damageSource` 做成了**单发子事件**（加入 `POINT_EVENT_NAMES`）而不是阶段名——  
   `damage` + 后缀推导不出它，而它确实「一次伤害只发一次」。
2. 伤害点数只有一个真值源 `event.values.num`（进来是基础值，出去是最终值）；  
   `baseDamage` 只作事后回溯用，不参与计算。原计划没提这个取舍，  
   但 `DamageInstance.currentAmount` 与 `event.num` 双真值源正是旧病根。

**验收**（`src/__tests__/event/damage-pipeline.test.ts`，14 例）

- [x] 目标出【闪】→ 杀事件 `cancelled === true` → 体力不变
- [x] 藤甲 + 火杀 → 伤害 +1：落点已就绪（`damageBefore` 写 `extraDamage`），具体 Mod 走 Phase 11；  
  本阶段用「`extraDamage += 2` → 伤害变 3」与「负增量下限 0」两条用例验证了通道
- [x] 伤害转移技能生效后，受伤方是转移目标（`damageBefore` 改写 `event.targets`）
- [x] 伤害扣减后触发 `damageEnd`，奸雄能拿到牌（`effect-wiring` 既有用例保持绿）
- [x] `DamageResolver` 上没有 `registerHook` / `clearHooks` / `executePipeline`（用例断言）
- [x] 分段顺序：扣血发生在 `damageSource` 之后、`damageEnd` 之前

---

### 组 D · 技能与扩展系统（核心）

---

## Phase 11 — `ModRegistry` 数值修改器 ✅

**目标**：让「所有杀伤害 +1」这类效果有安放之处。这是本计划新增的核心。

> 无名杀对应：`skill.mod`。这是它能支撑上千武将的关键——把「数值怎么算」从「流程怎么走」里剥离出来。

**新增文件**

- `core/skill/mod-registry.ts`
- `core/contracts/mod.interface.ts`

**接口设计**

```ts
/**
 * 修改器上下文：只读快照，Mod 函数不得修改任何状态
 */
export interface ModContext {
  /** 被计算数值的归属玩家 */
  player: IPlayer
  /** 游戏状态（只读） */
  game: IGameState
  /** 当前事件（若有） */
  event?: GameEvent
  /** 扩展负载，由调用方注入 */
  payload?: Record<string, unknown>
}

export interface DamageModPayload {
  source?: IPlayer
  target: IPlayer
  card?: ICard
  nature: DamageType
}

/** 数值型修改器：累加语义，按 (priority, seatOrder) 顺序依次应用 */
export interface INumericMods {
  /** 我造成的伤害 */
  damageFrom?(value: number, ctx: ModContext, p: DamageModPayload): number
  /** 我受到的伤害 */
  damageTo?(value: number, ctx: ModContext, p: DamageModPayload): number
  /** 任意角色造成的伤害（全局） */
  globalDamageFrom?(value: number, ctx: ModContext, p: DamageModPayload): number
  /** 任意角色受到的伤害（全局） */
  globalDamageTo?(value: number, ctx: ModContext, p: DamageModPayload): number
  /** 攻击范围 */
  attackRange?(value: number, ctx: ModContext): number
  /** 手牌上限 */
  maxHandcard?(value: number, ctx: ModContext): number
  /** 体力上限 */
  maxHp?(value: number, ctx: ModContext): number
  /** 我计算到他人的距离 */
  distanceFrom?(value: number, ctx: ModContext, to: IPlayer): number
  /** 他人计算到我的距离 */
  distanceTo?(value: number, ctx: ModContext, from: IPlayer): number
  /** 摸牌阶段的摸牌数 */
  drawCount?(value: number, ctx: ModContext): number
  /** 某张牌本回合可使用次数（返回 Infinity 表示无限） */
  cardUsable?(value: number, ctx: ModContext, card: ICard): number
  /** 一张牌能选择的目标数 */
  selectTarget?(value: number, ctx: ModContext, card: ICard): number
}

/** 布尔型修改器：否决语义，任一返回 false 即 false */
export interface IBooleanMods {
  cardEnabled?(card: ICard, ctx: ModContext): boolean
  cardRespondable?(card: ICard, ctx: ModContext): boolean
  cardSavable?(card: ICard, ctx: ModContext): boolean
  cardDiscardable?(card: ICard, ctx: ModContext): boolean
  cardCancelable?(card: ICard, ctx: ModContext): boolean
  targetEnabled?(card: ICard, ctx: ModContext, target: IPlayer): boolean
  targetInRange?(card: ICard, ctx: ModContext, target: IPlayer): boolean
  skillEnabled?(skillId: string, ctx: ModContext): boolean
  phaseSkippable?(phase: GamePhase, ctx: ModContext): boolean
}

export interface IModDefinition {
  id: string
  /** 修改数值型还是布尔型 */
  mods: INumericMods & IBooleanMods
  /** 优先级，同优先级按座次（距当前玩家的顺时针距离）排序 */
  priority?: number
  /** 生效条件（不满足则该 mod 本次不参与计算） */
  filter?: (ctx: ModContext) => boolean
}

export interface IModRegistry {
  register(def: IModDefinition): void
  unregister(id: string): void
  /** 查询数值：base 依次经过所有匹配 mod */
  queryNumeric<K extends keyof INumericMods>(
    key: K, base: number, ctx: ModContext, ...args: unknown[]
  ): number
  /** 查询布尔：任一 mod 返回 false 则 false */
  queryBoolean<K extends keyof IBooleanMods>(
    key: K, base: boolean, ctx: ModContext, ...args: unknown[]
  ): boolean
}
```

**关键设计约束**

1. **Mod 必须是纯函数**：只读 `ctx`，不改状态、不发事件、不询问玩家。违反则在 dev 模式下对 `ctx.game` 做浅冻结并抛错。
2. **Mod 随持有者自动失效**：`ModRegistry` 只遍历「持有该 mod 且存活」的玩家。玩家死亡 / 失去技能 / 卸下装备时无需手动清理。
3. **Mod 不可被无懈可击**：这是规则要求（锁定技类效果不可响应），也让 Mod 的实现不需要处理取消逻辑。
4. **调用顺序确定性**：`priority` 降序 → 同优先级按座次升序 → 同座次按 `mod.id` 字典序。禁止依赖注册顺序。

**改动**

- 新增上述两个文件
- `GameBoot` 装配时注册 `source/base/mods/*`
- 用 Mod 重写现有实现：藤甲（`damageTo`）、诸葛连弩（`cardUsable`）、-1 马（`distanceFrom`）、+1 马（`distanceTo`）、武器（`attackRange`）

**验收**（对应清单 #1–#9）

- [x] 注册 `globalDamageFrom: v => v + 1` → 全场任意【杀】伤害 +1
- [x] 注册 `damageFrom` 且持有者为 A → 只有 A 的伤害 +1，B 的不变
- [x] 藤甲 + 火杀 → +1；藤甲 + 普通杀 → 不变
- [x] -1 马 / +1 马的距离修正双向生效
- [x] 诸葛连弩 → `cardUsable` 返回 `Infinity`，一回合无限出杀
- [x] 测试：两个 `+1` mod 同时存在 → 结果为 `base + 2`（叠加正确）
- [x] 测试：持有者死亡后其 mod 自动不再生效
- [x] 测试：Mod 内修改 `ctx.game` 时抛错（纯函数校验）

### 实现记录（2026-09-24）

**结论：164 用例全绿 / type-check 0 错 / build 通过 / lint 27（净减 1，新增文件 0 告警）**

**落地文件**

| 文件                                | 作用                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `core/contracts/mod.interface.ts` | `ModContext` / `INumericMods` / `IBooleanMods` / `IModDefinition` / `ModPurityError` |
| `core/skill/mod-registry.ts`      | 注册 / 注销 / `queryNumeric` / `queryBoolean`，纯函数校验                                      |
| `core/skill/mod-query.ts`         | 面向调用方的语义化查询口（`damage` / `attackRange` / `drawCount` …），同时实现 `DistanceMods` 回调        |
| `core/skill/index.ts`             | skill 模块导出                                                                           |
| `source/base/mods/equip-mods.ts`  | 藤甲、诸葛连弩、±1 马、武器范围 —— 全部装备 Mod                                                        |
| `source/base/mods/index.ts`       | `collectMods()`                                                                      |

**接线点**：`GameEngine` 持有 `modRegistry` / `modQuery` 并注入 `EffectContextDeps`；`PhaseManager` 的摸牌数、手牌上限、出牌次数；`TargetSystem` 的目标数上限与距离；`game-controller` 的合法目标计算；`registerCancelGuard` 接上 `mod.cardCancelable`（清单 #13 的落点）。

**与计划的偏差（3 处）**

1. **Mod 的归属用 `owners()` 回调，不是「持有者字段」。** 计划里写的是「`ModRegistry` 只遍历持有该 mod 且存活的玩家」，但装备类 Mod 的持有者会随装备装卸变化，写死字段就得在每次装卸时同步。改成 `owners: () => IPlayer[]` 惰性求值——装备一卸，下一次查询自然查不到，零清理代码（有测试覆盖）。
2. **`IModDefinition` 不区分 numeric / boolean 两个注册表。** 计划里 `INumericMods & IBooleanMods` 是交叉类型，一个 `mods` 对象可同时提供两者；`queryNumeric` / `queryBoolean` 只是取不同的 key。实测这比拆两个注册表更顺手（一个「藤甲」Mod 既要 `damageTo` 又要 `cardEnabled`）。
3. **`distance` / `inRange` 不收 `event`。** `DistanceSystem` 的回调链没有事件上下文可传，硬留参数会让人误以为距离改写能读到当前事件。需要按事件区分的距离规则走 `selectTarget`。

**顺手修掉的真 bug**

`TargetSystem.getTargetsForDelayedCard` 里有一行 `c.name === (source as never)`——**拿卡牌名去和玩家对象比**，而且算出来的 `hasSameDelayed` 从未使用，函数无条件 `return true`。也就是说「判定区已有【乐不思蜀】的人还能再吃一张」这条禁令从来没生效过。改为传入 `card` 并真正按同名过滤。

**下一步**：Phase 12 布尔否决器与全系统接线（`IBooleanMods` 的其余 7 个 key 目前只有 `cardCancelable` 接了线）。


## Phase 12B — 代码整理与最小化系统功能测试 ✅

**为什么插在这里**：Phase 1–12 已经把引擎的主干全部打通——事件栈、七阶段流水线、Content/Trigger/Mod 三层、伤害、结算点、目标、回合。Phase 13 往后是 `ISkill` 契约与技能系统，属于**在已有主干上长新枝**，不是补地基。继续往上堆之前，主干必须先清干净。

**目标**：清掉重构过程中留下的死代码、过时注释、重复实现；然后用**一局真实对局**证明主干功能完好。

**改动**

1. **死代码与未用标识符** —— lint 报出来的全部清理（未使用的变量 / 参数 / 导入，按约定改名 `_xxx` 或直接删）。
2. **过时注释** —— 特指那些描述「即将做什么」的（"Phase 8 会替换这里"、"此后由 xxx 接管"）。这些话在当时是提醒，在现在是**假情报**。
3. **重复实现** —— 测试脚手架被抄了两份（`content-registry.test.ts` 里那一套），统一到 `src/__tests__/helpers/game-env.ts`。
4. **最小化系统功能测试** —— 不走 mock，走真实 `GameBoot`：
   - 起一局标准 5 人局，跑若干回合，断言「不崩、能收敛、状态自洽」
   - 逐条验证主干能力：摸牌 → 出牌 → 响应 → 伤害 → 濒死 → 死亡 → 胜负
   - 断言确定性：同一 seed 跑两遍，结果一致

**结果** ✅

- [x] lint 0 error（oxlint 28 → 0，eslint 8 → 0）
- [x] `type-check` 0 / `test` 196 全绿 / `build` 通过
- [x] 最小化系统功能测试 14 例（`src/__tests__/engine/system-smoke.test.ts`）
- [x] 主干里不再有指向未来的假情报注释

**清理掉的东西**

| 类型               | 例子                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 未使用的变量 / 参数 / 导入 | `useSkill` 两个死 computed、`ai-controller.getActiveEffects`（永远返回 `[]`，它的 `if (effect)` 分支是死路）、`useCardPlay` 的 `shallowRef` / `ICard` / `store`                  |
| 永远为真 / 永远为空的分支   | `equip-effects` 里恒返回 `null` 的 `viewAs`（等于没挂）、`game-boot` 里 `reduce((sum, def) => sum + 1, 0)`（就是 `.length`）                                                  |
| 过时注释             | `trick-contents`「完整实现在 Phase 8」、`settlement`/`response-inquiry`「Phase 9 之后技能可作响应」、`event.interface`「Phase 9 的 ContentRegistry」、`standard.ts`「技能实现位于 Phase 8」 |
| 重复实现             | `content-registry.test.ts` 抄了一整套测试替身（且漏实现接口）；`game-loop.test.ts` 抄了 logger / seeded random —— 统一收进 `helpers/game-env.ts`                                     |
| 真 bug            | `GameBoard.vue` 里 `props.players.sort()` —— `sort` 原地改数组，等于改父组件数据                                                                                            |
| `any`            | `ai-strategies` 两处 `as any` 收成一个 `aiValueOf()`（仍是断言，但只此一处，且写明了为什么）                                                                                           |

**测试工程这条线顺手补的**（都是上面「类型检查没覆盖测试文件」带出来的）

- `tsconfig.vitest.json` 的 `include` 改成递归；`tsconfig.app.json` 的 `exclude` 同理
- `ScriptedDecisionService` 补齐 `IUIDecisionService` 全部方法，新增 `outCard()`（队列语义，多次调用按顺序生效）
- 测试工程关闭 `noUncheckedIndexedAccess`

**下一步**：Phase 13 —— `ISkill` 新契约。

---

## Phase 13 — `ISkill` 新契约 ✅

**目标**：对齐无名杀的技能定义结构。

**改动**（`core/contracts/skill.interface.ts`）

```ts
export interface ISkill {
  // ── 基础 ──
  id: string
  name: string
  description: string

  // ── 分类属性 ──
  /** 主动技：在哪些上下文可手动发动 */
  enable?: SkillEnableContext[]
  /** 锁定技：满足条件强制发动，不可拒绝 */
  locked?: boolean
  /** 强制技：不可拒绝但有提示 */
  forced?: boolean
  /** 限定技：整局一次 */
  limited?: boolean
  /** 觉醒技 */
  awaken?: boolean
  /** 装备技：随装备获得/失去 */
  equipSkill?: boolean
  /** 转换技：阴阳两态 */
  convertible?: boolean | ((player: IPlayer, state: number) => void)
  /** 隐藏技：不在武将牌显示 */
  charlotte?: boolean

  // ── 触发 ──
  trigger?: {
    player?: EventName[]    // event.player === 持有者
    source?: EventName[]    // event.source === 持有者
    target?: EventName[]    // 持有者在 event.targets 中
    global?: EventName[]    // 任意角色
  }

  // ── 筛选与消耗 ──
  /** 能否发动（必要条件，全部通过） */
  filter?(ctx: ISkillContext): boolean
  /** 充分条件（任一通过即可）—— 对应无名杀 filter2 */
  filter2?(ctx: ISkillContext): boolean
  /** 发动代价：选牌 / 选目标 / 弃牌 */
  cost?(ctx: ISkillContext): Promise<void>
  /** AI 是否应该发动 */
  check?(ctx: ISkillContext): boolean

  // ── 执行 ──
  content(ctx: ISkillContext): Promise<void>

  // ── 频率 ──
  frequency?: 'once' | 'oncePerTurn' | 'oncePerRound' | 'oncePerPhase' | 'unlimited'
  /** 手动发动的次数上限（每阶段/每回合） */
  usable?: number | ((ctx: ISkillContext) => number)

  // ── 视作 ──
  viewAs?(card: ICard, ctx: ISkillContext): Partial<ICard> | null
  /** 哪些牌可被视作 */
  filterCard?(card: ICard, ctx: ISkillContext): boolean
  /** 选牌来源区域：h 手牌 / e 装备 / j 判定 */
  position?: ('h' | 'e' | 'j')[]
  /** 需选牌数 */
  selectCard?: number | [number, number]

  // ── 修改器 ──
  mod?: INumericMods & IBooleanMods

  // ── 标记 ──
  mark?: boolean
  marktext?: string
  intro?: { name: string; content: (n: number, p: IPlayer) => string }

  // ── 组合 ──
  group?: string[]
  subSkill?: Record<string, Partial<ISkill>>

  // ── AI ──
  ai?: {
    order: number
    result?: {
      player?(p: IPlayer): number
      target?(p: IPlayer, t: IPlayer): number
    }
    threaten?: number
    expose?: number
  }

  // ── 表现 ──
  popup?: boolean
  silent?: boolean
  /** 同类技能中优先结算 */
  firstDo?: boolean
  priority?: number
}
```

- `IEffect` 标记 `@deprecated`，退化为 `ISkill` 的**别名**（不再是并列接口）
- 迁移 `source/heroes/skills/{wei,shu,wu}-skills.ts` 到新契约
- 顺带迁移 `source/base/effects/equip-effects.ts`（否则两套契约会长期并存）

**验收**

- [x] 全部现有技能用新契约重写并通过原有测试
- [x] 类型层面：`mod` 字段与 `ModRegistry` 的 `IModDefinition.mods` 类型一致
- [x] `trigger` 迁移后事件名映射无遗漏（对照 Phase 5 映射表）

### 实现记录（2026-09-24）

**1. 为什么是「别名」而不是「子接口」或「转换函数」**

先试过让 `IEffect extends ISkill`（保留旧字段）。走到一半发现行不通：  
新契约的 `selectCard`（需选牌数）与旧契约的 `selectCard`（选择器工厂）  
**同名不同义**，接口继承直接冲突。改别名后问题消失——因为那时  
所有技能都已迁完，旧字段一个都不剩了。

| 做法                        | 代价                                 |
| ------------------------- | ---------------------------------- |
| `IEffect extends ISkill`  | 同名异义字段冲突（`selectCard`），必须为兼容而扭曲新契约 |
| `type IEffect = ISkill` ✅ | 要求先迁完；之后零成本                        |
| `toSkill(effect): ISkill` | 引擎每一步都要记得先转换，漏一处就是运行期 bug          |

**2. 布尔矩阵取代单值枚举**

旧 `type: SkillType` 只能二选一，表达不了「锁定技 + 限定技」。  
现在每个分类是一个独立布尔位（`locked` / `forced` / `limited` /  
`awaken` / `equipSkill` / `charlotte`），互不排斥。

**3. 接线的三处新代码**

| 文件                             | 作用                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `core/skill/skill-utils.ts`    | 归一化读取（`isLockedSkill` / `skillFrequency` / `skillPriority` / `isManualSkill` / `aiValueOf` / `expandSubSkills`） |
| `core/skill/skill-mods.ts`     | 把 `ISkill.mod` 装进 `ModRegistry`；持有者每次现算                                                                         |
| `core/event/event-compiler.ts` | 执行顺序改为 `filter → filter2 → frequency → usable → cost → content → 记账`                                            |

**4. 迁移过程中挖出来的五个真问题**（都已在本次修掉）

| 问题                   | 症状                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `oncePerTurn` 从未复位   | `usedThisTurn` 写了却没人清零 → 「每回合一次」实际等价于「整局一次」。补了 `EventTrigger.resetFrequency('turn'/'phase'/'round')` 并在 `PhaseManager` / `GameEngine` 的边界上调用                                         |
| 咆哮从未生效               | 它在 `turnStart` 上写 `player.attackLimit = Infinity`，而 `PhaseManager.getPlayableCards` 查的是 `modQuery.cardUsable`。改成 `mod.cardUsable`                                                    |
| 克己从未生效               | 挂在 `phaseDiscardBefore` 上，而 `executeTurn` 是在**分发阶段事件之前**就检查 `shouldSkipPhases` 的——等事件发出来，跳过与否早已定完。改挂 `phaseUseEnd`，并把判据从无人写入的 `usedShaThisTurn` 换成真正被维护的 `player.usedAttackThisTurn` |
| 连弩 / ±1 马各写了两份       | `equip-effects.ts` 里一份（死），`mods/equip-mods.ts` 里一份（活）。统一：**通用**的（任何武器范围、任何藤甲易伤）留 `equip-mods.ts`；**属于单张牌**的写到该牌自己的 `mod` 上                                                           |
| 技能里的 `Math.random()` | 反馈 / 鬼才 / 制衡 / 突袭 曾用随机取牌，违反确定性要求。改成固定的「取第一张 / 按座次」                                                                                                                                   |

**5. 数值改动归属的新分界线**

```
会改数值吗？
├─ 任何带这个特征的东西都会 → source/base/mods/equip-mods.ts
├─ 只有这一张牌会         → 该牌技能自己的 mod（effects/equip-effects.ts）
└─ 不会改数值，是时机反应 → 该牌技能的 trigger + content
```

**结果** ✅

- `test` **214 / 214**（新增 `src/__tests__/skill/skill-contract.test.ts` 18 例）
- `type-check` 0 / `oxlint` 0 / `eslint` 0 / `build` 通过
- 主干里 `IEffect` 的实例数为 0，只剩一个别名

**下一步**：Phase 14 —— `SkillRegistry` 挂载 / 卸载 / 临时技能。  
届时可以删掉 `GameEngine.registerSkillMods` 里那句临时的  
「英雄写着它 / 装备带着它」推断，换成真正的技能台账。

---

## Phase 14 — `SkillRegistry` 挂载 / 卸载 / 临时技能 ✅

**目标**：技能可动态增删。

### 实现记录（2026-09-24）

**1. 台账之前，「谁拥有哪个技能」有三套互相矛盾的推断**

| 机制  | 推断方式                       | 后果                                 |
| --- | -------------------------- | ---------------------------------- |
| 触发器 | 只认 `hero.effectIds`        | **装备的触发技从没被挂上过**（青釭剑、八卦阵、仁王盾全是死代码） |
| Mod | 现算「英雄写着它 / 装备带着它」          | 数值生效、触发不生效，同一张装备半身不遂               |
| 觉醒技 | `enableEffect()` 返回 `true` | 什么也没做，纯装饰                          |

`ctx.modifyEffects` 同样只往玩家身上写了一个没人读的 mark。

现在三者归一到 `core/skill/skill-registry.ts` 的一张台账，三种来源各有退场方式：

| 来源          | 谁挂上                | 谁摘掉                      |
| ----------- | ------------------ | ------------------------ |
| `permanent` | 英雄 / 觉醒 / `attach` | 只有显式 `detach`            |
| `equip`     | 装备区出现这张牌           | 牌离开装备区                   |
| `temp`      | `addTempSkill`     | 到期事件 / `removeTempSkill` |

**2. 三处「不靠记得调用」的接线**

| 位置         | 做法                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| 装备装卸       | 通知挂在 `CardSystem.moveCard` 上（进出 `Equip` 区都喊），而不是挂在 `equipCard` / `unequipCard` 两个入口——**拆装备、牵走装备走的是另一条路径**，只在入口喊会静默漏掉 |
| 临时技能到期     | 到期条件编译成一条**真正的事件钩子**（优先级 `-1000`，恒最后跑），于是 `{event:'damageEnd'}` 这种精确到期无需引擎配合；也保证了「技能先在本事件上生效，然后才被摘掉」                 |
| 新登记的 `mod` | `SkillRegistry.onRegister` 回调把 `mod` 补进 `ModRegistry`，于是「开局后才登记的技能」与开局时就有的走同一条路（否则会变成「触发有效、数值无效」的半身不遂）               |

**3. 死者的技能不摘，改用放行闸**

`skillGate` 里加一句 `!player.alive → false`。摘钩子容易，**复活时记得挂回去难**——  
而「记着」正是这一类 bug 的唯一成因。Mod 那边本来就有「持有者死亡自动失效」。

**4. 顺手修掉的三件事**

| 问题                       | 症状                                                                      |
| ------------------------ | ----------------------------------------------------------------------- |
| `ctx.modifyEffects` 是空操作 | 只写 `_pendingAddEffects` 这类 mark，无人读取 → 觉醒技纯装饰。改为真正调 `attach` / `detach` |
| 纯 Mod 技能不进台账             | 旧代码只在「编译出钩子」时才记账，于是咆哮这类只有 `mod` 的技能在台账里是缺失的                             |
| 卸钩子按 id 过滤               | 到期钩子的 `skillId` 是合成的，按 id 撤会把它漏在 `EventTrigger` 里变成幽灵钩子。改为按**对象身份**撤    |


**5. 补了一个 `roundEnd` 事件**

「持续到轮次结束」这一档持续期原本永远等不到自己的到期点——引擎只发 `roundStart`。  
在 `runGameLoop` 的轮次结束分支补发。

**结果** ✅

- `test` **233 / 233**（新增 `src/__tests__/skill/skill-registry.test.ts` 19 例）
- `type-check` 0 / `oxlint` 0 / `eslint` 0 / `build` 通过
- 删掉 `core/engine/skill-registry.ts` 与 `core/engine/effect-registry.ts`（两份注册表合成一份）

**下一步**：Phase 15 —— 技能属性矩阵（`locked` / `limited` / `awaken` / `convertible` / `frequency` 真正落地）。

**改动**（`core/skill/skill-registry.ts`，替换原 `core/engine/skill-registry.ts`）

```ts
export interface ISkillRegistry {
  register(def: ISkill): void
  /** 挂载到玩家（触发技 / mod 才开始生效） */
  attach(player: IPlayer, skillId: string): void
  detach(player: IPlayer, skillId: string): void
  /** 临时技能：到期自动 detach */
  addTempSkill(player: IPlayer, skillId: string, until: TempSkillDuration): void
  removeTempSkill(player: IPlayer, skillId: string): void
  /** 觉醒技：永久获得 */
  awakenSkill(player: IPlayer, skillId: string): void
  /** 玩家当前持有的全部技能（含临时） */
  getSkills(player: IPlayer): ISkill[]
  hasSkill(player: IPlayer, skillId: string): boolean
}

export type TempSkillDuration =
  | 'turnEnd' | 'roundEnd' | 'phaseUseEnd'
  | { event: EventName; scope: 'player' | 'global' }
```

- 删除原 `enableEffect` / `disableEffect` 空桩（违反规范第 5.6 条）—— 已删，两个文件整个删掉
- 临时技能到期由**事件钩子**驱动，不需要「在回合/轮次边界统一清理」这一趟扫描

**验收**（对应清单 #22 #23）— `src/__tests__/skill/skill-registry.test.ts`，19 例

- [x] `attach` 后该玩家的 `mod` 立即参与计算
- [x] `detach` 后立即不再参与
- [x] `addTempSkill(id, 'turnEnd')` → 回合结束时自动移除
- [x] `addTempSkill(id, {event:'damageEnd', scope:'player'})` → 该事件触发后移除（且**先生效再摘**）
- [x] 装备技：装备时自动 `attach`，卸下时自动 `detach`（含「被拆掉」这条 `moveCard` 路径）
- [x] 无 `return true` 空桩：用例直接断言 `enableEffect` / `disableEffect` 已从实例上消失

---

## Phase 15 — 技能属性矩阵 ✅

**目标**：`locked` / `forced` / `limited` / `awaken` / `convertible` / `frequency` 全部落地。

> 字段一律英文语义命名。原计划里的 `zhuanhuanji` 是拼音，违反  
> code-standards.md §6.1，改名 `convertible`；对应方法  
> `changeZhuanhuanji()` → `flipConvertState()`。

**改动**

- `ISkillRuntimeState`：每个「玩家 × 技能」一份，挂在台账的挂载记录上
- 频率检查前置到 `EventTrigger.getMatchingHandlers`：额度用完的钩子压根不被收集
- 回合 / 轮次 / 阶段边界统一清零，入口收敛到 `SkillRegistry.resetFrequency`
- `convertible`：态记在 `ISkillRuntimeState.convertState`，`flipConvertState()` 翻转
- `awaken`：`ctx.awakenSkill(target, id)` 永久挂载 + 打 `awakened` 标记
- `mark`：`addMark` / `countMark` / `clearMark`，`markClear` 声明清零时机

**验收**（对应清单 #18–#21 #24 #25）— `src/__tests__/skill/skill-attributes.test.ts`，17 例

- [x] 限定技一局只能发动一次，第二次 `isAvailable === false`
- [x] `frequency: 'oncePerTurn'` → 第二回合可再次发动
- [x] 锁定技强制发动（AI 不会拒绝，UI 不弹确认）
- [x] 觉醒技满足条件后 `hasSkill(newSkill) === true`，且不可回退
- [x] 转换技状态可翻转，两态的 `mod` / `content` 不同
- [x] 标记：`addMark(2)` → `countMark() === 2`，回合结束按需清零

**下一步**：Phase 16 —— `viewAs` 视作系统。（已完成，见下）

---

## Phase 16 — `viewAs` 视作系统

**目标**：支持「红色牌当杀」「杀当闪」等转化。

**改动**

- 新增 `core/skill/view-as.ts`
- `GetAvailableCardViews(player, context)`：遍历玩家所有 `viewAs` 技能 + 手牌，产出可虚拟使用的卡牌视图
- 虚拟卡：`Card.createVirtual(baseCard, overrides)`，`virtual = true`，使用后销毁
- `filterCard` + `position` + `selectCard` 约束选牌范围
- 响应征询时，虚拟牌必须计入可选牌（这是【龙胆】能响应【杀】的前提）

**验收**（对应清单 #14 #15）

- [x] 关羽：红色手牌可作为【杀】使用
- [x] 赵云：手牌中的【杀】可作为【闪】打出
- [x] 虚拟牌使用后进入弃牌堆，原牌被消耗
- [x] 响应征询的可选牌列表中包含虚拟牌
- [x] 测试：无 `viewAs` 时虚拟牌列表为空

### 实现记录（2026-09-28）

**结果**：`test` 268/268（新增 18 例）· `type-check` 0 · `oxlint` 0 · `eslint` 0 · `build` 通过

新增 `src/core/skill/view-as.ts`（`ViewAsService`）。契约侧加了  
`IViewAsContext` / `ICardView` / `CardViewQuery` / `IViewAsService`，  
`ICard` 加了 `viewedFrom`（虚拟牌指向底牌的实例 id）。

#### 四个「写了也没生效」的坑，各有一条用例盯着

1. **只覆盖 `tags` 不覆盖 `id` → 打出去什么也不发生**。内容分发按  
   `card.id` 找 `useCardContent`，一张「名字像杀、id 还是底牌」的虚拟牌  
   查不到任何内容。修法是内容层一律用 `viewLike(Sha, {...})` 而不是手写字面量——  
   id / type / tags / effectIds 照抄定义，规则判定看到的就是【杀】本身。
2. **响应窗口看不到虚拟牌** → 龙胆的杀当闪根本打不出去。  
   修法是 `ISkillContext.cardViews()` 进杀的响应候选、濒死求桃、  
   无懈窗口三处（三处都是「只有真手牌才进候选」的老写法）。
3. **出杀额度被视作绕过**：额度若按底牌 id 记账，每张红牌自带一次  
   「出杀」额度，「每回合一张杀」在武圣面前整体失效。  
   `cardUsageKey()` 按 `CardTag.Strike` 记账，虚拟杀与真杀共用同一个键。
4. **虚拟牌被当成实体**：塞进任何区域数组，牌堆就不守恒了。  
   翻译放在 `CardSystem` 的三个移动入口（`useCard` / `discardCard` /  
   `finishProcessing`）——出牌、响应、结算走的都是这几个出口，  
   内容层因此完全不需要知道「虚拟牌」这件事。

#### 两个设计决定

- **虚拟牌的 `instanceId` 是推导出来的**（`virtual:<skillId>:<底牌id...>`），  
  不是自增发号。交给发号器的话，出牌阶段每刷新一次候选列表同一条视作就换一个  
  id——UI 的选中项、测试编排好的应答、日志那一行全对不上号。
- **双面视作由 `ctx.usage` 分流**。龙胆的【杀】既是「可以打出去的杀」  
  也是「被杀时当闪的原料」，两面同时摆出来就会在出牌阶段冒出「闪」、  
  在响应窗口冒出「杀」——两条都是错的。`IViewAsContext.usage` 就是为此存在。

**下一步**：Phase 17 —— `group` / `subSkill` / 全局钩子 / `when()`。

---

## Phase 17 — `group` / `subSkill` / 全局钩子 / `when()`

**目标**：支持技能组合与一次性监听。

**改动**

- `group`：持有主技能等价于持有组内全部技能，`attach` 时递归挂载
- `subSkill`：子技能 id 为 `<主技能>_<子技能>`，不随主技能自动挂载，需显式调用
- 新增 `core/event/global-hook.ts`（对应无名杀 `game.globalEventHandlers`）
- 新增 `when()` 构造器（对应无名杀 `player.when()`）

```ts
player.when('drawEnd')
  .filter(e => e.player === player)
  .once()
  .then(async ctx => { await ctx.drawCards(1) })
  .finish()
```

**验收**（对应清单 #26 #27 #28）

- [x] `group: ['a','b']` → 挂载主技能后 a、b 均生效
- [x] 子技能可通过 `addTempSkill` 单独挂载
- [x] `globalHook.on('useCard', fn)` → 任意角色出牌均触发
- [x] `when(...).once()` → 触发一次后自动注销
- [x] 全局钩子可 `off()` 注销

### 实现记录（2026-09-28）

**结果**：`test` 296/296（新增 28 例）· `type-check` 0 · `oxlint` 0 · `eslint` 0 · `build` 通过

新增 `core/event/global-hook.ts`（`GlobalHookRegistry`）与 `core/event/when.ts`  
（`WhenBuilder`）。两者都编译成一条 `CompiledHandler` 挂进**技能钩子所在的同一个  
`EventTrigger`**——同样的阶段后缀、同样的优先级排序、同样的 `EffectContext`。  
引擎因此不需要为「监听」再开一条路，这是这一阶段最重要的一句决定。

#### 三个「写了也没生效」的坑，各有一条用例盯着

1. **没有持有者就没有 `ctx.player`**。`EventDispatcher.createContext` 按  
   `handler.playerId` 找人，找不到就**整条 handler 跳过**。全局钩子没有持有者，  
   playerId 该写谁？写谁都会变成「只有那个人出牌才触发」。  
   解法是 `CompiledHandler.ownerless`：上下文玩家改从**事件本身**取  
   （`event.player ?? event.source`），同时跳过技能放行闸。
2. **`expandSubSkills` 返回的是「子」而不是「父 + 子」**。  
   于是「有子技能的父技能」自己的 `mod` / `trigger` 从来没被登记过——  
   父技能被它的子技能吃掉了。现在返回 `[父, ...子]`。
3. **子技能的 Mod 被登记两遍**：`SkillRegistry.register` 摊平后逐条  
   `onRegister`，而 `registerSkillMods` 自己又展开一次，同 id 登记两回。  
   展开只留一处（台账），Mod 装配不再重复展开。

#### 两个设计决定

- **`group` 是派生挂载**，不是「给每个人各挂一份」。  
  台账记 `groupOwner`，于是主技能被摘时组内跟着走，而装备区对齐  
  （它只看装备区里有没有这张牌）不会单独摘掉组内那份——  
  否则「英雄自带主技能 + 恰好穿着同名牌」时组内技能会神秘消失。
- **`SkillRegistry.clear()` 不再调 `eventTrigger.clear()`**。  
  后者会把不属于台账的钩子一起抹掉：全局钩子与一次性监听挂在同一个  
  触发器上，重开一局不该连它们一起清。改成逐条 `detachEntry` 撤。

**下一步**：Phase 18 —— 确定性随机与回放。

---

### 组 E · 地基

---

## Phase 18 — 确定性随机与回放

**改动**

- 新增 `SeededRandomService`（mulberry32），`IRandomService` 改为**必填**
- 删除 `fisherYatesShuffle` 的 `Math.random()` 回退分支
- 全局清除引擎内 `Math.random()` 与影响状态的 `Date.now()`
- 容器遍历要么显式排序，要么依赖规格承诺的顺序（`Map` / 数组的插入序），  
  不依赖 `Set` / `Object.keys` 顺序
- 重新设计 `ReplayEngine`：记录「种子 + 决策序列」，回放时重放决策

**验收**

- [x] 同种子 + 同决策 → 8 人 AI 对局录一遍放一遍，事件流水逐条相同
- [x] `grep -rn "Math.random" src/core` 无结果（`src/core` 里只剩两处 `Date.now`：  
  日志服务的墙上时间与「摇一颗新种子」的兜底，两者都不进状态）
- [x] 回放：载入种子与决策日志，重演出相同结果（事件流水 / 终局 / 胜者 / 轮次）

**实现记录**

| 项                          | 落点                                                     |
| -------------------------- | ------------------------------------------------------ |
| 确定性随机源（mulberry32，状态可快照）   | `core/services/seeded-random.ts`                       |
| 逻辑时钟（事件 / 结算的时间一律取刻度，不取挂钟） | `core/utils/clock.ts`                                  |
| 卡牌实例号每局归零                  | `Card.resetIdGenerator()` ← `GameEngine.init()`        |
| `IRandomService` 升为必填      | `GameEngineOptions` / `DeckManager` / `GameController` |
| 录像 = 种子 + 决策序列             | `core/replay/replay-engine.ts`                         |
| 决策录制 / 重放（含指纹校验）           | `core/replay/decision-recorder.ts`                     |
| 事件流水（挂在 Phase 17 的全局钩子上）   | `core/replay/event-trail.ts`                           |
| 定式自动玩家（跑回归用，不思考所以快）        | `core/replay/auto-decision.ts`                         |

**四个真问题**

1. **卡牌实例号跨局自增** —— `Card._idGenerator` 是模块级单例，第二局的牌接着  
   上一局的尾巴编号。于是同一颗种子也复现不出同一局：局面完全一样，  
   可每张牌的 `instanceId` 都不一样，回放比对在第一张牌上就全线飘红。  
   修法：`init()` 里 `Card.resetIdGenerator()`；`game-clock` 同理归零。
2. **AI 与牌堆共用一条随机流** —— AI 的「拟人思考延迟」与「几张牌差不多好时  
   随机挑一张」都吃随机数。回放时没有 AI 参与，两边消耗次数不同会让洗牌序列  
   整体错位。修法：AI 用**自己**那条流（`AIController` 注入，缺省按种子派生），  
   同时把 `ai-strategies` 里两处裸 `Math.random()` 换成注入的随机源。
3. **「回放跑完了」曾经是个假信号** —— 篡改**应答**（而不是请求）不会触发指纹  
   校验：引擎照样一圈圈问下去，只是每步得到不同答案，最后照样「跑完了」，  
   放出来的却是另一局。修法：录像没走完即视为发散（`ReplayDivergenceError`）。
4. **为了「显式排序」而排序，会抹掉顺序里的语义** —— 给  
   `SkillRegistry.getSkills` 加按 id 字母排序后，`main` 掉到 `a` / `b` 之后，  
   Phase 17 的「持有主技能 = 持有全组」断言直接挂了。台账是 `Map`，  
   插入序本就是规格承诺的确定性顺序，排序纯属画蛇添足。  
   判据：排序是为了消除不确定性，不是为了让顺序好看；**顺序有语义时不要排**。  
   残留的 `Set` 遍历只剩 `syncEquipSkills` 的 `desired`，已就地排序。

---

## Phase 19 — 状态变更收口

**目标**：所有状态变更经由 `system/*`。

**新增** `core/system/player-system.ts`（负责 hp / maxHp / power / marks）

**已知违规点**

| 位置                                        | 违规                                  |
| ----------------------------------------- | ----------------------------------- |
| `DamageSystem.applyDamage`                | `target.hp -=`                      |
| `EffectContext.recoverHp` / `modifyMaxHp` | 直接调用 Player 方法                      |
| `EffectContext.drawCards`                 | 直接 `card.zone =` + `handCards.push` |
| `GameEngine.dealInitialHands`             | 同上                                  |
| `PhaseManager.doPhaseDraw`                | 同上                                  |
| `PhaseManager.doPhaseDiscard`             | 直接 splice                           |
| `PhaseManager.doPhaseJudge`               | 直接改 `card.zone`                     |

**验收**

- [x] `grep -rn "\.hp -=\|\.zone =\|handCards.push\|handCards.splice" src/core` 在 `system/` 外无结果
- [x] 摸牌后牌堆计数、手牌计数、卡牌 zone 三者一致
- [x] 弃牌后卡牌进入弃牌堆且 owner 清空

**落地情况**

三张表全部收口：

| 原写入点                                            | 去向                                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Player` 17 个变更方法                               | 数值/标记/回合 → `PlayerSystem`；卡牌区域 → `CardSystem`（**换名收编**：`addHandCards`→`obtainCard`、`addJudgeCard`→`placeJudgeCard`、`unEquipSlot`→`unequipCard`） |
| `Card.moveTo` / `moveToPlayer` / `createInZone` | 删除（零引用，且是 `CardSystem.moveCard` 的第二套实现，可见性规则还不一样）                                                                                               |
| `DeckManager.discard` / `discardOne`            | 删除（零引用，且只改 `zone` + push 弃牌堆，既不清 `owner` 也不摘手牌数组）                                                                                               |

`Player` 现在**没有任何变更方法**，只剩数据与只读派生（`handSize` / `isDying` / `attackRange` / `canAttack` / `getEquipInSlot` / `getMark`）。  
`IPlayer` 接口同步收窄——接口层不再承诺写入能力，类型系统就成了第一道护栏。

**四个真问题**

1. **夹取规则各写各的。** `recoverHp` 知道不能超过上限，濒死救活那句 `hp = 1` 不知道——  
   它只是碰巧在 hp ≤ 0 时才被调用。「碰巧成立」是最难守住的不变量。  
   现在 `resurrect` 是独立方法：它是「设为」而非「回复」，因为溢出伤害能把 hp 打到负数，  
   此时 `recoverHp(1)` 救不回来。
2. **「非正数」这道防线只写在一条路上。** 原来 `DamageResolver.applyDamage` 挡着  
   `amount <= 0`，回血那条路没人管——`recoverHp(-2)` 会返回 -2，日志写出「回复了 -2 点」。  
   现在防线收进写入点本身，扣血/回血/耗能量三条路同规则。
3. **「有第二条路」比「第二条路写错了」更危险。** `Player` 上那 10 个方法生产代码里  
   **一个都没人调用**，只在测试里被用。它们是 `CardSystem` 的重复实现，绕过  
   `zone` / `owner` / `visibleTo` 同步与装备变动通知——  
   「存在一条能改装备区却不会挂装备技的路」本身就是隐患，用不用都会诱导后来者。  
   判定标准改成：**零引用的写入方法一律删，不留「以后可能用得上」。**
4. **删完之后要有个东西记住「不许再加回来」。** 于是 `player-system.test.ts` 末尾有一组  
   结构护栏：断言 `Player` 上不存在这 18 个方法、断言 `PlayerSystem` 上没有卡牌区域写入。  
   它们不测行为，测的是「没有别的路可走」——删掉其中一行，就等于宣布那条路重新开放，  
   那应该是一个需要有人拍板的决定，而不是顺手一加。

**一处刻意的例外**

`DeckManager.draw()` 仍会写 `card.zone = Hand`。它是「两步式」交接：牌堆只负责把牌摘出来  
（并标上下一步该进手牌），交到谁手里由 `CardSystem.obtainCards()` 完成——  
摸牌数与「摸给谁」在引擎里由不同层决定。这是个陷阱：漏掉第二步不报错，牌只是从此消失。  
因此契约写在 `draw()` 的文档注释里，三个调用点紧挨着写，  
并由 `card-system.test.ts` 的「开局发牌后全场三处账目一致」做全表兜底。

**验收对应测试**：`src/__tests__/system/player-system.test.ts`（30 例，含结构护栏）、  
`src/__tests__/system/card-system.test.ts`（11 例，验收第 2、3 条）。

---

## Phase 20 — 日志与可观测性

- 结构化事件日志（事件名 / 参与者 / 数值 / 时间戳）
- 新增 `debug` 级别：打印每次 Mod 查询的 base → result 链路
- 新增 `EventTrace`：记录事件嵌套树

**验收**

- [x] 一局结束后可导出完整事件树 JSON
- [x] Mod 调试日志能看清每个修改器的贡献
- [x] 日志不影响确定性（时间戳不进游戏状态）

**实现**

- `src/core/debug/event-trace.ts` —— 事件嵌套树。`EventDispatcher` 多出三个回调  
  （进流水线 / 换阶段 / 离流水线），按 `parent` 组装成树，节点带事件名、参与者、  
  卡牌、数值、阶段序列、终态与逻辑刻度；可 `toJSON()` 导出、`render()` 出文本。
- `src/core/debug/mod-trace.ts` —— Mod 查询的 `base → 每个修改器 → result` 链路，  
  未参与的也留痕并写明原因（`owner-dead` / `filtered-out` / `short-circuited`）。
- `GameEngine.setObservability({ trace, mods })` 总开关。**默认全关**。
- 日志底板：`LogEntry.timestamp`（墙钟）→ `tick`（逻辑刻度）。`GameState.addLog`  
  自己盖章，调用方**传不进时间**。墙钟改由呈现层 `logStore` 补。

**两个真问题**

1. **「观测不影响确定性」这条验收，是被它自己的验收测试打破的。**  
   开着观测跑两遍，导出的事件树对不上——不是因为观测改了行为，而是  
   **事件 id 生成器从来没被归零过**。Phase 18 修了 `Card._idGenerator`，  
   漏了 `GameEvent` 的：后者连 `resetIdGenerator()` 都写好了，就是没人调用。  
   于是「录的是 event_1…、放的是 event_546…」，而事件树导出里带着 id。  
   补进 `GameEngine.init()` 的归零清单。

   教训不是「记得归零」，是：**任何会被写进可比对外延的自增量，都得在  
   归零清单里**。清单本身要比散落各处的 `resetXxx()` 更容易被找到，  
   所以放在 `init()` 的同一段注释下，而不是各自的文件里。
2. **观测端必须是彻底的旁观者。** `EventTrace` / `ModTrace` 的所有回调  
   在引擎侧一律吞错——「因为树记不下去导致整局崩了」是任何引擎都承受不起的  
   失败模式。同理，记录时只读 `gameClock.now`，绝不调用 `next()`：  
   观测把逻辑时钟往前拨一格，后面所有事件的时间戳就整体错位一格。

**关着的观测必须与不存在等价**：所以「开关」不是「记完之后丢弃」，  
而是从一开始就不往下走——`candidates()` 的跳过原因回调用回调传出而不是返回  
两组数组，因为绝大多数调用方（关着的全部分）根本不要这份信息。

---

### 组 F · 规则补全

> **本组已按代码实况重写（2026-09-30）。**  
> 组 F（Phase 21–27）的「现状 / 问题」列写于组 C/D 完成**之前**，是一份过期快照。


> 现按 `src/` 里的实际实现逐条核对完毕，结论见下表——**10 条里有 4 条被证伪**  
> （原文说没做，实际已经做了）。下面的各 Phase 正文已按实测结论改写，  
> 验收条目一条没删，仍然是可用的检查表。

#### 原文断言 → 实测结论 → 证据

| #  | 原文断言（待核实）                                     | 实测结论                                                                                                                              | 证据                                                                                                                                                                                                              |
| -- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `TargetSystem` 在引擎中被 `new` 但从未调用              | **成立**。而且那个实例本身毫无意义——`TargetSystem` 的方法**全是 `static`**，实例上没有任何东西可调。真正的选目标走 `PhaseManager.getValidTargetsForCard`，是一份同名但不算距离的第二套实现 | `new`：`game-engine.ts:218`；全仓仅测试调过 `TargetSystem.getAvailableTargets`（`__tests__/skill/boolean-mods.test.ts:243,253,267`）；真正在跑的分支：`phase-manager.ts:374,552`                                                    |
| 2  | `getValidTargetsForCard` 中「简化处理，不计算距离」的注释必须消除 | **成立**。注释仍在，行为也确实如注释所说——【杀】直接返回全部其他存活角色                                                                                           | `phase-manager.ts:564`                                                                                                                                                                                          |
| 3  | `shouldSkipPhases` 存在但未被消费                    | **证伪**（已消费）。`executeTurn` 在每个阶段前检查它，且做得比原计划更细：多一道 `mod.phaseSkippable` 否决——标记为不可跳过的阶段即使带着跳过标记也照常执行                                | `phase-manager.ts:158-164`；另有 `turn-manager.ts:202 isSkipped()`                                                                                                                                                 |
| 4  | `usedAttackThisTurn` 被设置但从未检查                 | **部分证伪**。它被三处读到；真正不再依赖它的是「每回合杀的上限」——那部分确实已经走 `mod.cardUsable`（原计划目标达成）                                                            | 写点：`player-system.ts:230`。读点：`player.ts:121`（`canAttack`）、`wu-skills.ts:80`（技能 filter）、`ai-strategies.ts:144`。额度：`phase-manager.ts:618-624`                                                                     |
| 5  | 主公固定 0 号位「❌ 身份整体 shuffle」                     | **成立**。含主公在内整体 shuffle，而先手取「第一个存活玩家」→ 主公未必先手                                                                                      | `game-engine.ts:801`；`turn-manager.ts:60`                                                                                                                                                                       |
| 6  | `phaseXxxBegin` / `phaseXxxEnd`「部分」发出         | **基本证伪**。6 个阶段各发一条事件，流水线走满 7 个阶段后缀，Begin / End 是**派生**出来的，因此全量可用。但有例外：被跳过的阶段整个 `continue` 掉了，连 Begin / End 都不发——这是设计的后果，不是遗漏      | 事件派发：`phase-manager.ts:202-205`；命名派生：`contracts/event-name.ts:83-94,154`；6 个 phase 主体在 `EVENT_SUBJECTS` 里一一对应。实测：Phase 20 事件树里每条事件 `stages` 均为 `["Before","Begin","Prepare","Content","Prevent","End","After"]` |
| 7  | 濒死求桃「按座次轮询」列为待做                               | **证伪**（已实现）。伤害 → `dying` 子事件 → `settleDying` 从濒死者自己开始按座次问一圈                                                                       | `damage-content.ts:126-142` → `dying-content.ts:24-33` → `effect-context.ts:162` 的 `seatOrderFrom(players, player, true)`                                                                                       |
| 8  | 死亡结算三项（亮身份 / 弃置所有牌 / 触发死亡技能）                  | **部分**。前两项已完成；**「触发死亡技能」没有落点**——`die` 进了事件名清单，但全仓没有任何地方发出它                                                                        | 亮身份 / 弃牌：`death-system.ts:112-143`（走 `PlayerSystem` 与 `CardSystem`）。`die` 仅出现在 `contracts/event-name.ts:68` 与 `__tests__/event/event-name.test.ts:101`，**无 emit 点**                                             |
| 9  | 乐不思蜀 / 兵粮寸断 / 闪电「真正生效」                        | **成立**（确实仍未生效）。三份内容与注册都在，**但没有任何事件会走到它们**：判定阶段只发名为 `judge` 的事件，而内容表里压根没有 `judge` 这个键；延时牌进判定区后就 `return`，不会像普通锦囊那样触发 `card.id` 子事件 | 内容：`delayed-contents.ts:18-56`，注册：`contents/index.ts:66-68`；判定阶段：`phase-manager.ts:273-288`；延时牌提前返回：`use-card-content.ts:50-54`（对比同一函数末尾非延时牌走 `card.id`）                                                        |
| 10 | Phase 21 / 23 的「依赖」列是否仍成立                     | **21 依赖 12,19：仍成立**。22：部分成立——依赖 8 的部分已由已完成的 Phase 8 提供（`settle()` 结算基础设施正在服役）；对 Phase 23 剩余缺口而言，与 22 无实际依赖                        | 依赖 8 的实际用例：`effect-context.ts:166`                                                                                                                                                                              |

#### 核对中新发现的四处（原文未列）

| 项               | 实况                                                                                                                       | 影响                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `rewardDraw` 标记 | **写了没人读**：`death-system.ts:167` 赋值 3，全仓无读取方                                                                              | Phase 23 验收「反贼死亡 → 击杀者摸 3 张」卡在这里——奖惩目前是个记账动作，不是发牌动作          |
| `Heal` 条件重复     | `target-system.ts:152` 与 `phase-manager.ts:570` 各自写着 `tags.has(CardTag.Heal) && tags.has(CardTag.Heal)`（同一条件写了两遍，疑为复制粘贴） | 行为等价（`A && A` ≡ `A`），但 `&&` 本该是另一个标签——**很可能是漏写而不是冗余**，待原作者确认 |
| 延时锦囊内容          | 内容在、注册在，**触发方不在**                                                                                                        | 见 #9；是本轮最贵的一处「接线缺失」                                          |
| Phase 19 收口漏网   | `assignRoles` 直写 `maxHp`/`hp`（`game-engine.ts:811-812`）、`delayed-contents` 直写 `shouldSkipPhases`（`:24,:35`）              | 未走 `PlayerSystem`。前者随后被 `chooseHeroes` 覆盖，故暂不发作；后者是真实绕过      |

---

## Phase 21 — 距离与目标合法性

**现状（2026-09-30 实测）**

| 项              | 实测                                                                                |
| -------------- | --------------------------------------------------------------------------------- |
| 距离计算           | ⚠️ `DistanceSystem` 与 `TargetSystem` 都实现了、`DistanceSystem` 在用，但**出牌选目标这条路完全没碰距离** |
| `TargetSystem` | ❌ **零生产调用方**——全仓没有任何非测试代码叫它。且它的方法全是 `static`，引擎里那个实例连被调用的可能都没有                    |
| 「简化处理」注释       | ❌ 仍在原位，且仍在准确描述现状                                                                  |

三条峡谷：

1. `game-engine.ts:218` `new TargetSystem()` —— 建了不用。`TargetSystem.getAvailableTargets`  
   至今只有测试在调（`boolean-mods.test.ts`）。
2. 真正在跑的是 `PhaseManager.getValidTargetsForCard`（`phase-manager.ts:552`）→  
   `resolveTargetsForCard`（`:561`），一份**同名却不看距离**的第二套实现：  
   【杀】那一支直接 `return aliveOthers`。  
   `phase-manager.ts:564` 那句「简化处理，不计算距离」不是在自嘲，是实情。
3. 两处的 Mod 否决已经接好了（`targetEnabled` / `targetInRange`），  
   所以欠的是**距离这一层**，不是否决那一层。

> 注意 `TargetSystem.computeAvailableTargets` 已经把规则写全了——按标签分牌型、  
> 该看距离的看距离、六个 `getTargetsForXxx` 各有归处。**它是成品，只是没人叫它。**  
> 所以本 Phase 的正确姿势是「让 `PhaseManager` 改用它」，不是重写一遍。

- 出牌/响应统一走 `TargetSystem`（取消静态实例，或让 `PhaseManager` 直接调静态方法）
- `getValidTargetsForCard` 中「简化处理，不计算距离」的注释必须消除——  
  连同它描述的那个 `return aliveOthers` 一起

**验收**

- [x] 无武器时攻击范围 1，装备武器后按武器范围 —— **2026-09-30 达成**（D4）。断言见 `src/__tests__/system/target-wiring.test.ts`：「座次距离 2 的人默认打不到」+「装上青釭剑（范围 2）后就能打到」
- [ ] -1 马 / +1 马影响可选目标
- [ ] 出牌时非法目标被拒绝并给出原因

---

## Phase 22 — 回合与阶段

**现状（2026-09-30 实测）**

| 项           | 原文写的                             | 实测                                                                                                                            |
| ----------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 主公固定 0 号位先手 | ❌ 身份整体 shuffle                   | **成立**。`assignRoles` 把主公也一起洗了；先手取「第一个存活玩家」，于是主公未必先手                                                                           |
| 每回合杀的上限     | ⚠️ `usedAttackThisTurn` 被设置但从未检查 | **原文后半句已证伪，目标已达成**。出牌额度走 `mod.cardUsable` + 局部 `usedThisTurn` 记账；反过来 `usedAttackThisTurn` 本身**有人读**（`canAttack`、技能 filter、AI） |
| 跳过阶段        | ⚠️ `shouldSkipPhases` 存在但未被消费    | **证伪**。已消费，且做得比原计划更细：`mod.phaseSkippable` 给了「这个阶段不许被跳过」一道否决                                                                   |
| 阶段事件        | 部分                               | **基本证伪**。6 个阶段各发一条事件走满流水线，Begin / End 是**派生**名，全量可用。例外：被跳过的阶段整个 `continue` 掉了，连 Begin / End 都不发                               |

**真还欠的**

- 主公 0 号位仍未做（原文这条是对的）
- `usedAttackThisTurn` 与 `mod.cardUsable` **两套额度并存**：一个喂 UI / AI / 技能 filter，  
  一个管出牌选项。它们对「还剩几次杀」的回答可以不一致——同一次 `markAttackUsed`  
  既会被计入 `canAttack`，也会被计入局部 `usedThisTurn`，但目前**没有任何总线确保两者同步**  
  （例如连弩：`cardUsable` 返回无限，而 `attackLimit` 仍是 1 → `canAttack` 说不能再攻了）
- 跳过阶段的名分：`shouldSkipPhases` 的写入方有三处绕过 `PlayerSystem` 直写数组  
  （`delayed-contents.ts:24,35`、`wu-skills.ts:85`、`turn-manager.ts:170,189`）

| 项         | 目标                                |
| --------- | --------------------------------- |
| 主公固定 0 号位 | 主公固定 0 号，其余身份 shuffle             |
| 杀的上限      | 两套额度归一，只留 `mod.cardUsable` 一个答案来源 |
| 跳过阶段      | 写入统一走 `PlayerSystem`              |
| 阶段事件      | 维持现状；若需「跳过也要发 Begin/End」，另行决议     |

**验收**：每条至少一个集成测试。

---

## Phase 23 — 濒死、死亡与奖惩

**现状（2026-09-30 实测）**

| 项               | 实测                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------- |
| 濒死求桃（按座次轮询）     | ✅ **已完成**。`damage` → `dying` 子事件 → `settleDying`，从濒死者自己开始问一圈，`stopOnFirstResponse` 收到第一个桃即关窗 |
| 死亡结算 · 亮身份      | ✅ `death-system.ts:115` 走 `PlayerSystem.revealRole`                                          |
| 死亡结算 · 弃置所有牌    | ✅ `death-system.ts:129-143` 逐张走 `CardSystem.moveToDiscard`（装备技因此会从台账摘下来）                     |
| 死亡结算 · 触发死亡技能   | ❌ **没有落点**。`die` 在事件名清单里，但全仓无任何 emit 点 —— 技能没有时机可挂                                           |
| 奖惩 · 反贼死亡摸 3 牌  | ⚠️ **半截**。`handleReward` 只往 `killer` 身上记了一个 `rewardDraw = 3` 的标记，**没人读它**。记账完成了，发牌没有发生       |
| 奖惩 · 主公误杀忠臣弃全部牌 | ❌ 未实现，`handleReward` 里没有这一支                                                                  |

- 濒死求桃：~~按座次轮询（依赖 Phase 8）~~ → 已完成（依赖已由 Phase 8 提供）
- 死亡结算：~~亮身份、弃置所有牌、触发死亡技能~~ → 前两项已完成，缺 `die` 事件
- 奖惩：反贼死亡摸 3 牌（**补上 `rewardDraw` 的消费方**）；主公杀忠臣弃全部牌（**未开工**）

**验收**

- [x] 濒死 → 无人出桃 → 死亡（`damage-content.ts:126` → `settleDying`；`damage-pipeline.test.ts:297`）
- [ ] 濒死 → 有人出桃 → 存活且 hp = 1
- [ ] 反贼死亡 → 击杀者摸 3 张（`rewardDraw` 尚未被消费）
- [ ] 主公误杀忠臣 → 主公弃置所有牌

---

## Phase 24 — 判定与延时锦囊

**现状（2026-09-30 实测）**

| 项                                    | 实测                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 判定流程 `judgeBegin → judge → judgeEnd` | ⚠️ 判定**会**发生（`phase-manager.ts:273` 发 `judge` 事件），但流水线名叫 `-egin/-End` 是派生后缀，实际只有一条 `judge` 事件走过 7 个阶段 |
| 乐 / 兵 / 闪电生效                         | ❌ **都没生效**。三份内容写好也注册了，**但没有任何事件会走到它们**                                                                |
| 改判技能（鬼才）                             | ❌ 同上，没有可用时机                                                                                           |

**这是本轮核实出的最贵一处「接线缺失」**，链条断在哪儿很具体：

1. 延时锦囊打出时，`useCardContent` 把它放进目标判定区后**直接 `return`**——  
   不像普通锦囊那样以 `card.id` 触发子事件（`use-card-content.ts:50-54`）。  
   这是对的：延时牌的结算要等到目标的判定阶段。
2. 到了判定阶段，`doPhaseJudge` 翻一张牌、发一条名为 **`judge`** 的事件  
   （`phase-manager.ts:273-288`）。
3. 而内容注册表里**没有 `judge` 这个键**——查 `contents/index.ts` 全表，  
   延时锦囊那三份内容注册在 `leBuSiShu` / `bingLiangCunDuan` / `shanDian` 名下，  
   没有任何人以这三个名字发过事件。
4. 于是 `judge` 事件跑完（无事发生），判定牌与延时牌双双进弃牌堆  
   （`:291-303`）。延时锦囊表现为「进判定区，下一轮静默消失」。

修法是补接线，不是重写效果：`doPhaseJudge` 在发完 `judge` 之后，  
以判定区那张牌的 `id` 触发一次子事件（与 `useCardContent` 末尾同一套路），  
三份内容就能各就各位。

- 判定流程：补全「`judge` → `<延时牌 id>`」这一步接线
- 乐不思蜀 / 兵粮寸断 / 闪电真正生效
- 判定时允许技能改判（如【鬼才】）—— 需要给 `judge` 留一个能被挂住的时机

**验收**

- [ ] 乐不思蜀判定非红桃 → 跳过出牌阶段（内容已就绪，欠事件）
- [ ] 兵粮寸断判定非草花 → 跳过摸牌阶段（内容已就绪，欠事件）
- [ ] 闪电判定黑桃 2–9 → 受到 3 点雷电伤害并传给下家（内容已就绪，欠事件）
- [ ] 改判技能生效

---

## Phase 25 — 胜负判定

- 统一到一个 `WinCondition`（Phase 0 已删旧的，本 Phase 重新设计）
- 支持四种身份的胜利条件

**现状（2026-09-30 实测）**：胜负**能判**——`DeathSystem.checkGameOver`（`:187-226`）  
已覆盖主公死亡、反贼+内奸全灭两条路径，`system-smoke.test.ts:176-181` 有集成测试兜着。  
但它是 `DeathSystem` 里的一个方法，不是计划要的那个统一 `WinCondition`：  
四个身份的判定逻辑写在函数体里扩展，且场上还剩多少人的枚举边界没有穷举测试。

| 身份      | 胜利条件        |
| ------- | ----------- |
| 主公 + 忠臣 | 反贼与内奸全部死亡   |
| 反贼      | 主公死亡        |
| 内奸      | 主公死亡且场上只剩自己 |

**验收**：9 种终局场景各一个测试。

---

### 组 G · AI 与 UI

---

## Phase 26 — AI 适配新契约

**现状（2026-09-30 实测）**

| 项                                                | 实测                                                                                                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI 认识 Mod                                        | ❌ 未实现。`ai-strategies.ts` 全文没有一处 `modQuery` / `queryNumeric`；它对「还剩几次杀」的判断读的是 `player.attackLimit`（`:143`），而 ModRegistry 那条路上的 `cardUsable` 它一无所知——这正是 Phase 22 两套额度并存的下游受害者 |
| AI 会用 `viewAs`                                   | ❌ 未实现。策略层没有 `getViews` 调用；决策出牌时只看真实手牌                                                                                                                                      |
| `ai.order` / `ai.result` / `threaten` / `expose` | ❌ 未实现。身份判断目前写在 `isAlly` / `shouldHeal` 等散落函数里（`ai-strategies.ts:66-88`）                                                                                                    |
| 三档难度                                             | ✅ 存在。新手 / 普通 / 困难三份策略各就各位（`:329` `:568`），由 `createAIStrategy(difficulty)` 分派（`:951`）；**但「标定」没做过**——没有任何测试或数据证明困难强于新手                                                       |

- AI 认识 Mod：评估伤害时调用 `modRegistry.queryNumeric`
- `ai.order` 决定行动优先级
- `ai.result.player` / `ai.result.target` 提供估值
- `threaten` / `expose` 用于身份判断
- 三档难度（新手/普通/困难）**重新标定**（代码已在，缺的是标定本身）

**验收**

- [ ] AI 会主动使用 `viewAs` 技能
- [ ] AI 能感知对手的 Mod（如不会去杀有藤甲的角色用火杀）
- [ ] 8 人局 AI 对战 100 局无死锁、无异常
- [ ] 困难难度胜率显著高于新手

---

## Phase 27 — UI 接线与 LOL 换皮

**现状（2026-09-30 实测）**

| 项                           | 实测                                                                                |
| --------------------------- | --------------------------------------------------------------------------------- |
| `GameBoard` 牌堆/弃牌堆数量硬编码 `0` | **成立**。`GameBoard.vue:11` 与 `:17` 两个 `<span class="pile-count">0</span>` 至今是字面量 0 |
| `CardBack.vue`              | 成立。Phase 0 已删且未重建（全仓无 `CardBack` 引用）                                              |
| 响应弹窗 / 技能面板由结算点驱动           | ⚠️ `ResponseDialog.vue` 与 `SkillPanel.vue` 存在，本轮未逐条核对其数据来源，列为待核                   |

**UI 接线**

- `GameBoard` 牌堆/弃牌堆数量当前硬编码 `0` → 读 Store（**已确认仍在**）
- 对手手牌渲染卡背（`CardBack.vue` 在 Phase 0 已删，需重新实现）
- 响应弹窗、技能面板由引擎的结算点驱动（依赖 Phase 8）
- 技能面板展示 Mod 带来的数值变化（如攻击范围 1 → 3）

**换皮**

- 建立 `source/theme/lol-mapping.ts`：三国杀 ID → LOL 名称/称号/描述
- 引擎内部继续用稳定 ID（`sha` / `caocao`），只在展示层替换
- 武将：曹操→? 关羽→? 等 16 个标准武将逐一映射
- 卡牌：杀/闪/桃/酒/锦囊/装备逐一映射

> 换皮放在最后。规则尚未正确时换皮，只会得到一堆漂亮的错。

---

## 5. 关键里程碑

| 里程碑          | 包含 Phase | 达成时引擎应该能                    |
| ------------ | -------- | --------------------------- |
| **M1 可验证**   | 1–2      | 编译通过、测试可控，后续每个改动都能被 CI 验证   |
| **M2 活起来**   | 3–4      | 跑出一局「每张牌都生效、每个技能都触发」的 AI 对局 |
| **M3 结算正确**  | 5–10     | 无懈可击连锁、南蛮入侵轮询、伤害可被防止        |
| **M4 可扩展** ★ | 11–17    | 验收清单 28 条全部可用 ≤15 行实现       |
| **M5 规则正确**  | 18–25    | 标准 5/8 人局完整规则无偏差            |
| **M6 可玩**    | 26–27    | AI 有策略、界面真实、主题完整            |

**建议的最小交付**：做到 **M4**。到那时引擎的扩展能力已经成立，后面是内容填充，风险可控。

### M4 正式验收（2026-09-30）

M4 的判据是「§2 的 28 条能否在 `source/` 里用 ≤15 行、零引擎改动地实现」。  
**此前从未做过这次勾选**——而 §5 一直在据此宣称 M4 已达成。现已逐条核过：

> **28 条中 28 条达标 / 0 条未达标 —— M4 达成。**

细化口径（详见 §2 的汇总行）：

| 档       | 条数     | 含义                        |
| ------- | ------ | ------------------------- |
| ✅ 实装    | **11** | `source/` 里有真实技能/装备在用     |
| 🟡 接线就绪 | **6**  | 消费方已在生产路径，补一条 ≤15 行定义即可   |
| ⬜ 机制已通  | **11** | 测试里实现过并断言通过，`source/` 无落点 |
| ❌ 不达标   | **0**  | —                         |

**但「达标」不等于「已经在玩」**：真正 ship 到 `source/` 的只有 11 条，  
其中 5 条（#18 限定技 / #19 觉醒技 / #20 转换技 / #23 临时技能 / #26 子技能）  
是属性与 API 都实现好了、还没有武将去用——这是**内容缺口**，不是架构缺口。  
把它们变成 ✅ 只需在 `source/heroes/` 里写武将，不再动引擎。

---

## 6. 风险登记

### 6.1 已关闭（对应 Phase 已完成，风险已消化）

| 原风险                   | 归属         | 结局                                                                                                                                                                |
| --------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 8 结算点重写波及全部引擎测试 | 8          | 按「先写验收（红）再改实现（绿）」做完，一次只动一个事件类型；此后测试数 268 → 296 → 363 单向往上，没有回退                                                                                                    |
| Phase 11 Mod 纯函数约束被绕过 | 11         | 收口在**类型层**：`ctx.game` 的类型是只读的 `IGameState`（`effect-context.ts:42`），写入在编译期就过不去，另有一条「Mod 内改 `ctx.game` 抛错」的验收用例兜底                                                   |
| Phase 13 技能契约迁移量大     | 13         | **原文应对与实现不符，按实测更正**：没有「并存期」，也没有逐包迁移。`IEffect` 现在是 `ISkill` 的**别名**（`export type IEffect = ISkill`，`effect.interface.ts:49`），存量定义零改动即合规，`wei → shu → wu` 的迁移顺序从未发生 |
| 装配后暴露大量真实缺陷（Phase 3）  | 3 / 4 / 4B | 确实暴露了，且按 B 类流程逐个登记。它同时是 6.2 里前四条「接线缺失」的发现现场                                                                                                                       |
| 事件名字符串化后失去类型安全        | 5          | `BuiltinEventName \| (string & {})` 已落地：内置名保留自动补全，自定义名仍能通过检查                                                                                                      |
| Mod 叠加顺序引发规则争议        | 11 / 12    | 顺序规则已写进 `code-standards.md`：`priority` 降序 → 同优先级按座次升序 → 同座次按 `mod.id` 字典序，并明确**禁止依赖注册顺序**                                                                         |

### 6.2 接线缺失（代码在、调用方不在）—— 本项目最高发的一类缺陷

**定义**：实现写好了、也注册/装配了，但**没有任何生产调用方会走到它**。  
它不会编译报错、不会测试失败，只会安静地不生效——直到有人去读代码才发现。  
2026-09-30 全仓清点共 **11 处**，其中 5 处已被历史 Phase 修掉，6 处仍开着（见 §3.1 的 D3 / D4 / D11 / D12 / D15 / D16）。

| #  | 发现于 | 实例                                                                                                                 | 怎么发现的                                     | 现状                                         |
| -- | --- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------ |
| 1  | 4B  | `Card.id` 是**定义 id**（30 张杀的 `id` 全是 `sha`），却被当成实例身份做区域比较                                                           | 跑超过一回合的对局时手牌凭空消失                          | 已修（切 `instanceId`）                         |
| 2  | 12  | 测试工程根本没被类型检查：`tsconfig.vitest.json` 的 `include` 写成 `src/**/__tests__/*`，而 `*` 不递归子目录                               | 改成 `**/*` 后一次性冒出 ~200 个错误                 | 已修                                         |
| 3  | 13  | 咆哮写 `player.attackLimit = Infinity`，而消费方查的是 `modQuery.cardUsable`；克己挂在 `phaseDiscardBefore` 上，而跳过与否在分发事件**之前**就已决定 | 写 Phase 13 用例时发现这两个技能从来没生效过               | 已修（改走 `mod.cardUsable` / 改挂 `phaseUseEnd`） |
| 4  | 14  | 装备触发技**从没被挂上过**（青釭剑 / 八卦阵 / 仁王盾全是死代码）；`ctx.modifyEffects` 只写了一个没人读的 mark                                           | 建技能台账时发现「谁拥有哪个技能」有三套互相矛盾的推断               | 已修（台账归一）                                   |
| 5  | 20  | `GameEvent.resetIdGenerator()` 方法在，但 `init()` 里没调用它——Phase 18 只归零了卡牌 id                                            | Phase 20 的验收用例自己撞出来的：同种子开观测跑两遍，事件树 id 对不上 | 已修（补进 `init()`）                            |
| 6  | 21  | `TargetSystem` 装配进引擎了，但**零生产调用方**（全部方法 `static`，只有测试在用）                                                            | 本轮核对                                      | 未修 → D3                                    |
| 7  | 21  | 出牌候选目标「简化处理，不计算距离」                                                                                                 | 本轮核对                                      | 未修 → D4                                    |
| 8  | 23  | `die` 事件名在册，全仓无 emit 点                                                                                             | 本轮核对                                      | 未修 → D11                                   |
| 9  | 23  | `rewardDraw` 记了账，没人读                                                                                               | 本轮核对                                      | 未修 → D12                                   |
| 10 | 24  | 延时锦囊三份内容已注册，但 `judge` 之后没有一次以牌 `id` 触发的子事件                                                                         | 本轮核对                                      | 未修 → D15                                   |
| 11 | 24  | 改判技能（鬼才）没有可挂的时机                                                                                                    | 本轮核对                                      | 未修 → D16                                   |

**应对（可执行，不靠记忆力）**：每新增一个**登记点**或**装配点**，合入前必须做一次  
**反向查找**——拿新注册的事件名 / 内容键 / 系统方法名去 `src` 里 grep，  
确认除定义与测试之外**至少有一个生产调用方**。查不到就两种处置，二选一：

1. 补上调用方（多数情况，通常几行）；
2. 明确登记为 §3.1 的欠账条目，写清「谁会来用它」。

第 5 条（Phase 20）是这条规则的样板：它不是设计缺陷，纯粹是「写了 `resetIdGenerator`  
却没人调用」，而发现它的是一条**验收用例**，不是人。

### 6.3 仍在册的存量风险

| 风险                                                                       | 影响 | 应对                                                                    |
| ------------------------------------------------------------------------ | -- | --------------------------------------------------------------------- |
| 组 F（21–25）的规则缺口多半是接线缺失的下游                                                | 高  | **先补接线，再谈规则**。D3 / D11 / D12 / D15 补完后重新评估——很可能有一批 ❌ 会自己变成 ✅          |
| Phase 22 两套出杀额度并存，可能给出互相矛盾的答案                                            | 中  | 先决议「只留 `mod.cardUsable` 一个答案来源」（D8），再动代码；不要两边各改一点                     |
| Phase 19 的收口有漏网（`assignRoles` 直写 `maxHp` / `hp`，`shouldSkipPhases` 三处直写） | 中  | 补进 `PlayerSystem`；`player-system.test.ts` 的结构护栏同步加断言，防止再加回来（D9 / D10） |
| UI 与引擎长期脱节（Phase 27 零进展，牌堆计数仍是硬编码 `0`）                                   | 中  | 刻意排在最后——规则尚未正确时接线 UI，只会得到一堆漂亮的错。组 F 收口后一并做                            |
| 「计划说 X 没做」与「X 没做」是两件事                                                    | 低  | 本轮已按此原则复核全文：被证伪的断言就地更正（见组 F 各表），不再沿用旧结论                               |

---

## 7. 与 v1 计划的差异

| v1                  | v2                                      | 原因                                                                                                                    |
| ------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Phase 0 清理          | **不作为编号 Phase 存在**；§3 从 1 起算，共 29 个执行单元 | v1 的 Phase 0 在立项时就已做完，本计划把它当作**前置条件**而非执行单元：其成果落在 §0 基线实测数据与 Phase 1 里。**遗留**：它删掉的 `CardBack.vue` 至今未重建（见 §3.1 的 D25） |
| 无                   | **组 A 抢救基线（Phase 1–2）**                 | 实测发现编译不过、315 测试失败，必须先修                                                                                                |
| Phase 3 统一伤害流水线     | Phase 10，且改为事件驱动                        | 需先有 ContentRegistry 承载卡牌效果                                                                                            |
| Phase 4 结算点与响应模型    | Phase 8–9，拆成两块                          | 结算点 + 无懈可击各自独立可验                                                                                                      |
| 无                   | **组 D 技能与扩展系统（Phase 11–17）**            | 参考无名杀后新增，回答「丰富的扩展功能」                                                                                                  |
| Phase 5 确定性随机       | Phase 18                                | 后排，不阻塞主链路                                                                                                             |
| Phase 7 Effect 系统收口 | 并入 Phase 13–15                          | 与技能新契约合并                                                                                                              |
| Phase 8 规则正确性补全     | Phase 21–25，拆成五块                        | 每块独立可验                                                                                                                |
| Phase 9 UI 与换皮      | Phase 27                                | 不变                                                                                                                    |
| 无                   | **执行中插入 4B / 12B**                      | 都是验证前序 Phase 时暴露的阻断项：4B 卡牌实例身份、12B 主干整理与对局级验证。不占新编号，因此编号仍止于 27                                                        |
