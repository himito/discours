/**
 * Phonetic analysis of a French speech.
 *
 * @remarks
 * {@link createAnalyzer} returns a function that turns raw text into paragraphs of items. Each word
 * carries its IPA transcription split into syllables, how it links to the next word (liaison or
 * enchaînement), and the keys used to compare it with speech recognition output.
 *
 * Pipeline:
 *
 * 1. `parseText` splits the text into paragraphs, sentences and tokens.
 * 2. `normalizeSentence` rewrites what phonemizers read badly and keeps a character map.
 * 3. The {@link Phonemizer} returns, for every phoneme, the position of the word that produced it.
 *    Phonemes are grouped per token through that map.
 * 4. The IPA comes from the hand-checked lexicon (`lexiconIpa`) when it knows the word, and from the
 *    phonemizer otherwise (`syllabify`).
 * 5. Liaisons are found by comparing each word in context with the same word pronounced alone.
 *
 * @packageDocumentation
 */
import type { AnalyzedParagraph, Item, WordItem } from '#core/model'
import {
  normalizeSentence,
  normalizeWord,
  parseText,
  SEPARATOR,
  type Paragraph,
  type Sentence,
  type Token,
} from '#core/text/normalize'
import { isTechnicalTerm, matchKeys, textId, wordKey } from '#core/text/words'
import { lexiconIpa } from './lexicon'
import type { PhonemeTrace, Phonemizer } from './Phonemizer'
import { cleanPhoneme, fixGlides, fixPalatal, isVowel, syllabify } from './syllables'
import type { Nullable } from '#core/types'

/**
 * Analyzes a French speech.
 *
 * @param text - The speech: one paragraph per line, `# Title` lines for sections, `/`, `//` and
 *   `[→]` as reading marks.
 * @returns The paragraphs, in order. Title lines are not paragraphs: they set
 *   {@link AnalyzedParagraph.section}.
 */
export type Analyzer = (text: string) => Promise<AnalyzedParagraph[]>

/** Phonemes of each token of a sentence, in context: `[token][phoneme]`. */
type TokenPhonemes = string[][]

/**
 * Creates an analyzer that uses `phonemizer`.
 *
 * @remarks The analyzer remembers how each word sounds alone, so analyzing the text again after a
 * small edit only phonemizes the new words.
 *
 * @example
 * ```ts
 * const analyze = createAnalyzer(new EspeakPhonemizer())
 * const [p] = await analyze('Les enfants sont arrivés.')
 * // p.items[0] → { text: 'Les', ipa: 'le', link: 'liaison', liaison: 'z', … }
 * ```
 */
export function createAnalyzer(phonemizer: Phonemizer): Analyzer {
  const alone = new IsolatedPronunciations(phonemizer)

  return async (text) => {
    const paragraphs = parseText(text)
    const sentences = paragraphs.flatMap((p) => p.sentences)
    // Each distinct word, pronounced on its own, tells us which final consonants are liaisons.
    const [inContext] = await Promise.all([
      phonemizeInContext(phonemizer, sentences),
      alone.learn(sentences.flatMap(wordsOf)),
    ])
    const items = sentences.map((sentence, i) => analyzeSentence(sentence, inContext[i]!, alone))
    const itemsByParagraph = splitBySizes(
      items,
      paragraphs.map((p) => p.sentences.length),
    )
    return paragraphs.map((p, i) => toAnalyzedParagraph(p, itemsByParagraph[i]!.flat()))
  }
}

// ---------------------------------------------------------------- phonemes

/**
 * How words sound when pronounced alone, remembered across analyses.
 *
 * @remarks Keyed by normalized word, the form sent to the phonemizer.
 */
class IsolatedPronunciations {
  private readonly phonemes = new Map<string, string[]>()

  constructor(private readonly phonemizer: Phonemizer) {}

  /** Phonemizes the words not known yet. */
  async learn(words: readonly string[]): Promise<void> {
    const unknown = [...new Set(words.map(normalizeWord))].filter((w) => !this.phonemes.has(w))
    if (!unknown.length) return
    const traces = await this.phonemizer.phonemize(unknown)
    unknown.forEach((word, i) => this.phonemes.set(word, cleanTrace(traces[i] ?? [])))
  }

  /** Phonemes of a word pronounced alone; empty if it was never learned. */
  of(word: string): string[] {
    return this.phonemes.get(normalizeWord(word)) ?? []
  }
}

/** Phonemizes sentences in context, and groups each sentence's phonemes by token. */
async function phonemizeInContext(
  phonemizer: Phonemizer,
  sentences: readonly Sentence[],
): Promise<TokenPhonemes[]> {
  const normalized = sentences.map((s) => normalizeSentence(s.tokens))
  const traces = await phonemizer.phonemize(normalized.map((n) => n.text))
  return sentences.map((s, i) => phonemesByToken(s.tokens, normalized[i]!.owner, traces[i] ?? []))
}

/** Texts of the words of a sentence. */
const wordsOf = (s: Sentence): string[] =>
  s.tokens.filter((t) => t.kind === 'word').map((t) => t.text)

/** Cleans a whole trace into a list of IPA phonemes. */
function cleanTrace(trace: PhonemeTrace): string[] {
  return fixGlides(trace.map(([, p]) => cleanPhoneme(p)).filter(Boolean))
}

/**
 * Groups a sentence's phonemes by token, using the character position the phonemizer reports.
 *
 * @param owner - Character → token map from `normalizeSentence`.
 */
function phonemesByToken(
  tokens: readonly Token[],
  owner: Int32Array,
  trace: PhonemeTrace,
): TokenPhonemes {
  const phonemes: TokenPhonemes = tokens.map(() => [])
  for (const [position, raw] of trace) {
    const phoneme = cleanPhoneme(raw)
    const token = tokenAt(owner, position - 1)
    if (phoneme && token !== null) phonemes[token]!.push(phoneme)
  }
  return phonemes.map((ph, i) => fixPalatal(fixGlides(ph), tokens[i]!.text))
}

/**
 * The token a phoneme belongs to, from the character position the phonemizer reported.
 *
 * @remarks Phonemizers sometimes report a position on a separator, for example the pause after a
 * comma. The closest word before it is used then, or the first word after it at the start of a
 * sentence.
 *
 * @param owner - Character → token map from `normalizeSentence`.
 * @param index - 0-based character index; positions outside the text are brought back into it.
 * @returns The token's index, or `null` if the sentence has no word.
 */
function tokenAt(owner: Int32Array, index: number): Nullable<number> {
  if (!owner.length) return null
  const at = clamp(index, 0, owner.length - 1)
  const before = owner.subarray(0, at + 1).findLast(isWordCharacter)
  return before ?? owner.subarray(at + 1).find(isWordCharacter) ?? null
}

/** Whether an entry of the character → token map is a word's token, not a separator. */
const isWordCharacter = (token: number): boolean => token !== SEPARATOR

/** `value` brought within `[min, max]`. */
const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

// ---------------------------------------------------------------- items

/** A token with its phonemes in context. */
interface PhonemizedToken {
  token: Token
  phonemes: string[]
}

/** Builds a sentence's items, with the links between its words. */
function analyzeSentence(
  sentence: Sentence,
  phonemes: TokenPhonemes,
  alone: IsolatedPronunciations,
): Item[] {
  const tokens = sentence.tokens.map((token, i) => ({ token, phonemes: phonemes[i] ?? [] }))
  return tokens.map((current, i) => toItem(current, tokens[i + 1], alone))
}

/** The item for a token: punctuation and marks as they are, a word with its link to the next. */
function toItem(
  current: PhonemizedToken,
  next: PhonemizedToken | undefined,
  alone: IsolatedPronunciations,
): Item {
  const { token, phonemes } = current
  if (token.kind !== 'word') return { kind: token.kind, text: token.text, space: token.space }
  return withLink(toWordItem(token, phonemes), phonemes, linkToNext(current, next, alone))
}

/**
 * How a word joins the token after it.
 *
 * @remarks Only two consecutive words can be linked: punctuation, or the end of the sentence,
 * blocks the link.
 */
function linkToNext(
  word: PhonemizedToken,
  next: PhonemizedToken | undefined,
  alone: IsolatedPronunciations,
): Link {
  if (next?.token.kind !== 'word') return null
  return linkBetween(word.phonemes, next.phonemes, alone.of(word.token.text))
}

/** A word with its IPA (from the lexicon, else from its phonemes) and its comparison keys. */
function toWordItem(token: Token, phonemes: string[]): WordItem {
  const fromLexicon = lexiconIpa(token.text)
  return {
    kind: 'word',
    text: token.text,
    space: token.space,
    ipa: fromLexicon || syllabify(phonemes),
    link: null,
    liaison: '',
    key: wordKey(token.text),
    match: matchKeys(token.text),
    tech: isTechnicalTerm(token.text),
    source: fromLexicon ? 'lexique' : 'espeak',
  }
}

/** How a word joins the next: a liaison with its consonant, an enchaînement, or nothing. */
type Link = Nullable<{ type: 'liaison'; consonant: string } | { type: 'enchainement' }>

/**
 * How a word ending in a consonant joins the next word.
 *
 * @remarks
 * - a **liaison** if that consonant is absent when the word is pronounced alone (*les* /le/ but
 *   *les enfants* /lez‿ɑ̃fɑ̃/), or if the phonemizer doubled it (*comptent un* /kɔ̃tt/);
 * - an **enchaînement** if the consonant is always pronounced and the next word starts with a vowel.
 *
 * @param word - The word's phonemes, in context.
 * @param next - The next word's phonemes, in context.
 * @param alone - The word's phonemes, pronounced alone.
 */
function linkBetween(word: string[], next: string[], alone: string[]): Link {
  const last = word.at(-1)
  const nextFirst = next[0]
  if (!last || isVowel(last) || !nextFirst) return null
  const silentAlone = alone.at(-1) !== last
  const doubled = word.length > 2 && word.at(-2) === last
  if ((silentAlone || doubled) && word.length > 1) return { type: 'liaison', consonant: last }
  return isVowel(nextFirst) ? { type: 'enchainement' } : null
}

/**
 * Applies a link to a word.
 *
 * @remarks A liaison consonant moves out of the IPA into {@link WordItem.liaison}; the lexicon's
 * IPA never contains it, so only the phonemizer's IPA is rebuilt.
 */
function withLink(word: WordItem, phonemes: string[], link: Link): WordItem {
  if (!link) return word
  if (link.type === 'enchainement') return { ...word, link: 'enchainement' }
  return {
    ...word,
    link: 'liaison',
    liaison: link.consonant,
    ipa: word.source === 'espeak' ? syllabify(phonemes.slice(0, -1)) : word.ipa,
  }
}

// ---------------------------------------------------------------- paragraphs

/** An analyzed paragraph, with an id derived from its text. */
function toAnalyzedParagraph(paragraph: Paragraph, items: Item[]): AnalyzedParagraph {
  return { id: textId(paragraph.text), section: paragraph.section, text: paragraph.text, items }
}

/** Cuts a list into consecutive groups of the given sizes. */
function splitBySizes<T>(list: readonly T[], sizes: readonly number[]): T[][] {
  let start = 0
  return sizes.map((size) => list.slice(start, (start += size)))
}
