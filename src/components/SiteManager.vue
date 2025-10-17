<template>
  <div class="site-manager-root">
    <div class="header-bar" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
      <div>
        <button class="create-btn" @click="openCreate">新建</button>
        <button class="refresh-btn" @click="fetchSites">刷新</button>
      </div>
    </div>

    <div class="table-section">
      <table class="common-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>名称</th>
            <th>网站首页 URL</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="site in sites" :key="site.id">
            <td>{{ site.id }}</td>
            <td>{{ site.name }}</td>
            <td title="{{ site.home_url }}">{{ site.home_url }}</td>
            <td>{{ formatLocalTime(site.created_at) }}</td>
            <td>
              <button class="btn" @click="openEdit(site)">编辑</button>
              <button class="btn" style="margin-left:8px;background:#ffa000;" @click="openCompose(site)">登录编排</button>
              <button class="btn delete-btn" style="margin-left:8px;background:#e53935;" @click="confirmDelete(site)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal for create/edit -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="agent-create-root">
        <div class="header-bar">
          <div class="title">{{ editSite.id ? '编辑站点' : '新建站点' }}</div>
        </div>
        <form class="agent-form" @submit.prevent="saveSite">
          <div class="form-group required">
            <label>名称</label>
            <input v-model="editSite.name" type="text" required />
          </div>
          <div class="form-group required">
            <label>站点主页 URL</label>
            <input v-model="editSite.home_url" type="text" required />
          </div>
          <div class="form-group">
            <label>登录信息 (JSON)</label>
            <textarea v-model="loginStepsText" rows="6"></textarea>
          </div>
          <div class="form-actions">
            <button class="submit-btn" type="submit">保存</button>
            <button class="cancel-btn" type="button" @click="closeModal">取消</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Compose (login steps) modal -->
    <div v-if="showCompose" class="modal-overlay" @click.self="closeCompose">
      <div class="agent-create-root">
        <div class="header-bar">
          <div class="title">编辑登录信息 - {{ composeSite.name || '' }}</div>
        </div>
        <form class="agent-form" @submit.prevent="saveCompose">
          <div class="form-group">
            <label>登录网址</label>
            <input v-model="composeData.url" type="text" />
          </div>
          <div class="form-group">
            <label>用户名选择器</label>
            <input v-model="composeData.usernameSelector" type="text" />
          </div>
          <div class="form-group">
            <label>用户名</label>
            <input v-model="composeData.username" type="text" />
          </div>
          <div class="form-group">
            <label>密码选择器</label>
            <input v-model="composeData.passwordSelector" type="text" />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input v-model="composeData.password" type="password" />
          </div>
          <div class="form-group" style="display: flex; flex-direction: row; align-items: center;">
            <label style="margin-bottom: 0;">启用验证码识别</label>
            <input type="checkbox" v-model="composeData.useCaptcha" style="width: auto; margin-left: 8px;" />
          </div>
          <div v-if="composeData.useCaptcha" class="form-group">
            <label>验证码图片选择器</label>
            <input v-model="composeData.captchaImageSelector" type="text" />
          </div>
          <div v-if="composeData.useCaptcha" class="form-group">
            <label>验证码输入框选择器</label>
            <input v-model="composeData.captchaInputSelector" type="text" />
          </div>
          <div class="form-actions">
            <button class="submit-btn" type="submit">保存</button>
            <button class="cancel-btn" type="button" @click="closeCompose">取消</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import { formatLocalTime } from '../utils/format';

const sites = ref([]);
const loading = ref(false);
const showModal = ref(false);
const editSite = ref({});
const loginStepsText = ref('');
const showCompose = ref(false);
const composeSite = ref({});
const composeData = ref({
  url: '',
  usernameSelector: '',
  username: '',
  passwordSelector: '',
  password: '',
  useCaptcha: false,
  captchaImageSelector: '',
  captchaInputSelector: ''
});

function openCreate() {
  editSite.value = {};
  loginStepsText.value = '';
  showModal.value = true;
}

function openEdit(site) {
  editSite.value = { ...site };
  loginStepsText.value = site.login_steps ? JSON.stringify(site.login_steps, null, 2) : '';
  showModal.value = true;
}

function openCompose(site) {
  composeSite.value = { ...site };
  const ls = site.login_steps || {};
  composeData.value = {
    url: ls.url || '',
    usernameSelector: ls.usernameSelector || '',
    username: ls.username || '',
    passwordSelector: ls.passwordSelector || '',
    password: ls.password || '',
    useCaptcha: !!ls.useCaptcha,
    captchaImageSelector: ls.captchaImageSelector || '',
    captchaInputSelector: ls.captchaInputSelector || ''
  };
  showCompose.value = true;
}

function closeCompose() {
  showCompose.value = false;
  composeSite.value = {};
}

async function saveCompose() {
  // write composeData into composeSite.login_steps and call save
  const ls = { ...composeData.value };
  // ensure boolean
  ls.useCaptcha = !!ls.useCaptcha;
  // reuse save logic: set editSite to composeSite and call saveSite
  editSite.value = { ...composeSite.value, login_steps: ls };
  loginStepsText.value = JSON.stringify(ls, null, 2);
  // call saveSite to persist
  await saveSite();
  closeCompose();
}

function closeModal() {
  showModal.value = false;
}

async function fetchSites() {
  loading.value = true;
  try {
    const res = await fetch('/api/sites');
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    sites.value = Array.isArray(data) ? data : [];
  } catch (e) {
    sites.value = [];
    ElMessage.error('获取站点列表失败');
  } finally {
    loading.value = false;
  }
}

async function saveSite() {
  const name = (editSite.value.name || '').trim();
  const home_url = (editSite.value.home_url || '').trim();
  if (!name || !home_url) {
    ElMessage.error('名称与 HOME URL 必须填写');
    return;
  }
  let login_steps = null;
  if (loginStepsText.value && loginStepsText.value.trim()) {
    try {
      login_steps = JSON.parse(loginStepsText.value);
    } catch (e) {
      ElMessage.error('login_steps JSON 格式错误');
      return;
    }
  }

  try {
    const payload = { name, home_url, login_steps };
    let res;
    if (editSite.value.id) {
      res = await fetch(`/api/sites/${editSite.value.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    if (res.ok) {
      ElMessage.success('保存成功');
      closeModal();
      fetchSites();
    } else {
      ElMessage.error('保存失败');
    }
  } catch (e) {
    ElMessage.error('网络错误');
  }
}

async function confirmDelete(site) {
  try {
    await ElMessageBox.confirm(`确认删除站点 ${site.name}？`, '删除确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' });
    const res = await fetch(`/api/sites/${site.id}`, { method: 'DELETE' });
    if (res.ok) {
      ElMessage.success('删除成功');
      fetchSites();
    } else {
      ElMessage.error('删除失败');
    }
  } catch (e) {
    // 用户取消或出错
  }
}

onMounted(fetchSites);
</script>

<style scoped>
.site-manager-root { background:#fff;border-radius:12px;padding:16px;margin-top:32px; }
.common-table { width:100%; border-collapse:collapse; font-size:14px }
.common-table th, .common-table td { padding:12px 8px; text-align:left }
.common-table thead { background:#e3f0fd }
.btn { background:#1976d2;color:#fff;border:none;border-radius:6px;padding:6px 18px;cursor:pointer }
.create-btn { background:#1976d2;color:#fff;border:none;border-radius:6px;padding:8px 22px }
.refresh-btn { background:#fff;color:#1976d2;border:1px solid #1976d2;border-radius:6px;padding:8px 22px;margin-left:12px }
.delete-btn { background:#e53935;color:#fff;border:none;border-radius:6px;padding:6px 18px }

/* Modal styles */
.modal-overlay {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.agent-create-root {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(36, 37, 38, 0.04);
  padding: 24px;
  width: 720px;
  max-width: 95%;
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
.form-group label {
  font-weight: 600;
}
input[type="text"], input[type="password"], textarea {
  border: 1px solid #e0e3eb;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 15px;
  background: #f8fafc;
  outline: none;
  transition: border 0.2s;
  width: 100%;
  box-sizing: border-box;
}
input[type="text"]:focus, input[type="password"]:focus, textarea:focus {
  border: 1.5px solid #1976d2;
  background: #fff;
}
textarea {
  min-height: 80px;
  resize: vertical;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}
.submit-btn, .cancel-btn {
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.submit-btn {
  background: #1976d2;
  color: #fff;
}
.submit-btn:hover {
  background: #1565c0;
}
.cancel-btn {
  background: #f0f2f5;
  color: #333;
}
.cancel-btn:hover {
  background: #e0e3eb;
}
</style>
