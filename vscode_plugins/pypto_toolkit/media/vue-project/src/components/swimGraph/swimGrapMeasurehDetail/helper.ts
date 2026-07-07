import SwimDataManager from "../swimData";

export interface MeasureEventSearchOptions {
  lineRange: [number, number];
  type: 'start' | 'end';
  measureDragStartY: number;
  measureDragEndY: number;
  childContextMap: any;
  processes: Map<any, any>;
  processExpanded: Map<any, boolean>;
  pinnedThreads: Map<any, any>;
  pinnedthreadsComponent: any;
  swimDataManager: SwimDataManager;
  isMixMode: { value: boolean};
}

export interface IntelligentSearchOptions {
  measureDragStartX: { value: number };
  measureDragEndX: { value: number };
  measureDragStartY: number;
  measureDragEndY: number;
  measureDragStartTime: { value: number };
  measureDragEndTime: { value: number };
  xToTime: (x: number) => number;
  timeToX: (time: number) => number;
  childContextMap: any;
  processes: Map<any, any>;
  processExpanded: Map<any, boolean>;
  pinnedThreads: Map<any, any>;
  pinnedthreadsComponent: any;
  renderFixedTimeline: () => void;
  renderTimeline: () => void;
  swimDataManager: SwimDataManager;
  isMixMode: { value: boolean};
}

export const measureTimeSearch = (
  matchingEvents: any[],
  lineRange: [number, number],
  yLayer: number,
  type: 'start' | 'end',
  isPinnedArea: boolean = false
): number | null => {
  const lineRangeStart = lineRange[0];
  const lineRangeEnd = lineRange[1];
  const rangeStart = Math.max(0, yLayer - 120);
  const rangeEnd = yLayer + 120;

  const filteredEvents = matchingEvents.filter((event) => {
    const eventY = isPinnedArea ? (event.renderInfo?.pinnedEventY || 0) : event.renderInfo?.y;
    return eventY && eventY >= rangeStart && eventY <= rangeEnd;
  });

  if (filteredEvents.length === 0) {
    return null;
  }
  let closestEvent = filteredEvents[0];
  for (const event of filteredEvents.slice(1)) {
    const prevY = isPinnedArea ? (closestEvent.renderInfo?.pinnedEventY || 0) : closestEvent.renderInfo?.y;
    const currentY = isPinnedArea ? (event.renderInfo?.pinnedEventY || 0) : event.renderInfo?.y;
    const prevDistance = Math.abs(prevY - yLayer);
    const currentDistance = Math.abs(currentY - yLayer);
    if (prevDistance > currentDistance) {
      closestEvent = event;
    }
  }

  if (type === 'start' || type === 'end') {
    const targetTime = type === 'start' ? closestEvent.startTime : closestEvent.endTime;
    const otherTime = type === 'start' ? closestEvent.endTime : closestEvent.startTime;

    if (targetTime > lineRangeStart && targetTime < lineRangeEnd) {
      return targetTime;
    } else if (otherTime > lineRangeStart && otherTime < lineRangeEnd) {
      return otherTime;
    }
  }
  return null;
};
/**
 * 获取鼠标所在画布和画布内的y坐标
 * @param y 鼠标所在y坐标
 * @returns processKey: 鼠标所在画布所属的processKey, realY: 画布内的相对y坐标
 */
const realCoordinateY = (y: number) => {
  const processContainers = document.querySelectorAll('[data-process-container]');
  
  for (let i = 0; i < processContainers.length; i++) {
    const container = processContainers[i];
    const rect = container.getBoundingClientRect();
    
    if (y >= rect.top && y <= rect.bottom) {
      const processKey = container.getAttribute('data-process-container');
      const realY = y - rect.top;
      return { realY, processkey: processKey };
    }
  }
  
  return { realY: 0, processkey: '' };
}

export const measureEventSearch = (options: MeasureEventSearchOptions): number | null => {
  const {
    lineRange,
    type,
    measureDragStartY,
    measureDragEndY,
    childContextMap,
    processes,
    processExpanded,
    pinnedThreads,
    pinnedthreadsComponent,
    swimDataManager,
    isMixMode
  } = options;

  const lineRangeStart = lineRange[0];
  const lineRangeEnd = lineRange[1];
  let matchingEvents = [];
  let yLayer = 0;
  let result;
  let isPinnedArea = false;

  const mouseY = type === 'start' ? measureDragStartY : measureDragEndY;
  
  let pinnedHeight = 0;
  if (pinnedthreadsComponent && pinnedthreadsComponent.value) {
    pinnedHeight = pinnedthreadsComponent.value.getPinnedHeight();
    const pinnedContainer = document.querySelector('.pinned-thread-event-container');
    if (pinnedContainer) {
      const rect = pinnedContainer.getBoundingClientRect();
      pinnedHeight = rect.bottom;
      yLayer = mouseY - rect.top;
    }
  }

  if (mouseY <= pinnedHeight) {
    isPinnedArea = true;
  }

  if (isPinnedArea) {
    for (const [key, pinnedData] of pinnedThreads.entries()) {
      const { thread } = pinnedData;
      for (const event of thread.events) {
        if (
          (event.startTime > lineRangeStart && event.startTime < lineRangeEnd) ||
          (event.endTime > lineRangeStart && event.endTime < lineRangeEnd)
        ) {
          matchingEvents.push(event);
        }
      }
    }
  } else {
    result = realCoordinateY(mouseY);
    yLayer = result.realY;
    
    for (const [processKey, process] of processes.entries()) {
      if ((result.processkey && processKey !== result.processkey) || !processExpanded.get(processKey)) {
        continue;
      }
      const threads = process.threads;
      for (const [threadKey, thread] of threads.entries()) {
        const events = collectEventsFromThread(thread, lineRangeStart, lineRangeEnd, isMixMode.value, swimDataManager);
        matchingEvents.push(...events);
      }
    }
  }
  if (type === 'end' && isMixMode.value) {
    matchingEvents = matchingEvents.filter(event =>
      event.endTime > lineRangeStart && event.endTime < lineRangeEnd
    );
  }
  const measureTime = measureTimeSearch(matchingEvents, lineRange, yLayer, type, isPinnedArea);
  return measureTime;
};

const collectEventsFromThread = (thread, lineRangeStart, lineRangeEnd, isMixMode, swimDataManager) => {
  const events = [];
  for (const event of thread.events) {
    if (
      (event.startTime > lineRangeStart && event.startTime < lineRangeEnd) ||
      (event.endTime > lineRangeStart && event.endTime < lineRangeEnd)
    ) {
      if (isMixMode) {
        const subEvent = swimDataManager.getSubEvents(event.id);
        if (subEvent.length > 0) {
          events.push(...subEvent);
        } else {
          events.push(event);
        }
      } else {
        events.push(event);
      }
    }
  }
  return events;
};

export const intelligentSearchHelper = (options: IntelligentSearchOptions) => {
  const {
    measureDragStartX,
    measureDragEndX,
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
    renderTimeline,
    swimDataManager,
    isMixMode
  } = options;

  let start = measureDragStartX.value;
  let end = measureDragEndX.value;

  const startlineRange: [number, number] = [xToTime(start - 16), xToTime(start + 16)];
  const endlineRange: [number, number] = [xToTime(end - 16), xToTime(end + 16)];

  const foundStartTime = measureEventSearch({
    lineRange: startlineRange,
    type: 'start',
    measureDragStartY: options.measureDragStartY,
    measureDragEndY: options.measureDragEndY,
    childContextMap,
    processes,
    processExpanded,
    pinnedThreads,
    pinnedthreadsComponent,
    swimDataManager,
    isMixMode
  });
  const foundEndTime = measureEventSearch({
    lineRange: endlineRange,
    type: 'end',
    measureDragStartY: options.measureDragStartY,
    measureDragEndY: options.measureDragEndY,
    childContextMap,
    processes,
    processExpanded,
    pinnedThreads,
    pinnedthreadsComponent,
    swimDataManager,
    isMixMode
  });

  if (foundStartTime !== null) {
    start = foundStartTime;
    measureDragStartX.value = timeToX(start);
  }

  if (foundEndTime !== null) {
    end = foundEndTime;
    measureDragEndX.value = timeToX(end);
  }

  if (measureDragStartX.value <= measureDragEndX.value) {
    document.documentElement.style.setProperty('--maskstart', `${measureDragStartX.value}px`);
    document.documentElement.style.setProperty('--maskend', `${measureDragEndX.value}px`);
  } else {
    document.documentElement.style.setProperty('--maskstart', `${measureDragEndX.value}px`);
    document.documentElement.style.setProperty('--maskend', `${measureDragStartX.value}px`);
  }

  measureDragStartTime.value = foundStartTime ? start : xToTime(measureDragStartX.value);
  measureDragEndTime.value = foundEndTime ? end : xToTime(measureDragEndX.value);

  renderFixedTimeline();
  renderTimeline();
};