<template>
  <div class="dashboard-root">
    <aside class="sidebar">
      <div class="logo">值班监控智能体</div>
      <nav class="menu">
        <div
          class="menu-item"
          :class="{ active: currentPage === 'agent-list' }"
          @click="currentPage = 'agent-list'"
        >智能体管理</div>
        <div
          class="menu-item"
          :class="{ active: currentPage === 'create-agent' }"
          @click="currentPage = 'create-agent'"
        >创建智能体</div>
        <div
          class="menu-item"
          :class="{ active: currentPage === 'workflow' }"
          @click="currentPage = 'workflow'"
        >流程编排</div>
        <div class="menu-item">审核发布</div>
        <div class="menu-item">设置中心</div>
        <div class="menu-item">日志追踪</div>
      </nav>
    </aside>
    <div class="content-area">
      <header class="header">
        <div class="header-title">
          <template v-if="currentPage === 'agent-list'">智能体管理</template>
          <template v-else-if="currentPage === 'create-agent'">创建智能体</template>
          <template v-else-if="currentPage === 'workflow'">流程编排</template>
          <template v-else>智能体中心</template>
        </div>
        <div class="header-user">admin</div>
      </header>
      <main class="main-content">
  <AgentList v-if="currentPage === 'agent-list'" @create-agent="currentPage = 'create-agent'" />
        <CreateAgent v-else-if="currentPage === 'create-agent'" />
        <Workflow v-else-if="currentPage === 'workflow'" />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import AgentList from './AgentList.vue';
import CreateAgent from './CreateAgent.vue';
import Workflow from './Workflow.vue';
const currentPage = ref('agent-list');
</script>

<style scoped>
.dashboard-root {
  display: flex;
  height: 100vh;
  background: #f5f6fa;
}
/* 以白色为主，焦点色为蓝色 */
.sidebar {
  width: 220px;
  background: #fff;
  color: #222;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 16px;
  border-right: 1px solid #e0e3eb;
}
.logo {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 16px;
  letter-spacing: 2px;
  color: #1976d2;
}
.menu {
  width: 100%;
}
.menu-item {
  padding: 16px 32px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  color: #222;
  border-left: 4px solid transparent;
}
.menu-item.active,
.menu-item:hover {
  background: #e3f0fd;
  color: #1976d2;
  border-left: 4px solid #1976d2;
}
.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.header {
  display: flex;
  align-items: center;
  height: 64px;
  border-bottom: 1px solid #e0e3eb;
  background: #fff;
  padding: 0 0 0 32px;
  /* 让header与sidebar无缝衔接 */
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: none;
  margin: 0;
  z-index: 1;
  position: relative;
}
.header-user {
  font-size: 16px;
  color: #888;
  margin-left: auto;
  padding-right: 32px;
}
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 16px;
}
.header-title {
  font-size: 22px;
  font-weight: 600;
}
.header-user {
  font-size: 16px;
  color: #888;
}
</style>
