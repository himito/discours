/**
 * French numbers in words.
 *
 * @remarks eSpeak-NG reads cardinals well but gets ordinals wrong (*21e*, *XXIe*). These helpers
 * write ordinals out in full before phonemization. They use the 1990 spelling reform: every part
 * is joined with a hyphen.
 *
 * @packageDocumentation
 */
import type { Nullable } from '#core/types'

/** 0 to 19 in words: the numbers that have their own name. */
const UNITS = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
] as const

/** Words for the tens from 20 to 60; 70 to 99 are built on *soixante* and *quatre-vingt*. */
const TENS = new Map([
  [20, 'vingt'],
  [30, 'trente'],
  [40, 'quarante'],
  [50, 'cinquante'],
  [60, 'soixante'],
])

/** Remainders joined to the tens with *et*: *vingt-et-un*, *soixante-et-onze*. */
const JOINED_WITH_ET = new Set([1, 11])

const THOUSAND = 1_000
const MILLION = 1_000_000
/** The largest number {@link cardinal} writes in words. */
const MAX_CARDINAL = 999_999_999

/**
 * The name of a number from 0 to 19.
 *
 * @param n - An integer from 0 to 19.
 * @returns Its name, from {@link UNITS}.
 * @throws RangeError if `n` is out of range.
 */
function unitName(n: number): string {
  const name = UNITS[n]
  if (name === undefined) throw new RangeError(`No unit name for ${n}`)
  return name
}

/**
 * The name of a ten from 20 to 60.
 *
 * @param tens - 20, 30, 40, 50 or 60.
 * @returns Its name, from {@link TENS}.
 * @throws RangeError for any other number.
 */
function tensName(tens: number): string {
  const name = TENS.get(tens)
  if (name === undefined) throw new RangeError(`No tens name for ${tens}`)
  return name
}

/**
 * Writes a number from 0 to 99 in words.
 *
 * @remarks 70–79 are *soixante* + 10–19 (*soixante-et-onze*, *soixante-douze*); 80–99 are
 * *quatre-vingt* + 0–19, with no *et*, and *quatre-vingts* takes an *s* when nothing follows.
 *
 * @param n - An integer from 0 to 99.
 * @returns The number in words.
 */
function below100(n: number): string {
  if (n < 20) return unitName(n)
  if (n >= 80) return n === 80 ? 'quatre-vingts' : `quatre-vingt-${unitName(n - 80)}`
  const tens = Math.min(Math.floor(n / 10) * 10, 60)
  const rest = n - tens
  const tensWord = tensName(tens)
  if (rest === 0) return tensWord
  return `${tensWord}-${JOINED_WITH_ET.has(rest) ? 'et-' : ''}${unitName(rest)}`
}

/**
 * Writes a number from 0 to 999 in words.
 *
 * @remarks *cent* takes an *s* when multiplied and nothing follows: *deux-cents*, but
 * *deux-cent-un*.
 *
 * @param n - An integer from 0 to 999.
 * @returns The number in words.
 */
function below1000(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds === 0) return below100(rest)
  const hundredsWords =
    hundreds === 1 ? 'cent' : `${unitName(hundreds)}-cent${rest === 0 ? 's' : ''}`
  return rest === 0 ? hundredsWords : `${hundredsWords}-${below100(rest)}`
}

/** Removes the plural *s* that *cents* and *vingts* only take at the end of a number. */
const withoutFinalPlural = (words: string): string => words.replace(/s$/, '')

/**
 * The millions of a number in words: *un-million*, *deux-cents-millions*.
 *
 * @param count - How many millions, from 0 to 999.
 * @returns The words, or `''` for 0.
 */
function millionsInWords(count: number): string {
  if (count === 0) return ''
  return count === 1 ? 'un-million' : `${below1000(count)}-millions`
}

/**
 * The thousands of a number in words: *mille*, *deux-cent-mille*.
 *
 * @remarks *mille* never takes an *s*, and *cents* / *vingts* lose theirs before it.
 *
 * @param count - How many thousands, from 0 to 999.
 * @returns The words, or `''` for 0.
 */
function thousandsInWords(count: number): string {
  if (count === 0) return ''
  return count === 1 ? 'mille' : `${withoutFinalPlural(below1000(count))}-mille`
}

/**
 * Writes a whole number in French words.
 *
 * @param n - An integer between 0 and 999 999 999.
 * @returns The number in words, or its digits if it is out of range.
 *
 * @example
 * ```ts
 * cardinal(1271) // → 'mille-deux-cent-soixante-et-onze'
 * cardinal(80)   // → 'quatre-vingts'
 * ```
 */
export function cardinal(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_CARDINAL) return String(n)
  if (n < THOUSAND) return below1000(n)
  const millions = Math.floor(n / MILLION)
  const thousands = Math.floor((n % MILLION) / THOUSAND)
  const rest = n % THOUSAND
  return [millionsInWords(millions), thousandsInWords(thousands), rest ? below1000(rest) : '']
    .filter(Boolean)
    .join('-')
}

/**
 * Writes an ordinal number in French words.
 *
 * @param n - A positive integer.
 * @returns The ordinal, masculine form for 1.
 *
 * @example
 * ```ts
 * ordinal(1)  // → 'premier'
 * ordinal(21) // → 'vingt-et-unième'
 * ordinal(5)  // → 'cinquième'
 * ```
 */
export function ordinal(n: number): string {
  if (n === 1) return 'premier'
  // quatre-vingts → quatre-vingtième, deux-cents → deux-centième
  const words = withoutFinalPlural(cardinal(n))
  if (words.endsWith('cinq')) return `${words}uième`
  if (words.endsWith('neuf')) return `${words.slice(0, -1)}vième`
  if (words.endsWith('e')) return `${words.slice(0, -1)}ième`
  return `${words}ième`
}

/** Values of the Roman numeral letters. */
const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }

/**
 * Parses a Roman numeral.
 *
 * @param s - Upper-case candidate, e.g. `XXI`.
 * @returns Its value, or `null` if `s` is not a canonical Roman numeral (`IIII` and `VX` are
 *   rejected).
 */
export function parseRoman(s: string): Nullable<number> {
  if (!/^[IVXLCDM]+$/.test(s)) return null
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]!]!
    const next = ROMAN[s[i + 1] ?? ''] ?? 0
    total += v < next ? -v : v
  }
  return toRoman(total) === s ? total : null
}

/** Roman symbols from the largest, with the subtractive pairs (`CM`, `IV`…) as symbols. */
const ROMAN_SYMBOLS = [
  { value: 1000, symbol: 'M' },
  { value: 900, symbol: 'CM' },
  { value: 500, symbol: 'D' },
  { value: 400, symbol: 'CD' },
  { value: 100, symbol: 'C' },
  { value: 90, symbol: 'XC' },
  { value: 50, symbol: 'L' },
  { value: 40, symbol: 'XL' },
  { value: 10, symbol: 'X' },
  { value: 9, symbol: 'IX' },
  { value: 5, symbol: 'V' },
  { value: 4, symbol: 'IV' },
  { value: 1, symbol: 'I' },
] as const

/**
 * Writes a number as a canonical Roman numeral, to validate {@link parseRoman}'s input.
 *
 * @param n - A positive integer.
 * @returns The Roman numeral: each symbol as many times as it fits, from the largest.
 */
function toRoman(n: number): string {
  let remaining = n
  return ROMAN_SYMBOLS.map(({ value, symbol }) => {
    const count = Math.floor(remaining / value)
    remaining -= count * value
    return symbol.repeat(count)
  }).join('')
}
