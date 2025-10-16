// 编排流程组件来自 simple-flow-web https://github.com/501351981/simple-flow-web
<template>
  <TopLoadingBar :loading="loading" />
  <div class="workflow-root">
    <div class="header-bar">
      <button @click="importWorkflow">导入</button>
      <button @click="exportWorkflow">导出</button>
      <button @click="testWorkflow" style="margin-left:8px;background:#1976d2;color:#fff;">测试</button>

      <!-- This new wrapper will be pushed to the far right -->
      <div style="margin-left: auto; display: flex; align-items: center;">
        <div v-if="uuid && agentName" class="agent-title-wrapper">
          <span class="agent-title-label">智能体:</span>
          <h2 class="agent-title">{{ agentName }}</h2>
        </div>

        <button @click="saveWorkflow" :disabled="!uuid" :class="{disabled:!uuid}" style="background:#43a047;border-color:#43a047;">更新到智能体</button>
      </div>
    </div>
    <div v-if="!uuid" style="color:#f44336;font-weight:bold;margin-bottom:12px;">当前为自由体验模式，不支持更新到智能体</div>
    <div class="workflow-canvas-wrapper" ref="canvasContainer" @contextmenu.prevent="handleContextMenu" @click="handleClick">
  <div v-if="showDrawer" class="property-drawer" :style="drawerFocusColorStyle">
      <div class="drawer-header" style="flex-direction:column;align-items:flex-start;gap:0;">
        <div style="width:100%;display:flex;justify-content:space-between;align-items:center;">
          <span :style="{color: drawerColor}">属性编辑</span>
          <span class="drawer-close" @click="showDrawer=false">×</span>
        </div>
        <span v-if="showDrawer && drawerNode" style="font-size:12px;color:#888;margin-top:2px;user-select:text;">ID: {{ drawerNode.id || (drawerNode.getId && drawerNode.getId()) }}</span>
      </div>
      <div style="margin-bottom: 10px;">
        <label :style="{color: drawerColor, fontSize: '14px'}"><span v-if="isFieldRequired('displayName')" style="color: #f56c6c;">* </span>节点名称：</label>
        <input v-model="drawerData.displayName" type="text" style="{color: drawerColor}" :class="{ 'invalid': !drawerValidation.displayName }" />
      </div>

      <template v-if="nodeFieldMeta[drawerNodeType]">
        <div v-for="field in nodeFieldMeta[drawerNodeType]" :key="field.key">
          <div v-if="!field.condition || field.condition(drawerData)">
              <div :style="{ display: field.type === 'checkbox' ? 'flex' : 'block', alignItems: 'center', marginTop: field.type === 'checkbox' ? '8px' : '0', marginBottom: field.type === 'checkbox' ? '6px' : '0' }">
                <label :style="{color: drawerColor, flexShrink: 0, marginRight: '8px', marginTop: 0}">
                  <span v-if="isFieldRequired(field.key)" style="color: #f56c6c;">* </span>
                  {{ field.label }}：
                </label>
                
                <input v-if="!field.type || field.type === 'text' || field.type === 'number'" 
                       :type="field.type || 'text'"
                       v-model="drawerData[field.key]" 
                       :placeholder="field.placeholder || ''"
                       :class="{ 'invalid': !drawerValidation[field.key] }" />

                <input v-if="field.type === 'checkbox'"
                       type="checkbox"
                       v-model="drawerData[field.key]"
                       style="margin:0;" />

                <select v-if="field.type === 'select'"
                        v-model="drawerData[field.key]"
                        :class="{ 'invalid': !drawerValidation[field.key] }">
                  <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.text }}</option>
                </select>
              </div>
          </div>
        </div>
      </template>
  <button class="drawer-save" @click="saveDrawer" :style="{background: drawerColor, borderColor: drawerColor}">保存属性</button>
    </div>

  </div>
  <div v-show="showNodeTypeMenu" class="node-type-menu" :style="nodeTypeMenuStyle">
      <div class="menu-title">添加</div>
      <div v-for="nodeType in menuNodeTypes" :key="nodeType.type" class="menu-item" @click="addNode(nodeType.type)">{{ nodeType.displayName }}</div>
      <div v-if="canDeleteNode">
        <div class="menu-separator"></div>
        <div class="menu-title">删除</div>
        <div class="menu-item" @click="deleteNode">删除</div>
      </div>
    </div>
    <div v-show="showWireMenu" class="node-type-menu" :style="wireMenuPosition">
      <div class="menu-item" @click="deleteWire">删除连线</div>
    </div>
  </div>

  <!-- 测试进度弹窗 -->
  <el-dialog v-model="showTestDialog" title="流程测试进度" width="500px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="testStatus!=='pending'">
    <template #title>
      <span>流程测试进度</span>
      <el-icon v-if="testStatus==='pending'" :size="18" class="is-loading" style="margin-left:8px;vertical-align:middle;"><Loading /></el-icon>
      <span v-if="testStatus==='success'" style="color:#43a047;font-size:14px;margin-left:8px;vertical-align:middle;">[已完成]</span>
    </template>
    <div style="max-height:350px;overflow:auto;" ref="testTimelineBox">
      <el-timeline>
        <el-timeline-item
          v-for="(step, idx) in testProgress"
          :key="idx"
          :type="step.status && step.status.startsWith('error') ? 'danger' : (step.status && step.status.includes('done') ? 'success' : 'info')"
          :color="step.status && step.status.startsWith('error') ? '#f56c6c' : (step.status && step.status.includes('done') ? '#67c23a' : '#409eff')"
          
        >
          <div style="white-space:pre-line;">{{ step.displayName || step.type }}<br><span style="font-size:12px;color:#888;">[{{ step._localTime }}] {{ step.status }}</span></div>
        </el-timeline-item>
      </el-timeline>
    </div>
    <div v-if="testStatus==='success'" style="color:#43a047;text-align:center;margin-top:10px;">测试完成</div>
    <div v-if="testStatus==='error'" style="color:#f56c6c;text-align:center;margin-top:10px;">{{ testError }}</div>
    <template #footer>
      <el-button v-if="testStatus!=='pending'" @click="showTestDialog=false">关闭</el-button>
    </template>
  </el-dialog>
</template>


<script setup>
import { ref, onMounted, reactive, computed, nextTick, watch } from 'vue';
// 测试进度弹窗相关响应式变量
const showTestDialog = ref(false);
const testProgress = ref([]);
const testStatus = ref('pending'); // pending/success/error
const testError = ref('');
const testTimelineBox = ref(null);
watch(testProgress, async () => {
  await nextTick();
  if (testTimelineBox.value) {
    testTimelineBox.value.scrollTop = testTimelineBox.value.scrollHeight;
  }
});
import { ElMessage, ElDialog, ElTimeline, ElTimelineItem } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';

const DEFAULT_DRAWER_COLOR = '#1976d2';

// 可用于节点类型的主色数组
const NODE_COLORS = [
  '#2feb77ff',
  '#ffbd67ff',
  '#479ef6ff',
  '#875bf7',
  '#ff8feaff',  
  '#ffd600',  
  '#ca7301ff',  
  '#15a892ff',  
];
import TopLoadingBar from './TopLoadingBar.vue';
import { useRoute } from 'vue-router';
import SF from 'simple-flow-web';
import 'simple-flow-web/lib/sf.css';

import beginIcon from '../assets/icons/node/begin.svg';
import loginIcon from '../assets/icons/node/login.svg';
import whiteGlobeIcon from '../assets/icons/node/white-globe.svg';
import keyboardIcon from '../assets/icons/node/keyboard.svg';
import mouseIcon from '../assets/icons/node/mouse.svg';
import snapshotIcon from '../assets/icons/node/snapshot.svg';
import timerIcon from '../assets/icons/node/timer.svg';
import finishIcon from '../assets/icons/node/finish.svg';
const route = useRoute();
const uuid = route.query.uuid;
const agentName = ref('');

const loading = ref(false);

// 属性编辑抽屉相关
const showDrawer = ref(false);
const drawerData = reactive({});
// drawerValidation 这个对象的设计目标就是包含所有不同节点类型的抽屉中，可能出现的所有输入字段的键名。
// 可以把它看作是所有字段校验状态的一个“全集”或“总表”。 这样无论当前编辑的节点类型是什么，drawerValidation 都已经预定义好了所有可能的字段校验状态，避免了动态添加属性带来的响应式问题。  
// 也意味着如果将来添加了新的节点类型或字段，需要手动在这里添加对应的键名。
const drawerValidation = reactive({
  url: true,
  usernameSelector: true,
  username: true,
  passwordSelector: true,
  password: true,
  captchaImageSelector: true,
  captchaInputSelector: true,
  waitSelector: true,
  selector: true,
  text: true,
  delay: true,
  waitFor: true,
  reason: true,
  path: true,
  displayName: true
});
const drawerNodeType = ref('');
let drawerNode = null;

const drawerFocusColorStyle = reactive({});
const drawerColor = ref(DEFAULT_DRAWER_COLOR);
function openDrawer(node) {
  console.log('[Workflow] openDrawer called', node);
  if (!node) {
    console.warn('[Workflow] openDrawer: node is null');
    return;
  }
  // 清空属性，防止残留
  for (const k in drawerData) delete drawerData[k];
  const type = node.getType();
  drawerNodeType.value = type;

  // Get the default values for this node type
  const nodeTypeDefinition = nodeTypes.value.find(nt => nt.type === type);
  const defaults = nodeTypeDefinition ? nodeTypeDefinition.options.defaults : {};
  
  // Get the node's saved attributes
  const savedAttrs = node.getAttrObject() || {};

  // Merge them: saved values override defaults
  Object.assign(drawerData, defaults, savedAttrs);

  drawerData.displayName = node.getDisplayName ? node.getDisplayName() : (node.displayName || '');
  drawerNode = node;

  // Reset validation state
  for (const key in drawerValidation) {
    drawerValidation[key] = true;
  }

  // 只取 rect.sf-flow-node-main-rect 的 fill 颜色
  let color = '';
  if (node._view && typeof node._view.querySelector === 'function') {
    const rect = node._view.querySelector('rect.sf-flow-node-main-rect');
    if (rect && rect.getAttribute) {
      color = rect.getAttribute('fill') || '';
    }
  }
  console.log('[Workflow] Node info:', node, 'rect.fill:', color);
  drawerFocusColorStyle['--drawer-focus-color'] = color || DEFAULT_DRAWER_COLOR;
  drawerColor.value = color || DEFAULT_DRAWER_COLOR;
  showDrawer.value = true;
  console.log('[Workflow] Drawer opened for node type:', drawerNodeType.value, 'data:', drawerData);
}

// Define field metadata for each node type
const nodeFieldMeta = {
  loginweb: [
    { key: 'url', label: '登录网址', required: true, type: 'text', placeholder: 'https://' },
    { key: 'usernameSelector', label: '用户名选择器', required: true, type: 'text', placeholder: '#username' },
    { key: 'username', label: '用户名', required: true, type: 'text', placeholder: 'admin' },
    { key: 'passwordSelector', label: '密码选择器', required: true, type: 'text', placeholder: '#password' },
    { key: 'password', label: '密码', required: true, type: 'text', placeholder: '******' },
    { key: 'useCaptcha', label: '启用验证码识别', required: false, type: 'checkbox' },
    { key: 'captchaImageSelector', label: '验证码显示区域选择器', required: true, type: 'text', condition: data => data.useCaptcha, placeholder: '.img.wrapper-code' },
    { key: 'captchaInputSelector', label: '验证码输入框选择器', required: true, type: 'text', condition: data => data.useCaptcha, placeholder: '#captcha' },
  ],
  openwebpage: [
    { key: 'url', label: '目标网址', required: true, type: 'text', placeholder: 'https://' },
    { key: 'waitSelector', label: '等待元素选择器', required: false, type: 'text', placeholder: '如 #main' },
  ],
  input: [
    { key: 'selector', label: '目标元素选择器', required: true, type: 'text', placeholder: '#input' },
    { key: 'text', label: '输入内容', required: true, type: 'text' },
    { key: 'delay', label: '每字符延迟(ms)', required: true, type: 'number' },
  ],
  click: [
    { key: 'selector', label: '目标元素选择器', required: true, type: 'text', placeholder: '#btn' },
    { key: 'clickType', label: '点击类型', required: true, type: 'select', options: [{value: 'left', text: '单击'}, {value: 'right', text: '右键'}, {value: 'double', text: '双击'}] },
    { key: 'waitFor', label: '点击前等待元素', required: false, type: 'text', placeholder: '#ready' },
  ],
  delay: [
    { key: 'delay', label: '等待时长(ms)', required: true, type: 'number' },
    { key: 'reason', label: '说明', required: false, type: 'text' },
  ],
  screenshot: []
};

function isFieldRequired(fieldKey) {
  if (fieldKey === 'displayName') return true;

  const type = drawerNodeType.value;
  if (nodeFieldMeta[type]) {
    const meta = nodeFieldMeta[type].find(f => f.key === fieldKey);
    if (meta && meta.required) {
      if (meta.condition) {
        return meta.condition(drawerData);
      }
      return true;
    }
  }
  return false;
}

function saveDrawer() {
  if (drawerNode) {
    // Reset validation state
    for (const key in drawerValidation) {
      drawerValidation[key] = true;
    }

    let isValid = true;
    const type = drawerNodeType.value;
    const data = drawerData;

    const fieldsToValidate = Object.keys(drawerValidation);
    for(const field of fieldsToValidate) {
        if (isFieldRequired(field)) {
            if (field === 'delay' && data[field] === 0) {
                continue;
            }
            if (!data[field]) {
                drawerValidation[field] = false;
                isValid = false;
            }
        }
    }

    if (!isValid) {
      ElMessage.error('请填写所有必填项');
      return;
    }

    // Save displayName
    if (data.displayName && drawerNode.setDisplayName) {
      drawerNode.setDisplayName(data.displayName);
    }
    // Save custom properties
    const { displayName, ...rest } = data;
    drawerNode.a({ ...rest });
    // showDrawer.value = false; // Per user request, do not close drawer on save
    ElMessage.success('属性已保存');
  }
}

async function saveWorkflow() {
  if (!uuid) {
  ElMessage.error('无效uuid，无法保存');
  return;
  }
  if (!dataModel) {
  ElMessage.error('流程未初始化');
  return;
  }
  loading.value = true;
  try {
    const workflow = dataModel.serialize();
    const res = await fetch(`/api/agents/${uuid}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow })
    });
    if (res.ok) {
      ElMessage.success('保存成功');
    } else {
      ElMessage.error('保存失败');
    }
  } catch (e) {
  ElMessage.error('保存异常');
  } finally {
    loading.value = false;
  }
}
const canvasContainer = ref(null);
let dataModel = null;
let graphView = null;

const showNodeTypeMenu = ref(false);
const nodeTypeMenuStyle = reactive({ top: '0px', left: '0px' });
const contextNode = ref(null);

const showWireMenu = ref(false);
const wireMenuPosition = reactive({ top: '0px', left: '0px' });
const contextWire = ref(null);

const canDeleteNode = computed(() => {
  if (!contextNode.value) return false;
  // simple-flow-web 节点类型有可能在 contextNode.value.type 或 contextNode.value._type
  const type = contextNode.value.type || contextNode.value._type;
  if (!type) return false;
  return String(type).toLowerCase() !== 'begin';
});

function handleContextMenu(event) {
  const nodeElement = event.target.closest('g.sf-flow-node');
  if (nodeElement) {
    showWireMenu.value = false;
    const nodeId = nodeElement.id;
    contextNode.value = dataModel.getDataById(nodeId);
    if (contextNode.value) {
      nodeTypeMenuStyle.left = `${event.clientX}px`;
      nodeTypeMenuStyle.top = `${event.clientY}px`;
      showNodeTypeMenu.value = true;
    }
    return;
  }

  const wireElement = event.target.closest('.sf-flow-link-path');
  if (wireElement) {
    showNodeTypeMenu.value = false;
    contextWire.value = wireElement.__node__;
    if (contextWire.value) {
      wireMenuPosition.left = `${event.clientX}px`;
      wireMenuPosition.top = `${event.clientY}px`;
      showWireMenu.value = true;
    }
    return;
  }

  showNodeTypeMenu.value = false;
  showWireMenu.value = false;
  contextNode.value = null;
  contextWire.value = null;
}

function handleClick() {
  showNodeTypeMenu.value = false;
  showWireMenu.value = false;
}

function addNode(type) {
  if (contextNode.value) {
    const sourceNode = contextNode.value;
    const position = sourceNode.getPosition();
    const nodeType = nodeTypes.value.find(nt => nt.type === type);
    const newNode = new SF.Node({
      type: type
    });
    newNode.setPosition(position.x + 200, position.y);
    newNode.setDisplayName(nodeType ? nodeType.displayName : type);
    dataModel.add(newNode);

    const wire = new SF.Wires({
      source: sourceNode,
      target: newNode
    });
    dataModel.add(wire);
  }
  showNodeTypeMenu.value = false;
  contextNode.value = null;
}

function deleteNode() {
  graphView.sm().clearSelection();
  console.log('deleteNode contextNode:', contextNode.value);
  if (!dataModel || !contextNode.value) {
    showNodeTypeMenu.value = false;
    contextNode.value = null;
    return;
  }
  const node = contextNode.value;
  // 获取所有元素（节点和连线）
  const allItems = typeof dataModel.getAll === 'function' ? dataModel.getAll() : [];
  // 找到所有与该节点相关的连线
  const wiresToRemove = allItems.filter(d => d && d.constructor && d.constructor.name === 'Wires' && (d.source === node || d.target === node));
  // 必须逐个删除，不能传数组
  wiresToRemove.forEach(wire => dataModel.remove(wire));
  // 删除节点本身
  dataModel.remove(node);
  showNodeTypeMenu.value = false;
  contextNode.value = null;
}

function deleteWire() {
  if (contextWire.value) {
    dataModel.remove(contextWire.value);
  }
  showWireMenu.value = false;
  contextWire.value = null;
}

function downloadJSON(data, filename) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importWorkflow() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';

  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = readerEvent => {
      const content = readerEvent.target.result;
      try {
        const json = JSON.parse(content);
        if (dataModel && graphView) {
          // Clear selection to prevent errors on removal
          graphView.sm().clearSelection();

          // Clear all existing nodes and wires
          const allNodes = [];
          dataModel.eachNode(node => allNodes.push(node));
          if (allNodes.length > 0) {
            dataModel.remove(allNodes);
          }

          // Deserialize the new workflow
          dataModel.deserialize(json);
        }
      } catch (error) {
        console.error('Error parsing or loading workflow:', error);
        alert('Failed to load workflow. Make sure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  input.click();
}

function exportWorkflow() {
  if (dataModel) {
    const jsonData = dataModel.serialize();
    downloadJSON(jsonData, 'workflow.json');
  }
}

// 测试流程，调用后端爬虫接口
async function testWorkflow() {
  if (!dataModel) {
    ElMessage.error('流程未初始化');
    return;
  }
  let workflow = dataModel.serialize();
  if (typeof workflow === 'string') {
    try {
      workflow = JSON.parse(workflow);
    } catch (e) {
      ElMessage.error('序列化数据格式错误');
      return;
    }
  }
  let testUuid = uuid;
  if (!testUuid) {
    testUuid = 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF';
  }
  showTestDialog.value = true;
  testProgress.value = [];
  testStatus.value = 'pending';
  testError.value = '';

  try {
    const response = await fetch('/api/workflow/crawler/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: testUuid, workflow })
    });

    if (!response.ok) {
      throw new Error(`服务器错误: ${response.status} ${response.statusText}`);
    }
    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (testStatus.value === 'pending') {
          testStatus.value = 'success';
        }
        break;
      }

      buffer += value;
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const message = buffer.substring(0, boundary).trim();
        buffer = buffer.substring(boundary + 2);

        if (message.startsWith('data:')) {
          try {
            const json = JSON.parse(message.slice(5).trim());
            if (json.done) {
              testStatus.value = 'success';
            } else if (json.error) {
              testStatus.value = 'error';
              testError.value = json.error;
            } else {
              testProgress.value.push({
                ...json,
                _localTime: new Date().toLocaleTimeString()
              });
            }
          } catch (e) {
            console.error('SSE JSON parsing error:', e, 'chunk:', message);
          }
        }
      }
    }
  } catch (e) {
    testStatus.value = 'error';
    testError.value = '测试异常: ' + e.message;
  }
}

const nodeTypes = ref([  
  {
    type: 'begin',
    displayName: '开始',
    options: {
      class: 'node-inject',
      align:'left',
      category: 'common',
      bgColor: NODE_COLORS[0],
      color:'#fff',
      defaults:{},
      icon: beginIcon,
      inputs:0,
      outputs:1,
      width:150,
      height: 40
    }
  },
  {
    type: 'loginweb',
    displayName: '登录网站',
    options: {
      align:'left',
      category: 'automation',
      bgColor: NODE_COLORS[7],
      color:'#fff',
            defaults:{
        url: '', // 登录网址
        usernameSelector: '', // 用户名输入框选择器
        username: '', // 用户名
        passwordSelector: '', // 密码输入框选择器
        password: '', // 密码
        useCaptcha: false, // 是否启用验证码识别
        captchaImageSelector: '.img.wrapper-code', // 验证码图片选择器
        captchaInputSelector: '#captcha' // 验证码输入框选择器
      },
      icon: loginIcon,
      inputs:1,
      outputs:1,
      width:150,
      height: 40
    }
  },
  {
    type: 'openwebpage',
    displayName: '打开网页',
    options: {
      align:'left',
      category: 'automation',
      bgColor: NODE_COLORS[1],
      color:'#fff',
      defaults:{
        url: 'https://', // 目标网址
        waitSelector: '' // 页面加载后等待的元素选择器
      },
      icon: whiteGlobeIcon,
      inputs:1,
      outputs:1,
      width:150,
      height: 40
    }
  },
  {
    type: 'input',
    displayName: '模拟输入',
    options: {
      align:'left',
      category: 'automation',
      bgColor: NODE_COLORS[2],
      color:'#fff',
      defaults:{
        selector: '', // 输入目标元素选择器
        text: '',     // 输入内容
        inputType: 'text', // 输入类型（text/password/number等）
      },
      icon: keyboardIcon,
      inputs:1,
      outputs:1,
      width:150,
      height: 40
    }
  },
  {
    type: 'click',
    displayName: '模拟点击',
    options: {
      align:'left',
      category: 'automation',
      bgColor: NODE_COLORS[3],
      color:'#fff',
      defaults:{
        selector: '', // 点击目标元素选择器
        clickType: 'left', // 点击类型（left/right/double），默认单击
        waitFor: '' // 点击前等待的元素选择器
      },
      icon: mouseIcon,
      inputs:1,
      outputs:1,
      width:150,
      height: 40
    }
  },
  {
    type: 'screenshot',
    displayName: '截图保存',
    options: {
      align:'left',
      category: 'automation',
      bgColor: NODE_COLORS[4],
      color:'#fff',
      defaults:{},
      icon: snapshotIcon,
      inputs:1,
      outputs:1,
      width:150,
      height: 40
    }
  },
  {
    type: 'delay',
    displayName: '定时等候',
    options: {
      align:'left',
      category: 'automation',
      bgColor: NODE_COLORS[5],
      color:'#fff',
      defaults:{
        delay: 1000, // 等待时长（ms）
        reason: '' // 说明
      },
      icon: timerIcon,
      inputs:1,
      outputs:1,
      width:150,
      height: 40
    }
  },
  {
    type: 'finish',
    displayName: '结束',
    options: {
      align:'right',
      category: 'common',
      bgColor: NODE_COLORS[6],
      color:'#fff',
      defaults:{},
      icon: finishIcon,
      inputs:1,
      outputs:0,
      width:150,
      height: 40
    }
  }
]);

const menuNodeTypes = computed(() => {
  return nodeTypes.value.filter(nt => nt.type !== 'begin');
});

onMounted(() => {
  if (canvasContainer.value) {
    dataModel = new SF.DataModel();
    const historyManager = new SF.HistoryManager(dataModel)
    graphView = new SF.GraphView(dataModel, {
      graphView: {
        width: canvasContainer.value.clientWidth,
        height: canvasContainer.value.clientHeight,
        editable: true,
      }
    });

    graphView.addToDom(canvasContainer.value);
    // 监听节点双击，弹出属性编辑抽屉（用 jQuery 代理，兼容 simple-flow-web）
    // 修正事件绑定，直接在canvasContainer下的svg层绑定
    setTimeout(() => {
      if (!graphView || !graphView.getNodeLayer) {
        console.warn('[Workflow] graphView or getNodeLayer not ready', graphView);
        return;
      }
      const nodeLayer = graphView.getNodeLayer();
      if (!nodeLayer) {
        console.warn('[Workflow] getNodeLayer() returned null', nodeLayer);
        return;
      }
      let nodeLayerEl = null;
      // 兼容 jQuery 对象、原生 DOM、NodeList
      if (nodeLayer && typeof nodeLayer.get === 'function') {
        nodeLayerEl = nodeLayer.get(0);
      } else if (nodeLayer instanceof Element) {
        nodeLayerEl = nodeLayer;
      } else if (Array.isArray(nodeLayer) || (typeof nodeLayer.length === 'number' && nodeLayer.length > 0)) {
        nodeLayerEl = nodeLayer[0];
      }
      if (!nodeLayerEl) {
        console.warn('[Workflow] nodeLayerEl is null', nodeLayer);
        return;
      }
      console.log('[Workflow] Binding native events on nodeLayer:', nodeLayerEl);
      // 事件委托：捕获 click/dblclick 到 .sf-flow-node
      nodeLayerEl.addEventListener('click', function(e) {
        const target = e.target.closest('.sf-flow-node');
        if (target) {
          console.log('[Workflow] Node click event fired', target, e);
        }
      });
      nodeLayerEl.addEventListener('dblclick', function(e) {
        const target = e.target.closest('.sf-flow-node');
        if (target) {
          console.log('[Workflow] Node dblclick event fired', target, e);
          e.stopPropagation();
          const node = target.__node__;
          if (node) {
            const type = node.getType();
            console.log('[Workflow] Node type on dblclick:', type);
            openDrawer(node);            
          } else {
            console.warn('[Workflow] No node found on dblclick');
          }
        }
      });
    }, 500);

    // 注册节点类型
    nodeTypes.value.forEach(nodeType => {
      graphView.registerNode(nodeType.type, {
        ...nodeType.options,
        displayName: nodeType.displayName
      });
    });

    if (uuid) {
      loading.value = true;
      fetch(`/api/agents?uuid=${uuid}`)
        .then(res => res.json())
        .then(result => {
          // 从 result.list 取出
          const agents = Array.isArray(result.list) ? result.list : [];
          if (agents.length > 0) {
            const agent = agents[0];
            agentName.value = agent.name;
            const wf = agent.workflow;
            if (wf && (typeof wf === 'object' ? Object.keys(wf).length > 0 : (typeof wf === 'string' && wf.trim() !== '' && wf !== '{}'))) {
              dataModel.deserialize(typeof wf === 'string' ? JSON.parse(wf) : wf);
            } else {
              // workflow 为空，添加一个开始节点
              let node1 = new SF.Node({ type: 'begin' });
              node1.setPosition(100, 100);
              node1.setDisplayName('开始');
              dataModel.add(node1);
            }
          }
        })
        .finally(() => {
          loading.value = false;
        });
    } else {
      // 体验模式，添加默认节点
      let node1 = new SF.Node({
        type: 'begin',
      })
      node1.setPosition(100,100)
      node1.setDisplayName("开始")
      dataModel.add(node1)
    }
  }
});
// 样式
//@vue-ignore
</script>

<style scoped>
.workflow-root {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(36, 37, 38, 0.04);
  padding: 24px;
  margin-top: 32px;
  height: 90%;
  display: flex;
  flex-direction: column;
}
.header-bar {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
}

.header-bar button {
  margin-left: 16px;
  padding: 8px 16px;
  border: 1px solid #1976d2;
  background-color: #1976d2;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.header-bar button:hover {
  background-color: #1565c0;
}
.header-bar button.disabled,
.header-bar button:disabled {
  background: #e0e0e0 !important;
  color: #bdbdbd !important;
  border-color: #e0e0e0 !important;
  cursor: not-allowed !important;
}

.agent-title-wrapper {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-right: 16px; /* Space between name and final button */
}
.agent-title-label {
  font-size: 14px;
  color: #666;
}
.agent-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.workflow-canvas-wrapper {
  flex-grow: 1;
  border: 1px solid #e0e3eb;
  border-radius: 8px;
  background: #f8fafc;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: auto;
}

.workflow-canvas-wrapper :deep(.sf-flow-node image) {
  width: 24px !important;
  height: 24px !important;
  x: 3px !important;
  y: 4px !important;
}

.node-type-menu {
  position: absolute;
  background-color: white;
  border: 1px solid #e0e3eb;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  z-index: 11;
}

.node-type-menu .menu-item {
  padding: 4px 16px 6px 24px;
  cursor: pointer;
  font-size: 14px;
}

.node-type-menu .menu-item:hover {
  background-color: #f0f2f5;
}

.node-type-menu .menu-title {
  padding: 8px 16px;
  font-weight: 600;
  color: #666;
  font-size: 12px;
  text-transform: uppercase;
}

.node-type-menu .menu-separator {
  height: 1px;
  background-color: #e0e3eb;
  margin: 4px 0;
}
.property-drawer {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 340px;
  background: #fff;
  box-shadow: 0 4px 24px rgba(36,37,38,0.18), 0 1.5px 6px rgba(36,37,38,0.08);
  border-radius: 14px;
  z-index: 3001;
  padding: 24px 24px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 12px;
}
.drawer-close {
  font-size: 22px;
  cursor: pointer;
  color: #888;
}
.property-drawer label {
  font-size: 14px;
  color: var(--drawer-focus-color, #1976d2);
  margin-top: 8px;
}
.property-drawer input[type="text"],
.property-drawer input[type="number"],
.property-drawer select {
  width: calc(100% - 0px); /* 让输入框宽度不突破padding，0px可根据需要调整 */
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid #e0e3eb;
  border-radius: 5px;
  margin-bottom: 6px;
  font-size: 15px;
  background: #f8fafc;
  outline: none;
  transition: border 0.2s;
}
.property-drawer input[type="text"]:focus,
.property-drawer input[type="number"]:focus,
.property-drawer select:focus {
  border: 1.5px solid var(--drawer-focus-color, #1976d2);
  background: #fff;
}
.property-drawer input[type="checkbox"] {
  margin-left: 8px;
  margin-bottom: 6px;
}
.drawer-save {
  margin-top: 18px;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 10px 0;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.drawer-save:hover {
  filter: brightness(0.92);
}
.property-drawer input.invalid {
  border-color: #f56c6c;
}
</style>