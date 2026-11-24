<script setup lang="ts">
/**
 * A paragraph as printed: its number, then each word with its IPA underneath, liaisons and reading
 * marks.
 *
 * @remarks Sizes come from the parent through `--fs` (text) and `--ipa-fs` (IPA). When the IPA is
 * hidden, liaisons are shown after the word itself.
 */
import { computed } from 'vue'
import type { PrintParagraphProps } from '#ui/types/components'
import { displayUnits } from '#core/speech/units'
import { useDiscoursStore } from '#ui/stores/discours'

const props = defineProps<PrintParagraphProps>()

const store = useDiscoursStore()
/** The paragraph as words with punctuation, and reading marks. */
const units = computed(() => displayUnits(props.paragraph.items))
</script>

<template>
  <div class="pp">
    <span class="pn">{{ n }}</span>
    <p class="pt" lang="fr">
      <template v-for="(u, k) in units" :key="k">
        <template v-if="u.kind === 'mark'">
          <span v-if="marks" class="mk">{{ u.text }}</span>
        </template>
        <span v-else class="w" :class="{ tech: u.item.tech }">
          <span class="wt"
            >{{ u.pre }}{{ u.item.text }}{{ u.post
            }}<template v-if="links && !ipa">
              <span v-if="u.item.link === 'liaison'" class="lz">‿{{ u.item.liaison }}</span>
              <span v-else-if="u.item.link === 'enchainement'" class="ench">‿</span>
            </template></span
          >
          <span v-if="ipa" class="ipa"
            ><template v-if="store.ipaOf(u.item)">/{{ store.ipaOf(u.item) }}/</template
            ><template v-else>&nbsp;</template
            ><template v-if="links">
              <span v-if="u.item.link === 'liaison'" class="lz">‿{{ u.item.liaison }}</span>
              <span v-else-if="u.item.link === 'enchainement'" class="ench">‿</span>
            </template></span
          >
        </span>
      </template>
    </p>
  </div>
</template>

<style scoped>
.pp {
  display: grid;
  grid-template-columns: 1.6em 1fr;
  align-items: start;
  break-inside: avoid;
}
.pn {
  font-family: var(--sans);
  font-size: calc(var(--ipa-fs) * 1.05);
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
  padding-top: 0.45em;
  font-variant-numeric: tabular-nums;
}
.pt {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  column-gap: 0.3em;
  row-gap: 0.15em;
  font-family: 'Charis SIL', Georgia, serif;
  font-size: var(--fs);
  line-height: 1.25;
  color: var(--ink);
}
.w {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}
.tech .wt {
  font-style: italic;
}
.ipa {
  font-family: var(--ipa-font);
  font-size: var(--ipa-fs);
  line-height: 1.3;
  color: #4a5d73;
  white-space: nowrap;
}
.lz {
  color: var(--liaison);
  font-weight: 700;
}
.ench {
  color: var(--ench);
  font-weight: 700;
}
.mk {
  align-self: flex-start;
  font-family: var(--mono);
  font-size: calc(var(--fs) * 0.8);
  font-weight: 600;
  color: var(--accent);
  line-height: 1.55;
}
</style>
