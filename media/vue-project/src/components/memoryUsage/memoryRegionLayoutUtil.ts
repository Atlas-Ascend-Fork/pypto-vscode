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
export interface MemoryRegion {
  regionId: number;
  addr0: number;
  addrEnd: number;
  span?: number;
  occupiedBytes?: number;
  fill?: number;
  count?: number;
  totalBytes?: number;
  workspaceCount?: number;
  globalCount?: number;
}

export interface RegionLayoutItem {
  regionId: number;

  addr0: number;
  addrEnd: number;
  span: number;

  yStart: number;
  yEnd: number;
  visualHeight: number;

  memoryStart: number;
  memoryEnd: number;

  label: string;
  rawRegion: MemoryRegion;
}

export interface RegionLayoutResult {
  regionMap: Map<number, RegionLayoutItem>;
  regions: RegionLayoutItem[];
  yMin: number;
  yMax: number;
}

export class MemoryRegionLayoutUtil {
  static readonly DEFAULT_REGION_HEIGHT = 1000;
  static readonly DEFAULT_REGION_GAP = 250;

  static createRegionBackgroundData(layoutRegions: RegionLayoutItem[], xStart: number, xEnd: number): unknown[][] {
    return layoutRegions.map((region) => [region.label, xStart, xEnd, region.yStart, region.yEnd, region.regionId, region.span]);
  }
  static formatBytes(bytes: number): string {
    const value = Number(bytes);

    if (!Number.isFinite(value)) {
      return '';
    }

    if (Math.abs(value) >= 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    }

    if (Math.abs(value) >= 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    }

    return `${Math.round(value)} B`;
  }

  static formatRegionRelativeLabel(chartY: number, layoutRegions: RegionLayoutItem[]): string {
    const yValue = Number(chartY);

    if (!Number.isFinite(yValue)) {
      return '';
    }

    const region = MemoryRegionLayoutUtil.findRegionByY(yValue, layoutRegions);

    if (!region) {
      return '';
    }

    const relativeOffset = yValue - region.yStart;

    return MemoryRegionLayoutUtil.formatBytes(relativeOffset);
  }
  static formatCumulativeYAxisLabel(chartY: number, layoutRegions: RegionLayoutItem[]): string {
    const value = Number(chartY);

    if (!Number.isFinite(value)) {
      return '';
    }

    const region = layoutRegions.find((item) => {
      return value >= item.yStart && value <= item.yEnd;
    });

    if (!region) {
      return '';
    }

    const relativeInRegion = value - region.yStart;
    const cumulativeValue = region.memoryStart + relativeInRegion;

    return MemoryRegionLayoutUtil.formatBytes(cumulativeValue);
  }
  static createRegionLayout(
    regions: MemoryRegion[] = [],
    regionHeight: number = MemoryRegionLayoutUtil.DEFAULT_REGION_HEIGHT,
    regionGap: number = MemoryRegionLayoutUtil.DEFAULT_REGION_GAP,
  ): RegionLayoutResult {
    let chartCursor = 0;
    let memoryCursor = 0;

    const regionMap = new Map<number, RegionLayoutItem>();
    const layoutRegions: RegionLayoutItem[] = [];

    regions.forEach((region) => {
      const regionId = Number(region.regionId);
      const addr0 = Number(region.addr0);
      const addrEnd = Number(region.addrEnd);

      let span = Number(region.span);

      if (!Number.isFinite(span) || span <= 0) {
        span = addrEnd - addr0;
      }

      if (!Number.isFinite(regionId) || !Number.isFinite(addr0) || !Number.isFinite(addrEnd) || !Number.isFinite(span) || span <= 0) {
        return;
      }

      const yStart = chartCursor;
      const yEnd = chartCursor + regionHeight;

      const memoryStart = memoryCursor;
      const memoryEnd = memoryCursor + span;

      const layoutItem: RegionLayoutItem = {
        regionId,
        addr0,
        addrEnd,
        span,

        yStart,
        yEnd,
        visualHeight: regionHeight,

        memoryStart,
        memoryEnd,

        label: `Region ${regionId}`,
        rawRegion: region,
      };

      layoutRegions.push(layoutItem);
      regionMap.set(regionId, layoutItem);

      chartCursor = yEnd + regionGap;
      memoryCursor = memoryEnd;
    });

    const yMax = layoutRegions.length > 0 ? layoutRegions[layoutRegions.length - 1].yEnd : 1;

    return {
      regionMap,
      regions: layoutRegions,
      yMin: 0,
      yMax,
    };
  }

  static findRegionByY(yValue: number, layoutRegions: RegionLayoutItem[]): RegionLayoutItem | undefined {
    const value = Number(yValue);

    if (!Number.isFinite(value)) {
      return undefined;
    }

    return layoutRegions.find((region) => {
      return value >= region.yStart && value <= region.yEnd;
    });
  }
  static toRegionRelativeY(absoluteAddress: number, region: RegionLayoutItem): number {
    const address = Number(absoluteAddress);

    if (!Number.isFinite(address)) {
      return region.yStart;
    }

    const relative = address - region.addr0;
    const ratio = relative / region.span;

    const clampedRatio = Math.min(1, Math.max(0, ratio));

    return region.yStart + clampedRatio * region.visualHeight;
  }

  static toAbsoluteAddress(chartY: number, region: RegionLayoutItem): number {
    const yValue = Number(chartY);

    if (!Number.isFinite(yValue) || !Number.isFinite(region.visualHeight) || region.visualHeight <= 0) {
      return region.addr0;
    }

    const ratio = (yValue - region.yStart) / region.visualHeight;
    const clampedRatio = Math.min(1, Math.max(0, ratio));

    return region.addr0 + clampedRatio * region.span;
  }

  static toRegionRelativeOffset(chartY: number, region: RegionLayoutItem): number {
    return Number(chartY) - region.yStart;
  }
}
