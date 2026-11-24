<script setup lang="ts">
/**
 * The training screen's header on phones: opens the paragraph drawer, shows where the learner is,
 * and folds or unfolds the settings. Hidden on larger screens.
 */
import logoMark from '#ui/assets/logo-mark.svg'
import type { MobileHeaderEmits, MobileHeaderProps } from '#ui/types/components'

defineProps<MobileHeaderProps>()
const emit = defineEmits<MobileHeaderEmits>()
</script>

<template>
  <header class="mobile-head">
    <button
      type="button"
      class="mh-btn"
      aria-controls="paragraphs"
      :aria-expanded="drawerOpen"
      @click="emit('openDrawer')"
    >
      <span aria-hidden="true">☰</span> Paragraphes
    </button>
    <p class="mh-title">
      <img :src="logoMark" alt="" width="22" height="22" />
      <span>{{ title }}</span>
    </p>
    <button
      type="button"
      class="mh-btn"
      :class="{ on: settingsOpen }"
      aria-controls="settings"
      :aria-expanded="settingsOpen"
      @click="emit('toggleSettings')"
    >
      <span aria-hidden="true">⚙</span> Réglages
    </button>
  </header>
</template>

<style scoped>
.mobile-head {
  display: none;
}

@media (max-width: 760px) {
  .mobile-head {
    position: sticky;
    top: 0;
    z-index: 12;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: calc(8px + env(safe-area-inset-top, 0px)) 12px 8px;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(6px);
    border-bottom: 1px solid var(--line);
  }
  .mh-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--line);
    background: #fff;
    color: var(--ink);
    font-size: 14px;
    font-weight: 600;
  }
  .mh-btn.on {
    background: var(--tint);
    border-color: var(--accent);
    color: var(--accent);
  }
  .mh-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
  }
  .mh-title img {
    border-radius: 5px;
  }
}
</style>
