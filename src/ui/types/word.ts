/**
 * Types of the word panel: the word chosen for practice, and the panel's states.
 *
 * @packageDocumentation
 */
import type { WordItem } from '#core/model'
import type { Nullable } from '#core/types'

/**
 * A word chosen for practice, from the text or from the words to work on.
 *
 * @remarks Emitted by `SpeechText` and `HardWordsPanel`, held by the screens, and shown by
 * `WordPractice`.
 */
export interface SelectedWord {
  /** The word as written (punctuation is stripped for display and speech). */
  text: string
  /** The analyzed word, if it is in the speech: gives its IPA and liaison. */
  item: Nullable<WordItem>
}

/** Result of the last attempt at saying the word: `''` before any attempt. */
export type AttemptVerdict = '' | 'good' | 'bad'

/** State of a dictionary look-up. */
export type LookupState = 'loading' | 'found' | 'none' | 'error'
