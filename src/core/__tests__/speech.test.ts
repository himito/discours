import { describe, expect, it } from 'vitest'
import { groupBySection, locate, readingSeconds, totalWords } from '../speech/sections'
import { displayUnits, spokenIndex, spokenText } from '../speech/units'
import { paragraph } from './fixtures'

describe('sections', () => {
  const speech = [
    paragraph('Bonjour à tous .', 'Intro'),
    paragraph('Je commence .', 'Intro'),
    paragraph('Merci .', 'Fin'),
  ]

  it('groups paragraphs by section and numbers them', () => {
    const sections = groupBySection(speech)
    expect(sections.map((s) => [s.number, s.title, s.paragraphs.length, s.words])).toEqual([
      [1, 'Intro', 2, 5],
      [2, 'Fin', 1, 1],
    ])
    expect(locate(sections, 2)).toMatchObject({ section: { title: 'Fin' }, number: 1 })
    expect(locate(sections, 9)).toBeNull()
  })

  it('counts words and reading time', () => {
    expect(totalWords(speech)).toBe(6)
    expect(readingSeconds(135)).toBe(60)
  })
})

describe('units', () => {
  const p = paragraph('Bonjour , / à tous . //')

  it('attaches punctuation to words and keeps marks apart', () => {
    expect(
      displayUnits(p.items).map((u) => (u.kind === 'word' ? u.item.text + u.post : u.text)),
    ).toEqual(['Bonjour,', '/', 'à', 'tous.', '//'])
  })

  it('turns marks into pauses for the voice, and maps characters back to words', () => {
    const { text, ranges } = spokenText(p.items)
    expect(text).toBe('Bonjour, à tous.')
    expect(spokenIndex(ranges, text.indexOf('tous'))).toBe(4)
    expect(spokenIndex(ranges, -1)).toBe(-1)
    expect(spokenText(paragraph('Merci // à / tous').items).text).toBe('Merci… à, tous')
  })
})
