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
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetIDELang = vi.hoisted(() => vi.fn().mockReturnValue('zh-cn'));

const {
  mockGetComGraphFinalResultStore,
  mockGetComGraphFuncDataStore,
  mockGetComGraphFileHashMapStore,
  mockRetryUntil,
  mockGetMTime,
  mockGetHealthReport,
  mockGetAccurancyReport,
  mockSearchAccurancySumList,
  mockGetAccurancyDetail,
  mockCollectOpMagic,
  mockGetErrorMessage,
  mockLayoutByLocal,
  mockNativeOrElkLayout,
  mockRenderLayout,
  mockBuildSubgraphQuery,
  mockApplyFailMagicResults,
  mockGetFailMagicList,
  graphFileHashMapData,
} = vi.hoisted(() => {
  const mockGetComGraphFinalResultStore = vi.fn(() => ({
    set: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue(null),
  }));
  const mockGetComGraphFuncDataStore = vi.fn(() => ({
    set: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue(null),
    query: vi.fn(() => ({
      filter: vi.fn(() => ({
        count: vi.fn().mockResolvedValue(0),
        exec: vi.fn().mockResolvedValue([]),
      })),
    })),
  }));
  const mockGetComGraphFileHashMapStore = vi.fn(() => ({
    set: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue(null),
  }));
  const mockRetryUntil = vi.fn();
  const mockGetMTime = vi.fn().mockResolvedValue('12345');
  const mockGetHealthReport = vi.fn().mockResolvedValue({ score: 90 });
  const mockGetAccurancyReport = vi.fn().mockResolvedValue(undefined);
  const mockSearchAccurancySumList = vi.fn().mockResolvedValue(undefined);
  const mockGetAccurancyDetail = vi.fn().mockResolvedValue(undefined);
  const mockCollectOpMagic = vi.fn().mockResolvedValue(new Set([1, 2]));
  const mockGetErrorMessage = vi.fn().mockResolvedValue([]);
  const mockLayoutByLocal = vi.fn();
  const mockNativeOrElkLayout = vi.fn().mockResolvedValue(undefined);
  const mockRenderLayout = vi.fn().mockResolvedValue(undefined);
  const mockBuildSubgraphQuery = vi.fn((entryHash, oldQuery, calleehash, subFuncmagicname, curPath, calleeOpMagic, calleeOpSubgraphId, parentInfo) => ({
    ...oldQuery,
    funcHash: calleehash,
    subFuncmagicname,
  }));
  const mockApplyFailMagicResults = vi.fn().mockReturnValue(true);
  const mockGetFailMagicList = vi.fn().mockResolvedValue({});
  const graphFileHashMapData: Record<string, any> = {};
  return {
    mockGetComGraphFinalResultStore,
    mockGetComGraphFuncDataStore,
    mockGetComGraphFileHashMapStore,
    mockRetryUntil,
    mockGetMTime,
    mockGetHealthReport,
    mockGetAccurancyReport,
    mockSearchAccurancySumList,
    mockGetAccurancyDetail,
    mockCollectOpMagic,
    mockGetErrorMessage,
    mockLayoutByLocal,
    mockNativeOrElkLayout,
    mockRenderLayout,
    mockBuildSubgraphQuery,
    mockApplyFailMagicResults,
    mockGetFailMagicList,
    graphFileHashMapData,
  };
});

vi.mock('../../../src/lang', () => ({
  getIDELang: mockGetIDELang,
}));

vi.mock('../../../src/config/config', () => ({
  globalConfig: { IS_USE_DB: true },
}));

vi.mock('../../../src/common/graphFileHashMap', () => ({
  graphFileHashMap: graphFileHashMapData,
}));

vi.mock('../../../src/utils/graphExtractor', () => ({
  extractIncasts: vi.fn().mockReturnValue([]),
  extractOutcasts: vi.fn().mockReturnValue([]),
  extractRawTensors: vi.fn().mockReturnValue(new Map()),
  extractTensorNodes: vi.fn().mockReturnValue(new Map()),
  extractOperationNodes: vi.fn().mockReturnValue(new Map()),
  extractFuncMap: vi.fn().mockReturnValue(new Map()),
  searchFunc: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../src/core/graphData', () => ({
  AbstractGraphData: class {},
}));

vi.mock('../../../src/hismarliteEx', () => ({
  hismartliteEx: { extensionPath: '/test/ext', webviews: {} },
}));

vi.mock('../../../src/core/json-graph/jsonGraph', () => {
  class MockAscppDagBuilder {
    constructor(..._args: any[]) {}
    createSprottyGraph(..._args: any[]) {
      return { nodes: [], edges: [] };
    }
  }
  return { AscppDagBuilder: MockAscppDagBuilder };
});

vi.mock('../../../src/utils/health-report', () => ({
  getHealthReport: mockGetHealthReport,
}));

vi.mock('../../../src/core/sqlInit', () => ({
  getComGraphFinalResultStore: mockGetComGraphFinalResultStore,
  getComGraphFuncDataStore: mockGetComGraphFuncDataStore,
  getComGraphFileHashMapStore: mockGetComGraphFileHashMapStore,
}));

vi.mock('../../../src/common/accurancyAnylasis', () => ({
  getFailMagicList: mockGetFailMagicList,
}));

vi.mock('../../../src/core/cache-query-helper', () => ({
  retryUntil: mockRetryUntil,
  getMTime: mockGetMTime,
}));

vi.mock('../../../src/handler/accuracy-report-service', () => ({
  getAccurancyReport: mockGetAccurancyReport,
  searchAccurancySumList: mockSearchAccurancySumList,
  getAccurancyDetail: mockGetAccurancyDetail,
}));

vi.mock('../../../src/handler/error-log-parser', () => ({
  collectOpMagic: mockCollectOpMagic,
  getErrorMessage: mockGetErrorMessage,
}));

vi.mock('../../../src/handler/elk-layout-service', () => ({
  layout: mockNativeOrElkLayout,
  layoutByLocal: mockLayoutByLocal,
  renderLayout: mockRenderLayout,
}));

vi.mock('../../../src/handler/subgraph-helpers', () => ({
  buildSubgraphQuery: mockBuildSubgraphQuery,
  applyFailMagicResults: mockApplyFailMagicResults,
}));

vi.mock('i18next', () => ({
  t: vi.fn((key: string, args?: any) => args ? `${key}:${JSON.stringify(args)}` : key),
}));

const mockReadFile = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  default: {
    readFile: mockReadFile,
  },
  readFile: mockReadFile,
}));

vi.mock('fs', () => ({
  default: {
    readdirSync: vi.fn().mockReturnValue([]),
    readFileSync: vi.fn().mockReturnValue('{}'),
  },
  readdirSync: vi.fn().mockReturnValue([]),
  readFileSync: vi.fn().mockReturnValue('{}'),
  promises: {
    readFile: mockReadFile,
  },
}));

import { BaseGraphMsgHandler } from '../../../src/handler/baseGraphMsgHandler';
import { commands, workspace, window, Uri, Position, Selection, Range } from 'vscode';

class TestableHandler extends BaseGraphMsgHandler {
  static mockGd: any = null;
  static mockLoadResult = true;

  protected static async loadMainData(_server: any): Promise<boolean> {
    return TestableHandler.mockLoadResult;
  }

  static getGraphData(_server: any): any {
    return TestableHandler.mockGd;
  }
}

describe('BaseGraphMsgHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    BaseGraphMsgHandler.globalCallInOutTensorMap.clear();
    TestableHandler.mockGd = {
      fsPath: '/test/Pass_001/func_123_TENSOR_456_ROOT.json',
      funcHash: '123',
      isUsedDB: false,
      dataMap: {},
      funcHashMap: {},
      callHashArrMap: {},
      outputDirPath: '/test',
      pathName: 'test',
      comPath: '/test/com',
      version: '1.0',
    };
    TestableHandler.mockLoadResult = true;
    Object.keys(graphFileHashMapData).forEach(k => delete graphFileHashMapData[k]);
  });

  describe('initTheme', () => {
    it('should set IDELang ref', async () => {
      const mockServer = { setRef: vi.fn() };
      await BaseGraphMsgHandler.initTheme(mockServer);
      expect(mockServer.setRef).toHaveBeenCalledWith('IDELang', { data: 'zh-cn' });
    });
  });

  describe('globalCallInOutTensorMap', () => {
    it('should be a shared Map instance', () => {
      expect(BaseGraphMsgHandler.globalCallInOutTensorMap).toBeInstanceOf(Map);
    });

    it('should allow adding and retrieving entries', () => {
      BaseGraphMsgHandler.globalCallInOutTensorMap.set('key1', { in: [1], out: [2] });
      expect(BaseGraphMsgHandler.globalCallInOutTensorMap.get('key1')).toEqual({ in: [1], out: [2] });
    });

    it('should persist across method calls', () => {
      BaseGraphMsgHandler.globalCallInOutTensorMap.set('key1', 'value1');
      expect(BaseGraphMsgHandler.globalCallInOutTensorMap.has('key1')).toBe(true);
    });
  });

  describe('WHITE_COMMANDS', () => {
    it('should be a Set', () => {
      expect(BaseGraphMsgHandler.WHITE_COMMANDS).toBeInstanceOf(Set);
    });

    it('should contain expected commands', () => {
      expect(BaseGraphMsgHandler.WHITE_COMMANDS.has('getInitialData')).toBe(true);
      expect(BaseGraphMsgHandler.WHITE_COMMANDS.has('getSubgraph')).toBe(true);
      expect(BaseGraphMsgHandler.WHITE_COMMANDS.has('askLayout')).toBe(true);
    });
  });

  describe('callInOutTensorMap', () => {
    it('should store tensor map data', () => {
      const data = {
        hash123: { in: [1, 2, 3], out: [4, 5] },
      };

      BaseGraphMsgHandler.callInOutTensorMap(data);

      expect(BaseGraphMsgHandler.globalCallInOutTensorMap.get('hash123')).toEqual({
        in: [1, 2, 3],
        out: [4, 5],
      });
    });

    it('should overwrite existing entries', () => {
      BaseGraphMsgHandler.globalCallInOutTensorMap.set('hash123', { in: [1], out: [2] });

      const data = {
        hash123: { in: [10, 20], out: [30] },
      };

      BaseGraphMsgHandler.callInOutTensorMap(data);

      expect(BaseGraphMsgHandler.globalCallInOutTensorMap.get('hash123')).toEqual({
        in: [10, 20],
        out: [30],
      });
    });
  });

  describe('returnError', () => {
    it('should set ErrorMessage ref with cmd and log', () => {
      const server = { setRef: vi.fn() };
      BaseGraphMsgHandler.returnError(server, 'error.cmd', { key: 'val' }, 'log.cmd', { logText: 'err' });
      expect(server.setRef).toHaveBeenCalledWith('ErrorMessage', {
        data: expect.any(String),
        log: expect.any(String),
        diffType: undefined,
      });
    });

    it('should handle missing cmdArgs and logCmdArgs', () => {
      const server = { setRef: vi.fn() };
      BaseGraphMsgHandler.returnError(server, 'error.cmd');
      expect(server.setRef).toHaveBeenCalledWith('ErrorMessage', {
        data: 'error.cmd',
        log: null,
        diffType: undefined,
      });
    });

    it('should pass diffType when provided', () => {
      const server = { setRef: vi.fn() };
      BaseGraphMsgHandler.returnError(server, 'error.cmd', undefined, undefined, undefined, 'before');
      expect(server.setRef).toHaveBeenCalledWith('ErrorMessage', expect.objectContaining({ diffType: 'before' }));
    });

    it('should handle cmdArgs without logCmd', () => {
      const server = { setRef: vi.fn() };
      BaseGraphMsgHandler.returnError(server, 'error.cmd', { key: 'val' });
      expect(server.setRef).toHaveBeenCalledWith('ErrorMessage', {
        data: expect.any(String),
        log: null,
        diffType: undefined,
      });
    });

    it('should handle logCmd without logCmdArgs', () => {
      const server = { setRef: vi.fn() };
      BaseGraphMsgHandler.returnError(server, 'error.cmd', undefined, 'log.cmd');
      expect(server.setRef).toHaveBeenCalledWith('ErrorMessage', {
        data: 'error.cmd',
        log: 'log.cmd',
        diffType: undefined,
      });
    });
  });

  describe('checkFuncHash', () => {
    it('should return true when funcHash exists', () => {
      const server = { setRef: vi.fn() };
      const gd = { funcHash: '123' };
      const result = (TestableHandler as any).checkFuncHash(server, gd, 'error.cmd');
      expect(result).toBe(true);
    });

    it('should return false and set error when funcHash is missing', () => {
      const server = { setRef: vi.fn() };
      const gd = { funcHash: null };
      const result = (TestableHandler as any).checkFuncHash(server, gd, 'error.cmd');
      expect(result).toBe(false);
      expect(server.setRef).toHaveBeenCalledWith('ErrorMessage', expect.any(Object));
    });

    it('should return false when gd has no funcHash with diffType', () => {
      const server = { setRef: vi.fn() };
      const gd = { funcHash: '' };
      const result = (TestableHandler as any).checkFuncHash(server, gd, 'error.cmd', 'after');
      expect(result).toBe(false);
    });
  });

  describe('checkIsLeaf', () => {
    it('should set isLeaf to true when func name contains leaf', () => {
      const server: any = { comGraphData: { funcHash: '123' }, setRef: vi.fn() };
      const calleeMap = { '123': { func_magicname: 'MyLeafFunction' } };
      (TestableHandler as any).checkIsLeaf(server, calleeMap);
      expect(server.isLeaf).toBe(true);
    });

    it('should set isLeaf to false when func name does not contain leaf', () => {
      const server: any = { comGraphData: { funcHash: '123' }, setRef: vi.fn() };
      const calleeMap = { '123': { func_magicname: 'MyFunction' } };
      (TestableHandler as any).checkIsLeaf(server, calleeMap);
      expect(server.isLeaf).toBe(false);
    });

    it('should set isLeaf to false when funcHash is missing', () => {
      const server: any = { comGraphData: { funcHash: null }, setRef: vi.fn() };
      (TestableHandler as any).checkIsLeaf(server, {});
      expect(server.isLeaf).toBe(false);
    });

    it('should set isLeaf to false when calleeMap entry is missing', () => {
      const server: any = { comGraphData: { funcHash: '999' }, setRef: vi.fn() };
      const calleeMap = { '123': { func_magicname: 'MyFunction' } };
      (TestableHandler as any).checkIsLeaf(server, calleeMap);
      expect(server.isLeaf).toBe(false);
    });
  });

  describe('postJsonGraphData', () => {
    it('should set JsonGraphData ref', () => {
      const server = { setRef: vi.fn() };
      const data = { nodes: [] };
      BaseGraphMsgHandler.postJsonGraphData(server, {}, data, false, {}, [], []);
      expect(server.setRef).toHaveBeenCalledWith('JsonGraphData', {
        data,
        isCached: false,
        wrongRawMagicList: {},
        failOpMagicList: [],
        failMagicList: [],
      });
    });

    it('should handle undefined optional params', () => {
      const server = { setRef: vi.fn() };
      BaseGraphMsgHandler.postJsonGraphData(server, {}, { nodes: [] }, true);
      expect(server.setRef).toHaveBeenCalledWith('JsonGraphData', {
        data: { nodes: [] },
        isCached: true,
        wrongRawMagicList: undefined,
        failOpMagicList: undefined,
        failMagicList: undefined,
      });
    });
  });

  describe('getElkLayoutComGraghData', () => {
    it('should return server.comGraphData', () => {
      const server = { comGraphData: { fsPath: '/test.json' } };
      const result = BaseGraphMsgHandler.getElkLayoutComGraghData(server, {});
      expect(result).toBe(server.comGraphData);
    });
  });

  describe('postLayoutResult', () => {
    it('should parse JSON and call postLayoutResultData', () => {
      const server = { setRef: vi.fn() };
      BaseGraphMsgHandler.postLayoutResult(server, '{"nodes":[]}');
      expect(server.setRef).toHaveBeenCalledWith('LayoutResult', { data: { nodes: [] } });
    });
  });

  describe('postLayoutResultData', () => {
    it('should set LayoutResult ref', () => {
      const server = { setRef: vi.fn() };
      const data = { nodes: [], edges: [] };
      (BaseGraphMsgHandler as any).postLayoutResultData(server, data);
      expect(server.setRef).toHaveBeenCalledWith('LayoutResult', { data });
    });
  });

  describe('jumpToCodeLine', () => {
    it('should open document and jump to line', async () => {
      const mockEditor = {
        selection: null as any,
        revealRange: vi.fn(),
      };
      vi.mocked(workspace.openTextDocument).mockResolvedValue({} as any);
      vi.mocked(window.showTextDocument).mockResolvedValue(mockEditor as any);

      await BaseGraphMsgHandler.jumpToCodeLine({ file: '/test/file.py', line: 10 });

      expect(workspace.openTextDocument).toHaveBeenCalled();
      expect(window.showTextDocument).toHaveBeenCalled();
      expect(mockEditor.revealRange).toHaveBeenCalled();
    });

    it('should show warning on error', async () => {
      vi.mocked(workspace.openTextDocument).mockRejectedValue(new Error('not found'));

      await BaseGraphMsgHandler.jumpToCodeLine({ file: '/missing.py', line: 1 });

      expect(window.showWarningMessage).toHaveBeenCalled();
    });
  });

  describe('setFinalResult', () => {
    it('should store layout result in DB', async () => {
      const mockStore = { set: vi.fn().mockResolvedValue(undefined), find: vi.fn() };
      mockGetComGraphFinalResultStore.mockReturnValue(mockStore);

      const server = {
        comGraphData: { fsPath: '/test.json', funcHash: '123' },
        diffGraphData: null,
      };
      const message = {
        data: { filePath: 'before', nodes: [] },
        layout: { direction: 'DOWN', showTensor: true },
        threeMode: false,
      };

      await BaseGraphMsgHandler.setFinalResult(message, server);
      expect(mockStore.set).toHaveBeenCalled();
    });

    it('should use diffGraphData when filePath is after', async () => {
      const mockStore = { set: vi.fn().mockResolvedValue(undefined), find: vi.fn() };
      mockGetComGraphFinalResultStore.mockReturnValue(mockStore);

      const server = {
        comGraphData: { fsPath: '/before.json', funcHash: '111' },
        diffGraphData: { fsPath: '/after.json', funcHash: '222' },
      };
      const message = {
        data: { filePath: 'after', nodes: [] },
        layout: { direction: 'UP', showTensor: false },
        threeMode: false,
      };

      await BaseGraphMsgHandler.setFinalResult(message, server);
      expect(mockStore.set).toHaveBeenCalled();
    });

    it('should return early when filePath is falsy', async () => {
      const server = {
        comGraphData: { fsPath: null, funcHash: '123' },
        diffGraphData: null,
      };
      const message = {
        data: { filePath: 'before' },
        layout: { direction: 'DOWN', showTensor: true },
      };

      await BaseGraphMsgHandler.setFinalResult(message, server);
    });
  });

  describe('getHealthyReport', () => {
    it('should call getHealthReport and set ref', async () => {
      const server = { comGraphData: { fsPath: '/test.json' }, setRef: vi.fn() };
      await BaseGraphMsgHandler.getHealthyReport(server);
      expect(mockGetHealthReport).toHaveBeenCalledWith('/test.json');
      expect(server.setRef).toHaveBeenCalledWith('HealthyReport', { data: { score: 90 } });
    });
  });

  describe('accuracy delegates', () => {
    it('getAccurancyReport should delegate', async () => {
      const server = { setRef: vi.fn() };
      await BaseGraphMsgHandler.getAccurancyReport(server);
      expect(mockGetAccurancyReport).toHaveBeenCalledWith(server);
    });

    it('searchAccurancySumList should delegate', async () => {
      const server = { setRef: vi.fn() };
      const msg = { data: {} };
      await BaseGraphMsgHandler.searchAccurancySumList(server, msg);
      expect(mockSearchAccurancySumList).toHaveBeenCalledWith(server, msg);
    });

    it('getAccurancyDetail should delegate', async () => {
      const server = { setRef: vi.fn() };
      const msg = { data: {} };
      await BaseGraphMsgHandler.getAccurancyDetail(server, msg);
      expect(mockGetAccurancyDetail).toHaveBeenCalledWith(server, msg);
    });
  });

  describe('error log delegates', () => {
    it('getErrorMessage should delegate to error-log-parser', async () => {
      const server = { setRef: vi.fn() };
      await TestableHandler.getErrorMessage({}, server);
      expect(mockGetErrorMessage).toHaveBeenCalled();
    });

    it('collectOpMagic should delegate to error-log-parser', async () => {
      const server = { setRef: vi.fn() };
      const result = await TestableHandler.collectOpMagic(server, [], 42);
      expect(mockCollectOpMagic).toHaveBeenCalledWith(server, [], 42);
      expect(result).toEqual(new Set([1, 2]));
    });
  });

  describe('openSearchMode', () => {
    it('should execute command with correct args', async () => {
      const server = {
        comGraphData: { fsPath: '/test.json' },
      };
      const message = {
        data: { nodeMagic: '42', funcHash: '123' },
      };

      await BaseGraphMsgHandler.openSearchMode(message, server);
      expect(commands.executeCommand).toHaveBeenCalledWith(
        'PyPTO.Open.OpenComGraphForNodeSearch',
        expect.any(Object),
        '123',
        '42',
      );
    });
  });

  describe('loadEntryFunction', () => {
    it('should read and parse JSON file, set JsonContent ref', async () => {
      const entryFunc = { hash: 'entry1', name: 'main' };
      mockReadFile.mockResolvedValue(
        JSON.stringify({ functions: [entryFunc], entryhash: 'entry1' }),
      );

      const server = { setRef: vi.fn() };
      await BaseGraphMsgHandler.loadEntryFunction('/test/file.json', server);
      expect(server.setRef).toHaveBeenCalledWith('JsonContent', { data: entryFunc });
    });

    it('should throw when entry function not found', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({ functions: [{ hash: 'other' }], entryhash: 'entry1' }),
      );

      const server = { setRef: vi.fn() };
      await expect(BaseGraphMsgHandler.loadEntryFunction('/test/file.json', server)).rejects.toThrow();
    });

    it('should throw on file read error', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const server = { setRef: vi.fn() };
      await expect(BaseGraphMsgHandler.loadEntryFunction('/missing.json', server)).rejects.toThrow('ENOENT');
    });
  });

  describe('postRenderJson', () => {
    it('should set ComData ref for returnCom command', async () => {
      const server: any = {
        setRef: vi.fn(),
        comGraphData: {
          fsPath: '/test/Pass_001/func_123.json',
          outputDirPath: '/output',
          pathName: 'test',
          comPath: '/com',
          version: '1.0',
        },
        query: {},
        isLeaf: false,
      };
      const json = { operations: [1, 2], rawtensors: [1], tensors: [1, 2, 3] };

      await (TestableHandler as any).postRenderJson(server, json, 'returnCom');
      expect(server.setRef).toHaveBeenCalledWith('ComData', expect.objectContaining({
        data: json,
        step: 'convertData',
      }));
    });

    it('should set PathOriginMode when node count exceeds limit', async () => {
      const server: any = {
        setRef: vi.fn(),
        comGraphData: {
          fsPath: '/test/Pass_001/func_123.json',
          outputDirPath: '/output',
          pathName: 'test',
          comPath: '/com',
          version: '1.0',
        },
        query: {},
        isLeaf: false,
      };
      const ops = Array.from({ length: 10001 }, (_, i) => i);
      const json = { operations: ops, rawtensors: [], tensors: [] };

      await (TestableHandler as any).postRenderJson(server, json, 'returnCom');
      expect(server.setRef).toHaveBeenCalledWith('PathOriginMode', expect.objectContaining({
        data: 1,
      }));
    });

    it('should set PathOriginMode for node search', async () => {
      const server: any = {
        setRef: vi.fn(),
        comGraphData: {
          fsPath: '/test/Pass_001/func_123.json',
          outputDirPath: '/output',
          pathName: 'test',
          comPath: '/com',
          version: '1.0',
        },
        query: { isSearch: true, nodeMagic: '42' },
        isLeaf: false,
      };
      const json = { operations: [1], rawtensors: [], tensors: [] };

      await (TestableHandler as any).postRenderJson(server, json, 'returnCom');
      expect(server.setRef).toHaveBeenCalledWith('PathOriginMode', expect.objectContaining({
        data: 3,
        nodeMagic: '42',
      }));
    });

    it('should set PathOriginMode for search with no magic', async () => {
      const server: any = {
        setRef: vi.fn(),
        comGraphData: {
          fsPath: '/test/Pass_001/func_123.json',
          outputDirPath: '/output',
          pathName: 'test',
          comPath: '/com',
          version: '1.0',
        },
        query: { isSearch: true, nodeMagic: '-1' },
        isLeaf: false,
      };
      const json = { operations: [1], rawtensors: [], tensors: [] };

      await (TestableHandler as any).postRenderJson(server, json, 'returnCom');
      expect(server.setRef).toHaveBeenCalledWith('PathOriginMode', expect.objectContaining({
        data: 2,
        nodeMagic: '-1',
      }));
    });

    it('should set DiffComData for returnDiffCom command', async () => {
      const server: any = { setRef: vi.fn() };
      const json = { diff: true };

      await (TestableHandler as any).postRenderJson(server, json, 'returnDiffCom');
      expect(server.setRef).toHaveBeenCalledWith('DiffComData', { step: 'convertData', diffInfo: json });
    });

    it('should extract passIndex from Pass directory path', async () => {
      const server: any = {
        setRef: vi.fn(),
        comGraphData: {
          fsPath: '/test/Pass_003_MyPass/func_123.json',
          outputDirPath: '/output',
          pathName: 'test',
          comPath: '/com',
          version: '1.0',
        },
        query: {},
        isLeaf: false,
      };
      const json = { operations: [1], rawtensors: [], tensors: [] };

      await (TestableHandler as any).postRenderJson(server, json, 'returnCom');
      expect(server.setRef).toHaveBeenCalledWith('ComData', expect.objectContaining({
        passIndex: '003',
      }));
    });
  });

  describe('loadFuncHashMap', () => {
    it('should use existing funcHashMap from gd when available', async () => {
      const gd: any = {
        fsPath: '/test.json',
        funcHashMap: { '123': { func_magicname: 'func1' } },
        isUsedDB: false,
      };
      const server = { setRef: vi.fn() };

      await (TestableHandler as any).loadFuncHashMap(server, gd);
      expect(graphFileHashMapData['/test.json']).toEqual({ '123': { func_magicname: 'func1' } });
    });

    it('should load from DB when funcHashMap is empty', async () => {
      const gd: any = {
        fsPath: '/test2.json',
        funcHashMap: {},
        isUsedDB: true,
      };
      const server = { setRef: vi.fn() };
      mockRetryUntil.mockResolvedValue({
        data: JSON.stringify({ '456': { func_magicname: 'func2' } }),
      });

      await (TestableHandler as any).loadFuncHashMap(server, gd);
      expect(graphFileHashMapData['/test2.json']).toEqual({ '456': { func_magicname: 'func2' } });
    });

    it('should try DB when graphFileHashMap already has entry', async () => {
      graphFileHashMapData['/test3.json'] = { existing: true };
      const gd: any = {
        fsPath: '/test3.json',
        funcHashMap: {},
        isUsedDB: false,
      };
      const server = { setRef: vi.fn() };
      mockRetryUntil.mockResolvedValue({
        data: JSON.stringify({ '789': { func_magicname: 'func3' } }),
      });

      await (TestableHandler as any).loadFuncHashMap(server, gd);
      expect(mockRetryUntil).toHaveBeenCalled();
      expect(graphFileHashMapData['/test3.json']).toEqual({ '789': { func_magicname: 'func3' } });
    });
  });

  describe('getJsonData', () => {
    it('should read file when DB not used', async () => {
      const gd: any = {
        fsPath: '/test.json',
        isUsedDB: false,
        readFileAndSetCache: vi.fn().mockResolvedValue(undefined),
      };
      const server = { setRef: vi.fn(), comGraphData: gd };

      const result = await (TestableHandler as any).getJsonData(gd, server);
      expect(gd.readFileAndSetCache).toHaveBeenCalledWith('/test.json');
      expect(result).toBe(true);
    });

    it('should read file when DB has no records', async () => {
      const mockQuery = {
        filter: vi.fn(() => ({
          count: vi.fn().mockResolvedValue(0),
          exec: vi.fn().mockResolvedValue([]),
        })),
      };
      mockGetComGraphFuncDataStore.mockReturnValue({
        query: () => mockQuery,
        find: vi.fn(),
        set: vi.fn(),
      });

      const gd: any = {
        fsPath: '/test.json',
        isUsedDB: true,
        readFileAndSetCache: vi.fn().mockResolvedValue(undefined),
      };
      const server = { setRef: vi.fn(), comGraphData: gd };

      const result = await (TestableHandler as any).getJsonData(gd, server);
      expect(gd.readFileAndSetCache).toHaveBeenCalledWith('/test.json');
      expect(result).toBe(true);
    });

    it('should skip reading when DB has records', async () => {
      const mockQuery = {
        filter: vi.fn(() => ({
          count: vi.fn().mockResolvedValue(5),
          exec: vi.fn().mockResolvedValue([{ firstEntryHash: 'hash1', funcHash: '0' }]),
        })),
      };
      mockGetComGraphFuncDataStore.mockReturnValue({
        query: () => mockQuery,
        find: vi.fn(),
        set: vi.fn(),
      });

      const gd: any = {
        fsPath: '/test.json',
        isUsedDB: true,
        readFileAndSetCache: vi.fn().mockResolvedValue(undefined),
      };
      const server = { setRef: vi.fn(), comGraphData: gd };

      const result = await (TestableHandler as any).getJsonData(gd, server);
      expect(gd.readFileAndSetCache).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle errors from readFileAndSetCache', async () => {
      const gd: any = {
        fsPath: '/test.json',
        isUsedDB: false,
        readFileAndSetCache: vi.fn().mockRejectedValue({ code: 'FILE_READ_ERROR', message: 'read failed' }),
      };
      const server = { setRef: vi.fn(), comGraphData: gd };

      await (TestableHandler as any).getJsonData(gd, server);
    });
  });

  describe('createJsonGraphData', () => {
    it('should create sprotty graph via AscppDagBuilder', () => {
      const data: any = {
        comGraphData: {},
        currentData: {},
        showTensorNodes: [],
        showSyncNodes: [],
        colorBySubgraph: false,
        isDark: true,
        isLeaf: false,
        selectedSubgraphId: null,
        nodeMagic: null,
        searchLevel: 0,
        threeMode: false,
      };
      const server = { comGraphData: { wrongRawMagicList: {} } };

      const result = TestableHandler.createJsonGraphData(data, server, new Set(), undefined);
      expect(result).toEqual({ nodes: [], edges: [] });
    });
  });

  describe('getInitialData', () => {
    it('should return early when loadMainData returns false', async () => {
      TestableHandler.mockLoadResult = false;
      const server = { setRef: vi.fn() };

      await TestableHandler.getInitialData(server);
      expect(server.setRef).toHaveBeenCalledWith('IDELang', expect.any(Object));
    });

    it('should return early when checkFuncHash fails', async () => {
      TestableHandler.mockLoadResult = true;
      TestableHandler.mockGd = { fsPath: '/test.json', funcHash: null };
      const server = { setRef: vi.fn() };

      await TestableHandler.getInitialData(server);
      expect(server.setRef).toHaveBeenCalledWith('ErrorMessage', expect.any(Object));
    });
  });

  describe('openDiffViewer', () => {
    it('should open diff graph via editorView', async () => {
      const mockOpen = vi.fn();
      vi.doMock('../../../src/view', () => ({
        useView: () => ({ editorView: { open: mockOpen } }),
      }));

      const server = {
        comGraphData: { fsPath: '/test.json', funcHash: '123' },
      };
      const query = { step: '1' };

      await BaseGraphMsgHandler.openDiffViewer(server, query);
    });

    it('should parse string query', async () => {
      const server = {
        comGraphData: { fsPath: '/test.json', funcHash: '123' },
      };
      const query = JSON.stringify({ step: '1' });

      await BaseGraphMsgHandler.openDiffViewer(server, query);
    });
  });

  describe('layout delegates', () => {
    it('layoutByLocal should delegate to elk-layout-service', async () => {
      const server = { setRef: vi.fn() };
      const gd = { fsPath: '/test.json' };
      await BaseGraphMsgHandler.layoutByLocal(server, gd, '12345', 'hash1');
      expect(mockLayoutByLocal).toHaveBeenCalled();
    });

    it('layout should delegate to elk-layout-service', async () => {
      const gd = { fsPath: '/test.json' };
      const server = { setRef: vi.fn() };
      await BaseGraphMsgHandler.layout(gd, server);
      expect(mockNativeOrElkLayout).toHaveBeenCalled();
    });

    it('renderLayout should delegate to elk-layout-service', () => {
      const server = { setRef: vi.fn() };
      BaseGraphMsgHandler.renderLayout('{}', '{}', server);
      expect(mockRenderLayout).toHaveBeenCalled();
    });
  });

  describe('getSubHash', () => {
    it('should return empty array when callHashArr is empty string', async () => {
      const gd: any = { isUsedDB: false, callHashArrMap: { '123': '' } };
      const result = await (TestableHandler as any).getSubHash('123', gd);
      expect(result).toEqual([]);
    });

    it('should return split array from memory mode', async () => {
      const gd: any = { isUsedDB: false, callHashArrMap: { '123': 'a,b,c' } };
      const result = await (TestableHandler as any).getSubHash('123', gd);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should return undefined split when no data', async () => {
      const gd: any = { isUsedDB: false, callHashArrMap: {} };
      const result = await (TestableHandler as any).getSubHash('123', gd);
      expect(result).toBeUndefined();
    });

    it('should use DB when isUsedDB is true', async () => {
      mockRetryUntil.mockResolvedValue(null);
      const mockStore = {
        find: vi.fn().mockResolvedValue({ callHashArr: 'x,y' }),
      };
      mockGetComGraphFuncDataStore.mockReturnValue(mockStore);

      const gd: any = { isUsedDB: true, fsPath: '/test.json', callHashArrMap: {} };
      const result = await (TestableHandler as any).getSubHash('123', gd);
      expect(result).toEqual(['x', 'y']);
    });
  });

  describe('generateFucTree', () => {
    it('should return empty object when no sub hashes', async () => {
      const gd: any = { isUsedDB: false, callHashArrMap: {} };
      const result = await (TestableHandler as any).generateFucTree('123', gd);
      expect(result).toEqual({});
    });

    it('should build tree from sub hashes', async () => {
      const gd: any = { isUsedDB: false, callHashArrMap: { 'root': 'a,b', 'a': '', 'b': '' } };
      const result = await (TestableHandler as any).generateFucTree('root', gd);
      expect(result).toHaveProperty('a');
      expect(result).toHaveProperty('b');
    });

    it('should use arrays for nested loops', async () => {
      const gd: any = { isUsedDB: false, callHashArrMap: { 'root': 'a', 'a': 'b', 'b': '' } };
      const result = await (TestableHandler as any).generateFucTree('root', gd);
      expect(result).toHaveProperty('a');
    });
  });

  describe('abstract methods', () => {
    it('loadMainData should throw', async () => {
      await expect((BaseGraphMsgHandler as any).loadMainData({})).rejects.toThrow('子类必须覆盖 loadMainData 方法');
    });

    it('loadDiffData should throw', async () => {
      await expect((BaseGraphMsgHandler as any).loadDiffData({}, '')).rejects.toThrow('子类必须覆盖 loadDiffData 方法');
    });

    it('getGraphData should throw', () => {
      expect(() => (BaseGraphMsgHandler as any).getGraphData({})).toThrow('子类必须覆盖 getGraphData 方法');
    });

    it('getSprottyGraphWithLevel should throw', async () => {
      await expect((BaseGraphMsgHandler as any).getSprottyGraphWithLevel({}, {})).rejects.toThrow('comgraph子类必须覆盖 getSprottyGraphWithLevel 方法');
    });
  });

  describe('innerGetSubgraph', () => {
    it('should return error when data not found', async () => {
      TestableHandler.mockGd = {
        fsPath: '/test.json',
        funcHash: '123',
        isUsedDB: false,
        dataMap: {},
      };
      const server = { setRef: vi.fn() };

      const result = await TestableHandler.innerGetSubgraph(server, { calleehash: '123' });
      expect(result).toEqual({ json: undefined });
      expect(server.setRef).toHaveBeenCalledWith('ErrorMessage', expect.any(Object));
    });

    it('should return parsed JSON from memory mode', async () => {
      const funcData = { operations: [] };
      TestableHandler.mockGd = {
        fsPath: '/test.json',
        funcHash: '123',
        isUsedDB: false,
        dataMap: { '123': JSON.stringify(funcData) },
      };
      const server = { setRef: vi.fn() };

      await TestableHandler.innerGetSubgraph(server, { calleehash: '123' });
      expect(server.setRef).toHaveBeenCalledWith('JsonContent', { data: funcData });
    });

    it('should call loadEntryFunction for non-numeric calleehash', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({ functions: [{ hash: 'entry1' }], entryhash: 'entry1' }),
      );

      TestableHandler.mockGd = {
        fsPath: '/test.json',
        funcHash: 'entry1',
        isUsedDB: false,
        dataMap: {},
      };
      const server = { setRef: vi.fn() };

      await TestableHandler.innerGetSubgraph(server, { calleehash: '/path/to/file.json' });
      expect(server.setRef).toHaveBeenCalledWith('JsonContent', expect.any(Object));
    });
  });

  describe('searchAllFunc', () => {
    it('should set empty result when funcHashMap is missing', async () => {
      TestableHandler.mockGd = {
        fsPath: '/no-hash.json',
        funcHash: '123',
        isUsedDB: false,
        dataMap: {},
      };
      const server = { setRef: vi.fn() };

      await TestableHandler.searchAllFunc(server, { keyword: 'test' });
      expect(server.setRef).toHaveBeenCalledWith('GlobalSearchResult', { data: {} });
    });
  });

  describe('getJsonGraphData', () => {
    it('should create new graph data when cache miss', async () => {
      mockGetComGraphFinalResultStore.mockReturnValue({
        find: vi.fn().mockResolvedValue(null),
        set: vi.fn(),
      });

      const server: any = {
        comGraphData: {
          fsPath: '/test.json',
          funcHash: '123',
          isUsedDB: false,
          wrongRawMagicList: {},
          failOpMagicList: [],
          failMagicList: [],
        },
        setRef: vi.fn(),
      };
      const message = {
        data: {
          filePath: 'before',
          layout: { direction: 'DOWN', showTensor: true },
          threeMode: false,
          currentData: { funcmagic: 123 },
          comGraphData: { isLeaf: false },
          showTensorNodes: [],
          showSyncNodes: [],
          colorBySubgraph: false,
          isDark: true,
          selectedSubgraphId: null,
          nodeMagic: null,
          searchLevel: 0,
          version: '1.0',
        },
      };

      await TestableHandler.getJsonGraphData(message, server);
      expect(server.setRef).toHaveBeenCalledWith('JsonGraphData', expect.any(Object));
    });

    it('should use cached data when filePath is not set and cache matches', async () => {
      const cachedResult = {
        lastChangeTime: '12345',
        finalResult: JSON.stringify({ nodes: [], isFinial: false }),
      };
      const mockStore = {
        find: vi.fn().mockResolvedValue(cachedResult),
        set: vi.fn(),
      };
      mockGetComGraphFinalResultStore.mockReturnValue(mockStore);

      const server: any = {
        comGraphData: {
          fsPath: '/test.json',
          funcHash: '123',
          isUsedDB: true,
          wrongRawMagicList: {},
          failOpMagicList: [],
          failMagicList: [],
        },
        setRef: vi.fn(),
      };
      const message = {
        data: {
          layout: { direction: 'DOWN', showTensor: true },
          threeMode: false,
          currentData: { funcmagic: 123 },
        },
      };

      await TestableHandler.getJsonGraphData(message, server);
      expect(server.setRef).toHaveBeenCalledWith('JsonGraphData', expect.any(Object));
    });
  });

  describe('getSubgraph', () => {
    it('should open ROOT subgraph when file ends with ROOT', async () => {
      const { readdirSync } = await import('fs');
      vi.mocked(readdirSync).mockReturnValue(['file_123.json', 'file_456.json'] as any);

      const server: any = {
        comGraphData: { fsPath: '/test/Pass_001/func_123_TENSOR_456_ROOT.json', calleehash: '789' },
        entryHash: '123',
      };
      const subInfo = { calleehash: '789', subFuncmagicname: 'subFunc', curPath: '/test' };

      await TestableHandler.getSubgraph(server, subInfo, {});
      expect(commands.executeCommand).toHaveBeenCalledWith('PyPTO.Open.OpenRenderGraphForCurrent', expect.any(Object), 'subFunc');
    });

    it('should reveal existing panel when entryHash matches', async () => {
      const mockPanel = { reveal: vi.fn(), ViewColumn: 1 };
      const { hismartliteEx } = await import('../../../src/hismarliteEx');
      (hismartliteEx as any).webviews = { 'func_123_TENSOR_456_ROOT.json': mockPanel };

      const server: any = {
        comGraphData: { fsPath: '/test/func_123_TENSOR_456_ROOT.json', calleehash: '123' },
        entryHash: '123',
      };
      const subInfo = { calleehash: '123', subFuncmagicname: 'subFunc', curPath: '/test' };

      await TestableHandler.getSubgraph(server, subInfo, {});
      expect(mockPanel.reveal).toHaveBeenCalled();
      (hismartliteEx as any).webviews = {};
    });

    it('should reveal existing panel when subFuncmagicname matches', async () => {
      const mockPanel = { reveal: vi.fn(), ViewColumn: 1 };
      const { hismartliteEx } = await import('../../../src/hismarliteEx');
      (hismartliteEx as any).webviews = { 'subFunc': mockPanel };

      const server: any = {
        comGraphData: { fsPath: '/test/func_123.json', calleehash: '789', subFuncmagicname: 'subFunc' },
        entryHash: '123',
      };
      const subInfo = { calleehash: '789', subFuncmagicname: 'subFunc', curPath: '/test' };

      await TestableHandler.getSubgraph(server, subInfo, {});
      expect(mockPanel.reveal).toHaveBeenCalled();
      (hismartliteEx as any).webviews = {};
    });
  });

  describe('render', () => {
    it('should fetch graph json and post render data', async () => {
      const mockGd: any = {
        fsPath: '/test.json',
        funcHash: '123',
        isUsedDB: false,
        dataMap: { '123': JSON.stringify({ operations: [1], rawtensors: [], tensors: [] }) },
        callHashArrMap: {},
        outputDirPath: '/output',
        pathName: 'test',
        comPath: '/com',
        version: '1.0',
      };
      TestableHandler.mockGd = mockGd;
      mockGetFailMagicList.mockResolvedValue({});
      mockApplyFailMagicResults.mockReturnValue(true);
      graphFileHashMapData['/test.json'] = { '123': { func_magicname: 'func1' } };

      const server: any = {
        comGraphData: mockGd,
        setRef: vi.fn(),
        query: {},
        isLeaf: false,
      };

      await (TestableHandler as any).render(server);
      expect(server.setRef).toHaveBeenCalled();
    });

    it('should return early when json is undefined', async () => {
      const mockGd: any = {
        fsPath: '/test.json',
        funcHash: '123',
        isUsedDB: false,
        dataMap: {},
        callHashArrMap: {},
      };
      TestableHandler.mockGd = mockGd;
      mockGetFailMagicList.mockResolvedValue({});
      mockApplyFailMagicResults.mockReturnValue(true);

      const server: any = {
        comGraphData: mockGd,
        setRef: vi.fn(),
        query: {},
      };

      await (TestableHandler as any).render(server);
    });

    it('should attach inouttensors when calleeOpMagic is set', async () => {
      const mockGd: any = {
        fsPath: '/test.json',
        funcHash: '123',
        isUsedDB: false,
        dataMap: { '123': JSON.stringify({ operations: [1], rawtensors: [], tensors: [] }) },
        callHashArrMap: {},
        outputDirPath: '/output',
        pathName: 'test',
        comPath: '/com',
        version: '1.0',
      };
      TestableHandler.mockGd = mockGd;
      BaseGraphMsgHandler.globalCallInOutTensorMap.set('123', { in: [1], out: [2] });
      mockGetFailMagicList.mockResolvedValue({});
      mockApplyFailMagicResults.mockReturnValue(true);
      graphFileHashMapData['/test.json'] = { '123': { func_magicname: 'func1' } };

      const server: any = {
        comGraphData: mockGd,
        setRef: vi.fn(),
        query: { calleeOpMagic: '42' },
        isLeaf: false,
      };

      await (TestableHandler as any).render(server);
      expect(server.setRef).toHaveBeenCalled();
    });
  });

  describe('getSubgraph editorView routing', () => {
    it('should open non-ROOT subgraph via editorView with deepened parentInfo', async () => {
      const mockOpen = vi.fn();
      vi.doMock('../../../src/view', () => ({
        useView: () => ({ editorView: { open: mockOpen } }),
      }));

      const server: any = {
        comGraphData: { fsPath: '/test/func_123.json', calleehash: '789' },
        entryHash: '123',
      };
      const subInfo = {
        calleehash: '789',
        subFuncmagicname: 'subFunc',
        curPath: '/test',
        calleeOpMagic: '42',
        calleeOpSubgraphId: '1',
      };

      try {
        await TestableHandler.getSubgraph(server, subInfo, {});
        expect(mockOpen).toHaveBeenCalledWith(
          'computeGraph',
          expect.anything(),
          expect.objectContaining({ title: 'subFunc' }),
        );
      } finally {
        vi.doUnmock('../../../src/view');
      }
    });

    it('should go back one level when calleeOpMagic is absent', async () => {
      const mockOpen = vi.fn();
      vi.doMock('../../../src/view', () => ({
        useView: () => ({ editorView: { open: mockOpen } }),
      }));

      const server: any = {
        comGraphData: { fsPath: '/test/func_123.json', calleehash: '789' },
        entryHash: '123',
      };
      const subInfo = { calleehash: '789', subFuncmagicname: 'subFunc', curPath: '/test' };
      const query = { parentInfo: { level: 2, calleeOpMagic: '42', calleeOpSubgraphId: '1' } };

      try {
        await TestableHandler.getSubgraph(server, subInfo, query);
        expect(mockOpen).toHaveBeenCalled();
        const parentInfo = mockBuildSubgraphQuery.mock.calls.at(-1)![7];
        expect(parentInfo.level).toBe(1);
        expect(parentInfo.calleeOpMagic).toBeUndefined();
      } finally {
        vi.doUnmock('../../../src/view');
      }
    });
  });

  describe('render in db mode', () => {
    it('should fetch func data and calleeMap from DB and honor multiple-graph firstExecFuncHash', async () => {
      const mockGd: any = {
        fsPath: '/test.json',
        funcHash: '123',
        firstExecFuncHash: '456',
        isUsedDB: true,
        dataMap: {},
        callHashArrMap: {},
        outputDirPath: '/output',
        pathName: 'test',
        comPath: '/com',
        version: '1.0',
      };
      TestableHandler.mockGd = mockGd;
      mockRetryUntil.mockImplementation((fn: () => any) => fn());
      const funcDataFind = vi.fn().mockResolvedValue({ data: JSON.stringify({ operations: [], rawtensors: [], tensors: [] }) });
      mockGetComGraphFuncDataStore.mockReturnValue({
        find: funcDataFind,
        set: vi.fn(),
      } as any);
      mockGetComGraphFileHashMapStore.mockReturnValue({
        find: vi.fn().mockResolvedValue({ data: JSON.stringify({ '456': { func_magicname: 'func2' } }) }),
        set: vi.fn(),
      } as any);
      mockGetFailMagicList.mockResolvedValue({});
      mockApplyFailMagicResults.mockReturnValue(true);

      const server: any = {
        comGraphData: mockGd,
        setRef: vi.fn(),
        query: {},
        isLeaf: false,
        title: 'multiple graph',
      };

      await (TestableHandler as any).render(server);

      expect(mockGd.funcHash).toBe('456');
      expect(funcDataFind).toHaveBeenCalledWith({ filePath: '/test.json', funcHash: '456' });
      const calleeMapCalls = server.setRef.mock.calls.filter(([key]: any[]) => key === 'CalleeMap');
      expect(calleeMapCalls).toHaveLength(1);
      expect(calleeMapCalls[0][1].data).toEqual({ '456': { func_magicname: 'func2' } });
    });

    it('should report error when calleeMap is missing in db mode', async () => {
      const mockGd: any = {
        fsPath: '/test-miss.json',
        funcHash: '123',
        isUsedDB: true,
        dataMap: {},
        callHashArrMap: {},
        outputDirPath: '/output',
        pathName: 'test',
        comPath: '/com',
        version: '1.0',
      };
      TestableHandler.mockGd = mockGd;
      graphFileHashMapData['/test-miss.json'] = {};
      mockRetryUntil.mockImplementation((fn: () => any) => fn());
      mockGetComGraphFuncDataStore.mockReturnValue({
        find: vi.fn().mockResolvedValue({ data: JSON.stringify({ operations: [], rawtensors: [], tensors: [] }) }),
        set: vi.fn(),
      } as any);
      mockGetComGraphFileHashMapStore.mockReturnValue({
        find: vi.fn().mockResolvedValue(null),
        set: vi.fn(),
      } as any);
      mockGetFailMagicList.mockResolvedValue({});
      mockApplyFailMagicResults.mockReturnValue(true);

      const server: any = {
        comGraphData: mockGd,
        setRef: vi.fn(),
        query: {},
        isLeaf: false,
      };

      await (TestableHandler as any).render(server);

      const errorCalls = server.setRef.mock.calls.filter(([key]: any[]) => key === 'ErrorMessage');
      expect(errorCalls).toHaveLength(1);
    });

    it('should search subgraph files for ROOT graphs', async () => {
      const { readdirSync, readFileSync } = await import('fs');
      vi.mocked(readdirSync).mockReturnValue(['func_789.json']);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ functions: [{ functype: 'PATH', func_magicname: 'sub', graphtype: '1' }] }),
      );

      const mockGd: any = {
        fsPath: '/test/func_123_ROOT.json',
        funcHash: '123',
        isUsedDB: false,
        dataMap: { '123': JSON.stringify({ operations: [{ calleehash: '789' }], rawtensors: [], tensors: [] }) },
        callHashArrMap: {},
        outputDirPath: '/output',
        pathName: 'test',
        comPath: '/com',
        version: '1.0',
      };
      TestableHandler.mockGd = mockGd;
      graphFileHashMapData['/test/func_123_ROOT.json'] = {};
      mockGetFailMagicList.mockResolvedValue({});
      mockApplyFailMagicResults.mockReturnValue(true);

      const server: any = {
        comGraphData: mockGd,
        setRef: vi.fn(),
        query: {},
        isLeaf: false,
      };

      await (TestableHandler as any).render(server);

      expect(graphFileHashMapData['/test/func_123_ROOT.json']['789']).toEqual({
        functype: 'PATH',
        func_magicname: 'sub',
        graphtype: '1',
      });
    });
  });

  describe('searchAllFunc with populated data', () => {
    it('should collect hits across functions in memory mode', async () => {
      const Extractor = await import('../../../src/utils/graphExtractor');
      vi.mocked(Extractor.searchFunc).mockReturnValueOnce([{ name: 'hit' }] as any);

      TestableHandler.mockGd = {
        fsPath: '/hashmap.json',
        funcHash: '123',
        isUsedDB: false,
        dataMap: { '123': JSON.stringify({}), '456': JSON.stringify({}) },
      };
      graphFileHashMapData['/hashmap.json'] = { '123': { func_magicname: 'f1' }, '456': { func_magicname: 'f2' } };
      const server = { setRef: vi.fn() };

      await TestableHandler.searchAllFunc(server, { keyword: 'test' });

      expect(server.setRef).toHaveBeenCalledWith('GlobalSearchResult', { data: { '123': [{ name: 'hit' }] } });
    });

    it('should break after first function for Function category search', async () => {
      TestableHandler.mockGd = {
        fsPath: '/func-cat.json',
        funcHash: '123',
        isUsedDB: false,
        dataMap: { '123': JSON.stringify({}), '456': JSON.stringify({}) },
      };
      graphFileHashMapData['/func-cat.json'] = { '123': { func_magicname: 'f1' }, '456': { func_magicname: 'f2' } };
      const server = { setRef: vi.fn() };

      await TestableHandler.searchAllFunc(server, { keyword: 'test', category: 'Function' });

      expect(server.setRef).toHaveBeenCalledWith('GlobalSearchResult', { data: {} });
    });

    it('should fetch func data from DB in db mode', async () => {
      mockRetryUntil.mockImplementation((fn: () => any) => fn());
      const funcDataFind = vi.fn().mockResolvedValue({ data: JSON.stringify({}) });
      mockGetComGraphFuncDataStore.mockReturnValue({
        find: funcDataFind,
        set: vi.fn(),
      } as any);

      TestableHandler.mockGd = {
        fsPath: '/db-hash.json',
        funcHash: '123',
        isUsedDB: true,
        dataMap: {},
      };
      graphFileHashMapData['/db-hash.json'] = { '123': { func_magicname: 'f1' } };
      const server = { setRef: vi.fn() };

      await TestableHandler.searchAllFunc(server, { keyword: 'x', category: 'Function' });

      expect(funcDataFind).toHaveBeenCalledWith({ filePath: '/db-hash.json', funcHash: '123' });
      expect(server.setRef).toHaveBeenCalledWith('GlobalSearchResult', { data: {} });
    });
  });

  describe('innerGetSubgraph in db mode', () => {
    it('should retry fetching func data from DB until found', async () => {
      mockRetryUntil.mockImplementation((fn: () => any) => fn());
      let callCount = 0;
      mockGetComGraphFuncDataStore.mockReturnValue({
        find: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount < 3) {
            return null;
          }
          return { data: JSON.stringify({ operations: [] }) };
        }),
        set: vi.fn(),
      } as any);

      TestableHandler.mockGd = {
        fsPath: '/test.json',
        funcHash: '123',
        isUsedDB: true,
        dataMap: {},
      };
      const server = { setRef: vi.fn() };

      await TestableHandler.innerGetSubgraph(server, { calleehash: '123' });

      expect(callCount).toBe(3);
      expect(server.setRef).toHaveBeenCalledWith('JsonContent', { data: { operations: [] } });
    });
  });
});
