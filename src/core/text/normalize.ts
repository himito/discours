/**
 * Tokenization and normalization of French text before phonemization.
 *
 * @remarks
 * eSpeak-NG reads some written forms badly: abbreviations (*M.* → "èm"), ordinals (*XXIe*),
 * acronyms (*PIB* read as one word), words with two apostrophes (*qu'aujourd'hui*). This module
 * rewrites them ({@link normalizeWord}). It also builds a character map back to the original
 * tokens ({@link normalizeSentence}), so each phoneme can be attributed to the word the user wrote.
 *
 * @packageDocumentation
 */
import type { Nullable } from '#core/types'
import { ordinal, parseRoman } from './numbers'

/**
 * Kind of a token.
 *
 * - `word`: anything pronounced: words, numbers, and spoken symbols (`%`, `€`…).
 * - `punct`: punctuation.
 * - `mark`: a reading mark written in the speech. `/` is a short pause, `//` a long pause and
 *   `[→]` a slide change.
 */
export type TokenKind = 'word' | 'punct' | 'mark'

/** A token of a paragraph, with its position in the original text. */
export interface Token {
  /** Word, punctuation or reading mark. */
  kind: TokenKind
  /** Original text of the token. */
  text: string
  /** Offset of the first character in the paragraph. */
  start: number
  /** Offset just after the last character in the paragraph. */
  end: number
  /** Whitespace that follows the token in the original text. */
  space: string
}

/** A sentence: the tokens up to a final `.`, `!`, `?` or `…`, with any closing quote. */
export interface Sentence {
  /** Tokens of the sentence, in order. */
  tokens: Token[]
}

/** A paragraph of the speech (one line of the input text). */
export interface Paragraph {
  /** Section title (from the closest `# Title` line above), or `''`. */
  section: string
  /** The line, trimmed. */
  text: string
  /** The line split into sentences. */
  sentences: Sentence[]
}

/** Abbreviations and their spoken form. */
const ABBREVIATIONS = new Map<string, string>([
  ['M.', 'Monsieur'],
  ['MM.', 'Messieurs'],
  ['Mme', 'Madame'],
  ['Mme.', 'Madame'],
  ['Mmes', 'Mesdames'],
  ['Mlle', 'Mademoiselle'],
  ['Mlles', 'Mesdemoiselles'],
  ['Dr', 'Docteur'],
  ['Dr.', 'Docteur'],
  ['Pr', 'Professeur'],
  ['Pr.', 'Professeur'],
  ['etc.', 'et cetera'],
  ['cf.', 'confer'],
  ['p.', 'page'],
  ['av.', 'avant'],
  ['apr.', 'après'],
  ['J.-C.', 'Jésus-Christ'],
])

/** All-caps words that are read as words, not spelled out letter by letter. */
const ACRONYMS_READ_AS_WORDS = new Set([
  'ONU',
  'OTAN',
  'UNESCO',
  'UNICEF',
  'SIDA',
  'NASA',
  'INSEE',
  'CAC',
  'ENA',
  'OPEP',
  'COVID',
  'ZAD',
  'CAPES',
  'ADN',
  'PACS',
  'SAMU',
  'ESA',
  'CERN',
  'INRIA',
  'INSERM',
  'IRCAM',
  'LIPN',
  'CROUS',
  'OCDE',
  'CNES',
  'MEDEF',
  'ASSEDIC',
  'URSSAF',
  'BAFA',
])

/** Acronyms whose spelling eSpeak cannot pronounce as a word. */
const RESPELLINGS = new Map([
  ['INSEE', 'insé'],
  ['CROUS', 'crousse'],
  ['URSSAF', 'urssaffe'],
])

/** All-caps tokens that look like Roman numerals but are acronyms. */
const NOT_ROMAN = new Set([
  'CD',
  'CV',
  'DC',
  'MC',
  'MD',
  'DM',
  'CDI',
  'CDD',
  'LCD',
  'DIV',
  'MIX',
  'CM',
  'CI',
  'CLI',
  'MDL',
  'DL',
])

const ABBREV_PATTERN = [...ABBREVIATIONS.keys()]
  .sort((a, b) => b.length - a.length)
  .map((a) => a.replace(/\./g, '\\.'))
  .join('|')

/**
 * One token per match.
 *
 * @remarks Alternatives are tried in order: abbreviations, dotted acronyms, numbers with thousands
 * groups, other numbers (with decimals and an ordinal suffix), words (with inner apostrophes and
 * hyphens), reading marks, then any other single character.
 */
const TOKEN_RE = new RegExp(
  [
    `(?<![\\p{L}\\p{N}])(?:${ABBREV_PATTERN})(?![\\p{L}\\p{N}])`,
    `(?:\\p{Lu}\\.){2,}`,
    `\\p{N}{1,3}(?:[ \\u00A0\\u202F]\\p{N}{3})+(?:[.,]\\p{N}+)?(?:\\p{L}+)?`,
    `\\p{N}+(?:[.,]\\p{N}+)*(?:\\p{L}+)?`,
    `[\\p{L}\\p{M}]+(?:['’\\-][\\p{L}\\p{M}]+)*['’]?`,
    `\\/{1,2}|\\[→\\]`,
    `\\S`,
  ].join('|'),
  'gu',
)

/** Symbols that are pronounced (and therefore get an IPA transcription). */
const SPOKEN_SYMBOLS = /^[%€$£&+=°§@]$/

/** Text with at least one letter or digit, in any script. */
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

/** Reading marks: `/`, `//` and `[→]`. */
const MARK = /^(?:\/{1,2}|\[→\])$/
/** Punctuation that ends a sentence. */
const SENTENCE_END = /^[.!?…]+$/
/** Closing quotes and brackets, kept with the sentence they end. */
const CLOSERS = /^[»”"')\]]$/

/**
 * Splits a paragraph into tokens.
 *
 * @param text - One paragraph.
 * @returns Tokens in order. Each token records the whitespace that follows it, so the text can be
 *   rebuilt exactly.
 *
 * @example
 * ```ts
 * tokenizeParagraph("M. Dupont, / l'équipe")
 * // → M. (word), Dupont (word), , (punct), / (mark), l'équipe (word)
 * ```
 */
export function tokenizeParagraph(text: string): Token[] {
  const matches = [...text.matchAll(TOKEN_RE)]
  return matches.map((match, i) => {
    const [token] = match
    const start = match.index
    const end = start + token.length
    const nextStart = matches[i + 1]?.index ?? text.length
    return { kind: tokenKind(token), text: token, start, end, space: text.slice(end, nextStart) }
  })
}

/**
 * What kind of token a piece of text is.
 *
 * @param token - The token's text.
 * @returns `mark` for a reading mark; `word` if it has a letter or a digit, or is a spoken symbol
 *   (`%`, `€`…); `punct` otherwise.
 */
function tokenKind(token: string): TokenKind {
  if (MARK.test(token)) return 'mark'
  if (HAS_LETTER_OR_DIGIT.test(token) || SPOKEN_SYMBOLS.test(token)) return 'word'
  return 'punct'
}

/**
 * Groups tokens into sentences.
 *
 * @remarks A sentence ends with its final punctuation (`.`, `!`, `?`, `…`), together with the
 * closing quotes, brackets and punctuation right after it (`.»`, `?!`). Liaisons never cross a
 * sentence boundary, and eSpeak gets one sentence per call. Abbreviations such as *M.* are single
 * word tokens, so their dot does not end a sentence.
 *
 * @param tokens - The tokens of one paragraph, in order.
 * @returns The sentences, in order; the last one may lack final punctuation.
 */
export function splitSentences(tokens: Token[]): Sentence[] {
  const sentences: Sentence[] = []
  let current: Token[] = []
  let ending = false
  for (const token of tokens) {
    if (ending && !belongsToSentenceEnd(token)) {
      sentences.push({ tokens: current })
      current = []
      ending = false
    }
    current.push(token)
    if (endsSentence(token)) ending = true
  }
  if (current.length) sentences.push({ tokens: current })
  return sentences
}

/**
 * Whether a token is final punctuation: `.`, `!`, `?`, `…`.
 *
 * @param token - Any token.
 * @returns `true` for sentence-ending punctuation.
 */
function endsSentence(token: Token): boolean {
  return token.kind === 'punct' && SENTENCE_END.test(token.text)
}

/**
 * Whether a token after final punctuation still belongs to the sentence: a closing quote or
 * bracket, or more final punctuation.
 *
 * @param token - A token following the sentence's final punctuation.
 * @returns `true` if the sentence continues to this token.
 */
function belongsToSentenceEnd(token: Token): boolean {
  return token.kind === 'punct' && (CLOSERS.test(token.text) || SENTENCE_END.test(token.text))
}

/**
 * Parses the whole speech.
 *
 * @param text - One paragraph per line. A line starting with `#` is a section title that applies
 *   to the paragraphs below it. Empty lines are ignored.
 * @returns The paragraphs, with their section and sentences.
 */
export function parseText(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  let section = ''
  for (const line of nonEmptyLines(text)) {
    const title = sectionTitle(line)
    if (title !== null) section = title
    else paragraphs.push(toParagraph(line, section))
  }
  return paragraphs
}

/** A section title line: `#`, `##`… then the title. */
const SECTION_TITLE = /^#+\s*(.*)$/

/**
 * The lines of a text, trimmed, without the empty ones.
 *
 * @param text - Any text, with Unix, Windows or old Mac line endings.
 * @returns The non-empty lines, in order.
 */
function nonEmptyLines(text: string): string[] {
  return text
    .split(/\r\n?|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * The title of a section title line.
 *
 * @param line - A trimmed, non-empty line.
 * @returns The title, trimmed (possibly `''`), or `null` if the line is not a section title.
 */
function sectionTitle(line: string): Nullable<string> {
  const match = line.match(SECTION_TITLE)
  return match ? match[1]!.trim() : null
}

/**
 * A paragraph line, split into sentences.
 *
 * @param line - A trimmed paragraph line.
 * @param section - Title of the section it belongs to.
 * @returns The paragraph.
 */
function toParagraph(line: string, section: string): Paragraph {
  return { section, text: line, sentences: splitSentences(tokenizeParagraph(line)) }
}

/**
 * Rewrites a word token into something eSpeak-NG pronounces correctly.
 *
 * @remarks
 * Handles, in order:
 *
 * - abbreviations: *M.* → Monsieur, *Mme* → Madame, *etc.* → et cetera;
 * - thousands separators: *1 200 000* → 1200000;
 * - *aujourd'hui* after an elision (*qu'aujourd'hui*), which eSpeak cannot read;
 * - elided prefixes: the rest of the word is normalized (*l'INSEE*, *d'XXIe*);
 * - ordinals: *21e* → vingt-et-unième, *XXIe* → vingt-et-unième, *1er* → premier;
 * - Roman numerals: *Louis XIV* → Louis 14;
 * - acronyms: spelled with letter names (*PIB* → pé-i-bé), except those read as words
 *   (*OTAN*, *UNESCO*).
 *
 * @param word - Original word.
 * @returns The text to give eSpeak. It may be longer than the word or contain hyphens.
 *
 * @example
 * ```ts
 * normalizeWord('XXIe') // → 'vingt-et-unième'
 * normalizeWord('PIB')  // → 'pé-i-bé'
 * ```
 */
export function normalizeWord(word: string): string {
  const typed = word.replace(/’/g, "'")
  const abbreviation = ABBREVIATIONS.get(typed)
  if (abbreviation) return abbreviation
  const cleaned = joinAujourdhui(joinThousands(typed))
  return (
    normalizeAfterElision(cleaned) ??
    ordinalInWords(cleaned) ??
    spellDottedAcronym(cleaned) ??
    readCapitals(cleaned) ??
    cleaned
  )
}

/** A number written with thousands groups: `1 200 000`, with ordinary or narrow spaces. */
const THOUSANDS = /^\p{N}{1,3}(?:[ \u00A0\u202F]\p{N}{3})+/u
/** The spaces that can separate thousands groups. */
const THOUSANDS_SPACES = /[ \u00A0\u202F]/g
/** A word after an elided prefix (*l'*, *qu'*…), with no other apostrophe. */
const ELIDED = /^([a-zA-Z]{1,3}')([^']+)$/
/** An ordinal: a number or Roman numeral, then *e*, *ème*… Single-letter numerals only for I, V, X. */
const ORDINAL = /^(\d+|[IVX]|[IVXLCDM]{2,})(e|è|ème|eme|ième)$/
/** *1er*, *1re*, *Ier*…: first, masculine or feminine. */
const FIRST = /^(1|I)(er|re|ère)$/
/** An acronym written with dots: *P.I.B.* */
const DOTTED_ACRONYM = /^(?:\p{Lu}\.){2,}$/u
/** A word in capitals, possibly plural: *PIB*, *CNRS*, *XIV*, *CDDs*. */
const CAPITALS = /^\p{Lu}{2,6}s?$/u

/** `1 200 000` → `1200000`: eSpeak reads a single number. */
function joinThousands(word: string): string {
  return THOUSANDS.test(word) ? word.replace(THOUSANDS_SPACES, '') : word
}

/** `qu'aujourd'hui` → `qu'aujourdhui`: eSpeak gives up on words with two apostrophes. */
function joinAujourdhui(word: string): string {
  return word.replace(/aujourd'hui/i, (match) => match.replace("'", ''))
}

/**
 * Normalizes the rest of a word after an elided prefix: *l'INSEE*, *d'XXIe*.
 *
 * @returns The prefix with the normalized rest, or `null` if the word has no elided prefix or the
 *   rest needs no change.
 */
function normalizeAfterElision(word: string): Nullable<string> {
  const match = word.match(ELIDED)
  if (!match) return null
  const [, prefix = '', rest = ''] = match
  const normalized = normalizeWord(rest)
  return normalized !== rest ? prefix + normalized : null
}

/**
 * Writes an ordinal in words: *21e*, *XXIe* → vingt-et-unième; *1er* → premier, *1re* → première.
 *
 * @returns The ordinal in words, or `null` if the word is not an ordinal.
 */
function ordinalInWords(word: string): Nullable<string> {
  const ordinalMatch = word.match(ORDINAL)
  if (ordinalMatch) {
    const numeral = ordinalMatch[1]!
    const n = /^\d+$/.test(numeral) ? Number(numeral) : parseRoman(numeral)
    if (n !== null && n > 1) return ordinal(n)
  }
  const firstMatch = word.match(FIRST)
  if (firstMatch) return firstMatch[2] === 'er' ? 'premier' : 'première'
  return null
}

/**
 * Spells an acronym written with dots: *P.I.B.* → pé-i-bé.
 *
 * @returns The spelled acronym, or `null` for other words.
 */
function spellDottedAcronym(word: string): Nullable<string> {
  return DOTTED_ACRONYM.test(word) ? spell(word.replace(/\./g, '')) : null
}

/**
 * Reads a word in capitals: as a Roman numeral (*Louis XIV* → Louis 14), as a word for the
 * acronyms read that way (*OTAN*), or spelled out (*PIB* → pé-i-bé).
 *
 * @returns How to read it, or `null` if the word is not in capitals.
 */
function readCapitals(word: string): Nullable<string> {
  if (!CAPITALS.test(word)) return null
  const roman = NOT_ROMAN.has(word) ? null : parseRoman(word)
  if (roman !== null) return String(roman)
  const singular = word.replace(/s$/, '')
  if (ACRONYMS_READ_AS_WORDS.has(word) || ACRONYMS_READ_AS_WORDS.has(singular))
    return RESPELLINGS.get(singular) ?? word.toLowerCase()
  return spell(word)
}

/** French names of the letters, used to spell acronyms. */
const LETTER_NAMES = new Map<string, string>([
  ['A', 'a'],
  ['B', 'bé'],
  ['C', 'cé'],
  ['D', 'dé'],
  ['E', 'e'],
  ['F', 'effe'],
  ['G', 'gé'],
  ['H', 'ache'],
  ['I', 'i'],
  ['J', 'ji'],
  ['K', 'ka'],
  ['L', 'elle'],
  ['M', 'emme'],
  ['N', 'enne'],
  ['O', 'o'],
  ['P', 'pé'],
  ['Q', 'ku'],
  ['R', 'erre'],
  ['S', 'esse'],
  ['T', 'té'],
  ['U', 'u'],
  ['V', 'vé'],
  ['W', 'double-vé'],
  ['X', 'ixe'],
  ['Y', 'i-grec'],
  ['Z', 'zède'],
])

/**
 * Spells an acronym with French letter names, joined by hyphens.
 *
 * @remarks Plain letters (`P I B`) don't work: eSpeak merges a final letter with the next word.
 */
function spell(acronym: string): string {
  return [...acronym].map((letter) => LETTER_NAMES.get(letter.toUpperCase()) ?? letter).join('-')
}

/**
 * In a {@link NormalizedSentence.owner} map: a character that belongs to no word (a space or
 * punctuation).
 */
export const SEPARATOR = -1

/** A sentence rewritten for eSpeak, with the way back to the original tokens. */
export interface NormalizedSentence {
  /** Text sent to eSpeak. */
  text: string
  /** For each character of `text`, index of the token it comes from, or {@link SEPARATOR}. */
  owner: Int32Array
}

/**
 * Builds the text sent to eSpeak for one sentence.
 *
 * @remarks Words go through {@link normalizeWord}. Reading marks become punctuation: `/` → `,`,
 * `//` → `.`, and `[→]` is dropped. Every run of whitespace becomes one space.
 *
 * @param tokens - Tokens of the sentence.
 * @returns The normalized text and its character → token map.
 */
export function normalizeSentence(tokens: Token[]): NormalizedSentence {
  const chunks = tokens.flatMap((token, index): Chunk[] => {
    const piece = { text: spokenForm(token), owner: token.kind === 'word' ? index : SEPARATOR }
    return token.space ? [piece, { text: ' ', owner: SEPARATOR }] : [piece]
  })
  return {
    text: chunks.map((chunk) => chunk.text).join(''),
    owner: Int32Array.from(chunks.flatMap((chunk) => Array(chunk.text.length).fill(chunk.owner))),
  }
}

/** A piece of the normalized text, and the token its characters come from (or `SEPARATOR`). */
interface Chunk {
  text: string
  owner: number
}

/** What reading marks become for eSpeak: pauses written as punctuation. `[→]` is silent. */
const MARK_PAUSES = new Map([
  ['/', ','],
  ['//', '.'],
])

/**
 * The text eSpeak reads for a token.
 *
 * @param token - Any token of a sentence.
 * @returns The normalized word, the punctuation as written, or the pause for a reading mark.
 */
function spokenForm(token: Token): string {
  switch (token.kind) {
    case 'word':
      return normalizeWord(token.text)
    case 'mark':
      return MARK_PAUSES.get(token.text) ?? ''
    case 'punct':
      return token.text
  }
}
