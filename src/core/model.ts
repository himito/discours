/**
 * The domain model: a speech analyzed into paragraphs of words with their pronunciation.
 *
 * @remarks Plain data, shared by every layer. Produced by `analyzeText` (`core/phonetics`).
 *
 * @packageDocumentation
 */

/**
 * How a word is linked to the next one when spoken.
 *
 * - `liaison`: a normally silent final consonant is pronounced before the next vowel
 *   (*les‿z enfants*, *sont‿t arrivés*).
 * - `enchainement`: a pronounced final consonant moves to the next vowel (*avec‿elle*).
 */
export type LinkType = 'liaison' | 'enchainement'

/** A word of the speech, with its pronunciation. */
export interface WordItem {
  /** Always `'word'`. */
  kind: 'word'
  /** Original text of the word, as written in the speech. */
  text: string
  /** Whitespace that follows the word in the original text. */
  space: string
  /**
   * IPA transcription split into syllables with dots (`a.bɔʁ`), without slashes.
   *
   * @remarks The liaison consonant is not included: it is in {@link WordItem.liaison}.
   */
  ipa: string
  /** How this word links to the next one, or `null`. */
  link: LinkType | null
  /** The consonant added by a liaison (`z`, `t`, `n`, `p`, `ʁ`…), or `''`. */
  liaison: string
  /** Key of the user's IPA corrections and statistics for this word (see `wordKey`). */
  key: string
  /** Forms compared with speech recognition output (see `matchKeys`). */
  match: string[]
  /**
   * `true` for acronyms and alphanumeric terms (CNRS, FAIR4RS). They are shown and checked, but
   * not counted in the reading score: recognizers transcribe them unpredictably.
   */
  tech: boolean
  /** Where {@link WordItem.ipa} comes from: the hand-checked lexicon or the phonemizer. */
  source: 'lexique' | 'espeak'
}

/** Punctuation (`punct`) or a reading mark written in the speech (`mark`: `/`, `//`, `[→]`). */
export interface OtherItem {
  /** Punctuation, or a reading mark (`/`, `//`, `[→]`). */
  kind: 'punct' | 'mark'
  /** Original text of the token. */
  text: string
  /** Whitespace that follows the token in the original text. */
  space: string
}

/** One token of a paragraph. */
export type Item = WordItem | OtherItem

/** A paragraph of the speech, ready to be displayed and practised. */
export interface AnalyzedParagraph {
  /**
   * Id derived from a hash of the paragraph text.
   *
   * @remarks Stays the same across sessions as long as the text doesn't change. Best scores are
   * remembered under this id.
   */
  id: string
  /** Title of the section the paragraph belongs to (a `# Title` line above it), or `''`. */
  section: string
  /** Original text of the paragraph. */
  text: string
  /** Words, punctuation and reading marks, in order. */
  items: Item[]
}

/** Whether an item is a word. */
export const isWord = (item: Item): item is WordItem => item.kind === 'word'

/** Number of words in a list of items. */
export const countWords = (items: readonly Item[]): number => items.filter(isWord).length
