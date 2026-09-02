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
import { calculateTensorDistance, findAdjacentTensorMeasurements } from '../memoryDistanceMeasurement';
import { MemoryRegionLayoutUtil } from '../memoryRegionLayoutUtil';
import { formatTimelineTimestamp, formatTimelineUnit, getTimelineLabelPosition, isValidChartTimeRange } from '../memoryTimelineUtil';
import { TensorSearchNavigationUtil } from '../tensorSearchNavigationUtil';
import { validateMemoryData } from '../validateMemoryData';
import { createMemoryUnitFixture } from './memory-unit-fixture';

describe('GM memory happy-path pipeline', () => {
  it('calculates address distance independent of selection order', () => {
    const lower = { absoluteBase: 100, absoluteEnd: 200 };
    const upper = { absoluteBase: 300, absoluteEnd: 400 };

    expect(calculateTensorDistance(lower, upper)).toMatchObject({
      lower,
      upper,
      lowerBoundary: 200,
      upperBoundary: 300,
      distance: 100,
    });
    expect(calculateTensorDistance(upper, lower)).toMatchObject({ distance: 100 });
    expect(calculateTensorDistance(lower, { absoluteBase: 200, absoluteEnd: 250 })).toMatchObject({ distance: 0 });
    expect(calculateTensorDistance(lower, { absoluteBase: 150, absoluteEnd: 250 })).toMatchObject({ distance: -50 });
    expect(
      calculateTensorDistance(
        { absoluteBase: 100, absoluteEnd: 200, regionId: 1 },
        { absoluteBase: 300, absoluteEnd: 400, regionId: 2 },
      ),
    ).toBeNull();
    expect(calculateTensorDistance(lower, lower)).toBeNull();
    expect(calculateTensorDistance({ absoluteBase: 'invalid', absoluteEnd: 200 } as any, upper)).toBeNull();
  });

  it('finds nearest same-level tensors above and below in the same region', () => {
    const anchor = { absoluteBase: 300, absoluteEnd: 400, regionId: 1 };
    const overlappingAbove = { absoluteBase: 200, absoluteEnd: 320, regionId: 1 };
    const fartherAbove = { absoluteBase: 100, absoluteEnd: 150, regionId: 1 };
    const sameLevelAbove = { absoluteBase: 100, absoluteEnd: 150, regionId: 1 };
    const differentLevelAbove = { absoluteBase: 50, absoluteEnd: 150, regionId: 1 };
    const overlappingBelow = { absoluteBase: 390, absoluteEnd: 450, regionId: 1 };
    const fartherBelow = { absoluteBase: 600, absoluteEnd: 700, regionId: 1 };
    const sameLevelBelow = { absoluteBase: 600, absoluteEnd: 700, regionId: 1 };
    const differentLevelBelow = { absoluteBase: 600, absoluteEnd: 650, regionId: 1 };
    const touchingAbove = { absoluteBase: 250, absoluteEnd: 300, regionId: 1 };
    const otherRegion = { absoluteBase: 399, absoluteEnd: 410, regionId: 2 };

    const adjacent = findAdjacentTensorMeasurements(anchor, [
      fartherBelow,
      differentLevelBelow,
      sameLevelBelow,
      otherRegion,
      overlappingAbove,
      fartherAbove,
      differentLevelAbove,
      sameLevelAbove,
      overlappingBelow,
    ]);
    expect(adjacent).toEqual({
      anchor,
      above: expect.objectContaining({ lower: fartherAbove, upper: anchor, distance: 150 }),
      below: expect.objectContaining({ lower: anchor, upper: fartherBelow, distance: 200 }),
      aboveCandidates: [
        expect.objectContaining({ lower: fartherAbove, upper: anchor, distance: 150 }),
        expect.objectContaining({ lower: sameLevelAbove, upper: anchor, distance: 150 }),
      ],
      belowCandidates: [
        expect.objectContaining({ lower: anchor, upper: fartherBelow, distance: 200 }),
        expect.objectContaining({ lower: anchor, upper: sameLevelBelow, distance: 200 }),
      ],
    });
    expect(findAdjacentTensorMeasurements(anchor, [touchingAbove])).toMatchObject({
      above: expect.objectContaining({ lower: touchingAbove, upper: anchor, distance: 0 }),
      aboveCandidates: [expect.objectContaining({ lower: touchingAbove, upper: anchor, distance: 0 })],
    });
  });

  it('formats timeline units, timestamps, and non-overlapping label positions', () => {
    expect(formatTimelineUnit(2e6, 1e6, 1e5)).toEqual({ value: '1.0', unit: 's' });
    expect(formatTimelineUnit(500, 25, 10)).toEqual({ value: '25', unit: 'µs' });
    expect(formatTimelineTimestamp(1.234, 1)).toBe('000 000 234');
    expect(isValidChartTimeRange(1, 2)).toBe(true);
    expect(isValidChartTimeRange(2, 1)).toBe(false);

    const context = { font: '12px Arial', measureText: (label: string) => ({ width: label.length * 5 }) } as any;
    expect(getTimelineLabelPosition(context, ['10µs'], 10, 100, -Infinity)).toEqual({ x: 12, right: 32 });
    expect(getTimelineLabelPosition(context, ['10µs'], 20, 100, 18)).toBeNull();
  });

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
    expect(MemoryRegionLayoutUtil.toAbsoluteAddress(0, result.regionLayout.regions[0])).toBe(1000);
    expect(MemoryRegionLayoutUtil.toAbsoluteAddress(500, result.regionLayout.regions[0])).toBe(1500);
    expect(MemoryRegionLayoutUtil.toAbsoluteAddress(1000, result.regionLayout.regions[0])).toBe(2000);
    expect(MemoryRegionLayoutUtil.toAbsoluteAddress(1500, result.regionLayout.regions[1])).toBe(3500);
    expect(MemoryRegionLayoutUtil.toAbsoluteAddress(1750, result.regionLayout.regions[1])).toBe(4000);
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
      { end: 8, endAddr: 30, magicId: 'a', name: 'a', rawObj: { rawId: 'a', hasOverlap: true }, regionId: 0, start: 0, startAddr: 10 },
      { end: 9, endAddr: 50, magicId: 'c', name: 'c', rawObj: { rawId: 'c', hasOverlap: true }, regionId: 1, start: 1, startAddr: 20 },
      { end: 7, endAddr: 40, magicId: 'b', name: 'b', rawObj: { rawId: 'b', hasOverlap: true }, regionId: 0, start: 2, startAddr: 20 },
      { end: 6, endAddr: 60, magicId: 'd', name: 'd', rawObj: { rawId: 'd', hasOverlap: true }, regionId: 1, start: 3, startAddr: 40 },
    ];

    expect(detectConflicts(blocks, '').overlaps).toEqual([
      expect.objectContaining({ regionId: 0, tensors: ['a', 'b'], x1: 2, x2: 7, y1: 20, y2: 30 }),
      expect.objectContaining({ regionId: 1, tensors: ['c', 'd'], x1: 3, x2: 6, y1: 40, y2: 50 }),
    ]);
    expect(blocks.map((block) => block.conflicts)).toEqual([['b'], ['d'], ['a'], ['c']]);
  });

  it('checks hasOverlap by default and can disable the feature', () => {
    const blocks: any[] = [
      { end: 8, endAddr: 30, magicId: 'a', name: 'a', rawObj: { rawId: 'a' }, regionId: 0, start: 0, startAddr: 10 },
      { end: 7, endAddr: 40, magicId: 'b', name: 'b', rawObj: { rawId: 'b' }, regionId: 0, start: 2, startAddr: 20 },
    ];

    expect(detectConflicts(blocks, '').overlaps).toEqual([]);
    expect(detectConflicts(blocks, '', false).overlaps).toHaveLength(1);

    blocks[0].rawObj.hasOverlap = true;
    expect(detectConflicts(blocks, '').overlaps).toEqual([]);

    blocks[1].rawObj.hasOverlap = true;
    expect(detectConflicts(blocks, '').overlaps).toHaveLength(1);

    blocks[1].rawObj.hasOverlap = false;
    expect(detectConflicts(blocks, '').overlaps).toEqual([]);
  });

  it('preserves boundary, equal-start, and numeric-string region semantics', () => {
    const blocks: any[] = [
      { end: 5, endAddr: 20, magicId: 'a', name: 'a', rawObj: { rawId: 'a', hasOverlap: true }, regionId: '1', start: 0, startAddr: 0 },
      { end: 4, endAddr: 15, magicId: 'b', name: 'b', rawObj: { rawId: 'b', hasOverlap: true }, regionId: 1, start: 0, startAddr: 5 },
      {
        end: 8, endAddr: 10, magicId: 'time-touch', name: 'time-touch', rawObj: { rawId: 'time-touch', hasOverlap: true },
        regionId: 1, start: 5, startAddr: 0,
      },
      {
        end: 4, endAddr: 30, magicId: 'address-touch', name: 'address-touch', rawObj: { rawId: 'address-touch', hasOverlap: true },
        regionId: 1, start: 1, startAddr: 20,
      },
    ];

    expect(detectConflicts(blocks, '').overlaps.map((overlap) => overlap.tensors)).toEqual([['a', 'b']]);
  });
});
