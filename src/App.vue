<script setup lang="ts">
import { onMounted } from 'vue'
import { warmUp } from '@/phonetics/analyze'

onMounted(warmUp)
</script>

<template>
  <RouterView />
</template>
