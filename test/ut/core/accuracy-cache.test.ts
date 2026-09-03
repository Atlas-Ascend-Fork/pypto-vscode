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
import { AccuracyCache } from '../../../src/core/accuracy-cache';
import type { Database } from 'sql.js';

describe('AccuracyCache', () => {
  let mockDb: any;
  let cache: AccuracyCache;

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
    cache = new AccuracyCache(mockDb as Database);
  });

  describe('toolSet', () => {
    it('should insert or replace accuracy tool data', async () => {
      const data = {
        filePath: '/path/to/file.csv',
        no: '1',
        phaseName: 'Pass_01',
        funcMagicName: 'func1',
        rawMagic: '123',
        result: 'PASS',
      };
      await cache.toolSet(data as any);
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('toolGet', () => {
    it('should get accuracy tool data by composite key', async () => {
      const mockRow = {
        file_path: '/path/to/file.csv',
        no: '1',
        phaseName: 'Pass_01',
        funcMagicName: 'func1',
        rawMagic: '123',
        result: 'PASS',
        dataType: 'float32',
        validShape: '[1,2,3]',
        loopInfo: 'loop1',
        rtolAtol: '1e-5',
        cntFailWarnTol: '1/0/0',
        cntTotalZeroInfnanCnt: '100/0/0',
        mre: '0.01',
        mreTop1permil: '0.001',
        mreTop8: '0.008',
        mae: '0.005',
        maeTop8: '0.004',
        maeTop1permil: '0.0005',
        aMax: '1.0',
        aMin: '0.0',
        aAvg: '0.5',
        aAavg: '0.5',
        aZero: '0',
        aInfnan: '0',
        bMax: '1.0',
        bMin: '0.0',
        bAvg: '0.5',
        bAavg: '0.5',
        bZero: '0',
        bInfnan: '0',
        bTimestamp: '2024-01-01',
      };
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRow),
        free: vi.fn(),
      });

      const result = await cache.toolGet('/path/to/file.csv', 'Pass_01', 'func1', '123');
      expect(result).toBeDefined();
      expect(result?.filePath).toBe('/path/to/file.csv');
      expect(result?.no).toBe('1');
      expect(result?.phaseName).toBe('Pass_01');
    });
  });

  describe('toolGetAll', () => {
    it('should get all accuracy tool data', async () => {
      const mockRows = [
        { filePath: '/path/to/file.csv', no: '1', result: 'PASS' },
        { filePath: '/path/to/file.csv', no: '2', result: 'FAIL' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValueOnce(mockRows[0]).mockReturnValueOnce(mockRows[1]),
        free: vi.fn(),
      });

      const result = await cache.toolGetAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('getStatsByFile', () => {
    it('should get statistics by file path', async () => {
      const mockRows = [
        { result: 'PASS', cnt: 10 },
        { result: 'FAIL', cnt: 5 },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValueOnce(mockRows[0]).mockReturnValueOnce(mockRows[1]),
        free: vi.fn(),
      });

      const result = await cache.getStatsByFile('/path/to/file.csv');
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('getPhaseStatusListByFunc', () => {
    it('should get phase status list by function', async () => {
      const mockRows = [
        { phaseName: 'Pass_01', result: 'PASS' },
        { phaseName: 'Pass_02', result: 'FAIL' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValueOnce(mockRows[0]).mockReturnValueOnce(mockRows[1]),
        free: vi.fn(),
      });

      const result = await cache.getPhaseStatusListByFunc('/path/to/file.csv', 'func1');
      expect(result).toHaveLength(2);
    });
  });

  describe('getDistinctPhaseResults', () => {
    it('should get distinct phase results', async () => {
      const mockRows = [
        { phaseName: 'Pass_01', result: 'PASS' },
        { phaseName: 'Pass_02', result: 'FAIL' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValueOnce(mockRows[0]).mockReturnValueOnce(mockRows[1]),
        free: vi.fn(),
      });

      const result = await cache.getDistinctPhaseResults('/path/to/file.csv');
      expect(result).toHaveLength(2);
    });
  });

  describe('getFirstResByPhaseOnTimestamp', () => {
    it('should get first result by phase on timestamp', async () => {
      const mockRows = [
        { phaseName: 'Pass_01', result: 'PASS', timestamp: '2024-01-01' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRows[0]),
        free: vi.fn(),
      });

      const result = await cache.getFirstResByPhaseOnTimestamp('/path/to/file.csv', 'Pass_01', 'PASS');
      expect(result).toHaveLength(1);
    });
  });

  describe('getFirstFailByPhase', () => {
    it('should get first fail by phase', async () => {
      const mockRows = [
        { phaseName: 'Pass_01', result: 'FAIL' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRows[0]),
        free: vi.fn(),
      });

      const result = await cache.getFirstFailByPhase('/path/to/file.csv');
      expect(result).toHaveLength(1);
    });
  });

  describe('getStatsByFunc', () => {
    it('should get statistics by function', async () => {
      const mockRows = [
        { result: 'PASS', cnt: 10 },
        { result: 'FAIL', cnt: 5 },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValueOnce(mockRows[0]).mockReturnValueOnce(mockRows[1]),
        free: vi.fn(),
      });

      const result = await cache.getStatsByFunc('/path/to/file.csv', 'Pass_01', 'func1');
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('getErrorDetailsByFunc', () => {
    it('should get error details by function', async () => {
      const mockRows = [
        { rawMagic: '123', result: 'FAIL' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRows[0]),
        free: vi.fn(),
      });

      const result = await cache.getErrorDetailsByFunc('/path/to/file.csv', 'Pass_01', 'func1', 10, 0);
      expect(result).toHaveLength(1);
    });
  });

  describe('getErrorDetailsOfGraphByFunc', () => {
    it('should get error details of graph by function', async () => {
      const mockRows = [
        { rawMagic: '123', result: 'FAIL' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRows[0]),
        free: vi.fn(),
      });

      const result = await cache.getErrorDetailsOfGraphByFunc('/path/to/file.csv', 'Pass_01', 'func1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getErrorListByPage', () => {
    it('should get error list by page', async () => {
      const mockRows = [
        { rawMagic: '123', result: 'FAIL' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRows[0]),
        free: vi.fn(),
      });

      const result = await cache.getErrorListByPage('/path/to/file.csv', 'Pass_01', 'func1', 'keyword', 10, 0);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('list');
    });
  });

  describe('cmpSet', () => {
    it('should insert or replace comparison data', async () => {
      const data = {
        filePath: '/path/to/file.csv',
        no: '1',
        pathFuncMagicName: 'func1',
      };
      await cache.cmpSet(data as any);
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('getCmpErrorListByFilePath', () => {
    it('should get comparison error list by file path', async () => {
      const mockRows = [
        { filePath: '/path/to/file.csv', no: '1', result: 'FAIL' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRows[0]),
        free: vi.fn(),
      });

      const result = await cache.getCmpErrorListByFilePath('/path/to/file.csv', 10, 0);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('list');
    });
  });

  describe('cmpGetByFilePath', () => {
    it('should get comparison data by file path', async () => {
      const mockRows = [
        { filePath: '/path/to/file.csv', no: '1' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRows[0]),
        free: vi.fn(),
      });

      const result = await cache.cmpGetByFilePath('/path/to/file.csv');
      expect(result).toHaveLength(1);
    });
  });

  describe('cmpGetCountByFilePath', () => {
    it('should get comparison count by file path', async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue({ cnt: 5 }),
        free: vi.fn(),
      });

      const result = await cache.cmpGetCountByFilePath('/path/to/file.csv');
      expect(result).toBe(5);
    });
  });

  describe('cmpDetailSet', () => {
    it('should insert or replace comparison detail data', async () => {
      const data = {
        filePath: '/path/to/file.csv',
        group: 'group1',
        index: '1',
      };
      await cache.cmpDetailSet(data as any);
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('cmpDetailGetByFilePath', () => {
    it('should get comparison detail data by file path', async () => {
      const mockRows = [
        { filePath: '/path/to/file.csv', group: 'group1', index: '1' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRows[0]),
        free: vi.fn(),
      });

      const result = await cache.cmpDetailGetByFilePath('/path/to/file.csv');
      expect(result).toHaveLength(1);
    });
  });

  describe('compListSet', () => {
    it('should insert or replace comparison list data', async () => {
      const dataList = [
        { computePath: '/path/to/compute', filePath: '/path/to/file.csv', firstReq: '2024-01-01' },
      ];
      await cache.compListSet('/path/to/compute', dataList as any);
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('compListGetByComputePath', () => {
    it('should get comparison list by compute path', async () => {
      const mockRows = [
        { computePath: '/path/to/compute', filePath: '/path/to/file.csv' },
      ];
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRows[0]),
        free: vi.fn(),
      });

      const result = await cache.compListGetByComputePath('/path/to/compute');
      expect(result).toHaveLength(1);
    });
  });

  describe('compListGetByFilePath', () => {
    it('should get comparison list by file path', async () => {
      const mockRow = {
        computePath: '/path/to/compute',
        filePath: '/path/to/file.csv',
        firstReq: '2024-01-01',
      };
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRow),
        free: vi.fn(),
      });

      const result = await cache.compListGetByFilePath('/path/to/file.csv');
      expect(result).toEqual(mockRow);
    });
  });

  describe('compListUpdateFirstReq', () => {
    it('should update first request timestamp', async () => {
      await cache.compListUpdateFirstReq('/path/to/file.csv', '2024-01-01');
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('filePathSet', () => {
    it('should insert or replace file path data', async () => {
      const data = {
        fileType: 'csv',
        filePath: '/path/to/file.csv',
      };
      await cache.filePathSet(data as any);
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('filePathGet', () => {
    it('should get file path data', async () => {
      const mockRow = {
        fileType: 'csv',
        filePath: '/path/to/file.csv',
      };
      mockDb.prepare.mockReturnValue({
        bind: vi.fn(),
        step: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
        getAsObject: vi.fn().mockReturnValue(mockRow),
        free: vi.fn(),
      });

      const result = await cache.filePathGet();
      expect(result).toEqual(mockRow);
    });
  });
});
