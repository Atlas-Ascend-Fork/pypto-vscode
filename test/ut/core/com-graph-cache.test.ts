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
import { ComGraphCache } from '../../../src/core/com-graph-cache';
import type { Database } from 'sql.js';

describe('ComGraphCache', () => {
  let mockDb: any;
  let cache: ComGraphCache;

  beforeEach(() => {
    mockDb = {
      run: vi.fn(),
      exec: vi.fn(),
      prepare: vi.fn(() => ({
        bind: vi.fn(),
        step: vi.fn().mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue({}),
        free: vi.fn(),
      })),
    };
    cache = new ComGraphCache(mockDb as Database);
  });

  describe('layoutSet', () => {
    it('should insert or replace layout data', async () => {
      await cache.layoutSet('/path/to/file.json', 'hash123', '{"layout":"data"}', '2024-01-01');
      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO com_graph_layout(file_path,func_hash,layout_result,last_change_time) VALUES(?,?,?,?)',
        ['/path/to/file.json', 'hash123', '{"layout":"data"}', '2024-01-01']
      );
    });
  });

  describe('layoutGet', () => {
    it('should get layout data by file path and func hash', async () => {
      const mockRow = {
        file_path: '/path/to/file.json',
        layout_result: '{"layout":"data"}',
        last_change_time: '2024-01-01',
      };
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRow),
        free: vi.fn(),
      });

      const result = await cache.layoutGet('/path/to/file.json', 'hash123');
      expect(result).toEqual(mockRow);
    });

    it('should return undefined when layout not found', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue({}),
        free: vi.fn(),
      });

      const result = await cache.layoutGet('/path/to/file.json', 'hash123');
      expect(result).toBeUndefined();
    });
  });

  describe('layoutDel', () => {
    it('should delete layout data by file path', async () => {
      await cache.layoutDel('/path/to/file.json');
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM com_graph_layout WHERE file_path=?',
        ['/path/to/file.json']
      );
    });
  });

  describe('finalResultSet', () => {
    it('should insert or replace final result data', async () => {
      await cache.finalResultSet('/path/to/file.json', 'hash123', '{"result":"data"}', '2024-01-01');
      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO com_graph_final_result(file_path,func_hash,final_result,last_change_time) VALUES(?,?,?,?)',
        ['/path/to/file.json', 'hash123', '{"result":"data"}', '2024-01-01']
      );
    });
  });

  describe('finalResultGet', () => {
    it('should get final result data by file path and func hash', async () => {
      const mockRow = {
        file_path: '/path/to/file.json',
        final_result: '{"result":"data"}',
        last_change_time: '2024-01-01',
      };
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRow),
        free: vi.fn(),
      });

      const result = await cache.finalResultGet('/path/to/file.json', 'hash123');
      expect(result).toEqual(mockRow);
    });
  });

  describe('finalResultDel', () => {
    it('should delete final result data by file path', async () => {
      await cache.finalResultDel('/path/to/file.json');
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM com_graph_final_result WHERE file_path=?',
        ['/path/to/file.json']
      );
    });
  });

  describe('funcDataSet', () => {
    it('should insert or replace function data', async () => {
      await cache.funcDataSet(
        '/path/to/file.json',
        'hash123',
        '["hash1","hash2"]',
        '{"data":"value"}',
        '/path/to/bigdata.json',
        '2024-01-01'
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO com_graph_func_data(file_path,func_hash,call_hash_arr,data,big_datA>file_path,last_change_time) VALUES(?,?,?,?,?,?)',
        ['/path/to/file.json', 'hash123', '["hash1","hash2"]', '{"data":"value"}', '/path/to/bigdata.json', '2024-01-01']
      );
    });
  });

  describe('funcDataGetCount', () => {
    it('should get count of function data by file path', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue({ cnt: 5 }),
        free: vi.fn(),
      });

      const result = await cache.funcDataGetCount('/path/to/file.json');
      expect(result).toBe(5);
    });
  });

  describe('funcDataGet', () => {
    it('should get function data by file path and func hash', async () => {
      const mockRow = {
        file_path: '/path/to/file.json',
        func_hash: 'hash123',
        call_hash_arr: '["hash1","hash2"]',
        data: '{"data":"value"}',
        'big_datA>file_path': '/path/to/bigdata.json',
        last_change_time: '2024-01-01',
      };
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRow),
        free: vi.fn(),
      });

      const result = await cache.funcDataGet('/path/to/file.json', 'hash123');
      expect(result).toEqual(mockRow);
    });
  });

  describe('funcDataDel', () => {
    it('should delete function data by file path', async () => {
      await cache.funcDataDel('/path/to/file.json');
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM com_graph_func_data WHERE file_path=?',
        ['/path/to/file.json']
      );
    });
  });

  describe('fileHashMapSet', () => {
    it('should insert or replace file hash map data', async () => {
      await cache.fileHashMapSet('/path/to/file.json', '{"hash":"value"}');
      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO com_graph_file_hash_map(file_path,data) VALUES(?,?)',
        ['/path/to/file.json', '{"hash":"value"}']
      );
    });
  });

  describe('fileHashMapGet', () => {
    it('should get file hash map data by file path', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue({ data: '{"hash":"value"}' }),
        free: vi.fn(),
      });

      const result = await cache.fileHashMapGet('/path/to/file.json');
      expect(result).toBe('{"hash":"value"}');
    });

    it('should return empty string when not found', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue({}),
        free: vi.fn(),
      });

      const result = await cache.fileHashMapGet('/path/to/file.json');
      expect(result).toBe('');
    });
  });

  describe('fileHashMapDel', () => {
    it('should delete file hash map data by file path', async () => {
      await cache.fileHashMapDel('/path/to/file.json');
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM com_graph_file_hash_map WHERE file_path=?',
        ['/path/to/file.json']
      );
    });
  });

  describe('fileCalleeOpAttrSet', () => {
    it('should insert or replace callee operation attributes', async () => {
      await cache.fileCalleeOpAttrSet('callee123', 'op456', 'subgraph789', '{"attr":"value"}', '["operand1","operand2"]');
      expect(mockDb.run).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO com_graph_file_callee_op_attr(calleehash,op_magic,op_subgraphid,op_attr,ioperands) VALUES(?,?,?,?,?)',
        ['callee123', 'op456', 'subgraph789', '{"attr":"value"}', '["operand1","operand2"]']
      );
    });
  });

  describe('fileCalleeOpAttrGet', () => {
    it('should get callee operation attributes', async () => {
      const mockRow = {
        op_attr: '{"attr":"value"}',
        ioperands: '["operand1","operand2"]',
      };
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRow),
        free: vi.fn(),
      });

      const result = await cache.fileCalleeOpAttrGet('callee123', 'op456', 'subgraph789');
      expect(result).toEqual(mockRow);
    });
  });
});
