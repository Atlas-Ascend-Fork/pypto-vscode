/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, expect, it } from 'vitest';

import { detectConflicts } from '../memoryConflictDetection';
import { findMemoryTensorsAtPoint, formatRawShape, processIncomingData } from '../memoryDataProcessor';
import { TensorSearchNavigationUtil } from '../tensorSearchNavigationUtil';
import { validateMemoryData } from '../validateMemoryData';
import { createMemoryUnitFixture } from './memory-unit-fixture';

describe('GM memory happy-path pipeline', () => {
  it('validates, lays out, detects conflicts, and creates searchable chart rows', () => {
    const data = createMemoryUnitFixture();
    const memoryBlocks: any[] = [];
    const overlaps: any[] = [];
    const tensorColorMap = {};
    const viewState = {};
    const timelineState = {};
    const maxY = { value: 0 };

    expect(validateMemoryData(data)).toBe(true);

    const result = processIncomingData(
      memoryBlocks,
      overlaps,
      tensorColorMap,
      viewState,
      timelineState,
      maxY,
      data,
      true,
    );

    expect(result.regionLayout.regions).toHaveLength(2);
    expect(result.regionLayout.yMax).toBe(2250);
    expect(memoryBlocks).toHaveLength(3);
    expect(memoryBlocks[0]).toMatchObject({ start: 2, end: 8, startAddr: 100, endAddr: 500, regionId: 0 });
    expect(memoryBlocks[2]).toMatchObject({ start: 1, end: 3, startAddr: 1500, endAddr: 1750, regionId: 1 });
    expect(result).toMatchObject({ minT: 1, maxT: 11.5 });
    expect(viewState).toMatchObject({ minTime: 1, maxTime: 11.5, timeRange: 10.5 });

    const conflictResult = detectConflicts(memoryBlocks, '');
    expect(conflictResult.overlaps).toEqual([
      expect.objectContaining({ x1: 5, x2: 8, y1: 300, y2: 500, tensors: ['magic-alpha', 'magic-beta'], regionId: 0 }),
    ]);

    const rows = TensorSearchNavigationUtil.createChartData(memoryBlocks, 'magic', 1, formatRawShape);
    expect(rows).toHaveLength(3);
    expect(rows[1][18]).toBe(1);
    expect(rows[1][19]).toBe(1);
    expect(rows[1][20]).toBe(1);

    expect(findMemoryTensorsAtPoint(memoryBlocks, 6, 400).map((tensor) => tensor.name)).toEqual(['tensor-a', 'tensor-b']);
    expect(findMemoryTensorsAtPoint(memoryBlocks, 2, 100).map((tensor) => tensor.name)).toEqual(['tensor-a']);
    expect(findMemoryTensorsAtPoint(memoryBlocks, 8, 500).map((tensor) => tensor.name)).toEqual(['tensor-b']);
    expect(findMemoryTensorsAtPoint(memoryBlocks, 6, 700)).toEqual([]);
  });

  it('rejects an incomplete payload before processing', () => {
    expect(validateMemoryData({ meta: {}, rawTensors: []})).toBe(false);
  });

  it('rejects non-boolean access types', () => {
    const data = createMemoryUnitFixture();
    data.rawTensors[0].accesses[0].isWrite = 'false' as any;

    expect(validateMemoryData(data)).toBe(false);
  });

  it('detects conflicts in globally sorted order while skipping other regions', () => {
    const blocks: any[] = [
      { end: 8, endAddr: 30, magicId: 'a', name: 'a', rawObj: { rawId: 'a' }, regionId: 0, start: 0, startAddr: 10 },
      { end: 9, endAddr: 50, magicId: 'c', name: 'c', rawObj: { rawId: 'c' }, regionId: 1, start: 1, startAddr: 20 },
      { end: 7, endAddr: 40, magicId: 'b', name: 'b', rawObj: { rawId: 'b' }, regionId: 0, start: 2, startAddr: 20 },
      { end: 6, endAddr: 60, magicId: 'd', name: 'd', rawObj: { rawId: 'd' }, regionId: 1, start: 3, startAddr: 40 },
    ];

    expect(detectConflicts(blocks, '').overlaps).toEqual([
      expect.objectContaining({ regionId: 0, tensors: ['a', 'b'], x1: 2, x2: 7, y1: 20, y2: 30 }),
      expect.objectContaining({ regionId: 1, tensors: ['c', 'd'], x1: 3, x2: 6, y1: 40, y2: 50 }),
    ]);
    expect(blocks.map((block) => block.conflicts)).toEqual([['b'], ['d'], ['a'], ['c']]);
  });

  it('preserves boundary, equal-start, and numeric-string region semantics', () => {
    const blocks: any[] = [
      { end: 5, endAddr: 20, magicId: 'a', name: 'a', rawObj: { rawId: 'a' }, regionId: '1', start: 0, startAddr: 0 },
      { end: 4, endAddr: 15, magicId: 'b', name: 'b', rawObj: { rawId: 'b' }, regionId: 1, start: 0, startAddr: 5 },
      {
        end: 8, endAddr: 10, magicId: 'time-touch', name: 'time-touch', rawObj: { rawId: 'time-touch' },
        regionId: 1, start: 5, startAddr: 0,
      },
      {
        end: 4, endAddr: 30, magicId: 'address-touch', name: 'address-touch', rawObj: { rawId: 'address-touch' },
        regionId: 1, start: 1, startAddr: 20,
      },
    ];

    expect(detectConflicts(blocks, '').overlaps.map((overlap) => overlap.tensors)).toEqual([['a', 'b']]);
  });
});
