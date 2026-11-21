<script setup lang="ts">
/**
 * Root component: shows the current route's screen, and starts loading eSpeak-NG as soon as the
 * app starts, so the first analysis doesn't wait for it.
 */
import { onMounted } from 'vue'
import { warmUp } from '@/phonetics/analyze'

onMounted(warmUp)
</script>

<template>
  <RouterView />
</template>
