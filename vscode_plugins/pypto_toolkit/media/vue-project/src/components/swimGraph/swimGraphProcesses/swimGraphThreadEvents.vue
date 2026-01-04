<template>
  <div class="thread-events" :data-process-container="process.key" tabindex="0">
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
    <canvas 
      class="events-canvas" 
      :data-process-key="processKey"
      @click="handleCanvasClick" 
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @mousedown="handleMouseDown" 
      @mouseup="handleMouseUp"
      @wheel="handleWheel"
    ></canvas>
    <canvas class="ui-events-canvas" :data-ui-process-key="process.key"></canvas>
    <canvas class="dependency-events-canvas" :data-dep-process-key="process.key"></canvas>
    <canvas class="hover-events-canvas" :data-hover-process-key="process.key"></canvas>
    <canvas class="background-events-canvas" :data-background-process-key="process.key"></canvas>
    <canvas class="line-events-canvas" :data-line-process-key="process.key"></canvas>
    <canvas class="selection-events-canvas" :data-selection-process-key="process.key"></canvas>
    <canvas class="three-column-events-canvas" :data-three-column-process-key="process.key"></canvas>
  </div>
</template>
  
<script setup>
import { useI18n } from 'vue-i18n';
import { inject, onMounted, onUnmounted, watch, ref } from 'vue';
import { COLOR_CFG, DEP_MODE, ctxs, drawArrow, devicePixelRatio, formatTimeWithUnit, getFontStyle, updateProcessSize, getCanvasCSSHeight, 
  getThreadHeight, getThreadStartY, eventTextSize, nodeSpaceMin, clearWholeProcess
} from '../swimGraphUtils';
import { isEqual, throttle } from 'lodash-es';
import { isPointInPolygonFun, computeLocalXY, getEventColor, getNoZoomX, getOffset, getRootHashList, getActiveEventCanvas, buildEventMap, matchKey, getCanvasRefs, getUIContext, handleMatchKey } from './render/utils';
import { EventRender } from './render/eventRender';
import { altClickData, measureState, MeatureRender } from './render/meatureRender';
import { ThreeRender, spaceInThreeCol, isAnimation } from './render/threeRender';
import { getIsCompleteBoot } from '@/apis/welcome';
import { swimConfig } from '../../welcome/guideStepsConfig';
const { isDarkTheme } = inject('root');
const { t: $t } = useI18n();
const canvasclickedEvent = ref(null);
const curThread = inject('curThread');
const lockPosition = ref(null);
let colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
let points = [];
let boundaries = [];
let preLabel = '';
let lockedLabel = '';
let drawColorDatas = {};
let isHoverLockStatus = ref(false); // 选定状态
// 注入父组件提供的状态和方法
const swimGraphState = inject('swimGraphState');
const {
  layout,
  selectedEvent,
  highlightedPaths,
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
  searchedEvent,
  colorRending
} = swimGraphState;

const {
  findEventAtPosition,
  selectEvent,
  timeToX,
  handleWheel,
  leftmove,
  rightmove,
  flagRender,
  durationToWidth,
  transform,
  measureDetailGet,
  xToTime,
  processThreadEventSearch,
  getDisplayName,
  changeScale,
  resetState,
} = inject('swimGraphMethods');

const { addChildContext } = inject('swimGraphContext');
const { userConfig, textOption } = inject('swimGraphCfg');
const { isSearchActive } = inject('swimGraphSearch');
let mousePosition = null;
let isKeyPressed = ref(false);
let keyTimeOut;
let keyInterval;
let scaleStep = 0.1; 
let moveStep = 30;
let scaleStepIncrement = 0.05;
let moveStepIncrement = 30;
// 创建渲染实例
const eventRenderer = new EventRender({...swimGraphState, colorCfg});
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
const handleCanvasClick = (e) => {
  if(!isClick.value){
    return;
  }
  if (isLockStatus.value) {
    return;
  }
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) {
    console.warn(`Canvas for process ${props.processKey} not found during click handling`);
    return;
  }

  if (e.ctrlKey) {
    // 拖动画布中
    return;
  }
  if(!isDragging.value){
    clearSelectionCanvas('data-selection-process-key');
  } 
  const rect = canvasRef.getBoundingClientRect();
  const x = (e.clientX - rect.left - viewState.offsetX) / viewState.scale;
  const y = e.clientY - rect.top;

  // 检查是否点击了事件
  const clickedEvent = findEventAtPosition(x, y, props.processKey)?.event;
  canvasclickedEvent.value = clickedEvent;
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
    if(e.altKey){
      // 清空hover画布 
      onHoverEvent();
      measureDistance(clickedEvent, props.processKey);
    } else {
      measureState.isMeasureFirst = false;
      measureState.isMeasureFixed = false;
      !e.ctrlKey && selectEvent(clickedEvent, props.processKey);
    }
  } else {
    measureState.isMeasureFirst = false;
    measureState.isMeasureFixed = false;
    highlightedPaths.clear();
    detailsPanelExpanded.value = false;
    selectEvent(null, props.processKey);
    const ctx = clearDependencyLines(props.processKey);
    highlightEvent(ctx, searchedEvent.value, props.processKey, true);
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
  if (cssWidth > timeLineEndX){
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

onMounted(() => {
  document.addEventListener('keydown', (e) => {
    if (!handleMatchKey(e.key, userConfig)) {
      e.stopPropagation();
      return;
    }
    onKeyDown(e);
    e.stopPropagation();
  });
  document.addEventListener('keyup', (e) => {
    if (!handleMatchKey(e.key, userConfig)) {
      e.stopPropagation();
      return;
    }
    onKeyUp(e);
    e.stopPropagation();
  });
  listenExtensionMessage();
  listenExtensionClearMessage();
});

onUnmounted(() => {
  document.removeEventListener('keydown');
  document.removeEventListener('keyup');
  throttledRender.cancel();
  if (isAnimation) {
    clearSelectionCanvas('data-three-column-process-key');
  }
});

const onKeyDown = (e) => {
  const activeElement = document.activeElement;
  if (activeElement.nodeName === 'INPUT') {
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
    }, 500); //500毫秒后开始加速
  }
};
 
const onKeyUp = (e) => {
  const activeElement = document.activeElement;
  if (activeElement.nodeName === 'INPUT') {
    return;
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

const handlekeydown = (event) => {
  clearTimeout(wheelDebounceTimer);
  const key = event.key.toLowerCase();
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) {
    return;
  }
  const rect = canvasRef.getBoundingClientRect();
  const mouseX = mousePosition?.x - rect.left;
  const mouseY = mousePosition?.y - rect.top;
  const canvasCSSWidth = viewState.canvasCssWidth;
  const canvasCSSHeight = getCanvasCSSHeight(canvasRef);
  // 由于每个process都会走一遍这个keydown事件，当鼠标不在当前画布时，mouseX和mouseY就是空
  if (!mouseX || !mouseY || mouseX < 0 || mouseY < 0 || mouseX > canvasCSSWidth || mouseY > canvasCSSHeight) {
    return;
  }
  if(viewState.scale * 10 >= sliderMax.value && matchKey(key, userConfig?.value.ZoomInShortcut)) {
    wheelDebounceTimer = setTimeout(() => {
      postMessage($t('scaleMaxInfo'));
    }, 100);
    return;
  }
  if(viewState.scale === 1 && matchKey(key, userConfig?.value.ZoomOutShortcut)) {
    wheelDebounceTimer = setTimeout(() => {
      postMessage($t('scaleMinInfo'));
    }, 100);
    return;
  }
  switch(true) {
    case matchKey(key, userConfig?.value.ZoomInShortcut):
      scaleCanvas(mouseX, 1 + scaleStep);
      scaleStep += scaleStepIncrement;
      if (measureState.isMeasureFixed) {
        measureDistanceZoom(altClickData.lastData, String(altClickData.lastData.pid));
      }
      break;
    case matchKey(key, userConfig?.value.ZoomOutShortcut):
      scaleCanvas(mouseX, 1 - scaleStep);
      scaleStep += scaleStepIncrement;
      if (measureState.isMeasureFixed) {
        measureDistanceZoom(altClickData.lastData, String(altClickData.lastData.pid));
      }
      break;
    case matchKey(key, userConfig?.value.leftmoveShortcut):
      rightmove(moveStep, false);
      moveStep += moveStepIncrement;
      break;
    case matchKey(key, userConfig?.value.rightmoveShortcut):
      leftmove(moveStep, false);
      moveStep += moveStepIncrement;
      break;
    default:
      break;
  }
}
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
  measureRenderer.clearDrawConnectorHover(uiCtx, props.processKey);
  measureRenderer.measureDistanceHover(uiCtx);
  return false;
}

function maybeDrawConnectorPreview(preData, lastData, nodeSpacingX, uiCtx) {
  if (!preData || !lastData || measureState.isMeasureFixed) { return };
  const divElement = document.getElementsByClassName('swimlane-container');
  const scrollWidth = divElement[0].offsetWidth - divElement[0].clientWidth;
  const actSpacingX = nodeSpacingX * viewState.scale;
  if (actSpacingX <= 3) { return };
  const { canvasWidth } = viewState;
  const noZoomLastX = getNoZoomX(lastData?.renderInfo?.x, viewState);
  const noZoomPreX = getNoZoomX(preData?.renderInfo?.x, viewState) + (preData?.renderInfo?.width * viewState.scale);
  if (noZoomLastX < (canvasWidth - scrollWidth) && noZoomPreX > 0 ) {
    altClickData.preData = preData;
    altClickData.lastData = lastData;
    altClickData.largeSpacing = actSpacingX > nodeSpaceMin;
    measureRenderer.drawConnector(uiCtx, altClickData.largeSpacing);
  }
}

function handleTooltipAndCursor(e, hoveredEvent, canvasRef) {
  let cursor = '';
  if (hoveredEvent && !e.altKey && !e.ctrlKey) {
    showTooltip(e, hoveredEvent, canvasRef);
    cursor = 'pointer';
  } else {
    hideTooltip();
  }
  return cursor;
}

const findLineAtPoint = (ctx, point) => {
  // 还原传入坐标为绘制算法
  const pointX = ((point.x * viewState.scale * viewState.scale) + viewState.pixelOffsetX) * devicePixelRatio;
  for (const line of dependencyLinesInfo.value) {
    if (ctx.isPointInStroke(line.linePath, pointX, point.y)) {
      return { fromEvent: line.fromEvent, toEvent: line.toEvent };
    }
  }
  return null;
};

const handleLineTooltipAndCursor = (e, x, y) => {
  let cursor = '';
  if (dependencyLinesInfo.value.length === 0) {
    return cursor;
  }
  const point = { x, y };

  const dependencyCanvasRef = document.querySelector(`[data-dep-process-key="${props.processKey}"]`);
  if (!dependencyCanvasRef) {
    return cursor;
  }

  const dependencyCtx = dependencyCanvasRef.getContext('2d');
  const line = findLineAtPoint(dependencyCtx, point);

  if (line && !e.altKey && !e.ctrlKey) {
    lineShowTooltip(e, line.fromEvent, line.toEvent);
    cursor = 'pointer';
  } else {
    hideLineTooltip();
  }
  return cursor;
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
  if (!isLockStatus.value) {
    onHoverEvent(hoveredEvent);
    maybeDrawConnectorPreview(preData, lastData, nodeSpacingX, uiCtx);
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

const handleMouseMove = throttle((e) => {
  const refs = getCanvasRefs(props.processKey);
  if (!refs) { return };
  const { canvasRef, uiCtx, backgroundCanvasRef, backgroundCanvasCtx } = refs;

  if (altClickData.preData && altClickData.lastData && !e.altKey && !measureState.isMeasureFixed) {
    measureRenderer.clearDrawConnector(uiCtx, props.processKey);
  }

  mousePosition = { x: e.clientX, y: e.clientY };
  const localPosition = computeLocalXY(canvasRef, mousePosition, viewState);
  const { x, y } = localPosition;
  const info = findEventAtPosition(x, y, props.processKey);
  const hoveredEvent = info?.event;

  highlightThreadOnHover(y, backgroundCanvasRef, backgroundCanvasCtx);
  
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
const handleSelection = () => {
  // 这里可以判断那些元素在框内
  checkInSelection();
  if (!selectionEvents.length) {
    mulDetailsExpanded.value = false;
    clearSelectionCanvas('data-selection-process-key');
    return;
  }
  const canvasRef = document.querySelector(`[data-selection-process-key="${props.processKey}"]`);
  const ctx = canvasRef.getContext('2d');
  selectionEvents.forEach(eventItem => {
    onSelectionEvent(eventItem, ctx, props.processKey, true);
  });
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
  processes.forEach((process, processKey) => {
    if (!processExpanded.get(processKey)) {
      return;
    }
    // 遍历线程
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
      if (threadName.includes('AIC_')) {
        if (processThreadEventSearchTemp.length) {
          AICCount++;
        }
        matchingAICEvents.push(...processThreadEventSearchTemp);
      } else if (threadName.includes('AIV_')) {
        if (processThreadEventSearchTemp.length) {
          AIVCount++;
        }
        matchingAIVEvents.push(...processThreadEventSearchTemp);
      }
    });
  });
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
    highlightEvent(ctx, hoveredEvent, props.processKey, false);
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
function onSelectionEvent(hoveredEvent, ctx, processKey, highlight) {
  highlightEvent(ctx, hoveredEvent, processKey, false, highlight);
}
const handleMouseDown = (e) => {
  hideLineTooltip();
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) {
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
    isDragging.value = true;

    measureDetailsData.value = [];
    rootHashes.value = [];
    leafHashes.value = [];
    leafHashMap.value.clear();
  }
  if (!e.ctrlKey) return;
  lastMoveX = e.clientX;
};

const handleMouseUp = throttle((e) => {
  selectionFinished(e);
}, 16);

const handleMouseLeave = throttle((e) => {
  hideTooltip();
  if (isDragging.value) {
    selectionFinished(e);
  }
  e.stopPropagation();
}, 16);
const selectionFinished = (e) => {
  if(isLockStatus.value) {
    return;
  }
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) {
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
  if (!canvasRef || !swimlaneContainer.value) return;

  const containerRect = swimlaneContainer.value.getBoundingClientRect();
  updateProcessSize(props.process, props.processKey, containerRect, layout, lane2line, viewState);
};

const transformEvents = (process, processKey) => {
  let { eventCtx, backgroundCtx } = ctxs[processKey];

  for (const ctx of Object.values(ctxs[processKey])) {
    clearWholeProcess(ctx, viewState, processKey);
  }
  
  for (const [threadKey, thread] of process.threads.entries()) {
    if (thread.isCounter) {
      eventCtx.save();
      eventCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      eventCtx.beginPath();
      eventCtx.strokeStyle = '#4aaad6ff';
      eventCtx.lineWidth = 1;

      const { drawData } = thread;
      for (const element of drawData) {
        const [x, y] = element;
        eventCtx.lineTo(getNoZoomX(x, viewState), y);
      }

      eventCtx.stroke();
      eventCtx.closePath();
      eventCtx.restore();
    } else if (!selectedEvent.value && !drawColorDatas.length) {
      let eventDatas = [];
      for (const event of thread.events) {
        const { drawData } = event;
        if (event.renderEndTime < timelineState.startTime || event.renderStartTime > timelineState.endTime) {
          drawData.show = false;
          continue;
        }
        drawData.show = true;
        eventDatas.push(drawData);
      }
      eventRenderer.drawEvent(eventDatas, eventCtx, false);
    }
  }

  if ((selectedEvent.value || searchedEvent.value) && !drawColorDatas.length) {
    changeNodeColor(processKey, true, false);
  }

  highlightThread(process, processKey, backgroundCtx);
  drawThreadSeparators(eventCtx, process, processKey);
};

const renderProcessEvents = (process, processKey) => {
  const canvasRef = document.querySelector(`[data-process-key="${processKey}"]`);
  if (!canvasRef) {
    console.warn(`Canvas for process ${processKey} not found`);
    return;
  }

  // 确保画布尺寸正确
  if (canvasRef.width === 0 || canvasRef.height === 0) {
    const containerRect = swimlaneContainer.value.getBoundingClientRect();
    updateProcessSize(process, processKey, containerRect, layout, lane2line, viewState);
  }

  let { eventCtx, backgroundCtx } = ctxs[processKey];

  for (const ctx of Object.values(ctxs[processKey])) {
    if (ctx) {
      clearWholeProcess(ctx, viewState, processKey);
    }
  }

  drawThreads(process, processKey, eventCtx);
  highlightThread(process, processKey, backgroundCtx);
  drawThreadSeparators(eventCtx, process, processKey);
}

const highlightThread = (process, processKey, backgroundCtx) => {
  if (curThread.value != '') {
    const [curProcess, lane] = curThread.value.split('-');
    const curLane = parseInt(lane);
    if (curProcess == processKey) {
      let curY = 0;
      let curHeight = 0;
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
    if (thread.isCounter) {
      drawCounterThread(thread, ctx, threadY);
    } else {
      drawEventThread(thread, ctx, threadY, processKey);
    }
  }
};

const changeNodeColor = (processKey, isDimmed, needText=true) => {
  if (!processKey) return;
  const { eventCtx } = ctxs[processKey];
  const drawDatas = [];
  const process = processes.get(processKey);
  let maxThreadY = 0;
  for (const [threadKey, thread] of process.threads.entries()) {
    if (thread.isCounter) {
      break; // 因为counter总是在最下方，不需要重绘，所以可以提前结束
    }
    const threadY = getThreadStartY(process, processKey, thread.tid, lane2line, layout);
    const threadHeight = getThreadHeight(processKey, thread.tid, lane2line, layout, thread.isCounter);
    maxThreadY = Math.max(maxThreadY, threadY + threadHeight);
    for (const event of thread.events) {
      if (event.renderEndTime < timelineState.startTime || event.renderStartTime > timelineState.endTime ) {
        event.drawData.show = false;
        event.drawData.text = '';
        continue;
      } else {
        event.drawData.show = true;
      }
      if (event.drawData) {
        if (!isDimmed) {
          const { fillColor, fontColor, strokeColor } = getEventColor(event, eventRenderer.deps, processKey, false, false);
          event.drawData.rectColor = fillColor;
          event.drawData.strokeColor = strokeColor;
          event.drawData.fontColor = fontColor;
        }
        drawDatas.push(event.drawData);
      }
    }
  }

  eventCtx.clearRect(0, 0, viewState.clearWidth, maxThreadY + 1);
  eventRenderer.drawEvent(drawDatas, eventCtx, isDimmed);
  if (needText) {
    eventRenderer.drawEventText(drawDatas, eventCtx, isDimmed);
  }
};

const clearDependencyLines = (processKey) => {
  dependencyLinesInfo.value = [];
  const dependencyCanvasRef = document.querySelector(`[data-dep-process-key="${processKey}"]`);
  if (!dependencyCanvasRef) return false;
  
  const dependencyCtx = dependencyCanvasRef.getContext('2d');
  clearWholeProcess(dependencyCtx, viewState, processKey);
  return dependencyCtx;
};

// 在依赖线画布上绘制依赖连接线
const drawDependencyLines = (process, processKey, mode) => {
  const ctx = clearDependencyLines(processKey);
  if (!ctx || !(selectedEvent.value || searchedEvent.value)) return;
  ctx.lineWidth = 1;
  if (selectedEvent.value) {
    const eventMap = buildEventMap(process);
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

const collectRelevantEdges = (startNodeId, eventMap, mode, level) => {
  const edgesToDraw = new Set();
  
  const bfsTraversal = (currentId, depth, direction) => {
    if (depth === 0 || !eventMap.has(currentId)) {
      return;
    }
    
    const currentEvent = eventMap.get(currentId);
    let neighbors;

    if (direction === 'pre') {
      neighbors = currentEvent.dependencies.predecessors || [];
    } else {
      neighbors = currentEvent.dependencies.successors || [];
    }

    for (const neighborId of neighbors) {
      const symbol = direction === 'pre' ? `${neighborId}->${currentId}` : `${currentId}->${neighborId}`;
      if (!edgesToDraw.has(symbol)) {
        edgesToDraw.add(symbol);
        bfsTraversal(neighborId, depth - 1, direction);
      }
    }
  };

  if (mode === DEP_MODE.all || mode === DEP_MODE.pre) {
    bfsTraversal(startNodeId, level, 'pre'); // 遍历前驱方向
  }
  
  if (mode === DEP_MODE.all || mode === DEP_MODE.next) {
    bfsTraversal(startNodeId, level, 'next'); // 遍历后继方向
  }

  return Array.from(edgesToDraw);
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

  dependencyLinesInfo.value.push({fromEvent, toEvent, linePath});
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
  const renderInfo = event.renderInfo;
  const { fillColor, fontColor } = getEventColor(event, eventRenderer.deps, processKey, highlight, stroke);
  const width = renderInfo.width;
  const drawData = {
    rectX: renderInfo.x,
    rectY: renderInfo.y,
    rectPixelX: renderInfo.x * devicePixelRatio,
    rectPixelY: renderInfo.y * devicePixelRatio,
    eventWidth: width,
    height: renderInfo.height,
    rectColor: fillColor,
    strokeColor: '',
    text: '',
    textX: 0,
    textY: 0,
    fontColor: fontColor,
    show: true,
  };
  eventRenderer.drawEvent([drawData], ctx);
  ctx.font = getFontStyle(eventTextSize);
  fillTextInfo(event, ctx, width, drawData, true);
  if (!drawData.text) { return };
  eventRenderer.drawEventText([drawData], ctx);
};

const drawThreadSeparators = (ctx, process, processKey) => {
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

const drawCounterThread = (thread, ctx, threadY) => {
  thread.drawData = [];
  
  // 预计算常量，避免重复计算
  const argKey = thread.argKey;
  const counterHeight = layout.counterHeight;
  const maxHeight = counterHeight * 2 / 3;
  const maxCount = thread.maxCount;
  const segment = 10; // 分段
  const countPerHeight = maxHeight / segment;
  const processLabelWidth = layout.processLabelWidth;
  const offsetX = viewState.offsetX;
  const canvasWidth = viewState.canvasWidth;
  const canvasCssWidth = viewState.canvasCssWidth;
  
  // 预计算基础坐标
  const baseY = threadY + counterHeight;
  const segmentStep = maxCount ? maxCount / segment : 0;
  
  ctx.beginPath();
  ctx.strokeStyle = '#4aaad6ff';
  ctx.lineWidth = 1;

  let lastSegment = undefined;
  let lastLineX = undefined;
  let lastLineY = baseY;
  let targetY = lastLineY;

  ctx.moveTo(0, lastLineY);
  thread.drawData.push([0, lastLineY]);

  for (const event of thread.events) {
    const x = timeToX(event.ts) - processLabelWidth;
    
    if (x < offsetX || x > canvasWidth) {
      break;
    }
    
    const size = event.args[argKey];
    const currentSegment = maxCount ? Math.floor(size / segmentStep) : 0;
    targetY = baseY - countPerHeight * currentSegment;
    
    if (lastSegment === undefined || currentSegment !== lastSegment) {
      ctx.lineTo(x, lastLineY);
      thread.drawData.push([x, lastLineY]);
      ctx.lineTo(x, targetY);
      thread.drawData.push([x, targetY]);
      lastSegment = currentSegment;
      lastLineX = x;
      lastLineY = targetY;
    }
  }

  ctx.lineTo(canvasCssWidth, targetY);
  thread.drawData.push([canvasCssWidth, targetY]);
  ctx.stroke();
  ctx.closePath();
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
    textX: 0, textY: 0, fontColor: '', show: true
  });
  
  thread.events.forEach((event, index, array) => {
    const lineOffset = (event.line || 0) + 1;
    const y = baseY + threadHeight * lineOffset;
    const eventY = y - halfEventHeight;
    
    const drawData = createDrawData();
    if (getDrawData(ctx, event, eventY, drawData, processKey)) {
      event.drawData = drawData;
      eventDatas.push(drawData);
    } else {
      return;
    }
    previousEventData = event;
  });
  eventRenderer.drawEvent(eventDatas, ctx);
};

// 全部的节点数据包括坐标和初始颜色
const getDrawData = (ctx, event, eventY, drawData, processKey) => {
  const { processLabelWidth, eventHeight } = layout;
  if (!ctx || !ctx.canvas) {
    console.warn('Canvas context not available for drawing event');
    return false;
  }
  let x = timeToX(event.renderStartTime) - processLabelWidth;
  if (x > viewState.canvasCssWidth) {
    x = viewState.canvasCssWidth - 1;
  }
  const eventWidth = durationToWidth(event.renderDuration);

  // 存储事件的位置信息，用于点击检测
  event.renderInfo = {
    x: x,
    y: eventY,
    width: eventWidth,
    height: eventHeight,
    processKey: processKey,
  };

  const colors = getEventColor(event, eventRenderer.deps, processKey);
  const { fillColor, fontColor, strokeColor } = colors;

  // 直接赋值，避免重复访问
  drawData.rectX = x;
  drawData.rectY = eventY;
  drawData.rectPixelX = x * devicePixelRatio;
  drawData.rectPixelY = eventY * devicePixelRatio;
  drawData.eventWidth = eventWidth;
  drawData.height = eventHeight;
  drawData.rectColor = fillColor;
  drawData.strokeColor = strokeColor;
  drawData.fontColor = fontColor;

  return true;
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
const fillTextInfo = (event, ctx, width, drawData, isTextXChange = true) => {
  // 预计算常量，避免重复计算
  const { scale, offsetX } = viewState;
  const absOffsetX = Math.abs(offsetX);
  
  const actualRectX = drawData.rectX * scale;
  const actualRectEndX = actualRectX + width * scale;
  const isSplit = actualRectX < absOffsetX;
  const actualWidth = isSplit ? actualRectEndX - absOffsetX : width * scale;
  
  if (actualWidth < 15) {
    drawData.text = '';
    return false;
  }

  const actualPixWidth = actualWidth * devicePixelRatio;
  let displayName = getDisplayName(event);
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

  let textStartX = 0;
  const textWidthDiff = actualPixWidth - textWidth;
  
  if (isSplit) {
    textStartX = textWidthDiff / 2;
  } else {
    textStartX = (offsetX + actualRectX) * devicePixelRatio + textWidthDiff / 2;
  }

  drawData.text = displayText;
  drawData.textX = isTextXChange ? textStartX : event.drawData.textX;
  drawData.textY = drawData.rectPixelY + eventTextSize;
  return true;
};

const renderProcessText = async (process, ctx) => {
  ctx.font = getFontStyle(eventTextSize);
  ctx.textRenderingOptimization = 'optimizeLegibility';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const selectedEventId = selectEvent.value ? selectEvent.value.id : null;
  const selectedDep = selectEvent.value ? [...selectedEvent.value.dependencies.predecessors, ...selectedEvent.value.dependencies.successors] : [];
  const isHighlighting = highlightedPaths.size > 0;

  for (const [threadKey, thread] of process.threads.entries()) {
    if (thread.isCounter) {
      break;
    }
    // 批量处理事件，减少重复的样式设置
    const visibleEvents = [];
    for (const event of thread.events) {
      const { drawData } = event;
      if (!drawData || !drawData.show) {
        continue;
      }
      
      // 预计算文本信息，避免在循环中重复调用
      fillTextInfo(event, ctx, drawData.eventWidth, drawData);
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
      ctx.fillText(drawData.text, drawData.textX, drawData.textY);
    }
    if (preData && nextData) {
      drawVirtualDom(preData, nextData, ctx);
    } 
  }
  ctx.restore();
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
const showTooltip = (e, event, canvasRef) => {
  if (!tooltip.value) return;

  const displayName = event.isCounter ? event.displayName : (getDisplayName(event) || 'Event');
  let tooltipContent = `<div class="tooltip-container">`;
  tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("title")}</span><span class="tooltip-value">${displayName}</span></div>`;
  tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("start")}</span><span class="tooltip-value">${formatTimeWithUnit(event.startTime - viewState.minTime).value}${formatTimeWithUnit(event.startTime - viewState.minTime).unit}</span></div>`;
  if (event.isCounter) {
    tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("countValue")}</span><span class="tooltip-value">${event.counterSize}</span></div>`;
  } else {
    tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("duration")}</span><span class="tooltip-value">${formatTimeWithUnit(event.duration).value}${formatTimeWithUnit(event.duration).unit}</span></div>`;
  }
  tooltipContent += "</div>"; 
  tooltip.value.innerHTML = tooltipContent;
  tooltipStyle.display = 'block';
  const canvasCSSWidth = viewState.canvasCssWidth;
  if(event.renderInfo.x + 200  > canvasCSSWidth){
      tooltipStyle.left = (e.clientX - 100) + 'px';
  } else {
      tooltipStyle.left = (e.clientX + 10) + 'px';
  }
  tooltipStyle.top = (e.clientY + 10) + 'px';
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

const hideTooltip = () => {
  tooltipStyle.display = 'none';
};

const hideLineTooltip = () => {
  lineTooltipStyle.display = 'none';
};

const measureDistance = (event, processKey) => {
  const uiCtx = getUIContext(processKey);
  measureRenderer.handleDistanceMeasurement(uiCtx, event, processKey);
}
const measureDistanceZoom = (event, processKey) => {
  const uiCtx = getUIContext(processKey);
  measureRenderer.handleDistanceMeasurement(uiCtx, event, processKey, true);
};

const renderEvents = () => {
  renderProcessEvents(props.process, props.processKey);
};

const realCoordinateY = (y) => {
  let realY = y;
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) {
    console.warn(`Canvas for process ${props.processKey} not found during click handling`);
    return { realY, processKey: props.processKey };
  }

  const rect = canvasRef.getBoundingClientRect();
  realY = y - rect.top;
  return { realY, processKey: props.processKey };
}

const drawEventLine = (x, color, flag) => {
  const devicePixelRatioValue = window.devicePixelRatio !== undefined ? window.devicePixelRatio : 1;
  const drawX = x * devicePixelRatioValue;
  for (const processx of processes.entries()) {
    let canvasRef = document.querySelector(`[data-line-process-key="${processx[0]}"]`);
    if (flag === "over") {
      canvasRef = document.querySelector(`[data-hover-process-key="${processx[0]}"]`);
    }
    let ctx = canvasRef.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(drawX, 0);
    ctx.lineTo(drawX, canvasRef.height);
    ctx.stroke();
    ctx.restore();
  }
}

const eraseEventLine = (flag) => {
  for (const [processKey] of processes.entries()) {
    if (!processExpanded.get(processKey)) {
      continue;
    }
    let canvasRef = document.querySelector(`[data-line-process-key="${processKey}"]`);
    if (flag === "over") {
      canvasRef = document.querySelector(`[data-hover-process-key="${processKey}"]`);
    }
    const ctx = canvasRef.getContext('2d');
    clearWholeProcess(ctx, viewState, processKey);
  }
}

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
window.ascEventBus.on('returnSemanticLabelFromCode', ({ label }) => {
  handleOutline(label);
});
window.ascEventBus.on('returnSemanticLabelFromCom', ({ label }) => {
  handleOutline(label, true, false);
});
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
});
const sendMsg = (command, param) => {
  Promise.resolve().then(() => {
    window.ascEventBus.emit(command, param);
  });
};
const drawLockedOutline = () => {
  handleOutline(lockedLabel, true, true, true);
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
  resizeCanvas,
  renderEvents,
  realCoordinateY,
  drawDependencyLines,
  clearDependencyLines,
  drawThreadSeparators,
  changeNodeColor,
  drawEventLine,
  eraseEventLine,
  getOffset,
  transformEvents,
  drawSelectionBox,
  toggleLock,
  resizeDrawBoundary,
  getEventColor: (event, processKey, highlight = false, stroke = true) => {
    return getEventColor(event, eventRenderer.deps, processKey, highlight, stroke);
  },
  drawBoundary: threeRender.drawBoundary,
  animate: threeRender.animate,
  stopAnimate: threeRender.stopAnimate,
  distanceMeasurementResize
});
watch(isHoverLockStatus, () => {
  sendMsg('swimSelectModeChange', { selectMode: isHoverLockStatus.value });
});
// 每个事件画布都会走一遍
watch(isDarkTheme, () => {
  colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
  updateProcessDrawData(props.process, props.processKey);
  const ctxInfo = ctxs[props.processKey];
  if (!ctxInfo) return;
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
  if (await getIsCompleteBoot()) {
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
      const uiCtx = getUIContext(processKey);
      measureRenderer.drawRoundedRect(uiCtx, lastData, processKey);
      measureRenderer.calculateAndDrawConnection(uiCtx);
      break;
    }
  }
};
const clearDistanceMeasurement = () => {
  for (const [processkey, process] of processes.entries()) {
    if (!processExpanded.get(processkey)) {
      continue;
    }
    const uiCtx = getUIContext(processkey);
    measureRenderer.clearDrawConnector(uiCtx, processkey);
  }
};
</script>
<style scoped>
@import url("../css/swimGraph/Processes/events.css");
</style>
  