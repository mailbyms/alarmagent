<template>
  <div class="captcha-history-root">
    <div class="header-bar">
      <button class="refresh-btn" @click="fetchShots">刷新</button>
    </div>
    <TopLoadingBar :loading="loading" />
    <div class="table-section">
      <table class="common-table">
        <thead>
          <tr>
            <th>任务ID</th>
            <th>保存时间</th>
            <th>识别内容</th>
            <th>原始内容 (双击修改)</th>
            <th>验证码图片</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="shot in shots" :key="shot.id">
            <td>{{ shot.task_id }}</td>
            <td>{{ formatLocalTime(shot.created_at) }}</td>
            <td>
              <span class="recognized-text">{{ shot.recognized_text }}</span>
            </td>
            <td>
              <span v-if="editId !== shot.id" @dblclick="startEdit(shot)" class="editable-text">{{ shot.raw_text }}</span>
              <input v-else
                v-model="editText"
                @blur="saveEdit(shot)"
                @keyup.enter="saveEdit(shot)"
                @keyup.esc="cancelEdit"
                class="edit-input"
                ref="editInput"
              />
            </td>
            <td>
              <img v-if="shot.image_base64" :src="'data:image/png;base64,' + shot.image_base64" alt="Captcha Image" class="captcha-image" />
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!loading && shots.length === 0" class="no-data-prompt">
        暂无记录
      </div>
      <div class="pagination-bar">
        <button class="page-btn" :disabled="page===1" @click="changePage(page-1)">上一页</button>
        <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="page===totalPages" @click="changePage(page+1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { formatLocalTime } from '../utils/format';
import TopLoadingBar from './TopLoadingBar.vue';

const shots = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

const editId = ref(null);
const editText = ref('');

function startEdit(shot) {
  editId.value = shot.id;
  editText.value = shot.raw_text;
  nextTick(() => {
    // The input might not be rendered yet, so we need to be careful.
    // A simple querySelector might be brittle if multiple rows are edited at once (though our logic prevents this).
    // A ref on the input would be better if we could manage it.
    const input = document.querySelector('.edit-input');
    if (input) input.focus();
  });
}

function cancelEdit() {
  editId.value = null;
  editText.value = '';
}

async function saveEdit(shot) {
  const newText = editText.value.trim();
  if (newText === shot.raw_text) {
    cancelEdit();
    return;
  }

  loading.value = true;
  try {
    const res = await fetch(`/api/captcha/shots/${shot.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: newText })
    });
    if (res.ok) {
      shot.raw_text = newText;
      ElMessage.success('更新成功');
    } else {
      ElMessage.error('更新失败');
    }
  } catch (e) {
    ElMessage.error('网络错误');
  } finally {
    cancelEdit();
    loading.value = false;
  }
}

async function fetchShots() {
  loading.value = true;
  try {
    const res = await fetch(`/api/captcha/shots?page=${page.value}&pageSize=${pageSize}`);
    const data = await res.json();
    shots.value = Array.isArray(data.list) ? data.list : [];
    total.value = data.total || 0;
  } catch (e) {
    shots.value = [];
    total.value = 0;
  }
  loading.value = false;
}

function changePage(p) {
  if (p < 1 || p > totalPages.value) return;
  page.value = p;
  fetchShots();
}

onMounted(fetchShots);
</script>

<style scoped>
/* Copied from AgentList.vue for consistency */
.captcha-history-root {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(36, 37, 38, 0.04);
  padding: 16px;
  margin-top: 32px;
}
.header-bar {
  margin-bottom: 18px;
}
.refresh-btn {
  background: #fff;
  color: #1976d2;
  border: 1px solid #1976d2;
  border-radius: 6px;
  padding: 8px 22px;
  font-size: 15px;
  cursor: pointer;
  /* margin-left: 12px; */ /* Removed to be the only button */
  transition: background 0.2s, color 0.2s;
}
.refresh-btn:hover {
  background: #e3f0fd;
  color: #1565c0;
}
.table-section {
  width: 100%;
  overflow-x: auto;
}
.common-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.common-table th, .common-table td {
  padding: 12px 8px;
  text-align: left;
  vertical-align: middle; /* Added for consistency */
}
.common-table thead {
  background: #e3f0fd; /* Key style from AgentList */
}
.common-table tbody tr {
  border-bottom: 1px solid #e0e3eb;
}
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-top: 32px;
  gap: 16px;
}
.page-btn {
  background: #fff;
  color: #1976d2;
  border: 1px solid #1976d2;
  border-radius: 6px;
  padding: 4px 16px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.page-btn:disabled {
  color: #aaa;
  border-color: #eee;
  cursor: not-allowed;
}
.page-info {
  font-size: 15px;
  color: #333;
}

/* Styles specific to CaptchaHistory */
.recognized-text {
  font-family: monospace;
  font-size: 16px;
  font-weight: bold;
  color: #333;
}
.editable-text {
  cursor: pointer;
  font-family: monospace;
  font-size: 16px;
}
.edit-input {
  font-size: 14px;
  padding: 4px 8px;
  border: 1px solid #1976d2;
  border-radius: 4px;
  outline: none;
  width: 100px;
}
.edit-input:focus {
  border-color: #1565c0;
  background: #e3f0fd;
}
.captcha-image {
  max-height: 40px;
  border-radius: 4px;
  border: 1px solid #eee;
  display: block; /* To avoid extra space under the image */
}
.no-data-prompt {
  text-align: center;
  color: #888;
  padding: 40px;
  font-size: 16px;
}
</style>