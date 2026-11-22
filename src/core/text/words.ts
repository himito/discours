/**
 * Word-level text helpers: keys, comparison forms, technical terms, ids.
 *
 * @packageDocumentation
 */

/** Quotes, brackets and punctuation that can be attached to a word. */
const ATTACHED_PUNCT = /[«»"“”().,;:!?]/g

/**
 * A word without the quotes, brackets and punctuation attached to it, as shown and spoken alone.
 *
 * @example
 * ```ts
 * bareWord('« L’équipe,') // → 'L’équipe'
 * ```
 */
export const bareWord = (text: string): string => text.replace(ATTACHED_PUNCT, '').trim()

/**
 * Key under which the user's IPA corrections and practice statistics are stored.
 *
 * @returns The word in lower case, without surrounding punctuation and with straight apostrophes.
 *
 * @example
 * ```ts
 * wordKey('« L’équipe,') // → "l'équipe"
 * ```
 */
export function wordKey(text: string): string {
  return bareWord(text).replace(/’/g, "'").toLowerCase()
}

/**
 * Normalizes a word to compare it with speech recognition output.
 *
 * @returns The word in lower case, without accents, keeping only letters, digits, apostrophes and
 *   inner hyphens.
 *
 * @example
 * ```ts
 * normForMatch('Été,') // → 'ete'
 * ```
 */
export function normForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'-]/g, '')
    .replace(/^-+|-+$/g, '')
}

/**
 * Splits a word on its elisions, so each part can be matched separately.
 *
 * @remarks Recognizers split elisions inconsistently (`l'équipe`, `l équipe`, `léquipe`).
 *
 * @example
 * ```ts
 * matchKeys("l'équipe") // → ['l', 'equipe']
 * ```
 */
export function matchKeys(text: string): string[] {
  return normForMatch(text).split("'").filter(Boolean)
}

/**
 * Splits a recognizer transcript into comparable parts, the same way as {@link matchKeys}.
 *
 * @example
 * ```ts
 * transcriptKeys("L'équipe est là") // → ['l', 'equipe', 'est', 'la']
 * ```
 */
export function transcriptKeys(transcript: string): string[] {
  return transcript.split(/\s+/).flatMap(matchKeys)
}

/**
 * Whether a word is a technical term: an acronym (CNRS, l'ONU) or an alphanumeric term (FAIR4RS,
 * 3D). Such words are not counted in reading scores and have no dictionary entry.
 */
export function isTechnicalTerm(text: string): boolean {
  const w = bareWord(text)
  return (/[0-9]/.test(w) && /[a-z]/i.test(w)) || /^\p{Lu}{2,}/u.test(w.replace(/^\p{L}'/u, ''))
}

/**
 * A short, stable id for a text: its djb2 hash in base 36.
 *
 * @remarks Used as paragraph id: the same text always gives the same id, across sessions.
 */
export function textId(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
