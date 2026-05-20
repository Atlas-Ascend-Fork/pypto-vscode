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
import { getEventColor } from './render/utils';
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
  isMixMode,
  isPathLockStatus,
  pathLockedEvent,
  globalDependencyLinesInfo,
  isPerfSwim,
  isMaxSchedule,
  highlightedPaths,
  isFromPerformanceClick
} = swimGraphState;
const swimGraphMethods = inject('swimGraphMethods');
const {
  drawClickWrapContainner,
  renderDimmedNodesInWrap,
  changeNodeColor
} = swimGraphMethods;
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

const drawDep = (event) => {
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
  
  globalDependencyLinesInfo.value = [];
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
const drawMixDep = (event) => {
  clearCanvas();
  drawClickWrapContainner(event, ctx);
  if (isMaxSchedule.value) {
    const subEvents = swimDataManager.getSubEvents(event.parentEventId);
    for (const subEvent of subEvents) {
      if (!subEvent.drawData) { 
        continue; 
      }
      const selectedCoords = getEventCoordinates(subEvent, false);
      if (selectedCoords) {
        highlightEventNode(subEvent, selectedCoords, true);
      }
    }
  } else {
    const selectedCoords = getEventCoordinates(event, false);
    if (selectedCoords) {
      highlightEventNode(event, selectedCoords, true);
    }
  }
  if (event?.isWait || isMaxSchedule.value) {
    return;
  }
  renderDimmedNodesInWrap(event, ctx);
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
    drawDep(selectedEvent.value);
  }

  if (isPathLockStatus.value) {
    drawDep(pathLockedEvent.value);
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
const drawNormalEventNode = (event, coords, isExpanded) => {
  if (!isExpanded || !event.drawData) {
    return;
  }
  
  const drawData = JSON.parse(JSON.stringify(event.drawData));
  const startY = coords.y - ((event.drawData.height * devicePixelRatio) / 2);
  
  drawData.rectY = startY / devicePixelRatio;
  drawData.textY = startY + eventTextSize;
  
  let eventColor = isDarkTheme.value ? event.color?.dark : event.color?.light;
  
  if (!eventColor && event.parentEventId) {
    const parentEvent = swimDataManager.getEventById(event.parentEventId);
    if (parentEvent) {
      eventColor = isDarkTheme.value ? parentEvent.color?.dark : parentEvent.color?.base;
    }
  }
  drawData.rectColor = eventColor.base;
  drawData.fontColor = isDarkTheme.value ? COLOR_CFG.dark.eventFont : COLOR_CFG.light.eventFont;
  
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
  
  let eventColor = isDarkTheme.value ? event.color?.dark : event.color?.light;
  
  if (!eventColor && event.parentEventId) {
    const parentEvent = swimDataManager.getEventById(event.parentEventId);
    if (parentEvent) {
      eventColor = isDarkTheme.value ? parentEvent.color?.dark : parentEvent.color?.light;
    }
  }
  drawData.rectColor = event?.isWait ? 'rgba(102, 102, 102, 1)' : eventColor.light;
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
  
  const linePath = drawArrow(ctx, position, sourceColor, targetColor, viewState.scale, viewState.offsetX);
  if (!isPerfSwim.value) {
    globalDependencyLinesInfo.value.push({fromEvent, toEvent, linePath});
  }
  
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
const getMixEventCoordinates = (event, isFrom) => {
  const processKey = '1';
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
  
  const processOffsetY = processRect.top - containerRect.top;
  
  const eventHeight = event.height;
  
  const eventY = event.y + (eventHeight / 2);

  const y = (processOffsetY + eventY) * devicePixelRatio;
  
  return y;
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

const drawMaxScheduleLineHighlightEvent = (subEvent) => {
 	if (subEvent) {
 	  const selectedProcessKey = subEvent.pid.toString();
 	  const isSelectedProcessExpanded = processExpanded.get(selectedProcessKey);
 	  if (isSelectedProcessExpanded) {
 	    const selectedCoords = getEventCoordinates(subEvent, false);
 	    if (selectedCoords) {
 	      highlightEventNode(subEvent, selectedCoords, isSelectedProcessExpanded);
 	    }
 	  }
 	}
};
 	 
const drawMaxScheduleLinedrawNormalEvent = (subEvent) => {
 	if (subEvent) {
 	  const selectedProcessKey = subEvent.pid.toString();
 	  const isSelectedProcessExpanded = processExpanded.get(selectedProcessKey);
 	  if (isSelectedProcessExpanded) {
 	    const selectedCoords = getEventCoordinates(subEvent, false);
 	    if (selectedCoords) {
 	      drawNormalEventNode(subEvent, selectedCoords, isSelectedProcessExpanded);
 	    }
 	  }
 	}
};

const drawMaxScheduleLine = (startEventId, endEventId) => {
  clearCanvas();
  const useSubEvent = isMixMode?.value && swimDataManager.hasMixConfig();
  let startEvent = swimDataManager.eventMap.get(startEventId);
  let endEvent = swimDataManager.eventMap.get(endEventId);
  let subStartEvents = [];
  let subEndEvents = [];
  startEvent = updateEvent(startEvent, useSubEvent);
  endEvent = updateEvent(endEvent, useSubEvent);
  if (startEvent?.parentEventId) {
    subStartEvents = swimDataManager.getSubEvents(startEvent.parentEventId);
  }
  if (endEvent?.parentEventId) {
    subEndEvents = swimDataManager.getSubEvents(endEvent.parentEventId);
  }
  if (startEvent && endEvent) {
    drawSingleConnectionLine(startEvent, endEvent);
  }
  if (subStartEvents.length > 0) {
    for (const subEvent of subStartEvents) {
      drawMaxScheduleLineHighlightEvent(subEvent);
    }
  }
  if (subEndEvents.length > 0) {
    for (const subEvent of subEndEvents) {
      drawMaxScheduleLinedrawNormalEvent(subEvent);
    }
  }
  if (subStartEvents.length === 0 ) {
    let event = JSON.parse(JSON.stringify(selectedEvent.value));
    event = updateEvent(event, useSubEvent);
    drawMaxScheduleLineHighlightEvent(event);
  }
};
const updateEvent = (event, useSubEvent) => {
  if (useSubEvent && !event.parentEventId) {
    const lastSubId = event.subEventIds?.[event.subEventIds.length - 1];
    return lastSubId ? swimDataManager.eventMap.get(lastSubId) : event;
  }
  if (!useSubEvent && event.parentEventId) {
    return swimDataManager.eventMap.get(event.parentEventId);
  }
  return event;
};

watch([() => props.containerWidth, () => props.containerHeight], () => {
  clearDomCache();
  initCanvas();
  if (isMixMode.value) {
    drawMacroDependencyLines();
  } else {
    drawGlobalConnectionLines();
  }
});

watch(processExpanded, () => {
  clearDomCache();
  nextTick(() => {
    initCanvas();
    if (isMixMode.value) {
      drawMacroDependencyLines();
    } else {
      drawGlobalConnectionLines();
    }
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

const drawMacroDependencyLines = () => {
  if (!ctx || (!selectedEvent.value && !searchedEvent.value)) {
    return;
  }
  
  const drawnNodes = new Set();
  const coordsCache = new Map();
  
  let level = 1;
  try {
    if (userConfig && userConfig.value && userConfig.value.connectionLevel !== undefined) {
      level = userConfig.value.connectionLevel;
    }
  } catch (error) {
    level = 1;
  }
  
  const startEvent = isPathLockStatus.value ? pathLockedEvent.value : (selectedEvent.value || searchedEvent.value);
  const startNodeId = startEvent.parentEventId || startEvent.id;
  
  const edgesToDraw = collectMacroEdges(startNodeId, swimDataManager.eventMap, viewState.depMode, level);
  
  if (isPathLockStatus.value) {
    drawMixDep(pathLockedEvent.value);
  } else {
    drawMixDep(selectedEvent.value || searchedEvent.value);
  }
  
  for (const edge of edgesToDraw) {
    const [fromId, toId] = edge.split('->');
    const fromEvent = swimDataManager.eventMap.get(fromId);
    const toEvent = swimDataManager.eventMap.get(toId);
    
    if (fromEvent && toEvent) {
      drawSingleMacroConnectionLine(fromEvent, toEvent, drawnNodes, coordsCache);
    }
  }
};

const collectMacroEdges = (startNodeId, eventMap, mode, level) => {
  const edgesToDraw = new Set();
  
  const bfsTraversal = (currentId, depth, direction) => {
    if (depth === 0 || !eventMap.has(currentId)) {
      return;
    }
    
    const currentEvent = eventMap.get(currentId);
    if (!currentEvent || !currentEvent.dependencies) {
      return;
    }
    
    let neighbors;
    if (direction === 'pre') {
      neighbors = currentEvent.dependencies.predecessors || [];
    } else {
      neighbors = currentEvent.dependencies.successors || [];
    }

    for (const neighborId of neighbors) {
      if (!highlightedPaths.has(neighborId)) {
        continue;
      }
      
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

const getDependencyNodeEdgeCoordinatesCached = (event, edge, coordsCache) => {
  const cacheKey = `${event.id}-${edge}`;
  if (coordsCache.has(cacheKey)) {
    return coordsCache.get(cacheKey);
  }
  
  const isMixParent = swimDataManager.isMixParentEvent(event);
  
  let coords;
  if (isMixParent) {
    const subEvents = swimDataManager.getSubEvents(event.id);
    if (subEvents.length === 0) {
      coords = getEventCoordinates(event, edge === 'right');
    } else {
      const edgeEvent = edge === 'right' 
        ? subEvents[subEvents.length - 1] 
        : subEvents[0];
      
      if (!edgeEvent?.renderInfo) {
        coords = getEventCoordinates(event, edge === 'right');
      } else {
        coords = getEventCoordinates(edgeEvent, edge === 'right');
      }
    }
  } else {
    coords = getEventCoordinates(event, edge === 'right');
  }
  
  if (coords) {
    coordsCache.set(cacheKey, coords);
  }
  return coords;
};

const drawSingleMacroConnectionLine = (fromEvent, toEvent, drawnNodes, coordsCache) => {
  const fromCoords = getDependencyNodeEdgeCoordinatesCached(fromEvent, 'right', coordsCache);
  const toCoords = getDependencyNodeEdgeCoordinatesCached(toEvent, 'left', coordsCache);
  
  if (!fromCoords || !toCoords) {
    return;
  }
  
  const fromColor = (isDarkTheme.value ? fromEvent.color?.dark?.base : fromEvent.color?.light?.base) || getEventColor(fromEvent, eventRenderer.deps, fromEvent.processKey).fillColor;
  const toColor = (isDarkTheme.value ? toEvent.color?.dark?.base : toEvent.color?.light?.base) || getEventColor(toEvent, eventRenderer.deps, toEvent.processKey).fillColor;
  
  const position = {
    startX: fromCoords.x,
    startY: fromCoords.y,
    endX: toCoords.x,
    endY: toCoords.y
  };
  
  drawArrow(ctx, position, fromColor, toColor, viewState.scale, viewState.offsetX);
  
  drawMacroEventNodeCached(fromEvent, fromCoords, drawnNodes);
  drawMacroEventNodeCached(toEvent, toCoords, drawnNodes);
};

const getDrawMacroEventNodeDrawData = () => {
  const clickedSubEvent = selectedEvent.value;
  if (clickedSubEvent?.drawData) {
    let subEvents = [clickedSubEvent];
    if (isFromPerformanceClick.value) {
      subEvents = swimDataManager.getSubEvents(clickedSubEvent.parentEventId);
    }
    for (const subEvent of subEvents) {
      const subCoords = getEventCoordinates(subEvent, false);
      if (subCoords) {
        const drawData = JSON.parse(JSON.stringify(subEvent.drawData));
        const startY = subCoords.y - ((subEvent.drawData.height * devicePixelRatio) / 2);
        drawData.rectY = startY / devicePixelRatio;
        drawData.textY = startY + eventTextSize;
        const parentEvent = swimDataManager.getEventById(subEvent.parentEventId);
        const eventColor = isDarkTheme.value ? parentEvent?.color?.dark : parentEvent?.color?.light;
        drawData.rectColor = eventColor?.light || '#90b8f9';
        drawData.fontColor = isDarkTheme.value ? COLOR_CFG.dark.eventFontHighLight : COLOR_CFG.light.eventFontHighLight;
        eventRenderer.drawEvent([drawData], ctx);
        eventRenderer.drawEventText([drawData], ctx);
      }
    }
  }
};

const drawMacroEventNodeCached = (event, coords, drawnNodes) => {
  if (drawnNodes.has(event.id)) {
    return;
  }
  drawnNodes.add(event.id);
  
  const isSelectedParent = event.id === selectedEvent.value?.parentEventId;
  
  if (isSelectedParent) {
    getDrawMacroEventNodeDrawData();
    return;
  }
  
  const isMixParent = swimDataManager.isMixParentEvent(event);
  
  if (isMixParent) {
    const subEvents = swimDataManager.getSubEvents(event.id);
    const eventColor = (isDarkTheme.value ? event.color?.dark?.base : event.color?.light?.base) || '#90b8f9';
    
    for (const subEvent of subEvents) {
      if (!subEvent.drawData) {
        continue;
      };
      
      const subCoords = getEventCoordinates(subEvent, false);
      if (subCoords) {
        const drawData = JSON.parse(JSON.stringify(subEvent.drawData));
        const startY = subCoords.y - ((subEvent.drawData.height * devicePixelRatio) / 2);
        drawData.rectY = startY / devicePixelRatio;
        drawData.textY = startY + eventTextSize;
        drawData.rectColor = eventColor;
        
        eventRenderer.drawEvent([drawData], ctx);
        eventRenderer.drawEventText([drawData], ctx);
      }
    }
  } else {
    if (!event.drawData) {
      return;
    };
    
    const drawData = JSON.parse(JSON.stringify(event.drawData));
    const startY = coords.y - ((event.drawData.height * devicePixelRatio) / 2);
    drawData.rectY = startY / devicePixelRatio;
    drawData.textY = startY + eventTextSize;
    const isSelected = event.id === selectedEvent.value.id;
    const eventColor = (isDarkTheme.value ? event.color?.dark : event.color?.light) || '#90b8f9';
    drawData.rectColor = isSelected ? eventColor.light : eventColor.base;
    const fontColor = isDarkTheme.value ? COLOR_CFG.dark : COLOR_CFG.light;
    drawData.fontColor = isSelected ? fontColor.eventFontHighLight : fontColor.eventFont;
    eventRenderer.drawEvent([drawData], ctx);
    eventRenderer.drawEventText([drawData], ctx);
  }
};

defineExpose({
  drawGlobalConnectionLines,
  clearCanvas,
  drawMaxScheduleLine,
  getEventCoordinates,
  highlightEventNode,
  globalConnectionCanvas,
  getMixEventCoordinates,
  drawMacroDependencyLines
});
</script>

<style scoped>
.global-connection-canvas {
  position: absolute;
  top: 0;
  pointer-events: none;
  z-index: 3;
}
</style>