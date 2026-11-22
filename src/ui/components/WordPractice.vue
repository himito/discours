<script setup lang="ts">
/**
 * Single-word practice panel, docked at the bottom of the screen.
 *
 * @remarks
 * As in the original prototype: the word is spoken when the panel opens. Then the user can
 * - **Écouter**: hear it again at the chosen rate,
 * - **Lentement**: hear it at 0.6×,
 * - **Répéter**: say it, checked by speech recognition (`isWordRecognized`).
 *
 * The IPA can also be corrected (`IpaEditor`), and the word's definitions are shown
 * (`WordDefinition`, except for technical terms).
 *
 * Emits `close` on × or Escape. Exposes `repeat()` so the parent can bind it to the space bar.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { WordItem } from '@/core/model'
import { RecognitionFailure, type UtteranceRecognition } from '@/core/ports'
import { isWordRecognized } from '@/core/reading/align'
import { bareWord, isTechnicalTerm, wordKey } from '@/core/text/words'
import IpaEditor from '@/ui/components/IpaEditor.vue'
import WordDefinition from '@/ui/components/WordDefinition.vue'
import { useModelVoice } from '@/ui/composables/useModelVoice'
import { recognitionMessage } from '@/ui/format'
import { usePorts } from '@/ui/ports'
import { useDiscoursStore } from '@/ui/stores/discours'

/** Component props. */
const props = defineProps<{
  /** The word as written (punctuation is stripped for display and speech). */
  text: string
  /** The analyzed word, if known: gives its IPA and liaison. */
  item: WordItem | null
}>()
/** `close`: the panel is closed (× or Escape). */
const emit = defineEmits<{ close: [] }>()

/** Rate of "Lentement". */
const SLOW_RATE = 0.6

const store = useDiscoursStore()
const voice = useModelVoice()
const { recognizer } = usePorts()

/** The word without surrounding punctuation, as shown and spoken. */
const word = computed(() => bareWord(props.text))
/** Key of the word in the store (corrections, statistics). */
const key = computed(() => wordKey(word.value))
/** IPA shown: the user's correction, the analyzed IPA, or `''`. */
const ipa = computed(() =>
  props.item ? store.ipaOf(props.item) : (store.overrides[key.value] ?? ''),
)
/** Whether the user corrected this word's IPA. */
const corrected = computed(() => store.overrides[key.value] !== undefined)
/** Practice results of this word, if any. */
const stat = computed(() => store.wordStats[key.value])
/** Whether the word may be in a dictionary (not an acronym or a number). */
const hasDefinition = computed(
  () => !props.item?.tech && !isTechnicalTerm(word.value) && /\p{L}{2}/u.test(word.value),
)

// ---------------------------------------------------------------- repeating

/** Instruction or result shown under the buttons. */
const message = ref(
  recognizer.supported
    ? 'Écoute, puis clique sur « Répéter » et prononce le mot.'
    : 'Répétition indisponible dans ce navigateur (utilise Chrome ou Edge).',
)
/** Result of the last attempt, for its colour. */
const verdict = ref<'' | 'good' | 'bad'>('')
/** The recognition in progress, if any. */
const listening = shallowRef<UtteranceRecognition | null>(null)

/** Listens for the word once and grades it; calling it again while listening stops. */
async function repeat() {
  if (!recognizer.supported) return
  if (listening.value) return stopListening()
  voice.stop()
  verdict.value = ''
  message.value = 'Prononce le mot maintenant.'
  const recognition = (listening.value = recognizer.listenOnce())
  try {
    const heard = await recognition.result
    if (listening.value !== recognition) return
    if (!heard.length) {
      message.value = "Je n'ai rien entendu. Réessaie."
      return
    }
    const ok = isWordRecognized(word.value, heard)
    store.recordAttempt(word.value, ok)
    verdict.value = ok ? 'good' : 'bad'
    message.value = ok
      ? `✓ Bien prononcé. Entendu : « ${heard[0]} »`
      : `✗ Pas encore. Entendu : « ${heard[0]} ». Réécoute et réessaie.`
  } catch (e) {
    message.value = e instanceof RecognitionFailure ? recognitionMessage(e.reason) : String(e)
  } finally {
    if (listening.value === recognition) listening.value = null
  }
}

/** Stops listening without grading. */
function stopListening() {
  listening.value?.cancel()
  listening.value = null
}

defineExpose({ repeat })

// ---------------------------------------------------------------- IPA correction

/** Whether the IPA editor is open. */
const editing = ref(false)

/** Stores the edited IPA; the analyzed IPA unchanged removes the correction. */
function saveIpa(value: string) {
  store.setCorrection(key.value, value, props.item?.ipa)
  editing.value = false
}

/** Removes the user's correction. */
function resetIpa() {
  store.setCorrection(key.value, null)
}

// ---------------------------------------------------------------- panel

/** Stops listening and closes the panel. */
function close() {
  stopListening()
  emit('close')
}
/** Escape closes the panel. */
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  void voice.sayWord(word.value)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  stopListening()
})
</script>

<template>
  <div class="wp" role="dialog" :aria-label="`Prononciation de ${word}`">
    <button type="button" class="x" aria-label="Fermer" @click="close">×</button>
    <div class="wpw">{{ word }}</div>

    <IpaEditor v-if="editing" :ipa="ipa" @save="saveIpa" @cancel="editing = false" />
    <div v-else class="wpi">
      <template v-if="ipa">/{{ ipa }}/</template>
      <span v-if="item?.link === 'liaison'" class="lz">‿{{ item.liaison }}</span>
      <button type="button" class="link" @click="editing = true">
        {{ ipa ? "Corriger l'API" : "Ajouter l'API" }}
      </button>
      <button v-if="corrected" type="button" class="link" @click="resetIpa">Rétablir</button>
    </div>

    <div class="bar">
      <button type="button" class="btn" @click="voice.sayWord(word)">▶ Écouter</button>
      <button type="button" class="btn" @click="voice.sayWord(word, SLOW_RATE)">▶ Lentement</button>
      <button
        type="button"
        class="btn"
        :class="listening ? 'rec' : 'primary'"
        :disabled="!recognizer.supported"
        @click="repeat"
      >
        {{ listening ? "■ J'écoute…" : '● Répéter' }}
      </button>
    </div>
    <div class="wpr" :class="verdict">{{ message }}</div>
    <div class="wps">
      <template v-if="stat?.n"
        >Réussi {{ stat.ok }} fois sur {{ stat.n }} essai{{ stat.n > 1 ? 's' : '' }}</template
      >
      <template v-if="item?.source === 'espeak' && !corrected">
        · API automatique (eSpeak)</template
      >
    </div>

    <WordDefinition v-if="hasDefinition" :word="word" />
  </div>
</template>

<style scoped>
.wp {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  width: min(520px, calc(100vw - 32px));
  background: #fff;
  border: 2px solid var(--ink);
  box-shadow: 0 12px 32px rgba(0, 40, 75, 0.18);
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 40;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
}
.x {
  position: absolute;
  top: 8px;
  right: 10px;
  border: 0;
  background: none;
  font-size: 22px;
  color: var(--soft);
  line-height: 1;
}
.wpw {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
}
.wpi {
  font-family: var(--ipa-font);
  font-size: 20px;
  color: var(--accent);
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.wpi .link {
  font-family: var(--sans);
}
.lz {
  color: var(--liaison);
  font-weight: 700;
  margin-left: -8px;
}
.wpr {
  font-size: 15px;
  min-height: 22px;
  color: var(--soft);
}
.wpr.good {
  color: var(--ok);
  font-weight: 600;
}
.wpr.bad {
  color: var(--bad);
  font-weight: 600;
}
.wps {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--soft);
}
.bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
@media (max-width: 760px) {
  /* Bottom sheet, above the sticky action bar. */
  .wp {
    left: 0;
    right: 0;
    bottom: 0;
    transform: none;
    width: 100%;
    border: 0;
    border-top: 2px solid var(--ink);
    border-radius: 14px 14px 0 0;
    padding: 18px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -10px 30px rgba(0, 40, 75, 0.2);
  }
  .x {
    width: 40px;
    height: 40px;
    top: 6px;
    right: 6px;
  }
  .wpw {
    font-size: 28px;
    padding-right: 40px;
  }
  .bar .btn {
    flex: 1;
    justify-content: center;
    min-height: 44px;
    padding: 0 10px;
  }
}
</style>
