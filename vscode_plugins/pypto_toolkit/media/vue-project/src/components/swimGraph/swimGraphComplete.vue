<template>
  <div style="height: 100vh;" class="swim-global-container">
    <div :class="['sticky-block', isSwimGraphActive ? 'visible' : 'hidden']">
      <div class="drag-icon-container">
        <DragIcon v-if="isThreeColumn" />
      </div>
      <swim-graph-header ref="swimgraphHeaderComponent" v-if="isThreeColumn"/>
    </div>
    <div :style="{display: 'flex',height: isSwimGraphActive ? 'calc(100% - 40px)' : '100%' }">
    <div class="container event-container"   
      :style="containerStyle">
      <Loading v-if="loading" :loadingText="loadingText" :warningText="warningText" />
      <div class="head-container" v-show="!loading">
        <div class="title" :style="{ width: layout.processLabelWidth + 'px' }" :class="{ 'title-threeColumn': isThreeColumn}">
          <div class="title_up_threecolum" v-show="isThreeColumn" id="swim-title_up_threecolum">
            <img class="title_pic_threecolum" :src="titlePath" alt="title-picture" />
            <div class="title_up_r_threecolum">
              <div class="title_up_threecolum_filename">
                <fileSelect v-if="isThreeColumn" :file-name="swimFileName" :file-paths="filePaths" />
                <div class="title_time">{{ formattedTime }}</div>
              </div>
            </div>
          </div>
          <Navbar v-if="!isThreeColumn && outPutPath" current-step="swimGraph" :current-record-directory-path="outPutPath" />
          <div class="title_up" v-if="!isThreeColumn && !outPutPath">
            <img class="title_pic" :src="titlePath" alt="title-picture" />
            <div class="title_up_r">
              <div class="workflow-container">
                <d-tooltip :content="fileName + '.json'">
                  <div class="simple-file-name">{{ fileName }}.json</div>
                </d-tooltip>
              </div>
              <div class="title_time">{{ formattedTime }}</div>
            </div>
          </div>
          <div class="title_up" v-if="!isThreeColumn && !outPutPath"></div>
          <div class="title_down" v-if="!isThreeColumn && !outPutPath">
            <d-tooltip :content="$t('tips1')">
              <img class="title_icon1" :src="iconPath1" alt="iconPath1-picture" />
            </d-tooltip>
            <div class="dashed-line"></div>
            <d-tooltip :content="$t('tips2')">
              <img class="title_icon2" :src="iconPath2" alt="iconPath2-picture" @click="onJumpCom"/>
            </d-tooltip>
            <div class="dashed-line"></div>
            <div class="title_down3">
              <img class="title_icon3" :src="iconPath3" alt="iconPath3-picture" />
              <div class="title_name">{{ $t('swimGraph') }}</div>
            </div>
          </div>
        </div>
        <div class="right-header-content" style="width: calc(100% - 250px)">
          <!-- 按钮操作区 -->
          <swim-graph-header v-if="!isThreeColumn" ref="swimgraphHeaderComponent" />
          <div class="swimlane-container" :class="{ mr16: !isGuidePage }" ref="swimlaneContainer">
            <!-- 时间轴区域 -->
            <swim-graph-timeline ref="timelineComponent" />
          </div>
          <swim-graph-config ref="configComponent" />
          <swim-graph-shortCutKey-descrition ref="shortCutKeyDescritionComponent" />
        </div>
      </div>
      <div class="main-view" v-show="!loading">
        <!-- 度量蒙板 -->
        <div
            class="measure-mask"
            v-if="isMeasureModel || isMaxSchedule"
            @mousedown="measureMouseDown($event)"
            @mousemove="measureMouseMove($event)"
            @mouseup="measureMouseUp()"
            @mouseleave="measureMouseLeave($event)"
            @wheel="measureHandleWheel($event)"
          >
            <div class="measure-drag-area"></div>
        </div>
        <!-- 置顶线程区域 -->
        <pinned-threads-container v-if="!isThreeColumn && pinnedThreadsList.length > 0" ref="pinnedthreadsComponent"/>
        <div id="main-swim" class="swimlane-container scroller-container swimlane-scroller-container" ref="swimlaneContainer" :style="containerStyles">
          <!-- 全局跨 process 连接线画布 -->
          <global-connection-canvas 
            v-if="!isMixedAicpuKernel"
            ref="globalConnectionCanvas"
            :container-width="containerWidth"
            :container-height="containerHeight"
          />
          <!-- 进程和线程区域 -->
          <swim-graph-processes ref="graphProcessesComponent" />
        </div>
        <swim-graph-measure-detail v-if="!isAicpu" ref="measureDetailComponent" />
        <!-- 详情区域 -->
        <swim-graph-detail ref="detailComponent" />
        <!-- AICPU控制详情区域 -->
        <aicpu-control-detail ref="aicpuControlDetailComponent" />
        <!-- AICPU调度详情区域 -->
        <aicpu-schedule-detail ref="aicpuscheduleDetailComponent" />        
        <!-- AICPU core详情区域 -->
        <aicpu-core-detail ref="aicpuCoreDetailComponent" />
      </div>
    </div>
      <div 
        :style="{
        width: performanceWidth.value + 'px',
        height: '100%'
        }" 
        v-if="(!loadingComplete) && performanceVisible" >
        <Teleport to="body">
          <swim-graph-performance ref="swimGraphPerformacneComponent" v-if="performanceVisible"/>
        </Teleport>
      </div>
    </div>
    <div class="tooltip" ref="tooltip" :style="tooltipStyle"></div>
    <div class="linetooltip" ref="lineTooltip" :style="lineTooltipStyle"></div>
    <div 
      v-if="pinnedMeasureInfo.show"
      class="pinned-measure-info"
      :style="{
        left: pinnedMeasureInfo.x + 'px',
        top: pinnedMeasureInfo.y + 'px',
      }"
    >
      {{ pinnedMeasureInfo.text }}
    </div>
  </div>
  <global-message></global-message>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch, nextTick, provide, inject, toRef, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { getReader } from '@pypto/data-compress/reader';
import SwimGraphHeader from './swimGraphHeader/swimGraphHeader.vue';
import SwimGraphTimeline from './swimGraphTimeline/swimGraphTimeline.vue';
import SwimGraphProcesses from './swimGraphProcesses/swimGraphProcesses.vue';
import SwimGraphDetail from './swimGraphDetail/swimGraphDetail.vue';
import SwimGraphMeasureDetail from './swimGrapMeasurehDetail/swimGraphMeasureDetail.vue';
import SwimGraphConfig from './swimGraphConfig/swimGraphConfig.vue';
import SwimGraphShortCutKeyDescrition from './swimGraphShortCutKeyDescripiton/swimGraphShortCutKeyDescripiton.vue';
import swimGraphPerformance from './swimGraphPerformance/swimGraphPerformance.vue';
import aicpuControlDetail from './swimGraphAicpuDetail/aicpuControlDetail.vue';
import aicpuScheduleDetail from './swimGraphAicpuDetail/aicpuScheduleDetail.vue';
import globalMessage from './globalMessage.vue';
import aicpuCoreDetail from './swimGraphAicpuDetail/aicpuCoreDetail.vue';
import Navbar from '@/components/navbar/navbar.vue';
import PinnedThreadsContainer from './swimGraphPinnedThreads/PinnedThreadsContainer.vue';
import { usePinnedThreads } from './swimGraphPinnedThreads/usePinnedThreads';
import GlobalConnectionCanvas from './swimGraphProcesses/GlobalConnectionCanvas.vue';
import { swimDataManager } from './swimData';
import { getQuery } from '@/core/query';
import { getTextWidth, layoutFakeCoreEvent } from '../../utils';
import {
  calculateGridInterval,
  ctxs,
  TimelineWithUnit,
  formatTimeWithUnit,
  devicePixelRatio,
  setDevicePixelRatio,
  updateProcessSize,
  processTimeInfo,
  getCanvasCSSHeight,
  getCanvasCSSWidth,
  getDevicePixelRatio,
  COLOR_CFG,
  processesToMap,
  SNAP_THRESHOLD,
  NARROW_WIDTH_THRESHOLD,
  findSchedTaskByNo,
  findBuildTaskByNo,
  clearWholeProcess,
  findSchedGraphMap,
  findSchedCoreMapByNo,
  findSchedCoreEventsByNo,
  findSchedMapByNo,
  findSchedEventsByNo,
  findCoreMapByNo,
  findCoreEventsByNo,
  parseSuffixNumbers,
} from './swimGraphUtils';
import Loading from '../comGraph/loading.vue';
import { throttle } from 'lodash-es';
import EventBus from '../../service/event-bus';
import { ThreeColumnProvideKey } from '../threeColumn/types';
import DragIcon from '../threeColumn/drag-icon.vue';
import fileSelect from '../threeColumn/file-select.vue';
import { useViewServer } from '../../core/use-view-server';
import { pushState, pullState } from '../../core/state';
import { swimConfig } from '../welcome/guideStepsConfig';
import { intelligentSearchHelper } from './swimGrapMeasurehDetail/helper';
import { globalKeyEvent } from './eventHandler';
import { getKernalEventColor } from './swimGraphProcesses/render/utils';

const { server } = useViewServer();

const swimGraphPerformacneComponent = ref(null);

const props = defineProps({
  isThreeColumn: {
    type: Boolean,
    default: false,
  },
  swimFileName: {
    type: String,
    default: ''
  },
  filePaths: {type: Object, default: {}}
});

const { isDarkTheme } = inject('root');
const threeColumnCtx = inject(ThreeColumnProvideKey, undefined);
const { t: $t } = useI18n();
const titlePath = ref(`${window.staticPath}/static-assets/title_40px.svg`);
const iconPath1 = ref(`${window.staticPath}/static-assets/icon_title_1.svg`);
const iconPath2 = ref(`${window.staticPath}/static-assets/icon_title_2.svg`);
let iconPath3 = ref(`${window.staticPath}/static-assets/icon_title_3.svg`);
let down_16px = ref(`${window.staticPath}/static-assets/down_16px.svg`);
const {
  isSwimFullscreen = ref(false),
  currentActiveBlock = ref(''),
  BlockToGraphMap = {},
  onToggleSwimFullscreen = () => {},
} = inject(ThreeColumnProvideKey, {});
// 响应式状态
const swimlaneContainer = ref(null);
const timelineComponent = ref(null);
const detailComponent = ref(null);
const measureDetailComponent = ref(null);
const graphProcessesComponent = ref(null);
const swimgraphHeaderComponent = ref(null);
const aicpuCoreDetailComponent = ref(null);
const globalConnectionCanvas = ref(null); 
const configComponent = ref(null);
const shortCutKeyDescritionComponent = ref(null);
const pinnedthreadsComponent = ref(null);
const timeLineX = ref(null);
const traceData = ref(null);
const tsScale = ref(1000);
const minTs = ref(0);
const processes = reactive(new Map());
const counterEvents = ref([]);
const lastSelected = ref(null);
const selectedEvent = ref(null);
const canvasclickedEvent = ref(null);
const pathLockedEvent = ref(null);
const isPathLockStatus = ref(false);
const highlightedPaths = reactive(new Set());
const processExpanded = reactive(new Map());
const loading = ref(false);
const loadingComplete = ref(true);
const loadingText = ref($t('loadTraceData'));
const warningText = ref('');
const detailsPanelExpanded = ref(false);
const detailsCoresExpanded = ref(false);
const tooltip = ref(null);
const lineTooltip = ref(null);
const tooltipStyle = reactive({
  display: 'none',
  left: '0px',
  top: '0px',
});
const lineTooltipStyle = reactive({
  display: 'none',
  left: '0px',
  top: '0px',
});
const pinnedMeasureInfo = reactive({
  show: false,
  x: 0,
  y: 0,
  text: ''
});
const bindFile = ref(false);
const bindButton = ref($t('bindComGraphJson'));
const isSwimGraphActive = ref(false);
const fileName = ref('');
const modeOption = ref('');
const isCfgEditing = ref(false);
const isShortcutKeyShow = ref(false);
const isAicpu = ref(false);
const isPerfSwim = ref(false);
const aicpuControlDetailsExpanded = ref(false);
const aicpuScheduleDetailsExpanded = ref(false);
const aicpuCoreDetailsExpanded = ref(false);
const scheduleList = ref([]);
const aicpuBuildTask = ref();
const aicpuSchedTask = ref('');
const aicpuHasRelevent = ref(false);

const isMixedAicpuKernel = ref(false);
const isGuidePage = ref(false);

const isMeasureModel = ref(false);
const isMeasureDragging = ref(false);
const showDragAreaBorders = ref(false);
const measureDragStartX = ref(0);
const measureDragEndX = ref(0);
const measureDragStartTime = ref(0);
const measureDragEndTime = ref(0);
const measureDragStartY = ref(0);
const measureDragEndY = ref(0);
const measureDragHeight = ref(0);
const measureDragCtrl = ref(false);
const measureDragCtrlX = ref(0);
const mulDetailsExpanded = ref(false);

let globalMousePosition = { x: 0, y: 0 };
const measureDetailsExpanded = ref(false);
const measureDetailsData = ref([]);
const rootHashes = ref([]);
const leafHashes = ref([]);
const leafHashMap = ref(new Map());
let isLockStatus = ref(false);
const labelRender = ref(false);
const dependencyLinesInfo = ref([]);
const outPutPath = ref();
const aicpuScheduleEventMaps = ref([]);
const aicpuScheduleMaps = ref(new Map());

let sliderValue = ref(0);
const sliderMax = ref(100);
const sliderMaxCount = ref(100);
const initialScale = ref(1);
const isMaxSchedule = ref(false);
let startEventId;
let endEventId;
const kernelThreadData = ref(new Map());
const viewState = reactive({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  minTime: 0,
  maxTime: 0,
  timeRange: 0,
  canvasCssWidth: 0,
  canvasWidth: 0,
  clearInfo: {},
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
  marginRight: 10,
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
  startTimeDecimal: 0,
  endTimeDecimal: 0,
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
});

const lane2line = reactive(new Map());
const userConfig = reactive(new Map());

const childContextMap = {};
const addChildContext = (childName, ctx) => {
  childContextMap[childName] = ctx;
};

const searchResult = ref([]);
const currentResultIndex = ref(0);
const isSearchActive = ref(false);
const searchedEvent = ref(null);
const searchQuery = ref('');
const isCaseSensitive = ref(false);

const pmuTotal = ref({});
const timeInfo = ref({});

const performanceVisible = ref(false);
const performanceWidth = ref(480);
const emit = defineEmits(['update-shared-swim-data']);
const isWideScreen = ref(true);
const screenWidth = ref(window.innerWidth);

if (screenWidth.value < 1500) {
  isWideScreen.value = false;
}

if (isWideScreen.value) {
  performanceWidth.value = 480;
} else {
  performanceWidth.value = 340;
}

watch(performanceWidth, async (newValue) => {
    await nextTick();
    doResize();
  });
watch(performanceVisible, async (newValue) => {
  emit('update-shared-swim-data', {
    performanceWidth,
    performanceVisible
  });
  if (newValue) {
    await nextTick();
    doResize();
  }
});
const containerStyle = computed(() => ({
  width: performanceVisible.value && !props.isThreeColumn ? `calc(100% - ${performanceWidth.value}px)` : '100%',
}));

// 使用置顶线程 composable
const { pinnedThreads, pinnedThreadsList, pinThread, unpinThread, restorePinnedState } = usePinnedThreads(
  processes
);

const handleGlobalMouseMove = (e) => {
  globalMousePosition = { x: e.clientX, y: e.clientY };
};

const handleGlobalKeyDown = (e) => { globalKeyEvent(e, globalMousePosition, layout, 'keydown') };

const handleGlobalKeyUp = (e) => { globalKeyEvent(e, globalMousePosition, layout, 'keyup') };

// 方法
const initEventListeners = () => {
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousemove', handleGlobalMouseMove);
  window.addEventListener('keydown', handleGlobalKeyDown);
  window.addEventListener('keyup', handleGlobalKeyUp);
};

function generateErrorMsg(msg) {
  return { msg };
}

function setupSwimWatchers() {
  watch(server.bindResult, (newValue) => {
    if (newValue.success) {
      bindFile.value = newValue.comGraphPath;
      bindButton.value = $t('unbindComGraph');
    } else {
      bindFile.value = false;
      bindButton.value = $t('bindComGraphJson');
    }
  });
  watch(server.unbindResult, (newValue) => {
    if (newValue.success) {
      bindFile.value = false;
      bindButton.value = $t('bindComGraphJson');
    } else {
      bindFile.value = newValue.comGraphPath;
      bindButton.value = $t('unbindComGraph');
    }
  });
  watch(server.noSwimFile, (newValue) => {
    const errorMsg = generateErrorMsg(`${ERROR_MESSAGES.FILE_NOT_FOUND}`);
    errorMsg.log = newValue.errMsg;
    window.ascEventBus.emit('jsonParseError', errorMsg);
  });
  watch(server.dataError, (newValue) => {
    window.ascEventBus.emit('jsonParseError', newValue);
  });
  watch(server.performanceWarn, (newValue) => {
    warningText.value = newValue;
  });
}

let ERROR_MESSAGES = {
  INVALID_FILE: $t('swimErroMsgINVALID_FILE'),
  MISSING_EVENT_FIELDS: $t('swimErroMsgMISSING_EVENT_FIELDS'),
  MISSING_END_EVENT: $t('swimErroMsgMISSING_END_EVENT'),
  MISSING_DUR: $t('swimErroMsgMISSING_DUR'),
  INVALID_ARGS: $t('swimErroMsgINVALID_ARGS'),
  MISSING_PROCESS_NAME: $t('swimErroMsgMISSING_PROCESS_NAME'),
  MISSING_THREADS_FIELDS: $t('swimErroMsgMISSING_THREADS_FIELDS'),
  NO_THREADS: $t('swimErroMsgNO_THREADS'),
  NO_PROCESS_NAME: $t('swimErroMsgNO_PROCESS_NAME'),
  FILE_NOT_FOUND: $t('swimErroMsgFILE_NOT_FOUND'),
  NOT_JSON: $t('swimErroMsgNot_JSON'),
};

window.ascEventBus.on('threeColumnSizeChange', () => {
  onWindowResize();
});

const validData = (dataStr) => {
  let data = {};
  try {
    data = JSON.parse(dataStr);
  } catch (error) {
    window.ascEventBus.emit('jsonParseError', generateErrorMsg(`${ERROR_MESSAGES.NOT_JSON}`));
    return;
  }
  if (!data || !data.traceEvents || !Array.isArray(data.traceEvents)) {
    window.ascEventBus.emit('jsonParseError', generateErrorMsg(`${ERROR_MESSAGES.INVALID_FILE}`));
    return;
  }

  let hasProcessName = false;
  let countThread = 0;

  const eventMap = new Map();
  data.traceEvents.forEach((event) => {
    const key = `${event.name}-${event.id}`;
    if (!eventMap.has(key)) {
      eventMap.set(key, []);
    }
    eventMap.get(key).push(event);
  });

  data.traceEvents.forEach((event) => {
    if (
      ['B', 'E', 'X'].includes(event.ph) &&
      (!event.name || typeof event.pid === 'undefined' || typeof event.tid === 'undefined' || typeof event.ts === 'undefined')
    ) {
      window.ascEventBus.emit('jsonParseError', generateErrorMsg(`${ERROR_MESSAGES.MISSING_EVENT_FIELDS}: ["${event.name || event.id}"]`));
    }

    if (event.ph === 'B') {
      const key = `${event.name}-${event.id}`;
      const endEvent = eventMap.get(key) || [];
      const hasE = endEvent.some((e) => e.ph === 'E');
      if (!hasE) {
        window.ascEventBus.emit('jsonParseError', generateErrorMsg(`${ERROR_MESSAGES.MISSING_END_EVENT}: ["${event.name}"]`));
      }
    } else if (event.ph === 'X') {
      if (!event.dur) {
        window.ascEventBus.emit('jsonParseError', generateErrorMsg(`${ERROR_MESSAGES.MISSING_DUR}: ["${event.name}"]`));
      }
    } else if (event.ph === 'C') {
      if (!event.args || (typeof event.args.size !== 'number' && typeof event.args['/byte'] !== 'number')) {
        window.ascEventBus.emit('jsonParseError', generateErrorMsg(`${ERROR_MESSAGES.INVALID_ARGS}: ["${event.name}"]`));
      }
    }

    if (event.name === 'process_name') {
      hasProcessName = true;
      if (typeof event.pid === 'undefined' || !event.args || !event.args.name) {
        window.ascEventBus.emit('jsonParseError', generateErrorMsg(`${ERROR_MESSAGES.MISSING_PROCESS_NAME}: ["${event.args.name}"]`));
      }
    }

    if (event.name.includes('thread')) {
      countThread += 1;
      if (typeof event.pid === 'undefined' || typeof event.tid === 'undefined' || !event.args || !event.args.name) {
        window.ascEventBus.emit('jsonParseError', generateErrorMsg(`${ERROR_MESSAGES.MISSING_THREADS_FIELDS}: ["${event.args.name}"]`));
      }
    }
  });

  if (countThread === 0) {
    window.ascEventBus.emit('jsonParseError', generateErrorMsg(ERROR_MESSAGES.NO_THREADS));
  }

  if (!hasProcessName) {
    window.ascEventBus.emit('jsonParseError', generateErrorMsg(ERROR_MESSAGES.NO_PROCESS_NAME));
  }
};

const loadTraceData = (data) => {
  try {
    processTraceData(data);
    loading.value = false;
    loadingComplete.value = false;
  } catch (error) {
    console.error($t('loadTraceDataError'), error);
    loading.value = true;
    loadingComplete.value = true;
  }
};

const processTraceData = (data) => {
  pmuTotal.value = data.pmu_total;
  timeInfo.value = data.timeInfo;
  let isFirst = true;
  let firstExpanded = true;
  for (const key in data.processes) {
    if (Object.prototype.hasOwnProperty.call(data.processes, key)) {
      if (props.isThreeColumn && data.processes[key].type === 'aicpu') {
        delete data.processes[key];
        continue;
      }
      if (firstExpanded) {
        processExpanded.set(key, true);
        firstExpanded = false;
      }
      data.processes[key].isRendered = isFirst;
      isFirst = false;
      data.processes[key].threads = new Map(Object.entries(data.processes[key].threads));
      processes.set(key, data.processes[key]);
    }
  }

  if (props.isThreeColumn) {
    processTimeInfo(timeInfo, data);
  }
  
  if (data.tsScale) {
    tsScale.value = data.tsScale;
  }
  
  if (data.minTs) { minTs.value = data.minTs }

  counterEvents.value = data.counterEvents;
  for (const key in data.lane2line) {
    if (Object.prototype.hasOwnProperty.call(data.lane2line, key)) {
      lane2line.set(key, data.lane2line[key]);
    }
  }
  if (timeInfo.value) {
    viewState.minTime = timeInfo.value.minTime;
    viewState.maxTime = timeInfo.value.maxTime;
    viewState.timeRange = viewState.maxTime - viewState.minTime;
  }

  processes.forEach((value) => {
    const cThread = new Map([...value.threads.entries()].filter((item) => item[1].isCounter).sort());
    const eThread = new Map([...value.threads.entries()].filter((item) => !item[1].isCounter).sort((a, b) => {
      return Number(a[0].split('-')[1]) - Number(b[0].split('-')[1]);
    }));
    value.threads = new Map([...eThread.entries(), ...cThread.entries()]);
    if (isPerfSwim.value) {
      value.type = 'PerfSwim';
    }
  });

  let allAicpu = true;
  for (const process of processes.values()) {
    if (process.type !== 'aicpu') {
      allAicpu = false;
      break;
    }
  }
  isAicpu.value = allAicpu;

  swimDataManager.initialize(processes);

  isMixedAicpuKernel.value = swimDataManager.isMixedData();

   if (props.isThreeColumn) {
     isMixedAicpuKernel.value = false;
  }

  nextTick(() => {
    initCanvases();
    resizeCanvases();
 
    if (!userConfig.value.showPerformancePanel || props.isThreeColumn || isGuidePage.value) {
      render();
    }
    // 恢复置顶状态
    restorePinnedState();
  });
};

const transform = (needClean=false) => {
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
  if (pinnedthreadsComponent && pinnedthreadsComponent.value) {
    pinnedthreadsComponent.value.Pinnedtransform();
  }
  if (needClean) {
    return;
  }
  renderDependencyLines();
  for (const [processKey, process] of processes.entries()) {
    if (processExpanded.get(processKey) && process.type === 'aicpu' && selectedEvent.value) {
      highlightAicpu(process, processKey, true);
    }
  }
  drawMeasureTime();
  timelineComponent.value.flagRender();
  if (props.isThreeColumn) {
    childContextMap.threadEvent.resizeDrawBoundary();
    childContextMap.threadEvent.toggleLock();
  }
  if (mulDetailsExpanded.value && !isMeasureModel.value) {
    childContextMap.threadEvent.drawSelectionBox();
    childContextMap.threadEvent.drawSelectionHightlight();
  }
};

const renderTwoTimeline = () => {
  // 渲染两段时间轴
  renderFixedTimeline();
  renderTimeline();
};

const renderEvent = () => {
  for (const [processKey, process] of processes.entries()) {
    childContextMap.threadEvent.renderProcessEvents(process, processKey);
    const ctx = ctxs[processKey].eventCtx;
    if (processExpanded.get(processKey)) {
      childContextMap.threadEvent.renderProcessText(process, ctx);
    }
  }
};

const renderDependencyLines = (processKey) => {
  if (!processKey && !selectedEvent.value && !searchedEvent.value) {
    if (globalConnectionCanvas.value) {
      globalConnectionCanvas.value.clearCanvas();
    }
    return;
  }
  const mode = viewState.depMode;
  const key = processKey || selectedEvent.value?.pid?.toString() || searchedEvent.value?.pid?.toString();
  if (key) {
    const process = processes.get(key);
    if (!globalConnectionCanvas.value) {
      if (isMaxSchedule.value) {
        childContextMap.threadEvent.drawMaxScheduleLine(startEventId, endEventId, process, key);
      } else {
        childContextMap.threadEvent.drawDependencyLines(process, key, mode);
      }
    } else {
      if (isMaxSchedule.value) {
        globalConnectionCanvas.value.drawMaxScheduleLine(startEventId, endEventId);
      } else {
        globalConnectionCanvas.value.drawGlobalConnectionLines();
      }
    }
  }
};

const clearDependencyLines = (processKey) => {
  if (globalConnectionCanvas.value) {
    globalConnectionCanvas.value.clearCanvas();
  } else {
    childContextMap.threadEvent.clearDependencyLines(processKey);
  }
  return;
};
const getAicpuDependencyCanvas = (processKey) => {
  const dependencyCanvasRef = document.querySelector(`[data-dep-process-key="${processKey}"]`);
  if (!dependencyCanvasRef) { return false };
  const dependencyCtx = dependencyCanvasRef.getContext('2d');
  clearWholeProcess(dependencyCtx, viewState, processKey);
  return dependencyCtx;
};
const guideRestore = async () => {
  timelineComponent.value.clearFlagCanvas(true);
  timelineComponent.value.toggleEditModel();
  await swimgraphHeaderComponent?.value.clearHeadState();
  detailComponent?.value.resetReleventState();
  resetState();
  transform(true);
  mulDetailsExpanded.value = false;
  swimlaneContainer.value.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
  isMeasureDragging.value = false;
  isMeasureModel.value = false;
  showDragAreaBorders.value = false;
};

const render = () => {
  resetState();
  renderTwoTimeline();
  renderEvent();
  renderDependencyLines();
  if (detailsPanelExpanded.value) {
    detailComponent?.value.showDependencies(selectedEvent.value, 'both');
  }
  timelineComponent.value.flagRender();
  if (props.isThreeColumn) {
    childContextMap.threadEvent.drawLockedOutline();
  }
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
};

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

  const endTime = startTime + canvasWidth * timelinePerPixel;
  const endTimex = fixedTimeToX(endTime) - layout.processLabelWidth;
  const endSecondTimex = timeToX(viewState.maxTime) - layout.processLabelWidth;

  timelineState.startTime = startTime;
  timelineState.startTimeDecimal = startTime;
  timelineState.startTimeX = startTimex;
  timelineState.endTime = endTime;
  timelineState.endTimeDecimal = endTime;
  timelineState.endTimeX = endTimex;
  timeLineX.value = endSecondTimex;
  for (let time = viewState.minTime; time <= viewState.maxTime; time += gridInterval) {
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

      const { value, unit } = TimelineWithUnit(viewState.timeRange, (time - viewState.minTime) * 1000 / tsScale.value);
      ctx.fillStyle = isDarkTheme.value ? '#cccccc' : 'rgba(25, 25, 25, 1)';
      ctx.font = '14px Arial';
      if (x < startTimex || x > endTimex) {
        ctx.fillStyle = isDarkTheme.value ? 'rgba(102, 102, 102, 0.8)' : '#cccccc';
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
  drawFixedTimelineSlider(ctx, canvas, startTimex, endTimex);
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
  for (let time = timelineState.startTime; time <= timelineState.endTime; time += gridInterval) {
    x = timeToX(time, true) - layout.processLabelWidth;
    if (x < 0) {
      x = 0;
    }
    if (x >= 0 && x <= viewState.canvasCssWidth) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      const { value, unit } = TimelineWithUnit(viewState.timeRange, (time - viewState.minTime) * 1000 / tsScale.value);
      ctx.fillStyle = isDarkTheme.value ? 'rgba(230, 230, 230)' : 'rgba(25, 25, 25)';
      ctx.font = '12px Arial';
      ctx.fillText(`${value}${unit}`, x + 2, 15);
      ctx.fillStyle = isDarkTheme.value ? 'rgba(230, 230, 230)' : 'rgba(25, 25, 25)';
      ctx.font = '12px Arial';
      const timeValue = xToTimeValue(time, true);
      ctx.fillText(`${timeValue}`, x + 2, 35);
    }
  }
  if (isMeasureDragging.value) {
    const measureStartTimeX = measureDragStartX.value - layout.processLabelWidth;
    const measureEndTimeX = measureDragEndX.value - layout.processLabelWidth;
    drawMeasureTimeRange(ctx, measureStartTimeX, measureEndTimeX);
  }
};

const xToTimeValue = (time) => {
  const timeDelta = time - viewState.minTime;
  const currentTime = Math.round(timeDelta);
  let truncatedCurrentTime = currentTime;
  if (currentTime.toString().length > 10) {
    truncatedCurrentTime = parseInt(currentTime.toString().slice(-9));
  }
  let str = truncatedCurrentTime.toString().padStart(9, '0');
  str = str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return str;
};

const durationToWidth = (duration) => {
  if (!timelineComponent || !timelineComponent.value?.timelineCanvas) return 0;

  const canvasWidth = viewState.canvasCssWidth;
  const normalizedDuration = duration / viewState.timeRange;
  return normalizedDuration * canvasWidth * viewState.scale;
};

const fixedTimeToX = (time) => {
  if (!timelineComponent.value.fixedtimelineCanvas) return 0;

  const canvasWidth = viewState.canvasCssWidth;
  const relativeTime = time - viewState.minTime;
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

const timeToX = (time) => {
  if (!timelineComponent.value?.timelineCanvas) return 0;

  const canvasWidth = viewState.canvasCssWidth;
  const relativeTime = time - viewState.minTime;
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

  // 如果曾经打开过，为了保证缩放比例等正确，也需要再次绘制
  const process = processes.get(processKey);
  let needRender = !process.isRendered;
  process.isRendered = true;

  nextTick(() => {
    resizeCanvases(processKey, false);
    if (needRender) {
      childContextMap.threadEvent.renderProcessEvents(process, processKey);
    }
    const ctxInfo = ctxs[processKey];
    if (!ctxInfo) {
      return;
    }
    for (const [ctxKey, ctx] of Object.entries(ctxInfo)) {
      ctx.save();
      ctx.setTransform(viewState.pixelScale, 0, 0, getDevicePixelRatio(), viewState.pixelOffsetX, 0);
    }
    const ctx = ctxInfo.eventCtx;
    childContextMap.threadEvent.transformEvents(process, processKey);
    childContextMap.threadEvent.renderProcessText(process, ctx);
    timelineComponent.value.flagRender();
    drawKernalEvents();
  });
};
const drawKernalEvents = () => {
  let processKey = '';
  for (const [key, processItem] of processes) {
    if (processItem.type === 'kernel') {
      processKey = key;
      break;
    }
  }
  const ctxInfo = ctxs[processKey];
  if (!ctxInfo) {
    return;
  }
  const ctx = ctxInfo.eventCtx;
  const kernalEvents = kernelThreadData.value.events || [];
  if (!aicpuCoreDetailsExpanded.value && kernalEvents.length === 0) {
    return;
  }
  let eventDatas = [];
  kernalEvents.forEach((event, index, array) => {
    const colors = handleKernalEventColors(event, processKey, false, false);
    const { fillColor, fontColor, strokeColor } = colors;
    event.drawData.rectColor = fillColor;
    event.drawData.strokeColor = strokeColor;
    event.drawData.fontColor = fontColor;
    eventDatas.push(event.drawData);
  });
  childContextMap.threadEvent.eventRenderer.drawEvent(eventDatas, ctx);
  childContextMap.threadEvent.eventRenderer.drawEventText(eventDatas, ctx);
};
const handleKernalEventColors = (event, processKey, highlight = false, stroke = true) => {
  return getKernalEventColor(event, childContextMap.threadEvent.eventRenderer.deps, processKey, highlight, stroke);
};
const updatePanelState = (event, processKey, showkernelDetail) => {
  if (event) {
    const process = processes.get(processKey);
    if (process.type === 'aicpu') {
      const { threadName } = event;
      const isCtrl = threadName.includes('AICPU-CTRL');
      const isSched = threadName.includes('AICPU-SCHED');
      aicpuControlDetailsExpanded.value = isCtrl;
      aicpuScheduleDetailsExpanded.value = isSched;
      aicpuCoreDetailsExpanded.value = !isCtrl && !isSched;
      detailsPanelExpanded.value = false;
    } else {
      aicpuControlDetailsExpanded.value = false;
      aicpuScheduleDetailsExpanded.value = false;
      aicpuCoreDetailsExpanded.value = !showkernelDetail;
      showDetailsPanel(showkernelDetail);
    }
  } else {
    detailsPanelExpanded.value = false;
  }
};
const selectEvent = (event, processKey, showkernelDetail = true, forceExec = false) => {
  updatePanelState(event, processKey, showkernelDetail);
  const noChange = (event && event.id === lastSelected.value) || (!event && !lastSelected.value);
  if (!forceExec && noChange) {
    return;
  }
  selectedEvent.value = event;
  if (event) {
    lastSelected.value = event.id;
    const process = processes.get(processKey);
    if (process.type === 'aicpu') {
      highlightedPaths.clear();
      highlightAicpu(process, processKey, false);
    } else {
      calculateHighlightedPaths(event);
      childContextMap.threadEvent.changeNodeColor(processKey, true);
      renderDependencyLines(processKey);
    }
    if (pinnedthreadsComponent && pinnedthreadsComponent.value) {
      pinnedthreadsComponent.value.changePinnedColor(true);
      pinnedthreadsComponent.value.highlightPinnedEvent(event);
    }
  } else {
    lastSelected.value = null;
    childContextMap.threadEvent.changeNodeColor(processKey);
    clearDependencyLines(processKey);
    if (pinnedthreadsComponent && pinnedthreadsComponent.value) {
      pinnedthreadsComponent.value.changePinnedColor(false);
    }
  }
  for (const [key, process] of processes.entries()) {
    if (!process.isRendered || !processExpanded.get(key) || !ctxs[key]) {
      continue;
    }
    if (key !== processKey) {
      childContextMap.threadEvent.changeNodeColor(key, Boolean(selectedEvent.value));
      if (!globalConnectionCanvas.value) {
        clearDependencyLines(key);
      }
    }
    const { eventCtx } = ctxs[key];
    childContextMap.threadEvent.drawThreadSeparators(eventCtx, processes.get(key), key);
  }
};

const highlightAicpu = (process, processKey, isResize) => {
  const eventName = selectedEvent.value.name;
  if (process.pid !== selectedEvent.value.pid) {
    return;
  }
  if (eventName.includes('DEV_')) {
    aicpuHasRelevent.value = true;
  } else {
    aicpuHasRelevent.value = false;
  }
  const result = parseSuffixNumbers(eventName);
  const { roundNo, taskNo } = result;
  const { threads } = process;
  const { threadName } = selectedEvent.value;
  childContextMap.threadEvent.changeNodeColor(processKey, true);
  const ctx = getAicpuDependencyCanvas(processKey);
  if (!ctx) { return };
  const isCtrl = threadName.includes('AICPU-CTRL');
  const isSched = threadName.includes('AICPU-SCHED');
  let aicpuEventsData = [];
  let drawDatas = [];
  const schedGraphMap= findSchedGraphMap(threads);
  aicpuScheduleMaps.value = schedGraphMap;
  if (isCtrl) {
    const schedCoreMap = findSchedCoreMapByNo(selectedEvent.value, threads);
    aicpuEventsData = findSchedCoreEventsByNo(schedCoreMap);
    scheduleList.value = findSchedTaskByNo(taskNo, roundNo, process);
  } else if (isSched) {
    const schedNo = threadName.split('-').pop();
    const schedMap = findSchedMapByNo({roundNo, taskNo, schedNo}, eventName, threads, selectedEvent.value);
    aicpuEventsData = findSchedEventsByNo(schedMap);
    aicpuScheduleEventMaps.value = [];
    aicpuScheduleEventMaps.value = aicpuEventsData;
    aicpuBuildTask.value = findBuildTaskByNo(schedMap);
  } else {
    if (aicpuCoreDetailComponent.value && !isResize) {
      aicpuCoreDetailComponent.value.renderCoreDetailCanvas();
    }
    const threadNameMatch = threadName.match(/SCHED(?<schedNo>\d+)/);
    const schedNo = threadNameMatch?.groups?.schedNo;
    const coreMap = findCoreMapByNo(schedNo, threadName, selectedEvent.value, threads);
    aicpuEventsData = findCoreEventsByNo(coreMap);
    aicpuBuildTask.value = findBuildTaskByNo(coreMap);
    aicpuSchedTask.value = `AICPU-SCHED-${schedNo}`;
  }
  for (const eventItme of aicpuEventsData) {
    highlightedPaths.add(eventItme.id);
    childContextMap.threadEvent.updateDrawDataColor(eventItme, childContextMap.threadEvent.eventRenderer.deps, processKey);
    drawDatas.push(eventItme.drawData);
  }
  childContextMap.threadEvent.eventRenderer.drawEvent(drawDatas, ctx);
  childContextMap.threadEvent.eventRenderer.drawEventText(drawDatas, ctx);
  childContextMap.threadEvent.highlightEvent(ctx, selectedEvent.value, processKey, true, true);
  if (!kernelThreadData.value || typeof kernelThreadData.value !== 'object' || Object.keys(kernelThreadData.value).length === 0) {
    return;
  }
  shadingKernal();
};
const shadingKernal = () => {
  let processKey = '';
  for (const [key, processItem] of processes) { 
    const {type, pid} = processItem;
    if (type === 'kernel') {
      processKey = pid.toString();
      break; 
    }
  }
  processExpanded.set(processKey, false);
  toggleProcess(processKey);
};
const resetMaxScheduleState = () => {
  isMaxSchedule.value = false;
  selectedEvent.value = null;
  highlightedPaths.clear();
  transform();
};

const autoExpandkernelProcess = async () => {
  const kernelProcesses = Array.from(processes.values()).filter(p => p.type === 'kernel');
  for (const kernelPro of kernelProcesses) {
    const kernelKey = String(kernelPro.pid);
    const isExpanded = processExpanded.get(kernelKey);
    if (!isExpanded) {
      childContextMap.processHeaderEvent.handleToggleProcess();
      await nextTick();
    }
  }
};

const showMaxScheduleEvent = async (startEvent, endEvent) => {
  if (!startEvent || !endEvent) {
    return;
  }
  if (isSearchActive.value) {
    swimgraphHeaderComponent?.value.resetsearchState();
  }
  if (isMixedAicpuKernel.value) {
    await autoExpandkernelProcess();
  }
  isMaxSchedule.value = true;
  startEventId = startEvent.id;
  endEventId = endEvent.id;
  highlightedPaths.clear();
  highlightedPaths.add(startEventId);
  highlightedPaths.add(endEventId);
  lastSelected.value = selectedEvent.value;
  selectedEvent.value = startEvent;
  const processKey = String(startEvent.pid);
  const process = processes.get(processKey);
  detailsPanelExpanded.value = false;
  mulDetailsExpanded.value = false;

  if (process) { 
    measureDragStartX.value =  timeToX(startEvent.endTime);
    measureDragEndY.value = timeToX(endEvent.startTime);
    measureDragStartTime.value = xToTime(measureDragStartX.value);
    measureDragEndTime.value = xToTime(measureDragEndY.value);
    setMeasureDragHeight();
  }
};

const setMeasureDragHeight = () => {
  const processHeight = graphProcessesComponent.value.getProcessContainerHeight();
  let measureHeight = processHeight;
  if (pinnedthreadsComponent && pinnedthreadsComponent.value) {
    const pinnedHeight = pinnedthreadsComponent.value.getPinnedHeight();
    measureHeight += pinnedHeight;
  }
  measureDragHeight.value = measureHeight;
  document.documentElement.style.setProperty('--maskHeight', `${measureDragHeight.value}px`);
};

const calculateHighlightedPaths = (event) => {
  highlightedPaths.clear();

  const addAllAncestors = (eventId, maxDepth) => {
    const visited = new Set();
    const queue = [{ id: eventId, depth: 0 }];

    while (queue.length > 0) {
      const { id: currentId, depth } = queue.shift();

      if (visited.has(currentId) || (depth > maxDepth && maxDepth != -1)) {
        continue;
      }

      visited.add(currentId);
      const currentEvent = swimDataManager.getEventById(currentId);
      if (currentEvent) {
        highlightedPaths.add(currentEvent.id);
        currentEvent.dependencies.predecessors.forEach((predId) => {
          if (!visited.has(predId)) {
            queue.push({ id: predId, depth: depth + 1 });
          }
        });
      }
    }
  };

  const addAllDescendants = (eventId, maxDepth) => {
    const visited = new Set();
    const queue = [{ id: eventId, depth: 0 }];

    while (queue.length > 0) {
      const { id: currentId, depth } = queue.shift();

      if (visited.has(currentId) || (depth > maxDepth && maxDepth != -1)) {
        continue;
      }

      visited.add(currentId);
      const currentEvent = swimDataManager.getEventById(currentId);
      if (currentEvent) {
        highlightedPaths.add(currentEvent.id);
        currentEvent.dependencies.successors.forEach((succId) => {
          if (!visited.has(succId)) {
            queue.push({ id: succId, depth: depth + 1 });
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
      nodeSpacingX: 0,
    },
  };
  const process = processes.get(processKey);
  if (!process) return null;
  // 用于记录最后一个有效的间隙（仅当无吸附时使用）
  let fallbackAltClickData = null;
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
    const result = searchEventsInThread(thread, x, y);
    if (result.foundEvent) {
      processObj.event = result.foundEvent;
      return processObj;
    }
    if (result.fallback) {
      fallbackAltClickData = result.fallback;
    }
  }
  if (fallbackAltClickData) {
    processObj.altClickData = fallbackAltClickData;
  }
  return processObj;
};

const searchEventsInThread = (thread, x, y) => {
  let fallbackAltClickData = null;
  const eventsOnCurrentLine = [];
  
  for (let index = 0; index < thread.events.length; index++) {
    const event = thread.events[index];
    if (!event.renderInfo) {
      continue;
    }
    const { x: eventX, y: eventY, height: eventHeight } = event.renderInfo;
    const { eventWidth } = event.drawData;
    
    if (y >= eventY && y <= eventY + eventHeight) {
      if (x >= eventX && x <= eventX + eventWidth) {
        return {
          foundEvent: event,
          fallback: null
        };
      }
      
      const { pixelScale } = viewState;
      const isNarrow = eventWidth * pixelScale <= NARROW_WIDTH_THRESHOLD;
      if (isNarrow && event.renderEndTime >= timelineState.startTime && event.renderStartTime <= timelineState.endTime) {
        // 吸附
        const snapThresholdInTime = SNAP_THRESHOLD / pixelScale;
        const eventRange = [eventX - snapThresholdInTime, eventX + eventWidth]; // 只扩充左边的吸附范围，避免右侧吸附范围包含了右侧节点时，选不中右侧节点的情况
        if (x >= eventRange[0] && x <= eventRange[1]) {
          return {
            foundEvent: event,
            fallback: null
          };
        }
      }
      
      eventsOnCurrentLine.push({ event, eventX, eventWidth });
    }
  }
  
  if (eventsOnCurrentLine.length < 2) {
    return {
      foundEvent: null,
      fallback: null
    };
  }
  
  for (let i = 0; i < eventsOnCurrentLine.length - 1; i++) {
    const { event, eventX, eventWidth } = eventsOnCurrentLine[i];
    const { event: nextEvent, eventX: nextEventX } = eventsOnCurrentLine[i + 1];
    
    if (x >= eventX + eventWidth && x <= nextEventX) {
      fallbackAltClickData = {
        preData: event,
        lastData: nextEvent,
        nodeSpacingX: nextEventX - (eventX + eventWidth),
      };
      break;
    }
  }
  return {
    foundEvent: null,
    fallback: fallbackAltClickData
  };
};

const getDisplayName = (event) => {
  let { name: displayName } = event;
  const textOption = userConfig.value.kernelTextRending ?? ['taskName', 'taskLabel'];
  if (textOption.length === 1 && textOption[0] === 'taskName') {
    displayName = displayName.split('(')[0].trim();
  } else if (textOption.length === 1 && textOption[0] === 'taskLabel') {
    const labelPart = displayName.match(/\((?<label>[^)]+)\)/);
    displayName = labelPart ? labelPart.groups.label.trim() : '';
  }
  return displayName;
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

const getEventDisplayName = (e) => {
  return (e?.name || '');
};
const getThreadDisplayName = (e) => {
  return (e?.threadName || '');
};
const getEventColor = (e) => {
  if (!e || !e.color) {
    return 'rgba(10, 89, 247, 0.3)';
  }
  return isDarkTheme.value ? e.color.dark?.base : e.color.light?.base;
};
const dynamicWidthStyle = (event) => {
  if (event) {
    const eventColor = isDarkTheme.value ? event.color.dark : event.color.light;
    const colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
    let fillColor = eventColor ? eventColor.base : 'rgba(10, 89, 247, 0.3)';
    const fontColor = colorCfg.eventFont;
    return {background:fillColor, color: fontColor};
  }
  return {};
};

const showDetailsPanel = (showkernelDetail) => {
  if (!showkernelDetail) {
    return;
  }
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
};

const initCanvases = () => {
  // 初始化画布
  if (timelineComponent.value) {
    timelineComponent.value.initCanvases();
  }
  const maxScale = calculateMaxScale();
  sliderMax.value = maxScale * 10;
  sliderMaxCount.value = Math.round(Math.log(maxScale) / Math.log(1.25));
};

const resetState = () => {
  viewState.scale = 1;
  viewState.pixelScale = viewState.scale * getDevicePixelRatio();
  viewState.offsetX = 0;
  viewState.pixelOffsetX = viewState.offsetX * getDevicePixelRatio();
  sliderValue.value = 0;
};

const doResize = () => {
  const currentDevicePixelRatio = getDevicePixelRatio();
  const currentWindowWidth = window.innerWidth;

  // 如果只是纵向内容被遮盖且没有缩放变化，不需要重绘
  if (currentWindowWidth === viewState.windowWidth && currentDevicePixelRatio === devicePixelRatio && !isSwimGraphActive) {
    return;
  }

  // 更新状态
  setDevicePixelRatio(currentDevicePixelRatio);
  viewState.windowWidth = currentWindowWidth;

  resetState();

  // 重新计算容器尺寸和canvas尺寸
  resizeCanvases();

  // 重新计算时间轴相关参数
  if (timelineComponent.value) {
    timelineComponent.value.resizeCanvases();
  }

  // 重新渲染所有内容
  render();
  if (pinnedthreadsComponent && pinnedthreadsComponent.value) {
    pinnedthreadsComponent.value.pinnedInitCanvases();
    pinnedthreadsComponent.value.pinnedRender();
  }
  drawMeasureTime();
  timelineComponent.value.observationLineResize();
  childContextMap.threadEvent.distanceMeasurementResize();
  if (aicpuCoreDetailsExpanded.value) {
    aicpuCoreDetailComponent.value.renderCoreDetailCanvas();
    drawKernalEvents();
    setTimeout(() => {
      aicpuCoreDetailComponent.value.handleHighKernelEvents();
    });
  }
};

const onWindowResize = throttle(() => {
  doResize();
}, 50);

const resizeCanvases = (processKey, needResizeTimeline = true) => {
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
    updateProcessSize(process, key, containerRect, layout, lane2line, viewState);
  }
};

const resizeMeasure = () => {
  showDragAreaBorders.value = false;
  setMeasureDragHeight();
  document.documentElement.style.setProperty('--maskstart', `${measureDragStartX.value}px`);
  document.documentElement.style.setProperty('--maskend', `${measureDragEndX.value}px`);
};

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
  measureDetailsExpanded.value = false;
  renderFixedTimeline();
  renderTimeline();

  if (!isMeasureModel.value) {
    return;
  }

  if (e.ctrlKey && e.buttons === 1) {
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
};

const measureHandleWheel = (e) => {
  timelineComponent.value.handleWheel(e);
  drawMeasureTime();
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    swimlaneContainer.value.scrollTop += e.deltaY;
  }
};

const drawMeasureTime = () => {
  if (!isMeasureModel.value && !isMaxSchedule.value) {
    return;
  }
  let drawMeasureStartX = timeToX(measureDragStartTime.value);
  let drawMeasureEndX = timeToX(measureDragEndTime.value);

  if (drawMeasureStartX > drawMeasureEndX) {
    const temp = drawMeasureEndX;
    drawMeasureEndX = drawMeasureStartX;
    drawMeasureStartX = temp;
  }

  if (drawMeasureStartX - layout.processLabelWidth < 0) {
    drawMeasureStartX = layout.processLabelWidth;
  }

  if (drawMeasureEndX - layout.processLabelWidth > viewState.canvasCssWidth) {
    drawMeasureEndX = viewState.canvasCssWidth + layout.processLabelWidth;
  }

  document.documentElement.style.setProperty('--maskstart', `${drawMeasureStartX}px`);
  document.documentElement.style.setProperty('--maskend', `${drawMeasureEndX}px`);

  const measureStartTimeX = drawMeasureStartX - layout.processLabelWidth;
  const measureEndTimeX = drawMeasureEndX - layout.processLabelWidth;
  const component = timelineComponent.value;
  if (!component || !component.timelineCtx || !component.timelineCanvas) {
    return;
  }
  const ctx = component.timelineCtx;
  drawMeasureTimeRange(ctx, measureStartTimeX, measureEndTimeX);
};

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
};

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
  let { value, unit } = formatTimeWithUnit(timerange * 1000 / tsScale.value);
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
    x: startX + distance,
    y: 15,
    width: RectWidth,
    height: RectHigh,
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
};

const measureMouseMove = (e) => {
  if (e.ctrlKey && e.buttons === 1) {
    if (viewState.scale === 1) {
      return;
    }
    const timeLineEndX = Math.abs(timeLineX.value);
    const deltaX = e.clientX - measureDragCtrlX.value;
    const cssWidth = viewState.canvasCssWidth;
    if (deltaX < 0 && cssWidth > timeLineEndX) {
      return;
    }
    viewState.offsetX += childContextMap.threadEvent.getOffset(deltaX, viewState.scale);
    if (deltaX > 0 && viewState.offsetX > 0) {
      viewState.offsetX = 0;
    }
    viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
    transform();
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
};

const measureMouseUp = () => {
  if (isMaxSchedule.value) {
    resetMaxScheduleState();
    return;
  }

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
  measureDetailSearch();

  isMeasureDragging.value = false;
  showDragAreaBorders.value = false;
  if (Math.abs(measureDragEndX.value - measureDragStartX.value) > 5) {
    mulDetailsExpanded.value = true;
    measureDetailsExpanded.value = true;
    detailsPanelExpanded.value = false;
    aicpuControlDetailsExpanded.value = false;
    aicpuScheduleDetailsExpanded.value = false;
    aicpuCoreDetailsExpanded.value = false;
    return;
  }
  return;
};

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
  measureDetailSearch();
  isMeasureDragging.value = false;
  if (Math.abs(measureDragEndX.value - measureDragStartX.value) > 5) {
    mulDetailsExpanded.value = true;
    measureDetailsExpanded.value = true;
    detailsPanelExpanded.value = false;
    return;
  }
  return;
};

const processThreadEventSearch = (thread, startTime, endTime) => {
  const matchedEvents = [];
  for (const event of thread.events) {
    if (event.startTime >= startTime && event.endTime <= endTime) {
      matchedEvents.push(event);
    }
  }
  return matchedEvents;
};

const hashMatchDataGet = (eventHint, eventTime) => {
  const eventTimeMs = eventTime / 1000;
  if (eventHint) {
    const rootHashMatch = eventHint.match(/rootHash:(?<hash>\d+)/);
    const leafHashMatch = eventHint.match(/leafHash:(?<hash>\d+)/);
    if (leafHashMatch && rootHashMatch) {
      const [, leafHash] = leafHashMatch;
      const [, rootHash] = rootHashMatch;
      if (!rootHashes.value.includes(rootHash)) {
        rootHashes.value.push(rootHash);
      }

      if (!leafHashes.value.includes(leafHash)) {
        leafHashes.value.push(leafHash);
      }
      const key = `${leafHash}_${rootHash}`;
      if (leafHashMap.value.has(key)) {
        const stats = leafHashMap.value.get(key);
        stats.Occurrences++;
        stats['Wall duration'] += eventTimeMs;
        stats['Avg Wall duration'] = stats['Wall duration'] / stats.Occurrences;
      } else {
        leafHashMap.value.set(key, {
          Occurrences: 1,
          'Wall duration': eventTimeMs,
          'Avg Wall duration': eventTimeMs,
          'root hash': rootHash,
          'leaf hash': leafHash,
        });
      }
    }
  }
};

const measureDetailGet = (matchingAICEvents, matchingAIVEvents, timeRange, AICCount, AIVCount) => {
  let AICoretime = 0;
  let AICtime = 0;
  let AIVtime = 0;

  let cubeCycle = 0;
  let vectorCycle = 0;

  if (matchingAICEvents.length !== 0) {
    for (const [key, event] of matchingAICEvents.entries()) {
      const eventTime = event.endTime - event.startTime;
      AICtime += eventTime;
      if (event.pmu_info) {
        cubeCycle += Number(event.pmu_info.cube_busy_cycles);
        vectorCycle += Number(event.pmu_info.vec_busy_cycles);
      }
      const eventHint = event.args['event-hint'];
      hashMatchDataGet(eventHint, eventTime);
    }
  }

  if (matchingAIVEvents.length !== 0) {
    for (const [key, event] of matchingAIVEvents.entries()) {
      const eventTime = event.endTime - event.startTime;
      AIVtime += eventTime;
      if (event.pmu_info) {
        cubeCycle += Number(event.pmu_info.cube_busy_cycles);
        vectorCycle += Number(event.pmu_info.vec_busy_cycles);
      }
      const eventHint = event.args['event-hint'];
      hashMatchDataGet(eventHint, eventTime);
    }
  }

  const AICoreCount = AICCount + AIVCount;
  AICoretime = AICtime + AIVtime;
  const AICoreUsage = (AICoretime / (timeRange * AICoreCount)) * 100;
  const AICUsage = (AICtime / (timeRange * AICCount)) * 100;
  const AIVUsage = (AIVtime / (timeRange * AIVCount)) * 100;

  const eventNum = matchingAICEvents.length + matchingAIVEvents.length;

  measureDetailsData.value.push({
    AICoreusage: AICoreUsage.toFixed(2),
    AICusage: AICUsage.toFixed(2),
    AIVusage: AIVUsage.toFixed(2),
    cubecycle: cubeCycle,
    vectorcycle: vectorCycle,
    eventnum: eventNum,
  });
};

const measureDetailSearch = () => {
  measureDetailsData.value = [];
  rootHashes.value = [];
  leafHashes.value = [];
  leafHashMap.value.clear();

  let startTime = measureDragStartTime.value;
  let endTime = measureDragEndTime.value;

  if (startTime > endTime) {
    const temp = startTime;
    startTime = endTime;
    endTime = temp;
  }

  const timeRange = endTime - startTime;
  const matchingAICEvents = [];
  const matchingAIVEvents = [];

  let AICCount = 0;
  let AIVCount = 0;

  const processedThreads = new Set();

  for (const [processKey, process] of processes.entries()) {
    const processType = process.type || 'kernel';
    if (!processExpanded.get(processKey) || processType != 'kernel') {
      continue;
    }
    const { threads } = process;
    for (const [threadKey, thread] of threads.entries()) {
      const threadId = `${processKey}-${threadKey}`;
      processedThreads.add(threadId);
      if (thread.threadName.startsWith('AIC_')) {
        AICCount++;
        matchingAICEvents.push(...processThreadEventSearch(thread, startTime, endTime));
      } else if (thread.threadName.startsWith('AIV_')) {
        AIVCount++;
        matchingAIVEvents.push(...processThreadEventSearch(thread, startTime, endTime));
      }
    }
  }

  for (const [key, pinnedData] of pinnedThreads.entries()) {
    const { process, thread } = pinnedData;
    const processType = process.type || 'kernel';
    if (processType != 'kernel') {
      continue;
    }
    const threadId = `${pinnedData.processKey}-${pinnedData.threadKey}`;
    if (processedThreads.has(threadId)) {
      continue;
    }
    if (thread.threadName.startsWith('AIC_')) {
      AICCount++;
      matchingAICEvents.push(...processThreadEventSearch(thread, startTime, endTime));
    } else if (thread.threadName.startsWith('AIV_')) {
      AIVCount++;
      matchingAIVEvents.push(...processThreadEventSearch(thread, startTime, endTime));
    }
  }
  measureDetailGet(matchingAICEvents, matchingAIVEvents, timeRange, AICCount, AIVCount);
};

const intelligentSearch = () => {
  intelligentSearchHelper({
    measureDragStartX,
    measureDragEndX,
    measureDragStartY: measureDragStartY.value,
    measureDragEndY: measureDragEndY.value,
    measureDragStartTime,
    measureDragEndTime,
    xToTime,
    timeToX,
    childContextMap,
    processes,
    processExpanded,
    pinnedThreads,
    pinnedthreadsComponent,
    renderFixedTimeline,
    renderTimeline
  });
};

const setPageState = (message) => {
  userConfig.value = message.config;
  if (message.config && message.config.showPerformancePanel !== undefined) {
    performanceVisible.value = message.config.showPerformancePanel && !props.isThreeColumn && !isGuidePage.value;
  }

  modeOption.value = userConfig.value.kernelColorRending;
  configComponent.value.connectionLevel = userConfig.value.connectionLevel;
  detailComponent.value.connectionLevel = userConfig.value.connectionLevel;
  configComponent.value.showPerformancePanel = userConfig.value.showPerformancePanel;
  if (message.comGraphPath) {
    bindFile.value = message.comGraphPath;
    bindButton.value = $t('unbindComGraph');
  }
  if (isLockStatus.value) {
    isLockStatus.value = false;
    window.ascEventBus.emit('deactivateLock');
  }
};

const onToggleSwimFullscreenFunction = () => {
  onToggleSwimFullscreen();
};

const onJumpCom = () => {
  const jumpType = 'nohash';
  server.jumpToComGraph({paramObj: { hash: jumpType }});
};

const parseCompressedData = (swimInfo) => {
  const swimData = getReader(swimInfo);
  const label2lines = {};
  swimData.lane2line = swimData.computeLane2Line();
  let processedTasks = [];
  let expandSet = false;
  for (const processId in swimData.processes) {
    if (!Object.prototype.hasOwnProperty.call(swimData.processes, processId)) { continue }
    if (!expandSet) {
      processExpanded.set(processId, true);
      expandSet = true;
    } else {
      processExpanded.set(processId, false);
    }
    const process = swimData.processes[processId];
    for (const threadId in process.threads) {
      if (!Object.prototype.hasOwnProperty.call(process.threads, threadId)) { continue }
      const thread = process.threads[threadId];
      const isCounter = thread.ph === 'C';
      process.threads[threadId].isCounter = isCounter;
      
      let events = [];
      for (let idx = 0; idx < thread.eventCount; idx++) {
        const event = thread.getEvent(idx);
        if (!isCounter) {
          const dependencies = event.getDependencies();
          event.dependencies = {};
          event.dependencies.predecessors = dependencies.predecessors.map(it => it.id);
          event.dependencies.successors = dependencies.successors.map(it => it.id);
          processedTasks.push(event);
        }
        events.push(event);
      }
      process.threads[threadId].events = events;
    }
  }

  processedTasks = processedTasks.sort((a, b) => a.startTime - b.startTime);
  const allEventsMap = new Map(processedTasks.map(e => [e.id, e]));
  const globalMaxTime = processedTasks.reduce((max, e) => {
    return e.endTime > max ? e.endTime : max;
  }, -Infinity); 

  for (const processId in swimData.processes) {
    if (!Object.prototype.hasOwnProperty.call(swimData.processes, processId)) { continue }
    const process = swimData.processes[processId];
    if (!['kernel', '', undefined].includes(process.type)) { continue }
    for (const threadId in process.threads) {
      if (!Object.prototype.hasOwnProperty.call(process.threads, threadId)) { continue }
      const thread = process.threads[threadId];
      if (!thread.threadName.includes('Fake Core')) { continue }
      
      for (let idx = 0; idx < thread.eventCount; idx++) {
        const event = thread.events[idx];
        const label = `${event.pid}@${event.tid}`;
        let lines = label2lines[label];
        if (!lines) {
          label2lines[label] = lines = [];
        }
        layoutFakeCoreEvent(event, lines, allEventsMap, globalMaxTime);
      }
    }
  }

  const computedPmuTotal = swimData.computePmuTotal();
  computedPmuTotal.icache_hit = 1 - (computedPmuTotal.icache_miss / computedPmuTotal.icache_req);
  computedPmuTotal.vec_ratio = computedPmuTotal.vec_busy_cycles / computedPmuTotal['total cycle'];
  computedPmuTotal.cube_ratio = computedPmuTotal.cube_busy_cycles / computedPmuTotal['total cycle'];
  computedPmuTotal.scalar_ratio = computedPmuTotal.scalar_busy_cycles / computedPmuTotal['total cycle'];
  computedPmuTotal.mte1_ratio = computedPmuTotal.mte1_busy_cycles / computedPmuTotal['total cycle'];
  computedPmuTotal.mte2_ratio = computedPmuTotal.mte2_busy_cycles / computedPmuTotal['total cycle'];
  computedPmuTotal.mte3_ratio = computedPmuTotal.mte3_busy_cycles / computedPmuTotal['total cycle'];

  swimData.pmu_total = computedPmuTotal;
  return swimData;
};  

// 生命周期钩子
onMounted(async () => {
  setupSwimWatchers();
  initEventListeners();
  loading.value = true;
  labelRender.value = true;
  const {
    server: { getCompressedData, getOtherData, getData },
  } = useViewServer();

  loading.value = true;
  let data = {};
  const state = pullState();
  loadingText.value = $t('receiveTraceData');

  const resData = await getQuery();
  if (resData && resData.outputPath) {
    outPutPath.value = resData.outputPath;
  } else {
    outPutPath.value = '';
  }
  isGuidePage.value = resData?.isBootStep;

  try {
    const res = await getOtherData();
    data.config = res.configuration;
    data.comGraphPath = res.comGraphPath;
    data.swimPath = res.swimPath;
    fileName.value = res.title;
    isPerfSwim.value = res.isPerfSwim;
  } catch (err) {
    console.log('parse other data error:', err);
  }

  const swimInfo = await getData({swimDataPath:state.swimDataPath}); 

  loadingText.value = $t('receiveTraceData');

  if (swimInfo.meta) {
    data.swimData = parseCompressedData(swimInfo);
  } else {
    const originalReader = swimInfo.getReader();
    let result = await originalReader.read();
    while (!result.done) {
      const val = result.value;
      if (val.type == 'first') {
        data.swimData = val.data;
      } else {
        data.swimData.processes[val.processId].threads[val.threadId].events.push(...val.data);
      }
      result = await originalReader.read();
    }
  }

  setPageState(data);
  loadTraceData(data.swimData);

  if (BlockToGraphMap[currentActiveBlock.value] && BlockToGraphMap[currentActiveBlock.value] === 'swimGraph') {
    isSwimGraphActive.value = true;
  }

  updateTheme();
  listenExtensionMessage();
});

const containerStyles = computed(() => ({
  overflowY: isMixedAicpuKernel.value ? 'hidden' : 'auto',
  scrollbarGutter: !isMixedAicpuKernel.value ? 'stable' : 'auto'
}));

const containerWidth = computed(() => {
  if (!swimlaneContainer.value) {
    return 0;
  }
  return swimlaneContainer.value.clientWidth || 0;
});

const containerHeight = computed(() => {
  if (!swimlaneContainer.value) {
    return 0;
  }
  return swimlaneContainer.value.clientHeight || 0;
});

defineExpose({
  setPageState,
  loadTraceData,
  loading,
  labelRender,
  loadingText,
  validData,
  processExpanded,
  processes
});

provide('swimGraphContext', { addChildContext });
// 提供搜索状态
provide('swimGraphSearch', { searchResult, currentResultIndex, isSearchActive, searchQuery, isCaseSensitive });

provide('swimGraphCfg', { userConfig });

// provide pmu info
provide('swimGraphPmuTotal', { pmuTotal});

// 提供置顶线程状态
provide('swimGraphPinnedState', {
  pinnedThreads,
  pinnedThreadsList,
  pinThread,
  unpinThread,
  pinnedMeasureInfo
});
 
// 提供状态给子组件
provide('swimGraphState', {
  tsScale,
  minTs,
  timelineComponent,
  viewState,
  layout,
  timeLineX,
  sliderValue,
  sliderMax,
  sliderMaxCount,
  initialScale,
  lastSelected,
  selectedEvent,
  canvasclickedEvent,
  pathLockedEvent,
  highlightedPaths,
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
  lineTooltip,
  lineTooltipStyle,
  bindFile,
  bindButton,
  isMeasureModel,
  measureDragStartX,
  measureDragEndX,
  measureDragEndY,
  measureDragStartTime,
  measureDragEndTime,
  isDarkTheme,
  mulDetailsExpanded,
  measureDetailsExpanded,
  measureDetailsData,
  rootHashes,
  leafHashes,
  leafHashMap,
  isLockStatus,
  dependencyLinesInfo,
  isCfgEditing,
  isShortcutKeyShow,
  isThreeColumn: props.isThreeColumn,
  searchedEvent,
  kernelColorRending: modeOption,
  labelRender,
  fileName,
  isSwimGraphActive,
  isSwimFullscreen,
  isPathLockStatus,
  isAicpu,
  isMixedAicpuKernel,
  performanceVisible,
  performanceWidth,
  isWideScreen,
  isMaxSchedule,
  aicpuControlDetailsExpanded,
  aicpuCoreDetailsExpanded,
  aicpuScheduleDetailsExpanded,
  scheduleList,
  aicpuBuildTask,
  aicpuSchedTask,
  aicpuHasRelevent,
  aicpuScheduleEventMaps,
  pinnedthreadsComponent,
  aicpuScheduleMaps,
  kernelThreadData,
  isPerfSwim
});

// 提供方法给子组件
provide('swimGraphMethods', {
  postMessage,
  render,
  renderFixedTimeline,
  renderTimeline,
  calculateGridInterval,
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
  measureDetailGet,
  processThreadEventSearch,
  getDisplayName,
  resetState,
  overflowText,
  guideRestore,
  showMaxScheduleEvent,
  resetMaxScheduleState,
  drawMeasureTime,
  setMeasureDragHeight,
  autoExpandkernelProcess,
  getEventColor,
  dynamicWidthStyle,
  getEventDisplayName,
  getThreadDisplayName,
  resetsearchState: () => {
    return swimgraphHeaderComponent?.value.resetsearchState();
  },
  showDependencies: (e, mode) => {
    return detailComponent?.value.showDependencies(e, mode);
  },
  scrollToEvent: (e) => {
    return swimgraphHeaderComponent?.value.scrollToEvent(e);
  },
  getTimelineCanvas: () => {
    return timelineComponent?.value.timelineCanvas;
  },
  handleWheel: (e) => {
    timelineComponent?.value.handleWheel(e);
  },
  flagRender: () => {
    timelineComponent?.value.flagRender();
  },
  leftmove: (step, forceTransform) => {
    swimgraphHeaderComponent?.value.leftmove(step, forceTransform);
  },
  rightmove: (step, forceTransform) => {
    swimgraphHeaderComponent?.value.rightmove(step, forceTransform);
  },
  changeScale: (zoomFactor, centerPositionX, needRender = true, isManual = true) => {
    timelineComponent?.value.changeScale(zoomFactor, centerPositionX, needRender, isManual);
  },
  onToggleSwimFullscreenFunction,
  canvasStatusReset: () => {
    childContextMap.threadEvent.canvasStatusReset();
  },
  pinnedDrawLine: (x, color, flag) => {
    pinnedthreadsComponent?.value?.pinnedDrawLine(x, color, flag);
  },
  pinnedEraseLine: (flag) => {
    pinnedthreadsComponent?.value?.pinnedEraseLine(flag);
  },
  drawFixedTimelineSlider,
  drawEventThread: (thread, eventCtx, threadY, processKey) => {
    childContextMap.threadEvent.drawEventThread(thread, eventCtx, threadY, processKey);
  },
  showTooltip: (e, event) => {
    childContextMap.threadEvent.showTooltip(e, event);
  },
  renderThreadText: (thread, ctx, selectedInfo, isHighlighting, isAicpuProcess) => {
    childContextMap.threadEvent.renderThreadText(thread, ctx, selectedInfo, isHighlighting, isAicpuProcess);
  },
  handleKernalEventColors
});
watch(isDarkTheme, () => {
  updateTheme();
  transform();
});

watch(currentActiveBlock, (val) => {
  if (val) {
    isSwimGraphActive.value = val && BlockToGraphMap[val] === 'swimGraph';
  }
});

const updateTheme = () => {
  iconPath3.value = isDarkTheme.value
    ? `${window.staticPath}/static-assets/icon_title_3.svg`
    : `${window.staticPath}/static-assets/icon_title_3_light.svg`;
  down_16px.value = isDarkTheme.value
    ? `${window.staticPath}/static-assets/down_16px.svg`
    : `${window.staticPath}/static-assets/down_16px_light.svg`;
};
// 监听引导模式的消息
const listenExtensionMessage = () => {
  window.ascEventBus.on('boot-step-tips', async (event) => {
    const message = event.data;
    if (event.type === 'welcomeSkipAll') {
      server.closeWebview();
    }
    if (event.type == 'callWebviewMethod') {
      switch (message.methodName) {
        case 'showGuideDetailsPanel':
          await guideRestore();
          getEventInfo();
          break;
        case 'measureDetailSearch': {
          await guideRestore();
          const totalWidth = viewState.canvasCssWidth + layout.processLabelWidth;
          measureDragStartX.value = totalWidth * (1 / 4);
          measureDragEndX.value = totalWidth * (3 / 4);
          isMeasureDragging.value = true;
          isMeasureModel.value = true;
          showDragAreaBorders.value = true;
          const element = document.querySelector('.zoom-controls');
          element.style.border = '';
          measureMouseUp();
          setMeasureDragHeight();
          break;
        }
        case 'zoomControls': {
          await guideRestore();
          clearMeasureDetailSearch();
          break;
        }
        case 'guideLink': {
          await guideRestore();
          const component = timelineComponent.value;
          const ctx = component.fixedtimelineCtx;
          const domRect = document.createElement('div');
          domRect.id = 'timeline-middle-virtual';
          domRect.style.position = 'absolute';
          domRect.style.left = ((viewState.canvasCssWidth - layout.processLabelWidth) / 2) + 'px';
          domRect.style.top = '90px';
          domRect.style.width = '10px';
          domRect.style.height = '3px';
          domRect.style.backgroundColor = 'red';
          ctx.canvas.parentNode.appendChild(domRect);
          break;
        }
        case 'viewThreeColumnGraph': {
          window.ascEventBus.emit('returnSemanticLabelFromCode', { label: '' });
          window.ascEventBus.emit('deactivateLock', '');
          guideRestore();
          break;
        }
        default:
          break;
      }
    }
  });
};
const clearMeasureDetailSearch = () => {
  mulDetailsExpanded.value = false;
  measureDetailsExpanded.value = false;
  measureDragStartX.value = 0;
  measureDragEndX.value = 0;
  isMeasureDragging.value = false;
  showDragAreaBorders.value = false;
  isMeasureModel.value = false;
  measureDragHeight.value = graphProcessesComponent.value.getProcessContainerHeight();
  document.documentElement.style.setProperty('--maskHeight', `0px`);
  renderTwoTimeline();
};
const getEventInfo = (flag) => {
  for (const [processKey, process] of processes.entries()) {
    if (!processExpanded.get(processKey)) {
      continue;
    }
    const thread = process.threads.get(swimConfig.threadKey);
    if (!thread || thread.events.length === 0) {
      continue;
    }
    let matchedEvent = thread.events.find(event => event.name === swimConfig.sampleEventNamePre);
    const [firstEvent] = thread.events;
    const targetEvent = matchedEvent ?? firstEvent;
    if (targetEvent) {
      selectEvent(targetEvent, processKey);
      return;
    }
  }
};
</script>
<style>
@import url('css/common.css');
</style>
<style scoped>
@import url('css/mainGraph.css');
</style>