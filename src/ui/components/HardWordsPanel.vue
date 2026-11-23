<script setup lang="ts">
/**
 * "Mots à travailler": the words missed while reading, most missed first.
 *
 * @remarks Each card shows the word, its IPA, how often it was missed and its practice results.
 * Clicking a card emits `open` with the word's key, for the word panel. The list can be emptied,
 * after confirmation.
 */
import { computed, ref } from 'vue'
import { hardWordList, missLevel } from '#core/progress/progress'
import { useDiscoursStore } from '#ui/stores/discours'

/** `open`: a word was chosen, with its key. */
const emit = defineEmits<{ open: [key: string] }>()

const store = useDiscoursStore()

/** Cards shown before "Afficher les … autres". */
const HARD_SHOWN = 12

/** Words to work on, most missed first, with what the cards show. */
const hardWords = computed(() =>
  hardWordList(store.paragraphs, store.hard).map(({ key, missed, item }) => ({
    key,
    missed,
    ipa: item ? store.ipaOf(item) : (store.overrides[key] ?? ''),
    stat: store.wordStats[key],
    level: missLevel(missed),
  })),
)
/** Whether all words are shown, not only the first ones. */
const showAllHard = ref(false)
/** Words shown. */
const shownHard = computed(() =>
  showAllHard.value ? hardWords.value : hardWords.value.slice(0, HARD_SHOWN),
)
/** Whether "Effacer la liste" is waiting for confirmation. */
const confirmClear = ref(false)

/** Empties the list, after confirmation. */
function clearHard() {
  store.clearHard()
  confirmClear.value = false
  showAllHard.value = false
}
</script>

<template>
  <section class="hard" aria-labelledby="hard-title">
    <div class="hard-head">
      <h3 id="hard-title">
        Mots à travailler
        <span v-if="hardWords.length" class="count">{{ hardWords.length }}</span>
      </h3>
      <div v-if="hardWords.length" class="hard-actions">
        <template v-if="confirmClear">
          <span>Effacer toute la liste ?</span>
          <button type="button" class="link danger" @click="clearHard">Effacer</button>
          <button type="button" class="link" @click="confirmClear = false">Annuler</button>
        </template>
        <button v-else type="button" class="link" @click="confirmClear = true">
          Effacer la liste
        </button>
      </div>
    </div>

    <p v-if="!hardWords.length" class="empty">
      Aucun mot pour l'instant. Lis un paragraphe à voix haute : les mots que la reconnaissance n'a
      pas compris s'ajouteront ici pour que tu les travailles un par un.
    </p>
    <template v-else>
      <p class="hard-hint">
        Clique un mot pour l'écouter et le répéter. Chaque réussite le fait reculer dans la liste.
      </p>
      <ul class="cards">
        <li v-for="w in shownHard" :key="w.key">
          <button type="button" class="card" :class="w.level" @click="emit('open', w.key)">
            <span class="card-word">{{ w.key }}</span>
            <span v-if="w.ipa" class="card-ipa">/{{ w.ipa }}/</span>
            <span class="card-meta">
              <span>manqué {{ w.missed }}×</span>
              <span v-if="w.stat?.n"
                >{{ w.stat.ok }}/{{ w.stat.n }} réussi{{ w.stat.ok > 1 ? 's' : '' }}</span
              >
            </span>
          </button>
        </li>
      </ul>
      <button
        v-if="hardWords.length > HARD_SHOWN"
        type="button"
        class="link"
        @click="showAllHard = !showAllHard"
      >
        {{
          showAllHard ? 'Afficher moins' : `Afficher les ${hardWords.length - HARD_SHOWN} autres`
        }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.hard {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid var(--line);
  padding-top: 18px;
}
.hard-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.hard h3 {
  margin: 0;
  font-size: 17px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.count {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--bad);
  background: var(--badbg);
  border-radius: 999px;
  padding: 1px 8px;
}
.hard-actions {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 13px;
  color: var(--soft);
}
.link.danger {
  color: var(--bad);
  font-weight: 600;
}
.hard-hint {
  margin: 0;
  font-size: 13px;
  color: var(--soft);
}
.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
  background: #fff;
  border: 1px solid var(--line);
  border-left: 4px solid var(--line);
  padding: 10px 12px;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.card:hover {
  background: var(--tint);
  border-color: var(--accent);
}
.card.high {
  border-left-color: var(--bad);
}
.card.mid {
  border-left-color: #d9a21b;
}
.card.low {
  border-left-color: var(--ipa-soft, #9aa6c8);
}
.card-word {
  font-size: 17px;
  font-weight: 600;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.card-ipa {
  font-family: var(--ipa-font);
  font-size: 14px;
  color: var(--accent);
}
.card-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--soft);
}
.card.high .card-meta span:first-child {
  color: var(--bad);
  font-weight: 600;
}
.empty {
  margin: 0;
  padding: 16px 18px;
  border: 1px dashed var(--line);
  font-size: 14px;
  line-height: 1.5;
  color: var(--soft);
}
@media (max-width: 760px) {
  .cards {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  }
  .hard {
    padding-bottom: 24px;
  }
}
</style>
