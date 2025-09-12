<template>
  <div class="task-history-root">
    <div class="header-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
      <button class="refresh-btn" @click="fetchTasks">刷新</button>
    </div>
    <div class="table-section">
      <table class="common-table task-table">
        <thead>
          <tr>
            <th>任务ID</th>
            <th>智能体UUID</th>
            <th>启动时间</th>
            <th>完成时间</th>
            <th>状态</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in tasks" :key="task.id">
            <td>
              <span class="task-id-link" @click="showShots(task.id)">{{ task.id }}</span>
            </td>
            <td>{{ task.agent_uuid }}</td>
            <td>{{ formatLocalTime(task.start_time) }}</td>
            <td>{{ formatLocalTime(task.end_time) }}</td>
            <td>
              <span :class="['status', task.status]">
                {{ task.status === 'success' ? '成功' : (task.status === 'failed' ? '失败' : (task.status === 'running' ? '进行中' : task.status)) }}
              </span>
            </td>
            <td class="result-cell">
              <span class="result-text" :title="task.result">{{ task.result }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="pagination-bar">
        <button class="page-btn" :disabled="page===1" @click="changePage(page-1)">上一页</button>
        <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="page===totalPages" @click="changePage(page+1)">下一页</button>
      </div>
      <!-- 弹窗组件始终挂载，只用 visible 控制显示 -->
      <TaskShotsDialog :taskId="currentTaskId" v-model:visible="showShotsDialog" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { formatLocalTime } from '../utils/format';
import TaskShotsDialog from './TaskShotsDialog.vue';
const tasks = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

const showShotsDialog = ref(false);
const currentTaskId = ref(null);
function showShots(taskId) {
  currentTaskId.value = taskId;
  showShotsDialog.value = true;
}

async function fetchTasks() {
  loading.value = true;
  try {
    const res = await fetch(`/api/crawler/tasks?page=${page.value}&pageSize=${pageSize}`);
    const data = await res.json();
    tasks.value = Array.isArray(data.list) ? data.list : [];
    total.value = data.total || 0;
  } catch (e) {
    tasks.value = [];
    total.value = 0;
  }
  loading.value = false;
}

function changePage(p) {
  if (p < 1 || p > totalPages.value) return;
  page.value = p;
  fetchTasks();
}

onMounted(fetchTasks);
</script>

<style scoped>
/* 以白色为主，焦点色为蓝色，风格与智能体管理一致 */
.task-history-root {
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
  margin-left: 12px;
  transition: background 0.2s;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
}
.refresh-btn:hover {
  background: #e3f0fd;
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
}
.result-cell {
  max-width: 320px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  position: relative;
}
.result-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  vertical-align: middle;
  cursor: pointer;
}
.task-id-link {
  color: #1976d2;
  cursor: pointer;
  text-decoration: underline;
  font-weight: bold;
}
.common-table thead {
  background: #e3f0fd;
}
.common-table tbody tr {
  border-bottom: 1px solid #e0e3eb;
}
.status {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}
.status.success {
  background: #e8f5e9;
  color: #43a047;
}
.status.failed {
  background: #ffebee;
  color: #f44336;
}
.status.running {
  background: #e3f2fd;
  color: #1976d2;
}
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-top: 32px;
  gap: 16px;
}
</style>
