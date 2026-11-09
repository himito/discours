/**
 * Speech recognition in French, as in the original prototype.
 *
 * @remarks Uses the Web Speech API (`SpeechRecognition`). It is available in Chrome and Edge,
 * which send the audio to their vendor's servers. Safari and Firefox don't support it: check
 * {@link recognitionSupported}.
 *
 * @packageDocumentation
 */
import { ref } from 'vue'

/* Minimal typings: the Web Speech recognition API is not in TypeScript's DOM lib. */
interface RecognitionAlternative {
  transcript: string
}
interface RecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: RecognitionAlternative
}
interface RecognitionEvent {
  resultIndex: number
  results: { length: number; [index: number]: RecognitionResult }
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

const w =
  typeof window !== 'undefined'
    ? (window as unknown as Record<string, RecognitionCtor | undefined>)
    : {}
const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
/** Whether this browser has speech recognition. */
export const recognitionSupported = !!Ctor

const MIC_BLOCKED =
  'Le micro est bloqué. Autorise le micro pour cette page dans ton navigateur, puis réessaie.'

/**
 * Recognition of a paragraph read aloud.
 *
 * @remarks Chrome ends a continuous recognition after a silence, so it is restarted until
 * {@link useReading | stop} is called.
 *
 * @returns
 * - `listening`: whether recognition is running.
 * - `finals`: confirmed transcript so far.
 * - `interim`: transcript still being recognized.
 * - `error`: message to show, for example when the microphone is blocked.
 * - `start()`, `stop()`.
 */
export function useReading() {
  const listening = ref(false)
  const finals = ref('')
  const interim = ref('')
  const error = ref('')
  let rec: Recognition | null = null

  function start() {
    if (!Ctor) return
    finals.value = ''
    interim.value = ''
    error.value = ''
    listening.value = true
    rec = new Ctor()
    rec.lang = 'fr-FR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      let tmp = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!
        if (r.isFinal) finals.value += ' ' + r[0]!.transcript
        else tmp += r[0]!.transcript
      }
      interim.value = tmp
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        error.value = MIC_BLOCKED
        stop()
      }
    }
    // Chrome ends continuous recognition after a silence: restart while the speaker reads.
    rec.onend = () => {
      if (listening.value) {
        try {
          rec?.start()
        } catch {
          /* already started */
        }
      }
    }
    try {
      rec.start()
    } catch {
      /* already started */
    }
  }

  function stop() {
    listening.value = false
    try {
      rec?.stop()
    } catch {
      /* not started */
    }
  }

  return { listening, finals, interim, error, start, stop }
}

/**
 * Recognizes one short utterance, for single-word practice.
 *
 * @returns
 * - `result`: resolves with up to 5 alternatives, most likely first (empty if nothing was heard).
 *   It rejects if the microphone is blocked.
 * - `cancel`: aborts listening.
 */
export function listenOnce(): { result: Promise<string[]>; cancel: () => void } {
  if (!Ctor) return { result: Promise.resolve([]), cancel: () => {} }
  const rec = new Ctor()
  rec.lang = 'fr-FR'
  rec.continuous = false
  rec.interimResults = false
  rec.maxAlternatives = 5
  const result = new Promise<string[]>((resolve, reject) => {
    let got: string[] = []
    rec.onresult = (e) => {
      const r = e.results[0]!
      got = Array.from({ length: r.length }, (_, i) => r[i]!.transcript.trim())
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        reject(new Error(MIC_BLOCKED))
    }
    rec.onend = () => resolve(got)
  })
  try {
    rec.start()
  } catch {
    /* already started */
  }
  return { result, cancel: () => rec.abort() }
}
