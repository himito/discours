/**
 * The ports: interfaces through which the core uses the outside world.
 *
 * @remarks Each port has a browser adapter in `src/adapters`. The UI receives them from the
 * composition root (`src/main.ts`) and never depends on an adapter directly, so any adapter can be
 * replaced (another engine, another dictionary, a fake in tests) without touching the core or the
 * UI.
 *
 * | Port                | Browser adapter              |
 * | ------------------- | ---------------------------- |
 * | {@link Phonemizer}        | `EspeakPhonemizer`           |
 * | {@link SpeechSynthesizer} | `WebSpeechSynthesizer`       |
 * | {@link SpeechRecognizer}  | `WebSpeechRecognizer`        |
 * | {@link Dictionary}        | `WiktionaryDictionary`       |
 * | {@link StateStorage}      | `LocalStorageStateStorage`   |
 * | {@link PageRasterizer}    | `HtmlToImageRasterizer`      |
 *
 * @packageDocumentation
 */
export type { Dictionary, Definition, Entry, Sense } from './Dictionary'
export type { PageRasterizer } from './PageRasterizer'
export type { PhonemeTrace, Phonemizer } from './Phonemizer'
export { RecognitionFailure } from './SpeechRecognizer'
export type {
  RecognitionError,
  RecognitionSession,
  SpeechRecognizer,
  TranscriptListener,
  UtteranceRecognition,
} from './SpeechRecognizer'
export type { SpeakOptions, SpeechSynthesizer, Voice } from './SpeechSynthesizer'
export type { StateStorage } from './StateStorage'

import type { SavedState } from '../state'
import type { Dictionary } from './Dictionary'
import type { PageRasterizer } from './PageRasterizer'
import type { Phonemizer } from './Phonemizer'
import type { SpeechRecognizer } from './SpeechRecognizer'
import type { SpeechSynthesizer } from './SpeechSynthesizer'
import type { StateStorage } from './StateStorage'

/**
 * Every port the app needs, as provided by the composition root.
 *
 * @typeParam Page - Page type of the rasterizer (`HTMLElement` in the browser).
 */
export interface Ports<Page> {
  /** Phonemes of the speech, for the IPA and the liaisons. */
  phonemizer: Phonemizer
  /** The model voice. */
  synthesizer: SpeechSynthesizer
  /** Speech recognition, for reading aloud and repeating words. */
  recognizer: SpeechRecognizer
  /** French definitions. */
  dictionary: Dictionary
  /** Where the speech, settings and progress are kept. */
  storage: StateStorage<SavedState>
  /** Page images, for the PDF export. */
  rasterizer: PageRasterizer<Page>
}
