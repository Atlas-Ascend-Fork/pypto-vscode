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
import { generateColorListExcludingReds } from './utils';
import { MemoryRegionLayoutUtil } from './memoryRegionLayoutUtil';
import { finishPerformanceStage, startPerformanceStage } from './memoryPerformance';

export function collectRawList(jsonData: any): any[] {
  const rawList: any[] = [];
  const rawTensors = jsonData.rawtensors || jsonData.rawTensors;

  if (Array.isArray(rawTensors)) {
    rawList.push(...rawTensors);
    return rawList;
  }

  if (!Array.isArray(jsonData.functions)) {
    return rawList;
  }

  jsonData.functions.forEach((f: any) => {
    const fRawTensors = f.rawtensors || f.rawTensors;

    if (Array.isArray(fRawTensors)) {
      rawList.push(...fRawTensors);
    }
  });

  return rawList;
}

export function getTensorMagicId(rawTensor: any, fallback = ''): string {
  const magicId = rawTensor?.rawmagic ?? rawTensor?.actual_rawmagic ?? fallback;
  return magicId === undefined || magicId === null ? '' : String(magicId);
}

export function findMemoryTensorsAtPoint(memoryBlocks: any[], x: number, y: number): any[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return [];
  }

  return memoryBlocks.filter((tensor) => {
    const start = Number(tensor?.start);
    const end = Number(tensor?.end);
    const startAddr = Number(tensor?.startAddr);
    const endAddr = Number(tensor?.endAddr);

    return (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      Number.isFinite(startAddr) &&
      Number.isFinite(endAddr) &&
      start <= x &&
      x < end &&
      startAddr <= y &&
      y < endAddr
    );
  });
}

function hasNonEmptyValue(value: any): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function toFiniteNumber(value: any): number | null {
  if (!hasNonEmptyValue(value)) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function hasValidRawShape(rawShape: any): boolean {
  return Array.isArray(rawShape) && rawShape.length > 0 && rawShape.every((dim) => toFiniteNumber(dim) !== null);
}

function hasValidOptionalLeafHash(rawTensor: any): boolean {
  const tensor = typeof rawTensor === 'object' && rawTensor !== null ? rawTensor : {};
  if (!('leafHash' in tensor) && !('leafhash' in tensor)) {
    return true;
  }

  return hasNonEmptyValue(tensor.leafHash ?? tensor.leafhash);
}

export function isValidMemoryTensor(rawTensor: any): boolean {
  const lifeStart = toFiniteNumber(rawTensor?.lifeStart);
  const lifeEnd = toFiniteNumber(rawTensor?.lifeEnd);

  return (
    lifeStart !== null &&
    lifeEnd !== null &&
    lifeStart < lifeEnd &&
    hasValidRawShape(rawTensor?.rawShape) &&
    hasNonEmptyValue(getTensorMagicId(rawTensor)) &&
    hasValidOptionalLeafHash(rawTensor)
  );
}

export function updateTensorColorMap(
  tensorColorMap: Record<string, { base: string; light: string }>,
  rawList: any[],
  isDark: boolean,
): void {
  Object.keys(tensorColorMap).forEach((key) => {
    delete tensorColorMap[key];
  });

  const magicIds = Array.from(new Set(rawList.map((rt, idx) => getTensorMagicId(rt, String(idx))).filter(Boolean)));
  const colors = generateColorListExcludingReds(magicIds.length, isDark);

  magicIds.forEach((magicId, idx) => {
    tensorColorMap[magicId] = {
      base: colors.baseColorList[idx] || '#574096',
      light: colors.lightColorList[idx] || '#765cb9',
    };
  });
}

export function buildParsedEntriesWithRegions(rawList: any[], jsonData: any, regionLayout: any): any[] {
  const regionMap = regionLayout.regionMap;
  const { meta } = jsonData;
  return rawList
    .map((item) => {
      if (!isValidMemoryTensor(item)) {
        return null;
      }

      const region = regionMap.get(Number(item.regionId));

      if (!region) {
        return null;
      }

      const base = Number(item.base);
      const end = Number(item.end);

      if (!Number.isFinite(base) || !Number.isFinite(end)) {
        return null;
      }

      const startAddr = MemoryRegionLayoutUtil.toRegionRelativeY(base, region);
      const endAddr = MemoryRegionLayoutUtil.toRegionRelativeY(end, region);

      const start = Number(toFiniteNumber(meta.timeUnit) ? (item.lifeStart - meta.t0) / meta.timeUnit : item.lifeStart);
      const finish = Number(toFiniteNumber(meta.timeUnit) ? (item.lifeEnd - meta.t0) / meta.timeUnit : item.lifeEnd);

      if (!Number.isFinite(start) || !Number.isFinite(finish)) {
        return null;
      }

      return {
        name: item.rawId || '',
        start,
        end: finish,
        startAddr,
        endAddr,
        category: item.memType || '',
        styleType: item.isWorkspace ? 'striped' : '',
        magicId: getTensorMagicId(item),
        size: item.size || '',
        addressRange: `${item.base} - ${item.end}`,
        shape: Array.isArray(item.rawShape) ? `[${item.rawShape.join(',')}]` : '',
        duration: finish - start,
        regionId: item.regionId,
        absoluteBase: item.base,
        absoluteEnd: item.end,
        rawObj: item,
      };
    })
    .filter(Boolean);
}

export function processIncomingData(
  memoryBlocksRaw: any[],
  overlaps: any[],
  tensorColorMap: Record<string, { base: string; light: string }>,
  viewState: any,
  timelineState: any,
  maxY: { value: number },
  jsonData: any,
  isDark: boolean,
): { minT: number; maxT: number; regionLayout: any } {
  memoryBlocksRaw.length = 0;
  overlaps.length = 0;

  if (!jsonData) {
    return { minT: 0, maxT: 18.0, regionLayout: { yMax: 0, regionMap: new Map(), regions: []}};
  }

  let stageStart = startPerformanceStage();
  const rawList = collectRawList(jsonData).filter(isValidMemoryTensor);
  finishPerformanceStage('tensorValidation', stageStart);

  stageStart = startPerformanceStage();
  updateTensorColorMap(tensorColorMap, rawList, isDark);
  finishPerformanceStage('colorGeneration', stageStart);

  if (rawList.length === 0) {
    maxY.value = 0;
    return { minT: 0, maxT: 18.0, regionLayout: { yMax: 0, regionMap: new Map(), regions: []}};
  }

  stageStart = startPerformanceStage();
  const regionLayout = MemoryRegionLayoutUtil.createRegionLayout(jsonData.meta.regions);
  finishPerformanceStage('regionLayout', stageStart);
  stageStart = startPerformanceStage();
  const parsed = buildParsedEntriesWithRegions(rawList, jsonData, regionLayout);
  finishPerformanceStage('tensorParsing', stageStart);

  maxY.value = regionLayout.yMax;

  stageStart = startPerformanceStage();
  for (let i = 0; i < parsed.length; i++) {
    memoryBlocksRaw.push(parsed[i]);
  }
  finishPerformanceStage('reactiveInsertion', stageStart);

  let minT = 0;
  let maxTime = 18.0;

  if (parsed.length > 0) {
    minT = Infinity;
    maxTime = -Infinity;
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      if (p.start < minT) {
        minT = p.start;
      }
      if (p.end > maxTime) {
        maxTime = p.end;
      }
    }
    const diff = maxTime - minT;
    maxTime = maxTime + Math.max(diff * 0.05, 0.5);
    minT = Math.max(0, minT);
  }

  viewState.minTime = minT;
  viewState.maxTime = maxTime;
  viewState.timeRange = maxTime - minT;

  timelineState.startTime = minT;
  timelineState.endTime = maxTime;
  timelineState.startTimeDecimal = minT;
  timelineState.endTimeDecimal = maxTime;

  maxY.value = regionLayout.yMax;

  return { minT, maxT: maxTime, regionLayout };
}

export function formatRawShape(rawShape: any): string {
  return Array.isArray(rawShape) ? `[${rawShape.join(',')}]` : '';
}
