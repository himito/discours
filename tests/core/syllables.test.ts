import { describe, expect, it } from 'vitest'
import { cleanPhoneme, fixGlides, fixPalatal, syllabify } from '@/core/phonetics/syllables'

describe('syllabify', () => {
  it.each([
    [['a', 'm', 'i'], 'a.mi'],
    [['a', 'p', 'ʁ', 'ɑ̃', 't', 'i'], 'a.pʁɑ̃.ti'],
    [['n', 'a', 's', 'j', 'ɔ̃'], 'na.sjɔ̃'],
    [['ɛ', 'k', 's', 'p', 'l', 'e'], 'ɛks.ple'],
    [['p', 'a'], 'pa'],
  ])('%j → %s', (phonemes, expected) => {
    expect(syllabify(phonemes)).toBe(expected)
  })
})

describe('phoneme fixes', () => {
  it('removes stress and language marks', () => {
    expect(cleanPhoneme('ˈa')).toBe('a')
    expect(cleanPhoneme('(en)t')).toBe('t')
  })

  it('restores ɥ before a vowel', () => {
    expect(fixGlides(['s', 'y', 'i'])).toEqual(['s', 'ɥ', 'i'])
    expect(fixGlides(['s', 'y'])).toEqual(['s', 'y'])
  })

  it('restores ɲ only for words spelled with gn', () => {
    expect(fixPalatal(['a', 'n', 'j', 'e'], 'agné')).toEqual(['a', 'ɲ', 'e'])
    expect(fixPalatal(['p', 'a', 'n', 'j', 'e'], 'panier')).toEqual(['p', 'a', 'n', 'j', 'e'])
  })
})
