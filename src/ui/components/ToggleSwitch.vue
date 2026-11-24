<script setup lang="ts">
/**
 * An on/off switch with its label (the default slot), bound with `v-model`.
 *
 * @remarks A real checkbox with `role="switch"`, visually hidden: keyboard and screen readers
 * work as with any checkbox.
 */
import type { ToggleSwitchProps } from '#ui/types/components'

defineProps<ToggleSwitchProps>()
/** Whether the switch is on. */
const on = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="switch">
    <input v-model="on" type="checkbox" role="switch" :disabled="disabled" />
    <span class="track" aria-hidden="true"><span class="knob" /></span>
    <slot />
  </label>
</template>

<style scoped>
.switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ink);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.switch input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.track {
  width: 32px;
  height: 18px;
  border-radius: 999px;
  background: var(--line);
  position: relative;
  flex: none;
  transition: background 0.15s;
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 40, 75, 0.3);
  transition: transform 0.15s;
}
.switch input:checked + .track {
  background: var(--accent);
}
.switch input:checked + .track .knob {
  transform: translateX(14px);
}
.switch input:focus-visible + .track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.switch:has(input:disabled) {
  opacity: 0.45;
  cursor: default;
}

@media (prefers-reduced-motion: reduce) {
  .track,
  .knob {
    transition: none;
  }
}
</style>
