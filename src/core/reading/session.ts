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

/** Builds the target for paragraphs `from` to `to` (inclusive) of the speech. */
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

/** Aligns a transcript with the target. */
export function followReading(target: ReadingTarget, transcript: string): ReadingState {
  const alignment = align(target.items, transcript)
  const heardAnything = alignment.lastHit >= 0
  const reached = heardAnything ? target.paragraphOf[alignment.lastHit]! : target.from
  return { alignment, reached, heardAnything }
}

/**
 * How a word fared.
 *
 * @param paragraph - Index of the word's paragraph in the speech.
 * @param index - Index of the word in its paragraph's items.
 * @param live - `true` while reading: words after the last one heard are not judged yet.
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
 * Scores a finished reading.
 *
 * @param scope - Which paragraphs are scored: `all` of the target, or only those `reached` (up to
 *   the last word heard). A reading that heard nothing then scores nothing.
 */
export function scoreReading(
  target: ReadingTarget,
  transcript: string,
  scope: 'all' | 'reached',
): ReadingScore {
  const state = followReading(target, transcript)
  const last = scope === 'all' ? target.to : state.heardAnything ? state.reached : target.from - 1
  const paragraphs = target.paragraphs
    .slice(0, last - target.from + 1)
    .map((p, k) => scoreParagraph(p, target.from + k, target.offsets[k]!, state.alignment))

  const sum = (f: (p: ParagraphScore) => number) => paragraphs.reduce((n, p) => n + f(p), 0)
  const missed = sum((p) => p.missed.length)
  const counted = sum((p) => p.counted)
  return {
    paragraphs,
    percent: percentage(counted - missed, counted),
    words: sum((p) => p.words),
    missed,
  }
}

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

/** `part / total` in whole %, 0 when `total` is 0. */
const percentage = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

/**
 * Reading speed, in words per minute.
 *
 * @returns `null` for readings under 2 seconds, too short to say.
 */
export function wordsPerMinute(words: number, seconds: number): number | null {
  return seconds > 2 ? Math.round((words / seconds) * 60) : null
}
