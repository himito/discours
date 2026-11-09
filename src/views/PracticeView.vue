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
 * - **Mots à travailler**: missed words, opening the {@link WordPractice} panel.
 *
 * Keyboard: ← → change paragraph. Space starts or stops reading, or repeats the word when the word
 * panel is open.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import WordPractice from '@/components/WordPractice.vue'
import type { AnalyzedParagraph, Item, WordItem } from '@/phonetics/analyze'
import { align } from '@/practice/align'
import { useDiscoursStore } from '@/stores/discours'
import { useSpeech } from '@/composables/useSpeech'
import { recognitionSupported, useReading } from '@/composables/useRecognition'

const store = useDiscoursStore()
const speech = useSpeech()
const reading = useReading()

const WPM_TARGET = 135

onMounted(() => void store.analyze())

// ---------------------------------------------------------------- navigation

const para = computed<AnalyzedParagraph | undefined>(() => store.paragraphs[store.cur])

/** Paragraphs grouped by section, with their position in the section and how many were read. */
const sections = computed(() => {
  const out: { title: string; read: number; items: { p: AnalyzedParagraph; index: number; n: number }[] }[] = []
  store.paragraphs.forEach((p, index) => {
    let sec = out[out.length - 1]
    if (!sec || sec.title !== p.section) out.push((sec = { title: p.section, read: 0, items: [] }))
    sec.items.push({ p, index, n: sec.items.length + 1 })
    if (store.best[p.id] !== undefined) sec.read++
  })
  return out
})

/** Paragraphs read at least once, and their average best score. */
const progress = computed(() => {
  const scores = store.paragraphs.map((p) => store.best[p.id]).filter((v): v is number => v !== undefined)
  const total = store.paragraphs.length
  return {
    read: scores.length,
    total,
    pct: total ? (scores.length / total) * 100 : 0,
    average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  }
})

const position = computed(() => {
  for (const s of sections.value) {
    const it = s.items.find((i) => i.index === store.cur)
    if (it) return { section: s.title || 'Discours', n: it.n }
  }
  return { section: 'Discours', n: 1 }
})

const wordCount = computed(() => para.value?.items.filter((i) => i.kind === 'word').length ?? 0)

const fmt = (sec: number) => {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function go(i: number) {
  if (i < 0 || i >= store.paragraphs.length) return
  store.cur = i
}

const nav = ref<HTMLElement>()
watch(
  () => store.cur,
  () => {
    stopAll()
    result.value = null
    // Keep the current paragraph visible in the sidebar.
    requestAnimationFrame(() => {
      const a = nav.value
      const b = a?.querySelector<HTMLElement>('.pbtn.on')
      if (!a || !b) return
      const r = b.offsetTop
      if (r < a.scrollTop || r > a.scrollTop + a.clientHeight - 60) a.scrollTop = r - a.clientHeight / 3
    })
  },
)

function scoreClass(v: number) {
  return v >= 90 ? 's-hi' : v >= 70 ? 's-mid' : 's-lo'
}

// ---------------------------------------------------------------- display units

/** What is displayed: a word with its attached punctuation, or a reading mark. */
type Unit = { kind: 'word'; index: number; item: WordItem; pre: string; post: string } | { kind: 'mark'; text: string }

const OPENING = /^[«“([]$/

/**
 * Display units of the current paragraph.
 *
 * @remarks Opening punctuation (« “ ( [) attaches to the next word and other punctuation to the
 * previous one, so a word and its punctuation highlight together.
 */
const units = computed<Unit[]>(() => {
  const out: Unit[] = []
  let pre = ''
  para.value?.items.forEach((item, index) => {
    if (item.kind === 'word') {
      out.push({ kind: 'word', index, item, pre, post: '' })
      pre = ''
    } else if (item.kind === 'mark') {
      out.push({ kind: 'mark', text: item.text === '[→]' ? '→' : item.text })
    } else if (OPENING.test(item.text)) {
      pre += item.text + (item.space ? ' ' : '')
    } else {
      const last = out[out.length - 1]
      if (last?.kind === 'word') last.post += (item.text === '…' || /^[,.)\]»”]/.test(item.text) ? '' : ' ') + item.text
      else pre += item.text + ' '
    }
  })
  return out
})

// ---------------------------------------------------------------- model voice

/**
 * Text given to the speech synthesizer, and the character range of each word in it.
 *
 * @remarks `/` is read as a comma and `//` as an ellipsis (a longer pause). `[→]` is silent. The
 * ranges map boundary events (`charIndex`) back to items, to highlight the spoken word.
 */
const spoken = computed(() => {
  let text = ''
  const ranges: { a: number; b: number; index: number }[] = []
  para.value?.items.forEach((item: Item, index) => {
    if (item.kind === 'word') {
      ranges.push({ a: text.length, b: text.length + item.text.length + 1, index })
      text += item.text + ' '
    } else if (item.kind === 'mark') {
      if (item.text !== '[→]') text = text.trimEnd() + (item.text === '//' ? '… ' : ', ')
    } else if (/^[,.…)\]»”]/.test(item.text)) {
      text = text.trimEnd() + item.text + ' '
    } else text += item.text + ' '
  })
  return { text: text.trimEnd(), ranges }
})

const listening = computed(() => !!para.value && speech.speakingId.value === para.value.id)

/** Item being spoken by the model voice. */
const sayIndex = computed(() => {
  if (!listening.value || speech.charIndex.value < 0) return -1
  const c = speech.charIndex.value
  return spoken.value.ranges.find((r) => c >= r.a && c < r.b)?.index ?? -1
})

function listen() {
  if (!para.value) return
  if (listening.value) return speech.stop()
  if (reading.listening.value) reading.stop()
  void speech.speak(para.value.id, spoken.value.text, { rate: store.rate, voiceURI: store.voiceURI })
}

// ---------------------------------------------------------------- reading aloud

const result = shallowRef<{ pct: number; sec: number; wpm: number | null } | null>(null)
let t0 = 0

const alignment = computed(() => {
  if (!para.value || (!reading.listening.value && !result.value)) return null
  const heard = reading.finals.value + (reading.listening.value ? ' ' + reading.interim.value : '')
  return align(para.value.items, heard)
})

/**
 * Color of a word while reading or after it.
 *
 * @remarks While reading, only words up to the last one heard are judged. A missed technical
 * term stays neutral.
 */
function wordState(index: number, item: WordItem): '' | 'ok' | 'miss' {
  const a = alignment.value
  if (!a || (reading.listening.value && index > a.lastHit)) return ''
  const v = a.perItem.get(index)
  if (!v) return ''
  if (v.heard === v.total) return 'ok'
  return item.tech ? '' : 'miss'
}

function toggleReading() {
  if (reading.listening.value) return finishReading()
  speech.stop()
  result.value = null
  t0 = performance.now()
  reading.start()
}

/** Stops recognition and scores the reading (technical terms are not counted). */
function finishReading() {
  const sec = (performance.now() - t0) / 1000
  reading.stop()
  // Let the recognizer deliver its last result before scoring.
  setTimeout(() => {
    const p = para.value
    if (!p) return
    const a = align(p.items, reading.finals.value)
    let total = 0
    let ok = 0
    const missed: string[] = []
    p.items.forEach((item, i) => {
      if (item.kind !== 'word' || item.tech) return
      const v = a.perItem.get(i)
      total++
      if (v && v.heard === v.total) ok++
      else missed.push(item.text)
    })
    const pct = total ? Math.round((ok / total) * 100) : 0
    result.value = { pct, sec, wpm: sec > 2 ? Math.round((wordCount.value / sec) * 60) : null }
    store.recordScore(p.id, pct, missed)
  }, 500)
}

function stopAll() {
  if (reading.listening.value) reading.stop()
  speech.stop()
}

// ---------------------------------------------------------------- words to work on

const HARD_SHOWN = 12

/** Words to work on, most missed first, with their IPA and practice results. */
const hardWords = computed(() =>
  Object.entries(store.hard)
    .sort((a, b) => b[1] - a[1])
    .map(([key, missed]) => {
      const item = findWord(key)
      const stat = store.wordStats[key]
      return {
        key,
        missed,
        ipa: item ? store.ipaOf(item) : (store.overrides[key] ?? ''),
        stat,
        level: missed >= 3 ? 'high' : missed === 2 ? 'mid' : 'low',
      }
    }),
)
const showAllHard = ref(false)
const shownHard = computed(() => (showAllHard.value ? hardWords.value : hardWords.value.slice(0, HARD_SHOWN)))
const confirmClear = ref(false)

function clearHard() {
  store.clearHard()
  confirmClear.value = false
  showAllHard.value = false
}

const practising = shallowRef<{ text: string; item: WordItem | null } | null>(null)
const wordPanel = ref<InstanceType<typeof WordPractice>>()

function openWord(text: string, item: WordItem | null) {
  stopAll()
  practising.value = { text, item: item ?? findWord(text) }
}

/** Finds an analyzed word by key, for words opened from the "Mots à travailler" list. */
function findWord(key: string): WordItem | null {
  for (const p of store.paragraphs) {
    for (const it of p.items) if (it.kind === 'word' && it.key === key) return it
  }
  return null
}

// ---------------------------------------------------------------- keyboard

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (t.closest('input, textarea, select')) return
  if (e.key === 'ArrowRight') go(store.cur + 1)
  else if (e.key === 'ArrowLeft') go(store.cur - 1)
  else if (e.key === ' ') {
    e.preventDefault()
    if (practising.value) wordPanel.value?.repeat()
    else if (recognitionSupported) toggleReading()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  stopAll()
})
</script>

<template>
  <div class="app">
    <aside>
      <header class="side-head">
        <p class="brand">Discours</p>
        <h1>Entraînement prononciation</h1>
        <p class="hint">Écoute le modèle, puis lis à voix haute. Les mots mal compris passent en rouge.</p>
        <div v-if="progress.total" class="overall">
          <div class="overall-row">
            <span><b>{{ progress.read }}</b> / {{ progress.total }} paragraphes lus</span>
            <span v-if="progress.average !== null" :class="scoreClass(progress.average)">moyenne {{ progress.average }} %</span>
          </div>
          <div class="meter" role="progressbar" :aria-valuenow="progress.read" aria-valuemin="0" :aria-valuemax="progress.total">
            <span :style="{ width: `${progress.pct}%` }" />
          </div>
        </div>
      </header>

      <nav ref="nav" class="plist" aria-label="Paragraphes">
        <section v-for="(s, si) in sections" :key="si" class="sec">
          <h2 v-if="s.title" class="sec-title">
            <span>{{ s.title }}</span>
            <span class="sec-count">{{ s.read }}/{{ s.items.length }}</span>
          </h2>
          <button
            v-for="it in s.items"
            :key="it.p.id + it.index"
            type="button"
            class="pbtn"
            :class="{ on: it.index === store.cur }"
            :aria-current="it.index === store.cur ? 'true' : undefined"
            @click="go(it.index)"
          >
            <span class="pnum">{{ it.n }}</span>
            <span class="ptext">{{ it.p.text }}</span>
            <span v-if="store.best[it.p.id] !== undefined" class="score" :class="scoreClass(store.best[it.p.id]!)">
              {{ store.best[it.p.id] }}%
            </span>
            <span v-else class="score none" aria-label="pas encore lu">–</span>
          </button>
        </section>
      </nav>

      <footer class="side-foot">
        <RouterLink class="btn edit" :to="{ name: 'texte' }">✎ Modifier le texte</RouterLink>
      </footer>
    </aside>

    <main>
      <div v-if="!recognitionSupported" class="msg">
        La reconnaissance vocale n'est pas disponible dans ce navigateur. Utilise Google Chrome ou Microsoft Edge sur
        ordinateur. Tu peux quand même écouter le modèle.
      </div>
      <div v-if="reading.error.value" class="msg">{{ reading.error.value }}</div>

      <template v-if="store.status === 'ready' && para">
        <div class="top">
          <h2>{{ position.section }} · § {{ position.n }}</h2>
          <span class="meta">{{ wordCount }} mots · ≈ {{ fmt((wordCount / WPM_TARGET) * 60) }} à {{ WPM_TARGET }} mots/min</span>
        </div>

        <div class="text" :class="{ noipa: !store.showIpa }">
          <template v-for="(u, k) in units" :key="k">
            <span v-if="u.kind === 'mark'" class="mk">{{ u.text }}</span>
            <span
              v-else
              class="w"
              :class="[{ tech: u.item.tech, say: u.index === sayIndex }, wordState(u.index, u.item)]"
              role="button"
              tabindex="0"
              @click="openWord(u.item.text, u.item)"
              @keydown.enter="openWord(u.item.text, u.item)"
            >
              <span>{{ u.pre }}{{ u.item.text }}{{ u.post }}</span>
              <span class="ipa">
                <template v-if="store.ipaOf(u.item)">/{{ store.ipaOf(u.item) }}/</template>
                <template v-else>&nbsp;</template>
                <span v-if="store.showLinks && u.item.link === 'liaison'" class="lz" :title="`Liaison en [${u.item.liaison}]`">‿{{ u.item.liaison }}</span>
                <span v-else-if="store.showLinks && u.item.link === 'enchainement'" class="ench" title="Enchaînement">‿</span>
              </span>
            </span>
          </template>
        </div>

        <div class="bar">
          <button type="button" class="btn" :disabled="!speech.supported" @click="listen">
            {{ listening ? '■ Arrêter' : '▶ Écouter le modèle' }}
          </button>
          <button
            type="button"
            class="btn"
            :class="reading.listening.value ? 'rec' : 'primary'"
            :disabled="!recognitionSupported"
            @click="toggleReading"
          >
            {{ reading.listening.value ? "■ J'ai fini" : '● Lire à voix haute' }}
          </button>
          <button type="button" class="btn" aria-label="Paragraphe précédent" :disabled="store.cur <= 0" @click="go(store.cur - 1)">←</button>
          <button type="button" class="btn" aria-label="Paragraphe suivant" :disabled="store.cur >= store.paragraphs.length - 1" @click="go(store.cur + 1)">→</button>
          <label class="rate push"><input v-model="store.showIpa" type="checkbox" /> Afficher la prononciation (API)</label>
          <label class="rate"><input v-model="store.showLinks" type="checkbox" /> Liaisons</label>
          <label class="rate">
            Vitesse du modèle
            <input v-model.number="store.rate" type="range" min="0.6" max="1.1" step="0.05" />
            <span>{{ store.rate.toFixed(2) }}</span>
          </label>
          <label v-if="speech.voices.value.length > 1" class="rate">
            Voix
            <select v-model="store.voiceURI">
              <option value="">Automatique</option>
              <option v-for="v in speech.voices.value" :key="v.voiceURI" :value="v.voiceURI">{{ v.name }}</option>
            </select>
          </label>
        </div>

        <div class="legend">
          <span><i style="background: var(--okbg)"></i>compris</span>
          <span><i style="background: var(--badbg)"></i>à retravailler</span>
          <span><i style="border: 1px solid var(--line)"></i><em>terme technique, non compté</em></span>
          <span><b class="lz">‿z</b> liaison <b class="ench">‿</b> enchaînement</span>
          <span>
            Clique un mot pour l'entendre et t'entraîner à le répéter. Sous chaque mot : sa prononciation en alphabet
            phonétique international (API).
          </span>
        </div>

        <div v-if="result" class="result">
          <div class="kpi"><b :class="scoreClass(result.pct)">{{ result.pct }} %</b><span>des mots compris</span></div>
          <div class="kpi"><b>{{ fmt(result.sec) }}</b><span>durée de lecture</span></div>
          <div class="kpi"><b>{{ result.wpm ?? '–' }}</b><span>mots / minute (cible ≈ {{ WPM_TARGET }})</span></div>
        </div>

        <div class="heard">
          <template v-if="reading.listening.value || reading.finals.value">
            <b>Entendu :</b> {{ reading.finals.value }}
            <i>{{ reading.listening.value && !reading.finals.value && !reading.interim.value ? 'parle maintenant…' : reading.interim.value }}</i>
          </template>
        </div>

        <section class="hard" aria-labelledby="hard-title">
          <div class="hard-head">
            <h3 id="hard-title">
              Mots à travailler
              <span v-if="hardWords.length" class="count">{{ hardWords.length }}</span>
            </h3>
            <div v-if="hardWords.length" class="hard-actions">
              <template v-if="confirmClear">
                <span>Effacer toute la liste ?</span>
                <button type="button" class="link danger" @click="clearHard">Effacer</button>
                <button type="button" class="link" @click="confirmClear = false">Annuler</button>
              </template>
              <button v-else type="button" class="link" @click="confirmClear = true">Effacer la liste</button>
            </div>
          </div>

          <p v-if="!hardWords.length" class="empty">
            Aucun mot pour l'instant. Lis un paragraphe à voix haute : les mots que la reconnaissance n'a pas compris
            s'ajouteront ici pour que tu les travailles un par un.
          </p>
          <template v-else>
            <p class="hard-hint">Clique un mot pour l'écouter et le répéter. Chaque réussite le fait reculer dans la liste.</p>
            <ul class="cards">
              <li v-for="w in shownHard" :key="w.key">
                <button type="button" class="card" :class="w.level" @click="openWord(w.key, null)">
                  <span class="card-word">{{ w.key }}</span>
                  <span v-if="w.ipa" class="card-ipa">/{{ w.ipa }}/</span>
                  <span class="card-meta">
                    <span>manqué {{ w.missed }}×</span>
                    <span v-if="w.stat?.n">{{ w.stat.ok }}/{{ w.stat.n }} réussi{{ w.stat.ok > 1 ? 's' : '' }}</span>
                  </span>
                </button>
              </li>
            </ul>
            <button v-if="hardWords.length > HARD_SHOWN" type="button" class="link" @click="showAllHard = !showAllHard">
              {{ showAllHard ? 'Afficher moins' : `Afficher les ${hardWords.length - HARD_SHOWN} autres` }}
            </button>
          </template>
        </section>
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
  margin: 0 0 2px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
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
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  background: #fafbfc;
}
.edit {
  justify-content: center;
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
  font-size: 24px;
  line-height: 1.8;
  text-wrap: pretty;
  border: 1px solid var(--line);
  padding: 24px 28px;
  display: flex;
  flex-wrap: wrap;
  column-gap: 0.32em;
  row-gap: 2px;
}
.text:not(.noipa) {
  row-gap: 14px;
}
.w {
  padding: 0 3px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.25;
}
.w .ipa {
  font-family: var(--ipa-font);
  font-size: 15px;
  color: var(--accent);
  font-style: normal;
  margin-top: 2px;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.noipa .ipa {
  display: none;
}
.w:hover,
.w:focus-visible {
  outline: 2px solid var(--accent);
}
.w.ok {
  background: var(--okbg);
  color: var(--ok);
}
.w.ok .ipa {
  color: var(--ok);
}
.w.miss {
  background: var(--badbg);
  color: var(--bad);
  text-decoration: underline wavy;
  text-underline-offset: 5px;
}
.w.miss .ipa {
  color: var(--bad);
}
.w.tech {
  color: var(--soft);
  font-style: italic;
}
.w.say {
  background: var(--accent);
  color: #fff;
}
.w.say .ipa,
.w.say .lz,
.w.say .ench {
  color: #fff;
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
.mk {
  font-family: var(--mono);
  font-size: 15px;
  color: var(--accent);
  font-weight: 600;
  align-self: center;
}
.bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.rate {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--soft);
}
.rate.push {
  margin-left: auto;
}
.rate input {
  accent-color: var(--accent);
}
.rate select {
  font: inherit;
  max-width: 11rem;
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
/* ---------------------------------------------------------------- words to work on */
.hard {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid var(--line);
  padding-top: 18px;
}
.hard-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.hard h3 {
  margin: 0;
  font-size: 17px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.count {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--bad);
  background: var(--badbg);
  border-radius: 999px;
  padding: 1px 8px;
}
.hard-actions {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 13px;
  color: var(--soft);
}
.link.danger {
  color: var(--bad);
  font-weight: 600;
}
.hard-hint {
  margin: 0;
  font-size: 13px;
  color: var(--soft);
}
.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
  background: #fff;
  border: 1px solid var(--line);
  border-left: 4px solid var(--line);
  padding: 10px 12px;
  transition: border-color 0.15s, background 0.15s;
}
.card:hover {
  background: var(--tint);
  border-color: var(--accent);
}
.card.high {
  border-left-color: var(--bad);
}
.card.mid {
  border-left-color: #d9a21b;
}
.card.low {
  border-left-color: var(--ipa-soft, #9aa6c8);
}
.card-word {
  font-size: 17px;
  font-weight: 600;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.card-ipa {
  font-family: var(--ipa-font);
  font-size: 14px;
  color: var(--accent);
}
.card-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--soft);
}
.card.high .card-meta span:first-child {
  color: var(--bad);
  font-weight: 600;
}
.empty {
  margin: 0;
  padding: 16px 18px;
  border: 1px dashed var(--line);
  font-size: 14px;
  line-height: 1.5;
  color: var(--soft);
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
@media (max-width: 760px) {
  .app {
    grid-template-columns: 1fr;
  }
  aside {
    border-right: 0;
    border-bottom: 1px solid var(--line);
    height: auto;
    max-height: 55vh;
    position: static;
  }
  .side-head {
    padding: 16px;
  }
  .text {
    font-size: 20px;
    padding: 16px;
  }
  .result {
    grid-template-columns: 1fr;
  }
}
</style>
