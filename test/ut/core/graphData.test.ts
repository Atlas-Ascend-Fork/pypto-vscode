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
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';

const mockGetMTime = vi.fn();
const mockFuncDataSet = vi.fn();
const mockHashMapSet = vi.fn();
const mockCalleeOpAttrSet = vi.fn();

vi.mock('../../../src/core/sqliteCache', () => ({
  getMTime: (...args: unknown[]) => mockGetMTime(...args),
  SQLiteCache: {},
}));

vi.mock('../../../src/core/sqlInit', () => ({
  getComGraphFuncDataStore: () => ({ set: mockFuncDataSet }),
  getComGraphFileHashMapStore: () => ({ set: mockHashMapSet }),
  getComGraphFileCalleeOpAttrStore: () => ({ set: mockCalleeOpAttrSet }),
}));

import { SingleGraphData, DiffGraphData, GraphData } from '../../../src/core/graphData';

let tmpDir: string;

function writeFixture(name: string, content: unknown): string {
  const file = nodePath.join(tmpDir, name);
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

function makeGraphJson() {
  return {
    version: 'v1',
    functions: [
      {
        hash: 'h1',
        functype: 'ft1',
        func_magicname: 'fm1',
        graphtype: 2,
        semantic_label: ['label1'],
        operations: [
          { opmagic: 1, calleehash: 'h2', attr: ['x'], subgraphid: 0, ioperands: [1, 1] },
          { opmagic: 2 },
        ],
      },
      { hash: 'h2', functype: 'ft2', func_magicname: 'fm2', operations: [] },
    ],
  };
}

describe('graphData', () => {
  beforeAll(() => {
    tmpDir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'graph-data-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMTime.mockResolvedValue('1700000000000');
    mockFuncDataSet.mockResolvedValue(undefined);
    mockHashMapSet.mockResolvedValue(undefined);
    mockCalleeOpAttrSet.mockResolvedValue(undefined);
  });

  describe('readFileAndSetCache (memory mode)', () => {
    it('builds funcHashMap, dataMap and calleeOpAttrMap from a small file', async () => {
      const file = writeFixture('small.json', makeGraphJson());
      const data = new SingleGraphData(file, undefined);

      await data.readFileAndSetCache(file);

      expect(data.funcHashMap.h1).toEqual({ functype: 'ft1', func_magicname: 'fm1', graphtype: 2 });
      expect(data.funcHashMap.h2).toEqual({ functype: 'ft2', func_magicname: 'fm2', graphtype: null });
      expect(data.firstExecFuncHash).toBe('h1');
      expect(data.version).toBe('v1');
      expect(Object.keys(data.dataMap)).toEqual(['h1']);
      expect(data.callHashArrMap.h1).toBe('h2');
      expect(data.calleeOpAttrMap.h2_1_0).toBe('h2');
      expect(mockFuncDataSet).not.toHaveBeenCalled();
    });

    it('does not set firstExecFuncHash when no function matches execution criteria', async () => {
      const json = makeGraphJson();
      json.functions[0].graphtype = 1;
      const file = writeFixture('no_exec.json', json);
      const data = new SingleGraphData(file, undefined);

      await data.readFileAndSetCache(file);

      expect(data.firstExecFuncHash).toBeUndefined();
    });

    it('throws DATA_VALIDATION_OP_MAGIC_ERROR on duplicated opmagic', async () => {
      const json = makeGraphJson();
      json.functions[0].operations = [
        { opmagic: 1, calleehash: 'h2', attr: ['a'], subgraphid: 0 },
        { opmagic: 1, calleehash: 'h2', attr: ['b'], subgraphid: 0 },
      ];
      const file = writeFixture('dup.json', json);
      const data = new SingleGraphData(file, undefined);

      let caught: any;
      try {
        await data.readFileAndSetCache(file);
      } catch (e) {
        caught = e;
      }
      expect(caught?.code).toBe('DATA_VALIDATION_OP_MAGIC_ERROR');
      expect(caught?.message).toContain('duplicated');
    });

    it('throws PURE_MEMORY when a memory-mode step fails', async () => {
      mockGetMTime.mockRejectedValue(new Error('stat failed'));
      const file = writeFixture('memfail.json', makeGraphJson());
      const data = new SingleGraphData(file, undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let caught: any;
      try {
        await data.readFileAndSetCache(file);
      } catch (e) {
        caught = e;
      }
      expect(caught?.code).toBe('PURE_MEMORY');
      errorSpy.mockRestore();
    });
  });

  describe('readFileAndSetCache (db mode)', () => {
    it('writes function data, hash map and callee op attrs to stores', async () => {
      const file = writeFixture('db.json', makeGraphJson());
      const data = new SingleGraphData(file, undefined);
      data.isUsedDB = true;

      await data.readFileAndSetCache(file);

      expect(mockHashMapSet).toHaveBeenCalledTimes(1);
      expect(mockHashMapSet.mock.calls[0][0].filePath).toBe(file);

      expect(mockFuncDataSet).toHaveBeenCalledTimes(2);
      const firstCall = mockFuncDataSet.mock.calls[0][0];
      expect(firstCall).toMatchObject({ filePath: file, funcHash: 'h1', lastChangeTime: '1700000000000', firstEntryHash: 'h1' });
      expect(JSON.parse(firstCall.data).hash).toBe('h1');
      expect(JSON.parse(firstCall.data).operations[0].functype).toBe('ft2');

      expect(mockCalleeOpAttrSet).toHaveBeenCalledWith({
        calleehash: 'h2',
        opMagic: 1,
        opSubgraphid: '0',
        opAttr: '["h2"]',
        ioperands: '[1]',
      });
      expect(data.dataMap).toEqual({});
    });

    it('falls back to memory mode when db writes fail', async () => {
      mockFuncDataSet.mockRejectedValue(new Error('db down'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const file = writeFixture('fallback.json', makeGraphJson());
      const data = new SingleGraphData(file, undefined);
      data.isUsedDB = true;

      await data.readFileAndSetCache(file);

      expect(data.isUsedDB).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
      expect(Object.keys(data.dataMap)).toEqual(['h1']);
      warnSpy.mockRestore();
    });
  });

  describe('readWithStream', () => {
    it('processes streamed values like the parse path', async () => {
      const file = writeFixture('stream.json', makeGraphJson());
      const data = new SingleGraphData(file, undefined);

      await (data as any).readWithStream(file);

      expect(Object.keys(data.dataMap)).toEqual(['h1']);
      expect(data.funcHashMap.h2).toBeDefined();
    });

    it('propagates FILE_READ_ERROR instead of hanging when file is missing', async () => {
      const data = new SingleGraphData(nodePath.join(tmpDir, 'missing.json'), undefined);

      await expect((data as any).readWithStream(nodePath.join(tmpDir, 'missing.json'))).rejects.toMatchObject({
        code: 'FILE_READ_ERROR',
      });
    }, 10000);
  });

  describe('getCompleteData', () => {
    it('returns the value containing functions', async () => {
      const file = writeFixture('complete.json', makeGraphJson());
      const data = new SingleGraphData(file, undefined);

      const result = await data.getCompleteData(file);

      expect(result.functions).toHaveLength(2);
      expect(result.version).toBe('v1');
    });

    it('resolves undefined when no functions present', async () => {
      const file = writeFixture('nofunc.json', { version: 'v1' });
      const data = new SingleGraphData(file, undefined);

      const result = await data.getCompleteData(file);

      expect(result).toBeUndefined();
    });
  });

  describe('getEntryHash', () => {
    it('extracts entryhash from the file', async () => {
      const file = writeFixture('entry.json', { entryhash: 'abc123', other: 1 });

      await expect(GraphData.getEntryHash(file)).resolves.toEqual({ entryhash: 'abc123' });
    });

    it('resolves empty object when entryhash is absent', async () => {
      const file = writeFixture('noentry.json', { other: 1 });

      await expect(GraphData.getEntryHash(file)).resolves.toEqual({});
    });

    it('rejects with FILE_READ_ERROR for a missing file', async () => {
      await expect(GraphData.getEntryHash(nodePath.join(tmpDir, 'missing.json'))).rejects.toMatchObject({
        code: 'FILE_READ_ERROR',
      });
    });
  });

  it('DiffGraphData is instantiable and shares GraphData behavior', async () => {
    const file = writeFixture('diff.json', makeGraphJson());
    const data = new DiffGraphData(file, 'h1');

    expect(data.funcHash).toBe('h1');
    await data.readFileAndSetCache(file);
    expect(data.funcHashMap.h1).toBeDefined();
  });
});
