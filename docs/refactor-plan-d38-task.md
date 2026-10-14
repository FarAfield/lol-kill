# D38 推进模型改造（引擎唯一驱动）

> **给执行者的第一句话**：本文件是**任务说明**，不是计划正文。
> 先读 `docs/refactor-plan.md` 的 **§3.1（D38 那一行）** 与 **Phase 27** 小节，再开工。
> **本轮要改 `src/**`，并且会删掉两个公开 API（`GameEngine.nextPhase` / `GameController.endPhase`）。**

**来源与适用修订**：本文件由第三方在 2026-10-09 读完当前 HEAD（`a843690`）的代码后写成。
文中所有 `文件:行` 是**写作时**的证据，开工前请自证仍然成立，不要直接采信。

---

## owner 已裁决的事（不要再回来问）

- **D38 → 形态丁：引擎唯一驱动。** 具体是四条：

  1. `GameEngine.runGameLoop()` 成为**唯一**的推进者；
  2. **删掉** `GameEngine.nextPhase()`（`game-engine.ts:770`）与
     `GameController.endPhase()`（`game-controller.ts:301`）；
  3. UI **不推进**、只**回答**引擎的提问；
  4. 「结束出牌」按钮 = 给一个**已经挂起**的提问答复 `null`。

- **为什么不选甲/乙/丙**（写在这里是为了让你理解约束，不是让你重新讨论）：
  参照无名杀 —— 它的骨架是 `game.loop()` → `phaseLoop()`（找下一个玩家并开回合）
  → `player.phase()`（六个阶段依次触发），**全程由一个异步流驱动**；
  人类输入走 `choose*` 系列，调用即**挂起当前步骤**，答案从 `result` 回到下一步。
  **无名杀没有「下一个阶段」这种 UI 接口** —— 推进与交互在那里是同一件事。
  - 甲（只补回合交接）≠ 无名杀：它保留了「UI 能推引擎」这个概念，两条推进路径继续并存，
    D38 这类错配以后还会以别的形式复发；
  - 乙（UI 当驱动者）与无名杀**方向相反**；
  - 丙（引入「哪些座位由 UI 驱动」）方向对，但多了一个**无名杀本身没有的概念** ——
    无名杀不需要它，因为所有座位走同一个 `choose`，谁回答由 `choose` 内部决定。

  裁决已下，**不要再就推进模型或「推进步长」发问**。
  若执行中发现与代码现实冲突（例如某个调用点无法迁移），**停下、登记、把冲突点写清楚**，不要自行改裁决。

---

## 背景：两个根因，以及一处**必须纠正**的诊断

### 根因 A —— 两条推进路径，只有一条写了「回合交接」

- **自动模式**：`runGameLoop()`（`game-engine.ts:627`）是个 `while` 循环，
  `turnManager.nextTurn()`（`:658`）与 `phaseManager.executeTurn()`（`:674`）交替。
  **「回合交接」全仓只在这里发生过。**
- **UI 逐步模式**：`endPhase()`（`game-controller.ts:301`）→ `nextPhase()`（`game-engine.ts:770`）。
  而 `nextPhase()` 的 `else` 分支（`:784-788`）在末阶段只是**把 `phasePost` 原地重设一遍** ——
  `getNextPhase()`（`phase-manager.ts:688-692`）对末阶段恒返回 `null`。
  **这条路上根本没人写交回合。**

第二个调用方 `confirmDiscard`（`game-controller.ts:394`）撞在同一处。

### 根因 B —— `start()` 一口气把整个回合跑完了

`GameEngine.start()`（`:610-614`）直接调 `phaseManager.executeTurn()`，而
`executeTurn()`（`phase-manager.ts:136`）是**整个回合**：TurnStart → 六个阶段全走 → TurnEnd。

关键在于出牌阶段 `doPhaseUse()`（`phase-manager.ts:425`）自带一个循环：

```ts
while (!phaseEnded && player.alive) {
  const result = await this.decisionService.askForCardPlay(player, options)
  if (result === null) { phaseEnded = true; break }
  ...
}
```

**出牌阶段什么时候结束，是决策服务说了算，不是 UI 说了算。**
所以 `startGame()` 返回时，第一个玩家的整个回合已经走完，`currentPhase` 停在 `phasePost`，
UI 面前没有任何「还没走完的东西」可推。

### 两条根因互相掩盖

- 只有 A：人会看到「出不了牌，但也推不动」；
- 只有 B：人会看到「错过了第一回合」，但后面能继续；
- A + B：唯一能交互的那一轮被吞掉，交接又不存在 → **界面看起来完全死了**。

### ⚠️ 纠正：不是「AI 替人打」，是「出牌阶段被静默跳过」

既有登记（§3.1 的 D38 行）里有一句「`askForCardPlay` 刻意没登记 → 落 AI 兜底」。
**按代码不是这样**，这一处必须纠正，否则会修错地方：

- `HUMAN_SEAT = 0`（`views/game/index.vue:176`），而 D7 之后主公 `RoleType.Aspect`
  被钉在 `players[0]` —— **人就是主公，就是第一个玩家**，根因 B 打中的正是人自己；
- `HumanDecisionService.askForCardPlay`（`human-decision.ts:141-148`）：

  ```ts
  if (!this.isHuman(player)) return this.fallback.askForCardPlay(player, options)  // 兜底只对非人类座位
  if (!this.channel.askForCardPlay) return null   // 缺省：结束出牌阶段
  ```

  兜底那条**只对非人类座位成立**。人走的是第二行：返回 `null` → `doPhaseUse` 立刻 `break`。
- 所以真实行为是：**人一张牌都没出，出牌阶段直接结束**；随后弃牌阶段由缺省实现
  替他弃前 N 张（`human-decision.ts:191-195`）。整个回合静默走完。

**这个区别决定了改法**：若是「AI 兜底」，解法是把按钮接到决策服务上；
实际是「阶段被跳过」，解法是让引擎在该停的地方停、把决定权交回 UI。两者都要做，
但**先做 T1（引擎侧）**，否则 T2 接上去也没有挂起点。

---

## 现状里**已经对**的部分（不要重写）

| 已经是对的 | 落点 |
|---|---|
| `doPhaseUse` 已经是「循环问决策服务直到返回 null」 | `phase-manager.ts:425` |
| 响应窗口已能**带回答案**（不是一个命令） | `useResponse.ts:65` `open(): Promise<string \| null>` |
| 座位分流已做好（谁是人、谁交给 AI） | `human-decision.ts:135` `isHuman()` |
| 「人的提问怎么摆到界面上」已有样板 | `views/game/index.vue:301` `askHumanResponse` |
| `runGameLoop()` 本来就在 | `game-engine.ts:627` |

**所以丁不是「新建一套」，是把「两条路」合成「一条」。** 绝大多数零件已经在位。

---

## 本轮会带来的一个**可见变化**（要自觉执行，不要让它意外发生）

引擎唯一驱动之后，**回合内没有提问的阶段不会停**：准备 / 判定 / 摸牌 / 结束阶段本来就没有玩家决策，
引擎会一路跑过去。于是：

- **「结束阶段」按钮在非出牌阶段失去意义**。`canEndPhase` 的含义从
  「现在是某个阶段」变成「现在正挂着一个提问」；
- 弃牌阶段只在**手牌超上限**时才停（`askForDiscard` 被问到时）；
- 这是无名杀的行为，也是丁的必然结果。

**不要为了保住按钮而在每个阶段插一个假的提问** —— 那等于把引擎又改回逐步推进，
本轮就白做了。

---

## 硬约束

- **按项目既有流程**：先写验收（红）→ 再改实现（绿）→ 跑全套自检。
- **不许留半条路**：`nextPhase()` 必须**删干净**。
  留一个「反正也没人用了」的兼容壳，等于两条推进路径继续并存，本轮白做。
  `endPhase()` 同理 —— 它不是「换个名字」，它的语义（推引擎一步）在本形态下不存在。
- **每个提问都必须有答案**。一个永不 resolve 的 Promise 就是**一次事件栈死锁**：
  不报错、不红测试，只是整局卡住。见 T3。
- **每条改动必须给出「生产调用方证据」**（`文件:行`）；**测试里有调用不算**。
- **不许靠把检查写窄来让验收变绿**。
- **不改 Phase 的范围与顺序**；发现新的设计级问题 → **只登记，不动手**。
- 每条结清后**同步更新 §3.1 与 §3 进度总表**，别攒到最后。

---

## 任务（按顺序，每步可独立提交）

### T1 — 引擎侧：唯一入口

1. **`start()` 不再跑回合**：删掉 `game-engine.ts:610-614` 的
   `const firstPlayer = ...; await this.phaseManager.executeTurn()`。
   `start()` 只负责：GameStart 事件 → 进第一轮 → 把第一个玩家设为行动者。
2. **`runGameLoop()` 成为唯一推进者**。
   ⚠️ **注意它是个 `while` 循环**：`startGame()` 调它时**不能 await 到整局结束**
   （否则视图里 `await ctrl.startGame()` 之后那段「启动后检查状态」要等到游戏结束才执行）。
   开局与「等整局结束」必须分开：让 `startGame()` 只把循环**跑起来**，
   整局结果走一个明确的出口回到 UI（`onGameOver` 回调，或 `whenFinished(): Promise<IGameResult>`，取最小做法）。
3. **删 `nextPhase()`**（`game-engine.ts:770-791`）及两个调用点
   （`game-controller.ts:301` `endPhase`、`:394` `confirmDiscard`）。
4. **阶段级同步**：UI 现在要看到阶段一格一格走，所以每个阶段推进之后都要 `syncState()`。
   检查现有 `syncState()` 的位置是否覆盖到 `executePhase` 粒度；不够就补。
5. **把 `start()` 的语义变化写进注释**（它从「跑第一个回合」变成「只开局」）。

### T2 — UI 侧：按钮从「推引擎」改成「回答问题」

1. **登记 `askForCardPlay` / `askForDiscard` 到 channel**
   （`views/game/index.vue:345-351`）。现在那段注释写着「其余四种刻意不登记」，
   **连同理由一起改掉**，并写清为什么现在必须登记 ——
   因为引擎在出牌阶段会**挂起**等人答复，不登记就等于「人永远不出牌」。
   形状照 `askHumanResponse`（`:301`）抄。
2. **`GameController.playCard`（`game-controller.ts:208`）改语义**：
   它从「调用引擎出牌」变成「**答复挂起的提问**」。
   `executeCardUse`（`:612`）现在是 UI 出牌与引擎出牌共用的执行体 ——
   在丁里，出牌这件事**只能由引擎做一次**，所以 `playCard` 不许再自己执行。
   这个方法的最终定位由你判断（改成答复器 / 拆成两个），但**不许留着两条出牌路径**。
3. **「结束出牌」按钮 = resolve(null)**。`handleEndPhase`（`views/game/index.vue:399`）
   与 `ActionButtons` 的三个 `end-phase` 出口（`ActionButtons.vue:33,74,86`）一并处理，
   并按上面的「可见变化」删掉非出牌阶段那几处。
4. **唯一真值源**：界面上「能打什么牌」必须来自**当前挂起提问的 `options`**，
   不许再从 `getAvailableActions()`（`game-controller.ts:426`）另算一份。
   `useCardPlay` 的 `playableCards`（`useCardPlay.ts:99-100`）改数据源。
   这与 D8（额度只有 `CardBudget` 一个答案）、D36（技能面板只认 `SkillRegistry`）是同一条规矩。

### T3 — 死锁纪律

- 组件卸载 / 路由离开 / 「再来一局」/ 重置会话 时，**所有挂起的提问都要被答复**
  （按缺省：不出 / 结束出牌 / 弃前 N 张）。
  照 `useResponse` 已有的 `discardStalePromise()`（`useResponse.ts:135`）的形状做。
- 断言：**提问挂起时强制重置会话 → 提问被答复，不悬着**。
  这条测试写起来比听起来难（正因为它「不报错」），但它是本轮最容易留下的隐性坑。

### T4 — 测试

- **端到端断言（本轮最重要的一条）**：人的出牌阶段**由 UI 给出答案**之后，
  牌真的打出去了，并且**出牌阶段结束时回合交到了下一位**。
  —— 这就是 D38 原本「走不完一圈」的那一圈。
- **原症状断言**：连按「结束阶段」若干次，回合**确实前进**。
- **`start()` 语义断言**：开局之后引擎**停在人的出牌阶段等答案**，
  而不是把第一个回合替他跑完。
- **变异检验**（必做）：把 `askForCardPlay` 从 channel 摘掉 → 必须有断言变红。
  摘掉之后全绿，说明断言落在不会坏的那一层。
- 既有 **508 passed / 40 files** 必须保持绿；数字变化要报告。
- ⚠️ 环境：`npm test` 要在**大写盘符**的 cwd 下跑（见 `.workbuddy/memory/MEMORY.md`）。

### T5 — 文档

- §3.1 的 **D38 结清**（写明「形态丁」与结清方式）；
  §3 进度总表同步；Phase 27 小节里 D38 那条从「待裁决」改掉。
- 上面那处**诊断纠正**（「AI 兜底」→「阶段被静默跳过」）要落到 D38 的条目里 ——
  它是「诊断写错一半」的第三个实例，值得留在纸面上。

---

## 交付与验收

- [ ] 自检全绿：`type-check` / `test` / `oxlint` / `eslint` / `build`；报告 `test` 用例数变化
- [ ] T1：`grep -rn "nextPhase" src` **零结果**（注释里也不留）；
      `GameController.endPhase` 已不存在；给出「只剩一条推进路径」的证据
- [ ] T1：`startGame()` **不阻塞**到整局结束（给出证据：视图里 `await startGame()` 之后的代码能立刻跑到）
- [ ] T2：`askForCardPlay` / `askForDiscard` 的**生产落点**（`文件:行`）；
      `playCard` 不再是第二条出牌路径
- [ ] T2：界面上的可出牌列表**只有一个来源**（挂起提问的 options）；
      `getAvailableActions().playableCards` 不再是第二本账（改掉或删掉，并说明）
- [ ] T3：重置/卸载时挂起的提问被答复 —— 有断言，且变异检验过
- [ ] T4：**端到端走完一圈**的断言存在，且**摘掉 channel 会红**
- [ ] §3.1 / §3 进度总表已同步；新发现的问题写入 §3.1（带证据），**不动手**
- [ ] 在 `.workbuddy/memory/<当日>.md` 记录：改了哪些接缝、哪些断言验证过会红、哪些判不出来
- [ ] 交付里明确回答：**这个「可见变化」（非出牌阶段不再停）是怎么落地的**

## 执行建议

**T1 → T2 → T3 → T4 → T5**，每步单独提交。

> T1 必须先行：没有引擎侧的挂起点，T2 的按钮接上去也没有东西可答复，
> 会出现「按钮点了没反应」这种看起来更像 bug 的中间态。

> **提醒**：前两轮的教训在这里同样成立 ——
> 「计划说 X 没做」和「X 没做」是两件事；**「代码里有」和「跑得到」也是两件事**。
> 本轮再加一条：**「接线接通了」和「整条链路能走完一圈」还是两件事** ——
> D34/D35/D36 全绿、端到端一按才发现回合根本交不出去，就是这条。
