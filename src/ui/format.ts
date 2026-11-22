/**
 * Presentation of values: durations, labels and messages, in French.
 *
 * @packageDocumentation
 */
import type { RecognitionError } from '@/core/reading/SpeechRecognizer'
import type { Section } from '@/core/speech/sections'

/** Seconds as a clock, `m:ss`. */
export function clock(seconds: number): string {
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A reading time rounded to 5 seconds: "40 s", "2 min", "2 min 30". */
export function duration(seconds: number): string {
  const sec = Math.max(5, Math.round(seconds / 5) * 5)
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`
}

/** Title of a section, or "Discours" for paragraphs before any title. */
export const sectionTitle = (title: string): string => title || 'Discours'

/** "Introduction § 2": a paragraph by its section and number. */
export const paragraphLabel = (section: Pick<Section, 'title'>, number: number): string =>
  `${sectionTitle(section.title)} § ${number}`

/** Colour class of a score: high (90 % or more), medium (70 % or more) or low. */
export const scoreClass = (percent: number): 's-hi' | 's-mid' | 's-lo' =>
  percent >= 90 ? 's-hi' : percent >= 70 ? 's-mid' : 's-lo'

/** What to tell the user when speech recognition fails. */
export function recognitionMessage(error: RecognitionError): string {
  switch (error) {
    case 'microphone-blocked':
      return 'Le micro est bloqué. Autorise le micro pour cette page dans ton navigateur, puis réessaie.'
  }
}
