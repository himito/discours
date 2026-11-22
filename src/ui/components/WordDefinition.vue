<script setup lang="ts">
/**
 * The French definitions of a word, from the `Dictionary` port.
 *
 * @remarks Looks the word up when mounted and cancels the request when unmounted. Shows a link to
 * search by hand when there is no entry, and a notice when the dictionary can't be reached.
 */
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { Definition } from '@/core/ports'
import { usePorts } from '@/ui/ports'

/** Component props. */
const props = defineProps<{
  /** The word as written in the speech. */
  word: string
}>()

const { dictionary } = usePorts()
/** The definitions found, if any. */
const definition = shallowRef<Definition | null>(null)
/** State of the look-up. */
const state = ref<'loading' | 'found' | 'none' | 'error'>('loading')
/** Cancels the look-up when the panel closes. */
const abort = new AbortController()

onMounted(async () => {
  try {
    definition.value = await dictionary.lookup(props.word, abort.signal)
    state.value = definition.value ? 'found' : 'none'
  } catch {
    if (!abort.signal.aborted) state.value = 'error'
  }
})
onBeforeUnmount(() => abort.abort())

/** "Pluriel de recherche" → "pluriel de recherche", after the word and a colon. */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
</script>

<template>
  <section class="def" aria-labelledby="def-title" aria-live="polite">
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
    <p v-if="state === 'loading'" class="note">Recherche dans le Wiktionnaire…</p>
    <p v-else-if="state === 'error'" class="note">
      Définition indisponible : pas de connexion au Wiktionnaire.
    </p>
    <p v-else-if="state === 'none'" class="note">
      Pas de définition trouvée.
      <a :href="dictionary.searchUrl(word)" target="_blank" rel="noopener noreferrer"
        >Chercher sur le Wiktionnaire ↗</a
      >
    </p>
    <template v-else-if="definition">
      <p v-if="definition.formOf" class="note">
        <i>{{ word }}</i> : {{ lowerFirst(definition.formOf) }}
      </p>
      <div v-for="(entry, ei) in definition.entries" :key="ei" class="entry">
        <p class="pos">
          {{ entry.pos }}<template v-if="definition.lemma"> · {{ definition.lemma }}</template>
        </p>
        <ol>
          <li v-for="(sense, si) in entry.senses" :key="si">
            {{ sense.text }}
            <q v-if="sense.example" class="ex">{{ sense.example }}</q>
          </li>
        </ol>
      </div>
    </template>
  </section>
</template>

<style scoped>
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
.note {
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
</style>
