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
    pinnedthreadsComponent
  } = options;

  const lineRangeStart = lineRange[0];
  const lineRangeEnd = lineRange[1];
  const matchingEvents = [];
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
    result = childContextMap.threadEvent.realCoordinateY(mouseY);
    yLayer = result.realY;
    
    for (const [processKey, process] of processes.entries()) {
      if (result.processkey && processExpanded.get(processKey) && processKey !== result.processkey) {
        continue;
      }
      const threads = process.threads;
      for (const [threadKey, thread] of threads.entries()) {
        for (const event of thread.events) {
          if (
            (event.startTime > lineRangeStart && event.startTime < lineRangeEnd) ||
            (event.endTime > lineRangeStart && event.endTime < lineRangeEnd)
          ) {
            matchingEvents.push(event);
          }
        }
      }
    }
  }
  const measureTime = measureTimeSearch(matchingEvents, lineRange, yLayer, type, isPinnedArea);
  return measureTime;
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
    renderTimeline
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
    pinnedthreadsComponent
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
    pinnedthreadsComponent
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