/**
 * The learner's progress: best scores, words to work on, single-word practice results.
 *
 * @remarks Pure functions over plain records: each returns a new record, so the UI store can keep
 * them as reactive state and persistence can save them as they are.
 *
 * @packageDocumentation
 */
import { isWord, type AnalyzedParagraph, type WordItem } from '#core/model'
import { wordKey } from '#core/text/words'

/** Best reading score per paragraph id, in %. */
export type BestScores = Record<string, number>
/** Words missed while reading, by word key, with how many times. */
export type HardWords = Record<string, number>

/** Single-word practice results. */
export interface WordStat {
  /** Successful attempts. */
  ok: number
  /** Total attempts. */
  n: number
}
/** Single-word practice results, by word key. */
export type WordStats = Record<string, WordStat>

/** Keeps the best of the stored score and `percent`. */
export function withScore(best: BestScores, paragraphId: string, percent: number): BestScores {
  return { ...best, [paragraphId]: Math.max(best[paragraphId] ?? 0, percent) }
}

/** Adds missed words to the words to work on (one-letter words are ignored). */
export function withMissed(hard: HardWords, missed: readonly string[]): HardWords {
  const next = { ...hard }
  for (const word of missed) {
    const key = wordKey(word)
    if (key.length > 1) next[key] = (next[key] ?? 0) + 1
  }
  return next
}

/** Records one single-word attempt. */
export function withAttempt(stats: WordStats, word: string, ok: boolean): WordStats {
  const key = wordKey(word)
  const stat = stats[key] ?? { ok: 0, n: 0 }
  return { ...stats, [key]: { ok: stat.ok + (ok ? 1 : 0), n: stat.n + 1 } }
}

/** A successful attempt lowers the word's count in the words to work on, removing it at 0. */
export function afterSuccess(hard: HardWords, word: string): HardWords {
  const key = wordKey(word)
  const count = hard[key]
  if (!count) return hard
  const next = { ...hard }
  if (count > 1) next[key] = count - 1
  else delete next[key]
  return next
}

/** How far the learner is through the speech. */
export interface Overview {
  /** Paragraphs read at least once. */
  read: number
  /** Paragraphs in the speech. */
  total: number
  /** `read / total`, in %. */
  percentRead: number
  /** Average best score of the paragraphs read, or `null` if none was read. */
  average: number | null
}

/** Summarizes the best scores over the speech. */
export function overview(speech: readonly AnalyzedParagraph[], best: BestScores): Overview {
  const scores = speech.map((p) => best[p.id]).filter((v): v is number => v !== undefined)
  const total = speech.length
  return {
    read: scores.length,
    total,
    percentRead: total ? (scores.length / total) * 100 : 0,
    average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  }
}

/** How often a word was missed: `high` (3 times or more), `mid` (twice) or `low`. */
export type MissLevel = 'high' | 'mid' | 'low'

/** The {@link MissLevel} for a number of misses. */
export const missLevel = (count: number): MissLevel =>
  count >= 3 ? 'high' : count === 2 ? 'mid' : 'low'

/** A word to work on, most missed first in lists. */
export interface HardWord {
  /** The word's key. */
  key: string
  /** Times it was missed. */
  missed: number
  /** The analyzed word, if it is still in the speech. */
  item: WordItem | null
}

/** The words to work on, most missed first. */
export function hardWordList(speech: readonly AnalyzedParagraph[], hard: HardWords): HardWord[] {
  const byKey = wordsByKey(speech)
  return Object.entries(hard)
    .sort((a, b) => b[1] - a[1])
    .map(([key, missed]) => ({ key, missed, item: byKey.get(key) ?? null }))
}

/**
 * The words to work on that appear in some paragraphs, most missed first.
 *
 * @param limit - How many to return at most.
 */
export function hardWordsIn(
  paragraphs: readonly AnalyzedParagraph[],
  hard: HardWords,
  limit: number,
): WordItem[] {
  return [...wordsByKey(paragraphs).values()]
    .filter((w) => hard[w.key])
    .sort((a, b) => (hard[b.key] ?? 0) - (hard[a.key] ?? 0))
    .slice(0, limit)
}

/** The first occurrence of each word, by key. */
export function wordsByKey(paragraphs: readonly AnalyzedParagraph[]): Map<string, WordItem> {
  const out = new Map<string, WordItem>()
  for (const p of paragraphs)
    for (const item of p.items) if (isWord(item) && !out.has(item.key)) out.set(item.key, item)
  return out
}
