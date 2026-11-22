<script setup lang="ts">
/**
 * The training screen, modelled on the original prototype.
 *
 * @remarks
 * - **Sidebar**: paragraphs grouped by section, with the best score of each.
 * - **Text**: the current paragraph, with the IPA under each word, and liaisons and reading marks.
 * - **Écouter le modèle**: the whole paragraph in one utterance; the spoken word is highlighted.
 * - **Lire à voix haute**: speech recognition. Words turn green or red live, then a score,
 *   reading time and words per minute are shown.
 * - **Mots à travailler** (`HardWordsPanel`): missed words, opening the `WordPractice` panel.
 *
 * Keyboard: ← → change paragraph. Space starts or stops reading, or repeats the word when the word
 * panel is open.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { countWords, type WordItem } from '@/core/model'
import { overview } from '@/core/progress/progress'
import { groupBySection, locate, readingSeconds, TARGET_WPM } from '@/core/speech/sections'
import logoMark from '@/ui/assets/logo-mark.svg'
import HardWordsPanel from '@/ui/components/HardWordsPanel.vue'
import SpeechText from '@/ui/components/SpeechText.vue'
import WordPractice from '@/ui/components/WordPractice.vue'
import { useModelVoice, useVoices } from '@/ui/composables/useModelVoice'
import { useReadingSession } from '@/ui/composables/useReadingSession'
import { clock, recognitionMessage, scoreClass, sectionTitle } from '@/ui/format'
import { useDiscoursStore } from '@/ui/stores/discours'

const store = useDiscoursStore()
const voice = useModelVoice()
const voices = useVoices()
const reading = useReadingSession('all')

onMounted(() => void store.analyze())

// ---------------------------------------------------------------- navigation

const para = computed(() => store.paragraphs[store.cur])
const sections = computed(() => groupBySection(store.paragraphs))
const progress = computed(() => overview(store.paragraphs, store.best))

/** Paragraphs of a section read at least once. */
const readCount = (s: (typeof sections.value)[number]) =>
  s.paragraphs.filter((p) => store.best[p.paragraph.id] !== undefined).length

/** Section and number of the current paragraph, for the heading. */
const position = computed(() => {
  const found = locate(sections.value, store.cur)
  return { section: sectionTitle(found?.section.title ?? ''), n: found?.number ?? 1 }
})

/** Words in the current paragraph. */
const wordCount = computed(() => countWords(para.value?.items ?? []))

/** Opens paragraph `i`. */
function go(i: number) {
  if (i < 0 || i >= store.paragraphs.length) return
  store.cur = i
  drawerOpen.value = false
}

// ---------------------------------------------------------------- mobile drawer and settings

/** On phones the paragraph list is a drawer, opened from the mobile header. */
const drawerOpen = ref(false)
/** On phones the settings bar is folded behind the ⚙ button. */
const settingsOpen = ref(false)
/** Close button of the drawer, focused when it opens. */
const drawerClose = ref<HTMLButtonElement>()
/** Paragraph list, scrolled to keep the current paragraph visible. */
const nav = ref<HTMLElement>()

watch(drawerOpen, (open) => {
  // Lock the page behind the drawer, and move focus into it for keyboard and screen reader users.
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    requestAnimationFrame(() => {
      drawerClose.value?.focus()
      nav.value?.querySelector<HTMLElement>('.pbtn.on')?.scrollIntoView({ block: 'center' })
    })
  }
})

watch(
  () => store.cur,
  () => {
    stopAll()
    reading.clear()
    requestAnimationFrame(keepCurrentInView)
  },
)

/** Scrolls the sidebar so the current paragraph is visible. */
function keepCurrentInView() {
  const list = nav.value
  const current = list?.querySelector<HTMLElement>('.pbtn.on')
  if (!list || !current) return
  const top = current.offsetTop
  if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - 60)
    list.scrollTop = top - list.clientHeight / 3
}

// ---------------------------------------------------------------- listening and reading

/** Whether the model voice is reading the current paragraph. */
const listening = computed(() => voice.playing.value)

/** Plays the current paragraph with the model voice, or stops it. */
function listen() {
  if (voice.playing.value) return voice.stop()
  reading.stop()
  void voice.play(store.cur)
}

/** Starts reading aloud, or ends and scores it. */
function toggleReading() {
  if (reading.listening.value) return void reading.finish()
  voice.stop()
  reading.start(store.cur, store.cur)
}

/** Score, duration and speed of the last reading of the current paragraph. */
const result = computed(() => {
  const r = reading.result.value
  return r && { percent: r.score.percent, seconds: r.seconds, wpm: r.wpm }
})

/** Stops the model voice and recognition. */
function stopAll() {
  reading.stop()
  voice.stop()
}

// ---------------------------------------------------------------- word panel

/** Word open in the word panel, if any. */
const practising = shallowRef<{ text: string; item: WordItem | null } | null>(null)
/** The word panel, to trigger "Répéter" with the space bar. */
const wordPanel = ref<InstanceType<typeof WordPractice>>()

/** Opens the word panel, stopping voice and recognition. */
function openWord(text: string, item: WordItem | null) {
  stopAll()
  practising.value = { text, item }
}

// ---------------------------------------------------------------- keyboard

/** ← → change paragraph; Space reads aloud, or repeats the word in the word panel. */
function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement).closest('input, textarea, select')) return
  if (e.key === 'Escape' && drawerOpen.value) drawerOpen.value = false
  else if (drawerOpen.value) return
  else if (e.key === 'ArrowRight') go(store.cur + 1)
  else if (e.key === 'ArrowLeft') go(store.cur - 1)
  else if (e.key === ' ') {
    e.preventDefault()
    if (practising.value) wordPanel.value?.repeat()
    else if (reading.supported) toggleReading()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="app">
    <aside id="paragraphs" :class="{ open: drawerOpen }" aria-label="Paragraphes du discours">
      <header class="side-head">
        <button
          ref="drawerClose"
          type="button"
          class="drawer-close"
          aria-label="Fermer la liste des paragraphes"
          @click="drawerOpen = false"
        >
          ×
        </button>
        <p class="brand"><img :src="logoMark" alt="" width="28" height="28" /> Discours</p>
        <h1>Entraînement prononciation</h1>
        <p class="hint">
          Écoute le modèle, puis lis à voix haute. Les mots mal compris passent en rouge.
        </p>
        <div v-if="progress.total" class="overall">
          <div class="overall-row">
            <span
              ><b>{{ progress.read }}</b> / {{ progress.total }} paragraphes lus</span
            >
            <span v-if="progress.average !== null" :class="scoreClass(progress.average)"
              >moyenne {{ progress.average }} %</span
            >
          </div>
          <div
            class="meter"
            role="progressbar"
            :aria-valuenow="progress.read"
            aria-valuemin="0"
            :aria-valuemax="progress.total"
          >
            <span :style="{ width: `${progress.percentRead}%` }" />
          </div>
        </div>
      </header>

      <nav ref="nav" class="plist" aria-label="Paragraphes">
        <section v-for="(s, si) in sections" :key="si" class="sec">
          <h2 v-if="s.title" class="sec-title">
            <span>{{ s.title }}</span>
            <span class="sec-count">{{ readCount(s) }}/{{ s.paragraphs.length }}</span>
          </h2>
          <button
            v-for="it in s.paragraphs"
            :key="it.paragraph.id + it.index"
            type="button"
            class="pbtn"
            :class="{ on: it.index === store.cur }"
            :aria-current="it.index === store.cur ? 'true' : undefined"
            @click="go(it.index)"
          >
            <span class="pnum">{{ it.number }}</span>
            <span class="ptext">{{ it.paragraph.text }}</span>
            <span
              v-if="store.best[it.paragraph.id] !== undefined"
              class="score"
              :class="scoreClass(store.best[it.paragraph.id]!)"
            >
              {{ store.best[it.paragraph.id] }}%
            </span>
            <span v-else class="score none" aria-label="pas encore lu">–</span>
          </button>
        </section>
      </nav>

      <footer class="side-foot">
        <div class="foot-actions">
          <RouterLink
            class="btn edit primary"
            :to="{ name: 'discours' }"
            title="Écouter et lire tout le discours d’un seul tenant"
            >▤ Discours entier</RouterLink
          >
          <RouterLink class="btn edit" :to="{ name: 'texte' }">✎ Modifier le texte</RouterLink>
          <RouterLink
            class="btn edit"
            :to="{ name: 'pdf' }"
            title="Fiches d’entraînement ou document, avec l’API"
            >⤓ Télécharger en PDF</RouterLink
          >
        </div>
      </footer>
    </aside>
    <div v-if="drawerOpen" class="backdrop" aria-hidden="true" @click="drawerOpen = false" />

    <div class="col">
      <header class="mobile-head">
        <button
          type="button"
          class="mh-btn"
          aria-controls="paragraphs"
          :aria-expanded="drawerOpen"
          @click="drawerOpen = true"
        >
          <span aria-hidden="true">☰</span> Paragraphes
        </button>
        <p class="mh-title">
          <img :src="logoMark" alt="" width="22" height="22" />
          <span v-if="para"
            >§ {{ position.n }} · {{ store.cur + 1 }}/{{ store.paragraphs.length }}</span
          >
          <span v-else>Discours</span>
        </p>
        <button
          type="button"
          class="mh-btn"
          :class="{ on: settingsOpen }"
          aria-controls="settings"
          :aria-expanded="settingsOpen"
          @click="settingsOpen = !settingsOpen"
        >
          <span aria-hidden="true">⚙</span> Réglages
        </button>
      </header>

      <header id="settings" class="topbar" :class="{ open: settingsOpen }" aria-label="Réglages">
        <fieldset class="group">
          <legend>Affichage</legend>
          <label class="switch">
            <input v-model="store.showIpa" type="checkbox" role="switch" />
            <span class="track" aria-hidden="true"><span class="knob" /></span>
            Prononciation (API)
          </label>
          <label class="switch">
            <input
              v-model="store.showLinks"
              type="checkbox"
              role="switch"
              :disabled="!store.showIpa"
            />
            <span class="track" aria-hidden="true"><span class="knob" /></span>
            Liaisons <span class="lz-sample" aria-hidden="true">‿z</span>
          </label>
        </fieldset>

        <fieldset class="group voice">
          <legend>Voix du modèle</legend>
          <label class="speed">
            <span class="lbl">Vitesse</span>
            <input
              v-model.number="store.rate"
              class="range"
              type="range"
              min="0.6"
              max="1.1"
              step="0.05"
              :style="{ '--fill': `${((store.rate - 0.6) / 0.5) * 100}%` }"
            />
            <output class="pill">{{ store.rate.toFixed(2).replace('.', ',') }}×</output>
          </label>
          <label v-if="voices.length > 1" class="select-wrap">
            <span class="lbl">Voix</span>
            <select v-model="store.voiceId" class="select">
              <option value="">Automatique (la meilleure)</option>
              <option v-for="v in voices" :key="v.id" :value="v.id">
                {{ v.name }}
              </option>
            </select>
          </label>
        </fieldset>
      </header>

      <main>
        <div v-if="!reading.supported" class="msg">
          La reconnaissance vocale n'est pas disponible dans ce navigateur. Utilise Google Chrome ou
          Microsoft Edge sur ordinateur. Tu peux quand même écouter le modèle.
        </div>
        <div v-if="reading.error.value" class="msg">
          {{ recognitionMessage(reading.error.value) }}
        </div>

        <template v-if="store.status === 'ready' && para">
          <div class="top">
            <h2>{{ position.section }} · § {{ position.n }}</h2>
            <span class="meta"
              >{{ wordCount }} mots · ≈ {{ clock(readingSeconds(wordCount)) }} à
              {{ TARGET_WPM }} mots/min</span
            >
          </div>

          <div class="text">
            <SpeechText
              :items="para.items"
              :say-index="voice.spokenItem(store.cur)"
              :verdict="(i) => reading.verdict(store.cur, i)"
              large
              @word="openWord"
            />
          </div>

          <div class="bar">
            <button type="button" class="btn act" :disabled="!voice.supported" @click="listen">
              <template v-if="listening">■ Arrêter</template>
              <template v-else>▶ Écouter<span class="long"> le modèle</span></template>
            </button>
            <button
              type="button"
              class="btn act"
              :class="reading.listening.value ? 'rec' : 'primary'"
              :disabled="!reading.supported"
              @click="toggleReading"
            >
              <template v-if="reading.listening.value">■ J'ai fini</template>
              <template v-else>● Lire<span class="long"> à voix haute</span></template>
            </button>
            <button
              type="button"
              class="btn"
              aria-label="Paragraphe précédent"
              :disabled="store.cur <= 0"
              @click="go(store.cur - 1)"
            >
              ←
            </button>
            <button
              type="button"
              class="btn"
              aria-label="Paragraphe suivant"
              :disabled="store.cur >= store.paragraphs.length - 1"
              @click="go(store.cur + 1)"
            >
              →
            </button>
          </div>

          <div class="legend">
            <span><i style="background: var(--okbg)"></i>compris</span>
            <span><i style="background: var(--badbg)"></i>à retravailler</span>
            <span
              ><i style="border: 1px solid var(--line)"></i
              ><em>terme technique, non compté</em></span
            >
            <span><b class="lz">‿z</b> liaison <b class="ench">‿</b> enchaînement</span>
            <span>
              Clique un mot pour l'entendre et t'entraîner à le répéter. Sous chaque mot : sa
              prononciation en alphabet phonétique international (API).
            </span>
          </div>

          <div v-if="result" class="result">
            <div class="kpi">
              <b :class="scoreClass(result.percent)">{{ result.percent }} %</b
              ><span>des mots compris</span>
            </div>
            <div class="kpi">
              <b>{{ clock(result.seconds) }}</b
              ><span>durée de lecture</span>
            </div>
            <div class="kpi">
              <b>{{ result.wpm ?? '–' }}</b
              ><span>mots / minute (cible ≈ {{ TARGET_WPM }})</span>
            </div>
          </div>

          <div class="heard">
            <template v-if="reading.listening.value || reading.transcript.value">
              <b>Entendu :</b> {{ reading.transcript.value }}
              <i>{{
                reading.listening.value && !reading.transcript.value && !reading.interim.value
                  ? 'parle maintenant…'
                  : reading.interim.value
              }}</i>
            </template>
          </div>

          <HardWordsPanel @open="(key) => openWord(key, null)" />
        </template>

        <div v-else-if="store.status === 'error'" class="msg">
          La transcription phonétique a échoué : {{ store.error }}
          <button type="button" class="link" @click="store.analyze()">Réessayer</button>
        </div>
        <div v-else-if="store.status === 'ready'" class="top">
          <h2>Aucun paragraphe</h2>
          <RouterLink :to="{ name: 'texte' }">Saisir un discours</RouterLink>
        </div>
        <div v-else class="top"><h2>Chargement…</h2></div>
      </main>
    </div>

    <WordPractice
      v-if="practising"
      ref="wordPanel"
      :key="practising.text"
      :text="practising.text"
      :item="practising.item"
      @close="practising = null"
    />
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  min-height: 100vh;
}
/* ---------------------------------------------------------------- sidebar */
aside {
  border-right: 1px solid var(--line);
  background: #fafbfc;
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.side-head {
  padding: 22px 20px 16px;
  border-bottom: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}
.brand img {
  border-radius: 7px;
}
.side-head h1 {
  font-size: 18px;
  line-height: 1.25;
  margin: 0 0 6px;
}
.hint {
  font-size: 13px;
  color: var(--soft);
  margin: 0;
  line-height: 1.45;
}
.overall {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.overall-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--soft);
}
.overall-row b {
  color: var(--ink);
  font-size: 14px;
}
.overall-row .s-hi,
.overall-row .s-mid,
.overall-row .s-lo {
  font-weight: 600;
}
.meter {
  height: 6px;
  border-radius: 3px;
  background: var(--line);
  overflow: hidden;
}
.meter span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.plist {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px 16px;
  position: relative;
}
.sec + .sec {
  margin-top: 6px;
}
.sec-title {
  position: sticky;
  top: -8px;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  padding: 12px 10px 6px;
  background: #fafbfc;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
}
.sec-count {
  font-family: var(--mono);
  font-weight: 500;
  font-size: 11px;
  color: var(--soft);
}
.pbtn {
  width: 100%;
  display: grid;
  grid-template-columns: 1.4rem minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  text-align: left;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0 6px 6px 0;
  background: none;
  padding: 8px 8px 8px 7px;
  font-size: 13px;
  color: var(--ink);
  line-height: 1.4;
}
.pbtn:hover {
  background: var(--tint);
}
.pbtn.on {
  background: var(--tint);
  border-left-color: var(--accent);
}
.pnum {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--soft);
  padding-top: 2px;
  text-align: right;
}
.pbtn.on .pnum {
  color: var(--accent);
}
.ptext {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  color: var(--soft);
}
.pbtn.on .ptext {
  color: var(--ink);
  font-weight: 600;
}
.score {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  margin-top: 1px;
}
.score.s-hi {
  background: var(--okbg);
}
.score.s-mid {
  background: #fdf1d8;
}
.score.s-lo {
  background: var(--badbg);
}
.score.none {
  color: var(--line);
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
.side-foot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  background: #fafbfc;
}
.edit {
  justify-content: center;
  white-space: nowrap;
  text-decoration: none;
  font-size: 14px;
  padding: 8px 14px;
}

main {
  padding: 28px clamp(16px, 4vw, 56px);
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1100px;
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
.top .meta {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
}
.text {
  border: 1px solid var(--line);
  padding: 24px 28px;
}
.lz {
  color: var(--liaison);
  font-weight: 700;
  margin-left: 1px;
}
.ench {
  color: var(--ench);
  font-weight: 700;
  margin-left: 1px;
}
.bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
/* ---------------------------------------------------------------- top bar (settings) */
.col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 0;
  min-height: 56px;
  padding: 8px clamp(16px, 4vw, 56px);
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line);
}
.group {
  border: 0;
  margin: 0;
  padding: 0 20px 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 18px;
  min-width: 0;
}
.group + .group {
  border-left: 1px solid var(--line);
  padding-left: 20px;
}
.group legend {
  float: left;
  padding: 0;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--soft);
}

/* Toggle switches */
.switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.switch input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.track {
  width: 32px;
  height: 18px;
  border-radius: 999px;
  background: var(--line);
  position: relative;
  flex: none;
  transition: background 0.15s;
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 40, 75, 0.3);
  transition: transform 0.15s;
}
.switch input:checked + .track {
  background: var(--accent);
}
.switch input:checked + .track .knob {
  transform: translateX(14px);
}
.switch input:focus-visible + .track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.switch:has(input:disabled) {
  opacity: 0.45;
  cursor: default;
}
.lz-sample {
  font-family: var(--ipa-font);
  font-weight: 700;
  color: var(--liaison);
}

/* Speed slider and voice select */
.speed,
.select-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ink);
  white-space: nowrap;
}
.pill {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: var(--tint);
  border-radius: 999px;
  padding: 1px 8px;
  min-width: 3.4em;
  text-align: center;
}
.range {
  -webkit-appearance: none;
  appearance: none;
  width: 120px;
  height: 6px;
  margin: 0;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    var(--accent) var(--fill, 50%),
    var(--line) var(--fill, 50%)
  );
  cursor: pointer;
}
.range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
  box-shadow: 0 1px 3px rgba(0, 40, 75, 0.25);
}
.range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
}
.range:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}
.select {
  -webkit-appearance: none;
  appearance: none;
  font: inherit;
  font-size: 14px;
  color: var(--ink);
  background: #fff
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%2300284B' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  border: 1px solid var(--line);
  padding: 5px 30px 5px 10px;
  max-width: 15rem;
  cursor: pointer;
}
.select:hover {
  border-color: var(--accent);
}
.select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .track,
  .knob {
    transition: none;
  }
}
.result {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.kpi {
  background: var(--tint);
  padding: 12px 16px;
}
.kpi b {
  display: block;
  font-size: 30px;
  line-height: 1.1;
}
.kpi span {
  font-size: 13px;
  color: var(--soft);
}
.heard {
  font-size: 15px;
  color: var(--soft);
  line-height: 1.55;
  border-left: 3px solid var(--line);
  padding: 4px 0 4px 14px;
  min-height: 28px;
}
.heard i {
  color: var(--accent);
  font-style: normal;
}
.msg {
  font-size: 14px;
  padding: 10px 14px;
  background: var(--badbg);
  color: var(--bad);
}
.legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--soft);
}
.legend span {
  display: flex;
  gap: 6px;
  align-items: center;
}
.legend i {
  width: 14px;
  height: 14px;
  display: inline-block;
}
/* ---------------------------------------------------------------- phones */
.mobile-head,
.drawer-close {
  display: none;
}

@media (max-width: 760px) {
  .app {
    grid-template-columns: 1fr;
  }

  /* Compact header with the drawer and settings buttons. */
  .mobile-head {
    position: sticky;
    top: 0;
    z-index: 12;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: calc(8px + env(safe-area-inset-top, 0px)) 12px 8px;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(6px);
    border-bottom: 1px solid var(--line);
  }
  .mh-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--ink);
    font-size: 14px;
    font-weight: 600;
  }
  .mh-btn.on {
    background: var(--tint);
    border-color: var(--accent);
    color: var(--accent);
  }
  .mh-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
  }
  .mh-title img {
    border-radius: 5px;
  }

  /* The paragraph list slides in from the left. */
  aside {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 30;
    width: min(88vw, 340px);
    height: 100dvh;
    border-right: 1px solid var(--line);
    box-shadow: 0 0 40px rgba(0, 40, 75, 0.25);
    transform: translateX(-105%);
    visibility: hidden;
    transition:
      transform 0.25s ease,
      visibility 0s linear 0.25s;
  }
  aside.open {
    transform: none;
    visibility: visible;
    transition: transform 0.25s ease;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 25;
    background: rgba(0, 40, 75, 0.35);
  }
  .side-head {
    position: relative;
    padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 14px;
  }
  .drawer-close {
    display: grid;
    place-items: center;
    position: absolute;
    top: calc(10px + env(safe-area-inset-top, 0px));
    right: 10px;
    width: 40px;
    height: 40px;
    border: 0;
    background: none;
    font-size: 26px;
    line-height: 1;
    color: var(--soft);
  }
  .pbtn {
    padding-block: 10px;
  }
  .side-foot {
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  }

  /* Settings fold away behind the ⚙ button. */
  .topbar {
    display: none;
    position: static;
    padding: 12px 16px;
    background: #fafbfc;
  }
  .topbar.open {
    display: flex;
  }
  .group,
  .group + .group {
    width: 100%;
    border-left: 0;
    padding: 0;
  }
  .group + .group {
    border-top: 1px solid var(--line);
    padding-top: 10px;
  }
  .group legend {
    width: 100%;
  }
  .speed {
    width: 100%;
  }
  .range {
    flex: 1;
    width: auto;
    height: 8px;
  }
  .select-wrap,
  .select {
    width: 100%;
    max-width: none;
  }
  .select {
    min-height: 40px;
    font-size: 16px; /* below 16px, iOS Safari zooms in on focus */
  }

  main {
    padding: 16px 14px 0;
    gap: 14px;
  }
  .top h2 {
    font-size: 12px;
  }
  .top .meta {
    font-size: 12px;
  }
  .text {
    padding: 14px;
  }

  /* Listen / read / previous / next stay at the bottom, within thumb reach. */
  .bar {
    position: sticky;
    bottom: 0;
    z-index: 11;
    margin: 0 -14px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(6px);
    border-top: 1px solid var(--line);
    flex-wrap: nowrap;
    gap: 8px;
  }
  .bar .btn {
    min-height: 44px;
    padding: 0 12px;
    justify-content: center;
  }
  .bar .act {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
  }
  .long {
    display: none;
  }

  .legend {
    gap: 6px 12px;
    font-size: 12px;
  }
  .legend span:last-child {
    display: none;
  }
  .result {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .kpi {
    padding: 10px;
  }
  .kpi b {
    font-size: 22px;
  }
  .kpi span {
    font-size: 11px;
  }
}

@media (max-width: 760px) and (prefers-reduced-motion: reduce) {
  aside,
  aside.open {
    transition: none;
  }
}
</style>
