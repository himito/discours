<script setup lang="ts">
/**
 * The training screen's settings: IPA and liaisons, the model voice's speed, and the voice.
 *
 * @remarks Each setting is a `v-model`: `showIpa`, `showLinks`, `rate` and `voiceId`. On phones
 * the bar is folded away unless `open`.
 */
import { computed } from 'vue'
import ToggleSwitch from '#ui/components/ToggleSwitch.vue'
import type { PracticeSettingsProps } from '#ui/types/components'

defineProps<PracticeSettingsProps>()
/** Whether the IPA is shown under the words. */
const showIpa = defineModel<boolean>('showIpa', { required: true })
/** Whether liaisons and enchaînements are shown. */
const showLinks = defineModel<boolean>('showLinks', { required: true })
/** Speed of the model voice. */
const rate = defineModel<number>('rate', { required: true })
/** Chosen voice, or `''` for the best one. */
const voiceId = defineModel<string>('voiceId', { required: true })

/** Slowest and fastest speeds of the model voice. */
const MIN_RATE = 0.6
const MAX_RATE = 1.1

/** How far the slider is filled, for its colour. */
const rateFill = computed(() => `${((rate.value - MIN_RATE) / (MAX_RATE - MIN_RATE)) * 100}%`)
/** The speed as shown, with a French decimal comma: *0,85×*. */
const rateLabel = computed(() => `${rate.value.toFixed(2).replace('.', ',')}×`)
</script>

<template>
  <header id="settings" class="topbar" :class="{ open }" aria-label="Réglages">
    <fieldset class="group">
      <legend>Affichage</legend>
      <ToggleSwitch v-model="showIpa">Prononciation (API)</ToggleSwitch>
      <ToggleSwitch v-model="showLinks" :disabled="!showIpa">
        Liaisons <span class="lz-sample" aria-hidden="true">‿z</span>
      </ToggleSwitch>
    </fieldset>

    <fieldset class="group voice">
      <legend>Voix du modèle</legend>
      <label class="speed">
        <span class="lbl">Vitesse</span>
        <input
          v-model.number="rate"
          class="range"
          type="range"
          :min="MIN_RATE"
          :max="MAX_RATE"
          step="0.05"
          :style="{ '--fill': rateFill }"
        />
        <output class="pill">{{ rateLabel }}</output>
      </label>
      <label v-if="voices.length > 1" class="select-wrap">
        <span class="lbl">Voix</span>
        <select v-model="voiceId" class="select">
          <option value="">Automatique (la meilleure)</option>
          <option v-for="v in voices" :key="v.id" :value="v.id">
            {{ v.name }}
          </option>
        </select>
      </label>
    </fieldset>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 0;
  min-height: 56px;
  padding: 8px clamp(16px, 4vw, 56px);
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--line);
}
.group {
  border: 0;
  margin: 0;
  padding: 0 20px 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 18px;
  min-width: 0;
}
.group + .group {
  border-left: 1px solid var(--line);
  padding-left: 20px;
}
.group legend {
  float: left;
  padding: 0;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--soft);
}
.lz-sample {
  font-family: var(--ipa-font);
  font-weight: 700;
  color: var(--liaison);
}

/* Speed slider and voice select */
.speed,
.select-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ink);
  white-space: nowrap;
}
.pill {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: var(--tint);
  border-radius: 999px;
  padding: 1px 8px;
  min-width: 3.4em;
  text-align: center;
}
.range {
  -webkit-appearance: none;
  appearance: none;
  width: 120px;
  height: 6px;
  margin: 0;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    var(--accent) var(--fill, 50%),
    var(--line) var(--fill, 50%)
  );
  cursor: pointer;
}
.range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
  box-shadow: 0 1px 3px rgba(0, 40, 75, 0.25);
}
.range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
}
.range:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}
.select {
  -webkit-appearance: none;
  appearance: none;
  font: inherit;
  font-size: 14px;
  color: var(--ink);
  background: #fff
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%2300284B' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  border: 1px solid var(--line);
  padding: 5px 30px 5px 10px;
  max-width: 15rem;
  cursor: pointer;
}
.select:hover {
  border-color: var(--accent);
}
.select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

/* On phones the settings fold away behind the ⚙ button. */
@media (max-width: 760px) {
  .topbar {
    display: none;
    position: static;
    padding: 12px 16px;
    background: #fafbfc;
  }
  .topbar.open {
    display: flex;
  }
  .group,
  .group + .group {
    width: 100%;
    border-left: 0;
    padding: 0;
  }
  .group + .group {
    border-top: 1px solid var(--line);
    padding-top: 10px;
  }
  .group legend {
    width: 100%;
  }
  .speed {
    width: 100%;
  }
  .range {
    flex: 1;
    width: auto;
    height: 8px;
  }
  .select-wrap,
  .select {
    width: 100%;
    max-width: none;
  }
  .select {
    min-height: 40px;
    font-size: 16px; /* below 16px, iOS Safari zooms in on focus */
  }
}
</style>
