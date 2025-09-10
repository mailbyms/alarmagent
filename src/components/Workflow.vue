// 编排流程组件来自 simple-flow-web https://github.com/501351981/simple-flow-web
<template>
  <div class="workflow-root">
    <div class="header-bar">
      <button @click="importWorkflow">导入</button>
      <button @click="exportWorkflow">导出</button>
    </div>
    <div class="workflow-canvas-wrapper" ref="canvasContainer" @contextmenu.prevent="handleContextMenu" @click="handleClick"></div>
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
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue';
import SF from 'simple-flow-web';
import 'simple-flow-web/lib/sf.css';

import beginIcon from '../assets/icons/node/begin.svg';
import whiteGlobeIcon from '../assets/icons/node/white-globe.svg';
import keyboardIcon from '../assets/icons/node/keyboard.svg';
import mouseIcon from '../assets/icons/node/mouse.svg';
import snapshotIcon from '../assets/icons/node/snapshot.svg';
import timerIcon from '../assets/icons/node/timer.svg';
import finishIcon from '../assets/icons/node/finish.svg';

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

const nodeTypes = ref([
  {
    type: 'begin',
    displayName: '开始',
    options: {
      class: 'node-inject',
      align:'left',
      category: 'common',
      bgColor: '#a6bbcf',
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
    type: 'openwebpage',
    displayName: '打开网页',
    options: {
      align:'left',
      category: 'automation',
      bgColor: '#4CAF50',
      color:'#fff',
      defaults:{
        url: 'https://'
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
      bgColor: '#2196F3',
      color:'#fff',
      defaults:{
        selector: '',
        text: ''
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
      bgColor: '#9C27B0',
      color:'#fff',
      defaults:{
        selector: ''
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
      bgColor: '#FF9800',
      color:'#fff',
      defaults:{
        path: './screenshots/'
      },
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
      bgColor: '#607D8B',
      color:'#fff',
      defaults:{
        delay: 1000
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
      bgColor: '#87a980',
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

    // 注册节点类型
    nodeTypes.value.forEach(nodeType => {
      graphView.registerNode(nodeType.type, {
        ...nodeType.options,
        displayName: nodeType.displayName
      });
    });

    // 添加3个节点
    let node1 = new SF.Node({
    type: 'begin',
    })
    node1.setPosition(100,100)
    node1.setDisplayName("开始")

    dataModel.add(node1)

  }
});
</script>

<style scoped>
.workflow-root {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(36, 37, 38, 0.04);
  padding: 24px;
  margin-top: 32px;
  height: 100%;
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
</style>