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

/** `localStorage` key of the saved state. */
const STORAGE_KEY = 'discours:v2'

/** Example speech shown on first use, and by "Charger l'exemple". */
export const SAMPLE_TEXT = `# Introduction
Bienvenue dans l'application Discours ! // Ici, / chaque mot de votre texte est accompagné de sa prononciation.
Écoutez d'abord le modèle, / puis lisez le paragraphe à voix haute. // Les mots mal compris s'affichent en rouge.
# Conseils
Prenez votre temps, / respirez aux pauses / et soignez les liaisons, / comme dans « les enfants » ou « un grand ami ». //
Quand vous êtes prêt, / remplacez cet exemple par votre propre discours.`

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
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Partial<Saved>
  } catch {
    /* storage unavailable or corrupt */
  }
  return {}
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

  /** The speech, in the editor's format. */
  const text = ref(saved.text ?? SAMPLE_TEXT)
  /** User corrections of the IPA, keyed by lower-cased word. */
  const overrides = ref<Record<string, string>>(saved.overrides ?? {})
  /** Whether the IPA is shown. */
  const showIpa = ref(saved.showIpa ?? true)
  /** Whether liaisons and enchaînements are shown. */
  const showLinks = ref(saved.showLinks ?? true)
  /** Speed of the model voice. */
  const rate = ref(saved.rate ?? 0.9)
  /** Chosen voice, or `''` for the best one. */
  const voiceURI = ref(saved.voiceURI ?? '')
  /** Paragraph being practised. */
  const cur = ref(saved.cur ?? 0)
  /** Best reading score per paragraph id, in %. */
  const best = ref<Record<string, number>>(saved.best ?? {})
  /** Words missed while reading, with how many times. */
  const hard = ref<Record<string, number>>(saved.hard ?? {})
  /** Single-word practice results, by word key. */
  const wordStats = ref<Record<string, WordStat>>(saved.wordStats ?? {})

  /** The analyzed speech. */
  const paragraphs = ref<AnalyzedParagraph[]>([])
  /** Text of the last finished analysis, to skip analyzing it again. */
  const analyzedText = ref<string | null>(null)
  /** State of the analysis. */
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  /** Error message of a failed analysis. */
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

  /** The state to save: the speech, settings and progress. */
  function snapshot(): Saved {
    return {
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
  }

  watch(
    [text, overrides, showIpa, showLinks, rate, voiceURI, cur, best, hard, wordStats],
    () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()))
      } catch {
        /* storage unavailable: progress just won't persist */
      }
    },
    { deep: true },
  )

  return {
    /** The speech, in the editor's format (see `parseText`). */
    text,
    /** User corrections of the IPA, keyed by word key. */
    overrides,
    /** Whether the IPA is shown under the words. */
    showIpa,
    /** Whether liaisons and enchaînements are shown. */
    showLinks,
    /** Speed of the model voice, 0.6 to 1.1. */
    rate,
    /** Chosen voice (`voiceURI`), or `''` for the best one. */
    voiceURI,
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
    /** Saves (or, with `null`, removes) the user's IPA for a word, for all its occurrences. */
    setOverride,
    /** Records a paragraph reading: keeps the best score and adds the missed words. */
    recordScore,
    /** Records a single-word attempt; a success lowers the word's count in `hard`. */
    recordWordTry,
    /** Empties the words to work on. */
    clearHard,
  }
})
