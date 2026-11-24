import { describe, expect, it, vi } from 'vitest'
import type { SpeakOptions, SpeechSynthesizer, Voice } from '#core/reading/SpeechSynthesizer'
import { playParagraphs } from '#core/reading/playback'
import { paragraph } from './fixtures'

/** A synthesizer that "speaks" instantly, reporting a boundary for each word. */
class FakeSynthesizer implements SpeechSynthesizer {
  readonly supported = true
  spoken: string[] = []
  stopped = 0

  voices(): Voice[] {
    return []
  }
  onVoicesChanged(): () => void {
    return () => {}
  }
  async speak(text: string, options: SpeakOptions): Promise<boolean> {
    this.spoken.push(text)
    for (const m of text.matchAll(/\S+/g)) options.onWord?.(m.index)
    return true
  }
  stop(): void {
    this.stopped++
  }
}

const speech = [
  paragraph('Bonjour / à tous .', 'A'),
  paragraph('Merci .', 'A'),
  paragraph('Fin .', 'B'),
]
const noGaps = { paragraph: 0, section: 0 }

describe('playParagraphs', () => {
  it('speaks each paragraph in turn, with marks as pauses', async () => {
    const synth = new FakeSynthesizer()
    const ok = await playParagraphs(synth, speech, 0, 2, { rate: 1, voiceId: '', gaps: noGaps })
    expect(ok).toBe(true)
    expect(synth.spoken).toEqual(['Bonjour, à tous.', 'Merci.', 'Fin.'])
  })

  it('reports paragraphs and words as they are spoken', async () => {
    const events: string[] = []
    await playParagraphs(new FakeSynthesizer(), speech, 0, 1, {
      rate: 1,
      voiceId: '',
      gaps: noGaps,
      onParagraph: (p) => events.push(`p${p}`),
      onWord: (p, i) => events.push(`${p}:${i}`),
    })
    expect(events).toEqual(['p0', '0:0', '0:2', '0:3', 'p1', '1:0'])
  })

  it('stops when aborted', async () => {
    const synth = new FakeSynthesizer()
    const controller = new AbortController()
    const ok = await playParagraphs(synth, speech, 0, 2, {
      rate: 1,
      voiceId: '',
      gaps: noGaps,
      signal: controller.signal,
      onWord: () => controller.abort(),
    })
    expect(ok).toBe(false)
    expect(synth.spoken).toEqual(['Bonjour, à tous.'])
    expect(synth.stopped).toBeGreaterThan(0)
  })

  it('waits longer before a new section, and plays a range past the end', async () => {
    vi.useFakeTimers()
    const waits = vi.spyOn(globalThis, 'setTimeout')
    const synth = new FakeSynthesizer()
    const run = playParagraphs(synth, speech, 0, 10, {
      rate: 1,
      voiceId: '',
      gaps: { paragraph: 100, section: 250 },
    })
    await vi.runAllTimersAsync()
    expect(await run).toBe(true)
    expect(synth.spoken).toHaveLength(3)
    expect(waits.mock.calls.map(([, ms]) => ms)).toEqual([100, 250])
    vi.useRealTimers()
  })

  it('removes the listeners it adds to the signal', async () => {
    const controller = new AbortController()
    const added = vi.spyOn(controller.signal, 'addEventListener')
    const removed = vi.spyOn(controller.signal, 'removeEventListener')
    await playParagraphs(new FakeSynthesizer(), speech, 0, 2, {
      rate: 1,
      voiceId: '',
      gaps: noGaps,
      signal: controller.signal,
    })
    expect(added).toHaveBeenCalledTimes(3)
    expect(removed).toHaveBeenCalledTimes(3)
  })
})
