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
import { promises as fs } from 'fs';
import {
  queryAll,
  queryOne,
  queryCount,
  queryAllRaw,
  retryOperation,
  getMTime,
  retryUntil,
} from '../../../src/core/cache-query-helper';

// Mock fs.promises
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    promises: {
      stat: vi.fn(),
    },
  };
});

describe('cache-query-helper', () => {
  describe('queryAll', () => {
    it('should execute multi-row query and map results', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn()
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false),
        getAsObject: vi.fn()
          .mockReturnValueOnce({ id: 1, name: 'Alice' })
          .mockReturnValueOnce({ id: 2, name: 'Bob' }),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      const mapRow = (row: any) => ({ id: row.id, name: row.name.toUpperCase() });
      const result = queryAll(mockDb, 'SELECT * FROM users', [], mapRow);

      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM users');
      expect(mockStmt.bind).toHaveBeenCalledWith([]);
      expect(mockStmt.step).toHaveBeenCalledTimes(3);
      expect(mockStmt.getAsObject).toHaveBeenCalledTimes(2);
      expect(mockStmt.free).toHaveBeenCalled();
      expect(result).toEqual([
        { id: 1, name: 'ALICE' },
        { id: 2, name: 'BOB' },
      ]);
    });

    it('should return empty array when no rows', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockReturnValue(false),
        getAsObject: vi.fn(),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      const result = queryAll(mockDb, 'SELECT * FROM users', [], (row) => row);

      expect(result).toEqual([]);
      expect(mockStmt.free).toHaveBeenCalled();
    });

    it('should free stmt even when error occurs', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockImplementation(() => {
          throw new Error('Query error');
        }),
        getAsObject: vi.fn(),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      expect(() => queryAll(mockDb, 'SELECT * FROM users', [], (row) => row)).toThrow('Query error');
      expect(mockStmt.free).toHaveBeenCalled();
    });
  });

  describe('queryOne', () => {
    it('should execute single-row query and return mapped result', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true),
        getAsObject: vi.fn().mockReturnValue({ id: 1, name: 'Alice' }),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      const mapRow = (row: any) => ({ id: row.id, name: row.name.toUpperCase() });
      const result = queryOne(mockDb, 'SELECT * FROM users WHERE id = ?', [1], mapRow);

      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
      expect(mockStmt.bind).toHaveBeenCalledWith([1]);
      expect(mockStmt.step).toHaveBeenCalledTimes(1);
      expect(mockStmt.getAsObject).toHaveBeenCalledTimes(1);
      expect(mockStmt.free).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, name: 'ALICE' });
    });

    it('should return undefined when no rows', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockReturnValue(false),
        getAsObject: vi.fn(),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      const result = queryOne(mockDb, 'SELECT * FROM users WHERE id = ?', [999], (row) => row);

      expect(result).toBeUndefined();
      expect(mockStmt.free).toHaveBeenCalled();
    });

    it('should free stmt even when error occurs', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockImplementation(() => {
          throw new Error('Query error');
        }),
        getAsObject: vi.fn(),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      expect(() => queryOne(mockDb, 'SELECT * FROM users', [], (row) => row)).toThrow('Query error');
      expect(mockStmt.free).toHaveBeenCalled();
    });
  });

  describe('queryCount', () => {
    it('should execute COUNT query and return number', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true),
        getAsObject: vi.fn().mockReturnValue({ total: 42 }),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      const result = queryCount(mockDb, 'SELECT COUNT(*) as total FROM users', []);

      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT COUNT(*) as total FROM users');
      expect(mockStmt.bind).toHaveBeenCalledWith([]);
      expect(mockStmt.step).toHaveBeenCalledTimes(1);
      expect(mockStmt.getAsObject).toHaveBeenCalledTimes(1);
      expect(mockStmt.free).toHaveBeenCalled();
      expect(result).toBe(42);
    });

    it('should return 0 when no rows', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockReturnValue(false),
        getAsObject: vi.fn(),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      const result = queryCount(mockDb, 'SELECT COUNT(*) as total FROM users', []);

      expect(result).toBe(0);
      expect(mockStmt.free).toHaveBeenCalled();
    });

    it('should handle cnt alias', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true),
        getAsObject: vi.fn().mockReturnValue({ cnt: 100 }),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      const result = queryCount(mockDb, 'SELECT COUNT(*) as cnt FROM users', []);

      expect(result).toBe(100);
    });

    it('should return 0 when total is null', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true),
        getAsObject: vi.fn().mockReturnValue({ total: null }),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      const result = queryCount(mockDb, 'SELECT COUNT(*) as total FROM users', []);

      expect(result).toBe(0);
    });
  });

  describe('queryAllRaw', () => {
    it('should execute multi-row query without mapping', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn()
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false),
        getAsObject: vi.fn()
          .mockReturnValueOnce({ id: 1, name: 'Alice' })
          .mockReturnValueOnce({ id: 2, name: 'Bob' }),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      const result = queryAllRaw(mockDb, 'SELECT * FROM users', [1, 2]);

      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM users');
      expect(mockStmt.bind).toHaveBeenCalledWith([1, 2]);
      expect(mockStmt.step).toHaveBeenCalledTimes(3);
      expect(mockStmt.getAsObject).toHaveBeenCalledTimes(2);
      expect(mockStmt.free).toHaveBeenCalled();
      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });

    it('should not bind when params is empty', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockReturnValue(false),
        getAsObject: vi.fn(),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      queryAllRaw(mockDb, 'SELECT * FROM users', []);

      expect(mockStmt.bind).not.toHaveBeenCalled();
    });

    it('should bind when params is not empty', () => {
      const mockStmt = {
        bind: vi.fn(),
        step: vi.fn().mockReturnValue(false),
        getAsObject: vi.fn(),
        free: vi.fn(),
      };

      const mockDb = {
        prepare: vi.fn().mockReturnValue(mockStmt),
      } as any;

      queryAllRaw(mockDb, 'SELECT * FROM users WHERE id = ?', [1]);

      expect(mockStmt.bind).toHaveBeenCalledWith([1]);
    });
  });

  describe('retryOperation', () => {
    it('should return result on first success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryOperation(operation, 3, 10);

      expect(operation).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });

    it('should retry on failure and succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success');

      const result = await retryOperation(operation, 3, 10);

      expect(operation).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should throw last error after max retries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockRejectedValueOnce(new Error('Third failure'));

      await expect(retryOperation(operation, 3, 10)).rejects.toThrow('Third failure');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should retry when condition is not met', async () => {
      const operation = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('success');

      const shouldRetry = (result: any) => result === null;
      const result = await retryOperation(operation, 3, 10, shouldRetry);

      expect(operation).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should return last result when condition not met after max retries', async () => {
      const operation = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const shouldRetry = (result: any) => result === null;
      const result = await retryOperation(operation, 3, 10, shouldRetry);

      expect(operation).toHaveBeenCalledTimes(3);
      expect(result).toBe(null);
    });

    it('should use default maxRetries and delayMs', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryOperation(operation);

      expect(result).toBe('success');
    });
  });

  describe('getMTime', () => {
    it('should return file modification time as string', async () => {
      const mockMtime = new Date('2024-01-01T12:00:00Z');
      vi.mocked(fs.stat).mockResolvedValue({
        mtime: mockMtime,
      } as any);

      const result = await getMTime('/test/file.txt');

      expect(fs.stat).toHaveBeenCalledWith('/test/file.txt');
      expect(result).toBe(mockMtime.toString());
    });

    it('should throw error when file does not exist', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

      await expect(getMTime('/nonexistent/file.txt')).rejects.toThrow('File not found');
    });
  });

  describe('retryUntil', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryUntil(fn, { maxRetries: 3, delayMs: 10 });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });

    it('should retry until success condition is met', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('success');

      const result = await retryUntil(fn, { maxRetries: 3, delayMs: 10 });

      expect(fn).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should return last result when max retries reached', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await retryUntil(fn, { maxRetries: 3, delayMs: 10 });

      expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      expect(result).toBe(null);
    });

    it('should use custom success condition', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10);

      const isSuccess = (result: number) => result >= 5;
      const result = await retryUntil(fn, { maxRetries: 3, delayMs: 10, isSuccess });

      expect(fn).toHaveBeenCalledTimes(2);
      expect(result).toBe(5);
    });

    it('should catch errors and continue retrying', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockRejectedValueOnce(new Error('Second error'))
        .mockResolvedValueOnce('success');

      const result = await retryUntil(fn, { maxRetries: 3, delayMs: 10 });

      expect(fn).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should return undefined when all attempts fail', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockRejectedValueOnce(new Error('Second error'))
        .mockRejectedValueOnce(new Error('Third error'))
        .mockRejectedValueOnce(new Error('Fourth error'));

      const result = await retryUntil(fn, { maxRetries: 3, delayMs: 10 });

      expect(fn).toHaveBeenCalledTimes(4);
      expect(result).toBeUndefined();
    });

    it('should use default maxRetries and delayMs', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryUntil(fn);

      expect(result).toBe('success');
    });

    it('should use default success condition', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('success');

      const result = await retryUntil(fn, { maxRetries: 3, delayMs: 10 });

      expect(fn).toHaveBeenCalledTimes(2);
      expect(result).toBe('success');
    });
  });
});
