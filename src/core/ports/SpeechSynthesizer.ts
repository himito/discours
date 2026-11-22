/**
 * Port: the model voice.
 *
 * @packageDocumentation
 */

/** A voice the synthesizer can speak with. */
export interface Voice {
  /** Stable identifier, saved in the settings. */
  id: string
  /** Name shown to the user. */
  name: string
  /** Language tag, e.g. `fr-FR`. */
  lang: string
}

/** How to speak a text. */
export interface SpeakOptions {
  /** Speaking rate: 1 is normal, 0.6 is slow. */
  rate: number
  /** Voice to use ({@link Voice.id}); empty means the best available one. */
  voiceId: string
  /** Called with the character index of each word as it is spoken. */
  onWord?: (charIndex: number) => void
}

/**
 * Speaks French text aloud.
 *
 * @remarks Implemented by `WebSpeechSynthesizer` (the browser's speech synthesis). Only one text
 * is spoken at a time: `speak` interrupts the previous one.
 */
export interface SpeechSynthesizer {
  /** Whether speech synthesis is available at all. */
  readonly supported: boolean
  /** French voices, best first. May be empty until the platform has loaded them. */
  voices(): Voice[]
  /**
   * Calls `listener` whenever the list of voices changes.
   *
   * @returns A function that removes the listener.
   */
  onVoicesChanged(listener: () => void): () => void
  /**
   * Speaks `text`, stopping whatever was playing.
   *
   * @returns `true` when the text was spoken to the end, `false` if it was stopped or failed.
   */
  speak(text: string, options: SpeakOptions): Promise<boolean>
  /** Stops speaking. */
  stop(): void
}
