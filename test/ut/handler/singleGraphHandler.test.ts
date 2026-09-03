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

const mockSingleGraphData = vi.hoisted(() => {
  const MockSingleGraphData = vi.fn(function(this: any, fsPath: string, funcHash?: string) {
    this.fsPath = fsPath;
    this.funcHash = funcHash;
    this.calleeOpMagic = undefined;
    this.calleeOpSubgraphId = undefined;
    this.isUsedDB = false;
    this.firstExecFuncHash = '';
    this.curPath = undefined;
  });
  MockSingleGraphData.getEntryHash = vi.fn().mockResolvedValue({ entryhash: 'test-entry-hash' });
  return MockSingleGraphData;
});

const mockGetComGraphFileCalleeOpAttrStore = vi.hoisted(() =>
  vi.fn(() => ({
    find: vi.fn().mockResolvedValue(null),
  }))
);

const mockAscppDagBuilder = vi.hoisted(() => {
  const MockBuilder = vi.fn(function(this: any, _comGraphData: any, _server: any, _version: any, _callInOutTensorMap: any) {
    this.createSprottyGraph = vi.fn().mockReturnValue({ nodes: [], edges: [] });
  });
  return MockBuilder;
});

const mockGenerateFucTree = vi.hoisted(() => vi.fn().mockResolvedValue({ children: [] }));

vi.mock('../../../src/core/graphData', () => ({
  SingleGraphData: mockSingleGraphData,
  AbstractGraphData: class {},
}));

vi.mock('../../../src/core/sqlInit', () => ({
  getComGraphFileCalleeOpAttrStore: mockGetComGraphFileCalleeOpAttrStore,
}));

vi.mock('../../../src/core/json-graph/jsonGraph', () => ({
  AscppDagBuilder: mockAscppDagBuilder,
}));

vi.mock('../../../src/handler/baseGraphMsgHandler', () => ({
  BaseGraphMsgHandler: class {
    static callInOutTensorMap = new Map();
    static initTheme = vi.fn();
    static generateFucTree = mockGenerateFucTree;
    static postJsonGraphData = vi.fn();
  },
}));

import { SingleGraphHandler } from '../../../src/handler/singleGraphHandler';

describe('SingleGraphHandler', () => {
  let mockServer: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = {
      query: {
        _path: '/test/graph.json',
        funcHash: 'test-func-hash',
        calleeOpMagic: undefined,
        calleeOpSubgraphId: undefined,
        outputDirPath: undefined,
        pathName: undefined,
        curPath: undefined,
        magicName: undefined,
        parentInfo: undefined,
      },
      comGraphData: undefined,
      entryHash: undefined,
      setRef: vi.fn(),
    };
    SingleGraphHandler.graphLastRenderData = undefined;
  });

  describe('loadMainData', () => {
    it('should create SingleGraphData when not exists', async () => {
      const result = await (SingleGraphHandler as any).loadMainData(mockServer);
      expect(mockSingleGraphData).toHaveBeenCalledWith(
        '/test/graph.json',
        'test-func-hash',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
      expect(result).toBe(true);
    });

    it('should resolve entryHash when not set', async () => {
      await (SingleGraphHandler as any).loadMainData(mockServer);
      expect(mockSingleGraphData.getEntryHash).toHaveBeenCalled();
      expect(mockServer.entryHash).toBe('test-entry-hash');
    });

    it('should set funcHash to entryHash when funcHash is empty', async () => {
      mockServer.query.funcHash = undefined;
      await (SingleGraphHandler as any).loadMainData(mockServer);
      expect(mockServer.comGraphData.funcHash).toBe('test-entry-hash');
    });

    it('should handle FILE_READ_ERROR', async () => {
      mockSingleGraphData.getEntryHash.mockRejectedValueOnce({
        code: 'FILE_READ_ERROR',
        message: 'File not found',
      });
      const result = await (SingleGraphHandler as any).loadMainData(mockServer);
      expect(result).toBe(false);
      expect(mockServer.setRef).toHaveBeenCalledWith(
        'ErrorMessage',
        expect.objectContaining({ graphType: 'comGraph' })
      );
    });

    it('should handle JSON_PARSE_ERROR', async () => {
      mockSingleGraphData.getEntryHash.mockRejectedValueOnce({
        code: 'JSON_PARSE_ERROR',
        message: 'Invalid JSON',
      });
      const result = await (SingleGraphHandler as any).loadMainData(mockServer);
      expect(result).toBe(false);
      expect(mockServer.setRef).toHaveBeenCalledWith(
        'ErrorMessage',
        expect.objectContaining({ graphType: 'comGraph' })
      );
    });

    it('should handle unknown errors', async () => {
      mockSingleGraphData.getEntryHash.mockRejectedValueOnce({
        code: 'UNKNOWN',
        message: 'Unknown error',
      });
      const result = await (SingleGraphHandler as any).loadMainData(mockServer);
      expect(result).toBe(false);
      expect(mockServer.setRef).toHaveBeenCalledWith(
        'ErrorMessage',
        expect.objectContaining({ graphType: 'comGraph' })
      );
    });
  });

  describe('getGraphData', () => {
    it('should return comGraphData', () => {
      const mockData = { fsPath: '/test.json' };
      mockServer.comGraphData = mockData;
      const result = (SingleGraphHandler as any).getGraphData(mockServer);
      expect(result).toBe(mockData);
    });
  });

  describe('getGrahpDataExtend', () => {
    it('should call getGraphData', () => {
      const mockData = { fsPath: '/test.json' };
      mockServer.comGraphData = mockData;
      const result = SingleGraphHandler.getGrahpDataExtend(mockServer);
      expect(result).toBe(mockData);
    });
  });

  describe('getSprottyGraphWithLevel', () => {
    it('should create sprotty graph with new search parameters', async () => {
      mockServer.comGraphData = { fsPath: '/test.json', funcHash: 'hash1' };
      SingleGraphHandler.graphLastRenderData = {
        comGraphData: mockServer.comGraphData,
        currentData: {},
        showTensorNodes: true,
        showSyncNodes: false,
        colorBySubgraph: false,
        isDark: true,
        selectedSubgraphId: 0,
        nodeMagic: 'old-magic',
        version: '1.0',
        threeMode: false,
      };

      const searchInfo = { nodeMagic: 'new-magic', searchLevel: 2 };
      await SingleGraphHandler.getSprottyGraphWithLevel(mockServer, searchInfo);

      expect(mockAscppDagBuilder).toHaveBeenCalled();
      const builderInstance = mockAscppDagBuilder.mock.results[0].value;
      expect(builderInstance.createSprottyGraph).toHaveBeenCalledWith(
        {},
        true,
        false,
        false,
        true,
        0,
        'new-magic',
        2
      );
    });

    it('should use existing nodeMagic when searchInfo.nodeMagic is empty', async () => {
      mockServer.comGraphData = { fsPath: '/test.json', funcHash: 'hash1' };
      SingleGraphHandler.graphLastRenderData = {
        comGraphData: mockServer.comGraphData,
        currentData: {},
        showTensorNodes: true,
        showSyncNodes: false,
        colorBySubgraph: false,
        isDark: true,
        selectedSubgraphId: 0,
        nodeMagic: 'existing-magic',
        version: '1.0',
        threeMode: false,
      };

      const searchInfo = { nodeMagic: null, searchLevel: 1 };
      await SingleGraphHandler.getSprottyGraphWithLevel(mockServer, searchInfo);

      const builderInstance = mockAscppDagBuilder.mock.results[0].value;
      expect(builderInstance.createSprottyGraph).toHaveBeenCalledWith(
        {},
        true,
        false,
        false,
        true,
        0,
        'existing-magic',
        1
      );
    });
  });

  describe('returnFuncTree', () => {
    it('should use curPath when length > 1', async () => {
      mockServer.comGraphData = {
        fsPath: '/test.json',
        funcHash: 'current-hash',
        curPath: JSON.stringify(['hash1', 'hash2', 'hash3']),
        firstExecFuncHash: '',
      };
      mockServer.entryHash = 'entry-hash';

      await SingleGraphHandler.returnFuncTree(mockServer);

      expect(mockGenerateFucTree).toHaveBeenCalledWith('hash2', mockServer.comGraphData);
      expect(mockServer.setRef).toHaveBeenCalledWith(
        'FuncTree',
        expect.objectContaining({
          entry: 'current-hash',
          fsPath: '/test.json',
        })
      );
    });

    it('should use firstExecFuncHash when curPath length <= 1', async () => {
      mockServer.comGraphData = {
        fsPath: '/test.json',
        funcHash: 'current-hash',
        curPath: JSON.stringify(['hash1']),
        firstExecFuncHash: 'first-exec-hash',
      };
      mockServer.entryHash = 'entry-hash';

      await SingleGraphHandler.returnFuncTree(mockServer);

      expect(mockGenerateFucTree).toHaveBeenCalledWith('first-exec-hash', mockServer.comGraphData);
    });

    it('should use entryHash when firstExecFuncHash is empty', async () => {
      mockServer.comGraphData = {
        fsPath: '/test.json',
        funcHash: 'current-hash',
        curPath: JSON.stringify(['hash1']),
        firstExecFuncHash: '',
      };
      mockServer.entryHash = 'entry-hash';

      await SingleGraphHandler.returnFuncTree(mockServer);

      expect(mockGenerateFucTree).toHaveBeenCalledWith('entry-hash', mockServer.comGraphData);
    });

    it('should use funcHash as fallback', async () => {
      mockServer.comGraphData = {
        fsPath: '/test.json',
        funcHash: 'current-hash',
        curPath: undefined,
        firstExecFuncHash: '',
      };
      mockServer.entryHash = undefined;

      await SingleGraphHandler.returnFuncTree(mockServer);

      expect(mockGenerateFucTree).toHaveBeenCalledWith('current-hash', mockServer.comGraphData);
    });

    it('should handle invalid curPath JSON', async () => {
      mockServer.comGraphData = {
        fsPath: '/test.json',
        funcHash: 'current-hash',
        curPath: 'invalid-json',
        firstExecFuncHash: 'first-exec-hash',
      };
      mockServer.entryHash = 'entry-hash';

      await SingleGraphHandler.returnFuncTree(mockServer);

      expect(mockGenerateFucTree).toHaveBeenCalledWith('first-exec-hash', mockServer.comGraphData);
    });
  });
});
