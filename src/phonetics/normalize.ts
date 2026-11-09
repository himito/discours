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
  tokens: Token[]
}

/** A paragraph of the speech (one line of the input text). */
export interface Paragraph {
  /** Section title (from the closest `# Title` line above), or `''`. */
  section: string
  /** The line, trimmed. */
  text: string
  sentences: Sentence[]
}

/** Abbreviations and their spoken form. */
const ABBREVIATIONS: Record<string, string> = {
  'M.': 'Monsieur',
  'MM.': 'Messieurs',
  Mme: 'Madame',
  'Mme.': 'Madame',
  Mmes: 'Mesdames',
  Mlle: 'Mademoiselle',
  Mlles: 'Mesdemoiselles',
  Dr: 'Docteur',
  'Dr.': 'Docteur',
  Pr: 'Professeur',
  'Pr.': 'Professeur',
  'etc.': 'et cetera',
  'cf.': 'confer',
  'p.': 'page',
  'av.': 'avant',
  'apr.': 'après',
  'J.-C.': 'Jésus-Christ',
}

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
const RESPELLINGS: Record<string, string> = { INSEE: 'insé', CROUS: 'crousse', URSSAF: 'urssaffe' }

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

const ABBREV_PATTERN = Object.keys(ABBREVIATIONS)
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

const MARK = /^(?:\/{1,2}|\[→\])$/
const SENTENCE_END = /^[.!?…]+$/
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
  const tokens: Token[] = []
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = m[0]
    const start = m.index
    const prev = tokens[tokens.length - 1]
    if (prev) prev.space = text.slice(prev.end, start)
    tokens.push({
      kind: MARK.test(t)
        ? 'mark'
        : /[\p{L}\p{N}]/u.test(t) || SPOKEN_SYMBOLS.test(t)
          ? 'word'
          : 'punct',
      text: t,
      start,
      end: start + t.length,
      space: '',
    })
  }
  const last = tokens[tokens.length - 1]
  if (last) last.space = text.slice(last.end)
  return tokens
}

/**
 * Groups tokens into sentences.
 *
 * @remarks Liaisons never cross a sentence boundary, and eSpeak gets one sentence per call.
 * Abbreviations such as *M.* are single word tokens, so their dot does not end a sentence.
 */
export function splitSentences(tokens: Token[]): Sentence[] {
  const sentences: Sentence[] = []
  let current: Token[] = []
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!
    current.push(tok)
    if (tok.kind === 'punct' && SENTENCE_END.test(tok.text)) {
      while (
        i + 1 < tokens.length &&
        tokens[i + 1]!.kind === 'punct' &&
        (CLOSERS.test(tokens[i + 1]!.text) || SENTENCE_END.test(tokens[i + 1]!.text))
      ) {
        current.push(tokens[++i]!)
      }
      sentences.push({ tokens: current })
      current = []
    }
  }
  if (current.length) sentences.push({ tokens: current })
  return sentences
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
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const heading = line.match(/^#+\s*(.*)$/)
    if (heading) {
      section = heading[1]!.trim()
      continue
    }
    paragraphs.push({ section, text: line, sentences: splitSentences(tokenizeParagraph(line)) })
  }
  return paragraphs
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
  let w = word.replace(/’/g, "'")
  const abbr = ABBREVIATIONS[w]
  if (abbr) return abbr

  // Thousands separators: "1 000 000" → "1000000"
  if (/^\p{N}{1,3}(?:[ \u00A0\u202F]\p{N}{3})+/u.test(w)) w = w.replace(/[ \u00A0\u202F]/g, '')

  // eSpeak gives up on words with two apostrophes (qu'aujourd'hui).
  w = w.replace(/aujourd'hui/i, (m) => m.replace("'", ''))

  // Ordinals: 21e, 3ème, XXIe, IIIe
  // Elided prefix (l'INSEE, d'XXIe…): normalize the rest of the word.
  const elided = w.match(/^([a-zA-Z]{1,3}')(.+)$/)
  if (elided && !/'/.test(elided[2]!)) {
    const rest = normalizeWord(elided[2]!)
    if (rest !== elided[2]) return elided[1] + rest
  }

  // Single-letter Roman ordinals only for I, V, X — "Le", "De", "Ce" are words.
  const ord = w.match(/^(\d+|[IVX]|[IVXLCDM]{2,})(e|è|ème|eme|ième)$/)
  if (ord) {
    const n = /^\d+$/.test(ord[1]!) ? Number(ord[1]) : parseRoman(ord[1]!)
    if (n !== null && n > 1) return ordinal(n)
  }
  const first = w.match(/^(1|I)(er|re|ère)$/)
  if (first) return first[2] === 'er' ? 'premier' : 'première'

  // Dotted acronyms (P.I.B.) are spelled out.
  if (/^(?:\p{Lu}\.){2,}$/u.test(w)) return spell(w.replace(/\./g, ''))

  if (/^\p{Lu}{2,6}s?$/u.test(w)) {
    const core = w.replace(/s$/, '')
    const roman = NOT_ROMAN.has(w) ? null : parseRoman(w)
    if (roman !== null) return String(roman) // Louis XIV → Louis 14
    if (ACRONYMS_READ_AS_WORDS.has(w) || ACRONYMS_READ_AS_WORDS.has(core)) {
      return RESPELLINGS[core] ?? w.toLowerCase() // OTAN → otan, read as a word
    }
    return spell(w) // PIB → pé-i-bé
  }
  return w
}

/** French names of the letters, used to spell acronyms. */
const LETTER_NAMES: Record<string, string> = {
  A: 'a',
  B: 'bé',
  C: 'cé',
  D: 'dé',
  E: 'e',
  F: 'effe',
  G: 'gé',
  H: 'ache',
  I: 'i',
  J: 'ji',
  K: 'ka',
  L: 'elle',
  M: 'emme',
  N: 'enne',
  O: 'o',
  P: 'pé',
  Q: 'ku',
  R: 'erre',
  S: 'esse',
  T: 'té',
  U: 'u',
  V: 'vé',
  W: 'double-vé',
  X: 'ixe',
  Y: 'i-grec',
  Z: 'zède',
}

/**
 * Spells an acronym with French letter names, joined by hyphens.
 *
 * @remarks Plain letters (`P I B`) don't work: eSpeak merges a final letter with the next word.
 */
function spell(acronym: string): string {
  return [...acronym].map((c) => LETTER_NAMES[c.toUpperCase()] ?? c).join('-')
}

/** A sentence rewritten for eSpeak, with the way back to the original tokens. */
export interface NormalizedSentence {
  /** Text sent to eSpeak. */
  text: string
  /** For each character of `text`, index of the token it comes from (-1 for separators). */
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
  let text = ''
  const owners: number[] = []
  tokens.forEach((tok, i) => {
    const piece =
      tok.kind === 'word'
        ? normalizeWord(tok.text)
        : tok.kind === 'mark'
          ? tok.text === '//'
            ? '.'
            : tok.text === '/'
              ? ','
              : ''
          : tok.text
    text += piece
    for (let k = 0; k < piece.length; k++) owners.push(tok.kind === 'word' ? i : -1)
    const space = tok.space ? ' ' : ''
    text += space
    if (space) owners.push(-1)
  })
  return { text, owner: Int32Array.from(owners) }
}
