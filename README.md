# lol-kill · 联盟杀

基于 **Vue 3 + Vite + Pinia** 构建的联盟主题卡牌游戏。

## 技术栈

| 技术 | 说明 |
|------|------|
| [Vue 3](https://vuejs.org/) | 渐进式 JavaScript 框架 |
| [Vite](https://vite.dev/) | 下一代前端构建工具 |
| [Pinia](https://pinia.vuejs.org/) | 现代化状态管理 |
| [Vue Router](https://router.vuejs.org/) | 官方路由管理 |
| [TypeScript](https://www.typescriptlang.org/) | 类型安全的开发体验 |
| [Naive UI](https://www.naiveui.com/) | 组件库 |
| [Less](https://lesscss.org/) | CSS 预处理器 |

## 项目结构

```
src/
├── __tests__/           # 单元测试
│   └── App.spec.ts
├── router/              # 路由配置
│   └── index.ts
├── views/               # 页面视图
│   └── home/
│       └── index.vue
├── App.vue              # 根组件
└── main.ts              # 应用入口
```

## 快速开始

```sh
# 安装依赖
npm install

# 启动开发服务器（热重载）
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 代码检查

```sh
# 运行全部检查（Oxlint + ESLint）
npm run lint

# Oxlint 检查与自动修复
npm run lint:oxlint

# ESLint 检查与自动修复
npm run lint:eslint

# Prettier 格式化
npm run format

# TypeScript 类型检查
npm run type-check
```

## 测试

```sh
# 单元测试（Vitest）
npm run test:unit

# E2E 测试（Playwright）
npm run test:e2e
```

## 编辑器推荐

- [VS Code](https://code.visualstudio.com/) + [Vue (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- 安装以下扩展获得完整开发体验（已在 `.vscode/extensions.json` 中配置推荐）：
  - **Vue (Volar)** — Vue 3 语言支持
  - **ESLint** — 代码规范检查
  - **Prettier** — 代码格式化
  - **EditorConfig** — 跨编辑器风格统一
  - **Oxc** — 高性能 Rust linter
  - **Vitest** — 单元测试集成
  - **Playwright** — E2E 测试集成
