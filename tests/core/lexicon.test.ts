import { describe, expect, it } from 'vitest'
import { lexiconIpa } from '#core/phonetics/lexicon'

describe('lexiconIpa', () => {
  it('finds known words, ignoring case and attached punctuation', () => {
    expect(lexiconIpa('archivage')).toBe('aʁ.ʃi.vaʒ')
    expect(lexiconIpa('« Archivage,')).toBe('aʁ.ʃi.vaʒ')
  })

  it('puts back the IPA of elided prefixes', () => {
    expect(lexiconIpa("l'archivage")).toBe('laʁ.ʃi.vaʒ')
    expect(lexiconIpa('L’archivage')).toBe('laʁ.ʃi.vaʒ')
  })

  it('strips up to two elided prefixes', () => {
    expect(lexiconIpa("qu'aujourd'hui")).toBe('ko.ʒuʁ.dɥi')
    expect(lexiconIpa("qu'l'archivage")).toBe('klaʁ.ʃi.vaʒ')
    expect(lexiconIpa("qu'l'd'archivage")).toBe('')
  })

  it('returns an empty string for unknown words and prefixes', () => {
    expect(lexiconIpa('inconnu')).toBe('')
    expect(lexiconIpa("x'archivage")).toBe('')
    expect(lexiconIpa("l'")).toBe('')
    expect(lexiconIpa('')).toBe('')
  })

  it('does not mistake object properties for words', () => {
    expect(lexiconIpa('constructor')).toBe('')
    expect(lexiconIpa('__proto__')).toBe('')
    expect(lexiconIpa("l'constructor")).toBe('')
  })
})
