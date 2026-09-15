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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { createReadStream } from 'fs';
import { parser } from 'stream-json';
import { streamValues } from 'stream-json/streamers/stream-values.js';
import * as fs from 'fs/promises';
import { getMemoryTraceCacheStore, getMemoryTraceEventStore, MemoryTraceEvent, BufferState } from '../core/sqlInit';

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

export interface TimelineEvent {
  eventType: string;
  clock: number;
  memId: number;
  memType: string;
  addrStart: number;
  size: number;
  inputMemIds: number[];
  outputMemIds: number[];
  freedMemIds: number[];
  spillDdrMemId: number;
  changes: Array<{ memId: number; newStart: number }>;
  [key: string]: any;
}

export interface EventPayload extends TimelineEvent {
  id: number;
  filePath: string;
  action: {
    targetBufferList: BufferState[];
    originBufferList: BufferState[];
    errorMemType?: string[];
  };
}

export interface GmCounterState {
  index: number;
}

export interface MemoryTraceFileData {
  timeline: TimelineEvent[];
  metadata?: {
    totalCycles?: number;
    chipArch?: string;
  };
}

export interface ClockEvents {
  clock: number;
  events: MemoryTraceEvent[];
}
export interface FrontendEvent {
  clockEvents: ClockEvents[];
}

export interface FrontendBuffer {
  memoryId: string;
  startLocation: number;
  size: number;
  status: 'initialized' | 'valid';
  address: string;
}

export class MemoryTraceHandler {
  private static readonly GM_BUFFER_SIZE = 32 * 1024 * 1024;

  static async parse(fsPath: string): Promise<void> {
    try {
      if (await this.isCacheValid(fsPath)) {
        console.log(`[MemoryTrace] Cache hit for: ${fsPath}`);
        return;
      }
    } catch (err) {
      // 缓存校验失败时降级为重新解析，避免阻塞主流程
      console.log(`[MemoryTrace] Cache check failed for: ${fsPath}, will parse normally`);
    }

    console.log(`[MemoryTrace] Cache miss for: ${fsPath}`);
    const { size } = await fs.stat(fsPath);

    let data: MemoryTraceFileData;
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
    const jsonParser = parser.asStream();
    const valuesStreamer = streamValues.asStream();
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
    const eventRecords = await getMemoryTraceEventStore().query().filter({ filePath }).exec();
    const records = await getMemoryTraceCacheStore().query().filter({ filePath }).exec();
    if (records.length === 0 || eventRecords.length === 0) {
      return false;
    }
    const cached = records[0];
    const fileStat = await fs.stat(filePath);
    return fileStat.mtimeMs === cached.mtime;
  }

  static async saveToCache(fsPath: string, data: MemoryTraceFileData): Promise<void> {
    const timeline = data.timeline || [];
    if (timeline.length === 0) return;

    const bufferMap = new Map<number, BufferState>();
    const gmState: GmCounterState = { index: 0 };
    const eventsToSave: EventPayload[] = [];

    for (let index = 0; index < timeline.length; index++) {
      const e = timeline[index];
      const targetBufferList: BufferState[] = [];
      const originBufferListSnapshot: BufferState[] = [];

      // 生成当前状态的快照
      bufferMap.forEach(val => originBufferListSnapshot.push({ ...val }));

      switch (e.eventType) {
        case 'ALLOC_EXEC':
          this.handleAllocExec(e, bufferMap, targetBufferList, gmState);
          break;
        case 'OP_LAUNCH':
          this.handleOpLaunch(e, bufferMap, targetBufferList, gmState);
          break;
        case 'OP_RETIRE':
          this.handleOpRetire(e, bufferMap, targetBufferList, gmState);
          break;
        case 'SPILL':
          this.handleSpill(e, bufferMap, targetBufferList, gmState);
          break;
        case 'BUFFER_REARRANGE':
          this.handleBufferRearrange(e, bufferMap, targetBufferList, gmState);
          break;
        case 'INIT_DDR_BUFFER':
          this.handleInitDdrBuffer(e, bufferMap, targetBufferList, gmState);
          break;
      }

      // 组装事件对象并加入待保存队列
      const eventPayload: EventPayload = {
        id: index,
        filePath: fsPath,
        ...e,
        action: {
          targetBufferList,
          originBufferList: originBufferListSnapshot,
        },
      };
      // ALLOC_FAIL 特殊字段处理
      if (e.eventType === 'ALLOC_FAIL') {
        eventPayload.action.errorMemType = [e.memType];
      }

      eventsToSave.push(eventPayload);
    }

    // 使用批量接口统一落盘，内部会执行分批事务与统一 db.save()
    // EventPayload 与 MemoryTraceEvent 的 size 字段类型不同（原始 JSON 为 number，DB 存储为 string），
    // 此处依赖 store 内部的序列化进行转换
    await getMemoryTraceEventStore().batchSet(eventsToSave as unknown as MemoryTraceEvent[]);

    console.log(`[MemoryTrace] Caching ${timeline.length} events for: ${fsPath}`);

    const clockMap = new Map<number, EventPayload[]>();
    for (const e of eventsToSave) {
      if (!clockMap.has(e.clock)) clockMap.set(e.clock, []);
      clockMap.get(e.clock)!.push(e);
    }

    const fileStat = await fs.stat(fsPath);
    const cacheRecord = {
      filePath: fsPath,
      totalCycles: data.metadata?.totalCycles || 0,
      chipArch: data.metadata?.chipArch || '',
      mtime: fileStat.mtimeMs,
      createdAt: Date.now(),
      timelineData: JSON.stringify(Array.from(clockMap.entries()))
    };
    await getMemoryTraceCacheStore().set(cacheRecord);
  }

  private static handleAllocExec(
    event: TimelineEvent,
    bufferMap: Map<number, BufferState>,
    targetBufferList: BufferState[],
    _gmState: GmCounterState,
  ): void {
    const newBuffer: BufferState = {
      memId: event.memId, memType: event.memType, addrStart: event.addrStart, size: event.size, status: 1,
    };
    targetBufferList.push(newBuffer);
    bufferMap.set(event.memId, newBuffer);
  }

  private static handleOpLaunch(
    event: TimelineEvent,
    bufferMap: Map<number, BufferState>,
    targetBufferList: BufferState[],
    _gmState: GmCounterState,
  ): void {
    // 处理输入
    if (event.inputMemIds.length > 0) {
      for (const id of event.inputMemIds) {
        const inputBuffer = bufferMap.get(id);
        if (inputBuffer) targetBufferList.push({ ...inputBuffer });
      }
    }
    // 处理输出
    if (event.outputMemIds.length > 0) {
      for (const id of event.outputMemIds) {
        const outputBuffer = bufferMap.get(id);
        if (outputBuffer) {
          const updatedBuffer = { ...outputBuffer, status: 2 };
          targetBufferList.push(updatedBuffer);
          bufferMap.set(id, updatedBuffer);
        }
      }
    }
  }

  private static handleOpRetire(
    event: TimelineEvent,
    bufferMap: Map<number, BufferState>,
    targetBufferList: BufferState[],
    _gmState: GmCounterState,
  ): void {
    if (event.freedMemIds.length > 0) {
      for (const id of event.freedMemIds) {
        const freedBuffer = bufferMap.get(id);
        if (freedBuffer) {
          targetBufferList.push({ ...freedBuffer, status: 0 });
          bufferMap.delete(id);
        }
      }
    }
  }

  private static handleSpill(
    event: TimelineEvent,
    bufferMap: Map<number, BufferState>,
    targetBufferList: BufferState[],
    gmState: GmCounterState,
  ): void {
    const freedBuffer = bufferMap.get(event.memId);
    if (freedBuffer) {
      targetBufferList.push({ ...freedBuffer, status: 0 });
      bufferMap.delete(event.memId);
    }
    const spillBuffer: BufferState = {
      memId: event.spillDdrMemId, memType: 'MEM_GM',
      addrStart: gmState.index * MemoryTraceHandler.GM_BUFFER_SIZE, size: MemoryTraceHandler.GM_BUFFER_SIZE, status: 2,
    };
    targetBufferList.push(spillBuffer);
    bufferMap.set(event.spillDdrMemId, spillBuffer);
    gmState.index++;
  }

  private static handleBufferRearrange(
    event: TimelineEvent,
    bufferMap: Map<number, BufferState>,
    targetBufferList: BufferState[],
    _gmState: GmCounterState,
  ): void {
    for (const change of event.changes) {
      const changeBuffer = bufferMap.get(change.memId);
      if (changeBuffer) {
        const updatedBuffer = { ...changeBuffer, addrStart: change.newStart };
        targetBufferList.push(updatedBuffer);
        bufferMap.set(change.memId, updatedBuffer);
      }
    }
  }

  private static handleInitDdrBuffer(
    event: TimelineEvent,
    bufferMap: Map<number, BufferState>,
    targetBufferList: BufferState[],
    gmState: GmCounterState,
  ): void {
    const initBuffer: BufferState = {
      memId: event.memId, memType: 'MEM_GM',
      addrStart: gmState.index * MemoryTraceHandler.GM_BUFFER_SIZE, size: MemoryTraceHandler.GM_BUFFER_SIZE, status: 2,
    };
    targetBufferList.push(initBuffer);
    bufferMap.set(event.memId, initBuffer);
    gmState.index++;
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
      chipArch: cached.chipArch,
    };
  }

  static async getTimelineEvents(fsPath: string): Promise<ClockEvents[]> {
    const cache = await getMemoryTraceCacheStore().find({ filePath: fsPath });
    if (!cache) return [];

    // 直接解析预聚合数据（无需分组计算）
    const result = JSON.parse(cache.timelineData).map(([clock, events]) => ({ clock, events }));
    return result;
  }
}
