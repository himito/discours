<script setup lang="ts">
/**
 * What the recognizer heard: the recognized words, then, in colour, those still being recognized.
 *
 * @remarks Keeps its height when empty, so the page doesn't jump when a reading starts.
 */
import { computed } from 'vue'
import type { HeardTranscriptProps } from '#ui/types/components'

const props = defineProps<HeardTranscriptProps>()

/** Whether there is anything to show. */
const visible = computed(() => props.listening || props.transcript !== '')
/** The words being recognized, or a prompt while nothing has been heard yet. */
const pending = computed(() =>
  props.listening && !props.transcript && !props.interim ? 'parle maintenant…' : props.interim,
)
</script>

<template>
  <div class="heard">
    <template v-if="visible">
      <b>Entendu :</b> {{ transcript }} <i>{{ pending }}</i>
    </template>
  </div>
</template>

<style scoped>
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
</style>
