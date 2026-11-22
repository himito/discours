/** Helpers to build analyzed paragraphs by hand in tests. */
import type { AnalyzedParagraph, Item, WordItem } from '../model'
import { isTechnicalTerm, matchKeys, textId, wordKey } from '../text/words'

/** A word item, with keys computed like the analyzer does. */
export function word(text: string, extra: Partial<WordItem> = {}): WordItem {
  return {
    kind: 'word',
    text,
    space: ' ',
    ipa: '',
    link: null,
    liaison: '',
    key: wordKey(text),
    match: matchKeys(text),
    tech: isTechnicalTerm(text),
    source: 'espeak',
    ...extra,
  }
}

/** A punctuation item. */
export const punct = (text: string): Item => ({ kind: 'punct', text, space: ' ' })

/** A reading mark item (`/`, `//`, `[→]`). */
export const mark = (text: string): Item => ({ kind: 'mark', text, space: ' ' })

/**
 * A paragraph from a sentence: words separated by spaces; `,` `.` `/` `//` tokens become
 * punctuation or marks.
 */
export function paragraph(text: string, section = ''): AnalyzedParagraph {
  const items = text.split(/\s+/).map((t): Item => {
    if (t === '/' || t === '//' || t === '[→]') return mark(t)
    if (/^[,.!?;:]$/.test(t)) return punct(t)
    return word(t)
  })
  return { id: textId(text), section, text, items }
}
