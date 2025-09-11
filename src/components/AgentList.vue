<template>
  <div class="agent-list-root">
    <div class="header-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
      <div>
        <button class="create-btn" @click="$emit('create-agent')">新建</button>
        <button class="refresh-btn" @click="refreshAgents">刷新</button>
      </div>
    </div>
    <div class="table-section">
      <table class="agent-table">
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
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
const agents = ref([]);
const router = useRouter();
async function refreshAgents() {
  try {
    const res = await fetch('/api/agents');
    agents.value = await res.json();
  } catch (e) {
    agents.value = [];
  }
}
function goWorkflow(uuid) {
  router.push({ path: '/workflow', query: { uuid } });
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
.agent-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.agent-table th, .agent-table td {
  padding: 12px 8px;
  text-align: left;
}
.agent-table thead {
  background: #e3f0fd;
}
.agent-table tbody tr {
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
</style>
