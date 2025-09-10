// 编排流程组件来自 simple-flow-web https://github.com/501351981/simple-flow-web
<template>
  <div class="workflow-root">
    <div class="header-bar">
      <div class="title">流程编排</div>
    </div>
    <div class="workflow-canvas-wrapper" ref="canvasContainer" @contextmenu.prevent="handleContextMenu" @click="handleClick"></div>
    <div v-show="showNodeTypeMenu" class="node-type-menu" :style="nodeTypeMenuStyle">
      <div v-for="nodeType in nodeTypes" :key="nodeType.type" class="menu-item" @click="addNode(nodeType.type)">{{ nodeType.displayName }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import SF from 'simple-flow-web';
import 'simple-flow-web/lib/sf.css';

const canvasContainer = ref(null);
let dataModel = null;
let graphView = null;

const showNodeTypeMenu = ref(false);
const nodeTypeMenuStyle = reactive({ top: '0px', left: '0px' });
let contextNode = null;

function handleContextMenu(event) {
  const nodeElement = event.target.closest('g.sf-flow-node');
  if (nodeElement) {
    const nodeId = nodeElement.id;
    contextNode = dataModel.getDataById(nodeId);
    if (contextNode) {
      nodeTypeMenuStyle.left = `${event.clientX}px`;
      nodeTypeMenuStyle.top = `${event.clientY}px`;
      showNodeTypeMenu.value = true;
    }
  } else {
    contextNode = null;
    showNodeTypeMenu.value = false;
  }
}

function handleClick() {
  showNodeTypeMenu.value = false;
}

function addNode(type) {
  if (contextNode) {
    const sourceNode = contextNode;
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
  contextNode = null;
}

const nodeTypes = ref([
  {
    type: 'inject',
    displayName: '开始节点',
    options: {
      class: 'node-inject',
      align:'left',
      category: 'common',
      bgColor: '#a6bbcf',
      color:'#fff',
      defaults:{},
      icon: '/src/assets/icons/node/inject.svg',
      inputs:0,
      outputs:1,
      width:150,
      height: 40
    }
  },
  {
    type: 'function',
    displayName: '函数节点',
    options: {
      align:'left',
      category: 'common',
      bgColor: 'rgb(253, 208, 162)',
      color:'#fff',
      defaults:{},
      icon: '/src/assets/icons/node/function.svg',
      inputs:1,
      outputs:1,
      width:150,
      height: 40
    }
  },
  {
    type: 'save2db',
    displayName: '结束',
    options: {
      align:'right',
      category: 'common',
      bgColor: '#87a980',
      color:'#fff',
      defaults:{},
      icon: '/src/assets/icons/node/leveldb.png',
      inputs:1,
      outputs:0,
      width:150,
      height: 40
    }
  }
]);

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
    type: 'inject',
    })
    node1.setPosition(100,100)
    node1.setDisplayName("开始")

    let node2 = new SF.Node({
        type: 'function',
    })
    node2.setPosition(300,200)
    node2.setDisplayName("函数组件")

    // 添加连线
    let wire = new SF.Wires({
        source: node1,
        target: node2
    })
    dataModel.add(node1)
    dataModel.add(node2)
    dataModel.add(wire)

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
  height: calc(100vh - 64px - 64px);
  display: flex;
  flex-direction: column;
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

.node-type-menu {
  position: absolute;
  background-color: white;
  border: 1px solid #e0e3eb;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  z-index: 11;
}

.node-type-menu .menu-item {
  padding: 8px 16px;
  cursor: pointer;
}

.node-type-menu .menu-item:hover {
  background-color: #f0f2f5;
}
</style>
