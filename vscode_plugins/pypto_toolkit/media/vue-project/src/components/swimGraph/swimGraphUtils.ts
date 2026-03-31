// 工具函数和共享方法
import { getEventColorByMode } from './swimGraphProcesses/processInfo';

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

// schedule和core有总分关系的task name对，这里的key和value都有可能在实际文件中不存在
export const AICPU_SCHED_TO_CORE_TASK_RELATION = {
  DEV_TASK_RCV: 'DEV_TASK_RCV_MODEL',
  DEV_TASK_SEND_FIRST_CALLOP_TASK: 'DEV_TASK_WAIT_RCV_FIRST_CALLOP_TASK',
  DEV_TASK_SCHED_EXEC: "DEV_TASK_ALL_CALLOP_TASK_EXEC",
  DEV_TASK_SYNC_CORE_STOP: 'DEV_TASK_WAIT_SYNC_STOP_NOTIFY',
} as const;

export const AICPU_CORE_TO_SCHED_TASK_RELATION = Object.fromEntries(
  Object.entries(AICPU_SCHED_TO_CORE_TASK_RELATION).map(([k, v]) => [v, k])
) as { [K in keyof typeof AICPU_SCHED_TO_CORE_TASK_RELATION as typeof AICPU_SCHED_TO_CORE_TASK_RELATION[K]]: K };

// 点击或者hover的吸附范围左右5px
export const SNAP_THRESHOLD = 5;
// 需要吸附节点的最大width
export const NARROW_WIDTH_THRESHOLD = 2;

export let ctxs: any = {};
export const getDevicePixelRatio = () => { return window.devicePixelRatio || 1; };
export let devicePixelRatio = getDevicePixelRatio();
export let eventTextSize = 12 * devicePixelRatio;
export let meaureTextSize = 12 * devicePixelRatio;
// 测距的最小距离，若小于这个距离，不显示左右箭头
export const nodeSpaceMin = 58;

export const FAKE_CORE_KEYWORD = 'Fake Core';
export const threadCache = new Map<string, { height: number; startY: number }>();

export const setDevicePixelRatio = (ratio: number) => {
  devicePixelRatio = ratio;
  eventTextSize = 12 * devicePixelRatio;
  meaureTextSize = 9 * devicePixelRatio;
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

export const formatTimeWithUnit = (timeInNanoseconds) => {
  const nanoseconds = timeInNanoseconds;
  const microseconds = nanoseconds / 1000;
  const milliseconds = microseconds / 1000;
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;

  if (minutes >= 1) {
    return { value: minutes.toFixed(2), unit: 'min' };
  } else if (seconds >= 1) {
    return { value: seconds.toFixed(2), unit: 's' };
  } else if (milliseconds >= 1) {
    return { value: milliseconds.toFixed(2), unit: 'ms' };
  } else if (microseconds >= 1) {
    return { value: microseconds.toFixed(0), unit: 'μs' };
  } else {
    return { value: nanoseconds.toFixed(0), unit: 'ns' };
  }
};
// 时间轴统一单位
export const TimelineWithUnit = (timelineRange, timeInNanoseconds) => {
  const nanoseconds = timelineRange;
  const microseconds = nanoseconds / 1000;
  const milliseconds = microseconds / 1000;
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;
  let timelineValue = 0;

  if (minutes >= 1) {
    timelineValue = timeInNanoseconds / 60000000000;
    return { value: timelineValue.toFixed(1), unit: 'min' };
  } else if (seconds >= 1) {
    timelineValue = timeInNanoseconds / 1000000000;
    return { value: timelineValue.toFixed(1), unit: 's' };
  } else if (milliseconds >= 1) {
    timelineValue = timeInNanoseconds / 1000000;
    return { value: timelineValue.toFixed(1), unit: 'ms' };
  } else if (microseconds >= 1) {
    timelineValue = timeInNanoseconds / 1000;
    return { value: timelineValue.toFixed(0), unit: 'μs' };
  } else {
    return { value: timeInNanoseconds.toFixed(0), unit: 'ns' };
  }
};
export const calculateGridInterval = (timePerPixel: number): number => {
  const minPixelInterval = 100;
  const minTimeInterval = timePerPixel * minPixelInterval;

  const smallIntervals = [
    0.001, 0.002, 0.005,
    0.1, 0.2, 0.5,
  ];

  // 微秒到其他时间单位的转换因子
  const nanosecond = 1;
  const microsecond = 1000 * nanosecond;
  const millisecond = 1000 * microsecond;
  const second = 1000 * millisecond;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;
  
  // 定义基础时间单位（微秒）
  const intervals = [
    1 * nanosecond, 2 * nanosecond, 5 * nanosecond,
    10 * nanosecond, 20 * nanosecond, 50 * nanosecond,
    100 * nanosecond, 200 * nanosecond, 500 * nanosecond,
    1 * microsecond, 2 * microsecond, 5 * microsecond,       // 1, 2, 5 μs
    10 * microsecond, 20 * microsecond, 50 * microsecond,    // 10, 20, 50 μs
    100 * microsecond, 200 * microsecond, 500 * microsecond, // 100, 200, 500 μs
    1 * millisecond, 2 * millisecond, 5 * millisecond,       // 1, 2, 5 ms
    10 * millisecond, 20 * millisecond, 50 * millisecond,    // 10, 20, 50 ms
    100 * millisecond, 200 * millisecond, 500 * millisecond, // 100, 200, 500 ms
    1 * second, 2 * second, 5 * second,                      // 1, 2, 5 s
    10 * second, 20 * second, 30 * second,                   // 10, 20, 30 s
    1 * minute, 2 * minute, 5 * minute,                      // 1, 2, 5 min
    10 * minute, 15 * minute, 30 * minute,                   // 10, 15, 30 min
    1 * hour, 2 * hour, 3 * hour, 6 * hour,                  // 1, 2, 3, 6 h
    12 * hour,                                               // 12 h
    1 * day                                                  // 1 d
  ];

  const finalIntervals = [...smallIntervals, ...intervals];

  // 查找第一个 >= minTimeInterval 的间隔
  for (const interval of finalIntervals) {
    if (interval >= minTimeInterval) {
      return interval;
    }
  }

  // 如果还是不够，就按指数增长（比如每次 ×10）
  let fallback = finalIntervals[finalIntervals.length - 1];
  while (fallback < minTimeInterval) {
    fallback *= 10;
  }
  return fallback;
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

  if (cp2x < cp1x && cp1y === cp2y) {
    cp2x = cp1x;
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

export const processesToMap = (processes: any, id2event: any) => {
  for (const [processKey, process] of processes.entries()) {
    const { threads } = process;
    for (const [threadKey, thread] of threads.entries()) {
      for (const event of thread.events) {
        if (event.isCounter) {
          break;
        }
        id2event[event.id] = event;
      }
    }
  }
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
  const currentDevicePixelRatio = getDevicePixelRatio();
  viewState.canvasCssWidth = canvasWidth;
  viewState.canvasWidth = processCtxs.eventCtx.canvas.width;
  
  if (!viewState.clearInfo[processKey]) {
    viewState.clearInfo[processKey] = {};
  }
  const clearInfo = viewState.clearInfo[processKey];
  clearInfo.clearWidth = Math.max(viewState.canvasCssWidth, viewState.canvasWidth);
  clearInfo.clearHeight = Math.max(canvasHeight, canvasHeight * currentDevicePixelRatio);
};

export const clearWholeProcess = (ctx: any, viewState: any, processKey: string) => {
  const clearInfo = viewState.clearInfo[processKey];
  if (!clearInfo) {
    return;
  }
  const { clearWidth, clearHeight } = clearInfo;
  ctx.clearRect(0, 0, clearWidth, clearHeight);
};

export const findSchedTaskByNo = (taskNo, roundNo, process) => {
  const eventPattern = `DEV_TASK_RCV_${roundNo}(${taskNo})`;
  const scheduleList = [];
  for (const thread of process.threads.values()) {
    if (!thread?.events || !thread?.threadName) continue;
    if (!thread.threadName.includes('AICPU-SCHED')) {
      continue;
    }
    const hasMatchingEvent = thread.events.some(event => event?.name === eventPattern);
    if (hasMatchingEvent) {
      scheduleList.push(thread.threadName);
    }
  }
  return scheduleList;
};
// 调度情况图使用接口
export const findSchedGraphMap = (threads) => {
  const threadMap = new Map();
  for (const [threadKey, thread] of threads.entries()) {
    if (thread.isCounter) {
      continue;
    }
    const { threadName } = thread;
    let eventArr = [];
    const isCtrl = threadName.includes('AICPU-CTRL');
    const isSched = threadName.includes('AICPU-SCHED');
    const isCore = threadName.includes('-AIC-') || threadName.includes('-AIV-');
    if (isCtrl) {
      eventArr = [];
    } else if (isSched) {
      eventArr = findBuildSchedEvent(thread, 0, 0);
    } else if (isCore) {
      eventArr = findBuildCoreEvent(thread.events, 0, 0, threadMap);
    } else {
      eventArr = [];
    }
    if (eventArr.length > 0) {
      threadMap.set(threadName, eventArr);
    }
  }
  return threadMap;
}

// 获取ctrl类的map
export const findSchedCoreMapByNo = (event, threads) => {
  const threadMap = new Map();
  const { name } = event;
  const { roundNo, taskNo } = parseSuffixNumbers(name);
  const devTaskBuildKey = `DEV_TASK_BUILD_${roundNo}(${taskNo})`;
  const hasDevTaskBuild = name.includes(devTaskBuildKey);
  for (const [threadKey, thread] of threads.entries()) {
    if (thread.isCounter) {
      continue;
    }
    const { threadName } = thread;
    let eventArr = [];
    const isCtrl = threadName.includes('AICPU-CTRL');
    const isSched = threadName.includes('AICPU-SCHED');
    const isCore = threadName.includes('-AIC-') || threadName.includes('-AIV-');
    if (isCtrl) {
      eventArr = [event];
    } else if (isSched && hasDevTaskBuild ) {
      eventArr = findBuildSchedEvent(thread, roundNo, taskNo);
    } else if (isCore) {
      eventArr = findBuildCoreEvent(thread.events, roundNo, taskNo, threadMap);
    } else {
      eventArr = [];
    }
    if (eventArr.length > 0) {
      threadMap.set(threadName, eventArr);
    }
  }
  return threadMap;
};
// 通过ctrl类的map获取events
export const findSchedCoreEventsByNo = (schedCoreMap) => {
  const eventsArray = [];
  for (const [key, value] of schedCoreMap) {
    for (const event of value) {
      eventsArray.push(event);
    }
  }
  return eventsArray;
};
// 获取SCHED类的map
export const findSchedMapByNo = ({roundNo, taskNo, schedNo}, currentEventName, threads , event) => {
  const { id } = event;
  const threadMap = new Map();
  const isSchedEventRange = checkSchedEventRange(currentEventName);  // 是否在SCHED范围
  const pattern = new RegExp(`SCHED${schedNo}-AI[C|V]-`);
  const schedStr = `AICPU-SCHED-${schedNo}`;
  if (!taskNo) {
    taskNo = getTaskNo(schedStr, id, threads);
  }
  for (const [threadKey, thread] of threads.entries()) {
    if (thread.isCounter) {
      continue;
    }
    const { threadName } = thread;
    let eventArr = [];
    const isCtrl = threadName.includes('AICPU-CTRL');
    const isSched = threadName.includes('AICPU-SCHED');
    if (isCtrl) {
      eventArr = findCtrlEvent(thread, roundNo, taskNo, isSchedEventRange);
    } else if (isSched && threadName === schedStr) {
      eventArr = findSchedEvent(thread, roundNo, taskNo, isSchedEventRange, currentEventName);
    } else if (pattern.test(threadName)) {
      const schedThread = threadMap.get(schedStr);
      eventArr = findCoreEvent(thread.events, currentEventName, roundNo, taskNo, schedThread);
    } else {
      eventArr = [];
    }
    if (eventArr.length > 0) {
      threadMap.set(threadName, eventArr);
    }
  }
  return threadMap;
};
// 通过SCHED类的map获取events
export const findSchedEventsByNo = (schedCoreMap) => {
  const eventsArray = [];
  for (const [key, value] of schedCoreMap) {
    for (const event of value) {
      eventsArray.push(event);
    }
  }
  return eventsArray;
};
// 获取AICORE类的map
export const findCoreMapByNo = (schedNo, threadNameInfo, event, threads) => {
  const threadMap = new Map();
  const {name} = event;
  const result = parseSuffixNumbers(name);
  const { roundNo, taskNo } = result;
  const isCoreEventRange = checkCoreEventRange(name);   // 是否在CORE范围
  const schedStr = `AICPU-SCHED-${schedNo}`;
  for (const [threadKey, thread] of threads.entries()) {
    if (thread.isCounter) {
      continue;
    }
    const { threadName } = thread;
    let eventArr = [];
    const isCtrl = threadName.includes('AICPU-CTRL');
    const isSched = threadName.includes('AICPU-SCHED');
    if (isCtrl && isCoreEventRange) {
      eventArr = findCtrlEvent(thread, roundNo, taskNo, isCoreEventRange);
    } else if (isSched && threadName === schedStr && isCoreEventRange) {
      const coreRelationSched = getCoreRelationEvent(roundNo, taskNo, name);   // 有没有影射任务
      eventArr = coreRelationSched ? findSchedEvent(thread, roundNo, taskNo, isCoreEventRange, coreRelationSched) : [];
    } else if (threadName === threadNameInfo) {
      const schedThread = threadMap.get(schedStr);
      eventArr = schedThread?.length > 0 ? findCoreEvent(thread.events, name, roundNo, taskNo, schedThread) : [event];
    } else {
      eventArr = [];
    }
    if (eventArr.length > 0) {
      threadMap.set(threadName, eventArr);
    }
  }
  return threadMap;
};
// 通过AICORE类的map获取events
export const findCoreEventsByNo = (schedCoreMap) => {
  const eventsArray = [];
  for (const [key, value] of schedCoreMap) {
    for (const event of value) {
      eventsArray.push(event);
    }
  }
  return eventsArray;
};
export const getTaskNo = (schedStr, id, threads) => {
  const thread = Array.from(threads.values()).find(t => t.threadName === schedStr);
  if (!thread) {
    return '';
  }
  const index = thread.events.findIndex(event => event.id === id);
  if (index > 0) {
    const preEvent = thread.events[index - 1];
    return parseSuffixNumbers(preEvent.name).taskNo;
  }
  return '';
};
export const findAllCoreEvent = (events, roundNo, taskNo, schedThread) => {
  const result = getSchedRelatation(schedThread, roundNo, taskNo);
  const coreEventArr = [];
  const nameToFlagMap = {
    [`DEV_TASK_RCV_MODEL_${roundNo}(${taskNo})`]: 'hasRcv',
    [`DEV_TASK_ALL_CALLOP_TASK_EXEC_${roundNo}(${taskNo})`]: 'hasExec',
    [`DEV_TASK_WAIT_RCV_FIRST_CALLOP_TASK_${roundNo}(${taskNo})`]: 'hasSend',
    [`DEV_TASK_WAIT_SYNC_STOP_NOTIFY_${roundNo}(${taskNo})`]: 'hasStop'
  };
  for (const event of events) {
    const flagKey = nameToFlagMap[event.name];
    if (flagKey && result[flagKey]) {
      coreEventArr.push(event);
    }
  }
  return coreEventArr;
};
export const findCoreEvent = (events, eventName, roundNo, taskNo, schedThread) => {
  const result = getSchedRelatation(schedThread, roundNo, taskNo);
  const coreEventArr = [];
  const relationCoreEventName = getSchedRelationEvent(roundNo, taskNo, eventName);
  const nameToFlagMap = {
    [`DEV_TASK_RCV_MODEL_${roundNo}(${taskNo})`]: 'hasRcv',
    [`DEV_TASK_ALL_CALLOP_TASK_EXEC_${roundNo}(${taskNo})`]: 'hasExec',
    [`DEV_TASK_WAIT_RCV_FIRST_CALLOP_TASK_${roundNo}(${taskNo})`]: 'hasSend',
    [`DEV_TASK_WAIT_SYNC_STOP_NOTIFY_${roundNo}(${taskNo})`]: 'hasStop'
  };
  for (const event of events) {
    const { name } = event;
    const flagKey = nameToFlagMap[name];
    if (flagKey && result[flagKey] && relationCoreEventName === name) {
      coreEventArr.push(event);
    }
  }
  return coreEventArr;
};
export const findBuildCoreEvent = (events, roundNo, taskNo, threadMap) => {
  for (const [key, value] of threadMap) {
    if(key.includes('AICPU-SCHED-')){
      return findAllCoreEvent(events, roundNo, taskNo, value);
    }
  }
  return [];
};
export const findSchedEvent = (thread, roundNo, taskNo, hasEvent, currentEventName) => {
  const originEvents = thread.events;
  if (hasEvent) {
    const rcvPattern = `DEV_TASK_RCV_${roundNo}(${taskNo})`;
    const rspPattern = `DEV_TASK_RSP_${roundNo}(${taskNo})`;
    const rcvIndex = originEvents.findIndex((e) => e.name === rcvPattern);
    const rspIndex = originEvents.findIndex((e) => e.name === rspPattern);
    let currentIndex = -1;
    for (let i = rcvIndex; i <= rspIndex; i++) {
      if (originEvents[i].name === currentEventName) {
        currentIndex = i;
        break; 
      }
    }
    if (rcvIndex !== -1 && rspIndex !== -1 && rcvIndex <= rspIndex) {
      return originEvents.slice(rcvIndex, currentIndex + 1);
    }
    return [];
  } else {
    const foundEvent = originEvents.find((e) => e.name === currentEventName);
    return foundEvent ? [foundEvent] : [];
  }
};
export const getCoreRelationEvent = (roundNo, taskNo, currentEventName) => {
  const suffix = `_${roundNo}(${taskNo})`;
  const schedSuffix = `_${roundNo}`;
  const relationMap = new Map([
    [`DEV_TASK_RCV_MODEL${suffix}`, `DEV_TASK_RCV${suffix}`],
    [`DEV_TASK_WAIT_RCV_FIRST_CALLOP_TASK${suffix}`, `DEV_TASK_SEND_FIRST_CALLOP_TASK${schedSuffix}`],
    [`DEV_TASK_ALL_CALLOP_TASK_EXEC${suffix}`, `DEV_TASK_SCHED_EXEC${suffix}`],
    [`DEV_TASK_WAIT_SYNC_STOP_NOTIFY${suffix}`, `DEV_TASK_SYNC_CORE_STOP${suffix}`]
  ]);
  return relationMap.get(currentEventName) || '';
};
export const getSchedRelationEvent = (roundNo, taskNo, currentEventName) => {
  const suffix = `_${roundNo}(${taskNo})`;
  const schedSuffix = `_${roundNo}`;
  const relationMap = new Map([
    [`DEV_TASK_RCV${suffix}`, `DEV_TASK_RCV_MODEL${suffix}`],
    [`DEV_TASK_SEND_FIRST_CALLOP_TASK${schedSuffix}`, `DEV_TASK_WAIT_RCV_FIRST_CALLOP_TASK${suffix}`],
    [`DEV_TASK_SCHED_EXEC${suffix}`, `DEV_TASK_ALL_CALLOP_TASK_EXEC${suffix}`],
    [`DEV_TASK_SYNC_CORE_STOP${suffix}`, `DEV_TASK_WAIT_SYNC_STOP_NOTIFY${suffix}`]
  ]);
  return relationMap.get(currentEventName) || '';
};
export const findBuildSchedEvent = (thread, roundNo, taskNo) => {
  const originEvents = thread.events;
  const rcvPattern = `DEV_TASK_RCV_${roundNo}(${taskNo})`;
  const rspPattern = `DEV_TASK_RSP_${roundNo}(${taskNo})`;
  const rcvIndex = originEvents.findIndex((e) => e.name === rcvPattern);
  const rspIndex = originEvents.findIndex((e) => e.name === rspPattern);
  if (rcvIndex !== -1 && rspIndex !== -1 && rcvIndex <= rspIndex) {
    return originEvents.slice(rcvIndex, rspIndex + 1);
  }
};
export const findCtrlEvent = (thread, roundNo, taskNo, hasEvent) => {
  if(!hasEvent){
    return [];
  }
  const targetStr = `DEV_TASK_BUILD_${roundNo}(${taskNo})`;
  for (const event of thread.events) {
    if (event.name.includes(targetStr)) {
      return [event];
    }
  }
  return [];
};
export const checkSchedEventRange = (currentEventName) => {
  const highSchedEventsArr = ['DEV_TASK_RCV', 'DEV_TASK_SEND_FIRST_CALLOP_TASK', 'DEV_TASK_SCHED_EXEC','DEV_TASK_SYNC_CORE_STOP','WAIT_ALL_DEV_TASK_FINISH', 'DEV_TASK_RSP'];
  let hasMatch = false;
  for (let i = 0; i < highSchedEventsArr.length; i++) {
    if (currentEventName.includes(highSchedEventsArr[i])) {
      hasMatch = true;
      break;
    }
  }
  return hasMatch;
};
export const checkCoreEventRange = (currentEventName) => {
  const highCoreEventsArr = ['DEV_TASK_RCV_MODEL', 'DEV_TASK_WAIT_RCV_FIRST_CALLOP_TASK', 'DEV_TASK_ALL_CALLOP_TASK_EXEC','WAIT_ALL_DEV_TASK_CALLOP_EXEC_FINISH','DEV_TASK_WAIT_SYNC_STOP_NOTIFY'];
  let hasMatch = false;
  for (let i = 0; i < highCoreEventsArr.length; i++) {
    if (currentEventName.includes(highCoreEventsArr[i])) {
      hasMatch = true;
      break;
    }
  }
  return hasMatch;
};
export const getSchedRelatation = (schedThread, roundNo, taskNo) => {
  const rcvStr = `DEV_TASK_RCV_${roundNo}(${taskNo})`;
  const sendStr = `DEV_TASK_SEND_FIRST_CALLOP_TASK_${roundNo}`;
  const execStr = `DEV_TASK_SCHED_EXEC_${roundNo}(${taskNo})`;
  const stopStr = `DEV_TASK_SYNC_CORE_STOP_${roundNo}(${taskNo})`;
  const result = {
    hasRcv: false,
    hasSend: false,
    hasExec: false,
    hasStop: false,
  };
  for (const event of schedThread) {
    const name = event.name;
    if (name === rcvStr) {
      result.hasRcv = true;
    } else if (name === sendStr) {
      result.hasSend = true;
    } else if (name === execStr) {
      result.hasExec = true;
    } else if (name === stopStr) {
      result.hasStop = true;
    }
    if (result.hasRcv && result.hasSend && result.hasExec && result.hasStop) {
      break;
    }
  }
  return result;
};
export const processTimeInfo = (timeInfo, data) => {
  let minT = Infinity;
  let maxT = -Infinity;
  for (const processId of Object.keys(data.processes)) {
    for (const [threadId, thread] of data.processes[processId].threads) {
      for (const event of thread.events) {
        minT = Math.min(minT, event.ts);
        if (event.duration) {
          maxT = Math.max(maxT, event.ts + event.duration);
        } else if (event.endTime) {
          maxT = Math.max(maxT, event.endTime);
        }
      }
    }
  }
  const offset = data.timeInfo.minTime - minT;
  maxT += offset;
  minT += offset;
  for (const processId of Object.keys(data.processes)) {
    for (const [threadId, thread] of data.processes[processId].threads) {
      for (let i = 0; i < thread.events.length; i++) {
        const event = data.processes[processId].threads.get(threadId).events[i];
        event.ts += offset;
        event.startTime += offset;
        event.endTime += offset;
        event.renderStartTime += offset;
        event.renderEndTime += offset;
      }
    }
  }
  timeInfo.value.minTime = minT;
  timeInfo.value.maxTime = maxT;
};

export const parseSuffixNumbers = (str) => {
  const regex = /_(\d+)(?:\((\d+)\))?$/;
  const match = str.match(regex);
  if (!match) {
    throw new Error(`Invalid format: ${str}. Expected format: '..._num' or '..._num(num)'`);
  }
  const roundNo = match[1]; //下划线
  const taskNo = match[2] ?? null; //括号
  return {
    roundNo,
    taskNo,
  };
};

export const findBuildTaskByNo = (schedCoreMap) => {
  for (const [key, value] of schedCoreMap) {
    if (key.includes('AICPU-CTRL') && value.length === 1) {
      return value[0];
    }
  }
  return null;
};
