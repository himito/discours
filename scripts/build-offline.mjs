/**
 * Builds `dist/discours-hors-ligne.html`: the whole app in a single HTML file that works when
 * opened from disk (`file://`), without a server.
 *
 * @remarks
 * Runs `vite build --mode offline` (see `vite.config.ts`): relative paths, hash routing, one
 * JavaScript chunk, the eSpeak worker and its French data embedded, every asset inlined. This
 * script then inlines the script and stylesheet into the HTML and adds a marker where the app
 * embeds the user's state when the file is downloaded (see `src/offline.ts`).
 *
 * Run by `npm run build` after the normal build; `npm run offline` runs it alone.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'vite'

const OUT = 'node_modules/.discours-offline'
const TARGET = 'dist/discours-hors-ligne.html'

await build({ mode: 'offline', logLevel: 'warn' })

let html = readFileSync(join(OUT, 'index.html'), 'utf8')
const read = (ref) => readFileSync(join(OUT, ref.replace(/^\.\//, '')), 'utf8')
const fail = (msg) => {
  console.error(`build-offline: ${msg}`)
  process.exit(1)
}

// The app must fit in one chunk: anything else would be fetched, which fails from disk. The
// build also emits the regular worker file (unused here) and a stub that eSpeak only imports when
// running under Node; neither is loaded in a browser.
const chunks = readdirSync(join(OUT, 'assets')).filter(
  (f) => f.endsWith('.js') && !/^(espeak\.worker|__vite-browser-external)-/.test(f),
)
if (chunks.length !== 1) fail(`expected one JavaScript chunk, got ${chunks.join(', ')}`)

// Replacer functions, not strings: "$" in the code must not be read as a replacement pattern.
let scripts = 0
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) => {
  scripts++
  // "</script" inside the code would end the element; "<\/script" means the same in JavaScript.
  const code = read(src).replace(/<\/script/gi, '<\\/script')
  return `<script type="module">${code}</script>`
})
let styles = 0
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, href) => {
  styles++
  return `<style>${read(href)}</style>`
})
if (scripts !== 1 || styles !== 1) fail(`inlined ${scripts} script(s), ${styles} stylesheet(s)`)

// Icons from public/ are not copied: inline the SVG favicon, drop the rest.
const favicon = readFileSync('public/favicon.svg').toString('base64')
html = html
  .replace(/<link rel="icon" href="[^"]*favicon\.ico"[^>]*>\s*/, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/, '')
  .replace(/<link rel="manifest"[^>]*>\s*/, '')
  .replace(
    /<link rel="icon" href="[^"]*favicon\.svg"/,
    `<link rel="icon" href="data:image/svg+xml;base64,${favicon}"`,
  )

// Where the download inserts the user's state: first thing in <head>, before the app runs.
html = html.replace('<head>', '<head>\n    <!--discours-seed-->')

mkdirSync('dist', { recursive: true })
writeFileSync(TARGET, html)
console.log(`✓ ${TARGET} (${(Buffer.byteLength(html) / 1048576).toFixed(1)} MB)`)
