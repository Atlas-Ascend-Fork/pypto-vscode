/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import SwimDataManager from "../swimData";
import { getThreadStartY, getThreadHeight } from "../swimGraphUtils";

export interface MeasureEventSearchOptions {
  lineRange: [number, number];
  type: 'start' | 'end';
  measureDragStartY: number;
  measureDragEndY: number;
  childContextMap: any;
  processExpanded: Map<any, boolean>;
  pinnedThreads: Map<any, any>;
  pinnedthreadsComponent: any;
  swimDataManager: SwimDataManager;
  isMixMode: { value: boolean};
  layout: any;
  lane2line: Map<string, number>;
  /* 预解析的起点坐标（mousedown 时解析），用于避免拖拽过程中 DOM 位移导致二次换算失败 */
  preResolvedStart?: { realY: number; processkey: string } | null;
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
  processExpanded: Map<any, boolean>;
  pinnedThreads: Map<any, any>;
  pinnedthreadsComponent: any;
  renderFixedTimeline: () => void;
  renderTimeline: () => void;
  swimDataManager: SwimDataManager;
  isMixMode: { value: boolean};
  layout: any;
  lane2line: Map<string, number>;
  /* mousedown 时预解析的起点容器内坐标，用于稳定起点泳道精确吸附 */
  preResolvedStart?: { realY: number; processkey: string } | null;
}

const getEventY = (event: any, isPinnedArea: boolean): number => {
  return isPinnedArea ? (event.renderInfo?.pinnedEventY || 0) : event.renderInfo?.y;
};

const findClosestEvent = (events: any[], yLayer: number, isPinnedArea: boolean): any => {
  return events.reduce((closest, event) => {
    const closestDistance = Math.abs(getEventY(closest, isPinnedArea) - yLayer);
    const currentDistance = Math.abs(getEventY(event, isPinnedArea) - yLayer);
    return currentDistance < closestDistance ? event : closest;
  });
};

const pickTimeInRange = (event: any, type: 'start' | 'end', lineRange: [number, number]): number | null => {
  const [rangeStart, rangeEnd] = lineRange;
  // 统一使用 renderStartTime/renderEndTime（与渲染位置一致），普通事件两者相等,
  // Fake Core 事件经 layoutFakeCoreEvent 重排后 render 值才反映视觉位置。
  const evStart = event.renderStartTime ?? event.startTime;
  const evEnd = event.renderEndTime ?? event.endTime;
  const targetTime = type === 'start' ? evStart : evEnd;
  const otherTime = type === 'start' ? evEnd : evStart;
  if (targetTime > rangeStart && targetTime < rangeEnd) {
    return targetTime;
  }
  if (otherTime > rangeStart && otherTime < rangeEnd) {
    return otherTime;
  }
  return null;
};

export const measureTimeSearch = (
  matchingEvents: any[],
  lineRange: [number, number],
  yLayer: number,
  type: 'start' | 'end',
  isPinnedArea: boolean = false
): number | null => {
  const rangeStart = Math.max(0, yLayer - 120);
  const rangeEnd = yLayer + 120;

  const filteredEvents = matchingEvents.filter((event) => {
    const eventY = getEventY(event, isPinnedArea);
    return eventY && eventY >= rangeStart && eventY <= rangeEnd;
  });

  if (filteredEvents.length === 0) {
    return null;
  }

  const closestEvent = findClosestEvent(filteredEvents, yLayer, isPinnedArea);
  return pickTimeInRange(closestEvent, type, lineRange);
};
/**
 * 获取鼠标所在画布和画布内的y坐标
 * @param y 鼠标所在y坐标
 * @returns processKey: 鼠标所在画布所属的processKey, realY: 画布内的相对y坐标
 */
export const realCoordinateY = (y: number) => {
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
};

const isEventInRange = (event: any, lineRangeStart: number, lineRangeEnd: number): boolean => {
  const evStart = event.renderStartTime ?? event.startTime;
  const evEnd = event.renderEndTime ?? event.endTime;
  return (
    (evStart > lineRangeStart && evStart < lineRangeEnd) ||
    (evEnd > lineRangeStart && evEnd < lineRangeEnd)
  );
};

const collectPinnedEvents = (pinnedThreads: Map<any, any>, lineRangeStart: number, lineRangeEnd: number): any[] => {
  const events: any[] = [];
  for (const [, pinnedData] of pinnedThreads.entries()) {
    const { thread } = pinnedData;
    for (const eventId of thread.eventIds) {
      const event = swimDataManager.getEventById(eventId);
      if (isEventInRange(event, lineRangeStart, lineRangeEnd)) {
        events.push(event);
      }
    }
  }
  return events;
};

const collectProcessEvents = (
  processExpanded: Map<any, boolean>,
  targetProcessKey: string,
  lineRangeStart: number,
  lineRangeEnd: number,
  isMixMode: boolean,
  swimDataManager: SwimDataManager
): any[] => {
  const events: any[] = [];
  for (const [processKey, process] of swimDataManager.getAllProcesses().entries()) {
    if ((targetProcessKey && processKey !== targetProcessKey) || !processExpanded.get(processKey)) {
      continue;
    }
    for (const [, thread] of process.threads.entries()) {
      const threadEvents = collectEventsFromThread(thread, lineRangeStart, lineRangeEnd, isMixMode, swimDataManager);
      events.push(...threadEvents);
    }
  }
  return events;
};

const resolvePinnedArea = (pinnedthreadsComponent: any, mouseY: number): { pinnedHeight: number; yLayer: number } => {
  let pinnedHeight = 0;
  let yLayer = 0;
  if (pinnedthreadsComponent && pinnedthreadsComponent.value) {
    pinnedHeight = pinnedthreadsComponent.value.getPinnedHeight();
    const pinnedContainer = document.querySelector('.pinned-thread-event-container');
    if (pinnedContainer) {
      const rect = pinnedContainer.getBoundingClientRect();
      pinnedHeight = rect.bottom;
      yLayer = mouseY - rect.top;
    }
  }
  return { pinnedHeight, yLayer };
};

/*根据鼠标在 process 容器内的 y 坐标，定位鼠标所在的具体线程（泳道）*/
const findThreadByY = (
  process: any,
  processKey: string,
  realY: number,
  lane2line: Map<string, number>,
  layout: any,
  swimDataManager: SwimDataManager
): any | null => {
  const swimLaneOrder = swimDataManager.getSwimLaneOrder();
  if (swimLaneOrder && swimLaneOrder.length > 0) {
    for (const lane of swimLaneOrder) {
      if (lane.type !== 'thread') {
        continue;
      }
      const laneEnd = lane.y + lane.height;
      if (realY >= lane.y && realY < laneEnd) {
        for (const [, thread] of process.threads.entries()) {
          if (thread.tid === lane.thread?.tid) {
            return thread;
          }
        }
        return null;
      }
    }
  }

  for (const [, thread] of process.threads.entries()) {
    const key = thread.isCounter ? thread.threadName : thread.tid;
    const threadY = getThreadStartY(process, processKey, key, lane2line, layout);
    const threadHeight = getThreadHeight(processKey, key, lane2line, layout, thread.isCounter);
    if (realY >= threadY && realY < threadY + threadHeight) {
      return thread;
    }
  }
  return null;
};

/*
* 在线程内取距离窗口中点最近的事件边界
* @param onlyInWindow true: 仅收集落入窗口内的边界（精确命中）；false：收集所有边界（最近有兜底）
* @param maxDist      距离上限，超过则返回 null（不吸附）。Infinity 表示无上限
*/
const pickClosestBoundaryInThread = (
  thread: any,
  type: 'start' | 'end',
  lineRange: [number, number],
  swimDataManager: SwimDataManager,
  isMixMode: boolean,
  onlyInWindow: boolean,
  maxDist: number = Infinity
): number | null => {
  const [rangeStart, rangeEnd] = lineRange;
  const windowMid = (rangeStart + rangeEnd) / 2;

  let bestTime: number | null = null;
  let bestDist = Infinity;
  let bestIsTarget = false;

  const inWindow = (t: number) => t > rangeStart && t < rangeEnd;
  const considerTarget = (time: number, isTarget: boolean) => {
    if (onlyInWindow && !inWindow(time)) {
      return;
    }
    const dist = Math.abs(time - windowMid);
    if (dist < bestDist || (dist === bestDist && !bestIsTarget && (isTarget || bestTime === null))) {
      bestDist = dist;
      bestTime = time;
      bestIsTarget = isTarget;
    }
  };

  for (const eventId of thread.eventIds) {
    const event = swimDataManager.getEventById(eventId);
    if (!event) {
      continue;
    }
    const candidates = isMixMode
      ? (swimDataManager.getSubEvents(event.id).length > 0 ? swimDataManager.getSubEvents(event.id) : [event])
      : [event];
    for (const candidate of candidates) {
      const evStart = candidate.renderStartTime ?? candidate.startTime;
      const evEnd = candidate.renderEndTime ?? candidate.endTime;
      const targetTime = type === 'start' ? evStart : evEnd;
      const otherTime = type === 'start' ? evEnd : evStart;
      considerTarget(targetTime, true);
      considerTarget(otherTime, false);
    }
  }

  if (bestTime === null || bestDist > maxDist) {
    return null;
  }
  return bestTime;
};

/** 窗口内精确命中：取落入窗口内距离最近的事件边界 */
const pickTimeInThreadRange = (
  thread: any,
  type: 'start' | 'end',
  lineRange: [number, number],
  swimDataManager: SwimDataManager,
  isMixMode: boolean
): number | null => {
  return pickClosestBoundaryInThread(thread, type, lineRange, swimDataManager, isMixMode, true);
};

/**
 * 本线程最近边界兜底：不限窗口，取距离窗口中点最近的事件边界，
 * 但距离超过窗口半宽则不吸附（返回 null），避免大范围跳变。
 */
const pickClosestBoundaryInThreadWithLimit = (
  thread: any,
  type: 'start' | 'end',
  lineRange: [number, number],
  swimDataManager: SwimDataManager,
  isMixMode: boolean
): number | null => {
  const maxDist = (lineRange[1] - lineRange[0]) / 2;
  return pickClosestBoundaryInThread(thread, type, lineRange, swimDataManager, isMixMode, false, maxDist);
};

export const measureEventSearch = (options: MeasureEventSearchOptions): number | null => {
  const {
    lineRange,
    type,
    measureDragStartY,
    measureDragEndY,
    childContextMap,
    processExpanded,
    pinnedThreads,
    pinnedthreadsComponent,
    swimDataManager,
    isMixMode,
    layout,
    lane2line,
    preResolvedStart
  } = options;

  const [lineRangeStart, lineRangeEnd] = lineRange;
  const mouseY = type === 'start' ? measureDragStartY : measureDragEndY;

  const { pinnedHeight, yLayer: pinnedYLayer } = resolvePinnedArea(pinnedthreadsComponent, mouseY);
  const isPinnedArea = mouseY <= pinnedHeight;

  let matchingEvents: any[];
  let yLayer: number;
  if (isPinnedArea) {
    matchingEvents = collectPinnedEvents(pinnedThreads, lineRangeStart, lineRangeEnd);
    yLayer = pinnedYLayer;
  } else {
    // 起点优先使用 mousedown 时预解析的容器内相对坐标，避免拖拽过程中
    // 滚动/平移/reflow 导致 measureDragStartY 与当前所在 DOM 位置脱节，
    // 进而使 realCoordinateY 命中失败、跳过泳道精确吸附分支。
    const usePreResolved = type === 'start' && !!preResolvedStart;
    const result = usePreResolved
      ? preResolvedStart
      : realCoordinateY(mouseY);
    yLayer = result.realY;

    // 优先吸附：定位鼠标 Y 所在的具体泳道（线程），仅在该泳道内查找命中时间窗口的起/止事件
    const process = result.processkey ? swimDataManager.getProcess(result.processkey) : undefined;
    if (process) {
      const currentThread = findThreadByY(process, result.processkey, result.realY, lane2line, layout, swimDataManager);
      if (currentThread) {
        const threadHitTime = pickTimeInThreadRange(currentThread, type, lineRange, swimDataManager, isMixMode.value);
        if (threadHitTime !== null) {
          return threadHitTime;
        }
        // 本线程最近边界兜底，命中即吸附道本线程最近的边界
        const closestBoundary = pickClosestBoundaryInThreadWithLimit(currentThread, type, lineRange, swimDataManager, isMixMode.value);
        if (closestBoundary !== null) {
          return closestBoundary;
        }
      }
    }

    matchingEvents = collectProcessEvents(
      processExpanded, result.processkey,
      lineRangeStart, lineRangeEnd, isMixMode.value, swimDataManager
    );
  }

  if (type === 'end' && isMixMode.value) {
    matchingEvents = matchingEvents.filter(event => {
      const evEnd = event.renderEndTime ?? event.endTime;
      return evEnd > lineRangeStart && evEnd < lineRangeEnd;
    });
  }

  const crossLaneResult = measureTimeSearch(matchingEvents, lineRange, yLayer, type, isPinnedArea);
  return crossLaneResult;
};

const collectEventsFromThread = (thread, lineRangeStart, lineRangeEnd, isMixMode, swimDataManager) => {
  const events = [];
  for (const eventId of thread.eventIds) {
    const event = swimDataManager.getEventById(eventId);
    if (!isEventInRange(event, lineRangeStart, lineRangeEnd)) {
      continue;
    }
    if (isMixMode) {
      const subEvents = swimDataManager.getSubEvents(event.id);
      events.push(...(subEvents.length > 0 ? subEvents : [event]));
    } else {
      events.push(event);
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
    processExpanded,
    pinnedThreads,
    pinnedthreadsComponent,
    renderFixedTimeline,
    renderTimeline,
    swimDataManager,
    isMixMode,
    layout,
    lane2line,
    preResolvedStart
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
    processExpanded,
    pinnedThreads,
    pinnedthreadsComponent,
    swimDataManager,
    isMixMode,
    layout,
    lane2line,
    preResolvedStart
  });
  const foundEndTime = measureEventSearch({
    lineRange: endlineRange,
    type: 'end',
    measureDragStartY: options.measureDragStartY,
    measureDragEndY: options.measureDragEndY,
    childContextMap,
    processExpanded,
    pinnedThreads,
    pinnedthreadsComponent,
    swimDataManager,
    isMixMode,
    layout,
    lane2line
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