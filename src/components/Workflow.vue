// 编排流程组件来自 simple-flow-web https://github.com/501351981/simple-flow-web
<template>
  <div class="workflow-root">
    <div class="header-bar">
      <div class="title">流程编排</div>
    </div>
    <div class="workflow-canvas-wrapper" ref="canvasContainer"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import SF from 'simple-flow-web';
import 'simple-flow-web/lib/sf.css';

const canvasContainer = ref(null);

onMounted(() => {
  if (canvasContainer.value) {
    const dataModel = new SF.DataModel();
    const historyManager = new SF.HistoryManager(dataModel)
    const graphView = new SF.GraphView(dataModel, {
      graphView: {
        width: canvasContainer.value.clientWidth,
        height: canvasContainer.value.clientHeight,
        editable: true,
      }
    });

    graphView.addToDom(canvasContainer.value);

    // 注册节点类型：inject, function, debug 
    graphView.registerNode('inject',{
            class: 'node-inject',
            align:'left',
            category: 'common',
            bgColor: '#a6bbcf',
            color:'#fff',
            defaults:{},          
            inputs:0,
            outputs:1,
            width:150,
            height: 40
        })
        
    graphView.registerNode('function',{
        align:'left',
        category: 'common',
        bgColor: 'rgb(253, 208, 162)',
        color:'#fff',
        defaults:{},
        inputs:1,
        outputs:1,
        width:150,
        height: 40
    })
    graphView.registerNode('debug',{
        align:'right',
        category: 'common',
        bgColor: '#87a980',
        color:'#fff',
        defaults:{},
        inputs:1,
        outputs:0,
        width:150,
        height: 40
    })

    // 添加3个节点
    let node1 = new SF.Node({
    type: 'inject',
    })
    node1.setPosition(100,100)
    node1.setDisplayName("定时触发流程")

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
}
</style>
