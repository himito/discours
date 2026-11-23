/**
 * Scoring of a reading against the text.
 *
 * @remarks Same algorithm as the original prototype. What the recognizer heard is aligned with the
 * expected words by longest common subsequence, with a tolerant word comparison
 * ({@link sameWord}). Skipped or misheard words are then missing from the alignment.
 *
 * @packageDocumentation
 */
import type { Item } from '#core/model'
import { matchKeys, transcriptKeys } from '#core/text/words'

/** Removes the endings recognizers often get wrong (plural, feminine, verb endings). */
const stem = (w: string) => w.replace(/s$|x$|e$|es$|ent$/, '')

/**
 * Whether a heard word matches an expected one, with some tolerance.
 *
 * @remarks Recognizers often confuse homophones (*arrivé* / *arrivés* / *arrivée*). So two words
 * match if they are equal, if one starts with the other (both over 3 letters), or if they are equal
 * once their ending is removed.
 *
 * @param a - Expected word, normalized with `normForMatch`.
 * @param b - Heard word, normalized the same way.
 */
export function sameWord(a: string, b: string): boolean {
  return (
    a === b ||
    (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a))) ||
    (stem(a) === stem(b) && a.length > 2)
  )
}

/** Result of {@link align}. */
/** How much of a word was heard. */
export interface WordHearing {
  /** Parts of the word that were heard (see `WordItem.match`). */
  heard: number
  /** Parts of the word: 1, or 2 and more for an elision (*l'équipe*). */
  total: number
}

/** Result of {@link align}. */
export interface Alignment {
  /** For each word's item index: how many of its parts were heard, out of how many. */
  perItem: Map<number, WordHearing>
  /** Index of the last item that was heard (words after it are not judged yet). */
  lastHit: number
}

/**
 * Aligns a recognizer transcript with the words of a paragraph.
 *
 * @remarks Each word may have several parts (see `WordItem.match`: *l'équipe* → `l`, `equipe`). A
 * word counts as understood when all its parts were heard. Runs in O(expected × heard) time and
 * memory, which is fine for a paragraph.
 *
 * @param items - Items of the paragraph.
 * @param heardText - Everything the recognizer transcribed so far.
 * @returns Heard parts per word, and the index of the last word heard.
 *
 * @example
 * ```ts
 * const { perItem } = align(paragraph.items, 'les enfants sont arrivé')
 * perItem.get(3) // → { heard: 1, total: 1 }  ("arrivés" matched "arrivé")
 * ```
 */
export function align(items: Item[], heardText: string): Alignment {
  const exp: { k: string; item: number }[] = []
  items.forEach((it, i) => {
    if (it.kind === 'word') it.match.forEach((k) => exp.push({ k, item: i }))
  })
  const heard = transcriptKeys(heardText)

  const n = exp.length
  const m = heard.length
  const D = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      D[i]![j] = sameWord(exp[i]!.k, heard[j]!)
        ? D[i + 1]![j + 1]! + 1
        : Math.max(D[i + 1]![j]!, D[i]![j + 1]!)
    }
  }
  const hit = new Set<number>()
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (sameWord(exp[i]!.k, heard[j]!)) {
      hit.add(i)
      i++
      j++
    } else if (D[i + 1]![j]! >= D[i]![j + 1]!) i++
    else j++
  }

  const perItem = new Map<number, { heard: number; total: number }>()
  let lastHit = -1
  exp.forEach((e, k) => {
    const v = perItem.get(e.item) ?? { heard: 0, total: 0 }
    v.total++
    if (hit.has(k)) {
      v.heard++
      lastHit = Math.max(lastHit, e.item)
    }
    perItem.set(e.item, v)
  })
  return { perItem, lastHit }
}

/**
 * Whether a heard word is close enough to the target, in single-word practice.
 *
 * @remarks Stricter than {@link sameWord}. The words must be equal, or (both 4 letters or more)
 * differ by at most one letter at the same position, or one must start with the other.
 */
export function closeEnough(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 4 || b.length < 4) return false
  let d = 0
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++
  return d <= 1 || a.startsWith(b) || b.startsWith(a)
}

/**
 * Whether a word was said, in single-word practice.
 *
 * @param word - The word to say, as written.
 * @param alternatives - What the recognizer heard, best guess first.
 * @returns `true` if any heard word is {@link closeEnough} to the word's last part (the part after
 *   an elision: *l'équipe* → *equipe*).
 */
export function isWordRecognized(word: string, alternatives: readonly string[]): boolean {
  const target = matchKeys(word).at(-1)
  if (!target) return false
  return alternatives.some((alt) => transcriptKeys(alt).some((heard) => closeEnough(heard, target)))
}
