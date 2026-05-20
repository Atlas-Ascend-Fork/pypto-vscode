<template>
  <div ref="containerRef" class="thread-events" :data-process-container="processKey" tabindex="0" @keydown="handleMountedKeyDown" @keyup="handleMountedKeyup" @mouseenter="handleMouseEnter">
    <div v-if="isThreeColumn && !isLockStatus && lockPosition" 
         class="lock-indicator"
         @click="lockClick"
         :style="{
           top: lockPosition.top + 'px',
           left: lockPosition.left + 'px',
           'background-color': 'var(--devui-tooltip-bg)',
           'border-radius': '6px',
           padding: '4px 6px',
           cursor: 'pointer',
         }">
      <d-icon name="lock-open"></d-icon>
    </div>
    <div v-if="isThreeColumn && isLockStatus && lockPosition" 
         class="lock-indicator"
         @click="unLockClick"
         :style="{
           top: lockPosition.top + 'px',
           left: lockPosition.left + 'px',
           'background-color': 'rgba(49,122,247,1)',
           'border-radius': '6px',
           padding: '4px 6px',
           cursor: 'pointer',
         }">
      <d-icon name="icon-lock-private" style="color: #ffffff;"></d-icon>
    </div>
    <div class="swim-lock-information" v-if="isPathLockStatus">
      <div class="swim-lock-information-item"> {{ $t('pathLockedTip') }} </div>
    </div>
    <canvas 
      class="events-canvas" 
      :data-process-key="processKey"
      @click="handleCanvasClick" 
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @mousedown="handleMouseDown" 
      @mouseup="handleMouseUp"
      @wheel="handleWheel"
      @contextmenu="handleCanvasRightClick"
    ></canvas>
    <canvas class="ui-events-canvas" :data-ui-process-key="processKey"></canvas>
    <canvas class="dependency-events-canvas" :data-dep-process-key="processKey"></canvas>
    <canvas class="hover-events-canvas" :data-hover-process-key="processKey"></canvas>
    <canvas class="background-events-canvas" :data-background-process-key="processKey"></canvas>
    <canvas class="wrap-container-canvas" :data-wrap-container-process-key="processKey"></canvas>
    <canvas class="mix-dependency-canvas" :data-mix-dep-process-key="processKey"></canvas>
    <canvas class="line-events-canvas" :data-line-process-key="processKey"></canvas>
    <canvas class="selection-events-canvas" :data-selection-process-key="processKey"></canvas>
    <canvas class="three-column-events-canvas" :data-three-column-process-key="processKey"></canvas>
    <canvas class="hover-wrap-container-canvas" :data-hover-wrap-container-process-key="processKey"></canvas>
    <swim-graph-thread-lock-menu/>
  </div>
</template>
  
<script setup>
import { useI18n } from 'vue-i18n';
import { inject, onMounted, onUnmounted, watch, ref, provide} from 'vue';
import { COLOR_CFG, DEP_MODE, ctxs, drawArrow, devicePixelRatio, formatTimeWithUnit, getFontStyle, updateProcessSize, getCanvasCSSHeight, getWrapLabelCache, 
  getThreadHeight, getThreadStartY, eventTextSize, nodeSpaceMin, clearWholeProcess,
  renderWrapLabel, renderMixDependenciesAll, renderWrapContainerBox, drawBezierDashedLine, renderWrapLabelRow, collectSubEventDependencyPathNodes
} from '../swimGraphUtils';
import { isEqual, throttle } from 'lodash-es';
import { isPointInPolygonFun, computeLocalXY, getEventColor, getNoZoomX, getOffset, getRootHashList, getActiveEventCanvas, buildEventMap, matchKey, getCanvasRefs, getUIContext, handleMatchKey, selectNoNodeWarm} from './render/utils';
import { EventRender } from './render/eventRender';
import { altClickData, measureState, MeatureRender } from './render/meatureRender';
import { ThreeRender, spaceInThreeCol, isAnimation } from './render/threeRender';
import { getIsCompleteBoot } from '@/apis/welcome';
import { swimConfig } from '../../welcome/guideStepsConfig';
import swimGraphThreadLockMenu from './swimGraphThreadLockMenu.vue';
import { getQuery } from '@/core/query';
import { getPositionByTime, getWidthByDuration, collectRelevantEdges } from './processInfo';
import { swimDataManager } from '../swimData';
import { Animation } from './animation';
const containerRef = ref(null);
const { isDarkTheme } = inject('root');
const { t: $t } = useI18n();
const curThread = inject('curThread');
const lockPosition = ref(null);
let switchLockInformationFlag = ref(false);
let topX = ref(0);
let leftX = ref(0);
let isClickedPath = ref(false);
let colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
let points = [];
let boundaries = [];
let preLabel = '';
let lockedLabel = '';
let drawColorDatas = {};
let isHoverLockStatus = ref(false); // 选定状态
let pinnedStatus = ref(false);
// 注入父组件提供的状态和方法
const swimGraphState = inject('swimGraphState');
const {
  tsScale,
  layout,
  lastSelected,
  selectedEvent,
  canvasclickedEvent,
  pathLockedEvent,
  highlightedPaths,
  mixRelatedPaths,
  swimlaneContainer,
  lane2line,
  viewState,
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
  processes,
  processExpanded,
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
  isPathLockStatus,
  isMaxSchedule,
  aicpuControlDetailsExpanded,
  aicpuCoreDetailsExpanded,
  aicpuScheduleDetailsExpanded,
  globalMeasureCanvas,
  globalDependencyLinesInfo,
  isMixMode,
  globalConnectionCanvas,
  isFromPerformanceClick
} = swimGraphState;

const {
  findEventAtPosition,
  selectEvent,
  handleWheel,
  leftmove,
  rightmove,
  flagRender,
  transform,
  measureDetailGet,
  xToTime,
  processThreadEventSearch,
  highlightPinnedEvent,
  getDisplayName,
  changeScale,
  resetMaxScheduleState,
  findWrapAtPosition
} = inject('swimGraphMethods');

const { addChildContext } = inject('swimGraphContext');
const { userConfig, textOption } = inject('swimGraphCfg');
let mousePosition = null;
let isKeyPressed = ref(false);
let keyTimeOut;
let keyInterval;
let scaleStep = 0.1; 
let moveStep = 30;

const SNAP_FACTOR = 0.4;
const ACCELERATION_PER_MS = 1 / 50;
const DEFAULT_ANIMATION_DURATION = 700;
const ZOOM_RATIO_PER_FRAME = 0.008;
const KEYBOARD_PAN_PX_PER_FRAME = 8;
const INITIAL_ZOOM_STEP = 0.1;

const Zoom = {
  None: 0,
  In: 1,
  Out: -1,
};

const Pan = {
  None: 0,
  Left: -1,
  Right: 1,
};

let zooming = Zoom.None;
let panning = Pan.None;
let targetZoomRatio = 0;
let currentZoomRatio = 0;
let targetPanOffsetPx = 0;
let currentPanOffsetPx = 0;
let zoomAnimation = null;
let panAnimation = null;
let animationFrameCount = 0;
const FRAME_SKIP = 2;
// 创建渲染实例
const eventRenderer = new EventRender({...swimGraphState, colorCfg, userConfig});
const measureRenderer = new MeatureRender({...swimGraphState, colorCfg}, $t('lessThan0'));
const threeRender = new ThreeRender({...swimGraphState, isKeyPressed});
// 定义props
const props = defineProps({
  processKey: {
    type: String,
    required: true
  },
  process: {
    type: Object,
    required: true
  }
});
let lastMoveX;

// 框选的起点和终点坐标
let selection = {
  startX : 0,
  startLocalX: 0,
  startY: 0,
  endX: 0,
  endLocalX: 0,
  endY: 0
};
let isDragging = ref(false);
let isClick = ref(false);
let wheelDebounceTimer;
let AICCount = 0;
let AIVCount = 0;
let matchingAICEvents = [];
let matchingAIVEvents = [];
let selectionEvents = [];

const canvasStatusReset = () => {
  measureState.isMeasureFirst = false;
  measureState.isMeasureFixed = false;
  highlightedPaths.clear();
  mixRelatedPaths.clear();
  detailsPanelExpanded.value = false;
  aicpuControlDetailsExpanded.value = false;
  aicpuScheduleDetailsExpanded.value = false;
  aicpuCoreDetailsExpanded.value = false;
  selectEvent(null, props.processKey);
  const ctx = clearDependencyLines(props.processKey);
  highlightEvent(ctx, searchedEvent.value, props.processKey, true);
};

const canDragSelect = (process) => {
  if (isMixMode.value) {
    return false;
  }
  if (process.type === 'aicpu') {
    return false;
  }
  if (process.type === 'PerfSwim') {
    return process.processName === 'AICore View';
  }
  return true;
};

const handleCanvasClick = (e) => {
  isFromPerformanceClick.value = false;
  if (!isClick.value) {
    return;
  }
  if (isLockStatus.value) {
    return;
  }
  switchLockInformationFlag.value = false;
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) {
    return;
  }

  if (e.ctrlKey) {
    // 拖动画布中
    return;
  }
  if (!isDragging.value) {
    clearAllSelectionCanvas('data-selection-process-key');
  } 
  const rect = canvasRef.getBoundingClientRect();
  const x = (e.clientX - rect.left - viewState.offsetX) / viewState.scale;
  const y = e.clientY - rect.top;

  // 检查是否点击了事件
  const clickedEvent = findEventAtPosition(x, y, props.processKey)?.event;
  canvasclickedEvent.value = clickedEvent;
  // 锁定时的点击处理
  if (isPathLockStatus.value) {
    detailsPanelExpanded.value = false;
    if (clickedEvent) {
      if (e.altKey) {
        // 清空hover画布 
        onHoverEvent();
        measureDistance(clickedEvent, props.processKey);
        return;
      }
      detailsPanelExpanded.value = !clickedEvent.parentEventId;
      onHoverEvent();
      clearOtherProcessCanvas();
      drawNodeHeight(clickedEvent, props.processKey);
      highlightPinnedEvent(clickedEvent, true);
    }
    return;
  }
  if (isThreeColumn) {
    const isPointInPolygon = isPointInPolygonFun([x, y], boundaries);
    if (isPointInPolygon) {
      if (!clickedEvent) {
        isHoverLockStatus.value = true;
        return;
      }
    } else {
      isHoverLockStatus.value = false;
      clearSelectionCanvas('data-three-column-process-key');
      sendMsg('returnSemanticLabelFromSwim', { label: '', rootHashList: [] });
      toggleLock();
    }
  }
  if (clickedEvent) {
    if (e.altKey) {
      // 清空hover画布 
      onHoverEvent();
      measureDistance(clickedEvent, props.processKey);
    } else {
      measureState.isMeasureFirst = false;
      measureState.isMeasureFixed = false;
      if (!e.ctrlKey) { selectEvent(clickedEvent, props.processKey) };
      isClickedPath.value = true;
    }
  } else {
    isClickedPath.value = false;
    canvasStatusReset();
  }
};

const pathLockedMethod = (clickedEvent) => {
  selectEvent(clickedEvent, props.processKey);
  detailsPanelExpanded.value = false;
};
const clearOtherProcessCanvas = () => {
  const selectedKey = selectedEvent.value?.pid?.toString();
  for (const [key, process] of swimDataManager.processInfo.entries()) {
    const isExpanded = processExpanded.get(key);
    if (isExpanded || selectedKey === key) {
      continue;
    }
    const { threads } = process;
    const drawDatas = [];
    for (const [threadKey, thread] of threads.entries()) {
      const { eventIds } = thread;
      for (const eventId of eventIds) {
        const event = swimDataManager.getEventById(eventId);
        if (!event.drawData) {
          continue;
        }
        if (event.drawData.rectColor != colorCfg.eventRectNoColor) {
          event.drawData.rectColor = colorCfg.eventRectNoColor;
          event.drawData.fontColor = colorCfg.eventFontNoColor;
        }
        drawDatas.push(event.drawData);
      }
      const canvas = document.querySelector(`[data-process-key="${key}"]`);
      const eventCtx = canvas.getContext('2d');
      const uiCanvas = document.querySelector(`[data-ui-process-key="${key}"]`);
      const uiCtx = uiCanvas.getContext('2d');
      uiCtx.clearRect(0, 0, viewState.canvasCssWidth, canvas.offsetHeight);
      eventCtx.clearRect(0, 0, viewState.canvasCssWidth, canvas.offsetHeight);
      eventRenderer.drawEvent(drawDatas, eventCtx, false);
      eventRenderer.drawEventText(drawDatas, eventCtx, false);
    }
  }
};
const handleCanvasRightClick = (e) => {
  if (isThreeColumn || !mousePosition) {
    return;
  }
  const refs = getCanvasRefs(props.processKey);
  if (!refs) { return };
  const { canvasRef, uiCtx, backgroundCanvasRef, backgroundCanvasCtx } = refs;
  const localPosition = computeLocalXY(canvasRef, mousePosition, viewState);
  const { x, y } = localPosition;
  const canvasCSSWidth = viewState.canvasCssWidth;
  if (e.clientX + 200  > canvasCSSWidth) {
      leftX.value = e.clientX - layout.processLabelWidth - 100;
  } else {
      leftX.value = e.clientX - layout.processLabelWidth + 10;
  }
  topX.value = y  + 10;

  const clickedEvent = findEventAtPosition(x, y, props.processKey)?.event;
  if (clickedEvent) {
    switchLockInformationFlag.value = true;
    hideTooltip();
    if (e.altKey) {
      // 清空hover画布 
      onHoverEvent();
      measureDistance(clickedEvent, props.processKey);
    } else {
      measureState.isMeasureFirst = false;
      measureState.isMeasureFixed = false;
      canvasclickedEvent.value = clickedEvent;
    }
  } else {
    switchLockInformationFlag.value = false;
    if (isPathLockStatus.value) {
      return;
    }
    canvasStatusReset();
  }
};

// 防抖的渲染函数，避免频繁重绘
const throttledRender = throttle(() => {
  transform();
}, 16); // 约60fps

const scaleCanvas = (mouseX, scale) => {
  const oldScale = viewState.scale;
  
  if (viewState.scale * scale < initialScale.value) {
    viewState.scale = initialScale.value;
  } else {
    viewState.scale = Math.max(initialScale.value, Math.min(sliderMax.value / 10, viewState.scale * scale));
  }
  
  const sliderCount = Math.round(Math.log(viewState.scale) / Math.log(1.25));
  sliderValue.value = parseInt(sliderCount, 10); 
  viewState.scaleChange = viewState.scale / oldScale;
  viewState.offsetX = mouseX - (mouseX - viewState.offsetX) * viewState.scaleChange;
  const timeLineEndX = Math.abs(timeLineX.value);
  const cssWidth = viewState.canvasCssWidth;
  if (cssWidth > timeLineEndX) {
    const tempOffsetX = cssWidth - timeLineEndX;
    viewState.offsetX += tempOffsetX;
  }
  if (viewState.offsetX > 0) {
    viewState.offsetX = 0;
  }
  viewState.pixelScale = viewState.scale * devicePixelRatio;
  viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
  viewState.minWidth = 1 / viewState.scale;

  // 使用防抖渲染
  throttledRender();
};


const handleMountedKeyDown = (e) => {
    if (e.key === 'Escape' || e.code === 'Escape') {
      e.preventDefault();   // 防止浏览器默认行为（如退出全屏）
      isPathLockStatus.value = false;
      canvasStatusReset();
      canvasclickedEvent.value = null;
      pathLockedEvent.value = null;
      if (isMaxSchedule.value) {
        resetMaxScheduleState();
      }
    }
    const isModifierKeyPressed = e.ctrlKey && !(e.shiftKey || e.altKey || e.metaKey);
    const isLKey = e.key.toLowerCase() === 'l';
    if (!isThreeColumn && isModifierKeyPressed && isLKey) {
      if (canvasclickedEvent.value) {
        pathLockedEvent.value = canvasclickedEvent.value;
        isPathLockStatus.value = true;
        switchLockInformationFlag.value = false;
        if (isClickedPath) {
          pathLockedMethod(canvasclickedEvent.value);
          isClickedPath.value = false;
        }
      } else {
        selectNoNodeWarm();
      }
    }

    if (!handleMatchKey(e.key, userConfig)) {
      e.stopPropagation();
      return;
    }
    onKeyDown(e);
    e.stopPropagation();
};
const handleMountedKeyup = (e) => {
  if (!handleMatchKey(e.key, userConfig)) {
    e.stopPropagation();
    return;
  }
  onKeyUp(e);
  e.stopPropagation();
};
onMounted(() => {
  listenExtensionMessage();
  listenExtensionClearMessage();
});

onUnmounted(() => {
  throttledRender.cancel();
  if (isAnimation) {
    clearSelectionCanvas('data-three-column-process-key');
  }
  if (zoomAnimation) {
    zoomAnimation.stop();
  }
  if (panAnimation) {
    panAnimation.stop();
  }
});

const onZoomAnimationStep = (msSinceStartOfAnimation, savedMousePosition) => {
  animationFrameCount++;
  
  if (animationFrameCount % FRAME_SKIP !== 0) {
    return;
  }
  
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) {
    return;
  }
  
  const mouseX = savedMousePosition?.x - layout.processLabelWidth;
  
  if (mouseX === null || mouseX === undefined) {
    return;
  }
  const step = (targetZoomRatio - currentZoomRatio) * SNAP_FACTOR;
  
  if (zooming !== Zoom.None) {
    const velocity = 1 + (msSinceStartOfAnimation * ACCELERATION_PER_MS);
    const targetStep = Math.max(ZOOM_RATIO_PER_FRAME * velocity, step);
    targetZoomRatio += zooming * targetStep;
  }
  
  currentZoomRatio += step;
  if (Math.abs(step) > 1e-6) {
    scaleCanvas(mouseX, 1 + step);
    if (measureState.isMeasureFixed) {
      measureDistanceZoom(altClickData.lastData, String(altClickData.lastData.pid));
    }
  } else {
    if (zoomAnimation) {
      zoomAnimation.stop();
      animationFrameCount = 0;
      transform();
    }
  }
};

const onPanAnimationStep = (msSinceStartOfAnimation) => {
  animationFrameCount++;
  
  if (animationFrameCount % FRAME_SKIP !== 0) {
    return;
  }
  
  if (panning !== Pan.None) {
    const velocity = 1 + (msSinceStartOfAnimation * ACCELERATION_PER_MS);
    const targetStep = Math.max(KEYBOARD_PAN_PX_PER_FRAME * velocity, Math.abs((targetPanOffsetPx - currentPanOffsetPx) * SNAP_FACTOR));
    targetPanOffsetPx += panning * targetStep;
  }
  
  const step = (targetPanOffsetPx - currentPanOffsetPx) * SNAP_FACTOR;
  currentPanOffsetPx += step;
  
  if (Math.abs(step) > 1e-1) {
    if (step > 0) {
      leftmove(Math.abs(step), false);
    } else {
      rightmove(Math.abs(step), false);
    }
  } else {
    if (panAnimation) {
      panAnimation.stop();
      animationFrameCount = 0;
      transform();
    }
  }
};

const onKeyDown = (e) => {
  if (document.activeElement.nodeName === 'INPUT') {
    return;
  }
  if (!isKeyPressed.value) {
    handlekeydown(e);
  }
  isKeyPressed.value = true;
  if (isAnimation) {
    threeRender.stopAnimate();
  }
  if (!keyTimeOut) {
    keyTimeOut = setTimeout(() => {
      keyInterval = setInterval(() => {
        handlekeydown(e);
      }, 50);
    }, 500); // 500毫秒后开始加速
  }
};
 
const onKeyUp = (e) => {
  if (document.activeElement.nodeName === 'INPUT') {
    return;
  }
  
  const key = e.key.toLowerCase();
  
  if (matchKey(key, userConfig?.value.ZoomInShortcut) && zooming === Zoom.In) {
    zooming = Zoom.None;
  }
  if (matchKey(key, userConfig?.value.ZoomOutShortcut) && zooming === Zoom.Out) {
    zooming = Zoom.None;
  }
  if (matchKey(key, userConfig?.value.leftmoveShortcut) && panning === Pan.Left) {
    panning = Pan.None;
  }
  if (matchKey(key, userConfig?.value.rightmoveShortcut) && panning === Pan.Right) {
    panning = Pan.None;
  }
  
  if (isKeyPressed.value) {
    isKeyPressed.value = false;
    threeRender.enableAnimate();
    threeRender.drawBoundary(boundaries, props.processKey);
    threeRender.animate();
    if (keyInterval) {
      clearInterval(keyInterval);
      keyInterval = null;
    }
    if (keyTimeOut) {
      clearTimeout(keyTimeOut);
      keyTimeOut = null;
    }
    scaleStep = 0.1;
    moveStep = 30;
  }
};

const handleMouseEnter = (event) => {
  pinnedStatus.value = false;
  containerRef?.value.focus({ preventScroll: true });
};

const isMouseInCanvas = (canvasRef) => {
  if (!canvasRef) {
    return false;
  }
  const rect = canvasRef.getBoundingClientRect();
  const mouseX = mousePosition?.x - layout.processLabelWidth;
  const mouseY = mousePosition?.y - rect.top;
  const canvasCSSWidth = viewState.canvasCssWidth;
  const canvasCSSHeight = getCanvasCSSHeight(canvasRef);
  
  return mouseX && mouseY && mouseX >= 0 && mouseY >= 0 && mouseX <= canvasCSSWidth && mouseY <= canvasCSSHeight;
};

const checkScaleLimits = (key) => {
  if (viewState.scale * 10 >= sliderMax.value && matchKey(key, userConfig?.value.ZoomInShortcut)) {
    wheelDebounceTimer = setTimeout(() => {
      postMessage($t('scaleMaxInfo'));
    }, 100);
    return true;
  }
  if (viewState.scale === 1 && viewState.offsetX >= 0 && matchKey(key, userConfig?.value.ZoomOutShortcut)) {
    wheelDebounceTimer = setTimeout(() => {
      postMessage($t('scaleMinInfo'));
    }, 100);
    return true;
  }
  return false;
};

const initZoomAnimation = (direction, currentMousePosition) => {
  if (zooming !== direction) {
    if (zoomAnimation) {
      zoomAnimation.stop();
    }
    currentZoomRatio = 0;
    targetZoomRatio = direction * INITIAL_ZOOM_STEP;
    
    // 使用闭包保存鼠标位置
    const savedMousePosition = currentMousePosition;
    zoomAnimation = new Animation((msSinceStartOfAnimation) => {
      onZoomAnimationStep(msSinceStartOfAnimation, savedMousePosition);
    });
  }
  zooming = direction;
  zoomAnimation.start(DEFAULT_ANIMATION_DURATION);
};

const initPanAnimation = (direction) => {
  if (panning !== direction) {
    if (panAnimation) {
      panAnimation.stop();
    }
    currentPanOffsetPx = 0;
    targetPanOffsetPx = 0;
    panAnimation = new Animation(onPanAnimationStep);
  }
  panning = direction;
  panAnimation.start(DEFAULT_ANIMATION_DURATION);
};

const handleKeyAction = (key, currentMousePosition) => {
  if (matchKey(key, userConfig?.value.ZoomInShortcut)) {
    initZoomAnimation(Zoom.In, currentMousePosition);
  } else if (matchKey(key, userConfig?.value.ZoomOutShortcut)) {
    initZoomAnimation(Zoom.Out, currentMousePosition);
  } else if (matchKey(key, userConfig?.value.leftmoveShortcut)) {
    initPanAnimation(Pan.Left);
  } else {
    initPanAnimation(Pan.Right);
  }
};

const handlekeydown = (event) => {
  clearTimeout(wheelDebounceTimer);
  const key = event.key.toLowerCase();
  const canvasRef = getActiveEventCanvas(props.processKey);
  
  if (!isMouseInCanvas(canvasRef)) {
    return;
  }
  
  if (checkScaleLimits(key)) {
    return;
  }
  
  handleKeyAction(key, mousePosition ? { x: mousePosition.x, y: mousePosition.y } : null);
};
const postMessage = (message) => {
  if (window.vscode) {
    window.vscode.postMessage({ command: 'showMessage' , paramObj: { text: message}});
  }
};

function highlightThreadOnHover(y, backgroundCanvasRef, backgroundCanvasCtx) {
  if (!(y > 0 && y < backgroundCanvasRef.offsetHeight - 1)) { return };
  let threadId = 0;
  let curY = 0;
  let curId = 0;
  let curHeight = 0;
  for (const [_, thread] of props.process.threads.entries()) {
    const threadKey = thread.isCounter ? thread.threadName : thread.tid;
    const threadY = getThreadStartY(props.process, props.processKey, threadKey, lane2line, layout);
    const threadHeight = getThreadHeight(props.processKey, threadKey, lane2line, layout, thread.isCounter);
    if (y <= threadY) {
      break;
    }
    curY = threadY;
    curId = threadId;
    curHeight = threadHeight;
    threadId++;
  }
  let hoverId = `${props.processKey}-${curId}`;
  if (hoverId != curThread.value) {
    curThread.value = hoverId;
    clearWholeProcess(backgroundCanvasCtx, viewState, props.processKey);
    backgroundCanvasCtx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    backgroundCanvasCtx.fillRect(0, curY, viewState.canvasCssWidth, curHeight);
  }
}

function highlightMixThreadOnHover(y, backgroundCanvasRef, backgroundCanvasCtx) {
  if (y < 0 || y >= backgroundCanvasRef.offsetHeight) { return };
  const swimLaneOrder = swimDataManager.getSwimLaneOrder();
  if (swimLaneOrder.length === 0) { return };
  
  for (let i = 0; i < swimLaneOrder.length; i++) {
    const lane = swimLaneOrder[i];
    const laneEnd = lane.y + lane.height;
    const lastLane = i === swimLaneOrder.length - 1 && y <= backgroundCanvasRef.offsetHeight;
    if (y >= lane.y && (y < laneEnd || lastLane)) {
      const hoverId = `${props.processKey}-${i}`;
      if (hoverId !== curThread.value) {
        curThread.value = hoverId;
        clearWholeProcess(backgroundCanvasCtx, viewState, props.processKey);
        backgroundCanvasCtx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        backgroundCanvasCtx.fillRect(0, lane.y, viewState.canvasCssWidth, lane.height);
      }
      return;
    }
  }
}
const drawDependencyLine = (fromEvent, toEvent, ctx) => {
  if (!fromEvent?.renderInfo || !toEvent?.renderInfo) { return };
  
  const fromX = getPositionByTime(fromEvent.endTime, viewState, layout) - layout.processLabelWidth;
  const toX = getPositionByTime(toEvent.startTime, viewState, layout) - layout.processLabelWidth;
  const isGlobalCanvas = ctx.canvas.classList.contains('global-connection-canvas');
  let fromY = fromEvent.renderInfo.y;
  if (isGlobalCanvas) {
    const coord = globalConnectionCanvas.value.getEventCoordinates(fromEvent, false);
    const startYTemp = coord.y - ((fromEvent.drawData.height * devicePixelRatio) / 2);
    fromY = startYTemp / devicePixelRatio;
  }
  const fromHeight = fromEvent.renderInfo.height;
  let toY = toEvent.renderInfo.y;
  if (isGlobalCanvas) {
    const coord = globalConnectionCanvas.value.getEventCoordinates(toEvent, false);
    const toYTemp = coord.y - ((toEvent.drawData.height * devicePixelRatio) / 2);
    toY = toYTemp / devicePixelRatio;
  }
  const toHeight = toEvent.renderInfo.height;
  
  let startY;
  let endY;
  
  if (fromY < toY) {
    startY = fromY + fromHeight;
    endY = toY;
  } else if (fromY > toY) {
    startY = fromY;
    endY = toY + toHeight;
  } else {
    startY = fromY + fromHeight / 2;
    endY = toY + toHeight / 2;
  }
  
  drawBezierDashedLine(
    ctx,
    fromX,
    startY,
    toX,
    endY,
    viewState.scale,
    viewState.offsetX,
    devicePixelRatio,
    isDarkTheme.value,
    true,
  );
};

const drawDependencyLinesForPath = (event, relatedEvents, ctx) => {
  // 1. 绘制 relatedEvents 内部节点到其他节点的连接线（包括到 event 的）
  for (const eventId of relatedEvents) {
    const subEvent = swimDataManager.getEventById(eventId);
    if (!subEvent?.renderInfo) { continue };
    
    const deps = swimDataManager.getSubEventDependencies(subEvent.id);
    
    for (const successor of deps.successors) {
      if (!successor.renderInfo) { continue };
      if (successor.id !== event.id && !relatedEvents.has(successor.id)) { continue };
      
      drawDependencyLine(subEvent, successor, ctx);
    }
  }
  
  // 2. 绘制 event 到下游节点的连接线
  if (event?.renderInfo) {
    const deps = swimDataManager.getSubEventDependencies(event.id);
    
    for (const successor of deps.successors) {
      if (!successor.renderInfo) { continue };
      if (!relatedEvents.has(successor.id)) { continue };
      
      drawDependencyLine(event, successor, ctx);
    }
  }
};

const renderDimmedNodesInWrap = (event, wrapHoverCtx) => {
  const wrapId = event?.args?.wrapId;
  if (wrapId === undefined) {
    return;
  }
  
  const isGlobalCanvas = wrapHoverCtx?.canvas?.classList.contains('global-connection-canvas');
  const relatedEvents = collectSubEventDependencyPathNodes(event);
  
  const drawDatas = [];
  for (const eventId of relatedEvents) {
    let subEvent = swimDataManager.getEventById(eventId);
    if (isGlobalCanvas) {
      subEvent = JSON.parse(JSON.stringify(subEvent));
      const coord = globalConnectionCanvas.value.getEventCoordinates(subEvent, false);
      const startY = coord.y - ((subEvent.drawData.height * devicePixelRatio) / 2);
      subEvent.drawData.rectY = startY / devicePixelRatio;
      subEvent.drawData.textY = startY + eventTextSize;
    }
    if (subEvent?.drawData) {
      drawDatas.push(subEvent.drawData);
    }
  }
  
  if (drawDatas.length > 0 && wrapHoverCtx) {
    eventRenderer.drawEvent(drawDatas, wrapHoverCtx);
    eventRenderer.drawEventText(drawDatas, wrapHoverCtx);
    
    drawDependencyLinesForPath(event, relatedEvents, wrapHoverCtx);
  }
};

const drawClickWrapContainner = (event, wrapCtx) => {
  if (!wrapCtx) {
    return;
  }
  let wrapId = event?.args?.wrapId;
  if (wrapId === null || wrapId === undefined) {
    return;
  }
  const wrapContainers = swimDataManager.getWrapContainers();
  const swimLaneOrder = swimDataManager.getSwimLaneOrder();
  for (const wrapContainer of wrapContainers) {
    if (wrapContainer.wrapId === wrapId) {
      renderWrapContainerBox(wrapCtx, wrapContainer, swimLaneOrder, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState, isHover: true });
      break;
    }
  }
  for (const lane of swimLaneOrder) {
    if (lane.type === 'wrap-label' && lane.wrapId === wrapId) {
      renderWrapLabelRow(wrapCtx, lane, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState, isHover: true, hoverWrapId: wrapId });
      break;
    }
  }
};

function drawHoverWrapContainner(event, x, y, wrapCtx) {
  let isHoverWrapContainner = false;
  if (!wrapCtx) {
    return;
  }
  let wrapId = event?.args?.wrapId;
  const wrapContainers = swimDataManager.getWrapContainers();
  const swimLaneOrder = swimDataManager.getSwimLaneOrder();
  if (wrapId == null && !selectedEvent.value) {
    wrapId = findWrapAtPosition(x, y, wrapCtx, getPositionByTime)?.wrapId;
    if (wrapId == null) {
      clearWholeProcess(wrapCtx, viewState, props.processKey);
      renderWrapLabel(wrapCtx, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState });
      for (const wrapContainer of wrapContainers) {
        renderWrapContainerBox(wrapCtx, wrapContainer, swimLaneOrder, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState });
      }
      return;
    }
    isHoverWrapContainner = true;
  }
  clearWholeProcess(wrapCtx, viewState, props.processKey);
  renderWrapLabel(wrapCtx, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState, wrapId });
  for (const wrapContainer of wrapContainers) {
    const isHover = wrapContainer.wrapId === wrapId && !isHoverWrapContainner;
    renderWrapContainerBox(wrapCtx, wrapContainer, swimLaneOrder, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState, isHover });
  }
}
 // 手动测距
function handleAltMeasureHoverBranch(e, hoveredEvent, uiCtx) {
  const manual = altClickData.preData && measureState.isMeasureFirst && !measureState.isMeasureFixed;
  if (!(hoveredEvent && e.altKey && manual)) {
    return false;
  }
  if (measureState.isMeasureChange && altClickData.lastData) {
    let temp = altClickData.preData;
    altClickData.preData = altClickData.lastData;
    altClickData.lastData = temp;
    measureState.isMeasureChange = false;
  }
  if (isEqual(altClickData.preData, hoveredEvent)) {
    return true; // consumed
  }
  altClickData.lastData = hoveredEvent;
  if (globalMeasureCanvas.value) {
    globalMeasureCanvas.value.clearCanvas(true);
    globalMeasureCanvas.value.measureDistanceHover();
  } else {
    measureRenderer.clearDrawConnectorHover(uiCtx, props.processKey);
    measureRenderer.measureDistanceHover(uiCtx);
  }
  return false;
}

function maybeDrawConnectorPreview(preData, lastData, nodeSpacingX, uiCtx) {
  if (!preData || !lastData || measureState.isMeasureFixed) { return };
  const divElement = document.getElementsByClassName('swimlane-container');
  const scrollWidth = divElement[0].offsetWidth - divElement[0].clientWidth;
  const actSpacingX = nodeSpacingX * viewState.pixelScale;
  if (actSpacingX <= 3) { return };
  const { canvasWidth } = viewState;
  const noZoomLastX = getNoZoomX(lastData?.renderInfo?.x, viewState);
  const noZoomPreX = getNoZoomX(preData?.renderInfo?.x, viewState) + (preData?.renderInfo?.width * viewState.pixelScale);
  if (noZoomLastX < (canvasWidth - scrollWidth) && noZoomPreX > 0 ) {
    altClickData.preData = preData;
    altClickData.lastData = lastData;
    altClickData.largeSpacing = actSpacingX > nodeSpaceMin;
    if (globalMeasureCanvas.value) {
      globalMeasureCanvas.value.drawMeasurePreview(preData, lastData, nodeSpacingX);
    } else {
      measureRenderer.drawConnector(uiCtx, altClickData.largeSpacing);
    }
  }
}

function handleTooltipAndCursor(e, hoveredEvent, canvasRef) {
  let cursor = '';
  const condition = hoveredEvent && !e.altKey && !e.ctrlKey;
  if (condition && !isPathLockStatus.value) {
    showTooltip(e, hoveredEvent, canvasRef);
    cursor = 'pointer';
  } else {
    hideTooltip();
  }
  return cursor;
}
const findLineAtPoint = (ctx, point) => {
  // 还原传入坐标为绘制算法
  let pointX = point.x * viewState.pixelScale;
  let pointY = point.y * devicePixelRatio;
  let linesToCheck;
  if (globalDependencyLinesInfo.value.length > 0) {
    // 全局画布依赖
    linesToCheck = globalDependencyLinesInfo.value;
    pointY = (point.y + layout.processHeaderHeight) * devicePixelRatio;
  } else if (dependencyLinesInfo.value.length > 0) {
    // 原始画布依赖
    linesToCheck = dependencyLinesInfo.value;
  } else {
    linesToCheck = [];
  }

  for (const line of linesToCheck) {
    if (ctx.isPointInStroke(line.linePath, pointX, pointY)) {
      return { fromEvent: line.fromEvent, toEvent: line.toEvent };
    }
  }
  return null;
};
const handleLineTooltipAndCursor = (e, x, y) => {
  const dependencyLinesChange = globalDependencyLinesInfo.value.length === 0 && dependencyLinesInfo.value.length === 0;
  if (dependencyLinesChange || isPerfSwim.value) {
    return '';
  }
  const point = { x, y };
  const dependencyCanvasRef = document.querySelector(`[data-dep-process-key="${props.processKey}"]`);
  if (!dependencyCanvasRef) {
    return '';
  }
  const dependencyCtx = dependencyCanvasRef.getContext('2d');
  dependencyCtx.save();
  dependencyCtx.setTransform(1, 0, 0, 1, 0, 0);
  dependencyCtx.lineWidth = 2 * devicePixelRatio;
  const line = findLineAtPoint(dependencyCtx, point);
  dependencyCtx.restore();
  if (line && !e.altKey && !e.ctrlKey) {
    lineShowTooltip(e, line.fromEvent, line.toEvent);
    return 'pointer';
  } else {
    hideLineTooltip();
  }
  return '';
};

function handleCtrlDragPan(e, canvasRef) {
  let cursor = null;
  if (e.ctrlKey && e.buttons === 1) {
    cursor = 'grab';
    if (viewState.scale === 1) { return cursor };
    const timeLineEndX = Math.abs(timeLineX.value);
    const deltaX = e.clientX - lastMoveX;
    const cssWidth = viewState.canvasCssWidth;
    const minOffset = cssWidth - (cssWidth * viewState.scale);
    const leftLimit = deltaX < 0 && viewState.offsetX === minOffset;
    const rightLimit = deltaX > 0 && viewState.offsetX === 0;
    if (leftLimit || rightLimit) {
      canvasRef.style.cursor = cursor;
      return cursor;
    }
    if (deltaX < 0 && cssWidth > timeLineEndX) {
      viewState.offsetX = minOffset;
    } else {
      viewState.offsetX += getOffset(deltaX, viewState.scale);
      if (deltaX > 0 && viewState.offsetX > 0) {
        viewState.offsetX = 0;
      }
    }
    viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
    transform();
  }
  lastMoveX = e.clientX;
  return cursor;
}

const handleAltMove = (e, hoverInfo, refs) => {
  const hoveredEvent = hoverInfo?.event;
  const { uiCtx } = refs;
  handleAltMeasureHoverBranch(e, hoveredEvent, uiCtx);
};

const handlePureMove = (hoverInfo, refs, localPosition) => {
  const hoveredEvent = hoverInfo?.event;
  const { preData, lastData, nodeSpacingX } = hoverInfo?.altClickData || {};
  const { uiCtx, canvasRef } = refs;
  const eventCtx = canvasRef.getContext('2d');
  const { x, y } = localPosition;
  if (!isLockStatus.value) { // 三栏锁定
    onHoverEvent(hoveredEvent);
    maybeDrawConnectorPreview(preData, lastData, nodeSpacingX, uiCtx); // 自动测距
    if (isDragging.value) {
      selection.endLocalX = x;
      selection.endY = y;
      // 绘制框选
      drawSelectionBox();
      mulDetailsExpanded.value = false;
    }
  }
  if (isThreeColumn) {
    handle3PureMove(hoverInfo, localPosition, eventCtx);
  }
};

const handle3PureMove = (hoverInfo, localPosition, eventCtx) => {
  const hoveredEvent = hoverInfo?.event;
  const { x, y } = localPosition;
  const hasHnadleHover = handleHoverEvent(hoveredEvent);
  if (!hasHnadleHover && !isLockStatus.value && !isHoverLockStatus.value) {
    const isPointInPolygon = isPointInPolygonFun([x, y], boundaries);
    if (!isPointInPolygon && preLabel) {
      sendMsg('returnSemanticLabelFromSwim', { label: '', rootHashList: [] });
      preLabel = '';
      clearSelectionCanvas('data-three-column-process-key');
      changeNodeColor(props.processKey, false);
      drawThreadSeparators(eventCtx, props.process, props.processKey);
    }
  }
};

const handleMouseMove = (e) => {
  mousePosition = { x: e.clientX, y: e.clientY };
  if (e.isTrusted) {
    handleMouseMoveThrottle(e);
  }
};

const handleMouseMoveThrottle = throttle((e) => {
  const refs = getCanvasRefs(props.processKey);
  if (!refs || !mousePosition) { return };
  const { canvasRef, uiCtx, backgroundCanvasRef, backgroundCanvasCtx } = refs;

  const validateData = altClickData.preData && altClickData.lastData;
  if (validateData && !e.altKey && !measureState.isMeasureFixed) {
    if (globalMeasureCanvas.value) {
      globalMeasureCanvas.value.clearMeasure();
    } else {
      measureRenderer.clearDrawConnector(uiCtx, props.processKey);
    }
  }

  const localPosition = computeLocalXY(canvasRef, mousePosition, viewState);
  const { x, y } = localPosition;
  const info = findEventAtPosition(x, y, props.processKey);
  const hoveredEvent = info?.event;

  if (isMixMode?.value) {
    highlightMixThreadOnHover(y, backgroundCanvasRef, backgroundCanvasCtx);
    const wrapCtx = ctxs[props.processKey]?.hoverWrapContainerCtx;
    drawHoverWrapContainner(hoveredEvent, x, y, wrapCtx);
    
    const wrapLabelHover = detectWrapLabelHover(x, y);
    if (wrapLabelHover) {
      renderWrapLabel(wrapCtx, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState, wrapId: wrapLabelHover });
      showWrapLabelTooltip(e, wrapLabelHover);
      canvasRef.style.cursor = 'pointer';
      return;
    }
  } else {
    highlightThreadOnHover(y, backgroundCanvasRef, backgroundCanvasCtx);
  }
  
  if (e.altKey) {
    handleAltMove(e, info, refs);
  } else if (e.ctrlKey) {
    measureState.isMeasureFirst = false;
  } else {
    measureState.isMeasureFirst = false;
    handlePureMove(info, refs, localPosition);
  }

  updateCursorState(e, hoveredEvent, x, y, canvasRef);
}, 80);
const handleHoverEvent = (hoveredEvent) => {
  if (!hoveredEvent) {
    return false;
  }
  const { args } = hoveredEvent ?? {};
  const { color } = args ?? {};
  const eventHintStr = args?.['event-hint'] ?? '';
  const rootHashList = [getRootHashList(eventHintStr)];
  // 使用可选链和空值合并确保安全
  if (shouldUpdateOutline(color)) {
    handleOutline(color, false);
    sendMsg('returnSemanticLabelFromSwim', { label: color, rootHashList: rootHashList?.length ? rootHashList : [] });
  }
  preLabel = color;
  return true;
};
const shouldUpdateOutline = (color) => {
  return preLabel !== color && !isLockStatus.value && isThreeColumn && !isHoverLockStatus.value;
};

const detectWrapLabelHover = (x, y) => {
  const swimLaneOrder = swimDataManager.getSwimLaneOrder();
  const mouseXInCanvas = getNoZoomX(x, viewState);
  
  for (const lane of swimLaneOrder) {
    if (lane.type !== 'wrap-label') { continue };
    
    const laneY = lane.y;
    const laneHeight = lane.height;
    if (y < laneY || y > laneY + laneHeight) { continue };
    
    const laneKey = lane.wrapId || lane.wrapIds?.join('-');
    const cachedData = getWrapLabelCache(laneKey);
    
    if (!cachedData) { continue };
    
    const { labelBoxes, padding } = cachedData;
    
    for (const boxInfo of labelBoxes) {
      const { wrapId, labelX, boxWidth } = boxInfo;
      const boxStartX = labelX - padding;
      const boxEndX = boxStartX + boxWidth;
      
      if (mouseXInCanvas >= boxStartX && mouseXInCanvas <= boxEndX) {
        return wrapId;
      }
    }
  }
  
  return null;
};

const showWrapLabelTooltip = (e, wrapId) => {
  if (!tooltip.value) { return };
  
  const tooltipContent = `<div class="tooltip-container"><div class="tooltip-item"><span class="tooltip-value">Wrap ${wrapId}</span></div></div>`;
  tooltip.value.innerHTML = tooltipContent;
  tooltipStyle.display = 'block';
  
  const tooltipWidth = tooltip.value.offsetWidth;
  const tooltipHeight = tooltip.value.offsetHeight;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let leftPos = e.clientX + 10;
  let topPos = e.clientY + 10;
  
  if (e.clientX + tooltipWidth + 15 > viewportWidth) {
    leftPos = e.clientX - tooltipWidth - 10;
  }
  if (e.clientY + tooltipHeight + 15 > viewportHeight) {
    topPos = e.clientY - tooltipHeight - 10;
  }
  
  tooltipStyle.left = `${leftPos}px`;
  tooltipStyle.top = `${topPos}px`;
};

const updateCursorState = (e, hoveredEvent, x, y, canvasRef) => {
  const taskCursor = handleTooltipAndCursor(e, hoveredEvent, canvasRef) || '';
  const lineCursor = handleLineTooltipAndCursor(e, x, y) || '';
  const dragCursor = handleCtrlDragPan(e, canvasRef) || '';
  canvasRef.style.cursor = taskCursor || lineCursor || dragCursor;
};

const drawSelectionBox = () => {
  const uiCanvasRef = document.querySelector(`[data-selection-process-key="${props.processKey}"]`);
  const uiCtx = uiCanvasRef.getContext('2d');
  if (!uiCtx) {
    return;
  }
  clearWholeProcess(uiCtx, viewState, props.processKey);
  const {startLocalX, startY, endLocalX, endY} = selection;
  // 填充矩形
  uiCtx.fillStyle = 'rgba(53, 127, 255, 0.5)';
  uiCtx.strokeStyle = 'rgba(53, 127, 255, 1)';
  uiCtx.beginPath();
  uiCtx.lineWidth = 1;
  uiCtx.rect(startLocalX, startY, endLocalX - startLocalX, endY - startY, 4);
  uiCtx.fill();
};
const drawSelectionHightlight = () => {
  const canvasRef = document.querySelector(`[data-selection-process-key="${props.processKey}"]`);
  const ctx = canvasRef.getContext('2d');
  selectionEvents.forEach(eventItem => {
    onSelectionEvent(eventItem, ctx, props.processKey, true);
  });
};
const handleSelection = () => {
  // 这里可以判断那些元素在框内
  checkInSelection();
  if (!selectionEvents.length) {
    mulDetailsExpanded.value = false;
    clearSelectionCanvas('data-selection-process-key');
    return;
  }
  // 清掉其他泳道的框选
  processes.forEach((process, processKey) => {
    if (!processExpanded.get(processKey) || process.type === 'aicpu' || processKey === props.processKey) {
      return;
    }
    const canvasRef = document.querySelector(`[data-selection-process-key="${processKey}"]`);
    if (!canvasRef) {
      return;
    }
    const ctx = canvasRef.getContext('2d');
    clearWholeProcess(ctx, viewState, processKey);
  }); 
  drawSelectionHightlight();
  mulDetailsExpanded.value = true;
  detailsPanelExpanded.value = false;
};
// 按y坐标分组，计算每行的左右边界
const calcRowBoundaries = (nodes) => {
  const rows = {};
  nodes.forEach(([x, y, w, h]) => {
    // 按y坐标分组(假设每行高度固定)
    const rowKey = `${y}`;
    if (!rows[rowKey]) {
      rows[rowKey] = { left: x, right: x + w, top: y, bottom: y + h };
    } else {
      rows[rowKey].left = Math.min(rows[rowKey].left, x);
      rows[rowKey].right = Math.max(rows[rowKey].right, x + w);
      rows[rowKey].bottom = y + h; // 更新行高(取最大)
    }
  });
  const sortedRows = Object.values(rows).sort((a, b) => a.top - b.top);
  if (!sortedRows.length) {
    return [];
  }
  // 分割为连续区域
  const regions = [];
  let currentRegion = [sortedRows[0]];
  for (let i = 1; i < sortedRows.length; i++) {
    const prevRow = sortedRows[i - 1];
    const currentRow = sortedRows[i];
    const gap = currentRow.top - prevRow.bottom;
    const threshold = 2 * (currentRow.bottom - currentRow.top); // 阈值：行高的两倍
    if (gap > threshold) {
      regions.push(currentRegion);
      currentRegion = [currentRow];
    } else {
      currentRegion.push(currentRow);
    }
  }
  if (currentRegion.length > 0) {
    regions.push(currentRegion);
  }

  // 返回每个区域的行对象数组
  return regions.map(region => {
    return region.map(row => ({
      leftTop: [row.left, row.top],
      leftBottom: [row.left, row.bottom],
      rightTop: [row.right, row.top],
      rightBottom: [row.right, row.bottom],
    }));
  });
};

const lockClick = (e) => {
  lockedLabel = preLabel;
  e.stopPropagation();
  isLockStatus.value = true;
  sendMsg('activeLock', { label: preLabel });
  let rootHashArray = [];
  processes.forEach((process, processKey) => {
    if (!processExpanded.get(processKey)) {
      return;
    }
    process.threads.forEach((thread, threadKey) => {
      if (thread.isCounter) {
        return; // 因为counter总是在最下方，不需要重绘，所以可以提前结束
      }
      const { events } = thread;
      events.forEach((event, eventKey) => {
        const { args } = event;
        const { color } = args;
        if (color === preLabel) {
          const eventHintStr = args?.['event-hint'] ?? '';
          const rootHashStr = getRootHashList(eventHintStr);
          rootHashArray.push(rootHashStr);
        }
      });
    });
  });
  const rootHashList = [...new Set(rootHashArray)];
  sendMsg('sendHashList', { rootHashList });
};

const unLockClick = (e) => {
  lockedLabel = '';
  e.stopPropagation();
  isLockStatus.value = false;
  sendMsg('deactivateLock');
};
const toggleLock = () => {
  if (!boundaries.length) {
    lockPosition.value = null;
    return;
  }
  let [x, y]= boundaries[0][0].leftTop;
  x = (x * viewState.scale) + viewState.offsetX + spaceInThreeCol;
  if (x < 0) {
    lockPosition.value = null;
    return;
  }
  lockPosition.value = {
    top: y,
    left: x,
  };
};
const resizeDrawBoundary = () => {
  if (!boundaries.length) {
    return;
  }
  processes.forEach((process, processKey) => {
    if (!processExpanded.get(processKey) || (drawColorDatas[processKey] && !drawColorDatas[processKey].length)) {
      return;
    }
    changeNodeColor(processKey, true);
    const { eventCtx } = ctxs[processKey];
    drawThreadSeparators(eventCtx, process, processKey);
    if (!drawColorDatas[processKey]) {
      return;
    }
    drawColorDatas[processKey].forEach((event, eventKey) => {
      onSelectionEvent(event, eventCtx, processKey, false);
    });
  });
  threeRender.drawBoundary(boundaries, props.processKey);
  if (!isKeyPressed.value) {
    threeRender.enableAnimate();
    threeRender.animate();
  }
};
const checkInSelection = () => {
  // 初始化计数器
  AICCount = 0;
  AIVCount = 0;
  matchingAICEvents = [];
  matchingAIVEvents = [];
  selectionEvents = [];
  // 解构选择区域坐标
  if (selection.endX < selection.startX) {
    [selection.startX, selection.endX] = [selection.endX, selection.startX];
    [selection.startLocalX, selection.endLocalX] = [selection.endLocalX, selection.startLocalX];
    [selection.startY, selection.endY] = [selection.endY, selection.startY];
  }
  const { startX, startY, endX, endY } = selection;

  // 计算时间范围
  const start = xToTime(startX + layout.processLabelWidth);
  const end = xToTime(endX + layout.processLabelWidth);

  // 预计算选择框边界
  const selectMinY = Math.min(startY, endY);
  const selectMaxY = Math.max(startY, endY);

  // 遍历进程
  const process = processes.get(props.processKey);
  // 遍历线程
  if (processExpanded.get(props.processKey) && canDragSelect(props.processKey)) {
    process.threads.forEach((thread, threadKey) => {
      const { threadName, events } = thread;
      const isTargetEvent = threadName.startsWith('AIC_') || threadName.startsWith('AIV_');
      if (!isTargetEvent) {
        return;
      }
      const [{ renderInfo }] = events;
      const { y } = renderInfo;
      if (y < selectMinY || (y + layout.eventHeight) > selectMaxY) {
        return;
      }
      const processThreadEventSearchTemp = processThreadEventSearch(thread, start, end);
      if (threadName.startsWith('AIC_')) {
        if (processThreadEventSearchTemp.length) {
          AICCount++;
        }
        matchingAICEvents.push(...processThreadEventSearchTemp);
      } else if (threadName.startsWith('AIV_')) {
        if (processThreadEventSearchTemp.length) {
          AIVCount++;
        }
        matchingAIVEvents.push(...processThreadEventSearchTemp);
      }
    });
  }
  selectionEvents = [...matchingAICEvents, ...matchingAIVEvents];
  const [selectionStartTime, selectionEndTime] = selectionEvents.reduce(
    ([min, max], { startTime, endTime }) => [
      Math.min(min, startTime),
      Math.max(max, endTime)
    ],
    selectionEvents.length ? [selectionEvents[0].startTime, selectionEvents[0].endTime] : [0, 0]
  );
  const timeRange = selectionEndTime - selectionStartTime;
  // 最终统计
  measureDetailGet(matchingAICEvents, matchingAIVEvents, timeRange, AICCount, AIVCount);
};
function onHoverEvent(hoveredEvent) {
  const canvasRef = document.querySelector(`[data-hover-process-key="${props.processKey}"]`);
  if (!canvasRef) {
    return;
  }
  const ctx = canvasRef.getContext('2d');
  clearWholeProcess(ctx, viewState, props.processKey);
  if (hoveredEvent) {
    if (isMixMode?.value && hoveredEvent.parentEventId) {
      renderDimmedNodesInWrap(hoveredEvent, ctx);
      highlightMixEvent(ctx, hoveredEvent, props.processKey);
    } else {
      highlightEvent(ctx, hoveredEvent, props.processKey, false);
    }
  }
}
const clearSelectionCanvas = (key) => {
  const canvasRef = document.querySelector(`[${key}="${props.processKey}"]`);
  if (!canvasRef) {
    return;
  }
  const ctx = canvasRef.getContext('2d');
  clearWholeProcess(ctx, viewState, props.processKey);
  if (key !== 'data-three-column-process-key') {
    return;
  }
  points = [];
  boundaries = [];
  lockPosition.value = isLockStatus.value ? lockPosition.value : null;
  threeRender.stopAnimate();
};
const clearAllSelectionCanvas = (key) => {
  mulDetailsExpanded.value = false;
  for (const [processKey] of processes.entries()) {
    const canvasRef = document.querySelector(`[${key}="${processKey}"]`);
    if (!canvasRef) {
      return;
    }
    const ctx = canvasRef.getContext('2d');
    clearWholeProcess(ctx, viewState, processKey);
  }
};
function onSelectionEvent(hoveredEvent, ctx, processKey, highlight) {
  highlightEvent(ctx, hoveredEvent, processKey, false, highlight);
}
const handleMouseDown = (e) => {
  hideLineTooltip();
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef || !mousePosition) {
    return;
  }
  if (!isLockStatus.value) {
    // 获取鼠标按下时的坐标
    const rect = canvasRef.getBoundingClientRect();
    if (!e.ctrlKey) {
      selection.startX = e.clientX - rect.left;
      selection.startY = e.clientY - rect.top;
      const { x } = computeLocalXY(canvasRef, mousePosition, viewState);
      selection.startLocalX = x;
    }

    isClick.value = true;
    isDragging.value = canDragSelect(props.process);

    measureDetailsData.value = [];
    rootHashes.value = [];
    leafHashes.value = [];
    leafHashMap.value.clear();
  }
  if (!e.ctrlKey) { return };
  lastMoveX = e.clientX;
};

const handleMouseUp = throttle((e) => {
  selectionFinished(e);
}, 16);

const handleMouseLeave = (e) => {
  mousePosition = null;
  handleMouseLeaveThrottle(e);
};

const handleMouseLeaveThrottle = throttle((e) => {
  hideTooltip();
  if (isDragging.value) {
    selectionFinished(e);
  }
  e.stopPropagation();
}, 16);
const selectionFinished = (e) => {
  if (isLockStatus.value || !mousePosition) {
    return;
  }
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) {
    return;
  }
  if (!canDragSelect(props.process)) {
    isDragging.value = false;
    return;
  }
  const rect = canvasRef.getBoundingClientRect();
  if (!e.ctrlKey) {
    selection.endX = e.clientX - rect.left;
    selection.endY = e.clientY - rect.top;
    const { x } = computeLocalXY(canvasRef, mousePosition, viewState);
    selection.endLocalX = x;
  }
  const dx = Math.abs(selection.endX - selection.startX);
  const dy = Math.abs(selection.endY - selection.startY);
  if (dx < 5 || dy < 5) {
    isClick.value = true;
    mulDetailsExpanded.value = false;
  } else if (!e.ctrlKey) {
    isClick.value = false;
    // 框选后的逻辑
    handleSelection();
  }
  isDragging.value = false;
};
const getCanvasHeight = () => {
  let height = 0;
  for (const [_, thread] of props.process.threads.entries()) {
    const threadKey = thread.isCounter ? thread.threadName : thread.tid;
    height += getThreadHeight(props.processKey, threadKey, lane2line, layout, thread.isCounter);
  }
  return height;
};

const resizeCanvas = () => {
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef || !swimlaneContainer.value) { return };

  const containerRect = swimlaneContainer.value.getBoundingClientRect();
  updateProcessSize(props.process, props.processKey, containerRect, layout, lane2line, viewState, isMixMode?.value);
};

const clearEventDrawdata = (process, processKey) => {
  for (const [threadKey, thread] of process.threads.entries()) {
    for (const event of thread.events) {
      const { drawData } = event;
      if (!drawData) {
        continue;
      }
      delete event.drawData;
    }
  }
};

const transformEvents = (process, processKey) => {
  if (!ctxs[processKey]) {
    return;
  }
  let { eventCtx, backgroundCtx } = ctxs[processKey];

  for (const ctx of Object.values(ctxs[processKey])) {
    if (ctx) {
      clearWholeProcess(ctx, viewState, processKey);
    }
  }
  
  if (isMixMode && isMixMode.value && swimDataManager.hasMixConfig()) {
    clearEventDrawdata(process, processKey);
    const wrapCtx = ctxs[processKey]?.wrapContainerCtx;
    clearWholeProcess(wrapCtx, viewState, processKey);
    renderWrapLabel(wrapCtx, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState });
    renderMixModeEvents(process, processKey, eventCtx);
    const wrapContainers = swimDataManager.getWrapContainers();
    const swimLaneOrder = swimDataManager.getSwimLaneOrder();
    if (wrapCtx) {
      for (const wrapContainer of wrapContainers) {
        renderWrapContainerBox(wrapCtx, wrapContainer, swimLaneOrder, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState });
      }
    }
    renderMixDependenciesAll(processKey, viewState, layout, eventCtx, getPositionByTime, isDarkTheme.value);
  } else if (isMixMode && !isMixMode.value && swimDataManager.hasMixConfig() ) {
    drawMixTransformEvent(process, processKey, eventCtx);
  } else {
    for (const [threadKey, thread] of process.threads.entries()) {
      drawTransformEvent(thread, eventCtx, false);
    }
    if ((selectedEvent.value || searchedEvent.value) && !drawColorDatas.length) {
      changeNodeColor(processKey, true, false);
    }
  }

  if (backgroundCtx) {
    highlightThread(process, processKey, backgroundCtx);
  }
  if (eventCtx) {
    drawThreadSeparators(eventCtx, process, processKey);
  }
};

const drawTransformEvent = (thread, eventCtx, isPinned = false) => {
    if (thread.isCounter) {
      eventCtx.save();
      eventCtx.setTransform(1, 0, 0, devicePixelRatio, 0, 0);
      eventCtx.beginPath();
      eventCtx.strokeStyle = '#4aaad6ff';
      eventCtx.lineWidth = 1;
      const { drawData } = thread;
      if (drawData) {
        for (const element of drawData) {
          let [x, y] = element;
          if (isPinned && thread.isPinned) {
            y -= thread.offsetY;
          }
          eventCtx.lineTo(getNoZoomX(x, viewState), y);
        }
      }
      eventCtx.stroke();
      eventCtx.closePath();
      eventCtx.restore();
    } else if (!selectedEvent.value && !drawColorDatas.length) {
      let eventDatas = [];
      for (const event of thread.events) {
        const { drawData } = event;
        if (!drawData) {
          continue;
        }
        if (event.renderEndTime < timelineState.startTime || event.renderStartTime > timelineState.endTime) {
          drawData.show = false;
          continue;
        }
        drawData.show = true;
        eventDatas.push(drawData);
      }
      eventRenderer.drawEvent(eventDatas, eventCtx, false, isPinned);
    }
};

const drawMixTransformEvent = (process, processKey, ctx) => {
  for (const [threadKey, thread] of process.threads.entries()) {
    const key = thread.isCounter ? thread.threadName : thread.tid;
    const threadY = getThreadStartY(process, processKey, key, lane2line, layout);
    if (thread.isCounter && processExpanded.get(processKey)) {
      drawCounterThread(thread, ctx, threadY);
    } else {
      drawEventThread(thread, ctx, threadY, processKey);
      drawTransformEvent(thread, ctx, false);
    }
  }
};

const renderProcessEvents = (process, processKey) => {
  const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
  if (!canvasRef) {
    return;
  }

  // 确保画布尺寸正确
  if (canvasRef.width === 0 || canvasRef.height === 0) {
    const containerRect = swimlaneContainer.value.getBoundingClientRect();
    updateProcessSize(process, processKey, containerRect, layout, lane2line, viewState, isMixMode?.value);
  }
  let { eventCtx, backgroundCtx } = ctxs[processKey];
  for (const ctx of Object.values(ctxs[processKey])) {
    if (ctx) {
      clearWholeProcess(ctx, viewState, processKey);
    }
  }

  if (isMixMode && isMixMode.value && swimDataManager.hasMixConfig()) {
    const wrapCtx = ctxs[processKey]?.wrapContainerCtx;
    clearWholeProcess(wrapCtx, viewState, processKey);
    renderWrapLabel(wrapCtx, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState });
    renderMixModeEvents(process, processKey, eventCtx);
    const wrapContainers = swimDataManager.getWrapContainers();
    const swimLaneOrder = swimDataManager.getSwimLaneOrder();
    if (wrapCtx) {
      for (const wrapContainer of wrapContainers) {
        renderWrapContainerBox(wrapCtx, wrapContainer, swimLaneOrder, getPositionByTime, globalConnectionCanvas, { colorCfg, layout, viewState });
      }
    }
    renderMixDependenciesAll(processKey, viewState, layout, eventCtx, getPositionByTime, isDarkTheme.value);
  } else {
    drawThreads(process, processKey, eventCtx);
  }
  
  if (processExpanded.get(processKey)) {
    highlightThread(process, processKey, backgroundCtx);
    drawThreadSeparators(eventCtx, process, processKey);
  }
};

const renderProcessPinEvents = (thread, eventCtx, threadY, processKey) => {
  pinnedStatus.value = true;
  
  if (isMixMode?.value && swimDataManager.hasMixConfig()) {
    renderMixPinnedThread(thread, eventCtx, threadY, processKey);
  } else {
    if (thread.isCounter) {
      drawCounterThread(thread, eventCtx, threadY, true);
    } else {
      drawEventThread(thread, eventCtx, threadY, processKey);
    }
  }
};

const renderMixPinnedSubThread = (parentEvents, drawDatas, processKey, eventY) => {
  const { processLabelWidth, eventHeight } = layout;
  for (const parentEvent of parentEvents) {
    const subEvents = swimDataManager.getSubEvents(parentEvent.id);
    const colors = getEventColor(parentEvent, eventRenderer.deps, processKey, false, false);
    
    for (const subEvent of subEvents) {
      if (!isEventInTimeRange(subEvent)) {
        continue;
      }
      
      // 更新 renderInfo - 保留原始 y，只设置 pinnedEventY
      if (!subEvent.renderInfo) {
        subEvent.renderInfo = {
          x: subEvent.drawData?.rectX || getPositionByTime(subEvent.startTime, viewState, layout) - processLabelWidth,
          y: eventY,
          width: subEvent.drawData?.width || getWidthByDuration(subEvent.endTime - subEvent.startTime, viewState, layout),
          height: eventHeight,
          processKey,
        };
      }
      subEvent.renderInfo.pinnedEventY = eventY;
      
      if (!parentEvent.renderInfo) {
        parentEvent.renderInfo = { pinnedEventY: eventY, y: eventY };
      } else {
        parentEvent.renderInfo.pinnedEventY = eventY;
      }
      
      if (!parentEvent.drawData) {
        parentEvent.drawData = { pinnedEventY: eventY, show: false };
      } else {
        parentEvent.drawData.pinnedEventY = eventY;
      }
      
      if (subEvent.drawData) {
        const pinnedDrawData = {
          ...subEvent.drawData,
          rectY: eventY,
          pinnedEventY: eventY,
          pinnedTextY: eventY * devicePixelRatio + eventTextSize,
          textY: eventY * devicePixelRatio + eventTextSize,
        };
        pinnedDrawData.rectColor = colors.fillColor;
        pinnedDrawData.fontColor = colors.fontColor;
        pinnedDrawData.show = true;
        drawDatas.push(pinnedDrawData);
      }
    }
    
    const waitTasks = swimDataManager.getWaitTasks(parentEvent.id);
    for (const waitTask of waitTasks) {
      if (!isEventInTimeRange(waitTask)) {
        continue;
      }
      
      // 更新 renderInfo - 保留原始 y，只设置 pinnedEventY
      if (!waitTask.renderInfo) {
        waitTask.renderInfo = {
          x: waitTask.drawData?.rectX || getPositionByTime(waitTask.startTime, viewState, layout) - processLabelWidth,
          y: eventY,
          width: waitTask.drawData?.width || getWidthByDuration(waitTask.endTime - waitTask.startTime, viewState, layout),
          height: eventHeight,
          processKey,
        };
      }
      waitTask.renderInfo.pinnedEventY = eventY;
      
      if (waitTask.drawData) {
        const pinnedDrawData = {
          ...waitTask.drawData,
          rectY: eventY,
          pinnedEventY: eventY,
          pinnedTextY: eventY * devicePixelRatio + eventTextSize,
          textY: eventY * devicePixelRatio + eventTextSize,
        };
        pinnedDrawData.show = true;
        drawDatas.push(pinnedDrawData);
      }
    }
  }
};

const renderMixNormanThread = (normalEvents, drawDatas, processKey, eventY) => {
  for (const event of normalEvents) {
    if (!isEventInTimeRange(event)) {
      continue;
    }
    
    // 更新 renderInfo - 保留原始 y，只设置 pinnedEventY
    if (!event.renderInfo) {
      event.renderInfo = {
        y: eventY,
      };
    }
    event.renderInfo.pinnedEventY = eventY;
    event.drawData.pinnedEventY = eventY;
    
    if (event.drawData) {
      const { fillColor, fontColor, strokeColor } = getEventColor(event, eventRenderer.deps, processKey, false, false);
      const pinnedDrawData = {
        ...event.drawData,
        rectY: eventY,
        pinnedEventY: eventY,
        pinnedTextY: eventY * devicePixelRatio + eventTextSize,
        textY: eventY * devicePixelRatio + eventTextSize,
        rectColor: fillColor,
        strokeColor,
        fontColor,
        show: true,
      };
      drawDatas.push(pinnedDrawData);
    }
  }
};

const renderMixPinnedThread = (thread, eventCtx, threadY, processKey) => {
  const threadInfo = getThreadInfo(processKey, thread.tid);
  if (!threadInfo) { return };
  
  const drawDatas = [];
  const { eventHeight, threadHeight } = layout;
  const halfEventHeight = eventHeight / 2;
  const laneHeight = threadHeight;
  const eventY = threadY + laneHeight / 2 - halfEventHeight;
  if (thread.isCounter) {
    thread.drawData = collectCounterDrawData(thread, threadY, true);
    drawCounterThread(thread, eventCtx, threadY, true);
  } else {
    const parentEvents = threadInfo.eventIds
      .map(id => swimDataManager.getEventById(id))
      .filter(e => e && swimDataManager.isMixParentEvent(e));
 
    renderMixPinnedSubThread(parentEvents, drawDatas, processKey, eventY);
    
    const normalEvents = threadInfo.eventIds
      .map(id => swimDataManager.getEventById(id))
      .filter(e => e && !swimDataManager.isMixParentEvent(e));
 
    renderMixNormanThread(normalEvents, drawDatas, processKey, eventY);
  }

  if (drawDatas.length > 0) {
    eventRenderer.drawEvent(drawDatas, eventCtx, false, true);
    eventRenderer.drawEventText(drawDatas, eventCtx, false, true);
  }
};

const highlightThread = (process, processKey, backgroundCtx) => {
  if (curThread.value != '') {
    const [curProcess, lane] = curThread.value.split('-');
    const curLane = parseInt(lane);
    if (curProcess == processKey) {
      let curY = 0;
      let curHeight = 0;
      
      if (isMixMode?.value && swimDataManager.hasMixConfig()) {
        const swimLaneOrder = swimDataManager.getSwimLaneOrder();
        if (curLane >= 0 && curLane < swimLaneOrder.length) {
          curY = swimLaneOrder[curLane].y;
          curHeight = swimLaneOrder[curLane].height;
          clearWholeProcess(backgroundCtx, viewState, processKey);
          backgroundCtx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
          backgroundCtx.fillRect(0, curY, viewState.clearWidth, curHeight);
        }
        return;
      }
      const threads = [];
      for (const [threadKey, thread] of process.threads.entries()) {
        threads.push(thread);
      }
      for (let index = 0; index < threads.length; index++) {
        let thread = threads[index];
        const threadKey = thread.isCounter ? thread.threadName : thread.tid;
        curHeight = getThreadHeight(processKey, threadKey, lane2line, layout, thread.isCounter);
        if (index >= curLane) { break };
        curY += curHeight;
      }
      clearWholeProcess(backgroundCtx, viewState, processKey);
      backgroundCtx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
      backgroundCtx.fillRect(0, curY, viewState.clearWidth, curHeight);
    }
  }
};

const drawThreads = (process, processKey, ctx) => {
  for (const [threadKey, thread] of process.threads.entries()) {
    const key = thread.isCounter ? thread.threadName : thread.tid;
    const threadY = getThreadStartY(process, processKey, key, lane2line, layout);
    if (thread.isCounter && processExpanded.get(processKey)) {
      drawCounterThread(thread, ctx, threadY);
    } else {
      drawEventThread(thread, ctx, threadY, processKey);
    }
  }
};

const getThreadInfo = (processKey, tid) => {
  const processInfo = swimDataManager.processInfo.get(processKey);
  if (!processInfo) { return null };
  
  for (const [threadKey, t] of processInfo.threads.entries()) {
    if (t.tid === tid) {
      return t;
    }
  }
  return null;
};

const isEventInTimeRange = (event) => {
  return !(event.endTime < timelineState.startTime || event.startTime > timelineState.endTime);
};

const updateEventDrawData = (event, isDimmed, processKey) => {
  if (!event.drawData) { return };
  
  if (!isDimmed) {
    const { fillColor, fontColor, strokeColor } = getEventColor(event, eventRenderer.deps, processKey, false, false);
    event.drawData.rectColor = fillColor;
    event.drawData.strokeColor = strokeColor;
    event.drawData.fontColor = fontColor;
  }
  event.drawData.show = true;
};

const changeWrapThreadNodeColor = (thread, processKey, isDimmed, drawDatas, siblingContext={}) => {
  const threadInfo = getThreadInfo(processKey, thread.tid);
  if (!threadInfo) { return };
  
  const parentEvents = threadInfo.eventIds
    .map(id => swimDataManager.getEventById(id))
    .filter(e => e && swimDataManager.isMixParentEvent(e));
  
  const { parentEventId, siblingDrawDatas=[] } = siblingContext;
  
  for (const parentEvent of parentEvents) {
    const subEvents = swimDataManager.getSubEvents(parentEvent.id);
    
    const isSiblingParent = parentEvent.id === parentEventId;
    
    for (const subEvent of subEvents) {
      const colors = getEventColor(subEvent, eventRenderer.deps, processKey, false, false);
      if (!isEventInTimeRange(subEvent)) {
        if (subEvent.drawData) {
          subEvent.drawData.show = false;
        }
        continue;
      }
      if (subEvent.drawData) {
        if (isSiblingParent) {
          subEvent.drawData.rectColor = colors.fillColor;
          subEvent.drawData.fontColor = colors.fontColor;
          subEvent.drawData.show = true;
          siblingDrawDatas.push(subEvent.drawData);
          continue;
        }
        if (!isDimmed) {
          subEvent.drawData.rectColor = colors.fillColor;
          subEvent.drawData.fontColor = colors.fontColor;
        }
        subEvent.drawData.show = true;
        drawDatas.push(subEvent.drawData);
      }
    }
    
    const waitTasks = swimDataManager.getWaitTasks(parentEvent.id);
    for (const waitTask of waitTasks) {
      if (!isEventInTimeRange(waitTask)) {
        if (waitTask.drawData) {
          waitTask.drawData.show = false;
        }
        continue;
      }
      if (waitTask.drawData) {
        waitTask.drawData.show = true;
        waitTask.drawData.fontColor = selectedEvent.value ? colorCfg.eventFontNoColor : colorCfg.eventFont;
        drawDatas.push(waitTask.drawData);
      }
    }
  }
  
  const normalEvents = threadInfo.eventIds
    .map(id => swimDataManager.getEventById(id))
    .filter(e => e && !swimDataManager.isMixParentEvent(e));
  
  for (const event of normalEvents) {
    if (!isEventInTimeRange(event)) {
      if (event.drawData) {
        event.drawData.show = false;
      }
      continue;
    }
    if (event.drawData) {
      updateEventDrawData(event, isDimmed, processKey);
      drawDatas.push(event.drawData);
    }
  }
};

const changeNormalMixThreadNodeColor = (thread, processKey, isDimmed, drawDatas) => {
  const threadInfo = getThreadInfo(processKey, thread.tid);
  if (!threadInfo) { return };
  
  const events = threadInfo.eventIds
    .map(id => swimDataManager.getEventById(id))
    .filter(e => e);
  
  for (const event of events) {
    if (!isEventInTimeRange(event)) {
      if (event.drawData) {
        event.drawData.show = false;
      }
      continue;
    }
    if (event.drawData) {
      updateEventDrawData(event, isDimmed, processKey);
      drawDatas.push(event.drawData);
    }
  }
};

const changeMixModeNodeColor = (processKey, isDimmed, drawDatas, clickedEvent=null, siblingDrawDatas=[]) => {
  const swimLaneOrder = swimDataManager.getSwimLaneOrder();
  let maxThreadY = 0;
  
  const siblingContext = {
    parentEventId: clickedEvent?.parentEventId,
    siblingDrawDatas
  };
  
  for (const lane of swimLaneOrder) {
    if (lane.type !== 'thread' || lane.thread.isCounter) { continue };
    maxThreadY = Math.max(maxThreadY, lane.y + lane.height);
    
    if (lane.wrapIds.length > 0) {
      changeWrapThreadNodeColor(lane.thread, processKey, isDimmed, drawDatas, siblingContext);
    } else {
      changeNormalMixThreadNodeColor(lane.thread, processKey, isDimmed, drawDatas);
    }
  }
  
  return maxThreadY;
};

const changeNormalNodeColor = (process, processKey, isDimmed, drawDatas) => {
  let maxThreadY = 0;
  
  for (const [threadKey, thread] of process.threads.entries()) {
    if (thread.isCounter) {
      break;
    }
    const threadY = getThreadStartY(process, processKey, thread.tid, lane2line, layout);
    const threadHeight = getThreadHeight(processKey, thread.tid, lane2line, layout, thread.isCounter);
    maxThreadY = Math.max(maxThreadY, threadY + threadHeight);
    
    for (const event of thread.events) {
      if (event.renderEndTime < timelineState.startTime || event.renderStartTime > timelineState.endTime) {
        event.drawData.show = false;
        event.drawData.text = '';
        swimDataManager.updateEvent(event.id, { drawData: event.drawData });
        continue;
      }
      if (event.drawData) {
        updateEventDrawData(event, isDimmed, processKey);
        swimDataManager.updateEvent(event.id, { drawData: event.drawData });
        drawDatas.push(event.drawData);
      }
    }
  }
  
  return maxThreadY;
};

const changeNodeColor = (processKey, isDimmed=false, needText=true) => {
  if (!processKey || !ctxs[processKey]) { return };
  
  const { eventCtx } = ctxs[processKey];
  const drawDatas = [];
  const siblingDrawDatas = [];
  const process = processes.get(processKey);
  let maxThreadY = 0;
  
  const clickedEvent = selectedEvent.value;
  if (isMixMode?.value && swimDataManager.hasMixConfig()) {
    maxThreadY = changeMixModeNodeColor(processKey, isDimmed, drawDatas, clickedEvent, siblingDrawDatas);
  } else {
    maxThreadY = changeNormalNodeColor(process, processKey, isDimmed, drawDatas);
  }
  
  if (processExpanded.get(processKey)) {
    eventCtx.clearRect(0, 0, viewState.clearWidth, maxThreadY + 1);
    eventRenderer.drawEvent(drawDatas, eventCtx, isDimmed);
    if (needText) {
      eventRenderer.drawEventText(drawDatas, eventCtx, isDimmed);
    }
    
    if (siblingDrawDatas.length > 0) {
      eventRenderer.drawEvent(siblingDrawDatas, eventCtx, false);
      if (needText) {
        eventRenderer.drawEventText(siblingDrawDatas, eventCtx, false);
      }
    }
    
    if (isMixMode?.value && swimDataManager.hasMixConfig()) {
      renderMixDependenciesAll(processKey, viewState, layout, eventCtx, getPositionByTime, isDarkTheme.value);
    }
  }
};

const clearDependencyLines = (processKey) => {
  dependencyLinesInfo.value = dependencyLinesInfo.value.filter(line =>
    line.processKey !== processKey
  );
  const dependencyCanvasRef = document.querySelector(`[data-dep-process-key="${processKey}"]`);
  if (!dependencyCanvasRef) { return false };
  
  const dependencyCtx = dependencyCanvasRef.getContext('2d');
  clearWholeProcess(dependencyCtx, viewState, processKey);
  return dependencyCtx;
};

// 在依赖线画布上绘制依赖连接线
const drawDependencyLines = (process, processKey, mode) => {
  const ctx = clearDependencyLines(processKey);
  if (!ctx || !(selectedEvent.value || searchedEvent.value)) { return };
  ctx.lineWidth = 1;
  if (selectedEvent.value) {
    if (isPathLockStatus.value) {
      selectedEvent.value = pathLockedEvent.value;
    }
    const { eventMap } = swimDataManager;
    let level = userConfig.value.connectionLevel;
    const edgesToDraw = collectRelevantEdges(
      selectedEvent.value.id,
      eventMap,
      mode,
      level
    );
    renderDependencyEdges(edgesToDraw, eventMap, ctx);
    highlightEvent(ctx, selectedEvent.value, processKey, true);
  }
  highlightEvent(ctx, searchedEvent.value, processKey, true);
};

const drawMaxScheduleLine = (startEvent, endEvent, process, processKey) => {
  if (!isDragging.value) {
    clearSelectionCanvas('data-selection-process-key');
  }
  const ctx = clearDependencyLines(processKey);
  if (!ctx || !(selectedEvent.value)) {
    return;
  }
  ctx.lineWidth = 1;
  if (selectedEvent.value) {
    const eventMap = buildEventMap(process);
    const edgesToDraw = [`${startEvent}->${endEvent}`];
    renderDependencyEdges(edgesToDraw, eventMap, ctx);
    highlightEvent(ctx, selectedEvent.value, processKey, true, true);
  }
};

/**
 * 收集并绘制所有在层级内的依赖边
 */
const renderDependencyEdges = (edgesToDraw, eventMap, ctx) => {
  for (const edge of edgesToDraw) {
    const [fromId, toId] = edge.split('->');
    const fromEvent = eventMap.get(fromId);
    const toEvent = eventMap.get(toId);
    const needDraw = fromEvent && toEvent && fromEvent.renderInfo && toEvent.renderInfo;
    if (needDraw) {
      drawSingleEdge(fromEvent, toEvent, ctx);
    }
  }
};

/**
 * 绘制单条依赖线（箭头 + 事件框 + 文本）
 */
const drawSingleEdge = (fromEvent, toEvent, ctx) => {
  if (!fromEvent.renderInfo || !toEvent.renderInfo) {
    return;
  }
  if (fromEvent.renderInfo.processKey !== toEvent.renderInfo.processKey) {
    return;
  }

  const fromColor = isDarkTheme.value ? fromEvent.color.dark : fromEvent.color.light;
  const toColor = isDarkTheme.value ? toEvent.color.dark : toEvent.color.light;

  const sourceColor = selectedEvent.value.id === fromEvent.id ? fromColor.light : fromColor.base;
  const targetColor = selectedEvent.value.id === toEvent.id ? toColor.light : toColor.base;

  let fromWidth = fromEvent.renderInfo.width;
  const pos = {
    startX: (fromEvent.renderInfo.x + fromWidth) * devicePixelRatio,
    startY: (fromEvent.renderInfo.y + (fromEvent.renderInfo.height / 2)) * devicePixelRatio,
    endX: toEvent.renderInfo.x * devicePixelRatio,
    endY: (toEvent.renderInfo.y + (toEvent.renderInfo.height / 2)) * devicePixelRatio,
  };

  const linePath = drawArrow(ctx, pos, sourceColor, targetColor, viewState.scale, viewState.offsetX);

  dependencyLinesInfo.value.push({fromEvent, toEvent, linePath, processKey: props.processKey});
  eventRenderer.drawEvent([fromEvent.drawData, toEvent.drawData], ctx);
  eventRenderer.drawEventText([fromEvent.drawData, toEvent.drawData], ctx);
};

const highlightEvent = (ctx, event, processKey, stroke=true, highlight=true) => {
  if (!event || !event.renderInfo) {
    return;
  }
  if (event.renderInfo.processKey !== processKey) {
    return;
  }
  const { renderInfo } = event;
  const { fillColor, fontColor } = getEventColor(event, eventRenderer.deps, processKey, highlight, stroke);
  const { width } = renderInfo;
  const drawData = {
    rectX: renderInfo.x, rectY: renderInfo.y,
    rectPixelX: renderInfo.x * devicePixelRatio, rectPixelY: renderInfo.y * devicePixelRatio,
    eventWidth: width, height: renderInfo.height,
    rectColor: fillColor, strokeColor: '', text: '', textX: 0, textY: 0,
    fontColor, show: true, width,
  };
  eventRenderer.drawEvent([drawData], ctx);
  ctx.font = getFontStyle(eventTextSize);
  const isAicpuProcess = Array.from(processes.entries()).some(([key, value]) => value.type === 'aicpu' && key === processKey);
  fillTextInfo(event, ctx, drawData, true, isAicpuProcess);
  if (!drawData.text) { return };
  eventRenderer.drawEventText([drawData], ctx);
};

const highlightMixEvent = (ctx, event, processKey) => {
  if (!event || !event.renderInfo) {
    return;
  }
  if (event.renderInfo.processKey !== processKey) {
    return;
  }
  
  const { renderInfo } = event;
  let fillColor = '';
  let fontColor = '';
  
  if (event.name === 'Wait') {
    fillColor = colorCfg.eventRectNoColorHighlight;
    fontColor = colorCfg.eventFontHighLight;
  } else {
    ({ fillColor, fontColor } = getEventColor(event, eventRenderer.deps, processKey, true, false));
  }
  
  const { width } = renderInfo;
  const drawData = {
    rectX: renderInfo.x, rectY: renderInfo.y,
    rectPixelX: renderInfo.x * devicePixelRatio, rectPixelY: renderInfo.y * devicePixelRatio,
    eventWidth: width, height: renderInfo.height,
    rectColor: fillColor, strokeColor: '', text: event.name || '', textX: 0, 
    textY: renderInfo.y * devicePixelRatio + eventTextSize,
    fontColor, show: true, width,
  };
  eventRenderer.drawEvent([drawData], ctx);
  ctx.font = getFontStyle(eventTextSize);
  const fakeEvent = {
    name: drawData.text,
    renderStartTime: 0,
    renderDuration: drawData.eventWidth / viewState.scale,
    drawData
  };
  fillTextInfo(fakeEvent, ctx, drawData, true, false);
  if (!drawData.text) { return };
  eventRenderer.drawEventText([drawData], ctx);
};

const drawThreadSeparators = (ctx, process, processKey) => {
  if (isMixMode?.value && swimDataManager.hasMixConfig()) {
    drawMixThreadSeparators(ctx);
    return;
  }
  
  const threadKeys = Array.from(process.threads.keys());

  for (let i = 0; i < threadKeys.length; i++) {
    const threadKey = threadKeys[i];
    const thread = process.threads.get(threadKey);
    const key = thread.isCounter ? thread.threadName : thread.tid;

    const threadY = getThreadStartY(process, processKey, key, lane2line, layout);
    const threadHeight = getThreadHeight(processKey, key, lane2line, layout, thread.isCounter);

    const separatorY = threadY + threadHeight;

    // 对齐到像素边界, 需要保证逻辑坐标alignedY * devicePixelRatio为整数
    thread.bottomY = Math.floor(separatorY * devicePixelRatio) / devicePixelRatio;
  }

  ctx.strokeStyle = colorCfg.splitLineColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([]);
  for (let i = 0; i < threadKeys.length; i++) {
    const threadKey = threadKeys[i];
    const thread = process.threads.get(threadKey);
    if (thread.isCounter) {
      break;
    }
    ctx.beginPath();
    ctx.moveTo(0, thread.bottomY);
    ctx.lineTo(viewState.canvasCssWidth, thread.bottomY);
    ctx.stroke();
  }
};

const drawMixThreadSeparators = (ctx) => {
  const swimLaneOrder = swimDataManager.getSwimLaneOrder();
  if (swimLaneOrder.length === 0) { return };
  
  ctx.strokeStyle = colorCfg.splitLineColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([]);
  
  for (let i = 0; i < swimLaneOrder.length; i++) {
    const lane = swimLaneOrder[i];
    const separatorY = lane.y + lane.height;
    
    ctx.beginPath();
    ctx.moveTo(0, separatorY);
    ctx.lineTo(viewState.canvasCssWidth, separatorY);
    ctx.stroke();
  }
};

const collectCounterDrawData = (thread, threadY, isPinned) => {
  const drawData = [];
  if (!isPinned) {
    thread.drawData = drawData;
  }
  const { counterHeight, processLabelWidth } = layout;
  const maxHeight = counterHeight * 2 / 3;
  const { maxCount, argKey } = thread;
  const segment = 10;
  const countPerHeight = maxHeight / segment;
  const { offsetX, canvasWidth, canvasCssWidth } = viewState;
  
  const baseY = threadY + counterHeight;
  const segmentStep = maxCount ? maxCount / segment : 0;
  
  let lastSegment = null;
  let lastLineY = baseY;
  let targetY = lastLineY;

  drawData.push([0, lastLineY]);

  for (const event of thread.events) {
    const x = getPositionByTime(event.ts, viewState, layout) - processLabelWidth;
    
    if (x < offsetX || x > canvasWidth) {
      break;
    }
    
    const size = event.args[argKey];
    const currentSegment = maxCount ? Math.floor(size / segmentStep) : 0;
    targetY = baseY - countPerHeight * currentSegment;
    
    if (lastSegment === undefined || currentSegment !== lastSegment) {
      drawData.push([x, lastLineY]);
      drawData.push([x, targetY]);
      lastSegment = currentSegment;
      lastLineY = targetY;
    }
  }

  drawData.push([canvasCssWidth, targetY]);
  return drawData;
};

const drawCounterThreadFromData = (ctx, drawData) => {
  ctx.beginPath();
  ctx.strokeStyle = '#4aaad6ff';
  ctx.lineWidth = 1;
  ctx.moveTo(0, drawData[0][1]);
  
  for (let i = 1; i < drawData.length; i++) {
    ctx.lineTo(drawData[i][0], drawData[i][1]);
  }
  
  ctx.stroke();
  ctx.closePath();
};

const drawCounterThread = (thread, ctx, threadY, isPinned = false) => {
  const drawData = collectCounterDrawData(thread, threadY, isPinned);
  drawCounterThreadFromData(ctx, drawData);
};

const drawEventThread = (thread, ctx, threadY, processKey) => {
  // 绘制线程事件
  let eventDatas = [];
  let previousEventData = null;
  
  // 预计算常量，避免在循环中重复计算
  const { threadHeight, eventHeight } = layout;
  const halfThreadHeight = threadHeight / 2;
  const baseY = threadY - halfThreadHeight; // 基础Y坐标
  const halfEventHeight = eventHeight / 2;
  
  // 预创建 drawData 模板，避免重复对象创建
  const createDrawData = () => ({
    rectX: 0, rectY: 0, eventWidth: 0, height: 0, 
    rectColor: '', strokeColor: '', text: '', 
    textX: 0, textY: 0, fontColor: '', show: true, pinnedEventY: 0,
  });
  
  thread.events.forEach((event, index, array) => {
    const lineOffset = (event.line || 0) + 1;
    const y = baseY + threadHeight * lineOffset;
    const eventY = y - halfEventHeight;
    
    const drawData = createDrawData();
    if (getDrawData(ctx, event, eventY, drawData, processKey)) {
      event.drawData = drawData;
      swimDataManager.updateEvent(event.id, { drawData, renderInfo: event.renderInfo });
      eventDatas.push(drawData);
    } else {
      return;
    }
    previousEventData = event;
  });
  eventRenderer.drawEvent(eventDatas, ctx, false, pinnedStatus.value);
};

// 全部的节点数据包括坐标和初始颜色
const getDrawData = (ctx, event, eventY, drawData, processKey) => {
  const { processLabelWidth, eventHeight } = layout;
  if (!ctx || !ctx.canvas) {
    return false;
  }
  let x = getPositionByTime(event.renderStartTime, viewState, layout) - processLabelWidth;
  if (x > viewState.canvasCssWidth) {
    x = viewState.canvasCssWidth - 1;
  }
  const eventWidth = getWidthByDuration(event.renderDuration, viewState);
  const originalY = event.renderInfo?.y ?? eventY;
  const originalPinnedEventY = event.renderInfo?.pinnedEventY ?? eventY;
  const originalX = event.renderInfo?.x ?? x;
  const originalWidth = event.renderInfo?.width ?? eventWidth;

  // 存储事件的位置信息，用于点击检测
  event.renderInfo = {
    x, y: eventY, width: eventWidth,
    height: eventHeight, processKey, pinnedEventY: eventY,
  };

  const colors = getEventColor(event, eventRenderer.deps, processKey);
  const { fillColor, fontColor, strokeColor } = colors;
  Object.assign(drawData, {
    rectX: x, rectY: eventY, rectPixelX: x * devicePixelRatio, rectPixelY: eventY * devicePixelRatio,
    eventWidth, height: eventHeight, rectColor: fillColor, strokeColor,
    fontColor, fontColor, pinnedEventY: eventY});
  if (pinnedStatus.value) {
    Object.assign(event.renderInfo, {x: originalX, y: originalY, width: originalWidth});
    Object.assign(drawData, {rectX: originalX, rectY: originalY, rectPixelX: originalX * devicePixelRatio, 
      rectPixelY: originalY * devicePixelRatio, eventWidth: originalWidth});
  } else {
    Object.assign(event.renderInfo, { pinnedEventY: originalPinnedEventY });
    Object.assign(drawData, { pinnedEventY: originalPinnedEventY });
  }
  return true;
};

const updateDrawDataColor = (event, deps, processKey) => {
  const colors = getEventColor(event, deps, processKey);
  const { fillColor, fontColor, strokeColor } = colors;
  Object.assign(event.drawData, {rectColor: fillColor, strokeColor, fontColor});
};

const updateProcessDrawData = (process, processKey) => {
  if (!processExpanded.get(processKey)) {
    return;
  }
  for (const [threadKey, thread] of process.threads.entries()) {
    for (const event of thread.events) {
      if (event.isCounter) {
        continue;
      }
      const { drawData } = event;
      const colors = getEventColor(event, eventRenderer.deps, processKey);
      const { fillColor, fontColor, strokeColor } = colors;
      drawData.rectColor = fillColor;
      drawData.strokeColor = strokeColor;
      drawData.fontColor = fontColor;
    }
  }
};

// 调用之前需确认画布已还原成初始状态
const fillTextInfo = (event, ctx, drawData, isTextXChange = true, isAicpuProcess = false) => {
  // 预计算常量，避免在循环中重复计算
  const { scale, offsetX, canvasCssWidth } = viewState;
  const absOffsetX = Math.abs(offsetX);
  
  const rectStartX = drawData.rectX * scale;
  const rectEndX = rectStartX + drawData.width * scale;
  
  // 计算可见范围
  const visibleStartX = Math.max(rectStartX, absOffsetX);
  const visibleEndX = Math.min(rectEndX, absOffsetX + canvasCssWidth);
  const actualWidth = Math.max(0, visibleEndX - visibleStartX);
  
  if (actualWidth < 15) {
    drawData.text = '';
    return false;
  }

  const actualPixWidth = actualWidth * devicePixelRatio;
  let displayName = isAicpuProcess ? event.name : getDisplayName(event);
  let textWidth = ctx.measureText(displayName).width;

  let displayText = '';
  if (textWidth > actualPixWidth) {
    const widthPerChar = textWidth / displayName.length;
    let maxCharsToFit = Math.floor(actualPixWidth / widthPerChar);
    if (maxCharsToFit > 3) {
      maxCharsToFit -= 3;
      displayText = displayName.substr(0, maxCharsToFit) + '...';
      textWidth = widthPerChar * displayText.length;
    } else {
      drawData.text = '';
      return false;
    }
  } else {
    displayText = displayName;
  }

  const visibleRectXOnScreen = visibleStartX - absOffsetX;
  // 计算文字居中位置：可见区域左边缘 + (可见宽度 - 文字宽度)/2
  const textStartX = (visibleRectXOnScreen * devicePixelRatio) + (actualPixWidth - textWidth) / 2;

  drawData.text = displayText;
  drawData.textX = isTextXChange ? textStartX : event.drawData.textX;
  drawData.textY = drawData.rectPixelY + eventTextSize;
  drawData.pinnedTextY = (drawData.pinnedEventY * devicePixelRatio) + eventTextSize;
  return true;
};

const renderProcessText = async (process, ctx, isPinned = false) => {
  ctx.font = getFontStyle(eventTextSize);
  ctx.textRenderingOptimization = 'optimizeLegibility';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const selectedEventId = selectEvent.value ? selectEvent.value.id : null;
  const selectedDep = selectEvent.value ? [...selectedEvent.value.dependencies.predecessors, ...selectedEvent.value.dependencies.successors] : [];
  const isHighlighting = highlightedPaths.size > 0;
  let isAicpuProcess = process.type === 'aicpu';
  const selectedInfo = { selectedEventId, selectedDep };
  if (isPinned) {
    for (const item of process.value) {
      pinnedStatus.value = true;
      isAicpuProcess = item.process.type === 'aicpu';
      renderThreadText(item.thread, ctx, selectedInfo, isHighlighting, isAicpuProcess);
    }
  } else {
    for (const [threadKey, thread] of process.threads.entries()) {
      if (!renderThreadText(thread, ctx, selectedInfo, isHighlighting, isAicpuProcess)) {
        break;
      }
    }
  }
  pinnedStatus.value = false;
  ctx.restore();
};

const renderThreadText = (thread, ctx, selectedInfo, isHighlighting, isAicpuProcess) => {
  const { selectedEventId, selectedDep } = selectedInfo;
  if (thread.isCounter) {
    return false;
  }
  // 批量处理事件，减少重复的样式设置
  const visibleEvents = [];
  for (const event of thread.events) {
    const { drawData } = event;
    if (!drawData || !drawData.show) {
      continue;
    }
      
    // 预计算文本信息，避免在循环中重复调用
    drawData.width = drawData.eventWidth;
    fillTextInfo(event, ctx, drawData, true, isAicpuProcess);
    if (!drawData.text) { continue };
      
    visibleEvents.push({ event, drawData });
  }
  let preData;
  let nextData;
  // 批量渲染文本，减少样式切换
  for (const { event, drawData } of visibleEvents) {
    const isSelf = selectedEventId === event.id;
      
    // 优化颜色判断逻辑
    const hasCurrent = highlightedPaths.has(event.id) || selectedDep.includes(event.id);
    if (isHighlighting && !isSelf && !hasCurrent) {
      ctx.fillStyle = colorCfg.eventFontNoColor;
    } else {
      ctx.fillStyle = drawData.fontColor;
    }
    if (event.name === swimConfig.sampleEventNamePre) {
      preData = drawData;
    }
    if (event.name === swimConfig.sampleEventNameNext) {
      nextData = drawData;
    }
    ctx.fillText(drawData.text, drawData.textX, pinnedStatus.value ? drawData.pinnedTextY : drawData.textY);
  }
  if (preData && nextData) {
    drawVirtualDom(preData, nextData, ctx);
  }
  return true;
};

// 引导页定位测距的虚拟dom
const drawVirtualDom = (preData, nextData, ctx) => {
  const existingElement = document.querySelector('#distance-measurement');
  if (existingElement) {
    existingElement.remove();
  }
  const domRect = document.createElement('div');
  domRect.id = 'distance-measurement';
  domRect.style.position = 'absolute';
  domRect.style.left = (((preData.rectX + preData.eventWidth) + nextData.rectX) / 2) + 'px';
  domRect.style.top = preData.rectY + 'px';
  domRect.style.width = '1px';
  domRect.style.height = preData.height + 'px';
  domRect.style.backgroundColor = 'transparent';
  ctx.canvas.parentNode.appendChild(domRect);
};
const showTooltip = (e, event) => {
  if (!tooltip.value) { return };
  const displayName = event.isCounter ? event.displayName : (getDisplayName(event) || 'Event');
  let tooltipContent = `<div class="tooltip-container">`;
  tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t('title')}</span><span class="tooltip-value">${displayName}</span></div>`;
  tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t('start')}</span><span class="tooltip-value">${formatTimeWithUnit((event.startTime - viewState.minTime) * 1000 / tsScale.value).value}${formatTimeWithUnit((event.startTime - viewState.minTime)* 1000 / tsScale.value).unit}</span></div>`;
  if (!event.isCounter) {
    const duration = event.duration ?? (event.endTime - event.startTime);
    tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t('duration')}</span><span class="tooltip-value">${formatTimeWithUnit(duration * 1000 / tsScale.value).value}${formatTimeWithUnit(duration * 1000 / tsScale.value).unit}</span></div>`;
  }
  tooltipContent += '</div>'; 
  tooltip.value.innerHTML = tooltipContent;
  tooltipStyle.display = 'block';
  // 获取气泡的真实尺寸
  const tooltipWidth = tooltip.value.offsetWidth;
  const tooltipHeight = tooltip.value.offsetHeight;
  // 获取视口边界
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  // 计算水平位置 (防止超出左右边界)
  let leftPos;
  // 如果 鼠标X + 气泡宽 + 偏移量 > 屏幕宽，说明右边放不下，要放左边
  if (mouseX + tooltipWidth + 15 > viewportWidth) {
    leftPos = mouseX - tooltipWidth - 10; // 显示在鼠标左侧
  } else {
    leftPos = mouseX + 10; // 显示在鼠标右侧
  }
  // 计算垂直位置 (防止超出底部边界)
  let topPos;
  // 如果 鼠标Y + 气泡高 + 偏移量 > 屏幕高，说明下面放不下，要放上面
  if (mouseY + tooltipHeight + 15 > viewportHeight) {
    topPos = mouseY - tooltipHeight - 10; // 显示在鼠标上方
  } else {
    topPos = mouseY + 10; // 显示在鼠标下方
  }
  tooltipStyle.left = `${leftPos}px`;
  tooltipStyle.top = `${topPos}px`;
};

const lineShowTooltip = (e, startEvent, endEvent) => {
  if (!startEvent.args['ooperand-hint'] || !endEvent.args['ioperand-hint']) {
    return;
  }

  let jsonStartHint = startEvent.args['ooperand-hint'].replace(/'/g, '"');
  jsonStartHint = jsonStartHint.replace(/\b(?<number>\d+)\b(?=\s*[:\]])/g, '"$<number>"');

  let jsonEndHint = endEvent.args['ioperand-hint'].replace(/'/g, '"');
  jsonEndHint = jsonEndHint.replace(/\b(?<number>\d+)\b(?=\s*[:\]])/g, '"$<number>"');

  const startHint = JSON.parse(jsonStartHint);
  const endHint = JSON.parse(jsonEndHint);
  const startMap = new Map(startHint.map(item => [Object.keys(item)[0], item]));
  const endMap = new Map(endHint.map(item => [Object.keys(item)[0], item]));

  const interSectionMap = new Map();
  for (const [key, value] of startMap) {
    if (endMap.has(key) && JSON.stringify(value) === JSON.stringify(endMap.get(key))) {
      interSectionMap.set(key, value);
    }
  }

  if (interSectionMap.size === 0) {
    return;
  }

  let lineTooltipContent = `<div class="linetooltip-container">`;
  for (const [key, value] of interSectionMap) {
    const { shape, dtype, rawmagic, mem_usage } = value[key];
    const valueString = `{${key}: {shape:${JSON.stringify(shape)}, dtype:${dtype}, rawmagic:${rawmagic}, mem_usage:${mem_usage}}}`;
    lineTooltipContent += `<div class="linetooltip-item"><span class="linetooltip-value">${valueString}</span></div>`;
  }
  lineTooltipContent += '</div>';
  lineTooltip.value.innerHTML = lineTooltipContent;
  lineTooltipStyle.display = 'block';
  const canvasCSSWidth = viewState.canvasCssWidth;
  if (e.clientX  + 200  > canvasCSSWidth) {
    lineTooltipStyle.left = (e.clientX - 100) + 'px';
  } else {
    lineTooltipStyle.left = (e.clientX + 10) + 'px';
  }
  lineTooltipStyle.top = (e.clientY - 10) + 'px';
};

const hideTooltip = () => { tooltipStyle.display = 'none' };

const hideLineTooltip = () => { lineTooltipStyle.display = 'none' };

const drawNodeHeight = (event, processKey) => {
  if (globalMeasureCanvas.value) {
    globalMeasureCanvas.value.clearCanvas();
    globalMeasureCanvas.value.drawRoundedRect(event, processKey);
    return;
  }
  const uiCtx = getUIContext(processKey);
  measureRenderer.drawNodeRoundedRect(uiCtx, event, processKey);
};

const measureDistance = (event, processKey) => {
  if (globalMeasureCanvas.value) {
    globalMeasureCanvas.value.handleDistanceMeasurement(event, processKey);
  } else {
    const uiCtx = getUIContext(processKey);
    measureRenderer.handleDistanceMeasurement(uiCtx, event, processKey);
  }
};
const measureDistanceZoom = (event, processKey) => {
  if (globalMeasureCanvas.value) {
    globalMeasureCanvas.value.handleDistanceMeasurement(event, processKey, true);
  } else {
    const uiCtx = getUIContext(processKey);
    measureRenderer.handleDistanceMeasurement(uiCtx, event, processKey, true);
  }
};

const renderEvents = () => { renderProcessEvents(props.process, props.processKey) };

const drawEventLine = (x, color, flag) => {
  const devicePixelRatioValue = window.devicePixelRatio !== undefined ? window.devicePixelRatio : 1;
  const drawX = x * devicePixelRatioValue;
  for (const processx of processes.entries()) {
    let canvasRef = document.querySelector(`[data-line-process-key="${processx[0]}"]`);
    if (flag === 'over') {
      canvasRef = document.querySelector(`[data-hover-process-key="${processx[0]}"]`);
    }
    let ctx = canvasRef.getContext('2d');
    eventRenderer.drawFlagLine(ctx, color, drawX, canvasRef.height);
  }
};

const eraseEventLine = (flag) => {
  for (const [processKey] of processes.entries()) {
    if (!processExpanded.get(processKey)) {
      continue;
    }
    let canvasRef = document.querySelector(`[data-line-process-key="${processKey}"]`);
    if (flag === 'over') {
      canvasRef = document.querySelector(`[data-hover-process-key="${processKey}"]`);
    }
    const ctx = canvasRef.getContext('2d');
    clearWholeProcess(ctx, viewState, processKey);
  }
};

const transformCanvas = ({ minX, maxX, startT, endT, minY }) => {
  let xRange = (maxX - minX) * viewState.pixelScale;
  const targetWidth = viewState.canvasCssWidth * 0.8;
  const widthValid = Math.abs(xRange - targetWidth) < viewState.canvasCssWidth * 0.1;
  const viewValid = startT >= timelineState.startTime && endT <= timelineState.endTime;
  if (widthValid && viewValid) {
    swimlaneContainer.value.scrollTo({
      top: minY,
      behavior: 'smooth',
    });
    return;
  }
  let needRender = true;
  const zoomFactor = (targetWidth / (maxX - minX)) / viewState.scale;
  changeScale(zoomFactor, 0, false, false);
  const eventLeftX = (minX * viewState.scale) + viewState.offsetX;
  if (eventLeftX < 0) {
    rightmove(0 - eventLeftX, true);
    needRender = false;
  }
  const eventRightX = (maxX * viewState.scale) + viewState.offsetX;
  const divElement = document.getElementsByClassName('swimlane-container');
  const scrollWidth = divElement[0].offsetWidth - divElement[0].clientWidth; // 滚动条的宽度
  const canvasCSSWidth = viewState.canvasCssWidth;
  const actualMaxX = canvasCSSWidth - scrollWidth; // 视口最右x坐标
  if (eventLeftX < actualMaxX && eventRightX > actualMaxX) {
    // 一半被隐藏在视口之外
    const hiddenWidth = eventRightX - canvasCSSWidth;
    leftmove(hiddenWidth + scrollWidth, true);
    needRender = false;
  } else if (eventLeftX > actualMaxX) {
    // 整个被隐藏在视口之外
    xRange = (maxX - minX) * viewState.pixelScale;
    leftmove((eventLeftX - canvasCSSWidth + xRange) + scrollWidth, true);
    needRender = false;
  }
  if (needRender) {
    transform();
  }
  swimlaneContainer.value.scrollTo({
    top: minY,
    behavior: 'auto',
  });
};

const setSelectedData = (boundRange, label) => {
  points = [];
  drawColorDatas = {};
  processes.forEach((process, processKey) => {
    if (!processExpanded.get(processKey)) {
      return;
    }
    highlightedPaths.clear();
    detailsPanelExpanded.value = false;
    drawColorDatas[processKey] = [];
    // 遍历线程
    process.threads.forEach((thread, threadKey) => {
      if (thread.isCounter) {
        return; // 因为counter总是在最下方，不需要重绘，所以可以提前结束
      }
      const { events } = thread;
      events.forEach((event, eventKey) => {
        const { args } = event;
        const { color } = args;
        if (color === label) {
          const { x, y, width, height } = event.renderInfo;
          boundRange.minX = Math.min(boundRange.minX, x);
          boundRange.maxX = Math.max(boundRange.maxX, x + width);
          boundRange.startT = Math.min(boundRange.startT, event.startTime);
          boundRange.endT = Math.max(boundRange.endT, event.endTime);
          boundRange.minY = Math.min(boundRange.minY, y);
          boundRange.maxY = Math.max(boundRange.maxX, y + height);
          points.push([x, y, width, height]);
          drawColorDatas[processKey].push(event);
        }
      });
    });
  });
};

const drawSelection = (label, needSendCom, isLock) => {
  let rootHashArray = [];
  processes.forEach((process, processKey) => {
    if (!processExpanded.get(processKey) || (drawColorDatas[processKey] && !drawColorDatas[processKey].length)) {
      return;
    }
    changeNodeColor(processKey, true);
    const { eventCtx } = ctxs[processKey];
    drawThreadSeparators(eventCtx, process, processKey);
    drawColorDatas[processKey].forEach((event, eventKey) => {
      onSelectionEvent(event, eventCtx, processKey, false);
      const { args } = event ?? {};
      const eventHintStr = args?.['event-hint'] ?? '';
      const rootHashStr = getRootHashList(eventHintStr);
      rootHashArray.push(rootHashStr);
    });
    if (!isLockStatus.value && drawColorDatas[processKey].length) {
      const rootHashList = [...new Set(rootHashArray)];
      if (needSendCom) {
        sendMsg('returnSemanticLabelFromSwimToCom', { label, rootHashList: rootHashList?.length ? rootHashList : [] });
      }
      if (isLock) {
        sendMsg('sendHashList', { rootHashList: rootHashList?.length ? rootHashList : [] });
      }
    }
  });
}; 

const handleOutline = (label, needTransform = true, needSendCom = true, isLock = false) => {
  if (!label) {
    clearSelectionCanvas('data-three-column-process-key');
    changeNodeColor(props.processKey, false);
    const { eventCtx } = ctxs[props.processKey];
    drawThreadSeparators(eventCtx, props.process, props.processKey);
    return;
  }
  if (!viewState.canvasCssWidth) {
    return;
  }
  const boundRange = { minX: Infinity, maxX: 0, startT: Infinity, endT: 0, minY: Infinity, maxY: 0 };
  setSelectedData(boundRange, label);
  boundaries = calcRowBoundaries(points);
  if (boundaries.length) {
    if (needTransform) {
      transformCanvas(boundRange);
    }
    drawSelection(label, needSendCom, isLock);
    threeRender.enableAnimate();
    threeRender.drawBoundary(boundaries, props.processKey);
    threeRender.animate();
    toggleLock();
  } else {
    clearSelectionCanvas('data-three-column-process-key');
    selectEvent(null, props.processKey);
    const ctx = clearDependencyLines(props.processKey);
    highlightEvent(ctx, searchedEvent.value, props.processKey, true);
    if (isLockStatus.value) {
      return;
    }
    if (needSendCom) {
      sendMsg('returnSemanticLabelFromSwimToCom', { label, rootHashList: [] });
    }
    if (isLock) {
      sendMsg('sendHashList', { rootHashList: [] });
    }
  }
};
window.ascEventBus.on('returnSemanticLabelFromCode', ({ label }) => { handleOutline(label) });
window.ascEventBus.on('returnSemanticLabelFromCom', ({ label }) => { handleOutline(label, true, false) });
window.ascEventBus.on('activeLock', ({ label }) => {
  lockedLabel = label;
  handleOutline(label, false, true, true);
  isLockStatus.value = true;
});
window.ascEventBus.on('deactivateLock', () => {
  lockedLabel = '';
  isLockStatus.value = false;
});
window.ascEventBus.on('clearSearchEvent', () => {
  let { eventCtx } = ctxs[props.processKey];
  if (!selectedEvent.value) {
    return;
  }
  const { color } = selectedEvent.value.args;
  const isDimmed = lockedLabel !== color;
  drawEvent([selectedEvent.value.drawData], eventCtx, isDimmed);
  selectedEvent.value = null;
  lastSelected.value = null;
});
const sendMsg = (command, param) => {
  Promise.resolve().then(() => {
    window.ascEventBus.emit(command, param);
  });
};
const drawLockedOutline = () => {
  handleOutline(lockedLabel, true, true, true);
};

const renderMixModeEvents = (process, processKey, ctx) => {
  const swimLaneOrder = swimDataManager.getSwimLaneOrder();
  const drawDatas = [];
  
  for (const lane of swimLaneOrder) {
    if (lane.type !== 'thread') {
      continue;
    }
    const { thread } = lane;
    const threadY = lane.y;
    const laneHeight = lane.height;
    
    if (thread.isCounter) {
      for (const [threadKey, procThread] of process.threads.entries()) {
        if (procThread.tid === thread.tid && procThread.threadName === thread.threadName) {
          collectCounterDrawData(procThread, threadY);
          drawTransformEvent(procThread, ctx, false);
          break;
        }
      }
    } else if (lane.wrapIds.length > 0) {
      renderThreadSubEvents(thread, threadY, laneHeight, drawDatas, processKey);
      renderThreadNormalEvents(thread, threadY, laneHeight, drawDatas, processKey);
    } else {
      for (const [threadKey, procThread] of process.threads.entries()) {
        if (procThread.tid === thread.tid) {
          drawEventThread(procThread, ctx, threadY, processKey);
          break;
        }
      }
    }
  }
  
  for (const drawData of drawDatas) {
    ctx.font = getFontStyle(eventTextSize);
    const fakeEvent = {
      name: drawData.text,
      renderStartTime: 0,
      renderDuration: drawData.eventWidth / viewState.scale,
      drawData
    };
    fillTextInfo(fakeEvent, ctx, drawData, true, false);
  }
  
  if (drawDatas.length > 0) {
    eventRenderer.drawEvent(drawDatas, ctx);
    eventRenderer.drawEventText(drawDatas, ctx);
  }
};

const renderThreadNormalEvents = (thread, threadY, laneHeight, drawDatas, processKey) => {
  const { processLabelWidth, eventHeight } = layout;
  const halfEventHeight = eventHeight / 2;
  const eventY = threadY + laneHeight / 2 - halfEventHeight;
  
  const normalEvents = thread.eventIds
    .map(id => swimDataManager.getEventById(id))
    .filter(e => e && !swimDataManager.isMixParentEvent(e));
  
  for (const event of normalEvents) {
    const x = getPositionByTime(event.startTime, viewState, layout) - processLabelWidth;
    const width = getWidthByDuration(event.endTime - event.startTime, viewState, layout);
    
    event.renderInfo = { x, y: eventY, width, height: eventHeight, processKey };
    
    const colors = getEventColor(event, eventRenderer.deps, processKey);
    const { fillColor, fontColor, strokeColor } = colors;
    
    const drawData = {
      rectX: x,
      rectY: eventY,
      rectPixelX: x * devicePixelRatio,
      rectPixelY: eventY * devicePixelRatio,
      eventWidth: width,
      width,
      height: eventHeight,
      rectColor: fillColor,
      strokeColor: strokeColor || fillColor,
      fontColor,
      text: event.name,
      show: width > viewState.minWidth,
      textX: 0,
      textY: eventY * devicePixelRatio + eventTextSize,
      startTime: event.startTime,
      endTime: event.endTime
    };
    
    event.drawData = drawData;
    drawDatas.push(drawData);
  }
};

const renderThreadSubEvents = (thread, threadY, laneHeight, drawDatas, processKey) => {
  const parentEvents = thread.eventIds
    .map(id => swimDataManager.getEventById(id))
    .filter(e => e && swimDataManager.isMixParentEvent(e));
  
  const { processLabelWidth, eventHeight } = layout;
  const halfEventHeight = eventHeight / 2;
  const eventY = threadY + laneHeight / 2 - halfEventHeight;
  
  for (const parentEvent of parentEvents) {
    const subEvents = swimDataManager.getSubEvents(parentEvent.id);
    
    for (const subEvent of subEvents) {
      const colors = getEventColor(subEvent, eventRenderer.deps, processKey);
      const { fillColor, fontColor } = colors;
      const x = getPositionByTime(subEvent.startTime, viewState, layout) - processLabelWidth;
      const width = getWidthByDuration(subEvent.endTime - subEvent.startTime, viewState, layout);
      
      subEvent.renderInfo = { x, y: eventY, width, height: eventHeight, processKey };
      
      const drawData = {
        rectX: x,
        rectY: eventY,
        rectPixelX: x * devicePixelRatio,
        rectPixelY: eventY * devicePixelRatio,
        eventWidth: width,
        width,
        height: eventHeight,
        rectColor: fillColor,
        fontColor,
        text: subEvent.name,
        show: width > viewState.minWidth,
        textX: 0,
        textY: eventY * devicePixelRatio + eventTextSize,
        startTime: subEvent.startTime,
        endTime: subEvent.endTime
      };
      
      subEvent.drawData = drawData;
      drawDatas.push(drawData);
    }
    const waitTasks = swimDataManager.getWaitTasks(parentEvent.id);
    for (const waitTask of waitTasks) {
      const x = getPositionByTime(waitTask.startTime, viewState, layout) - processLabelWidth;
      const width = getWidthByDuration(waitTask.endTime - waitTask.startTime, viewState, layout);
      
      waitTask.renderInfo = { x, y: eventY, width, height: eventHeight, processKey };
      
      const drawData = {
        rectX: x,
        rectY: eventY,
        rectPixelX: x * devicePixelRatio,
        rectPixelY: eventY * devicePixelRatio,
        eventWidth: width,
        width,
        height: eventHeight,
        rectColor: colorCfg.eventRectNoColor,
        fontColor: selectedEvent.value ? colorCfg.eventFontNoColor : colorCfg.eventFont,
        text: waitTask.name,
        show: width > 20 / viewState.scale,
        textX: 0,
        textY: eventY * devicePixelRatio + eventTextSize,
        startTime: waitTask.startTime,
        endTime: waitTask.endTime
      };
      
      waitTask.drawData = drawData;
      drawDatas.push(drawData);
    }
  }
};

const distanceMeasurementResize = () => {
  if (swimConfig.currentStepTargetDomId !== 'distance-measurement') {
    return;
  }
  guideDistanceMeasurement();
};
addChildContext('threadEvent', {
  drawLockedOutline,
  getCanvasHeight,
  renderProcessEvents,
  renderProcessText,
  fillTextInfo,
  resizeCanvas,
  renderEvents,
  drawDependencyLines,
  clearDependencyLines,
  drawMaxScheduleLine,
  drawThreadSeparators,
  changeNodeColor,
  drawEventLine,
  eraseEventLine,
  getOffset,
  transformEvents,
  drawSelectionBox,
  drawSelectionHightlight,
  toggleLock,
  resizeDrawBoundary,
  getEventColor: (event, processKey, highlight = false, stroke = true) => {
    return getEventColor(event, eventRenderer.deps, processKey, highlight, stroke);
  },
  updateDrawDataColor,
  drawBoundary: threeRender.drawBoundary,
  animate: threeRender.animate,
  stopAnimate: threeRender.stopAnimate,
  distanceMeasurementResize,
  canvasStatusReset,
  renderProcessPinEvents,
  drawTransformEvent,
  highlightEvent,
  eventRenderer,
  drawEventThread,
  showTooltip,
  renderThreadText,
  drawNodeHeight,
  drawHoverWrapContainner,
  drawClickWrapContainner,
  renderDimmedNodesInWrap
});
watch(isHoverLockStatus, () => { sendMsg('swimSelectModeChange', { selectMode: isHoverLockStatus.value }) });
// 每个事件画布都会走一遍
watch(isDarkTheme, () => {
  colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
  updateProcessDrawData(props.process, props.processKey);
  const ctxInfo = ctxs[props.processKey];
  if (!ctxInfo) { return };
  for (const [ctxKey, ctx] of Object.entries(ctxInfo)) {
    ctx.save();
    ctx.setTransform(viewState.pixelScale, 0, 0, window.devicePixelRatio, viewState.pixelOffsetX, 0);
  }
  if (processExpanded.get(props.processKey)) {
    transformEvents(props.process, props.processKey);
    const ctx = ctxInfo.eventCtx;
    renderProcessText(props.process, ctx);
  }
  drawDependencyLines(props.process, props.processKey, viewState.depMode);
  flagRender();
});
const listenExtensionMessage = async () => {
  const res = await getQuery();
  if (res?.isBootStep === true  && !isThreeColumn && await getIsCompleteBoot()) {
    guideDistanceMeasurement();
  }
};
// 监听引导模式的消息
const listenExtensionClearMessage = () => {
  window.ascEventBus.on('boot-step-tips', (event) => {
    const message = event.data;
    if (event.type == 'callWebviewMethod') {
      switch (message.methodName) {
        case 'addObservationLine': {
          clearDistanceMeasurement();
          break;
        }
        case 'distanceMeasurement': {
          guideDistanceMeasurement();
          break;
        }
        case 'measureDetailSearch': {
          mulDetailsExpanded.value = true;
          canvasStatusReset();
          break;
        }
        case 'viewThreeColumnGraph': {
          lockPosition.value = null;
          break;
        }
        default:
          break;
      }
    }
  });
};
const guideDistanceMeasurement = () => {
  for (const [processKey, process] of processes.entries()) {
    if (!processExpanded.get(processKey)) {
      continue;
    }
    for (const [threadKey, thread] of process.threads.entries()) {
      if (threadKey !== swimConfig.threadKey) {
        continue;
      }
      const { events } = thread;
      if (events.length < 2) {
        continue;
      }
      const preIndex = events.findIndex(event => event.name === swimConfig.sampleEventNamePre);
      if (preIndex === -1 || preIndex === events.length - 1) {
        continue; 
      }
      const preData = events[preIndex];
      const lastData = events[preIndex + 1];
      altClickData.preData = preData;
      altClickData.lastData = lastData;
      if (globalMeasureCanvas.value) {
        globalMeasureCanvas.value.handleDistanceMeasurement(lastData, processKey);
      } else {
        const uiCtx = getUIContext(processKey);
        measureRenderer.drawRoundedRect(uiCtx, lastData, processKey);
        measureRenderer.calculateAndDrawConnection(uiCtx);
      }
      break;
    }
  }
};
const clearDistanceMeasurement = () => {
  if (globalMeasureCanvas.value) {
    globalMeasureCanvas.value.clearMeasure();
  } else {
    for (const [processkey, process] of processes.entries()) {
      if (!processExpanded.get(processkey)) {
        continue;
      }
      const uiCtx = getUIContext(processkey);
      measureRenderer.clearDrawConnector(uiCtx, processkey);
    }
  }
};
provide('swimGraphThreadState', {
  switchLockInformationFlag,
  isPathLockStatus,
  topX,
  leftX,
  canvasclickedEvent,
  isClickedPath,
  pathLockedEvent
});
provide('swimGraphThreadMethods', {
  pathLockedMethod
});

</script>
<style scoped>
@import url("../css/swimGraph/Processes/events.css");
</style>
  