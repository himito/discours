/**
 * A reading aloud of one or more consecutive paragraphs: following it live, colouring the words,
 * and scoring it.
 *
 * @remarks
 * The training screen reads one paragraph ({@link readingTarget} with `from === to`); the whole
 * speech screen reads from a starting paragraph to the end. Both use the same rules:
 *
 * - the transcript is aligned with all the target's words at once (`align`);
 * - while reading, only words up to the last one heard are judged;
 * - technical terms (acronyms…) are never counted as missed;
 * - each paragraph gets its own score, as if read alone.
 *
 * @packageDocumentation
 */
import { isWord, type AnalyzedParagraph, type Item, type WordItem } from '#core/model'
import { align, type Alignment } from './align'
import type { Nullable } from '#core/types'

/** The words a reading is checked against: paragraphs `from` to `to`, concatenated. */
export interface ReadingTarget {
  /** Index of the first paragraph read. */
  from: number
  /** Index of the last paragraph that can be read. */
  to: number
  /** The paragraphs' items, concatenated. */
  items: Item[]
  /** For each item: the index of its paragraph in the speech. */
  paragraphOf: number[]
  /** For each paragraph from `from` to `to`: the index of its first item in `items`. */
  offsets: number[]
  /** The paragraphs read, from `from` to `to`. */
  paragraphs: AnalyzedParagraph[]
}

/** How a word fared in a reading. `''`: not judged (not reached yet, or a technical term). */
export type WordVerdict = '' | 'ok' | 'miss'

/**
 * Builds the target for paragraphs `from` to `to` (inclusive) of the speech.
 *
 * @param speech - The whole analyzed speech.
 * @param from - Index of the first paragraph to read.
 * @param to - Index of the last paragraph that can be read; defaults to the end of the speech, and
 *   is brought back to it if past.
 * @returns The paragraphs' items concatenated, with the way back from each item to its paragraph.
 */
export function readingTarget(
  speech: readonly AnalyzedParagraph[],
  from: number,
  to = speech.length - 1,
): ReadingTarget {
  const paragraphs = speech.slice(from, to + 1)
  const items: Item[] = []
  const paragraphOf: number[] = []
  const offsets: number[] = []
  paragraphs.forEach((p, k) => {
    offsets.push(items.length)
    for (const item of p.items) {
      items.push(item)
      paragraphOf.push(from + k)
    }
  })
  return { from, to: from + paragraphs.length - 1, items, paragraphOf, offsets, paragraphs }
}

/** A transcript aligned with a target. */
export interface ReadingState {
  /** Which words were heard. */
  alignment: Alignment
  /** Paragraph holding the last word heard; `from` when nothing was heard yet. */
  reached: number
  /** Whether anything matched at all. */
  heardAnything: boolean
}

/**
 * Aligns a transcript with the target, to follow a reading as it goes.
 *
 * @param target - What is being read.
 * @param transcript - Everything the recognizer transcribed so far.
 * @returns Which words were heard, and the paragraph the reader has reached.
 */
export function followReading(target: ReadingTarget, transcript: string): ReadingState {
  const alignment = align(target.items, transcript)
  const heardAnything = alignment.lastHit >= 0
  const reached = heardAnything ? target.paragraphOf[alignment.lastHit]! : target.from
  return { alignment, reached, heardAnything }
}

/**
 * How a word fared, for its colour.
 *
 * @param target - What is being read.
 * @param state - The transcript aligned with the target (see {@link followReading}).
 * @param paragraph - Index of the word's paragraph in the speech.
 * @param index - Index of the word in its paragraph's items.
 * @param live - `true` while reading: words after the last one heard are not judged yet.
 * @returns `ok` if understood, `miss` if not, `''` if not judged: not reached yet, outside the
 *   target, not a word, or a missed technical term.
 */
export function wordVerdict(
  target: ReadingTarget,
  state: ReadingState,
  paragraph: number,
  index: number,
  live: boolean,
): WordVerdict {
  const offset = target.offsets[paragraph - target.from]
  if (offset === undefined) return ''
  const at = offset + index
  const item = target.items[at]
  const hearing = state.alignment.perItem.get(at)
  if (!item || !isWord(item) || !hearing) return ''
  if (live ? at > state.alignment.lastHit : paragraph > state.reached) return ''
  if (hearing.heard === hearing.total) return 'ok'
  return item.tech ? '' : 'miss'
}

/** Score of one paragraph. */
export interface ParagraphScore {
  /** Index of the paragraph in the speech. */
  index: number
  /** The paragraph's id. */
  id: string
  /** Share of its counted words that were understood, in %. */
  percent: number
  /** Words not understood (technical terms excluded). */
  missed: string[]
  /** All its words, technical terms included. */
  words: number
  /** Its words that count in the score (technical terms excluded). */
  counted: number
}

/** Score of a whole reading. */
export interface ReadingScore {
  /** Scores of the paragraphs reached, in order. */
  paragraphs: ParagraphScore[]
  /** Share of the counted words understood across those paragraphs, in %. */
  percent: number
  /** Words in those paragraphs. */
  words: number
  /** Words missed in those paragraphs. */
  missed: number
}

/**
 * Which paragraphs of a reading are scored.
 *
 * - `all`: every paragraph of the target, even those not read: the training screen, where one
 *   paragraph is read on purpose.
 * - `reached`: only the paragraphs up to the last word heard: the whole speech screen, where the
 *   reader stops whenever they like. A reading that heard nothing then scores nothing.
 */
export type ScoringScope = 'all' | 'reached'

/**
 * Scores a finished reading.
 *
 * @param target - What was read.
 * @param transcript - The final transcript of the reading.
 * @param scope - Which paragraphs are scored.
 * @returns A score per paragraph scored, and the totals over them.
 */
export function scoreReading(
  target: ReadingTarget,
  transcript: string,
  scope: ScoringScope,
): ReadingScore {
  const state = followReading(target, transcript)
  const scored = target.paragraphs.slice(0, scoredParagraphCount(target, state, scope))
  // `offsets` has one entry per paragraph of the target, in the same order.
  const scores = scored.map((paragraph, k) =>
    scoreParagraph(paragraph, target.from + k, target.offsets[k]!, state.alignment),
  )
  return totalScore(scores)
}

/**
 * How many paragraphs of the target are scored, counting from the first.
 *
 * @param target - What was read.
 * @param state - The final transcript aligned with the target.
 * @param scope - Which paragraphs are scored.
 * @returns All of the target's paragraphs for `all`; for `reached`, those up to the last word
 *   heard, or none if nothing was heard.
 */
function scoredParagraphCount(
  target: ReadingTarget,
  state: ReadingState,
  scope: ScoringScope,
): number {
  if (scope === 'all') return target.paragraphs.length
  return state.heardAnything ? state.reached - target.from + 1 : 0
}

/**
 * The score of a whole reading, from the scores of its paragraphs.
 *
 * @param paragraphs - Scores of the paragraphs scored, in order.
 * @returns The paragraphs' scores, with the totals over them.
 */
function totalScore(paragraphs: ParagraphScore[]): ReadingScore {
  const counted = sumOf(paragraphs, (p) => p.counted)
  const missed = sumOf(paragraphs, (p) => p.missed.length)
  return {
    paragraphs,
    percent: percentage(counted - missed, counted),
    words: sumOf(paragraphs, (p) => p.words),
    missed,
  }
}

/**
 * Adds up a number taken from each item.
 *
 * @param items - The items.
 * @param value - The number to take from an item.
 * @returns The sum, 0 for no items.
 */
function sumOf<T>(items: readonly T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0)
}

/**
 * Scores one paragraph of a reading.
 *
 * @param paragraph - The paragraph.
 * @param index - Its index in the speech.
 * @param offset - Index of its first item in the target's items, where the alignment refers.
 * @param alignment - The final transcript aligned with the target.
 * @returns Its score, and its missed words (technical terms are never counted as missed).
 */
function scoreParagraph(
  paragraph: AnalyzedParagraph,
  index: number,
  offset: number,
  alignment: Alignment,
): ParagraphScore {
  const understood = (i: number) => {
    const hearing = alignment.perItem.get(offset + i)
    return !!hearing && hearing.heard === hearing.total
  }
  const words = paragraph.items.filter(isWord)
  const counted = words.filter((w) => !w.tech).length
  const missed = paragraph.items
    .filter((item, i): item is WordItem => isWord(item) && !item.tech && !understood(i))
    .map((w) => w.text)
  return {
    index,
    id: paragraph.id,
    percent: percentage(counted - missed.length, counted),
    missed,
    words: words.length,
    counted,
  }
}

/**
 * A share in whole percent.
 *
 * @param part - The part counted.
 * @param total - The whole.
 * @returns `part / total` rounded to a whole %, or 0 when `total` is 0.
 */
const percentage = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

/**
 * Reading speed, in words per minute.
 *
 * @param words - Words read.
 * @param seconds - Duration of the reading.
 * @returns The speed, rounded; `null` for readings under 2 seconds, too short to say.
 */
export function wordsPerMinute(words: number, seconds: number): Nullable<number> {
  return seconds > 2 ? Math.round((words / seconds) * 60) : null
}
