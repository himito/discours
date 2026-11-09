/**
 * Application state: the speech, its analysis, settings and practice progress.
 *
 * @remarks Everything except the analysis is saved in `localStorage` (key `discours:v2`) and
 * restored on load.
 *
 * @packageDocumentation
 */
import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { analyzeText, wordKey, type AnalyzedParagraph, type WordItem } from '@/phonetics/analyze'

const STORAGE_KEY = 'discours:v2'

/** Example speech shown on first use, and by "Charger l'exemple". */
export const SAMPLE_TEXT = `# Introduction
Mesdames et Messieurs les membres du jury, / je vous remercie de m'accueillir aujourd'hui. //
Je vais d'abord vous présenter mon parcours, / puis mes principaux résultats, / et enfin les perspectives que j'envisage pour les années à venir.
# Parcours
Depuis mon arrivée au laboratoire, / mes travaux portent sur les langages de programmation et leurs applications. // Ils ont donné lieu à plusieurs collaborations internationales.`

/** Single-word practice results. */
interface WordStat {
  /** Successful attempts. */
  ok: number
  /** Total attempts. */
  n: number
}

/** What is saved in `localStorage`. */
interface Saved {
  text: string
  overrides: Record<string, string>
  showIpa: boolean
  showLinks: boolean
  rate: number
  voiceURI: string
  cur: number
  best: Record<string, number>
  hard: Record<string, number>
  wordStats: Record<string, WordStat>
}

/** Reads the saved state; missing or corrupt data gives defaults. */
function load(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Saved>
  } catch {
    return {}
  }
}

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
  const saved = load()

  const text = ref(saved.text ?? SAMPLE_TEXT)
  /** User corrections of the IPA, keyed by lower-cased word. */
  const overrides = ref<Record<string, string>>(saved.overrides ?? {})
  const showIpa = ref(saved.showIpa ?? true)
  const showLinks = ref(saved.showLinks ?? true)
  const rate = ref(saved.rate ?? 0.9)
  const voiceURI = ref(saved.voiceURI ?? '')
  /** Paragraph being practised. */
  const cur = ref(saved.cur ?? 0)
  /** Best reading score per paragraph id, in %. */
  const best = ref<Record<string, number>>(saved.best ?? {})
  /** Words missed while reading, with how many times. */
  const hard = ref<Record<string, number>>(saved.hard ?? {})
  const wordStats = ref<Record<string, WordStat>>(saved.wordStats ?? {})

  const paragraphs = ref<AnalyzedParagraph[]>([])
  const analyzedText = ref<string | null>(null)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')

  /**
   * Analyzes {@link text} unless it already has been.
   *
   * @remarks If the text changes during the analysis, it starts again on the new text. Sets
   * `status` to `loading`, then `ready` or `error`.
   */
  async function analyze(): Promise<void> {
    if (analyzedText.value === text.value && status.value === 'ready') return
    const current = text.value
    status.value = 'loading'
    error.value = ''
    try {
      const result = await analyzeText(current)
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

  /** IPA to display for a word: the user's correction if any, else the analyzed IPA. */
  function ipaOf(word: WordItem): string {
    return overrides.value[word.key] ?? word.ipa
  }

  /**
   * Saves the user's IPA for a word, applied to all its occurrences.
   *
   * @param key - The word's `key`.
   * @param ipa - New IPA; `null` or blank removes the correction.
   */
  function setOverride(key: string, ipa: string | null): void {
    const next = { ...overrides.value }
    if (ipa === null || ipa.trim() === '') delete next[key]
    else next[key] = ipa.trim()
    overrides.value = next
  }

  /**
   * Records a paragraph reading.
   *
   * @param paragraphId - The paragraph's `id`.
   * @param pct - Share of words understood, in %. Only the best score is kept.
   * @param missed - Words not understood; each is added to the words to work on.
   */
  function recordScore(paragraphId: string, pct: number, missed: string[]): void {
    best.value = { ...best.value, [paragraphId]: Math.max(best.value[paragraphId] ?? 0, pct) }
    const h = { ...hard.value }
    for (const w of missed) {
      const k = wordKey(w)
      if (k.length > 1) h[k] = (h[k] ?? 0) + 1
    }
    hard.value = h
  }

  /**
   * Records a single-word practice attempt.
   *
   * @remarks A success also lowers the word's count in the words to work on, and removes it at 0.
   *
   * @returns The word's updated statistics.
   */
  function recordWordTry(word: string, ok: boolean): WordStat {
    const k = wordKey(word)
    const st = { ...(wordStats.value[k] ?? { ok: 0, n: 0 }) }
    st.n++
    if (ok) st.ok++
    wordStats.value = { ...wordStats.value, [k]: st }
    if (ok && hard.value[k]) {
      const h = { ...hard.value }
      h[k] = h[k]! - 1
      if (h[k]! <= 0) delete h[k]
      hard.value = h
    }
    return st
  }

  /** Empties the list of words to work on. */
  function clearHard(): void {
    hard.value = {}
  }

  watch(
    [text, overrides, showIpa, showLinks, rate, voiceURI, cur, best, hard, wordStats],
    () => {
      const data: Saved = {
        text: text.value,
        overrides: overrides.value,
        showIpa: showIpa.value,
        showLinks: showLinks.value,
        rate: rate.value,
        voiceURI: voiceURI.value,
        cur: cur.value,
        best: best.value,
        hard: hard.value,
        wordStats: wordStats.value,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        /* storage unavailable: progress just won't persist */
      }
    },
    { deep: true },
  )

  return {
    text,
    overrides,
    showIpa,
    showLinks,
    rate,
    voiceURI,
    cur,
    best,
    hard,
    wordStats,
    paragraphs,
    status,
    error,
    analyze,
    ipaOf,
    setOverride,
    recordScore,
    recordWordTry,
    clearHard,
  }
})
