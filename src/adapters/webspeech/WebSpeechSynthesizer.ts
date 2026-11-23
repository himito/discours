/**
 * {@link SpeechSynthesizer} backed by the browser's speech synthesis (Web Speech API).
 *
 * @packageDocumentation
 */
import type { SpeakOptions, SpeechSynthesizer, Voice } from '#core/reading/SpeechSynthesizer'

/**
 * How good a voice usually sounds: fr-FR voices, Google first, then Thomas / Amélie / Denise /
 * Henri (macOS, Windows), then the rest. The same preference as the original prototype.
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
  /** Increments on each `speak`/`stop`, so events from a cancelled utterance are ignored. */
  private token = 0

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
    const mine = ++this.token
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'fr-FR'
      utterance.rate = options.rate
      const voice =
        this.frenchVoices.find((v) => v.voiceURI === options.voiceId) ?? this.frenchVoices[0]
      if (voice) utterance.voice = voice
      utterance.onboundary = (e) => {
        if (mine === this.token && e.name === 'word') options.onWord?.(e.charIndex)
      }
      utterance.onend = () => resolve(mine === this.token)
      utterance.onerror = () => resolve(false)
      speechSynthesis.speak(utterance)
    })
  }

  stop(): void {
    if (!this.supported) return
    this.token++
    speechSynthesis.cancel()
  }

  private refreshVoices(): void {
    this.frenchVoices = speechSynthesis
      .getVoices()
      .filter((v) => v.lang.toLowerCase().startsWith('fr'))
      .sort((a, b) => quality(b) - quality(a))
    this.listeners.forEach((listener) => listener())
  }
}
