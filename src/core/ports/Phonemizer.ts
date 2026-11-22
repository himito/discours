/**
 * Port: turns French text into phonemes.
 *
 * @packageDocumentation
 */

/**
 * Phonemes of one text, in order.
 *
 * @remarks `position` is the 1-based character index, in the text sent, of the word that produced
 * the phoneme: it is what lets the analysis align phonemes with words. `ipa` may carry stress marks
 * (`ˈa`); the analysis removes them.
 */
export type PhonemeTrace = [position: number, ipa: string][]

/**
 * Produces the phonemes of French texts, with the position of the word behind each one.
 *
 * @remarks Implemented by `EspeakPhonemizer` (eSpeak-NG in a web worker). Tests use a fake.
 */
export interface Phonemizer {
  /**
   * Phonemizes several texts.
   *
   * @param texts - Texts to phonemize, already normalized (see `normalizeSentence`).
   * @returns One trace per text, in the same order.
   */
  phonemize(texts: readonly string[]): Promise<PhonemeTrace[]>
  /** Starts loading the engine in the background, so the first analysis doesn't wait for it. */
  warmUp(): void
}
