<script setup lang="ts">
/**
 * The training screen's sidebar: the overall progress, the paragraph list, and links to the other
 * screens.
 *
 * @remarks On phones it is a drawer. While open, the page behind it is locked, the focus moves to
 * its close button, and the current paragraph is centred in the list.
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import logoMark from '#ui/assets/logo-mark.svg'
import OverallProgress from '#ui/components/OverallProgress.vue'
import ParagraphList from '#ui/components/ParagraphList.vue'
import type { ParagraphSidebarEmits, ParagraphSidebarProps } from '#ui/types/components'

const props = defineProps<ParagraphSidebarProps>()
const emit = defineEmits<ParagraphSidebarEmits>()

/** Close button of the drawer, focused when it opens. */
const closeButton = ref<HTMLButtonElement>()
/** The paragraph list, to centre the current paragraph when the drawer opens. */
const list = ref<InstanceType<typeof ParagraphList>>()

/** Locks or unlocks the scrolling of the page behind the drawer. */
function lockPage(locked: boolean): void {
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(
  () => props.open,
  (open) => {
    lockPage(open)
    if (!open) return
    requestAnimationFrame(() => {
      closeButton.value?.focus()
      list.value?.revealCurrent()
    })
  },
)
onBeforeUnmount(() => lockPage(false))
</script>

<template>
  <aside id="paragraphs" :class="{ open }" aria-label="Paragraphes du discours">
    <header class="side-head">
      <button
        ref="closeButton"
        type="button"
        class="drawer-close"
        aria-label="Fermer la liste des paragraphes"
        @click="emit('close')"
      >
        ×
      </button>
      <p class="brand"><img :src="logoMark" alt="" width="28" height="28" /> Discours</p>
      <h1>Entraînement prononciation</h1>
      <p class="hint">
        Écoute le modèle, puis lis à voix haute. Les mots mal compris passent en rouge.
      </p>
      <OverallProgress v-if="progress.total" :progress="progress" />
    </header>

    <ParagraphList
      ref="list"
      :sections="sections"
      :best="best"
      :current="current"
      @select="emit('select', $event)"
    />

    <footer class="side-foot">
      <div>
        <RouterLink
          class="btn edit primary"
          :to="{ name: 'discours' }"
          title="Écouter et lire tout le discours d’un seul tenant"
          >▤ Discours entier</RouterLink
        >
        <RouterLink class="btn edit" :to="{ name: 'texte' }">✎ Modifier le texte</RouterLink>
        <RouterLink
          class="btn edit"
          :to="{ name: 'pdf' }"
          title="Fiches d’entraînement ou document, avec l’API"
          >⤓ Télécharger en PDF</RouterLink
        >
      </div>
    </footer>
  </aside>
  <div v-if="open" class="backdrop" aria-hidden="true" @click="emit('close')" />
</template>

<style scoped>
aside {
  border-right: 1px solid var(--line);
  background: #fafbfc;
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.side-head {
  padding: 22px 20px 16px;
  border-bottom: 1px solid var(--line);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}
.brand img {
  border-radius: 7px;
}
.side-head h1 {
  font-size: 18px;
  line-height: 1.25;
  margin: 0 0 6px;
}
.hint {
  font-size: 13px;
  color: var(--soft);
  margin: 0;
  line-height: 1.45;
}
.side-foot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  background: #fafbfc;
}
.edit {
  justify-content: center;
  white-space: nowrap;
  text-decoration: none;
  font-size: 14px;
  padding: 8px 14px;
}
.drawer-close {
  display: none;
}

/* On phones the sidebar is a drawer sliding in from the left. */
@media (max-width: 760px) {
  aside {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 30;
    width: min(88vw, 340px);
    height: 100dvh;
    box-shadow: 0 0 40px rgba(0, 40, 75, 0.25);
    transform: translateX(-105%);
    visibility: hidden;
    transition:
      transform 0.25s ease,
      visibility 0s linear 0.25s;
  }
  aside.open {
    transform: none;
    visibility: visible;
    transition: transform 0.25s ease;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 25;
    background: rgba(0, 40, 75, 0.35);
  }
  .side-head {
    position: relative;
    padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 14px;
  }
  .drawer-close {
    display: grid;
    place-items: center;
    position: absolute;
    top: calc(10px + env(safe-area-inset-top, 0px));
    right: 10px;
    width: 40px;
    height: 40px;
    border: 0;
    background: none;
    font-size: 26px;
    line-height: 1;
    color: var(--soft);
  }
  .side-foot {
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  }
}

@media (max-width: 760px) and (prefers-reduced-motion: reduce) {
  aside,
  aside.open {
    transition: none;
  }
}
</style>
