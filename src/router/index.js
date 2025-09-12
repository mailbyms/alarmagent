import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from '../components/Dashboard.vue';
import AgentList from '../components/AgentList.vue';
import CreateAgent from '../components/CreateAgent.vue';
import Workflow from '../components/Workflow.vue';
import TaskHistory from '../components/TaskHistory.vue';

const routes = [
  {
    path: '/',
    component: Dashboard,
    children: [
      { path: '', component: AgentList },
      { path: 'create-agent', component: CreateAgent },
      { path: 'workflow', component: Workflow },
      { path: 'task-history', component: TaskHistory }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
