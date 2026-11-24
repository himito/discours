import { describe, expect, it } from 'vitest'
import { cardinal, ordinal, parseRoman } from '#core/text/numbers'

describe('cardinal', () => {
  it.each([
    [0, 'zéro'],
    [17, 'dix-sept'],
    [21, 'vingt-et-un'],
    [22, 'vingt-deux'],
    [70, 'soixante-dix'],
    [71, 'soixante-et-onze'],
    [72, 'soixante-douze'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [91, 'quatre-vingt-onze'],
    [100, 'cent'],
    [200, 'deux-cents'],
    [201, 'deux-cent-un'],
    [1000, 'mille'],
    [80_000, 'quatre-vingt-mille'],
    [200_000, 'deux-cent-mille'],
    [1271, 'mille-deux-cent-soixante-et-onze'],
    [1_000_000, 'un-million'],
    [200_000_000, 'deux-cents-millions'],
    [2_080_001, 'deux-millions-quatre-vingt-mille-un'],
  ])('%i → %s', (n, words) => {
    expect(cardinal(n)).toBe(words)
  })

  it('leaves numbers out of range as digits', () => {
    expect(cardinal(1_000_000_000)).toBe('1000000000')
    expect(cardinal(-1)).toBe('-1')
    expect(cardinal(1.5)).toBe('1.5')
  })
})

describe('ordinal', () => {
  it.each([
    [1, 'premier'],
    [2, 'deuxième'],
    [5, 'cinquième'],
    [9, 'neuvième'],
    [11, 'onzième'],
    [21, 'vingt-et-unième'],
    [80, 'quatre-vingtième'],
    [200, 'deux-centième'],
  ])('%i → %s', (n, words) => {
    expect(ordinal(n)).toBe(words)
  })
})

describe('parseRoman', () => {
  it('reads canonical numerals', () => {
    expect(parseRoman('XIV')).toBe(14)
    expect(parseRoman('XXI')).toBe(21)
    expect(parseRoman('MCMXCIX')).toBe(1999)
  })

  it('rejects non-canonical or non-Roman text', () => {
    expect(parseRoman('IIII')).toBeNull()
    expect(parseRoman('VX')).toBeNull()
    expect(parseRoman('ABC')).toBeNull()
    expect(parseRoman('')).toBeNull()
  })
})
