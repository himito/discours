/**
 * The contracts of the components: their props and the events they emit.
 *
 * @remarks Defined here rather than in each component, so a parent and its child share the same
 * types: a screen handling `SpeechText`'s `word` event knows it receives a {@link SelectedWord}.
 *
 * @packageDocumentation
 */
import type { AnalyzedParagraph, Item } from '#core/model'
import type { WordVerdict } from '#core/reading/session'
import type { DisplayOptions, DocBlock } from './print'
import type { SelectedWord } from './word'

/** Props of `SpeechText`: a paragraph's words with their IPA and reading colours. */
export interface SpeechTextProps {
  /** The paragraph's items. */
  items: Item[]
  /** Index of the item being spoken, or -1. */
  sayIndex: number
  /** How the word at item `index` fared in the reading, for its colour. */
  verdict: (index: number) => WordVerdict
  /** Larger type, for a single paragraph. */
  large?: boolean
}

/** Events of `SpeechText`. */
export interface SpeechTextEmits {
  /** A word was clicked or activated with Enter. */
  word: [word: SelectedWord]
}

/** Events of `HardWordsPanel`. */
export interface HardWordsPanelEmits {
  /** A word to work on was chosen. */
  open: [word: SelectedWord]
}

/** Props of `WordPractice`: the single-word practice panel. */
export interface WordPracticeProps {
  /** The word to practise. */
  word: SelectedWord
}

/** Events of `WordPractice`. */
export interface WordPracticeEmits {
  /** The panel is closed (× or Escape). */
  close: []
}

/** Props of `IpaEditor`. */
export interface IpaEditorProps {
  /** The IPA to start from. */
  ipa: string
}

/** Events of `IpaEditor`. */
export interface IpaEditorEmits {
  /** The edited IPA, to store. */
  save: [ipa: string]
  /** Editing was abandoned. */
  cancel: []
}

/** Props of `WordDefinition`. */
export interface WordDefinitionProps {
  /** The word as written in the speech. */
  word: string
}

/** Props of `PrintParagraph`: a paragraph in the PDF. */
export interface PrintParagraphProps extends DisplayOptions {
  /** The paragraph to show. */
  paragraph: AnalyzedParagraph
  /** Number of the paragraph in its section, as in the sidebar. */
  n: number
}

/** Props of `PrintDocBlock`: a block of the document template. */
export interface PrintDocBlockProps extends DisplayOptions {
  /** The block to show. */
  block: DocBlock
  /** Reading speed shown in the header, in words per minute. */
  wpm: number
}
