/**
 * The app's reactive state: the speech, its analysis, the settings and the progress.
 *
 * @remarks
 * A thin layer over the core: the rules live in `core/progress` and `core/phonetics`, the store
 * holds their results as reactive state for the screens. It uses two ports:
 *
 * - the `Phonemizer`, through the analyzer, to analyze the text;
 * - the `StateStorage`, to restore the state on load and save it on every change.
 *
 * @packageDocumentation
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { AnalyzedParagraph, WordItem } from '@/core/model'
import { createAnalyzer } from '@/core/phonetics/analyze'
import {
  ipaOf as correctedIpa,
  withCorrection,
  type Corrections,
} from '@/core/progress/corrections'
import {
  afterSuccess,
  withAttempt,
  withMissed,
  withScore,
  type BestScores,
  type HardWords,
  type WordStats,
} from '@/core/progress/progress'
import type { ReadingScore } from '@/core/reading/session'
import { DEFAULT_SETTINGS, type SavedState } from '@/core/state'
import { usePorts } from '@/ui/ports'
import { SAMPLE_TEXT } from '@/ui/sampleText'

/** State of the analysis. */
export type AnalysisStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * The app's single store.
 *
 * @example
 * ```ts
 * const store = useDiscoursStore()
 * await store.analyze()
 * store.paragraphs[store.cur]
 * ```
 */
export const useDiscoursStore = defineStore('discours', () => {
  const { phonemizer, storage } = usePorts()
  const analyzer = createAnalyzer(phonemizer)
  const saved = storage.load()

  // ---------------------------------------------------------------- saved state

  const text = ref(saved.text ?? SAMPLE_TEXT)
  const overrides = ref<Corrections>(saved.overrides ?? {})
  const showIpa = ref(saved.showIpa ?? DEFAULT_SETTINGS.showIpa)
  const showLinks = ref(saved.showLinks ?? DEFAULT_SETTINGS.showLinks)
  const rate = ref(saved.rate ?? DEFAULT_SETTINGS.rate)
  // `voiceURI` is the name used by versions before 2026-11.
  const voiceId = ref(saved.voiceId ?? legacyVoice(saved) ?? DEFAULT_SETTINGS.voiceId)
  const cur = ref(saved.cur ?? 0)
  const best = ref<BestScores>(saved.best ?? {})
  const hard = ref<HardWords>(saved.hard ?? {})
  const wordStats = ref<WordStats>(saved.wordStats ?? {})

  // ---------------------------------------------------------------- analysis

  const paragraphs = ref<AnalyzedParagraph[]>([])
  /** Text of the last finished analysis, to skip analyzing it again. */
  const analyzedText = ref<string | null>(null)
  const status = ref<AnalysisStatus>('idle')
  const error = ref('')

  /**
   * Analyzes {@link text} unless it already has been.
   *
   * @remarks If the text changes during the analysis, it starts again on the new text.
   */
  async function analyze(): Promise<void> {
    if (analyzedText.value === text.value && status.value === 'ready') return
    const current = text.value
    status.value = 'loading'
    error.value = ''
    try {
      const result = await analyzer(current)
      if (current !== text.value) return analyze()
      paragraphs.value = result
      analyzedText.value = current
      cur.value = Math.min(cur.value, Math.max(result.length - 1, 0))
      status.value = 'ready'
    } catch (e) {
      status.value = 'error'
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  // ---------------------------------------------------------------- actions

  /** IPA to display for a word: the user's correction if any, else the analyzed IPA. */
  const ipaOf = (word: WordItem): string => correctedIpa(word, overrides.value)

  /**
   * Corrects the IPA of a word, for all its occurrences.
   *
   * @param ipa - New IPA; `null`, blank or the analyzed IPA removes the correction.
   * @param analyzed - The word's analyzed IPA, if known.
   */
  function setCorrection(key: string, ipa: string | null, analyzed?: string): void {
    overrides.value = withCorrection(overrides.value, key, ipa, analyzed)
  }

  /** Records a reading: each paragraph's best score, and the missed words to work on. */
  function recordReading(score: ReadingScore): void {
    for (const p of score.paragraphs) {
      best.value = withScore(best.value, p.id, p.percent)
      hard.value = withMissed(hard.value, p.missed)
    }
  }

  /** Records a single-word attempt; a success lowers the word's count in the words to work on. */
  function recordAttempt(word: string, ok: boolean): void {
    wordStats.value = withAttempt(wordStats.value, word, ok)
    if (ok) hard.value = afterSuccess(hard.value, word)
  }

  /** Empties the words to work on. */
  function clearHard(): void {
    hard.value = {}
  }

  // ---------------------------------------------------------------- persistence

  watch(
    [text, overrides, showIpa, showLinks, rate, voiceId, cur, best, hard, wordStats],
    () =>
      storage.save({
        text: text.value,
        overrides: overrides.value,
        showIpa: showIpa.value,
        showLinks: showLinks.value,
        rate: rate.value,
        voiceId: voiceId.value,
        cur: cur.value,
        best: best.value,
        hard: hard.value,
        wordStats: wordStats.value,
      }),
    { deep: true },
  )

  return {
    /** The speech, in the editor's format (see `parseText`). */
    text,
    /** The user's IPA corrections, by word key. */
    overrides,
    /** Whether the IPA is shown under the words. */
    showIpa,
    /** Whether liaisons and enchaînements are shown. */
    showLinks,
    /** Speed of the model voice, 0.6 to 1.1. */
    rate,
    /** Chosen voice, or `''` for the best one. */
    voiceId,
    /** Index of the paragraph being practised. */
    cur,
    /** Best reading score per paragraph id, in %. */
    best,
    /** Words missed while reading, by word key, with how many times. */
    hard,
    /** Single-word practice results, by word key. */
    wordStats,
    /** The analyzed speech: one entry per paragraph. */
    paragraphs,
    /** State of the analysis. */
    status,
    /** Error message when `status` is `error`. */
    error,
    /** Analyzes `text` unless it already has been; sets `status`. */
    analyze,
    /** IPA to display for a word: the user's correction if any, else the analyzed IPA. */
    ipaOf,
    /** Corrects (or, with `null`, restores) the IPA of a word, for all its occurrences. */
    setCorrection,
    /** Records a reading: each paragraph's best score, and the missed words. */
    recordReading,
    /** Records a single-word attempt; a success lowers the word's count in `hard`. */
    recordAttempt,
    /** Empties the words to work on. */
    clearHard,
  }
})

/** The voice saved by older versions, under its former name. */
function legacyVoice(saved: Partial<SavedState>): string | undefined {
  return (saved as { voiceURI?: string }).voiceURI
}
