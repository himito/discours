import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  // Public path of the app: `/` in development, set by scripts/deploy.sh (BASE_PATH) when the
  // app is served from a sub-path.
  base: process.env.BASE_PATH ?? '/',
  plugins: [vue(), vueDevTools()],
  // The eSpeak module relies on import.meta, so workers must be ES modules.
  worker: { format: 'es' },
})
