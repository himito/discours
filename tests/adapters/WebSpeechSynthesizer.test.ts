// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSpeechSynthesizer } from '#adapters/webspeech/WebSpeechSynthesizer'

/** A stand-in for the browser's SpeechSynthesisUtterance. */
class FakeUtterance {
  lang = ''
  rate = 1
  voice: unknown = null
  onboundary: ((e: { name: string; charIndex: number }) => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(readonly text: string) {}
}

const voice = (name: string, lang: string) => ({ name, lang, voiceURI: `uri:${name}` })

/** A stand-in for window.speechSynthesis, driven by the test. */
function fakeSynthesis(
  voices = [
    voice('Amélie', 'fr-CA'),
    voice('Google français', 'fr-FR'),
    voice('Thomas', 'fr-FR'),
    voice('Daniel', 'en-GB'),
    voice('Audrey', 'fr-FR'),
  ],
) {
  const listeners: (() => void)[] = []
  return {
    voices,
    spoken: [] as FakeUtterance[],
    getVoices: () => voices,
    speak(utterance: FakeUtterance) {
      this.spoken.push(utterance)
    },
    cancel: vi.fn(),
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
    changeVoices(next: ReturnType<typeof voice>[]) {
      voices.splice(0, voices.length, ...next)
      listeners.forEach((l) => l())
    },
  }
}

let synthesis: ReturnType<typeof fakeSynthesis>
beforeEach(() => {
  synthesis = fakeSynthesis()
  vi.stubGlobal('speechSynthesis', synthesis)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
})
afterEach(() => vi.unstubAllGlobals())

const last = () => synthesis.spoken.at(-1)!

describe('WebSpeechSynthesizer', () => {
  it('lists French voices, best first', () => {
    expect(new WebSpeechSynthesizer().voices().map((v) => v.name)).toEqual([
      'Google français',
      'Thomas',
      'Audrey',
      'Amélie',
    ])
  })

  it('tells listeners when the voices change', () => {
    const synthesizer = new WebSpeechSynthesizer()
    const listener = vi.fn()
    const unsubscribe = synthesizer.onVoicesChanged(listener)
    synthesis.changeVoices([voice('Thomas', 'fr-FR')])
    expect(listener).toHaveBeenCalledTimes(1)
    expect(synthesizer.voices().map((v) => v.name)).toEqual(['Thomas'])
    unsubscribe()
    synthesis.changeVoices([])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('speaks in French at the given rate, with the chosen voice', async () => {
    const spoken = new WebSpeechSynthesizer().speak('Bonjour', { rate: 0.8, voiceId: 'uri:Thomas' })
    expect(last()).toMatchObject({ text: 'Bonjour', lang: 'fr-FR', rate: 0.8 })
    expect(last().voice).toMatchObject({ name: 'Thomas' })
    last().onend?.()
    await expect(spoken).resolves.toBe(true)
  })

  it('falls back to the best voice when the chosen one is missing', () => {
    void new WebSpeechSynthesizer().speak('Bonjour', { rate: 1, voiceId: 'uri:Gone' })
    expect(last().voice).toMatchObject({ name: 'Google français' })
  })

  it('reports each word as it is spoken', () => {
    const onWord = vi.fn()
    void new WebSpeechSynthesizer().speak('Bonjour à tous', { rate: 1, voiceId: '', onWord })
    last().onboundary?.({ name: 'word', charIndex: 8 })
    last().onboundary?.({ name: 'sentence', charIndex: 0 })
    expect(onWord.mock.calls).toEqual([[8]])
  })

  it('interrupts the previous text and ignores its late events', async () => {
    const synthesizer = new WebSpeechSynthesizer()
    const onWord = vi.fn()
    const first = synthesizer.speak('Un', { rate: 1, voiceId: '', onWord })
    const firstUtterance = last()
    const second = synthesizer.speak('Deux', { rate: 1, voiceId: '' })
    expect(synthesis.cancel).toHaveBeenCalled()
    firstUtterance.onboundary?.({ name: 'word', charIndex: 0 })
    firstUtterance.onend?.()
    expect(onWord).not.toHaveBeenCalled()
    await expect(first).resolves.toBe(false)
    last().onend?.()
    await expect(second).resolves.toBe(true)
  })

  it('reports a failed or stopped utterance as not finished', async () => {
    const synthesizer = new WebSpeechSynthesizer()
    const failed = synthesizer.speak('Un', { rate: 1, voiceId: '' })
    last().onerror?.()
    await expect(failed).resolves.toBe(false)
    const stopped = synthesizer.speak('Deux', { rate: 1, voiceId: '' })
    synthesizer.stop()
    last().onend?.()
    await expect(stopped).resolves.toBe(false)
  })

  it('does nothing without browser support', async () => {
    vi.unstubAllGlobals()
    const synthesizer = new WebSpeechSynthesizer()
    expect(synthesizer.supported).toBe(false)
    await expect(synthesizer.speak('Bonjour', { rate: 1, voiceId: '' })).resolves.toBe(false)
  })
})
