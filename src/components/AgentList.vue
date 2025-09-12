
<template>
  <div class="agent-list-root">
    <div class="header-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
      <div>
  <button class="create-btn" @click="goCreateAgent">新建</button>
        <button class="refresh-btn" @click="refreshAgents">刷新</button>
      </div>
    </div>
  <TopLoadingBar :loading="loading" />
    <div class="table-section">
      <table class="common-table agent-table">
        <thead>
          <tr>
            <th>图标</th>
            <th>智能体名称</th>
            <th>运行状态</th>
            <th>创建时间</th>
            <th>更新时间</th>
            <th>截图数量</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="agent in agents" :key="agent.uuid">
            <td>{{ agent.icon }}</td>
            <td>
              <span :title="agent.description || '没有简介'">{{ agent.name }}</span>
            </td>
            <td>
              <span :class="['status', agent.status]">
                {{ agent.status === 'running' ? '运行中' : '已停止' }}
              </span>
            </td>
            <td>{{ agent.created_at }}</td>
            <td>{{ agent.updated_at }}</td>
            <td>{{ agent.screenshot_count }}</td>
              <td>
                <span style="display:none">{{ agent.uuid }}</span>
                <button class="btn" @click="goWorkflow(agent.uuid)">编排</button>
                <button
                  class="btn"
                  v-if="agent.status === 'running'"
                  style="margin-left: 8px; background: #f44336;"
                >停止</button>
                <button
                  class="btn"
                  v-else
                  style="margin-left: 8px; background: #43a047;"
                >启动</button>
              </td>
          </tr>
        </tbody>
      </table>
      <div class="pagination-bar">
        <button class="page-btn" :disabled="page===1" @click="changePage(page-1)">上一页</button>
        <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
        <button class="page-btn" :disabled="page===totalPages" @click="changePage(page+1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
const page = ref(1);
const pageSize = 10;
const total = ref(0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
import { useRouter } from 'vue-router';
import TopLoadingBar from './TopLoadingBar.vue';
const agents = ref([]);
const loading = ref(false);
const router = useRouter();
async function refreshAgents() {
  loading.value = true;
  try {
    const res = await fetch(`/api/agents?page=${page.value}&pageSize=${pageSize}`);
    const data = await res.json();
    agents.value = Array.isArray(data.list) ? data.list : [];
    total.value = data.total || 0;
  } catch (e) {
    agents.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}
function changePage(p) {
  if (p < 1 || p > totalPages.value) return;
  page.value = p;
  refreshAgents();
}
function goWorkflow(uuid) {
  router.push({ path: '/workflow', query: { uuid } });
}
function goCreateAgent() {
  router.push({ path: '/create-agent' });
}
onMounted(refreshAgents);
</script>


<style scoped>
/* 以白色为主，焦点色为蓝色 */
.agent-list-root {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(36, 37, 38, 0.04);
  padding: 16px;
  margin-top: 32px;
}
.header-bar {
  margin-bottom: 18px;
}
.create-btn {
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 22px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
}
.create-btn:hover {
  background: #1565c0;
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
  transition: background 0.2s, color 0.2s;
}
.refresh-btn:hover {
  background: #e3f0fd;
  color: #1565c0;
}
/* 通用表格样式 */
.common-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.common-table th, .common-table td {
  padding: 12px 8px;
  text-align: left;
}
.common-table thead {
  background: #e3f0fd;
}
.common-table tbody tr {
  border-bottom: 1px solid #e0e3eb;
}
.status.running {
  color: #1976d2;
  font-weight: bold;
}
.status.stopped {
  color: #f44336;
  font-weight: bold;
}
.btn {
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 18px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}
.btn:hover {
  background: #1565c0;
}
/* 分页栏通用样式 */
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
</style>
