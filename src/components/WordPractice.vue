<script setup lang="ts">
/**
 * Single-word practice panel, docked at the bottom of the screen.
 *
 * @remarks
 * As in the original prototype: the word is spoken when the panel opens. Then the user can
 * - **Écouter**: hear it again at the chosen rate,
 * - **Lentement**: hear it at 0.6×,
 * - **Répéter**: say it, checked by speech recognition.
 *
 * Unlike the prototype, the IPA can also be corrected here.
 *
 * Emits `close` on × or Escape. Exposes `repeat()` so the parent can bind it to the space bar.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { matchKeys, normForMatch, wordKey, type WordItem } from '@/phonetics/analyze'
import { closeEnough } from '@/practice/align'
import { listenOnce, recognitionSupported } from '@/composables/useRecognition'
import { useSpeech } from '@/composables/useSpeech'
import { useDiscoursStore } from '@/stores/discours'

const props = defineProps<{
  /** The word as written (punctuation is stripped for display and speech). */
  text: string
  /** The analyzed word, if known: gives its IPA and liaison. */
  item: WordItem | null
}>()
const emit = defineEmits<{ close: [] }>()

const store = useDiscoursStore()
const speech = useSpeech()

const word = computed(() => props.text.replace(/[«»"“”().,;:!?]/g, ''))
const key = computed(() => wordKey(word.value))
const ipa = computed(() => (props.item ? store.ipaOf(props.item) : (store.overrides[key.value] ?? '')))
const corrected = computed(() => store.overrides[key.value] !== undefined)

const message = ref(
  recognitionSupported
    ? 'Écoute, puis clique sur « Répéter » et prononce le mot.'
    : 'Répétition indisponible dans ce navigateur (utilise Chrome ou Edge).',
)
const verdict = ref<'' | 'good' | 'bad'>('')
const recording = ref(false)
let cancel: (() => void) | null = null

const stat = computed(() => store.wordStats[key.value])

function say(rate: number) {
  void speech.speak(`word:${key.value}`, word.value, { rate, voiceURI: store.voiceURI })
}

/** Listens for the word once and grades it; calling it again while listening stops. */
async function repeat() {
  if (!recognitionSupported) return
  if (recording.value) return stopRepeat()
  speech.stop()
  const target = matchKeys(word.value).pop() ?? ''
  recording.value = true
  verdict.value = ''
  message.value = 'Prononce le mot maintenant.'
  const session = listenOnce()
  cancel = session.cancel
  try {
    const alts = await session.result
    if (!recording.value) return
    if (!alts.length) {
      message.value = "Je n'ai rien entendu. Réessaie."
      return
    }
    const ok = alts.some((a) =>
      a
        .split(/\s+/)
        .flatMap((w) => normForMatch(w).split("'"))
        .filter(Boolean)
        .some((w) => closeEnough(w, target)),
    )
    store.recordWordTry(word.value, ok)
    verdict.value = ok ? 'good' : 'bad'
    message.value = ok
      ? `✓ Bien prononcé. Entendu : « ${alts[0]} »`
      : `✗ Pas encore. Entendu : « ${alts[0]} ». Réécoute et réessaie.`
  } catch (e) {
    message.value = e instanceof Error ? e.message : String(e)
  } finally {
    recording.value = false
    cancel = null
  }
}

function stopRepeat() {
  recording.value = false
  cancel?.()
}

defineExpose({ repeat })

// ---------------------------------------------------------------- IPA correction

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement>()
const SYMBOLS = ['ə', 'ɛ', 'ɔ', 'ø', 'œ', 'ɑ̃', 'ɔ̃', 'ɛ̃', 'œ̃', 'ʁ', 'ʃ', 'ʒ', 'ɲ', 'ɥ']

function edit() {
  draft.value = ipa.value
  editing.value = true
  void nextTick(() => input.value?.focus())
}
function insert(sym: string) {
  const el = input.value
  if (!el) return
  const a = el.selectionStart ?? draft.value.length
  const b = el.selectionEnd ?? a
  draft.value = draft.value.slice(0, a) + sym + draft.value.slice(b)
  void nextTick(() => {
    el.focus()
    el.setSelectionRange(a + sym.length, a + sym.length)
  })
}
function save() {
  store.setOverride(key.value, props.item && draft.value === props.item.ipa ? null : draft.value)
  editing.value = false
}
function reset() {
  store.setOverride(key.value, null)
  editing.value = false
}

function close() {
  stopRepeat()
  emit('close')
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  say(store.rate)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  stopRepeat()
})
</script>

<template>
  <div class="wp" role="dialog" :aria-label="`Prononciation de ${word}`">
    <button type="button" class="x" aria-label="Fermer" @click="close">×</button>
    <div class="wpw">{{ word }}</div>

    <div v-if="!editing" class="wpi">
      <template v-if="ipa">/{{ ipa }}/</template>
      <span v-if="item?.link === 'liaison'" class="lz">‿{{ item.liaison }}</span>
      <button type="button" class="link" @click="edit">{{ ipa ? "Corriger l'API" : "Ajouter l'API" }}</button>
      <button v-if="corrected" type="button" class="link" @click="reset">Rétablir</button>
    </div>
    <form v-else class="edit" @submit.prevent="save">
      <input ref="input" v-model="draft" class="field" spellcheck="false" autocomplete="off" aria-label="Transcription API" />
      <div class="symbols">
        <button v-for="s in SYMBOLS" :key="s" type="button" class="sym" @click="insert(s)">{{ s }}</button>
      </div>
      <div class="bar">
        <button type="submit" class="btn primary">Enregistrer</button>
        <button type="button" class="btn" @click="editing = false">Annuler</button>
      </div>
    </form>

    <div class="bar">
      <button type="button" class="btn" @click="say(store.rate)">▶ Écouter</button>
      <button type="button" class="btn" @click="say(0.6)">▶ Lentement</button>
      <button type="button" class="btn" :class="recording ? 'rec' : 'primary'" :disabled="!recognitionSupported" @click="repeat">
        {{ recording ? "■ J'écoute…" : '● Répéter' }}
      </button>
    </div>
    <div class="wpr" :class="verdict">{{ message }}</div>
    <div class="wps">
      <template v-if="stat?.n">Réussi {{ stat.ok }} fois sur {{ stat.n }} essai{{ stat.n > 1 ? 's' : '' }}</template>
      <template v-if="item?.source === 'espeak' && !corrected"> · API automatique (eSpeak)</template>
    </div>
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
  z-index: 20;
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
.edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field {
  font-family: var(--ipa-font);
  font-size: 20px;
  padding: 6px 10px;
  border: 2px solid var(--line);
  color: var(--ink);
}
.field:focus {
  outline: none;
  border-color: var(--accent);
}
.symbols {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.sym {
  font-family: var(--ipa-font);
  font-size: 16px;
  min-width: 32px;
  padding: 2px 6px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
}
.sym:hover {
  background: var(--tint);
}
</style>
