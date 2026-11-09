/**
 * Downloading the app as a single HTML file, for training offline.
 *
 * @remarks
 * `npm run build` also produces `discours-hors-ligne.html` (see `scripts/build-offline.mjs`): the
 * whole app, eSpeak-NG and its French data in one file that works when opened from disk. The
 * download takes that file and embeds the current state (speech, IPA corrections, settings,
 * progress) in it, so the copy opens on the user's speech.
 *
 * @packageDocumentation
 */
import type { Saved } from '@/stores/discours'

/** Name of the offline file next to `index.html`. */
const OFFLINE_FILE = 'discours-hors-ligne.html'
/** Marker in the offline file where the state is inserted. */
const SEED_MARKER = '<!--discours-seed-->'

/** Whether this page is itself an offline copy (it then has nothing to download). */
export const isOfflineCopy = import.meta.env.MODE === 'offline'

/**
 * Downloads the offline copy with `state` embedded.
 *
 * @throws If the offline file is missing (development server, or a build without it).
 */
export async function downloadOfflineCopy(state: Saved): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL}${OFFLINE_FILE}`)
  const html = res.ok ? await res.text() : ''
  if (!html.includes(SEED_MARKER))
    throw new Error('Version hors ligne indisponible : elle est créée par « npm run build ».')

  // `<` escaped so the text can't close the script element.
  const json = JSON.stringify(state).replace(/</g, '\\u003c')
  const page = html.replace(SEED_MARKER, () => `<script>window.__DISCOURS_SEED__=${json}</script>`)

  const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }))
  const a = document.createElement('a')
  a.href = url
  a.download = OFFLINE_FILE
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
