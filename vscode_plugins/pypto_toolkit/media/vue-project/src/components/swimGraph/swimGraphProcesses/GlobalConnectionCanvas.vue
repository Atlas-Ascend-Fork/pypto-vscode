<template>
  <canvas
    ref="globalConnectionCanvas"
    class="global-connection-canvas"
    :data-global-connection="true"
    :style="{ left: layout.processLabelWidth + 'px' }"
  ></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted, inject, watch, nextTick } from 'vue';
import { throttle } from 'lodash-es';
import { COLOR_CFG, DEP_MODE, drawArrow, eventTextSize } from '../swimGraphUtils';
import { swimDataManager } from '../swimData';
import { EventRender } from './render/eventRender';
const { isDarkTheme } = inject('root');
const props = defineProps({
  containerWidth: {
    type: Number,
    required: true
  },
  containerHeight: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['canvas-ready']);

const globalConnectionCanvas = ref(null);
let ctx = null;
const devicePixelRatio = window.devicePixelRatio || 1;
let colorCfg = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
const swimGraphState = inject('swimGraphState');
const {
  viewState,
  processes,
  processExpanded,
  selectedEvent,
  layout,
  searchedEvent,
  swimlaneContainer,
} = swimGraphState;

const { userConfig } = inject('swimGraphCfg');
const eventRenderer = new EventRender({...swimGraphState, colorCfg, userConfig});
const processDomCache = new Map();

const getProcessDomElement = (processKey) => {
  if (processDomCache.has(processKey)) {
    return processDomCache.get(processKey);
  }
  const element = document.querySelector(`[data-process-key="${processKey}"]`);
  if (element) {
    processDomCache.set(processKey, element);
  }
  return element;
};

const clearDomCache = () => {
  processDomCache.clear();
};

const collectEdges = (startNodeId, eventMap, mode, level) => {
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
    bfsTraversal(startNodeId, level, 'pre');
  }
  
  if (mode === DEP_MODE.all || mode === DEP_MODE.next) {
    bfsTraversal(startNodeId, level, 'next');
  }

  return Array.from(edgesToDraw);
};

const initCanvas = () => {
  const canvas = globalConnectionCanvas.value;
  if (!canvas) {
    return;
  }
  const eles = document.getElementsByClassName('processes-container');
  const [containerEle] = eles;
  const { width: eleWidth, height: eleHeight } = containerEle.getBoundingClientRect();
  
  const width = eleWidth - layout.processLabelWidth;
  const height = eleHeight;
  
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);
  
  emit('canvas-ready', ctx);
};

const clearCanvas = () => {
  if (!ctx) {
    return;
  }
  const canvas = globalConnectionCanvas.value;
  if (!canvas) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);
};

const drawDep = () => {
  const event = selectedEvent.value;
  const mode = viewState.depMode;
  let level = 1;
  
  try {
    if (userConfig && userConfig.value && userConfig.value.connectionLevel !== undefined) {
      level = userConfig.value.connectionLevel;
    }
  } catch (error) {
    level = 1;
  }
  const edgesToDraw = collectEdges(
    event.id,
    swimDataManager.eventMap,
    mode,
    level
  );
  
  for (const edge of edgesToDraw) {
    const [fromId, toId] = edge.split('->');
    const fromEvent = swimDataManager.eventMap.get(fromId);
    const toEvent = swimDataManager.eventMap.get(toId);
    
    if (fromEvent && toEvent) {
      drawSingleConnectionLine(fromEvent, toEvent);
    }
  }
  
  const selectedProcessKey = event.pid.toString();
  const isSelectedProcessExpanded = processExpanded.get(selectedProcessKey);
  if (isSelectedProcessExpanded) {
    const selectedCoords = getEventCoordinates(event, false);
    if (selectedCoords) {
      highlightEventNode(event, selectedCoords, isSelectedProcessExpanded);
    }
  }
};

const drawSearchedValue = () => {
  const event = searchedEvent.value;
  const selectedProcessKey = event.pid.toString();
  const isSelectedProcessExpanded = processExpanded.get(selectedProcessKey);
  if (isSelectedProcessExpanded) {
    const selectedCoords = getEventCoordinates(event, false);
    if (selectedCoords) {
      highlightEventNode(event, selectedCoords, isSelectedProcessExpanded);
    }
  }
};

const drawGlobalConnectionLines = () => {
  if (!ctx || (!selectedEvent.value && !searchedEvent.value)) {
    return;
  }
  
  clearCanvas();
  
  if (selectedEvent.value) {
    drawDep();
  }
  if (searchedEvent.value) {
    drawSearchedValue();
  }
};

const drawEventNode = (event, coords, isExpanded) => {
  if (!isExpanded || !event.drawData) {
    return;
  }
  
  const drawData = JSON.parse(JSON.stringify(event.drawData));
  const startY = coords.y - ((event.drawData.height * devicePixelRatio) / 2);
  
  drawData.rectY = startY / devicePixelRatio;
  drawData.textY = startY + eventTextSize;
  
  eventRenderer.drawEvent([drawData], ctx);
  eventRenderer.drawEventText([drawData], ctx);
};

const highlightEventNode = (event, coords, isExpanded) => {
  if (!isExpanded || !event.drawData) {
    return;
  }
  
  const drawData = JSON.parse(JSON.stringify(event.drawData));
  const startY = coords.y - ((event.drawData.height * devicePixelRatio) / 2);
  
  drawData.rectY = startY / devicePixelRatio;
  drawData.textY = startY + eventTextSize;
  
  const eventColor = isDarkTheme.value ? event.color?.dark : event.color?.light;
  drawData.rectColor = eventColor.light;
  drawData.fontColor = isDarkTheme.value ? COLOR_CFG.dark.eventFontHighLight : COLOR_CFG.light.eventFontHighLight;
  
  eventRenderer.drawEvent([drawData], ctx);
  eventRenderer.drawEventText([drawData], ctx);
};

const drawSingleConnectionLine = (fromEvent, toEvent) => {
  const fromProcessKey = fromEvent.pid.toString();
  const toProcessKey = toEvent.pid.toString();
  const isFromProcessExpanded = processExpanded.get(fromProcessKey);
  const isToProcessExpanded = processExpanded.get(toProcessKey);
  
  const fromCoords = getEventCoordinates(fromEvent, true);
  const toCoords = getEventCoordinates(toEvent, false);
  
  if (!fromCoords || !toCoords) {
    return;
  }
  
  let fromColor = isDarkTheme.value ? fromEvent.color?.dark : fromEvent.color?.light;
  fromColor = fromColor || { base: '#90b8f9', light: '#90b8f9' };
  let toColor = isDarkTheme.value ? toEvent.color?.dark : toEvent.color?.light;
  toColor = toColor || { base: '#90b8f9', light: '#90b8f9' };
  
  const sourceColor = selectedEvent.value?.id === fromEvent.id ? fromColor.light : fromColor.base;
  const targetColor = selectedEvent.value?.id === toEvent.id ? toColor.light : toColor.base;
  
  const position = {
    startX: fromCoords.x,
    startY: fromCoords.y,
    endX: toCoords.x,
    endY: toCoords.y
  };
  
  drawArrow(ctx, position, sourceColor, targetColor, viewState.scale, viewState.offsetX);
  
  drawEventNode(fromEvent, fromCoords, isFromProcessExpanded);
  drawEventNode(toEvent, toCoords, isToProcessExpanded);
};

const getEventCoordinates = (event, isFrom) => {
  if (!event.renderInfo) {
    return null;
  }
  
  const processKey = event.pid.toString();
  const isExpanded = processExpanded.get(processKey);
  
  if (!isExpanded) {
    return getProcessHeaderCoordinates(processKey, event, isFrom);
  }
  
  const process = processes.get(processKey);
  if (!process) {
    return null;
  }
  
  const processElement = getProcessDomElement(processKey);
  if (!processElement) {
    return null;
  }
  
  const processRect = processElement.getBoundingClientRect();
  const containerRect = globalConnectionCanvas.value?.getBoundingClientRect();
  
  if (!containerRect) {
    return null;
  }
  
  const processOffsetX = processRect.left - containerRect.left;
  const processOffsetY = processRect.top - containerRect.top;
  
  const eventWidth = event.renderInfo.width || event.drawData?.eventWidth;
  const eventHeight = event.renderInfo.height || event.drawData?.height;
  
  const eventX = isFrom ? event.renderInfo.x + eventWidth : event.renderInfo.x;
  const eventY = event.renderInfo.y + (eventHeight / 2);

  const x = eventX * devicePixelRatio;
  const y = (processOffsetY + eventY) * devicePixelRatio;
  
  return { x, y, processKey };
};

const getProcessHeaderCoordinates = (processKey, event, isFrom) => {
  const process = processes.get(processKey);
  if (!process) {
    return null;
  }
  
  const processElement = document.querySelector(`[data-process-hover-header-key="${processKey}"]`);
  if (!processElement) {
    return null;
  }
  
  const processRect = processElement.getBoundingClientRect();
  const containerRect = globalConnectionCanvas.value?.getBoundingClientRect();
  
  if (!containerRect) {
    return null;
  }

  const processOffsetX = processRect.left - containerRect.left;
  const processOffsetY = processRect.top + processRect.height - containerRect.top;
  
  const eventWidth = event.renderInfo?.width || event.drawData?.eventWidth;
  const eventX = isFrom ? (event.renderInfo?.x) + eventWidth : (event.renderInfo?.x);
  
  const logicalX = (processOffsetX / viewState.scale) + eventX;
  const x = logicalX * devicePixelRatio;
  const y = processOffsetY * devicePixelRatio;
  
  return { x, y, processKey };
};

const drawMaxScheduleLine = (startEventId, endEventId) => {
  clearCanvas();
  const startEvent = swimDataManager.eventMap.get(startEventId);
  const endEvent = swimDataManager.eventMap.get(endEventId);
  if (startEvent && endEvent) {
    drawSingleConnectionLine(startEvent, endEvent);
  }
  const event = selectedEvent.value;
  if (event) {
    const selectedProcessKey = event.pid.toString();
    const isSelectedProcessExpanded = processExpanded.get(selectedProcessKey);
    if (isSelectedProcessExpanded) {
      const selectedCoords = getEventCoordinates(event, false);
      if (selectedCoords) {
        highlightEventNode(event, selectedCoords, isSelectedProcessExpanded);
      }
    }
  }
};

watch([() => props.containerWidth, () => props.containerHeight], () => {
  clearDomCache();
  initCanvas();
  drawGlobalConnectionLines();
});

watch(processExpanded, () => {
  clearDomCache();
  nextTick(() => {
    initCanvas();
    drawGlobalConnectionLines();
  });
}, { deep: true });

onMounted(() => {
  initCanvas();
});

onUnmounted(() => {
  if (ctx) {
    ctx = null;
  }
});

defineExpose({
  drawGlobalConnectionLines,
  clearCanvas,
  drawMaxScheduleLine,
});
</script>

<style scoped>
.global-connection-canvas {
  position: absolute;
  top: 0;
  pointer-events: none;
  z-index: 1;
}
</style>