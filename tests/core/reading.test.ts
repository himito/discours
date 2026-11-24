import { describe, expect, it } from 'vitest'
import { align, closeEnough, isWordRecognized, sameWord } from '#core/reading/align'
import {
  followReading,
  readingTarget,
  scoreReading,
  wordsPerMinute,
  wordVerdict,
} from '#core/reading/session'
import { paragraph } from './fixtures'

const speech = [
  paragraph('Les enfants sont arrivés .'),
  paragraph('Le CNRS les accueille .'),
  paragraph('Merci à tous .'),
]

describe('align', () => {
  it('tolerates plural and verb endings', () => {
    expect(sameWord('arrive', 'arrives')).toBe(true)
    expect(sameWord('chat', 'chien')).toBe(false)
  })

  it('reports which words were heard, and the last one', () => {
    const { perItem, lastHit } = align(speech[0]!.items, 'les enfants arrivé')
    expect(perItem.get(1)).toEqual({ heard: 1, total: 1 })
    expect(perItem.get(2)).toEqual({ heard: 0, total: 1 })
    expect(lastHit).toBe(3)
  })

  it('ignores extra and repeated words in the transcript', () => {
    const { perItem, lastHit } = align(speech[0]!.items, 'euh les les enfants bon sont arrivés')
    expect([...perItem.values()].every((h) => h.heard === h.total)).toBe(true)
    expect(lastHit).toBe(3)
    expect(align(speech[0]!.items, '').lastHit).toBe(-1)
  })

  it('accepts a close single word only when long enough', () => {
    expect(closeEnough('maison', 'maison')).toBe(true)
    expect(closeEnough('raison', 'maison')).toBe(true)
    expect(closeEnough('maisons', 'maison')).toBe(true)
    expect(closeEnough('raisin', 'maison')).toBe(false)
    expect(closeEnough('bas', 'bal')).toBe(false)
  })

  it('checks single words leniently, on the part after an elision', () => {
    expect(isWordRecognized("l'équipe", ['équipes'])).toBe(true)
    expect(isWordRecognized('maison', ['raison', 'saison'])).toBe(true)
    expect(isWordRecognized('maison', ['voiture'])).toBe(false)
  })
})

describe('reading session', () => {
  it('scores one paragraph, listing missed words', () => {
    const target = readingTarget(speech, 0, 0)
    const score = scoreReading(target, 'les enfants arrivés', 'all')
    expect(score.paragraphs).toHaveLength(1)
    expect(score.paragraphs[0]).toMatchObject({ percent: 75, missed: ['sont'] })
  })

  it('does not count technical terms', () => {
    const target = readingTarget(speech, 1, 1)
    const score = scoreReading(target, 'le les accueille', 'all')
    expect(score.percent).toBe(100)
    expect(score.paragraphs[0]!.counted).toBe(3)
  })

  it('scores only the paragraphs reached across the speech', () => {
    const target = readingTarget(speech, 0)
    const score = scoreReading(target, 'les enfants sont arrivés le cnrs les accueille', 'reached')
    expect(score.paragraphs.map((p) => p.index)).toEqual([0, 1])
    expect(score.percent).toBe(100)
  })

  it('still scores the paragraph when nothing was heard, in "all" scope', () => {
    const score = scoreReading(readingTarget(speech, 0, 0), '', 'all')
    expect(score.paragraphs).toHaveLength(1)
    expect(score).toMatchObject({ percent: 0, missed: 4, words: 4 })
  })

  it('scores nothing when nothing was heard, in "reached" scope', () => {
    const target = readingTarget(speech, 0)
    expect(scoreReading(target, 'bla bla', 'reached').paragraphs).toEqual([])
  })

  it('judges words only up to the last one heard while reading', () => {
    const target = readingTarget(speech, 0)
    const state = followReading(target, 'les enfants')
    expect(state.reached).toBe(0)
    expect(wordVerdict(target, state, 0, 1, true)).toBe('ok')
    expect(wordVerdict(target, state, 0, 2, true)).toBe('')
    expect(wordVerdict(target, state, 0, 2, false)).toBe('miss')
    expect(wordVerdict(target, state, 1, 0, false)).toBe('')
  })

  it('computes words per minute, not for very short readings', () => {
    expect(wordsPerMinute(30, 15)).toBe(120)
    expect(wordsPerMinute(3, 1)).toBeNull()
  })
})
