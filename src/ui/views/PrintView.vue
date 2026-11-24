<script setup lang="ts">
/**
 * The speech as a PDF, whole or one section, in one of two templates.
 *
 * @remarks
 * - **Fiches**: one card per section, two A5 cards per A4 page, to cut out. A section that
 *   doesn't fit continues on the next card.
 * - **Document**: A4 pages, with a legend and page numbers.
 *
 * Both are laid out here as exact A4 pages: the heights of paragraphs and titles are measured in a
 * hidden box, at final size, then the cards or pages are filled. The preview shows those pages,
 * and the PDF is made from them (see `src/pdf.ts`).
 *
 * Route `/pdf`; `?partie=2` preselects the second section and `?modele=document` the document
 * template.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { exportPdf } from '#core/print/exportPdf'
import { pdfFileName } from '#core/print/fileName'
import { fillPages, pairs, type PageBox } from '#core/print/pagination'
import { A4_CSS_PIXELS } from '#core/print/paper'
import { hardWordsIn } from '#core/progress/progress'
import { groupBySection, readingSeconds, TARGET_WPM, type Section } from '#core/speech/sections'
import PrintDocBlock from '#ui/components/PrintDocBlock.vue'
import PrintParagraph from '#ui/components/PrintParagraph.vue'
import { saveFile } from '#ui/utils/download'
import { duration, sectionTitle } from '#ui/utils/format'
import { usePorts } from '#ui/composables/usePorts'
import { useDiscoursStore } from '#ui/stores/discours'
import type { Card, DocBlock, ExportProgress, PdfTemplate, TextSize } from '#ui/types/print'
import type { Nullable } from '#core/types'

const store = useDiscoursStore()
const { rasterizer } = usePorts()
const route = useRoute()
onMounted(() => void store.analyze())

/** Words to work on listed on a section's last card, at most. */
const HARD_ON_CARD = 8

// ---------------------------------------------------------------- options

/** Template: cards to cut out, or a document. */
const layout = ref<PdfTemplate>(route.query.modele === 'document' ? 'document' : 'cards')
/** Text size of the templates. */
const size = ref<TextSize>('normal')
/** Section to export (index), or `-1` for the whole speech. */
const scope = ref(Math.max(-1, Number(route.query.partie ?? 0) - 1))
/** Whether the IPA is included. */
const showIpa = ref(store.showIpa)
/** Whether liaisons are included. */
const showLinks = ref(store.showLinks)
/** Whether the reading marks are included. */
const showMarks = ref(true)
/** Whether cards list the section's words to work on. */
const showHard = ref(true)

// ---------------------------------------------------------------- content

/** Every section of the speech. */
const allSections = computed(() => groupBySection(store.paragraphs))

/** Sections included in the PDF. */
const sections = computed(() =>
  scope.value < 0 ? allSections.value : allSections.value.slice(scope.value, scope.value + 1),
)

watch(allSections, (all) => {
  if (scope.value >= all.length) scope.value = -1
})

/** Words included. */
const totalWords = computed(() => sections.value.reduce((n, s) => n + s.words, 0))

/** Reading time of `words` words at the target speed, as text. */
const readingTime = (words: number) => duration(readingSeconds(words))

/** Words to work on that appear in a section, with their IPA. */
function sectionHardWords(section: Section) {
  return hardWordsIn(
    section.paragraphs.map((p) => p.paragraph),
    store.hard,
    HARD_ON_CARD,
  ).map((w) => ({ text: w.text, ipa: store.ipaOf(w) }))
}

// ---------------------------------------------------------------- measuring

/** The room on an empty page or card, and the heights of the blocks to place, in the page. */
function measure(probe: HTMLElement | undefined, box: HTMLElement | undefined) {
  if (!probe || !box) return null
  const room: PageBox = {
    height: probe.clientHeight,
    gap: parseFloat(getComputedStyle(probe).rowGap) || 0,
  }
  const heights = [...box.querySelectorAll<HTMLElement>('[data-measure]')].map(
    (el) => el.getBoundingClientRect().height,
  )
  return { room, heights }
}

// ---------------------------------------------------------------- cards

/** The cards, filled by {@link paginateCards}. */
const cards = shallowRef<Card[]>([])
/** Hidden box holding every paragraph at card size, to measure them. */
const measureBox = ref<HTMLElement>()
/** Body of an empty hidden card: its height is the room for paragraphs. */
const probeBody = ref<HTMLElement>()

/** Fills cards section by section with as many paragraphs as fit. */
function paginateCards() {
  const measured = measure(probeBody.value, measureBox.value)
  if (!measured) return
  let offset = 0
  cards.value = sections.value.flatMap((section) => {
    const heights = measured.heights.slice(offset, (offset += section.paragraphs.length))
    const parts = fillPages(section.paragraphs, heights, measured.room)
    return parts.map((paragraphs, i) => ({ section, paragraphs, part: i + 1, parts: parts.length }))
  })
}

/** Cards two by two, one pair per A4 sheet. */
const sheets = computed(() => pairs(cards.value))

// ---------------------------------------------------------------- document

/** The document as a list of blocks: header, then each section's title and paragraphs. */
const docBlocks = computed<DocBlock[]>(() => [
  { kind: 'head', words: totalWords.value, duration: readingTime(totalWords.value) },
  ...sections.value.flatMap((s): DocBlock[] => [
    { kind: 'section', number: s.number, title: sectionTitle(s.title) },
    ...s.paragraphs.map(({ paragraph, number }): DocBlock => ({
      kind: 'para',
      paragraph,
      n: number,
    })),
  ]),
])

/** The document's pages, filled by {@link paginateDocument}. */
const docPages = shallowRef<DocBlock[][]>([])
/** Hidden box holding every block at page width, to measure them. */
const docMeasure = ref<HTMLElement>()
/** Body of an empty hidden page: its height is the room for blocks. */
const docProbe = ref<HTMLElement>()

/** Fills A4 pages; a section title always stays with its first paragraph. */
function paginateDocument() {
  const measured = measure(docProbe.value, docMeasure.value)
  if (!measured) return
  docPages.value = fillPages(
    docBlocks.value,
    measured.heights,
    measured.room,
    (b) => b.kind === 'section',
  )
}

/** Lays out the current template, once the hidden boxes are rendered with the right fonts. */
async function paginate() {
  await nextTick()
  await document.fonts?.ready
  if (layout.value === 'cards') paginateCards()
  else paginateDocument()
}

watch([sections, layout, size, showIpa, showLinks, showMarks, showHard], paginate, {
  immediate: true,
})

// ---------------------------------------------------------------- preview scale

const preview = ref<HTMLElement>()
/** Scale of the preview, to fit the window; the PDF is captured at full size. */
const zoom = ref(1)
let observer: ResizeObserver | undefined

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    const sheetWidth = A4_CSS_PIXELS.width
    zoom.value = Math.min(1, (entry?.contentRect.width ?? sheetWidth) / sheetWidth)
  })
  if (preview.value) observer.observe(preview.value)
})
onBeforeUnmount(() => observer?.disconnect())

// ---------------------------------------------------------------- PDF

/** The preview's pages container. */
const pages = ref<HTMLElement>()
/** Pages captured so far while making the PDF, or `null`. */
const exporting = ref<Nullable<ExportProgress>>(null)
/** Message shown when the PDF could not be made. */
const exportError = ref('')

/** File name of the PDF. */
const fileName = computed(() =>
  pdfFileName(scope.value >= 0 ? (sections.value[0] ?? null) : null, layout.value === 'cards'),
)

/** Captures the preview pages and downloads them as a PDF. */
async function downloadPdf() {
  const elements = [...(pages.value?.querySelectorAll<HTMLElement>('.sheet, .page') ?? [])]
  if (!elements.length || exporting.value) return
  exportError.value = ''
  exporting.value = { done: 0, total: elements.length }
  // Captured at full size: the preview's scale would otherwise apply to the capture.
  const previewZoom = zoom.value
  zoom.value = 1
  try {
    await nextTick()
    const pdf = await exportPdf(elements, rasterizer, (done) => {
      exporting.value = { done, total: elements.length }
    })
    saveFile(new Blob([pdf as BlobPart], { type: 'application/pdf' }), fileName.value)
  } catch (e) {
    exportError.value = `Le PDF n’a pas pu être créé : ${e instanceof Error ? e.message : String(e)}`
  } finally {
    zoom.value = previewZoom
    exporting.value = null
  }
}
</script>

<template>
  <div class="print-view" :class="[`size-${size}`, `layout-${layout}`]">
    <header class="toolbar">
      <RouterLink class="back" :to="{ name: 'entrainement' }">← Entraînement</RouterLink>
      <h1>Télécharger en PDF</h1>

      <div class="controls">
        <label class="field">
          <span>Contenu</span>
          <select v-model.number="scope">
            <option :value="-1">Tout le discours</option>
            <option v-for="(s, i) in allSections" :key="i" :value="i">
              {{ s.number }}. {{ sectionTitle(s.title) }}
            </option>
          </select>
        </label>

        <fieldset class="seg">
          <legend>Modèle</legend>
          <div class="opts">
            <label :class="{ on: layout === 'cards' }">
              <input v-model="layout" type="radio" value="cards" /> Fiches
            </label>
            <label :class="{ on: layout === 'document' }">
              <input v-model="layout" type="radio" value="document" /> Document
            </label>
          </div>
        </fieldset>

        <fieldset class="seg">
          <legend>Texte</legend>
          <div class="opts">
            <label :class="{ on: size === 'normal' }">
              <input v-model="size" type="radio" value="normal" /> Normal
            </label>
            <label :class="{ on: size === 'large' }">
              <input v-model="size" type="radio" value="large" /> Grand
            </label>
          </div>
        </fieldset>

        <fieldset class="checks">
          <legend>Afficher</legend>
          <div class="opts">
            <label><input v-model="showIpa" type="checkbox" /> API</label>
            <label><input v-model="showLinks" type="checkbox" /> Liaisons</label>
            <label><input v-model="showMarks" type="checkbox" /> Pauses</label>
            <label v-if="layout === 'cards'">
              <input v-model="showHard" type="checkbox" /> Mots à travailler
            </label>
          </div>
        </fieldset>

        <button
          type="button"
          class="btn primary"
          :disabled="!sections.length || !!exporting"
          :aria-busy="!!exporting"
          @click="downloadPdf"
        >
          <template v-if="exporting">
            Création du PDF… {{ exporting.done }}/{{ exporting.total }}
          </template>
          <template v-else>⤓ Télécharger le PDF</template>
        </button>
      </div>
      <p v-if="exportError" class="tip error" role="alert">{{ exportError }}</p>
      <p v-else class="tip">
        <template v-if="layout === 'cards'">
          Deux fiches par page A4, à découper le long des pointillés.
        </template>
        <template v-else>Pages A4 numérotées.</template>
        L’aperçu ci-dessous montre les pages du PDF.
      </p>
    </header>

    <main ref="preview" class="preview" :aria-busy="!!exporting">
      <p v-if="store.status === 'loading' && !store.paragraphs.length" class="state">
        Analyse du texte…
      </p>
      <p v-else-if="!allSections.length" class="state">
        Aucun texte à imprimer.
        <RouterLink :to="{ name: 'texte' }">Écrire le discours</RouterLink>
      </p>

      <!-- Fiches -->
      <div v-else-if="layout === 'cards'" ref="pages" class="sheets" :style="{ zoom }">
        <section v-for="(sheet, si) in sheets" :key="si" class="sheet">
          <article v-for="(card, ci) in sheet" :key="ci" class="card">
            <aside class="rail">
              <span class="num">{{ card.section.number }}</span>
              <span class="rail-title">{{ sectionTitle(card.section.title) }}</span>
            </aside>
            <div class="card-main">
              <div class="card-body">
                <PrintParagraph
                  v-for="{ paragraph, number } in card.paragraphs"
                  :key="paragraph.id + number"
                  :paragraph="paragraph"
                  :n="number"
                  :ipa="showIpa"
                  :links="showLinks"
                  :marks="showMarks"
                />
              </div>
              <footer class="card-foot">
                <span class="reps" aria-label="Répétitions">
                  Répétitions <i v-for="r in 5" :key="r" class="box" />
                </span>
                <span
                  v-if="
                    showHard && card.part === card.parts && sectionHardWords(card.section).length
                  "
                  class="hard"
                >
                  <b>À travailler</b>
                  <span v-for="w in sectionHardWords(card.section)" :key="w.text" class="hw"
                    >{{ w.text }}<template v-if="showIpa && w.ipa"> /{{ w.ipa }}/</template></span
                  >
                </span>
                <span class="meta">
                  <template v-if="card.parts > 1">{{ card.part }}/{{ card.parts }} · </template>≈
                  {{ readingTime(card.section.words) }}
                </span>
              </footer>
            </div>
          </article>
        </section>
      </div>

      <!-- Document -->
      <div v-else ref="pages" class="sheets" :style="{ zoom }">
        <section v-for="(page, pi) in docPages" :key="pi" class="page">
          <div class="page-body">
            <PrintDocBlock
              v-for="(block, bi) in page"
              :key="bi"
              :block="block"
              :ipa="showIpa"
              :links="showLinks"
              :marks="showMarks"
              :wpm="TARGET_WPM"
            />
          </div>
          <footer class="page-num">{{ pi + 1 }} / {{ docPages.length }}</footer>
        </section>
      </div>
    </main>

    <!-- Hidden measuring box: an empty page, and every block at page width. -->
    <div v-if="layout === 'document'" class="measure" aria-hidden="true">
      <section class="page">
        <div ref="docProbe" class="page-body" />
      </section>
      <div ref="docMeasure" class="measure-doc">
        <div v-for="(block, bi) in docBlocks" :key="bi" data-measure>
          <PrintDocBlock
            :block="block"
            :ipa="showIpa"
            :links="showLinks"
            :marks="showMarks"
            :wpm="TARGET_WPM"
          />
        </div>
      </div>
    </div>

    <!-- Hidden measuring box: a card at final size, and every paragraph at card width. -->
    <div v-if="layout === 'cards'" class="measure" aria-hidden="true">
      <article class="card">
        <aside class="rail" />
        <div class="card-main">
          <div ref="probeBody" class="card-body" />
          <footer class="card-foot"><span class="reps">Répétitions</span></footer>
        </div>
      </article>
      <div ref="measureBox" class="measure-paras">
        <template v-for="s in sections" :key="s.number">
          <div
            v-for="{ paragraph, number } in s.paragraphs"
            :key="paragraph.id + number"
            data-measure
          >
            <PrintParagraph
              :paragraph="paragraph"
              :n="number"
              :ipa="showIpa"
              :links="showLinks"
              :marks="showMarks"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.print-view {
  --fs: 13pt;
  --ipa-fs: 8.5pt;
  --paper-gap: #e6e9ef;
  min-height: 100vh;
  background: var(--paper-gap);
}
.size-large {
  --fs: 17pt;
  --ipa-fs: 10pt;
}
.layout-document {
  --fs: 12.5pt;
  --ipa-fs: 8.5pt;
}
.layout-document.size-large {
  --fs: 16pt;
  --ipa-fs: 10pt;
}

/* ------------------------------------------------------------ toolbar */
.toolbar {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 5;
  background: #fff;
  border-bottom: 1px solid var(--line);
  padding: 12px clamp(16px, 3vw, 32px);
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 16px;
  row-gap: 10px;
}
.back {
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.toolbar h1 {
  margin: 0;
  font-size: 18px;
}
.controls {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 20px;
}
.field,
fieldset {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.field > span,
legend {
  font-size: 12px;
  font-weight: 600;
  color: var(--soft);
  padding: 0;
  margin-bottom: 4px;
}
select {
  font: inherit;
  font-size: 14px;
  color: var(--ink);
  padding: 7px 10px;
  border: 1px solid var(--line);
  background: #fff;
  max-width: 260px;
}
.opts {
  display: flex;
  flex-wrap: wrap;
}
.seg label {
  position: relative;
  padding: 7px 12px;
  font-size: 14px;
  border: 1px solid var(--line);
  margin-left: -1px;
  cursor: pointer;
  background: #fff;
}
.seg label:first-of-type {
  margin-left: 0;
}
.seg label.on {
  background: var(--tint);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
  z-index: 1;
}
.seg input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.seg label:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.checks .opts {
  gap: 0 14px;
}
.checks label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  padding-block: 6px;
}
.checks input {
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
}
.controls .btn {
  margin-left: auto;
}
.tip {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 13px;
  color: var(--soft);
}
.tip.error {
  color: var(--bad);
  font-weight: 600;
}
.preview[aria-busy='true'] {
  cursor: progress;
}

/* ------------------------------------------------------------ preview */
.preview {
  padding: 24px clamp(16px, 3vw, 32px) 48px;
}
.state {
  text-align: center;
  color: var(--soft);
  margin-top: 15vh;
}
.sheets {
  margin: 0 auto;
  width: 210mm;
}
.sheets {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.sheet,
.page {
  width: 210mm;
  height: 297mm;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 40 75 / 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ------------------------------------------------------------ card */
.card {
  position: relative;
  width: 210mm;
  height: 148.5mm;
  display: grid;
  grid-template-columns: 22mm minmax(0, 1fr);
  overflow: hidden;
}
/* Cut line between the two cards of a sheet. */
.card + .card {
  border-top: 0.3mm dashed #9aa8b6;
}
.card + .card::before {
  content: '✂';
  font-family: 'Apple Symbols', 'Segoe UI Symbol', 'DejaVu Sans', sans-serif;
  position: absolute;
  top: -2.6mm;
  left: 6mm;
  font-size: 9pt;
  line-height: 1;
  color: #9aa8b6;
  background: #fff;
  padding: 0 1mm;
}
.rail {
  background: var(--tint);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 7mm 0 8mm;
  gap: 5mm;
  min-height: 0;
}
.num {
  font-family: 'Charis SIL', Georgia, serif;
  font-weight: 700;
  font-size: 40pt;
  line-height: 0.9;
  color: var(--accent);
  font-variant-numeric: lining-nums;
}
.rail-title {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-family: var(--sans);
  font-size: 10.5pt;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-height: 0;
  flex: 1;
  text-align: right;
}
.card-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 8mm 10mm 6mm 8mm;
  min-height: 0;
}
.card-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  row-gap: 4mm;
}
.card-foot {
  display: flex;
  align-items: center;
  gap: 6mm;
  padding-top: 3mm;
  border-top: 0.3mm solid var(--line);
  font-family: var(--sans);
  font-size: 8pt;
  color: var(--soft);
  white-space: nowrap;
}
.reps {
  display: inline-flex;
  align-items: center;
  gap: 1.2mm;
}
.box {
  display: inline-block;
  width: 3.4mm;
  height: 3.4mm;
  border: 0.3mm solid var(--soft);
  border-radius: 0.6mm;
}
.box:first-of-type {
  margin-left: 1mm;
}
.hard {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hard b {
  color: var(--bad);
  margin-right: 1.5mm;
}
.hw + .hw::before {
  content: ', ';
}
.hw {
  font-family: 'Charis SIL', Georgia, serif;
  font-size: 9pt;
  color: var(--ink);
}
.meta {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

/* ------------------------------------------------------------ document */
.page {
  position: relative;
  padding: 16mm 18mm 18mm;
}
.page-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  row-gap: 4mm;
}
.page-num {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 8mm;
  text-align: center;
  font-family: var(--sans);
  font-size: 8pt;
  color: #6b7b8c;
}

/* ------------------------------------------------------------ measuring box */
.measure {
  position: absolute;
  left: -10000px;
  top: 0;
  visibility: hidden;
  pointer-events: none;
}
/* Same width as a card's body: 210 mm − rail − padding. */
.measure-paras {
  width: calc(210mm - 22mm - 18mm);
}
/* Same width as a page's body: 210 mm − margins. */
.measure-doc {
  width: calc(210mm - 36mm);
}

@media (max-width: 640px) {
  .controls .btn {
    margin-left: 0;
    width: 100%;
    justify-content: center;
  }
}
</style>
