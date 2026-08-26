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

const { mocks } = vi.hoisted(() => ({
  mocks: {
    viewServer: {
      viewApi: () => (target: any, key: string) => {},
      viewRefs: () => (target: any) => {},
      ViewServer: class {
        _refMap = new Map();
        constructor() {}
        setRef(k: string, v: unknown) { this._refMap.set(k, v); }
        getRef(k: string) { return this._refMap.get(k); }
        closeWebview() {}
        onDisposed() {}
        created() {}
      },
    },
    viewServerContext: {
      ViewServerContext: class {
        viewType = 'threeColumnGraph';
        fileUri: any = {};
        init = function() {};
        setRef = function() {};
        closeWebview = function() {};
      },
    },
    singleGraphHandler: {
      SingleGraphHandler: class {
        static async getInitialData(s: any) { await this.loadMainData(s); }
        static async loadMainData(s: any) {}
        static async layout(d: any, s: any) {}
        static async renderLayout(d: any, i: string, s: any) {}
        static async getJsonGraphData(m: any, s: any) {}
        static async setFinalResult(m: any, s: any) {}
        static async openDiffViewer(s: any, q: any) {}
        static async getSubgraph(s: any, p: any, q: any) {}
        static async searchAllFunc(s: any, m: any) {}
        static async jumpToCodeLine(m: any) {}
        static async getHealthyReport(s: any) {}
        static async getAccurancyReport(s: any) {}
        static async searchAccurancySumList(s: any, m: any) {}
        static async getAccurancyDetail(s: any, m: any) {}
        static async innerGetSubgraph(s: any, p: any) {}
        static async returnFuncTree(s: any) {}
        static async getSprottyGraphWithLevel(s: any, m: any) {}
        static async openSearchMode(m: any, s: any) {}
        static getGrahpDataExtend(s: any) { return undefined; }
        static getGraphData(s: any) { return { fsPath: '/com.json', getCompleteData: async () => ({ functions: [] }) }; }
      },
    },
    swimGraphMsgHandler: {
      getInitialData: vi.fn(),
      getSwimData: vi.fn(),
      getData: vi.fn(),
      getOtherData: vi.fn(),
      getPerformanceInfo: vi.fn(),
      getCompressedData: vi.fn(),
      bindComGraphJson: vi.fn(),
      unbindComGraph: vi.fn(),
      jumpToComGraph: vi.fn(),
      openBoundComGraph: vi.fn(),
      jumpRawMagic: vi.fn(),
      showMessage: vi.fn(),
      saveRendingMode: vi.fn(),
      changeUserCfgConnection: vi.fn(),
      changeUserCfgPerformance: vi.fn(),
      changeUserCfgIsMixMode: vi.fn(),
      getShortCutKeyCfg: vi.fn(),
    },
    fider: {
      findByCodePathMock: vi.fn(async (swimPath: any, comPath: any) => { return { swimPath, comPath, runDataTitle: undefined }; }),
      handleUserSelectMock: vi.fn(async (graphType: string) => { return { swimPath: '/swim.json', comPath: '/com.json' }; }),
      selectPathMock: vi.fn(async (graphType: string) => { return { path: '/selected.json' }; }),
      Fider: class {
        constructor(codePath?: string) {}
        async findByCodePath(swimPath: any, comPath: any) { return mocks.fider.findByCodePathMock(swimPath, comPath); }
        async handleUserSelect(graphType: string) { return mocks.fider.handleUserSelectMock(graphType); }
        async selectPath(graphType: string) { return mocks.fider.selectPathMock(graphType); }
      },
    },
    util: {
      Util: {
        getCachePath: vi.fn().mockReturnValue('/cache.json'),
        readSwim2ComGraphMap: vi.fn().mockReturnValue({}),
        writeJsonCache: vi.fn(),
      },
    },
    fs: {
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      readdirSync: vi.fn(),
      existsSync: vi.fn(),
    },
    stream: { Readable: { from: vi.fn(), toWeb: vi.fn() } },
    fileSystem: { readFirstNLines: vi.fn() },
    runDataApi: { getRunDataList: vi.fn(), GetOutputRecordParams: {} },
    graphData: {
      SingleGraphData: class {
        fsPath: string;
        funcHash: any;
        static getEntryHash = vi.fn();
        constructor(fsPath: string) { this.fsPath = fsPath; this.funcHash = undefined; }
      },
    },
    hismarliteEx: {},
    vscode: { workspace: { workspaceFolders: [{ uri: { fsPath: '/workspace' } }] as any[], findFiles: vi.fn() } },
  },
}));

vi.mock('vscode', async () => {
  const mock = await import('./../../mocks/vscode');
  return { ...mock, Uri: { file: (p: string) => ({ fsPath: p }) }, workspace: mocks.vscode.workspace };
});

vi.mock(import('../../../../src/core/view/view-server'), () => ({
  viewApi: mocks.viewServer.viewApi,
  viewRefs: mocks.viewServer.viewRefs,
  ViewServer: mocks.viewServer.ViewServer,
}));

vi.mock(import('../../../../src/core/view/view-server-context'), () => ({
  ViewServerContext: mocks.viewServerContext.ViewServerContext,
}));

vi.mock(import('../../../../src/handler/singleGraphHandler'), () => ({
  SingleGraphHandler: mocks.singleGraphHandler.SingleGraphHandler,
}));

vi.mock(import('../../../../src/handler/swimGraphMsgHandler'), () => ({
  SwimGraphMsgHandler: mocks.swimGraphMsgHandler,
}));

vi.mock(import('../../../../src/view/threeColumnEntry'), () => ({
  Fider: mocks.fider.Fider,
}));

vi.mock(import('../../../../src/util'), () => ({ Util: mocks.util.Util }));

vi.mock('fs', async (orig) => { const a = await orig<typeof import('fs')>(); return { ...a, ...mocks.fs }; });

vi.mock('node:fs', () => ({ default: mocks.fs, readdirSync: mocks.fs.readdirSync, readFileSync: mocks.fs.readFileSync, writeFileSync: mocks.fs.writeFileSync, existsSync: mocks.fs.existsSync }));

vi.mock('node:stream', () => ({ default: mocks.stream, Readable: mocks.stream.Readable }));

vi.mock(import('../../../../src/utils/file-system'), () => ({ readFirstNLines: mocks.fileSystem.readFirstNLines }));

vi.mock(import('../../../../src/services/run-data/api'), () => ({
  getRunDataList: mocks.runDataApi.getRunDataList,
  GetOutputRecordParams: mocks.runDataApi.GetOutputRecordParams,
}));

vi.mock(import('../../../../src/core/graphData'), () => ({ SingleGraphData: mocks.graphData.SingleGraphData }));

vi.mock('i18next', () => ({ t: (key: string) => key }));

import { ThreeColumnServer, SwimData, ComGraphHandler } from '../../../../src/view/servers/three-column-server';

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

function resetFiderMocks() {
  mocks.fider.findByCodePathMock.mockImplementation(async (swimPath: any, comPath: any) => { return { swimPath, comPath, runDataTitle: undefined }; });
  mocks.fider.handleUserSelectMock.mockImplementation(async () => { return { swimPath: '/swim.json', comPath: '/com.json' }; });
  mocks.fider.selectPathMock.mockImplementation(async () => { return { path: '/selected.json' }; });
}

const origBeforeEach = beforeEach;
beforeEach(() => {
  resetFiderMocks();
});

function createServer(queryOverride?: any, path?: string) {
  const ctx = new mocks.viewServerContext.ViewServerContext();
  const query = queryOverride ?? { _path: '/test/code.py' };
  ctx.fileUri = { query: JSON.stringify(query), path: path ?? '/test/code.py' };
  return new ThreeColumnServer(ctx as any);
}

describe('SwimData', () => {
  it('stores uri and fsPath', () => {
    const data = new SwimData({ fsPath: '/test' } as any, '/test');
    expect(data.fsPath).toBe('/test');
  });
});

describe('ThreeColumnServer.created', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('initializes with fileUri containing query and path', () => {
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = { query: JSON.stringify({ _path: '/test/code.py' }), path: '/test/code.py' };
    const server = new ThreeColumnServer(ctx as any);
    server.created(ctx as any);
    expect(server.title).toBe('multiple graph');
    expect(server.codePath).toBe('/test/code.py');
    expect(server.cachePath).toBe('/cache.json');
  });

  it('returns early when fileUri is undefined', () => {
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = undefined;
    const server = new ThreeColumnServer(ctx as any);
    server.created(ctx as any);
    expect(server.title).toBeUndefined();
  });

  it('sets swimDataPath and comPath when isBootStep is true', () => {
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = { query: JSON.stringify({ _path: '/test/code.py', isBootStep: true, swim: '/swim.json', comput: '/com.json' }), path: '/test/code.py' };
    const server = new ThreeColumnServer(ctx as any);
    server.created(ctx as any);
    expect(server.swimDataPath).toBe('/swim.json');
    expect(server.comPath).toBe('/com.json');
  });

  it('uses title from path when .py file', () => {
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = { query: JSON.stringify({ _path: '/test/myfile.py' }), path: '/test/myfile.py' };
    const server = new ThreeColumnServer(ctx as any);
    server.created(ctx as any);
    expect(server.title).toBe('multiple graph');
  });

  it('handles query with - suffix in _path', () => {
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = { query: JSON.stringify({ _path: '/test/code.py - Label' }), path: '/test/code.py' };
    const server = new ThreeColumnServer(ctx as any);
    server.created(ctx as any);
    expect(server.codePath).toBe('/test/code.py');
  });

  it('initWebViewPanel sets returnInitPath when paths missing', async () => {
    mocks.util.Util.getCachePath.mockReturnValue('/cache.json');
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = { query: JSON.stringify({ _path: '/test/code.py' }), path: '/test/code.py' };
    const server = new ThreeColumnServer(ctx as any);
    server.created(ctx as any);
    await new Promise((r) => setTimeout(r, 10));
    expect(server.getRef('returnInitPath')).toBeDefined();
  });

  it('initWebViewPanel sets InitFlag when paths exist', async () => {
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = { query: JSON.stringify({ _path: '/test/code.py', isBootStep: true, swim: '/swim.json', comput: '/com.json' }), path: '/test/code.py' };
    const server = new ThreeColumnServer(ctx as any);
    server.created(ctx as any);
    await new Promise((r) => setTimeout(r, 10));
    expect(server.getRef('InitFlag')).toBeDefined();
    expect(server.getRef('SetVscodeState')).toBeDefined();
  });

  it('initWebViewPanel catches error from initPaths', async () => {
    mocks.fider.Fider = class {
      constructor() { throw new Error('init error'); }
      async findByCodePath() { return {}; }
    };
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = { query: JSON.stringify({ _path: '/test/code.py' }), path: '/test/code.py' };
    const server = new ThreeColumnServer(ctx as any);
    expect(() => server.created(ctx as any)).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    mocks.fider.Fider = class {
      constructor(codePath?: string) {}
      async findByCodePath(swimPath: any, comPath: any) { return { swimPath, comPath, runDataTitle: undefined }; }
      async handleUserSelect(graphType: string) { return { swimPath: '/swim.json', comPath: '/com.json' }; }
      async selectPath(graphType: string) { return { path: '/selected.json' }; }
    };
  });
});

describe('ThreeColumnServer API methods - handler delegation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getInitialData delegates to handlers', async () => {
    mocks.graphData.SingleGraphData.getEntryHash.mockResolvedValue({ entryhash: 'abc' });
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.comPath = '/com.json';
    await server.getInitialData();
    expect(mocks.swimGraphMsgHandler.getInitialData).toHaveBeenCalled();
  });

  it('getInitialComData delegates to ComGraphHandler', async () => {
    mocks.graphData.SingleGraphData.getEntryHash.mockResolvedValue({ entryhash: 'abc' });
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.comPath = '/com.json';
    await server.getInitialComData();
  });

  it('getInitialSwimData delegates to SwimGraphMsgHandler', async () => {
    const server = createServer();
    await server.getInitialSwimData();
    expect(mocks.swimGraphMsgHandler.getInitialData).toHaveBeenCalled();
  });

  it('getPyCode delegates to codeMsgHandler', async () => {
    mocks.fs.readFileSync.mockReturnValue('code content');
    const server = createServer();
    server.codePath = '/test.py';
    await server.getPyCode();
    expect(server.getRef('PyCode')).toBeDefined();
  });

  it('savePyCode delegates to codeMsgHandler', async () => {
    mocks.fs.writeFileSync.mockImplementation(() => {});
    const server = createServer();
    server.codePath = '/test.py';
    await server.savePyCode('new code');
    expect(server.getRef('SaveSuccess')).toBeDefined();
  });

  it('savePyCode handles write error', async () => {
    mocks.fs.writeFileSync.mockImplementation(() => { throw new Error('EACCES'); });
    const server = createServer();
    server.codePath = '/test.py';
    await server.savePyCode('new code');
    expect(server.getRef('SaveError')).toBeDefined();
  });

  it('askLayout delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.askLayout({ data: 'layout' });
  });

  it('renderLayout delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.renderLayout({}, 'info');
  });

  it('getJsonGraphData delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.getJsonGraphData({ param: 1 });
  });

  it('setFinalResult delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.setFinalResult({ param: 1 });
  });

  it('openDiffViewer delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.openDiffViewer();
  });

  it('getSubgraph delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.getSubgraph({ paramObj: { hash: 'abc' } });
  });

  it('searchAllFunc delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.searchAllFunc({ query: 'test' });
  });

  it('jumpToCodeLine delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.jumpToCodeLine({ line: 10 });
  });

  it('getHealthyReport delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.getHealthyReport();
  });

  it('getAccurancyReport delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.getAccurancyReport();
  });

  it('searchAccurancySumList delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.searchAccurancySumList({ query: 'test' });
  });

  it('getAccurancyDetail delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.getAccurancyDetail({ id: 1 });
  });

  it('innerGetSubgraph delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.innerGetSubgraph({ paramObj: { hash: 'abc' } });
  });

  it('returnFuncTree delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.returnFuncTree();
  });

  it('getSprottyGraphWithLevel delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.getSprottyGraphWithLevel({ level: 1 });
  });

  it('selectPassPath delegates to ComGraphHandler', async () => {
    mocks.fs.readdirSync.mockReturnValue([]);
    const server = createServer();
    server.comPath = '/com.json';
    server.query = { _path: '/code.py' };
    await server.selectPassPath({ paramObj: { calleehash: 'abc' } });
  });

  it('openSearchMode delegates to ComGraphHandler', async () => {
    const server = createServer();
    await server.openSearchMode({ query: 'test' });
  });

  it('getOtherData delegates to SwimGraphMsgHandler', async () => {
    mocks.swimGraphMsgHandler.getOtherData.mockResolvedValue({});
    const server = createServer();
    await server.getOtherData();
    expect(mocks.swimGraphMsgHandler.getOtherData).toHaveBeenCalled();
  });

  it('getPerformanceInfo delegates to SwimGraphMsgHandler', async () => {
    mocks.swimGraphMsgHandler.getPerformanceInfo.mockResolvedValue({});
    const server = createServer();
    await server.getPerformanceInfo();
  });

  it('getCompressedData delegates to SwimGraphMsgHandler', async () => {
    mocks.swimGraphMsgHandler.getCompressedData.mockResolvedValue({});
    const server = createServer();
    await server.getCompressedData({ swimDataPath: '/swim.json' });
    expect(server.swimDataPath).toBe('/swim.json');
  });

  it('bindComGraphJson delegates', async () => {
    const server = createServer();
    await server.bindComGraphJson();
  });

  it('unbindComGraph delegates', async () => {
    const server = createServer();
    await server.unbindComGraph();
  });

  it('jumpToComGraph delegates', async () => {
    const server = createServer();
    await server.jumpToComGraph({ paramObj: { hash: 'abc' } });
  });

  it('openBoundComGraph delegates', async () => {
    const server = createServer();
    await server.openBoundComGraph();
  });

  it('jumpRawMagic delegates', async () => {
    const server = createServer();
    await server.jumpRawMagic({ paramObj: { rawmagic: 1 } });
  });

  it('showMessage delegates', async () => {
    const server = createServer();
    await server.showMessage({ paramObj: { text: 'hi' } });
  });

  it('saveRendingMode delegates', async () => {
    const server = createServer();
    await server.saveRendingMode({ paramObj: '{}' });
  });

  it('changeUserCfgConnection delegates', async () => {
    const server = createServer();
    await server.changeUserCfgConnection({ paramObj: { level: 5 } });
  });

  it('changeUserCfgPerformance delegates', async () => {
    const server = createServer();
    await server.changeUserCfgPerformance({ paramObj: { show: true } });
  });

  it('changeUserCfgIsMixMode delegates', async () => {
    const server = createServer();
    await server.changeUserCfgIsMixMode({ paramObj: { show: false } });
  });

  it('getShortCutKeyCfg delegates', async () => {
    mocks.swimGraphMsgHandler.getShortCutKeyCfg.mockResolvedValue({});
    const server = createServer();
    await server.getShortCutKeyCfg();
  });

  it('setSaveDir is no-op', async () => {
    const server = createServer();
    await server.setSaveDir();
  });

  it('checkSys is no-op', async () => {
    const server = createServer();
    await server.checkSys();
  });

  it('saveFile is no-op', async () => {
    const server = createServer();
    await server.saveFile({});
  });

  it('checkFilePath is no-op', async () => {
    const server = createServer();
    await server.checkFilePath({});
  });
});

describe('ThreeColumnServer.fetchVscodeState', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates swimDataPath when message has swimDataPath', async () => {
    const server = createServer();
    await server.fetchVscodeState({ swimDataPath: '/new/swim.json' });
    expect(server.swimDataPath).toBe('/new/swim.json');
    expect(server.swimData).toBeDefined();
  });

  it('updates comPath when message has comPath', async () => {
    const server = createServer();
    server.initPath = '/test/code.py';
    await server.fetchVscodeState({ comPath: '/new/com.json' });
    expect(server.comPath).toBe('/new/com.json');
    expect(server.query.fsPath).toBe('/new/com.json');
  });

  it('updates codePath when message has codePath', async () => {
    const server = createServer();
    await server.fetchVscodeState({ codePath: '/new/code.py' });
    expect(server.codePath).toBe('/new/code.py');
  });
});

describe('ThreeColumnServer.getSwimData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when no swimDataPath', async () => {
    const server = createServer();
    server.swimDataPath = undefined;
    const result = await server.getSwimData({});
    expect(result).toBeUndefined();
  });

  it('sets dataError when content is not Google format', async () => {
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['{"tasks":[]}']);
    const server = createServer();
    server.swimDataPath = '/swim.json';
    await server.getSwimData({});
    expect(server.getRef('dataError')).toBeDefined();
  });

  it('returns stream when packages available', async () => {
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['{"traceEvents":[]}']);
    mocks.swimGraphMsgHandler.getSwimData.mockResolvedValue([{ type: 'events' }]);
    mocks.stream.Readable.from.mockReturnValue({});
    mocks.stream.Readable.toWeb.mockReturnValue({ web: true });
    const server = createServer();
    server.swimDataPath = '/swim.json';
    const result = await server.getSwimData({});
    expect(result).toEqual({ web: true });
  });

  it('updates swimDataPath from message', async () => {
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['{"traceEvents":[]}']);
    mocks.swimGraphMsgHandler.getSwimData.mockResolvedValue(null);
    const server = createServer();
    await server.getSwimData({ swimDataPath: '/new/swim.json' });
    expect(server.swimDataPath).toBe('/new/swim.json');
  });
});

describe('ThreeColumnServer.getData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when no swimDataPath', async () => {
    const server = createServer();
    server.swimDataPath = undefined;
    const result = await server.getData({});
    expect(result).toBeUndefined();
  });

  it('sets dataError when content is not Google format', async () => {
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['{"tasks":[]}']);
    const server = createServer();
    server.swimDataPath = '/swim.json';
    await server.getData({});
    expect(server.getRef('dataError')).toBeDefined();
  });

  it('returns stream when data is array', async () => {
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['{"traceEvents":[]}']);
    mocks.swimGraphMsgHandler.getData.mockResolvedValue([{ type: 'events' }]);
    mocks.stream.Readable.from.mockReturnValue({});
    mocks.stream.Readable.toWeb.mockReturnValue({ web: true });
    const server = createServer();
    server.swimDataPath = '/swim.json';
    const result = await server.getData({});
    expect(result).toEqual({ web: true });
  });

  it('returns data when not array', async () => {
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['{"traceEvents":[]}']);
    mocks.swimGraphMsgHandler.getData.mockResolvedValue({ data: 'non-array' });
    const server = createServer();
    server.swimDataPath = '/swim.json';
    const result = await server.getData({});
    expect(result).toEqual({ data: 'non-array' });
  });

  it('returns undefined when packages is null in getSwimData', async () => {
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['{"traceEvents":[]}']);
    mocks.swimGraphMsgHandler.getSwimData.mockResolvedValue(null);
    const server = createServer();
    server.swimDataPath = '/swim.json';
    const result = await server.getSwimData({});
    expect(result).toBeUndefined();
  });
});

describe('ThreeColumnServer.selectRunData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates paths and sets refs', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.selectRunData({ runDataPaths: { swimPath: '/swim.json', comPath: '/com.json', runDataTitle: 'title' } });
    expect(server.swimDataPath).toBe('/swim.json');
    expect(server.comPath).toBe('/com.json');
    expect(server.getRef('SetVscodeState')).toBeDefined();
    expect(server.getRef('returnSearchPath')).toBeDefined();
  });

  it('handles missing swimPath', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.selectRunData({ runDataPaths: { comPath: '/com.json', runDataTitle: '' } });
    expect(server.getRef('returnSearchPath')).toBeDefined();
  });
});

describe('ThreeColumnServer.selectFile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handles swimGraph selection with no conflict', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    server.swimDataPath = undefined;
    server.comPath = undefined;
    await server.selectFile({ graphType: 'swimGraph', options: {} });
    expect(server.getRef('returnSearchPath')).toBeDefined();
  });

  it('handles swimGraph selection with path conflict', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.selectFile({ graphType: 'swimGraph', options: { comPath: '/existing/com.json' } });
    expect(server.getRef('returnReplace')).toBeDefined();
  });

  it('handles comGraph selection with no conflict', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    server.swimDataPath = undefined;
    server.comPath = undefined;
    await server.selectFile({ graphType: 'comGraph', options: {} });
    expect(server.getRef('returnSearchPath')).toBeDefined();
  });

  it('handles comGraph selection with path conflict', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.selectFile({ graphType: 'comGraph', options: { swimPath: '/existing/swim.json' } });
    expect(server.getRef('returnReplace')).toBeDefined();
  });

  it('handles computeGraph type', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    server.swimDataPath = undefined;
    server.comPath = undefined;
    await server.selectFile({ graphType: 'computeGraph', options: {} });
    expect(server.getRef('returnSearchPath')).toBeDefined();
  });
});

describe('ThreeColumnServer.replaceFile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates paths from options', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.replaceFile({ options: { swimPath: '/swim.json', comPath: '/com.json' } });
    expect(server.swimDataPath).toBe('/swim.json');
    expect(server.comPath).toBe('/com.json');
    expect(server.getRef('SetVscodeState')).toBeDefined();
  });
});

describe('ThreeColumnServer.singleSelectFile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when message is null', async () => {
    const server = createServer();
    await server.singleSelectFile(null as any);
  });

  it('returns early when graphType is missing', async () => {
    const server = createServer();
    await server.singleSelectFile({} as any);
  });

  it('returns early when graphType is invalid', async () => {
    const server = createServer();
    await server.singleSelectFile({ graphType: 'unknown' });
  });

  it('returns early when path is undefined', async () => {
    mocks.fider.Fider = class {
      constructor() {}
      async selectPath() { return { path: undefined }; }
    };
    const server = createServer();
    await server.singleSelectFile({ graphType: 'swimGraph' });
    mocks.fider.Fider = class {
      constructor(codePath?: string) {}
      async findByCodePath(swimPath: any, comPath: any) { return { swimPath, comPath, runDataTitle: undefined }; }
      async handleUserSelect(graphType: string) { return { swimPath: '/swim.json', comPath: '/com.json' }; }
      async selectPath(graphType: string) { return { path: '/selected.json' }; }
    };
  });

  it('handles editor graphType', async () => {
    mocks.fs.readFileSync.mockReturnValue('code');
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'editor' });
    expect(server.getRef('PyCode')).toBeDefined();
  });

  it('handles editor graphType with readFileSync error', async () => {
    mocks.fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'editor' });
  });

  it('handles editor graphType with graphData', async () => {
    mocks.fs.readFileSync.mockReturnValue('code');
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'editor' });
    expect(server.getRef('SetVscodeState')).toBeDefined();
  });

  it('handles swimGraph graphType', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'swimGraph' });
    expect(server.getRef('returnSwimPath')).toBeDefined();
  });

  it('handles comGraph graphType', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'comGraph' });
    expect(server.getRef('returnComPath')).toBeDefined();
  });

  it('catches error during processing', async () => {
    mocks.fider.Fider = class {
      constructor() { throw new Error('init error'); }
    };
    const server = createServer();
    await server.singleSelectFile({ graphType: 'editor' });
    mocks.fider.Fider = class {
      constructor(codePath?: string) {}
      async findByCodePath(swimPath: any, comPath: any) { return { swimPath, comPath, runDataTitle: undefined }; }
      async handleUserSelect(graphType: string) { return { swimPath: '/swim.json', comPath: '/com.json' }; }
      async selectPath(graphType: string) { return { path: '/selected.json' }; }
    };
  });
});

describe('ThreeColumnServer.initRelativePath', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns codePath and found paths', async () => {
    const server = createServer();
    const result = await server.initRelativePath('/code.py', '/swim.json', '/com.json');
    expect(result.codePath).toBe('/code.py');
    expect(result.swimPath).toBe('/swim.json');
    expect(result.comPath).toBe('/com.json');
  });
});

describe('ThreeColumnServer.initPaths', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates swimData when swimPath found', async () => {
    const server = createServer();
    server.codePath = '/test/code.py';
    server.swimDataPath = undefined;
    server.comPath = undefined;
    const ret = await server.initRelativePath('/test/code.py', '/found/swim.json', '/found/com.json');
    expect(ret.swimPath).toBe('/found/swim.json');
    expect(ret.comPath).toBe('/found/com.json');
    server.updateSwimData('/found/swim.json');
    server.updateComData('/found/com.json');
    expect(server.swimDataPath).toBe('/found/swim.json');
  });

  it('updates paths and fetches runDataList when runDataTitle is set', async () => {
    mocks.runDataApi.getRunDataList.mockResolvedValue({ data: [{ swimlaneGraphFilePath: '/rd/swim.json', controlFlowFilePath: '/rd/com.json' }] });
    const server = createServer();
    server.codePath = '/test/code.py';
    server.initPath = '/test/code.py';
    server.headerTitle = 'title';
    await server.fetchRunDataList('title');
    expect(server.swimDataPath).toBe('/rd/swim.json');
  });

  it('handles fetchRunDataList error', async () => {
    mocks.fider.Fider = class {
      constructor() {}
      async findByCodePath() { return { swimPath: undefined, comPath: undefined, runDataTitle: 'title' }; }
    };
    mocks.runDataApi.getRunDataList.mockRejectedValue(new Error('fetch error'));
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.initPaths();
    mocks.fider.Fider = class {
      constructor(codePath?: string) {}
      async findByCodePath(swimPath: any, comPath: any) { return { swimPath, comPath, runDataTitle: undefined }; }
      async handleUserSelect(graphType: string) { return { swimPath: '/swim.json', comPath: '/com.json' }; }
      async selectPath(graphType: string) { return { path: '/selected.json' }; }
    };
  });

  it('skips when both paths already exist', async () => {
    const server = createServer();
    server.swimDataPath = '/existing/swim.json';
    server.comPath = '/existing/com.json';
    await server.initPaths();
  });
});

describe('ThreeColumnServer.fetchRunDataList', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fetches and updates paths from runData', async () => {
    mocks.runDataApi.getRunDataList.mockResolvedValue({ data: [{ swimlaneGraphFilePath: '/swim.json', controlFlowFilePath: '/com.json' }] });
    const server = createServer();
    server.initPath = '/code.py';
    await server.fetchRunDataList('title');
    expect(server.swimDataPath).toBe('/swim.json');
    expect(server.comPath).toBe('/com.json');
  });

  it('handles error', async () => {
    mocks.runDataApi.getRunDataList.mockRejectedValue(new Error('fail'));
    const server = createServer();
    await server.fetchRunDataList('title');
  });
});

describe('ThreeColumnServer.safeParse', () => {
  it('parses valid JSON', () => {
    const server = createServer();
    expect(server.safeParse('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('returns {} on invalid JSON', () => {
    const server = createServer();
    expect(server.safeParse('invalid')).toEqual({});
  });
});

describe('ThreeColumnServer.updateFilePathsCache', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('writes cache with paths', async () => {
    mocks.util.Util.readSwim2ComGraphMap.mockReturnValue({ '/code.py': { existing: 'data' } });
    const server = createServer();
    server.codePath = '/code.py';
    server.cachePath = '/cache.json';
    await (server as any).updateFilePathsCache('/swim.json', '/com.json', 'title');
    expect(mocks.util.Util.writeJsonCache).toHaveBeenCalled();
  });

  it('creates new cache entry when codePath not in cache', async () => {
    mocks.util.Util.readSwim2ComGraphMap.mockReturnValue({});
    const server = createServer();
    server.codePath = '/new/code.py';
    server.cachePath = '/cache.json';
    await (server as any).updateFilePathsCache('/swim.json', '/com.json');
    expect(mocks.util.Util.writeJsonCache).toHaveBeenCalled();
  });

  it('handles error', async () => {
    mocks.util.Util.readSwim2ComGraphMap.mockImplementation(() => { throw new Error('read error'); });
    const server = createServer();
    server.codePath = '/code.py';
    server.cachePath = '/cache.json';
    await (server as any).updateFilePathsCache('/swim.json', '/com.json');
  });
});

describe('removeSuffix', () => {
  it('removes suffix after " - "', () => {
    const server = createServer({ _path: '/test/code.py - Label' });
    expect(server.codePath).toBeUndefined();
  });
});

describe('ComGraphHandler internal methods (via ThreeColumnServer)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('searchFuncHashInProject via selectPassPath', async () => {
    mocks.fs.readdirSync.mockReturnValue([
      { name: 'hash123.json', isFile: () => true, isDirectory: () => false },
    ]);
    mocks.vscode.workspace.findFiles.mockResolvedValue([{ fsPath: '/found.json' }]);
    const server = createServer();
    server.comPath = '/com.json';
    server.query = { _path: '/code.py' };
    await server.selectPassPath({ paramObj: { calleehash: 'hash123' } });
    expect(server.getRef('GetPassPath')).toBeDefined();
  });

  it('getSemanticObj via singleSelectFile editor type', async () => {
    mocks.fs.readFileSync.mockReturnValue('code');
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [{ operations: [{ semantic_label: ['label'], file: '/test.py', line: 5 }] }] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'editor' });
    expect(server.getRef('CompleteData')).toBeDefined();
  });

  it('getSemanticObj with array semantic_label without op.file', async () => {
    mocks.fs.readFileSync.mockReturnValue('code');
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [{ operations: [{ semantic_label: ['label'] }] }] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'editor' });
    expect(server.getRef('CompleteData')).toBeDefined();
  });

  it('getSemanticObj with object semanticInfo', async () => {
    mocks.fs.readFileSync.mockReturnValue('code');
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [{ operations: [{ semantic_label: { filename: '/test.py', lineno: 5, label: 'mylabel' } }] }] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'editor' });
  });

  it('getSemanticObj with Windows backslash path', async () => {
    mocks.fs.readFileSync.mockReturnValue('code');
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [{ operations: [{ semantic_label: ['label'], file: 'C:\\test.py', line: 5 }] }] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'editor' });
  });

  it('getSemanticObj with no workspace', async () => {
    mocks.fs.readFileSync.mockReturnValue('code');
    const oldWf = mocks.vscode.workspace.workspaceFolders;
    mocks.vscode.workspace.workspaceFolders = [];
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'editor' });
    mocks.vscode.workspace.workspaceFolders = oldWf;
  });

  it('getSemanticObj skips ops without semantic_label', async () => {
    mocks.fs.readFileSync.mockReturnValue('code');
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [{ operations: [{ file: '/test.py', line: 5 }] }] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'editor' });
  });
});

describe('ThreeColumnServer coverage supplements', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('getData updates swimDataPath from message', async () => {
    mocks.fileSystem.readFirstNLines.mockResolvedValue(['{"traceEvents":[]}']);
    mocks.swimGraphMsgHandler.getData.mockResolvedValue({ data: 'non-array' });
    const server = createServer();
    server.swimDataPath = undefined;
    await server.getData({ swimDataPath: '/new/swim.json' });
    expect(server.swimDataPath).toBe('/new/swim.json');
  });

  it('initWebViewPanel catches error', async () => {
    const OrigFider = mocks.fider.Fider;
    mocks.fider.Fider = class {
      constructor() { throw new Error('init error'); }
    };
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = { query: JSON.stringify({ _path: '/test/code.py' }), path: '/test/code.py' };
    const server = new ThreeColumnServer(ctx as any);
    server.created(ctx as any);
    await new Promise((r) => setTimeout(r, 10));
    mocks.fider.Fider = OrigFider;
  });

  it('initPaths updates swimData and comData when paths found', async () => {
    mocks.fider.findByCodePathMock.mockResolvedValue({ swimPath: '/found/swim.json', comPath: '/found/com.json', runDataTitle: 'title' });
    mocks.runDataApi.getRunDataList.mockResolvedValue({ data: [] });
    const server = createServer();
    server.codePath = '/test/code.py';
    server.initPath = '/test/code.py';
    server.swimDataPath = undefined;
    server.comPath = undefined;
    await server.initPaths();
    expect(server.swimDataPath).toBe('/found/swim.json');
    expect(server.comPath).toBe('/found/com.json');
    expect(server.headerTitle).toBe('title');
  });

  it('initPaths sets runDataTitle and fetches runDataList', async () => {
    mocks.runDataApi.getRunDataList.mockResolvedValue({ data: [{ swimlaneGraphFilePath: '/rd/swim.json', controlFlowFilePath: '/rd/com.json' }] });
    const server = createServer();
    server.codePath = '/test/code.py';
    server.initPath = '/test/code.py';
    server.headerTitle = 'myTitle';
    await server.fetchRunDataList('myTitle');
    expect(server.swimDataPath).toBe('/rd/swim.json');
  });

  it('initWebViewPanel catches error from initPaths', async () => {
    mocks.fider.findByCodePathMock.mockRejectedValue(new Error('init error'));
    const ctx = new mocks.viewServerContext.ViewServerContext();
    ctx.fileUri = { query: JSON.stringify({ _path: '/test/code.py' }), path: '/test/code.py' };
    const server = new ThreeColumnServer(ctx as any);
    server.created(ctx as any);
    await new Promise((r) => setTimeout(r, 20));
  });

  it('singleSelectFile returns early when path is undefined (selectPath returns undefined)', async () => {
    mocks.fider.selectPathMock.mockResolvedValue({ path: undefined });
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'swimGraph' });
  });

  it('singleSelectFile catches error during processing', async () => {
    mocks.fider.selectPathMock.mockRejectedValue(new Error('select error'));
    const server = createServer();
    server.codePath = '/test/code.py';
    await server.singleSelectFile({ graphType: 'editor' });
  });

  it('searchFuncHashInProject resolves with file list', async () => {
    mocks.vscode.workspace.findFiles.mockResolvedValue([{ fsPath: '/found.json' }]);
    const server = { setRef: vi.fn() };
    ComGraphHandler.searchFuncHashInProject(server, 'hash123');
    await new Promise((r) => setTimeout(r, 20));
    expect(server.setRef).toHaveBeenCalledWith('FuncHashFileList', { data: ['/found.json'] });
  });

  it('singleSelectFile returns early when path is undefined', async () => {
    const OrigFider = mocks.fider.Fider;
    mocks.fider.Fider = class {
      constructor() {}
      async selectPath() { return { path: undefined }; }
    };
    const server = createServer();
    await server.singleSelectFile({ graphType: 'swimGraph' });
    mocks.fider.Fider = OrigFider;
  });

  it('singleSelectFile catches error during processing', async () => {
    const OrigFider = mocks.fider.Fider;
    mocks.fider.Fider = class {
      constructor() { throw new Error('select error'); }
    };
    const server = createServer();
    await server.singleSelectFile({ graphType: 'editor' });
    mocks.fider.Fider = OrigFider;
  });

  it('getPyCode handles readFileSync error', async () => {
    mocks.fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    const server = createServer();
    server.codePath = '/missing.py';
    await server.getPyCode();
    expect(server.getRef('PyCode')).toBeDefined();
  });

  it('selectPassPath triggers searchFuncHashInProject with findFiles', async () => {
    mocks.fs.readdirSync.mockReturnValue([
      { name: 'hash123.json', isFile: () => true, isDirectory: () => false },
    ]);
    mocks.vscode.workspace.findFiles.mockResolvedValue([{ fsPath: '/found.json' }]);
    const server = createServer();
    server.comPath = '/com.json';
    server.query = { _path: '/code.py' };
    await server.selectPassPath({ paramObj: { calleehash: 'hash123' } });
    await new Promise((r) => setTimeout(r, 10));
  });

  it('findSubDir recurses into directories', async () => {
    let callCount = 0;
    mocks.fs.readdirSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return [
          { name: 'subdir', isFile: () => false, isDirectory: () => true },
          { name: 'hash123.json', isFile: () => true, isDirectory: () => false },
        ];
      }
      return [
        { name: 'hash456.json', isFile: () => true, isDirectory: () => false },
      ];
    });
    const server = createServer();
    server.comPath = '/com.json';
    server.query = { _path: '/code.py' };
    await server.selectPassPath({ paramObj: { calleehash: 'hash' } });
    expect(server.getRef('GetPassPath')).toBeDefined();
  });

  it('loadMainData succeeds via getInitialComData', async () => {
    
    mocks.graphData.SingleGraphData.getEntryHash.mockResolvedValue({ entryhash: 'abc' });
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.comPath = '/com.json';
    await server.getInitialComData();
  });

  it('loadMainData handles FILE_READ_ERROR', async () => {
    
    mocks.graphData.SingleGraphData.getEntryHash.mockRejectedValue({ code: 'FILE_READ_ERROR', message: 'read fail' });
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.comPath = '/com.json';
    await server.getInitialComData();
  });

  it('loadMainData handles JSON_PARSE_ERROR', async () => {
    
    mocks.graphData.SingleGraphData.getEntryHash.mockRejectedValue({ code: 'JSON_PARSE_ERROR', message: 'parse fail' });
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.comPath = '/com.json';
    await server.getInitialComData();
  });

  it('loadMainData handles STREAM_PROCESSING_ERROR', async () => {
    
    mocks.graphData.SingleGraphData.getEntryHash.mockRejectedValue({ code: 'STREAM_PROCESSING_ERROR', message: 'stream fail' });
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.comPath = '/com.json';
    await server.getInitialComData();
  });

  it('loadMainData handles unknown error', async () => {
    
    mocks.graphData.SingleGraphData.getEntryHash.mockRejectedValue({ code: 'UNKNOWN', message: 'unknown' });
    const mockGraphData = { fsPath: '/com.json', getCompleteData: vi.fn().mockResolvedValue({ functions: [] }) };
    mocks.singleGraphHandler.SingleGraphHandler.getGrahpDataExtend = vi.fn().mockReturnValue(mockGraphData) as any;
    const server = createServer();
    server.comPath = '/com.json';
    await server.getInitialComData();
  });
});
