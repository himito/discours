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
import type { AnalyzedParagraph, Item, WordItem } from '../model'
import type { PhonemeTrace, Phonemizer } from './Phonemizer'
import { normalizeSentence, normalizeWord, parseText, type Sentence } from '../text/normalize'
import { isTechnicalTerm, matchKeys, textId, wordKey } from '../text/words'
import { lexiconIpa } from './lexicon'
import { cleanPhoneme, fixGlides, fixPalatal, isVowel, syllabify } from './syllables'

/**
 * Analyzes a French speech.
 *
 * @param text - The speech: one paragraph per line, `# Title` lines for sections, `/`, `//` and
 *   `[→]` as reading marks.
 * @returns The paragraphs, in order. Title lines are not paragraphs: they set
 *   {@link AnalyzedParagraph.section}.
 */
export type Analyzer = (text: string) => Promise<AnalyzedParagraph[]>

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
  /** Phonemes of words pronounced alone, by normalized word. */
  const isolated = new Map<string, string[]>()

  return async (text) => {
    const paragraphs = parseText(text)
    const sentences = paragraphs.flatMap((p) => p.sentences)
    const normalized = sentences.map((s) => normalizeSentence(s.tokens))

    // Each distinct word, pronounced on its own, tells us which final consonants are liaisons.
    const unknown = [...new Set(sentences.flatMap(wordsOf).map(normalizeWord))].filter(
      (w) => !isolated.has(w),
    )
    const [inContext, alone] = await Promise.all([
      phonemizer.phonemize(normalized.map((n) => n.text)),
      phonemizer.phonemize(unknown),
    ])
    unknown.forEach((w, i) => isolated.set(w, cleanTrace(alone[i] ?? [])))

    let sentenceIndex = 0
    return paragraphs.map((p) => {
      const items = p.sentences.flatMap((sentence) => {
        const i = sentenceIndex++
        const phonemes = phonemesByToken(sentence, normalized[i]!.owner, inContext[i] ?? [])
        return analyzeSentence(sentence, phonemes, isolated)
      })
      return { id: textId(p.text), section: p.section, text: p.text, items }
    })
  }
}

/** Texts of the words of a sentence. */
const wordsOf = (s: Sentence) => s.tokens.filter((t) => t.kind === 'word').map((t) => t.text)

/** Cleans a whole trace into a list of IPA phonemes. */
function cleanTrace(trace: PhonemeTrace): string[] {
  return fixGlides(trace.map(([, p]) => cleanPhoneme(p)).filter(Boolean))
}

/**
 * Groups a sentence's phonemes by token, using the character position the phonemizer reports.
 *
 * @param owner - Character → token map from `normalizeSentence`.
 */
function phonemesByToken(sentence: Sentence, owner: Int32Array, trace: PhonemeTrace): string[][] {
  const phonemes: string[][] = sentence.tokens.map(() => [])
  for (const [position, raw] of trace) {
    const ph = cleanPhoneme(raw)
    const token = ownerAt(owner, position - 1)
    if (ph && token >= 0) phonemes[token]!.push(ph)
  }
  return phonemes.map((ph, i) => fixPalatal(fixGlides(ph), sentence.tokens[i]!.text))
}

/** Builds a sentence's items and marks its liaisons. */
function analyzeSentence(
  sentence: Sentence,
  phonemes: string[][],
  isolated: ReadonlyMap<string, string[]>,
): Item[] {
  const items = sentence.tokens.map((tok, i): Item => {
    if (tok.kind !== 'word') return { kind: tok.kind, text: tok.text, space: tok.space }
    const lex = lexiconIpa(tok.text)
    return {
      kind: 'word',
      text: tok.text,
      space: tok.space,
      ipa: lex || syllabify(phonemes[i]!),
      link: null,
      liaison: '',
      key: wordKey(tok.text),
      match: matchKeys(tok.text),
      tech: isTechnicalTerm(tok.text),
      source: lex ? 'lexique' : 'espeak',
    }
  })
  const alone = sentence.tokens.map((t) => isolated.get(normalizeWord(t.text)) ?? [])
  detectLinks(items, phonemes, alone)
  return items
}

/**
 * Finds the token that owns a character of the normalized text.
 *
 * @remarks Phonemizers sometimes report a position on a separator, for example the pause after a
 * comma. The closest preceding word is used then, or the next one at the start of a sentence.
 *
 * @param owner - Character → token map from `normalizeSentence`.
 * @param index - 0-based character index.
 * @returns A token index, or -1 if the sentence has no word.
 */
function ownerAt(owner: Int32Array, index: number): number {
  for (let i = Math.min(index, owner.length - 1); i >= 0; i--) if (owner[i]! >= 0) return owner[i]!
  for (let i = Math.max(index, 0); i < owner.length; i++) if (owner[i]! >= 0) return owner[i]!
  return -1
}

/**
 * Marks liaisons and enchaînements between consecutive words of a sentence.
 *
 * @remarks
 * A word ending in a consonant before another word is:
 *
 * - a **liaison** if that consonant is absent when the word is pronounced alone (*les* /le/ but
 *   *les enfants* /lez‿ɑ̃fɑ̃/), or if the phonemizer doubled it (*comptent un* /kɔ̃tt/). The
 *   consonant moves to {@link WordItem.liaison}.
 * - an **enchaînement** if the consonant is always pronounced and the next word starts with a vowel.
 *
 * Punctuation between two words blocks the link.
 *
 * @param items - Items of the sentence; modified in place.
 * @param phonemes - Phonemes of each item, in context.
 * @param alone - Phonemes of each item pronounced alone.
 */
function detectLinks(items: Item[], phonemes: string[][], alone: string[][]): void {
  for (let i = 0; i < items.length - 1; i++) {
    const item = items[i]!
    if (item.kind !== 'word' || items[i + 1]!.kind !== 'word') continue
    const ph = phonemes[i]!
    const last = ph[ph.length - 1]
    const nextFirst = phonemes[i + 1]![0]
    if (!last || isVowel(last) || !nextFirst) continue

    const isolatedLast = alone[i]!.at(-1)
    const doubled = ph.length > 2 && ph[ph.length - 2] === last
    if ((isolatedLast !== last || doubled) && ph.length > 1) markLiaison(item, ph)
    else if (isVowel(nextFirst)) item.link = 'enchainement'
  }
}

/** Moves the word's last consonant into its liaison. */
function markLiaison(item: WordItem, phonemes: string[]): void {
  item.link = 'liaison'
  item.liaison = phonemes.at(-1)!
  if (item.source === 'espeak') item.ipa = syllabify(phonemes.slice(0, -1))
}
