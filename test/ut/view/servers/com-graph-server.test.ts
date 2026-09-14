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
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock(import('../../../../src/handler/singleGraphHandler'), () => ({
  SingleGraphHandler: {
    getInitialData: vi.fn(),
    layout: vi.fn(),
    renderLayout: vi.fn(),
    getJsonGraphData: vi.fn(),
    returnFuncTree: vi.fn(),
    openSearchMode: vi.fn(),
    setFinalResult: vi.fn(),
    openDiffViewer: vi.fn(),
    getSubgraph: vi.fn(),
    searchAllFunc: vi.fn(),
    jumpToCodeLine: vi.fn(),
    getHealthyReport: vi.fn(),
    getAccurancyReport: vi.fn(),
    searchAccurancySumList: vi.fn(),
    getAccurancyDetail: vi.fn(),
    innerGetSubgraph: vi.fn(),
    getSprottyGraphWithLevel: vi.fn(),
    loadDiffData: vi.fn(),
  },
}));

vi.mock(import('../../../../src/handler/diffGraphHandler'), () => ({
  DiffGraphHandler: {
    getInitialData: vi.fn(),
    layout: vi.fn(),
    renderLayout: vi.fn(),
    getJsonGraphData: vi.fn(),
    openSearchMode: vi.fn(),
    setFinalResult: vi.fn(),
    openDiffViewer: vi.fn(),
    getSubgraph: vi.fn(),
    searchAllFunc: vi.fn(),
    jumpToCodeLine: vi.fn(),
    getHealthyReport: vi.fn(),
    getAccurancyReport: vi.fn(),
    searchAccurancySumList: vi.fn(),
    getAccurancyDetail: vi.fn(),
    innerGetSubgraph: vi.fn(),
    getSprottyGraphWithLevel: vi.fn(),
    loadDiffData: vi.fn(),
  },
}));

vi.mock(import('../../../../src/handler/memoryTraceHandler'), () => ({
  MemoryTraceHandler: {
    parse: vi.fn(),
    getMetadata: vi.fn().mockResolvedValue({ clock: 100 }),
    getTimelineEvents: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock(import('../../../../src/common/downloadFileCheck'), () => ({
  setSaveDir: vi.fn().mockResolvedValue('/save/dir'),
  getCurrentPlatform: vi.fn(() => 'windows'),
  saveFile: vi.fn().mockResolvedValue({ success: true }),
  checkFilePath: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock(import('../../../../src/core/sqliteCache'), () => ({
  SQLiteCache: { getInstance: vi.fn(() => ({})) },
}));

vi.mock(import('../../../../src/common/accurancyAnylasis'), () => ({
  getCmpDiffList: vi.fn().mockResolvedValue({ data: [] }),
  getAccuFilePath: vi.fn().mockResolvedValue({ filePath: '/test/accu.csv' }),
  getCmpErrorList: vi.fn().mockResolvedValue({ data: [] }),
  getPrecisionExceptList: vi.fn().mockResolvedValue({ data: [] }),
  getTaskCmpList: vi.fn().mockResolvedValue({ data: [] }),
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
  return { ViewServer: MockViewServer, viewApi: () => () => {}, viewRefs: () => () => {} };
});

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, default: { ...actual, existsSync: vi.fn() }, existsSync: vi.fn() };
});

import * as fs from 'fs';
import { window } from 'vscode';
import { ComputeGraphServer } from '../../../../src/view/servers/com-graph-server';
import { SingleGraphHandler } from '../../../../src/handler/singleGraphHandler';
import { DiffGraphHandler } from '../../../../src/handler/diffGraphHandler';
import { MemoryTraceHandler } from '../../../../src/handler/memoryTraceHandler';
import { setSaveDir, saveFile, checkFilePath } from '../../../../src/common/downloadFileCheck';
import { getCmpDiffList, getAccuFilePath, getCmpErrorList, getPrecisionExceptList, getTaskCmpList } from '../../../../src/common/accurancyAnylasis';

function createMockCtx(viewType = 'computeGraph', query?: any) {
  return {
    viewType,
    fileUri: { fsPath: '/test/graph.json', query: query ? JSON.stringify(query) : undefined },
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(),
  };
}

function createServer(viewType = 'computeGraph', query?: any) {
  const ctx = createMockCtx(viewType, query);
  const server = new ComputeGraphServer(ctx as any);
  server.created(ctx as any);
  return server;
}

describe('ComputeGraphServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('safeParse returns parsed object for valid JSON', () => {
    const server = new ComputeGraphServer(createMockCtx() as any);
    expect(server.safeParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('safeParse returns empty object for invalid JSON', () => {
    const server = new ComputeGraphServer(createMockCtx() as any);
    expect(server.safeParse('bad')).toEqual({});
  });

  it('created sets handler to SingleGraphHandler for computeGraph', () => {
    const ctx = createMockCtx('computeGraph');
    const server = new ComputeGraphServer(ctx as any);
    server.created(ctx as any);
    expect(server.viewType).toBe('computeGraph');
    expect(server.handler).toBeDefined();
  });

  it('created sets handler to DiffGraphHandler for diffGraph', () => {
    const ctx = createMockCtx('diffGraph');
    const server = new ComputeGraphServer(ctx as any);
    server.created(ctx as any);
    expect(server.viewType).toBe('diffGraph');
    expect(server.handler).toBeDefined();
  });

  it('created parses string query', () => {
    const ctx = createMockCtx('computeGraph', { _path: '/test.json' });
    const server = new ComputeGraphServer(ctx as any);
    server.created(ctx as any);
    expect(server.query).toEqual({ _path: '/test.json' });
  });

  it('created handles object query', () => {
    const ctx = { viewType: 'computeGraph', fileUri: { fsPath: '/test.json', query: { _path: '/test.json' } }, init: vi.fn(), setRef: vi.fn(), closeWebview: vi.fn() };
    const server = new ComputeGraphServer(ctx as any);
    server.created(ctx as any);
    expect(server.query).toEqual({ _path: '/test.json' });
  });

  it('checkSys sets platform ref', async () => {
    const server = createServer();
    await server.checkSys();
    expect(server.getRef('CheckSysResult')).toEqual({ sustem: 'windows' });
  });

  it('getInitialData calls handler and sets InitComFlag', async () => {
    const server = createServer();
    await server.getInitialData();
    expect(SingleGraphHandler.getInitialData).toHaveBeenCalledWith(server);
    expect(server.getRef('InitComFlag')).toBe('true');
  });

  it('askLayout delegates to handler', async () => {
    const server = createServer();
    const msg = { data: { nodes: [] } };
    await server.askLayout(msg);
    expect(SingleGraphHandler.layout).toHaveBeenCalledWith(msg.data, server);
  });

  it('renderLayout delegates to handler', async () => {
    const server = createServer();
    await server.renderLayout({ nodes: [] }, 'info');
    expect(SingleGraphHandler.renderLayout).toHaveBeenCalledWith({ nodes: [] }, 'info', server);
  });

  it('getJsonGraphData delegates to handler', async () => {
    const server = createServer();
    const msg = { data: {} };
    await server.getJsonGraphData(msg);
    expect(SingleGraphHandler.getJsonGraphData).toHaveBeenCalledWith(msg, server);
  });

  it('openSearchMode delegates to handler', async () => {
    const server = createServer();
    const msg = { keyword: 'test' };
    await server.openSearchMode(msg);
    expect(SingleGraphHandler.openSearchMode).toHaveBeenCalledWith(msg, server);
  });

  it('setFinalResult delegates to handler', async () => {
    const server = createServer();
    const msg = { result: true };
    await server.setFinalResult(msg);
    expect(SingleGraphHandler.setFinalResult).toHaveBeenCalledWith(msg, server);
  });

  it('openDiffViewer delegates to handler', async () => {
    const server = createServer();
    await server.openDiffViewer();
    expect(SingleGraphHandler.openDiffViewer).toHaveBeenCalledWith(server, server.query);
  });

  it('getSubgraph merges query when both are objects', async () => {
    const server = createServer('computeGraph', { _path: '/test.json' });
    const msg = { paramObj: { id: 1 }, query: { extra: true } };
    await server.getSubgraph(msg);
    expect(SingleGraphHandler.getSubgraph).toHaveBeenCalledWith(server, msg.paramObj, expect.objectContaining({ _path: '/test.json', extra: true }));
  });

  it('searchAllFunc delegates to handler', async () => {
    const server = createServer();
    const msg = { keyword: 'func' };
    await server.searchAllFunc(msg);
    expect(SingleGraphHandler.searchAllFunc).toHaveBeenCalledWith(server, msg);
  });

  it('jumpToCodeLine delegates to handler', async () => {
    const server = createServer();
    const msg = { paramObj: { line: 10 } };
    await server.jumpToCodeLine(msg);
    expect(SingleGraphHandler.jumpToCodeLine).toHaveBeenCalledWith(msg.paramObj);
  });

  it('getHealthyReport delegates to handler', async () => {
    const server = createServer();
    await server.getHealthyReport();
    expect(SingleGraphHandler.getHealthyReport).toHaveBeenCalledWith(server);
  });

  it('getAccurancyReport delegates to handler', async () => {
    const server = createServer();
    await server.getAccurancyReport();
    expect(SingleGraphHandler.getAccurancyReport).toHaveBeenCalledWith(server);
  });

  it('searchAccurancySumList delegates to handler', async () => {
    const server = createServer();
    const msg = { keyword: 'test' };
    await server.searchAccurancySumList(msg);
    expect(SingleGraphHandler.searchAccurancySumList).toHaveBeenCalledWith(server, msg);
  });

  it('getAccurancyDetail delegates to handler', async () => {
    const server = createServer();
    const msg = { id: 1 };
    await server.getAccurancyDetail(msg);
    expect(SingleGraphHandler.getAccurancyDetail).toHaveBeenCalledWith(server, msg);
  });

  it('innerGetSubgraph delegates to handler', async () => {
    const server = createServer();
    const msg = { id: 1 };
    await server.innerGetSubgraph(msg);
    expect(SingleGraphHandler.innerGetSubgraph).toHaveBeenCalledWith(server, msg);
  });

  it('getSprottyGraphWithLevel delegates to handler', async () => {
    const server = createServer();
    const msg = { level: 2 };
    await server.getSprottyGraphWithLevel(msg);
    expect(SingleGraphHandler.getSprottyGraphWithLevel).toHaveBeenCalledWith(server, msg);
  });

  it('returnFuncTree delegates to SingleGraphHandler', async () => {
    const server = createServer();
    await server.returnFuncTree();
    expect(SingleGraphHandler.returnFuncTree).toHaveBeenCalledWith(server);
  });

  it('setSaveDir calls setSaveDir and sets ref', async () => {
    const server = createServer();
    await server.setSaveDir();
    expect(setSaveDir).toHaveBeenCalled();
    expect(server.getRef('SaveDirPath')).toEqual({ dir: '/save/dir' });
  });

  it('saveFile calls saveFile and sets ref', async () => {
    const server = createServer();
    const msg = { content: 'data' };
    await server.saveFile(msg);
    expect(saveFile).toHaveBeenCalledWith(msg);
    expect(server.getRef('SaveFileResult')).toEqual({ success: true });
  });

  it('checkFilePath calls checkFilePath and sets ref', async () => {
    const server = createServer();
    const msg = { path: '/test' };
    await server.checkFilePath(msg);
    expect(checkFilePath).toHaveBeenCalledWith(msg);
    expect(server.getRef('CheckFilePathResult')).toEqual({ valid: true });
  });

  it('selectFile opens dialog and loads diff data on selection', async () => {
    const server = createServer('diffGraph');
    vi.mocked(window.showOpenDialog).mockResolvedValue([{ fsPath: '/other/graph.json' }] as any);
    await server.selectFile('/test/graph.json');
    expect(window.showOpenDialog).toHaveBeenCalled();
    expect(DiffGraphHandler.loadDiffData).toHaveBeenCalledWith(server, '/other/graph.json');
  });

  it('selectFile sets SameDiffFile when same file selected', async () => {
    const server = createServer('diffGraph');
    vi.mocked(window.showOpenDialog).mockResolvedValue([{ fsPath: '/test/graph.json' }] as any);
    await server.selectFile('/test/graph.json');
    expect(server.getRef('SameDiffFile')).toBe('');
  });

  it('selectFile does nothing when dialog cancelled', async () => {
    const server = createServer('diffGraph');
    vi.mocked(window.showOpenDialog).mockResolvedValue(undefined);
    await server.selectFile('/test/graph.json');
    expect(DiffGraphHandler.loadDiffData).not.toHaveBeenCalled();
  });

  it('getMemTraceFile returns early when no path', async () => {
    const server = createServer('computeGraph', {});
    await server.getMemTraceFile();
    expect(server.getRef('MemTraceFileFlag')).toBeUndefined();
  });

  it('getMemTraceFile detects memory trace file directly', async () => {
    const server = createServer('computeGraph', { _path: '/test/graph.json', memoryPath: '/test/graph_OoO_Memory_Trace.json' });
    await server.getMemTraceFile();
    expect(server.getRef('MemTraceFileFlag')).toEqual({ isComFile: false, existTraceFile: true });
  });

  it('getMemTraceFile detects existing trace file from com file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const server = createServer('computeGraph', { _path: '/test/graph.json', memoryPath: '/test/other.json' });
    await server.getMemTraceFile();
    expect(server.getRef('MemTraceFileFlag')).toEqual({ isComFile: true, existTraceFile: true });
  });

  it('getMemTraceFile detects missing trace file from com file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const server = createServer('computeGraph', { _path: '/test/graph.json', memoryPath: '/test/other.json' });
    await server.getMemTraceFile();
    expect(server.getRef('MemTraceFileFlag')).toEqual({ isComFile: true, existTraceFile: false });
  });

  it('getInitialMemoryData returns early when no path', async () => {
    const server = createServer('computeGraph', {});
    await server.getInitialMemoryData();
    expect(MemoryTraceHandler.parse).not.toHaveBeenCalled();
  });

  it('getInitialMemoryData parses and sets metadata when file exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const server = createServer('computeGraph', { _path: '/test/graph_OoO_Memory_Trace.json' });
    await server.getInitialMemoryData();
    expect(MemoryTraceHandler.parse).toHaveBeenCalledWith('/test/graph_OoO_Memory_Trace.json');
    expect(MemoryTraceHandler.getMetadata).toHaveBeenCalledWith('/test/graph_OoO_Memory_Trace.json');
    expect(server.getRef('InitMemoryTraceFlag')).toBe('true');
  });

  it('getInitialMemoryData appends trace suffix for non-trace files', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const server = createServer('computeGraph', { _path: '/test/graph.json' });
    await server.getInitialMemoryData();
    expect(MemoryTraceHandler.parse).toHaveBeenCalledWith('/test/graph_OoO_Memory_Trace.json');
  });

  it('getMetadata returns early when no path', async () => {
    const server = createServer('computeGraph', {});
    await server.getMetadata();
    expect(MemoryTraceHandler.getMetadata).not.toHaveBeenCalled();
  });

  it('getMetadata calls handler and sets ref', async () => {
    const server = createServer('computeGraph', { _path: '/test/graph_OoO_Memory_Trace.json' });
    await server.getMetadata();
    expect(MemoryTraceHandler.getMetadata).toHaveBeenCalledWith('/test/graph_OoO_Memory_Trace.json');
    expect(server.getRef('Metadata')).toEqual({ clock: 100 });
  });

  it('getTimelineEvents returns early when no path', async () => {
    const server = createServer('computeGraph', {});
    await server.getTimelineEvents();
    expect(MemoryTraceHandler.getTimelineEvents).not.toHaveBeenCalled();
  });

  it('getTimelineEvents calls handler and sets ref', async () => {
    const server = createServer('computeGraph', { _path: '/test/graph_OoO_Memory_Trace.json' });
    await server.getTimelineEvents();
    expect(MemoryTraceHandler.getTimelineEvents).toHaveBeenCalledWith('/test/graph_OoO_Memory_Trace.json');
    expect(server.getRef('Timeline')).toEqual([]);
  });

  it('accuFilePathGet calls getAccuFilePath and sets ref', async () => {
    const server = createServer();
    const result = await server.accuFilePathGet();
    expect(getAccuFilePath).toHaveBeenCalled();
    expect(server.getRef('AccuFilePath')).toEqual({ filePath: '/test/accu.csv' });
    expect(result).toEqual({ filePath: '/test/accu.csv' });
  });

  it('getCmpDiffListData calls getCmpDiffList with defaults', async () => {
    const server = createServer();
    await server.getCmpDiffListData({ cmpCsvPath: '/test/cmp.csv' });
    expect(getCmpDiffList).toHaveBeenCalledWith('/test/cmp.csv', true, 50, 0, undefined, undefined);
    expect(server.getRef('CmpDiffList')).toEqual({ data: [] });
  });

  it('getCmpDiffListData passes custom params', async () => {
    const server = createServer();
    await server.getCmpDiffListData({ cmpCsvPath: '/test/cmp.csv', pageSize: 10, startOffset: 5, res: 'FAIL', keyword: 'op1' });
    expect(getCmpDiffList).toHaveBeenCalledWith('/test/cmp.csv', true, 10, 5, 'FAIL', 'op1');
  });

  it('getCmpErrorListData calls getCmpErrorList', async () => {
    const server = createServer();
    await server.getCmpErrorListData({ cmpCsvPath: '/test/cmp.csv', comgraphPath: '/test/com.json' });
    expect(getCmpErrorList).toHaveBeenCalled();
    expect(server.getRef('cmpErrorList')).toEqual({ data: [] });
  });

  it('getTaskCmpErrorListData calls getTaskCmpList', async () => {
    const server = createServer();
    await server.getTaskCmpErrorListData({ cmpCsvPath: '/test/cmp.csv' });
    expect(getTaskCmpList).toHaveBeenCalled();
    expect(server.getRef('taskCmpErrorList')).toEqual({ data: [] });
  });

  it('getPrecisionExceptList sets result on success', async () => {
    const server = createServer();
    await server.getPrecisionExceptList({ filePath: '/test', fileName: 'test.csv' });
    expect(getPrecisionExceptList).toHaveBeenCalledWith('/test', 'test.csv');
    expect(server.getRef('precisionExceptList')).toEqual({ data: [] });
  });

  it('getPrecisionExceptList sets null on error', async () => {
    vi.mocked(getPrecisionExceptList).mockRejectedValueOnce(new Error('fail'));
    const server = createServer();
    await server.getPrecisionExceptList({ filePath: '/test', fileName: 'test.csv' });
    expect(server.getRef('precisionExceptList')).toBeNull();
  });
});
