/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { ENABLE_HAS_OVERLAP_CHECK } from './memoryFeatureFlags';

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
  checkHasOverlap = ENABLE_HAS_OVERLAP_CHECK,
): ConflictResult {
  const blocks = filterBlocksByQuery(memoryBlocksRaw, searchQuery, checkHasOverlap);
  resetBlockState(blocks);

  const sortedBlocks = [...blocks].sort((a, b) => a.start - b.start);
  const { blocksByRegion, positionInRegion } = groupBlocksByRegion(sortedBlocks);

  const conflictMap = new Map();
  const overlapList: ConflictOverlap[] = [];

  for (const a of sortedBlocks) {
    checkConflictsInBlock(a, blocksByRegion, positionInRegion, conflictMap, overlapList);
  }

  assignConflictLists(blocks, conflictMap);
  return { overlaps: overlapList };
}

function filterBlocksByQuery(memoryBlocksRaw: BlockItem[], searchQuery: string, checkHasOverlap: boolean): BlockItem[] {
  const q = searchQuery.trim().toLowerCase();
  return memoryBlocksRaw.filter((item) => {
    if (checkHasOverlap && item.hasOverlap === false) {
      return false;
    }
    return !q || (String(item.magicId) || '').toLowerCase().includes(q);
  });
}

function resetBlockState(blocks: BlockItem[]): void {
  for (const block of blocks) {
    block.isConflict = false;
    block.conflicts = [];
  }
}

function groupBlocksByRegion(sortedBlocks: BlockItem[]): {
  blocksByRegion: Map<number, BlockItem[]>;
  positionInRegion: Map<BlockItem, number>;
} {
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

  return { blocksByRegion, positionInRegion };
}

function hasValidBlockBounds(block: BlockItem): boolean {
  return (
    Number.isFinite(Number(block.end)) &&
    Number.isFinite(Number(block.startAddr)) &&
    Number.isFinite(Number(block.endAddr))
  );
}

function getBlockKey(block: BlockItem): string {
  return block.rawObj?.rawId || block.magicId;
}

function addConflictPair(conflictMap: Map<any, Set<any>>, a: BlockItem, b: BlockItem): void {
  const aKey = getBlockKey(a);
  const bKey = getBlockKey(b);
  if (!conflictMap.has(aKey)) {
    conflictMap.set(aKey, new Set());
  }
  if (!conflictMap.has(bKey)) {
    conflictMap.set(bKey, new Set());
  }
  conflictMap.get(aKey).add(b.magicId);
  conflictMap.get(bKey).add(a.magicId);
}

function pushOverlapIfDifferent(
  a: BlockItem,
  b: BlockItem,
  overlapList: ConflictOverlap[],
  aRegionId: number,
): void {
  const aName = a.name;
  const sameName = (aName && aName === b.name) || (!aName && !b.name);
  if (sameName) {
    return;
  }
  overlapList.push({
    x1: Math.max(Number(a.start), Number(b.start)),
    y1: Math.max(Number(a.startAddr), Number(b.startAddr)),
    x2: Math.min(Number(a.end), Number(b.end)),
    y2: Math.min(Number(a.endAddr), Number(b.endAddr)),
    tensors: [a.magicId || 'Anonymous', b.magicId || 'Anonymous'],
    regionId: aRegionId,
  });
}

function checkConflictsInBlock(
  a: BlockItem,
  blocksByRegion: Map<number, BlockItem[]>,
  positionInRegion: Map<BlockItem, number>,
  conflictMap: Map<any, Set<any>>,
  overlapList: ConflictOverlap[],
): void {
  const aEnd = Number(a.end);
  const aStartAddr = Number(a.startAddr);
  const aEndAddr = Number(a.endAddr);
  const aRegionId = Number(a.regionId);
  const regionBlocks = blocksByRegion.get(aRegionId);
  const regionPosition = positionInRegion.get(a);

  if (!hasValidBlockBounds(a) || !regionBlocks || regionPosition === undefined) {
    return;
  }

  for (let j = regionPosition + 1; j < regionBlocks.length; j++) {
    const b = regionBlocks[j];
    const bStart = Number(b.start);

    if (!Number.isFinite(bStart) || bStart >= aEnd) {
      break;
    }

    if (!hasValidBlockBounds(b)) {
      continue;
    }

    if (aStartAddr >= Number(b.endAddr) || Number(b.startAddr) >= aEndAddr) {
      continue;
    }

    a.isConflict = true;
    b.isConflict = true;
    addConflictPair(conflictMap, a, b);
    pushOverlapIfDifferent(a, b, overlapList, aRegionId);
  }
}

function assignConflictLists(blocks: BlockItem[], conflictMap: Map<any, Set<any>>): void {
  for (const block of blocks) {
    const key = block.rawObj?.rawId || block.name;
    const c = conflictMap.get(key);
    if (c) {
      block.conflicts = Array.from(c);
    }
  }
}
