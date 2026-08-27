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
import { Readable } from 'stream';

// Mock node:fs
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    createReadStream: vi.fn(),
  },
  existsSync: vi.fn(),
  createReadStream: vi.fn(),
}));

// Mock stream-json
vi.mock('stream-json', () => ({
  parser: vi.fn(() => {
    const stream = new Readable({ read() {} });
    (stream as any).pipe = vi.fn().mockReturnThis();
    return stream;
  }),
}));

vi.mock('stream-json/streamers/StreamValues', () => ({
  streamValues: vi.fn(() => {
    const stream = new Readable({ read() {} });
    (stream as any).pipe = vi.fn().mockReturnThis();
    return stream;
  }),
}));

import fs from 'node:fs';
import { parser } from 'stream-json';
import { streamValues } from 'stream-json/streamers/StreamValues';
import { hasHealthReport, getHealthReport } from '../../../src/utils/health-report';

describe('health-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasHealthReport', () => {
    it('should return true when TensorGraph health report exists', () => {
      (fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('_TensorGraphHealthReport.json');
      });

      const result = hasHealthReport('/test/graph.json');
      expect(result).toBe(true);
    });

    it('should return true when TileGraph health report exists', () => {
      (fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('_TileGraphHealthReport.json');
      });

      const result = hasHealthReport('/test/graph.json');
      expect(result).toBe(true);
    });

    it('should return true when ExecuteGraph health report exists', () => {
      (fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('_ExecuteGraph_Health_Report.json');
      });

      const result = hasHealthReport('/test/graph.json');
      expect(result).toBe(true);
    });

    it('should return true when BlockGraph health report exists', () => {
      (fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('_Block_Graph_Health_Report.json');
      });

      const result = hasHealthReport('/test/graph.json');
      expect(result).toBe(true);
    });

    it('should return false when no health report exists', () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = hasHealthReport('/test/graph.json');
      expect(result).toBe(false);
    });

    it('should handle path without .json extension', () => {
      (fs.existsSync as any).mockImplementation((path: string) => {
        return path.includes('_TensorGraphHealthReport.json');
      });

      const result = hasHealthReport('/test/graph');
      expect(result).toBe(true);
    });
  });

  describe('getHealthReport', () => {
    it('should return all health reports when all exist', async () => {
      (fs.existsSync as any).mockReturnValue(true);

      const finalStream = new Readable({ read() {} });
      (finalStream as any).on = vi.fn().mockImplementation(function (this: any, event: string, cb: Function) {
        if (event === 'data') setTimeout(() => cb({ value: { healthKey: 'healthValue' } }), 5);
        if (event === 'end') setTimeout(() => cb(), 10);
        return this;
      });

      const parserStream = { pipe: vi.fn().mockReturnValue(finalStream) };
      (parser as any).mockReturnValue(parserStream);

      (fs.createReadStream as any).mockReturnValue({
        pipe: vi.fn().mockReturnValue(parserStream),
      });

      const result = await getHealthReport('/test/graph.json');

      expect(result.TensorGraph).toEqual({ healthKey: 'healthValue' });
      expect(result.TileGraph).toEqual({ healthKey: 'healthValue' });
      expect(result.ExecuteGraph).toEqual({ healthKey: 'healthValue' });
      expect(result.BlockGraph).toEqual({ healthKey: 'healthValue' });
    });

    it('should return null for non-existent reports', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = await getHealthReport('/test/graph.json');
      
      expect(result.TensorGraph).toBeNull();
      expect(result.TileGraph).toBeNull();
      expect(result.ExecuteGraph).toBeNull();
      expect(result.BlockGraph).toBeNull();
    });

    it('should handle path without .json extension', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      const result = await getHealthReport('/test/graph');
      
      expect(result).toHaveProperty('TensorGraph');
      expect(result).toHaveProperty('TileGraph');
      expect(result).toHaveProperty('ExecuteGraph');
      expect(result).toHaveProperty('BlockGraph');
    });

    it('should check all four health report types', async () => {
      (fs.existsSync as any).mockReturnValue(false);

      await getHealthReport('/test/graph.json');
      
      // Should check all 4 health report types
      expect(fs.existsSync).toHaveBeenCalledWith('/test/graph_TensorGraphHealthReport.json');
      expect(fs.existsSync).toHaveBeenCalledWith('/test/graph_TileGraphHealthReport.json');
      expect(fs.existsSync).toHaveBeenCalledWith('/test/graph_ExecuteGraph_Health_Report.json');
      expect(fs.existsSync).toHaveBeenCalledWith('/test/graph_Block_Graph_Health_Report.json');
    });
  });
});
