// 工具函数和共享方法
import { getEventColor } from './swimGraphProcesses/processInfo';

export const COLOR_CFG = {
  dark: {
    backGround: '#1F1F1F',
    eventFont: '#ffffff',
    eventRectNoColor: 'rgba(125, 125, 125, 0.5)',
    eventFontNoColor: '#999999',
    eventFontHighLight: '#000000',
    eventHighLightStroke: '#ffffff',
    lightlyCompareBkgColor: 'rgba(255, 255, 255, 0.05)',
    splitLineColor: 'rgba(255, 255, 255, 0.1)'
  },
  light: {
    backGround: '#ffffff',
    eventFont: '#000000',
    eventRectNoColor: 'rgba(0, 0, 0, 0.05)',
    eventFontNoColor: '#999999',
    eventFontHighLight: '#ffffff',
    eventHighLightStroke: '#191919',
    lightlyCompareBkgColor: 'rgba(0, 0, 0, 0.05)',
    splitLineColor: 'rgba(98, 98, 98, 0.2)'
  }
};

export const DEP_MODE = {
  all: 'all',
  pre: 'pre',
  next: 'next',
};

export let ctxs: any = {};
export const getDevicePixelRatio = () => { return window.devicePixelRatio || 1; };
export let devicePixelRatio = getDevicePixelRatio();
export let eventTextSize = 12 * devicePixelRatio;
export const FAKE_CORE_KEYWORD = 'Fake Core';
export const threadCache = new Map<string, { height: number; startY: number }>();

export const setDevicePixelRatio = (ratio: number) => {
  devicePixelRatio = ratio;
  eventTextSize = 12 * devicePixelRatio;
};

export const getThreadHeight = (processKey: string, threadKey: any, lane2line: Map<string, number>, layout: any, isCounter: boolean = false): number => {
  const cacheKey = `${processKey}@${threadKey}@${isCounter}`;
  
  if (threadCache.has(cacheKey)) {
    return threadCache.get(cacheKey)!.height;
  }
  
  let height = 0;
  if (isCounter) {
    height = layout.counterHeight;
  } else {
    const lineCount = lane2line.get(`${processKey}@${threadKey}`) || 1;
    height = layout.threadHeight * lineCount;
  }
  
  if (!threadCache.has(cacheKey)) {
    threadCache.set(cacheKey, { height, startY: 0 });
  } else {
    threadCache.get(cacheKey)!.height = height;
  }
  
  return height;
};

// 普通event threadKey是tid, counter的是threadName
export const getThreadStartY = (process: any, processKey: any, threadKey: string, lane2line: Map<string, number>, layout: any): number => {
  const cacheKey = `${processKey}@${threadKey}@startY`;
  
  if (threadCache.has(cacheKey)) {
    return threadCache.get(cacheKey)!.startY;
  }
  
  let threadY = 0;
  for (const [_, thread] of process.threads.entries()) {
    const key = thread.isCounter ? 'threadName' : 'tid';
    if (thread[key] === threadKey) {
      break;
    }
    threadY += getThreadHeight(processKey, thread[key], lane2line, layout, thread.isCounter);
  }
  
  threadCache.set(cacheKey, { height: 0, startY: threadY });
  return threadY;
};

export const calculateLine = (event, lable2lines) => {
  const isFakeCore = event.threadName.includes(FAKE_CORE_KEYWORD);
  const label = `${event.pid}@${event.tid}`;
  let lines = lable2lines[label];
  if (!lines) {
    lable2lines[label] = [];
    lines = lable2lines[label];
  }
  let placed = false;

  for (let i = 0; i < lines.length; i++) {
    if (event.startTime >= lines[i]) {
      event.line = isFakeCore ? 0 : i;
      lines[i] = Math.max(lines[i], event.endTime);
      placed = true;
      break;
    }
  }
  if (!placed) {
    event.line = isFakeCore ? 0 : lines.length;
    lines.push(event.endTime);
  }
  return lines.length;
};

export const calculateDuration = (eventTasks, processedTasks) => {
  let taskIndex = 0;
  while (taskIndex <= eventTasks.length - 1) {
    const tStart = eventTasks[taskIndex];
    const isFakeCore = tStart.threadName && tStart.threadName.includes(FAKE_CORE_KEYWORD);
    if (tStart.ph.toUpperCase() === 'X') {
      const dur = isFakeCore ? 1 : tStart.dur;
      const event = {
        ...tStart,
        id: `event_${tStart.originalIndex}`,
        startTime: tStart.ts,
        endTime: tStart.ts + tStart.dur,
        renderStartTime: tStart.ts,
        renderEndTime: tStart.ts + tStart.dur,
        duration: dur,
        isCounter: false,
        dependencies: {
          predecessors: [],
          successors: []
        }
      };
      processedTasks.push(event);
      taskIndex += 1;
      continue;
    }
    const tEnd = eventTasks[taskIndex + 1];

    if (tEnd && tStart.id === tEnd.id && tStart.ph.toUpperCase() === 'B' && tEnd.ph.toUpperCase() === 'E') {
      const dur = isFakeCore ? 1 : tEnd.ts - tStart.ts;
      const processedEvent = {
        ...tStart,
        id: `event_${tStart.originalIndex}`,
        startTime: tStart.ts,
        endTime: tEnd.ts,
        duration: dur,
        renderStartTime: tStart.ts,
        renderEndTime: tStart.ts + dur,
        isCounter: false,
        dependencies: {
          predecessors: [],
          successors: []
        }
      };
      processedTasks.push(processedEvent);
      taskIndex += 2;
    } else {
      taskIndex += 1;
    }
  }
};

export const formatTimeWithUnit = (timeInMicroseconds) => {
  const microseconds = timeInMicroseconds;
  const milliseconds = microseconds / 1000;
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;

  if (minutes >= 1) {
    return { value: minutes.toFixed(2), unit: 'min' };
  } else if (seconds >= 1) {
    return { value: seconds.toFixed(2), unit: 's' };
  } else if (milliseconds >= 1) {
    return { value: milliseconds.toFixed(2), unit: 'ms' };
  } else {
    return { value: microseconds.toFixed(0), unit: 'μs' };
  }
};
// 时间轴统一单位
export const TimelineWithUnit = (timelineRange, timeInMicroseconds) => {
  const microseconds = timelineRange;
  const milliseconds = microseconds / 1000;
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;
  let timelineValue = 0;

  if (minutes >= 1) {
    timelineValue = timeInMicroseconds / 60000000;
    return { value: timelineValue.toFixed(1), unit: 'min' };
  } else if (seconds >= 1) {
    timelineValue = timeInMicroseconds / 1000000;
    return { value: timelineValue.toFixed(1), unit: 's' };
  } else if (milliseconds >= 1) {
    timelineValue = timeInMicroseconds / 1000;
    return { value: timelineValue.toFixed(1), unit: 'ms' };
  } else {
    return { value: timeInMicroseconds.toFixed(0), unit: 'μs' };
  }
};
export const calculateGridInterval = (timePerPixel) => {
  const minPixelInterval = 100;
  const minTimeInterval = timePerPixel * minPixelInterval;

  const intervals = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100,
   200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  for (const interval of intervals) {
    if (interval >= minTimeInterval) {
      return interval;
    }
  }
  return intervals[intervals.length - 1];
};

export const calculateDependencies = (events, connections) => {
  const eventIndex = new Map();

  events.forEach(event => {
    if (!eventIndex.has(event.tid)) {
      eventIndex.set(event.tid, []);
    }
    eventIndex.get(event.tid).push(event);
  });

  for (let eventsList of eventIndex.values()) {
    eventsList.sort((a, b) => a.startTime - b.startTime);
  }

  let cIndex = 0;
  while (cIndex < connections.length) {
    const start = connections[cIndex];
    const end = connections[cIndex + 1];
    const tid1 = start.tid;
    const tid2 = end.tid;

    const parentEvents = eventIndex.get(tid1);
    const parent = parentEvents ? findEvent(parentEvents, start.ts) : null;

    const childEvents = eventIndex.get(tid2);
    const child = childEvents ? findEvent(childEvents, end.ts) : null;

    if (parent && child && start.ts <= end.ts) {
      parent.dependencies.successors.push(child.id);
      child.dependencies.predecessors.push(parent.id);
    }

    cIndex += 2;
  }
};

export const findEvent = (eventsList, timestamp) => {
  let left = 0;
  let right = eventsList.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const event = eventsList[mid];

    if (timestamp >= event.startTime && timestamp <= event.endTime) {
      return event;
    } else if (timestamp < event.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return null;
};

export const drawArrow = (ctx: any, position: any, startColor: string, endColor: string, scale=1, translate=0) => {
  let { startX, startY, endX, endY } = position;
  startX *= scale;
  endX *= scale;
  let cp1x = startX;
  let cp1y = startY;
  let cp2x = endX;
  let cp2y = endY;
  const endXLine = endX - 10;

  // 获取canvas的CSS尺寸用于计算
  const canvasCSSWidth = getCanvasCSSWidth(ctx.canvas);
  const canvasCSSHeight = getCanvasCSSHeight(ctx.canvas);

  if (Math.abs(startX - endX) > 0.01 * canvasCSSWidth)
  {
    cp1x = startX + 0.03 * canvasCSSWidth;
    cp2x = endX - 0.03 * canvasCSSWidth;
  }
  
  if (Math.abs(startY - endY) > 0.01 * canvasCSSHeight)
  {
    cp1y = startY - 0.01 * canvasCSSHeight;
    cp2y = endY + 0.01 * canvasCSSHeight;
  }
  
  if (Math.abs(startX - endXLine) < 50) {
    cp2x = endX - 50;
  } else {
    cp2x = endX - 0.03 * canvasCSSWidth;
  }

  const gradient = ctx.createLinearGradient(startX, startY, endXLine, endY);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, translate * devicePixelRatio, 0);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2 * devicePixelRatio;

  const path = new Path2D();
  path.moveTo(startX, startY);
  path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endXLine, endY);
  path.lineTo(endX, endY);

  ctx.stroke(path);

  const arrowLength = 10;
  const arrowAngle = Math.PI / 6;
  const arrowTipX = endX;
  const arrowTipY = endY;
  const arrowVertex1X = arrowTipX - arrowLength * Math.cos(-arrowAngle);
  const arrowVertex1Y = arrowTipY - arrowLength * Math.sin(-arrowAngle);
  const arrowVertex2X = arrowTipX - arrowLength * Math.cos(arrowAngle);
  const arrowVertex2Y = arrowTipY - arrowLength * Math.sin(arrowAngle);

  ctx.strokeStyle = endColor;
  ctx.beginPath();
  ctx.moveTo(arrowTipX, arrowTipY);
  ctx.lineTo(arrowVertex1X, arrowVertex1Y);
  ctx.lineTo(arrowVertex2X, arrowVertex2Y);
  ctx.closePath();

  ctx.fillStyle = endColor;
  ctx.fill();
  ctx.restore();

  return path;
};

export const mkTraceData = (processedEvents, processes, processExpanded, traceData, counterEvents, lane2line) => {
  processedEvents.value = [];
  processes.clear();
  processExpanded.clear();

  if (!traceData.value || !traceData.value.traceEvents) {
    return;
  }

  const processNames = new Map();
  const threadNames = new Map();
  const eventTasks = [];
  const connections = [];

  traceData.value.traceEvents.forEach((event, index) => {
    if (event.name === 'process_name') {
      processNames.set(event.pid, event.args.name);
    } else if (event.name === 'thread_name') {
      threadNames.set(`${event.pid}-${event.tid}`, event.args.name);
    } else if (event.cat === 'event' || event.ph === 'C') {
      if (event.ph === 'C' && (typeof(event.args.size) === 'number')) {
        const sId = event.name;
        if (!threadNames.has(sId)) {
          threadNames.set(sId, event.name);
        }
        counterEvents.value.push({ ...event, isCounter: true });
      } else {
        const color = getEventColor(event, 'subGraph');
        const threadName =  threadNames.get(`${event.pid}-${event.tid}`);
        eventTasks.push({ ...event, originalIndex: index, color, threadName});
      }
    } else if (event.cat === 'machine-view-last-dep') {
      connections.push(event);
    }
  });

  let processThreadMap = new Map();
  counterEvents.value = counterEvents.value.sort((a, b) => a.ts - b.ts);
  [...eventTasks, ...counterEvents.value].forEach((event: any) => {
    const processKey = `${event.pid || 0}`;
    const threadKey =  event.isCounter ? event.name : `${event.pid || 0}-${event.tid || 0}`;

    if (!processThreadMap.has(processKey)) {
      processThreadMap.set(processKey, {
        pid: event.pid || 0,
        processName: processNames.get(event.pid) || `Process ${event.pid || 0}`,
        threads: new Map()
      });
    }

    const process = processThreadMap.get(processKey);
    if (!process.threads.has(threadKey)) {
      const threadName = threadNames.get(threadKey) || `Thread ${event.tid || 0}`;
      process.threads.set(threadKey, {
        tid: event.tid || 0,
        threadName,
        events: []
      });
    }
  });

  let processedTasks = [];
  calculateDuration(eventTasks, processedTasks);

  processedTasks = processedTasks.sort((a, b) => a.startTime - b.startTime);
  const lable2lines = {};
  for (const event of processedTasks) {
    const isFakeCore = event.threadName.includes(FAKE_CORE_KEYWORD);
    const lineCount = isFakeCore ? 1 : calculateLine(event, lable2lines);
    lane2line.set(`${event.pid}@${event.tid}`, lineCount);
  }

  // 计算依赖关系
  calculateDependencies(processedTasks, connections);

  let firstExpanded = false;
  // 组织数据结构
  [...processedTasks, ...counterEvents.value].forEach((event: any) => {
    const processKey = `${event.pid || 0}`;
    const threadKey =  event.isCounter ? event.name : `${event.pid || 0}-${event.tid || 0}`;

    if (!processes.has(processKey)) {
      const processInfo = processThreadMap.get(processKey);
      let expanded = false;
      if (!firstExpanded) {
        expanded = true;
        firstExpanded = true;
      }
      processes.set(processKey, {
        pid: processInfo.pid,
        processName: processInfo.processName,
        threads: new Map(),
        expanded: expanded,
      });
      processExpanded.set(processKey, expanded);
    }

    const process = processes.get(processKey);
    if (!process.threads.has(threadKey)) {
      const threadInfo = processThreadMap.get(processKey).threads.get(threadKey);
      const info = {
        tid: threadInfo.tid,
        threadName: threadInfo.threadName,
        events: [],
        isCounter: false,
        isFakeCore: threadInfo.threadName.includes(FAKE_CORE_KEYWORD),
        maxCount: 0,
        argKey: 'size',
      };
      if (event.isCounter) {
        info.isCounter = true;
        info.maxCount = 0;
        info.argKey = Object.keys(event.args)[0];
      }
      process.threads.set(threadKey, info);
    }

    const thread = process.threads.get(threadKey);
    event.isFakeCore = thread.isFakeCore;
    thread.events.push(event);
    if (thread.isCounter) {
      thread.maxCount = Math.max(thread.maxCount, event.args[thread.argKey]);
    }
  });

  processedEvents.value = processedTasks;
};

// 高DPI Canvas初始化辅助函数
export const setupHighDPICanvas = (canvas: any, width: number, height: number) => {
  const currentDevicePixelRatio = getDevicePixelRatio();
  
  // 设置CSS尺寸
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  
  // 设置实际像素尺寸
  canvas.width = width * currentDevicePixelRatio;
  canvas.height = height * currentDevicePixelRatio;
  
  // 获取上下文并设置缩放
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(currentDevicePixelRatio, currentDevicePixelRatio);
  }
  
  return ctx;
};

export const getFontStyle = (fontSize: number) => {
  // fontSize 后面的字体按清晰程度排优先级，如果前面的字体找不到，会用后面的字体
  return `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
};

// 获取canvas的CSS宽度，兼容高DPI和标准DPI
export const getCanvasCSSWidth = (canvas: any) => {
  // 优先使用style.width，如果没有则使用offsetWidth
  return parseFloat(canvas.style.width) || canvas.offsetWidth;
};

// 获取canvas的CSS高度，兼容高DPI和标准DPI
export const getCanvasCSSHeight = (canvas: any) => {
  // 优先使用style.height，如果没有则使用offsetHeight
  return parseFloat(canvas.style.height) || canvas.offsetHeight;
};

export const updateProcessSize = (process: any, processKey: string, containerRect: any, layout: any, lane2line: any, viewState: any) => {
  ctxs[processKey] = {
    eventCtx: document.querySelector(`[data-process-key="${processKey}"]`),
    uiCtx: document.querySelector(`[data-ui-process-key="${processKey}"]`),
    dependencyCtx: document.querySelector(`[data-dep-process-key="${processKey}"]`),
    hoverCtx: document.querySelector(`[data-hover-process-key="${processKey}"]`),
    backgroundCtx: document.querySelector(`[data-background-process-key="${processKey}"]`),
    lineCanvasCtx:  document.querySelector(`[data-line-process-key="${processKey}"]`),
    selectionCanvasCtx:  document.querySelector(`[data-selection-process-key="${processKey}"]`),
    threeColumnCanvasCtx:  document.querySelector(`[data-three-column-process-key="${processKey}"]`),
  };
  const processCtxs = ctxs[processKey];
  const availableWidth = containerRect.width;
  const canvasWidth = availableWidth - layout.processLabelWidth - layout.marginRight;
  let canvasHeight = 0;
  for (const [threadKey, thread] of process.threads.entries()) {
    canvasHeight += getThreadHeight(processKey, thread.tid, lane2line, layout, thread.isCounter);
  }
  for (const key of Object.keys(processCtxs)) {
    if (processCtxs[key]) {
      processCtxs[key] = setupHighDPICanvas(processCtxs[key], canvasWidth, canvasHeight);
    }
  }
  viewState.canvasCssWidth = canvasWidth;
  viewState.canvasWidth = processCtxs.eventCtx.canvas.width;
};