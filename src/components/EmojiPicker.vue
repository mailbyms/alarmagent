<template>
  <div v-if="visible" class="emoji-picker-overlay" @click="close">
    <div class="emoji-picker" @click.stop>
      <div class="emoji-picker-header">
        选择图标
        <button class="close-btn" @click="close">×</button>
      </div>
      <div class="emoji-list">
        <div
          v-for="emoji in emojis"
          :key="emoji"
          class="emoji-item"
          @click="selectEmoji(emoji)"
        >
          {{ emoji }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

defineProps({
  visible: {
    type: Boolean,
    default: false
  }
});

const emits = defineEmits(['update:visible', 'select']);

const emojis = [
  '🤖', '👾', '👹', '👺', '👻', '🧞‍♀️', '🤵', '👩‍🦰', '👨‍🏭', '👩‍🏭', '👀', '🦾'
];

function close() {
  emits('update:visible', false);
}

function selectEmoji(emoji) {
  emits('select', emoji);
  close();
}
</script>

<style scoped>
.emoji-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.emoji-picker {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 320px;
  max-height: 400px;
  overflow: hidden;
}

.emoji-picker-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e3eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.close-btn {
  border: none;
  background: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-list {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.emoji-item {
  font-size: 24px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
}

.emoji-item:hover {
  background: #f0f2f5;
}
</style>
