<template>
  <div class="thread-events" :data-process-container="process.key">
    <canvas 
      class="events-canvas" 
      :data-process-key="processKey"
      @click="handleCanvasClick" 
      @mousemove="handleMouseMove"
      @mouseleave="hideTooltip"
      @mousedown="handleMouseDown" 
      @mouseup="handleMouseUp"
      @wheel="handleWheel"
    ></canvas>
    <canvas class="ui-events-canvas" :data-ui-process-key="process.key"></canvas>
    <canvas class="dependency-events-canvas" :data-dep-process-key="process.key"></canvas>
    <canvas class="hover-events-canvas" :data-hover-process-key="process.key"></canvas>
    <canvas class="background-events-canvas" :data-background-process-key="process.key"></canvas>
    <canvas class="line-events-canvas" :data-line-process-key="process.key"></canvas>
  </div>
</template>
  
<script setup>
import { useI18n } from 'vue-i18n';
import { inject, onMounted, onUnmounted, watch, ref } from 'vue';
import { COLOR_CFG, DEP_MODE, ctxs, drawArrow, formatTimeWithUnit, getFontStyle, updateProcessSize, getCanvasCSSHeight} from '../swimGraphUtils';
import { isEqual, throttle } from 'lodash-es';

const { isDarkTheme } = inject('root');
const eventTextSize = 12;
const { t: $t } = useI18n();
const canvasclickedEvent = ref(null);
const curThread = inject('curThread');

const getActiveEventCanvas = (processKey) => {
  return document.querySelector(`[data-process-key="${processKey}"]`);
};

// 注入父组件提供的状态和方法
const {
  layout,
  selectedEvent,
  highlightedPaths,
  swimlaneContainer,
  lane2line,
  viewState,
  processedEvents,
  detailsPanelExpanded,
  timeLineX,
  sliderValue,
  sliderMax,
  initialScale,
  tooltip,
  tooltipStyle,
  timelineState,
  processes,
} = inject('swimGraphState');

const {
  findEventAtPosition,
  selectEvent,
  timeToX,
  handleWheel,
  leftmove,
  rightmove,
  durationToWidth,
  renderEvent,
  render,
} = inject('swimGraphMethods');

const { addChildContext } = inject('swimGraphContext');
const { userConfig } = inject('swimGraphCfg');
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
let lastX;
let altClickData = {
    preData: null,
    lastData: null,
    largeSpacing: false
};
// 手动测距，点击第一个节点
let isMeasureFirst = ref(false);
// 手动测距，点击第二个节点 ，此时的测距需要保留
let isMeasureFixed = ref(false);
// 手动测距，是否交换
let isMeasureChange = ref(false);
const handleCanvasClick = (e) => {
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) {
    console.warn(`Canvas for process ${props.processKey} not found during click handling`);
    return;
  }

  if (e.ctrlKey) {
    // 拖动画布中
    return;
  }

  const rect = canvasRef.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 检查是否点击了事件
  const clickedEvent = findEventAtPosition(x, y, props.processKey)?.event;
  canvasclickedEvent.value = clickedEvent;
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
  render();
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
  const scaleChange = viewState.scale / oldScale;
  viewState.offsetX = mouseX - (mouseX - viewState.offsetX) * scaleChange;
  const timeLineEndX = Math.abs(timeLineX.value);
  const cssWidth = viewState.canvasCssWidth;
  if (cssWidth > timeLineEndX){
    const tempOffsetX = cssWidth - timeLineEndX;
    viewState.offsetX += tempOffsetX;
  }
  if (viewState.offsetX > 0) {
    viewState.offsetX = 0;
  }

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
  const key = event.key.toLowerCase();
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) return;
  const rect = canvasRef.getBoundingClientRect();
  const mouseX = mousePosition?.x - rect.left;
  const mouseY = mousePosition?.y - rect.top;
  const canvasCSSWidth = viewState.canvasCssWidth;
  const canvasCSSHeight = getCanvasCSSHeight(canvasRef);
  // 由于每个process都会走一遍这个keydown事件，当鼠标不在当前画布时，mouseX和mouseY就是空
  if (!mouseX || !mouseY || mouseX < 0 || mouseY < 0 || mouseX > canvasCSSWidth || mouseY > canvasCSSHeight) {
    return;
  }
  switch(true) {
    case matchKey(key, userConfig?.value.ZoomInShortcut):
      scaleCanvas(mouseX, 1 + scaleStep);
      scaleStep += scaleStepIncrement;
      break;
    case matchKey(key, userConfig?.value.ZoomOutShortcut):
      scaleCanvas(mouseX, 1 - scaleStep);
      scaleStep += scaleStepIncrement;
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

const handleMouseMove = throttle((e) => {
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef) return;
  const uiCanvasRef = document.querySelector(`[data-ui-process-key="${props.processKey}"]`);
  if (!uiCanvasRef) return;
  const uiCtx = uiCanvasRef.getContext('2d');
  const hoverCanvasRef = document.querySelector(`[data-hover-process-key="${props.processKey}"]`);
  if (!hoverCanvasRef) return;
  const backgroundCanvasRef = document.querySelector(`[data-background-process-key="${props.processKey}"]`);
  if (!backgroundCanvasRef) return;
  const lineCanvasRef = document.querySelector(`[data-line-process-key="${props.processKey}"]`);
  if (!lineCanvasRef) return;
  const backgroundCanvasCtx = backgroundCanvasRef.getContext('2d');
  if(altClickData.preData && altClickData.lastData && !e.altKey && !isMeasureFixed.value){
    clearDrawConnector(uiCtx, props.processKey);
  }
  mousePosition = {
    x: e.clientX,
    y: e.clientY
  };
  const rect = canvasRef.getBoundingClientRect();
  const x = mousePosition.x - rect.left;
  const y = mousePosition.y - rect.top;

  const info = findEventAtPosition(x, y, props.processKey);
  const hoveredEvent = info?.event;
  const altClickDataTemp = info?.altClickData;
  const divElement = document.getElementsByClassName('swimlane-container');
  const scrollWidth = divElement[0].offsetWidth - divElement[0].clientWidth; // 滚动条的宽度
  const {preData , lastData, nodeSpacingX} = altClickDataTemp;

  //highlight thread when hovered
  if (y > 0 && y < backgroundCanvasRef.offsetHeight - 1){
    let threadY = 0;
    let threadId = 0;
    let curY = 0;
    let curId = 0;
    let curHeight = 0;
    for (const [threadKey, thread] of props.process.threads.entries()) {
      if (y <= threadY){
        break;
      }
      curY = threadY;
      curId = threadId;
      curHeight = layout.threadHeight * (lane2line.get(`${props.processKey}@${thread.tid}`) || 1);
      threadY += thread.isCounter ? layout.counterHeight : curHeight;
      threadId++;
    }
    let hoverId = `${props.processKey}-${curId}`;
    if (hoverId != curThread.value) {
      curThread.value = hoverId;
      backgroundCanvasCtx.clearRect(0, 0, viewState.canvasCssWidth, backgroundCanvasRef.offsetHeight);
      backgroundCanvasCtx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
      backgroundCanvasCtx.fillRect(0, curY, viewState.canvasCssWidth, curHeight);
    } 
  }
  if(!e.altKey){
      isMeasureFirst.value = false;
  }

  if(hoveredEvent && e.altKey && altClickData.preData && isMeasureFirst.value && !isMeasureFixed.value){
    if(isMeasureChange.value && altClickData.lastData){
      let temp = altClickData.preData;
      altClickData.preData = altClickData.lastData;
      altClickData.lastData = temp;
      isMeasureChange.value = false;
    }
    if(isEqual(altClickData.preData, hoveredEvent)){
      return;
    }
    altClickData.lastData = hoveredEvent;
    clearDrawConnectorHover(uiCtx, props.processKey);
    measureDistanceHover(hoveredEvent, props.processKey);
  }
  if(!e.altKey){
    onHoverEvent(hoveredEvent);
  }
  if (preData && lastData && !e.altKey && !e.ctrlKey && nodeSpacingX > 3 && !isMeasureFixed.value) {
    const canvasCSSWidth = viewState.canvasCssWidth;
    if(lastData?.renderInfo?.x < (canvasCSSWidth - scrollWidth) && preData?.renderInfo?.x + preData?.renderInfo?.width > 0 ){
      altClickData = {
      preData: preData,
      lastData: lastData,
      largeSpacing: nodeSpacingX > nodeSpaceMin
      };
      drawConnector(uiCtx, altClickData.largeSpacing);
    }
  }
  let cursor = '';
  if (hoveredEvent && !e.altKey && !e.ctrlKey) {
    showTooltip(e, hoveredEvent, canvasRef);
    cursor = 'pointer';
  } else {
    hideTooltip();
  }

  if (e.ctrlKey && e.buttons === 1) {
    cursor = 'grab';
    if (viewState.scale === 1) return;
    const timeLineEndX = Math.abs(timeLineX.value);
    const deltaX = (e.clientX - lastX);
    const cssWidth = viewState.canvasCssWidth;
    if (deltaX < 0 && cssWidth > timeLineEndX) {
      canvasRef.style.cursor = 'grab';
      return;
    }
    viewState.offsetX += getOffset(deltaX, viewState.scale);
    if (deltaX > 0 && viewState.offsetX > 0) {
      viewState.offsetX = 0;
    }
    render();
  }
  canvasRef.style.cursor = cursor;
}, 16);

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
  if (!canvasRef) return;
  const ctx = canvasRef.getContext('2d');

  if (hoveredEvent) {
    ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    highlightEvent(ctx, hoveredEvent, props.processKey, false);
  } else {
    ctx.clearRect(0, 0, viewState.canvasCssWidth, canvasRef.offsetHeight);
  }
}

const handleMouseDown = (e) => {
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!e.ctrlKey || !canvasRef) return;
  lastX = e.clientX;
};

const getCanvasHeight = () => {
  let height = 0;
  for (const [threadKey, thread] of props.process.threads.entries()) {
    const label = `${props.processKey}@${thread.tid}`;
    const lineCount = lane2line.get(label) || 1;
    height += layout.threadHeight * lineCount;
  }
  return height;
};

const resizeCanvas = () => {
  const canvasRef = getActiveEventCanvas(props.processKey);
  if (!canvasRef || !swimlaneContainer.value) return;

  const containerRect = swimlaneContainer.value.getBoundingClientRect();
  updateProcessSize(props.process, props.processKey, containerRect, layout, lane2line, viewState);
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

  const offsetHeight = canvasRef.offsetHeight;
  for (const ctx of Object.values(ctxs[processKey])) {
    if (ctx) {
      ctx.clearRect(0, 0, viewState.canvasCssWidth, offsetHeight);
    }
  }

  drawThreads(process, processKey, eventCtx);

  //绘制高亮
  if (curThread.value != '') {
    const curProcess = curThread.value.split('-')[0];
    const curLane = parseInt(curThread.value.split('-')[1]);
    if (curProcess == processKey) {
      let curY = 0;
      let curHeight = 0;
      const threads = [];
      for (const [threadKey, thread] of process.threads.entries()) {
        threads.push(thread);
      }

      for (let index = 0; index < threads.length; index++) {
        let thread = threads[index];
        curHeight = layout.threadHeight * (lane2line.get(`${processKey}@${thread.tid}`) || 1);
        if (index >= curLane) break;
        curY += thread.isCounter ? layout.counterHeight : curHeight;
      }
      backgroundCtx.clearRect(0, 0, viewState.canvasCssWidth, offsetHeight);
      backgroundCtx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
      backgroundCtx.fillRect(0, curY, viewState.canvasCssWidth, curHeight);
    }
  }
  drawThreadSeparators(eventCtx, process, processKey);
}

const drawThreads = (process, processKey, ctx) => {
  let threadY = 0;
  for (const [threadKey, thread] of process.threads.entries()) {
    if (thread.isCounter) {
      drawCounterThread(thread, ctx, threadY);
    } else {
      drawEventThread(thread, ctx, threadY);
    }
    threadY += thread.isCounter ? layout.counterHeight : layout.threadHeight * (lane2line.get(`${processKey}@${thread.tid}`) || 1);
  }
};

const changeNodeColor = (processKey, isDimmed) => {
  if (!processKey) return;
  const { eventCtx } = ctxs[processKey];
  let threadY = 0;
  const drawDatas = [];
  const process = processes.get(processKey);
  for (const [threadKey, thread] of process.threads.entries()) {
    if (thread.isCounter) {
      break; // 因为counter总是在最下方，不需要重绘，所以可以提前结束
    }
    for (const event of thread.events) {
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

    threadY += thread.isCounter ? layout.counterHeight : layout.threadHeight * (lane2line.get(`${processKey}@${thread.tid}`) || 1);
  }

  eventCtx.clearRect(0, 0, viewState.canvasCssWidth, threadY);
  drawEvent(drawDatas, eventCtx, isDimmed);
};

const clearDependencyLines = (processKey) => {
  const dependencyCanvasRef = document.querySelector(`[data-dep-process-key="${processKey}"]`);
  if (!dependencyCanvasRef) return false;
  
  const dependencyCtx = dependencyCanvasRef.getContext('2d');
  dependencyCtx.clearRect(0, 0, dependencyCanvasRef.width, dependencyCanvasRef.height);
  return dependencyCtx;
};

// 在依赖线画布上绘制依赖连接线
const drawDependencyLines = (process, processKey, mode) => {
  const dependencyCtx = clearDependencyLines(processKey);
  if (!dependencyCtx) {
    return;
  }
  
  if (!selectedEvent.value || highlightedPaths.size === 0) {
    return;
  }
  dependencyCtx.lineWidth = 1;

  const eventMap = new Map();
  processedEvents.value.forEach(event => {
    eventMap.set(event.id, event);
  });

  // 获取所有在路径中的相关节点（祖先 + 自身 + 子孙）
  const allRelevantIds = new Set(Array.from(highlightedPaths));

  // 遍历当前进程中的所有事件，绘制依赖线
  const selectStartTime = selectedEvent.value.startTime;
  const selectEndTime = selectedEvent.value.endTime;
  for (const [threadKey, thread] of process.threads.entries()) {
    for (const event of thread.events) {
      if (!allRelevantIds.has(event.id)) continue;
      const needDrawSuccessor = event.startTime >= selectEndTime || event.id === selectedEvent.value.id;
      const needDrawPredecessor = event.endTime <= selectStartTime || event.id === selectedEvent.value.id;
      if (needDrawSuccessor && (mode === DEP_MODE.all || mode === DEP_MODE.next)) {
        drawSuccessor(event, eventMap, dependencyCtx);
      }
      if (needDrawPredecessor && (mode === DEP_MODE.all || mode === DEP_MODE.pre)) {
        drawPredecessor(event, eventMap, dependencyCtx);
      }
    }
  }

  highlightEvent(dependencyCtx, selectedEvent.value, processKey, true);
};

const highlightEvent = (ctx, event, processKey, stroke=true) => {
  if (!event || !event.renderInfo) {
    return;
  }
  if (event.renderInfo.processKey !== processKey) {
    return;
  }
  const renderInfo = event.renderInfo;
  const { fillColor, fontColor, strokeColor } = getEventColor(event, true, stroke);
  const width = renderInfo.width;
  const drawData = {
    rectX: renderInfo.x,
    rectY: renderInfo.y,
    eventWidth: width,
    height: renderInfo.height,
    rectColor: fillColor,
    strokeColor: strokeColor,
    text: '',
    textX: 0,
    textY: 0,
    fontColor: fontColor,
  };
  const textX = event.renderInfo.x;
  let actualWidth = textX >= 0 ? width : width + textX;
  if (actualWidth > 15) {
    fillTextInfo(event, ctx, actualWidth, drawData);
  }
  drawEvent([drawData], ctx);
};

const drawSuccessor = (event, eventMap, dependencyCtx) => {
  const eventColor = isDarkTheme.value ? event.color.dark : event.color.light;
  // 遍历所有后继
  for (const succId of event.dependencies.successors) {
    const toEvent = eventMap.get(succId);
    const isSameProcess = toEvent.renderInfo.processKey === event.renderInfo.processKey;
    if (toEvent && toEvent.renderInfo && event.renderInfo && isSameProcess) {
      // 获取源节点和目标节点的颜色
      const toEventColor = isDarkTheme.value ? toEvent.color.dark : toEvent.color.light;
      const sourceColor = selectedEvent.value.id === event.id ? eventColor.light : eventColor.base;
      const targetColor = selectedEvent.value.id === toEvent.id ? toEventColor.light : toEventColor.base;
      const position = {
        startX: event.renderInfo.x + event.renderInfo.width,
        startY: event.renderInfo.y + event.renderInfo.height / 2,
        endX: toEvent.renderInfo.x,
        endY:toEvent.renderInfo.y + toEvent.renderInfo.height / 2,
      };
      drawArrow(dependencyCtx, position, sourceColor, targetColor);
      drawEvent([event.drawData, toEvent.drawData], dependencyCtx);
    }
  }
};

const drawPredecessor = (event, eventMap, dependencyCtx) => {
  const eventColor = isDarkTheme.value ? event.color.dark : event.color.light;
  // 遍历所有祖先
  for (const preId of event.dependencies.predecessors) {
    const sourceEvent = eventMap.get(preId);
    const isSameProcess = sourceEvent.renderInfo.processKey === event.renderInfo.processKey;
    if (sourceEvent && sourceEvent.renderInfo && event.renderInfo && isSameProcess) {
      // 获取源节点和目标节点的颜色
      const sourceEventColor = isDarkTheme.value ? sourceEvent.color.dark : sourceEvent.color.light;
      const targetColor = selectedEvent.value.id === event.id ? eventColor.light : eventColor.base;
      const sourceColor = selectedEvent.value.id === sourceEventColor.id ? sourceEventColor.light : sourceEventColor.base;
      const position = {
        endX: event.renderInfo.x,
        endY: event.renderInfo.y + event.renderInfo.height / 2,
        startX: sourceEvent.renderInfo.x + sourceEvent.renderInfo.width,
        startY:sourceEvent.renderInfo.y + sourceEvent.renderInfo.height / 2,
      };
      drawArrow(dependencyCtx, position, sourceColor, targetColor);
      drawEvent([event.drawData, sourceEvent.drawData], dependencyCtx);
    }
  }
};

const drawThreadSeparators = (ctx, process, processKey) => {
  const colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
  const devicePixelRatio = window.devicePixelRatio || 1;

  let threadY = 0;
  const threadKeys = Array.from(process.threads.keys());

  for (let i = 0; i < threadKeys.length; i++) {
    const threadKey = threadKeys[i];
    const thread = process.threads.get(threadKey);

    const threadHeight = thread.isCounter 
      ? layout.counterHeight 
      : layout.threadHeight * (lane2line.get(`${processKey}@${thread.tid}`) || 1);

    const separatorY = threadY + threadHeight;

    // 对齐到像素边界, 需要保证逻辑坐标alignedY * devicePixelRatio为整数
    thread.bottomY = Math.floor(separatorY * devicePixelRatio) / devicePixelRatio;

    threadY += threadHeight;
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
  const argKey = thread.argKey;
  const maxHight = layout.counterHeight * 2 / 3;
  const maxCount = thread.maxCount;
  const segment = 10; // 分段
  const countPerHeight = maxHight / segment;
  
  ctx.beginPath();
  ctx.strokeStyle = '#4aaad6ff';
  ctx.lineWidth = 1;

  let lastSegment = undefined;
  let lastLineX = undefined;
  let lastLineY = threadY + layout.counterHeight;
  let targetY = lastLineY;

  ctx.moveTo(0, lastLineY);

  for (const event of thread.events) {
    const x = timeToX(event.ts) - layout.processLabelWidth;
    if (x < viewState.offsetX || x > viewState.canvasWidth) {
      break;
    }
    const size = event.args[argKey];
    const currentSegment = maxCount ? Math.floor(size / (maxCount / segment)) : 0;
    targetY = threadY + layout.counterHeight - countPerHeight * currentSegment;
    if (lastSegment === undefined || currentSegment !== lastSegment ) {
      ctx.lineTo(x, lastLineY);
      ctx.lineTo(x, targetY);
      lastSegment = currentSegment;
      lastLineX = x;
      lastLineY = targetY;
    }
  }

  ctx.lineTo(viewState.canvasCssWidth, targetY);
  ctx.stroke();
  ctx.closePath();
};

const drawEventThread = (thread, ctx, threadY) => {
  // 绘制线程事件
  let eventDatas = [];
  let previousEventData = null;
  for (const event of thread.events) {
    // 冲突处理：将渲染时间后移1个单位以避免重叠
    const hasTimeConflict = thread.isFakeCore && previousEventData && previousEventData.renderStartTime >= event.renderStartTime;
    if(hasTimeConflict){
      // 冲突处理：将渲染时间后移1个单位
      const newRenderStartTime = event.startTime + 1;
      event.renderStartTime = newRenderStartTime;
      event.renderEndTime = newRenderStartTime + 1;
    }
    const drawData = {rectX: 0, rectY: 0, eventWidth: 0, height: 0, rectColor: '', strokeColor: '', text: '', textX: 0, textY: 0, fontColor: ''};
    const y = threadY + layout.threadHeight * ((event.line || 0) + 1) - layout.threadHeight / 2;
    if (getDrawData(ctx, event, y, drawData)) {
      event.drawData = drawData;
      eventDatas.push(drawData);
    } else {
      event.drawData = null;
    }
    previousEventData = event;
  }
  drawEvent(eventDatas, ctx);
};

const getEventColor = (event, highlight=false, stroke=true) => {
  const colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
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

const getDrawData = (ctx, event, y, drawData) => {
  if (!ctx || !ctx.canvas) {
    console.warn('Canvas context not available for drawing event');
    return false;
  }
  const x = timeToX(event.renderStartTime) - layout.processLabelWidth;
  let width;
  let height;

  width = Math.max(1, durationToWidth(event.duration));
  height = layout.eventHeight;
  const eventX = x;
  const eventY = y - height / 2;
  const eventWidth = event.isFakeCore ? 1 : width;
  // 存储事件的位置信息，用于点击检测
  event.renderInfo = {
    x: eventX,
    y: eventY,
    width: eventWidth,
    height: height,
    processKey: ctx.canvas.dataset.processKey || ctx.canvas.dataset.hoverProcessKey
  };

  // 检查事件是否在可视区域内
  if (event.renderEndTime < timelineState.startTime || event.renderStartTime > timelineState.endTime) {
    return false;
  }

  const colors = getEventColor(event);
  const { fillColor, fontColor, strokeColor } = colors;

  // 确保宽度和高度为正值
  if (eventWidth <= 0 || height <= 0) {
    return false;
  }
  drawData.rectX = eventX;
  drawData.rectY = eventY;
  drawData.eventWidth = eventWidth;
  drawData.height = height;
  drawData.rectColor = fillColor;
  drawData.strokeColor = strokeColor;
  drawData.fontColor = fontColor;

  const textX = event.renderInfo.x;
  let actualWidth = textX >= 0 ? width : width + textX;
  if (actualWidth < 15) {
    return true;
  }
  fillTextInfo(event, ctx, actualWidth, drawData);
  return true;
};

const fillTextInfo = (event, ctx, width, drawData) => {
  if (event.isFakeCore) return;
  const displayName = event.isCounter ? event.displayName || event.name : event.name;
  ctx.font = getFontStyle(eventTextSize);
  let textWidth = event.textWidth || ctx.measureText(displayName).width; // 这里测量一次，后续不用再测量了，用getTextWidth在苹果电脑上测量不准确
  event.textWidth = textWidth;
  const widthPerChar = textWidth / displayName.length;

  let maxCharsToFit = Math.floor(width / widthPerChar);
  
  let displayText = '';
  if (textWidth >= width && maxCharsToFit > 3) {
    maxCharsToFit -= 3;
    displayText = displayName.substr(0, maxCharsToFit) + '...';
    textWidth = ctx.measureText(displayText).width;
  } else if (textWidth < width) {
    displayText = displayName;
  }

  const textX = event.renderInfo.x;
  let textStartX = textX + (width - textWidth) / 2;
  if (textX < 0) {
    textStartX = (width - textWidth) / 2;
  }
  drawData.text = displayText;
  drawData.textX = textStartX;
  drawData.textY = drawData.rectY + eventTextSize;
};

const drawEvent = (eventDatas, ctx, isDimmed=false) => {
  const colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
  for (const drawData of eventDatas) {
    if (!drawData) {
      continue;
    }
    ctx.fillStyle = isDimmed ? colorCfg.eventRectNoColor : drawData.rectColor;
    ctx.strokeStyle = drawData.strokeColor;
    ctx.beginPath();
    if (drawData.eventWidth < 4) {
      ctx.rect(drawData.rectX, drawData.rectY, drawData.eventWidth, drawData.height);
    } else {
      ctx.roundRect(drawData.rectX, drawData.rectY, drawData.eventWidth, drawData.height, 4);
    }
    ctx.fill();
    if (drawData.strokeColor) ctx.stroke();

    if (drawData.text) {
      ctx.fillStyle = isDimmed ? colorCfg.eventFontNoColor : drawData.fontColor;
      ctx.font = getFontStyle(eventTextSize);
      ctx.textRenderingOptimization = 'optimizeLegibility';
      ctx.fillText(drawData.text, drawData.textX, drawData.textY);
    }
  }
};

const showTooltip = (e, event, canvasRef) => {
  if (!tooltip.value) return;

  const displayName = event.isCounter ? event.displayName : (event.name || 'Event');
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
  tooltipStyle.top = (e.clientY - 10) + 'px';
};

const hideTooltip = () => {
  tooltipStyle.display = 'none';
};
const clearDrawConnector = (ctx, processKey) => {
    const canvasRef = getActiveEventCanvas(processKey);
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    const canvasCSSWidth = viewState.canvasCssWidth;
    const canvasCSSHeight = getCanvasCSSHeight(canvasRef);
    ctx.clearRect(0, 0, canvasCSSWidth, canvasCSSHeight);
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
    const canvasCSSWidth = viewState.canvasCssWidth;
    const canvasCSSHeight = getCanvasCSSHeight(canvasRef);
    ctx.clearRect(0, 0, canvasCSSWidth, canvasCSSHeight);
    // 补画第一个手动测距的节点
    const uiCanvasRef = document.querySelector(`[data-ui-process-key="${processKey}"]`);
    const uiCtx = uiCanvasRef.getContext('2d');
    uiCtx.strokeStyle = isDarkTheme.value ? "#FFFFFF" : '#191919';
    uiCtx.lineWidth = 1;
    const {x ,y , width, height} = altClickData.preData.renderInfo;
    strokeRoundRect(uiCtx, x, y, width,height, 4);
  }
  const drawConnector = (ctx, largeSpacing) => {
    const rect = calculateRect(ctx , largeSpacing);
    // 填充矩形
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = getFontStyle(9);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    ctx.fillText(rect.text, centerX, centerY);
    // 绘制双向箭头
    if(largeSpacing){
      drawDoubleArrow(rect, ctx);
    } else {
      drawDistanceSelectionBox(ctx);
    }
  };
  const drawDiffConnector = (ctx, largeSpacing) => {
    const rect = calculateDiffRect(largeSpacing);
    // 填充矩形
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0)';
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = getFontStyle(9);
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
    const {x: preX, y: preY, width: preWidth, height: preHeight}  = altClickData.preData.renderInfo;
    const {x: lastX, y: lastY}  = altClickData.lastData.renderInfo;
    const leftLineWidth = lastX;
    const leftLineHeight = preY + preHeight /2;
    ctx.moveTo(preX + preWidth, leftLineHeight ); 
    ctx.lineTo(leftLineWidth, leftLineHeight);
    ctx.strokeStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 左侧箭头头部
    const arrowSize = 8;
    ctx.beginPath();
    ctx.moveTo(preX + preWidth, preY + preHeight /2);
    ctx.lineTo(preX + preWidth + arrowSize, leftLineHeight - arrowSize / 2);
    ctx.lineTo(preX + preWidth + arrowSize, leftLineHeight + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.fill();
    // 垂直虚线部分（从水平线末端垂直延伸到第二个节点）
    ctx.beginPath();
    ctx.setLineDash([5, 3]);
    ctx.moveTo(lastX, preY + preHeight /2);
    ctx.lineTo(lastX, lastY + preHeight /2);
    ctx.strokeStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    // 右侧箭头头部
    ctx.beginPath();
    ctx.moveTo(lastX , preY + preHeight /2);
    ctx.lineTo(lastX - arrowSize + 1, leftLineHeight - arrowSize / 2);
    ctx.lineTo(lastX - arrowSize + 1, leftLineHeight + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.fill();
  };
  const drawDistanceSelectionBox = (ctx) =>{
    const {x: preX, y: preY, width: preWidth, height: preHeight } = altClickData.preData.renderInfo;
    const {x: lastX} = altClickData.lastData.renderInfo;
    // 填充矩形
    ctx.fillStyle = 'rgba(49, 122, 247, 0.4)';
    ctx.strokeStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.roundRect(preX + preWidth + 1, preY - 2, lastX - (preX + preWidth + 2) , preHeight + 4, 4);
    ctx.fill();
    ctx.stroke();
  };
  // 绘制双箭头
  const drawDoubleArrow = (rect, ctx) => {
    const arrowSize = 8;
  
    // 左侧箭头（指向左边）
    const leftLineWidth = rect.x - rect.arrowWidth ;
    const rightLineWidth = rect.x + rect.width + rect.arrowWidth ;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.centerY); 
    ctx.lineTo(leftLineWidth, rect.centerY);
    ctx.strokeStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.lineWidth = 2;
    ctx.stroke();
  
    // 左侧箭头头部
    ctx.beginPath();
    ctx.moveTo(leftLineWidth - arrowSize / 2, rect.centerY);
    ctx.lineTo(leftLineWidth - arrowSize / 2 + arrowSize, rect.centerY - arrowSize / 2);
    ctx.lineTo(leftLineWidth - arrowSize / 2 + arrowSize, rect.centerY + arrowSize / 2);
    ctx.closePath();
    ctx.fillStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.fill();
  
    // 右侧箭头（指向右边）
    ctx.beginPath();
    ctx.moveTo(rect.x + rect.width, rect.centerY);
    ctx.lineTo(rightLineWidth , rect.centerY);
    ctx.strokeStyle = isDarkTheme.value ? '#317af7' : '#0a59f7';
    ctx.lineWidth = 2;
    ctx.stroke();
  
    // 右侧箭头头部
    ctx.beginPath();
    ctx.moveTo(rightLineWidth + arrowSize / 2, rect.centerY);
    ctx.lineTo(rightLineWidth + arrowSize / 2 - arrowSize + 1, rect.centerY - arrowSize / 2);
    ctx.lineTo(rightLineWidth + arrowSize / 2 - arrowSize + 1, rect.centerY + arrowSize / 2);
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
    const { x: lastX } = altClickData.lastData.renderInfo;
    const width = 40;
    const height = preHeight;
    const centerY = preY + height / 2;
    const text = getMeasureDistance(altClickData);
    return {
      x: (preX + preWidth) + (lastX - (preX + preWidth) - width) / 2,
      y: preY,
      width: width,
      height: height,
      centerX: (preX + preWidth) + (lastX - (preX + preWidth) - width) / 2 + (width / 2 - text.length) / 2,
      centerY: centerY,
      textX: (preX + preWidth) + (lastX - (preX + preWidth) - width) / 2 + (width / 2 - text.length) / 2,
      textY: centerY + 3,
      text: text,
      arrowWidth: (lastX - (preX + preWidth) - width - 6) / 2
    };
  };
  
  const calculateDiffRect = (largeSpacing) => {
    let { x: preX, width: preWidth, y: preY, height: preHeight } = altClickData.preData.renderInfo;
    if(!largeSpacing){
      preY = preY < layout.threadHeight ? preY + layout.threadHeight : preY - layout.threadHeight;
      }
    const { x: lastX} = altClickData.lastData.renderInfo;
    const width = 40;
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
    const uiCanvasRef = document.querySelector(`[data-ui-process-key="${processKey}"]`);
    const uiCtx = uiCanvasRef.getContext('2d');
    if((altClickData.preData && altClickData.lastData) && (isMeasureFixed.value || !isMeasureFirst.value)){
      clearDrawConnector(uiCtx, processKey);
    }
    if(!altClickData.preData){
      altClickData.preData = event;
      isMeasureFirst.value = true;
    } else {
      if(isEqual(altClickData.preData, event) && !altClickData.lastData){ 
        return;
      }
      isMeasureFixed.value = true;
      altClickData.lastData = event;
    }
    uiCtx.strokeStyle = isDarkTheme.value ? "#FFFFFF" : '#191919';
    uiCtx.lineWidth = 1;
    const {x ,y , width, height} = event.renderInfo;
    strokeRoundRect(uiCtx, x, y, width,height, 4);
    if(altClickData.preData && altClickData.lastData){
      const { renderInfo: preRenderInfo } = altClickData.preData;
      const { renderInfo: lastRenderInfo } = altClickData.lastData;
      const { x: preX, y: preY, width: perWidth} = preRenderInfo;
      const { x: lastX, y: lastY} = lastRenderInfo;
      const nodeSpacingX = Math.min(Math.abs(lastX - (preX + perWidth)), Math.abs(lastX - preX ));
      if(nodeSpacingX < 3) return;
      let largeSpacing = nodeSpacingX > nodeSpaceMin;
      if(lastX < preX){
          let temp = altClickData.preData;
          altClickData.preData = altClickData.lastData;
          altClickData.lastData = temp;
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
  
  const measureDistanceHover = (event, processKey) => {
    const uiCanvasRef = document.querySelector(`[data-ui-process-key="${processKey}"]`);
    const uiCtx = uiCanvasRef.getContext('2d');
    if(altClickData.preData && altClickData.lastData){
      const { renderInfo: preRenderInfo } = altClickData.preData;
      const { renderInfo: lastRenderInfo } = altClickData.lastData;
      const { x: preX, y: preY, width: perWidth} = preRenderInfo;
      const { x: lastX, y: lastY} = lastRenderInfo;
      const nodeSpacingX = Math.min(Math.abs(lastX - (preX + perWidth)), Math.abs(lastX - preX ));
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
  const strokeRoundRect = (ctx , x, y, width,height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y ,x + width, y + height, radius);
    ctx.arcTo(x + width, y + height ,x , y + height, radius);
    ctx.arcTo(x , y + height ,x , y, radius);
    ctx.arcTo(x , y ,x + width , y, radius);
    ctx.closePath();
    ctx.stroke();
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
  for (const processx of processes.entries()) {
    if (processx[1].expanded) {
      let canvasRef = document.querySelector(`[data-line-process-key="${processx[0]}"]`);
      if (flag === "over") {
        canvasRef = document.querySelector(`[data-hover-process-key="${processx[0]}"]`);
      }
      let ctx = canvasRef.getContext('2d');
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasRef.height);
      ctx.stroke();
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
      ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
    }
  }
}

addChildContext('threadEvent', {
  getCanvasHeight,
  renderProcessEvents,
  resizeCanvas,
  renderEvents,
  realCoordinateY,
  drawDependencyLines,
  clearDependencyLines,
  drawThreadSeparators,
  changeNodeColor,
  drawEventLine,
  eraseEventLine,
});
  
watch(isDarkTheme, () => {
  renderEvent();
});

onUnmounted(() => {
  throttledRender.cancel();
});
</script>

<style scoped>
@import url("../css/swimGraph/Processes/events.css");
</style>
  