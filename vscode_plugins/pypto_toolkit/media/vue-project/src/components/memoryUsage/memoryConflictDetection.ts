/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
export interface ConflictOverlap {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tensors: [string, string];
  regionId: number;
}

export type BlockItem = Record<string, any>;

export interface ConflictResult {
  overlaps: ConflictOverlap[];
}

export function detectConflicts(
  memoryBlocksRaw: BlockItem[],
  searchQuery: string,
): ConflictResult {
  const q = searchQuery.trim().toLowerCase();
  const blocks = memoryBlocksRaw.filter((item) => {
    if (!q) {
      return true;
    }
    return (String(item.magicId) || '').toLowerCase().includes(q);
  });

  const n = blocks.length;

  for (let i = 0; i < n; i++) {
    blocks[i].isConflict = false;
    blocks[i].conflicts = [];
  }

  const sortedBlocks = [...blocks].sort((a, b) => a.start - b.start);
  const blocksByRegion = new Map<number, BlockItem[]>();
  const positionInRegion = new Map<BlockItem, number>();

  for (const block of sortedBlocks) {
    const regionId = Number(block.regionId);
    if (!Number.isFinite(regionId)) {
      continue;
    }
    let regionBlocks = blocksByRegion.get(regionId);
    if (!regionBlocks) {
      regionBlocks = [];
      blocksByRegion.set(regionId, regionBlocks);
    }
    positionInRegion.set(block, regionBlocks.length);
    regionBlocks.push(block);
  }

  const conflictMap = new Map();
  const overlapList: ConflictOverlap[] = [];

  for (let i = 0; i < sortedBlocks.length; i++) {
    const a = sortedBlocks[i];

    const aEnd = Number(a.end);
    const aStartAddr = Number(a.startAddr);
    const aEndAddr = Number(a.endAddr);
    const aName = a.name;
    const aRegionId = Number(a.regionId);
    const regionBlocks = blocksByRegion.get(aRegionId);
    const regionPosition = positionInRegion.get(a);

    const invalidBounds = !Number.isFinite(aEnd) || !Number.isFinite(aStartAddr) || !Number.isFinite(aEndAddr);
    if (invalidBounds || !regionBlocks || regionPosition === undefined) {
      continue;
    }

    for (let j = regionPosition + 1; j < regionBlocks.length; j++) {
      const b = regionBlocks[j];

      const bStart = Number(b.start);
      const bEnd = Number(b.end);
      const bStartAddr = Number(b.startAddr);
      const bEndAddr = Number(b.endAddr);

      if (!Number.isFinite(bStart)) {
        continue;
      }

      if (bStart >= aEnd) {
        break;
      }

      if (!Number.isFinite(bEnd) || !Number.isFinite(bStartAddr) || !Number.isFinite(bEndAddr)) {
        continue;
      }

      const hasMemoryOverlap = aStartAddr < bEndAddr && bStartAddr < aEndAddr;

      if (!hasMemoryOverlap) {
        continue;
      }

      a.isConflict = true;
      b.isConflict = true;

      const aKey = a.rawObj?.rawId || a.magicId;
      const bKey = b.rawObj?.rawId || b.magicId;

      if (!conflictMap.has(aKey)) {
        conflictMap.set(aKey, new Set());
      }

      if (!conflictMap.has(bKey)) {
        conflictMap.set(bKey, new Set());
      }

      conflictMap.get(aKey).add(b.magicId);
      conflictMap.get(bKey).add(a.magicId);

      const sameName = (aName && aName === b.name) || (!aName && !b.name);
      if (!sameName) {
        overlapList.push({
          x1: Math.max(Number(a.start), bStart),
          y1: Math.max(aStartAddr, bStartAddr),
          x2: Math.min(aEnd, bEnd),
          y2: Math.min(aEndAddr, bEndAddr),
          tensors: [a.magicId || 'Anonymous', b.magicId || 'Anonymous'],
          regionId: aRegionId,
        });
      }
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    const key = blocks[i].rawObj?.rawId || blocks[i].name;
    const c = conflictMap.get(key);

    if (c) {
      blocks[i].conflicts = Array.from(c);
    }
  }

  return { overlaps: overlapList };
}
