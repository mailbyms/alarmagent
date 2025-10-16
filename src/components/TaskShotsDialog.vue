<template>
  <el-dialog :model-value="visible" @update:model-value="emit('update:visible', $event)" width="700px" :close-on-click-modal="true">
    <template #header="{ close, titleId, titleClass }">
      <div class="my-header">
        <h4 :id="titleId" :class="titleClass">任务截图</h4>
        <button @click="analyzeTaskInDialog" :disabled="analysisStatus === 'loading'" class="analysis-btn-dialog">
          {{ analysisStatus === 'loading' ? '分析中...' : '分析截图' }}
        </button>
      </div>
    </template>

    <TopLoadingBar :loading="loading || analysisStatus === 'loading'" />

    <div v-if="analysisResult" class="analysis-result-box">
      <h5>分析结果:</h5>
      <div v-if="analysisResult.alarm_detected" style="color: red; font-weight: bold;">
        检测到告警: {{ analysisResult.alarm_description }}
      </div>
      <div v-else-if="analysisResult.error" style="color: orange;">
        分析出错: {{ analysisResult.details }}
      </div>
      <div v-else style="color: green;">
        无告警
      </div>
    </div>

    <div v-if="shots.length === 0 && !loading" style="text-align:center;padding:40px 0;">暂无截图</div>
    <div v-else>
      <!-- 轮播模式：图片多于5张 -->
      <div v-if="shots.length > 5" class="shot-carousel">
        <button class="carousel-btn left" @click="prevShot">‹</button>
        <div class="shot-item">
          <img :src="'data:image/png;base64,' + shots[currentIndex].image_base64" style="max-width:100%;max-height:320px;border-radius:8px;box-shadow:0 2px 8px #eee;cursor:pointer;" @click="showPreview = true" />
          <div class="shot-time">{{ shots[currentIndex].created_at }}</div>
          <div class="shot-index">{{ currentIndex+1 }} / {{ shots.length }}</div>
        </div>
        <button class="carousel-btn right" @click="nextShot">›</button>
        <el-image-viewer v-if="showPreview" :url-list="[ 'data:image/png;base64,' + shots[currentIndex].image_base64 ]" @close="showPreview = false" />
      </div>
      <!-- 平铺模式：图片不超过5张 -->
      <div v-else class="shot-list-horizontal">
        <div v-for="(shot, idx) in shots" :key="shot.id" class="shot-item-horizontal">
          <img :src="'data:image/png;base64,' + shot.image_base64" style="max-width:180px;max-height:120px;border-radius:8px;box-shadow:0 2px 8px #eee;cursor:pointer;" @click="openPreview(idx)" />
          <div class="shot-time">{{ shot.created_at }}</div>
        </div>
        <el-image-viewer v-if="showPreview" :url-list="shots.map(s => 'data:image/png;base64,' + s.image_base64)" :initial-index="previewIndex" @close="showPreview = false" />
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import TopLoadingBar from './TopLoadingBar.vue';
import ElImageViewer from 'element-plus/es/components/image-viewer/index.mjs';

const props = defineProps({
  taskId: { type: [Number, String], required: true },
  visible: { type: Boolean, required: true },
});
const emit = defineEmits(['update:visible']);

const shots = ref([]);
const loading = ref(false);
const currentIndex = ref(0);
const showPreview = ref(false);
const previewIndex = ref(0);

const analysisResult = ref(null);
const analysisStatus = ref('idle'); // idle, loading, done, error

watch([() => props.visible, () => props.taskId], async ([visible, taskId]) => {
  if (visible && taskId) {
    // Reset states for new task
    shots.value = [];
    analysisResult.value = null;
    analysisStatus.value = 'idle';
    currentIndex.value = 0;

    loading.value = true;
    try {
      const res = await fetch(`/api/crawler/shots?taskId=${taskId}`);
      const data = await res.json();
      shots.value = Array.isArray(data) ? data : [];
    } catch {
      shots.value = [];
    }
    loading.value = false;
  }
}, { immediate: true });

async function analyzeTaskInDialog() {
  analysisStatus.value = 'loading';
  analysisResult.value = null;
  try {
    const res = await fetch('/api/analysis/analyze-shots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: props.taskId }),
    });
    if (!res.ok) throw new Error('Analysis request failed');
    const result = await res.json();
    analysisResult.value = result;
    analysisStatus.value = 'done';
  } catch (e) {
    console.error('Failed to analyze task in dialog:', e);
    analysisResult.value = { error: 'Analysis failed', details: e.message };
    analysisStatus.value = 'error';
  }
}

function prevShot() {
  if (shots.value.length > 0) {
    currentIndex.value = (currentIndex.value - 1 + shots.value.length) % shots.value.length;
  }
}
function nextShot() {
  if (shots.value.length > 0) {
    currentIndex.value = (currentIndex.value + 1) % shots.value.length;
  }
}

function openPreview(idx) {
  previewIndex.value = idx;
  showPreview.value = true;
}
</script>

<style scoped>
.my-header {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
}
.analysis-btn-dialog {
  background: #fff;
  color: #ff9800;
  border: 1px solid #ff9800;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
  margin-left: 16px;
}
.analysis-btn-dialog:hover {
  background: #fff3e0;
}
.analysis-btn-dialog:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.analysis-result-box {
  margin-bottom: 16px;
  padding: 12px;
  background-color: #f9f9f9;
  border: 1px solid #eee;
  border-radius: 6px;
}

.shot-list-horizontal {
  display: flex;
  flex-direction: row;
  gap: 24px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.shot-item-horizontal {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 180px;
}
.shot-carousel {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-height: 360px;
}
.carousel-btn {
  background: #fff;
  border: 1px solid #1976d2;
  color: #1976d2;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  margin: 0 12px;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.08);
  user-select: none;
}
.carousel-btn:hover {
  background: #e3f0fd;
}
.shot-item {
  width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.shot-time {
  margin-top: 8px;
  font-size: 13px;
  color: #888;
}
.shot-index {
  margin-top: 4px;
  font-size: 12px;
  color: #aaa;
}
</style>