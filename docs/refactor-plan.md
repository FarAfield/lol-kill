# 联盟杀 · 引擎重构计划

> 配套文档：[代码规范](./code-standards.md)
> 原则：**先让引擎能跑，再让规则正确，最后才谈界面。**
> 每个 Phase 都有明确的验收标准，未通过不得进入下一 Phase。

---

## 现状结论

引擎的**骨架是对的**（分层清晰、事件驱动、数据驱动），但存在**装配断裂**：`EffectRegistry` / `SkillRegistry` 从未在生产代码中实例化，`DamageSystem` 的钩子从未注册。结果是——

> 当前任何一局游戏里，**没有一张卡牌生效，没有一个技能触发**，伤害只是 `hp -= n`。

所谓"完整 AI 对局能跑通"，是因为什么都不发生。单元测试之所以全绿，是因为每个测试自己手工 `registerAll` 装配了零件，测的是零件不是整机。

因此重构的第一目标不是"优化"，而是**把线接上，让引擎第一次真正运行**。

---

## 进度表

| Phase | 目标 | 状态 | 依赖 |
|-------|------|------|------|
| 0 | 清理死代码与过时文档 | ✅ 完成 | — |
| 1 | 建立装配根，让 Effect 真正生效 | ⬜ | 0 |
| 2 | 单一真值源，消灭 rebindState | ⬜ | 1 |
| 3 | 统一伤害流水线 | ⬜ | 2 |
| 4 | 结算点与响应模型 | ⬜ | 3 |
| 5 | 确定性随机 | ⬜ | 1 |
| 6 | 状态变更收口 | ⬜ | 2 |
| 7 | Effect 系统收口 | ⬜ | 1 |
| 8 | 规则正确性补全 | ⬜ | 4, 6 |
| 9 | UI 接线与主题换皮 | ⬜ | 8 |

> ⬜ 未开始 ｜ 🟡 进行中 ｜ ✅ 完成

---

## Phase 0 — 清理 ✅

**已完成。** 删除零引用的孤儿模块、孤儿组件、过时文档与脚手架残留：

- 文档：`PLAN.md`、`CLAUDE.md`（内容已被本文档与代码规范取代）
- core 死代码：`response-window.ts`、`replay-engine.ts`、`log-serializer.ts`、`di-container.ts`、`card-auditor.ts`、`role-system.ts`、`win-condition.ts`
- 组件孤儿：`PlayerInfo.vue`、`CardBack.vue`
- 脚手架残留：`e2e/vue.spec.ts`（断言 `You did it!`，必然失败）、`scripts/update-claude-md.cjs`（一次性迁移脚本）、`App.spec.ts`
- 连带清理：`core/event/index.ts`、`core/system/index.ts` 的导出；`game-engine.ts` 的 `CardAuditor` 引用与 `enableAudit` 逻辑

> 注：`replay-engine` / `log-serializer` 的删除不仅因为零引用，更因为**随机不可复现**使其功能本身不成立。回放能力应在 Phase 5 之后重新设计。

---

## Phase 1 — 建立装配根

**目标**：让 Effect 系统第一次真正接入引擎。

**问题**
1. `EffectRegistry` / `SkillRegistry` 只在测试里被实例化，生产代码零调用。
2. `rebindState()` 重建了所有子系统，但 `EventDispatcher` 的 `deps` 仍是构造时捕获的旧引用 → EffectContext 操作的是被废弃的空 `GameState`。

**改动**

| 文件 | 改动 |
|------|------|
| `core/boot/game-boot.ts` | 新建 `EffectRegistry`、`EventCompiler`、`SkillRegistry`；启动时注册 `source/base/effects/*` 与 `source/heroes/skills/*` 的全部 Effect |
| `core/boot/game-boot.ts` | 分配英雄后调用 `skillRegistry.loadAllHeroSkills(players)` |
| `core/engine/game-engine.ts` | 接收外部注入的 `eventTrigger` / `skillRegistry`，不再内部新建 |
| `core/engine/game-engine.ts` | 新增 `setDeps()` 或在 `rebindState()` 中重建 `eventDispatcher`，保证 deps 指向当前子系统 |
| `core/event/event-dispatcher.ts` | 增加 `setDeps(deps)` 方法 |
| 新增 `core/boot/effect-setup.ts` | 集中 Effect 装配逻辑，避免 GameBoot 膨胀 |

**验收**
- [ ] 5 人局启动后，`eventTrigger.count > 0`
- [ ] 集成测试：曹操受到杀的伤害后，手牌中**确实出现**那张杀（奸雄生效）
- [ ] 集成测试：关羽用红色牌当杀（武圣生效）
- [ ] 集成测试：张飞一回合出两张杀（咆哮生效）
- [ ] 上述测试必须走 `GameBoot` 完整路径，不得手工拼装

**风险**：装配后大量此前"因为不生效而通过"的测试会暴露真实缺陷。这是好事，但需预留时间。

---

## Phase 2 — 单一真值源

**目标**：`GameState` 在整个生命周期内只有一个实例。

**问题**：`init()` 中 `this.state = GameState.create(config)` 替换对象，随后 `rebindState()` 重建 8 个子系统。任何持有旧 state 引用的组件都会静默失效。

**改动**
- `GameState.create()` 改为 `GameState.reset(config)`，原地重置而非替换
- 删除 `rebindState()`，子系统只在构造函数中创建一次
- `EventDispatcher` 的 `deps` 只需绑定一次，但仍保留 `setDeps()` 供测试

**验收**
- [ ] `game-engine.ts` 中不再出现 `this.state =`
- [ ] 测试：init 后 `effectContext.game === engine.state`（同一引用）
- [ ] 测试：连续 `init` 两次不产生幽灵状态

---

## Phase 3 — 统一伤害流水线

**目标**：伤害只有一条流水线，且顺序正确。

**问题**
1. `DamageSystem` 自建 `DamageStage` 六段流水线，与事件系统的 `TriggerStage` 平行且互不相通。
2. `EffectContext.damageTarget` **先** `executePipeline()`（血已扣完）**再** `dispatch()` 事件 → 技能无法阻止伤害。

**改动**
- **删除** `DamageSystem` 的独立钩子注册表与 `DamageStage` 枚举
- 伤害改为纯事件驱动：伤害本身就是一次 `Damage` 事件，走标准流水线

```
Damage 事件流水线
  Before     → 伤害来源/属性确定，技能可转移（天香）
  Prepare    → 目标确定
  Content    → 伤害值计算与修改（古锭刀、藤甲）
  Prevent    → 伤害预防窗口（闪、技能）      ← 结算点
  Apply      → 扣减体力
  After      → 受伤后触发（反馈、刚烈、奸雄）  ← 结算点
  Complete
```

- `EffectContext.damageTarget()` 只负责创建并 dispatch 事件，不再直接执行流水线
- 原 `DamageSystem` 保留为 `DamageResolver`（纯函数，计算伤害值），不再持有状态与钩子

**验收**
- [ ] 测试：目标出闪 → `prevented === true` → 体力不变
- [ ] 测试：藤甲 + 火杀 → 伤害 +1
- [ ] 测试：伤害转移技能生效后，受伤方是转移目标
- [ ] 测试：伤害扣减后触发 `Damaged` 事件，奸雄能拿到牌
- [ ] `damage-system.ts` 中不再存在 `registerHook`

---

## Phase 4 — 结算点与响应模型

**目标**：实现三国杀真正的"后发先至"结算。这是**最难但最核心**的一步。

**问题**
1. `EventChain` 的 LIFO 名不副实：`dispatchAll` 先 pop 再 dispatch，`processNestedEvents` 只在 Content 阶段后统一处理。
2. `canceled` 只在 SkipCheck 检查一次，无法在结算中途插入（无懈可击无法实现）。
3. 没有按座次轮询的模型（南蛮入侵无法实现）。

**改动**

重新设计事件推进模型，引入三个概念：

```ts
/** 结算点：事件在此暂停并向相关玩家征询响应 */
interface ISettlementPoint {
  id: string
  stage: TriggerStage
  /** 参与轮询的玩家顺序：从当前行动玩家起，按座次顺时针 */
  getResponders(event: IGameEvent, state: IGameState): IPlayer[]
}

/** 响应请求 */
interface IResponseRequest {
  point: ISettlementPoint
  player: IPlayer
  validEffects: IEffect[]
  validCards: ICard[]
}
```

事件推进循环改为：

```
while (事件未完成) {
  推进到下一个结算点
  do {
    changed = false
    for (player of point.getResponders()) {      // 按座次
      const resp = await decisionService.ask(player)
      if (resp) {
        changed = true
        pushStack(resp.event)                    // 压栈
        await resolveStack()                     // 立即完整结算（后发先至）
      }
    }
  } while (changed)                              // 一轮内有人响应就再来一轮
}
```

- `EventDispatcher.dispatch` 重写为上述循环
- `EventChain` 保留为纯栈结构（push / pop / peek），语义回归真正的 LIFO
- `EventPauseManager` 重写：暂停的是**结算点**，不是整个栈
- `PriorityManager` 增加座次级排序

**验收**（每个都是一条三国杀硬规则）
- [ ] A 对 B 用锦囊 → C 出无懈可击 → D 出无懈可击 → **D 的先生效**，C 的无懈可击被抵消，锦囊正常结算
- [ ] 南蛮入侵 → 从行动者下家开始**按座次依次**询问，不出杀者扣血
- [ ] 濒死求桃 → 从濒死者自己开始按座次询问，有人出桃则存活
- [ ] 决斗 → 双方轮流出杀，先不出者扣血
- [ ] 事件嵌套深度上限 20，超限抛错而非静默

**风险**：这是全局性重写，几乎所有引擎测试都要改。建议先写上述 5 条验收测试（红），再改实现（绿）。

---

## Phase 5 — 确定性随机

**目标**：相同种子 + 相同决策 = 完全相同的一局。

**改动**
- 新增 `SeededRandomService`（实现 `IRandomService`，如 mulberry32 / xorshift）
- `GameEngine` 构造函数中 `randomService` 改为**必填**，删除 `fisherYatesShuffle` 回退分支
- `DefaultRandomService` 改用种子，禁止 `Math.random()`
- 全局搜索并清除引擎内的 `Math.random()` 与影响状态的 `Date.now()`
- 容器遍历显式排序，不依赖 `Set` / `Object.keys` 顺序

**验收**
- [ ] 同种子跑两局 8 人 AI 对局，逐事件日志完全相同
- [ ] `grep -r "Math.random" src/core` 无结果
- [ ] 回放能力在此基础上重新设计（原 `replay-engine` 已删）

---

## Phase 6 — 状态变更收口

**目标**：所有状态变更经由 `system/*`，消灭直接改属性。

**已知违规点**

| 位置 | 违规 |
|------|------|
| `DamageSystem.applyDamage` | `target.hp -=` |
| `EffectContext.recoverHp` | `target.recoverHp()` |
| `EffectContext.modifyMaxHp` | `target.modifyMaxHp()` |
| `EffectContext.drawCards` | 直接 `card.zone =` + `handCards.push` |
| `GameEngine.dealInitialHands` | 同上 |
| `PhaseManager.doPhaseDraw` | 同上 |
| `PhaseManager.doPhaseDiscard` | 直接 splice + `deckManager.discardOne` |
| `PhaseManager.doPhaseJudge` | 直接改 `card.zone` |

**改动**：上述全部改为调用 `CardSystem` / 新增的 `PlayerSystem`（负责 hp、maxHp、标记）。发牌、摸牌、弃牌、判定各有一个明确入口。

**验收**
- [ ] `grep -rn "\.hp -=\|\.zone =\|handCards.push\|handCards.splice" src/core` 在 system 层之外无结果
- [ ] 测试：摸牌后牌堆计数、手牌计数、卡牌 zone 三者一致
- [ ] 测试：弃牌后卡牌进入弃牌堆且 owner 清空

---

## Phase 7 — Effect 系统收口

**目标**：Effect 契约完整、无空桩、频率语义落地。

**改动**
- 删除 `SkillRegistry.enableEffect` / `disableEffect` 空实现；觉醒技改用 `player.marks` + `isAvailable`
- `EffectContext.modifyEffects` 实现真正的注册/注销（当前只存了数组长度）
- `IEffect.frequency`（once / oncePerTurn / oncePerRound / unlimited）落地：由 `CompiledHandler` 持有使用记录，回合/轮次边界清零
- 整理 trigger 的四个 scope：`source` / `player` / `global` / `target`。当前 `player` scope 依赖 `event.player`，而多数事件创建时未传该字段 → 实际永不触发。要么统一在创建事件时填充 `player`，要么砍掉这个 scope
- 统一文档与实现：代码规范中记录的 scope 数量必须与代码一致

**验收**
- [ ] 无 `return true` 空桩；未完成处显式抛错
- [ ] 测试：限定技一局只能发动一次
- [ ] 测试：每回合限一次的技能在第二回合可再次发动
- [ ] 测试：觉醒技满足条件后 `isAvailable` 变为 true

---

## Phase 8 — 规则正确性补全

**目标**：补齐三国杀基础规则中当前缺失或错误的部分。

| 规则 | 现状 | 目标 |
|------|------|------|
| 主公固定 0 号位先手 | ❌ 身份整体 shuffle，主公可能在任意座位 | 主公固定 0 号，其余身份 shuffle |
| 距离与攻击范围 | ❌ `getValidTargetsForCard` 注释写着"简化处理，不计算距离" | 全部走 `DistanceSystem` |
| 目标合法性 | ❌ `TargetSystem` 在引擎里被 new 但从未调用 | 出牌/响应统一走 `TargetSystem` 校验 |
| 胜负判定 | ❌ `WinCondition` 已删，逻辑散在 `DeathSystem` | 统一到一个 `WinCondition`，支持主公/忠臣/反贼/内奸四种胜利条件 |
| 濒死求桃 | ⚠️ 只 emit 事件，无实际求桃流程 | 按座次求桃（依赖 Phase 4） |
| 奖惩 | ⚠️ 反贼死亡摸 3 牌未实现 | 实现奖惩 |
| 延时锦囊 | ⚠️ 判定后直接进弃牌堆，未生效 | 乐不思蜀/兵粮寸断/闪电生效 |
| 装备 | ⚠️ 装备区渲染存在，效果未接 | 武器范围、防具、马匹生效 |
| 每回合杀的上限 | ⚠️ `usedAttackThisTurn` 被设置但从未被检查 | 出牌阶段校验 |

**验收**：每条规则至少一个集成测试，走 `GameBoot` 完整路径。

---

## Phase 9 — UI 接线与主题换皮

**目标**：界面真实反映引擎状态；完成英雄联盟主题包装。

**UI 接线**
- `GameBoard` 中牌堆/弃牌堆数量当前硬编码为 `0`，改为读 Store
- 对手手牌渲染卡背（`CardBack.vue` 已在 Phase 0 删除，需重新实现并接入）
- 响应弹窗、技能面板改为由引擎的结算点驱动（依赖 Phase 4）
- 删除或补全 `SkillPanel` 的空壳逻辑

**主题换皮**（当前只做到枚举层）
- 势力枚举已是 `Demacia / Noxus / Ionia`，身份已是 `天命星灵 / 守护者 / 飞升者 / 潜伏者`
- **但**武将仍是曹操/关羽/张飞，卡牌仍是杀/闪/桃
- 建立 `source/theme/lol-mapping.ts`：三国杀 ID → LOL 名称/称号/描述 的映射表
- 引擎内部继续用稳定 ID（`sha` / `caocao`），只在展示层做替换

> 换皮必须放在最后。规则尚未正确时换皮，只会得到一堆漂亮的错。

---

## 附录：重构顺序的理由

1. **Phase 1 优先**：没有装配，后面所有机制都无法验证——你甚至不知道自己改对了没有。
2. **Phase 2 紧随**：依赖失效会让 Phase 1 的成果静默丢失。
3. **Phase 3–4 是核心**：伤害与结算是三国杀的灵魂，也是当前最错的部分。
4. **Phase 5–7 是地基**：确定性决定能否测试，收口决定能否维护。
5. **Phase 8–9 是填充**：规则和皮肤都建立在正确的内核之上。

**建议的最小可交付里程碑**：完成 Phase 1 + 2 + 3 后，引擎应能跑出一局"每张牌都生效、每个技能都触发"的 AI 对局。到那时再评估后续投入。
