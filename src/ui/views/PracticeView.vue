<script setup lang="ts">
/**
 * The training screen.
 *
 * @remarks
 * - **Sidebar** (`ParagraphSidebar`): paragraphs grouped by section, with the best score of each.
 * - **Settings** (`PracticeSettings`): IPA, liaisons, the model voice's speed and voice.
 * - **Text**: the current paragraph, with the IPA under each word, and liaisons and reading marks.
 * - **Écouter le modèle** (`ReadingControls`): the whole paragraph in one utterance; the spoken
 *   word is highlighted.
 * - **Lire à voix haute**: speech recognition. Words turn green or red live (`HeardTranscript`),
 *   then a score, reading time and words per minute are shown (`ReadingSummary`).
 * - **Mots à travailler** (`HardWordsPanel`): missed words, opening the `WordPractice` panel.
 *
 * On phones the sidebar is a drawer and the settings fold away, both opened from `MobileHeader`.
 *
 * Keyboard: ← → change paragraph. Space starts or stops reading, or repeats the word when the word
 * panel is open.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { countWords } from '#core/model'
import { overview } from '#core/progress/progress'
import { groupBySection, locate, readingSeconds, TARGET_WPM } from '#core/speech/sections'
import HardWordsPanel from '#ui/components/HardWordsPanel.vue'
import HeardTranscript from '#ui/components/HeardTranscript.vue'
import MobileHeader from '#ui/components/MobileHeader.vue'
import ParagraphSidebar from '#ui/components/ParagraphSidebar.vue'
import PracticeLegend from '#ui/components/PracticeLegend.vue'
import PracticeSettings from '#ui/components/PracticeSettings.vue'
import ReadingControls from '#ui/components/ReadingControls.vue'
import ReadingSummary from '#ui/components/ReadingSummary.vue'
import SpeechText from '#ui/components/SpeechText.vue'
import WordPractice from '#ui/components/WordPractice.vue'
import { useModelVoice, useVoices } from '#ui/composables/useModelVoice'
import { useReadingSession } from '#ui/composables/useReadingSession'
import { clock, recognitionMessage, sectionTitle } from '#ui/utils/format'
import { useDiscoursStore } from '#ui/stores/discours'
import type { SelectedWord } from '#ui/types/word'
import type { Nullable } from '#core/types'

const store = useDiscoursStore()
const voice = useModelVoice()
const voices = useVoices()
const reading = useReadingSession('all')

onMounted(() => void store.analyze())

// ---------------------------------------------------------------- phones

/** On phones the paragraph list is a drawer, opened from the header. */
const drawerOpen = ref(false)
/** On phones the settings are folded behind the ⚙ button. */
const settingsOpen = ref(false)

// ---------------------------------------------------------------- the current paragraph

const para = computed(() => store.paragraphs[store.cur])
const sections = computed(() => groupBySection(store.paragraphs))
const progress = computed(() => overview(store.paragraphs, store.best))

/** Section and number of the current paragraph, for the heading. */
const position = computed(() => {
  const found = locate(sections.value, store.cur)
  return { section: sectionTitle(found?.section.title ?? ''), number: found?.number ?? 1 }
})

/** Where the learner is, for the phone header: *§ 2 · 5/18*. */
const mobileTitle = computed(() =>
  para.value
    ? `§ ${position.value.number} · ${store.cur + 1}/${store.paragraphs.length}`
    : 'Discours',
)

/** Words in the current paragraph. */
const wordCount = computed(() => countWords(para.value?.items ?? []))

const hasPrevious = computed(() => store.cur > 0)
const hasNext = computed(() => store.cur < store.paragraphs.length - 1)

/**
 * Opens a paragraph, and closes the drawer.
 *
 * @param index - The paragraph's index in the speech; ignored if out of range.
 */
function go(index: number): void {
  if (index < 0 || index >= store.paragraphs.length) return
  store.cur = index
  drawerOpen.value = false
}

watch(
  () => store.cur,
  () => {
    stopAll()
    reading.clear()
  },
)

// ---------------------------------------------------------------- listening and reading

/** Plays the current paragraph with the model voice, or stops it. */
function listen(): void {
  if (voice.playing.value) return voice.stop()
  reading.stop()
  void voice.play(store.cur)
}

/** Starts reading aloud, or ends and scores it. */
function toggleReading(): void {
  if (reading.listening.value) return void reading.finish()
  voice.stop()
  reading.start(store.cur, store.cur)
}

/** Stops the model voice and recognition. */
function stopAll(): void {
  reading.stop()
  voice.stop()
}

// ---------------------------------------------------------------- word panel

/** Word open in the word panel, if any. */
const practising = shallowRef<Nullable<SelectedWord>>(null)
/** The word panel, to trigger "Répéter" with the space bar. */
const wordPanel = ref<InstanceType<typeof WordPractice>>()

/** Opens the word panel, stopping voice and recognition. */
function openWord(word: SelectedWord): void {
  stopAll()
  practising.value = word
}

// ---------------------------------------------------------------- keyboard

/** Whether a key press is meant for a form field. */
const inField = (e: KeyboardEvent): boolean =>
  !!(e.target as HTMLElement).closest('input, textarea, select')

/** Escape closes the drawer; ← → change paragraph; Space reads aloud, or repeats the word. */
function onKey(e: KeyboardEvent): void {
  if (inField(e)) return
  if (drawerOpen.value) {
    if (e.key === 'Escape') drawerOpen.value = false
  } else if (e.key === 'ArrowRight') go(store.cur + 1)
  else if (e.key === 'ArrowLeft') go(store.cur - 1)
  else if (e.key === ' ') {
    e.preventDefault()
    if (practising.value) wordPanel.value?.repeat()
    else if (reading.supported) toggleReading()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app">
    <ParagraphSidebar
      :open="drawerOpen"
      :progress="progress"
      :sections="sections"
      :best="store.best"
      :current="store.cur"
      @select="go"
      @close="drawerOpen = false"
    />

    <div class="col">
      <MobileHeader
        :drawer-open="drawerOpen"
        :settings-open="settingsOpen"
        :title="mobileTitle"
        @open-drawer="drawerOpen = true"
        @toggle-settings="settingsOpen = !settingsOpen"
      />

      <PracticeSettings
        v-model:show-ipa="store.showIpa"
        v-model:show-links="store.showLinks"
        v-model:rate="store.rate"
        v-model:voice-id="store.voiceId"
        :open="settingsOpen"
        :voices="voices"
      />

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
            <h2>{{ position.section }} · § {{ position.number }}</h2>
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

          <ReadingControls
            :playing="voice.playing.value"
            :recording="reading.listening.value"
            :can-listen="voice.supported"
            :can-read="reading.supported"
            :has-previous="hasPrevious"
            :has-next="hasNext"
            @listen="listen"
            @read="toggleReading"
            @previous="go(store.cur - 1)"
            @next="go(store.cur + 1)"
          />

          <PracticeLegend />

          <ReadingSummary v-if="reading.result.value" :result="reading.result.value" />

          <HeardTranscript
            :listening="reading.listening.value"
            :transcript="reading.transcript.value"
            :interim="reading.interim.value"
          />

          <HardWordsPanel @open="openWord" />
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
      :word="practising"
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
.col {
  display: flex;
  flex-direction: column;
  min-width: 0;
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
.msg {
  font-size: 14px;
  padding: 10px 14px;
  background: var(--badbg);
  color: var(--bad);
}

@media (max-width: 760px) {
  .app {
    grid-template-columns: 1fr;
  }
  /* The side padding is cancelled by the sticky ReadingControls bar: keep them in step. */
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
}
</style>
