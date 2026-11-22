import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores([
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    'src/adapters/espeak/vendor/*.js',
  ]),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  // Architecture (ports & adapters): dependencies point inward. Each module of src/core declares
  // the ports it needs; src/adapters implements them; the UI uses ports only. Only the
  // composition root (src/main.ts) sees the adapters.
  {
    name: 'app/architecture/core',
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/ui',
                '@/ui/*',
                '@/adapters',
                '@/adapters/*',
                'vue',
                'pinia',
                'vue-router',
                'html-to-image',
              ],
              message: 'The core is plain TypeScript: no UI, no adapters, no frameworks.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'app/architecture/adapters',
    files: ['src/adapters/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/ui', '@/ui/*', 'vue', 'pinia', 'vue-router'],
              message: 'Adapters implement core ports; they must not depend on the UI.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'app/architecture/ui',
    files: ['src/ui/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/adapters', '@/adapters/*'],
              message:
                'The UI uses ports (usePorts), never adapters: wire adapters in src/main.ts.',
            },
          ],
        },
      ],
    },
  },

  skipFormatting,
)
