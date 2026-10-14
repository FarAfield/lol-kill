# lol-kill · 项目长期笔记

## 环境（必读）

### Vitest 必须用盘符大写的 shell 跑（Windows）

在本机跑 `npx vitest` 时，`process.cwd()` 的盘符大小写决定成败：

- **Git Bash**：cwd 是 `c:\...`（小写）→ **31 个测试文件全部 0 test 挂掉**，
  报 `TypeError: Cannot read properties of undefined (reading 'config')`
  或 `Error: Vitest failed to find the runner`。
- **PowerShell**：cwd 是 `C:\...`（大写）→ 正常。

根因：Vite 把 node_modules 依赖 externalize 时给出的 id 是 `c:/...`，
而 vitest 内部由 Node 解析得到的是 `C:/...`。ESM 按**模块 URL 字符串**建缓存，
两个大小写不同的 URL 就是两个实例 → `@vitest/runner` 的模块级 `runner`
状态只在一边被赋值，测试文件里的 `describe()` 拿到的是没有状态的那一份。

**排查结论：这不是代码问题，不要去改 vitest/vite 版本或配置。**
用 PowerShell 跑测试即可（`npx vitest run`）。

相关：`npx vite build` 在本机会被批量删除保护拦住（清空 `dist/` 超过 50 个文件），
加 `--emptyOutDir false` 绕过。

### 读日志的两个坑（会让你误判成败）

- **PowerShell 里 `cmd | Out-String | Set-Content` 之后，`$LASTEXITCODE` 取自最后一个
  cmdlet 而不是被测命令** —— 报告出来的 `exit=0` 不可信。成败一律看日志正文
  （`Test Files X passed` / `Found 0 warnings`）。
- PowerShell 重定向出来的日志是**带 NUL 的 UTF-16**，bash 下要
  `tr -d '\0' | sed 's/\x1b\[[0-9;]*m//g'` 洗一遍才读得清。
- **vitest 里 `import.meta.url` 不是 `file:` 协议**，
  `fileURLToPath(new URL('../../', import.meta.url))` 会炸
  `TypeError: The URL must be of scheme file`。全仓一律用 `process.cwd()`。

## 项目约定

- 卡牌 tag 是「具体牌 tag + 类别 tag」两个维度（杀 `Strike+Attack`、闪 `Dodge+Defense`、
  桃 `Heal+Basic`）。只判一个维度会撞车——桃园结义是 `[PeachGardenOath, Trick, Heal, Aoe]`，
  只判 `Heal` 会被桃的目标规则吃掉（欠账 D5 / D6）。
- **测试里的牌必须是真的牌**：`cardDef(id, tags)` 手搓的 tag 集合一旦与
  `src/source/cards/*.ts` 不一致，那张牌就会落进 `TargetSystem` 的另一个分支。
  唯一真值源是卡牌定义（欠账 D32，缺护栏）。
- 「代码里有」≠「跑得到」。反查生产调用方时，**测试里有调用不算**。
  本仓已为此登记过 8 条接线缺失（D3 / D4 / D11 / D12 / D15 / D16 / D31 / D33）。
- **一件事只许有一个答案**。出杀额度（`CardBudget.canPlay`）、「跳过」
  （`player.shouldSkipPhases`）都已归一。遇到「两处各算一遍」的成员，
  优先**删掉**那个不完整的，而不是让它俩互相同步——零调用方 + 给出第二答案
  = 直接删（`TurnManager.skippedPlayers` / `shouldSkipPhase()` 就是这样没的）。
- **断言随机行为必须用会洗牌的随机源**。测试脚手架默认的 `IdentityRandomService`
  `shuffle()` 原序返回，用它断言「某物在第 0 位」是句废话。改用
  `SeededRandomService`（多颗种子），并**另配一条证明其余部分确实被洗了**——
  否则「恒在第 0 位」可能只是原序照抄的假象。
- **奖惩 / 惩罚分两层**：system 层（`DeathSystem.handleReward`）只**判定并记账**
  （`setMark`），内容层（`dieContent`）**执行**摸牌 / 弃牌——因为执行要发事件、
  要能被 Mod 拦。记账方与消费方之间**必须用常量连**
  （`REWARD_DRAW_MARK` / `PENALTY_DISCARD_ALL_MARK`）：两边各抄字符串，
  拼错就是奖惩**静默消失**，不报错也不红测试（D12 当初就栽在这里）。
- **每条「相等」断言都要配一条「它会动」的对照**。`0 === 0` 也绿、空数组也绿、
  `availableSkills.length === 0` 也绿——而这三种恰好都是本仓真实出现过的原状
  （Phase 27 的 D24 牌堆计数恒为 0、D36 的 `activeSkills` 恒空）。
  写完「等于真值」一定再加一句证明**真值本身会变**，否则断言没有牙齿。
- **Store 给派生值，不给原始数组**。把整个 `ICard[]` / `IPlayer[]` 递给组件，
  组件就会顺手从里面派生别的东西，等于给同一件事开了第二个答案（`deckCount` 而非 `deck`）。
- **断言要落在会坏的那一层**。测「面板显示真名」时断言 `useSkill().availableSkills`，
  别断言上游的 `getPlayerSkills()` —— 上游对了不代表面板对，而坏的就只是面板那一层。
  变异检验时把面板的 `name` 改回 `skill.id`，断言上游的那版**居然还是绿的**。
- **写了源码级模式匹配的，注释里不许出现那个模式**。已栽两次：
  `GameBoard` 注释里写出已删 props 的名字、`useSkill` 注释里复述旧代码
  `flatMap(h => h.effectIds)`，都被自己的 `toMatch` / `not.toMatch` 抓到。
- **「能跑」不等于「能推进」**。接线类欠账要端到端按一遍，看整条链路能不能
  **走完一圈**：D34 / D35 / D36 全绿之后才发现 `endPhase()` 交不出回合（D38），
  人类的第一个回合其实是被 AI 替着打完的。
- **补发注入要放在「唯一的那个出口」里**，不要放在各自的启动器里。
  `setCardBudget` / `setModQuery` / `setSkillRegistry` 曾只写在 `GameBoot`，
  而 `GameController` 是另一条启动路径 —— 图形界面那一路的 AI 一直是瞎的（D37）。
- **换皮（皮肤）只许落在「引擎数据 → UI 显示值」那道边界上**（D27）。
  引擎与三个定义文件一律用稳定 ID + 三国杀原名，换名的表只有
  `src/source/theme/lol-mapping.ts` 一份；落点是 `CardFace`（全仓唯一画牌名的组件）、
  `game-store` 派生 `UIPlayerInfo`、`useSkill` 的 `ISkill → SkillUIInfo`、
  `useResponse.open()` 的提问文案。**查不到就显示原名**——皮肤缺一块比空白强。
- **「显示名 === 查表结果」是句废话**。换皮类断言要**同一时刻两边都取一次值**：
  Store 派生出「德莱厄斯」而引擎真值仍是「关羽」。少取一边，换皮倒流进引擎也发现不了。
- **整句文案里的名字要能反查**：换皮表每条留着 `sgs`（原名），提问文案先整句查表、
  再按 `sgs` 反查替换【××】。`sgs` 与定义里的 `name` 必须一致（有断言盯着），
  否则反查**静默失效**。别在展示层另抄一份牌名对照。
- **跨模块的「数据键」必须用常量连，不许两边各抄字符串**。判定结果牌就是这么
  栽的（D44）：两个发起方对同一个键给了相反含义，改判改了三年错的对象。
  现在 `src/core/event/judge-keys.ts` 给常量 + 读写函数，生产者消费者共用。
- **「按条件豁免」的断言必须成对写**：只写「条件成立时生效」，把实现写成
  **无条件生效**那条**居然也是绿的**。真正会红的永远是「条件不成立时不生效」
  那一半（【奇才】：锦囊够得到远处 + 【杀】够不到，缺后者等于没测）。
- **全局触发的技能会让整批用例一起红**。测试里英雄池要能钉死：
  `createTestEnv(decisions, overrides)` 的 `overrides` 与 `NO_GUICAI_HEROES`
  就是为此存在的——【鬼才】是全局触发，标准池里多一个英雄就可能让 4 条
  既有断言莫名其妙地红（D44 当天正是如此）。

## UI 响应式（D45 之后新立的规矩）

- **控制器给 UI 的答案若是普通字段，必须由控制器自己报变更**。
  `pendingCardPlay` / `pendingDiscard` / 可打列表 / 技能面板**全是普通字段**，
  Vue 看不见；唯一能推出去的路（Store 同步）盖不住「引擎提问挂起」那一刻
  （`PhaseManager.executeTurn` 是先同步状态、再 `await executePhase`，
  **最后一次同步在提问之前**）。所以控制器有 `revision`（`revisionRef` + getter），
  在**提问挂起 / 答复 / 状态同步**三处 `markChanged()`，
  UI 的 computed 依赖一律挂 `ctrl.revision`。
  **别去让引擎提问时多推一次状态**——那是往引擎里塞 UI 的心思。
- **computed 的依赖必须「进门就挂」，不许放在早退之后**。
  早退的那一轮不会注册后面才读到的依赖：`humanPlayer` 在引擎出生前
  `if (!state) return null`，那一次根本没读到 Store，于是只认 `session`
  （shallowRef，开局后是同一个对象再没变过）→ 恒为 null → 手牌区整块空白。
- **端到端断言 UI 必须用 `watchEffect` 把值写进一个 `ref`（模拟渲染 effect）**。
  直接读一次 `ctrl.getAvailableActions()` 永远拿得到新值——computed 一读就重算，
  掩盖 bug。只有挂在 effect 上才测得到「依赖变了没有、界面重算过没有」。
  「我直接读一下是对的」在排查这类问题时**不能作为证据**。
- **「回合交出去了」不能只断言 `currentPlayerIndex !== HUMAN_SEAT`**。
  AI 那几位跑得快会绕回来又轮到人，那样断言照样绿。用「界面上出现过的
  所有当前玩家」+「牌堆张数减少」双证据。
- **变异检验要组合着做**。同一个副作用可能被另一条路径补偿：
  `askCardPlay` / `askDiscard` 进门第一句是 `settleAllPending()`，
  而它末尾也有 `markChanged()`，于是**单独**注掉 ask 里那句并不红。
  逐个单点变异 7 处全绿，差点误判断言没牙齿；组合去掉才现形。
- **全绿 ≠ 能用**。615 条断言全绿时用户实测仍报「图文版卡在第一回合」，
  因为**没有一条挂载真实视图点过按钮**。UI 类缺陷要有一条挂载真组件的
  端到端（`game-view-first-turn.test.ts` 就是补的这个位）。
