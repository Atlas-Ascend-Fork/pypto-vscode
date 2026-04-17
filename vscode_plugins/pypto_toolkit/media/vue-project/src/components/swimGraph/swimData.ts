export interface ThreadInfo {
  tid: string;
  threadName: string;
  eventIds: string[];
  isCounter?: boolean;
  isFakeCore?: boolean;
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
}

class SwimDataManager {
  private static instance: SwimDataManager;
  
  public processInfo: Map<string, ProcessInfo>;
  public eventMap: Map<string, EventDetail>;
  
  private constructor() {
    this.processInfo = new Map();
    this.eventMap = new Map();
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
    
    for (const [processKey, process] of Array.from(processes.entries())) {
      const threadInfoMap = new Map<string, ThreadInfo>();
      
      if (process.threads) {
        for (const [threadKey, thread] of process.threads.entries()) {
          const eventIds: string[] = [];
          
          if (thread.events && Array.isArray(thread.events)) {
            for (const event of thread.events) {
              eventIds.push(event.id);
              
              const eventDetail: EventDetail = {
                ...event,
                processKey,
                threadKey
              };
              this.eventMap.set(event.id, eventDetail);
            }
          }
          
          const threadInfo: ThreadInfo = {
            tid: thread.tid || threadKey,
            threadName: thread.threadName || '',
            eventIds,
            isCounter: thread.isCounter,
            isFakeCore: thread.threadName.includes('Fake Core')
          };
          
          threadInfoMap.set(threadKey, threadInfo);
        }
      }
      
      const processInfoItem: ProcessInfo = {
        pid: process.pid || processKey,
        name: process.name || '',
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
    for (const threadInfo of Array.from(process.threads.values())) {
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
  }
  
  public updateEvent(eventId: string, updates: Partial<EventDetail>): void {
    const event = this.eventMap.get(eventId);
    if (event) {
      Object.assign(event, updates);
    }
  }

  public isMixedData(): boolean {
    let hasAicpu = false;
    let hasKernel = false;
    for (const [_, process] of this.processInfo.entries()) {
        if (process.type === 'aicpu') {
            hasAicpu = true;
        } else {
            hasKernel = true;
        }
    }
    return hasAicpu && hasKernel;
}
}

export const swimDataManager = SwimDataManager.getInstance();

export default SwimDataManager;
