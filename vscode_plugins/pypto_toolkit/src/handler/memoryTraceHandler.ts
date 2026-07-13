/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { createReadStream } from 'fs';
const { parser } = require('stream-json');
const { streamValues } = require('stream-json/streamers/StreamValues');
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
    const eventRecords = await getMemoryTraceEventStore().query().filter({ filePath }).exec();
    const records = await getMemoryTraceCacheStore().query().filter({ filePath }).exec();
    if (records.length === 0 || eventRecords.length === 0) {
      return false;
    }
    const cached = records[0];
    const fileStat = await fs.stat(filePath);
    return fileStat.mtimeMs === cached.mtime;
  }

  static async saveToCache(fsPath: string, data: any): Promise<void> {
    const timeline = data.timeline || [];
    if (timeline.length === 0) return;

    const bufferMap = new Map<number, BufferState>(); 
    let gmIndex = 0;
    const eventsToSave: any[] = []; // 收集所有待入库的事件对象

    for (let index = 0; index < timeline.length; index++) {
      const e = timeline[index];
      const targetBufferList: BufferState[] = [];
      const originBufferListSnapshot: BufferState[] = []; // 用于快照当前状态

      // 生成当前状态的快照
      bufferMap.forEach(val => originBufferListSnapshot.push({ ...val }));

      if (e.eventType === 'ALLOC_EXEC') {
        const newBuffer: BufferState = {
          memId: e.memId, memType: e.memType, addrStart: e.addrStart, size: e.size, status: 1,
        };
        targetBufferList.push(newBuffer);
        bufferMap.set(e.memId, newBuffer);

      } else if (e.eventType === 'OP_LAUNCH') {
        // 处理输入
        if (e.inputMemIds.length > 0) {
          for (const id of e.inputMemIds) {
            const inputBuffer = bufferMap.get(id);
            if (inputBuffer) targetBufferList.push({ ...inputBuffer });
          }
        }
        // 处理输出
        if (e.outputMemIds.length > 0) {
          for (const id of e.outputMemIds) {
            const outputBuffer = bufferMap.get(id);
            if (outputBuffer) {
              const updatedBuffer = { ...outputBuffer, status: 2 };
              targetBufferList.push(updatedBuffer);
              bufferMap.set(id, updatedBuffer); // 更新 Map
            }
          }
        }
      } else if (e.eventType === 'OP_RETIRE') {
        if (e.freedMemIds.length > 0) {
          for (const id of e.freedMemIds) {
            const freedBuffer = bufferMap.get(id);
            if (freedBuffer) {
              targetBufferList.push({ ...freedBuffer, status: 0 });
              bufferMap.delete(id); // 释放后从 Map 移除
            }
          }
        }
      } else if (e.eventType === 'SPILL') {
        const freedBuffer = bufferMap.get(e.memId);
        if (freedBuffer) {
          targetBufferList.push({ ...freedBuffer, status: 0 });
          bufferMap.delete(e.memId);
        }
        const spillBuffer: BufferState = {
          memId: e.spillDdrMemId, memType: 'MEM_GM',
          addrStart: gmIndex * 32 * 1024 * 1024, size: 32 * 1024 * 1024, status: 2,
        };
        targetBufferList.push(spillBuffer);
        bufferMap.set(e.spillDdrMemId, spillBuffer);
        gmIndex++;
      } else if (e.eventType === 'BUFFER_REARRANGE') {
        for (const change of e.changes) {
          const changeBuffer = bufferMap.get(change.memId);
          if (changeBuffer) {
            const updatedBuffer = { ...changeBuffer, addrStart: change.newStart };
            targetBufferList.push(updatedBuffer);
            bufferMap.set(change.memId, updatedBuffer);
          }
        }
      } else if (e.eventType === 'INIT_DDR_BUFFER') {
        const initBuffer: BufferState = {
          memId: e.memId, memType: 'MEM_GM',
          addrStart: gmIndex * 32 * 1024 * 1024, size: 32 * 1024 * 1024, status: 2,
        };
        targetBufferList.push(initBuffer);
        bufferMap.set(e.memId, initBuffer);
        gmIndex++;
      }

      // 组装事件对象并加入待保存队列
      const eventPayload: any = {
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
    await getMemoryTraceEventStore().batchSet(eventsToSave);
    
    console.log(`[MemoryTrace] Caching ${timeline.length} events for: ${fsPath}`);

    const clockMap = new Map<number, MemoryTraceEvent[]>();
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

  static async getTimeline(fsPath: string): Promise<ClockEvents[]> {
  const cache = await getMemoryTraceCacheStore().find({filePath:fsPath});
  if (!cache) return [];
  
  // 直接解析预聚合数据（无需分组计算）
  const result = JSON.parse(cache.timelineData).map(([clock, events]) => ({ clock, events }));
  return result;
}

  static async getTimelineEvents(fsPath: string): Promise<any> {
    const timeline = await this.getTimeline(fsPath);
    return timeline;
  }
}
