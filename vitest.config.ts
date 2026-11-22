import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Unit tests of the core: plain TypeScript, run in Node with fake adapters.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/__tests__/*.test.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
