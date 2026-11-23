/**
 * The browser adapters, assembled: one implementation of each port.
 *
 * @packageDocumentation
 */
import type { Ports } from '#core/ports'
import type { SavedState } from '#core/state/state'
import { EspeakPhonemizer } from './espeak/EspeakPhonemizer'
import { HtmlToImageRasterizer } from './pdf/HtmlToImageRasterizer'
import { LocalStorageStateStorage } from './storage/LocalStorageStateStorage'
import { WebSpeechRecognizer } from './webspeech/WebSpeechRecognizer'
import { WebSpeechSynthesizer } from './webspeech/WebSpeechSynthesizer'
import { WiktionaryDictionary } from './wiktionary/WiktionaryDictionary'

/** `localStorage` key of the saved state. */
const STORAGE_KEY = 'discours:v2'

/** Creates the adapters the app uses in the browser. */
export function createBrowserPorts(): Ports<HTMLElement> {
  return {
    phonemizer: new EspeakPhonemizer(),
    synthesizer: new WebSpeechSynthesizer(),
    recognizer: new WebSpeechRecognizer(),
    dictionary: new WiktionaryDictionary(),
    storage: new LocalStorageStateStorage<SavedState>(STORAGE_KEY),
    rasterizer: new HtmlToImageRasterizer(),
  }
}
