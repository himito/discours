/**
 * {@link SpeechRecognizer} backed by the browser's speech recognition (Web Speech API).
 *
 * @remarks Available in Chrome and Edge, which send the audio to their vendor's servers.
 *
 * @packageDocumentation
 */
import {
  RecognitionFailure,
  type RecognitionSession,
  type SpeechRecognizer,
  type TranscriptListener,
  type UtteranceRecognition,
} from '#core/reading/SpeechRecognizer'
import type { Nullable } from '#core/types'

/*
 * Minimal typings: the Web Speech recognition API is not in TypeScript's DOM lib. Its lists
 * (results, alternatives) are not arrays but list-like objects, hence `ArrayLike`.
 */

/** One guess for what was said. */
export interface RecognitionAlternative {
  /** The words heard, as text. */
  readonly transcript: string
}

/** One utterance recognized: its guesses, best first. */
export interface RecognitionResult extends ArrayLike<RecognitionAlternative> {
  /** `false` while the recognizer may still change it. */
  readonly isFinal: boolean
}

/** New or updated results of a recognition. */
export interface RecognitionEvent {
  /** Index of the first result that changed. */
  readonly resultIndex: number
  /** Every result since the recognition started. */
  readonly results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: Nullable<(e: RecognitionEvent) => void>
  onerror: Nullable<(e: { error: string }) => void>
  onend: Nullable<() => void>
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

/** The browser's recognition constructor, prefixed or not. */
function recognitionConstructor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as Record<string, RecognitionCtor | undefined>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** How a recognition listens: `continuous` for reading aloud, `utterance` for one word. */
type RecognitionMode = 'continuous' | 'utterance'

/**
 * Settings of each {@link RecognitionMode}: a continuous recognition reports results as they come,
 * with one guess each; a single utterance gives up to 5 guesses at the end.
 */
const MODES = {
  continuous: { continuous: true, interimResults: true, maxAlternatives: 1 },
  utterance: { continuous: false, interimResults: false, maxAlternatives: 5 },
} satisfies Record<RecognitionMode, Partial<Recognition>>

/** A transcript so far: what is confirmed, and what is still being recognized. */
export interface Transcript {
  /** Everything confirmed since the start, each result preceded by a space. */
  finals: string
  /** What is still being recognized; it may change. */
  interim: string
}

/**
 * Reads the results that changed in a recognition event.
 *
 * @param event - The browser's results event.
 * @param finalsSoFar - What was confirmed before this event.
 * @returns The transcript: the confirmed results added to `finalsSoFar`, and the others as interim.
 */
export function readResults(event: RecognitionEvent, finalsSoFar: string): Transcript {
  let finals = finalsSoFar
  let interim = ''
  for (const result of Array.from(event.results).slice(event.resultIndex)) {
    if (result.isFinal) finals += ' ' + bestTranscript(result)
    else interim += bestTranscript(result)
  }
  return { finals, interim }
}

/** The most likely transcript of a result, or `''` if it has no guess. */
const bestTranscript = (result: RecognitionResult): string => result[0]?.transcript ?? ''

/** Errors meaning the microphone is not allowed. */
const isBlocked = (error: string) => error === 'not-allowed' || error === 'service-not-allowed'

/** Starts a recognition, ignoring "already started". */
function start(recognition: Recognition): void {
  try {
    recognition.start()
  } catch {
    /* already started */
  }
}

/** Recognizes French with the browser's speech recognition. */
export class WebSpeechRecognizer implements SpeechRecognizer {
  private readonly Ctor = recognitionConstructor()
  readonly supported = !!this.Ctor

  listen(listener: TranscriptListener): RecognitionSession {
    const recognition = this.create('continuous')
    if (!recognition) return { stop: () => {} }
    let finals = ''
    let stopped = false
    const stop = () => {
      stopped = true
      recognition.stop()
    }
    recognition.onresult = (event) => {
      const transcript = readResults(event, finals)
      finals = transcript.finals
      listener.onTranscript(transcript.finals, transcript.interim)
    }
    recognition.onerror = ({ error }) => {
      if (!isBlocked(error)) return
      stop()
      listener.onError('microphone-blocked')
    }
    // Chrome ends a continuous recognition after a silence: restart while the speaker reads.
    recognition.onend = () => {
      if (!stopped) start(recognition)
    }
    start(recognition)
    return { stop }
  }

  listenOnce(): UtteranceRecognition {
    const recognition = this.create('utterance')
    if (!recognition) return { result: Promise.resolve([]), cancel: () => {} }
    const result = new Promise<string[]>((resolve, reject) => {
      let heard: string[] = []
      recognition.onresult = (e) => {
        const [utterance] = Array.from(e.results)
        heard = utterance ? Array.from(utterance, (guess) => guess.transcript.trim()) : []
      }
      recognition.onerror = (e) => {
        if (isBlocked(e.error)) reject(new RecognitionFailure('microphone-blocked'))
      }
      recognition.onend = () => resolve(heard)
    })
    start(recognition)
    return { result, cancel: () => recognition.abort() }
  }

  /**
   * A French recognition set up for a mode.
   *
   * @param mode - How it listens (see {@link MODES}).
   * @returns The recognition, not started; `null` if the browser has no speech recognition.
   */
  private create(mode: RecognitionMode): Nullable<Recognition> {
    if (!this.Ctor) return null
    return Object.assign(new this.Ctor(), { lang: 'fr-FR' }, MODES[mode])
  }
}
