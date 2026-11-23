/**
 * The speech's structure: sections, paragraph numbers, sizes and reading times.
 *
 * @packageDocumentation
 */
import { countWords, type AnalyzedParagraph } from '#core/model'
import type { Nullable } from '#core/types'

/** Reading speed aimed at, in words per minute. */
export const TARGET_WPM = 135

/** A paragraph in its section. */
export interface SectionParagraph {
  /** The paragraph. */
  paragraph: AnalyzedParagraph
  /** Index of the paragraph in the whole speech. */
  index: number
  /** Number of the paragraph in its section, from 1. */
  number: number
}

/** Consecutive paragraphs under the same title. */
export interface Section {
  /** Number of the section in the speech, from 1. */
  number: number
  /** The `# Title`, or `''` for paragraphs before any title. */
  title: string
  /** Its paragraphs, in order. */
  paragraphs: SectionParagraph[]
  /** Words in the section. */
  words: number
}

/** What names a section for the reader: its number and title (in headings, file names…). */
export type SectionHeading = Pick<Section, 'number' | 'title'>

/** Groups consecutive paragraphs by section. */
export function groupBySection(speech: readonly AnalyzedParagraph[]): Section[] {
  const sections: Section[] = []
  speech.forEach((paragraph, index) => {
    let section = sections.at(-1)
    if (!section || section.title !== paragraph.section) {
      section = { number: sections.length + 1, title: paragraph.section, paragraphs: [], words: 0 }
      sections.push(section)
    }
    section.paragraphs.push({ paragraph, index, number: section.paragraphs.length + 1 })
    section.words += countWords(paragraph.items)
  })
  return sections
}

/** Where a paragraph is. */
export interface ParagraphLocation {
  /** Its section. */
  section: Section
  /** Its number in the section, from 1. */
  number: number
}

/** Where paragraph `index` is, or `null` for an unknown index. */
export function locate(sections: readonly Section[], index: number): Nullable<ParagraphLocation> {
  for (const section of sections) {
    const found = section.paragraphs.find((p) => p.index === index)
    if (found) return { section, number: found.number }
  }
  return null
}

/** Words in the whole speech. */
export const totalWords = (speech: readonly AnalyzedParagraph[]): number =>
  speech.reduce((n, p) => n + countWords(p.items), 0)

/** Time to read `words` words at `wpm` words per minute, in seconds. */
export const readingSeconds = (words: number, wpm = TARGET_WPM): number => (words / wpm) * 60
