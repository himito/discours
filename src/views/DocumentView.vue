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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import SpeechText from '@/components/SpeechText.vue'
import WordPractice from '@/components/WordPractice.vue'
import { recognitionSupported, useReading } from '@/composables/useRecognition'
import { useSpeech } from '@/composables/useSpeech'
import type { AnalyzedParagraph, Item, WordItem } from '@/phonetics/analyze'
import { align } from '@/practice/align'
import { spokenIndex, spokenText } from '@/practice/units'
import { useDiscoursStore } from '@/stores/discours'

const store = useDiscoursStore()
const speech = useSpeech()
const reading = useReading()
onMounted(() => void store.analyze())

const WPM_TARGET = 135
/** Silence between two paragraphs, and before a new section, in ms. */
const GAP = { paragraph: 450, section: 1100 }

const paragraphs = computed(() => store.paragraphs)
const wordsOf = (p: AnalyzedParagraph) => p.items.filter((i) => i.kind === 'word').length

/** Paragraphs grouped by section, numbered within their section as in the sidebar. */
const sections = computed(() => {
  const out: { title: string; items: { p: AnalyzedParagraph; index: number; n: number }[] }[] = []
  paragraphs.value.forEach((p, index) => {
    let sec = out[out.length - 1]
    if (!sec || sec.title !== p.section) out.push((sec = { title: p.section, items: [] }))
    sec.items.push({ p, index, n: sec.items.length + 1 })
  })
  return out
})

const totalWords = computed(() => paragraphs.value.reduce((n, p) => n + wordsOf(p), 0))

const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`

/** Paragraph where listening and reading start. */
const startAt = ref(0)
watch(paragraphs, (ps) => {
  if (startAt.value >= ps.length) startAt.value = 0
})

// ---------------------------------------------------------------- following along

const paraEls = new Map<number, HTMLElement>()
function setParaEl(index: number, el: unknown) {
  if (el instanceof HTMLElement) paraEls.set(index, el)
  else paraEls.delete(index)
}
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Keeps paragraph `index` in view while listening or reading. */
function follow(index: number) {
  paraEls
    .get(index)
    ?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
}

// ---------------------------------------------------------------- listening

const playing = ref(false)
/** Paragraph being spoken, or -1. */
const playingIndex = ref(-1)
let playRun = 0

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Reads the paragraphs one after the other from {@link startAt}, until the end or a stop. */
async function playAll() {
  if (playing.value) return stopPlaying()
  stopReading()
  const run = ++playRun
  playing.value = true
  for (let i = startAt.value; i < paragraphs.value.length; i++) {
    const p = paragraphs.value[i]!
    playingIndex.value = i
    follow(i)
    const ok = await speech.speak(`doc:${i}`, spokenText(p.items).text, {
      rate: store.rate,
      voiceURI: store.voiceURI,
    })
    if (!ok || run !== playRun) break
    const next = paragraphs.value[i + 1]
    if (next) await wait(next.section !== p.section ? GAP.section : GAP.paragraph)
    if (run !== playRun) break
  }
  if (run === playRun) {
    playing.value = false
    playingIndex.value = -1
  }
}

function stopPlaying() {
  playRun++
  playing.value = false
  playingIndex.value = -1
  speech.stop()
}

/** Item being spoken in paragraph `index`, or -1. */
function sayIndexOf(index: number): number {
  if (speech.speakingId.value !== `doc:${index}`) return -1
  const p = paragraphs.value[index]
  return p ? spokenIndex(spokenText(p.items).ranges, speech.charIndex.value) : -1
}

// ---------------------------------------------------------------- reading aloud

/** The words read against: every paragraph from the start, concatenated. */
interface Span {
  from: number
  items: Item[]
  /** For each item, its paragraph and its index in that paragraph. */
  owner: { p: number; i: number }[]
  /** Index of each paragraph's first item in `items`. */
  offset: Map<number, number>
}

const span = shallowRef<Span | null>(null)
const finished = ref('')
let t0 = 0

function buildSpan(from: number): Span {
  const items: Item[] = []
  const owner: { p: number; i: number }[] = []
  const offset = new Map<number, number>()
  paragraphs.value.slice(from).forEach((p, k) => {
    offset.set(from + k, items.length)
    p.items.forEach((it, i) => {
      items.push(it)
      owner.push({ p: from + k, i })
    })
  })
  return { from, items, owner, offset }
}

const alignment = computed(() => {
  const s = span.value
  if (!s) return null
  const heard = reading.listening.value
    ? reading.finals.value + ' ' + reading.interim.value
    : finished.value
  return align(s.items, heard)
})

/** Paragraph the reader has reached (holding the last word heard). */
const readingIndex = computed(() => {
  const s = span.value
  const a = alignment.value
  if (!s || !a || a.lastHit < 0) return s?.from ?? -1
  return s.owner[a.lastHit]?.p ?? s.from
})
watch(readingIndex, (i) => {
  if (reading.listening.value && i >= 0) follow(i)
})

function stateOf(pIndex: number) {
  return (index: number, item: WordItem): '' | 'ok' | 'miss' => {
    const s = span.value
    const a = alignment.value
    const off = s?.offset.get(pIndex)
    if (!s || !a || off === undefined) return ''
    const g = off + index
    if (reading.listening.value && g > a.lastHit) return ''
    if (!reading.listening.value && pIndex > readingIndex.value) return ''
    const v = a.perItem.get(g)
    if (!v) return ''
    if (v.heard === v.total) return 'ok'
    return item.tech ? '' : 'miss'
  }
}

interface Summary {
  first: number
  last: number
  pct: number
  sec: number
  wpm: number | null
  missed: number
}
const summary = shallowRef<Summary | null>(null)

function startReading() {
  stopPlaying()
  summary.value = null
  finished.value = ''
  span.value = buildSpan(startAt.value)
  t0 = performance.now()
  follow(startAt.value)
  reading.start()
}

function toggleReading() {
  if (reading.listening.value) finishReading()
  else startReading()
}

/** Stops recognition and scores each paragraph reached, then the whole reading. */
function finishReading() {
  const sec = (performance.now() - t0) / 1000
  reading.stop()
  setTimeout(() => {
    const s = span.value
    if (!s) return
    finished.value = reading.finals.value
    const a = align(s.items, finished.value)
    const last = a.lastHit < 0 ? -1 : s.owner[a.lastHit]!.p
    if (last < 0) {
      summary.value = { first: s.from, last: -1, pct: 0, sec, wpm: null, missed: 0 }
      return
    }
    let total = 0
    let ok = 0
    let words = 0
    let missedCount = 0
    for (let pi = s.from; pi <= last; pi++) {
      const p = paragraphs.value[pi]!
      const off = s.offset.get(pi)!
      let pTotal = 0
      let pOk = 0
      const missed: string[] = []
      p.items.forEach((item, i) => {
        if (item.kind !== 'word') return
        words++
        if (item.tech) return
        const v = a.perItem.get(off + i)
        pTotal++
        if (v && v.heard === v.total) pOk++
        else missed.push(item.text)
      })
      total += pTotal
      ok += pOk
      missedCount += missed.length
      store.recordScore(p.id, pTotal ? Math.round((pOk / pTotal) * 100) : 0, missed)
    }
    summary.value = {
      first: s.from,
      last,
      pct: total ? Math.round((ok / total) * 100) : 0,
      sec,
      wpm: sec > 2 ? Math.round((words / sec) * 60) : null,
      missed: missedCount,
    }
  }, 500)
}

/** Stops reading without scoring. */
function stopReading() {
  if (reading.listening.value) reading.stop()
}

function clearResults() {
  span.value = null
  summary.value = null
  finished.value = ''
}

/** "Introduction § 2" for paragraph `index`. */
function label(index: number): string {
  for (const s of sections.value) {
    const it = s.items.find((x) => x.index === index)
    if (it) return `${s.title || 'Discours'} § ${it.n}`
  }
  return ''
}

// ---------------------------------------------------------------- word panel

const practising = shallowRef<{ text: string; item: WordItem } | null>(null)

function openWord(text: string, item: WordItem) {
  stopPlaying()
  stopReading()
  practising.value = { text, item }
}

// ---------------------------------------------------------------- keyboard

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (practising.value || t?.closest('input, select, textarea, button, [role="button"]')) return
  if (e.code === 'Space') {
    e.preventDefault()
    if (recognitionSupported) toggleReading()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  stopPlaying()
  stopReading()
})

/** Starting from paragraph `index`: selects it, and restarts listening there if playing. */
function setStart(index: number) {
  startAt.value = index
  if (playing.value) {
    stopPlaying()
    void nextTick(playAll)
  }
}
</script>

<template>
  <div class="doc-view">
    <header class="bar">
      <div class="bar-top">
        <RouterLink class="back" :to="{ name: 'entrainement' }">← Par paragraphe</RouterLink>
        <h1>Discours entier</h1>
        <span class="meta"
          >{{ totalWords }} mots · ≈ {{ fmt((totalWords / WPM_TARGET) * 60) }} à
          {{ WPM_TARGET }} mots/min</span
        >
      </div>
      <div class="bar-actions">
        <button
          type="button"
          class="btn"
          :disabled="!speech.supported || !paragraphs.length"
          @click="playAll"
        >
          <template v-if="playing">■ Arrêter</template>
          <template v-else>▶ Écouter</template>
        </button>
        <button
          type="button"
          class="btn"
          :class="reading.listening.value ? 'rec' : 'primary'"
          :disabled="!recognitionSupported || !paragraphs.length"
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
      <p v-if="reading.error.value" class="msg" role="alert">{{ reading.error.value }}</p>
      <p v-else-if="reading.listening.value" class="msg live">
        Lisez le discours à votre rythme, la page vous suit. Cliquez sur « Terminer la lecture »
        quand vous voulez vous arrêter.
      </p>
      <div v-else-if="summary" class="summary" role="status">
        <template v-if="summary.last < 0"
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
            ><b>{{ summary.pct }} %</b> compris</span
          >
          <span
            ><b>{{ fmt(summary.sec) }}</b></span
          >
          <span v-if="summary.wpm"
            ><b>{{ summary.wpm }}</b> mots/min (cible ≈ {{ WPM_TARGET }})</span
          >
          <span v-if="summary.missed"
            >{{ summary.missed }} mot{{ summary.missed > 1 ? 's' : '' }} à travailler</span
          >
        </template>
        <button type="button" class="link" @click="clearResults">Effacer les couleurs</button>
      </div>
      <p v-else-if="!recognitionSupported" class="msg">
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
          v-for="it in s.items"
          :key="it.p.id + it.index"
          :ref="(el) => setParaEl(it.index, el)"
          class="para"
          :class="{
            start: it.index === startAt,
            current:
              it.index === playingIndex || (reading.listening.value && it.index === readingIndex),
          }"
        >
          <button
            type="button"
            class="pnum"
            :title="`Commencer ici (${label(it.index)})`"
            :aria-pressed="it.index === startAt"
            @click="setStart(it.index)"
          >
            {{ it.n }}
            <span
              v-if="store.best[it.p.id] !== undefined"
              class="score"
              :class="
                store.best[it.p.id]! >= 85 ? 's-hi' : store.best[it.p.id]! >= 60 ? 's-mid' : 's-lo'
              "
              >{{ store.best[it.p.id] }}%</span
            >
          </button>
          <SpeechText
            :items="it.p.items"
            :say-index="sayIndexOf(it.index)"
            :state="stateOf(it.index)"
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
