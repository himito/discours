<script setup lang="ts">
/**
 * The training screen's actions: listen to the model, read aloud, previous and next paragraph.
 *
 * @remarks On phones the bar sticks to the bottom of the screen, within thumb reach, and the
 * buttons drop the end of their labels.
 */
import type { ReadingControlsEmits, ReadingControlsProps } from '#ui/types/components'

defineProps<ReadingControlsProps>()
const emit = defineEmits<ReadingControlsEmits>()
</script>

<template>
  <div class="bar">
    <button type="button" class="btn act" :disabled="!canListen" @click="emit('listen')">
      <template v-if="playing">■ Arrêter</template>
      <template v-else>▶ Écouter<span class="long"> le modèle</span></template>
    </button>
    <button
      type="button"
      class="btn act"
      :class="recording ? 'rec' : 'primary'"
      :disabled="!canRead"
      @click="emit('read')"
    >
      <template v-if="recording">■ J'ai fini</template>
      <template v-else>● Lire<span class="long"> à voix haute</span></template>
    </button>
    <button
      type="button"
      class="btn"
      aria-label="Paragraphe précédent"
      :disabled="!hasPrevious"
      @click="emit('previous')"
    >
      ←
    </button>
    <button
      type="button"
      class="btn"
      aria-label="Paragraphe suivant"
      :disabled="!hasNext"
      @click="emit('next')"
    >
      →
    </button>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

@media (max-width: 760px) {
  .bar {
    position: sticky;
    bottom: 0;
    z-index: 11;
    /* Full width: cancels the side padding of the screen's main area. */
    margin: 0 -14px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(6px);
    border-top: 1px solid var(--line);
    flex-wrap: nowrap;
    gap: 8px;
  }
  .btn {
    min-height: 44px;
    padding: 0 12px;
    justify-content: center;
  }
  .act {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
  }
  .long {
    display: none;
  }
}
</style>
