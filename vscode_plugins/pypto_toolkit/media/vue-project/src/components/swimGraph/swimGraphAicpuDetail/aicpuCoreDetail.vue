<template>
  <div>
    <div class="core-details" :class="{ expanded: aicpuCoreDetailsExpanded }">
      <div class="core-details-content">
        <!-- 详情页面具体内容 -->
        <aicpu-detail-content />
        <div class="relevent">
          <div class="relevent-title">Relevent</div>
          <div class="relevent-content" v-if="aicpuHasRelevent">
            <div class="build-content" v-if="aicpuBuildTask">
              <div class="title">AICPU_DEV_TASK</div>
              <div class="content" :style="{...dynamicWidthStyle(aicpuBuildTask), width:'auto'}">{{ getEventDisplayName(aicpuBuildTask) }}</div>
            </div>
            <gradientDashedLine v-if="aicpuBuildTask" :left-color="buildTaskColor" :right-color="stopColor" />
            <div class="sched-content">
              <div class="title">Schedule NO.</div>
              <div class="sched"> {{ aicpuSchedTask }} </div>
            </div>
            <gradientDashedLine :left-color="stopColor" :right-color="stopColor" />
            <div class="current-content">
              <div class="title current canvas-title">Current</div>
              <div class="sched"> 
                <div class="detail-canvas-container">
                  <div class="detail-canvas-left-container"> 
                    <div class="thread-name-font">{{ kernalName }}</div>
                    <div class="mt10 ml12 event-name-font">{{t('apiCpuView')}}</div>
                    <div class="mt20 ml12 event-name-font">{{t('kernelCpuView')}}</div>
                  </div>
                  <div id="current-container" class="detail-canvas-right-container" > 
                    <canvas id="core-detail-timeline" ref="coreDetailTimelineCanvas"></canvas>
                    <canvas id="core-detail-aicpu" ref="coreDetailAicpuCanvas"></canvas>
                    <canvas id="core-detail-kernel" ref="coreDetailKernelCanvas" @mousemove="handleMouseMove"  @mouseleave="handleMouseLeave"></canvas>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <template v-else>
            <aicpu-detail-nodata />
          </template>
        </div>
        <div class="close-button">
          <d-button icon="icon-close" style="width: 16px; font-size: 16px; border: none; background-color: transparent"
            @click="AicpuCoreDetailsPanel()"></d-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, computed, nextTick, watch} from 'vue';
import { useI18n } from 'vue-i18n';
import aicpuDetailContent from './aicpuDetailContent.vue';
import aicpuDetailNodata from './aicpuDetailNoData.vue';
import gradientDashedLine from './gradientDashedLine.vue';
import { COLOR_CFG, setupHighDPICanvas, TimelineWithUnit, NARROW_WIDTH_THRESHOLD, SNAP_THRESHOLD, formatTimeWithUnit} from '../swimGraphUtils';
import { computeLocalXY, getNoZoomX } from '../swimGraphProcesses/render/utils';
import { getBaseColor } from '../swimGraphProcesses/processInfo';
const { t } = useI18n();
const {
    aicpuCoreDetailsExpanded,
    isDarkTheme,
    aicpuBuildTask,
    aicpuSchedTask,
    aicpuHasRelevent,
    viewState,
    layout,
    processes,
    lane2line,
    timelineState,
    tooltipStyle,
    kernelColorRending,
    performanceVisible,
    selectedEvent
} = inject('swimGraphState');

const {
  dynamicWidthStyle,
  getEventDisplayName,
  getEventColor,
  showTooltip,
} = inject('swimGraphMethods');
const coreDetailTimelineCanvas = ref(null);
const coreDetailTimelineCtx = ref(null);
const coreDetailAicpuCanvas = ref(null);
const coreDetailAicpuCtx = ref(null);
const coreDetailKernelCanvas = ref(null);
const coreDetailKernelCtx = ref(null);
const kernalProcessKey = ref('');
const kernelCloneThreadData = ref('');
const CANVAS_HEIGHT = ref(20);
const containerWidth = ref(0);
let TOTAL_TICKS = ref(10);
let hasClicked = ref(false);
const AicpuCoreDetailsPanel = () => {
  aicpuCoreDetailsExpanded.value = !aicpuCoreDetailsExpanded.value;
};
const kernalName = ref('');
const kernelThreadData = ref(new Map());
let buildTaskColor = computed(() => {
  return getEventColor(aicpuBuildTask.value);
});
let stopColor = computed(() => {
  return isDarkTheme.value ? '#ffffff' : '#000000';
});
const initCanvases = () => {
  if (coreDetailTimelineCanvas.value) {
    coreDetailTimelineCtx.value = coreDetailTimelineCanvas.value.getContext('2d');
  }
  if (coreDetailAicpuCanvas.value) {
    coreDetailAicpuCtx.value = coreDetailAicpuCanvas.value.getContext('2d');
  }
  if (coreDetailKernelCanvas.value) {
    coreDetailKernelCtx.value = coreDetailKernelCanvas.value.getContext('2d');
  }
};

const getTimeByIndex = (index, x, timePerPixel, { startTimeInfo, endTimeInfo }) => {
  if (index === 0) {
    return startTimeInfo;
  }
  if (index === TOTAL_TICKS.value - 1) {
    return endTimeInfo;
  }
  return startTimeInfo + (x * timePerPixel);
};

const renderCoreDetailTimeline = (startTimeInfo, endTimeInfo) => {
  const canvas = coreDetailTimelineCanvas.value;
  const canvasContainer = document.getElementById('current-container');
  if (!canvas || !canvasContainer) {
    return;
  }
  const ctx = coreDetailTimelineCtx.value;
  const canvasWidth = containerWidth.value;
  const canvasHeight = CANVAS_HEIGHT.value;
  setupHighDPICanvas(canvas, canvasWidth, canvasHeight);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  const timeRange = endTimeInfo - startTimeInfo;
  if (timeRange <= 0) {
    return;
  }
  const timePerPixel = timeRange / canvasWidth;
  const USE_NS = timeRange < 1000;
  const UNIT_DIVISOR = USE_NS ? 1 : 1000;
  const UNIT_LABEL = USE_NS ? 'ns' : 'μs';
  const stepX = (canvasWidth - 60) / (TOTAL_TICKS.value - 1);
  for (let i = 0; i < TOTAL_TICKS.value; i++) {
    let x = i * stepX;
    let time = getTimeByIndex(i, x, timePerPixel, { startTimeInfo, endTimeInfo });
    let displayValue;
    if (i === 0) {
      displayValue = Math.floor(startTimeInfo / UNIT_DIVISOR);
    } else if (i === TOTAL_TICKS.value - 1) {
      displayValue = Math.ceil(endTimeInfo / UNIT_DIVISOR);
    } else {
      displayValue = Math.round(time / UNIT_DIVISOR);
    }
    const text = `${displayValue}${UNIT_LABEL}`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.strokeStyle = isDarkTheme.value ? '#3e3e42' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = isDarkTheme.value ? '#cccccc' : '#333333';
    ctx.font = '12px Arial';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, 4);
  }
};
const renderCoreDetailAicpu = (fontColor, rectColor, eventName) => {
  const canvas = coreDetailAicpuCanvas.value;
  const canvasContainer = document.getElementById('current-container');
  if (!canvas || !canvasContainer) {
    return;
  }
  const ctx = coreDetailAicpuCtx.value;
  const canvasWidth = containerWidth.value;
  const canvasHeight = CANVAS_HEIGHT.value;
  setupHighDPICanvas(canvas, canvasWidth, canvasHeight);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = rectColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.font = '12px Arial'; 
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fontColor; 
  ctx.fillText(eventName, canvasWidth / 2, canvasHeight / 2);
};
const drawKernelEvents = (ctx, events, canvasWidth, canvasHeight, { timelineStart, timelineEnd }) => {
  const timeRange = timelineEnd - timelineStart;
  if (timeRange <= 0) {
    return;
  }
  const eventHeight = canvasHeight;
  const padding = 2;
  const actualEventHeight = eventHeight - (padding * 2);
  const colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
  ctx.font = '12px Arial';
  ctx.textBaseline = 'top';
  for (const event of events) {
    const { startTime, endTime, name } = event;
    const relativeStartTime = startTime - timelineStart;
    const relativeEndTime = endTime - timelineStart;
    const x = (relativeStartTime / timeRange) * canvasWidth;
    const width = ((relativeEndTime - relativeStartTime) / timeRange) * canvasWidth;
    const y = padding;
    event.renderInfo = {
      x,
      y,
      width,
      height: actualEventHeight
    };
    const eventColor = getBaseColor(event, { processes, isDarkTheme, kernelColorRending });
    const fillColor = eventColor;
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, width, actualEventHeight);
    if (width > 15) {
      const fontColor = isDarkTheme.value ? colorCfg.eventFont : colorCfg.eventFont;
      ctx.fillStyle = fontColor;
      const textWidth = ctx.measureText(name).width;
      let displayText = name;
      if (textWidth > width) {
        const widthPerChar = textWidth / name.length;
        const ellipsisWidth = ctx.measureText('...').width;
        const availableWidth = width - ellipsisWidth;
        let maxCharsToFit = Math.floor(availableWidth / widthPerChar);
        if (maxCharsToFit > 0) {
          displayText = name.substring(0, maxCharsToFit) + '...';
        } else {
          displayText = '';
        }
      }
      if (displayText) {
        const displayTextWidth = ctx.measureText(displayText).width;
        const textX = x + ((width - displayTextWidth) / 2);
        const textY = y + ((actualEventHeight - 12) / 2);
        ctx.fillText(displayText, textX, textY);
      }
    }
  }
};

const renderCoreDetailKernel = ({ startTime, endTime }) => {
  const canvas = coreDetailKernelCanvas.value;
  const canvasContainer = document.getElementById('current-container');
  if (!canvas || !canvasContainer) {
    return;
  }
  const ctx = coreDetailKernelCtx.value;
  const canvasWidth = containerWidth.value;
  const canvasHeight = CANVAS_HEIGHT.value;
  setupHighDPICanvas(canvas, canvasWidth, canvasHeight);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = 'transparent';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  if (!kernelThreadData.value || typeof kernelThreadData.value !== 'object' || Object.keys(kernelThreadData.value).length === 0) {
    return;
  }
  kernelCloneThreadData.value = JSON.parse(JSON.stringify(kernelThreadData.value));
  const thread = kernelCloneThreadData.value;
  const events = thread.events || [];
  if (events.length === 0) {
    return;
  }
  drawKernelEvents(ctx, events, canvasWidth, canvasHeight, { timelineStart: startTime, timelineEnd: endTime });
};
const renderCoreDetailCanvas = (event) => {
  if (coreDetailTimelineCtx.value) {
    coreDetailTimelineCtx.value.clearRect(0, 0, viewState.canvasWidth, coreDetailTimelineCanvas.value.height);
  }
  if (coreDetailAicpuCtx.value) {
    coreDetailAicpuCtx.value.clearRect(0, 0, viewState.canvasWidth, coreDetailAicpuCanvas.value.height);
  }
  if (coreDetailKernelCtx.value) {
    coreDetailKernelCtx.value.clearRect(0, 0, viewState.canvasWidth, coreDetailKernelCanvas.value.height);
  }
  const { name, threadName } = event;
  const targetThreadName = extractAicAiv(threadName).replace('-','_');
  kernalName.value = targetThreadName;
  const {startTime, endTime} = event;
  getKernelEventsData(startTime, endTime);
  const rectColor = isDarkTheme.value ? event.color.dark.light : event.color.light.light;
  const colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
  const fontColor = colorCfg.eventFontHighLight;
  setTimeout(() => {
    const canvasContainer = document.getElementById('current-container');
    const baseWidth = canvasContainer.clientWidth;
    containerWidth.value = hasClicked.value ? baseWidth - 10 : baseWidth;
    initCanvases();
    renderCoreDetailTimeline(startTime, endTime);
    renderCoreDetailAicpu(fontColor, rectColor, name);
    renderCoreDetailKernel({ startTime, endTime });
    hasClicked.value = true;
  });
};
const getKernelEventsData = (startTime, endTime) => {
  let kernelThreads = null;
  for (const [key, processItem] of processes) { 
    if (processItem.type === 'kernel') {
      kernalProcessKey.value = key;
      kernelThreads = processItem.threads;
      break; 
    }
  }
  if (kernelThreads) {
    kernelThreadData.value = getThreadByThreadName(kernelThreads, startTime, endTime);
  } else {
    kernelThreadData.value = {};
  }
};
const getThreadByThreadName = (map, startTimeInfo, endTimeInfo) => {
  for (const [, value] of map) {
    if (value.threadName === kernalName.value) {
      const originalEvents = value.events || [];
      const filteredEvents = originalEvents.filter(item => {
        return item.startTime >= startTimeInfo && item.endTime <= endTimeInfo;
      });
      if (filteredEvents.length > 0) {
        return {
          ...value,
          events: filteredEvents
        };
      }
    }
  }
  return {};
};
const extractAicAiv = (str) => {
  const match = str.match(/^[^-]+-(?<result>.*)$/);
  return match ? match.groups.result : null;
};
const handleMouseMove = (e) => {
  const mousePosition = { x: e.clientX, y: e.clientY };
  if (!coreDetailKernelCanvas.value || !mousePosition) { return };
  const rect = coreDetailKernelCanvas.value.getBoundingClientRect();
  const x = mousePosition.x - rect.left;
  const y = mousePosition.y - rect.top;
  const info = findEventAtPosition(x, y, kernalProcessKey.value);
  const hoveredEvent = info?.event;
  if (!hoveredEvent) {
    return;
  }
  showTooltip(e, hoveredEvent, coreDetailKernelCanvas.value);
};
const handleMouseLeave = (e) => {
  tooltipStyle.display = 'none';
};
const findEventAtPosition = (x, y, processKey) => {
  let processObj = {
    event: null
  };
  const thread = kernelCloneThreadData.value;
  if (!thread) {
    return processObj;
  }
  const [temp] = thread.events;
  if (!temp) {
    return processObj;
  }
  const label = `${processKey}@${thread.tid}`;
  const lineCount = lane2line.get(label) || 1;
  if (temp.renderInfo) {
    const minY = temp.renderInfo.y;
    const maxY = minY + (layout.threadHeight * lineCount);
    if (y < minY || y > maxY) {
      return processObj;
    }
  }
  const result = searchEventsInThread(thread, x, y);
  if (result.foundEvent) {
    processObj.event = result.foundEvent;
    return processObj;
  }
  return processObj;
};
const searchEventsInThread = (thread, x, y) => {
  for (let index = 0; index < thread.events.length; index++) {
    const event = thread.events[index];
    if (!event.renderInfo) {
      continue;
    }
    const { x: eventX, y: eventY, height: eventHeight, width } = event.renderInfo;
    if (y < eventY || y > eventY + eventHeight) {
      continue;
    }
    if (x >= eventX && x <= eventX + width) {
      return {
        foundEvent: event
      };
    } else {
      const { pixelScale } = viewState;
      const isNarrow = width * pixelScale <= NARROW_WIDTH_THRESHOLD;
      if (isNarrow && event.renderEndTime >= timelineState.startTime && event.renderStartTime <= timelineState.endTime) {
        const snapThresholdInTime = SNAP_THRESHOLD / pixelScale;
        const eventRange = [eventX - snapThresholdInTime, eventX + width];
        if (x >= eventRange[0] && x <= eventRange[1]) {
          return {
            foundEvent: event
          };
        }
      }
    }
  }
  return {
    foundEvent: null
  };
};
watch(performanceVisible, () => {
  TOTAL_TICKS.value = performanceVisible.value ? 5 : 10;
  if (!aicpuCoreDetailsExpanded.value) {
    return;
  }
  renderCoreDetailCanvas(selectedEvent.value);
});
defineExpose({
  renderCoreDetailCanvas  
});
</script>

<style scoped lang="scss">
@import url("../css/swimGraph/AicpuDetail/aicpuCoreDetail.css");
</style>