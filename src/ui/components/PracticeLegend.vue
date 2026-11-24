<script setup lang="ts">
/** What the colours and marks of the text mean, and how to practise a word. */
</script>

<template>
  <div class="legend">
    <span><i class="swatch ok" />compris</span>
    <span><i class="swatch bad" />à retravailler</span>
    <span><i class="swatch tech" /><em>terme technique, non compté</em></span>
    <span><b class="lz">‿z</b> liaison <b class="ench">‿</b> enchaînement</span>
    <span class="tip">
      Clique un mot pour l'entendre et t'entraîner à le répéter. Sous chaque mot : sa prononciation
      en alphabet phonétique international (API).
    </span>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--soft);
}
.legend span {
  display: flex;
  gap: 6px;
  align-items: center;
}
.swatch {
  width: 14px;
  height: 14px;
  display: inline-block;
}
.swatch.ok {
  background: var(--okbg);
}
.swatch.bad {
  background: var(--badbg);
}
.swatch.tech {
  border: 1px solid var(--line);
}
.lz {
  color: var(--liaison);
  font-weight: 700;
  margin-left: 1px;
}
.ench {
  color: var(--ench);
  font-weight: 700;
  margin-left: 1px;
}

@media (max-width: 760px) {
  .legend {
    gap: 6px 12px;
    font-size: 12px;
  }
  .legend .tip {
    display: none;
  }
}
</style>
