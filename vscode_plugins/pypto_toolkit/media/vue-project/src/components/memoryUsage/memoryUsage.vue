<template>
  <div :style="{ height: isThreeColumn ? '100%' : '100vh' }" class="swim-global-container">
    <Loading v-if="loading" :loadingText="loadingText" />
    <DataError v-if="error" />
    <div
      v-if="!error && !loading"
      :style="{ display: 'flex', flexDirection: 'column', height: isSwimGraphActive && isThreeColumn ? 'calc(100% - 40px)' : '100%' }"
    >
      <div class="filter-toolbar">
        <div style="display: flex; align-items: center;">
          <div class="search-bar-container">
            <svg
              class="search-icon"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              stroke="currentColor"
              stroke-width="2.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" v-model="searchQuery" :placeholder="'Search'" class="search-input" />
            <div class="search-action-wrapper" v-if="searchQuery">
              <button class="search-clear-btn" @click="clearSearch" title="Clear Search">
                <svg
                  viewBox="0 0 24 24"
                  width="10"
                  height="10"
                  stroke="currentColor"
                  stroke-width="3"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          <div class="search-nav-container" v-if="searchQuery">
            <span class="search-results-count">{{ searchNavigationLabel }}</span>
            <div class="search-nav">
              <d-icon name="icon-arrow-left-l" class="search-nav-prev" :disabled="filteredResultsCount <= 1" @click.stop="goToPreviousSearchResult" style="font-size: 16px;"></d-icon>
              <d-icon name="icon-arrow-right-l" class="search-nav-next" :disabled="filteredResultsCount <= 1" @click.stop="goToNextSearchResult" style="font-size: 16px;"></d-icon>
            </div>
          </div>
        </div>
        <button class="reset-filters-btn" @click="resetFilters" title="Reset all filters">
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            stroke="currentColor"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 .49-4.9L1 10"></path>
          </svg>
        </button>
      </div>
      <div class="head-container" v-show="!loading" :style="{ display: 'flex', height: '60px', width: '100%' }">
        <div class="title" :style="{ width: layout.processLabelWidth + 'px' }" :class="{ 'title-threeColumn': isThreeColumn }"></div>

        <div class="right-header-content" :style="{ width: 'calc(100% - ' + layout.processLabelWidth + 'px)' }">
          <div class="swimlane-container" :class="{ mr16: !isGuidePage }" ref="swimlaneContainer">
            <swim-graph-timeline ref="timelineComponent" :hoverFlags="false" />
          </div>
          <swim-graph-config />
        </div>
      </div>

      <div class="memory-layout-main" v-show="!loading" :style="{ height: 'calc(100% - 80px)' }">
        <div class="minimap-visual-rail">
          <svg viewBox="0 0 80 100" preserveAspectRatio="none" class="minimap-svg">
            <rect
              v-for="(rect, idx) in minimapRects"
              :key="idx"
              x="5"
              :y="rect.y"
              width="70"
              :height="rect.height"
              :fill="rect.fill"
              rx="1"
            />
          </svg>
          <div class="minimap-dashed-line"></div>
        </div>
        <div class="chart-wrapper">
          <div ref="chartRef" class="echarts-container" :style="{ minHeight: minimumChartHeight + 'px' }"></div>
          <div
            v-if="manualTensorTooltipVisible"
            class="manual-tensor-tooltip"
            :style="manualTensorTooltipStyle"
            v-html="manualTensorTooltipHtml"
          ></div>
        </div>
      </div>
    </div>
    <MemoryUsageSidebar :selectedNode="selectedNode" @close="selectedNode = null" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick, inject, markRaw, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import * as echarts from 'echarts';
import SwimGraphTimeline from '../swimGraph/swimGraphTimeline/swimGraphTimeline.vue';
import SwimGraphConfig from '../swimGraph/swimGraphConfig/swimGraphConfig.vue';
import Loading from '../comGraph/loading.vue';
import MemoryUsageSidebar from './memoryUsageSidebar.vue';
import DataError from './dataError.vue';
import { useViewServer } from '@/core/use-view-server.ts';
import { devicePixelRatio, getCanvasCSSHeight, calculateGridInterval } from '../swimGraph/swimGraphUtils';
import { MemoryRegionLayoutUtil } from './memoryRegionLayoutUtil.ts';
import {
  regionHoverTemplate,
  tensorHoverTemplate,
  getDataZoomConfig,
  getxAxisConfig,
  getyAxisConfig,
  getVisibleXAxisRange,
  getVisibleYAxisRange,
  getRegionLayerVisibleYRange,
  ensureMinimumVisibleRatio,
} from './utils';
import { validateMemoryData } from './validateMemoryData';
import { createMemoryUsageChildContextMap, provideMemoryUsageSwimGraph } from './memoryUsageProvide';
import { TensorSearchNavigationUtil } from './tensorSearchNavigationUtil';
import { TensorSearchOverlayUtil } from './TensorSearchOverlayUtil';
import { processIncomingData, formatRawShape, isValidMemoryTensor, getTensorMagicId } from './memoryDataProcessor';
import { detectConflicts } from './memoryConflictDetection';

const props = defineProps({
  jsonContent: {
    type: Object,
    default: () => ({}),
  },
  memoryFileName: {
    type: String,
    default: '',
  },
  graphType: {
    type: String,
    default: '',
  },
  isThreeColumn: {
    type: Boolean,
    default: false,
  },
  filePaths: {
    type: Object,
    default: () => ({}),
  },
});

const NANOSECONDS_PER_MICROSECOND = 1000;
const MICROSECONDS_PER_SECOND = 1e6;
const MIN_REGION_HEIGHT_PX = 30;
const CHART_GRID_VERTICAL_PADDING_PX = 60;

const { server } = useViewServer();
const { isDarkTheme } = inject('root', ref(true));
const { t: $t } = useI18n();
const isGuidePage = ref(false);
const error = ref(false);

watch(isDarkTheme, () => {
  if (myChart) {
    myChart.setOption(getChartOption());
  }
  renderFixedTimeline();
  renderTwoTimeline();
});

const timelineComponent = ref(null);
const loading = ref(true);
const selectedSearchIndex = ref(0);
const labelRender = ref(true);
const loadingText = ref('Loading trace data...');
const processes = reactive({
  clear() {},
});
const manualTensorTooltipVisible = ref(false);
const manualTensorTooltipHtml = ref('');

const manualTensorTooltipStyle = reactive({
  left: '0px',
  top: '0px',
});
const isAicpu = ref(false);
const isE2ESwim = ref(false);
const isSwimGraphActive = ref(true);
const isPathLockStatus = ref(false);
const isMaxSchedule = ref(false);
const isMixMode = ref(false);
const timeLineX = ref(null);
const sliderValue = ref(0);
const sliderMax = ref(100);
const initialScale = ref(1);
const detailsPanelExpanded = ref(false);
const selectedEvent = ref(null);
const highlightedPaths = reactive(new Set());
const swimlaneContainer = ref(null);
const isMeasureModel = ref(false);
const mulDetailsExpanded = ref(false);
const isCfgEditing = ref(false);
const searchedEvent = ref(null);
const isPerfSwim = ref(false);
const isMsProf = ref(false);
const mixRelatedPaths = reactive(new Set());
const measureDetailsExpanded = ref(false);
const aicpuControlDetailsExpanded = ref(false);
const aicpuScheduleDetailsExpanded = ref(false);
const aicpuCoreDetailsExpanded = ref(false);
const hashOrderRending = ref('cubeMergeHashOrder');
const searchQuery = ref('');
const isCtrlDown = ref(false);
const debouncedSearchQuery = ref('');
const memoryBlocksRaw = reactive([]);
let timer = null;

const filteredResultsCount = computed(() => {
  return TensorSearchNavigationUtil.getSearchMatchedItems(memoryBlocksRaw, debouncedSearchQuery.value).length;
});

const searchNavigationLabel = computed(() => {
  const total = filteredResultsCount.value;

  if (!total) {
    return '0/0';
  }

  return `${selectedSearchIndex.value + 1}/${total}`;
});
const performSearch = () => {
  debouncedSearchQuery.value = searchQuery.value;
  selectedSearchIndex.value = 0;
  refreshSearchChart();
};
const selectedNode = shallowRef(null);
const chartRef = ref(null);
const maxY = ref(22);
const regionCount = ref(0);
const minimumChartHeight = computed(() => {
  if (regionCount.value <= 0) {
    return 0;
  }

  const regionHeight = MemoryRegionLayoutUtil.DEFAULT_REGION_HEIGHT;
  const regionGap = MemoryRegionLayoutUtil.DEFAULT_REGION_GAP;
  const layoutHeight = regionCount.value * regionHeight + (regionCount.value - 1) * regionGap;
  const minimumPlotHeight = (layoutHeight / regionHeight) * MIN_REGION_HEIGHT_PX;

  return Math.ceil(minimumPlotHeight + CHART_GRID_VERTICAL_PADDING_PX);
});

const minimapRects = computed(() => {
  if (!maxY.value || maxY.value <= 0) {
    return [];
  }

  const virtualHeightPx = 440;
  const mbPerPixel = maxY.value / virtualHeightPx;

  const pixelGrid = new Array(virtualHeightPx).fill(0);

  const MathClamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const addrToPixelIdx = (addr) => MathClamp(Math.floor(addr / mbPerPixel), 0, virtualHeightPx - 1);

  overlaps.value.forEach((overlap) => {
    const startIdx = addrToPixelIdx(overlap.y1);
    const endIdx = addrToPixelIdx(overlap.y2);

    for (let i = startIdx; i <= endIdx; i++) {
      pixelGrid[i] = 2;
    }
  });

  const rects = [];
  let currentFill = null;
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
      let fill;
      if (currentFill === 2) {
        fill = isDarkTheme.value ? '#8a1a1a' : '#e53935';
      } else {
        fill = isDarkTheme.value ? '#075238' : '#2e7d32';
      }

      rects.push({
        y,
        height,
        fill,
      });

      if (pixelVal !== 0) {
        currentFill = pixelVal;
        startPixel = i;
      } else {
        currentFill = null;
      }
    }
  }

  return rects;
});
let myChart = null;
let chartWheelDom = null;
let chartWheelHandler = null;
let currentMemoryData = null;
let isProgrammaticZoom = false;

const overlaps = ref([]);
const patternCache = { B: null, reg: null, stripe: null };

const buildConflictPattern = () => {
  const cvs = document.createElement('canvas');
  cvs.width = 16;
  cvs.height = 16;
  const ctx = cvs.getContext('2d');
  ctx.strokeStyle = 'rgba(231, 67, 74, 0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(12, 0);
  ctx.stroke();
  patternCache.B = { image: cvs, repeat: 'repeat' };
};
buildConflictPattern();
const getOverlapData = () => {
  return overlaps.value.map((o) => [o.x1, o.y1, o.x2, o.y2, o.tensors[0] || 'Anonymous', o.tensors[1] || 'Anonymous']);
};

const viewState = reactive({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  minTime: 0,
  maxTime: 18.0,
  timeRange: 18.0,
  canvasCssWidth: 0,
  canvasWidth: 0,
  clearInfo: {},
  windowWidth: window.innerWidth,
  depMode: 'all',
  scaleChange: 1,
  pixelOffsetX: 0,
  pixelScale: devicePixelRatio,
  offsetXChange: 0,
  minWidth: 1,
});

const layout = reactive({
  processLabelWidth: 180,
  eventHeight: 16,
  processHeaderHeight: 30,
  threadHeight: 24,
  counterHeight: 24,
  eventMargin: 2,
  processMargin: 5,
  marginRight: 10,
});

const result = detectConflicts(memoryBlocksRaw, searchQuery.value);
overlaps.value = result.overlaps;

const timelineState = reactive({
  startTime: 0,
  endTime: 18.0,
  startTimeX: 0,
  endTimeX: 0,
  isInLeftTag: false,
  isInRightTag: false,
  isOnTag: false,
  isOutTag: false,
  startTimeDecimal: 0,
  endTimeDecimal: 18.0,
});

const childContextMap = createMemoryUsageChildContextMap();

defineExpose({
  loading,
  labelRender,
  loadingText,
  processes,
});
const clearSearch = () => {
  searchQuery.value = '';
  debouncedSearchQuery.value = '';
  selectedSearchIndex.value = 0;

  clearSearchOverlays();

  if (myChart) {
    myChart.setOption({
      series: [
        {
          id: 'tensors',
          data: getChartData(),
        },
        {
          id: 'tensor-labels',
          data: getTensorLabelData(),
        },
      ],
    });
  }
};

const getChartData = () => {
  return TensorSearchNavigationUtil.createChartData(memoryBlocksRaw, debouncedSearchQuery.value, selectedSearchIndex.value, formatRawShape);
};

const navigateToSelectedSearchTensor = () => {
  if (!myChart) {
    return;
  }

  const selectedItem = getSelectedSearchItem();

  if (!selectedItem) {
    return;
  }

  const visibleXRange = getVisibleXAxisRange(myChart, timelineState);
  const visibleYRange = getVisibleYAxisRange(myChart, maxY.value);

  const fullXRange = TensorSearchNavigationUtil.getFullXAxisRange(memoryBlocksRaw, {
    min: timelineState.startTime,
    max: timelineState.endTime,
  });

  const fullYRange = TensorSearchNavigationUtil.getFullYAxisRange(currentLayoutRegions, {
    min: 0,
    max: maxY.value,
  });

  const nextRanges = TensorSearchNavigationUtil.getNavigationRangesForTensor({
    selectedItem,
    visibleXRange,
    visibleYRange,
    fullXRange,
    fullYRange,
  });

  if (!nextRanges) {
    return;
  }

  const xRange = ensureMinimumVisibleRatio(nextRanges.xRange, fullXRange, 0.2);

  const yRange = ensureMinimumVisibleRatio(nextRanges.yRange, fullYRange, 0.2);

  if (nextRanges.shouldMoveX) {
    syncTimelineViewStateFromRange(xRange.min, xRange.max, false);
    applyChartXAxisRange(xRange.min, xRange.max);
    renderTwoTimeline();
    timelineComponent.value?.flagRender();
  }

  if (nextRanges.shouldMoveY) {
    myChart.dispatchAction({
      type: 'dataZoom',
      batch: [
        {
          dataZoomId: 'y-inside',
          startValue: yRange.min,
          endValue: yRange.max,
        },
        {
          dataZoomId: 'y-slider',
          startValue: yRange.min,
          endValue: yRange.max,
        },
      ],
    });
  }
};

const applySearchSelection = () => {
  navigateToSelectedSearchTensor();

  requestAnimationFrame(() => {
    scheduleSearchOverlayUpdate();
  });
};
const isValueInsideRange = (value, min, max) => {
  return value >= min && value <= max;
};
const goToPreviousSearchResult = () => {
  const total = filteredResultsCount.value;

  if (!total) {
    return;
  }

  selectedSearchIndex.value = selectedSearchIndex.value <= 0 ? total - 1 : selectedSearchIndex.value - 1;

  applySearchSelection();
};

const goToNextSearchResult = () => {
  const total = filteredResultsCount.value;

  if (!total) {
    return;
  }

  selectedSearchIndex.value = selectedSearchIndex.value >= total - 1 ? 0 : selectedSearchIndex.value + 1;

  applySearchSelection();
};
const refreshSearchChart = () => {
  if (!myChart) {
    return;
  }

  const { overlaps: newOverlaps } = detectConflicts(memoryBlocksRaw, searchQuery.value);
  overlaps.value = newOverlaps;

  myChart.setOption({
    series: [{ data: getChartData() }, { data: getOverlapData() }, { data: getTensorLabelData() }],
  });
};

const getTensorSearchKey = (item) => {
  return [item.magicId || '', item.start, item.end, item.startAddr, item.endAddr].join('_');
};

const getSearchMatchedItems = () => {
  return TensorSearchNavigationUtil.getSearchMatchedItems(memoryBlocksRaw, debouncedSearchQuery.value);
};

const getSelectedSearchItem = () => {
  return TensorSearchNavigationUtil.getSelectedSearchItem(memoryBlocksRaw, debouncedSearchQuery.value, selectedSearchIndex.value);
};

const isTensorMatchedBySearch = (item, query) => {
  if (!query) {
    return false;
  }

  return String(item.magicId || '')
    .toLowerCase()
    .includes(query);
};

let searchDimOverlay = null;
let searchFocusOverlay = null;
let searchOverlayFrame = null;
const clearSearchOverlays = () => {
  searchFocusOverlay = TensorSearchOverlayUtil.clearOverlay(myChart, searchFocusOverlay);
};

const updateSearchOverlays = () => {
  searchFocusOverlay = TensorSearchOverlayUtil.updateSearchFocusOverlay({
    chart: myChart,
    currentOverlay: searchFocusOverlay,
    searchQuery: debouncedSearchQuery.value,
    selectedItem: getSelectedSearchItem(),
    tensorColorMap,
    patternCache,
  });
};

const scheduleSearchOverlayUpdate = () => {
  if (searchOverlayFrame !== null) {
    cancelAnimationFrame(searchOverlayFrame);
  }

  searchOverlayFrame = requestAnimationFrame(() => {
    updateSearchOverlays();
    searchOverlayFrame = null;
  });
};

const renderItem = (params, api) => {
  const name = api.value(0);
  const startX = api.value(1);
  const endX = api.value(2);
  const startY = api.value(3);
  const endY = api.value(4);

  const startPos = api.coord([startX, startY]);
  const endPos = api.coord([endX, endY]);

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

  let rectShape = echarts.graphic.clipRectByRect({ x: left, y: top, width, height }, params.coordSys);

  if (!rectShape) {
    return {
      type: 'group',
      children: [],
    };
  }

  const isSelected = selectedNode.value && selectedNode.value.name === name && selectedNode.value.startAddr === startY;
  const isSearchActive = Number(api.value(19)) === 1;
  const isDimmedBySearch = isSearchActive && filteredResultsCount.value;
  const styleType = api.value(6);
  const magicId = api.value(7);
  const originalColor = tensorColorMap[magicId]?.base || '#574096';
  const baseColor = isDimmedBySearch ? 'rgba(130, 130, 130, 0.55)' : originalColor;
  const rectOpacity = isDimmedBySearch ? 0.35 : 0.8;
  const children = [];
  let strokeColor = 'transparent';
  let lineWidth = 0;
  let shadowBlur = 0;
  let shadowColor = 'transparent';

  if (isSelected && !isSearchActive) {
    strokeColor = '#ffffff';
    lineWidth = 2;
    shadowBlur = 2;
    shadowColor = '#ffffff';
  }

  const r = width > 12 && height > 12 ? 4 : 0;

  if (patternCache.stripe) {
    children.push({
      type: 'rect',
      shape: { ...rectShape, r },
      style: { fill: patternCache.stripe, opacity: 0.35 },
    });
  }

  children.push({
    type: 'rect',
    shape: { ...rectShape, r },
    style: {
      fill: baseColor,
      stroke: strokeColor,
      lineWidth,
      shadowBlur,
      shadowColor,
      opacity: rectOpacity,
    },
  });
  if (styleType === 'striped' && patternCache.reg) {
    children.push({
      type: 'rect',
      shape: {
        ...rectShape,
        r: width > 12 && height > 12 ? 4 : 0,
      },
      style: {
        fill: patternCache.reg,
        opacity: 0.18,
      },
    });
  }

  return {
    type: 'group',
    silent: false,
    children: children.filter(Boolean),
  };
};
const getTensorLabelData = () => {
  const q = searchQuery.value.trim().toLowerCase();

  const candidates = memoryBlocksRaw.filter((item) => {
    const magicId = item.magicId || item.rawObj?.rawmagic || '';

    if (!magicId) {
      return false;
    }

    if (q) {
      const name = String(item.name || '-').toLowerCase();
      const magic = String(magicId || '-').toLowerCase();
      const shape = String(formatRawShape(item.rawObj?.rawShape) || '-').toLowerCase();

      return name.includes(q) || magic.includes(q) || shape.includes(q) || !filteredResultsCount.value;
    }

    return true;
  });

  const data = candidates.map((item) => [
    item.name || '',
    item.start,
    item.end,
    item.startAddr,
    item.endAddr,
    item.magicId || item.rawObj?.rawmagic || '',
    formatRawShape(item.rawObj?.rawShape),
  ]);
  return data;
};

function renderTensorLabelItem(params, api) {
  const startX = Number(api.value(1));
  const endX = Number(api.value(2));
  const startY = Number(api.value(3));
  const endY = Number(api.value(4));
  const magicId = api.value(5) || '-';
  const rawShape = api.value(6);

  const p1 = api.coord([startX, startY]);
  const p2 = api.coord([endX, endY]);

  if (!p1 || !p2) {
    return {
      type: 'group',
      children: [],
    };
  }

  const left = Math.min(p1[0], p2[0]);
  const top = Math.min(p1[1], p2[1]);
  const width = Math.abs(p2[0] - p1[0]);
  const height = Math.abs(p2[1] - p1[1]);

  if (width <= 50 || height <= 24) {
    return {
      type: 'group',
      children: [],
    };
  }
  const rectShape = echarts.graphic.clipRectByRect(
    {
      x: left,
      y: top,
      width,
      height,
    },
    params.coordSys,
  );

  if (!rectShape) {
    return {
      type: 'group',
      children: [],
    };
  }
  const textPadding = 8;
  const textWidth = Math.max(rectShape.width - textPadding * 2, 0);
  const textHeight = Math.max(rectShape.height - textPadding * 2, 0);
  return {
    type: 'text',
    silent: true,
    z: 100,
    style: {
      x: rectShape.x + rectShape.width / 2,
      y: rectShape.y + rectShape.height / 2,
      text: `magicID: ${magicId} rawShape: ${rawShape || '-'}`,
       fill: isDarkTheme.value ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.7)',
      fontSize: 10,
      lineHeight: 14,
      textAlign: 'center',
      textVerticalAlign: 'middle',
      width: textWidth,
      height: textHeight,
      overflow: 'truncate',
      lineOverflow: 'truncate',
      ellipsis: '...',
    },
  };
}

function renderOverlapItem(params, api) {
  const x1 = api.value(0);
  const y1 = api.value(1);
  const x2 = api.value(2);
  const y2 = api.value(3);
  const tensorA = api.value(4);
  const tensorB = api.value(5);

  const p1 = api.coord([x1, y1]);
  const p2 = api.coord([x2, y2]);

  let width = Math.abs(p2[0] - p1[0]);
  let height = Math.abs(p2[1] - p1[1]);
  if (width < 5) {
    width = 5;
  }
  if (height < 5) {
    height = 5;
  }

  let overlapRect = echarts.graphic.clipRectByRect(
    { x: Math.min(p1[0], p2[0]), y: Math.min(p1[1], p2[1]), width, height },
    params.coordSys,
  );

  if (!overlapRect) {
    const grid = params.coordSys;
    const oLeft = Math.min(p1[0], p2[0]);
    const oTop = Math.min(p1[1], p2[1]);
    const oWidth = Math.abs(p2[0] - p1[0]);
    const oHeight = Math.abs(p2[1] - p1[1]);

    const widthOverlap = Math.min(oLeft + oWidth, grid.x + grid.width) - Math.max(oLeft, grid.x);
    const heightOverlap = Math.min(oTop + oHeight, grid.y + grid.height) - Math.max(oTop, grid.y);
    if (widthOverlap > 0 && heightOverlap > 0) {
      overlapRect = {
        x: Math.max(oLeft, grid.x),
        y: Math.max(oTop, grid.y),
        width: widthOverlap,
        height: heightOverlap,
      };
    }
  }

  if (overlapRect) {
    if (overlapRect.width <= 0) {
      overlapRect.width = 1;
    }
    if (overlapRect.height <= 0) {
      overlapRect.height = 1;
    }

    let itemOpacity = 1.0;
    if (searchQuery.value.trim() !== '') {
      const q = searchQuery.value.trim().toLowerCase();
      const matchesA = String(tensorA || '')
        .toLowerCase()
        .includes(q);
      const matchesB = String(tensorB || '')
        .toLowerCase()
        .includes(q);
      if (matchesA || matchesB) {
        itemOpacity = 1.0;
      } else {
        itemOpacity = 0.15;
      }
    }

    const rOverlap = 0;
    const stripeFill = patternCache.stripe || patternCache.B;

    return {
      type: 'group',
      cursor: 'default',
      children: [
        {
          type: 'rect',
          cursor: 'default',
          zIndex: 10,
          shape: { ...overlapRect, r: rOverlap },
          style: { fill: 'rgba(231, 67, 74, 0.7)', opacity: 0.4 },
        },
        {
          type: 'rect',
          cursor: 'default',
          zIndex: 11,
          shape: { ...overlapRect, r: rOverlap },
          style: { fill: stripeFill, opacity: 0.35 },
        },
        {
          type: 'rect',
          cursor: 'default',
          zIndex: 12,
          shape: { ...overlapRect, r: rOverlap },
          style: { fill: 'transparent', stroke: 'rgba(231, 67, 74, 1)', lineWidth: 1 },
        },
      ],
    };
  }

  return {
    type: 'group',
    children: [],
  };
}

let currentLayoutRegions = [];
let hoveredRegionData = [];
let regionLabelHoverAreas = [];
const findHoveredRegionData = (offsetX, offsetY) => {
  const area = regionLabelHoverAreas.find((item) => {
    return offsetX >= item.x && offsetX <= item.x + item.width && offsetY >= item.y && offsetY <= item.y + item.height;
  });
  return area?.regionData || null;
};
const getTooltipConfig = () => ({
  show: true,
  trigger: 'item',
  backgroundColor: isDarkTheme.value ? 'rgba(54, 54, 54, 1)' : 'rgba(255, 255, 255, 0.95)',
  borderRadius: '12',
  borderColor: isDarkTheme.value ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)',
  borderWidth: 1,
  textStyle: { color: isDarkTheme.value ? '#ffffff' : '#191919', fontSize: 12 },
  formatter: (params) => {
    if (!params.data) {
      return '';
    };
    if (params.seriesId === 'region-axis-labels') {
      return hoveredRegionData ? regionHoverTemplate(hoveredRegionData, isDarkTheme.value) : '';
    };
    return tensorHoverTemplate(params.data, params, isDarkTheme.value);
  },
});
const getSeriesConfig = () => [
  { id: 'tensors', type: 'custom', renderItem, encode: { x: [1, 2], y: [3, 4] }, data: getChartData(), progressive: 0, animation: false, animationDuration: 0, animationDurationUpdate: 0 },
  { id: 'overlaps', type: 'custom', renderItem: renderOverlapItem, encode: { x: [0, 2], y: [1, 3] }, data: getOverlapData(), zIndex: 10, cursor: 'default' },
  { id: 'tensor-labels', name: 'tensor-labels', type: 'custom', coordinateSystem: 'cartesian2d', renderItem: renderTensorLabelItem, data: getTensorLabelData(), silent: true, z: 200, zIndex: 200, encode: { x: [1, 2], y: [3, 4] }, animation: false },
  { id: 'regions', name: 'Regions', type: 'custom', coordinateSystem: 'cartesian2d', renderItem: renderRegionLayerItem, data: getRegionLayerData(), encode: { x: 1, y: 2 }, silent: true, z: 0, clip: false, animation: false },
  { id: 'region-axis-labels', name: 'region-axis-labels', type: 'custom', coordinateSystem: 'cartesian2d', renderItem: renderRegionAxisLabelLayerItem, data: getRegionLabelLayerData(), encode: { x: 1, y: 2 }, silent: false, z: 200, animation: false },
];
const getChartOption = () => {
  const rawMemoryData = currentMemoryData || server.GmMemoryVisualData?.value;
  const memoryData = rawMemoryData?.data || rawMemoryData || {};
  const regions = memoryData?.meta?.regions || [];
  const { regionMap, regions: layoutRegions, yMin, yMax } = MemoryRegionLayoutUtil.createRegionLayout(regions);
  currentLayoutRegions = layoutRegions;
  return {
    backgroundColor: 'transparent',
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    tooltip: getTooltipConfig(),
    grid: {
      top: 20,
      bottom: 40,
      left: layout.processLabelWidth,
      right: 20,
      containLabel: false,
    },
    xAxis: getxAxisConfig({
      startTime: viewState.minTime,
      endTime: viewState.maxTime,
    }),
    yAxis: getyAxisConfig(yMin, yMax, isDarkTheme.value),
    dataZoom: getDataZoomConfig(isDarkTheme.value),
    series: getSeriesConfig(),
  };
};
const renderRegionAxisLabelLayerItem = (params, api) => {
  if (!currentLayoutRegions.length) {
    regionLabelHoverAreas = [];

    return {
      type: 'group',
      silent: false,
      children: [],
    };
  }

  const { min: visibleXMin, max: visibleXMax } = getVisibleXAxisRange(myChart, timelineState);
  const { min: visibleYMin, max: visibleYMax } = getVisibleYAxisRange(myChart, maxY.value);

  const xCenter = (visibleXMin + visibleXMax) / 2;

  const children = [];
  const nextHoverAreas = [];

  currentLayoutRegions.forEach((region) => {
    if (region.yEnd < visibleYMin || region.yStart > visibleYMax) {
      return;
    }

    const regionCenterY = (region.yStart + region.yEnd) / 2;

    const visibleRegionTop = Math.max(region.yStart, visibleYMin);
    const visibleRegionBottom = Math.min(region.yEnd, visibleYMax);

    const fixedLabelY = Math.min(Math.max(regionCenterY, visibleRegionTop), visibleRegionBottom);

    const yPixel = myChart.convertToPixel({ yAxisIndex: 0 }, fixedLabelY);
    const visibleRegionStartPixel = myChart.convertToPixel({ yAxisIndex: 0 }, visibleRegionTop);
    const visibleRegionEndPixel = myChart.convertToPixel({ yAxisIndex: 0 }, visibleRegionBottom);

    if (!Number.isFinite(yPixel) || !Number.isFinite(visibleRegionStartPixel) || !Number.isFinite(visibleRegionEndPixel)) {
      return;
    }

    const regionData = [
      xCenter,
      fixedLabelY,
      `Region\nID:${region.regionId}`,
      region.regionId,
      region.yStart,
      region.yEnd,
      region.span,
      region.addr0,
      region.addrEnd,
      region.rawRegion,
    ];

    const labelX = params.coordSys.x - 50;
    const labelY = yPixel;
    const labelWidth = 44;
    const labelHeight = 30;
    const visibleRegionPixelTop = Math.min(visibleRegionStartPixel, visibleRegionEndPixel);
    const visibleRegionPixelBottom = Math.max(visibleRegionStartPixel, visibleRegionEndPixel);
    const chartWidth = myChart.getWidth();
    const labelFitsCanvas = labelX >= 0 && labelX + labelWidth <= chartWidth;
    const labelFitsRegion =
      labelY - labelHeight / 2 >= visibleRegionPixelTop && labelY + labelHeight / 2 <= visibleRegionPixelBottom;

    if (!labelFitsCanvas || !labelFitsRegion) {
      return;
    }

    nextHoverAreas.push({
      x: labelX,
      y: labelY - labelHeight / 2,
      width: labelWidth,
      height: labelHeight,
      regionData,
    });

    children.push({
      type: 'rect',
      name: 'region-axis-hit-area',
      silent: false,
      z: 199,
      shape: {
        x: labelX,
        y: labelY - labelHeight / 2,
        width: labelWidth,
        height: labelHeight,
      },
      style: {
        fill: 'rgba(0, 0, 0, 0)',
      },
    });

    children.push({
      type: 'text',
      name: 'region-axis-label',
      silent: false,
      z: 200,
      style: {
        x: labelX,
        y: labelY,
        text: `Region\nID:${region.regionId}`,
        fill: isDarkTheme.value ? 'rgba(230, 230, 230, 1)' : 'rgba(25, 25, 25, 1)',
        fontSize: 11,
        lineHeight: 15,
        textAlign: 'left',
        textVerticalAlign: 'middle',
      },
    });
  });

  regionLabelHoverAreas = nextHoverAreas;

  return {
    type: 'group',
    silent: false,
    children,
  };
};
const getRegionLabelLayerData = () => {
  const { min: visibleXMin, max: visibleXMax } = getVisibleXAxisRange(myChart, timelineState);
  const { min: visibleYMin, max: visibleYMax } = getVisibleYAxisRange(myChart, maxY.value);

  const xCenter = (visibleXMin + visibleXMax) / 2;
  const yCenter = (visibleYMin + visibleYMax) / 2;

  return [['region-label-layer', xCenter, yCenter, 'sa']];
};
const updateRegionLayers = () => {
  if (!myChart) {
    return;
  }

  myChart.setOption(
    {
      series: [
        {
          id: 'regions',
          data: getRegionLayerData(),
        },
        {
          id: 'region-axis-labels',
          data: getRegionLabelLayerData(),
        },
      ],
    },
    { lazyUpdate: false },
  );
};
const getRegionLayerData = () => {
  const { min: visibleXMin, max: visibleXMax } = getVisibleXAxisRange(myChart, timelineState);
  const { min: visibleYMin, max: visibleYMax } = getVisibleYAxisRange(myChart, maxY.value);

  const xCenter = (visibleXMin + visibleXMax) / 2;
  const yCenter = (visibleYMin + visibleYMax) / 2;

  return [['regions-layer', xCenter, yCenter]];
};
const REGION_BACKGROUND_GAP_PX = 10;
const renderRegionLayerItem = (params, api) => {
  if (!currentLayoutRegions.length) {
    return {
      type: 'group',
      silent: true,
      children: [],
    };
  }

  const { coordSys } = params;
  const isCoordSysValid = !Number.isFinite(coordSys.x) || !Number.isFinite(coordSys.y);
  const isCoordSysSpaceValid = !Number.isFinite(coordSys.width) || !Number.isFinite(coordSys.height);
  if (!coordSys || isCoordSysValid || isCoordSysSpaceValid) {
    return {
      type: 'group',
      silent: true,
      children: [],
    };
  }

  const children = [];
  const gridLeft = coordSys.x;
  const gridTop = coordSys.y;
  const gridBottom = coordSys.y + coordSys.height;
  const gridWidth = coordSys.width;

  const gridSize = 100;
  const gridColor = isDarkTheme.value ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const regionFill = isDarkTheme.value ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.018)';

  const regionStroke = isDarkTheme.value ? '#333' : '#ddd';
  const { min: visibleYMin, max: visibleYMax } = getRegionLayerVisibleYRange(coordSys, myChart, currentLayoutRegions);

  const visibleRegions = currentLayoutRegions
    .map((region) => {
      const rawStart = Number(region.yStart);
      const rawEnd = Number(region.yEnd);

      if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
        return null;
      }

      const regionMin = Math.min(rawStart, rawEnd);
      const regionMax = Math.max(rawStart, rawEnd);

      const visibleStart = Math.max(regionMin, visibleYMin);
      const visibleEnd = Math.min(regionMax, visibleYMax);

      const visibleSpan = visibleEnd - visibleStart;

      if (visibleSpan <= 0) {
        return null;
      }

      return {
        region,
        visibleStart,
        visibleEnd,
        visibleSpan,
      };
    })
    .filter(Boolean);

  if (!visibleRegions.length) {
    currentLayoutRegions.forEach((region) => {
      const startYPixel = myChart.convertToPixel({ yAxisIndex: 0 }, region.yStart);

      const endYPixel = myChart.convertToPixel({ yAxisIndex: 0 }, region.yEnd);

      if (!Number.isFinite(startYPixel) || !Number.isFinite(endYPixel)) {
        return;
      }
      const rawTop = Math.min(startYPixel, endYPixel);
      const rawBottom = Math.max(startYPixel, endYPixel);
      if (rawBottom <= gridTop || rawTop >= gridBottom) {
        return;
      }
      const regionTop = Math.max(rawTop, gridTop);
      const regionBottom = Math.min(rawBottom, gridBottom);
      const regionHeight = regionBottom - regionTop;
      if (regionHeight <= 0) {
        return;
      }

      const rectShape = {
        x: gridLeft,
        y: regionTop,
        width: gridWidth,
        height: regionHeight,
      };

      children.push({
        type: 'rect',
        silent: true,
        shape: rectShape,
        style: {
          fill: regionFill,
          stroke: regionStroke,
          lineWidth: 1,
        },
      });
    });

    return {
      type: 'group',
      silent: true,
      children,
    };
  }

  const gapCount = Math.max(0, visibleRegions.length - 1);
  const totalGapHeight = gapCount * REGION_BACKGROUND_GAP_PX;

  const availableRegionHeight = Math.max(0, coordSys.height - totalGapHeight);

  const totalVisibleSpan = visibleRegions.reduce((sum, item) => {
    return sum + item.visibleSpan;
  }, 0);

  if (availableRegionHeight <= 0 || totalVisibleSpan <= 0) {
    return {
      type: 'group',
      silent: true,
      children: [],
    };
  }

  let currentY = coordSys.y;

  visibleRegions.forEach((item) => {
    const regionHeight = (item.visibleSpan / totalVisibleSpan) * availableRegionHeight;
    if (regionHeight <= 0) {
      return;
    }
    const rectShape = {
      x: gridLeft,
      y: currentY,
      width: gridWidth,
      height: regionHeight,
    };

    children.push({
      type: 'rect',
      silent: true,
      shape: rectShape,
      style: {
        fill: regionFill,
        stroke: regionStroke,
        lineWidth: 1,
      },
    });

    for (let x = rectShape.x + gridSize; x < rectShape.x + rectShape.width; x += gridSize) {
      children.push({
        type: 'line',
        silent: true,
        shape: {
          x1: x,
          y1: rectShape.y,
          x2: x,
          y2: rectShape.y + rectShape.height,
        },
        style: {
          stroke: gridColor,
          lineWidth: 1,
        },
      });
    }

    currentY += regionHeight + REGION_BACKGROUND_GAP_PX;
  });

  return {
    type: 'group',
    silent: true,
    children,
  };
};
const zoomXAxisAroundMouse = (mousePixel, zoomIn) => {
  const { min, max } = getVisibleXAxisExtent();

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return;
  }

  const converted = myChart.convertFromPixel({ xAxisIndex: 0 }, mousePixel[0]);

  const anchor = Number(converted);

  if (!Number.isFinite(anchor)) {
    return;
  }

  const span = max - min;

  if (span <= 0) {
    return;
  }

  const zoomFactor = zoomIn ? 0.85 : 1.15;
  const nextSpan = span * zoomFactor;

  const totalMin = viewState.minTime;
  const totalMax = viewState.maxTime;
  const totalSpan = totalMax - totalMin;

  const anchorRatio = (anchor - min) / span;

  let nextMin = anchor - nextSpan * anchorRatio;
  let nextMax = nextMin + nextSpan;

  if (nextSpan >= totalSpan) {
    nextMin = totalMin;
    nextMax = totalMax;
  } else {
    if (nextMin < totalMin) {
      nextMax += totalMin - nextMin;
      nextMin = totalMin;
    }

    if (nextMax > totalMax) {
      nextMin -= nextMax - totalMax;
      nextMax = totalMax;
    }

    nextMin = Math.max(totalMin, nextMin);
    nextMax = Math.min(totalMax, nextMax);
  }

  syncTimelineViewStateFromRange(nextMin, nextMax, false);
  applyChartXAxisRange(nextMin, nextMax);
};
const getVisibleXAxisExtent = () => {
  const xAxisModel = myChart.getModel().getComponent('xAxis', 0);
  const extent = xAxisModel?.axis?.scale?.getExtent?.();

  if (!extent) {
    return {
      min: timelineState.startTime,
      max: timelineState.endTime,
    };
  }

  const a = Number(extent[0]);
  const b = Number(extent[1]);

  return {
    min: Math.min(a, b),
    max: Math.max(a, b),
  };
};

const zoomYAxisAroundMouse = (mousePixel, zoomIn) => {
  const { min, max } = getVisibleYAxisExtent();

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return;
  }

  const converted = myChart.convertFromPixel({ yAxisIndex: 0 }, mousePixel[1]);

  const anchor = Number(converted);

  if (!Number.isFinite(anchor)) {
    return;
  }

  const span = max - min;

  if (span <= 0) {
    return;
  }

  const zoomFactor = zoomIn ? 0.85 : 1.15;
  const nextSpan = span * zoomFactor;

  const anchorRatio = (anchor - min) / span;

  let nextMin = anchor - nextSpan * anchorRatio;
  let nextMax = nextMin + nextSpan;

  if (nextMin < 0) {
    nextMax -= nextMin;
    nextMin = 0;
  }

  if (nextMax > maxY.value) {
    const overflow = nextMax - maxY.value;
    nextMin -= overflow;
    nextMax = maxY.value;
  }

  nextMin = Math.max(0, nextMin);
  nextMax = Math.min(maxY.value, nextMax);

  myChart.dispatchAction({
    type: 'dataZoom',
    dataZoomIndex: 0,
    startValue: nextMin,
    endValue: nextMax,
  });
};

const getVisibleYAxisExtent = () => {
  const yAxisModel = myChart.getModel().getComponent('yAxis', 0);
  const extent = yAxisModel?.axis?.scale?.getExtent?.();

  if (!extent) {
    return {
      min: 0,
      max: maxY.value,
    };
  }

  return {
    min: Number(extent[0]),
    max: Number(extent[1]),
  };
};

const postMessage = (message) => {
  server.showMessage({ paramObj: { text: message } });
};

const fixedTimeToX = (time) => {
  if (!timelineComponent.value || !timelineComponent.value.fixedtimelineCanvas) {
    return 0;
  }
  const canvasWidth = viewState.canvasCssWidth;
  const relativeTime = time - viewState.minTime;
  const normalizedTime = relativeTime / viewState.timeRange;
  return layout.processLabelWidth + normalizedTime * canvasWidth;
};

const timeToX = (time) => {
  if (!timelineComponent.value || !timelineComponent.value.timelineCanvas) {
    return 0;
  }
  const canvasWidth = viewState.canvasCssWidth;
  const relativeTime = time - viewState.minTime;
  const normalizedTime = relativeTime / viewState.timeRange;
  return layout.processLabelWidth + normalizedTime * canvasWidth * viewState.scale + viewState.offsetX;
};

const xToTime = (x) => {
  if (!timelineComponent.value || !timelineComponent.value.timelineCanvas) {
    return 0;
  }
  const canvasWidth = viewState.canvasCssWidth;
  const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
  const offsetTime = Math.abs(viewState.offsetX * timelinePerPixel);
  const normalizedTime = (x - layout.processLabelWidth) / (canvasWidth * viewState.scale);
  return viewState.minTime + offsetTime + normalizedTime * viewState.timeRange;
};

const drawFixedTimelineSlider = (ctx, canvas, startTimex, endTimex) => {
  ctx.strokeStyle = isDarkTheme.value ? 'rgba(255, 255, 255)' : 'rgba(25, 25, 25)';
  ctx.lineWidth = 6;

  let startx = startTimex;
  let endx = endTimex;

  if (endx - startx < 3) {
    endx = endx + 3;
  }

  if (endx > viewState.canvasCssWidth) {
    endx = viewState.canvasCssWidth;
  }

  const canvasCSSHeight = getCanvasCSSHeight(canvas);

  ctx.beginPath();
  ctx.moveTo(startx, 0);
  ctx.lineTo(startx, canvasCSSHeight / 3);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endx, 0);
  ctx.lineTo(endx, canvasCSSHeight / 3);
  ctx.stroke();

  ctx.strokeStyle = isDarkTheme.value ? 'rgba(255, 255, 255)' : 'rgba(25, 25, 25)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(startx, canvasCSSHeight / 3);
  ctx.lineTo(startx, canvasCSSHeight);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endx, 0);
  ctx.lineTo(endx, canvasCSSHeight);
  ctx.stroke();
};

const timelineWithUnit = (timelineRangeInMicroseconds, timeInMicroseconds) => {
  const seconds = timelineRangeInMicroseconds / MICROSECONDS_PER_SECOND;
  const minutes = seconds / 60;

  if (minutes >= 1) {
    return { value: (timeInMicroseconds / (MICROSECONDS_PER_SECOND * 60)).toFixed(1), unit: 'min' };
  }

  if (seconds >= 1) {
    return { value: (timeInMicroseconds / MICROSECONDS_PER_SECOND).toFixed(1), unit: 's' };
  }

  if (timelineRangeInMicroseconds >= 1) {
    return { value: timeInMicroseconds.toFixed(0), unit: 'µs' };
  }

  return { value: (timeInMicroseconds * NANOSECONDS_PER_MICROSECOND).toFixed(0), unit: 'ns' };
};

const getTimelineLabelPosition = (ctx, labels, tickX, canvasWidth, lastLabelRight) => {
  const edgePadding = 2;
  const labelGap = 8;
  const availableWidth = canvasWidth - edgePadding * 2;
  const currentFont = ctx.font;
  ctx.font = '14px Arial';
  const labelWidth = Math.max(...labels.map((label) => ctx.measureText(label).width));
  ctx.font = currentFont;

  if (labelWidth > availableWidth) {
    return null;
  }

  const labelX = Math.max(edgePadding, Math.min(tickX + edgePadding, canvasWidth - labelWidth - edgePadding));
  if (labelX < lastLabelRight + labelGap) {
    return null;
  }

  return {
    x: labelX,
    right: labelX + labelWidth,
  };
};

const renderFixedTimeline = () => {
  const component = timelineComponent.value;
  if (!component || !component.fixedtimelineCtx || !component.fixedtimelineCanvas) {
    return;
  }

  const ctx = component.fixedtimelineCtx;
  const canvas = component.fixedtimelineCanvas;

  ctx.clearRect(0, 0, viewState.canvasCssWidth, canvas.offsetHeight);

  ctx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, viewState.canvasCssWidth, canvas.offsetHeight);

  ctx.strokeStyle = isDarkTheme.value ? '#3e3e42' : 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(viewState.canvasCssWidth, 20);
  ctx.stroke();

  let lastx = 0;
  let distance = 0;
  let lastLabelRight = -Infinity;
  const canvasWidth = viewState.canvasCssWidth;
  const timePerPixel = viewState.timeRange / canvasWidth;
  const gridInterval = calculateGridInterval(timePerPixel);

  const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
  const startTime = viewState.minTime + Math.abs(viewState.offsetX * timelinePerPixel);
  const startTimex = fixedTimeToX(startTime) - layout.processLabelWidth;

  const endTime = startTime + canvasWidth * timelinePerPixel;
  const endTimex = fixedTimeToX(endTime) - layout.processLabelWidth;

  timelineState.startTime = startTime;
  timelineState.startTimeDecimal = startTime;
  timelineState.startTimeX = startTimex;
  timelineState.endTime = endTime;
  timelineState.endTimeDecimal = endTime;
  timelineState.endTimeX = endTimex;
  timeLineX.value = timeToX(viewState.maxTime) - layout.processLabelWidth;

  for (let time = viewState.minTime; time <= viewState.maxTime; time += gridInterval) {
    const x = fixedTimeToX(time) - layout.processLabelWidth;
    if (x >= 0 && x <= canvasWidth) {
      const { value, unit } = timelineWithUnit(viewState.timeRange, time - viewState.minTime);
      ctx.fillStyle = isDarkTheme.value ? '#cccccc' : 'rgba(25, 25, 25, 1)';
      ctx.font = '14px Arial';
      if (x < startTimex || x > endTimex) {
        ctx.fillStyle = isDarkTheme.value ? 'rgba(102, 102, 102, 0.8)' : 'rgba(102, 102, 102, 0.8)';
      }
      const label = `${value}${unit}`;
      const labelPosition = getTimelineLabelPosition(ctx, [label, xToTimeValue(time)], x, canvasWidth, lastLabelRight);
      if (!labelPosition) {
        lastx = x;
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
      distance = x - lastx;
      const segmentWidth = distance / 10;
      for (let i = 1; i < 10; i++) {
        const segmentX = x + i * segmentWidth;
        ctx.beginPath();
        ctx.moveTo(segmentX, 20);
        ctx.lineTo(segmentX, 10);
        ctx.stroke();
      }

      ctx.fillText(label, labelPosition.x, 15);
      lastLabelRight = labelPosition.right;
    }
    lastx = x;
  }

  for (let i = 1; i < 10; i++) {
    const segmentx = i * (distance / 10);
    ctx.beginPath();
    ctx.moveTo(segmentx, 20);
    ctx.lineTo(segmentx, 10);
    ctx.stroke();
  }

  drawFixedTimelineSlider(ctx, canvas, startTimex, endTimex);
};
const syncTimelineViewStateFromRange = (startTime, endTime, shouldRender = true) => {
  const canvasWidth = viewState.canvasCssWidth;

  if (!canvasWidth || canvasWidth <= 0) {
    return;
  }

  const visibleRange = endTime - startTime;

  if (!Number.isFinite(visibleRange) || visibleRange <= 0) {
    return;
  }

  const totalRange = viewState.maxTime - viewState.minTime;

  if (!Number.isFinite(totalRange) || totalRange <= 0) {
    return;
  }

  const nextScale = totalRange / visibleRange;
  const timelinePerPixel = totalRange / (canvasWidth * nextScale);

  const nextOffsetX = -((startTime - viewState.minTime) / timelinePerPixel);

  viewState.scale = nextScale;
  viewState.offsetX = nextOffsetX;
  viewState.pixelScale = nextScale * devicePixelRatio;
  viewState.pixelOffsetX = nextOffsetX * devicePixelRatio;
  viewState.minWidth = 1 / nextScale;

  if (shouldRender) {
    renderFixedTimeline();
  }
};
const xToTimeValue = (time) => {
  const timeDelta = (time - viewState.minTime) * NANOSECONDS_PER_MICROSECOND;
  const currentTime = Math.round(timeDelta);
  let truncatedCurrentTime = currentTime;
  if (currentTime.toString().length > 10) {
    truncatedCurrentTime = parseInt(currentTime.toString().slice(-9));
  }
  let str = truncatedCurrentTime.toString().padStart(9, '0');
  str = str.replace(/\B(?=(?:\d{3})+(?!\d))/g, ' ');
  return str;
};

const renderTimeline = () => {
  const component = timelineComponent.value;
  if (!component || !component.timelineCtx || !component.timelineCanvas) {
    return;
  }

  const ctx = component.timelineCtx;
  const canvas = component.timelineCanvas;

  ctx.clearRect(0, 0, viewState.canvasCssWidth, canvas.offsetHeight);

  ctx.fillStyle = isDarkTheme.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, viewState.canvasCssWidth, canvas.offsetHeight);

  ctx.strokeStyle = isDarkTheme.value ? '#3e3e42' : 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;

  let x = 0;
  let lastLabelRight = -Infinity;
  const timelineTimeRange = timelineState.endTime - timelineState.startTime;
  const canvasWidth = viewState.canvasCssWidth;
  const timePerPixel = timelineTimeRange / canvasWidth;
  const gridInterval = calculateGridInterval(timePerPixel);
  for (let time = timelineState.startTime; time <= timelineState.endTime; time += gridInterval) {
    x = timeToX(time) - layout.processLabelWidth;
    if (x < 0) {
      x = 0;
    }
    if (x >= 0 && x <= viewState.canvasCssWidth) {
      const { value, unit } = timelineWithUnit(viewState.timeRange, time - viewState.minTime);
      ctx.fillStyle = isDarkTheme.value ? 'rgba(230, 230, 230)' : 'rgba(25, 25, 25)';
      ctx.font = '12px Arial';
      const timeValue = xToTimeValue(time);
      const timeLabel = `${value}${unit}`;
      const labelPosition = getTimelineLabelPosition(ctx, [timeLabel, timeValue], x, canvasWidth, lastLabelRight);
      if (!labelPosition) {
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      ctx.fillText(timeLabel, labelPosition.x, 15);
      ctx.fillText(timeValue, labelPosition.x, 35);
      lastLabelRight = labelPosition.right;
    }
  }
};

const renderTwoTimeline = () => {
  renderFixedTimeline();
  renderTimeline();
};

const isValidChartTimeRange = (startTime, endTime) => {
  return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime < endTime;
};

const applyChartXAxisRange = (startTime, endTime) => {
  if (!myChart) {
    return;
  }

  if (!isValidChartTimeRange(startTime, endTime)) {
    return;
  }

  const { min, max } = getVisibleXAxisExtent();
  const tolerance = Math.max(1, Math.abs(startTime), Math.abs(endTime)) * 1e-12;
  if (Math.abs(min - startTime) <= tolerance && Math.abs(max - endTime) <= tolerance) {
    return;
  }

  isProgrammaticZoom = true;
  try {
    myChart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 1, startValue: startTime, endValue: endTime });
    updateRegionLayers();
  } finally {
    isProgrammaticZoom = false;
  }
};

const transform = () => {
  renderTwoTimeline();
  applyChartXAxisRange(timelineState.startTime, timelineState.endTime);
};

provideMemoryUsageSwimGraph({
  props,
  state: {
    viewState,
    layout,
    timeLineX,
    sliderValue,
    sliderMax,
    initialScale,
    loading,
    timelineState,
    childContextMap,
    isE2ESwim,
    isCfgEditing,
    isPathLockStatus,
    isAicpu,
    isPerfSwim,
    isMsProf,
    isMixMode,
    processes,
    detailsPanelExpanded,
    selectedEvent,
    highlightedPaths,
    isMeasureModel,
    mulDetailsExpanded,
    mixRelatedPaths,
    searchedEvent,
    isMaxSchedule,
    measureDetailsExpanded,
    aicpuControlDetailsExpanded,
    aicpuScheduleDetailsExpanded,
    aicpuCoreDetailsExpanded,
    hashOrderRending,
  },
  methods: {
    postMessage,
    renderFixedTimeline,
    renderTimeline,
    calculateGridInterval,
    timeToX,
    xToTime,
    transform,
    selectedNode,
    viewState,
    timelineComponent,
    drawFixedTimelineSlider,
  },
});
onMounted(() => {
  window.addEventListener('resize', resizeChart);
});

const setChartCursor = (cursor) => {
  myChart?.getZr?.()?.setCursorStyle?.(cursor);
  const chartDom = myChart?.getDom?.();
  if (chartDom) {
    chartDom.style.cursor = cursor;
  }
};

const detachChartWheelListener = () => {
  if (chartWheelDom && chartWheelHandler) {
    chartWheelDom.removeEventListener('wheel', chartWheelHandler, true);
  }
  chartWheelDom = null;
  chartWheelHandler = null;
};

const disposeMainChart = () => {
  detachChartWheelListener();
  if (myChart) {
    myChart.dispose();
    myChart = null;
  }
};

const attachChartWheelListener = (chartDom) => {
  chartWheelHandler = (event) => {
    if (!event.altKey && !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const rect = chartDom.getBoundingClientRect();

    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const zoomIn = event.deltaY < 0;

    if (event.ctrlKey) {
      zoomXAxisAroundMouse([offsetX, offsetY], zoomIn);
      renderTwoTimeline();
      timelineComponent.value?.flagRender();
      return;
    }

    if (event.altKey) {
      zoomYAxisAroundMouse([offsetX, offsetY], zoomIn);
    }
  };
  chartWheelDom = chartDom;
  chartDom.addEventListener('wheel', chartWheelHandler, {
    passive: false,
    capture: true,
  });
};
let tensorHoverFrame = null;
let lastHoveredTensorKey = null;

const initChart = () => {
  if (!chartRef.value) {
    return;
  }
  disposeMainChart();
  myChart = echarts.init(chartRef.value);

  myChart.setOption(getChartOption());

  const chartDom = myChart.getDom();

  attachChartWheelListener(chartDom);
  myChart.on('datazoom', (params) => {
    scheduleSearchOverlayUpdate();

    if (isProgrammaticZoom) {
      return;
    }

    updateRegionLayers();

    if (isCtrlDown.value) {
      return;
    }

    const hasBatch = params.batch !== undefined;
    const hasStartEnd = params.start !== undefined || params.end !== undefined;
    if (!hasBatch && !hasStartEnd) {
      return;
    }

    const xAxisModel = myChart.getModel().getComponent('xAxis', 0);
    if (!xAxisModel) {
      return;
    }
    const [newStart, newEnd] = xAxisModel.axis.scale.getExtent();

    if (isNaN(newStart) || isNaN(newEnd) || newStart >= newEnd) {
      return;
    }

    if (Math.abs(timelineState.startTime - newStart) > 0.001 || Math.abs(timelineState.endTime - newEnd) > 0.001) {
      timelineState.startTime = newStart;
      timelineState.startTimeDecimal = newStart;
      timelineState.endTime = newEnd;
      timelineState.endTimeDecimal = newEnd;

      const canvasWidth = viewState.canvasCssWidth;
      const rangeWidth = newEnd - newStart;
      if (rangeWidth > 0) {
        viewState.scale = viewState.timeRange / rangeWidth;
        const timelinePerPixel = viewState.timeRange / (canvasWidth * viewState.scale);
        viewState.offsetX = (viewState.minTime - newStart) / timelinePerPixel;
        viewState.pixelOffsetX = viewState.offsetX * devicePixelRatio;
        viewState.pixelScale = viewState.scale * devicePixelRatio;
      }

      renderTwoTimeline();
      timelineComponent.value?.flagRender();
    }
  });

  myChart.on('click', (params) => {
    if (params.seriesId !== 'tensors' || !params.data) {
      return;
    }
    dimDetails(params.data);
  });

  myChart.getZr().on('mousemove', (event) => {
    const regionData = findHoveredRegionData(event.offsetX, event.offsetY);

    hoveredRegionData = regionData;
  });

  myChart.getZr().on('globalout', () => {
    hoveredRegionData = null;
  });

  myChart.on('mouseover', { seriesId: 'overlaps' }, () => setChartCursor('default'));
  myChart.on('mousemove', { seriesId: 'overlaps' }, () => setChartCursor('default'));
  myChart.on('mouseout', { seriesId: 'overlaps' }, () => setChartCursor('default'));
};
const resizeChart = () => {
  const visibleStartTime = timelineState.startTime;
  const visibleEndTime = timelineState.endTime;
  if (timelineComponent.value) {
    timelineComponent.value.resizeCanvases();
    syncTimelineViewStateFromRange(visibleStartTime, visibleEndTime, false);
  }
  if (myChart) {
    myChart.setOption({
      grid: {
        width: viewState.canvasCssWidth,
      },
    });
    myChart.resize();
  }
  if (timelineComponent.value) {
    renderTwoTimeline();
    timelineComponent.value.flagRender();
  }
};
let regionAxisLabelFrame = null;

const dimDetails = (params) => {
  const tensor = params.at(17);
  if (!tensor || !isValidMemoryTensor(tensor)) {
    return;
  }
  const raw = server.GmMemoryVisualData?.value ?? server.GmMemoryVisualData;
  const root = raw?.data || raw;
  const magicId = getTensorMagicId(tensor);
  selectedNode.value = markRaw({
    meta: root?.meta,
    rawTensors: [tensor],
    color: tensorColorMap[magicId],
  });
};

const resetFilters = () => {
  searchQuery.value = '';
  viewState.scale = 1;
  viewState.offsetX = 0;
  viewState.offsetY = 0;
  viewState.pixelOffsetX = 0;
  viewState.pixelScale = devicePixelRatio;
  viewState.offsetXChange = 0;
  viewState.scaleChange = 1;
  viewState.minWidth = 1;
  sliderValue.value = 0;
  transform();
  if (myChart) {
    const xStart = viewState.minTime;
    const xEnd = viewState.maxTime;
    const yStart = 0;
    const yEnd = maxY.value;
    isProgrammaticZoom = true;
    myChart.setOption({
      xAxis: {
        min: xStart,
        max: xEnd,
      },
      yAxis: {
        min: yStart,
        max: yEnd,
      },
      dataZoom: [
        {
          id: 'y-slider',
          startValue: yStart,
          endValue: yEnd,
        },
        {
          id: 'x-inside',
          startValue: xStart,
          endValue: xEnd,
        },
        {
          id: 'y-inside',
          startValue: yStart,
          endValue: yEnd,
        },
      ],
      series: [{ data: getChartData() }, { data: getOverlapData() }, { data: getTensorLabelData() }],
    });
    myChart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, startValue: yStart, endValue: yEnd });
    myChart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 1, startValue: xStart, endValue: xEnd });
    myChart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 2, startValue: yStart, endValue: yEnd });
    isProgrammaticZoom = false;
  }
};

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart);
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  disposeMainChart();
});

watch(searchQuery, (value) => {
  clearTimeout(timer);

  timer = setTimeout(() => {
    debouncedSearchQuery.value = value;
    selectedSearchIndex.value = 0;

    if (myChart) {
      myChart.setOption({
        series: [
          {
            id: 'tensors',
            data: getChartData(),
          },
          {
            id: 'tensor-labels',
            data: getTensorLabelData(),
          },
        ],
      });

      navigateToSelectedSearchTensor();

      requestAnimationFrame(() => {
        scheduleSearchOverlayUpdate();
      });
    }
  }, 300);
});

watch(selectedNode, (newVal) => {
  if (!newVal && myChart) {
    myChart.dispatchAction({
      type: 'unselect',
      seriesIndex: 0,
    });
  }
});
const tensorColorMap = {};

const handleNewMemoryData = (newValue) => {
  const data = newValue?.data || newValue;

  if (!data) {
    regionCount.value = 0;
    loading.value = true;
    error.value = false;
    return;
  }

  if (!validateMemoryData(data)) {
    currentMemoryData = null;
    regionCount.value = 0;
    loading.value = false;
    error.value = true;
    disposeMainChart();
    return;
  }

  try {
    currentMemoryData = data;
    const isDark = !!(isDarkTheme && typeof isDarkTheme === 'object' ? isDarkTheme.value : true);
    const { regionLayout } = processIncomingData(
      memoryBlocksRaw,
      overlaps.value,
      tensorColorMap,
      viewState,
      timelineState,
      maxY,
      data,
      isDark,
    );
    regionCount.value = regionLayout.regions.length;
    const conflictResult = detectConflicts(memoryBlocksRaw, searchQuery.value);
    overlaps.value = conflictResult.overlaps;
    loading.value = false;
    error.value = false;
    nextTick(() => {
      if (timelineComponent.value) {
        timelineComponent.value.initCanvases();
        renderTwoTimeline();
      }
      initChart();
      resizeChart();
    });
  } catch {
    currentMemoryData = null;
    regionCount.value = 0;
    loading.value = false;
    error.value = true;
    disposeMainChart();
  }
};

if (server.GmMemoryVisualData) {
  watch(
    server.GmMemoryVisualData,
    (newValue) => {
      handleNewMemoryData(newValue);
    },
    { immediate: true },
  );
}
</script>

<style>
@import url('../swimGraph/css/common.css');
</style>

<style scoped lang="scss" src="./memoryUsage.scss"></style>
