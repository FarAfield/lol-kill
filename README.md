# 联盟杀 (lol-kill)

基于《三国杀》标准规则体系，以英雄联盟（League of Legends）角色为主题的在线卡牌游戏。

---

## 架构概览

```
┌─────────────────────────────────┐
│  UI Layer (Vue 3 + Pinia)       │
│  views → components → hooks     │
│              ↓                  │
│  services/GameController        │  ← UI 与引擎的唯一接口
│  ═════════════ 边界 ══════════  │
│              ↓                  │
│  Core Layer (Pure TypeScript)    │
│  GameEngine → EventSystem(LIFO) │
│            → Subsystems         │
│            → GameState          │
└─────────────────────────────────┘
```

**核心原则**:
- **Core 层零依赖** — 纯 TypeScript，不依赖 Vue / Pinia / 浏览器 API
- **事件驱动** — 所有游戏状态变更通过 LIFO 事件栈（模拟三国杀「后发先至」结算）
- **引擎/UI 分离** — UI 通过 `GameController` 适配器与引擎交互

---

## 快速开始

```sh
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

---

## 测试

```sh
# 全部单元测试 (Vitest)
npm run test:unit

# E2E 测试 (Playwright)
npm run test:e2e

# TypeScript 类型检查
npm run type-check

# 代码检查
npm run lint
```

---

## 项目结构

```
core/               # 纯 TS 引擎 — 零视图依赖
├── contracts/      # 接口定义 (IEvent, IEffect, ICard, IPlayer...)
├── engine/         # GameEngine, StateMachine, PhaseManager, SkillRegistry
├── event/          # EventChain(LIFO), EventDispatcher(AOP), EventTrigger
├── system/         # CardSystem, DamageSystem, DeathSystem, DeckManager...
├── entity/         # Player, Card, Hero, GameState
├── services/       # StoreService, AIController
└── boot/           # GameBoot 启动引导

source/             # 静态游戏资源（声明式数据）
├── heroes/         # 英雄数据 + 技能定义
├── cards/          # 卡牌数据（基本/锦囊/装备）
├── modes/          # 游戏模式（标准5人/8人）
└── base/           # Effect 定义、规则常量

components/         # Vue 可复用组件
hooks/              # Vue 自定义钩子
store/              # Pinia 响应式状态
services/           # GameController — UI 调用引擎的唯一入口
views/              # Vue 页面
```

---

## 核心机制

### 事件系统 (LIFO 栈)

三国杀结算的核心规则是「后发先至」— 最新触发的事件优先结算。

```
触发 → WAITING → SKIP_CHECK → (CANCELLED)
     → BEFORE → BEGIN → PREPARE → CONTENT
     → PREVENT → (PREVENTED) → END → AFTER → COMPLETED
```

### 伤害流水线

```
来源确定 → BEFORE_DAMAGE → DAMAGE_PREVENT → DAMAGE_MODIFY
        → DAMAGE_APPLY → AFTER_DAMAGED → DAMAGE_COMPLETE
```

### 技能系统

| 类型 | 说明 |
|------|------|
| 主动技 | 玩家主动选择时机发动 |
| 被动技 | 满足条件自动触发，可选择 |
| 锁定技 | 强制触发，不可取消 |
| 限定技 | 每局仅一次 |
| 觉醒技 | 满足条件自动获得新技能 |

---

## 开发状态

引擎骨架（分层、事件系统、数据驱动）已成型，但存在装配断裂：Effect 系统尚未接入引擎，
当前对局中卡牌效果与武将技能均不生效。引擎正处于重构中。

- 架构与编码规范：[docs/code-standards.md](./docs/code-standards.md)
- 重构计划与进度：[docs/refactor-plan.md](./docs/refactor-plan.md)

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 核心引擎 | TypeScript（纯逻辑，零依赖） |
| 视图层 | Vue 3 + Pinia + Naive UI |
| 构建工具 | Vite |
| 测试 | Vitest (单元) + Playwright (E2E) |
