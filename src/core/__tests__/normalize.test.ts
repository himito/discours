import { describe, expect, it } from 'vitest'
import { normalizeWord, parseText } from '../text/normalize'

describe('parseText', () => {
  it('splits paragraphs and assigns sections from title lines', () => {
    const paragraphs = parseText('# Intro\nBonjour à tous.\n\n# Fin\nMerci.')
    expect(paragraphs.map((p) => [p.section, p.text])).toEqual([
      ['Intro', 'Bonjour à tous.'],
      ['Fin', 'Merci.'],
    ])
  })

  it('keeps reading marks as tokens', () => {
    const [p] = parseText('Bonjour / à tous //')
    const kinds = p!.sentences.flatMap((s) => s.tokens).map((t) => t.kind)
    expect(kinds).toEqual(['word', 'mark', 'word', 'word', 'mark'])
  })
})

describe('normalizeWord', () => {
  it('spells out abbreviations and ordinals', () => {
    expect(normalizeWord('M.')).toBe('Monsieur')
    expect(normalizeWord('XXIe')).toMatch(/vingt-et-unième/)
  })
})
