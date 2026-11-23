import { describe, expect, it } from 'vitest'
import { createAnalyzer } from '#core/phonetics/analyze'
import type { PhonemeTrace, Phonemizer } from '#core/phonetics/Phonemizer'
import type { WordItem } from '#core/model'

/** How each word sounds alone. */
const ALONE: Record<string, string[]> = {
  les: ['l', 'e'],
  enfants: ['ɑ̃', 'f', 'ɑ̃'],
  avec: ['a', 'v', 'ɛ', 'k'],
  elle: ['ɛ', 'l'],
  arrivent: ['a', 'ʁ', 'i', 'v'],
}
/** Words that make a liaison before a vowel, and its consonant. */
const LIAISON: Record<string, string> = { les: 'z' }

/**
 * A fake phonemizer: reports each word's phonemes at the word's position, adding the liaison
 * consonant before a vowel, like eSpeak does.
 */
class FakePhonemizer implements Phonemizer {
  calls: string[][] = []

  async phonemize(texts: readonly string[]): Promise<PhonemeTrace[]> {
    this.calls.push([...texts])
    return texts.map((text) => {
      const words = [...text.matchAll(/[\p{L}']+/gu)]
      return words.flatMap((m, i) => {
        const w = m[0].toLowerCase()
        const next = words[i + 1]?.[0].toLowerCase()
        const ph = [...(ALONE[w] ?? [])]
        if (LIAISON[w] && next && /^[aeiouéèêɑ]/.test(ALONE[next]?.[0] ?? next))
          ph.push(LIAISON[w]!)
        return ph.map((p): [number, string] => [m.index + 1, p])
      })
    })
  }

  warmUp(): void {}
}

const words = (items: { kind: string }[]) => items.filter((i): i is WordItem => i.kind === 'word')

describe('createAnalyzer', () => {
  it('splits paragraphs and sections, with stable ids', async () => {
    const analyze = createAnalyzer(new FakePhonemizer())
    const result = await analyze('# Début\nLes enfants arrivent.\n# Fin\nAvec elle.')
    expect(result.map((p) => p.section)).toEqual(['Début', 'Fin'])
    expect(result[0]!.id).toBe((await analyze('# X\nLes enfants arrivent.'))[0]!.id)
  })

  it('finds liaisons and enchaînements', async () => {
    const analyze = createAnalyzer(new FakePhonemizer())
    const [first, second] = await analyze('Les enfants arrivent.\nAvec elle.')
    const [les] = words(first!.items)
    const [avec] = words(second!.items)
    expect(les).toMatchObject({ link: 'liaison', liaison: 'z' })
    expect(avec).toMatchObject({ link: 'enchainement', liaison: '' })
  })

  it('does not link across punctuation', async () => {
    const analyze = createAnalyzer(new FakePhonemizer())
    const [p] = await analyze('Avec, elle.')
    expect(words(p!.items)[0]!.link).toBeNull()
  })

  it('only phonemizes new words alone when analyzing again', async () => {
    const phonemizer = new FakePhonemizer()
    const analyze = createAnalyzer(phonemizer)
    await analyze('Les enfants.')
    phonemizer.calls = []
    await analyze('Les enfants avec elle.')
    expect(phonemizer.calls[1]).toEqual(['avec', 'elle'])
  })
})
