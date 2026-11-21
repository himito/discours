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
 * Unlike the prototype, the IPA can also be corrected here, and the word's French definitions are
 * shown, from the Wiktionnaire (see `src/practice/dictionary.ts`).
 *
 * Emits `close` on × or Escape. Exposes `repeat()` so the parent can bind it to the space bar.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { matchKeys, normForMatch, wordKey, type WordItem } from '@/phonetics/analyze'
import { closeEnough } from '@/practice/align'
import { candidates, lookup, pageUrl, type Definition } from '@/practice/dictionary'
import { listenOnce, recognitionSupported } from '@/composables/useRecognition'
import { useSpeech } from '@/composables/useSpeech'
import { useDiscoursStore } from '@/stores/discours'

/** Component props. */
const props = defineProps<{
  /** The word as written (punctuation is stripped for display and speech). */
  text: string
  /** The analyzed word, if known: gives its IPA and liaison. */
  item: WordItem | null
}>()
/** `close`: the panel is closed (× or Escape). */
const emit = defineEmits<{ close: [] }>()

const store = useDiscoursStore()
const speech = useSpeech()

/** The word without surrounding punctuation, as shown and spoken. */
const word = computed(() => props.text.replace(/[«»"“”().,;:!?]/g, ''))
/** Key of the word in the store (overrides, statistics). */
const key = computed(() => wordKey(word.value))
/** IPA shown: the user's correction, the analyzed IPA, or `''`. */
const ipa = computed(() =>
  props.item ? store.ipaOf(props.item) : (store.overrides[key.value] ?? ''),
)
/** Whether the user corrected this word's IPA. */
const corrected = computed(() => store.overrides[key.value] !== undefined)

/** Instruction or result shown under the buttons. */
const message = ref(
  recognitionSupported
    ? 'Écoute, puis clique sur « Répéter » et prononce le mot.'
    : 'Répétition indisponible dans ce navigateur (utilise Chrome ou Edge).',
)
/** Result of the last attempt, for its colour. */
const verdict = ref<'' | 'good' | 'bad'>('')
/** Whether the microphone is listening for the word. */
const recording = ref(false)
let cancel: (() => void) | null = null

/** Practice results of this word, if any. */
const stat = computed(() => store.wordStats[key.value])

/** Speaks the word at `rate`. */
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

/** Stops listening without grading. */
function stopRepeat() {
  recording.value = false
  cancel?.()
}

defineExpose({ repeat })

// ---------------------------------------------------------------- IPA correction

const editing = ref(false)
/** IPA being edited. */
const draft = ref('')
/** The IPA field, to focus it and insert symbols at the cursor. */
const input = ref<HTMLInputElement>()
/** IPA symbols of French that are hard to type, offered as buttons. */
const SYMBOLS = ['ə', 'ɛ', 'ɔ', 'ø', 'œ', 'ɑ̃', 'ɔ̃', 'ɛ̃', 'œ̃', 'ʁ', 'ʃ', 'ʒ', 'ɲ', 'ɥ']

/** Opens the IPA editor with the current IPA. */
function edit() {
  draft.value = ipa.value
  editing.value = true
  void nextTick(() => input.value?.focus())
}
/** Inserts an IPA symbol at the cursor. */
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
/** Saves the edited IPA; the analyzed IPA unchanged removes the correction. */
function save() {
  store.setOverride(key.value, props.item && draft.value === props.item.ipa ? null : draft.value)
  editing.value = false
}
/** Removes the user's correction. */
function reset() {
  store.setOverride(key.value, null)
  editing.value = false
}

// ---------------------------------------------------------------- definition

const definition = ref<Definition | null>(null)
/** State of the definition look-up; `skip` for acronyms and numbers. */
const defState = ref<'loading' | 'done' | 'none' | 'skip' | 'error'>('loading')
/** Cancels the look-up when the panel closes. */
const lookupAbort = new AbortController()
/** Where to search by hand when there is no definition. */
const searchUrl = computed(() => pageUrl(candidates(word.value)[0] ?? word.value))

/** Looks the word up in the Wiktionnaire, unless it is a technical term. */
async function loadDefinition() {
  // Acronyms, numbers and other technical terms are not dictionary words.
  if (props.item?.tech || !/\p{L}{2}/u.test(word.value)) {
    defState.value = 'skip'
    return
  }
  try {
    definition.value = await lookup(word.value, lookupAbort.signal)
    defState.value = definition.value ? 'done' : 'none'
  } catch {
    if (!lookupAbort.signal.aborted) defState.value = 'error'
  }
}

/** Stops listening and closes the panel. */
function close() {
  stopRepeat()
  emit('close')
}
/** Escape closes the panel. */
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  say(store.rate)
  void loadDefinition()
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  stopRepeat()
  lookupAbort.abort()
})
</script>

<template>
  <div class="wp" role="dialog" :aria-label="`Prononciation de ${word}`">
    <button type="button" class="x" aria-label="Fermer" @click="close">×</button>
    <div class="wpw">{{ word }}</div>

    <div v-if="!editing" class="wpi">
      <template v-if="ipa">/{{ ipa }}/</template>
      <span v-if="item?.link === 'liaison'" class="lz">‿{{ item.liaison }}</span>
      <button type="button" class="link" @click="edit">
        {{ ipa ? "Corriger l'API" : "Ajouter l'API" }}
      </button>
      <button v-if="corrected" type="button" class="link" @click="reset">Rétablir</button>
    </div>
    <form v-else class="edit" @submit.prevent="save">
      <input
        ref="input"
        v-model="draft"
        class="field"
        spellcheck="false"
        autocomplete="off"
        aria-label="Transcription API"
      />
      <div class="symbols">
        <button v-for="s in SYMBOLS" :key="s" type="button" class="sym" @click="insert(s)">
          {{ s }}
        </button>
      </div>
      <div class="bar">
        <button type="submit" class="btn primary">Enregistrer</button>
        <button type="button" class="btn" @click="editing = false">Annuler</button>
      </div>
    </form>

    <div class="bar">
      <button type="button" class="btn" @click="say(store.rate)">▶ Écouter</button>
      <button type="button" class="btn" @click="say(0.6)">▶ Lentement</button>
      <button
        type="button"
        class="btn"
        :class="recording ? 'rec' : 'primary'"
        :disabled="!recognitionSupported"
        @click="repeat"
      >
        {{ recording ? "■ J'écoute…" : '● Répéter' }}
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

    <section v-if="defState !== 'skip'" class="def" aria-labelledby="def-title" aria-live="polite">
      <h3 id="def-title">
        Définition
        <a
          v-if="definition"
          class="src"
          :href="definition.url"
          target="_blank"
          rel="noopener noreferrer"
          >Wiktionnaire ↗</a
        >
      </h3>
      <p v-if="defState === 'loading'" class="def-note">Recherche dans le Wiktionnaire…</p>
      <p v-else-if="defState === 'error'" class="def-note">
        Définition indisponible : pas de connexion au Wiktionnaire.
      </p>
      <p v-else-if="defState === 'none'" class="def-note">
        Pas de définition trouvée.
        <a :href="searchUrl" target="_blank" rel="noopener noreferrer"
          >Chercher sur le Wiktionnaire ↗</a
        >
      </p>
      <template v-else-if="definition">
        <p v-if="definition.formOf" class="form-of">
          <i>{{ word }}</i> :
          {{ definition.formOf.charAt(0).toLowerCase() + definition.formOf.slice(1) }}
        </p>
        <div v-for="(e, ei) in definition.entries" :key="ei" class="entry">
          <p class="pos">
            {{ e.pos }}<template v-if="definition.lemma"> · {{ definition.lemma }}</template>
          </p>
          <ol>
            <li v-for="(sense, si) in e.senses" :key="si">
              {{ sense.text }}
              <q v-if="sense.example" class="ex">{{ sense.example }}</q>
            </li>
          </ol>
        </div>
      </template>
    </section>
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
.def {
  border-top: 1px solid var(--line);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.def h3 {
  margin: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
}
.src {
  font-size: 12px;
  font-weight: 400;
}
.def-note,
.form-of {
  margin: 0;
  font-size: 14px;
  color: var(--soft);
}
.entry + .entry {
  margin-top: 4px;
}
.pos {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}
.def ol {
  margin: 0;
  padding-left: 1.4em;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  line-height: 1.45;
}
.ex {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  font-style: italic;
  color: var(--soft);
  quotes: '« ' ' »';
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
