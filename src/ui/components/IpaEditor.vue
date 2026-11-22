<script setup lang="ts">
/**
 * Editing a word's IPA, with buttons for the French symbols that are hard to type.
 *
 * @remarks Emits `save` with the new IPA (the parent stores it) or `cancel`.
 */
import { nextTick, onMounted, ref } from 'vue'

/** Component props. */
const props = defineProps<{
  /** The IPA to start from. */
  ipa: string
}>()
/** `save`: the edited IPA; `cancel`: editing was abandoned. */
const emit = defineEmits<{ save: [ipa: string]; cancel: [] }>()

/** IPA symbols of French that are hard to type. */
const SYMBOLS = ['ə', 'ɛ', 'ɔ', 'ø', 'œ', 'ɑ̃', 'ɔ̃', 'ɛ̃', 'œ̃', 'ʁ', 'ʃ', 'ʒ', 'ɲ', 'ɥ']

/** IPA being edited. */
const draft = ref(props.ipa)
/** The field, to focus it and insert symbols at the cursor. */
const input = ref<HTMLInputElement>()

onMounted(() => input.value?.focus())

/** Inserts a symbol at the cursor, replacing the selection. */
function insert(symbol: string) {
  const el = input.value
  if (!el) return
  const start = el.selectionStart ?? draft.value.length
  const end = el.selectionEnd ?? start
  draft.value = draft.value.slice(0, start) + symbol + draft.value.slice(end)
  void nextTick(() => {
    el.focus()
    el.setSelectionRange(start + symbol.length, start + symbol.length)
  })
}
</script>

<template>
  <form class="edit" @submit.prevent="emit('save', draft)">
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
      <button type="button" class="btn" @click="emit('cancel')">Annuler</button>
    </div>
  </form>
</template>

<style scoped>
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
.bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
@media (max-width: 760px) {
  .bar .btn {
    flex: 1;
    justify-content: center;
    min-height: 44px;
  }
}
</style>
