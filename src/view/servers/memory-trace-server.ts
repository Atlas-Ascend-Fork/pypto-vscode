/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { MemoryTraceHandler } from '../../handler/memoryTraceHandler';


/**
 * MemoryTraceServer - 内存追踪视图服务
 */
@viewRefs(['Metadata', 'Timeline', 'BufferState', 'ErrorMessage', 'InitMemoryTraceFlag', 'ClockList', 'EventsAtClock'])
export class MemoryTraceServer extends ViewServer<import('./view-server-interface').IMemoryTraceApis, import('./view-server-interface').IMemoryTraceRefs> {
  viewType?: string;
  query?: any;

  public override created(ctx: ViewServerContext): void {
    console.log('[MemoryTrace] Step 1: Server created, viewType:', ctx.viewType);
    this.viewType = ctx.viewType;
    this.query =
      typeof ctx.fileUri?.query === 'string' ? this.safeParse(ctx.fileUri?.query) : ctx.fileUri?.query ?? {};
    this.getInitialData();
  }

  @viewApi()
  public getInitialData = async () => {
    let fsPath = this.query?._path;
    // _path 缺失（如非内存追踪入口打开）时直接完成初始化，避免 undefined.replace 抛 TypeError
    if (!fsPath) {
      this.setRef('InitMemoryTraceFlag', 'true');
      return;
    }
    if (!/_OoO_Memory_Trace\.json$/.test(fsPath)) {
      fsPath = fsPath.replace(/\.json$/, '_OoO_Memory_Trace.json');
    }
    console.log('[MemoryTrace] Step 2: Loading file:', fsPath);
    await MemoryTraceHandler.parse(fsPath);
    const metadata = await MemoryTraceHandler.getMetadata(this.query._path);
    this.setRef('Metadata', metadata);
    console.log('[MemoryTrace] Step 3: Data loaded');
    this.setRef('InitMemoryTraceFlag', 'true');
  };

  @viewApi()
  public getMetadata = async () => {
    const metadata = await MemoryTraceHandler.getMetadata(this.query._path);
    this.setRef('Metadata', metadata);
  };


  // 按clock分好事件
  @viewApi()
  public getTimelineEvents = async () => {
    const events = await MemoryTraceHandler.getTimelineEvents(this.query._path);
    this.setRef('Timeline', events);
  };


  safeParse(str: string) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
