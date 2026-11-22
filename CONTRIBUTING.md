# Contributing to Discours

Thank you for helping. This guide explains how to set up the project, where code belongs, and
what a change needs before it can be merged.

## Contents

- [Getting set up](#getting-set-up)
- [Where code goes](#where-code-goes)
- [Making a change](#making-a-change)
- [Checks before you push](#checks-before-you-push)
- [Common tasks](#common-tasks)
- [Commits and pull requests](#commits-and-pull-requests)
- [Reporting a problem](#reporting-a-problem)
- [Licence of contributions](#licence-of-contributions)

## Getting set up

Requirements: Node.js 22.18+ or 24.12+, and Chrome or Edge to try speech recognition.

```sh
npm install
npm run dev
```

`npm run dev` first builds the French eSpeak-NG bundle (`npm run espeak`), then starts Vite. The
generated files (`src/adapters/espeak/vendor/espeak-ng-fr.js`, `public/espeak/`) are ignored by
git; don't commit them.

## Where code goes

The project follows **ports and adapters**. Read the [Architecture](README.md#architecture)
section of the README first. In short:

| Folder          | Contains                                                                                 | May import                          |
| --------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| `src/core/`     | Logic as pure functions and plain data, and the **ports** (interfaces) each module needs | other core modules only             |
| `src/adapters/` | Browser implementations of the ports                                                     | `src/core`, browser APIs, libraries |
| `src/ui/`       | Vue: screens, components, composables, the Pinia store                                   | `src/core`, Vue                     |
| `src/main.ts`   | The composition root: creates adapters, starts the app                                   | everything                          |
| `tests/`        | Unit tests (Vitest), mirroring `src/`                                                    | `src`, through `@/`                 |

ESLint enforces the import rules: `npm run lint` fails if the core imports Vue, the UI or an
adapter, if an adapter imports the UI, or if the UI imports an adapter.

Some rules of thumb:

- **A rule, a computation, a format?** It goes in `src/core`, as a pure function with a test.
  Components only display state and forward user actions.
- **Something from the browser or the network?** Declare what the core needs as an interface in
  the module that uses it (like `Phonemizer` in `core/phonetics/`), implement it in
  `src/adapters/`, and add it to `Ports` (`src/core/ports.ts`) and `createBrowserPorts()`
  (`src/adapters/index.ts`). The UI gets it with `usePorts()`.
- **Reactive state for several components?** A composable in `src/ui/composables/`, or the store
  in `src/ui/stores/discours.ts` if it must be saved.
- **Text the user sees** is in French; code, comments and documentation are in English.

## Making a change

1. Create a branch from `main`.
2. Make the change in the right layer (see above). Keep functions small and named after what they
   do; prefer a new pure function in the core to logic inside a component.
3. Add or update tests in `tests/` for any change in `src/core`. Ports make the logic testable
   without a browser: use a fake adapter, as `tests/core/analyze.test.ts` does for the
   `Phonemizer`.
4. Document every exported function, type and member with a [TSDoc](https://tsdoc.org) comment,
   and give each new file a header comment. Vue components need a header comment in
   `<script setup>` and a comment on each prop and event: they feed the _Vue components_ page of
   the API documentation.
5. Update the README if you change a feature, a command or the project structure.
6. Try the change in Chrome with `npm run dev`. For the PDF export and the deployment path, check
   a production build too (`npm run build`, then `npm run preview`).

## Checks before you push

All of these must pass:

```sh
npm run type-check   # TypeScript, app and tests
npm run lint         # oxlint, then ESLint (with architecture rules)
npm test             # unit tests
npm run build        # production build
npm run docs         # API documentation: must report no warnings
```

`npm run format` formats `src/` and `tests/` with Prettier (no semicolons, single quotes, 100
columns). `npm run docs` warns about any undocumented export.

## Common tasks

- **Fix a pronunciation for everyone:** add the word to `LEXICON` in
  `src/core/phonetics/lexicon.ts`, split into syllables with dots (`a.pʁɑ̃.ti.saʒ`).
- **Read a new written form correctly** (abbreviation, number format…): extend `normalizeWord` in
  `src/core/text/normalize.ts`, with a test in `tests/core/normalize.test.ts`.
- **Use another engine** (voice, phonemizer, dictionary, storage): write a class implementing the
  port in `src/adapters/`, then use it in `createBrowserPorts()`. Nothing else should change.
- **Add a screen:** a view in `src/ui/views/`, a route in `src/ui/router/index.ts`, and its
  logic in `src/core`.
- **Upgrade eSpeak-NG:** update `@echogarden/espeak-ng-emscripten`, then run `npm run espeak`.
  The script fails loudly if the upstream module layout changed.

## Commits and pull requests

- Write commit messages in the [Conventional Commits](https://www.conventionalcommits.org) style
  used in the history: `feat: …`, `fix: …`, `refactor: …`, `docs: …`, `test: …`, `chore: …`.
- Keep a pull request to one topic. Describe what changes for the user, and how you tested it
  (browser, screens, speech recognition or not).
- Include a screenshot for visual changes.

## Reporting a problem

Open an issue with:

- what you did, what you expected and what happened;
- the browser and system (speech features depend on them);
- for a wrong pronunciation: the word, the sentence it is in, the IPA shown and the IPA expected.

## Licence of contributions

Discours is released under the GNU General Public License, version 3 or (at your option)
any later version. By contributing, you agree that your contribution is released under the same
licence. See [LICENSE](LICENSE).
