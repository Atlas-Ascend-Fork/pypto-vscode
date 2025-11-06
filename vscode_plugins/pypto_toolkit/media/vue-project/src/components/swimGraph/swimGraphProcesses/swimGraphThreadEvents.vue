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
           'padding': '4px 6px',
         }">
      <d-icon name="lock-open"></d-icon>
    </div>
    <div v-if="isThreeColumn && isLockStatus && lockPosition" 
         class="lock-indicator"
         @click="unLockClick"
         :style="{
           top: lockPosition.top + 'px',
           left: lockPosition.left + 'px',
           'background-color': 'var(--devui-tooltip-bg)',
           'border-radius': '6px',
           'padding': '4px 6px',
         }">
      <d-icon name="icon-lock-private"></d-icon>
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
  getThreadHeight, getThreadStartY, eventTextSize, meaureTextSize
} from '../swimGraphUtils';
import { isEqual, throttle } from 'lodash-es';

const { isDarkTheme } = inject('root');
const { t: $t } = useI18n();
const canvasclickedEvent = ref(null);
const curThread = inject('curThread');
const lockPosition = ref(null);
let colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
let points = [];
let boundaries = [];
let preLabel = '';
let drawColorDatas = {};
const spaceInThreeCol = 2;
const getActiveEventCanvas = (processKey) => {
  return document.querySelector(`[data-process-key="${processKey}"]`);
};
let isHoverLockStatus = false;
// 注入父组件提供的状态和方法
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
} = inject('swimGraphState');

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
// 测距的最小距离，若小于这个距离，不显示左右箭头
const nodeSpaceMin = 58;
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
let altClickData = {
    preData: null,
    lastData: null,
    largeSpacing: false
};
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
// 手动测距，点击第一个节点
let isMeasureFirst = ref(false);
// 手动测距，点击第二个节点 ，此时的测距需要保留
let isMeasureFixed = ref(false);
// 手动测距，是否交换
let isMeasureChange = ref(false);
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
        isHoverLockStatus = true;
        return;
      }
    } else {
      isHoverLockStatus = false;
      clearSelectionCanvas('data-three-column-process-key');
      toggleLock();
    }
  }
  if (clickedEvent) {
    if(e.altKey){
      // 清空hover画布 
      onHoverEvent();
      measureDistance(clickedEvent, props.processKey);
    } else {
      isMeasureFirst.value = false;
      isMeasureFixed.value = false;
      !e.ctrlKey && selectEvent(clickedEvent, props.processKey);
    }
  } else {
    isMeasureFirst.value = false;
    isMeasureFixed.value = false;
    highlightedPaths.clear();
    detailsPanelExpanded.value = false;
    selectEvent(null, props.processKey);
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

let mousePosition = null;
let isKeyPressed = false;
let keyTimeOut;
let keyInterval;
let scaleStep = 0.1;
let moveStep = 30;
let scaleStepIncrement = 0.05;
let moveStepIncrement = 30;

onMounted(() => {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
});

const onKeyDown = (e) => {
  const activeElement = document.activeElement;
  if (activeElement.nodeName === 'INPUT') {
    return;
  }
  if (!isKeyPressed) {
    handlekeydown(e);
  }
  isKeyPressed = true;
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
  if (isKeyPressed) {
    isKeyPressed = false;
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

const matchKey = (key, configKey) => {
  if (configKey === undefined || configKey === null) {
    return false;
  } 
  return key === configKey || key === configKey.toLowerCase();
}

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
      if (isMeasureFixed.value) {
        measureDistanceZoom(altClickData.lastData, String(altClickData.lastData.pid));
      }
      break;
    case matchKey(key, userConfig?.value.ZoomOutShortcut):
      scaleCanvas(mouseX, 1 - scaleStep);
      scaleStep += scaleStepIncrement;
      if (isMeasureFixed.value) {
        measureDistanceZoom(altClickData.lastData, String(altClickData.lastData.pid));
      }
      break;
    case matchKey(key, userConfig?.value.leftmoveShortcut):
      rightmove(moveStep);
      moveStep += moveStepIncrement;
      break;
    case matchKey(key, userConfig?.value.rightmoveShortcut):
      leftmove(moveStep);
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
function getCanvasRefs(processKey) {
  const canvasRef = getActiveEventCanvas(processKey);
  if (!canvasRef) { return null };
  const uiCanvasRef = document.querySelector(`[data-ui-process-key="${processKey}"]`);
  if (!uiCanvasRef) { return null };
  const hoverCanvasRef = document.querySelector(`[data-hover-process-key="${processKey}"]`);
  if (!hoverCanvasRef) { return null };
  const backgroundCanvasRef = document.querySelector(`[data-background-process-key="${processKey}"]`);
  if (!backgroundCanvasRef) { return null };
  const lineCanvasRef = document.querySelector(`[data-line-process-key="${processKey}"]`);
  if (!lineCanvasRef) { return null };
  const selectionCanvasRef = document.querySelector(`[data-selection-process-key="${processKey}"]`);
  if (!selectionCanvasRef) { return null };
  const threeColumnCanvasRef = document.querySelector(`[data-three-column-process-key="${processKey}"]`);
  if (!threeColumnCanvasRef) { return null };
  return {
    canvasRef,
    uiCanvasRef,
    uiCtx: uiCanvasRef.getContext('2d'),
    hoverCanvasRef,
    backgroundCanvasRef,
    backgroundCanvasCtx: backgroundCanvasRef.getContext('2d'),
    lineCanvasRef,
    selectionCanvasRef,
    threeColumnCanvasRef
  };
}

function updateMousePos(e) {
  mousePosition = { x: e.clientX, y: e.clientY };
}

function computeLocalXY(canvasRef) {
  const rect = canvasRef.getBoundingClientRect();
  const x = (mousePosition.x - rect.left - viewState.offsetX) / viewState.scale;
  const y = mousePosition.y - rect.top;
  return { x, y };
}

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
    backgroundCanvasCtx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
    backgroundCanvasCtx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    backgroundCanvasCtx.fillRect(0, curY, viewState.canvasCssWidth, curHeight);
  }
}

function handleAltMeasureHoverBranch(e, hoveredEvent, uiCtx) {
  const manual = altClickData.preData && isMeasureFirst.value && !isMeasureFixed.value;
  if (!(hoveredEvent && e.altKey && manual)) {
    return false;
  }
  if (isMeasureChange.value && altClickData.lastData) {
    let temp = altClickData.preData;
    altClickData.preData = altClickData.lastData;
    altClickData.lastData = temp;
    isMeasureChange.value = false;
  }
  if (isEqual(altClickData.preData, hoveredEvent)) {
    return true; // consumed
  }
  altClickData.lastData = hoveredEvent;
  clearDrawConnectorHover(uiCtx, props.processKey);
  measureDistanceHover(hoveredEvent, props.processKey);
  return false;
}

function maybeDrawConnectorPreview(preData, lastData, nodeSpacingX, uiCtx) {
  if (!preData || !lastData || isMeasureFixed.value) { return };
  const divElement = document.getElementsByClassName('swimlane-container');
  const scrollWidth = divElement[0].offsetWidth - divElement[0].clientWidth;
  const actSpacingX = nodeSpacingX * viewState.scale;
  if (actSpacingX <= 3) { return };
  const { canvasWidth } = viewState;
  const noZoomLastX = getNoZoomX(lastData?.renderInfo?.x);
  const noZoomPreX = getNoZoomX(preData?.renderInfo?.x) + (preData?.renderInfo?.width * viewState.scale);
  if (noZoomLastX < (canvasWidth - scrollWidth) && noZoomPreX > 0 ) {
    altClickData = { preData, lastData, largeSpacing: actSpacingX > nodeSpaceMin };
    drawConnector(uiCtx, altClickData.largeSpacing);
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
  const pointX = (point.x * viewState.scale * viewState.scale) + viewState.offsetX;
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

const handleMouseMove = throttle((e) => {
  const refs = getCanvasRefs(props.processKey);
  if (!refs) return;
  const { canvasRef, uiCanvasRef, uiCtx, hoverCanvasRef, backgroundCanvasRef, backgroundCanvasCtx } = refs;

  if (altClickData.preData && altClickData.lastData && !e.altKey && !isMeasureFixed.value) {
    clearDrawConnector(uiCtx, props.processKey);
  }

  updateMousePos(e);
  const { x, y } = computeLocalXY(canvasRef);

  const info = findEventAtPosition(x, y, props.processKey);
  const hoveredEvent = info?.event;
  const { preData, lastData, nodeSpacingX } = info?.altClickData || {};

  highlightThreadOnHover(y, backgroundCanvasRef, backgroundCanvasCtx);

  if (!e.altKey) {
    isMeasureFirst.value = false;
  }

  if (handleAltMeasureHoverBranch(e, hoveredEvent, uiCtx)) {
    return;
  }

  if (!e.altKey && !isLockStatus.value) {
    onHoverEvent(hoveredEvent);
    maybeDrawConnectorPreview(preData, lastData, nodeSpacingX, uiCtx);
  }

  updateCursorState(e, hoveredEvent, x, y, canvasRef);
  const hasHnadleHover = handleHoverEvent(hoveredEvent);
  if (!hasHnadleHover && isThreeColumn && !isLockStatus.value && !isHoverLockStatus) {
    sendMsg('returnSemanticLabelFromSwim', { label: '', rootHashList: [] });
    preLabel = '';
    const isPointInPolygon = isPointInPolygonFun([x, y], boundaries);
    if (!isPointInPolygon) {
      clearSelectionCanvas('data-three-column-process-key');
      selectEvent(null, props.processKey);
    }
  }
  if (isLockStatus.value) {
    return;
  }
  if (isDragging.value && !e.altKey && !e.ctrlKey) {
    selection.endLocalX = x;
    selection.endY = y;
    // 绘制框选
    drawSelectionBox();
    mulDetailsExpanded.value = false;
  }
}, 16);
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
  return preLabel !== color && !isLockStatus.value && isThreeColumn && !isHoverLockStatus;
};
const updateCursorState = (e, hoveredEvent, x, y, canvasRef) => {
  let cursor = handleTooltipAndCursor(e, hoveredEvent, canvasRef) || '';
  cursor = handleLineTooltipAndCursor(e, x, y) || '';
  const dragCursor = handleCtrlDragPan(e, canvasRef);
  if (dragCursor) {
    cursor = dragCursor;
  }
  canvasRef.style.cursor = cursor;
};
const getRootHashList = (eventHintStr) => {
  // 添加输入验证
  if (typeof eventHintStr !== 'string') {
    return [];
  }

  // 使用全局匹配和命名捕获组，支持匹配多个根哈希
  const rootHashRegex = /rootHash:(?<hash>\d+)/g;
  const matches = [...eventHintStr.matchAll(rootHashRegex)];

  // 使用可选链和空值合并确保安全提取
  const hashArray = matches
    .map(match => match?.groups?.hash)
    .filter(hash => hash != null);
  return hashArray.join(',');
};
const drawSelectionBox = () => {
  const uiCanvasRef = document.querySelector(`[data-selection-process-key="${props.processKey}"]`);
  const uiCtx = uiCanvasRef.getContext('2d');
  if(!uiCtx) {
    return;
  }
  uiCtx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
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

// 绘制边界路径
const drawBoundary = () => {
  const uiCanvasRef = document.querySelector(`[data-three-column-process-key="${props.processKey}"]`);
  const ctx = uiCanvasRef.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, uiCanvasRef.width, uiCanvasRef.height);
  if (!boundaries.length) {
    return;
  }
  const space = spaceInThreeCol;
  const xSpace = space / viewState.scale;
  const { minLeft, maxRight } = boundaries.reduce((acc, group) => {
    return group.reduce((groupAcc, item) => {
      const [left] = item.leftTop;
      const [right] = item.rightTop;
      return {
        minLeft: Math.min(groupAcc.minLeft, left),
        maxRight: Math.max(groupAcc.maxRight, right)
      };
    }, acc);
  }, { minLeft: Infinity, maxRight: -Infinity });
  const isAtLeftEdge = viewState.offsetX === 0 && minLeft <= xSpace;
  const isAtRightEdge = viewState.offsetX === 0 && maxRight >= viewState.canvasWidth;
  // 计算每个区域的左右边界范围
  const tempRegions = boundaries.map(region => {
    return region.map(row => {
      const leftX = isAtLeftEdge ? row.leftTop[0] : row.leftTop[0] - xSpace;
      const rightX = isAtRightEdge ? row.rightTop[0] : row.rightTop[0] + xSpace;
      const topY = row.leftTop[1] - space;
      const bottomY = row.leftBottom[1] + space;
      return {
        leftTop: [leftX, topY],
        leftBottom: [leftX, bottomY],
        rightTop: [rightX, topY],
        rightBottom: [rightX, bottomY],
        width: rightX - leftX
      };
    });
  });
  ctx.fillStyle = isDarkTheme.value ? 'rgba(49, 127, 255, 0.2)' : 'rgba(10, 89, 247, 0.2)';
  ctx.strokeStyle = isDarkTheme.value ? '#317AF7' : '#0A59F7';
  ctx.lineWidth = 1 / viewState.scale;
  // 遍历每个区域并绘制路径
  let lineArray = [];
  for (const region of tempRegions) {
    ctx.beginPath();
    const [firstRow] = region;
    const lastRow = region[region.length - 1];
    // 起点：首行左上
    ctx.moveTo(...firstRow.leftTop);
    // 绘制左边界
    let minObj = firstRow; // 默认取第一个对象
    for (let i = 0; i < region.length; i++) {
      const currentRow = region[i];
      if (i === 0) {
        // 首行：直接左上 -> 左下
        ctx.lineTo(...currentRow.leftBottom);
      } else {
        const preRow = region[i - 1];
        // 从上一行左下 -> 水平移动到当前行X坐标 -> 垂直上升到当前行左上
        if ((Math.abs(preRow.leftBottom[0] - currentRow.leftBottom[0]) - currentRow.width) !== (Math.abs(preRow.rightBottom[0] - currentRow.rightBottom[0]) - preRow.width)) {
          ctx.lineTo(preRow.leftBottom[0], currentRow.leftTop[1]);  // 水平过渡
        } else {
          if (Math.abs(preRow.leftBottom[0] - currentRow.leftBottom[0]) < currentRow.width) {
            ctx.lineTo(preRow.leftBottom[0], currentRow.leftTop[1]);  // 水平过渡
          }
        }
        ctx.lineTo(...currentRow.leftTop);  // 垂直上升
        ctx.lineTo(...currentRow.leftBottom);  // 垂直上升
      }
      if (currentRow.leftBottom[0] < minObj.leftBottom[0]) {
        minObj = currentRow; // 找到更小的则替换
      }
    }
    // 绘制右边界
    // 从最下行左下 -> 右下
    ctx.lineTo(...lastRow.rightBottom);
    lineArray.push(minObj);
    for (let i = region.length - 1; i >= 0; i--) {
      const currentRow = region[i];
      if (i === region.length - 1) {
        // 最下行： 直接右下 -> 右上
        ctx.lineTo(...currentRow.rightTop);
      } else {
        const nextRow = region[i + 1];
        // 从下一行右上 -> 水平移动到当前行X坐标 -> 垂直下降到当前行右下
        if ((Math.abs(currentRow.leftBottom[0] - nextRow.leftBottom[0]) - nextRow.width) !== (Math.abs(currentRow.rightBottom[0] - nextRow.rightBottom[0]) - currentRow.width)) {
          ctx.lineTo(nextRow.rightTop[0], currentRow.rightBottom[1]);  // 水平过渡
        } else {
          if (Math.abs(currentRow.leftBottom[0] - nextRow.leftBottom[0]) < nextRow.width) {
            ctx.lineTo(nextRow.rightTop[0], currentRow.rightBottom[1]);  // 水平过渡
          }
        }
        ctx.lineTo(...currentRow.rightBottom);  // 垂直上升
        ctx.lineTo(...currentRow.rightTop);  // 垂直下降
      }
    }
    // 闭合路径: 首行右上 -> 左下
    ctx.lineTo(...firstRow.rightTop);
    ctx.lineTo(...firstRow.leftTop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // 绘制不同区域的连线
  drawConnectLines(lineArray, ctx);
};
const drawConnectLines = (lineArray, ctx) => {
  const connectPoints = lineArray.map(item => item.leftBottom);
  // 绘制连线
  for (let i = 0; i < connectPoints.length - 1; i++) {
    const start = connectPoints[i];
    const end = connectPoints[i + 1];
    // 如果起点和终点在同一列（x相同），直接画垂直线
    if (start[0] === end[0]) {
      ctx.beginPath();
      ctx.moveTo(...start);
      ctx.lineTo(...end);
      ctx.stroke();
    } else {
      // 否则先水平移动，再垂直移动
      const midPoint = [end[0], start[1]];  //水平移动到目标列
      ctx.beginPath();
      ctx.moveTo(...start);
      ctx.lineTo(...midPoint);
      ctx.lineTo(...end);
      ctx.stroke();
    }
  }
};
const lockClick = (e) => {
  e.stopPropagation();
  isLockStatus.value = true;
  sendMsg('activeLock', { label: preLabel });
  let rootHashArray = [];
  processes.forEach((process, processKey) => {
    if (!process.expanded) {
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
    return;
  }
  lockPosition.value = {
    top: y,
    left: x,
  };
};
const resizeDrawBoundary = () => {
  processes.forEach((process, processKey) => {
    if (!process.expanded || (drawColorDatas[processKey] && !drawColorDatas[processKey].length)) {
      return;
    }
    changeNodeColor(processKey, true);
    const { eventCtx } = ctxs[processKey];
    if (!drawColorDatas[processKey]) {
      return;
    }
    drawColorDatas[processKey].forEach((event, eventKey) => {
      onSelectionEvent(event, eventCtx, processKey, false);
    });
  });
  drawBoundary();
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
    if (!process.expanded) {
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
const getOffset = (deltaX, scale) => {
  if (scale <= 10) {
    return deltaX / scale;
  }
  if (scale <= 100) {
    return deltaX / scale * 10;
  }
  if (scale <= 1000) {
    return deltaX * (1 / Math.log2(scale));
  }
  return deltaX * (1.25 / Math.log2(scale));
};

function onHoverEvent(hoveredEvent) {
  const canvasRef = document.querySelector(`[data-hover-process-key="${props.processKey}"]`);
  if (!canvasRef) {
    return;
  }
  const ctx = canvasRef.getContext('2d');
  ctx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
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
  ctx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
  if (key !== 'data-three-column-process-key') {
    return;
  }
  points = [];
  boundaries = [];
  lockPosition.value = isLockStatus.value ? lockPosition.value : false;
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
      const { x } = computeLocalXY(canvasRef);
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
    const { x } = computeLocalXY(canvasRef);
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
    ctx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
  }
  
  for (const [threadKey, thread] of process.threads.entries()) {
    if (thread.isCounter) {
      eventCtx.beginPath();
      eventCtx.strokeStyle = '#4aaad6ff';
      eventCtx.lineWidth = 1 / viewState.scale;

      const { drawData } = thread;
      for (const element of drawData) {
        const [x, y] = element;
        eventCtx.lineTo(x, y);
      }

      eventCtx.stroke();
      eventCtx.closePath();
    } else if (!selectedEvent.value && !drawColorDatas.length) {
      let eventDatas = [];
      for (const event of thread.events) {
        const { drawData } = event;
        if (event.endTime < timelineState.startTime || event.startTime > timelineState.endTime) {
          drawData.show = false;
          continue;
        }
        if (event.isFakeCore) {
          drawData.eventWidth = event.renderInfo.width / viewState.scale;
        }
        drawData.show = true;
        eventDatas.push(drawData);
      }
      drawEvent(eventDatas, eventCtx, false);
    }
  }

  if (selectedEvent.value && !drawColorDatas.length) {
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
      ctx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
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
      backgroundCtx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
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
      if (event.endTime < timelineState.startTime || event.startTime > timelineState.endTime ) {
        event.drawData.show = false;
        event.drawData.text = '';
        continue;
      } else {
        event.drawData.show = true;
      }
      if (event.isFakeCore) {
        event.drawData.eventWidth = event.renderInfo.width / viewState.scale;
      }
      if (event.drawData) {
        if (!isDimmed) {
          const { fillColor, fontColor, strokeColor } = getEventColor(event, false, false);
          event.drawData.rectColor = fillColor;
          event.drawData.strokeColor = strokeColor;
          event.drawData.fontColor = fontColor;
        }
        drawDatas.push(event.drawData);
      }
    }
  }

  eventCtx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
  drawEvent(drawDatas, eventCtx, isDimmed);
  if (needText) drawEventText(drawDatas, eventCtx, isDimmed);
};

const clearDependencyLines = (processKey) => {
  dependencyLinesInfo.value = [];
  const dependencyCanvasRef = document.querySelector(`[data-dep-process-key="${processKey}"]`);
  if (!dependencyCanvasRef) return false;
  
  const dependencyCtx = dependencyCanvasRef.getContext('2d');
  dependencyCtx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
  return dependencyCtx;
};

// 在依赖线画布上绘制依赖连接线
const drawDependencyLines = (process, processKey, mode) => {
  const ctx = clearDependencyLines(processKey);
  if (!ctx || !selectedEvent.value) return;
  ctx.lineWidth = 1;

  const eventMap = buildEventMap(process);
  let level = isSearchActive.value ? 0 : userConfig.value.connectionLevel;
  const edgesToDraw = collectRelevantEdges(
    selectedEvent.value.id,
    eventMap,
    mode,
    level
  );

  renderDependencyEdges(edgesToDraw, eventMap, ctx);
  highlightEvent(ctx, selectedEvent.value, processKey, true);
};

const buildEventMap = (process) => {
  const eventMap = new Map();
  for (const [, thread] of process.threads) {
    for (const event of thread.events) {
      eventMap.set(event.id, event);
    }
  }
  return eventMap;
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
  if (fromEvent.isFakeCore) {
    fromWidth /= viewState.scale;
  }

  const pos = {
    startX: (fromEvent.renderInfo.x + fromWidth) * devicePixelRatio,
    startY: (fromEvent.renderInfo.y + (fromEvent.renderInfo.height / 2)) * devicePixelRatio,
    endX: toEvent.renderInfo.x * devicePixelRatio,
    endY: (toEvent.renderInfo.y + (toEvent.renderInfo.height / 2)) * devicePixelRatio,
  };

  const linePath = drawArrow(ctx, pos, sourceColor, targetColor, viewState.scale, viewState.offsetX);

  dependencyLinesInfo.value.push({fromEvent, toEvent, linePath});
  drawEvent([fromEvent.drawData, toEvent.drawData], ctx);
  drawEventText([fromEvent.drawData, toEvent.drawData], ctx);
};

const highlightEvent = (ctx, event, processKey, stroke=true, highlight=true) => {
  if (!event || !event.renderInfo) {
    return;
  }
  if (event.renderInfo.processKey !== processKey) {
    return;
  }
  const renderInfo = event.renderInfo;
  const { fillColor, fontColor } = getEventColor(event, highlight, stroke);
  const width = event.isFakeCore ? renderInfo.width / viewState.scale : renderInfo.width;
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
  drawEvent([drawData], ctx);
  ctx.font = getFontStyle(eventTextSize);
  fillTextInfo(event, ctx, width, drawData, true);
  if (!drawData.text) { return };
  drawEventText([drawData], ctx);
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
    // 冲突处理：将渲染时间后移1个单位以避免重叠
    const hasTimeConflict = thread.isFakeCore && previousEventData && previousEventData.renderEndTime > event.renderStartTime;
    if (hasTimeConflict) {
      // 获取当前事件的所有后置依赖事件
      const dependentEvents = getDependentEvents(event.dependencies.successors);
      const minDependentStartTime = dependentEvents.length ? Math.min(...dependentEvents.map(dep => dep.startTime)) : timelineState.endTime;
      const lastEventData = array[index + 1];
      const lastStartTime = lastEventData ? lastEventData.startTime : timelineState.endTime;
      const duration = Math.min((Math.min(minDependentStartTime, lastStartTime) - event.startTime) / 2, 1);
      // 冲突处理：将渲染时间后移1个单位
      const newRenderStartTime = event.renderStartTime + duration;
      event.renderStartTime = newRenderStartTime;
      event.renderEndTime = newRenderStartTime + 1;
    }
    
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
  drawEvent(eventDatas, ctx);
};
const getDependentEvents = (successors) => {
  const dependentEvents = [];
  processes.forEach((process, processKey) => {
    if (!process.expanded) {
      return;
    }
    // 遍历线程
    process.threads.forEach((thread, threadKey) => {
      const { threadName, events } = thread;
      events.forEach((event, eventKey) => {
        if (successors.includes(event.id)) {
          dependentEvents.push(event);
        }
      });
    });
  });
  return dependentEvents;
};
const getEventColor = (event, highlight=false, stroke=true) => {
  const eventColor = isDarkTheme.value ? event.color.dark : event.color.light;
  let fillColor = eventColor ? eventColor.base : '';
  let fontColor = colorCfg.eventFont;
  let strokeColor = '';

  if (event.renderInfo.processKey === props.processKey) {
    const isSelf = selectedEvent.value && selectedEvent.value.id === event.id;
    const selectedDep = selectedEvent.value ? [...selectedEvent.value.dependencies.predecessors, ...selectedEvent.value.dependencies.successors] : [];
    if (highlightedPaths.size > 0 && !isSelf && !highlightedPaths.has(event.id) && !selectedDep.includes(event.id)) {
      fillColor = colorCfg.eventRectNoColor;
      fontColor = colorCfg.eventFontNoColor;
    }
  }

  if (highlight) {
    fillColor = eventColor.light;
    fontColor = colorCfg.eventFontHighLight;
    if (stroke) strokeColor = colorCfg.eventHighLightStroke;
  }

  const colors = { fillColor, fontColor, strokeColor };
  return colors;
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
  const width = durationToWidth(event.duration);
  const eventWidth = event.isFakeCore ? 1 : width;
  
  // 存储事件的位置信息，用于点击检测
  event.renderInfo = {
    x: x,
    y: eventY,
    width: eventWidth,
    height: eventHeight,
    processKey: processKey,
  };

  const colors = getEventColor(event);
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
      const colors = getEventColor(event);
      const { fillColor, fontColor, strokeColor } = colors;
      drawData.rectColor = fillColor;
      drawData.strokeColor = strokeColor;
      drawData.fontColor = fontColor;
    }
  }
};

// 调用之前需确认画布已还原成初始状态
const fillTextInfo = (event, ctx, width, drawData, isTextXChange = true) => {
  if (event.isFakeCore) return false;
  
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

const drawEvent = (eventDatas, ctx, isDimmed=false) => {
  for (const drawData of eventDatas) {
    if (!drawData) {
      continue;
    }
    let width;
    if (drawData.eventWidth < viewState.minWidth) {
      width = viewState.minWidth;
    } else {
      width = drawData.eventWidth;
    }
    ctx.fillStyle = isDimmed ? colorCfg.eventRectNoColor : drawData.rectColor;
    ctx.strokeStyle = drawData.strokeColor;
    ctx.beginPath();
    ctx.rect(drawData.rectX, drawData.rectY, width, drawData.height);
    ctx.fill();
    if (drawData.strokeColor && width * viewState.scale > 10) {
      ctx.stroke();
    }
  }
};

const drawEventText = (drawDatas, ctx, isDimmed=false) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const { show, text, textX, textY, fontColor } of drawDatas) {
    if (!show || !text) { continue };
    ctx.fillStyle = isDimmed ? colorCfg.eventFontNoColor : fontColor;
    ctx.font = getFontStyle(eventTextSize);
    ctx.textRenderingOptimization = 'optimizeLegibility';
    ctx.fillText(text, textX, textY);
  }

  ctx.restore();
};

const renderProcessText = (process, ctx) => {
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

      ctx.fillText(drawData.text, drawData.textX, drawData.textY);
    }
  }
  ctx.restore();
};

const showTooltip = (e, event, canvasRef) => {
  if (!tooltip.value) return;

  const displayName = event.isCounter ? event.displayName : (getDisplayName(event) || 'Event');
  let tooltipContent = `<div class="tooltip-container">`;
  tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("title")}</span><span class="tooltip-value">${displayName}</span></div>`;
  if(event.cat){
    tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t("categroy")}</span><span class="tooltip-value">${event.cat}</span></div>`;
  }
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
    const valueString = `shape:${JSON.stringify(shape)}, dtype:${dtype}, rawmagic:${rawmagic}, mem_usage:${mem_usage}`;
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
const clearDrawConnector = (ctx, processKey) => {
    const canvasRef = getActiveEventCanvas(processKey);
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
    altClickData = {
      preData: null,
      lastData: null,
      largeSpacing: false
    };
  }
  const clearDrawConnectorHover = (ctx, processKey) => {
    //先清空画布
    const canvasRef = getActiveEventCanvas(processKey);
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
    // 补画第一个手动测距的节点
    const uiCanvasRef = document.querySelector(`[data-ui-process-key="${processKey}"]`);
    const uiCtx = uiCanvasRef.getContext('2d');
    uiCtx.strokeStyle = isDarkTheme.value ? "#FFFFFF" : '#191919';
    uiCtx.lineWidth = 2 / viewState.scale;
    strokeRoundRect(uiCtx, altClickData.preData, processKey);
  }

  const getNoZoomX = (x) => { return viewState.pixelOffsetX + (x * viewState.pixelScale) };

  const drawConnector = (ctx, largeSpacing) => {
    const rect = calculateRect(ctx, largeSpacing);
    // 填充矩形
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = getFontStyle(meaureTextSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    ctx.fillText(rect.text, centerX, centerY);
    // 绘制双向箭头
    if (largeSpacing){
      drawDoubleArrow(rect, ctx);
    } else {
      drawDistanceSelectionBox(ctx);
    }
    ctx.restore();
  };
  const drawDiffConnector = (ctx, largeSpacing) => {
    const rect = calculateDiffRect(largeSpacing);
    // 填充矩形
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
    ctx.beginPath();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = getFontStyle(meaureTextSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    ctx.fillText(rect.text, centerX, centerY);
    if(!largeSpacing){
      return;
    }
    // 绘制线水平实线部分
    ctx.beginPath();
    let {x: preX, y: preY, width: preWidth, height: preHeight} = renderInfo2pixelData(altClickData.preData.renderInfo);
    let {x: lastX, y: lastY} = renderInfo2pixelData(altClickData.lastData.renderInfo);
    const arrowLeftStartX = preX + preWidth;
    const leftLineWidth = lastX;
    const leftLineHeight = preY + preHeight / 2;
    ctx.moveTo(arrowLeftStartX, leftLineHeight ); 
    ctx.lineTo(leftLineWidth, leftLineHeight);
    ctx.strokeStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 左侧箭头头部
    const arrowSize = 8;
    ctx.beginPath();
    ctx.moveTo(arrowLeftStartX, preY + preHeight /2);
    ctx.lineTo(arrowLeftStartX + arrowSize, leftLineHeight - arrowSize / 2);
    ctx.lineTo(arrowLeftStartX + arrowSize, leftLineHeight + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.fill();
    // 垂直虚线部分（从水平线末端垂直延伸到第二个节点）
    ctx.beginPath();
    ctx.setLineDash([5, 3]);
    ctx.moveTo(leftLineWidth, preY + preHeight /2);
    ctx.lineTo(leftLineWidth, lastY + preHeight /2);
    ctx.strokeStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    // 右侧箭头头部
    ctx.beginPath();
    const arrowRightStartX = leftLineWidth;
    ctx.moveTo(arrowRightStartX, preY + preHeight /2);
    ctx.lineTo(arrowRightStartX - arrowSize, leftLineHeight - arrowSize / 2);
    ctx.lineTo(arrowRightStartX - arrowSize, leftLineHeight + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.fill();
    ctx.restore();
  };
  const drawDistanceSelectionBox = (ctx) =>{
    const {x: preX, y: preY, width: preWidth, height: preHeight } = renderInfo2pixelData(altClickData.preData.renderInfo);
    const {x: lastX} = renderInfo2pixelData(altClickData.lastData.renderInfo);
    // 填充矩形
    ctx.fillStyle = 'rgba(49, 122, 247, 0.4)';
    ctx.strokeStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.roundRect(preX + preWidth + 1, preY - 2, lastX - (preX + preWidth), preHeight + 4, 4);
    ctx.fill();
    ctx.stroke();
  };
  // 绘制双箭头
  const drawDoubleArrow = (rect, ctx) => {
    const arrowSize = 8;
  
    // 左侧箭头（指向左边）
    const actLeft = rect.leftX;
    const leftLineWidth = actLeft + arrowSize - 2;
    const { centerY } = rect;
    ctx.beginPath();
    ctx.moveTo(rect.x, centerY); 
    ctx.lineTo(leftLineWidth, centerY);
    ctx.strokeStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.lineWidth = 2;
    ctx.stroke();
  
    // 左侧箭头头部
    ctx.beginPath();
    ctx.moveTo(leftLineWidth - arrowSize / 2, centerY);
    ctx.lineTo(leftLineWidth - arrowSize / 2 + arrowSize, centerY - arrowSize / 2);
    ctx.lineTo(leftLineWidth - arrowSize / 2 + arrowSize, centerY + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.fill();
  
    // 右侧箭头（指向右边）
    const rightLineWidth = rect.rightX - arrowSize + 2;
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.width, centerY);
    ctx.lineTo(rightLineWidth, centerY);
    ctx.strokeStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.lineWidth = 2;
    ctx.stroke();
  
    // 右侧箭头头部
    ctx.beginPath();
    ctx.moveTo(rightLineWidth + arrowSize / 2, centerY);
    ctx.lineTo(rightLineWidth + arrowSize / 2 - arrowSize + 1, centerY - arrowSize / 2);
    ctx.lineTo(rightLineWidth + arrowSize / 2 - arrowSize + 1, centerY + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.fill();
  };


  // 计算矩形位置
  const calculateRect = (ctx, largeSpacing) => {
    let { x: preX, width: preWidth, y: preY, height: preHeight } = altClickData.preData.renderInfo;
    if(!largeSpacing){
      preY = preY < layout.threadHeight ? preY + layout.threadHeight : preY - layout.threadHeight;
      }
    let { x: lastX } = altClickData.lastData.renderInfo;
    lastX = getNoZoomX(lastX);
    const width = 40 * devicePixelRatio;
    const height = preHeight;
    const centerY = preY + height / 2;
    const text = getMeasureDistance(altClickData);
    const leftX = getNoZoomX(preX + preWidth);  // 连线左端点
    const rectX = leftX + (lastX - leftX - width) / 2;
    return {
      leftX: leftX,
      rightX: lastX,
      x: rectX,
      y: preY * devicePixelRatio,
      width: width,
      height: height * devicePixelRatio,
      centerX: rectX + (width / 2 - text.length) / 2,
      centerY: centerY * devicePixelRatio,
      textX: rectX + (width / 2 - text.length) / 2,
      textY: centerY * devicePixelRatio + 3,
      text: text,
      arrowWidth: (lastX - leftX - width - 6) / 2
    };
  };

const renderInfo2pixelData = (renderInfo) => {
  const {x, width, y, height} = renderInfo;
  return {
    x: getNoZoomX(x),
    width: width * viewState.pixelScale,
    y: y * devicePixelRatio,
    height: height * devicePixelRatio,
  };
};
  
  const calculateDiffRect = (largeSpacing) => {
    let { x: preX, width: preWidth, y: preY, height: preHeight } = renderInfo2pixelData(altClickData.preData.renderInfo);
    if (!largeSpacing) {
      preY = preY < layout.threadHeight ? preY + layout.threadHeight : preY - layout.threadHeight;
    }
    let { x: lastX} = altClickData.lastData.renderInfo;
    lastX = getNoZoomX(lastX);
    const width = 40 * devicePixelRatio;
    const height = preHeight;
    const centerY = preY + height / 2;
    const text = getMeasureDistance(altClickData);
    return {
      x: preX + preWidth + (lastX- (preX + preWidth)) / 2,
      y: preY + height,
      width: width,
      height: height,
      textX: preX + preWidth + (lastX- (preX + preWidth)) / 2 + (width / 2 - text.length) / 2,
      textY: centerY + height + 3,
      text: text,
    };
  };
  const getMeasureDistance = (altClickData) => {
    const time = Math.abs(altClickData.lastData.startTime - altClickData.preData.endTime);
    const timeInfo = formatTimeWithUnit(time);
    if(Number(timeInfo.value) === 0){
      return $t("lessThan0");
    }
    return timeInfo.value + timeInfo.unit;
  };
  const measureDistance = (event, processKey) => {
    handleDistanceMeasurement(event, processKey);
  }
  const measureDistanceZoom = (event, processKey) => {
    handleDistanceMeasurement(event, processKey, true);
  };
  const handleDistanceMeasurement = (event, processKey, isZoomMode = false) => {
    const uiCtx = getUIContext(processKey);
    const shouldClearDrawConnector = !isZoomMode && altClickData.preData && altClickData.lastData && (isMeasureFixed.value || !isMeasureFirst.value);
    if (shouldClearDrawConnector) {
      clearDrawConnector(uiCtx, processKey);
    }
    if (!isZoomMode) {
      if (!altClickData.preData) {
        altClickData.preData = event;
        isMeasureFirst.value = true;
      } else {
        if (isEqual(altClickData.preData, event) && !altClickData.lastData) { 
          return;
        }
        isMeasureFixed.value = true;
        altClickData.lastData = event;
      }
    }
    drawRoundedRect(uiCtx, event, processKey);
    if (isZoomMode && altClickData.preData) {
      drawRoundedRect(uiCtx, altClickData.preData, processKey);
    }
    calculateAndDrawConnection(uiCtx);
  };
  const getUIContext = (processKey) => {
    const uiCanvasRef = document.querySelector(`[data-ui-process-key="${processKey}"]`);
    return uiCanvasRef.getContext('2d');
  };
  const drawRoundedRect = (ctx, event, processKey) => {
    ctx.strokeStyle = isDarkTheme.value ? '#FFFFFF' : '#191919';
    ctx.lineWidth = 2 / viewState.scale;
    strokeRoundRect(ctx, event, processKey);
  };
  const calculateAndDrawConnection = (uiCtx) => {
    if (!altClickData.preData || !altClickData.lastData) {
      return;
    }
    const { renderInfo: preRenderInfo } = altClickData.preData;
    const { renderInfo: lastRenderInfo } = altClickData.lastData;
    const { x: preX, y: preY, width: preWidth} = preRenderInfo;
    const { x: lastDataX, y: lastDataY} = lastRenderInfo;
    const nodeSpacingX = Math.min(Math.abs(lastDataX - (preX + preWidth)), Math.abs(lastDataX - preX)) * viewState.scale;
    if (nodeSpacingX < 3) {
      return;
    }
    let largeSpacing = nodeSpacingX > nodeSpaceMin;
    if (lastDataX < preX) {
      let temp = altClickData.preData;
      altClickData.preData = altClickData.lastData;
      altClickData.lastData = temp;
    }
    // 同泳道
    if (lastDataY === preY) {
      drawConnector(uiCtx, largeSpacing);
    } else {
      largeSpacing = nodeSpacingX > 60;
      drawDiffConnector(uiCtx, largeSpacing);
    }
  };
  const measureDistanceHover = (event, processKey) => {
    const uiCanvasRef = document.querySelector(`[data-ui-process-key="${processKey}"]`);
    const uiCtx = uiCanvasRef.getContext('2d');
    if(altClickData.preData && altClickData.lastData){
      const { renderInfo: preRenderInfo } = altClickData.preData;
      const { renderInfo: lastRenderInfo } = altClickData.lastData;
      const { x: preX, y: preY, width: perWidth} = preRenderInfo;
      const { x: lastX, y: lastY} = lastRenderInfo;
      const nodeSpacingX = Math.min(Math.abs(lastX - (preX + perWidth)), Math.abs(lastX - preX)) * viewState.scale;
      if(nodeSpacingX < 3) return;
      let largeSpacing = nodeSpacingX > nodeSpaceMin;
      if(lastX < preX){
          let temp = altClickData.preData;
          altClickData.preData = altClickData.lastData;
          altClickData.lastData = temp;
          isMeasureChange.value = true;
      } else {
        isMeasureChange.value = false;
      }
      // 同泳道
      if(lastY === preY){
        drawConnector(uiCtx, largeSpacing);
      } else {
        largeSpacing = nodeSpacingX > 60;
        drawDiffConnector(uiCtx, largeSpacing);
      }
    }
  }
  const strokeRoundRect = (ctx, event, processKey) => {
    const { x, y, width, height } = event.renderInfo;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(getNoZoomX(x), y, width * viewState.scale, height);
    const temp = JSON.parse(JSON.stringify(event));
    const { fillColor, fontColor, strokeColor } = getEventColor(temp, true, true);
    temp.drawData.rectColor = fillColor;
    temp.drawData.strokeColor = strokeColor;
    temp.drawData.fontColor = fontColor;
    const { eventCtx } = ctxs[processKey];
    eventCtx.lineWidth = ctx.lineWidth;
    drawEvent([temp.drawData], eventCtx, false);
    drawEventText([temp.drawData], eventCtx, false);
    ctx.restore();
  }
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
    if (processx[1].expanded) {
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
}

const eraseEventLine = (flag) => {
  for (const processx of processes.entries()) {
    if (processx[1].expanded) {
      let canvasRef = document.querySelector(`[data-line-process-key="${processx[0]}"]`);
      if (flag === "over") {
        canvasRef = document.querySelector(`[data-hover-process-key="${processx[0]}"]`);
      }
      const ctx = canvasRef.getContext('2d');
      ctx.clearRect(0, 0, viewState.clearWidth, viewState.clearHeight);
    }
  }
}

const transformCanvas = ({ minX, maxX, startT, endT, minY }) => {
  const xRange = (maxX - minX) * viewState.pixelScale;
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
    rightmove(0 - eventLeftX);
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
    leftmove(hiddenWidth + scrollWidth);
    needRender = false;
  } else if (eventLeftX > actualMaxX) {
    // 整个被隐藏在视口之外
    leftmove((eventLeftX - canvasCSSWidth + eventWidth) + scrollWidth);
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

const handleOutline = (label, needTransform = true, needSendCom = ture, isLock = false) => {
  if (!label) {
    clearSelectionCanvas('data-three-column-process-key');
    transform();
    return;
  }
  points = [];
  drawColorDatas = {};
  let rootHashArray = [];
  const boundRange = { minX: Infinity, maxX: 0, startT: Infinity, endT: 0, minY: Infinity, maxY: 0 };
  processes.forEach((process, processKey) => {
    if (!process.expanded) {
      return;
    }
    highlightedPaths.clear();
    detailsPanelExpanded.value = false;
    selectEvent(null, props.processKey);
    drawColorDatas[processKey] = [];
    rootHashArray = [];
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
  boundaries = calcRowBoundaries(points);
  if (boundaries.length) {
    if (needTransform) {
      transformCanvas(boundRange);
    }
    processes.forEach((process, processKey) => {
      if (!process.expanded || (drawColorDatas[processKey] && !drawColorDatas[processKey].length)) {
        return;
      }
      changeNodeColor(processKey, true);
      const { eventCtx } = ctxs[processKey];
      drawColorDatas[processKey].forEach((event, eventKey) => {
        onSelectionEvent(event, eventCtx, processKey, false);
        const { args } = event ?? {};
        const eventHintStr = args?.['event-hint'] ?? '';
        const rootHashStr = getRootHashList(eventHintStr);
        rootHashArray.push(rootHashStr);
      });
      if (!isLockStatus.value && drawColorDatas[processKey].length) {
        const rootHashList = [...new Set(rootHashArray)];
        needSendCom && sendMsg('returnSemanticLabelFromSwimToCom', { label, rootHashList: rootHashList?.length ? rootHashList : [] });
        isLock && sendMsg('sendHashList', { rootHashList: rootHashList?.length ? rootHashList : [] });
      }
    });
    drawBoundary();
    toggleLock();
  } else {
    clearSelectionCanvas('data-three-column-process-key');
    selectEvent(null, props.processKey);
    if (!isLockStatus.value) {
      needSendCom && sendMsg('returnSemanticLabelFromSwimToCom', { label, rootHashList: [] });
      isLock && sendMsg('sendHashList', { rootHashList: [] });
    }
    return;
  }
};
window.ascEventBus.on('returnSemanticLabelFromCode', ({ label }) => {
  handleOutline(label);
});
window.ascEventBus.on('returnSemanticLabelFromCom', ({ label }) => {
  handleOutline(label, true, false);
});
window.ascEventBus.on('activeLock', ({ label }) => {
  handleOutline(label, false, true, true);
  isLockStatus.value = true;
});
window.ascEventBus.on('deactivateLock', () => {
  isLockStatus.value = false;
});
const sendMsg = (command, param) => {
  Promise.resolve().then(() => {
    window.ascEventBus.emit(command, param);
  });
};
const isPointInPolygonFun = (point, polygonBoundaries) => {
  if (!polygonBoundaries || polygonBoundaries.length === 0) {
    return false;
  }

  const [x, y] = point;

  // 构建边界多边形的所有顶点
  const polygonPoints = [];

  // 收集左边界点（从上到下）
  for (let i = 0; i < polygonBoundaries.length; i++) {
    for (let j = 0; j < polygonBoundaries[i].length; j++) {
      polygonPoints.push(polygonBoundaries[i][j].leftTop);
    }
  }
  polygonPoints.push(polygonBoundaries[polygonBoundaries.length - 1][polygonBoundaries[polygonBoundaries.length - 1].length - 1].leftBottom);

  // 收集右边界点（从下到上）
  for (let i = polygonBoundaries.length - 1; i >= 0; i--) {
    for (let j = polygonBoundaries[i].length - 1; j >= 0; j--) {
      polygonPoints.push(polygonBoundaries[i][j].rightBottom);
      polygonPoints.push(polygonBoundaries[i][j].rightTop);
    }
  }

  // 使用射线法判断点是否在多边形内
  let inside = false;
  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const [xi, yi] = polygonPoints[i];
    const [xj, yj] = polygonPoints[j];

    // 检查点是否在多边形边界上
    const pointsObj = {
      p1: { x: xi, y: yi },
      p2: { x: xj, y: yj },
      point: { x, y }
    };
    if (isPointOnVertex(pointsObj)) {
      return true;
    }

    // 射线法核心判断
    const intersect = ((yi > y) !== (yj > y)) && 
      (x < (((xj - xi) * (y - yi)) / (yj - yi)) + xi);
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
};

const isPointOnVertex = ({ p1, p2, point }) => {
  return (p1.x === point.x && p1.y === point.y) || (p2.x === point.x && p2.y === point.y);
};
addChildContext('threadEvent', {
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
  getEventColor,
  drawBoundary
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

onUnmounted(() => {
  throttledRender.cancel();
});
</script>

<style scoped>
@import url("../css/swimGraph/Processes/events.css");
</style>
  