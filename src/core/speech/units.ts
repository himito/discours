/**
 * How a paragraph is laid out as words with their IPA: punctuation is attached to the words, and
 * reading marks stand alone.
 *
 * @remarks Shared by every screen that shows a paragraph, and by the model voice.
 *
 * @packageDocumentation
 */
import type { Item, WordItem } from '../model'

/** A word with the punctuation around it, or a reading mark. */
export type Unit =
  | {
      /** A word. */
      kind: 'word'
      /** Index of the word in the paragraph's items. */
      index: number
      /** The analyzed word. */
      item: WordItem
      /** Opening punctuation before the word (« “ ( [). */
      pre: string
      /** Punctuation after the word. */
      post: string
    }
  | {
      /** A reading mark. */
      kind: 'mark'
      /** `/`, `//`, or `→` for `[→]`. */
      text: string
    }

/** Opening punctuation, attached to the following word. */
const OPENING = /^[«“([]$/

/**
 * Groups a paragraph's items into display units.
 *
 * @remarks Opening punctuation (« “ ( [) attaches to the next word and other punctuation to the
 * previous one, so a word and its punctuation highlight together.
 */
export function displayUnits(items: Item[]): Unit[] {
  const out: Unit[] = []
  let pre = ''
  items.forEach((item, index) => {
    if (item.kind === 'word') {
      out.push({ kind: 'word', index, item, pre, post: '' })
      pre = ''
    } else if (item.kind === 'mark') {
      out.push({ kind: 'mark', text: item.text === '[→]' ? '→' : item.text })
    } else if (OPENING.test(item.text)) {
      pre += item.text + (item.space ? ' ' : '')
    } else {
      const last = out[out.length - 1]
      if (last?.kind === 'word')
        last.post += (item.text === '…' || /^[,.)\]»”]/.test(item.text) ? '' : ' ') + item.text
      else pre += item.text + ' '
    }
  })
  return out
}

/** Where a word is in the text given to the speech synthesizer. */
export interface WordRange {
  /** Offset of its first character. */
  a: number
  /** Offset just after it (and its following space). */
  b: number
  /** Index of the word in the paragraph's items. */
  index: number
}

/** Result of {@link spokenText}. */
export interface SpokenText {
  /** The text to speak. */
  text: string
  /** Each word's position in `text`, in order. */
  ranges: WordRange[]
}

/**
 * Text given to the speech synthesizer for a paragraph, and the character range of each word in
 * it.
 *
 * @remarks `/` is read as a comma and `//` as an ellipsis (a longer pause), unless punctuation
 * already marks a pause there. `[→]` is silent. The
 * ranges map boundary events (`charIndex`) back to items, to highlight the spoken word.
 */
export function spokenText(items: Item[]): SpokenText {
  let text = ''
  const ranges: WordRange[] = []
  items.forEach((item, index) => {
    if (item.kind === 'word') {
      ranges.push({ a: text.length, b: text.length + item.text.length + 1, index })
      text += item.text + ' '
    } else if (item.kind === 'mark') {
      if (item.text !== '[→]') text = withPause(text.trimEnd(), item.text === '//') + ' '
    } else if (/^[,.…)\]»”]/.test(item.text)) {
      text = text.trimEnd() + item.text + ' '
    } else text += item.text + ' '
  })
  return { text: text.trimEnd(), ranges }
}

/**
 * Adds a pause after `text`: a comma, or an ellipsis when `long`.
 *
 * @remarks Punctuation already written is kept: after a full stop nothing is added, and a comma
 * becomes an ellipsis for a long pause.
 */
function withPause(text: string, long: boolean): string {
  if (/[.!?…;:]$/.test(text)) return text
  if (text.endsWith(',')) return long ? text.slice(0, -1) + '…' : text
  return text + (long ? '…' : ',')
}

/** Item index being spoken at character `charIndex` of {@link spokenText}, or -1. */
export function spokenIndex(ranges: WordRange[], charIndex: number): number {
  if (charIndex < 0) return -1
  return ranges.find((r) => charIndex >= r.a && charIndex < r.b)?.index ?? -1
}
