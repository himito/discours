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

/** Errors meaning the microphone is not allowed. */
const isBlocked = (error: string) => error === 'not-allowed' || error === 'service-not-allowed'

/** Starts a recognition, ignoring "already started". */
function start(rec: Recognition): void {
  try {
    rec.start()
  } catch {
    /* already started */
  }
}

/** Recognizes French with the browser's speech recognition. */
export class WebSpeechRecognizer implements SpeechRecognizer {
  private readonly Ctor = recognitionConstructor()
  readonly supported = !!this.Ctor

  listen(listener: TranscriptListener): RecognitionSession {
    if (!this.Ctor) return { stop: () => {} }
    const rec = this.create(true)
    let running = true
    let finals = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]!
        if (result.isFinal) finals += ' ' + result[0]!.transcript
        else interim += result[0]!.transcript
      }
      listener.onTranscript(finals, interim)
    }
    rec.onerror = (e) => {
      if (!isBlocked(e.error)) return
      running = false
      rec.stop()
      listener.onError('microphone-blocked')
    }
    // Chrome ends a continuous recognition after a silence: restart while the speaker reads.
    rec.onend = () => {
      if (running) start(rec)
    }
    start(rec)
    return {
      stop: () => {
        running = false
        rec.stop()
      },
    }
  }

  listenOnce(): UtteranceRecognition {
    if (!this.Ctor) return { result: Promise.resolve([]), cancel: () => {} }
    const rec = this.create(false)
    const result = new Promise<string[]>((resolve, reject) => {
      let heard: string[] = []
      rec.onresult = (e) => {
        const r = e.results[0]!
        heard = Array.from({ length: r.length }, (_, i) => r[i]!.transcript.trim())
      }
      rec.onerror = (e) => {
        if (isBlocked(e.error)) reject(new RecognitionFailure('microphone-blocked'))
      }
      rec.onend = () => resolve(heard)
    })
    start(rec)
    return { result, cancel: () => rec.abort() }
  }

  /** A French recognition: continuous with interim results, or one utterance with 5 guesses. */
  private create(continuous: boolean): Recognition {
    const rec = new this.Ctor!()
    rec.lang = 'fr-FR'
    rec.continuous = continuous
    rec.interimResults = continuous
    rec.maxAlternatives = continuous ? 1 : 5
    return rec
  }
}
