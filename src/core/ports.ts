/**
 * The set of ports the app needs.
 *
 * @remarks Each module of the core defines the ports it uses, next to its logic. Their browser
 * implementations are in `src/adapters`:
 *
 * | Module       | Port                      | Browser adapter                       |
 * | ------------ | ------------------------- | ------------------------------------- |
 * | `phonetics`  | {@link Phonemizer}        | `espeak/EspeakPhonemizer`             |
 * | `reading`    | {@link SpeechSynthesizer} | `webspeech/WebSpeechSynthesizer`      |
 * | `reading`    | {@link SpeechRecognizer}  | `webspeech/WebSpeechRecognizer`       |
 * | `dictionary` | {@link Dictionary}        | `wiktionary/WiktionaryDictionary`     |
 * | `state`      | {@link StateStorage}      | `storage/LocalStorageStateStorage`    |
 * | `print`      | {@link PageRasterizer}    | `pdf/HtmlToImageRasterizer`           |
 *
 * The composition root (`src/main.ts`) creates the adapters (`createBrowserPorts`); the UI
 * receives them as {@link Ports} and never imports an adapter, so any of them can be replaced
 * (another engine, another dictionary, a fake in tests) without touching the core or the UI.
 *
 * @packageDocumentation
 */
import type { Dictionary } from './dictionary/Dictionary'
import type { Phonemizer } from './phonetics/Phonemizer'
import type { PageRasterizer } from './print/PageRasterizer'
import type { SpeechRecognizer } from './reading/SpeechRecognizer'
import type { SpeechSynthesizer } from './reading/SpeechSynthesizer'
import type { SavedState } from './state/state'
import type { StateStorage } from './state/StateStorage'

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
