<template>
  <div class="dashboard-root">
    <aside class="sidebar">
      <div class="logo">值班监控智能体</div>
      <nav class="menu">
        <div
          class="menu-item"
          :class="{ active: $route.path === '/' }"
          @click="goPage('/')"
        ><el-icon><Grid /></el-icon><span>智能体管理</span></div>
        <div
          class="menu-item"
          :class="{ active: $route.path === '/create-agent' }"
          @click="goPage('/create-agent')"
        ><el-icon><OfficeBuilding /></el-icon><span>创建智能体</span></div>
        <div
          class="menu-item"
          :class="{ active: $route.path === '/workflow' }"
          @click="goPage('/workflow')"
        ><el-icon><SetUp /></el-icon><span>流程编排</span></div>
        <div
          class="menu-item"
          :class="{ active: $route.path === '/task-history' }"
          @click="goPage('/task-history')"
        ><el-icon><List /></el-icon><span>值班历史</span></div>
        <div class="menu-item">审核发布</div>
        <div class="menu-item">设置中心</div>
        <div class="menu-item">日志追踪</div>
      </nav>
    </aside>
    <div class="content-area">
      <header class="header">
        <div class="header-title">
          <template v-if="$route.path === '/'">智能体管理</template>
          <template v-else-if="$route.path === '/create-agent'">创建智能体</template>
          <template v-else-if="$route.path === '/workflow'">流程编排</template>
          <template v-else-if="$route.path === '/task-history'">值班历史</template>
          <template v-else>智能体中心</template>
        </div>
        <div class="header-user">admin</div>
      </header>
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { Grid, SetUp, OfficeBuilding, List } from '@element-plus/icons-vue';
const router = useRouter();
function goPage(path) {
  if (router.currentRoute.value.path !== path) {
    router.push(path);
  }
}
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
  display: flex;
  align-items: center;
  gap: 8px;
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