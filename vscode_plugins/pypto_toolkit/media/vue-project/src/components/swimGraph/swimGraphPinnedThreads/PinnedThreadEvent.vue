<template>
  <div 
    ref="canvasContainerRef"
    class="pinned-thread-event-container"
    :style="{ height: containerHeight + 'px' }"
    @click="handleCanvasClick" 
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @wheel="handleWheel"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mouseenter="handleMouseEnter"
    @keydown="handleKeyDown" 
    @keyup="handleKeyUp"
    tabindex="0"
  >
    <!-- 事件层 -->
    <canvas ref="eventsCanvasRef" class="pinned-events-canvas"></canvas>
    <!-- 依赖层 -->
    <canvas ref="depCanvasRef" class="pinned-dep-canvas"></canvas>
    <!-- UI 层 -->
    <canvas ref="uiCanvasRef" class="pinned-ui-canvas"></canvas>
    <!-- Hover 层 -->
    <canvas ref="hoverCanvasRef" class="pinned-hover-canvas"></canvas>
    <!-- 连接线层 -->
    <canvas ref="lineCanvasRef" class="pinned-line-canvas"></canvas>
  </div>
</template>

<script setup>
import { ref, inject, onMounted, onUnmounted, watch, computed, provide, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { isEqual, throttle } from 'lodash-es';
import { devicePixelRatio, getThreadHeight, getDevicePixelRatio, 
          formatTimeWithUnit, COLOR_CFG, eventTextSize, getFontStyle, nodeSpaceMin } from '../swimGraphUtils';
import { EventRender } from '../swimGraphProcesses/render/eventRender';
import { getEventColor, getNoZoomX } from '../swimGraphProcesses/render/utils';
import { MeatureRender, altClickData, measureState } from '../swimGraphProcesses/render/meatureRender';

const { t: $t } = useI18n();

const { userConfig } = inject('swimGraphCfg');
const swimGraphState = inject('swimGraphState');
const { 
  viewState, 
  layout, 
  swimlaneContainer,
  isDarkTheme,
  lane2line,
  childContextMap,
  tooltip,
  tooltipStyle,
  selectedEvent,
  canvasclickedEvent,
  pathLockedEvent,
  isPathLockStatus,
  searchedEvent,
  timelineState,
  processes,
  highlightedPaths,
  timeLineX,
  detailsPanelExpanded
} = swimGraphState;

const { 
  flagRender,
  getDisplayName,
  handleWheel,
  selectEvent,
  setMeasureDragHeight,
  transform,
  drawNodeHeight
} = inject('swimGraphMethods');

const { pinnedThreadsList, pinnedMeasureInfo } = inject('swimGraphPinnedState');

let colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;

const canvasContainerRef = ref(null);
const eventsCanvasRef = ref(null);
const depCanvasRef = ref(null);
const uiCanvasRef = ref(null);
const hoverCanvasRef = ref(null);
const lineCanvasRef = ref(null);

let eventsCtx = null;
let depCtx = null;
let uiCtx = null;
let hoverCtx = null;
let lineCtx = null;

const eventRenderer = new EventRender({...swimGraphState, colorCfg, userConfig});
const measureRenderer = new MeatureRender({...swimGraphState, colorCfg, userConfig}, $t('lessThan0us'));

let hoveredEvent = ref(null);
let mousePosition = { x: 0, y: 0 };
let isPinnedCtrlDragging = false;
let pinnedCtrlDragStartX = 0;

// 计算容器高度
const containerHeight = computed(() => {
  let totalHeight = 0;
  for (const pinnedThread of pinnedThreadsList.value) {
    totalHeight += getThreadHeight(pinnedThread.processKey, pinnedThread.thread.tid, lane2line, layout, pinnedThread.thread.isCounter);
  }
  return totalHeight;
});

// 初始化所有 canvas
const pinnedInitCanvases = () => {
  if (!canvasContainerRef.value || !swimlaneContainer.value) {
    return;
  }
  
  const containerRect = swimlaneContainer.value.getBoundingClientRect();
  const eventWidth = containerRect.width - layout.processLabelWidth -layout.marginRight;
  const height = containerHeight.value;
  
  const canvases = [
    { canvasRef: eventsCanvasRef, ctx: 'eventsCtx' },
    { canvasRef: depCanvasRef, ctx: 'depCtx' },
    { canvasRef: uiCanvasRef, ctx: 'uiCtx' },
    { canvasRef: hoverCanvasRef, ctx: 'hoverCtx' },
    { canvasRef: lineCanvasRef, ctx: 'lineCtx' }
  ];
  
  canvases.forEach(({ canvasRef, ctx }) => {
    if (!canvasRef.value) {
      return;
    }
    
    // 设置 canvas 尺寸
    canvasRef.value.width = eventWidth * devicePixelRatio;
    canvasRef.value.height = height * devicePixelRatio;
    canvasRef.value.style.width = eventWidth + 'px';
    canvasRef.value.style.height = height + 'px';
    
    // 获取 context 并设置缩放
    const context = canvasRef.value.getContext('2d');
    context.scale(devicePixelRatio, devicePixelRatio);
    
    // 保存 context 引用
    if (ctx === 'eventsCtx') {
      eventsCtx = context;
    }
    if (ctx === 'depCtx') {
      depCtx = context;
    }
    if (ctx === 'uiCtx') {
      uiCtx = context;
    }
    if (ctx === 'hoverCtx') {
      hoverCtx = context;
    }
    if (ctx === 'lineCtx') {
      lineCtx = context;
    }
  });
};

// 清空所有 canvas
const clearCanvases = () => {
  if (!eventsCtx) {
    return;
  }
  
  const eventWidth = eventsCanvasRef.value.offsetWidth;
  const height = containerHeight.value;
  
  eventsCtx.clearRect(0, 0, eventWidth, height);
  depCtx.clearRect(0, 0, eventWidth, height);
  uiCtx.clearRect(0, 0, eventWidth, height);
  hoverCtx.clearRect(0, 0, eventWidth, height);
  lineCtx.clearRect(0, 0, eventWidth, height);
};

const clearEventCanvas = () => {
  if (!eventsCtx) {
    return;
  }
  const eventWidth = eventsCanvasRef.value.offsetWidth;
  const height = containerHeight.value;
  eventsCtx.clearRect(0, 0, eventWidth, height);
  depCtx.clearRect(0, 0, eventWidth, height);
};

// 清空测距画布
const clearPinnedMeasureCanvas = () => {
  hideMeasureInfo();
  if (!uiCtx) {
    return;
  }
  measureRenderer.clearDrawConnector(uiCtx);
  const eventWidth = eventsCanvasRef.value.offsetWidth;
  const height = containerHeight.value;
  uiCtx.clearRect(0, 0, eventWidth, height);
};

// 置顶区缩放
const transformPinned = () => {
  // canvas处理
  const ctxs = {
    events: eventsCtx,
    ui: uiCtx,
    hover: hoverCtx,
    line: lineCtx
  };

  for (const [key, ctx] of Object.entries(ctxs)) {
    if (!ctx) {
      continue;
    }
    ctx.save();
    ctx.setTransform(viewState.pixelScale, 0, 0, getDevicePixelRatio(), viewState.pixelOffsetX, 0);
  }
  if (!selectedEvent.value && !searchedEvent.value) {
    clearCanvases();
    pinnedThreadsList.value.forEach(item => {
      childContextMap.threadEvent.drawTransformEvent(item.thread, eventsCtx, true);
    });
    childContextMap.threadEvent.renderProcessText(pinnedThreadsList, eventsCtx, true);
    return;
  }
  changePinnedColor(true);
  highlightPinnedEvent(selectedEvent.value || searchedEvent.value);
};

const changePinnedColor = (isDimmed) => {
  clearEventCanvas();
  const drawDatas = [];
  for (const pinnedThread of pinnedThreadsList.value) {
    const { thread, processKey } = pinnedThread;
    for (const event of thread.events) {
      if (!event.renderInfo) {
        continue;
      }
      
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
  eventRenderer.drawEvent(drawDatas, eventsCtx, isDimmed, true);
  eventRenderer.drawEventText(drawDatas, eventsCtx, isDimmed, true);
};

const highlightPinnedEvent = (event, stroke=true, highlight=true) => {
  if (!event || !event.renderInfo) {
    return;
  }
  let threadPinned = false;
  const pinnedKey = `${event.pid}-${event.pid}-${event.tid}`;
  for (const pinnedThread of pinnedThreadsList.value) {
    const { processKey, threadKey, thread } = pinnedThread;
    if (thread.isCounter) {
      continue;
    }
    if (`${processKey}-${threadKey}` === pinnedKey) {
     threadPinned = true;
     break; 
    }
  }
  if (!threadPinned) {
    return;
  }
  const { renderInfo } = event;
  const { processKey, width } = renderInfo;
  const { fillColor, fontColor } = getEventColor(event, eventRenderer.deps, processKey, highlight, stroke);
  const drawData = {
    rectX: renderInfo.x,
    pinnedEventY: renderInfo.pinnedEventY,
    eventWidth: width,
    height: renderInfo.height,
    rectColor: fillColor,
    strokeColor: '',
    text: '',
    textX: 0,
    textY: 0,
    fontColor,
    show: true,
  };
  eventRenderer.drawEvent([drawData], depCtx, false, true);
  depCtx.font = getFontStyle(eventTextSize);
  const isAicpuProcess = Array.from(processes.entries()).some(([key, value]) => value.type === 'aicpu' && key === processKey);
  drawData.width = width;
  childContextMap.threadEvent.fillTextInfo(event, depCtx, drawData, true, isAicpuProcess);
  if (!drawData.text) { return };
  eventRenderer.drawEventText([drawData], depCtx, false, true);
};

// 渲染置顶线程事件
const pinnedRender = () => {
  if (!eventsCtx) {
    return;
  }
  clearCanvases();
  // 实现渲染逻辑
  let threadY = 0;
  pinnedThreadsList.value.forEach(item => {
    childContextMap.threadEvent.renderProcessPinEvents(item.thread, eventsCtx, threadY, item.processKey);
    const threadKey = item.thread.isCounter ? item.thread.threadName : item.thread.tid;
    const lineCount = lane2line.get(`${item.processKey}@${threadKey}`) || 1;
    threadY += layout.threadHeight * lineCount;
  });
  childContextMap.threadEvent.renderProcessText(pinnedThreadsList, eventsCtx, true);
  flagRender();
};

const drawPinnedThreadEventline = (x, color, flag) => {
  const devicePixelRatioVlaue = devicePixelRatio !== undefined ? devicePixelRatio : 1;
  const drawX = x * devicePixelRatioVlaue;
  const height = containerHeight.value * devicePixelRatioVlaue;
  let ctx = lineCtx;
  if (flag === 'over') {
    ctx = hoverCtx;
  }
  eventRenderer.drawFlagLine(ctx, color, drawX, height);
};

const erasePinnedThreadEventline = (flag) => {
  let ctx = lineCtx;
  if (flag === 'over') {
    ctx = hoverCtx;
  }
  const eventWidth = eventsCanvasRef.value.offsetWidth;
  const height = containerHeight.value;
  ctx.clearRect(0, 0, eventWidth, height);
};

const handleCanvasClick = (e) => {
  if (!canvasContainerRef.value) {
    return;
  }
  mousePosition = { x: e.clientX, y: e.clientY };
  const localPosition = computeLocalXY(canvasContainerRef.value, mousePosition);
  const { event } = findEventAtPosition(localPosition.x, localPosition.y);
  if (event && e.altKey) {
    highlightEvent(depCtx, event);
    measureRenderer.handleDistanceMeasurement(uiCtx, event, event.renderInfo?.processKey || event.pid.toString(), false, true);
    // 如果需要在上方显示测距信息
    if (!altClickData.largeSpacing && pinnedThreadsList.value.length === 1) {
      const rect = measureRenderer.calculateRect(altClickData.largeSpacing, true);
      showMeasureInfo(rect);
    }
  } else {
    measureState.isMeasureFirst = false;
    measureState.isMeasureFixed = false;
    measureState.isMeasureChange = false;
    clearPinnedMeasureCanvas();
  }
};

const highlightEvent = (ctx, event, stroke=true, highlight=true) => {
  if (!event || !event.renderInfo) {
    return;
  }
  const processKey = event.renderInfo?.processKey || event.pid.toString();
  const { renderInfo } = event;
  const { fillColor, fontColor } = getEventColor(event, eventRenderer.deps, processKey, highlight, stroke);
  const { width, pinnedEventY, x, height } = renderInfo;
  const drawData = {
    rectX: x, rectY: pinnedEventY,
    rectPixelX: x * devicePixelRatio, rectPixelY: pinnedEventY * devicePixelRatio,
    eventWidth: width, height,
    rectColor: fillColor, strokeColor: '', text: '', textX: 0, textY: 0,
    fontColor, show: true,
  };
  eventRenderer.drawEvent([drawData], ctx);
  ctx.font = getFontStyle(eventTextSize);
  const isAicpuProcess = Array.from(processes.entries()).some(([key, value]) => value.type === 'aicpu' && key === processKey);
  drawData.width = width;
  childContextMap.threadEvent.fillTextInfo(event, ctx, drawData, true, isAicpuProcess);
  if (!drawData.text) { return };
  eventRenderer.drawEventText([drawData], ctx);
};

const findEventAtPosition = (x, y) => {
  let processObj = {
    event: null,
    mData: {
      preData: null, // 鼠标位置左侧的节点
      lastData: null, // 鼠标位置右侧的节点
      nodeSpacingX: 0, // 左右节点的x坐标间隙
    },
  };
  let threadY = 0;
  for (const pinnedThread of pinnedThreadsList.value) {
    const { thread, processKey } = pinnedThread;
    const threadKey = thread.isCounter ? thread.threadName : thread.tid;
    const lineCount = lane2line.get(`${processKey}@${threadKey}`) || 1;
    const threadHeight = layout.threadHeight * lineCount;
    
    if (y >= threadY && y <= threadY + threadHeight) {
      for (let index = 0; index < thread.events.length; index++) {
        const event = thread.events[index];
        if (!event.renderInfo) {
          continue;
        }
        
        const eventX = event.renderInfo.x;
        const eventY = event.renderInfo.pinnedEventY;
        const eventWidth = event.drawData?.eventWidth || 0;
        const eventHeight = event.renderInfo.height || layout.eventHeight;
        
        const validateX = x >= eventX && x <= eventX + eventWidth;
        const validateY = y >= eventY && y <= eventY + eventHeight;
        if (validateX && validateY) {
          processObj.event = event;
          return processObj;
        }
        if (!validateY) {
          continue;
        }
        const nextEvent = thread.events[index + 1];
        if (!nextEvent) {
          continue;
        }
        const { x: nextEventX } = nextEvent.renderInfo;
        if (x >= eventX + eventWidth && x <= nextEventX) {
          processObj.mData = {
            preData: event,
            lastData: nextEvent,
            nodeSpacingX: nextEventX - (eventX + eventWidth),
          };
          return processObj;
        }
      }
    }
    threadY += threadHeight;
  }
  return processObj;
};

const drawHoverHighlight = (event) => {
  if (!hoverCtx) {
    return;
  }
  
  hoverCtx.clearRect(0, 0, eventsCanvasRef.value.offsetWidth, containerHeight.value);
  
  if (!event || !event.renderInfo) {
    return;
  }
  
  const processKey = String(event.pid);
  const thread = pinnedThreadsList.value.find(p => p.processKey == processKey)?.thread;
  if (!thread) {
    return;
  }
  
  let threadY = 0;
  for (const pinnedThread of pinnedThreadsList.value) {
    if (pinnedThread.processKey == processKey) {
      break;
    }
    const t = pinnedThread.thread;
    const tk = t.isCounter ? t.threadName : t.tid;
    const lc = lane2line.get(`${pinnedThread.processKey}@${tk}`) || 1;
    threadY += layout.threadHeight * lc;
  }
  
  const { renderInfo } = event;
  const { fillColor, fontColor } = getEventColor(event, {...swimGraphState, userConfig, colorCfg}, processKey, true, true);
  const { width } = renderInfo;
  const pinnedEventY = renderInfo.pinnedEventY || 0;
  const drawData = {
    rectX: renderInfo.x, 
    pinnedEventY,
    rectPixelX: renderInfo.x * devicePixelRatio, 
    rectPixelY: pinnedEventY * devicePixelRatio,
    eventWidth: width, 
    height: renderInfo.height,
    rectColor: fillColor, 
    strokeColor: '', 
    text: '', 
    textX: 0, 
    textY: 0,
    fontColor, 
    show: true,
  };
  
  eventRenderer.drawEvent([drawData], hoverCtx, false, true);
  
  const { scale, offsetX, canvasCssWidth } = viewState;
  const absOffsetX = Math.abs(offsetX);
  
  const rectStartX = drawData.rectX * scale;
  const rectEndX = rectStartX + (drawData.eventWidth * scale);
  
  const visibleStartX = Math.max(rectStartX, absOffsetX);
  const visibleEndX = Math.min(rectEndX, absOffsetX + canvasCssWidth);
  const actualWidth = Math.max(0, visibleEndX - visibleStartX);
  
  if (actualWidth >= 15) {
    const actualPixWidth = actualWidth * devicePixelRatio;
    const displayName = event.isCounter ? event.displayName : getDisplayName(event);
    
    hoverCtx.font = getFontStyle(eventTextSize);
    let textWidth = hoverCtx.measureText(displayName).width;
    
    let displayText = '';
    if (textWidth > actualPixWidth) {
      const widthPerChar = textWidth / displayName.length;
      let maxCharsToFit = Math.floor(actualPixWidth / widthPerChar);
      if (maxCharsToFit > 3) {
        maxCharsToFit -= 3;
        displayText = displayName.substr(0, maxCharsToFit) + '...';
        textWidth = widthPerChar * displayText.length;
      } else {
        displayText = '';
      }
    } else {
      displayText = displayName;
    }
    
    if (displayText) {
      const visibleRectXOnScreen = visibleStartX - absOffsetX;
      const textStartX = (visibleRectXOnScreen * devicePixelRatio) + ((actualPixWidth - textWidth) / 2);
      const textY = ( pinnedEventY * devicePixelRatio) + eventTextSize;
      
      hoverCtx.save();
      hoverCtx.setTransform(1, 0, 0, 1, 0, 0);
      hoverCtx.fillStyle = fontColor;
      hoverCtx.fillText(displayText, textStartX, textY);
      hoverCtx.restore();
    }
  }
};

const showTooltip = (e, event) => {
  if (!tooltip.value) {
    return;
  }
  
  const displayName = event.isCounter ? event.displayName : (getDisplayName(event) || 'Event');
  let tooltipContent = `<div class="tooltip-container">`;
  tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t('title')}</span><span class="tooltip-value">${displayName}</span></div>`;
  tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t('start')}</span><span class="tooltip-value">${formatTimeWithUnit(event.startTime - viewState.minTime).value}${formatTimeWithUnit(event.startTime - viewState.minTime).unit}</span></div>`;
  if (event.isCounter) {
    tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t('countValue')}</span><span class="tooltip-value">${event.counterSize}</span></div>`;
  } else {
    tooltipContent += `<div class="tooltip-item"><span class="tooltip-key">${$t('duration')}</span><span class="tooltip-value">${formatTimeWithUnit(event.duration).value}${formatTimeWithUnit(event.duration).unit}</span></div>`;
  }
  tooltipContent += '</div>';
  
  tooltip.value.innerHTML = tooltipContent;
  tooltipStyle.display = 'block';
  
  const canvasCSSWidth = viewState.canvasCssWidth;
  if (e.clientX + 200 > canvasCSSWidth) {
    tooltipStyle.left = (e.clientX - 100) + 'px';
  } else {
    tooltipStyle.left = (e.clientX + 10) + 'px';
  }
  tooltipStyle.top = (e.clientY + 10) + 'px';
};

const hideTooltip = () => {
  tooltipStyle.display = 'none';
};

const computeLocalXY = (canvasRef, mousePos) => {
  const rect = canvasRef.getBoundingClientRect();
  const x = (mousePos.x - rect.left - viewState.offsetX) / viewState.scale;
  const y = mousePos.y - rect.top;
  return { x, y };
};

const handleTooltipAndCursor = (e, event) => {
  let cursor = '';
  const isNoModifierKey = !e.altKey && !e.ctrlKey;
  const isUnlock = !isPathLockStatus.value;
  if (event && isNoModifierKey && isUnlock) {
    showTooltip(e, event);
    cursor = 'pointer';
  } else {
    hideTooltip();
  }
  return cursor;
};

const updateCursorState = (e, event) => {
  const cursor = handleTooltipAndCursor(e, event) || '';
  canvasContainerRef.value.style.cursor = cursor;
};

const handlePureMove = (mData, event) => {
  const { preData, lastData, nodeSpacingX } = mData || {};
  if (event !== hoveredEvent.value) {
    hoveredEvent.value = event;
    drawHoverHighlight(event);
  }
  const validateMData = preData && lastData && nodeSpacingX;
  if (validateMData && !measureState.isMeasureFixed) {
    maybeDrawConnectorPreview(preData, lastData, nodeSpacingX); // 自动测距
  }
};

function maybeDrawConnectorPreview(preData, lastData, nodeSpacingX) {
  const scrollWidth = 0;
  const actSpacingX = nodeSpacingX * viewState.pixelScale;
  if (actSpacingX <= 3) { 
    return;
  }
  const { canvasWidth } = viewState;
  const noZoomLastX = getNoZoomX(lastData?.renderInfo?.x, viewState);
  const noZoomPreX = getNoZoomX(preData?.renderInfo?.x, viewState) + (preData?.renderInfo?.width * viewState.pixelScale);
  if (noZoomLastX < (canvasWidth - scrollWidth) && noZoomPreX > 0 ) {
    altClickData.preData = preData;
    altClickData.lastData = lastData;
    altClickData.largeSpacing = actSpacingX > nodeSpaceMin;
    measureRenderer.drawConnector(uiCtx, altClickData.largeSpacing, true);
    // 如果需要在上方显示测距信息
    if (!altClickData.largeSpacing && pinnedThreadsList.value.length === 1) {
      const rect = measureRenderer.calculateRect(altClickData.largeSpacing, true);
      showMeasureInfo(rect);
    }
  }
}

const showMeasureInfo = (rect) => {
  if (!canvasContainerRef.value) {
    return;
  }
  const containerRect = canvasContainerRef.value.getBoundingClientRect();
  pinnedMeasureInfo.show = true;
  pinnedMeasureInfo.x = containerRect.left + (rect.x / devicePixelRatio);
  pinnedMeasureInfo.y = 98;
  pinnedMeasureInfo.text = rect.text;
};

const hideMeasureInfo = () => {
  pinnedMeasureInfo.show = false;
};

const handleMouseMove = throttle((e) => {
  if (!canvasContainerRef.value) {
    return;
  }
  
  if (e.ctrlKey && e.buttons === 1 && isPinnedCtrlDragging) {
    handleCtrlDrag(e);
    return;
  }
  
  mousePosition = { x: e.clientX, y: e.clientY };
  const localPosition = computeLocalXY(canvasContainerRef.value, mousePosition);
  const { event, mData } = findEventAtPosition(localPosition.x, localPosition.y);
  const validateClickData = altClickData.preData && altClickData.lastData;
  if (validateClickData && !e.altKey && !measureState.isMeasureFixed) {
    clearPinnedMeasureCanvas();
  }
  if (e.altKey) {
    handleAltMove(e, event);
  } else if (e.ctrlKey) {
    dispatchEventToFirstEventsCanvas('mousemove', e);
  } else {
    handlePureMove(mData, event);
  }
  
  updateCursorState(e, event);
}, 80);

const handleCtrlDrag = (e) => {
  if (viewState.scale === 1) {
      return;
    }
    const timeLineEndX = Math.abs(timeLineX.value);
    const deltaX = e.clientX - pinnedCtrlDragStartX;
    const cssWidth = viewState.canvasCssWidth;
    if (deltaX < 0 && cssWidth > timeLineEndX) {
      return;
    }
    canvasContainerRef.value.style.cursor = 'grab';
    viewState.offsetX += childContextMap.threadEvent.getOffset(deltaX, viewState.scale);
    if (deltaX > 0 && viewState.offsetX > 0) {
      viewState.offsetX = 0;
    }
    viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
    transform();
    pinnedCtrlDragStartX = e.clientX;
};

const handleAltMove = (e, event) => {
  handleAltMeasureHoverBranch(e, event);
};

function handleAltMeasureHoverBranch(e, event) {
  const manual = altClickData.preData && measureState.isMeasureFirst && !measureState.isMeasureFixed;
  if (!(event && e.altKey && manual)) {
    return false;
  }
  if (measureState.isMeasureChange && altClickData.lastData) {
    let temp = altClickData.preData;
    altClickData.preData = altClickData.lastData;
    altClickData.lastData = temp;
    measureState.isMeasureChange = false;
  }
  if (isEqual(altClickData.preData, event)) {
    return true; // consumed
  }
  altClickData.lastData = event;
  measureRenderer.clearDrawConnectorHover(uiCtx, event.renderInfo?.processKey || event.pid.toString(), true);
  measureRenderer.measureDistanceHover(uiCtx, true);
  return false;
}

const handleMouseLeave = () => {
  hoveredEvent.value = null;
  drawHoverHighlight(null);
  hideTooltip();
};

const getFirstEventsCanvas = () => {
  const canvas = document.querySelector('.events-canvas');
  return canvas;
};

const dispatchEventToFirstEventsCanvas = (eventType, event) => {
  const canvas = getFirstEventsCanvas();
  if (!canvas || event.altKey) {
    return;
  }
  
  const pinnedRect = canvasContainerRef.value.getBoundingClientRect();
  const targetRect = canvas.getBoundingClientRect();
  
  const relativeX = event.clientX - pinnedRect.left;
  
  const newEvent = new MouseEvent(eventType, {
    clientX: targetRect.left + relativeX,
    clientY: 10,  // mock 位置纵坐标为固定值，防止置顶泳道y坐标比分配的canvas长度大
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    buttons: event.buttons,
    deltaY: event.deltaY,
    deltaX: event.deltaX,
    bubbles: true,
    cancelable: true
  });
  
  canvas.dispatchEvent(newEvent);
};

const handleMouseDown = (e) => {
  if (!canvasContainerRef.value || e.altKey) {
    return;
  }
  if (e.ctrlKey && e.buttons === 1) {
    isPinnedCtrlDragging = true;
    pinnedCtrlDragStartX = e.clientX;
    return;
  }
  
  mousePosition = { x: e.clientX, y: e.clientY };
  const localPosition = computeLocalXY(canvasContainerRef.value, mousePosition);
  const { event } = findEventAtPosition(localPosition.x, localPosition.y);
  canvasclickedEvent.value = event;
  if (event) {
    if (isPathLockStatus.value) {
      selectedEvent.value = event;
      detailsPanelExpanded.value = true;
      drawHoverHighlight(event);
      childContextMap.threadEvent.changeNodeColor(event.renderInfo?.processKey || event.pid.toString());
      drawNodeHeight(event, event.renderInfo?.processKey || event.pid.toString());
      selectEvent(event, event.renderInfo?.processKey || event.pid.toString());
      return;
    }
    selectEvent(event, event.renderInfo?.processKey || event.pid.toString());
    pathLockedEvent.value = event;
  } else {
    highlightedPaths.clear();
    for (const [processKey, process] of processes.entries()) {
      if (process.isRendered) {
        selectEvent(null, processKey);
      } 
    }
  }
};

const handleMouseUp = (e) => {
  if (isPinnedCtrlDragging) {
    isPinnedCtrlDragging = false;
    return;
  }
  dispatchEventToFirstEventsCanvas('mouseup', e);
};

const handleMouseEnter = (e) => {
  canvasContainerRef.value?.focus();
};

const handleKeyDown = (e) => { 
  dispatchKeyEventToFirstEventsCanvas('keydown', e); 
  e.stopPropagation();
}; 
 
const handleKeyUp = (e) => { 
  dispatchKeyEventToFirstEventsCanvas('keyup', e); 
  e.stopPropagation();
};

const dispatchKeyEventToFirstEventsCanvas = (eventType, event) => { 
  const canvas = getFirstEventsCanvas(); 
  if (!canvas) { 
    return; 
  } 
  
  const targetRect = canvas.getBoundingClientRect(); 
  
  const mouseMoveEvent = new MouseEvent('mousemove', { 
    clientX: mousePosition.x, 
    clientY: 10 + targetRect.top, 
    bubbles: true, 
    cancelable: true 
  }); 
  
  canvas.dispatchEvent(mouseMoveEvent); 
  
  const newEvent = new KeyboardEvent(eventType, { 
    key: event.key, 
    code: event.code, 
    keyCode: event.keyCode, 
    ctrlKey: event.ctrlKey, 
    altKey: event.altKey, 
    shiftKey: event.shiftKey, 
    metaKey: event.metaKey, 
    bubbles: true, 
    cancelable: true 
  }); 
  
  canvas.dispatchEvent(newEvent); 
  if (eventType === 'keyup') { 
    const mouseLeaveEvent = new MouseEvent('mouseleave', { 
      bubbles: true, 
      cancelable: true 
    }); 
    
    canvas.dispatchEvent(mouseLeaveEvent); 
  } 
};

onMounted(() => {
  pinnedInitCanvases();
  pinnedRender();
});

// 监听容器高度变化，重新初始化canvas
watch(containerHeight, () => {
  pinnedInitCanvases();
  pinnedRender();
  setMeasureDragHeight();
});

onUnmounted(() => {
  // 清理资源
});

defineExpose ({
  transformPinned,
  drawPinnedThreadEventline,
  erasePinnedThreadEventline,
  pinnedInitCanvases,
  pinnedRender,
  changePinnedColor,
  highlightPinnedEvent,
});

</script>

<style scoped>
.pinned-measure-info {
  position: absolute;
}
.pinned-thread-event-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  outline: none;
}

.pinned-thread-event-container:focus {
  outline: none;
}

.pinned-thread-event-container canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
