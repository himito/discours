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

/**
 * Restores the palatal nasal ɲ.
 *
 * @remarks eSpeak writes the "gn" of *accompagné*, *soignez* as `n j`. That sequence is also a
 * real one (*panier* /pa.nje/), so it is only rewritten when the word is spelled with "gn", once
 * per "gn".
 *
 * @param phonemes - Phonemes of one word.
 * @param spelling - The word as written.
 */
export function fixPalatal(phonemes: string[], spelling: string): string[] {
  let left = (spelling.toLowerCase().match(/gn/g) ?? []).length
  if (!left) return phonemes
  const out: string[] = []
  for (let i = 0; i < phonemes.length; i++) {
    if (left && phonemes[i] === 'n' && phonemes[i + 1] === 'j') {
      out.push('ɲ')
      i++
      left--
    } else out.push(phonemes[i]!)
  }
  return out
}

/** Consonants that can start a syllable together with a following liquid (*pr*, *bl*…). */
const OBSTRUENTS = new Set(['p', 'b', 't', 'd', 'k', 'ɡ', 'g', 'f', 'v'])
/** Second consonant of an onset cluster (*pr*, *fl*). */
const LIQUIDS = new Set(['ʁ', 'l'])
/** Semi-vowels, which stay with the following vowel (*pi.jɛʁ*). */
const GLIDES = new Set(['j', 'w', 'ɥ'])

/**
 * Splits a word's phonemes into syllables, separated by dots.
 *
 * @remarks
 * The usual French rules, applied between two vowels:
 *
 * - one consonant starts the next syllable (`a.mi`);
 * - an obstruent + liquid cluster stays together (`a.pʁɑ̃.ti`);
 * - a consonant + glide stays together (`na.sjɔ̃`, `kɔ̃.ti.nɥi.te`);
 * - otherwise the cluster is split before its last consonant (`ɛks.ple.ʁi.mɑ̃`).
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
  const nuclei = phonemes.map((p, i) => (isVowel(p) ? i : -1)).filter((i) => i >= 0)
  if (nuclei.length < 2) return phonemes.join('')
  const breaks = new Set<number>()
  for (let k = 0; k < nuclei.length - 1; k++) {
    const from = nuclei[k]! + 1
    const to = nuclei[k + 1]! // consonants between the two vowels: phonemes[from..to-1]
    const consonants = to - from
    if (consonants === 0) {
      breaks.add(to)
      continue
    }
    // The onset of the next syllable takes as many consonants as French allows.
    let onset = 1
    let i = to - 1
    if (GLIDES.has(phonemes[i]!) && consonants >= 2) {
      onset++
      i--
    }
    if (consonants > onset && LIQUIDS.has(phonemes[i]!) && OBSTRUENTS.has(phonemes[i - 1]!)) onset++
    breaks.add(to - Math.min(onset, consonants))
  }
  return phonemes.map((p, i) => (breaks.has(i) ? '.' : '') + p).join('')
}
