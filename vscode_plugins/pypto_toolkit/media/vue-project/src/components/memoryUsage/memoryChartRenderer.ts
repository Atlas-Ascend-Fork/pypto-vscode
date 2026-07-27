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
  getFilteredResultsCount: () => number;
  getIsDarkTheme: () => boolean;
  tensorColorMap: TensorColorMap;
  patternCache: PatternCache;
};

type MemoryChartRenderers = {
  renderItem: (params: ChartRenderParams, api: ChartRenderApi) => ChartGraphic;
  renderOverlapItem: (params: ChartRenderParams, api: ChartRenderApi) => ChartGraphic;
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
      const fill = currentFill === 2 ? (isDarkTheme ? '#8a1a1a' : '#e53935') : isDarkTheme ? '#075238' : '#2e7d32';

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

export const createMemoryChartRenderers = ({
  getSelectedNode,
  getFilteredResultsCount,
  getIsDarkTheme,
  tensorColorMap,
  patternCache,
}: MemoryChartRendererOptions): MemoryChartRenderers => {
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

  const getTensorBorderStyle = (isSelected: boolean, isSearchActive: boolean) => {
    if (isSelected && !isSearchActive) {
      return {
        strokeColor: '#ffffff',
        lineWidth: 2,
        shadowBlur: 2,
        shadowColor: '#ffffff',
      };
    }

    return {
      strokeColor: 'transparent',
      lineWidth: 0,
      shadowBlur: 0,
      shadowColor: 'transparent',
    };
  };

  const getTensorRenderState = (api: ChartRenderApi) => {
    const isSelected = Boolean(getSelectedNode()?.tensors?.some((entry) => entry.rawTensor === api.value(17)));
    const isSearchActive = Number(api.value(19)) === 1;
    const isSearchMatched = Number(api.value(18)) === 1;
    const hasSearchResults = getFilteredResultsCount() > 0;
    const isDimmedBySearch = isSearchActive && hasSearchResults;
    const magicId = String(api.value(7) || '');
    const originalColor = tensorColorMap[magicId]?.base || '#574096';

    return {
      styleType: api.value(6),
      magicId,
      isSearchActive,
      isSearchMatched,
      hasSearchResults,
      baseColor: isDimmedBySearch ? 'rgba(130, 130, 130, 0.55)' : originalColor,
      rectOpacity: isDimmedBySearch ? 0.35 : 0.8,
      borderStyle: getTensorBorderStyle(isSelected, isSearchActive),
    };
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

  const createTensorChildren = (
    rectShape: ChartRect,
    width: number,
    height: number,
    api: ChartRenderApi,
    state: ReturnType<typeof getTensorRenderState>,
  ): ChartGraphic[] => {
    const { styleType, magicId, isSearchActive, isSearchMatched, hasSearchResults, baseColor, rectOpacity, borderStyle } = state;
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
      children.push({
        type: 'text',
        silent: true,
        z: 100,
        style: {
          x: rectShape.x + rectShape.width / 2,
          y: rectShape.y + rectShape.height / 2,
          text: `magicID: ${magicId || '-'} rawShape: ${api.value(10) || '-'}`,
          fill: getIsDarkTheme() ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.7)',
          fontSize: 10,
          lineHeight: 14,
          textAlign: 'center',
          textVerticalAlign: 'middle',
          width: Math.max(rectShape.width - textPadding * 2, 0),
          height: Math.max(rectShape.height - textPadding * 2, 0),
          overflow: 'truncate',
          lineOverflow: 'truncate',
          ellipsis: '...',
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

  return { renderItem, renderOverlapItem };
};
