<script setup lang="ts">
/**
 * A paragraph as words with their IPA, liaisons and reading marks, as on the training screen.
 *
 * @remarks The parent decides each word's colour (`state`) and which word the model voice is
 * saying (`sayIndex`). Clicking a word emits `word`.
 */
import { computed } from 'vue'
import type { Item, WordItem } from '@/phonetics/analyze'
import { displayUnits } from '@/practice/units'
import { useDiscoursStore } from '@/stores/discours'

/** Component props. */
const props = defineProps<{
  /** The paragraph's items. */
  items: Item[]
  /** Index of the item being spoken, or -1. */
  sayIndex: number
  /** Reading result of a word: `ok`, `miss` or `''` (not judged). */
  state: (index: number, item: WordItem) => '' | 'ok' | 'miss'
}>()
/** `word`: a word was clicked or activated with Enter. */
const emit = defineEmits<{ word: [text: string, item: WordItem] }>()

const store = useDiscoursStore()
/** The paragraph as words with punctuation, and reading marks. */
const units = computed(() => displayUnits(props.items))
</script>

<template>
  <p class="st" :class="{ noipa: !store.showIpa }" lang="fr">
    <template v-for="(u, k) in units" :key="k">
      <span v-if="u.kind === 'mark'" class="mk">{{ u.text }}</span>
      <span
        v-else
        class="w"
        :class="[{ tech: u.item.tech, say: u.index === sayIndex }, state(u.index, u.item)]"
        role="button"
        tabindex="0"
        @click="emit('word', u.item.text, u.item)"
        @keydown.enter="emit('word', u.item.text, u.item)"
      >
        <span>{{ u.pre }}{{ u.item.text }}{{ u.post }}</span>
        <span class="ipa">
          <template v-if="store.ipaOf(u.item)">/{{ store.ipaOf(u.item) }}/</template>
          <template v-else>&nbsp;</template>
          <span
            v-if="store.showLinks && u.item.link === 'liaison'"
            class="lz"
            :title="`Liaison en [${u.item.liaison}]`"
            >‿{{ u.item.liaison }}</span
          >
          <span
            v-else-if="store.showLinks && u.item.link === 'enchainement'"
            class="ench"
            title="Enchaînement"
            >‿</span
          >
        </span>
      </span>
    </template>
  </p>
</template>

<style scoped>
.st {
  margin: 0;
  font-size: 21px;
  line-height: 1.8;
  display: flex;
  flex-wrap: wrap;
  column-gap: 0.3em;
  row-gap: 2px;
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
  font-size: 13.5px;
  color: var(--accent);
  margin-top: 2px;
  white-space: nowrap;
}
.noipa .ipa {
  display: none;
}
.w:focus-visible {
  outline: 2px solid var(--accent);
}
@media (hover: hover) {
  .w:hover {
    outline: 2px solid var(--accent);
  }
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
  font-size: 14px;
  color: var(--accent);
  font-weight: 600;
  align-self: center;
}
@media (max-width: 760px) {
  .st {
    font-size: 19px;
  }
}
</style>
