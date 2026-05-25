import { createReadStream } from 'fs';
const { parser } = require('stream-json');
const { streamValues } = require('stream-json/streamers/StreamValues');
import * as fs from 'fs/promises';
import { getMemoryTraceCacheStore, getMemoryTraceEventStore, MemoryTraceEvent,BufferState } from '../core/sqlInit';

export interface MemoryTraceMetadata {
  totalCycles: number;
  scheduleResult: string;
  chipArch: string;
  dumpFile?: string;
}

export interface OpInfo {
  opMagic: number;
  execOrder: number;
  pipeType: string;
  coreType: string;
  coreIdx: number;
}

export interface TensorInfo {
  memId: number;
  rawSize: number;
  memType: string;
  coreType: string;
  coreIdx: number;
  bornClock: number;
  diedClock: number;
  logicalTensors: Array<{
    magic: number;
    validSize: number;
  }>;
}


export interface ClockEvents {
  clock:number;
  events:MemoryTraceEvent[];
}
export interface FrontendEvent {
  clockEvents:ClockEvents[];
}

export interface FrontendBuffer {
  memoryId: string;
  startLocation: number;
  size: number;
  status: 'initialized' | 'valid';
  address: string;
}

export class MemoryTraceHandler {
  static async parse(fsPath: string): Promise<void> {
    try {
      if (await this.isCacheValid(fsPath)) {
        console.log(`[MemoryTrace] Cache hit for: ${fsPath}`);
        return;
      }
    } catch (err) {
      console.log(`[MemoryTrace] Cache check failed for: ${fsPath}, will parse normally`);
    }

    console.log(`[MemoryTrace] Cache miss for: ${fsPath}`);
    const { size } = await fs.stat(fsPath);

    let data: any;
    if (size < 200 * 1024 * 1024) {
      const buffer = await fs.readFile(fsPath);
      data = JSON.parse(buffer.toString());
    } else {
      data = await this.readWithStream(fsPath);
    }

    await this.saveToCache(fsPath, data);
  }

  private static async readWithStream(fsPath: string): Promise<any> {
    const fileStream = createReadStream(fsPath);
    const jsonParser = parser();
    const valuesStreamer = streamValues();
    let streamError: Error | null = null;

    fileStream.on('error', (err) => (streamError = Object.assign(err, { code: 'FILE_READ_ERROR' })));
    jsonParser.on('error', (err: any) => (streamError = Object.assign(err, { code: 'JSON_PARSE_ERROR' })));
    valuesStreamer.on('error', (err: any) => (streamError = Object.assign(err, { code: 'STREAM_ERROR' })));

    fileStream.pipe(jsonParser).pipe(valuesStreamer);

    let data: any = null;
    for await (const { value } of valuesStreamer) {
      if (streamError) {
        throw streamError;
      }
      data = value;
    }

    if (streamError) {
      throw streamError;
    }

    return data;
  }

  static async isCacheValid(filePath: string): Promise<boolean> {
    const records = await getMemoryTraceCacheStore().query().filter({ filePath }).exec();
    if (records.length === 0) {
      return false;
    }
    const cached = records[0];
    const fileStat = await fs.stat(filePath);
    return fileStat.mtimeMs === cached.mtime;
  }

  static async saveToCache(fsPath: string, data: any): Promise<void> {
    const fileStat = await fs.stat(fsPath);
    const timeline = data.timeline || [];

    const cacheRecord = {
      filePath: fsPath,
      totalCycles: data.metadata?.totalCycles || 0,
      chipArch: data.metadata?.chipArch || '',
      mtime: fileStat.mtimeMs,
      createdAt: Date.now(),
    };
    await getMemoryTraceCacheStore().set(cacheRecord);

    // 写入 events 表（保留原有功能）
    let originBufferList:BufferState[] = []; // 记录初始所有buffer的情况
    let gmIndex = 0; 
    for (let index = 0; index < timeline.length; index++) {
      const e = timeline[index];
      let targetBufferList:BufferState[] =  []; // 记录当前变化buffer的情况
      if(e.eventType == "ALLOC_EXEC"){
        targetBufferList.push({
          memId: e.memId,
          memType:e.memType,
          addrStart:e.addrStart,
          size: e.size,
          status: 1
        });
        
        await getMemoryTraceEventStore().set({
          id: index,
          filePath: fsPath,
          ...e,
          action: {
            targetBufferList: targetBufferList,
            originBufferList: originBufferList,
          },
        });

        originBufferList.push({
          memId: e.memId,
          memType:e.memType,
          addrStart:e.addrStart,
          size: e.size,
          status: 1
        });
      }else if(e.eventType == "OP_LAUNCH"){
        if(e.inputMemIds.length != 0){
          for(let i = 0; i < e.inputMemIds.length; i++){
            const inputBuffer = originBufferList.find(item => item.memId === e.inputMemIds[i]);
            if(inputBuffer) {
              targetBufferList.push({ ...inputBuffer });
            }
          }
        }
        if(e.outputMemIds.length != 0){
          for(let i = 0; i < e.outputMemIds.length; i++){
            const outputBuffer = originBufferList.find(item => item.memId === e.outputMemIds[i]);
            if(outputBuffer) {
              outputBuffer.status = 2;
              targetBufferList.push({ ...outputBuffer });
            }
          }
        }
        await getMemoryTraceEventStore().set({
          id: index,
          filePath: fsPath,
          ...e,
          action: {
            targetBufferList: targetBufferList,
            originBufferList: originBufferList,
          },
        });
        // 修改 originBufferList
        for(let i = 0; i < targetBufferList.length; i++){
          const outputBuffer = originBufferList.find(item => item.memId === targetBufferList[i].memId);
          if(outputBuffer) {
            outputBuffer.status = 2;
          }
        }
      }else if(e.eventType == "OP_RETIRE"){
        if(e.freedMemIds.length != 0){
          for(let i = 0; i < e.freedMemIds.length; i++){
            const freedBuffer = originBufferList.find(item => item.memId === e.freedMemIds[i]);
            if(freedBuffer) {
              freedBuffer.status = 0;
              targetBufferList.push({ ...freedBuffer });
            }
          }
        }
        await getMemoryTraceEventStore().set({
          id: index,
          filePath: fsPath,
          ...e,
          action: {
            targetBufferList: targetBufferList,
            originBufferList: originBufferList,
          },
        });
        // 修改 originBufferList
        for(let i = 0; i < targetBufferList.length; i++){
          const freedBufferIndex = originBufferList.findIndex(item => item.memId === targetBufferList[i].memId);
          if(freedBufferIndex !== -1) {
            originBufferList.splice(freedBufferIndex,1);
          }
        }
      }else if(e.eventType == "SPILL"){
        // 暂无样例数据
      }else if(e.eventType == "BUFFER_REARRANGE"){
        // 暂无样例数据
      }else if(e.eventType == "ALLOC_FAIL"){
        // 暂无样例数据
      }else if(e.eventType == "INIT"){
        targetBufferList.push({
          memId: e.memId,
          memType:e.memType,
          addrStart:gmIndex * 32 *1024 * 1024,
          size: 32 *1024 * 1024,
          status: 2
        });
        await getMemoryTraceEventStore().set({
          id: index,
          filePath: fsPath,
          ...e,
          action: {
            targetBufferList: targetBufferList,
            originBufferList: originBufferList,
          },
        });
        originBufferList.push({
          memId: e.memId,
          memType:e.memType,
          addrStart:gmIndex * 32 *1024 * 1024,
          size: 32 * 1024 * 1024,
          status: 2
        });
        gmIndex++;
      }
    }
    console.log(`[MemoryTrace] Caching ${timeline.length} events for: ${fsPath}`);
  }

  static async getMetadata(fsPath: string): Promise<MemoryTraceMetadata | null> {
    const records = await getMemoryTraceCacheStore().query().filter({ filePath: fsPath }).exec();
    if (records.length === 0) {
      return null;
    }

    const cached = records[0];
    return {
      totalCycles: cached.totalCycles,
      scheduleResult: '',
      chipArch: cached.chipArch
    };
  }

  // static async getClockList(fsPath: string): Promise<{ clock: number; eventCount: number }[]> {
  //   const records = await getMemoryTraceBufferStateStore().query()
  //     .filter({ filePath: fsPath })
  //     .sort('clock', 'asc')
  //     .exec();

  //   return records.map(r => ({
  //     clock: r.clock,
  //     eventCount: JSON.parse(r.bufferData || '[]').length,
  //   }));
  // }

  // static async getBufferState(fsPath: string, clock: number): Promise<BufferState[]> {
  //   const records = await getMemoryTraceBufferStateStore().query()
  //     .filter({ filePath: fsPath, clock })
  //     .exec();

  //   if (records.length === 0) {
  //     return [];
  //   }

  //   const tensors: TensorInfo[] = JSON.parse(records[0].bufferData || '[]');
  //   return tensors.map(t => ({
  //     memId: t.memId,
  //     memType: t.memType,
  //     addrStart: 0,
  //     addrEnd: t.rawSize,
  //     size: t.rawSize,
  //     status: 'allocated',
  //     bornClock: t.bornClock,
  //     diedClock: t.diedClock,
  //   }));
  // }

  // static toFrontendBuffer(bufferState: BufferState): FrontendBuffer {
  //   let status: 'initialized' | 'valid' = 'initialized';
  //   if (bufferState.status === 'allocated') {
  //     status = 'valid';
  //   }

  //   return {
  //     memoryId: bufferState.memId.toString(),
  //     startLocation: bufferState.addrStart,
  //     size: bufferState.size,
  //     status,
  //     address: bufferState.addrStart.toString(16),
  //   };
  // }

  // static async getFrontendBufferState(fsPath: string, clock: number): Promise<FrontendBuffer[]> {
  //   const bufferStates = await this.getBufferState(fsPath, clock);
  //   return bufferStates.map(b => this.toFrontendBuffer(b));
  // }

 
  static async getTimeline(fsPath: string): Promise<ClockEvents[]> {
    const allEvents = await getMemoryTraceEventStore().query()
      .filter({ filePath: fsPath })
      .exec();
    // 1. 创建一个 Map，key 是 clock，value 是该 clock 下的事件数组
    const clockMap = new Map<number, MemoryTraceEvent[]>();

    // 2. 遍历原始数据，进行分组
    for (const event of allEvents) {
      if (!clockMap.has(event.clock)) {
        clockMap.set(event.clock, []);
      }
      clockMap.get(event.clock)!.push(event);
    }

    // 3. 将 Map 转换成你需要的 ClockEvents[] 数组格式
    const clockEvents: ClockEvents[] = Array.from(clockMap.entries()).map(([clock, events]) => ({
      clock,
      events
    }));

    // 4. 如果需要按时间顺序排序（可选）
    clockEvents.sort((a, b) => a.clock - b.clock);

    return clockEvents;
  }

  static async getTimelineEvents(fsPath: string): Promise<any> {
    const timeline = await this.getTimeline(fsPath);
    return timeline;
  }

  // static toFrontendEvent(timelineEvent: TimelineEvent): FrontendEvent {
  //   return {
  //     id: timelineEvent.id || `event-${timelineEvent.clock}-${timelineEvent._index || 0}`,
  //     eventType: timelineEvent.eventType,
  //     startTime: timelineEvent.startTime || timelineEvent.clock,
  //     endTime: timelineEvent.endTime || timelineEvent.clock,
  //     clock: timelineEvent.clock,
  //     animationData: {
  //       inputMemIds: timelineEvent.inputMemIds,
  //       outputMemIds: timelineEvent.outputMemIds,
  //     },
  //   };
  // }

  // static async getEventsAtClock(fsPath: string, clock: number): Promise<FrontendEvent[]> {
  //   const events = await getMemoryTraceEventStore().query()
  //     .filter({ filePath: fsPath, clock: clock })
  //     .exec();

  //   return events.map((e: any) => this.toFrontendEvent({
  //     ...JSON.parse(e.eventData || '{}'),
  //     clock: e.clock,
  //     eventType: e.eventType,
  //   }));
  // }
}
