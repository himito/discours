<script setup lang="ts">
/** How far the learner is through the speech: paragraphs read, average score and a meter. */
import { scoreClass } from '#ui/utils/format'
import type { OverallProgressProps } from '#ui/types/components'

defineProps<OverallProgressProps>()
</script>

<template>
  <div class="overall">
    <div class="overall-row">
      <span
        ><b>{{ progress.read }}</b> / {{ progress.total }} paragraphes lus</span
      >
      <span v-if="progress.average !== null" class="average" :class="scoreClass(progress.average)"
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
</template>

<style scoped>
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
.average {
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
</style>
