/**
 * Scoring of a reading against the text.
 *
 * @remarks What the recognizer heard is aligned with the expected words by
 * longest common subsequence, with a tolerant word comparison
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
  /** Index of the last item that was heard, or -1 if none (words after it are not judged yet). */
  lastHit: number
}

/**
 * Aligns a recognizer transcript with the words of a paragraph.
 *
 * @remarks Each word may have several parts (see `WordItem.match`: *l'équipe* → `l`, `equipe`). A
 * word counts as understood when all its parts were heard. The parts are aligned with the heard
 * words by longest common subsequence, which tolerates skipped, repeated and extra words. Runs in
 * O(expected × heard) time and memory, which is fine for a paragraph.
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
  const expected = expectedParts(items)
  const heard = transcriptKeys(heardText)
  const matched = matchedParts(expected, heard)
  return tallyByWord(expected, matched)
}

/** A part of a word to be heard: its comparison key, and the item it belongs to. */
interface ExpectedPart {
  key: string
  item: number
}

/** The parts of every word of the paragraph, in reading order. */
function expectedParts(items: readonly Item[]): ExpectedPart[] {
  return items.flatMap((item, index) =>
    item.kind === 'word' ? item.match.map((key) => ({ key, item: index })) : [],
  )
}

/**
 * Which expected parts were heard, as indexes into `expected`.
 *
 * @remarks Walks the longest common subsequence: a part and a heard word that match are paired;
 * otherwise whichever side keeps the longer remaining subsequence is skipped.
 */
function matchedParts(expected: readonly ExpectedPart[], heard: readonly string[]): Set<number> {
  const remaining = commonSuffixLengths(expected, heard)
  const matched = new Set<number>()
  let e = 0
  let h = 0
  while (e < expected.length && h < heard.length) {
    if (sameWord(expected[e]!.key, heard[h]!)) {
      matched.add(e)
      e++
      h++
    } else if (remaining.at(e + 1, h) >= remaining.at(e, h + 1)) e++
    else h++
  }
  return matched
}

/** Lengths of the longest common subsequences of every pair of suffixes. */
interface SuffixLengths {
  /** Length for `expected` from part `e` on and `heard` from word `h` on. */
  at(e: number, h: number): number
}

/**
 * Computes {@link SuffixLengths} by dynamic programming, from the ends of both lists.
 */
function commonSuffixLengths(
  expected: readonly ExpectedPart[],
  heard: readonly string[],
): SuffixLengths {
  const rows = Array.from({ length: expected.length + 1 }, () => new Uint16Array(heard.length + 1))
  const at = (e: number, h: number) => rows[e]![h]!
  for (let e = expected.length - 1; e >= 0; e--) {
    for (let h = heard.length - 1; h >= 0; h--) {
      rows[e]![h] = sameWord(expected[e]!.key, heard[h]!)
        ? at(e + 1, h + 1) + 1
        : Math.max(at(e + 1, h), at(e, h + 1))
    }
  }
  return { at }
}

/** Counts heard and total parts per word, and finds the last word heard. */
function tallyByWord(expected: readonly ExpectedPart[], matched: ReadonlySet<number>): Alignment {
  const perItem = new Map<number, WordHearing>()
  let lastHit = -1
  expected.forEach((part, index) => {
    const hearing = perItem.get(part.item) ?? { heard: 0, total: 0 }
    hearing.total++
    if (matched.has(index)) {
      hearing.heard++
      lastHit = Math.max(lastHit, part.item)
    }
    perItem.set(part.item, hearing)
  })
  return { perItem, lastHit }
}

/** Words shorter than this must be heard exactly, in single-word practice. */
const MIN_FUZZY_LENGTH = 4
/** Letters that may differ between a long heard word and its target. */
const MAX_DIFFERENT_LETTERS = 1

/**
 * Whether a heard word is close enough to the target, in single-word practice.
 *
 * @remarks Stricter than {@link sameWord}. The words must be equal, or, when both have at least
 * 4 letters, differ by at most one letter at the same position, or one must start with the other.
 *
 * @param heard - The heard word, normalized with `normForMatch`.
 * @param target - The word to say, normalized the same way.
 */
export function closeEnough(heard: string, target: string): boolean {
  if (heard === target) return true
  if (heard.length < MIN_FUZZY_LENGTH || target.length < MIN_FUZZY_LENGTH) return false
  return (
    differentLetters(heard, target) <= MAX_DIFFERENT_LETTERS ||
    heard.startsWith(target) ||
    target.startsWith(heard)
  )
}

/** Positions where two words have different letters; extra letters of the longer one count. */
function differentLetters(a: string, b: string): number {
  const length = Math.max(a.length, b.length)
  return Array.from({ length }, (_, i) => a[i] !== b[i]).filter(Boolean).length
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
