/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import * as echarts from 'echarts';
import type { ConflictOverlap } from './memoryConflictDetection';

type MinimapRect = {
  y: number;
  height: number;
  fill: string;
};

type ChartRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ChartRenderParams = {
  coordSys: ChartRect;
};

type ChartRenderApi = {
  coord: (data: unknown[]) => number[];
  value: (index: number) => unknown;
};

type ChartGraphic = {
  type: string;
  children?: ChartGraphic[];
  [key: string]: unknown;
};

type TensorColorMap = Record<string, { base?: string; light?: string }>;

type PatternFill = string | CanvasPattern | { image: HTMLCanvasElement; repeat: 'repeat' } | null;

type PatternCache = {
  B: PatternFill;
  reg: PatternFill;
  stripe: PatternFill;
};

type SelectedNode = {
  tensors?: Array<{ rawTensor?: unknown }>;
} | null;

type MemoryChartRendererOptions = {
  getSelectedNode: () => SelectedNode;
  getMeasuredTensors: () => unknown[];
  getMeasurementHighlightTensors: () => unknown[];
  getFilteredResultsCount: () => number;
  getIsDarkTheme: () => boolean;
  tensorColorMap: TensorColorMap;
  patternCache: PatternCache;
};

type MemoryChartRenderers = {
  renderItem: (params: ChartRenderParams, api: ChartRenderApi) => ChartGraphic;
  renderOverlapItem: (params: ChartRenderParams, api: ChartRenderApi) => ChartGraphic;
  renderMeasurementItem: (params: ChartRenderParams, api: ChartRenderApi) => ChartGraphic;
};

const getTensorIdentity = (tensor: any): string => {
  const rawTensor = tensor?.rawObj || tensor;
  const values = [rawTensor?.instanceId, rawTensor?.rawId, rawTensor?.base, rawTensor?.end, rawTensor?.lifeStart, rawTensor?.lifeEnd];
  if (!values.some((value) => value !== undefined && value !== null && String(value) !== '')) {
    return '';
  }

  return values.map((value) => (value === undefined || value === null ? '' : String(value))).join('|');
};

const isSameTensor = (first: any, second: any): boolean => {
  if (first === second) {
    return true;
  }

  const firstIdentity = getTensorIdentity(first);
  return Boolean(firstIdentity) && firstIdentity === getTensorIdentity(second);
};

export const createMinimapRects = (maxY: number, overlaps: ConflictOverlap[], isDarkTheme: boolean): MinimapRect[] => {
  if (!maxY || maxY <= 0) {
    return [];
  }

  const virtualHeightPx = 440;
  const mbPerPixel = maxY / virtualHeightPx;
  const pixelGrid = new Array(virtualHeightPx).fill(0);
  const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
  const addrToPixelIdx = (addr: number): number => clamp(Math.floor(addr / mbPerPixel), 0, virtualHeightPx - 1);

  overlaps.forEach((overlap) => {
    const startIdx = addrToPixelIdx(overlap.y1);
    const endIdx = addrToPixelIdx(overlap.y2);

    for (let i = startIdx; i <= endIdx; i++) {
      pixelGrid[i] = 2;
    }
  });

  const rects: MinimapRect[] = [];
  let currentFill: number | null = null;
  let startPixel = 0;

  for (let i = 0; i <= virtualHeightPx; i++) {
    const pixelVal = i < virtualHeightPx ? pixelGrid[i] : 0;

    if (currentFill === null) {
      if (pixelVal !== 0) {
        currentFill = pixelVal;
        startPixel = i;
      }
    } else if (pixelVal !== currentFill) {
      const pixelLength = i - startPixel;
      const y = (startPixel / virtualHeightPx) * 100;
      const height = (pixelLength / virtualHeightPx) * 100;
      let fill = isDarkTheme ? '#075238' : '#2e7d32';
      if (currentFill === 2) {
        fill = isDarkTheme ? '#8a1a1a' : '#e53935';
      }

      rects.push({ y, height, fill });

      if (pixelVal !== 0) {
        currentFill = pixelVal;
        startPixel = i;
      } else {
        currentFill = null;
      }
    }
  }

  return rects;
};

export const createConflictPattern = (): NonNullable<PatternFill> => {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d')!;
  context.strokeStyle = 'rgba(231, 67, 74, 0.35)';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(0, 12);
  context.lineTo(12, 0);
  context.stroke();
  return { image: canvas, repeat: 'repeat' };
};

const shouldRenderTensorLabel = (
  width: number,
  height: number,
  isSearchActive: boolean,
  isSearchMatched: boolean,
  hasSearchResults: boolean,
): boolean => {
  if (width <= 50 || height <= 24) {
    return false;
  }
  if (!isSearchActive) {
    return true;
  }
  return isSearchMatched || !hasSearchResults;
};

const getTensorGeometry = (params: ChartRenderParams, api: ChartRenderApi) => {
  const startPos = api.coord([api.value(1), api.value(3)]);
  const endPos = api.coord([api.value(2), api.value(4)]);
  const width = Math.max(Math.abs(endPos[0] - startPos[0]), 2);
  const height = Math.max(Math.abs(endPos[1] - startPos[1]), 2);

  return {
    width,
    height,
    rectShape: echarts.graphic.clipRectByRect(
      {
        x: Math.min(startPos[0], endPos[0]),
        y: Math.min(startPos[1], endPos[1]),
        width,
        height,
      },
      params.coordSys,
    ),
  };
};

const getTensorBorderStyle = (isSelected: boolean, isSearchActive: boolean, isMeasurementSelected: boolean, getIsDarkTheme) => {
  if (isMeasurementSelected) {
    return {
      stroke: getIsDarkTheme() ? '#2f80ed' : '#0a59f7',
      lineWidth: 2,
      shadowBlur: 4,
      shadowColor: getIsDarkTheme() ? 'rgba(47, 128, 237, 0.55)' : 'rgba(10, 89, 247, 0.4)',
    };
  }

  if (isSelected && !isSearchActive) {
    return {
      stroke: '#ffffff',
      lineWidth: 2,
      shadowBlur: 2,
      shadowColor: '#ffffff',
    };
  }

  return {
    stroke: 'transparent',
    lineWidth: 0,
    shadowBlur: 0,
    shadowColor: 'transparent',
  };
};

const getFillcolor = (isMeasurementHighlighted, isDimmed, getIsDarkTheme) => {
  if(isMeasurementHighlighted) {
    return '#232631';
  } else {
    if(isDimmed) {
      return getIsDarkTheme() ? 'rgba(180, 180, 186, 0.7)' : 'rgba(82, 82, 88, 0.65)';
    } else {
      return getIsDarkTheme() ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.7)';
    }
  }
}

const createTensorRenderer = ({
  getSelectedNode,
  getMeasuredTensors,
  getMeasurementHighlightTensors,
  getFilteredResultsCount,
  getIsDarkTheme,
  tensorColorMap,
  patternCache,
}: MemoryChartRendererOptions): MemoryChartRenderers['renderItem'] => {
  const getTensorRenderState = (api: ChartRenderApi) => {
    const measurementHighlightTensors = getMeasurementHighlightTensors();
    const isMeasurementModeActive = measurementHighlightTensors.length > 0;
    const tensor = api.value(17);
    const chartTensorIdentity = String(api.value(21) || '');
    const isSameRenderedTensor = (entry: any): boolean => {
      return chartTensorIdentity ? getTensorIdentity(entry) === chartTensorIdentity : isSameTensor(entry, tensor);
    };
    const measuredTensors = getMeasuredTensors();
    const isMeasurementSelected = (isMeasurementModeActive ? measuredTensors.slice(0, 1) : measuredTensors).some(isSameRenderedTensor);
    const isMeasurementHighlighted = measurementHighlightTensors.some(isSameRenderedTensor);
    const isSelected =
      isMeasurementSelected || Boolean(getSelectedNode()?.tensors?.some((entry) => isSameRenderedTensor(entry.rawTensor)));
    const isSearchActive = Number(api.value(19)) === 1;
    const isSearchMatched = Number(api.value(18)) === 1;
    const hasSearchResults = getFilteredResultsCount() > 0;
    const isDimmedBySearch = isSearchActive && hasSearchResults;
    const magicId = String(api.value(7) || '');
    const originalColor = tensorColorMap[magicId]?.base || '#574096';
    const isDimmedByMeasurement = isMeasurementModeActive && !isMeasurementHighlighted;
    const isDimmed = isDimmedByMeasurement || isDimmedBySearch;
    const highlightColor = getIsDarkTheme() ? 'rgba(196, 198, 212, 1)' : 'rgba(211, 212, 220, 1)';
    let baseColor = isDimmed ? 'rgba(130, 130, 130, 0.55)' : originalColor;
    let rectOpacity = isDimmed ? 0.35 : 0.8;
    if (isMeasurementHighlighted) {
      baseColor = highlightColor;
      rectOpacity = 0.9;
    }

    return {
      styleType: api.value(6),
      magicId,
      isSearchActive,
      isSearchMatched,
      hasSearchResults,
      isMeasurementHighlighted,
      isDimmed,
      baseColor,
      rectOpacity,
      borderStyle: getTensorBorderStyle(isSelected, isSearchActive, isMeasurementSelected, getIsDarkTheme),
    };
  };

  const createTensorChildren = (
    rectShape: ChartRect,
    width: number,
    height: number,
    api: ChartRenderApi,
    state: ReturnType<typeof getTensorRenderState>,
  ): ChartGraphic[] => {
    const {
      styleType,
      magicId,
      isSearchActive,
      isSearchMatched,
      hasSearchResults,
      isMeasurementHighlighted,
      isDimmed,
      baseColor,
      rectOpacity,
      borderStyle,
    } = state;
    const radius = width > 12 && height > 12 ? 4 : 0;
    const children: ChartGraphic[] = [];

    if (patternCache.stripe) {
      children.push({
        type: 'rect',
        shape: { ...rectShape, r: radius },
        style: { fill: patternCache.stripe, opacity: 0.35 },
      });
    }

    children.push({
      type: 'rect',
      shape: { ...rectShape, r: radius },
      style: {
        fill: baseColor,
        ...borderStyle,
        opacity: rectOpacity,
      },
    });

    if (shouldRenderTensorLabel(width, height, isSearchActive, isSearchMatched, hasSearchResults)) {
      const textPadding = 8;
      const shape = String(api.value(10) || '-');
      const text = isMeasurementHighlighted
        ? `{label|MagicID:} {value|${magicId || '-'}}  {label|Shape:} {value|${shape}}`
        : `MagicID: ${magicId || '-'} Shape: ${shape}`;
      children.push({
        type: 'text',
        silent: true,
        z: 100,
        style: {
          x: rectShape.x + rectShape.width / 2,
          y: rectShape.y + rectShape.height / 2,
          text,
          fill: getFillcolor(isMeasurementHighlighted, isDimmed, getIsDarkTheme),
          opacity: isDimmed ? 0.45 : 1,
          fontSize: isMeasurementHighlighted ? 12 : 10,
          fontWeight: isMeasurementHighlighted ? 500 : 400,
          lineHeight: 14,
          textAlign: 'center',
          textVerticalAlign: 'middle',
          width: Math.max(rectShape.width - textPadding * 2, 0),
          overflow: 'truncate',
          ellipsis: '...',
          rich: isMeasurementHighlighted
            ? {
              label: { fill: '#6f7280', fontSize: 12, fontWeight: 400 },
              value: { fill: '#232631', fontSize: 12, fontWeight: 500 },
            }
            : undefined,
        },
      });
    }

    if (styleType === 'striped' && patternCache.reg) {
      children.push({
        type: 'rect',
        shape: { ...rectShape, r: radius },
        style: {
          fill: patternCache.reg,
          opacity: 0.18,
        },
      });
    }

    return children;
  };

  const renderItem = (params: ChartRenderParams, api: ChartRenderApi): ChartGraphic => {
    const { width, height, rectShape } = getTensorGeometry(params, api);
    if (!rectShape) {
      return {
        type: 'group',
        children: [],
      };
    }

    return {
      type: 'group',
      silent: false,
      children: createTensorChildren(rectShape, width, height, api, getTensorRenderState(api)),
    };
  };

  return renderItem;
};

const createOverlapRenderer = (patternCache: PatternCache): MemoryChartRenderers['renderOverlapItem'] => {
  const renderOverlapItem = (params: ChartRenderParams, api: ChartRenderApi): ChartGraphic => {
    const p1 = api.coord([api.value(0), api.value(1)]);
    const p2 = api.coord([api.value(2), api.value(3)]);
    const width = Math.max(Math.abs(p2[0] - p1[0]), 5);
    const height = Math.max(Math.abs(p2[1] - p1[1]), 5);
    let overlapRect = echarts.graphic.clipRectByRect(
      { x: Math.min(p1[0], p2[0]), y: Math.min(p1[1], p2[1]), width, height },
      params.coordSys,
    );

    if (!overlapRect) {
      const grid = params.coordSys;
      const overlapLeft = Math.min(p1[0], p2[0]);
      const overlapTop = Math.min(p1[1], p2[1]);
      const overlapWidth = Math.abs(p2[0] - p1[0]);
      const overlapHeight = Math.abs(p2[1] - p1[1]);
      const widthOverlap = Math.min(overlapLeft + overlapWidth, grid.x + grid.width) - Math.max(overlapLeft, grid.x);
      const heightOverlap = Math.min(overlapTop + overlapHeight, grid.y + grid.height) - Math.max(overlapTop, grid.y);

      if (widthOverlap > 0 && heightOverlap > 0) {
        overlapRect = {
          x: Math.max(overlapLeft, grid.x),
          y: Math.max(overlapTop, grid.y),
          width: widthOverlap,
          height: heightOverlap,
        };
      }
    }

    if (!overlapRect) {
      return {
        type: 'group',
        children: [],
      };
    }

    overlapRect.width = Math.max(overlapRect.width, 1);
    overlapRect.height = Math.max(overlapRect.height, 1);
    return {
      type: 'group',
      cursor: 'default',
      children: [
        {
          type: 'rect',
          cursor: 'default',
          zIndex: 10,
          shape: { ...overlapRect, r: 0 },
          style: { fill: 'rgba(231, 67, 74, 0.7)', opacity: 0.4 },
        },
        {
          type: 'rect',
          cursor: 'default',
          zIndex: 11,
          shape: { ...overlapRect, r: 0 },
          style: { fill: patternCache.stripe || patternCache.B, opacity: 0.35 },
        },
        {
          type: 'rect',
          cursor: 'default',
          zIndex: 12,
          shape: { ...overlapRect, r: 0 },
          style: { fill: 'transparent', stroke: 'rgba(231, 67, 74, 1)', lineWidth: 1 },
        },
      ],
    };
  };

  return renderOverlapItem;
};

const createMeasurementRenderer = (getIsDarkTheme: () => boolean): MemoryChartRenderers['renderMeasurementItem'] => {
  const renderMeasurementItem = (params: ChartRenderParams, api: ChartRenderApi): ChartGraphic => {
    const lowerStart = Number(api.value(0));
    const lowerEnd = Number(api.value(1));
    const lowerBoundary = Number(api.value(3));
    const upperStart = Number(api.value(4));
    const upperEnd = Number(api.value(5));
    const upperBoundary = Number(api.value(6));
    const label = String(api.value(9) || '');

    if (
      !Number.isFinite(lowerStart) ||
      !Number.isFinite(lowerEnd) ||
      !Number.isFinite(lowerBoundary) ||
      !Number.isFinite(upperStart) ||
      !Number.isFinite(upperEnd) ||
      !Number.isFinite(upperBoundary) ||
      !label
    ) {
      return { type: 'group', children: []};
    }

    const overlapStart = Math.max(lowerStart, upperStart);
    const overlapEnd = Math.min(lowerEnd, upperEnd);
    const hasSharedLifetime = overlapStart < overlapEnd;
    let lowerXValue: number;
    let upperXValue: number;
    if (hasSharedLifetime) {
      lowerXValue = (overlapStart + overlapEnd) / 2;
      upperXValue = lowerXValue;
    } else if (lowerEnd <= upperStart) {
      lowerXValue = lowerEnd;
      upperXValue = upperStart;
    } else {
      lowerXValue = lowerStart;
      upperXValue = upperEnd;
    }
    const anchorXValue = hasSharedLifetime ? lowerXValue : (lowerXValue + upperXValue) / 2;

    const lowerPoint = api.coord([lowerXValue, lowerBoundary]);
    const upperPoint = api.coord([upperXValue, upperBoundary]);
    const lowerAnchor = api.coord([anchorXValue, lowerBoundary]);
    const upperAnchor = api.coord([anchorXValue, upperBoundary]);
    const points = [lowerPoint, upperPoint, lowerAnchor, upperAnchor];

    if (points.some((point) => !Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) {
      return { type: 'group', children: []};
    }

    const color = getIsDarkTheme() ? '#6ea8ff' : '#0a59f7';
    const arrowHalfWidth = 3;
    const arrowLength = 4;
    const labelWidth = Math.max(32, label.length * 5 + 8);
    const labelHeight = 15;
    const midX = (lowerAnchor[0] + upperAnchor[0]) / 2;
    const midY = (lowerAnchor[1] + upperAnchor[1]) / 2;
    const labelX = Math.max(
      params.coordSys.x + 4,
      Math.min(midX + 4, params.coordSys.x + params.coordSys.width - labelWidth - 4),
    );
    const labelY = Math.max(
      params.coordSys.y + 4,
      Math.min(midY - labelHeight / 2, params.coordSys.y + params.coordSys.height - labelHeight - 4),
    );
    const children: ChartGraphic[] = [];

    if (Math.abs(lowerPoint[0] - lowerAnchor[0]) > 0.5) {
      children.push({
        type: 'line',
        shape: { x1: lowerPoint[0], y1: lowerPoint[1], x2: lowerAnchor[0], y2: lowerAnchor[1] },
        style: { stroke: color, lineWidth: 1, lineDash: [4, 3]},
      });
    }

    if (Math.abs(upperPoint[0] - upperAnchor[0]) > 0.5) {
      children.push({
        type: 'line',
        shape: { x1: upperPoint[0], y1: upperPoint[1], x2: upperAnchor[0], y2: upperAnchor[1] },
        style: { stroke: color, lineWidth: 1, lineDash: [4, 3]},
      });
    }

    children.push({
      type: 'line',
      shape: { x1: lowerAnchor[0], y1: lowerAnchor[1], x2: upperAnchor[0], y2: upperAnchor[1] },
      style: { stroke: color, lineWidth: 1 },
    });

    const arrowDirection = upperAnchor[1] >= lowerAnchor[1] ? 1 : -1;
    children.push({
      type: 'polygon',
      shape: {
        points: [
          [lowerAnchor[0], lowerAnchor[1]],
          [lowerAnchor[0] - arrowHalfWidth, lowerAnchor[1] + arrowDirection * arrowLength],
          [lowerAnchor[0] + arrowHalfWidth, lowerAnchor[1] + arrowDirection * arrowLength],
        ],
      },
      style: { fill: color },
    });
    children.push({
      type: 'polygon',
      shape: {
        points: [
          [upperAnchor[0], upperAnchor[1]],
          [upperAnchor[0] - arrowHalfWidth, upperAnchor[1] - arrowDirection * arrowLength],
          [upperAnchor[0] + arrowHalfWidth, upperAnchor[1] - arrowDirection * arrowLength],
        ],
      },
      style: { fill: color },
    });
    children.push({
      type: 'rect',
      shape: { x: labelX, y: labelY, width: labelWidth, height: labelHeight, r: 2 },
      style: { fill: color },
    });
    children.push({
      type: 'text',
      style: {
        x: labelX + labelWidth / 2,
        y: labelY + labelHeight / 2,
        text: label,
        fill: '#ffffff',
        fontSize: 9,
        fontWeight: 500,
        textAlign: 'center',
        textVerticalAlign: 'middle',
      },
    });

    return { type: 'group', silent: true, z: 300, children };
  };

  return renderMeasurementItem;
};

export const createMemoryChartRenderers = (options: MemoryChartRendererOptions): MemoryChartRenderers => {
  return {
    renderItem: createTensorRenderer(options),
    renderOverlapItem: createOverlapRenderer(options.patternCache),
    renderMeasurementItem: createMeasurementRenderer(options.getIsDarkTheme),
  };
};
