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
