/**
 * How a paragraph is laid out as words with their IPA: punctuation is attached to the words, and
 * reading marks stand alone.
 *
 * @remarks Shared by the training screen and the print templates.
 *
 * @packageDocumentation
 */
import type { Item, WordItem } from '@/phonetics/analyze'

/** A word with the punctuation around it, or a reading mark. */
export type Unit =
  | {
      kind: 'word'
      /** Index of the word in the paragraph's items. */
      index: number
      item: WordItem
      /** Opening punctuation before the word (« “ ( [). */
      pre: string
      /** Punctuation after the word. */
      post: string
    }
  | {
      kind: 'mark'
      /** `/`, `//`, or `→` for `[→]`. */
      text: string
    }

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

/**
 * Text given to the speech synthesizer for a paragraph, and the character range of each word in
 * it.
 *
 * @remarks `/` is read as a comma and `//` as an ellipsis (a longer pause). `[→]` is silent. The
 * ranges map boundary events (`charIndex`) back to items, to highlight the spoken word.
 */
export function spokenText(items: Item[]): {
  text: string
  ranges: { a: number; b: number; index: number }[]
} {
  let text = ''
  const ranges: { a: number; b: number; index: number }[] = []
  items.forEach((item, index) => {
    if (item.kind === 'word') {
      ranges.push({ a: text.length, b: text.length + item.text.length + 1, index })
      text += item.text + ' '
    } else if (item.kind === 'mark') {
      if (item.text !== '[→]') text = text.trimEnd() + (item.text === '//' ? '… ' : ', ')
    } else if (/^[,.…)\]»”]/.test(item.text)) {
      text = text.trimEnd() + item.text + ' '
    } else text += item.text + ' '
  })
  return { text: text.trimEnd(), ranges }
}

/** Item index being spoken at character `charIndex` of {@link spokenText}, or -1. */
export function spokenIndex(
  ranges: { a: number; b: number; index: number }[],
  charIndex: number,
): number {
  if (charIndex < 0) return -1
  return ranges.find((r) => charIndex >= r.a && charIndex < r.b)?.index ?? -1
}
