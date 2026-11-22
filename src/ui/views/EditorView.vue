<script setup lang="ts">
/**
 * Editing the speech.
 *
 * @remarks One paragraph per line, `# Title` lines for sections, `/` `//` `[→]` as reading marks.
 * The text is saved as it is typed. "S'entraîner" starts the analysis and opens the training
 * screen.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { SAMPLE_TEXT } from '@/ui/sampleText'
import { useDiscoursStore } from '@/ui/stores/discours'

const store = useDiscoursStore()
const router = useRouter()

/** Number of words in the text. */
const wordCount = computed(
  () => store.text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0,
)

/** Analyzes the text and opens the training screen. */
function start() {
  void store.analyze()
  void router.push({ name: 'entrainement' })
}
</script>

<template>
  <main class="editor">
    <div class="top">
      <h2>Texte du discours</h2>
      <span class="meta"
        >{{ wordCount }} mots · ≈ {{ Math.max(1, Math.round(wordCount / 135)) }} min à 135
        mots/min</span
      >
    </div>
    <p class="hint">
      Un paragraphe par ligne. Une ligne qui commence par <code>#</code> est un titre de partie.
      Dans le texte, <code>/</code> marque une pause courte, <code>//</code> une pause longue et
      <code>[→]</code> un enchaînement de diapositive.
    </p>
    <textarea
      v-model="store.text"
      class="text"
      spellcheck="true"
      lang="fr"
      aria-label="Texte du discours"
    />
    <div class="bar">
      <button type="button" class="btn primary" :disabled="!wordCount" @click="start">
        ▶ S'entraîner
      </button>
      <button
        v-if="store.text !== SAMPLE_TEXT"
        type="button"
        class="btn"
        @click="store.text = SAMPLE_TEXT"
      >
        Charger l'exemple
      </button>
      <button v-if="store.text" type="button" class="btn" @click="store.text = ''">Effacer</button>
    </div>
  </main>
</template>

<style scoped>
.editor {
  max-width: 900px;
  margin: 0 auto;
  padding: 28px clamp(16px, 4vw, 56px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}
.top h2 {
  margin: 0;
  font-family: var(--mono);
  font-size: 14px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
}
.meta {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
}
.hint {
  margin: 0;
  font-size: 14px;
  color: var(--soft);
  line-height: 1.5;
}
code {
  font-family: var(--mono);
  background: var(--tint);
  padding: 0 4px;
}
.text {
  min-height: 60vh;
  resize: vertical;
  font: 18px/1.7 var(--sans);
  color: var(--ink);
  border: 1px solid var(--line);
  padding: 20px 24px;
}
.text:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}
.bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
