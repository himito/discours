import { beforeAll, describe, expect, it } from 'vitest'
import { loadFrenchSynthesizer, phonemize } from '#adapters/espeak/engine'

// The real eSpeak engine, with its French data from public/espeak/ (built by `npm run espeak`).
let synthesizer: Awaited<ReturnType<typeof loadFrenchSynthesizer>>
beforeAll(async () => {
  synthesizer = await loadFrenchSynthesizer((file) => `${process.cwd()}/public/espeak/${file}`)
})

describe('eSpeak engine', () => {
  it('gives each phoneme with the position of the word that produced it', async () => {
    const trace = await phonemize(synthesizer, 'les enfants')
    const phonemes = trace.map(([, ipa]) => ipa.replace(/[ˈˌ]/g, '')).join('')
    expect(phonemes).toContain('ɑ̃fɑ̃')
    expect(trace[0]![0]).toBe(1)
    expect(trace.at(-1)![0]).toBe(5)
  })

  it('gives nothing for an empty text', async () => {
    expect(await phonemize(synthesizer, '')).toEqual([])
  })
})
