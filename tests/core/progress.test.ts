import { describe, expect, it } from 'vitest'
import { ipaOf, withCorrection } from '@/core/progress/corrections'
import {
  afterSuccess,
  hardWordList,
  hardWordsIn,
  missLevel,
  overview,
  withAttempt,
  withMissed,
  withScore,
} from '@/core/progress/progress'
import { paragraph, word } from './fixtures'

describe('progress', () => {
  it('keeps the best score', () => {
    const best = withScore(withScore({}, 'p1', 80), 'p1', 60)
    expect(best).toEqual({ p1: 80 })
  })

  it('counts missed words by key, ignoring one-letter words', () => {
    expect(withMissed({ maison: 1 }, ['Maison,', 'à', 'jury'])).toEqual({ maison: 2, jury: 1 })
  })

  it('records attempts and lowers the miss count on success', () => {
    expect(withAttempt({}, 'Jury', true)).toEqual({ jury: { ok: 1, n: 1 } })
    expect(afterSuccess({ jury: 2 }, 'jury')).toEqual({ jury: 1 })
    expect(afterSuccess({ jury: 1 }, 'jury')).toEqual({})
  })

  it('summarizes the progress over the speech', () => {
    const speech = [paragraph('Un .'), paragraph('Deux .'), paragraph('Trois .')]
    expect(overview(speech, { [speech[0]!.id]: 80, [speech[1]!.id]: 61 })).toEqual({
      read: 2,
      total: 3,
      percentRead: (2 / 3) * 100,
      average: 71,
    })
  })

  it('lists the words to work on, most missed first', () => {
    const speech = [paragraph('Le jury est là .'), paragraph('Merci au jury .')]
    expect(hardWordList(speech, { merci: 1, jury: 3, absent: 2 }).map((w) => w.key)).toEqual([
      'jury',
      'absent',
      'merci',
    ])
    expect(hardWordsIn(speech.slice(1), { merci: 1, jury: 3 }, 1).map((w) => w.key)).toEqual([
      'jury',
    ])
    expect([missLevel(1), missLevel(2), missLevel(5)]).toEqual(['low', 'mid', 'high'])
  })

  it('applies and removes IPA corrections', () => {
    const w = word('jury', { ipa: 'ʒy.ʁi' })
    const corrections = withCorrection({}, 'jury', ' ʒy.ri ')
    expect(ipaOf(w, corrections)).toBe('ʒy.ri')
    expect(withCorrection(corrections, 'jury', 'ʒy.ʁi', 'ʒy.ʁi')).toEqual({})
    expect(withCorrection(corrections, 'jury', '')).toEqual({})
  })
})
