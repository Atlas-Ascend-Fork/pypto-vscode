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

const mockIsFileUriExists = vi.fn();
const mockIsFilePathExists = vi.fn();
const mockGetCmpFileList = vi.fn();
const mockAccuracyGet = vi.fn();
const mockAccuracySet = vi.fn();

vi.mock('../../../../../src/utils/file-system', () => ({
  isFileUriExists: (...args: unknown[]) => mockIsFileUriExists(...args),
  isFilePathExists: (...args: unknown[]) => mockIsFilePathExists(...args),
}));

vi.mock('../../../../../src/services/welcome', () => ({
  getMockDataPath: vi.fn().mockResolvedValue('/root/mocks/graph/pass1'),
  getProgramPath: vi.fn().mockResolvedValue('/root/mocks/program.json'),
  getSwimPath: vi.fn().mockResolvedValue('/root/mocks/swim.json'),
}));

vi.mock('../../../../../src/common/csvReader', () => ({
  getCmpFileList: (...args: unknown[]) => mockGetCmpFileList(...args),
}));

vi.mock('../../../../../src/core/sqliteCache', () => ({
  SQLiteCache: {
    getInstance: () => ({
      accuracyToolCompListGetByComputePath: mockAccuracyGet,
      accuracyToolCompListSet: mockAccuracySet,
    }),
  },
  AccuracyToolCompList: {},
}));

import { workspace, Uri, FileType } from 'vscode';
import {
  readRunDataList,
  readRunData,
  findVerifyDir,
  findVerifySubDir,
} from '../../../../../src/services/run-data/utils/scan-run-data';

const readDirectory = vi.mocked(workspace.fs.readDirectory);
const readFile = vi.mocked(workspace.fs.readFile);

let dirListing: Record<string, [string, number][]>;
let fileContent: Record<string, string>;

function setupFs(directories: Record<string, [string, number][]> = {}, files: Record<string, string> = {}) {
  dirListing = directories;
  fileContent = files;
  readDirectory.mockImplementation(async (uri: { fsPath: string }) => {
    const listing = dirListing[uri.fsPath];
    if (!listing) {
      throw new Error('ENOENT');
    }
    return listing as [string, import('vscode').FileType][];
  });
  readFile.mockImplementation(async (uri: { fsPath: string }) => {
    const content = fileContent[uri.fsPath];
    if (content === undefined) {
      throw new Error('ENOENT');
    }
    return Buffer.from(content);
  });
}

describe('run-data/utils/scan-run-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFileUriExists.mockResolvedValue(true);
    mockIsFilePathExists.mockResolvedValue(true);
    mockAccuracyGet.mockResolvedValue([]);
    mockAccuracySet.mockResolvedValue(undefined);
    setupFs();
  });

  describe('readRunDataList', () => {
    it('returns empty when parent directory does not exist', async () => {
      mockIsFileUriExists.mockResolvedValue(false);

      const result = await readRunDataList(Uri.file('/root/.pypto/run'));

      expect(result).toEqual([]);
      expect(readDirectory).not.toHaveBeenCalled();
    });

    it('filters out files and invalid directory names', async () => {
      setupFs({
        '/run': [
          ['rundata_20240102030405', FileType.Directory],
          ['afile.json', FileType.File],
          ['invalid_name', FileType.Directory],
          ['rundata_bad', FileType.Directory],
        ],
      });

      const result = await readRunDataList(Uri.file('/run'));

      expect(result).toEqual([{ dirname: 'rundata_20240102030405', executeTime: '2024-01-02 03:04:05' }]);
    });

    it('returns directories in reverse order (newest first)', async () => {
      setupFs({
        '/run': [
          ['rundata_20240101010101', FileType.Directory],
          ['rundata_20240202020202', FileType.Directory],
          ['rundata_20240303030303', FileType.Directory],
        ],
      });

      const result = await readRunDataList(Uri.file('/run'));

      expect(result.map((item) => item.dirname)).toEqual([
        'rundata_20240303030303',
        'rundata_20240202020202',
        'rundata_20240101010101',
      ]);
    });

    it('limits result to 5000 entries', async () => {
      const entries: [string, number][] = Array.from({ length: 5001 }, (_, i) => [
        `rundata_20240102${String(i).padStart(6, '0')}`,
        FileType.Directory,
      ]);
      setupFs({ '/run': entries });

      const result = await readRunDataList(Uri.file('/run'));

      expect(result).toHaveLength(5000);
    });
  });

  describe('readRunData', () => {
    const runUri = Uri.file('/root/rundata_20240102030405');

    it('returns undefined when directory cannot be read', async () => {
      const result = await readRunData(Uri.file('/root/missing'));

      expect(result).toBeUndefined();
    });

    it('returns undefined when rundata.json is missing', async () => {
      setupFs({ '/root/rundata_20240102030405': [['other.txt', FileType.File]] });

      const result = await readRunData(runUri);

      expect(result).toBeUndefined();
    });

    it('returns undefined when runtype is missing', async () => {
      setupFs(
        { '/root/rundata_20240102030405': [['rundata.json', FileType.File]] },
        { '/root/rundata_20240102030405/rundata.json': JSON.stringify({ pto_src_file: '/src/main.py' }) },
      );

      const result = await readRunData(runUri);

      expect(result).toBeUndefined();
    });

    it('returns undefined when directory name does not encode execute time', async () => {
      setupFs(
        { '/root/not_a_rundata': [['rundata.json', FileType.File]] },
        { '/root/not_a_rundata/rundata.json': JSON.stringify({ runtype: 'pass', pto_src_file: '/src/main.py' }) },
      );

      const result = await readRunData(Uri.file('/root/not_a_rundata'));

      expect(result).toBeUndefined();
    });

    it('returns undefined when no display item is configured', async () => {
      setupFs(
        { '/root/rundata_20240102030405': [['rundata.json', FileType.File]] },
        { '/root/rundata_20240102030405/rundata.json': JSON.stringify({ runtype: 'pass' }) },
      );

      const result = await readRunData(runUri);

      expect(result).toBeUndefined();
    });

    it('builds record from rundata.json with existing files', async () => {
      setupFs(
        { '/root/rundata_20240102030405': [['rundata.json', FileType.File]] },
        {
          '/root/rundata_20240102030405/rundata.json': JSON.stringify({
            runtype: 'pass',
            pto_src_file: '/src/main.py',
            program_file: '/src/program.json',
            flow_verify_path: '/root/verify1',
          }),
        },
      );

      const result = await readRunData(runUri);

      expect(result).toMatchObject({
        title: 'pass_20240102_030405',
        executeTime: '2024-01-02 03:04:05',
        directoryPath: '/root/rundata_20240102030405',
        sourceFilePath: '/src/main.py',
        controlFlowFilePath: '/src/program.json',
        flowVerifyPath: '/root/verify1',
      });
    });

    it('nulls out file paths that do not exist', async () => {
      mockIsFilePathExists.mockResolvedValue(false);
      setupFs(
        { '/root/rundata_20240102030405': [['rundata.json', FileType.File]] },
        {
          '/root/rundata_20240102030405/rundata.json': JSON.stringify({
            runtype: 'pass',
            pto_src_file: '/src/main.py',
            swim_graph_path: '/src/swim.json',
          }),
        },
      );

      const result = await readRunData(runUri);

      expect(result?.sourceFilePath).toBeNull();
      expect(result?.swimlaneGraphFilePath).toBeNull();
    });

    it('augments boot steps rundata with mock sample paths', async () => {
      setupFs(
        {
          '/root/rundata_20240102030405': [['rundata_boot_steps.json', FileType.File]],
          '/root/mocks': [['other', FileType.Directory]],
        },
        {
          '/root/rundata_20240102030405/rundata_boot_steps.json': JSON.stringify({
            runtype: 'boot',
            compute_graph_path: '/original/graph',
          }),
        },
      );

      const result = await readRunData(runUri);

      expect(result?.computeGraphDirPath).toBe('/root/mocks/graph/pass1');
      expect(result?.controlFlowFilePath).toBe('/root/mocks/program.json');
      expect(result?.swimlaneGraphFilePath).toBe('/root/mocks/swim.json');
    });
  });

  describe('ope/task check discovery', () => {
    it('reports no checks when neither verify path nor compute graph dir exists', async () => {
      setupFs(
        { '/root/rundata_20240102030405': [['rundata.json', FileType.File]] },
        {
          '/root/rundata_20240102030405/rundata.json': JSON.stringify({
            runtype: 'pass',
            pto_src_file: '/src/main.py',
          }),
        },
      );

      const result = await readRunData(Uri.file('/root/rundata_20240102030405'));

      expect(result?.hasOpeCheck).toBe(false);
      expect(result?.opeCheckDirPath).toBeNull();
      expect(result?.hasTaskCheck).toBe(false);
      expect(result?.taskCheckDirPath).toBeNull();
    });

    it('merges cached and new opcheck cmp files', async () => {
      setupFs(
        {
          '/root/rundata_20240102030405': [['rundata.json', FileType.File]],
          '/root/verify1': [['verify_graph_result_cmp_a.csv', FileType.File]],
        },
        {
          '/root/rundata_20240102030405/rundata.json': JSON.stringify({
            runtype: 'pass',
            flow_verify_path: '/root/verify1',
          }),
        },
      );
      mockAccuracyGet.mockResolvedValue([{ file_path: 'cached.csv' }]);
      mockGetCmpFileList.mockResolvedValue(['cached.csv', 'new1.csv']);

      const result = await readRunData(Uri.file('/root/rundata_20240102030405'));

      expect(mockAccuracyGet).toHaveBeenCalledWith('/root/verify1_opcheck');
      expect(mockGetCmpFileList).toHaveBeenCalledWith('/root/verify1', 'opcheck');
      expect(mockAccuracySet).toHaveBeenCalledWith('/root/verify1_opcheck', [
        { file_path: 'new1.csv', first_req: '-1', compute_path: '/root/verify1_opcheck' },
      ]);
      expect(result?.hasOpeCheck).toBe(true);
      expect(result?.opeCheckDirPath).toEqual([{ file_path: 'cached.csv' }, { file_path: 'new1.csv', first_req: '-1', compute_path: '/root/verify1_opcheck' }]);
    });

    it('keeps cached opcheck list when no cmp file present', async () => {
      setupFs(
        {
          '/root/rundata_20240102030405': [['rundata.json', FileType.File]],
          '/root/verify1': [['other.csv', FileType.File]],
        },
        {
          '/root/rundata_20240102030405/rundata.json': JSON.stringify({
            runtype: 'pass',
            flow_verify_path: '/root/verify1',
          }),
        },
      );
      mockAccuracyGet.mockResolvedValue([{ file_path: 'cached.csv' }]);

      const result = await readRunData(Uri.file('/root/rundata_20240102030405'));

      expect(result?.hasOpeCheck).toBe(true);
      expect(result?.opeCheckDirPath).toEqual([{ file_path: 'cached.csv' }]);
      expect(mockGetCmpFileList).not.toHaveBeenCalled();
    });

    it('falls back to cached list when verify dir cannot be read', async () => {
      setupFs(
        { '/root/rundata_20240102030405': [['rundata.json', FileType.File]] },
        {
          '/root/rundata_20240102030405/rundata.json': JSON.stringify({
            runtype: 'pass',
            flow_verify_path: '/root/gone',
          }),
        },
      );
      mockAccuracyGet.mockResolvedValue([{ file_path: 'cached.csv' }]);

      const result = await readRunData(Uri.file('/root/rundata_20240102030405'));

      expect(result?.hasOpeCheck).toBe(true);
      expect(result?.opeCheckDirPath).toEqual([{ file_path: 'cached.csv' }]);
    });

    it('resolves verify dir from compute graph path when flow verify missing', async () => {
      setupFs(
        {
          '/root/rundata_20240102030405': [['rundata.json', FileType.File]],
          '/root/run1': [['verify', FileType.Directory]],
          '/root/run1/verify': [['verify_task_result_cmp_t.csv', FileType.File]],
        },
        {
          '/root/rundata_20240102030405/rundata.json': JSON.stringify({
            runtype: 'pass',
            compute_graph_path: '/root/run1/graph/pass1',
          }),
        },
      );
      mockGetCmpFileList.mockResolvedValue(['task1.csv']);

      const result = await readRunData(Uri.file('/root/rundata_20240102030405'));

      expect(mockAccuracyGet).toHaveBeenCalledWith('/root/run1/verify_taskcheck');
      expect(mockGetCmpFileList).toHaveBeenCalledWith('/root/run1/verify', 'taskcheck');
      expect(mockAccuracySet).toHaveBeenCalledWith('/root/run1/verify_taskcheck', [
        { file_path: 'task1.csv', first_req: '-1', compute_path: '/root/run1/verify_taskcheck' },
      ]);
      expect(result?.hasTaskCheck).toBe(true);
      expect(result?.taskCheckDirPath).toHaveLength(1);
      expect(result?.hasOpeCheck).toBe(false);
    });
  });

  describe('findVerifyDir', () => {
    it('returns empty string for empty or non-string path', () => {
      expect(findVerifyDir('', 2)).toBe('');
      expect(findVerifyDir(undefined as unknown as string, 2)).toBe('');
    });

    it('strips trailing slashes before splitting', () => {
      expect(findVerifyDir('/a/b/c/d/', 2)).toBe('/a/b');
    });

    it('returns empty when path depth does not exceed level', () => {
      expect(findVerifyDir('a/b/c', 5)).toBe('');
    });

    it('returns relative path without leading slash when input is relative', () => {
      expect(findVerifyDir('a/b/c', 1)).toBe('a/b');
    });
  });

  describe('findVerifySubDir', () => {
    it('returns first verify-prefixed subdirectory', async () => {
      setupFs({
        '/parent': [
          ['other', FileType.Directory],
          ['verify_v2', FileType.Directory],
          ['verify_file.json', FileType.File],
        ],
      });

      const result = await findVerifySubDir('/parent');

      expect(result).toBe('/parent/verify_v2');
    });

    it('returns empty string when no verify subdirectory exists', async () => {
      setupFs({ '/parent': [['other', FileType.Directory]] });

      const result = await findVerifySubDir('/parent');

      expect(result).toBe('');
    });
  });
});
