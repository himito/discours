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
import { errorMessage } from '#core/errors'
import type { PhonemeTrace } from '#core/phonetics/Phonemizer'
import type { Nullable } from '#core/types'
import createModule, { type ESpeakEvent, type ESpeakWorker } from './vendor/espeak-ng-fr.js'

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

/** eSpeak's French voice. */
const FRENCH_VOICE = 'fr'
/** Value returned to eSpeak's synthesis callback to let it continue. */
const CONTINUE = 0

/** The engine, loaded on first use and shared by every request. */
let engine: Nullable<Promise<ESpeakWorker>> = null

/** Loads eSpeak on the first call, from the app's `public/espeak/` folder. */
function getEngine(): Promise<ESpeakWorker> {
  engine ??= loadFrenchSynthesizer(publicDataUrl)
  return engine
}

/**
 * URL of an eSpeak data file served by the app.
 *
 * @param file - The file's name, as eSpeak asks for it.
 * @returns Its URL under the app's `espeak/` folder.
 */
function publicDataUrl(file: string): string {
  return new URL(`${import.meta.env.BASE_URL}espeak/${file}`, self.location.origin).href
}

/**
 * Loads eSpeak and selects its French voice.
 *
 * @param locateFile - Where to find each data file (a URL, or a path under Node).
 * @returns A synthesizer ready to phonemize French.
 */
export async function loadFrenchSynthesizer(
  locateFile: (file: string) => string,
): Promise<ESpeakWorker> {
  const module = await createModule({ locateFile })
  const synthesizer = new module.eSpeakNGWorker()
  synthesizer.set_voice(FRENCH_VOICE)
  return synthesizer
}

/**
 * The events of a synthesis of `text`.
 *
 * @remarks eSpeak reports events through a callback, chunk by chunk, and synthesizes
 * synchronously: by the time `synthesize` returns, every event has been reported.
 *
 * @param synthesizer - A loaded synthesizer.
 * @param text - The text to synthesize.
 * @returns Every event, in order.
 */
function synthesisEvents(synthesizer: ESpeakWorker, text: string): Promise<ESpeakEvent[]> {
  return new Promise((resolve) => {
    const events: ESpeakEvent[] = []
    synthesizer.synthesize(text, (_audio, chunk) => {
      events.push(...chunk)
      return CONTINUE
    })
    resolve(events)
  })
}

/**
 * The phonemes of `text`, each with the position of the word that produced it.
 *
 * @param synthesizer - A loaded synthesizer.
 * @param text - Normalized text.
 * @returns The phoneme events of a synthesis of the text; the audio is discarded.
 */
export async function phonemize(synthesizer: ESpeakWorker, text: string): Promise<PhonemeTrace> {
  const events = await synthesisEvents(synthesizer, text)
  return events.filter(isPhonemeEvent).map((event) => [event.text_position, event.id])
}

/** A synthesis event that reports a phoneme, in IPA. */
type PhonemeEvent = ESpeakEvent & { type: 'phoneme'; id: string }

/** Whether an event reports a (non-empty) phoneme. */
function isPhonemeEvent(event: ESpeakEvent): event is PhonemeEvent {
  return event.type === 'phoneme' && typeof event.id === 'string' && event.id !== ''
}

/**
 * Answers a request.
 *
 * @param request - The texts to phonemize, and the request's id.
 * @returns One phoneme trace per text, in order, or the error message.
 */
export async function handleRequest({ id, texts }: PhonemizeRequest): Promise<PhonemizeResponse> {
  try {
    const synthesizer = await getEngine()
    const results: PhonemeTrace[] = []
    // One synthesis at a time: the engine is not reentrant.
    for (const text of texts) results.push(await phonemize(synthesizer, text))
    return { id, results }
  } catch (error) {
    return { id, error: errorMessage(error) }
  }
}
