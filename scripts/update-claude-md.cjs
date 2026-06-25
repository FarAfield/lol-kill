const fs = require('fs')
let content = fs.readFileSync('CLAUDE.md', 'utf8')

// 1. Replace trigger timing section
const oldTriggerSection = `### 触发时机 (Trigger Timing)

以下枚举定义在 \`src/core/contracts/enums.ts\`，是技能触发的基础：

| 分类       | 时机                                                                 |
| ---------- | -------------------------------------------------------------------- |
| 回合阶段   | \`phaseBegin\`, \`phasePrepare\`, \`phaseJudge\`, \`phaseDraw\`, \`phaseUse\`, \`phaseDiscard\`, \`phaseEnd\` |
| 卡牌使用   | \`cardUseBefore\`, \`cardUse\`, \`cardUseAfter\`, \`cardTargetSpecify\`, \`cardTargetSpecified\`, \`cardEffect\` |
| 伤害结算   | \`damageBefore\`, \`damage\`, \`damageAfter\`, \`damaged\`, \`damagedAfter\`   |
| 判定       | \`judgeBefore\`, \`judge\`, \`judgeAfter\`                                 |
| 死亡       | \`playerDying\`, \`playerDeath\`, \`playerDeadAfter\`                      |
| 全局       | \`gameStart\`, \`gameOver\`, \`roundStart\`, \`roundEnd\`, \`turnStart\`, \`turnEnd\` |

### 触发时机与流水线阶段的映射 (TriggerTiming ↔ EventStatus)

这是技能系统与事件系统交互的核心契约。每个 \`TriggerTiming\` 值对应事件流水线中的一个 \`EventStatus\` 阶段。技能在 \`ISkill.trigger\` 中声明监听的时机，EventDispatcher 在对应阶段将匹配的技能注入为 AOP 钩子执行。

**映射表**:

| TriggerTiming        | → EventStatus     | 说明                                   |
| -------------------- | ----------------- | -------------------------------------- |
| \`*Before\` (全部)     | → \`BEFORE\`        | 所有带 Before 后缀的时机在 BEFORE 阶段 |
| \`phaseBegin\`         | → \`BEGIN\`         | 阶段开始时                             |
| \`phasePrepare\` 等    | → \`BEGIN\`         | 各阶段开始时                           |
| \`cardUse\`            | → \`CONTENT\`       | 卡牌使用核心结算                       |
| \`cardEffect\`         | → \`CONTENT\`       | 卡牌效果结算                           |
| \`damage\`             | → \`CONTENT\`       | 伤害核心结算                           |
| \`damaged\`            | → \`CONTENT\`       | 受伤核心结算                           |
| \`judge\`              | → \`CONTENT\`       | 判定核心结算                           |
| \`cardTargetSpecify\`  | → \`PREPARE\`       | 指定目标时                             |
| \`cardTargetSpecified\`| → \`PREPARE\`       | 指定目标后（仍属准备）                 |
| \`playerDying\`        | → \`CONTENT\`       | 濒死结算                               |
| \`playerDeath\`        | → \`END\`           | 死亡结算结束时                         |
| \`*After\` (全部)      | → \`AFTER\`         | 所有带 After 后缀的时机在 AFTER 阶段   |
| \`gameStart/Over\`     | → \`BEGIN\`         | 游戏开始/结束触发                      |
| \`roundStart/End\`     | → \`BEGIN\` / \`END\` | 轮次边界                               |
| \`turnStart/End\`      | → \`BEGIN\` / \`END\` | 回合边界                               |

**AOP 钩子注入流程**:

\`\`\`
1. GameEngine 创建事件 (IGameEvent)，设置 type = 某个 TriggerTiming
       │
2. EventCompiler 或 EventDispatcher 调用 EventTrigger
   → 遍历全部已注册技能的 ITriggerCondition
   → 匹配: skill.trigger 中声明的 timing === event.type
   → 按 PriorityManager 排序
       │
3. 根据「TriggerTiming → EventStatus」映射，确定匹配技能应注入到哪个流水线阶段
   例如: 技能监听 damageAfter → 映射到 EventStatus.AFTER → stageHooks[AFTER].push(hook)
       │
4. EventDispatcher 按流水线推进事件:
   WAITING → SKIP_CHECK → BEFORE → BEGIN → PREPARE → CONTENT
     → PREVENT → END → AFTER → COMPLETED
       │
   每进入一个阶段，取出 event.stageHooks[currentStage] 中的钩子依次执行
       │
5. 钩子执行完毕（或被 cancel/prevent）→ 进入下一阶段 → 重复步骤 4
\`\`\`

**source vs player 的区别**:

| 属性   | 含义                                                       | 示例                                                      |
| ------ | --------------------------------------------------------- | --------------------------------------------------------- |
| source | 事件的实际触发者（谁做了这件事）                           | A 借刀杀人让 B 对 C 出杀 → 杀事件的 source = B            |
| player | 事件的驱动者（谁在主导这条事件链）                         | 同上 → player = A（A 是借刀杀人的发起者）                |

多数情况下 source === player。在事件链中，子事件的 \`player\` 继承自顶层事件的 \`player\`，
确保技能在判断"谁在主导"时有明确的上游锚点。`

const newTriggerSection = `### 触发时机 (Trigger Timing)

以下枚举定义在 \`src/core/contracts/enums.ts\`：

| 分类       | 时机                                                                 |
| ---------- | -------------------------------------------------------------------- |
| 全局       | \`GameStart\`, \`RoundStart\`, \`TurnStart\`, \`TurnEnd\`, \`RoundEnd\`, \`GameOver\` |
| 回合阶段   | \`PhasePre\`, \`PhaseJudge\`, \`PhaseDraw\`, \`PhaseUse\`, \`PhaseDiscard\`, \`PhasePost\` |
| 卡牌       | \`CardUse\`, \`CardTarget\`, \`CardEffect\`                          |
| 伤害       | \`Damage\`, \`Damaged\`                                               |
| 判定       | \`Judge\`                                                             |
| 死亡       | \`PlayerDying\`, \`PlayerDeath\`                                      |

> **设计要点**: 触发时机不再包含 \`*Before\` / \`*After\` 后缀。
> Before/After 由 \`TriggerStage\` 表达——技能在注册时声明
> \`{ timing: TriggerTiming, stage: 'Before' | 'Content' | 'After' }\`。
> 这避免了「damageBefore 自身是否还能有 before」的语义混淆。

### 触发时机与流水线阶段的映射 (TriggerTiming ↔ EventStatus)

效果（Effect）通过 \`ITriggerCondition\` 中的 \`TriggerEntry[]\` 声明触发条件。
每个 \`TriggerEntry\` 包含 \`timing\`（监听的事件类型）和 \`stage\`（在该事件的哪个流水线阶段触发）。

**映射规则**:

| TriggerStage | → EventStatus     | 说明                                   |
| ------------ | ----------------- | -------------------------------------- |
| \`'Before'\`   | → \`BEFORE\`      | 事件前置钩子                           |
| \`'Content'\`  | → \`CONTENT\`     | 事件核心结算（默认）                   |
| \`'After'\`    | → \`AFTER\`       | 事件后置钩子                           |

大多数系统事件的默认阶段为 \`Content\`。\`TurnStart\` / \`RoundStart\` 等边界事件
默认在 \`BEGIN\` 阶段触发。

**AOP 钩子注入流程**:

\`\`\`
1. GameEngine 创建事件 (IGameEvent)，设置 type = 某个 TriggerTiming
       │
2. EventDispatcher 调用 EventTrigger，遍历全部已注册 Effect 的 ITriggerCondition
   → 匹配: entry.timing === event.type && entry.stage === 当前期望的阶段
   → 按 priority 排序
       │
3. EventDispatcher 按流水线推进事件:
   WAITING → SKIP_CHECK → BEFORE → BEGIN → PREPARE → CONTENT
     → PREVENT → END → AFTER → COMPLETED
       │
   每进入一个阶段，查询 EventTrigger 获取匹配该阶段的钩子并依次执行
       │
4. 钩子执行完毕（或被 cancel/prevent）→ 进入下一阶段 → 重复步骤 3
\`\`\`

**source vs player 的区别**:

| 属性   | 含义                                                       | 示例                                                      |
| ------ | --------------------------------------------------------- | --------------------------------------------------------- |
| source | 事件的实际触发者（谁做了这件事），可为空                   | 闪电 → source = undefined（无明确来源）                   |
| player | 事件的驱动者（谁在主导这条事件链），可为空                 | A 借刀杀人让 B 对 C 出杀 → player = A                    |

多数情况下 source === player。两者均可为空（如系统事件闪电无明确来源）。
在事件链中，子事件的 \`player\` 继承自顶层事件的 \`player\`。`

content = content.replace(oldTriggerSection, newTriggerSection)

// 2. Update type names
content = content.replace(/ISkillContext/g, 'IEffectContext')
content = content.replace(/ISkill\b/g, 'IEffect')
content = content.replace(/PhaseType/g, 'GamePhase')
content = content.replace(/ICardDefinition/g, 'ICard')
content = content.replace(/IHeroDefinition/g, 'IHero')
content = content.replace(/CardSubType/g, 'tag (string)')

// 3. Update Phase name mappings
content = content.replace(/phaseBegin/g, 'PhasePre')
content = content.replace(/phasePrepare/g, 'PhasePre')
content = content.replace(/phaseEnd/g, 'PhasePost')
content = content.replace(/PhasePrepare/g, 'PhasePre')
content = content.replace(/PhaseEnd/g, 'PhasePost')
content = content.replace(/PhasePlay/g, 'PhaseUse')

// 4. Update state machine
content = content.replace(/PHASE_PREPARE/g, 'PHASE_PRE')
content = content.replace(/PHASE_PLAY/g, 'PHASE_USE')
content = content.replace(/PHASE_END/g, 'PHASE_POST')

// 5. Card type names
content = content.replace(/TrickCard/g, 'RuneCard')

// 6. Event source/player optional
content = content.replace(/\| source \| IPlayer/g, '| source | IPlayer (optional)')
content = content.replace(/\| player \| IPlayer/g, '| player | IPlayer (optional)')

// 7. Update directory structure
content = content.replace(
  '├── contracts/      # 全部接口定义（IEvent, ISkill, ICard, IPlayer, IGameState...）',
  '├── contracts/      # 全部接口定义（IEvent, IEffect, ICard, IPlayer, IGameState...）'
)

// 8. Update source/ description
content = content.replace(
  /source\/\s+# 静态游戏资源[\s\S]*?└── base\//,
  `source/             # 静态游戏资源（声明式数据，不包含逻辑）
├── heroes/         # 英雄数据（直接导出 IHero[]）
├── cards/          # 卡牌数据（直接导出 ICard[]，含默认运行时状态）
├── modes/          # 游戏模式配置（标准场、3v3、1v1 等）
└── base/           # Effect 定义、规则常量
    └── effects/    # 全局 Effect 注册表（所有效果在此定义，卡牌/英雄通过 effectIds 引用）`
)

// 9. Update card type hierarchy section
const oldCardTypeSection = `### 卡牌类型体系

\`\`\`
Card (抽象基类)
├── BasicCard (基本牌)
│   ├── 攻击牌 (Attack)        — 对目标造成伤害
│   ├── 防御牌 (Defend)        — 响应攻击，避免伤害
│   ├── 回复牌 (Heal)          — 回复体力
│   └── 增益牌 (Buff)          — 濒死回复 / 伤害+1
├── RuneCard (符文牌，即时生效)
│   ├── ImmediateRune (非延时符文)
│   │   ├── 控制类 (过河拆桥 / 顺手牵羊)
│   │   ├── 增益类 (无中生有 / 五谷丰登)
│   │   ├── 群体类 (南蛮入侵 / 万箭齐发 / 桃园结义)
│   │   ├── 反制类 (无懈可击)
│   │   └── 特殊类 (借刀杀人 / 决斗)
│   └── DelayedRune (延时符文)
│       ├── 跳过出牌阶段
│       ├── 跳过摸牌阶段
│       └── 判定伤害 (闪电)
├── TalentCard (天赋牌，发动后永久生效)
│   └── 全局被动增益 / 光环效果
└── EquipCard (装备牌)
    ├── Weapon (武器)    — 攻击范围+特效
    └── Armor (防具)     — 防御效果
\`\`\`

> **注意**: 以上具体卡牌名称（Sha, Shan, Tao 等）不再硬编码在引擎中。
> 所有卡牌以声明式数据定义在 \`source/cards/\` 目录下，引擎通过 \`tag\` 字段识别卡牌行为。`

const newCardTypeSection = `### 卡牌类型体系

\`\`\`
Card (统一接口 ICard)
├── BasicCard (基本牌)    — 攻击/防御/回复/增益
├── RuneCard (符文牌)     — 即时或延时生效
├── TalentCard (天赋牌)   — 发动后永久生效
└── EquipCard (装备牌)    — 武器/防具
\`\`\`

> **设计要点**: 不再区分「卡牌定义」和「卡牌实体」——所有卡牌统一为 \`ICard\`。
> source/ 中的卡牌数据直接导出 \`ICard[]\`（含默认运行时状态值）。
> 具体卡牌名称（杀、闪、桃 等）由 source/cards/ 中的声明式数据定义，
> 引擎通过 \`tags: Set<string>\` 字段进行分类和筛选。
> 卡牌效果通过 \`effectIds: string[]\` 引用全局 EffectRegistry。`

content = content.replace(oldCardTypeSection, newCardTypeSection)

// 10. Update title
content = content.replace(
  '│  GameEngine → EventDispatcher → EventChain(LIFO)        │\n│                  → EventTrigger → 技能 content           │',
  '│  GameEngine → EventDispatcher → EventChain(LIFO)        │\n│                  → EventTrigger → Effect content        │'
)

fs.writeFileSync('CLAUDE.md', content)
console.log('CLAUDE.md updated successfully')
