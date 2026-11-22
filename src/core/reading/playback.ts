/**
 * Playing paragraphs with the model voice.
 *
 * @packageDocumentation
 */
import type { AnalyzedParagraph } from '../model'
import type { SpeechSynthesizer } from '../ports/SpeechSynthesizer'
import { spokenIndex, spokenText } from '../speech/units'

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
 * marks become pauses (see `spokenText`).
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
  const abort = () => synthesizer.stop()
  signal?.addEventListener('abort', abort)
  try {
    for (let i = from; i <= to && i < speech.length; i++) {
      if (signal?.aborted) return false
      const paragraph = speech[i]!
      const { text, ranges } = spokenText(paragraph.items)
      options.onParagraph?.(i)
      const finished = await synthesizer.speak(text, {
        rate: options.rate,
        voiceId: options.voiceId,
        onWord: (charIndex) => options.onWord?.(i, spokenIndex(ranges, charIndex)),
      })
      if (!finished) return false
      const next = speech[i + 1]
      if (i < to && next)
        await pause(next.section !== paragraph.section ? gaps.section : gaps.paragraph, signal)
    }
    return !signal?.aborted
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}

/** Waits `ms` milliseconds, or less if `signal` aborts. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}
