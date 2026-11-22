/**
 * Port: speech recognition, for reading aloud and repeating words.
 *
 * @packageDocumentation
 */

/** Why recognition failed. `microphone-blocked`: the user or the browser denied the microphone. */
export type RecognitionError = 'microphone-blocked'

/** Error thrown by a recognizer, carrying the {@link RecognitionError}. */
export class RecognitionFailure extends Error {
  /** Why recognition failed. */
  readonly reason: RecognitionError

  constructor(reason: RecognitionError) {
    super(`Speech recognition failed: ${reason}`)
    this.name = 'RecognitionFailure'
    this.reason = reason
  }
}

/** Receives the transcript of a continuous recognition. */
export interface TranscriptListener {
  /**
   * Called on every update.
   *
   * @param finals - Everything confirmed since the start.
   * @param interim - What is still being recognized (may change).
   */
  onTranscript(finals: string, interim: string): void
  /** Called when recognition stops because of an error. */
  onError(error: RecognitionError): void
}

/** A recognition in progress. */
export interface RecognitionSession {
  /** Stops listening. The last results may still arrive shortly after. */
  stop(): void
}

/** A single-utterance recognition in progress. */
export interface UtteranceRecognition {
  /**
   * Up to 5 alternatives for what was heard, best first; empty if nothing was heard.
   *
   * @remarks Rejects with a {@link RecognitionFailure} when the microphone is blocked.
   */
  result: Promise<string[]>
  /** Stops listening; `result` then resolves with what was heard so far. */
  cancel(): void
}

/**
 * Recognizes spoken French.
 *
 * @remarks Implemented by `WebSpeechRecognizer` (the browser's speech recognition).
 */
export interface SpeechRecognizer {
  /** Whether speech recognition is available. */
  readonly supported: boolean
  /** Listens until stopped, reporting the transcript as it grows. */
  listen(listener: TranscriptListener): RecognitionSession
  /** Listens for one short utterance, such as a single word. */
  listenOnce(): UtteranceRecognition
}
