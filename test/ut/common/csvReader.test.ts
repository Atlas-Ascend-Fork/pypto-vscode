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
import { Readable } from 'node:stream';

const mockSave = vi.fn().mockResolvedValue(undefined);
const mockAccuracyToolSet = vi.fn().mockResolvedValue(undefined);
const mockAccuracyToolCmpSet = vi.fn().mockResolvedValue(undefined);
const mockAccuracyToolCmpDetailSet = vi.fn().mockResolvedValue(undefined);
const mockAccuracyToolTaskCmpSet = vi.fn().mockResolvedValue(undefined);
const mockAccuracyToolTaskDetailSet = vi.fn().mockResolvedValue(undefined);
const mockAccuracyToolCmpGetByFilePath = vi.fn().mockResolvedValue([]);
const mockAccuracyToolCmpDetailGetByFilePath = vi.fn().mockResolvedValue([]);
const mockAccuracyToolTaskCmpGetByFileName = vi.fn().mockResolvedValue([]);
const mockAccuracyToolTaskDetailGet = vi.fn().mockResolvedValue([]);

const mockSQLiteCacheInstance = {
  save: mockSave,
  accuracyToolSet: mockAccuracyToolSet,
  accuracyToolCmpSet: mockAccuracyToolCmpSet,
  accuracyToolCmpDetailSet: mockAccuracyToolCmpDetailSet,
  accuracyToolTaskCmpSet: mockAccuracyToolTaskCmpSet,
  accuracyToolTaskDetailSet: mockAccuracyToolTaskDetailSet,
  accuracyToolCmpGetByFilePath: mockAccuracyToolCmpGetByFilePath,
  accuracyToolCmpDetailGetByFilePath: mockAccuracyToolCmpDetailGetByFilePath,
  accuracyToolTaskCmpGetByFileName: mockAccuracyToolTaskCmpGetByFileName,
  accuracyToolTaskDetailGet: mockAccuracyToolTaskDetailGet,
};

vi.mock(import('../../../src/core/sqliteCache'), () => ({
  SQLiteCache: {
    getInstance: vi.fn(() => mockSQLiteCacheInstance),
  },
}));

vi.mock(import('../../../src/common/accurancyAnylasis'), () => ({
  getSortedVerifyFiles: vi.fn(() => ['/path/file1.csv', '/path/file2.csv']),
}));

import { getSortedVerifyFiles } from '../../../src/common/accurancyAnylasis';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      createReadStream: vi.fn(),
      readdirSync: vi.fn(),
      statSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    createReadStream: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  };
});

import * as fs from 'fs';
import { readCsv, getCsvData, getCmpFileList, SmartLogExtractor } from '../../../src/common/csvReader';

describe('readCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for empty path', async () => {
    const result = await readCsv('');
    expect(result).toBe(false);
  });

  it('returns false when file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = await readCsv('/nonexistent.csv');
    expect(result).toBe(false);
  });

  it('parses type 1 CSV and saves to SQLiteCache', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(Buffer.from('NO.,B>PHASE_NAME\n1,Pass_01\n'));
    const result = await readCsv('/test/data.csv', 1);
    expect(result).toBe(true);
    expect(mockAccuracyToolSet).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
  });

  it('parses type 2 CSV', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(Buffer.from('NO.,B>PHASE_NAME\n1,Pass_01\n'));
    const result = await readCsv('/test/data.csv', 2);
    expect(result).toBe(true);
    expect(mockAccuracyToolCmpSet).toHaveBeenCalled();
  });

  it('parses type 3 CSV', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(Buffer.from('GROUP,INDEX\n1,0\n'));
    const result = await readCsv('/test/data.csv', 3);
    expect(result).toBe(true);
    expect(mockAccuracyToolCmpDetailSet).toHaveBeenCalled();
  });

  it('parses type 4 CSV', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(Buffer.from('NO.,A>PHASE_NAME\n1,Pass_01\n'));
    const result = await readCsv('/test/data.csv', 4);
    expect(result).toBe(true);
    expect(mockAccuracyToolTaskCmpSet).toHaveBeenCalled();
  });

  it('parses type 5 CSV', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(Buffer.from('GROUP,INDEX\n1,0\n'));
    const result = await readCsv('/test/data.csv', 5);
    expect(result).toBe(true);
    expect(mockAccuracyToolTaskDetailSet).toHaveBeenCalled();
  });

  it('returns false for unsupported type', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(Buffer.from('A,B\n1,2\n'));
    const result = await readCsv('/test/data.csv', 99);
    expect(result).toBe(false);
  });

  it('handles UTF-8 BOM', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(Buffer.from('\uFEFFNO.,B>PHASE_NAME\n1,Pass_01\n'));
    const result = await readCsv('/test/data.csv', 1);
    expect(result).toBe(true);
  });
});

describe('getCsvData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls accuracyToolCmpGetByFilePath for type 2', async () => {
    await getCsvData('/test/data.csv', 2);
    expect(mockAccuracyToolCmpGetByFilePath).toHaveBeenCalledWith('/test/data.csv', 50, 0);
  });

  it('calls accuracyToolCmpDetailGetByFilePath for type 3', async () => {
    await getCsvData('/test/data.csv', 3);
    expect(mockAccuracyToolCmpDetailGetByFilePath).toHaveBeenCalledWith('/test/data.csv');
  });

  it('calls accuracyToolTaskCmpGetByFileName for type 4', async () => {
    await getCsvData('/test/data.csv', 4);
    expect(mockAccuracyToolTaskCmpGetByFileName).toHaveBeenCalledWith('/test/data.csv', 50, 0);
  });

  it('calls accuracyToolTaskDetailGet for type 5', async () => {
    await getCsvData('/test/data.csv', 5);
    expect(mockAccuracyToolTaskDetailGet).toHaveBeenCalledWith('/test/data.csv');
  });

  it('returns false for unsupported type', async () => {
    const result = await getCsvData('/test/data.csv', 99);
    expect(result).toBe(false);
  });
});

describe('getCmpFileList', () => {
  it('returns sorted file list', async () => {
    const result = await getCmpFileList('/test/dir');
    expect(result).toEqual(['/path/file1.csv', '/path/file2.csv']);
  });

  it('returns empty array on error', async () => {
    vi.mocked(getSortedVerifyFiles).mockImplementationOnce(() => {
      throw new Error('dir not found');
    });
    const result = await getCmpFileList('/nonexistent');
    expect(result).toEqual([]);
  });
});

describe('SmartLogExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts lines between start and end keywords', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const stream = Readable.from([
      'other line\n',
      '[START] begin data\n',
      'data line 1\n',
      'data line 2\n',
      '[END] stop\n',
    ]);
    vi.mocked(fs.createReadStream).mockReturnValue(stream as any);

    const extractor = new SmartLogExtractor();
    const result = await extractor.extract('/test/file.log', '[START]', '[END]');
    expect(result).toEqual(['[START] begin data', 'data line 1', 'data line 2']);
  });

  it('rejects when file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const extractor = new SmartLogExtractor();
    await expect(extractor.extract('/missing.log', 'start', 'end')).rejects.toThrow();
  });

  it('returns all lines from start to EOF when end keyword not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const stream = Readable.from([
      '[START] begin\n',
      'data line\n',
    ]);
    vi.mocked(fs.createReadStream).mockReturnValue(stream as any);

    const extractor = new SmartLogExtractor();
    const result = await extractor.extract('/test/file.log', '[START]', '[END]');
    expect(result).toEqual(['[START] begin', 'data line']);
  });
});
