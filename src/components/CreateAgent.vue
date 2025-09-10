<template>
  <div class="agent-create-root">
    <div class="header-bar">
      <div class="title">创建智能体</div>
    </div>
    <form class="agent-form">
      <div class="form-group required">
        <label for="agentName">智能体名称</label>
        <input id="agentName" v-model="agentName" type="text" placeholder="请输入智能体名称" required />
      </div>
      <div class="form-group">
        <label for="agentDesc">智能体简介</label>
        <textarea id="agentDesc" v-model="agentDesc" placeholder="可填写智能体简介"></textarea>
      </div>
      <div class="form-group">
        <label>选择图标</label>
        <div class="selected-icon-wrapper" @click="handleIconClick">
          <div class="selected-icon">{{ selectedIcon }}</div>
        </div>
      </div>
      <button class="submit-btn" type="submit">创建</button>
    </form>
    <EmojiPicker :visible="showEmojiPicker" @update:visible="showEmojiPicker = $event" @select="handleEmojiSelect" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import EmojiPicker from './EmojiPicker.vue';
const agentName = ref('');
const agentDesc = ref('');
const selectedIcon = ref('🤖');
const showEmojiPicker = ref(false);
function handleIconClick() {
  showEmojiPicker.value = true;
}
function handleEmojiSelect(emoji) {
  selectedIcon.value = emoji;
  showEmojiPicker.value = false;
}
</script>

<style scoped>
.agent-create-root {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(36, 37, 38, 0.04);
  padding: 24px;
  margin-top: 32px;
  max-width: 520px;
}
.header-bar {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}
.title {
  font-size: 20px;
  font-weight: 600;
  color: #1976d2;
}
.agent-form {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-group.required label:after {
  content: '*';
  color: #f44336;
  margin-left: 4px;
}
input[type="text"], textarea {
  border: 1px solid #e0e3eb;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 15px;
  background: #f8fafc;
  outline: none;
  transition: border 0.2s;
}
input[type="text"]:focus, textarea:focus {
  border: 1.5px solid #1976d2;
  background: #fff;
}
textarea {
  min-height: 60px;
  resize: vertical;
}
.selected-icon-wrapper {
  margin-top: 4px;
}
.selected-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e0e3eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  cursor: pointer;
  transition: border 0.2s, background 0.2s;
}
.selected-icon:hover {
  background: #f0f2f5;
}
.submit-btn {
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 10px 0;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
  transition: background 0.2s;
}
.submit-btn:hover {
  background: #1565c0;
}
</style>
