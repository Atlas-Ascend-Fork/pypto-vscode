export interface ThreadInfo {
  tid: string;
  threadName: string;
  eventIds: string[];
  isCounter?: boolean;
  isFakeCore?: boolean;
  isPinned?: boolean;
  renderInfo?: {
    startY: number;
    height?: number;
  };
  parentThreadName?: string;
  parentTid?: string;
}

export interface ProcessInfo {
  pid: string;
  name: string;
  type: string;
  threads: Map<string, ThreadInfo>;
}

export interface EventDetail {
  id: string;
  name: string;
  pid: string;
  tid: string;
  threadName: string;
  startTime: number;
  endTime: number;
  duration?: number;
  ph?: string;
  args?: any;
  dependencies?: {
    predecessors: string[];
    successors: string[];
  };
  color?: any;
  pmu_info?: any;
  renderInfo?: any;
  drawData?: any;
  leafIndex?: number;
  [key: string]: any;
  
  subEventIds?: string[];
  parentEventId?: string;
}

export interface MixConfig {
  wrapId: number;
  parentEventId: string;
  subEventIds: string[];
  waitTaskIds: string[];
  discardIntervals: [number, number][];
}

export interface SyncEvent {
  idx: number;
  time: number;
  type: 'CV_SYNC_SET' | 'CV_SYNC_WAIT';
  eventid: number;
  parentEventId?: string;
}

export interface SwimLaneWrapLabel {
  type: 'wrap-label';
  wrapId: number;
  wrapIds: number[];
  wrapStartTimes: number[];
  label: string;
  y: number;
  height: number;
  startTime: number;
}

export interface SwimLaneThread {
  type: 'thread';
  thread: ThreadInfo;
  y: number;
  height: number;
  wrapIds: number[];
}

export type SwimLaneItem = SwimLaneWrapLabel | SwimLaneThread;

export interface WrapContainerInfo {
  wrapId: number;
  label: string;
  minStartTime: number;
  maxEndTime: number;
  threadTids: string[];
}

class SwimDataManager {
  private static instance: SwimDataManager;
  
  public processInfo: Map<string, ProcessInfo>;
  public eventMap: Map<string, EventDetail>;
  public mixConfig: MixConfig[];
  private eventsByWrapId: Map<number, EventDetail[]>;
  private wrapContainers: Map<number, WrapContainerInfo>;
  private swimLaneOrder: SwimLaneItem[];
  private isMixModeActive: boolean;
  private mixThreads: ThreadInfo[];
  private wrapThreadMap: Map<number, ThreadInfo[]>;
  private lane2line: Map<string, number>;
  
  private constructor() {
    this.processInfo = new Map();
    this.eventMap = new Map();
    this.mixConfig = [];
    this.eventsByWrapId = new Map();
    this.wrapContainers = new Map();
    this.swimLaneOrder = [];
    this.isMixModeActive = false;
    this.mixThreads = [];
    this.wrapThreadMap = new Map();
    this.lane2line = new Map();
  }
  
  public static getInstance(): SwimDataManager {
    if (!SwimDataManager.instance) {
      SwimDataManager.instance = new SwimDataManager();
    }
    return SwimDataManager.instance;
  }
  
  public initialize(processes: Map<string, any>): void {
    this.processInfo.clear();
    this.eventMap.clear();
    this.eventsByWrapId.clear();
    this.mixConfig = [];
    this.wrapContainers.clear();
    this.swimLaneOrder = [];
    this.isMixModeActive = false;
    this.mixThreads = [];
    this.wrapThreadMap.clear();
    this.lane2line.clear();
    
    for (const [processKey, process] of processes.entries()) {
      const threadInfoMap = new Map<string, ThreadInfo>();
      
      if (process.threads) {
        for (const [threadKey, thread] of process.threads.entries()) {
          const eventIds: string[] = [];
          
          if (thread.events && Array.isArray(thread.events)) {
            for (const event of thread.events) {
              eventIds.push(event.id);
              
              event.processKey = processKey;
              event.threadKey = threadKey;
              this.eventMap.set(event.id, event);
              
              const wrapId = event.args?.wrapId;
              if (wrapId !== undefined && wrapId !== -1) {
                if (!this.eventsByWrapId.has(wrapId)) {
                  this.eventsByWrapId.set(wrapId, []);
                }
                this.eventsByWrapId.get(wrapId)?.push(event);
              }
            }
          }
          
          const threadInfo: ThreadInfo = {
            tid: thread.tid || threadKey,
            threadName: thread.threadName || '',
            eventIds,
            isCounter: thread.isCounter,
            isFakeCore: thread.threadName.includes('Fake Core'),
            parentThreadName: thread.parentThreadName,
            parentTid: thread.parentTid,
          };
          
          threadInfoMap.set(threadKey, threadInfo);
        }
      }
      
      const processInfoItem: ProcessInfo = {
        pid: process.pid || processKey,
        name: process.processName || '',
        type: process.type || 'kernel',
        threads: threadInfoMap
      };
      
      this.processInfo.set(processKey, processInfoItem);
    }
  }
  
  public getEventById(eventId: string): EventDetail | undefined {
    return this.eventMap.get(eventId);
  }
  
  public getEventsByIds(eventIds: string[]): EventDetail[] {
    return eventIds
      .map(id => this.eventMap.get(id))
      .filter((event): event is EventDetail => event !== undefined);
  }
  
  public getProcessByEvent(eventId: string): ProcessInfo | undefined {
    const event = this.eventMap.get(eventId);
    if (!event) return undefined;
    
    return this.processInfo.get(event.processKey);
  }
  
  public getThreadByEvent(eventId: string): ThreadInfo | undefined {
    const event = this.eventMap.get(eventId);
    if (!event) return undefined;
    
    const process = this.processInfo.get(event.processKey);
    if (!process) return undefined;
    
    return process.threads.get(event.threadKey);
  }
  
  public getEventsByProcess(processKey: string): EventDetail[] {
    const process = this.processInfo.get(processKey);
    if (!process) return [];
    
    const events: EventDetail[] = [];
    for (const threadInfo of process.threads.values()) {
      for (const eventId of threadInfo.eventIds) {
        const event = this.eventMap.get(eventId);
        if (event) {
          events.push(event);
        }
      }
    }
    return events;
  }
  
  public getEventsByThread(processKey: string, threadKey: string): EventDetail[] {
    const process = this.processInfo.get(processKey);
    if (!process) return [];
    
    const threadInfo = process.threads.get(threadKey);
    if (!threadInfo) return [];
    
    return this.getEventsByIds(threadInfo.eventIds);
  }
  
  public clear(): void {
    this.processInfo.clear();
    this.eventMap.clear();
    this.eventsByWrapId.clear();
    this.mixConfig = [];
    this.wrapContainers.clear();
    this.swimLaneOrder = [];
    this.isMixModeActive = false;
    this.mixThreads = [];
    this.wrapThreadMap.clear();
    this.lane2line.clear();
  }
  
  public updateEvent(eventId: string, updates: Partial<EventDetail>): void {
    const event = this.eventMap.get(eventId);
    if (event) {
      Object.assign(event, updates);
    }
  }

  public splitMixSubTask(): MixConfig[] {
    return this.mixConfig;
  }

  public getSubEvents(parentEventId: string): EventDetail[] {
    const config = this.mixConfig.find(c => c.parentEventId === parentEventId);
    if (!config?.subEventIds) { return []; }
    return config.subEventIds
      .map(id => this.eventMap.get(id))
      .filter((e): e is EventDetail => e !== undefined);
  }

  public getWaitTasks(parentEventId: string): EventDetail[] {
    const config = this.getSplitConfig(parentEventId);
    if (!config?.waitTaskIds) { return []; }
    return config.waitTaskIds
      .map(id => this.eventMap.get(id))
      .filter((e): e is EventDetail => e !== undefined);
  }

  public getSplitConfig(parentEventId: string): MixConfig | undefined {
    return this.mixConfig.find(c => c.parentEventId === parentEventId);
  }

  public getSubEventDependencies(subEventId: string): {
    predecessors: EventDetail[];
    successors: EventDetail[];
  } {
    const subEvent = this.eventMap.get(subEventId);
    if (!subEvent?.parentEventId) {
      return { predecessors: [], successors: [] };
    }

    const predecessors = (subEvent.dependencies?.predecessors || [])
      .map(id => this.eventMap.get(id))
      .filter((e): e is EventDetail => !!e);

    const successors = (subEvent.dependencies?.successors || [])
      .map(id => this.eventMap.get(id))
      .filter((e): e is EventDetail => !!e);

    return { predecessors, successors };
  }

  public getParentDependencies(subEventId: string): {
    parentEvent: EventDetail | null;
    predecessors: EventDetail[];
    successors: EventDetail[];
  } {
    const subEvent = this.eventMap.get(subEventId);
    if (!subEvent?.parentEventId) {
      return { parentEvent: null, predecessors: [], successors: [] };
    }

    const parentEvent = this.eventMap.get(subEvent.parentEventId);
    if (!parentEvent) {
      return { parentEvent: null, predecessors: [], successors: [] };
    }

    const predecessors = (parentEvent.dependencies?.predecessors || [])
      .map(id => this.eventMap.get(id))
      .filter((e): e is EventDetail => !!e);

    const successors = (parentEvent.dependencies?.successors || [])
      .map(id => this.eventMap.get(id))
      .filter((e): e is EventDetail => !!e);

    return { parentEvent, predecessors, successors };
  }

  public splitAllEvents(): void {
    for (const [eventId, event] of Array.from(this.eventMap.entries())) {
      const wrapId = event.args?.wrapId;
      if (wrapId === undefined || wrapId === -1) {
        continue;
      }
      this.splitSingleEvent(eventId);
    }
    this.generateAllDependencies();
  }

  private createMinimalSubEvent(
    parentEvent: EventDetail,
    subEventId: string,
    subEventName: string,
    startTime: number,
    endTime: number
  ): EventDetail {
    return {
      id: subEventId,
      name: subEventName,
      pid: parentEvent.pid,
      tid: parentEvent.tid,
      threadName: parentEvent.threadName,
      threadKey: parentEvent.threadKey,
      startTime,
      endTime,
      args: { wrapId: parentEvent.args?.wrapId, hashorder: parentEvent.args?.['hashOrder-hint'] },
      dependencies: { predecessors: [], successors: [] },
      parentEventId: parentEvent.id,
      leafIndex: parentEvent.leafIndex,
    };
  }

  private isValidSyncEvent(syncEvent: any): boolean {
    return (
      syncEvent !== null &&
      syncEvent !== undefined &&
      typeof syncEvent.eventid === 'number' &&
      typeof syncEvent.time === 'number' &&
      (syncEvent.type === 'CV_SYNC_SET' || syncEvent.type === 'CV_SYNC_WAIT')
    );
  }

  private filterValidSyncEvents(syncEvents: any[]): SyncEvent[] {
    return syncEvents.filter(se => this.isValidSyncEvent(se)) as SyncEvent[];
  }

  private mergeIntervals(intervals: [number, number][]): [number, number][] {
    if (intervals.length === 0) return [];
    const sorted = intervals.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];
      if (current[0] <= last[1]) {
        last[1] = Math.max(last[1], current[1]);
      } else {
        merged.push(current);
      }
    }
    return merged;
  }

  private getWaitDependencyTime(
    waitTime: number,
    setTime: number,
    discardIntervals: [number, number][]
  ): number {
    if (waitTime > setTime) {
      for (const [start, end] of discardIntervals) {
        if (start <= waitTime && waitTime <= end) {
          return end;
        }
      }
      return waitTime;
    } else if (waitTime < setTime) {
      const allIntervals: [number, number][] = [...discardIntervals, [waitTime, setTime]];
      const merged = this.mergeIntervals(allIntervals);
      for (const [start, end] of merged) {
        if (start <= waitTime && waitTime <= end) {
          return end;
        }
      }
      return setTime;
    } else {
      return waitTime;
    }
  }

  private splitSingleEvent(parentEventId: string): void {
    const parentEvent = this.eventMap.get(parentEventId);
    if (!parentEvent || parentEvent.subEventIds) {
      return;
    }

    const wrapId = parentEvent.args?.wrapId;
    const rawSyncEvents: any[] = parentEvent.args?.syncEvents || [];
    const syncEvents = this.filterValidSyncEvents(rawSyncEvents);

    const pool = this.buildSyncEventPool(wrapId);

    const subEvents: EventDetail[] = [];
    const subEventIds: string[] = [];
    const discardIntervals: [number, number][] = [];

    if (syncEvents.length === 0) {
      const subEventId = `${parentEventId}_sub_0`;
      const subEvent = this.createMinimalSubEvent(
        parentEvent,
        subEventId,
        `${parentEvent.name}_0`,
        parentEvent.startTime,
        parentEvent.endTime
      );
      subEvents.push(subEvent);
      subEventIds.push(subEventId);
      this.eventMap.set(subEventId, subEvent);
    } else {
      const sortedSyncEvents = [...syncEvents].sort((a, b) => a.time - b.time);
      
      for (const syncEvent of sortedSyncEvents) {
        if (syncEvent.type === 'CV_SYNC_WAIT') {
          const pairSetEvent = this.findAndRemoveSyncEventPair(pool, syncEvent.eventid, 'CV_SYNC_SET');
          if (pairSetEvent && pairSetEvent.time > syncEvent.time) {
            discardIntervals.push([syncEvent.time, Math.min(pairSetEvent.time, parentEvent.endTime)]);
          }
        }
      }
      
      const mergedDiscardIntervals = this.mergeIntervals(discardIntervals);
      
      let currentStartTime = parentEvent.startTime;

      for (let si = 0; si < sortedSyncEvents.length; si++) {
        const syncEvent = sortedSyncEvents[si];
        const syncTime = syncEvent.time;
        
        let inDiscardInterval = false;
        let matchedDiscardIdx = -1;
        for (let di = 0; di < mergedDiscardIntervals.length; di++) {
          const [start, end] = mergedDiscardIntervals[di];
          if (start <= syncTime && syncTime <= end) {
            inDiscardInterval = true;
            matchedDiscardIdx = di;
            break;
          }
        }
        
        if (inDiscardInterval) {
          const [start, end] = mergedDiscardIntervals[matchedDiscardIdx];
          if (currentStartTime < start) {
            const nameIndex = si;
            const subEventId = `${parentEventId}_sub_${nameIndex}`;
            const subEvent = this.createMinimalSubEvent(
              parentEvent,
              subEventId,
              `${parentEvent.name}_${nameIndex}`,
              currentStartTime,
              start
            );
            subEvents.push(subEvent);
            subEventIds.push(subEventId);
            this.eventMap.set(subEventId, subEvent);
          }
          currentStartTime = end;
        } else {
          if (syncTime > currentStartTime) {
            const nameIndex = si;
            const subEventId = `${parentEventId}_sub_${nameIndex}`;
            const subEvent = this.createMinimalSubEvent(
              parentEvent,
              subEventId,
              `${parentEvent.name}_${nameIndex}`,
              currentStartTime,
              syncTime
            );
            subEvents.push(subEvent);
            subEventIds.push(subEventId);
            this.eventMap.set(subEventId, subEvent);
          }
          currentStartTime = syncTime;
        }
      }

      if (currentStartTime < parentEvent.endTime) {
        const nameIndex = sortedSyncEvents.length;
        const subEventId = `${parentEventId}_sub_${nameIndex}`;
        const subEvent = this.createMinimalSubEvent(
          parentEvent,
          subEventId,
          `${parentEvent.name}_${nameIndex}`,
          currentStartTime,
          parentEvent.endTime
        );
        subEvents.push(subEvent);
        subEventIds.push(subEventId);
        this.eventMap.set(subEventId, subEvent);
      }
    }

    parentEvent.subEventIds = subEventIds;

    const waitTasks = this.computeWaitTasks(subEvents, parentEventId);
    const waitTaskIds: string[] = [];
    for (const waitTask of waitTasks) {
      this.eventMap.set(waitTask.id, waitTask);
      waitTaskIds.push(waitTask.id);
    }

    const mergedDiscardIntervals = discardIntervals.length > 0 ? this.mergeIntervals(discardIntervals) : [];
    this.mixConfig.push({
      wrapId: wrapId ?? -1,
      parentEventId,
      subEventIds,
      waitTaskIds,
      discardIntervals: mergedDiscardIntervals,
    });
  }

  private computeWaitTasks(subEvents: EventDetail[], parentEventId: string): EventDetail[] {
    if (subEvents.length < 2) {
      return [];
    }

    const sortedSubEvents = [...subEvents].sort((a, b) => a.startTime - b.startTime);
    const waitTasks: EventDetail[] = [];

    for (let i = 0; i < sortedSubEvents.length - 1; i++) {
      const currentTask = sortedSubEvents[i];
      const { pid, tid, threadName, args, endTime: currentEnd } = currentTask;
      const nextStart = sortedSubEvents[i + 1].startTime;
      if (nextStart > currentEnd) {
        const waitTaskId = `${parentEventId}_wait_${i}`;
        const waitTask: EventDetail = {
          id: waitTaskId,
          name: 'Wait',
          startTime: currentEnd,
          endTime: nextStart,
          parentEventId,
          isWait: true,
          pid: pid,
          tid: tid,
          threadName: threadName,
          args: { wrapId: args?.wrapId}
        };
        waitTasks.push(waitTask);
      }
    }

    return waitTasks;
  }

  private buildSyncEventPool(wrapId: number): Map<number, { sets: SyncEvent[]; waits: SyncEvent[] }> {
    const pool = new Map<number, { sets: SyncEvent[]; waits: SyncEvent[] }>();
    const events = this.eventsByWrapId.get(wrapId);
    if (!events) return pool;

    for (const event of events) {
      if (event.args?.syncEvents) {
        for (const se of event.args.syncEvents) {
          if (!this.isValidSyncEvent(se)) continue;
          if (!pool.has(se.eventid)) {
            pool.set(se.eventid, { sets: [], waits: [] });
          }
          const entry = pool.get(se.eventid)!;
          const enrichedSe: SyncEvent = { ...se, parentEventId: event.id };
          if (se.type === 'CV_SYNC_SET') {
            entry.sets.push(enrichedSe);
          } else {
            entry.waits.push(enrichedSe);
          }
        }
      }
    }
    
    for (const entry of pool.values()) {
      entry.sets.sort((a, b) => a.time - b.time);
      entry.waits.sort((a, b) => a.time - b.time);
    }
    return pool;
  }

  private findAndRemoveSyncEventPair(
    pool: Map<number, { sets: SyncEvent[]; waits: SyncEvent[] }>,
    eventid: number,
    targetType: 'CV_SYNC_SET' | 'CV_SYNC_WAIT'
  ): SyncEvent | null {
    const entry = pool.get(eventid);
    if (!entry) return null;
    
    const targetList = targetType === 'CV_SYNC_SET' ? entry.sets : entry.waits;
    if (targetList.length === 0) return null;
    
    return targetList.shift()!;
  }

  private findEventBySyncEvent(wrapId: number, syncEvent: SyncEvent): EventDetail | null {
    const events = this.eventsByWrapId.get(wrapId);
    if (!events) {
      return null;
    }
    for (const event of events) {
      if (event.args?.syncEvents) {
        const syncEvents: SyncEvent[] = event.args.syncEvents;
        if (syncEvents.some(se => se.eventid === syncEvent.eventid && se.type === syncEvent.type)) {
          return event;
        }
      }
    }
    return null;
  }

  private findSubEventByEndTime(parentEventId: string, endTime: number): EventDetail | null {
    const subEvents = this.getSubEvents(parentEventId);
    const sorted = [...subEvents].sort((a, b) => b.endTime - a.endTime);
    return sorted.find(se => se.endTime <= endTime) || null;
  }

  private findSubEventByStartTime(parentEventId: string, startTime: number): EventDetail | null {
    const subEvents = this.getSubEvents(parentEventId);
    const sorted = [...subEvents].sort((a, b) => a.startTime - b.startTime);
    return sorted.find(se => se.startTime >= startTime) || null;
  }

  private generateAllDependencies(): void {
    const poolByWrapId = new Map<number, Map<number, { sets: SyncEvent[]; waits: SyncEvent[] }>>();
    const processedWrapIds = new Set<number>();

    for (const config of this.mixConfig) {
      const wrapId = config.wrapId;
      if (processedWrapIds.has(wrapId)) continue;
      processedWrapIds.add(wrapId);

      if (!poolByWrapId.has(wrapId)) {
        poolByWrapId.set(wrapId, this.buildSyncEventPool(wrapId));
      }
      const pool = poolByWrapId.get(wrapId)!;

      const allSets: SyncEvent[] = [];
      for (const entry of pool.values()) {
        allSets.push(...entry.sets);
      }
      allSets.sort((a, b) => a.time - b.time);

      for (const setEvent of allSets) {
        const pairWaitEvent = this.findAndRemoveSyncEventPair(pool, setEvent.eventid, 'CV_SYNC_WAIT');
        if (!pairWaitEvent) {
          continue;
        }

        const setParentEventId = setEvent.parentEventId!;
        const subEventA = this.findSubEventByEndTime(setParentEventId, setEvent.time);
        if (!subEventA) {
          continue;
        }

        const waitParentEventId = pairWaitEvent.parentEventId!;
        const waitParentEvent = this.eventMap.get(waitParentEventId);
        if (!waitParentEvent) {
          continue;
        }

        const waitConfig = this.getSplitConfig(waitParentEvent.id);
        const waitDiscardIntervals = waitConfig?.discardIntervals || [];

        const dependencyTime = this.getWaitDependencyTime(
          pairWaitEvent.time,
          setEvent.time,
          waitDiscardIntervals
        );

        const subEventC = this.findSubEventByStartTime(waitParentEvent.id, dependencyTime);
        if (!subEventC) {
          continue;
        }

        if (!subEventA.dependencies.successors.includes(subEventC.id)) {
          subEventA.dependencies.successors.push(subEventC.id);
        }
        if (!subEventC.dependencies.predecessors.includes(subEventA.id)) {
          subEventC.dependencies.predecessors.push(subEventA.id);
        }
      }
    }
  }

  public getSubEventsByWrapId(wrapId: number): EventDetail[] {
    const configs = this.mixConfig.filter(c => c.wrapId === wrapId);
    return configs
      .flatMap(c => c.subEventIds)
      .map(id => this.eventMap.get(id))
      .filter((e): e is EventDetail => e !== undefined);
  }

  public getAllSubEvents(): EventDetail[] {
    return this.mixConfig
      .flatMap(c => c.subEventIds)
      .map(id => this.eventMap.get(id))
      .filter((e): e is EventDetail => e !== undefined);
  }

  public isMixedData(): boolean {
    let hasAicpu = false;
    let hasKernel = false;
    for (const [_, process] of Array.from(this.processInfo.entries())) {
        if (process.type === 'aicpu') {
            hasAicpu = true;
        } else {
            hasKernel = true;
        }
    }
    return hasAicpu && hasKernel;
  }

  public setMixMode(isMixMode: boolean): void {
    this.isMixModeActive = isMixMode;
  }

  public getMixMode(): boolean {
    return this.isMixModeActive;
  }

  public hasMixConfig(): boolean {
    return this.mixConfig.length > 0;
  }

  public getSwimLaneOrder(): SwimLaneItem[] {
    return this.swimLaneOrder;
  }

  public getWrapContainers(): WrapContainerInfo[] {
    return Array.from(this.wrapContainers.values());
  }

  public getWrapContainerByWrapId(wrapId: number): WrapContainerInfo | undefined {
    return this.wrapContainers.get(wrapId);
  }

  public getTotalLaneHeight(): number {
    let totalHeight = 0;
    for (const lane of this.swimLaneOrder) {
      totalHeight += lane.height;
    }
    return totalHeight;
  }

  public calculateMixLayout(layout: any, lane2line: Map<string, number>): void {
    this.lane2line = lane2line;
    this.buildWrapThreadMap();
    this.buildMixThreads();
    this.buildSwimLaneOrder(layout);
    this.buildWrapContainers();
    this.calculateYPositions(layout);
  }

  private buildWrapThreadMap(): void {
    this.wrapThreadMap.clear();
    
    for (const config of this.mixConfig) {
      const wrapId = config.wrapId;
      if (!this.wrapThreadMap.has(wrapId)) {
        this.wrapThreadMap.set(wrapId, []);
      }
      
      const parentEvent = this.eventMap.get(config.parentEventId);
      if (parentEvent) {
        const thread = this.getThreadByEvent(parentEvent.id);
        if (thread) {
          const existingThreads = this.wrapThreadMap.get(wrapId);
          if (existingThreads && !existingThreads.some(t => t.tid === thread.tid)) {
            existingThreads.push(thread);
          }
        }
      }
    }
  }

  private buildMixThreads(): void {
    this.mixThreads = [];
    
    const allMixThreads = new Set<ThreadInfo>();
    for (const threads of Array.from(this.wrapThreadMap.values())) {
      for (const thread of threads) {
        allMixThreads.add(thread);
      }
    }
    
    this.mixThreads = Array.from(allMixThreads);
    this.sortMixThreads();
  }

  private sortMixThreads(): void {
    const computeThreads = this.mixThreads.filter(t => this.isComputeThread(t));
    const vectorThreads = this.mixThreads.filter(t => this.isVectorThread(t));
    
    vectorThreads.sort((a, b) => Number(a.tid) - Number(b.tid));
    computeThreads.sort((a, b) => Number(a.tid) - Number(b.tid));
    
    this.mixThreads = [...vectorThreads, ...computeThreads];
  }

  private buildSwimLaneOrder(layout: any): void {
    this.swimLaneOrder = [];
    
    const fakeCoreThreads = this.getFakeCoreThreads();
    for (const thread of fakeCoreThreads) {
      const threadHeight = this.getThreadHeight(thread, layout);
      this.swimLaneOrder.push({
        type: 'thread',
        thread,
        y: 0,
        height: threadHeight,
        wrapIds: []
      });
    }
    
    const wrapGroups = this.buildWrapGroups();
    const wrapLabelHeight = layout.threadHeight;
    
    for (const group of wrapGroups) {
      const wrapStartTimes = group.wrapIds.map(id => this.getWrapStartTime(id));
      const wrapStartTime = Math.min(...wrapStartTimes);
      
      this.swimLaneOrder.push({
        type: 'wrap-label',
        wrapId: group.wrapIds[0],
        wrapIds: group.wrapIds,
        wrapStartTimes,
        label: `Wrap`,
        y: 0,
        height: wrapLabelHeight,
        startTime: wrapStartTime
      });
      
      const sortedThreads = this.sortThreadsForWrap(group.threads);
      
      for (const thread of sortedThreads) {
        const threadHeight = this.getThreadHeight(thread, layout);
        this.swimLaneOrder.push({
          type: 'thread',
          thread,
          y: 0,
          height: threadHeight,
          wrapIds: group.wrapIds
        });
      }
    }
    
    const { nonCounterThreads, counterThreads } = this.getNonMixThreadsSorted();
    
    for (const thread of nonCounterThreads) {
      const threadHeight = this.getThreadHeight(thread, layout);
      this.swimLaneOrder.push({
        type: 'thread',
        thread,
        y: 0,
        height: threadHeight,
        wrapIds: []
      });
    }
    
    for (const thread of counterThreads) {
      const threadHeight = this.getThreadHeight(thread, layout);
      this.swimLaneOrder.push({
        type: 'thread',
        thread,
        y: 0,
        height: threadHeight,
        wrapIds: []
      });
    }
  }
  
  private buildWrapGroups(): { wrapIds: number[]; threads: ThreadInfo[]; cTid: number }[] {
    const wrapIds = Array.from(this.wrapThreadMap.keys());
    const parent: Map<number, number> = new Map();
    
    for (const wrapId of wrapIds) {
      parent.set(wrapId, wrapId);
    }
    
    const find = (id: number): number => {
      if (parent.get(id) !== id) {
        parent.set(id, find(parent.get(id)!));
      }
      return parent.get(id)!;
    };
    
    const union = (id1: number, id2: number): void => {
      const root1 = find(id1);
      const root2 = find(id2);
      if (root1 !== root2) {
        parent.set(root1, root2);
      }
    };
    
    const threadToWraps: Map<string, number[]> = new Map();
    for (const wrapId of wrapIds) {
      const threads = this.wrapThreadMap.get(wrapId) || [];
      for (const thread of threads) {
        if (!threadToWraps.has(thread.tid)) {
          threadToWraps.set(thread.tid, []);
        }
        threadToWraps.get(thread.tid)!.push(wrapId);
      }
    }
    
    for (const [, wraps] of threadToWraps) {
      if (wraps.length > 1) {
        for (let i = 1; i < wraps.length; i++) {
          union(wraps[0], wraps[i]);
        }
      }
    }
    
    const groups: Map<number, { wrapIds: number[]; threads: ThreadInfo[] }> = new Map();
    for (const wrapId of wrapIds) {
      const root = find(wrapId);
      if (!groups.has(root)) {
        groups.set(root, { wrapIds: [], threads: [] });
      }
      const group = groups.get(root)!;
      group.wrapIds.push(wrapId);
      const threads = this.wrapThreadMap.get(wrapId) || [];
      for (const thread of threads) {
        if (!group.threads.some(t => t.tid === thread.tid)) {
          group.threads.push(thread);
        }
      }
    }
    
    const result = Array.from(groups.values()).map(group => ({
      ...group,
      cTid: this.getComputeTidFromThreads(group.threads)
    }));
    
    result.sort((a, b) => a.cTid - b.cTid);
    
    return result;
  }

  private buildWrapContainers(): void {
    this.wrapContainers.clear();
    
    for (const [wrapId, subEvents] of Array.from(this.eventsByWrapId.entries())) {
      const parentEvents = subEvents.filter(e => e.subEventIds && e.subEventIds.length > 0);
      
      if (parentEvents.length === 0) continue;
      
      const allSubEvents = parentEvents.flatMap(e => 
        this.getSubEvents(e.id)
      );
      
      if (allSubEvents.length === 0) continue;
      
      const minStartTime = Math.min(...allSubEvents.map(e => e.startTime));
      const maxEndTime = Math.max(...allSubEvents.map(e => e.endTime));
      
      const threadTids = new Set<string>();
      for (const parentEvent of parentEvents) {
        const thread = this.getThreadByEvent(parentEvent.id);
        if (thread) {
          threadTids.add(thread.tid);
        }
      }
      
      this.wrapContainers.set(wrapId, {
        wrapId,
        label: `Wrap ${wrapId}`,
        minStartTime,
        maxEndTime,
        threadTids: Array.from(threadTids)
      });
    }
  }

  private calculateYPositions(layout: any): void {
    let currentY = 0;
    
    for (const lane of this.swimLaneOrder) {
      lane.y = currentY;
      
      if (lane.type === 'thread') {
        lane.thread.renderInfo = {
          startY: currentY,
          height: lane.height
        };
      }
      
      currentY += lane.height;
    }
  }

  private sortThreadsForWrap(threads: ThreadInfo[]): ThreadInfo[] {
    const computeThreads = threads.filter(t => this.isComputeThread(t));
    const vectorThreads = threads.filter(t => this.isVectorThread(t));
    
    vectorThreads.sort((a, b) => Number(a.tid) - Number(b.tid));
    computeThreads.sort((a, b) => Number(a.tid) - Number(b.tid));
    
    if (vectorThreads.length === 1 && computeThreads.length === 1) {
      return [vectorThreads[0], computeThreads[0]];
    } else if (vectorThreads.length === 2 && computeThreads.length === 1) {
      return [vectorThreads[0], computeThreads[0], vectorThreads[1]];
    }
    
    return [...vectorThreads, ...computeThreads];
  }

  private getComputeTidFromThreads(threads: ThreadInfo[]): number {
    const computeThread = threads.find(t => this.isComputeThread(t));
    return computeThread ? Number(computeThread.tid) : 0;
  }

  private isComputeThread(thread: ThreadInfo): boolean {
    return thread.threadName.includes('AIC_');
  }

  private isVectorThread(thread: ThreadInfo): boolean {
    return thread.threadName.includes('AIV_');
  }

  public getWrapStartTime(wrapId: number): number {
    const subEvents = this.getSubEventsByWrapId(wrapId);
    if (subEvents.length === 0) return 0;
    return Math.min(...subEvents.map(e => e.startTime));
  }

  private getFakeCoreThreads(): ThreadInfo[] {
    const fakeCoreThreads: ThreadInfo[] = [];
    
    for (const [processKey, process] of Array.from(this.processInfo.entries())) {
      for (const [threadKey, thread] of Array.from(process.threads.entries())) {
        if (thread.isFakeCore || thread.threadName.includes('Fake Core')) {
          fakeCoreThreads.push(thread);
          break;
        }
      }
    }
    
    return fakeCoreThreads;
  }

  private getNonMixThreads(): ThreadInfo[] {
    const nonMixThreads: ThreadInfo[] = [];
    
    for (const [processKey, process] of Array.from(this.processInfo.entries())) {
      for (const [threadKey, thread] of Array.from(process.threads.entries())) {
        const isMixThread = this.mixThreads.some(mt => mt.tid === thread.tid);
        if (!isMixThread) {
          nonMixThreads.push(thread);
        }
      }
    }
    
    return nonMixThreads;
  }

  private getNonMixThreadsSorted(): { nonCounterThreads: ThreadInfo[], counterThreads: ThreadInfo[] } {
    const nonMixThreads = this.getNonMixThreads();
    
    const nonCounterThreads = nonMixThreads.filter(t => !t.isCounter && !t.isFakeCore && !t.threadName.includes('Fake Core'));
    const counterThreads = nonMixThreads.filter(t => t.isCounter && !t.isFakeCore && !t.threadName.includes('Fake Core'));
    
    nonCounterThreads.sort((a, b) => Number(a.tid) - Number(b.tid));
    counterThreads.sort((a, b) => Number(a.tid) - Number(b.tid));
    
    return { nonCounterThreads, counterThreads };
  }

  private getThreadHeight(thread: ThreadInfo, layout: any): number {
    if (thread.isCounter) {
      return layout.counterHeight;
    }
    
    const processKey = this.getProcessKeyByThread(thread);
    const cacheKey = `${processKey}@${thread.tid}`;
    const lineCount = this.lane2line.get(cacheKey) || 1;
    return layout.threadHeight * lineCount;
  }
  
  private getProcessKeyByThread(thread: ThreadInfo): string {
    for (const [processKey, process] of Array.from(this.processInfo.entries())) {
      for (const [threadKey, t] of Array.from(process.threads.entries())) {
        if (t.tid === thread.tid) {
          return processKey;
        }
      }
    }
    return '';
  }

  public isMixParentEvent(event: EventDetail): boolean {
    return Array.isArray(event.subEventIds) && event.subEventIds.length > 0;
  }

  public getMixThreadFlattenedEvents(thread: ThreadInfo): EventDetail[] {
    const parentEvents = thread.eventIds
      .map(id => this.getEventById(id))
      .filter(e => e && this.isMixParentEvent(e));

    const events: EventDetail[] = [];

    for (const parentEvent of parentEvents) {
      const subEvents = this.getSubEvents(parentEvent.id);
      for (const subEvent of subEvents) {
        (subEvent as any)._mixEventType = 'subEvent';
        events.push(subEvent);
      }
      const waitTasks = this.getWaitTasks(parentEvent.id);
      for (const waitTask of waitTasks) {
        (waitTask as any)._mixEventType = 'waitTask';
        events.push(waitTask);
      }
    }

    const normalEvents = thread.eventIds
      .map(id => this.getEventById(id))
      .filter(e => e && !this.isMixParentEvent(e));
    for (const normalEvent of normalEvents) {
      (normalEvent as any)._mixEventType = 'normalEvent';
      events.push(normalEvent);
    }

    events.sort((a, b) => a.startTime - b.startTime);
    return events;
  }

  public getThreadYByTid(tid: string): number {
    for (const lane of this.swimLaneOrder) {
      if (lane.type === 'thread' && lane.thread.tid === tid) {
        return lane.y;
      }
    }
    return 0;
  }

  public getWrapLabelY(wrapId: number): number {
    for (const lane of this.swimLaneOrder) {
      if (lane.type === 'wrap-label' && lane.wrapId === wrapId) {
        return lane.y;
      }
    }
    return 0;
  }
}

export const swimDataManager = SwimDataManager.getInstance();

export default SwimDataManager;
