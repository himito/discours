import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

/**
 * Provides `virtual:espeak-data`: the French eSpeak data package as base64 in the offline build
 * (embedded in the single HTML file), `null` otherwise (fetched from `public/espeak/`).
 */
function espeakData(offline: boolean): Plugin {
  const id = 'virtual:espeak-data'
  return {
    name: 'discours:espeak-data',
    resolveId: (source) => (source === id ? '\0' + id : undefined),
    load(resolved) {
      if (resolved !== '\0' + id) return
      if (!offline) return 'export default null'
      const file = fileURLToPath(new URL('./public/espeak/espeak-ng-fr.data', import.meta.url))
      return `export default ${JSON.stringify(readFileSync(file).toString('base64'))}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `--mode offline` (scripts/build-offline.mjs) builds a version that runs from a single HTML
  // file opened from disk: relative paths, everything in one chunk, all assets inlined.
  const offline = mode === 'offline'
  return {
    // Public path of the app: `/` in development, set by scripts/deploy.sh (BASE_PATH) when the
    // app is served from a sub-path.
    base: offline ? './' : (process.env.BASE_PATH ?? '/'),
    plugins: [vue(), vueDevTools(), espeakData(offline)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // The eSpeak module relies on import.meta, so workers must be ES modules.
    worker: { format: 'es', plugins: () => [espeakData(offline)] },
    build: offline
      ? {
          outDir: 'node_modules/.discours-offline',
          emptyOutDir: true,
          copyPublicDir: false,
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          cssCodeSplit: false,
          modulePreload: false,
          rolldownOptions: { output: { codeSplitting: false } },
        }
      : undefined,
  }
})
