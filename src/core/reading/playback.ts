/**
 * Playing paragraphs with the model voice.
 *
 * @packageDocumentation
 */
import type { AnalyzedParagraph } from '#core/model'
import type { SpeechSynthesizer } from './SpeechSynthesizer'
import { spokenIndex, spokenText } from '#core/speech/units'

/** Silences between paragraphs, in milliseconds. */
export interface Gaps {
  /** Between two paragraphs of a section. */
  paragraph: number
  /** Before a paragraph that starts a new section. */
  section: number
}

/** Default {@link Gaps}. */
export const DEFAULT_GAPS: Gaps = { paragraph: 450, section: 1100 }

/** How to play. */
export interface PlaybackOptions {
  /** Speaking rate: 1 is normal. */
  rate: number
  /** Voice to use; empty for the best one. */
  voiceId: string
  /** Stops the playback when aborted. */
  signal?: AbortSignal
  /** Silences between paragraphs. */
  gaps?: Gaps
  /** Called when a paragraph starts, with its index in the speech. */
  onParagraph?: (paragraph: number) => void
  /**
   * Called when a word starts, with its paragraph's index and the word's index in the paragraph's
   * items.
   */
  onWord?: (paragraph: number, item: number) => void
}

/**
 * Speaks paragraphs `from` to `to` one after the other, one utterance each.
 *
 * @remarks One utterance per paragraph keeps a natural intonation across its sentences. Reading
 * marks become pauses (see `spokenText`). Between two paragraphs comes a silence, longer before a
 * new section (see {@link Gaps}). `to` may go past the end of the speech.
 *
 * @returns `true` if every paragraph was spoken, `false` if the playback was stopped (by `signal`,
 *   by another `speak` on the synthesizer) or failed.
 */
export async function playParagraphs(
  synthesizer: SpeechSynthesizer,
  speech: readonly AnalyzedParagraph[],
  from: number,
  to: number,
  options: PlaybackOptions,
): Promise<boolean> {
  const { signal, gaps = DEFAULT_GAPS } = options
  const paragraphs = speech.slice(from, to + 1)
  const stopSpeaking = () => synthesizer.stop()
  signal?.addEventListener('abort', stopSpeaking)
  try {
    for (const [offset, paragraph] of paragraphs.entries()) {
      if (signal?.aborted) return false
      const spoken = await speakParagraph(synthesizer, paragraph, from + offset, options)
      if (!spoken) return false
      const next = paragraphs[offset + 1]
      if (next) await pause(gapBetween(paragraph, next, gaps), signal)
    }
    return !signal?.aborted
  } finally {
    signal?.removeEventListener('abort', stopSpeaking)
  }
}

/**
 * Speaks one paragraph, reporting it and each of its words through the callbacks.
 *
 * @param index - The paragraph's index in the speech, passed to the callbacks.
 * @returns Whether the paragraph was spoken to the end.
 */
function speakParagraph(
  synthesizer: SpeechSynthesizer,
  paragraph: AnalyzedParagraph,
  index: number,
  options: PlaybackOptions,
): Promise<boolean> {
  const { text, ranges } = spokenText(paragraph.items)
  options.onParagraph?.(index)
  return synthesizer.speak(text, {
    rate: options.rate,
    voiceId: options.voiceId,
    onWord: (charIndex) => options.onWord?.(index, spokenIndex(ranges, charIndex)),
  })
}

/** The silence between two consecutive paragraphs: longer when the second starts a section. */
function gapBetween(current: AnalyzedParagraph, next: AnalyzedParagraph, gaps: Gaps): number {
  return next.section !== current.section ? gaps.section : gaps.paragraph
}

/**
 * Waits `ms` milliseconds, or less if `signal` aborts.
 *
 * @remarks The abort listener is removed once the wait is over, so a long playback doesn't pile
 * up one listener per paragraph on its signal.
 */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal?.addEventListener('abort', finish, { once: true })
  })
}
