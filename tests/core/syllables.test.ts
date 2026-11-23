import { describe, expect, it } from 'vitest'
import { cleanPhoneme, fixGlides, fixPalatal, syllabify } from '#core/phonetics/syllables'

describe('syllabify', () => {
  it.each([
    [['a', 'm', 'i'], 'a.mi'],
    [['a', 'p', 'ʁ', 'ɑ̃', 't', 'i'], 'a.pʁɑ̃.ti'],
    [['n', 'a', 's', 'j', 'ɔ̃'], 'na.sjɔ̃'],
    [['ɛ', 'k', 's', 'p', 'l', 'e'], 'ɛks.ple'],
    [['p', 'a'], 'pa'],
    [[], ''],
    [['s', 't', 'ʁ', 'i', 'k', 't'], 'stʁikt'],
    [['k', 'ɔ̃', 't', 'i', 'n', 'ɥ', 'i', 't', 'e'], 'kɔ̃.ti.nɥi.te'],
    [['ɛ̃', 'd', 'y', 's', 't', 'ʁ', 'j', 'ɛ', 'l'], 'ɛ̃.dys.tʁjɛl'],
    [['a', 'ɛ'], 'a.ɛ'],
    [['ɛ', 'k', 's', 'p', 'l', 'e', 'ʁ', 'i', 'm', 'ɑ̃'], 'ɛks.ple.ʁi.mɑ̃'],
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
    expect(fixPalatal(['ɑ̃', 's', 'ɛ', 'n', 'j', 'm', 'ɑ̃'], 'Enseignement')).toEqual([
      'ɑ̃',
      's',
      'ɛ',
      'ɲ',
      'm',
      'ɑ̃',
    ])
  })

  it('rewrites n j once per gn, from the start', () => {
    expect(fixPalatal(['n', 'j', 'a', 'n', 'j'], 'gnagn')).toEqual(['ɲ', 'a', 'ɲ'])
    expect(fixPalatal(['n', 'j', 'a', 'n', 'j'], 'gnanier')).toEqual(['ɲ', 'a', 'n', 'j'])
    expect(fixPalatal(['n', 'n', 'j'], 'gn')).toEqual(['n', 'ɲ'])
  })
})
