/**
 * {@link SpeechSynthesizer} backed by the browser's speech synthesis (Web Speech API).
 *
 * @packageDocumentation
 */
import type { SpeakOptions, SpeechSynthesizer, Voice } from '#core/reading/SpeechSynthesizer'

/** Language of every utterance. */
const LANGUAGE = 'fr-FR'

/**
 * How good a voice usually sounds: fr-FR voices, Google first, then Thomas / Amélie / Denise /
 * Henri (macOS, Windows), then the rest.
 */
function quality(v: SpeechSynthesisVoice): number {
  if (!/^fr(-|_)FR/i.test(v.lang)) return 0
  if (/google/i.test(v.name)) return 3
  if (/(thomas|amélie|amelie|denise|henri)/i.test(v.name)) return 2
  return 1
}

/** Speaks with the browser's French voices. */
export class WebSpeechSynthesizer implements SpeechSynthesizer {
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  /** French voices, best first. */
  private frenchVoices: SpeechSynthesisVoice[] = []
  private readonly listeners = new Set<() => void>()
  /**
   * Number of the latest utterance. Each `speak` and `stop` starts a new number, so the events of
   * an interrupted utterance can be told apart and ignored.
   */
  private latest = 0

  constructor() {
    if (!this.supported) return
    this.refreshVoices()
    // Browsers load voices asynchronously.
    speechSynthesis.addEventListener('voiceschanged', () => this.refreshVoices())
  }

  voices(): Voice[] {
    return this.frenchVoices.map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang }))
  }

  onVoicesChanged(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  speak(text: string, options: SpeakOptions): Promise<boolean> {
    if (!this.supported) return Promise.resolve(false)
    this.stop()
    const number = ++this.latest
    const isLatest = () => number === this.latest
    const utterance = this.createUtterance(text, options)
    return new Promise((resolve) => {
      utterance.onboundary = (event) => {
        if (isLatest() && event.name === 'word') options.onWord?.(event.charIndex)
      }
      // An interrupted utterance also ends: it was not spoken to the end.
      utterance.onend = () => resolve(isLatest())
      utterance.onerror = () => resolve(false)
      speechSynthesis.speak(utterance)
    })
  }

  stop(): void {
    if (!this.supported) return
    this.latest++
    speechSynthesis.cancel()
  }

  /**
   * An utterance of `text` in French, at the given rate and voice.
   *
   * @param text - What to say.
   * @param options - The rate, and the voice to use.
   * @returns The utterance, ready to be spoken.
   */
  private createUtterance(text: string, { rate, voiceId }: SpeakOptions): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = LANGUAGE
    utterance.rate = rate
    const voice = this.voiceFor(voiceId)
    if (voice) utterance.voice = voice
    return utterance
  }

  /**
   * The voice to speak with.
   *
   * @param id - The chosen voice's {@link Voice.id}, or `''` for the best one.
   * @returns The chosen voice if available, else the best French voice; `undefined` if the browser
   *   has none (it then uses its default voice).
   */
  private voiceFor(id: string): SpeechSynthesisVoice | undefined {
    return this.frenchVoices.find((voice) => voice.voiceURI === id) ?? this.frenchVoices[0]
  }

  private refreshVoices(): void {
    this.frenchVoices = speechSynthesis
      .getVoices()
      .filter((v) => v.lang.toLowerCase().startsWith('fr'))
      .sort((a, b) => quality(b) - quality(a))
    this.listeners.forEach((listener) => listener())
  }
}
