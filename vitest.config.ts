import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // 压力测试（整局 AI 对局，一局几十秒）走 `npm run test:stress`，
      // 不进日常门禁 —— 见 `vitest.stress.config.ts`
      exclude: [...configDefaults.exclude, 'e2e/**', 'src/__tests__/stress/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
