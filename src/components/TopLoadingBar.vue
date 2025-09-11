<template>
  <div v-if="loading" class="loading-progress-bar"></div>
</template>

<script setup>
import { defineProps } from 'vue';
const props = defineProps({
  loading: Boolean
});
</script>

<style scoped>
.loading-progress-bar {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 4px;
  background: linear-gradient(90deg, #ffffffff 30%, #42a5f5 100%);
  animation: loading-bar-move 1.2s linear infinite;
  z-index: 2000;
}
@keyframes loading-bar-move {
  0% { background-position: 0 0; }
  100% { background-position: 100vw 0; }
}
</style>
