import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * 压力测试配置 —— 与日常门禁**分开**
 *
 * 一局 8 人全 AI 对局实测约 52 秒（5 人约 28 秒），慢的是引擎的
 * 事件分发与技能钩子遍历，不是 AI 决策（AI 一局只被问 20–35 次）。
 * 因此「100 局无死锁」这类验收若进日常门禁，一次全量就要 80 分钟。
 *
 * 跑法：`npm run test:stress`
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      root: fileURLToPath(new URL('./', import.meta.url)),
      include: ['src/__tests__/stress/**/*.test.ts'],
      // 一局就几十秒、一个 suite 十几分钟，别让 vitest 的超时把正常的慢判成失败
      testTimeout: 900_000,
      hookTimeout: 900_000,
    },
  }),
)
