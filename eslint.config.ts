import type { Linter } from 'eslint'
import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

/**
 * A restricted import pattern for `no-restricted-imports`.
 *
 * @remarks A regular expression, not a `group`: groups use .gitignore syntax, where the `#` of
 * the layer aliases would start a comment and the rule would silently match nothing.
 */
interface Restriction {
  regex: string
  message: string
}

/** Matches imports of the given modules or aliases, and of anything under them. */
const importsOf = (...names: string[]) => `^(${names.join('|')})(/|$)`

/** Imports that leave their folder must use a layer alias, for every file. */
const NO_PARENT_IMPORTS: Restriction = {
  regex: '^\\.\\./',
  message: 'Use a layer alias (#core/…, #adapters/…, #ui/…) instead of ../ imports.',
}

/**
 * The import rules of a layer: no `../` imports, plus the layer's own restriction.
 *
 * @remarks One `no-restricted-imports` per file set: ESLint would not merge two of them.
 */
function layerRules(name: string, files: string[], restriction?: Restriction): Linter.Config {
  return {
    name: `app/architecture/${name}`,
    files,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: restriction ? [restriction, NO_PARENT_IMPORTS] : [NO_PARENT_IMPORTS] },
      ],
    },
  }
}

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
  // composition root (src/main.ts) sees the adapters. Imports leaving a folder use the layer
  // aliases (#core, #adapters, #ui), never `../`.
  layerRules('core', ['src/core/**/*.ts'], {
    regex: importsOf('#ui', '#adapters', 'vue', 'pinia', 'vue-router', 'html-to-image'),
    message: 'The core is plain TypeScript: no UI, no adapters, no frameworks.',
  }),
  layerRules('adapters', ['src/adapters/**/*.ts'], {
    regex: importsOf('#ui', 'vue', 'pinia', 'vue-router'),
    message: 'Adapters implement core ports; they must not depend on the UI.',
  }),
  layerRules('ui', ['src/ui/**/*.{ts,vue}'], {
    regex: importsOf('#adapters'),
    message: 'The UI uses ports (usePorts), never adapters: wire adapters in src/main.ts.',
  }),
  layerRules('entry-and-tests', ['src/main.ts', 'tests/**/*.ts']),

  skipFormatting,
)
