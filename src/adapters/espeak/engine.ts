/**
 * eSpeak-NG, loaded once and used to phonemize French text.
 *
 * @remarks
 * Runs in the web worker of `espeak.worker.ts`, off the main thread.
 *
 * Synthesis events are used rather than `text_to_phonemes`: each phoneme event carries the
 * character position of the word that produced it, which is what lets the IPA be aligned word by
 * word. The audio itself is thrown away; the voice comes from the browser.
 *
 * @packageDocumentation
 */
import type { PhonemeTrace } from '@/core/ports'
import createModule, { type ESpeakWorker } from './vendor/espeak-ng-fr.js'

/** A phonemization request. */
export interface PhonemizeRequest {
  /** Echoed in the response, to match it with its request. */
  id: number
  /** Texts to phonemize, each as a separate synthesis. */
  texts: string[]
}

/** The answer to a {@link PhonemizeRequest}: one trace per text, or the error message. */
export type PhonemizeResponse = PhonemizeResult | PhonemizeError

/** Successful answer: one phoneme trace per text sent. */
export interface PhonemizeResult {
  /** The request's id. */
  id: number
  /** One trace per text, in the order of {@link PhonemizeRequest.texts}. */
  results: PhonemeTrace[]
}

/** Failed answer, typically when the eSpeak data couldn't be loaded. */
export interface PhonemizeError {
  /** The request's id. */
  id: number
  /** Error message. */
  error: string
}

let engine: Promise<ESpeakWorker> | undefined

/**
 * Loads eSpeak once and selects French.
 *
 * @remarks The data package is fetched from `public/espeak/`.
 */
function getEngine(): Promise<ESpeakWorker> {
  engine ??= createModule({
    locateFile: (path) =>
      new URL(`${import.meta.env.BASE_URL}espeak/${path}`, self.location.origin).href,
  }).then((m) => {
    const w = new m.eSpeakNGWorker()
    w.set_voice('fr')
    return w
  })
  return engine
}

/** Synthesizes `text` and keeps only its phoneme events. */
function phonemize(w: ESpeakWorker, text: string): PhonemeTrace {
  const trace: PhonemeTrace = []
  w.synthesize(text, (_audio, events) => {
    for (const ev of events) {
      if (ev.type === 'phoneme' && typeof ev.id === 'string' && ev.id)
        trace.push([ev.text_position, ev.id])
    }
    return 0
  })
  return trace
}

/** Answers a request: one phoneme trace per text, or the error message. */
export async function handleRequest({ id, texts }: PhonemizeRequest): Promise<PhonemizeResponse> {
  try {
    const w = await getEngine()
    return { id, results: texts.map((t) => phonemize(w, t)) }
  } catch (err) {
    return { id, error: err instanceof Error ? err.message : String(err) }
  }
}
