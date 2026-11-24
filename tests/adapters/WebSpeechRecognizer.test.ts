// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readResults, WebSpeechRecognizer } from '#adapters/webspeech/WebSpeechRecognizer'
import { RecognitionFailure } from '#core/reading/SpeechRecognizer'

/** A recognition result as the browser builds it: a list of guesses with `isFinal`. */
const result = (isFinal: boolean, ...guesses: string[]) =>
  Object.assign(
    guesses.map((transcript) => ({ transcript })),
    { isFinal },
  )

/** A stand-in for the browser's SpeechRecognition, driven by the test. */
class FakeRecognition {
  static last: FakeRecognition
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  starts = 0
  start = vi.fn(() => this.starts++)
  stop = vi.fn()
  abort = vi.fn(() => this.onend?.())
  constructor() {
    FakeRecognition.last = this
  }
  emit(resultIndex: number, ...results: ReturnType<typeof result>[]) {
    this.onresult?.({ resultIndex, results })
  }
}

afterEach(() => vi.unstubAllGlobals())

function recognizer() {
  vi.stubGlobal('SpeechRecognition', FakeRecognition)
  return new WebSpeechRecognizer()
}

describe('WebSpeechRecognizer', () => {
  it('is unsupported without the browser API', () => {
    expect(new WebSpeechRecognizer().supported).toBe(false)
  })

  it('reports the transcript of a continuous recognition as it grows', () => {
    const onTranscript = vi.fn()
    recognizer().listen({ onTranscript, onError: vi.fn() })
    const rec = FakeRecognition.last
    expect(rec).toMatchObject({ lang: 'fr-FR', continuous: true, interimResults: true })

    rec.emit(0, result(false, 'les enfants'))
    expect(onTranscript).toHaveBeenLastCalledWith('', 'les enfants')
    rec.emit(0, result(true, 'les enfants'), result(false, 'sont'))
    expect(onTranscript).toHaveBeenLastCalledWith(' les enfants', 'sont')
    rec.emit(1, result(true, 'les enfants'), result(true, 'sont arrivés'))
    expect(onTranscript).toHaveBeenLastCalledWith(' les enfants sont arrivés', '')
  })

  it('restarts after a silence until stopped', () => {
    const session = recognizer().listen({ onTranscript: vi.fn(), onError: vi.fn() })
    const rec = FakeRecognition.last
    rec.onend?.()
    expect(rec.starts).toBe(2)
    session.stop()
    rec.onend?.()
    expect(rec.starts).toBe(2)
  })

  it('reports a blocked microphone', () => {
    const onError = vi.fn()
    recognizer().listen({ onTranscript: vi.fn(), onError })
    FakeRecognition.last.onerror?.({ error: 'not-allowed' })
    expect(onError).toHaveBeenCalledWith('microphone-blocked')
  })

  it('returns the guesses for a single utterance, trimmed', async () => {
    const recognition = recognizer().listenOnce()
    const rec = FakeRecognition.last
    expect(rec).toMatchObject({ continuous: false, maxAlternatives: 5 })
    rec.emit(0, result(true, ' maison ', 'raison'))
    rec.onend?.()
    await expect(recognition.result).resolves.toEqual(['maison', 'raison'])
  })

  it('returns no guess when nothing was heard', async () => {
    const recognition = recognizer().listenOnce()
    FakeRecognition.last.emit(0)
    FakeRecognition.last.onend?.()
    await expect(recognition.result).resolves.toEqual([])
  })

  it('rejects a single utterance when the microphone is blocked', async () => {
    const recognition = recognizer().listenOnce()
    FakeRecognition.last.onerror?.({ error: 'service-not-allowed' })
    await expect(recognition.result).rejects.toBeInstanceOf(RecognitionFailure)
  })
})

describe('readResults', () => {
  it('adds confirmed results to the transcript and keeps the others as interim', () => {
    const event = {
      resultIndex: 1,
      results: [result(true, 'ignoré'), result(true, 'les'), result(false, 'enfants')],
    }
    expect(readResults(event, ' bonjour')).toEqual({ finals: ' bonjour les', interim: 'enfants' })
  })

  it('reads a result without any guess as empty', () => {
    expect(readResults({ resultIndex: 0, results: [result(false)] }, '')).toEqual({
      finals: '',
      interim: '',
    })
  })
})
