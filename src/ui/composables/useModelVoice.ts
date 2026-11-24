/**
 * The model voice, as reactive state for a component.
 *
 * @packageDocumentation
 */
import { onScopeDispose, readonly, ref, shallowRef, type Ref } from 'vue'
import { playParagraphs } from '#core/reading/playback'
import type { Voice } from '#core/reading/SpeechSynthesizer'
import { usePorts } from '#ui/composables/usePorts'
import { useDiscoursStore } from '#ui/stores/discours'
import type { Nullable } from '#core/types'

/** The word being spoken: its paragraph's index and its index in the paragraph's items. */
export interface SpokenWord {
  /** Index of the paragraph in the speech. */
  paragraph: number
  /** Index of the word in the paragraph's items; -1 before the first word. */
  item: number
}

/** The model voice for a component, from {@link useModelVoice}. */
export interface ModelVoice {
  /** Whether the browser can speak at all. */
  readonly supported: boolean
  /** Whether paragraphs are being played. */
  readonly playing: Readonly<Ref<boolean>>
  /** The word being spoken, if any. */
  readonly spoken: Readonly<Ref<Nullable<SpokenWord>>>
  /**
   * Plays paragraphs `from` to `to` (default: only `from`) of the speech, one after the other.
   *
   * @returns `true` if every paragraph was spoken.
   */
  play(from: number, to?: number): Promise<boolean>
  /** Speaks a single word, at the chosen rate unless `rate` is given. */
  sayWord(word: string, rate?: number): Promise<boolean>
  /** Stops the playback. */
  stop(): void
  /** Index of the item being spoken in paragraph `paragraph`, or -1. */
  spokenItem(paragraph: number): number
}

/**
 * Plays paragraphs and single words with the chosen voice and rate.
 *
 * @remarks Each component gets its own playback state. Only one text plays at a time: starting a
 * playback anywhere stops the others. Playback stops when the component is unmounted.
 */
export function useModelVoice(): ModelVoice {
  const { synthesizer } = usePorts()
  const store = useDiscoursStore()
  const playing = ref(false)
  const spoken = shallowRef<Nullable<SpokenWord>>(null)
  let controller: Nullable<AbortController> = null

  /**
   * Plays paragraphs `from` to `to` of the speech, one after the other.
   *
   * @returns `true` if every paragraph was spoken.
   */
  async function play(from: number, to = from): Promise<boolean> {
    stop()
    const mine = (controller = new AbortController())
    playing.value = true
    try {
      return await playParagraphs(synthesizer, store.paragraphs, from, to, {
        rate: store.rate,
        voiceId: store.voiceId,
        signal: mine.signal,
        onParagraph: (paragraph) => (spoken.value = { paragraph, item: -1 }),
        onWord: (paragraph, item) => (spoken.value = { paragraph, item }),
      })
    } finally {
      if (controller === mine) reset()
    }
  }

  /** Speaks a single word. */
  function sayWord(word: string, rate = store.rate): Promise<boolean> {
    stop()
    return synthesizer.speak(word, { rate, voiceId: store.voiceId })
  }

  /** Stops the playback. */
  function stop(): void {
    controller?.abort()
    synthesizer.stop()
    reset()
  }

  function reset(): void {
    controller = null
    playing.value = false
    spoken.value = null
  }

  /** Index of the item being spoken in paragraph `paragraph`, or -1. */
  const spokenItem = (paragraph: number): number =>
    spoken.value?.paragraph === paragraph ? spoken.value.item : -1

  onScopeDispose(stop)

  return {
    supported: synthesizer.supported,
    playing: readonly(playing),
    spoken: readonly(spoken),
    play,
    sayWord,
    stop,
    spokenItem,
  }
}

/** The available voices, kept up to date (browsers load them asynchronously). */
export function useVoices() {
  const { synthesizer } = usePorts()
  const voices = shallowRef<Voice[]>(synthesizer.voices())
  const unsubscribe = synthesizer.onVoicesChanged(() => (voices.value = synthesizer.voices()))
  onScopeDispose(unsubscribe)
  return readonly(voices)
}
