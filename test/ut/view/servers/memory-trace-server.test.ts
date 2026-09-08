/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock(import('../../../../src/handler/memoryTraceHandler'), () => ({
  MemoryTraceHandler: {
    parse: vi.fn().mockResolvedValue(undefined),
    getMetadata: vi.fn().mockResolvedValue({ meta: 'data' }),
    getTimelineEvents: vi.fn().mockResolvedValue([{ clock: 1 }]),
  },
}));

vi.mock(import('../../../../src/core/view/view-server'), () => {
  class MockViewServer {
    static _viewConfig: any = { apis: ['closeWebview'], refs: [] };
    _refMap = new Map<string, unknown>();
    _disposables: any[] = [];
    constructor(ctx: any) {
      ctx.init.call(this);
    }
    created(_ctx: any) {}
    setRef(key: string, value: unknown) {
      this._refMap.set(key, value);
    }
    getRef(key: string) {
      return this._refMap.get(key);
    }
    closeWebview() {}
    dispose() {}
  }
  return {
    ViewServer: MockViewServer,
    viewApi: () => () => {},
    viewRefs: () => () => {},
  };
});

import { MemoryTraceServer } from '../../../../src/view/servers/memory-trace-server';
import { MemoryTraceHandler } from '../../../../src/handler/memoryTraceHandler';

function createServer(query: unknown = { _path: '/test/trace.json' }) {
  const ctx = {
    viewType: 'memoryTrace',
    fileUri: { fsPath: '/test/trace.json', query },
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(),
  };
  const server = new MemoryTraceServer(ctx as any);
  if (query && typeof query === 'object') {
    server.query = query;
  }
  return { server, ctx };
}

describe('MemoryTraceServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('safeParse returns parsed object for valid JSON', () => {
    const { server } = createServer();
    expect(server.safeParse('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('safeParse returns empty object for invalid JSON', () => {
    const { server } = createServer();
    expect(server.safeParse('not json')).toEqual({});
  });

  it('created parses string query and triggers initial data load', async () => {
    const { server, ctx } = createServer(JSON.stringify({ _path: '/test/trace.json' }));

    server.created(ctx as any);
    await vi.waitFor(() => expect(server.getRef('InitMemoryTraceFlag')).toBe('true'));

    expect(server.query).toEqual({ _path: '/test/trace.json' });
    expect(MemoryTraceHandler.parse).toHaveBeenCalledWith('/test/trace_OoO_Memory_Trace.json');
    expect(MemoryTraceHandler.getMetadata).toHaveBeenCalledWith('/test/trace.json');
    expect(server.getRef('Metadata')).toEqual({ meta: 'data' });
  });

  it('created uses object query as-is', async () => {
    const { server, ctx } = createServer({ _path: '/test/other.json' });

    server.created(ctx as any);
    await vi.waitFor(() => expect(server.getRef('InitMemoryTraceFlag')).toBe('true'));

    expect(server.query).toEqual({ _path: '/test/other.json' });
  });

  it('getInitialData keeps path already ending with memory trace suffix', async () => {
    const { server } = createServer({ _path: '/test/trace_OoO_Memory_Trace.json' });

    await server.getInitialData();

    expect(MemoryTraceHandler.parse).toHaveBeenCalledWith('/test/trace_OoO_Memory_Trace.json');
    expect(server.getRef('InitMemoryTraceFlag')).toBe('true');
  });

  it('getInitialData skips loading when path is empty', async () => {
    const { server } = createServer({ _path: '' });

    await server.getInitialData();

    expect(MemoryTraceHandler.parse).not.toHaveBeenCalled();
    expect(MemoryTraceHandler.getMetadata).not.toHaveBeenCalled();
    expect(server.getRef('InitMemoryTraceFlag')).toBe('true');
  });

  it('getInitialData completes initialization without throwing when _path is undefined', async () => {
    const { server } = createServer({});

    await server.getInitialData();

    expect(MemoryTraceHandler.parse).not.toHaveBeenCalled();
    expect(MemoryTraceHandler.getMetadata).not.toHaveBeenCalled();
    expect(server.getRef('InitMemoryTraceFlag')).toBe('true');
  });

  it('getInitialData completes initialization without throwing when query is missing', async () => {
    const ctx = {
      viewType: 'memoryTrace',
      fileUri: { fsPath: '/test/trace.json', query: undefined },
      init: vi.fn(),
      setRef: vi.fn(),
      closeWebview: vi.fn(),
    };
    const server = new MemoryTraceServer(ctx as any);
    server.query = undefined;

    await server.getInitialData();

    expect(MemoryTraceHandler.parse).not.toHaveBeenCalled();
    expect(server.getRef('InitMemoryTraceFlag')).toBe('true');
  });

  it('getMetadata sets Metadata ref', async () => {
    const { server } = createServer();

    await server.getMetadata();

    expect(MemoryTraceHandler.getMetadata).toHaveBeenCalledWith('/test/trace.json');
    expect(server.getRef('Metadata')).toEqual({ meta: 'data' });
  });

  it('getTimelineEvents sets Timeline ref', async () => {
    const { server } = createServer();

    await server.getTimelineEvents();

    expect(MemoryTraceHandler.getTimelineEvents).toHaveBeenCalledWith('/test/trace.json');
    expect(server.getRef('Timeline')).toEqual([{ clock: 1 }]);
  });
});
