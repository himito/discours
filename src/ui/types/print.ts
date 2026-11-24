/**
 * Types of the PDF screen and its templates.
 *
 * @packageDocumentation
 */
import type { AnalyzedParagraph } from '#core/model'
import type { Section } from '#core/speech/sections'

/** PDF template: cards to cut out, or a document. */
export type PdfTemplate = 'cards' | 'document'

/** Text size of the templates. */
export type TextSize = 'normal' | 'large'

/** What the templates show besides the words. */
export interface DisplayOptions {
  /** Whether to show the IPA under each word. */
  ipa: boolean
  /** Whether to show liaisons and enchaînements. */
  links: boolean
  /** Whether to show the reading marks (`/`, `//`, `→`). */
  marks: boolean
}

/** A paragraph with its number in its section, as in the sidebar. */
export interface NumberedParagraph {
  /** The paragraph. */
  paragraph: AnalyzedParagraph
  /** Number in its section, from 1. */
  number: number
}

/** A card: some paragraphs of a section, possibly one part of several. */
export interface Card {
  /** The section the card belongs to. */
  section: Section
  /** The paragraphs on this card. */
  paragraphs: NumberedParagraph[]
  /** Number of this card in the section, from 1. */
  part: number
  /** Cards the section needs. */
  parts: number
}

/** The document's header: its title, size and reading time, and the legend. */
export interface HeadBlock {
  /** Always `'head'`. */
  kind: 'head'
  /** Words in the document. */
  words: number
  /** Reading time, as text (*2 min 30*). */
  duration: string
}

/** A section title. */
export interface SectionBlock {
  /** Always `'section'`. */
  kind: 'section'
  /** Number of the section in the speech, from 1. */
  number: number
  /** The section's title. */
  title: string
}

/** A paragraph of the document, with its number in its section. */
export interface ParagraphBlock extends NumberedParagraph {
  /** Always `'para'`. */
  kind: 'para'
}

/** A block of the document template, the unit the pages are filled with. */
export type DocBlock = HeadBlock | SectionBlock | ParagraphBlock

/** Progress of a PDF export. */
export interface ExportProgress {
  /** Pages captured so far. */
  done: number
  /** Pages to capture. */
  total: number
}
