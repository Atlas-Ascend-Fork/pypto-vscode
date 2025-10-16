<template>
  <div class="processes-container" ref="processesContainer">
    <div v-for="(process, index) in processesArray" :key="index" class="process-section">
      <!-- 进程头部 -->
      <span :data-processKey="process.key" :data-process="process.key"></span>
      <swim-graph-process-header 
        :process-key="process.key" 
        :process="process"
      />

      <!-- 线程和事件区域 -->
      <div class="threads-container" v-show="processExpanded.get(process.key)">
        <!-- 线程标签区域 -->
        <swim-graph-thread-labels 
          :process-key="process.key" 
          :process="process"
        />

        <!-- 线程事件区域 -->
        <swim-graph-thread-events 
          :process-key="process.key" 
          :process="process"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, provide, ref, defineExpose, watch } from 'vue';
import SwimGraphProcessHeader from './swimGraphProcessHeader.vue';
import SwimGraphThreadLabels from './swimGraphThreadLabels.vue';
import SwimGraphThreadEvents from './swimGraphThreadEvents.vue';
import { getThreadHeight, getThreadStartY } from '../swimGraphUtils';

// 注入父组件提供的状态
const {
  processes,
  processExpanded,
  viewState,
  layout,
  lane2line,
  swimlaneContainer,
  selectedEvent,
  processedEvents,
  highlightedPaths,
  detailsPanelExpanded,
  timeLineX,
  sliderValue,
  sliderMax,
  initialScale,
  tooltip,
  tooltipStyle,
  timelineState,
  isDarkTheme,
  mulDetailsExpanded,
  measureDetailsData,
  rootHashes,
  leafHashMap
} = inject('swimGraphState');

const curThread = ref('');
provide('curThread', curThread);

provide('swimGraphState', {
  viewState,
  layout,
  processExpanded,
  processes,
  lane2line,
  swimlaneContainer,
  selectedEvent,
  processedEvents,
  highlightedPaths,
  detailsPanelExpanded,
  timeLineX,
  sliderValue,
  sliderMax,
  initialScale,
  tooltip,
  tooltipStyle,
  timelineState,
  isDarkTheme,
  mulDetailsExpanded,
  measureDetailsData,
  rootHashes,
  leafHashMap
});

const {
  leftmove,
  rightmove,
  toggleProcess,
  findEventAtPosition,
  selectEvent,
  handleWheel,
  timeToX,
  durationToWidth,
  getTimelineCanvas,
  render,
  renderEvent,
  transform,
  measureDetailGet,
  xToTime,
  processThreadEventSearch
} = inject('swimGraphMethods');

provide('swimGraphMethods', {
  leftmove,
  rightmove,
  toggleProcess,
  findEventAtPosition,
  selectEvent,
  handleWheel,
  timeToX,
  durationToWidth,
  getTimelineCanvas,
  render,
  renderEvent,
  transform,
  measureDetailGet,
  xToTime,
  processThreadEventSearch
});

const processesContainer = ref(null);

const {
  addChildContext,
} = inject('swimGraphContext');

provide('swimGraphContext', {
  addChildContext,
});

// 将Map转换为数组以便在模板中使用v-for
const processesArray = computed(() => {
  return Array.from(processes.entries()).map(([key, value]) => {
    return {
      key,
      ...value
    };
  });
});

const getProcessContainerHeight = () => {
  if (!processesContainer.value) return 1000;
  const rect = processesContainer.value.getBoundingClientRect();
  return rect.height;
}

watch( curThread, (newValue, oldValue) => {
  //highlight thread when label hovered
  let oriProcessKeyStr = oldValue.split('-')[0];
  let oriProcessKey = parseInt(oriProcessKeyStr);
  let processKeyStr = newValue.split('-')[0];
  let processKey = parseInt(processKeyStr);

  //if leave old process, clear old process background
  if (oldValue != '') {
    const oriBackgroundCanvasRef = document.querySelector(`[data-background-process-key="${oriProcessKey}"]`);
    try{
      const oriBackgroundCanvasCtx = oriBackgroundCanvasRef.getContext('2d');
      oriBackgroundCanvasCtx.clearRect(0, 0, oriBackgroundCanvasRef.width, oriBackgroundCanvasRef.height);}
    catch(err){
      console.error(err);
    }
  }

  //if mouse not on canvas, return
  if (newValue == '') {
    return;
  }
  let threadIdx = parseInt(newValue.split('-')[1]);
  let curY = 0;
  let curHeight = 0;
  const threads = [];
  const curProcess = processes.get(processKeyStr);
  for (const [threadKey, thread] of curProcess.threads.entries()) {
    threads.push(thread);
  }

  for (let index = 0; index < threads.length; index++) {
    let thread = threads[index];
    if (index >= threadIdx) {
      const key = thread.isCounter ? thread.threadName : thread.tid;
      curY = getThreadStartY(curProcess, processKey, key, lane2line, layout);
      curHeight = getThreadHeight(processKey, key, lane2line, layout, thread.isCounter);
      break;
    }
  }
  const backgroundCanvasRef = document.querySelector(`[data-background-process-key="${processKey}"]`);
  if (!backgroundCanvasRef) return;
  const backgroundCanvasCtx = backgroundCanvasRef.getContext('2d');
  backgroundCanvasCtx.clearRect(0, 0, viewState.canvasCssWidth, backgroundCanvasRef.offsetHeight);
  backgroundCanvasCtx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  backgroundCanvasCtx.fillRect(0, curY, viewState.canvasCssWidth, curHeight);
});

defineExpose({
  getProcessContainerHeight,
});
</script>

<style scoped>
@import url("../css/swimGraph/Processes/processes.css");
</style>
