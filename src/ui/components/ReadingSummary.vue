<script setup lang="ts">
/** The result of a reading: the share of words understood, the duration and the speed. */
import { TARGET_WPM } from '#core/speech/sections'
import { clock, scoreClass } from '#ui/utils/format'
import type { ReadingSummaryProps } from '#ui/types/components'

defineProps<ReadingSummaryProps>()
</script>

<template>
  <div class="result">
    <div class="kpi">
      <b :class="scoreClass(result.score.percent)">{{ result.score.percent }} %</b
      ><span>des mots compris</span>
    </div>
    <div class="kpi">
      <b>{{ clock(result.seconds) }}</b
      ><span>durée de lecture</span>
    </div>
    <div class="kpi">
      <b>{{ result.wpm ?? '–' }}</b
      ><span>mots / minute (cible ≈ {{ TARGET_WPM }})</span>
    </div>
  </div>
</template>

<style scoped>
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

@media (max-width: 760px) {
  .result {
    gap: 6px;
  }
  .kpi {
    padding: 10px;
  }
  .kpi b {
    font-size: 22px;
  }
  .kpi span {
    font-size: 11px;
  }
}
</style>
