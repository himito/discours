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
