/**
 * The model voice: the browser's French speech synthesis.
 *
 * @remarks
 * Same engine and voice choice as the original prototype. A whole paragraph is read as **one
 * utterance**, so intonation flows across sentences. Separate utterances per sentence sound
 * choppy. `word` boundary events report which word is being spoken, for highlighting.
 *
 * State is module-level: every component that calls {@link useSpeech} shares the same voice
 * list and playback state.
 *
 * @packageDocumentation
 */
import { ref, shallowRef } from 'vue'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
/** French voices, best first: Google, then Thomas / Amélie / Denise / Henri, then the rest. */
const voices = shallowRef<SpeechSynthesisVoice[]>([])
/** Id of what is being spoken (a paragraph id or a word), or null. */
const speakingId = ref<string | null>(null)
/** Character index of the word currently spoken, within the spoken text. */
const charIndex = ref(-1)

/** Increments on each `speak`/`stop`, so events from a cancelled utterance are ignored. */
let token = 0

/**
 * Same preference as the original prototype: fr-FR voices, Google first, then Thomas / Amélie /
 * Denise / Henri, then the rest.
 */
function quality(v: SpeechSynthesisVoice): number {
  if (!/^fr(-|_)FR/i.test(v.lang)) return 0
  if (/google/i.test(v.name)) return 3
  if (/(thomas|amélie|amelie|denise|henri)/i.test(v.name)) return 2
  return 1
}

/** Reloads the voice list; browsers load voices asynchronously (`voiceschanged`). */
function refreshVoices() {
  voices.value = speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('fr'))
    .sort((a, b) => quality(b) - quality(a))
}

if (supported) {
  refreshVoices()
  speechSynthesis.addEventListener('voiceschanged', refreshVoices)
}

/** Options of {@link useSpeech | speak}. */
export interface SpeakOptions {
  /** Speaking rate: 1 is normal, 0.6 is slow. */
  rate: number
  /** Chosen voice; empty means the best available one. */
  voiceURI: string
}

/**
 * Speaks `text` in a single utterance, stopping anything already playing.
 *
 * @param id - What is being spoken: a paragraph id, or `word:<key>`. Exposed as `speakingId`.
 * @param text - Text to speak.
 * @param opts - Rate and voice.
 * @returns `true` when the utterance finished, `false` if it was interrupted or failed.
 */
function speak(id: string, text: string, opts: SpeakOptions): Promise<boolean> {
  if (!supported) return Promise.resolve(false)
  stop()
  const mine = ++token
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'fr-FR'
    u.rate = opts.rate
    const voice = voices.value.find((v) => v.voiceURI === opts.voiceURI) ?? voices.value[0]
    if (voice) u.voice = voice
    u.onboundary = (e) => {
      if (mine === token && e.name === 'word') charIndex.value = e.charIndex
    }
    const done = (ok: boolean) => {
      if (mine !== token) return resolve(false)
      speakingId.value = null
      charIndex.value = -1
      resolve(ok)
    }
    u.onend = () => done(true)
    u.onerror = () => done(false)
    speakingId.value = id
    charIndex.value = -1
    speechSynthesis.speak(u)
  })
}

/** Stops speaking. */
function stop() {
  if (!supported) return
  token++
  speakingId.value = null
  charIndex.value = -1
  speechSynthesis.cancel()
}

/**
 * Access to the model voice.
 *
 * @returns
 * - `supported`: whether the browser has speech synthesis.
 * - `voices`: French voices, best first.
 * - `speakingId`: id passed to `speak` while it is speaking, else `null`.
 * - `charIndex`: character index of the word being spoken, or -1.
 * - `speak`, `stop`.
 */
export function useSpeech() {
  return { supported, voices, speakingId, charIndex, speak, stop }
}
