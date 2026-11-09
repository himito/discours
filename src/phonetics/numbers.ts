/**
 * French numbers in words.
 *
 * @remarks eSpeak-NG reads cardinals well but gets ordinals wrong (*21e*, *XXIe*). These helpers
 * write ordinals out in full before phonemization. They use the 1990 spelling reform: every part
 * is joined with a hyphen.
 *
 * @packageDocumentation
 */

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
]
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

/** 0–99 in words. */
function below100(n: number): string {
  if (n < 20) return UNITS[n]!
  if (n < 70) {
    const t = Math.floor(n / 10)
    const u = n % 10
    if (u === 0) return TENS[t]!
    if (u === 1) return `${TENS[t]}-et-un`
    return `${TENS[t]}-${UNITS[u]}`
  }
  if (n < 80) return n === 71 ? 'soixante-et-onze' : `soixante-${UNITS[n - 60]}`
  if (n === 80) return 'quatre-vingts'
  return `quatre-vingt-${UNITS[n - 80]}`
}

/** 0–999 in words (*cents* agrees when nothing follows). */
function below1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  if (h === 0) return below100(r)
  const head = h === 1 ? 'cent' : `${UNITS[h]}-cent${r === 0 ? 's' : ''}`
  return r === 0 ? head : `${head}-${below100(r)}`
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
  if (!Number.isInteger(n) || n < 0 || n >= 1e9) return String(n)
  if (n < 1000) return below1000(n)
  const parts: string[] = []
  const millions = Math.floor(n / 1e6)
  const thousands = Math.floor((n % 1e6) / 1000)
  const rest = n % 1000
  if (millions)
    parts.push(`${millions === 1 ? 'un' : below1000(millions)}-million${millions > 1 ? 's' : ''}`)
  if (thousands) {
    // "cent" and "vingt" lose their plural -s before "mille".
    const t = thousands === 1 ? '' : `${below1000(thousands).replace(/s$/, '')}-`
    parts.push(`${t}mille`)
  }
  if (rest) parts.push(below1000(rest))
  return parts.join('-')
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
  const words = cardinal(n).replace(/s$/, '') // quatre-vingts → quatre-vingtième, deux-cents → deux-centième
  if (words.endsWith('cinq')) return `${words}uième`
  if (words.endsWith('neuf')) return `${words.slice(0, -1)}vième`
  if (words.endsWith('e')) return `${words.slice(0, -1)}ième`
  return `${words}ième`
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }

/**
 * Parses a Roman numeral.
 *
 * @param s - Upper-case candidate, e.g. `XXI`.
 * @returns Its value, or `null` if `s` is not a canonical Roman numeral (`IIII` and `VX` are
 *   rejected).
 */
export function parseRoman(s: string): number | null {
  if (!/^[IVXLCDM]+$/.test(s)) return null
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]!]!
    const next = ROMAN[s[i + 1] ?? ''] ?? 0
    total += v < next ? -v : v
  }
  return toRoman(total) === s ? total : null
}

/** Canonical Roman numeral of a number, used to validate {@link parseRoman}'s input. */
function toRoman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let out = ''
  for (const [v, r] of table) {
    while (n >= v) {
      out += r
      n -= v
    }
  }
  return out
}
