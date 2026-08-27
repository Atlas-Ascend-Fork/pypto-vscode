/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockDbRun = vi.fn();
const mockDbClose = vi.fn();
const mockDbExport = vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]));
const mockStmtBind = vi.fn();
const mockStmtStep = vi.fn().mockReturnValue(false);
const mockStmtGetAsObject = vi.fn().mockReturnValue({});
const mockStmtFree = vi.fn();
const mockDbPrepare = vi.fn(() => ({
  bind: mockStmtBind,
  step: mockStmtStep,
  getAsObject: mockStmtGetAsObject,
  free: mockStmtFree,
}));

const mockDatabase = {
  run: mockDbRun,
  close: mockDbClose,
  export: mockDbExport,
  prepare: mockDbPrepare,
};

function MockDatabaseCtor(this: any, _buf?: Uint8Array) {
  Object.assign(this, mockDatabase);
}

const mockSqlJsInstance = {
  Database: MockDatabaseCtor as any,
};

vi.mock('sql.js', () => ({
  default: vi.fn((opts?: any) => {
    if (opts?.locateFile) {
      opts.locateFile();
    }
    return Promise.resolve(mockSqlJsInstance);
  }),
  Database: vi.fn(),
}));

const mockExistsSync = vi.fn().mockReturnValue(false);
const mockFsReadFile = vi.fn();
vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  promises: {
    readFile: (...args: any[]) => mockFsReadFile(...args),
  },
}));

const mockCreateAllTables = vi.fn();
vi.mock('../../../src/core/cache-schema', () => ({
  createAllTables: (...args: any[]) => mockCreateAllTables(...args),
}));

const mockComGraphInstance = {
  layoutSet: vi.fn(),
  layoutGet: vi.fn(),
  layoutDel: vi.fn(),
  finalResultSet: vi.fn(),
  finalResultGet: vi.fn(),
  finalResultDel: vi.fn(),
  funcDataSet: vi.fn(),
  funcDataGetCount: vi.fn(),
  funcDataGet: vi.fn(),
  funcDataDel: vi.fn(),
  fileHashMapSet: vi.fn(),
  fileHashMapGet: vi.fn(),
  fileHashMapDel: vi.fn(),
  fileCalleeOpAttrSet: vi.fn(),
  fileCalleeOpAttrGet: vi.fn(),
};

function MockComGraphCtor(this: any) {
  Object.assign(this, mockComGraphInstance);
}

vi.mock('../../../src/core/com-graph-cache', () => ({
  ComGraphCache: MockComGraphCtor,
}));

const mockAccuracyInstance = {
  toolSet: vi.fn(),
  toolGet: vi.fn(),
  toolGetAll: vi.fn(),
  getStatsByFile: vi.fn(),
  getPhaseStatusListByFunc: vi.fn(),
  getDistinctPhaseResults: vi.fn(),
  getFirstResByPhaseOnTimestamp: vi.fn(),
  getFirstFailByPhase: vi.fn(),
  getStatsByFunc: vi.fn(),
  getErrorDetailsByFunc: vi.fn(),
  getErrorDetailsOfGraphByFunc: vi.fn(),
  getErrorListByPage: vi.fn(),
  cmpSet: vi.fn(),
  getCmpErrorListByFilePath: vi.fn(),
  cmpGetByFilePath: vi.fn(),
  cmpGetCountByFilePath: vi.fn(),
  cmpDetailSet: vi.fn(),
  cmpDetailGetByFilePath: vi.fn(),
  compListSet: vi.fn(),
  compListGetByComputePath: vi.fn(),
  compListGetByFilePath: vi.fn(),
  compListUpdateFirstReq: vi.fn(),
  filePathSet: vi.fn(),
  filePathGet: vi.fn(),
};

function MockAccuracyCtor(this: any) {
  Object.assign(this, mockAccuracyInstance);
}

vi.mock('../../../src/core/accuracy-cache', () => ({
  AccuracyCache: MockAccuracyCtor,
}));

const mockExtractParams = vi.fn((fields: readonly string[], data: any) => fields.map((f) => data[f] ?? ''));
vi.mock('../../../src/core/cache-field-maps', () => ({
  TASK_CMP_FIELDS: [
    'sourceFileName', 'no', 'phaseName', 'ioFlag', 'loopInfo',
    'rootCallOpmagic', 'rootCallRawmagic', 'fileName',
    'aDatatype', 'aFormat', 'aMagic', 'aOpcode', 'aOpMagic', 'aRawMagic',
    'aSymbol', 'aValidshape', 'aDynvalidshape',
    'aOpAttrAtomic', 'aOpAttrSymOfst',
    'aFuncHash', 'aPathHash', 'aRootFuncHash',
    'bDataType', 'bRawShape', 'bValidShape', 'bBlockIdx', 'bOpAttrSymOfst',
    'bSeqNo', 'bTaskId', 'bTensorAddr', 'bTimestamp', 'bExecTimestamp',
    'result', 'rtolAtol',
    'cntFailWarnTol', 'cntTotalZeroInfnanCnt',
    'mae', 'maeTop8', 'maeTop1permil', 'mre', 'mreTop8', 'mreTop1permil',
    'aMax', 'aMin', 'aAvg', 'aAavg', 'aZero', 'aInfnan',
    'bMax', 'bMin', 'bAvg', 'bAavg', 'bZero', 'bInfnan',
  ],
  extractParams: (...args: any[]) => mockExtractParams(...args),
}));

vi.mock('../../../src/core/cache-query-helper', () => ({
  getMTime: vi.fn(),
}));

import * as vscode from 'vscode';

describe('SQLiteCache', () => {
  let SQLiteCache: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockStmtStep.mockReturnValue(false);
    mockStmtGetAsObject.mockReturnValue({});
    mockDbPrepare.mockReturnValue({
      bind: mockStmtBind,
      step: mockStmtStep,
      getAsObject: mockStmtGetAsObject,
      free: mockStmtFree,
    });
    mockDbExport.mockReturnValue(new Uint8Array([1, 2, 3]));
    mockExistsSync.mockReturnValue(false);
    mockFsReadFile.mockResolvedValue('{}');

    vi.mocked(vscode.workspace.fs.createDirectory).mockResolvedValue(undefined as any);
    vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue(new Error('File not found'));
    vi.mocked(vscode.workspace.fs.writeFile).mockResolvedValue(undefined as any);
    vi.mocked(vscode.workspace.fs.delete).mockResolvedValue(undefined as any);

    const mod = await import('../../../src/core/sqliteCache');
    SQLiteCache = mod.SQLiteCache;
  });

  afterEach(() => {
    try {
      SQLiteCache.getInstance()?.dispose();
    } catch {}
  });

  describe('getInstance', () => {
    it('should throw when not initialized', () => {
      expect(() => SQLiteCache.getInstance()).toThrow('SQLiteCache has not been initialized yet!');
    });
  });

  describe('init', () => {
    it('should create singleton instance', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      expect(instance).toBeDefined();
      expect(SQLiteCache.getInstance()).toBe(instance);
    });

    it('should return existing instance on second call', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance1 = await SQLiteCache.init(context);
      const instance2 = await SQLiteCache.init(context);
      expect(instance1).toBe(instance2);
    });

    it('should create directory and database', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      await SQLiteCache.init(context);
      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
      expect(mockCreateAllTables).toHaveBeenCalledWith(mockDatabase);
    });

    it('should load existing db file when available', async () => {
      const existingData = new Uint8Array([10, 20, 30]);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(existingData);

      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      expect(instance).toBeDefined();
    });

    it('should create new db when file does not exist', async () => {
      vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue(new Error('File not found'));

      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      expect(instance).toBeDefined();
    });

    it('should initialize comGraph and accuracy sub-modules', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      expect(instance.comGraph).toBeDefined();
      expect(instance.accuracy).toBeDefined();
      expect(instance.comGraph.layoutSet).toBeDefined();
      expect(instance.accuracy.toolSet).toBeDefined();
    });

    it('should create accuracy_tool_task_cmp and accuracy_tool_task_result_detail tables', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      await SQLiteCache.init(context);
      const createTableCalls = mockDbRun.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('CREATE TABLE IF NOT EXISTS'),
      );
      expect(createTableCalls.length).toBe(2);
      expect(createTableCalls[0][0]).toContain('accuracy_tool_task_cmp');
      expect(createTableCalls[1][0]).toContain('accuracy_tool_task_result_detail');
    });
  });

  describe('save', () => {
    it('should export db and write to file', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      await instance.save();

      expect(mockDbExport).toHaveBeenCalled();
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('should return early when db is undefined', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      instance.dispose();
      await instance.save();

      expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should close db', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      instance.dispose();
      expect(mockDbClose).toHaveBeenCalled();
    });

    it('should not throw when called twice', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      instance.dispose();
      expect(() => instance.dispose()).not.toThrow();
    });
  });

  describe('clearCache', () => {
    it('should delete db file and bigData dir, then reopen', async () => {
      mockExistsSync.mockReturnValue(true);
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      mockDbRun.mockClear();
      mockCreateAllTables.mockClear();

      await instance.clearCache();

      expect(mockDbClose).toHaveBeenCalled();
      expect(vscode.workspace.fs.delete).toHaveBeenCalled();
      expect(mockCreateAllTables).toHaveBeenCalled();
    });

    it('should skip db file deletion when file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      const deleteCallCount = vi.mocked(vscode.workspace.fs.delete).mock.calls.length;

      await instance.clearCache();

      const newDeleteCalls = vi.mocked(vscode.workspace.fs.delete).mock.calls.length;
      expect(newDeleteCalls - deleteCallCount).toBe(1);
    });
  });

  describe('deleteForCommand', () => {
    it('should delegate to clearCache', async () => {
      mockExistsSync.mockReturnValue(false);
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      await instance.deleteForCommand();
      expect(mockDbClose).toHaveBeenCalled();
    });
  });

  describe('createBigDataFile', () => {
    it('should create file in bigData dir and return path', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      const result = await instance.createBigDataFile('abc123', '{"data":true}');

      expect(result).toContain('bigData');
      expect(result).toContain('abc123');
      expect(result).toContain('.json');
      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('readJsonFile', () => {
    it('should read file content as utf8', async () => {
      mockFsReadFile.mockResolvedValue('{"key":"value"}');
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      const result = await instance.readJsonFile('/some/path.json');

      expect(result).toBe('{"key":"value"}');
      expect(mockFsReadFile).toHaveBeenCalledWith('/some/path.json', 'utf8');
    });
  });

  describe('comGraphDataDelete', () => {
    it('should call all four delete methods on comGraph', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      await instance.comGraphDataDelete('/path/to/file');

      expect(mockComGraphInstance.layoutDel).toHaveBeenCalledWith('/path/to/file');
      expect(mockComGraphInstance.finalResultDel).toHaveBeenCalledWith('/path/to/file');
      expect(mockComGraphInstance.funcDataDel).toHaveBeenCalledWith('/path/to/file');
      expect(mockComGraphInstance.fileHashMapDel).toHaveBeenCalledWith('/path/to/file');
    });
  });

  describe('comGraph delegation methods', () => {
    let instance: any;

    beforeEach(async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;
      instance = await SQLiteCache.init(context);
    });

    it('comGraphLayoutSet should delegate to comGraph.layoutSet', async () => {
      await instance.comGraphLayoutSet('fp', 'fh', 'lr', 'lct');
      expect(mockComGraphInstance.layoutSet).toHaveBeenCalledWith('fp', 'fh', 'lr', 'lct');
    });

    it('comGraphLayoutGet should delegate to comGraph.layoutGet', async () => {
      await instance.comGraphLayoutGet('fp', 'fh');
      expect(mockComGraphInstance.layoutGet).toHaveBeenCalledWith('fp', 'fh');
    });

    it('comGraphLayoutDel should delegate to comGraph.layoutDel', async () => {
      await instance.comGraphLayoutDel('fp');
      expect(mockComGraphInstance.layoutDel).toHaveBeenCalledWith('fp');
    });

    it('comGraphFinalResultSet should delegate to comGraph.finalResultSet', async () => {
      await instance.comGraphFinalResultSet('fp', 'fh', 'fr', 'lct');
      expect(mockComGraphInstance.finalResultSet).toHaveBeenCalledWith('fp', 'fh', 'fr', 'lct');
    });

    it('comGraphFinalResultGet should delegate to comGraph.finalResultGet', async () => {
      await instance.comGraphFinalResultGet('fp', 'fh');
      expect(mockComGraphInstance.finalResultGet).toHaveBeenCalledWith('fp', 'fh');
    });

    it('comGraphFinalResultDel should delegate to comGraph.finalResultDel', async () => {
      await instance.comGraphFinalResultDel('fp');
      expect(mockComGraphInstance.finalResultDel).toHaveBeenCalledWith('fp');
    });

    it('comGraphFuncDataSet should delegate to comGraph.funcDataSet', async () => {
      await instance.comGraphFuncDataSet('fp', 'fh', 'fd', 'lct');
      expect(mockComGraphInstance.funcDataSet).toHaveBeenCalledWith('fp', 'fh', 'fd', 'lct');
    });

    it('comGraphFuncDataGetCount should delegate to comGraph.funcDataGetCount', async () => {
      await instance.comGraphFuncDataGetCount('fp');
      expect(mockComGraphInstance.funcDataGetCount).toHaveBeenCalledWith('fp');
    });

    it('comGraphFuncDataGet should delegate to comGraph.funcDataGet', async () => {
      await instance.comGraphFuncDataGet('fp', 10, 0);
      expect(mockComGraphInstance.funcDataGet).toHaveBeenCalledWith('fp', 10, 0);
    });

    it('comGraphFuncDataDel should delegate to comGraph.funcDataDel', async () => {
      await instance.comGraphFuncDataDel('fp');
      expect(mockComGraphInstance.funcDataDel).toHaveBeenCalledWith('fp');
    });

    it('comGraphFileHashMapSet should delegate to comGraph.fileHashMapSet', async () => {
      await instance.comGraphFileHashMapSet('fp', 'fh', 'data');
      expect(mockComGraphInstance.fileHashMapSet).toHaveBeenCalledWith('fp', 'fh', 'data');
    });

    it('comGraphFileHashMapGet should delegate to comGraph.fileHashMapGet', async () => {
      await instance.comGraphFileHashMapGet('fp');
      expect(mockComGraphInstance.fileHashMapGet).toHaveBeenCalledWith('fp');
    });

    it('comGraphFileHashMapDel should delegate to comGraph.fileHashMapDel', async () => {
      await instance.comGraphFileHashMapDel('fp');
      expect(mockComGraphInstance.fileHashMapDel).toHaveBeenCalledWith('fp');
    });

    it('comGraphFileCalleeOpAttrSet should delegate to comGraph.fileCalleeOpAttrSet', async () => {
      await instance.comGraphFileCalleeOpAttrSet('fp', 'fh', 'data');
      expect(mockComGraphInstance.fileCalleeOpAttrSet).toHaveBeenCalledWith('fp', 'fh', 'data');
    });

    it('comGraphFileCalleeOpAttrGet should delegate to comGraph.fileCalleeOpAttrGet', async () => {
      await instance.comGraphFileCalleeOpAttrGet('fp');
      expect(mockComGraphInstance.fileCalleeOpAttrGet).toHaveBeenCalledWith('fp');
    });
  });

  describe('accuracy delegation methods', () => {
    let instance: any;

    beforeEach(async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;
      instance = await SQLiteCache.init(context);
    });

    it('accuracyToolSet should delegate to accuracy.toolSet', async () => {
      await instance.accuracyToolSet({ filePath: '/f' });
      expect(mockAccuracyInstance.toolSet).toHaveBeenCalledWith({ filePath: '/f' });
    });

    it('accuracyToolGet should delegate to accuracy.toolGet', async () => {
      await instance.accuracyToolGet('/f', 'p', 'fm', 'rm');
      expect(mockAccuracyInstance.toolGet).toHaveBeenCalledWith('/f', 'p', 'fm', 'rm');
    });

    it('accuracyToolGetAll should delegate to accuracy.toolGetAll', async () => {
      await instance.accuracyToolGetAll();
      expect(mockAccuracyInstance.toolGetAll).toHaveBeenCalled();
    });

    it('getAccuracyStatsByFile should delegate to accuracy.getStatsByFile', async () => {
      await instance.getAccuracyStatsByFile('/f');
      expect(mockAccuracyInstance.getStatsByFile).toHaveBeenCalledWith('/f');
    });

    it('getPhaseStatusListByFunc should delegate to accuracy.getPhaseStatusListByFunc', async () => {
      await instance.getPhaseStatusListByFunc('/f', 'fh');
      expect(mockAccuracyInstance.getPhaseStatusListByFunc).toHaveBeenCalledWith('/f', 'fh');
    });

    it('getDistinctPhaseResults should delegate to accuracy.getDistinctPhaseResults', async () => {
      await instance.getDistinctPhaseResults('/f');
      expect(mockAccuracyInstance.getDistinctPhaseResults).toHaveBeenCalledWith('/f');
    });

    it('getFirstResByPhaseOnTimestamp should delegate to accuracy.getFirstResByPhaseOnTimestamp', async () => {
      await instance.getFirstResByPhaseOnTimestamp('/f', 'p', 'r');
      expect(mockAccuracyInstance.getFirstResByPhaseOnTimestamp).toHaveBeenCalledWith('/f', 'p', 'r');
    });

    it('getFirstFailByPhase should delegate to accuracy.getFirstFailByPhase', async () => {
      await instance.getFirstFailByPhase('/f');
      expect(mockAccuracyInstance.getFirstFailByPhase).toHaveBeenCalledWith('/f');
    });

    it('getAccuracyStatsByFunc should delegate to accuracy.getStatsByFunc', async () => {
      await instance.getAccuracyStatsByFunc('/f', 'p', 'fh');
      expect(mockAccuracyInstance.getStatsByFunc).toHaveBeenCalledWith('/f', 'p', 'fh');
    });

    it('getErrorDetailsByFunc should delegate to accuracy.getErrorDetailsByFunc', async () => {
      await instance.getErrorDetailsByFunc('/f', 'p', 'fh', 10, 0);
      expect(mockAccuracyInstance.getErrorDetailsByFunc).toHaveBeenCalledWith('/f', 'p', 'fh', 10, 0);
    });

    it('getErrorDetailsOfGraphByFunc should delegate to accuracy.getErrorDetailsOfGraphByFunc', async () => {
      await instance.getErrorDetailsOfGraphByFunc('/f', 'p', 'fh');
      expect(mockAccuracyInstance.getErrorDetailsOfGraphByFunc).toHaveBeenCalledWith('/f', 'p', 'fh');
    });

    it('getErrorListByPage should delegate to accuracy.getErrorListByPage', async () => {
      await instance.getErrorListByPage('/f', 'p', 'fh', 'kw', 10, 0);
      expect(mockAccuracyInstance.getErrorListByPage).toHaveBeenCalledWith('/f', 'p', 'fh', 'kw', 10, 0);
    });

    it('accuracyToolCmpSet should delegate to accuracy.cmpSet', async () => {
      await instance.accuracyToolCmpSet({ filePath: '/f' });
      expect(mockAccuracyInstance.cmpSet).toHaveBeenCalledWith({ filePath: '/f' });
    });

    it('getCmpErrorListByFilePath should delegate to accuracy.getCmpErrorListByFilePath', async () => {
      await instance.getCmpErrorListByFilePath('/f', 10, 0);
      expect(mockAccuracyInstance.getCmpErrorListByFilePath).toHaveBeenCalledWith('/f', 10, 0);
    });

    it('accuracyToolCmpGetByFilePath should delegate to accuracy.cmpGetByFilePath', async () => {
      await instance.accuracyToolCmpGetByFilePath('/f');
      expect(mockAccuracyInstance.cmpGetByFilePath).toHaveBeenCalledWith('/f');
    });

    it('accuracyToolCmpGetCountByFilePath should delegate to accuracy.cmpGetCountByFilePath', async () => {
      await instance.accuracyToolCmpGetCountByFilePath('/f');
      expect(mockAccuracyInstance.cmpGetCountByFilePath).toHaveBeenCalledWith('/f');
    });

    it('accuracyToolCmpDetailSet should delegate to accuracy.cmpDetailSet', async () => {
      await instance.accuracyToolCmpDetailSet({ filePath: '/f' });
      expect(mockAccuracyInstance.cmpDetailSet).toHaveBeenCalledWith({ filePath: '/f' });
    });

    it('accuracyToolCmpDetailGetByFilePath should delegate to accuracy.cmpDetailGetByFilePath', async () => {
      await instance.accuracyToolCmpDetailGetByFilePath('/f');
      expect(mockAccuracyInstance.cmpDetailGetByFilePath).toHaveBeenCalledWith('/f');
    });

    it('accuracyToolCompListSet should delegate to accuracy.compListSet', async () => {
      await instance.accuracyToolCompListSet('/cp', []);
      expect(mockAccuracyInstance.compListSet).toHaveBeenCalledWith('/cp', []);
    });

    it('accuracyToolCompListGetByComputePath should delegate to accuracy.compListGetByComputePath', async () => {
      await instance.accuracyToolCompListGetByComputePath('/cp');
      expect(mockAccuracyInstance.compListGetByComputePath).toHaveBeenCalledWith('/cp');
    });

    it('accuracyToolCompListGetByFilePath should delegate to accuracy.compListGetByFilePath', async () => {
      await instance.accuracyToolCompListGetByFilePath('/f');
      expect(mockAccuracyInstance.compListGetByFilePath).toHaveBeenCalledWith('/f');
    });

    it('accuracyToolCompListUpdateFirstReq should delegate to accuracy.compListUpdateFirstReq', async () => {
      await instance.accuracyToolCompListUpdateFirstReq('/f', '2024-01-01');
      expect(mockAccuracyInstance.compListUpdateFirstReq).toHaveBeenCalledWith('/f', '2024-01-01');
    });

    it('accuFilePathSet should delegate to accuracy.filePathSet', async () => {
      await instance.accuFilePathSet({ filePath: '/f' });
      expect(mockAccuracyInstance.filePathSet).toHaveBeenCalledWith({ filePath: '/f' });
    });

    it('accuFilePathGet should delegate to accuracy.filePathGet', async () => {
      await instance.accuFilePathGet();
      expect(mockAccuracyInstance.filePathGet).toHaveBeenCalled();
    });
  });

  describe('accuracyToolTaskCmpSet', () => {
    it('should call db.run with INSERT SQL and extracted params', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      const data = {
        sourceFileName: 'test.csv',
        no: '1',
        phaseName: 'Phase1',
        ioFlag: 'I',
        loopInfo: 'loop1',
        result: 'PASS',
      };

      await instance.accuracyToolTaskCmpSet(data);

      expect(mockDbRun).toHaveBeenCalled();
      const lastCall = mockDbRun.mock.calls[mockDbRun.mock.calls.length - 1];
      expect(lastCall[0]).toContain('INSERT OR REPLACE INTO accuracy_tool_task_cmp');
      expect(mockExtractParams).toHaveBeenCalled();
    });
  });

  describe('accuracyToolTaskCmpGetByFileName', () => {
    let instance: any;
    const mockRow = {
      no: '1', phaseName: 'Phase1', ioFlag: 'I', loopInfo: 'loop1',
      rootCallOpmagic: 'op1', rootCallRawmagic: 'raw1', fileName: 'file.csv',
      aPhaseName: 'Phase1', aDatatype: 'float32', aFormat: 'ND',
      aMagic: 'magic1', aOpcode: 'op1', aRawMagic: 'raw1', aOpMagic: 'opm1',
      aSymbol: 'sym1', aValidshape: '[1,2]', aDynvalidshape: '[1,2]',
      aOpAttrAtomic: '{}', aOpAttrSymOfst: '0',
      aFuncHash: 'fh1', aPathHash: 'ph1', aRootFuncHash: 'rfh1',
      bDataType: 'float32', bRawShape: '[1,2]', bValidShape: '[1,2]',
      bBlockIdx: '0', bOpAttrSymOfst: '0', bSeqNo: '1', bTaskId: 't1',
      bTensorAddr: '0x100', bTimestamp: '2024-01-01', bExecTimestamp: '2024-01-01',
      result: 'PASS', rtolAtol: '1e-5', cntFailWarnTol: '0/0/0',
      cntTotalZeroInfnanCnt: '100/0/0', mae: '0.01', maeTop8: '0.008',
      maeTop1permil: '0.001', mre: '0.02', mreTop8: '0.016', mreTop1permil: '0.002',
      aMax: '1.0', aMin: '0.0', aAvg: '0.5', aAavg: '0.5', aZero: '0', aInfnan: '0',
      bMax: '1.0', bMin: '0.0', bAvg: '0.5', bAavg: '0.5', bZero: '0', bInfnan: '0',
    };

    beforeEach(async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;
      instance = await SQLiteCache.init(context);
    });

    it('should return results with basic query', async () => {
      mockStmtStep.mockReturnValueOnce(true).mockReturnValue(false);
      mockStmtGetAsObject.mockReturnValue(mockRow);

      const result = await instance.accuracyToolTaskCmpGetByFileName('test.csv', 10, 0);
      expect(result).toHaveLength(1);
      expect(result[0].no).toBe('1');
      expect(result[0].result).toBe('PASS');
      expect(mockStmtFree).toHaveBeenCalled();
    });

    it('should return empty array when no rows', async () => {
      mockStmtStep.mockReturnValue(false);

      const result = await instance.accuracyToolTaskCmpGetByFileName('test.csv', 10, 0);
      expect(result).toHaveLength(0);
    });

    it('should add res filter condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName('test.csv', 10, 0, 'FAIL');

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"AB>RESULT" = ?');
    });

    it('should add keyword filter condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName('test.csv', 10, 0, undefined, 'keyword1');

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"LOOP_INFO" LIKE ?');
      expect(sql).toContain('"B>:datatype" LIKE ?');
    });

    it('should add funcHash filter condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName('test.csv', 10, 0, undefined, undefined, 'hash123');

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"FUNC:hash" = ?');
    });

    it('should add rootFuncHash filter condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName(
        'test.csv', 10, 0, undefined, undefined, undefined, undefined, 'rootHash1',
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"ROOT_FUNC:hash" = ?');
    });

    it('should add pathFunchash filter condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName(
        'test.csv', 10, 0, undefined, undefined, undefined, undefined, undefined, undefined, 'pathHash1',
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"PATH_FUNC:hash" LIKE ?');
    });

    it('should add filterWord.rawMagic condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName(
        'test.csv', 10, 0, undefined, undefined, undefined, { rawMagic: 'rm1' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"ROOT_CALL:rawmagic" LIKE ?');
    });

    it('should add filterWord.opMagic condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName(
        'test.csv', 10, 0, undefined, undefined, undefined, { opMagic: 'om1' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"ROOT_CALL:opmagic" LIKE ?');
    });

    it('should add filterWord.tensorAddr condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName(
        'test.csv', 10, 0, undefined, undefined, undefined, { tensorAddr: '0x100' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"B>tensorAddr" LIKE ?');
    });

    it('should add filterWord.symbol condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName(
        'test.csv', 10, 0, undefined, undefined, undefined, { symbol: 'sym1' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"A>:symbol" LIKE ?');
    });

    it('should add filterWord.funchash condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName(
        'test.csv', 10, 0, undefined, undefined, undefined, { funchash: 'fh1' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"FUNC:hash" LIKE ?');
    });

    it('should add oriLoopInfo filter condition', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName(
        'test.csv', 10, 0, undefined, undefined, undefined, undefined, undefined, 'loop_info_val',
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"LOOP_INFO" = ?');
    });

    it('should add all filterWord conditions together', async () => {
      mockStmtStep.mockReturnValue(false);

      await instance.accuracyToolTaskCmpGetByFileName(
        'test.csv', 10, 0, undefined, undefined, undefined,
        { rawMagic: 'rm', opMagic: 'om', tensorAddr: 'ta', symbol: 'sym', funchash: 'fh' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"ROOT_CALL:rawmagic" LIKE ?');
      expect(sql).toContain('"ROOT_CALL:opmagic" LIKE ?');
      expect(sql).toContain('"B>tensorAddr" LIKE ?');
      expect(sql).toContain('"A>:symbol" LIKE ?');
      expect(sql).toContain('"FUNC:hash" LIKE ?');
    });

    it('should return multiple rows', async () => {
      mockStmtStep.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false);
      mockStmtGetAsObject.mockReturnValueOnce(mockRow).mockReturnValueOnce({ ...mockRow, no: '2' });

      const result = await instance.accuracyToolTaskCmpGetByFileName('test.csv', 10, 0);
      expect(result).toHaveLength(2);
      expect(result[0].no).toBe('1');
      expect(result[1].no).toBe('2');
    });

    it('should free statement even on error', async () => {
      mockStmtStep.mockImplementation(() => { throw new Error('step error'); });

      await expect(instance.accuracyToolTaskCmpGetByFileName('test.csv', 10, 0)).rejects.toThrow('step error');
      expect(mockStmtFree).toHaveBeenCalled();
    });
  });

  describe('accuracyToolTaskCmpGetCountByFileName', () => {
    let instance: any;

    beforeEach(async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;
      instance = await SQLiteCache.init(context);
    });

    it('should return count with basic query', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 42 });

      const result = await instance.accuracyToolTaskCmpGetCountByFileName('test.csv');
      expect(result).toBe(42);
      expect(mockStmtFree).toHaveBeenCalled();
    });

    it('should return 0 when no rows', async () => {
      mockStmtStep.mockReturnValue(false);

      const result = await instance.accuracyToolTaskCmpGetCountByFileName('test.csv');
      expect(result).toBe(0);
    });

    it('should add res filter', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName('test.csv', 'FAIL');

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"AB>RESULT" = ?');
    });

    it('should add keyword filter', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName('test.csv', undefined, 'kw');

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"LOOP_INFO" LIKE ?');
    });

    it('should add phaseName and funcHash together', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName('test.csv', undefined, undefined, 'phase1', 'fh1');

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"A>PHASE_NAME" = ?');
      expect(sql).toContain('"FUNC:hash" = ?');
    });

    it('should add phaseName only', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName('test.csv', undefined, undefined, 'phase1');

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"A>PHASE_NAME" = ?');
      expect(sql).not.toContain('"FUNC:hash" = ?');
    });

    it('should add funcHash only when no phaseName', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName('test.csv', undefined, undefined, undefined, 'fh1');

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"FUNC:hash" = ?');
      expect(sql).not.toContain('"A>PHASE_NAME" = ?');
    });

    it('should add rootFuncHash filter', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName(
        'test.csv', undefined, undefined, undefined, undefined, undefined, 'rfh1',
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"ROOT_FUNC:hash" = ?');
    });

    it('should add pathFunchash filter', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName(
        'test.csv', undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'pfh1',
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"PATH_FUNC:hash" LIKE ?');
    });

    it('should add all filterWord conditions', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName(
        'test.csv', undefined, undefined, undefined, undefined,
        { rawMagic: 'rm', opMagic: 'om', tensorAddr: 'ta', symbol: 'sym', funchash: 'fh' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"ROOT_CALL:rawmagic" LIKE ?');
      expect(sql).toContain('"ROOT_CALL:opmagic" LIKE ?');
      expect(sql).toContain('"B>tensorAddr" LIKE ?');
      expect(sql).toContain('"A>:symbol" LIKE ?');
      expect(sql).toContain('"FUNC:hash" LIKE ?');
    });

    it('should add filterWord.rawMagic condition', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName(
        'test.csv', undefined, undefined, undefined, undefined, { rawMagic: 'rm' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"ROOT_CALL:rawmagic" LIKE ?');
    });

    it('should add filterWord.opMagic condition', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName(
        'test.csv', undefined, undefined, undefined, undefined, { opMagic: 'om' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"ROOT_CALL:opmagic" LIKE ?');
    });

    it('should add filterWord.tensorAddr condition', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName(
        'test.csv', undefined, undefined, undefined, undefined, { tensorAddr: 'ta' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"B>tensorAddr" LIKE ?');
    });

    it('should add filterWord.symbol condition', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName(
        'test.csv', undefined, undefined, undefined, undefined, { symbol: 'sym' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"A>:symbol" LIKE ?');
    });

    it('should add filterWord.funchash condition', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName(
        'test.csv', undefined, undefined, undefined, undefined, { funchash: 'fh' },
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"FUNC:hash" LIKE ?');
    });

    it('should add oriLoopInfo filter', async () => {
      mockStmtStep.mockReturnValueOnce(true);
      mockStmtGetAsObject.mockReturnValue({ total: 5 });

      await instance.accuracyToolTaskCmpGetCountByFileName(
        'test.csv', undefined, undefined, undefined, undefined, undefined, undefined, 'loop1',
      );

      const sql = mockDbPrepare.mock.calls[mockDbPrepare.mock.calls.length - 1][0];
      expect(sql).toContain('"LOOP_INFO" = ?');
    });
  });

  describe('accuracyToolTaskDetailSet', () => {
    it('should call db.run with INSERT SQL and params', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      const data = {
        sourceFileName: 'test.csv',
        group: 'g1',
        index: '0',
        offset: '100',
        offsetRaw: '200',
        aData: '1.0',
        bData: '1.1',
        ae: '0.1',
        re: '0.09',
        tol: 'PASS',
      };

      await instance.accuracyToolTaskDetailSet(data);

      const lastCall = mockDbRun.mock.calls[mockDbRun.mock.calls.length - 1];
      expect(lastCall[0]).toContain('INSERT OR REPLACE INTO accuracy_tool_task_result_detail');
      expect(lastCall[1]).toEqual([
        'test.csv', 'g1', '0', '100', '200', '1.0', '1.1', '0.1', '0.09', 'PASS',
      ]);
    });

    it('should default undefined fields to empty string', async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;

      const instance = await SQLiteCache.init(context);
      await instance.accuracyToolTaskDetailSet({} as any);

      const lastCall = mockDbRun.mock.calls[mockDbRun.mock.calls.length - 1];
      expect(lastCall[1]).toEqual(['', '', '', '', '', '', '', '', '', '']);
    });
  });

  describe('accuracyToolTaskDetailGet', () => {
    let instance: any;

    beforeEach(async () => {
      const context = {
        globalStorageUri: { fsPath: '/mock/storage' },
      } as vscode.ExtensionContext;
      instance = await SQLiteCache.init(context);
    });

    it('should return detail rows', async () => {
      const mockRow = {
        group: 'g1', index: '0', offset: '100', offsetRaw: '200',
        aData: '1.0', bData: '1.1', ae: '0.1', re: '0.09', tol: 'PASS',
      };
      mockStmtStep.mockReturnValueOnce(true).mockReturnValue(false);
      mockStmtGetAsObject.mockReturnValue(mockRow);

      const result = await instance.accuracyToolTaskDetailGet('test.csv');
      expect(result).toHaveLength(1);
      expect(result[0].group).toBe('g1');
      expect(result[0].tol).toBe('PASS');
      expect(mockStmtFree).toHaveBeenCalled();
    });

    it('should return empty array when no rows', async () => {
      mockStmtStep.mockReturnValue(false);

      const result = await instance.accuracyToolTaskDetailGet('test.csv');
      expect(result).toHaveLength(0);
    });

    it('should return multiple rows', async () => {
      mockStmtStep.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false);
      mockStmtGetAsObject
        .mockReturnValueOnce({ group: 'g1', index: '0', offset: '100', offsetRaw: '200', aData: '1.0', bData: '1.1', ae: '0.1', re: '0.09', tol: 'PASS' })
        .mockReturnValueOnce({ group: 'g2', index: '1', offset: '101', offsetRaw: '201', aData: '2.0', bData: '2.1', ae: '0.2', re: '0.19', tol: 'FAIL' });

      const result = await instance.accuracyToolTaskDetailGet('test.csv');
      expect(result).toHaveLength(2);
      expect(result[0].group).toBe('g1');
      expect(result[1].group).toBe('g2');
    });

    it('should free statement even on error', async () => {
      mockStmtStep.mockImplementation(() => { throw new Error('step error'); });

      await expect(instance.accuracyToolTaskDetailGet('test.csv')).rejects.toThrow('step error');
      expect(mockStmtFree).toHaveBeenCalled();
    });
  });
});
