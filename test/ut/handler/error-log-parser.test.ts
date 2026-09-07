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
import { Readable } from 'node:stream';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      readdirSync: vi.fn(),
      createReadStream: vi.fn(),
    },
    readdirSync: vi.fn(),
    createReadStream: vi.fn(),
  };
});

import * as fs from 'fs';
import { findFileHere, parseErrorLogs, collectOpMagic, extractErrorBackTrace, getErrorMessage } from '../../../src/handler/error-log-parser';

describe('findFileHere', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns full path when file is found', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'target.log', isFile: () => true, isDirectory: () => false },
      { name: 'other.txt', isFile: () => true, isDirectory: () => false },
    ] as any);
    const result = findFileHere('/test/dir', 'target.log');
    expect(result).toContain('target.log');
  });

  it('returns null when file is not found', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'other.txt', isFile: () => true, isDirectory: () => false },
    ] as any);
    const result = findFileHere('/test/dir', 'missing.log');
    expect(result).toBeNull();
  });

  it('skips directories with matching name', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'target.log', isFile: () => false, isDirectory: () => true },
    ] as any);
    const result = findFileHere('/test/dir', 'target.log');
    expect(result).toBeNull();
  });
});

describe('parseErrorLogs', () => {
  it('parses a single error log line', async () => {
    const logs = ['[ERROR]: some error message [FuncMagic:123][OpMagic:456][Backtrace]'];
    const result = await parseErrorLogs(logs);
    expect(result).toHaveLength(1);
    expect(result[0].FuncMagic).toBe(123);
    expect(result[0].OpMagic).toBe(456);
  });

  it('parses multiple error log lines', async () => {
    const logs = [
      '[ERROR]: error1 [FuncMagic:1][OpMagic:10][Backtrace]',
      '[ERROR]: error2 [FuncMagic:2][OpMagic:20][Backtrace]',
    ];
    const result = await parseErrorLogs(logs);
    expect(result).toHaveLength(2);
    expect(result[0].FuncMagic).toBe(1);
    expect(result[1].FuncMagic).toBe(2);
  });

  it('returns null FuncMagic when not present', async () => {
    const logs = ['[ERROR]: some error opmagic: 789'];
    const result = await parseErrorLogs(logs);
    expect(result[0].FuncMagic).toBeNull();
    expect(result[0].OpMagic).toBe(789);
  });

  it('returns null OpMagic when not present', async () => {
    const logs = ['[ERROR]: some error FuncMagic:100'];
    const result = await parseErrorLogs(logs);
    expect(result[0].FuncMagic).toBe(100);
    expect(result[0].OpMagic).toBeNull();
  });

  it('handles empty logs array', async () => {
    const result = await parseErrorLogs([]);
    expect(result).toEqual([]);
  });
});

describe('collectOpMagic', () => {
  it('collects OpMagic for matching FuncMagic', async () => {
    const server = { setRef: vi.fn() };
    const errlist = [
      { FuncMagic: 100, OpMagic: 1, error: 'err1' },
      { FuncMagic: 100, OpMagic: 2, error: 'err2' },
      { FuncMagic: 200, OpMagic: 3, error: 'err3' },
    ];
    const result = await collectOpMagic(server, errlist, 100);
    expect(result).toEqual(new Set([1, 2]));
    expect(server.setRef).toHaveBeenCalledWith('nodeErrorList', {
      data: [
        { magic: 1, error: 'err1' },
        { magic: 2, error: 'err2' },
      ],
    });
  });

  it('includes OpMagic when FuncMagic is null', async () => {
    const server = { setRef: vi.fn() };
    const errlist = [
      { FuncMagic: null, OpMagic: 5, error: 'err' },
    ];
    const result = await collectOpMagic(server, errlist, 100);
    expect(result).toEqual(new Set([5]));
  });

  it('skips entries with null OpMagic', async () => {
    const server = { setRef: vi.fn() };
    const errlist = [
      { FuncMagic: 100, OpMagic: null, error: 'err' },
    ];
    const result = await collectOpMagic(server, errlist, 100);
    expect(result.size).toBe(0);
  });
});

describe('extractErrorBackTrace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts lines with [ERROR] and magic pattern', async () => {
    const stream = Readable.from([
      'normal line\n',
      '[ERROR]: error msg [FuncMagic:1][OpMagic:2][Backtrace]\n',
      'another normal line\n',
    ]);
    vi.mocked(fs.createReadStream).mockReturnValue(stream as any);
    const result = await extractErrorBackTrace('/test/file.log');
    expect(result).toHaveLength(1);
    expect(result[0].FuncMagic).toBe(1);
  });

  it('returns empty array when no error lines', async () => {
    const stream = Readable.from(['normal line\n', 'another line\n']);
    vi.mocked(fs.createReadStream).mockReturnValue(stream as any);
    const result = await extractErrorBackTrace('/test/file.log');
    expect(result).toEqual([]);
  });
});

describe('getErrorMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('derives log name from PATH pattern and extracts stacks', async () => {
    // jsonFile: After_01_TensorGraph_kernel_PATH1_main.json → targetLog: TensorGraphkernel_PATH1_main.log
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'TensorGraphkernel_PATH1_main.log', isFile: () => true, isDirectory: () => false },
    ] as any);
    vi.mocked(fs.createReadStream).mockReturnValue(
      Readable.from(['[ERROR]: boom [FuncMagic:7][OpMagic:8][Backtrace]\n']) as any,
    );

    const stacks = await getErrorMessage({ fsPath: '/logs/After_01_TensorGraph_kernel_PATH1_main.json' } as any);

    expect(fs.readdirSync).toHaveBeenCalledWith('/logs', expect.anything());
    expect(stacks).toHaveLength(1);
    expect(stacks[0]).toMatchObject({ FuncMagic: 7, OpMagic: 8, error: 'boom' });
  });

  it('falls back to underscore splitting when no PATH pattern', async () => {
    // jsonFile: before_01_run42_debug.json → key: run42_debug.log → targetLog: rundebug.log
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'rundebug.log', isFile: () => true, isDirectory: () => false },
    ] as any);
    vi.mocked(fs.createReadStream).mockReturnValue(
      Readable.from(['[ERROR]: bad opmagic: 11\n']) as any,
    );

    const stacks = await getErrorMessage({ fsPath: '/logs/before_01_run42_debug.json' } as any);

    expect(stacks).toHaveLength(1);
    expect(stacks[0].OpMagic).toBe(11);
  });

  it('returns empty stacks when no matching log file exists', async () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'unrelated.log', isFile: () => true, isDirectory: () => false },
    ] as any);

    const stacks = await getErrorMessage({ fsPath: '/logs/After_01_TensorGraph_kernel_PATH1_main.json' } as any);

    expect(stacks).toEqual([]);
    expect(fs.createReadStream).not.toHaveBeenCalled();
  });
});
