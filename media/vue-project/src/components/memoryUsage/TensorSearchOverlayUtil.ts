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
import * as echarts from 'echarts';

type Nullable<T> = T | null;

type ChartGridRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TensorItem = Record<string, any>;

type TensorColorMap = Record<
  string,
  {
    base?: string;
    light?: string;
  }
>;

type PatternCache = {
  reg?: CanvasPattern | string | null;
};

type SearchOverlayOptions = {
  chart: any;
  currentOverlay: any;
  searchQuery: string;
  selectedItem: Nullable<TensorItem>;
  tensorColorMap: TensorColorMap;
  patternCache: PatternCache;
};

export class TensorSearchOverlayUtil {
  static getChartGridRect(chart: any): Nullable<ChartGridRect> {
    if (!chart || typeof chart.getModel !== 'function') {
      return null;
    }

    const gridModel = chart.getModel().getComponent('grid', 0);
    const coordSys = gridModel?.coordinateSystem;

    if (coordSys?.getRect) {
      const rect = coordSys.getRect();

      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }

    if (
      coordSys &&
      Number.isFinite(coordSys.x) &&
      Number.isFinite(coordSys.y) &&
      Number.isFinite(coordSys.width) &&
      Number.isFinite(coordSys.height)
    ) {
      return {
        x: coordSys.x,
        y: coordSys.y,
        width: coordSys.width,
        height: coordSys.height,
      };
    }

    return null;
  }

  static clearOverlay(chart: any, overlay: any) {
    if (!chart || !overlay) {
      return null;
    }

    chart.getZr().remove(overlay);

    return null;
  }

  static getTensorRectShape(chart: any, item: TensorItem) {
    if (!chart || !item) {
      return null;
    }

    const gridRect = this.getChartGridRect(chart);

    if (!gridRect) {
      return null;
    }

    const startX = Number(item.start);
    const endX = Number(item.end);
    const startY = Number(item.startAddr);
    const endY = Number(item.endAddr);

    if (
      !Number.isFinite(startX) ||
      !Number.isFinite(endX) ||
      !Number.isFinite(startY) ||
      !Number.isFinite(endY)
    ) {
      return null;
    }

    const startPos = chart.convertToPixel(
      {
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
      [startX, startY],
    );

    const endPos = chart.convertToPixel(
      {
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
      [endX, endY],
    );

    if (
      !startPos ||
      !endPos ||
      !Number.isFinite(startPos[0]) ||
      !Number.isFinite(startPos[1]) ||
      !Number.isFinite(endPos[0]) ||
      !Number.isFinite(endPos[1])
    ) {
      return null;
    }

    let width = Math.abs(endPos[0] - startPos[0]);
    let height = Math.abs(endPos[1] - startPos[1]);

    if (width < 2) {
      width = 2;
    }

    if (height < 2) {
      height = 2;
    }

    const left = Math.min(startPos[0], endPos[0]);
    const top = Math.min(startPos[1], endPos[1]);

    return echarts.graphic.clipRectByRect(
      {
        x: left,
        y: top,
        width,
        height,
      },
      gridRect,
    );
  }

  static createSearchFocusOverlay(options: {
    chart: any;
    selectedItem: TensorItem;
    tensorColorMap: TensorColorMap;
    patternCache: PatternCache;
  }) {
    const { chart, selectedItem, tensorColorMap, patternCache } = options;

    const rectShape = this.getTensorRectShape(chart, selectedItem);

    if (!rectShape) {
      return null;
    }

    const magicId =
      selectedItem.magicId ||
      selectedItem.rawObj?.rawmagic ||
      '';

    const styleType = selectedItem.styleType || '';
    const baseColor = tensorColorMap[magicId]?.base || '#574096';

    const r = rectShape.width > 12 && rectShape.height > 12 ? 4 : 0;

    const group = new echarts.graphic.Group({
      silent: true,
      z: 125,
    });

    group.add(
      new echarts.graphic.Rect({
        silent: true,
        z: 125,
        shape: {
          ...rectShape,
          r,
        },
        style: {
          fill: baseColor,
          stroke: 'transparent',
          lineWidth: 0,
          shadowBlur: 0,
          shadowColor: 'transparent',
          opacity: 0.95,
        },
      }),
    );

    if (styleType === 'striped' && patternCache.reg) {
      group.add(
        new echarts.graphic.Rect({
          silent: true,
          z: 126,
          shape: {
            ...rectShape,
            r,
          },
          style: {
            fill: patternCache.reg,
            opacity: 0.2,
          },
        }),
      );
    }

    return group;
  }

  static updateSearchFocusOverlay(options: SearchOverlayOptions) {
    const {
      chart,
      currentOverlay,
      searchQuery,
      selectedItem,
      tensorColorMap,
      patternCache,
    } = options;

    const clearedOverlay = this.clearOverlay(chart, currentOverlay);

    if (!chart) {
      return clearedOverlay;
    }

    const q = String(searchQuery || '').trim();

    if (!q || !selectedItem) {
      return clearedOverlay;
    }

    const nextOverlay = this.createSearchFocusOverlay({
      chart,
      selectedItem,
      tensorColorMap,
      patternCache,
    });

    if (!nextOverlay) {
      return clearedOverlay;
    }

    chart.getZr().add(nextOverlay);

    return nextOverlay;
  }
}