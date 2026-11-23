<script setup lang="ts">
/**
 * One block of the document template: the header, a section title, or a paragraph.
 *
 * @remarks The print screen measures blocks one by one to cut the document into A4 pages, so each
 * block keeps its spacing inside itself (padding, not margins).
 */
import PrintParagraph from '#ui/components/PrintParagraph.vue'
import type { AnalyzedParagraph } from '#core/model'

/** A block of the document. */
export type DocBlock =
  | { kind: 'head'; words: number; duration: string }
  | { kind: 'section'; number: number; title: string }
  | { kind: 'para'; paragraph: AnalyzedParagraph; n: number }

defineProps<{
  /** The block to show. */
  block: DocBlock
  /** Whether to show the IPA under each word. */
  ipa: boolean
  /** Whether to show liaisons and enchaînements (and their legend). */
  links: boolean
  /** Whether to show the reading marks (and their legend). */
  marks: boolean
  /** Reading speed shown in the header, in words per minute. */
  wpm: number
}>()
</script>

<template>
  <header v-if="block.kind === 'head'" class="doc-head">
    <h2>Discours</h2>
    <p>{{ block.words }} mots, environ {{ block.duration }} à {{ wpm }} mots par minute.</p>
    <p v-if="marks || links" class="legend">
      <template v-if="marks">
        <span><b class="mk">/</b> pause courte</span>
        <span><b class="mk">//</b> pause longue</span>
        <span><b class="mk">→</b> diapositive suivante</span>
      </template>
      <template v-if="links">
        <span><b class="lz">‿z</b> liaison</span>
        <span><b class="ench">‿</b> enchaînement</span>
      </template>
    </p>
  </header>
  <h3 v-else-if="block.kind === 'section'" class="doc-sec">
    <span class="num">{{ block.number }}</span> {{ block.title }}
  </h3>
  <PrintParagraph
    v-else
    :paragraph="block.paragraph"
    :n="block.n"
    :ipa="ipa"
    :links="links"
    :marks="marks"
  />
</template>

<style scoped>
.doc-head {
  border-bottom: 0.4mm solid var(--ink);
  padding-bottom: 5mm;
  margin-bottom: 2mm;
}
.doc-head h2 {
  margin: 0 0 2mm;
  font-family: 'Charis SIL', Georgia, serif;
  font-size: 26pt;
  line-height: 1.1;
}
.doc-head p {
  margin: 0;
  font-size: 10pt;
  color: var(--soft);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1mm 6mm;
  margin-top: 3mm !important;
}
.legend b {
  font-weight: 700;
  margin-right: 1mm;
}
.legend .mk {
  font-family: var(--mono);
  color: var(--accent);
}
.legend .lz {
  color: var(--liaison);
}
.legend .ench {
  color: var(--ench);
}
.doc-sec {
  margin: 0;
  padding-top: 4mm;
  display: flex;
  align-items: baseline;
  gap: 3mm;
  font-family: 'Charis SIL', Georgia, serif;
  font-size: 15pt;
  line-height: 1.2;
}
.num {
  font-weight: 700;
  font-size: 20pt;
  color: var(--accent);
}
</style>
