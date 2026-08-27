/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetMTime, mockGetComGraphLayoutStore, mockFork, mockGraphLayout } = vi.hoisted(() => ({
  mockGetMTime: vi.fn().mockResolvedValue('1234567890'),
  mockGetComGraphLayoutStore: vi.fn(() => ({
    find: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  })),
  mockFork: vi.fn(),
  mockGraphLayout: vi.fn(() => null),
}));

vi.mock(import('../../../src/core/cache-query-helper'), () => ({
  getMTime: mockGetMTime,
}));

vi.mock(import('../../../src/core/sqlInit'), () => ({
  getComGraphLayoutStore: mockGetComGraphLayoutStore,
}));

vi.mock('elkjs/lib/elk.bundled', () => {
  class MockElk {
    constructor(_options?: any) {}
    layout = vi.fn();
  }
  return { default: MockElk };
});

vi.mock('child_process', () => ({
  fork: mockFork,
}));

vi.mock('@pypto/native-layout', () => ({
  graphLayout: mockGraphLayout,
}));

import { workspace, extensions, commands } from 'vscode';
import { layout, elkLayout, layoutByLocal, renderLayout, postLayoutResult } from '../../../src/handler/elk-layout-service';

describe('layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses native layout when enabled and successful', async () => {
    mockGraphLayout.mockReturnValueOnce({ nodes: [] });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: vi.fn(() => true),
      update: vi.fn(),
    } as any);

    const gd = { children: [1, 2, 3], layoutOptions: {} };
    const server = { setRef: vi.fn() };
    const getComGraphData = vi.fn();
    const globalMap = new Map();

    await layout(gd, server, getComGraphData, globalMap);
    expect(mockGraphLayout).toHaveBeenCalledWith(gd);
    expect(server.setRef).toHaveBeenCalledWith('LayoutResult', expect.objectContaining({ data: { nodes: [] } }));
  });

  it('falls back to elk when native layout returns falsy', async () => {
    mockGraphLayout.mockReturnValueOnce(null);
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: vi.fn(() => true),
      update: vi.fn(),
    } as any);
    mockFork.mockReturnValue({ send: vi.fn(), on: vi.fn(), kill: vi.fn() } as any);

    const gd = { children: [], layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true' } };
    const server = { setRef: vi.fn(), title: 'test', query: {} };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: false }));
    const globalMap = new Map();

    await layout(gd, server, getComGraphData, globalMap);
    expect(mockGraphLayout).toHaveBeenCalled();
  });

  it('uses elk layout when native is disabled', async () => {
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: vi.fn(() => false),
      update: vi.fn(),
    } as any);
    mockFork.mockReturnValue({ send: vi.fn(), on: vi.fn(), kill: vi.fn() } as any);

    const gd = { layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true' } };
    const server = { setRef: vi.fn(), title: 'test', query: {} };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: false }));
    const globalMap = new Map();

    await layout(gd, server, getComGraphData, globalMap);
  });

  it('falls back to elk when native layout throws', async () => {
    mockGraphLayout.mockImplementationOnce(() => { throw new Error('native failed'); });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: vi.fn(() => true),
      update: vi.fn(),
    } as any);
    mockFork.mockReturnValue({ send: vi.fn(), on: vi.fn(), kill: vi.fn() } as any);

    const gd = { children: [], layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true' } };
    const server = { setRef: vi.fn(), title: 'test', query: {} };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: false }));
    const globalMap = new Map();

    await layout(gd, server, getComGraphData, globalMap);
  });

  it('handles native layout with no children', async () => {
    mockGraphLayout.mockReturnValueOnce({ nodes: [] });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: vi.fn(() => true),
      update: vi.fn(),
    } as any);

    const gd = { layoutOptions: {} };
    const server = { setRef: vi.fn() };
    const getComGraphData = vi.fn();
    const globalMap = new Map();

    await layout(gd, server, getComGraphData, globalMap);
    expect(server.setRef).toHaveBeenCalledWith('LayoutResult', expect.objectContaining({ data: { nodes: [] } }));
  });
});

describe('elkLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses cache when available and mtime matches', async () => {
    const mockStore = {
      find: vi.fn().mockResolvedValue({ lastChangeTime: '1234567890', layoutResult: '{"cached":true}' }),
      set: vi.fn(),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);

    const gd = { layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true' } };
    const server = { setRef: vi.fn(), title: 'test', query: {} };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: true }));
    const globalMap = new Map();

    await elkLayout(gd, server, getComGraphData, globalMap);
    expect(mockStore.find).toHaveBeenCalled();
    expect(server.setRef).toHaveBeenCalledWith('LayoutResult', expect.objectContaining({ data: { cached: true } }));
  });

  it('calls layoutByLocal when cache miss', async () => {
    const mockStore = {
      find: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);
    vi.mocked(extensions.getExtension).mockReturnValue(undefined);
    mockFork.mockReturnValue({ send: vi.fn(), on: vi.fn(), kill: vi.fn() } as any);

    const gd = { layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true' } };
    const server = { setRef: vi.fn(), title: 'test', query: {} };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: true }));
    const globalMap = new Map();

    await elkLayout(gd, server, getComGraphData, globalMap);
    expect(mockStore.find).toHaveBeenCalled();
  });

  it('uses java-elk-extension when available', async () => {
    const mockStore = {
      find: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);
    vi.mocked(extensions.getExtension).mockReturnValue({ id: 'hakan-6666.java-elk-extension' } as any);

    const gd = { layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true' } };
    const server = { setRef: vi.fn(), title: 'test', query: { _path: '/test', funcHash: 'abc' } };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: true }));
    const globalMap = new Map();

    await elkLayout(gd, server, getComGraphData, globalMap);
    expect(commands.executeCommand).toHaveBeenCalledWith('PyPTO.elkLayout', expect.any(String), expect.any(String), 'PyPto.Open.postLayoutData');
  });

  it('calls layoutByLocal when cache mtime does not match', async () => {
    const mockStore = {
      find: vi.fn().mockResolvedValue({ lastChangeTime: 'old_time', layoutResult: '{"old":true}' }),
      set: vi.fn(),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);
    vi.mocked(extensions.getExtension).mockReturnValue(undefined);
    mockGetMTime.mockResolvedValue('new_time');
    mockFork.mockReturnValue({ send: vi.fn(), on: vi.fn(), kill: vi.fn() } as any);

    const gd = { layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true' } };
    const server = { setRef: vi.fn(), title: 'test', query: {} };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: true }));
    const globalMap = new Map();

    await elkLayout(gd, server, getComGraphData, globalMap);
    expect(mockStore.find).toHaveBeenCalled();
  });

  it('uses path render mode without cache', async () => {
    const mockStore = {
      find: vi.fn().mockResolvedValue({ lastChangeTime: '1234567890', layoutResult: '{"cached":true}' }),
      set: vi.fn(),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);
    vi.mocked(extensions.getExtension).mockReturnValue(undefined);
    mockFork.mockReturnValue({ send: vi.fn(), on: vi.fn(), kill: vi.fn() } as any);

    const gd = { layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true', 'PyPTO.renderMode': 'path' } };
    const server = { setRef: vi.fn(), title: 'test', query: {} };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: true }));
    const globalMap = new Map();

    await elkLayout(gd, server, getComGraphData, globalMap);
  });
});

describe('layoutByLocal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fork child process and send layout data', () => {
    const mockChild = {
      send: vi.fn(),
      on: vi.fn(),
      kill: vi.fn(),
    };
    mockFork.mockReturnValue(mockChild as any);

    const server = { setRef: vi.fn(), title: 'test' };
    const gd = { layoutOptions: { 'PyPTO.renderMode': 'normal', 'PyPTO.filePath': '/test.json' } };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: false }));

    layoutByLocal(server, gd, '12345', 'hash1', getComGraphData);

    expect(mockFork).toHaveBeenCalled();
    expect(mockChild.send).toHaveBeenCalledWith({ type: 'layout', graphData: gd });
    expect(mockChild.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockChild.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockChild.on).toHaveBeenCalledWith('exit', expect.any(Function));
  });

  it('should handle result message from child process', async () => {
    let messageHandler: any;
    const mockChild = {
      send: vi.fn(),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      }),
      kill: vi.fn(),
    };
    mockFork.mockReturnValue(mockChild as any);

    const server = { setRef: vi.fn(), title: 'test' };
    const gd = { layoutOptions: { 'PyPTO.renderMode': 'normal', 'PyPTO.filePath': '/test.json' } };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: false }));

    layoutByLocal(server, gd, '12345', 'hash1', getComGraphData);

    await messageHandler({ type: 'result', data: { nodes: [] } });
    expect(server.setRef).toHaveBeenCalledWith('LayoutResult', expect.objectContaining({
      data: { nodes: [] },
    }));
    expect(mockChild.kill).toHaveBeenCalled();
  });

  it('should handle error message from child process', () => {
    let messageHandler: any;
    const mockChild = {
      send: vi.fn(),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      }),
      kill: vi.fn(),
    };
    mockFork.mockReturnValue(mockChild as any);

    const mockReturnError = vi.fn();
    const server = { setRef: vi.fn(), title: 'test' };
    const gd = { layoutOptions: { 'PyPTO.renderMode': 'normal', 'PyPTO.filePath': '/test.json' } };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: false }));

    layoutByLocal(server, gd, '12345', 'hash1', getComGraphData, mockReturnError);

    messageHandler({ type: 'error', data: 'layout error' });
    expect(mockReturnError).toHaveBeenCalled();
  });

  it('should save layout to DB when isUsedDB is true', async () => {
    let messageHandler: any;
    const mockChild = {
      send: vi.fn(),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      }),
      kill: vi.fn(),
    };
    mockFork.mockReturnValue(mockChild as any);

    const mockStore = {
      find: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);

    const server = { setRef: vi.fn(), title: 'test' };
    const gd = { layoutOptions: { 'PyPTO.renderMode': 'normal', 'PyPTO.filePath': '/test.json' } };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: true }));

    layoutByLocal(server, gd, '12345', 'hash1', getComGraphData);

    await messageHandler({ type: 'result', data: { nodes: [] } });
    expect(mockStore.set).toHaveBeenCalled();
  });

  it('should append _threeMode for multiple graph title', async () => {
    let messageHandler: any;
    const mockChild = {
      send: vi.fn(),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      }),
      kill: vi.fn(),
    };
    mockFork.mockReturnValue(mockChild as any);

    const mockStore = {
      find: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);

    const server = { setRef: vi.fn(), title: 'multiple graph' };
    const gd = { layoutOptions: { 'PyPTO.renderMode': 'normal', 'PyPTO.filePath': '/test.json' } };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: true }));

    layoutByLocal(server, gd, '12345', 'hash1', getComGraphData);

    await messageHandler({ type: 'result', data: { nodes: [] } });
    expect(mockStore.set).toHaveBeenCalledWith(expect.objectContaining({
      funcHash: 'hash1_threeMode',
    }));
  });

  it('should handle child process error', () => {
    let errorHandler: any;
    const mockChild = {
      send: vi.fn(),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'error') errorHandler = handler;
      }),
      kill: vi.fn(),
    };
    mockFork.mockReturnValue(mockChild as any);

    const server = { setRef: vi.fn(), title: 'test' };
    const gd = { layoutOptions: { 'PyPTO.renderMode': 'normal', 'PyPTO.filePath': '/test.json' } };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: false }));

    layoutByLocal(server, gd, '12345', 'hash1', getComGraphData);

    errorHandler(new Error('child error'));
    expect(mockChild.kill).toHaveBeenCalled();
  });

  it('should use console.error when no returnError provided', () => {
    let messageHandler: any;
    const mockChild = {
      send: vi.fn(),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'message') messageHandler = handler;
      }),
      kill: vi.fn(),
    };
    mockFork.mockReturnValue(mockChild as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const server = { setRef: vi.fn(), title: 'test' };
    const gd = { layoutOptions: { 'PyPTO.renderMode': 'normal', 'PyPTO.filePath': '/test.json' } };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: false }));

    layoutByLocal(server, gd, '12345', 'hash1', getComGraphData);

    messageHandler({ type: 'error', data: 'layout error' });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('renderLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process layout result and save to DB', async () => {
    const mockStore = {
      find: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);

    const gd = { layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true' }, children: [] };
    const server = { setRef: vi.fn(), title: 'test' };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: true }));
    const globalMap = new Map();

    await renderLayout(JSON.stringify(gd), '{"extra":"info"}', server, getComGraphData, globalMap);
    expect(server.setRef).toHaveBeenCalledWith('LayoutResult', expect.any(Object));
    expect(mockStore.set).toHaveBeenCalled();
  });

  it('should not save to DB when renderMode is path', async () => {
    const mockStore = {
      find: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);

    const gd = { layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true', 'PyPTO.renderMode': 'path' }, children: [] };
    const server = { setRef: vi.fn(), title: 'test' };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: true }));
    const globalMap = new Map();

    await renderLayout(JSON.stringify(gd), '{"extra":"info"}', server, getComGraphData, globalMap);
    expect(mockStore.set).not.toHaveBeenCalled();
  });

  it('should handle error type layout by calling layoutByLocal', async () => {
    const mockStore = {
      find: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);

    const mockChild = {
      send: vi.fn(),
      on: vi.fn(),
      kill: vi.fn(),
    };
    mockFork.mockReturnValue(mockChild as any);

    const errorGd = { type: 'error', data: { layoutOptions: { 'elk.direction': 'DOWN' } } };
    const server = { setRef: vi.fn(), title: 'test' };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: false }));
    const globalMap = new Map();

    await renderLayout(JSON.stringify(errorGd), '{"extra":"info"}', server, getComGraphData, globalMap);
    expect(mockFork).toHaveBeenCalled();
  });

  it('should append _threeMode for multiple graph title', async () => {
    const mockStore = {
      find: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);

    const gd = { layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true' }, children: [] };
    const server = { setRef: vi.fn(), title: 'multiple graph' };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: true }));
    const globalMap = new Map();

    await renderLayout(JSON.stringify(gd), '{"extra":"info"}', server, getComGraphData, globalMap);
    expect(mockStore.set).toHaveBeenCalledWith(expect.objectContaining({
      funcHash: expect.stringContaining('_threeMode'),
    }));
  });

  it('should not save to DB when isUsedDB is false', async () => {
    const mockStore = {
      find: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
    };
    mockGetComGraphLayoutStore.mockReturnValue(mockStore);

    const gd = { layoutOptions: { 'elk.direction': 'DOWN', 'PyPTO.showTensor': 'true' }, children: [] };
    const server = { setRef: vi.fn(), title: 'test' };
    const getComGraphData = vi.fn(() => ({ fsPath: '/test.json', funcHash: 'abc', isUsedDB: false }));
    const globalMap = new Map();

    await renderLayout(JSON.stringify(gd), '{"extra":"info"}', server, getComGraphData, globalMap);
    expect(mockStore.set).not.toHaveBeenCalled();
  });
});

describe('postLayoutResult', () => {
  it('sends layout result to frontend', () => {
    const server = { setRef: vi.fn() };
    const jsonStr = '{"nodes":[],"edges":[]}';
    postLayoutResult(server, jsonStr, '/test/file.json');
    expect(server.setRef).toHaveBeenCalledWith('LayoutResult', {
      data: { nodes: [], edges: [] },
      filePath: '/test/file.json',
    });
  });

  it('handles undefined filePath', () => {
    const server = { setRef: vi.fn() };
    const jsonStr = '{"test":true}';
    postLayoutResult(server, jsonStr);
    expect(server.setRef).toHaveBeenCalledWith('LayoutResult', {
      data: { test: true },
      filePath: undefined,
    });
  });
});
