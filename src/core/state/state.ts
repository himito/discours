/**
 * What the app remembers between visits: the speech, the settings and the progress.
 *
 * @packageDocumentation
 */
import type { BestScores, HardWords, WordStats } from '#core/progress/progress'
import type { Corrections } from '#core/progress/corrections'

/** Display and voice settings. */
export interface Settings {
  /** Whether the IPA is shown under the words. */
  showIpa: boolean
  /** Whether liaisons and enchaînements are shown. */
  showLinks: boolean
  /** Speed of the model voice, 0.6 to 1.1. */
  rate: number
  /** Chosen voice, or `''` for the best one. */
  voiceId: string
}

/** The state saved through the `StateStorage` port. */
export interface SavedState extends Settings {
  /** The speech, in the editor's format. */
  text: string
  /** The user's IPA corrections. */
  overrides: Corrections
  /** Index of the paragraph being practised. */
  cur: number
  /** Best reading score per paragraph id. */
  best: BestScores
  /** Words to work on. */
  hard: HardWords
  /** Single-word practice results. */
  wordStats: WordStats
}

/** Default settings. */
export const DEFAULT_SETTINGS: Settings = {
  showIpa: true,
  showLinks: true,
  rate: 0.9,
  voiceId: '',
}
