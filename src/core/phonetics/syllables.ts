/**
 * Phoneme-level rules: cleaning the phonemizer's output and splitting words into syllables.
 *
 * @packageDocumentation
 */

const VOWEL_RE = /[aeiouyøœəɛɔɑɪʊ]/

/** Whether an IPA phoneme is a vowel (nasal vowels included, glides excluded). */
export const isVowel = (phoneme: string): boolean => VOWEL_RE.test(phoneme)

/** Removes stress marks (`ˈ ˌ`), reduction marks (`-`) and language switches (`(en)`). */
export function cleanPhoneme(phoneme: string): string {
  return phoneme
    .replace(/\([^)]*\)/g, '')
    .replace(/[ˈˌ\-_]/g, '')
    .trim()
}

/**
 * Restores the glide ɥ.
 *
 * @remarks eSpeak writes the glide of *suis*, *nuit* as the vowel `y` followed by `i`. Before
 * another vowel, `y` is really ɥ: `s y i` → `s ɥ i`.
 */
export function fixGlides(phonemes: string[]): string[] {
  return phonemes.map((p, i) => {
    const next = phonemes[i + 1]
    return p === 'y' && next !== undefined && isVowel(next) ? 'ɥ' : p
  })
}

/** Spelling of the palatal nasal: *gn*. */
const SPELLED_GN = /gn/gi
/** Two consecutive items of a list: `first`, immediately followed by `second`. */
interface Pair<T> {
  readonly first: T
  readonly second: T
}

/** How eSpeak writes the palatal nasal: an `n` followed by the glide `j`. */
const NASAL_THEN_GLIDE: Pair<string> = { first: 'n', second: 'j' }
/** The palatal nasal, as in *montagne* /mɔ̃.taɲ/. */
const PALATAL_NASAL = 'ɲ'

/**
 * Restores the palatal nasal ɲ.
 *
 * @remarks eSpeak writes the "gn" of *accompagné*, *soignez* as `n j`. That sequence is also a
 * real one (*panier* /pa.nje/), so it is only rewritten when the word is spelled with "gn", once
 * per "gn", from the start of the word.
 *
 * @param phonemes - Phonemes of one word.
 * @param spelling - The word as written.
 */
export function fixPalatal(phonemes: string[], spelling: string): string[] {
  const spelledGn = spelling.match(SPELLED_GN)?.length ?? 0
  if (!spelledGn) return phonemes
  return replacePairs(phonemes, NASAL_THEN_GLIDE, PALATAL_NASAL, spelledGn)
}

/**
 * Replaces the first `limit` occurrences of a pair of consecutive items with a single item.
 *
 * @param items - The list; not modified.
 * @param pair - The two consecutive items to look for.
 * @param replacement - What replaces each occurrence of the pair.
 * @param limit - How many occurrences to replace at most, from the start.
 *
 * @example
 * ```ts
 * replacePairs(['a', 'n', 'j', 'e'], { first: 'n', second: 'j' }, 'ɲ', 1) // → ['a', 'ɲ', 'e']
 * ```
 */
function replacePairs<T>(items: readonly T[], pair: Pair<T>, replacement: T, limit: number): T[] {
  const result = [...items]
  for (let replaced = 0; replaced < limit; replaced++) {
    const at = result.findIndex((item, i) => item === pair.first && result[i + 1] === pair.second)
    if (at < 0) break
    result.splice(at, 2, replacement)
  }
  return result
}

/** Consonants that can start a syllable together with a following liquid (*pr*, *bl*…). */
const OBSTRUENTS = new Set(['p', 'b', 't', 'd', 'k', 'ɡ', 'g', 'f', 'v'])
/** Second consonant of an onset cluster (*pr*, *fl*). */
const LIQUIDS = new Set(['ʁ', 'l'])
/** Semi-vowels, which stay with the following vowel (*pi.jɛʁ*). */
const GLIDES = new Set(['j', 'w', 'ɥ'])
/** Written between two syllables. */
const SYLLABLE_SEPARATOR = '.'

/**
 * Splits a word's phonemes into syllables, separated by dots.
 *
 * @remarks Each vowel is the nucleus of a syllable. Between two vowels, the consonants are shared
 * out with the usual French rules:
 *
 * - one consonant starts the next syllable (`a.mi`);
 * - a consonant + glide stays together (`na.sjɔ̃`, `kɔ̃.ti.nɥi.te`);
 * - an obstruent + liquid stays together (`a.pʁɑ̃.ti`), also before a glide (`ɛ̃.dys.tʁjɛl`);
 * - the other consonants close the previous syllable (`ɛks.ple.ʁi.mɑ̃`).
 *
 * @param phonemes - The word's phonemes, one IPA symbol (possibly with diacritics) per entry.
 * @returns The IPA string with `.` between syllables.
 *
 * @example
 * ```ts
 * syllabify(['a', 'p', 'ʁ', 'ɑ̃', 't', 'i']) // → 'a.pʁɑ̃.ti'
 * ```
 */
export function syllabify(phonemes: string[]): string {
  const vowels = vowelPositions(phonemes)
  const syllableStarts = new Set(
    vowels.slice(1).map((vowel, k) => {
      const consonantsBefore = phonemes.slice(vowels[k]! + 1, vowel)
      return vowel - onsetLength(consonantsBefore)
    }),
  )
  return phonemes.map((p, i) => (syllableStarts.has(i) ? SYLLABLE_SEPARATOR : '') + p).join('')
}

/** Indexes of the vowels of a word, in order. */
function vowelPositions(phonemes: readonly string[]): number[] {
  return phonemes.flatMap((phoneme, i) => (isVowel(phoneme) ? [i] : []))
}

/**
 * How many consonants between two vowels start the second syllable, following the rules listed
 * on {@link syllabify}.
 *
 * @param cluster - The consonants between the two vowels, in order.
 */
function onsetLength(cluster: readonly string[]): number {
  if (!cluster.length) return 0
  let onset = 1
  if (cluster.length > 1 && GLIDES.has(cluster.at(-1)!)) onset++
  const first = cluster.at(-onset)!
  const before = cluster.at(-onset - 1)
  if (before !== undefined && OBSTRUENTS.has(before) && LIQUIDS.has(first)) onset++
  return onset
}
