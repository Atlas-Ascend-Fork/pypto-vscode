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

const mockAccuracyToolCompListGetByFilePath = vi.fn();
const mockAccuracyToolCompListUpdateFirstReq = vi.fn();
const mockAccuracyToolCmpGetCountByFilePath = vi.fn().mockResolvedValue(0);
const mockGetCmpErrorListByFilePath = vi.fn().mockResolvedValue({ total: 0, list: [] });
const mockAccuFilePathGet = vi.fn().mockResolvedValue({ fileType: 'op_A' });
const mockAccuracyToolTaskCmpGetCountByFileName = vi.fn().mockResolvedValue(0);
const mockAccuracyToolTaskCmpGetByFileName = vi.fn().mockResolvedValue([]);
const mockGetPhaseStatusListByFunc = vi.fn().mockResolvedValue([]);
const mockGetAccuracyStatsByFile = vi.fn().mockResolvedValue({ PASS: 10, FAIL: 2, EXCEPTION: 1, SKIP: 0 });
const mockGetDistinctPhaseResults = vi.fn().mockResolvedValue([]);
const mockGetFirstResByPhaseOnTimestamp = vi.fn().mockResolvedValue([]);
const mockGetErrorDetailsOfGraphByFunc = vi.fn().mockResolvedValue([]);
const mockGetAccuracyStatsByFunc = vi.fn().mockResolvedValue({ FAIL: 5 });
const mockGetErrorListByPage = vi.fn().mockResolvedValue([]);
const mockGetErrorDetailsByFunc = vi.fn().mockResolvedValue([]);
const mockAccuracyToolCmpGetByFilePath = vi.fn().mockResolvedValue([]);
const mockAccuFilePathSet = vi.fn().mockResolvedValue(undefined);
const mockAccuracyToolTaskCmpGetCountByFilePath = vi.fn().mockResolvedValue(0);

const mockSQLiteCacheInstance = {
  accuracyToolCompListGetByFilePath: mockAccuracyToolCompListGetByFilePath,
  accuracyToolCompListUpdateFirstReq: mockAccuracyToolCompListUpdateFirstReq,
  accuracyToolCmpGetCountByFilePath: mockAccuracyToolCmpGetCountByFilePath,
  getCmpErrorListByFilePath: mockGetCmpErrorListByFilePath,
  accuFilePathGet: mockAccuFilePathGet,
  accuracyToolTaskCmpGetCountByFileName: mockAccuracyToolTaskCmpGetCountByFileName,
  accuracyToolTaskCmpGetByFileName: mockAccuracyToolTaskCmpGetByFileName,
  getPhaseStatusListByFunc: mockGetPhaseStatusListByFunc,
  getAccuracyStatsByFile: mockGetAccuracyStatsByFile,
  getDistinctPhaseResults: mockGetDistinctPhaseResults,
  getFirstResByPhaseOnTimestamp: mockGetFirstResByPhaseOnTimestamp,
  getErrorDetailsOfGraphByFunc: mockGetErrorDetailsOfGraphByFunc,
  getAccuracyStatsByFunc: mockGetAccuracyStatsByFunc,
  getErrorListByPage: mockGetErrorListByPage,
  getErrorDetailsByFunc: mockGetErrorDetailsByFunc,
  accuracyToolCmpGetByFilePath: mockAccuracyToolCmpGetByFilePath,
  accuracyToolTaskCmpGetCountByFileName: mockAccuracyToolTaskCmpGetCountByFileName,
  accuFilePathSet: mockAccuFilePathSet,
  accuracyToolTaskCmpGetCountByFilePath: mockAccuracyToolTaskCmpGetCountByFilePath,
};

vi.mock(import('../../../src/core/sqliteCache'), () => ({
  SQLiteCache: {
    getInstance: vi.fn(() => mockSQLiteCacheInstance),
  },
}));

vi.mock(import('../../../src/common/csvReader'), () => ({
  readCsv: vi.fn().mockResolvedValue(true),
  getCsvData: vi.fn(),
  SmartLogExtractor: vi.fn().mockImplementation(() => ({
    extract: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
      readdirSync: vi.fn(),
      statSync: vi.fn(),
      readFileSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

import * as fs from 'fs';
import {
  findComputationDir,
  getSortedVerifyFiles,
  getResDataSum,
  getComGraphOpMagic,
  updateCompListFirstReq,
  getPassInfoOfSinglePath,
  getComGraphRawMagic,
  getComGraphDataSum,
  searchKeyword,
  getCmpDiffList,
  getPrecisionExceptList,
  openCmpDiffComGraph,
  setCurAccuFilePath,
  getAccuFilePath,
  getFailMagicList,
  getCmpErrorList,
  getTaskCmpList,
  openTaskCmpDiffComGraph,
  getComGraphDataDetail,
} from '../../../src/common/accurancyAnylasis';
import { workspace, window, commands, Uri } from 'vscode';

describe('findComputationDir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns PVC2 directory path when computation_graph and PVC2 exist', () => {
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'computation_graph', isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'PVC2_OOO_123', isDirectory: () => true }] as any);
    const result = findComputationDir('/test/output');
    expect(result).toContain('PVC2_OOO_123');
  });

  it('returns empty string when no computation directory', () => {
    vi.mocked(fs.readdirSync).mockReturnValueOnce([{ name: 'other', isDirectory: () => true }] as any);
    const result = findComputationDir('/test/output');
    expect(result).toBe('');
  });

  it('returns empty string when no PVC2 directory', () => {
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'computation_graph', isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'other_dir', isDirectory: () => true }] as any);
    const result = findComputationDir('/test/output');
    expect(result).toBe('');
  });
});

describe('getSortedVerifyFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sorted files for opcheck mode', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'verify_graph_result_cmp~Pass_01~1000000000000001.csv', isFile: () => true },
      { name: 'verify_graph_result_cmp~Pass_02~1000000000000002.csv', isFile: () => true },
      { name: 'other_file.txt', isFile: () => true },
    ] as any);
    const result = getSortedVerifyFiles('/test/dir', 'opcheck');
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('1000000000000002');
  });

  it('returns sorted files for taskcheck mode', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'verify_task_result_cmp~Pass_01~1000000000000001.csv', isFile: () => true },
    ] as any);
    const result = getSortedVerifyFiles('/test/dir', 'taskcheck');
    expect(result).toHaveLength(1);
  });

  it('throws when directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(() => getSortedVerifyFiles('/nonexistent', 'opcheck')).toThrow();
  });

  it('throws when path is not a directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
    expect(() => getSortedVerifyFiles('/test/file.txt', 'opcheck')).toThrow();
  });
});

describe('getResDataSum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when filePath is undefined', async () => {
    const result = await getResDataSum(undefined);
    expect(result).toBeUndefined();
  });

  it('returns undefined when csv does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = await getResDataSum('/test/output.json', '/verify/path');
    expect(result).toBeUndefined();
  });

  it('returns parseResult Fail when readCsv fails', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const { readCsv } = await import('../../../src/common/csvReader');
    vi.mocked(readCsv).mockResolvedValueOnce(false);
    const result = await getResDataSum('/test/output.json', '/verify/path');
    expect(result).toHaveProperty('parseResult', 'Fail');
  });

  it('returns parseResult Success when readCsv succeeds', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'Pass_01_dir', isDirectory: () => true },
      { name: 'Pass_02_dir', isDirectory: () => true },
    ] as any);
    const { readCsv } = await import('../../../src/common/csvReader');
    vi.mocked(readCsv).mockResolvedValueOnce(true);
    mockGetAccuracyStatsByFile.mockResolvedValueOnce({ PASS: 10, FAIL: 2, EXCEPTION: 1, SKIP: 0 });
    mockGetDistinctPhaseResults.mockResolvedValueOnce([
      { phaseName: 'Pass_01', result: 'PASS' },
      { phaseName: 'Pass_02', result: 'FAIL' },
    ]);
    mockGetFirstResByPhaseOnTimestamp.mockResolvedValue([]);
    mockAccuracyToolCompListGetByFilePath.mockResolvedValue(undefined);
    const result = await getResDataSum('/test/output.json', '/verify/path');
    expect(result).toHaveProperty('parseResult', 'Success');
    expect(result).toHaveProperty('allResultSum');
  });
});

describe('getComGraphOpMagic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty result for empty directoryPath', async () => {
    const result = await getComGraphOpMagic('');
    expect(result).toEqual({ wrongOpMagicList: [], failRes: 0, updateFlag: false });
  });

  it('collects aOp/bOp magics from the error list', async () => {
    mockAccuracyToolCmpGetCountByFilePath.mockResolvedValueOnce(3);
    mockGetCmpErrorListByFilePath.mockResolvedValueOnce({
      total: 2,
      list: [
        { aOpMagic: '111', bOpMagic: '222' },
        { aOpMagic: '333' },
      ],
    });
    mockAccuracyToolCompListGetByFilePath.mockResolvedValueOnce(undefined);

    const result = await getComGraphOpMagic('/test/file.csv');

    expect(result.wrongOpMagicList).toEqual([111, 222, 333]);
    expect(result.failRes).toBe(3);
    expect(result.updateFlag).toBe(false);
  });
});

describe('updateCompListFirstReq', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates and returns true when record exists', async () => {
    mockAccuracyToolCompListGetByFilePath.mockResolvedValueOnce({ filePath: '/test.csv' });
    const result = await updateCompListFirstReq('/test.csv', '5');
    expect(result).toBe(true);
    expect(mockAccuracyToolCompListUpdateFirstReq).toHaveBeenCalledWith('/test.csv', '5');
  });

  it('returns false when record does not exist', async () => {
    mockAccuracyToolCompListGetByFilePath.mockResolvedValueOnce(undefined);
    const result = await updateCompListFirstReq('/test.csv', '5');
    expect(result).toBe(false);
    expect(mockAccuracyToolCompListUpdateFirstReq).not.toHaveBeenCalled();
  });
});

describe('setCurAccuFilePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when fileType is missing', async () => {
    await setCurAccuFilePath({});
    expect(mockAccuFilePathSet).not.toHaveBeenCalled();
  });

  it('returns early when fileType starts with op but filePath is missing', async () => {
    await setCurAccuFilePath({ fileType: 'op_A' });
    expect(mockAccuFilePathSet).not.toHaveBeenCalled();
  });

  it('calls accuFilePathSet when fileType starts with op and filePath is provided', async () => {
    await setCurAccuFilePath({ fileType: 'op_A', filePath: '/test.csv' });
    expect(mockAccuFilePathSet).toHaveBeenCalledWith({ fileType: 'op_A', filePath: '/test.csv' });
  });

  it('calls accuFilePathSet when fileType does not start with op', async () => {
    await setCurAccuFilePath({ fileType: 'brief' });
    expect(mockAccuFilePathSet).toHaveBeenCalledWith({ fileType: 'brief' });
  });
});

describe('getAccuFilePath', () => {
  it('returns result from SQLiteCache', async () => {
    mockAccuFilePathGet.mockResolvedValueOnce({ fileType: 'op_A', filePath: '/test.csv' });
    const result = await getAccuFilePath();
    expect(result).toEqual({ fileType: 'op_A', filePath: '/test.csv' });
  });
});

describe('getPassInfoOfSinglePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when csv does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = await getPassInfoOfSinglePath('/test/dir', 'funcMagic');
    expect(result).toBeUndefined();
  });

  it('returns pass list when csv exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockGetPhaseStatusListByFunc.mockResolvedValueOnce([
      { phaseName: 'Pass_01', status: ['PASS'] },
      { phaseName: 'Pass_02', status: ['FAIL'] },
    ]);
    const result = await getPassInfoOfSinglePath('/test/dir', 'funcMagic');
    expect(result).toEqual([
      { passName: 'Pass_01', status: ['PASS'] },
      { passName: 'Pass_02', status: ['FAIL'] },
    ]);
  });
});

describe('getComGraphRawMagic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when csv does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = await getComGraphRawMagic('/test/graph.json', 'Pass_01', 'funcMagic', 'FAIL');
    expect(result).toBeUndefined();
  });

  it('returns set of rawMagic values', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockGetErrorDetailsOfGraphByFunc.mockResolvedValueOnce([
      { rawMagic: 'magic1' },
      { rawMagic: 'magic2' },
      { rawMagic: 'magic1' },
    ]);
    const result = await getComGraphRawMagic('/test/graph.json', 'Pass_01', 'funcMagic', 'FAIL');
    expect(result).toBeInstanceOf(Set);
    expect(result!.size).toBe(2);
    expect(result!.has('magic1')).toBe(true);
    expect(result!.has('magic2')).toBe(true);
  });
});

describe('getComGraphDataSum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when csv does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = await getComGraphDataSum('/test/graph.json', 'Pass_01', 'funcMagic');
    expect(result).toBeUndefined();
  });

  it('returns accuracy data when csv exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockGetAccuracyStatsByFunc.mockResolvedValueOnce({ FAIL: 5 });
    mockGetErrorDetailsOfGraphByFunc.mockResolvedValueOnce([{ rawMagic: 'magic1' }]);
    const result = await getComGraphDataSum('/test/graph.json', 'Pass_01', 'funcMagic');
    expect(result).toHaveProperty('comgraphFailSum');
    expect(result).toHaveProperty('comgraphFailList');
  });
});

describe('searchKeyword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when csv does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = await searchKeyword('/test/graph.json', 'Pass_01', 'funcMagic', 'keyword');
    expect(result).toBeUndefined();
  });

  it('returns search results when csv exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockGetErrorListByPage.mockResolvedValueOnce([{ rawMagic: 'magic1' }]);
    const result = await searchKeyword('/test/graph.json', 'Pass_01', 'funcMagic', 'keyword');
    expect(result).toHaveProperty('comgraphFailList');
    expect(result!.comgraphFailList).toEqual([{ rawMagic: 'magic1' }]);
  });
});

describe('getCmpDiffList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty result for empty filePath', async () => {
    const result = await getCmpDiffList('');
    expect(result).toEqual({ diffList: [], total: 0, failRes: 0, updateFlag: false });
  });

  it('returns diff list with readFlag false', async () => {
    mockAccuracyToolCmpGetByFilePath.mockResolvedValueOnce([
      { aOpMagic: '123', bOpMagic: '456', abResult: 'FAIL' },
    ]);
    mockAccuracyToolCmpGetCountByFilePath.mockResolvedValueOnce(1);
    mockAccuracyToolCompListGetByFilePath.mockResolvedValueOnce(undefined);
    const result = await getCmpDiffList('/test/file.csv', false);
    expect(result.diffList).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('handles empty aOp and bOp', async () => {
    mockAccuracyToolCmpGetByFilePath.mockResolvedValueOnce([
      { abResult: 'FAIL', shared: 'value' },
    ]);
    mockAccuracyToolCmpGetCountByFilePath.mockResolvedValueOnce(1);
    mockAccuracyToolCompListGetByFilePath.mockResolvedValueOnce(undefined);
    const result = await getCmpDiffList('/test/file.csv', false);
    expect(result.diffList[0].aOp).toBeUndefined();
    expect(result.diffList[0].bOp).toBeUndefined();
    expect(result.diffList[0].compareRes).toBe('FAIL');
  });

  it('re-reads csv and counts failures when readFlag is true', async () => {
    const { readCsv } = await import('../../../src/common/csvReader');
    mockAccuracyToolCmpGetCountByFilePath
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    mockAccuracyToolCmpGetByFilePath.mockResolvedValueOnce([]);
    mockAccuracyToolCompListGetByFilePath.mockResolvedValueOnce(undefined);

    const result = await getCmpDiffList('/test/file.csv', true);

    expect(readCsv).toHaveBeenCalledWith('/test/file.csv', 2);
    expect(result.failRes).toBe(2);
    expect(result.total).toBe(1);
  });
});

describe('getPrecisionExceptList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when directory read fails', async () => {
    vi.mocked(fs.readdirSync).mockImplementation(() => { throw new Error('ENOENT'); });
    const result = await getPrecisionExceptList('/test/file.csv', 'detail.csv');
    expect(result).toBeNull();
  });

  it('returns null when file not found', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'other.csv', isFile: () => true },
    ] as any);
    const result = await getPrecisionExceptList('/test/file.csv', 'detail.csv');
    expect(result).toBeNull();
  });

  it('returns parsed CSV data when file found', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'detail.csv', isFile: () => true },
    ] as any);
    vi.mocked(fs.readFileSync).mockReturnValue('GROUP,INDEX,OFFSET,OFFSET_RAW,A_data,B_data,AB_ae,AB_re,AB_tol\n1,0,100,200,1.0,2.0,0.1,0.2,0.3\n');
    const result = await getPrecisionExceptList('/test/file.csv', 'detail.csv');
    expect(result).toHaveLength(1);
    expect(result![0].GROUP).toBe('1');
    expect(result![0].INDEX).toBe('0');
  });
});

describe('openCmpDiffComGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows warning when pass directory not found', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'other_dir', isDirectory: () => true },
    ] as any);
    await openCmpDiffComGraph('/test/graph.json', 'hash123', 'Pass_01', 'funcMagic', undefined, undefined, undefined, '/compute/dir');
    expect(window.showWarningMessage).toHaveBeenCalled();
  });

  it('shows warning when json file not found', async () => {
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'Pass_01_dir', isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'other.json', isFile: () => true }] as any);
    await openCmpDiffComGraph('/test/graph.json', 'hash123', 'Pass_01', 'funcMagic', undefined, undefined, undefined, '/compute/dir');
    expect(window.showWarningMessage).toHaveBeenCalled();
  });

  it('executes command when json file found', async () => {
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'Pass_01_dir', isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'graph_funcMagic_hash123.json', isFile: () => true }] as any);
    await openCmpDiffComGraph('/test/graph.json', 'hash123', 'Pass_01', 'funcMagic', undefined, undefined, undefined, '/compute/dir');
    expect(commands.executeCommand).toHaveBeenCalledWith(
      'PyPTO.Open.OpenComGraphByFunchash',
      expect.anything(),
      'hash123',
      undefined,
      undefined,
      undefined,
      undefined
    );
  });

  it('prefers After file when multiple json files found', async () => {
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'Pass_01_dir', isDirectory: () => true }] as any)
      .mockReturnValueOnce([
        { name: 'Before_funcMagic_hash123.json', isFile: () => true },
        { name: 'After_funcMagic_hash123.json', isFile: () => true },
      ] as any);
    await openCmpDiffComGraph('/test/graph.json', 'hash123', 'Pass_01', 'funcMagic', undefined, undefined, undefined, '/compute/dir');
    expect(commands.executeCommand).toHaveBeenCalled();
  });

  it('uses computeGraphDirPath when provided', async () => {
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'Pass_01_dir', isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'graph_funcMagic_hash123.json', isFile: () => true }] as any);
    await openCmpDiffComGraph('/test/graph.json', 'hash123', 'Pass_01', 'funcMagic', undefined, undefined, undefined, '/compute/dir');
    expect(commands.executeCommand).toHaveBeenCalled();
  });

  it('falls back to findComputationDir when computeGraphDirPath is missing', async () => {
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'computation_graph', isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'PVC2_OOO_123', isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'Pass_01_dir', isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'graph_funcMagic_hash123.json', isFile: () => true }] as any);

    await openCmpDiffComGraph('/test/output/graph.json', 'hash123', 'Pass_01', 'funcMagic');

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'PyPTO.Open.OpenComGraphByFunchash',
      expect.anything(),
      'hash123',
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });
});

describe('openTaskCmpDiffComGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows warning when computation dir not found', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue([] as any);
    await openTaskCmpDiffComGraph('/test/graph.json', 'hash123', 'Pass_01');
    expect(window.showWarningMessage).toHaveBeenCalled();
  });

  it('shows warning when pass dir not found', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'other_dir', isDirectory: () => true },
    ] as any);
    await openTaskCmpDiffComGraph('/test/graph.json', 'hash123', 'Pass_01', undefined, undefined, undefined, '/compute/dir');
    expect(window.showWarningMessage).toHaveBeenCalled();
  });

  it('shows warning when json not found', async () => {
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'Pass_01_dir', isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'other.json', isFile: () => true }] as any);
    await openTaskCmpDiffComGraph('/test/graph.json', 'hash123', 'Pass_01', undefined, undefined, undefined, '/compute/dir');
    expect(window.showWarningMessage).toHaveBeenCalled();
  });

  it('executes command when json found', async () => {
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'Pass_01_dir', isDirectory: () => true }] as any)
      .mockReturnValueOnce([{ name: 'graph_hash123.json', isFile: () => true }] as any);
    await openTaskCmpDiffComGraph('/test/graph.json', 'hash123', 'Pass_01', undefined, undefined, undefined, '/compute/dir');
    expect(commands.executeCommand).toHaveBeenCalled();
  });

  it('prefers After file when multiple json files found', async () => {
    vi.mocked(fs.readdirSync)
      .mockReturnValueOnce([{ name: 'Pass_01_dir', isDirectory: () => true }] as any)
      .mockReturnValueOnce([
        { name: 'Before_hash123.json', isFile: () => true },
        { name: 'After_hash123.json', isFile: () => true },
      ] as any);
    await openTaskCmpDiffComGraph('/test/graph.json', 'hash123', 'Pass_01', undefined, undefined, undefined, '/compute/dir');

    const call = vi.mocked(commands.executeCommand).mock.calls[0];
    expect(call[1].fsPath).toContain('After_hash123.json');
  });
});

describe('getCmpErrorList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error list with counts', async () => {
    mockAccuracyToolCmpGetCountByFilePath
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);
    mockGetCmpErrorListByFilePath.mockResolvedValueOnce({
      total: 5,
      list: [{ aOpMagic: '123', abResult: 'FAIL' }],
    });
    mockAccuFilePathGet.mockResolvedValueOnce({ fileType: 'op_A' });
    const result = await getCmpErrorList('/test/file.csv', '/test/graph.json', false);
    expect(result).toHaveProperty('diffList');
    expect(result).toHaveProperty('failRes', 5);
    expect(result).toHaveProperty('excepRes', 2);
    expect(result).toHaveProperty('totalRes', 10);
  });
});

describe('getTaskCmpList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty result for empty filePath', async () => {
    const result = await getTaskCmpList('');
    expect(result).toEqual({ diffList: [], total: 0, failRes: 0, excepRes: -1, totalRes: -1, listSum: 0, updateFlag: false });
  });

  it('returns task cmp list with readFlag false', async () => {
    mockAccuracyToolTaskCmpGetCountByFileName
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5);
    mockAccuracyToolTaskCmpGetByFileName.mockResolvedValueOnce([
      { result: 'FAIL', aMagic: '123', bMagic: '456' },
    ]);
    const result = await getTaskCmpList('/test/file.csv', false);
    expect(result.diffList).toHaveLength(1);
    expect(result.total).toBe(5);
    expect(result.failRes).toBe(5);
    expect(result.excepRes).toBe(2);
  });

  it('re-reads csv and updates first request when readFlag is true', async () => {
    const { readCsv } = await import('../../../src/common/csvReader');
    mockAccuracyToolTaskCmpGetCountByFileName
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5);
    mockAccuracyToolTaskCmpGetByFileName.mockResolvedValueOnce([]);
    mockAccuracyToolCompListGetByFilePath.mockResolvedValueOnce({ filePath: '/test/file.csv' });

    const result = await getTaskCmpList('/test/file.csv', true);

    expect(readCsv).toHaveBeenCalledWith('/test/file.csv', 4);
    expect(mockAccuracyToolCompListUpdateFirstReq).toHaveBeenCalledWith('/test/file.csv', '5');
    expect(result.updateFlag).toBe(true);
  });
});

describe('getComGraphDataDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined when log or csv does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = await getComGraphDataDetail('/test/graph.json', 'Pass_01', 'funcMagic', 'loopInfo', 'rawMagic');
    expect(result).toBeUndefined();
  });

  it('parses, dedups and sorts the extracted log details', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const { SmartLogExtractor } = await import('../../../src/common/csvReader');
    vi.mocked(SmartLogExtractor).mockImplementationOnce(function (this: any) {
      return {
        extract: vi.fn().mockResolvedValue([
          '[VERIFY:FAIL] Pass_01, funcMagic, loopInfo, rawMagic',
          'GROUP, OFFSET, [tensors, list]',
          'row1, 200, [1, 2]',
          'row2, 100, [3, 4]',
          'row3, 200, [9, 9]',
        ]),
      };
    } as any);
    mockGetErrorDetailsByFunc.mockResolvedValueOnce([{ summary: 'fail' }]);

    const result = await getComGraphDataDetail('/test/graph.json', 'Pass_01', 'funcMagic', 'loopInfo', 'rawMagic', undefined, undefined, '/verify/path');

    expect(result).toBeDefined();
    expect(result!.failDetailList).toHaveLength(2);
    expect(result!.failDetailList.map((row: any) => row.OFFSET)).toEqual(['100', '200']);
    expect(result!.failDetailList[0]).toMatchObject({ GROUP: 'row2', OFFSET: '100' });
    expect(result!.failSummary).toEqual({ summary: 'fail' });
  });

  it('returns empty detail list when extracted log is too short', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const { SmartLogExtractor } = await import('../../../src/common/csvReader');
    vi.mocked(SmartLogExtractor).mockImplementationOnce(function (this: any) {
      return { extract: vi.fn().mockResolvedValue(['only one line']) };
    } as any);
    mockGetErrorDetailsByFunc.mockResolvedValueOnce([]);

    const result = await getComGraphDataDetail('/test/graph.json', 'Pass_01', 'funcMagic', 'loopInfo', 'rawMagic', undefined, undefined, '/verify/path');

    expect(result!.failDetailList).toEqual([]);
  });
});

describe('getFailMagicList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns task fail magic list for task fileType', async () => {
    mockAccuracyToolTaskCmpGetCountByFileName.mockResolvedValueOnce(3);
    mockAccuracyToolTaskCmpGetByFileName.mockResolvedValueOnce([
      { aMagic: '123' },
      { aMagic: '456' },
    ]);
    const result = await getFailMagicList('/test/graph.json', 'hash123', undefined, 'task', '/output.csv');
    expect(result).toHaveProperty('accuType', 'task');
    expect(result).toHaveProperty('failMagicList');
    expect(result!.failMagicList).toHaveLength(2);
  });

  it('returns brief fail magic list for brief fileType', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockGetErrorDetailsOfGraphByFunc.mockResolvedValue([{ rawMagic: 'magic1' }]);
    const result = await getFailMagicList('/test/Pass_01/graph_TENSOR_funcMagic_LEAF_hash.json', 'hash123', undefined, undefined, undefined, undefined, '/compute/dir');
    expect(result).toHaveProperty('accuType', 'brief');
    expect(result).toHaveProperty('wrongRawMagicList');
  });

  it('returns op fail magic list derived from the cmp csv', async () => {
    mockGetCmpErrorListByFilePath.mockResolvedValueOnce({
      total: 1,
      list: [{ aOpMagic: '111', bOpMagic: '222' }],
    });
    mockAccuracyToolCompListGetByFilePath.mockResolvedValueOnce(undefined);

    const result = await getFailMagicList(
      '/test/graph_a_b_funcMagic_LEAF_hash.json',
      undefined,
      undefined,
      'op_A',
      '/output/xx~Pass_01~Pass_02~12345.csv',
    );

    expect(result).toMatchObject({ accuType: 'op', failMagicList: [111, 222] });
  });
});
