/**
 * eSpeak-NG, loaded once and used to phonemize French text.
 *
 * @remarks
 * Runs in the web worker of `espeak.worker.ts` in the normal build, and directly in the page in the
 * offline build: Chrome won't start a worker from a page opened from disk.
 *
 * Synthesis events are used rather than `text_to_phonemes`: each phoneme event carries the
 * character position of the word that produced it, which is what lets the IPA be aligned word by
 * word. The audio itself is thrown away; the voice comes from the browser.
 *
 * @packageDocumentation
 */
import createModule, { type ESpeakWorker } from '@/vendor/espeak-ng-fr.js'
import embeddedData from 'virtual:espeak-data'

/**
 * Phonemes of one text, in order.
 *
 * @remarks `position` is the 1-based character index (in the text sent) of the word that produced
 * the phoneme. `ipa` is eSpeak's IPA, possibly with stress marks (`ˈa`).
 */
export type PhonemeTrace = [position: number, ipa: string][]

/** A phonemization request. */
export interface PhonemizeRequest {
  /** Echoed in the response, to match it with its request. */
  id: number
  /** Texts to phonemize, each as a separate synthesis. */
  texts: string[]
}

/** The answer to a {@link PhonemizeRequest}: one trace per text, or the error message. */
export type PhonemizeResponse =
  { id: number; results: PhonemeTrace[] } | { id: number; error: string }

let engine: Promise<ESpeakWorker> | undefined

/** Decodes base64 into an `ArrayBuffer`. */
function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

/**
 * Loads eSpeak once and selects French.
 *
 * @remarks The data package is fetched from `public/espeak/`, except in the offline build, where
 * it is embedded in the code.
 */
function getEngine(): Promise<ESpeakWorker> {
  const data = embeddedData
  engine ??= createModule(
    data
      ? { getPreloadedPackage: () => fromBase64(data) }
      : {
          locateFile: (path) =>
            new URL(`${import.meta.env.BASE_URL}espeak/${path}`, self.location.origin).href,
        },
  ).then((m) => {
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
