<script setup lang="ts">
/**
 * The whole speech on one page, to listen to and read through without stopping.
 *
 * @remarks
 * - **Écouter**: the model voice reads the paragraphs one after the other (one utterance each, as
 *   on the training screen), from the chosen starting paragraph. The page follows along.
 * - **Lire à voix haute**: one continuous recognition session. The transcript is aligned with all
 *   the words from the starting paragraph on, so the reader can go on as long as they like. When
 *   they stop, every paragraph they reached is scored, as if read on its own, and missed words go
 *   to the words to work on.
 *
 * Clicking a paragraph number sets the starting paragraph; clicking a word opens the word panel.
 * Route `/discours`.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { WordItem } from '#core/model'
import {
  groupBySection,
  locate,
  readingSeconds,
  TARGET_WPM,
  totalWords,
} from '#core/speech/sections'
import SpeechText from '#ui/components/SpeechText.vue'
import WordPractice from '#ui/components/WordPractice.vue'
import { useModelVoice } from '#ui/composables/useModelVoice'
import { useReadingSession } from '#ui/composables/useReadingSession'
import { clock, paragraphLabel, recognitionMessage, scoreClass } from '#ui/format'
import { useDiscoursStore } from '#ui/stores/discours'

const store = useDiscoursStore()
const voice = useModelVoice()
const reading = useReadingSession('reached')
onMounted(() => void store.analyze())

const paragraphs = computed(() => store.paragraphs)
const sections = computed(() => groupBySection(paragraphs.value))
const words = computed(() => totalWords(paragraphs.value))

/** "Introduction § 2" for paragraph `index`. */
function label(index: number): string {
  const found = locate(sections.value, index)
  return found ? paragraphLabel(found.section, found.number) : ''
}

/** Paragraph where listening and reading start. */
const startAt = ref(0)
watch(paragraphs, (ps) => {
  if (startAt.value >= ps.length) startAt.value = 0
})

/** Selects the starting paragraph, and restarts listening there if playing. */
function setStart(index: number) {
  startAt.value = index
  if (voice.playing.value) playFromStart()
}

// ---------------------------------------------------------------- following along

const paragraphElements = new Map<number, HTMLElement>()
/** Template ref callback: remembers each paragraph's element, to scroll to it. */
function setParagraphElement(index: number, el: unknown) {
  if (el instanceof HTMLElement) paragraphElements.set(index, el)
  else paragraphElements.delete(index)
}
/** Whether the user asked for less motion: scrolling is then instant. */
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Keeps paragraph `index` in view. */
function follow(index: number) {
  paragraphElements
    .get(index)
    ?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
}

/** Paragraph being spoken or read, highlighted and kept in view; -1 if none. */
const activeIndex = computed(() =>
  voice.spoken.value
    ? voice.spoken.value.paragraph
    : reading.listening.value
      ? reading.reached.value
      : -1,
)
watch(activeIndex, (i) => {
  if (i >= 0) follow(i)
})

// ---------------------------------------------------------------- listening and reading

/** Reads the paragraphs from {@link startAt} to the end, or stops. */
function playAll() {
  if (voice.playing.value) voice.stop()
  else playFromStart()
}

/** Reads the paragraphs from {@link startAt} to the end. */
function playFromStart() {
  reading.stop()
  void voice.play(startAt.value, paragraphs.value.length - 1)
}

/** Starts reading from {@link startAt}, or ends and scores the reading. */
function toggleReading() {
  if (reading.listening.value) return void reading.finish()
  voice.stop()
  follow(startAt.value)
  reading.start(startAt.value)
}

/** Summary of the last reading: paragraphs reached, score, time, speed. */
const summary = computed(() => {
  const r = reading.result.value
  if (!r) return null
  const scored = r.score.paragraphs
  return {
    first: scored[0]?.index ?? -1,
    last: scored.at(-1)?.index ?? -1,
    percent: r.score.percent,
    seconds: r.seconds,
    wpm: r.wpm,
    missed: r.score.missed,
  }
})

// ---------------------------------------------------------------- word panel

/** Word open in the word panel, if any. */
const practising = shallowRef<{ text: string; item: WordItem } | null>(null)

/** Opens the word panel, stopping voice and recognition. */
function openWord(text: string, item: WordItem) {
  voice.stop()
  reading.stop()
  practising.value = { text, item }
}

// ---------------------------------------------------------------- keyboard

/** Space starts and ends the reading. */
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (practising.value || t?.closest('input, select, textarea, button, [role="button"]')) return
  if (e.code === 'Space') {
    e.preventDefault()
    if (reading.supported) toggleReading()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="doc-view">
    <header class="bar">
      <div class="bar-top">
        <RouterLink class="back" :to="{ name: 'entrainement' }">← Par paragraphe</RouterLink>
        <h1>Discours entier</h1>
        <span class="meta"
          >{{ words }} mots · ≈ {{ clock(readingSeconds(words)) }} à {{ TARGET_WPM }} mots/min</span
        >
      </div>
      <div class="bar-actions">
        <button
          type="button"
          class="btn"
          :disabled="!voice.supported || !paragraphs.length"
          @click="playAll"
        >
          <template v-if="voice.playing.value">■ Arrêter</template>
          <template v-else>▶ Écouter</template>
        </button>
        <button
          type="button"
          class="btn"
          :class="reading.listening.value ? 'rec' : 'primary'"
          :disabled="!reading.supported || !paragraphs.length"
          @click="toggleReading"
        >
          <template v-if="reading.listening.value">■ Terminer la lecture</template>
          <template v-else>● Lire à voix haute</template>
        </button>
        <span class="from">
          à partir de <b>{{ label(startAt) }}</b>
          <button v-if="startAt" type="button" class="link" @click="setStart(0)">
            revenir au début
          </button>
        </span>
        <span class="toggles">
          <label><input v-model="store.showIpa" type="checkbox" /> API</label>
          <label
            ><input v-model="store.showLinks" type="checkbox" :disabled="!store.showIpa" />
            Liaisons</label
          >
          <label class="speed"
            >Vitesse
            <input v-model.number="store.rate" type="range" min="0.6" max="1.1" step="0.05" />
            <output>{{ store.rate.toFixed(2) }}×</output></label
          >
        </span>
      </div>
      <p v-if="reading.error.value" class="msg" role="alert">
        {{ recognitionMessage(reading.error.value) }}
      </p>
      <p v-else-if="reading.listening.value" class="msg live">
        Lisez le discours à votre rythme, la page vous suit. Cliquez sur « Terminer la lecture »
        quand vous voulez vous arrêter.
      </p>
      <div v-else-if="summary" class="summary" role="status">
        <template v-if="summary.first < 0"
          >Rien n’a été reconnu. Vérifiez le micro et réessayez.</template
        >
        <template v-else>
          <span
            >Lu : <b>{{ label(summary.first) }}</b>
            <template v-if="summary.last > summary.first">
              → <b>{{ label(summary.last) }}</b></template
            ></span
          >
          <span
            ><b>{{ summary.percent }} %</b> compris</span
          >
          <span
            ><b>{{ clock(summary.seconds) }}</b></span
          >
          <span v-if="summary.wpm"
            ><b>{{ summary.wpm }}</b> mots/min (cible ≈ {{ TARGET_WPM }})</span
          >
          <span v-if="summary.missed"
            >{{ summary.missed }} mot{{ summary.missed > 1 ? 's' : '' }} à travailler</span
          >
        </template>
        <button type="button" class="link" @click="reading.clear()">Effacer les couleurs</button>
      </div>
      <p v-else-if="!reading.supported" class="msg">
        La lecture à voix haute fonctionne dans Chrome et Edge.
      </p>
    </header>

    <main class="doc">
      <p v-if="store.status === 'loading' && !paragraphs.length" class="state">Analyse du texte…</p>
      <p v-else-if="!paragraphs.length" class="state">
        Aucun texte. <RouterLink :to="{ name: 'texte' }">Écrire le discours</RouterLink>
      </p>
      <section v-for="(s, si) in sections" :key="si" class="sec">
        <h2 v-if="s.title">{{ s.title }}</h2>
        <div
          v-for="it in s.paragraphs"
          :key="it.paragraph.id + it.index"
          :ref="(el) => setParagraphElement(it.index, el)"
          class="para"
          :class="{ start: it.index === startAt, current: it.index === activeIndex }"
        >
          <button
            type="button"
            class="pnum"
            :title="`Commencer ici (${label(it.index)})`"
            :aria-pressed="it.index === startAt"
            @click="setStart(it.index)"
          >
            {{ it.number }}
            <span
              v-if="store.best[it.paragraph.id] !== undefined"
              class="score"
              :class="scoreClass(store.best[it.paragraph.id]!)"
              >{{ store.best[it.paragraph.id] }}%</span
            >
          </button>
          <SpeechText
            :items="it.paragraph.items"
            :say-index="voice.spokenItem(it.index)"
            :verdict="(i) => reading.verdict(it.index, i)"
            @word="openWord"
          />
        </div>
      </section>
    </main>

    <WordPractice
      v-if="practising"
      :key="practising.text"
      :text="practising.text"
      :item="practising.item"
      @close="practising = null"
    />
  </div>
</template>

<style scoped>
.doc-view {
  min-height: 100vh;
  background: #fff;
}

/* ------------------------------------------------------------ sticky bar */
.bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  border-bottom: 1px solid var(--line);
  padding: calc(12px + env(safe-area-inset-top, 0px)) clamp(16px, 4vw, 48px) 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bar-top {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 16px;
}
.back {
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
h1 {
  margin: 0;
  font-size: 18px;
}
.meta {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}
.bar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 14px;
}
.from {
  font-size: 14px;
  color: var(--soft);
  display: inline-flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
}
.from b {
  color: var(--ink);
}
.toggles {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 14px;
}
.toggles label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.toggles input[type='checkbox'] {
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
}
.speed input {
  width: 90px;
  accent-color: var(--accent);
}
.speed output {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--accent);
  min-width: 3.5em;
}
.msg {
  margin: 0;
  font-size: 14px;
  color: var(--soft);
}
.msg.live {
  color: var(--bad);
  font-weight: 600;
}
.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 18px;
  font-size: 14px;
  padding: 8px 12px;
  background: var(--tint);
}
.summary b {
  font-weight: 700;
}

/* ------------------------------------------------------------ text */
.doc {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px clamp(16px, 4vw, 48px) 30vh;
}
.state {
  text-align: center;
  color: var(--soft);
  margin-top: 15vh;
}
.sec + .sec {
  margin-top: 36px;
}
.sec h2 {
  margin: 0 0 12px;
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink);
  border-bottom: 2px solid var(--ink);
  padding-bottom: 6px;
}
.para {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 8px;
  padding: 12px 8px 12px 0;
  border-left: 3px solid transparent;
  scroll-margin-top: 180px;
  transition: background 0.2s;
}
.para.start {
  border-left-color: var(--accent);
}
.para.current {
  background: #f8f6ff;
}
.pnum {
  align-self: start;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 6px;
  border: 0;
  background: none;
  padding: 2px 0;
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}
.pnum:hover {
  text-decoration: underline;
}
.score {
  font-size: 11px;
}
.s-hi {
  color: var(--ok);
}
.s-mid {
  color: #8a5a00;
}
.s-lo {
  color: var(--bad);
}

@media (max-width: 760px) {
  .meta {
    margin-left: 0;
    width: 100%;
  }
  .toggles {
    margin-left: 0;
  }
  .bar-actions .btn {
    flex: 1;
    justify-content: center;
    min-height: 44px;
  }
  .para {
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 4px;
  }
}
</style>
