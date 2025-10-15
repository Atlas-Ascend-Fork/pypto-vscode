<template>
  <div>
    <div class="container">
      <Loading v-if="loading" :loadingText="loadingText" warningText="" />
      <div class="head-container" v-show="!loading">
        <div class="title" :style="{'width':layout.processLabelWidth + 'px'}">
          <div class="title_up">
            <!-- <div class="title_pic"></div> -->
            <img class="title_pic" :src="titlePath" alt="title-picture">
            <div class="title_up_r">
              <div class="workflow-container">
                <div class="workflow">Workflow</div>
                <img class="down_16px" :src="down_16px" alt="down_16px">
              </div>
              <div class="title_time"> {{ formattedTime }} </div>
            </div>
          </div>
          <div class="title_down">
            <d-tooltip :content="$t('tips1')">
              <img class="title_icon1" :src="iconPath1" alt="iconPath1-picture">
            </d-tooltip>
            <div class="dashed-line"></div>
            <d-tooltip :content="$t('tips2')"><img class="title_icon2" :src="iconPath2" alt="iconPath2-picture"></d-tooltip>
            <div class="dashed-line"></div>
            <div class="title_down3">
              <img class="title_icon3" :src="iconPath3" alt="iconPath3-picture">
              <div class="title_name">{{ $t('swimGraph')}}</div>
            </div>
          </div>
        </div>
        <div class="right-header-content" style="width:calc(100% - 250px)">
          <!-- 按钮操作区 -->
          <swim-graph-header ref="swimgraphHeaderComponent" />
          <div class="swimlane-container mr16" ref="swimlaneContainer">
            <!-- 时间轴区域 -->
            <swim-graph-timeline ref="timelineComponent" />
          </div>
        </div>   
      </div>
      <div class="main-view" v-show="!loading">
        <div class="swimlane-container" ref="swimlaneContainer">
          <!-- 进程和线程区域 -->
          <swim-graph-processes ref="graphProcessesComponent"/>
          <!-- 度量蒙板 -->
          <div class="measure-mask" v-if="isMeasureModel"
            @mousedown="measureMouseDown($event)" @mousemove="measureMouseMove($event)" @mouseup="measureMouseUp()"
            @mouseleave="measureMouseLeave($event)" @wheel="measureHandleWheel($event)">
            <div class="measure-drag-area" :style="dragAreaStyle()"></div>
          </div>
        </div>
        <!-- 详情区域 -->
        <swim-graph-detail ref="detailComponent"/>
      </div>
    </div>

  </div>
  <div class="tooltip" ref="tooltip" :style="tooltipStyle"></div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch, nextTick, provide, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import SwimGraphHeader from './swimGraphHeader/swimGraphHeader.vue';
import SwimGraphTimeline from './swimGraphTimeline/swimGraphTimeline.vue';
import SwimGraphProcesses from './swimGraphProcesses/swimGraphProcesses.vue';
import SwimGraphDetail from './swimGraphDetail/swimGraphDetail.vue';
import { getTextWidth } from '../../utils';
import { BigNumber } from 'bignumber.js';
import {
  calculateGridInterval,
  ctxs,
  TimelineWithUnit,
  formatTimeWithUnit,
  devicePixelRatio,
  setDevicePixelRatio,
  updateProcessSize,
  setupHighDPICanvas,
  getCanvasCSSHeight,
  getCanvasCSSWidth,
  getDevicePixelRatio,
  COLOR_CFG,
} from './swimGraphUtils';
import Loading from '../comGraph/loading.vue';
import { throttle } from 'lodash-es';

const { isDarkTheme } = inject('root');
const { t: $t } = useI18n();
const titlePath = ref(`${window.staticPath}/static-assets/title_40px.svg`);
const iconPath1 = ref(`${window.staticPath}/static-assets/icon_title_1.svg`);
const iconPath2 = ref(`${window.staticPath}/static-assets/icon_title_2.svg`);
let iconPath3 = ref(`${window.staticPath}/static-assets/icon_title_3.svg`);
let down_16px = ref(`${window.staticPath}/static-assets/down_16px.svg`);
// 响应式状态
const swimlaneContainer = ref(null);
const timelineComponent = ref(null);
const detailComponent = ref(null);
const graphProcessesComponent = ref(null);
const swimgraphHeaderComponent = ref(null);
const timeLineX = ref(null);
const traceData = ref(null);
const processedEvents = ref([]);
const processes = reactive(new Map());
const counterEvents = ref([]);
const selectedEvent = ref(null);
const highlightedPaths = reactive(new Set());
const processExpanded = reactive(new Map());
const loading = ref(false);
const loadingText = ref($t("loadTraceData"));
const detailsPanelExpanded = ref(false);
const detailsCoresExpanded = ref(false);
const tooltip = ref(null);
const tooltipStyle = reactive({
  display: 'none',
  left: '0px',
  top: '0px'
});
const bindFile = ref(false);
const bindButton = ref($t("bindComGraphJson"));
const cycleDisplay = ref('none');
const selectedOption = ref('clockCycle');
const selectOptions = [
  {name: $t('clockCycle'), value: 'clockCycle', disabled: false},
  {name: $t('throughout'), value: 'throughout', disabled: true},
  {name: $t('cacheHit'), value: 'cacheHit', disabled: true},
  {name: $t('task'), value: 'task', disabled: false},
];
const options = reactive(selectOptions);

const isMeasureModel = ref(false);
const isMeasureDragging = ref(false);
const showDragAreaBorders = ref(false);
const measureDragStartX = ref(0);
const measureDragEndX = ref(0);
const measureDragStartY = ref(0);
const measureDragEndY = ref(0);
const measureDragHeight = ref(0);
const measureDragCtrl = ref(false);
const measureDragCtrlX = ref(0);

let sliderValue = ref(0);
const sliderMax = ref(100);
const sliderMaxCount = ref(100);
const initialScale = ref(1);
const viewState = reactive({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  minTime: 0,
  maxTime: 0,
  timeRange: 0,
  canvasCssWidth: 0,
  canvasWidth: 0,
  windowWidth: 0,
  depMode: 'all',
  scaleChange: 1,
  pixelOffsetX: 0,
  pixelScale: devicePixelRatio,
  offsetXChange: 0,
  minWidth: 1,
});

const layout = reactive({
  processLabelWidth: 250,
  eventHeight: 16,
  processHeaderHeight: 30,
  threadHeight: 24,
  counterHeight: 24,
  eventMargin: 2,
  processMargin: 5,
  marginRight: 10
});

const timelineState = reactive({
  startTime: 0,
  endTime: 0,
  startTimeX: 0,
  endTimeX: 0,
  isInLeftTag: false,
  isInRightTag: false,
  isOnTag: false,
  isOutTag: false,
  startTimeDecimal: new BigNumber(0),
  endTimeDecimal: new BigNumber(0)
});
const formattedTime = computed(() => {
  let date = new Date();
  let year = date.getFullYear();
  let month = String(date.getMonth() + 1).padStart(2, '0');
  let day = String(date.getDate()).padStart(2, '0');
  let hours = String(date.getHours()).padStart(2, '0');
  let minutes = String(date.getMinutes()).padStart(2, '0');
  let seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
})

const lane2line = reactive(new Map());
const id2event = {};
const userConfig = reactive(new Map());

const childContextMap = {};
const addChildContext = (childName, ctx) => {
  childContextMap[childName] = ctx;
}

const searchResult = ref([]);
const currentResultIndex = ref(0);
const isSearchActive = ref(false);
const searchQuery = ref('');
const isCaseSensitive= ref(false);

const pmuTotal = ref({});

// 方法
const initEventListeners = () => {
  window.addEventListener('message', handleMessage);
  window.addEventListener('resize', onWindowResize);
};

const handleMessage = (event) => {
  const message = event.data;
  switch (message.command) {
    case 'returnSwimData':
      const oldMessage = /** @type { { message: object } | undefined } */ (vscode.getState());
      let newMessage = (oldMessage && oldMessage.message) || message;
      vscode.setState({ message: message });
      setPageState(message);
      loadTraceData(newMessage.data);
      break;
    case 'bindResult':
      if (message.success) {
        bindFile.value = message.comGraphPath;
        bindButton.value = $t("unbindComGraph");
      } else {
        bindFile.value = false;
        bindButton.value = $t("bindComGraphJson");
      }
      break;
    case 'unbindResult':
      if (message.success) {
        bindFile.value = false;
        bindButton.value = $t("bindComGraphJson");
      } else {
        bindFile.value = message.comGraphPath;
        bindButton.value = $t("unbindComGraph");
      }
      break;
  }
};

const postMessage = (message) => {
  if (window.vscode) {
    window.vscode.postMessage(message);
  }
};

let ERROR_MESSAGES = {
  INVALID_FILE: $t("swimErroMsgINVALID_FILE"),
  MISSING_EVENT_FIELDS: $t("swimErroMsgMISSING_EVENT_FIELDS"),
  MISSING_END_EVENT: $t("swimErroMsgMISSING_END_EVENT"),
  MISSING_DUR: $t("swimErroMsgMISSING_DUR"),
  INVALID_ARGS: $t("swimErroMsgINVALID_ARGS"),
  MISSING_PROCESS_NAME: $t("swimErroMsgMISSING_PROCESS_NAME"),
  MISSING_THREADS_FIELDS: $t("swimErroMsgMISSING_THREADS_FIELDS"),
  NO_THREADS: $t("swimErroMsgNO_THREADS"),
  NO_PROCESS_NAME: $t("swimErroMsgNO_PROCESS_NAME")
}

const validData = (data) => {
  if (!data || !data.traceEvents || !Array.isArray(data.traceEvents)) {
    window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.INVALID_FILE}`);
  }

  let hasProcessName = false;
  let countThread = 0;

  const eventMap = new Map();
  data.traceEvents.forEach(event => {
    const key = `${event.name}-${event.id}`;
    if (!eventMap.has(key)) {
      eventMap.set(key, []);
    }
    eventMap.get(key).push(event);
  });

  data.traceEvents.forEach(event => {
    if (event.cat === 'event' && (typeof event.id === "undefined" || !event.name || !event.ph || typeof event.pid === "undefined" || typeof event.tid === "undefined" || typeof event.ts === "undefined")) {
      window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.MISSING_EVENT_FIELDS}: ["${event.name}"]`);
    }

    if (event.ph === 'B') {
      const key = `${event.name}-${event.id}`;
      const endEvent = eventMap.get(key) || [];
      const hasE = endEvent.some(e => e.ph === 'E');
      if (!hasE) {
        window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.MISSING_END_EVENT}: ["${event.name}"]`);
      }
    } else if (event.ph === 'X') {
      if (!event.dur) {
        window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.MISSING_DUR}: ["${event.name}"]`);
      }
    } else if (event.ph === 'C') {
      if (!event.args || (typeof event.args.size !== "number" && typeof event.args['/byte'] !== "number" )) {
        window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.INVALID_ARGS}: ["${event.name}"]`);
      }
    } 

    if (event.name === "process_name") {
      hasProcessName = true;
      if (typeof event.pid === "undefined" || !event.args || !event.args.name) {
        window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.MISSING_PROCESS_NAME}: ["${event.args.name}"]`);
      }
    }

    if (event.name.includes("thread")) {
      countThread += 1;
      if (typeof event.pid === "undefined" || typeof event.tid === "undefined" || !event.args || !event.args.name) {
        window.ascEventBus.emit('jsonParseError', `${ERROR_MESSAGES.MISSING_THREADS_FIELDS}: ["${event.args.name}"]`);
      }
    }
  });

  if (countThread === 0) {
    window.ascEventBus.emit('jsonParseError', ERROR_MESSAGES.NO_THREADS);
  }

  if (!hasProcessName) {
    window.ascEventBus.emit('jsonParseError', ERROR_MESSAGES.NO_PROCESS_NAME);
  }
};

const loadTraceData = (data) => {
  try {
    processTraceData(data);
    loading.value = false;
  } catch (error) {
    console.error($t("loadTraceDataError"), error);
    loading.value = true;
  }
};

const processTraceData = (data) => {
  pmuTotal.value = data.pmu_total;
  processedEvents.value = data.processedEvents;
  for (const key in data.processes) {
    if (Object.prototype.hasOwnProperty.call(data.processes, key)) {
      data.processes[key].threads = new Map(Object.entries(data.processes[key].threads));
      processes.set(key, data.processes[key]);
    }
  }
  for (const key in data.processExpanded) {
    if (Object.prototype.hasOwnProperty.call(data.processExpanded, key)) {
      processExpanded.set(key, data.processExpanded[key]);
    }
  }
  counterEvents.value = data.counterEvents;
  for (const key in data.lane2line) {
    if (Object.prototype.hasOwnProperty.call(data.lane2line, key)) {
      lane2line.set(key, data.lane2line[key]);
    }
  }
  if (processedEvents.value.length > 0) {
    const ret = parseTime(processedEvents);
    viewState.minTime = ret.minTime;
    viewState.maxTime = ret.maxTime;
    viewState.timeRange = viewState.maxTime - viewState.minTime;
  }

  // 对线程进行排序
  processes.forEach((value) => {
    const cThread = new Map([...value.threads.entries()].filter(
      (item) => item[1].isCounter
    ).sort());
    const eThread = new Map([...value.threads.entries()].filter((item) => !item[1].isCounter).sort());
    value.threads = new Map([...eThread.entries(), ...cThread.entries()]);
  });

  // 初始化画布
  nextTick(() => {
    initCanvases();
    resizeCanvases();
    render();
  });
};

const transform = () => {
  renderTwoTimeline();
  for (const [processKey, ctxInfo] of Object.entries(ctxs)) {
    for (const [ctxKey, ctx] of Object.entries(ctxInfo)) {
      ctx.save();
      ctx.setTransform(viewState.pixelScale, 0, 0, getDevicePixelRatio(), viewState.pixelOffsetX, 0);
    }
  }
  // 渲染进程事件
  for (const [processKey, process] of processes.entries()) {
    if (processExpanded.get(processKey)) {
      childContextMap.threadEvent.transformEvents(process, processKey);
      const ctx = ctxs[processKey].eventCtx;
      childContextMap.threadEvent.renderProcessText(process, ctx);
    }
  }
  renderDependencyLines();
  timelineComponent.value.flagRender();
};

const parseTime = (processedEvents) => {
  let minTime = processedEvents.value[0].startTime;
  let maxTime = 0;
  for (const event of processedEvents.value) {
    minTime = Math.min(...[minTime, event.startTime]);
    maxTime = Math.max(...[maxTime, event.endTime]);
  }
  return { minTime, maxTime };
}

const renderTwoTimeline = () => {
  // 渲染两段时间轴
  renderFixedTimeline();
  renderTimeline();
}

const renderEvent = () => {
  if (!processedEvents.value.length && !counterEvents.value.length) return;
  // 渲染进程事件
  for (const [processKey, process] of processes.entries()) {
    if (processExpanded.get(processKey)) {
      childContextMap.threadEvent.renderProcessEvents(process, processKey);
      const ctx = ctxs[processKey].eventCtx;
      childContextMap.threadEvent.renderProcessText(process, ctx);
    }
  }
};

const renderDependencyLines = (processKey) => {
  if (!processedEvents.value.length) return;
  const mode = viewState.depMode;
  if (processKey) {
    const process = processes.get(processKey);
    childContextMap.threadEvent.drawDependencyLines(process, processKey, mode);
    return;
  }
  for (const [processKey, process] of processes.entries()) {
    if (processExpanded.get(processKey)) {
      childContextMap.threadEvent.drawDependencyLines(process, processKey, mode);
    }
  }
};

const clearDependencyLines = (processKey) => {
  childContextMap.threadEvent.clearDependencyLines(processKey);
  return;
};

const render = () => {
  if (!processedEvents.value.length && !counterEvents.value.length) return;
  renderTwoTimeline();
  renderEvent();
  renderDependencyLines();
  if(detailsPanelExpanded.value) {
    showDependencies(selectedEvent.value, "both");
  }
  timelineComponent.value.flagRender();
};

const drawFixedTimelineSlider = (ctx, canvas, startTimex, endTimex) => {
  ctx.strokeStyle = isDarkTheme.value ? 'rgba(255, 255, 255)' : 'rgba(25, 25, 25)';
  ctx.lineWidth = 6;

  let startx = startTimex;
  let endx = endTimex;

  // 极端场景处理用于区分
  if (endx - startx < 3) {
    endx = endx + 3;
  }

  if (endx > viewState.canvasCssWidth || endx === viewState.canvasCssWidth) {
    endx = viewState.canvasCssWidth;
  }
  
  const canvasCSSHeight = getCanvasCSSHeight(canvas);
  
  ctx.beginPath();
  ctx.moveTo(startx, 0);
  ctx.lineTo(startx, canvasCSSHeight / 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endx, 0);
  ctx.lineTo(endx, canvasCSSHeight / 3);
  ctx.stroke();

  ctx.strokeStyle = isDarkTheme.value ? 'rgba(255, 255, 255)' : 'rgba(25, 25, 25)';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.moveTo(startx, canvasCSSHeight / 3);
  ctx.lineTo(startx, canvasCSSHeight);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endx, 0);
  ctx.lineTo(endx, canvasCSSHeight);
  ctx.stroke();
}

const renderFixedTimeline = () => {
  const component = timelineComponent.value;
  if (!component || !component.fixedtimelineCtx || !component.fixedtimelineCanvas) return;

  const ctx = component.fixedtimelineCtx;
  const canvas = component.fixedtimelineCanvas;

  ctx.clearRect(0, 0, viewState.canvasCssWidth, canvas.offsetHeight);

  // 绘制背景
  ctx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, viewState.canvasCssWidth, canvas.offsetHeight);

  // 绘制时间网格
  ctx.strokeStyle = isDarkTheme.value ? '#3e3e42' : 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(viewState.canvasCssWidth, 20);
  ctx.stroke();

  let lastx = 0;
  let distance = 0;
  const canvasWidth = viewState.canvasCssWidth;
  const timePerPixel = viewState.timeRange / canvasWidth;
  const gridInterval = calculateGridInterval(timePerPixel);

  // 联动二段轴逻辑
  const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
  const startTime = viewState.minTime + Math.abs(viewState.offsetX * timelinePerPixel);
  const startTimex = fixedTimeToX(startTime) - layout.processLabelWidth;

  const endTime = startTime + (canvasWidth * timelinePerPixel);
  const endTimex = fixedTimeToX(endTime) - layout.processLabelWidth;
  const endSecondTimex = timeToX(viewState.maxTime) - layout.processLabelWidth;

  timelineState.startTime = startTime;
  timelineState.startTimeDecimal = startTime;
  timelineState.startTimeX = startTimex;
  timelineState.endTime = endTime;
  timelineState.endTimeDecimal = endTime;
  timelineState.endTimeX = endTimex;
  timeLineX.value = endSecondTimex;
  const gridIntervalDecimal = new BigNumber(gridInterval);
  const minTime = new BigNumber(viewState.minTime);
  const maxTime = new BigNumber(viewState.maxTime);
  for (let time = minTime; time.lte(maxTime); time = time.plus(gridIntervalDecimal)) {
    const x = fixedTimeToX(time, true) - layout.processLabelWidth;
    if (x >= 0 && x <= canvasWidth) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
      distance = x - lastx;
      const segmentWidth = distance / 10;
      for (let i = 1; i < 10; i++) {
        const segmentX = x + i * segmentWidth;
        ctx.beginPath();
        ctx.moveTo(segmentX, 20);
        ctx.lineTo(segmentX, 10);
        ctx.stroke();
      }

      const { value, unit } = TimelineWithUnit(viewState.timeRange, time.minus(minTime));
      ctx.fillStyle = isDarkTheme.value ? '#cccccc' : 'rgba(25, 25, 25, 1)';
      ctx.font = '14px Arial';
      if (x < startTimex || x > endTimex) {
        ctx.fillStyle = isDarkTheme.value ?  'rgba(102, 102, 102, 1)' : '#cccccc';
      }
      ctx.fillText(`${value}${unit}`, x + 2, 15);
    }
    lastx = x;
  }

  // 补齐未绘制的轴线
  for (let i = 1; i < 10; i++) {
      const segmentx = i * (distance / 10);
      ctx.beginPath();
      ctx.moveTo(segmentx, 20);
      ctx.lineTo(segmentx, 10);
      ctx.stroke();
  }
  if (isMeasureDragging.value && viewState.scale === 1) {
    const measureStartTimeX = measureDragStartX.value - layout.processLabelWidth;
    const measureEndTimeX = measureDragEndX.value - layout.processLabelWidth;
    drawFixedTimelineSlider(ctx, canvas, measureStartTimeX, measureEndTimeX);
    return;
  }
  drawFixedTimelineSlider(ctx, canvas, startTimex, endTimex)
};

const renderTimeline = () => {
  const component = timelineComponent.value;
  if (!component || !component.timelineCtx || !component.timelineCanvas) return;

  const ctx = component.timelineCtx;
  const canvas = component.timelineCanvas;

  ctx.clearRect(0, 0, viewState.canvasCssWidth, canvas.offsetHeight);

  // 绘制背景
  ctx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, viewState.canvasCssWidth, canvas.offsetHeight);

  // 绘制时间网格
  ctx.strokeStyle = isDarkTheme.value ? '#3e3e42' : 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;

  let x = 0;
  const timelineTimeRange = timelineState.endTime - timelineState.startTime;
  const canvasWidth = viewState.canvasCssWidth;
  const timePerPixel = timelineTimeRange / canvasWidth;
  const gridInterval = calculateGridInterval(timePerPixel);
  const gridIntervalDecimal = new BigNumber(gridInterval);
  const startTime = new BigNumber(timelineState.startTime);
  const endTime = new BigNumber(timelineState.endTime);
  const minTime = new BigNumber(viewState.minTime);
  for (let time = startTime; time.lte(endTime); time = time.plus(gridIntervalDecimal)) {
    x = timeToX(time, true) - layout.processLabelWidth;
    if (x < 0) {
      x = 0;
    }
    if (x >= 0 && x <= viewState.canvasCssWidth) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      const { value, unit } = TimelineWithUnit(viewState.timeRange, time.minus(minTime));
      ctx.fillStyle = isDarkTheme.value ? 'rgba(230, 230, 230)' : 'rgba(25, 25, 25)';
      ctx.font = '12px Arial';
      ctx.fillText(`${value}${unit}`, x + 2, 15);
      ctx.fillStyle = isDarkTheme.value ? 'rgba(230, 230, 230)' : 'rgba(25, 25, 25)';
      ctx.font = '12px Arial';
      const timeValue = xToTimeValue(time, true);
      ctx.fillText(`${timeValue}`, x + 2, 35);
    }
  }
    if (isMeasureDragging.value || measureDragCtrl.value) {
    const measureStartTimeX = measureDragStartX.value - layout.processLabelWidth;
    const measureEndTimeX = measureDragEndX.value - layout.processLabelWidth;
    drawMeasureTimeRange(ctx, measureStartTimeX, measureEndTimeX);
  }
};

const xToTimeValue = (time, isDecimal = false) => {
  const timeDelta = isDecimal ? time.minus(new BigNumber(viewState.minTime)) : (time - viewState.minTime);
  const currentTime = Math.round(timeDelta * 1000);
  let truncatedCurrentTime = currentTime;
  if (currentTime.toString().length > 10) {
    truncatedCurrentTime = parseInt(currentTime.toString().slice(-9));
  }
  let str = truncatedCurrentTime.toString().padStart(9, '0');
  str = str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return str;
}

const durationToWidth = (duration) => {
  if (!timelineComponent || !timelineComponent.value?.timelineCanvas) return 0;

  const canvasWidth = viewState.canvasCssWidth;
  const normalizedDuration = duration / viewState.timeRange;
  return normalizedDuration * canvasWidth * viewState.scale;
};

const fixedTimeToX = (time, isDecimal = false) => {
  if (!timelineComponent.value.fixedtimelineCanvas) return 0;

  const canvasWidth = viewState.canvasCssWidth;
  const relativeTime = isDecimal ? time.minus(new BigNumber(viewState.minTime)) : (time - viewState.minTime);
  const normalizedTime = relativeTime / viewState.timeRange;
  return layout.processLabelWidth + (normalizedTime * canvasWidth);
};


const xToFixedTime = (x) => {
  if (!timelineComponent.value.fixedtimelineCanvas) return null;

  const canvasWidth = getCanvasCSSWidth(timelineComponent.value.fixedtimelineCanvas);
  const xWithoutLabel = x - layout.processLabelWidth;
  const normalizedTime = xWithoutLabel / canvasWidth;
  return viewState.minTime + (normalizedTime * viewState.timeRange);
};


const timeToX = (time, isDecimal = false) => {
  if (!timelineComponent.value?.timelineCanvas) return 0;

  const canvasWidth = viewState.canvasCssWidth;
  const relativeTime = isDecimal ? time.minus(new BigNumber(viewState.minTime)) : (time - viewState.minTime);
  const normalizedTime = relativeTime / viewState.timeRange;
  return layout.processLabelWidth + (normalizedTime * canvasWidth * viewState.scale) + viewState.offsetX;
};

const xToTime = (x) => {
  if (!timelineComponent.value?.timelineCanvas) return 0;

  const canvasWidth = getCanvasCSSWidth(timelineComponent.value.timelineCanvas);
  const adjustedX = x - layout.processLabelWidth - viewState.offsetX;
  const normalizedTime = adjustedX / (canvasWidth * viewState.scale);
  const relativeTime = normalizedTime * viewState.timeRange;
  return viewState.minTime + relativeTime;
};

const toggleProcess = (processKey) => {
  const isExpanded = processExpanded.get(processKey);
  processExpanded.set(processKey, !isExpanded);
  // 如果当前打开的就是该process，则折叠即可
  if (isExpanded) {
    return;
  }

  // 如果曾经打开过，则展开即可，就不需要重新渲染了
  const process = processes.get(processKey);
  if (process.expanded) {
    return;
  }
  process.expanded = true;

  nextTick(() => {
    resizeCanvases(processKey, false);
    childContextMap.threadEvent.renderProcessEvents(process, processKey);
    const ctxInfo = ctxs[processKey];
    if (!ctxInfo) { return };
    for (const [ctxKey, ctx] of Object.entries(ctxInfo)) {
      ctx.save();
      ctx.setTransform(viewState.pixelScale, 0, 0, getDevicePixelRatio(), viewState.pixelOffsetX, 0);
    }
    const ctx = ctxInfo.eventCtx;
    childContextMap.threadEvent.transformEvents(process, processKey);
    childContextMap.threadEvent.renderProcessText(process, ctx);
    timelineComponent.value.flagRender();
  });
};

const selectEvent = (event, processKey) => {
  selectedEvent.value = event;
  if (event) {
    calculateHighlightedPaths(event);
    showDetailsPanel();
    childContextMap.threadEvent.changeNodeColor(processKey, true);
    renderDependencyLines(processKey);
  } else {
    childContextMap.threadEvent.changeNodeColor(processKey, false);
    clearDependencyLines(processKey);
  }
  const { eventCtx } = ctxs[processKey];
  childContextMap.threadEvent.drawThreadSeparators(eventCtx, processes.get(processKey), processKey);
};

const calculateHighlightedPaths = (event) => {
  if (!Object.keys(id2event).length) {
    processedEvents.value.forEach(element => {
      id2event[element.id] = element;
    });
  }
  highlightedPaths.clear();
  // 获取事件位置的辅助函数
  const getEventById = (eventId) => id2event[eventId];

  const addAllAncestors = (eventId, maxDepth) => {
    const visited = new Set();
    const queue = [{ id: eventId, depth: 0 }];

    while (queue.length > 0) {
      const { id : currentId, depth} = queue.shift();

      if (visited.has(currentId) || (depth > maxDepth && maxDepth != -1)) {
        continue;
      }

      visited.add(currentId);
      const currentEvent = getEventById(currentId);
      if (currentEvent) {
        highlightedPaths.add(currentEvent.id);
        currentEvent.dependencies.predecessors.forEach(predId => {
          if (!visited.has(predId)) {
            queue.push({ id: predId, depth: depth + 1});
          }
        });
      }
    }
  };

  const addAllDescendants = (eventId, maxDepth) => {
    const visited = new Set();
    const queue = [{ id: eventId, depth: 0 }];

    while (queue.length > 0) {
      const { id : currentId, depth} = queue.shift();

      if (visited.has(currentId) || (depth > maxDepth && maxDepth != -1)) {
        continue;
      }

      visited.add(currentId);
      const currentEvent = getEventById(currentId);
      if (currentEvent) {
        highlightedPaths.add(currentEvent.id);
        currentEvent.dependencies.successors.forEach(succId => {
          if (!visited.has(succId)) {
            queue.push({ id: succId, depth: depth + 1});
          }
        });
      }
    }
  };

  // 从选定事件开始，分别向前后遍历，设置最大层级
  addAllAncestors(event.id, userConfig.value.connectionLevel);
  addAllDescendants(event.id, userConfig.value.connectionLevel);

  // 确保选择的事件本身也被高亮显示
  highlightedPaths.add(event.id);
};

const findEventAtPosition = (x, y, processKey) => {
  let processObj = {
      event: null,
      altClickData: {
        preData: null,
        lastData: null,
        nodeSpacingX: 0
      },
    };
  const process = processes.get(processKey);
  if (!process) return null;

  // 遍历进程中的所有事件，检查点击位置
  for (const [threadKey, thread] of process.threads.entries()) {
    // 优化: 先确定目标位置的y坐标是否在当前泳道中,如果不在,及时返回
    const temp = thread.events[0];
    if (!temp) {
      continue;
    }
    const label = `${processKey}@${thread.tid}`;
    const lineCount = lane2line.get(label) || 1;
    if (temp.renderInfo) {
      const minY = temp.renderInfo.y;
      const maxY = minY + layout.threadHeight * lineCount;
      if (y < minY || y > maxY) {
        continue;
      }
    }
    thread.events.forEach((event, index) => {
      if (event.renderInfo) {
        const { x: eventX, y: eventY, height: eventHeight } = event.renderInfo;
        const eventWidth = event.drawData.eventWidth;
        if (x >= eventX && x <= eventX + eventWidth &&
          y >= eventY && y <= eventY + eventHeight) {
            processObj.event = event;
            return processObj;
        } else {
          const nextEvent = thread.events[index + 1];
          if(nextEvent){
              const { x: nextEventX } = nextEvent.renderInfo;
              if (x >= eventX + eventWidth && x <= nextEventX) {
                processObj.altClickData.preData = event;
                processObj.altClickData.lastData = nextEvent;
                processObj.altClickData.nodeSpacingX = nextEventX - (eventX + eventWidth);
                return processObj;
              }
            }
        }
      }
    });
  }

  return processObj;
};

const showDependencies = (event, type) => {
  const displayName = event.isCounter ? event.displayName : (event.name || 'Event');
  const predecessors = event.dependencies.predecessors.map(id => id2event[id]).filter(e => e);

  const successors = event.dependencies.successors.map(id => id2event[id]).filter(e => e);
  const canvas = document.getElementById('dependency-canvas');
  const canvasContainer = document.getElementById('canvas-container');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // 去掉margin-left
  const canvasWidth = canvasContainer.clientWidth - canvas.offsetLeft - layout.marginRight;
  const canvasHeight = Math.max(186, 20 * (Math.max(predecessors.length, successors.length) + 1));
  let actualWidth = canvasWidth / 5;
  setupHighDPICanvas(canvas, canvasWidth, canvasHeight);
  ctx.clearRect(0, 0, viewState.canvasWidth, canvas.height);
  const currentNode = {
      x:canvasWidth / 2 - canvasWidth / 10,
      y:10,
      width:actualWidth,
      height:16,
  }
  const eventColor = isDarkTheme.value ? event.color.dark : event.color.light;
  const colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
  let fillColor = eventColor ? eventColor.light : 'rgba(10, 89, 247, 0.3)';
  ctx.fillStyle = fillColor;
  ctx.roundRect(currentNode.x, currentNode.y, currentNode.width, currentNode.height, 4);
  ctx.fill();
  ctx.fillStyle = colorCfg.eventFontHighLight;
  ctx.font = '12px Arial';
  let [displayText, leftspace] = overflowText(actualWidth, displayName);
  ctx.fillText(displayText, currentNode.x + leftspace, currentNode.y + 12);
  const depFillColor = colorCfg.lightlyCompareBkgColor;
  if(type === "forward" || type === "both") {
      predecessors.forEach((pre, index) => {
          const preNode = {
              x:0,
              y:10 + index * 20,
              width:actualWidth,
              height:16,
          }
          ctx.beginPath();
          ctx.fillStyle = depFillColor;
          ctx.roundRect(preNode.x, preNode.y, preNode.width, preNode.height, 4);
          ctx.fill();
          ctx.closePath();
          ctx.fillStyle = colorCfg.eventFontNoColor;
          ctx.font = '12px Arial';
          let [displayText, leftspace] = overflowText(actualWidth, pre.isCounter ? pre.displayName:(pre.name || 'Event'));
          ctx.fillText(displayText, preNode.x + leftspace, preNode.y + 12);
          ctx.beginPath();
          ctx.moveTo(currentNode.x, currentNode.y + currentNode.height / 2);
          ctx.bezierCurveTo(currentNode.x + 5, 
                            currentNode.y + currentNode.height / 2 + 5,
                            preNode.x + preNode.width, 
                            preNode.y + preNode.height / 2 + 5,
                            preNode.x + preNode.width,
                            preNode.y + preNode.height / 2);
          var gradient = ctx.createLinearGradient(
            currentNode.x, currentNode.y + currentNode.height / 2,
            preNode.x + preNode.width, preNode.y + preNode.height / 2
          );
          gradient.addColorStop(0, fillColor);
          gradient.addColorStop(1, depFillColor);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 0.8;
          ctx.stroke();
      });
  }
  if(type === "backward" || type === "both") {
      successors.forEach((dep, index) => {
          const depNode = {
              x:canvasWidth * 0.8,
              y:10 + index * 20,
              width:actualWidth,
              height:16,
          };
          ctx.beginPath();
          ctx.fillStyle = depFillColor;
          ctx.roundRect(depNode.x, depNode.y, depNode.width, depNode.height, 4);
          ctx.fill();
          ctx.closePath();
          ctx.fillStyle = colorCfg.eventFontNoColor;
          ctx.font = '12px Arial';
          let [displayText, leftspace] = overflowText(actualWidth, dep.isCounter ? dep.displayName:(dep.name || 'Event'));
          ctx.fillText(displayText, depNode.x + leftspace, depNode.y + 12);
          ctx.beginPath();
          ctx.moveTo(currentNode.x + currentNode.width, currentNode.y + currentNode.height / 2);
          ctx.bezierCurveTo(currentNode.x + currentNode.width, 
                            currentNode.y + currentNode.height / 2 + 5,
                            depNode.x, 
                            depNode.y + depNode.height / 2 + 5,
                            depNode.x,
                            depNode.y + depNode.height / 2);
          var gradient = ctx.createLinearGradient(
            currentNode.x + currentNode.width, currentNode.y + currentNode.height / 2,
            depNode.x, depNode.y + depNode.height / 2
          );
          gradient.addColorStop(0, fillColor);
          gradient.addColorStop(1, depFillColor);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 0.8;
          ctx.stroke();
      });
  }
};

const overflowText = (actualWidth, text) => {
  let textWidth = getTextWidth(text, 12);
  const widthPerChar = textWidth / text.length;
  let maxCharsToFit = Math.floor(actualWidth / widthPerChar);

  let displayText = '';
  if (textWidth >= actualWidth && maxCharsToFit > 3) {
    maxCharsToFit -= 3;
    displayText = text.substr(0, maxCharsToFit) + '...';
  } else if (textWidth < actualWidth) {
    displayText = text;
  }

  let textStartX = (actualWidth - getTextWidth(displayText, 12)) / 2;
  return [displayText, textStartX];
};

const showDetailsPanel = () => {
  detailsPanelExpanded.value = true;
};

const toggleDetailsPanel = () => {
  detailsPanelExpanded.value = !detailsPanelExpanded.value;
};

const toggleDetailsCores = () => {
  detailsCoresExpanded.value = !detailsCoresExpanded.value;
};

const calculateMaxScale = () => {
  if (!timelineComponent.value.fixedtimelineCtx || !timelineComponent.value.fixedtimelineCanvas) return 10;
  const canvasWidth = viewState.canvasWidth;
  const calculateScale = (viewState.timeRange / canvasWidth) * 1000 * 100;
  const maxScale = Math.floor(calculateScale);
  return maxScale;
}

const initCanvases = () => {
  // 初始化画布
  if (timelineComponent.value) {
    timelineComponent.value.initCanvases();
  }
  const maxScale = calculateMaxScale();
  sliderMax.value = maxScale * 10;
  sliderMaxCount.value = Math.round(Math.log(maxScale) / Math.log(1.25));
};

const onWindowResize = throttle((event) => {
  const currentDevicePixelRatio = getDevicePixelRatio();
  const currentWindowWidth = window.innerWidth;
  
  // 如果只是纵向内容被遮盖且没有缩放变化，不需要重绘
  if (currentWindowWidth === viewState.windowWidth && currentDevicePixelRatio === devicePixelRatio) {
    return;
  }
  
  // 更新状态
  setDevicePixelRatio(currentDevicePixelRatio);
  viewState.windowWidth = currentWindowWidth;

  viewState.scale = 1;
  viewState.pixelScale = viewState.scale * getDevicePixelRatio();
  viewState.offsetX = 0;
  viewState.pixelOffsetX = viewState.offsetX * getDevicePixelRatio();
  sliderValue.value = 0;
  
  // 重新计算容器尺寸和canvas尺寸
  resizeCanvases();
  
  // 重新计算时间轴相关参数
  if (timelineComponent.value) {
    timelineComponent.value.resizeCanvases();
  }
  
  // 重新渲染所有内容
  render();
}, 50);

const resizeCanvases = (processKey, needResizeTimeline=true) => {
  if (!swimlaneContainer.value) return;

  const containerRect = swimlaneContainer.value.getBoundingClientRect();

  // 调整时间轴画布大小
  if (needResizeTimeline && timelineComponent.value) {
    timelineComponent.value.resizeCanvases();
  }

  if (processKey) {
    const process = processes.get(processKey);
    if (!process) return;
    updateProcessSize(process, processKey, containerRect, layout, lane2line, viewState);
    return;
  }

  for (const [key, process] of processes.entries()) {
    if (processExpanded.get(key)) {
      updateProcessSize(process, key, containerRect, layout, lane2line, viewState);
    }
  }
};

const resizeMeasure = () => {
  showDragAreaBorders.value = false;
  measureDragHeight.value = graphProcessesComponent.value.getProcessContainerHeight();
  document.documentElement.style.setProperty('--maskstart', `${measureDragStartX.value}px`);
  document.documentElement.style.setProperty('--maskend', `${measureDragEndX.value}px`);
  document.documentElement.style.setProperty('--maskHeight', `${measureDragHeight.value}px`);
}

const dragAreaStyle = () => {
  const width = Math.abs(measureDragEndX.value - measureDragStartX.value);
  const left = Math.min(measureDragStartX.value, measureDragEndX.value);
  const borderStyle = showDragAreaBorders.value ? '1px solid rgba(255, 255, 255, 0.2)' : 'none';
  return {
    left: `${left}px`,
    width: `${width}px`,
    height: '100%',
    borderLeft: borderStyle,
    borderRight: borderStyle,
  };
};

const measureMouseDown = (e) => {
  renderFixedTimeline();
  renderTimeline();

  if (!isMeasureModel.value) {
    return;
  }

  if(e.ctrlKey && e.buttons === 1) {
    measureDragCtrl.value = true;
    measureDragCtrlX.value = e.clientX;
    if (measureDragCtrlX.value - layout.processLabelWidth < 0) {
      measureDragCtrlX.value = layout.processLabelWidth;
    }
    return;
  }

  measureDragStartX.value = e.clientX;
  measureDragStartY.value = e.clientY;
  measureDragEndX.value = e.clientX;
  measureDragEndY.value = e.clientY;
  if (measureDragStartX.value - layout.processLabelWidth < 0) {
    measureDragStartX.value = layout.processLabelWidth;
  }
  isMeasureDragging.value = true;

  showDragAreaBorders.value = true;
  return;
}

const measureHandleWheel = (e) => {
  timelineComponent.value.handleWheel(e);
  const measureStartTimeX = measureDragStartX.value - layout.processLabelWidth;
  const measureEndTimeX = measureDragEndX.value - layout.processLabelWidth;
  const component = timelineComponent.value;
  if (!component || !component.timelineCtx || !component.timelineCanvas) return;
  const ctx = component.timelineCtx;
  drawMeasureTimeRange(ctx, measureStartTimeX, measureEndTimeX);
}

const drawMeasureArrow = (ctx, startx, endx, distance) => {
  const areaMidden = 20;
  const baypx = 6;
  ctx.beginPath();
  ctx.moveTo(startx, areaMidden);
  ctx.lineTo(startx + distance - baypx, areaMidden);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endx, areaMidden);
  ctx.lineTo(endx - distance + baypx, areaMidden);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(startx, areaMidden);
  ctx.lineTo(startx + baypx, areaMidden - baypx);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(startx, areaMidden);
  ctx.lineTo(startx + baypx, areaMidden + baypx);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endx, areaMidden);
  ctx.lineTo(endx - baypx, areaMidden - baypx);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endx, areaMidden);
  ctx.lineTo(endx - baypx, areaMidden + baypx);
  ctx.stroke();
}

const drawMeasureTimeTip = (ctx, rect, value, unit) => {
  ctx.fillStyle = 'rgba(49, 122, 247, 1)';
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '9px sans-serif';
  let textStart = rect.x + 2;
  let displayValue = value;
  if (unit === 'μs') {
    textStart += 2;
    if (value < 1) {
      displayValue = '<1';
    }
  }
  ctx.fillText(`${displayValue}${unit}`, textStart, 25);
};

const drawMeasureTimeRange = (ctx, startx, endx) => {
  let startX = startx;
  let endX = endx;
  if (endx > viewState.canvasCssWidth) {
    endX = viewState.canvasCssWidth;
  }
  if (startx > endx) {
    startX = endx;
    endX = startx;
  }
  const range = Math.abs(endx - startx);
  const timerange = Math.abs(xToTime(endx) - xToTime(startx));
  let {value, unit} = formatTimeWithUnit(timerange);
  const RectWidth = 35;
  const RectHigh = 12;

  // 绘制边距线
  ctx.strokeStyle = 'rgba(49, 122, 247, 1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, 10);
  ctx.lineTo(startX, 30);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, 10);
  ctx.lineTo(endX, 30);
  ctx.stroke();

  const distance = (range - RectWidth) / 2;
  let rect = {
    x:startX + distance,
    y:15,
    width:RectWidth,
    height:RectHigh,
  };
  // 绘制长方形
  if (range < RectWidth + 10) {
    rect.x = startX - 40;
    if (startX < 40) {
      rect.x = endX + 5;
    }
    drawMeasureTimeTip(ctx, rect, value, unit);
    return;
  }
  drawMeasureTimeTip(ctx, rect, value, unit);
  // 绘制箭头
  drawMeasureArrow(ctx, startX, endX, distance);
}

const measureMouseMove = (e) => {
  if (e.ctrlKey && e.buttons === 1) {
    if (viewState.scale === 1) {
      return;
    }
    const timeLineEndX = Math.abs(timeLineX.value);
    const deltaX = (e.clientX - measureDragCtrlX.value);
    const cssWidth = viewState.canvasCssWidth;
    if (deltaX < 0 && cssWidth > timeLineEndX) {
      return;
    }
    viewState.offsetX += childContextMap.threadEvent.getOffset(deltaX, viewState.scale);
    if (deltaX > 0 && viewState.offsetX > 0) {
      viewState.offsetX = 0;
    }
    render();
    return;
  }

  if (!isMeasureDragging.value) {
    return;
  }

  measureDragEndX.value = e.clientX;
  measureDragEndY.value = e.clientY;

  document.documentElement.style.setProperty('--maskstart', `${measureDragStartX.value}px`);
  document.documentElement.style.setProperty('--maskend', `${measureDragEndX.value}px`);
  return;
}

const measureMouseUp = () => {
  if (measureDragCtrl.value) {
    measureDragCtrl.value = false;
    return;
  }

  if (!isMeasureDragging.value) {
    return;
  }

  if (measureDragEndX.value - layout.processLabelWidth < 0) {
    measureDragEndX.value = layout.processLabelWidth;
  }

  intelligentSearch();

  isMeasureDragging.value = false;
  showDragAreaBorders.value = false;
  return;
}

const measureMouseLeave = (e) => {
  if (!isMeasureDragging.value) {
    return;
  }

  const rect = e.currentTarget.getBoundingClientRect();
  const mouseX = e.clientX;
  if (mouseX < rect.left) {
    measureDragEndX.value = layout.processLabelWidth;
  } else if (mouseX > rect.right) {
    measureDragEndX.value = viewState.canvasCssWidth + layout.processLabelWidth;
  }

  intelligentSearch();
  isMeasureDragging.value = false;
  return;
}

const intelligentSearch = () => {
  let start = measureDragStartX.value;
  let end = measureDragEndX.value;

  const startlineRange = [];
  // 吸附热区为16px
  startlineRange.push(xToTime(start - 16));
  startlineRange.push(xToTime(start + 16));

  const endlineRange = [];
  endlineRange.push(xToTime(end - 16));
  endlineRange.push(xToTime(end + 16));

  const foundStartTime = measureEventSearch(startlineRange, 'start');
  const foundEndTime = measureEventSearch(endlineRange, 'end');

  // 更新start和end的值
  if(foundStartTime !== null) {
    start = foundStartTime;
    measureDragStartX.value = timeToX(start);
  }

  if(foundEndTime !== null) {
    end = foundEndTime;
    measureDragEndX.value = timeToX(end);
  }

  if(measureDragStartX.value <= measureDragEndX.value) {
    document.documentElement.style.setProperty('--maskstart', `${measureDragStartX.value}px`);
    document.documentElement.style.setProperty('--maskend', `${measureDragEndX.value}px`);
  } else {
    document.documentElement.style.setProperty('--maskstart', `${measureDragEndX.value}px`);
    document.documentElement.style.setProperty('--maskend', `${measureDragStartX.value}px`);
  }

  renderFixedTimeline();
  renderTimeline();
}

const measureEventSearch = (lineRange, type) => {
  const lineRangeStart = lineRange[0];
  const lineRangeEnd = lineRange[1];
  const matchingEvents = [];
  let yLayer = 0;
  let result;

  if (type === "start") {
    result = childContextMap.threadEvent.realCoordinateY(measureDragStartY.value);
    yLayer = result.realY;
  } else if (type === "end") {
    result = childContextMap.threadEvent.realCoordinateY(measureDragEndY.value);
    yLayer = result.realY;
  }
  for (const [processKey, process] of processes.entries()) {
    if (result.processkey && process.expanded === false && processKey !== result.processkey) {
      continue;
    }
    const threads = process.threads;
    for (const [threadKey, thread] of threads.entries()) {
      for (const event of thread.events) {
        if ((event.startTime > lineRangeStart && event.startTime < lineRangeEnd) ||
          (event.endTime > lineRangeStart && event.endTime < lineRangeEnd)
        ) {
          matchingEvents.push(event);
        }
      }
    }
  }
  const measureTime = measureTimeSearch(matchingEvents, lineRange, yLayer, type);
  return measureTime;
}

const measureTimeSearch = (matchingEvents, lineRange, yLayer, type) => {
  const lineRangeStart = lineRange[0];
  const lineRangeEnd = lineRange[1];
  const rangeStart = Math.max(0, yLayer - 120);
  const rangeEnd = yLayer + 120;

  const filteredEvents = matchingEvents.filter(event => {
    return event.renderInfo && event.renderInfo.y >= rangeStart && event.renderInfo.y <= rangeEnd;
  });

  if (filteredEvents.length === 0) {
    return null;
  }
  let closestEvent = filteredEvents.reduce((prev, current) => {
    const prevDistance = Math.abs(prev.renderInfo.y - yLayer);
    const currentDistance = Math.abs(current.renderInfo.y - yLayer);
    return prevDistance < currentDistance ? prev : current;
  });

  if (type === 'start' || type === 'end') {
    const targetTime = type === 'start' ? closestEvent.startTime : closestEvent.endTime;
    const otherTime = type === 'start' ? closestEvent.endTime : closestEvent.startTime;

    if (targetTime > lineRangeStart && targetTime < lineRangeEnd) {
      return targetTime;
    } else if (otherTime > lineRangeStart && otherTime < lineRangeEnd) {
      return otherTime;
    }
  }
  return null;
}

const setPageState = (message) => {
  userConfig.value = message.configration;
  detailComponent.value.refLabel = userConfig.value.connectionLevel;
  if (message.comGraphPath) {
    bindFile.value = message.comGraphPath;
    bindButton.value = $t('unbindComGraph');
  }
};

// 生命周期钩子
onMounted(() => {
  initEventListeners();
  const oldMessage = /** @type { { message: object } | undefined } */ (vscode.getState());
  if (oldMessage && oldMessage.message.data) {
    setPageState(oldMessage.message);
    loadTraceData(oldMessage.message.data);
  } else {
    loading.value = true;
    postMessage({ command: 'getSwimData' });
  }
});
provide('swimCycleDisplay', { cycleDisplay, selectedOption, options });

provide('swimGraphContext', { addChildContext });
// 提供搜索状态
provide('swimGraphSearch', {searchResult, currentResultIndex, isSearchActive, searchQuery, isCaseSensitive});

provide('swimGraphCfg', { userConfig });

// provide pmu info
provide('swimGraphPmuTotal', {pmuTotal});

// 提供状态给子组件
provide('swimGraphState', {
  timelineComponent,
  viewState,
  layout,
  timeLineX,
  sliderValue,
  sliderMax,
  sliderMaxCount,
  initialScale,
  selectedEvent,
  highlightedPaths,
  processedEvents,
  processes,
  processExpanded,
  loading,
  detailsPanelExpanded,
  detailsCoresExpanded,
  swimlaneContainer,
  lane2line,
  timelineState,
  childContextMap,
  tooltip,
  tooltipStyle,
  bindFile,
  bindButton,
  isMeasureModel,
  measureDragStartX,
  measureDragEndX,
  isDarkTheme,
});

// 提供方法给子组件
provide('swimGraphMethods', {
  postMessage,
  render,
  renderFixedTimeline,
  renderTimeline,
  calculateGridInterval,
  showDependencies,
  toggleDetailsPanel,
  toggleDetailsCores,
  toggleProcess,
  selectEvent,
  findEventAtPosition,
  timeToX,
  xToTime,
  durationToWidth,
  renderDependencyLines,
  resizeMeasure,
  renderEvent,
  transform,
  getTimelineCanvas: () => { return timelineComponent?.value.timelineCanvas; },
  handleWheel: (e) => { timelineComponent?.value.handleWheel(e) },
  leftmove: (step) => { swimgraphHeaderComponent?.value.leftmove(step) },
  rightmove: (step) => { swimgraphHeaderComponent?.value.rightmove(step) }
});
watch(isDarkTheme, () => {
  updateTheme();
  transform();
});

const updateTheme = () => {
  iconPath3.value = isDarkTheme.value ? `${window.staticPath}/static-assets/icon_title_3.svg` : `${window.staticPath}/static-assets/icon_title_3_light.svg`;
  down_16px.value  = isDarkTheme.value ? `${window.staticPath}/static-assets/down_16px.svg` : `${window.staticPath}/static-assets/down_16px_light.svg`;
}
</script>

<style>
@import url("css/common.css");
</style>
<style scoped>
@import url("css/mainGraph.css");
</style>