<script setup lang="ts">
/**
 * The paragraphs of the speech, grouped by section, with the best score of each.
 *
 * @remarks Keeps the current paragraph in view as it changes. Exposes `revealCurrent()` to
 * centre it, for when the list becomes visible (the drawer opening, on phones).
 */
import { computed, nextTick, ref, watch } from 'vue'
import { overview } from '#core/progress/progress'
import type { Section } from '#core/speech/sections'
import { scoreClass } from '#ui/utils/format'
import type { ParagraphListEmits, ParagraphListProps } from '#ui/types/components'

const props = defineProps<ParagraphListProps>()
const emit = defineEmits<ParagraphListEmits>()

/** Room kept under the current paragraph before the list scrolls, in pixels. */
const BOTTOM_MARGIN = 60

/** The list, to scroll it. */
const list = ref<HTMLElement>()

/** Paragraphs of a section read at least once. */
const readIn = (section: Section): number =>
  overview(
    section.paragraphs.map((p) => p.paragraph),
    props.best,
  ).read

/** The sections as shown: each paragraph with its best score, if read. */
const rows = computed(() =>
  props.sections.map((section) => ({
    title: section.title,
    read: readIn(section),
    paragraphs: section.paragraphs.map(({ paragraph, index, number }) => ({
      key: paragraph.id + index,
      index,
      number,
      text: paragraph.text,
      score: props.best[paragraph.id] ?? null,
    })),
  })),
)

/** The button of the current paragraph. */
function currentButton(): HTMLElement | undefined {
  return list.value?.querySelector<HTMLElement>('[aria-current]') ?? undefined
}

/** Scrolls the list just enough to show the current paragraph. */
function keepCurrentInView(): void {
  const current = currentButton()
  if (!list.value || !current) return
  const { scrollTop, clientHeight } = list.value
  const top = current.offsetTop
  if (top < scrollTop || top > scrollTop + clientHeight - BOTTOM_MARGIN)
    list.value.scrollTop = top - clientHeight / 3
}

/** Centres the current paragraph in the list. */
function revealCurrent(): void {
  currentButton()?.scrollIntoView({ block: 'center' })
}

watch(
  () => props.current,
  async () => {
    await nextTick()
    requestAnimationFrame(keepCurrentInView)
  },
)

defineExpose({ revealCurrent })
</script>

<template>
  <nav ref="list" class="plist" aria-label="Paragraphes">
    <section v-for="(section, si) in rows" :key="si" class="sec">
      <h2 v-if="section.title" class="sec-title">
        <span>{{ section.title }}</span>
        <span class="sec-count">{{ section.read }}/{{ section.paragraphs.length }}</span>
      </h2>
      <button
        v-for="p in section.paragraphs"
        :key="p.key"
        type="button"
        class="pbtn"
        :class="{ on: p.index === current }"
        :aria-current="p.index === current ? 'true' : undefined"
        @click="emit('select', p.index)"
      >
        <span class="pnum">{{ p.number }}</span>
        <span class="ptext">{{ p.text }}</span>
        <span v-if="p.score !== null" class="score" :class="scoreClass(p.score)">
          {{ p.score }}%
        </span>
        <span v-else class="score none" aria-label="pas encore lu">–</span>
      </button>
    </section>
  </nav>
</template>

<style scoped>
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

@media (max-width: 760px) {
  .pbtn {
    padding-block: 10px;
  }
}
</style>
