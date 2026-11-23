import { describe, expect, it } from 'vitest'
import {
  bareWord,
  isTechnicalTerm,
  matchKeys,
  normForMatch,
  textId,
  transcriptKeys,
  wordKey,
} from '#core/text/words'

describe('words', () => {
  it('strips attached punctuation', () => {
    expect(bareWord('« L’équipe,')).toBe('L’équipe')
  })

  it('makes storage keys in lower case with straight apostrophes', () => {
    expect(wordKey('« L’équipe,')).toBe("l'équipe")
  })

  it('normalizes for comparison: no accents, no punctuation', () => {
    expect(normForMatch('Été,')).toBe('ete')
    expect(normForMatch('-bien-')).toBe('bien')
  })

  it('splits elisions into parts', () => {
    expect(matchKeys("l'équipe")).toEqual(['l', 'equipe'])
    expect(transcriptKeys("L'équipe est là")).toEqual(['l', 'equipe', 'est', 'la'])
  })

  it('recognizes acronyms and alphanumeric terms', () => {
    expect(isTechnicalTerm('CNRS')).toBe(true)
    expect(isTechnicalTerm("l'ONU")).toBe(true)
    expect(isTechnicalTerm('FAIR4RS')).toBe(true)
    expect(isTechnicalTerm('Paris')).toBe(false)
    expect(isTechnicalTerm('2019')).toBe(false)
  })

  it('gives stable ids that depend on the text', () => {
    expect(textId('Bonjour.')).toBe(textId('Bonjour.'))
    expect(textId('Bonjour.')).not.toBe(textId('Bonsoir.'))
  })
})
