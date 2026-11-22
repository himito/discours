import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Unit tests (tests/): the core is plain TypeScript, run in Node with fake adapters.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
