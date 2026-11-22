/**
 * Reading aloud, as reactive state for a component: recognition, live colours, scoring.
 *
 * @packageDocumentation
 */
import { computed, onScopeDispose, ref, shallowRef, type Ref } from 'vue'
import type { RecognitionError, RecognitionSession } from '@/core/ports'
import {
  followReading,
  readingTarget,
  scoreReading,
  wordsPerMinute,
  wordVerdict,
  type ReadingScore,
  type ReadingTarget,
  type WordVerdict,
} from '@/core/reading/session'
import { usePorts } from '@/ui/ports'
import { useDiscoursStore } from '@/ui/stores/discours'

/** Time left to the recognizer to deliver its last result after stopping, in ms. */
const LAST_RESULT_DELAY = 500

/** A finished reading. */
export interface ReadingResult {
  /** Scores of the paragraphs read, and overall. */
  score: ReadingScore
  /** Duration of the reading, in seconds. */
  seconds: number
  /** Reading speed, or `null` if too short to say. */
  wpm: number | null
}

/** A reading aloud for a component, from {@link useReadingSession}. */
export interface ReadingSession {
  /** Whether the browser can recognize speech. */
  readonly supported: boolean
  /** Whether the microphone is listening. */
  readonly listening: Ref<boolean>
  /** Why recognition stopped, if it failed. */
  readonly error: Ref<RecognitionError | null>
  /** What was recognized for sure so far. */
  readonly transcript: Ref<string>
  /** What is still being recognized. */
  readonly interim: Ref<string>
  /** The last finished reading. */
  readonly result: Ref<ReadingResult | null>
  /** Paragraph the reader has reached, or -1 when not reading. */
  readonly reached: Ref<number>
  /** Starts reading paragraphs `from` to `to` (default: to the end of the speech). */
  start(from: number, to?: number): void
  /** Ends the reading, then scores and records it. */
  finish(): Promise<ReadingResult | null>
  /** Stops listening without scoring. */
  stop(): void
  /** Forgets the last reading: its colours and its result. */
  clear(): void
  /** How word `index` of paragraph `paragraph` fared, for its colour. */
  verdict(paragraph: number, index: number): WordVerdict
}

/**
 * A reading aloud of paragraphs of the speech.
 *
 * @param scope - Which paragraphs are scored when the reading ends: `all` those started with, or
 *   only those `reached` (see `scoreReading`).
 *
 * @remarks The score is recorded in the store. Recognition stops when the component is unmounted.
 */
export function useReadingSession(scope: 'all' | 'reached'): ReadingSession {
  const { recognizer } = usePorts()
  const store = useDiscoursStore()

  const listening = ref(false)
  const finals = ref('')
  const interim = ref('')
  const error = ref<RecognitionError | null>(null)
  const target = shallowRef<ReadingTarget | null>(null)
  const result = shallowRef<ReadingResult | null>(null)
  let session: RecognitionSession | null = null
  let startedAt = 0

  /** The transcript aligned with the target, while reading and after. */
  const state = computed(() => {
    if (!target.value || (!listening.value && !result.value)) return null
    return followReading(target.value, `${finals.value} ${listening.value ? interim.value : ''}`)
  })

  /** Paragraph the reader has reached, or -1 when not reading. */
  const reached = computed(() => state.value?.reached ?? -1)

  /** Starts reading paragraphs `from` to `to` (default: to the end). */
  function start(from: number, to?: number): void {
    stop()
    target.value = readingTarget(store.paragraphs, from, to)
    result.value = null
    finals.value = ''
    interim.value = ''
    error.value = null
    listening.value = true
    startedAt = performance.now()
    session = recognizer.listen({
      onTranscript: (f, i) => {
        finals.value = f
        interim.value = i
      },
      onError: (e) => {
        error.value = e
        stop()
      },
    })
  }

  /** Ends the reading, then scores and records it. */
  async function finish(): Promise<ReadingResult | null> {
    const seconds = (performance.now() - startedAt) / 1000
    stop()
    await new Promise((resolve) => setTimeout(resolve, LAST_RESULT_DELAY))
    if (!target.value) return null
    const score = scoreReading(target.value, finals.value, scope)
    store.recordReading(score)
    result.value = { score, seconds, wpm: wordsPerMinute(score.words, seconds) }
    return result.value
  }

  /** Stops listening without scoring. */
  function stop(): void {
    session?.stop()
    session = null
    listening.value = false
  }

  /** Forgets the last reading: its colours and its result. */
  function clear(): void {
    stop()
    target.value = null
    result.value = null
  }

  /** How word `index` of paragraph `paragraph` fared, for its colour. */
  function verdict(paragraph: number, index: number): WordVerdict {
    if (!target.value || !state.value) return ''
    return wordVerdict(target.value, state.value, paragraph, index, listening.value)
  }

  onScopeDispose(stop)

  return {
    supported: recognizer.supported,
    listening,
    error,
    transcript: finals,
    interim,
    result,
    reached,
    start,
    finish,
    stop,
    clear,
    verdict,
  }
}
