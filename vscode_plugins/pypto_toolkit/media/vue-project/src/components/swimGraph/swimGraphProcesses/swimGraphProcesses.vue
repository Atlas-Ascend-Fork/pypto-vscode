<template>
  <div class="processes-container" ref="processesContainer" :style="containerStyle">
    <template v-if="isMixedAicpuKernel">
      <div class="process-section aicpu-section" :style="aicpuContainerStyle" ref="aicpuSection">
        <swim-graph-process-item 
          v-for="(processEntry, index) in aicpuProcesses" 
          :key="processEntry[0]"
          :process-key="processEntry[0]"
          :process="processEntry[1]"
          :labelRender="labelRender"
        />
      </div>
      <div class="process-section kernel-section" :style="kernelContainerStyle" ref="kernelSection">
        <swim-graph-process-item 
          v-for="(processEntry, index) in kernelProcesses" 
          :key="processEntry[0]"
          :process-key="processEntry[0]"
          :process="processEntry[1]"
          :labelRender="labelRender"
        />
      </div>
    </template>
    <template v-else>
      <swim-graph-process-item 
        v-for="(processEntry, index) in processes" 
        :key="processEntry[0]"
        :process-key="processEntry[0]"
        :process="processEntry[1]"
        :labelRender="labelRender"
      />
    </template>
  </div>
</template>

<script setup>
import { inject, provide, ref, defineExpose, watch, computed } from 'vue';
import SwimGraphProcessItem from './SwimGraphProcessItem.vue';
import { getThreadHeight, getThreadStartY } from '../swimGraphUtils';

// 注入父组件提供的状态
const {
  tsScale,
  processes,
  processExpanded,
  viewState,
  layout,
  lane2line,
  swimlaneContainer,
  selectedEvent,
  globalMeasureCanvas,
  canvasclickedEvent,
  pathLockedEvent,
  highlightedPaths,
  detailsPanelExpanded,
  timeLineX,
  sliderValue,
  sliderMax,
  initialScale,
  tooltip,
  tooltipStyle,
  lineTooltip,
  lineTooltipStyle,
  timelineState,
  isDarkTheme,
  mulDetailsExpanded,
  measureDetailsData,
  rootHashes,
  leafHashes,
  isLockStatus,
  leafHashMap,
  dependencyLinesInfo,
  isThreeColumn,
  isPerfSwim,
  searchedEvent,
  kernelColorRending,
  labelRender,
  childContextMap,
  isPathLockStatus,
  isAicpu,
  isMixedAicpuKernel,
  isMaxSchedule,
  aicpuControlDetailsExpanded,
  aicpuScheduleDetailsExpanded,
  aicpuCoreDetailsExpanded
} = inject('swimGraphState');

const curThread = ref('');
const aicpuSection = ref(null);
const kernelSection = ref(null);
provide('curThread', curThread);

const aicpuProcesses = computed(() => {
  const result = [];
  for (const entry of processes) {
    if (entry[1].type === 'aicpu') {
      result.push(entry);
    }
  }
  return result;
});

const kernelProcesses = computed(() => {
  const result = [];
  for (const entry of processes) {
    if (entry[1].type !== 'aicpu') {
      result.push(entry);
    }
  }
  return result;
});

const hasAicpuExpanded = computed(() => {
  return aicpuProcesses.value.some(([key]) => processExpanded.get(key));
});

const hasKernelExpanded = computed(() => {
  return kernelProcesses.value.some(([key]) => processExpanded.get(key));
});

const aicpuContainerStyle = computed(() => {
  return {
    flex: hasAicpuExpanded.value ? '1' : 'none',
    overflowY: 'auto',
    overflowX: 'hidden',
    maxHeight: hasAicpuExpanded.value ? 'none' : '50%',
    scrollbarGutter: isMixedAicpuKernel.value ? 'stable': 'auto',
  };
});

const kernelContainerStyle = computed(() => {
  return {
    flex: hasKernelExpanded.value ? '1' : 'none',
    overflowY: 'auto',
    overflowX: 'hidden',
    maxHeight: hasKernelExpanded.value ? 'none' : '50%',
    scrollbarGutter: isMixedAicpuKernel.value ? 'stable': 'auto',
  };
});

const containerStyle = computed(() => {
  if (isMixedAicpuKernel.value) {
    return {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    };
  }
  return {};
});

provide('swimGraphState', {
  tsScale,
  viewState,
  layout,
  processExpanded,
  processes,
  lane2line,
  swimlaneContainer,
  selectedEvent,
  globalMeasureCanvas,
  canvasclickedEvent,
  pathLockedEvent,
  highlightedPaths,
  detailsPanelExpanded,
  timeLineX,
  sliderValue,
  sliderMax,
  initialScale,
  tooltip,
  tooltipStyle,
  lineTooltip,
  lineTooltipStyle,
  timelineState,
  isDarkTheme,
  mulDetailsExpanded,
  measureDetailsData,
  rootHashes,
  leafHashes,
  leafHashMap,
  isLockStatus,
  dependencyLinesInfo,
  isThreeColumn,
  isPerfSwim,
  searchedEvent,
  kernelColorRending,
  childContextMap,
  isPathLockStatus,
  isAicpu,
  isMixedAicpuKernel,
  isMaxSchedule,
  aicpuControlDetailsExpanded,
  aicpuScheduleDetailsExpanded,
  aicpuCoreDetailsExpanded
});

const {
  leftmove,
  rightmove,
  flagRender,
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
  processThreadEventSearch,
  getDisplayName,
  changeScale,
  resetState,
  resetMaxScheduleState,
} = inject('swimGraphMethods');

provide('swimGraphMethods', {
  leftmove,
  rightmove,
  flagRender,
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
  processThreadEventSearch,
  getDisplayName,
  changeScale,
  resetState,
  resetMaxScheduleState,
});

const processesContainer = ref(null);

const {
  addChildContext,
} = inject('swimGraphContext');

provide('swimGraphContext', {
  addChildContext,
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

const measureMaskHandleWheel = (e) => {
  const aicpuRect = aicpuSection.value.getBoundingClientRect();
  if (isPointInRect(e.clientX, e.clientY, aicpuRect)) {
    e.preventDefault();
    aicpuSection.value.scrollTop += e.deltaY;
    return;
  }
  const kernelRect = kernelSection.value.getBoundingClientRect();
  if (isPointInRect(e.clientX, e.clientY, kernelRect)) {
    e.preventDefault();
    kernelSection.value.scrollTop += e.deltaY;
    return;
  }
};

const isPointInRect = (x, y, rect) => {
  return (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
};
addChildContext('process', {
  measureMaskHandleWheel
});
defineExpose({
  getProcessContainerHeight,
});
</script>

<style scoped>
@import url("../css/swimGraph/Processes/processes.css");
</style>
