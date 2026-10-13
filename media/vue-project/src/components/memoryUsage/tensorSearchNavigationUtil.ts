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
export type NumericRange = {
  min: number;
  max: number;
};

type TensorItem = Record<string, any>;
type RegionItem = Record<string, any>;

export class TensorSearchNavigationUtil {
  static normalizeQuery(query: string) {
    return String(query || '').trim().toLowerCase();
  }

  static isTensorMatchedBySearch(item: TensorItem, query: string) {
    const q = this.normalizeQuery(query);

    if (!q) {
      return false;
    }

    return String(item.magicId || '').toLowerCase().includes(q);
  }

  static getTensorSearchKey(item: TensorItem) {
    return [
      item.magicId || '',
      item.start,
      item.end,
      item.startAddr,
      item.endAddr,
    ].join('_');
  }

  static getTensorIdentity(item: TensorItem) {
    const tensor = item.rawObj || item;
    const values = [tensor?.instanceId, tensor?.rawId, tensor?.base, tensor?.end, tensor?.lifeStart, tensor?.lifeEnd];
    if (!values.some((value) => value !== undefined && value !== null && String(value) !== '')) {
      return '';
    }

    return values.map((value) => (value === undefined || value === null ? '' : String(value))).join('|');
  }

  static getSearchMatchedItems(memoryBlocksRaw: TensorItem[], query: string) {
    const q = this.normalizeQuery(query);

    if (!q) {
      return [];
    }

    return memoryBlocksRaw.filter((item) =>
      this.isTensorMatchedBySearch(item, q),
    );
  }

  static getSelectedSearchItem(
    memoryBlocksRaw: TensorItem[],
    query: string,
    selectedSearchIndex: number,
  ) {
    const results = this.getSearchMatchedItems(memoryBlocksRaw, query);

    if (!results.length) {
      return null;
    }

    const safeIndex = Math.min(selectedSearchIndex, results.length - 1);

    return results[safeIndex] || null;
  }

  static toChartDataRow(
    item: TensorItem,
    options: {
      formatRawShape: (shape: unknown) => string;
      isSearchMatched?: boolean;
      isSearchActive?: boolean;
      isSearchSelected?: boolean;
    },
  ) {
    return [
      item.name || '',
      item.start,
      item.end,
      item.startAddr,
      item.endAddr,
      item.category || '',
      item.styleType || '',
      item.magicId || '',
      item.size || '',
      item.addressRange || '',
      options.formatRawShape(item.rawObj?.rawShape),
      item.duration || '',
      item.startTime || '',
      item.endTime || '',
      item.isConflict ? 1 : 0,
      item.conflicts ? item.conflicts.join(', ') : '',
      item.conflictOffset || '',
      item.rawObj || null,
      options.isSearchMatched ? 1 : 0, // 18
      options.isSearchActive ? 1 : 0, // 19
      options.isSearchSelected ? 1 : 0, // 20
      this.getTensorIdentity(item), // 21
    ];
  }

  static createSearchResultData(
    memoryBlocksRaw: TensorItem[],
    query: string,
    formatRawShape: (shape: unknown) => string,
  ) {
    const matchedItems = this.getSearchMatchedItems(memoryBlocksRaw, query);

    return matchedItems.map((item) =>
      this.toChartDataRow(item, {
        formatRawShape,
        isSearchMatched: true,
        isSearchActive: true,
        isSearchSelected: false,
      }),
    );
  }

  static createChartData(
    memoryBlocksRaw: TensorItem[],
    query: string,
    selectedSearchIndex: number,
    formatRawShape: (shape: unknown) => string,
  ) {

    const q = this.normalizeQuery(query);
    const isSearchActive = !!q;

    const selectedItem = this.getSelectedSearchItem(
      memoryBlocksRaw,
      q,
      selectedSearchIndex,
    );
    
    const selectedKey = selectedItem
    ? this.getTensorSearchKey(selectedItem)
    : null;
    
    return memoryBlocksRaw.map((item) => {
      const isSearchMatched = this.isTensorMatchedBySearch(item, q);

      const isSearchSelected =
        isSearchActive &&
        !!selectedKey &&
        this.getTensorSearchKey(item) === selectedKey;

      return this.toChartDataRow(item, {
        formatRawShape,
        isSearchMatched,
        isSearchActive,
        isSearchSelected,
      });
    });
  }

  static getFullXAxisRange(
    memoryBlocksRaw: TensorItem[],
    fallback: NumericRange,
  ): NumericRange {
    if (!memoryBlocksRaw.length) {
      return fallback;
    }

    let min = Infinity;
    let max = -Infinity;

    memoryBlocksRaw.forEach((item) => {
      min = Math.min(min, Number(item.start));
      max = Math.max(max, Number(item.end));
    });

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return fallback;
    }

    return { min, max };
  }

  static getFullYAxisRange(
    layoutRegions: RegionItem[],
    fallback: NumericRange,
  ): NumericRange {
    if (!layoutRegions.length) {
      return fallback;
    }

    let min = Infinity;
    let max = -Infinity;

    layoutRegions.forEach((region) => {
      min = Math.min(min, Number(region.yStart));
      max = Math.max(max, Number(region.yEnd));
    });

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return fallback;
    }

    return { min, max };
  }

  static clampVisibleRange(
    center: number,
    currentSize: number,
    fullMin: number,
    fullMax: number,
  ): NumericRange {
    const fullSize = fullMax - fullMin;

    if (
      !Number.isFinite(center) ||
      !Number.isFinite(currentSize) ||
      currentSize <= 0
    ) {
      return {
        min: fullMin,
        max: fullMax,
      };
    }

    if (currentSize >= fullSize) {
      return {
        min: fullMin,
        max: fullMax,
      };
    }

    let nextMin = center - currentSize / 2;
    let nextMax = center + currentSize / 2;

    if (nextMin < fullMin) {
      nextMin = fullMin;
      nextMax = fullMin + currentSize;
    }

    if (nextMax > fullMax) {
      nextMax = fullMax;
      nextMin = fullMax - currentSize;
    }

    return {
      min: nextMin,
      max: nextMax,
    };
  }

  static isValueInsideRange(value: number, min: number, max: number) {
    return value >= min && value <= max;
  }

  static getNavigationRangesForTensor(options: {
    selectedItem: TensorItem | null;
    visibleXRange: NumericRange;
    visibleYRange: NumericRange;
    fullXRange: NumericRange;
    fullYRange: NumericRange;
  }) {
    const {
      selectedItem,
      visibleXRange,
      visibleYRange,
      fullXRange,
      fullYRange,
    } = options;

    if (!selectedItem) {
      return null;
    }

    const currentXSize = visibleXRange.max - visibleXRange.min;
    const currentYSize = visibleYRange.max - visibleYRange.min;

    const tensorXMin = Number(selectedItem.start);
    const tensorXMax = Number(selectedItem.end);
    const tensorYMin = Number(selectedItem.startAddr);
    const tensorYMax = Number(selectedItem.endAddr);

    if (
      !Number.isFinite(tensorXMin) ||
      !Number.isFinite(tensorXMax) ||
      !Number.isFinite(tensorYMin) ||
      !Number.isFinite(tensorYMax)
    ) {
      return null;
    }

    const tensorCenterX = (tensorXMin + tensorXMax) / 2;
    const tensorCenterY = (tensorYMin + tensorYMax) / 2;

    const shouldMoveX = !this.isValueInsideRange(
      tensorCenterX,
      visibleXRange.min,
      visibleXRange.max,
    );

    const shouldMoveY = !this.isValueInsideRange(
      tensorCenterY,
      visibleYRange.min,
      visibleYRange.max,
    );

    if (!shouldMoveX && !shouldMoveY) {
      return null;
    }

    const nextXRange = shouldMoveX
      ? this.clampVisibleRange(
          tensorCenterX,
          currentXSize,
          fullXRange.min,
          fullXRange.max,
        )
      : visibleXRange;

    const nextYRange = shouldMoveY
      ? this.clampVisibleRange(
          tensorCenterY,
          currentYSize,
          fullYRange.min,
          fullYRange.max,
        )
      : visibleYRange;

    return {
      xRange: nextXRange,
      yRange: nextYRange,
      shouldMoveX,
      shouldMoveY,
    };
  }
}
