<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
<template>
  <div :style="{ height: isThreeColumn ? '100%' : '100vh' }" class="swim-global-container">
    <Loading v-if="loading" :loading-text="loadingText" />
    <DataError v-if="error" />
    <div
      v-if="!error && !loading"
      :style="{ display: 'flex', flexDirection: 'column', height: isSwimGraphActive && isThreeColumn ? 'calc(100% - 40px)' : '100%' }"
    >
      <div class="filter-toolbar">
        <div style="display: flex; align-items: center">
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input v-model="searchQuery" type="text" :placeholder="'Search'" class="search-input" />
            <div v-if="searchQuery" class="search-action-wrapper">
              <button class="search-clear-btn" title="Clear Search" @click="clearSearch">
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          <div v-if="searchQuery" class="search-nav-container">
            <span class="search-results-count">{{ searchNavigationLabel }}</span>
            <div class="search-nav">
              <d-icon
                name="icon-arrow-left-l"
                class="search-nav-prev"
                :disabled="filteredResultsCount <= 1"
                style="font-size: 16px"
                @click.stop="goToPreviousSearchResult"
              />
              <d-icon
                name="icon-arrow-right-l"
                class="search-nav-next"
                :disabled="filteredResultsCount <= 1"
                style="font-size: 16px"
                @click.stop="goToNextSearchResult"
              />
            </div>
          </div>
        </div>
        <button class="reset-filters-btn" title="Reset all filters" @click="resetFilters">
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
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-4.9L1 10" />
          </svg>
        </button>
      </div>
      <div v-show="!loading" class="head-container" :style="{ display: 'flex', height: '60px', width: '100%' }">
        <div class="title" :style="{ width: layout.processLabelWidth + 'px' }" :class="{ 'title-threeColumn': isThreeColumn }">
          <div v-if="selectedRegionId !== null" @click="leaveRegionDetail" class="region-detail-title">
            <button type="button" class="region-back-btn" aria-label="Back to all regions">
              <d-icon name="icon-arrow-left-l" style="font-size: 24px; width: 24px; height: 24px" />
            </button>
            <span class="region-detail-name">Region <br />ID: {{ selectedRegionId }}</span>
          </div>
        </div>

        <div class="right-header-content" :style="{ width: 'calc(100% - ' + layout.processLabelWidth + 'px)' }">
          <div ref="swimlaneContainer" class="swimlane-container" :class="{ mr16: !isGuidePage }">
            <swim-graph-timeline ref="timelineComponent" :hover-flags="false" />
          </div>
          <swim-graph-config />
        </div>
      </div>

      <div v-show="!loading" class="memory-layout-main" :style="{ height: 'calc(100% - 80px)' }">
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
          <div class="minimap-dashed-line" />
        </div>
        <div class="chart-wrapper">
          <div ref="chartRef" class="echarts-container" :style="{ minHeight: minimumChartHeight + 'px' }" />
          <div
            v-if="tensorContextMenu.visible"
            class="tensor-context-menu"
            role="menu"
            :style="{ left: tensorContextMenu.left + 'px', top: tensorContextMenu.top + 'px' }"
          >
            <button
              type="button"
              role="menuitem"
              class="tensor-context-menu-item"
              @click="activateAdjacentMeasurement"
            >
              <svg class="measurement-mode-icon" aria-hidden="true" viewBox="0 0 16 16">
                <path d="M8 1v14M5 4l3-3 3 3M5 12l3 3 3-3" />
              </svg>
              <span>{{ t('memoryMeasurementMode') }}</span>
            </button>
          </div>
          <div v-if="measurementLabel" class="memory-measurement-status" role="status" aria-live="polite">
            {{ measurementLabel }}
          </div>
          <!-- eslint-disable vue/no-v-html -->
          <div
            v-if="manualTensorTooltipVisible"
            class="manual-tensor-tooltip"
            :style="manualTensorTooltipStyle"
            v-html="manualTensorTooltipHtml"
          />
          <!-- eslint-enable vue/no-v-html -->
        </div>
      </div>
    </div>
    <MemoryUsageSidebar :selected-node="selectedNode" @close="selectedNode = null" />
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
  ensureMinimumVisibleRatio,
} from './utils';
import { validateMemoryData } from './validateMemoryData';
import { createMemoryUsageChildContextMap, provideMemoryUsageSwimGraph } from './memoryUsageProvide';
import { TensorSearchNavigationUtil } from './tensorSearchNavigationUtil';
import { TensorSearchOverlayUtil } from './TensorSearchOverlayUtil';
import { TensorAddressGuide } from './tensorAddressGuide';
import { processIncomingData, formatRawShape, getTensorMagicId, findMemoryTensorsAtPoint } from './memoryDataProcessor';
import { detectConflicts } from './memoryConflictDetection';
import { createConflictPattern, createMemoryChartRenderers, createMinimapRects } from './memoryChartRenderer';
import {
  calculateTensorDistance,
  findAdjacentTensorMeasurements,
  getMeasurementTensorIdentity,
  serializeTensorMeasurement,
} from './memoryDistanceMeasurement';
import { createMemoryRegionRenderers } from './memoryRegionRenderer';
import { formatTimelineTimestamp, formatTimelineUnit, getTimelineLabelPosition, isValidChartTimeRange } from './memoryTimelineUtil';
import { finishPerformanceStage, markPerformance, startPerformanceStage, updatePerformanceFingerprint } from './memoryPerformance';

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

const MIN_REGION_HEIGHT_PX = 30;
const CHART_GRID_VERTICAL_PADDING_PX = 60;

const { server } = useViewServer();
const { isDarkTheme } = inject('root', ref(true));
const { t } = useI18n();
const isGuidePage = ref(false);
const error = ref(false);

watch(isDarkTheme, () => {
  if (myChart) {
    myChart.setOption(getChartOption());
    tensorAddressGuide.render();
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
const isAltDown = ref(false);
const debouncedSearchQuery = ref('');
const memoryBlocksRaw = reactive([]);
const selectedRegionId = ref(null);
let timer = null;

const getActiveMemoryBlocks = () => {
  if (selectedRegionId.value === null) {
    return memoryBlocksRaw;
  }

  return memoryBlocksRaw.filter((item) => Number(item.regionId) === selectedRegionId.value);
};

const filteredResultsCount = computed(() => {
  return TensorSearchNavigationUtil.getSearchMatchedItems(getActiveMemoryBlocks(), debouncedSearchQuery.value).length;
});

const searchNavigationLabel = computed(() => {
  const total = filteredResultsCount.value;

  if (!total) {
    return '0/0';
  }

  return `${selectedSearchIndex.value + 1}/${total}`;
});
const selectedNode = shallowRef(null);
const measurementSelection = shallowRef({ first: null, second: null });
const adjacentMeasurement = shallowRef(null);
const tensorContextMenu = reactive({ visible: false, left: 0, top: 0, tensor: null });
const measurementLabel = computed(() => {
  if (adjacentMeasurement.value) {
    const labels = [adjacentMeasurement.value.above, adjacentMeasurement.value.below]
      .filter(Boolean)
      .map((measurement) => `Addr: ${measurement.distance}`);
    return labels.join(', ');
  }
  const { first, second } = measurementSelection.value;
  const measurement = first && second ? calculateTensorDistance(first, second) : null;
  return measurement ? `Distance: ${measurement.distance}` : '';
});
const chartRef = ref(null);
const maxY = ref(22);
const regionCount = ref(0);
const minimumChartHeight = computed(() => {
  const visibleRegionCount = selectedRegionId.value === null ? regionCount.value : 1;
  if (visibleRegionCount <= 0) {
    return 0;
  }

  const regionHeight = MemoryRegionLayoutUtil.DEFAULT_REGION_HEIGHT;
  const regionGap = MemoryRegionLayoutUtil.DEFAULT_REGION_GAP;
  const layoutHeight = visibleRegionCount * regionHeight + (visibleRegionCount - 1) * regionGap;
  const minimumPlotHeight = (layoutHeight / regionHeight) * MIN_REGION_HEIGHT_PX;

  return Math.ceil(minimumPlotHeight + CHART_GRID_VERTICAL_PADDING_PX);
});

const minimapRects = computed(() => {
  const activeOverlaps = overlaps.value.filter((item) => {
    return selectedRegionId.value === null || Number(item.regionId) === selectedRegionId.value;
  });
  const activeRegion = getSelectedRegion();
  const minimapMaxY = activeRegion ? activeRegion.yEnd - activeRegion.yStart : maxY.value;
  const minimapOverlaps = activeRegion
    ? activeOverlaps.map((item) => ({ ...item, y1: item.y1 - activeRegion.yStart, y2: item.y2 - activeRegion.yStart }))
    : activeOverlaps;

  return createMinimapRects(minimapMaxY, minimapOverlaps, isDarkTheme.value);
});
let myChart = null;
let chartWheelDom = null;
let chartWheelHandler = null;
let currentMemoryData = null;
let hasReceivedMemoryPayload = false;
let isProgrammaticZoom = false;

const overlaps = ref([]);
const patternCache = { B: null, reg: null, stripe: null };
patternCache.B = createConflictPattern();
const tensorColorMap = {};
const getOverlapData = () => {
  return overlaps.value
    .filter((item) => selectedRegionId.value === null || Number(item.regionId) === selectedRegionId.value)
    .map((o) => [o.x1, o.y1, o.x2, o.y2, o.tensors[0] || 'Anonymous', o.tensors[1] || 'Anonymous']);
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

const SINGLE_REGION_LABEL_AREA_WIDTH = 160;
const MULTI_REGION_LABEL_AREA_WIDTH = 155;

const layout = reactive({
  processLabelWidth: MULTI_REGION_LABEL_AREA_WIDTH,
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
      ],
    });
  }
};

const getChartData = () => {
  return TensorSearchNavigationUtil.createChartData(
    getActiveMemoryBlocks(),
    debouncedSearchQuery.value,
    selectedSearchIndex.value,
    formatRawShape,
  );
};

const getMeasuredTensors = () => {
  if (adjacentMeasurement.value) {
    const { anchor, above, below } = adjacentMeasurement.value;
    return [anchor, above?.lower, above?.upper, below?.lower, below?.upper]
      .filter(Boolean)
      .map((entry) => entry.rawObj || entry)
      .filter((entry, index, entries) => entries.indexOf(entry) === index);
  }
  return [measurementSelection.value.first, measurementSelection.value.second].filter(Boolean).map((entry) => entry.rawObj || entry);
};

const getMeasurementHighlightTensors = () => {
  if (!adjacentMeasurement.value) {
    return [];
  }

  const { anchor, above, below } = adjacentMeasurement.value;
  const anchorMagicId = getTensorMagicId(anchor.rawObj || anchor);
  const measuredEntries = [anchor, above?.lower, above?.upper, below?.lower, below?.upper].filter(Boolean);
  const highlightedEntries = getActiveMemoryBlocks().filter((entry) => {
    return getTensorMagicId(entry.rawObj || entry) === anchorMagicId;
  });

  return [...measuredEntries, ...highlightedEntries]
    .map((entry) => entry.rawObj || entry)
    .filter((entry, index, entries) => entries.indexOf(entry) === index);
};

const getMeasurementData = () => {
  if (adjacentMeasurement.value) {
    return [adjacentMeasurement.value.above, adjacentMeasurement.value.below]
      .filter(Boolean)
      .map((measurement) => serializeTensorMeasurement(measurement, `Addr: ${measurement.distance}`));
  }

  const { first, second } = measurementSelection.value;
  if (!first || !second) {
    return [];
  }

  const measurement = calculateTensorDistance(first, second);
  if (!measurement) {
    return [];
  }

  const label = measurementLabel.value.replace(/^Distance:\s*/, '');
  return [serializeTensorMeasurement(measurement, label)];
};

const refreshMeasurementVisuals = () => {
  if (!myChart) {
    return;
  }

  myChart.setOption(
    {
      series: [
        {
          id: 'tensors',
          data: getChartData(),
        },
        {
          id: 'tensor-distance',
          data: getMeasurementData(),
        },
      ],
    },
    { lazyUpdate: false },
  );
};

const clearMeasurement = () => {
  if (!measurementSelection.value.first && !measurementSelection.value.second && !adjacentMeasurement.value) {
    return;
  }

  measurementSelection.value = { first: null, second: null };
  adjacentMeasurement.value = null;
  refreshMeasurementVisuals();
};

const selectMeasurementTensor = (entry) => {
  if (!entry) {
    return;
  }

  adjacentMeasurement.value = null;
  const { first, second } = measurementSelection.value;
  const entryIdentity = entry.rawObj || entry;
  const firstIdentity = first?.rawObj || first;

  if (first && !second && firstIdentity === entryIdentity) {
    return;
  }

  measurementSelection.value = !first || second ? { first: entry, second: null } : { first, second: entry };
  refreshMeasurementVisuals();
};

const closeTensorContextMenu = () => {
  tensorContextMenu.visible = false;
  tensorContextMenu.tensor = null;
};

const activateAdjacentMeasurement = () => {
  const anchor = tensorContextMenu.tensor;
  closeTensorContextMenu();
  if (!anchor) {
    return;
  }

  measurementSelection.value = { first: null, second: null };
  adjacentMeasurement.value = findAdjacentTensorMeasurements(anchor, getActiveMemoryBlocks());
  refreshMeasurementVisuals();
};

const handleMeasurementClick = (directTensor) => {
  if (!directTensor || selectedRegionId.value === null) {
    return;
  }

  const tensorIdentity = getMeasurementTensorIdentity(directTensor);
  const entry = getActiveMemoryBlocks().find((item) => {
    return item.rawObj === directTensor || (tensorIdentity && getMeasurementTensorIdentity(item.rawObj) === tensorIdentity);
  });
  selectMeasurementTensor(entry);
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

  const activeMemoryBlocks = getActiveMemoryBlocks();
  const fullXRange = TensorSearchNavigationUtil.getFullXAxisRange(activeMemoryBlocks, {
    min: timelineState.startTime,
    max: timelineState.endTime,
  });

  const activeYAxisBounds = getActiveYAxisBounds();
  const fullYRange = TensorSearchNavigationUtil.getFullYAxisRange(currentLayoutRegions, activeYAxisBounds);

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
const getSelectedSearchItem = () => {
  return TensorSearchNavigationUtil.getSelectedSearchItem(getActiveMemoryBlocks(), debouncedSearchQuery.value, selectedSearchIndex.value);
};
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

const { renderItem, renderOverlapItem, renderMeasurementItem } = createMemoryChartRenderers({
  getSelectedNode: () => selectedNode.value,
  getMeasuredTensors,
  getMeasurementHighlightTensors,
  getFilteredResultsCount: () => filteredResultsCount.value,
  getIsDarkTheme: () => isDarkTheme.value,
  tensorColorMap,
  patternCache,
});

let currentLayoutRegions = [];
let allLayoutRegions = [];
let hoveredRegionData = [];
let regionLabelHoverAreas = [];
const getSelectedRegion = () => {
  if (selectedRegionId.value === null) {
    return null;
  }

  return allLayoutRegions.find((region) => region.regionId === selectedRegionId.value) || null;
};
const tensorAddressGuide = new TensorAddressGuide({
  getChart: () => myChart,
  getIsDarkTheme: () => isDarkTheme.value,
  getSelectedRegion,
});
const getActiveYAxisBounds = () => {
  const selectedRegion = getSelectedRegion();

  return selectedRegion ? { min: selectedRegion.yStart, max: selectedRegion.yEnd } : { min: 0, max: maxY.value };
};
const formatDetailAddress = (chartY) => {
  const selectedRegion = getSelectedRegion();
  if (!selectedRegion) {
    return '';
  }

  return String(Math.round(MemoryRegionLayoutUtil.toAbsoluteAddress(chartY, selectedRegion)));
};
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
    }
    if (params.seriesId === 'region-axis-labels') {
      return hoveredRegionData ? regionHoverTemplate(hoveredRegionData, isDarkTheme.value) : '';
    }
    if (params.seriesId === 'overlaps') {
      const firstTensor = params.data[4] || 'Anonymous';
      const secondTensor = params.data[5] || 'Anonymous';
      return `Conflict<br/>${firstTensor}<br/>${secondTensor}`;
    }
    if (params.seriesId !== 'tensors') {
      return '';
    }
    return tensorHoverTemplate(params.data, params, isDarkTheme.value);
  },
});
const getSeriesConfig = () => [
  {
    id: 'tensors',
    type: 'custom',
    renderItem,
    encode: { x: [1, 2], y: [3, 4] },
    data: getChartData(),
    progressive: 0,
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
  },
  {
    id: 'overlaps',
    type: 'custom',
    renderItem: renderOverlapItem,
    encode: { x: [0, 2], y: [1, 3] },
    data: getOverlapData(),
    zIndex: 10,
    cursor: 'default',
  },
  {
    id: 'tensor-distance',
    name: 'tensor-distance',
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    renderItem: renderMeasurementItem,
    data: getMeasurementData(),
    encode: { x: [0, 1, 4, 5], y: [2, 3, 6, 7] },
    silent: true,
    z: 300,
    clip: false,
    animation: false,
  },
  {
    id: 'regions',
    name: 'Regions',
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    renderItem: renderRegionLayerItem,
    data: getRegionLayerData(),
    encode: { x: 1, y: 2 },
    silent: true,
    z: 0,
    clip: false,
    animation: false,
  },
  {
    id: 'region-axis-labels',
    name: 'region-axis-labels',
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    renderItem: renderRegionAxisLabelLayerItem,
    data: getRegionLabelLayerData(),
    encode: { x: 1, y: 2 },
    silent: false,
    z: 200,
    animation: false,
  },
];
const getChartOption = () => {
  const stageStart = startPerformanceStage();
  const rawMemoryData = currentMemoryData || server.GmMemoryVisualData?.value;
  const memoryData = rawMemoryData?.data || rawMemoryData || {};
  const regions = memoryData?.meta?.regions || [];
  const { regions: layoutRegions, yMin, yMax } = MemoryRegionLayoutUtil.createRegionLayout(regions);
  allLayoutRegions = layoutRegions;
  const selectedRegion = getSelectedRegion();
  layout.processLabelWidth = selectedRegion ? SINGLE_REGION_LABEL_AREA_WIDTH : MULTI_REGION_LABEL_AREA_WIDTH;
  currentLayoutRegions = selectedRegion ? [selectedRegion] : layoutRegions;
  const activeYMin = selectedRegion ? selectedRegion.yStart : yMin;
  const activeYMax = selectedRegion ? selectedRegion.yEnd : yMax;
  const yAxis = getyAxisConfig(activeYMin, activeYMax, isDarkTheme.value, selectedRegion ? formatDetailAddress : null);
  if (selectedRegion) {
    Object.assign(yAxis.axisLabel, {
      width: 70,
      overflow: 'truncate',
      ellipsis: '...',
    });
  }
  const option = {
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
    yAxis,
    dataZoom: getDataZoomConfig(isDarkTheme.value),
    series: getSeriesConfig(),
  };
  finishPerformanceStage('chartInputConstruction', stageStart);
  updatePerformanceFingerprint({
    seriesRows: option.series.map((series) => ({ id: series.id, rows: series.data.length })),
  });
  return option;
};
const applyRegionView = () => {
  if (!myChart) {
    return;
  }

  const visibleXRange = getVisibleXAxisRange(myChart, timelineState);
  const { min, max } = getActiveYAxisBounds();
  myChart.clear();
  tensorAddressGuide.reset();
  myChart.setOption(getChartOption());
  myChart.dispatchAction({
    type: 'dataZoom',
    batch: [
      { dataZoomId: 'y-slider', startValue: min, endValue: max },
      { dataZoomId: 'x-inside', startValue: visibleXRange.min, endValue: visibleXRange.max },
      { dataZoomId: 'y-inside', startValue: min, endValue: max },
    ],
  });
};
const enterRegionDetail = (regionData) => {
  const regionId = Number(regionData?.[3]);
  if (!Number.isFinite(regionId) || !allLayoutRegions.some((region) => region.regionId === regionId)) {
    return;
  }

  selectedRegionId.value = regionId;
  selectedSearchIndex.value = 0;
  selectedNode.value = null;
  hoveredRegionData = null;
  regionLabelHoverAreas = [];
  clearMeasurement();
  tensorAddressGuide.clear();
  applyRegionView();
  scheduleSearchOverlayUpdate();
};
const leaveRegionDetail = () => {
  selectedRegionId.value = null;
  resetFilters();
};
const { getRegionLabelLayerData, renderRegionAxisLabelLayerItem, renderRegionLayerItem } = createMemoryRegionRenderers({
  getChart: () => myChart,
  getCurrentRegions: () => currentLayoutRegions,
  getIsDarkTheme: () => isDarkTheme.value,
  getMaxY: () => maxY.value,
  getSelectedRegionId: () => selectedRegionId.value,
  getTimelineState: () => timelineState,
  setHoverAreas: (areas) => {
    regionLabelHoverAreas = areas;
  },
});
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
  const visibleYRange = selectedRegionId.value === null ? getVisibleYAxisRange(myChart, maxY.value) : getActiveYAxisBounds();

  const xCenter = (visibleXMin + visibleXMax) / 2;
  const yCenter = (visibleYRange.min + visibleYRange.max) / 2;

  return [['regions-layer', xCenter, yCenter]];
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

  const activeBounds = getActiveYAxisBounds();
  if (nextMin < activeBounds.min) {
    nextMax += activeBounds.min - nextMin;
    nextMin = activeBounds.min;
  }

  if (nextMax > activeBounds.max) {
    const overflow = nextMax - activeBounds.max;
    nextMin -= overflow;
    nextMax = activeBounds.max;
  }

  nextMin = Math.max(activeBounds.min, nextMin);
  nextMax = Math.min(activeBounds.max, nextMax);

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
    return getActiveYAxisBounds();
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
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      const nextX = fixedTimeToX(time + gridInterval) - layout.processLabelWidth;
      const segmentWidth = (nextX - x) / 10;
      for (let i = 1; i < 10; i++) {
        const segmentX = x + i * segmentWidth;
        if (segmentX <= 0 || segmentX >= canvasWidth) {
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(segmentX, 20);
        ctx.lineTo(segmentX, 10);
        ctx.stroke();
      }

      const { value, unit } = formatTimelineUnit(viewState.timeRange, time - viewState.minTime, gridInterval);
      ctx.fillStyle = isDarkTheme.value ? '#cccccc' : 'rgba(25, 25, 25, 1)';
      ctx.font = '14px Arial';
      if (x < startTimex || x > endTimex) {
        ctx.fillStyle = isDarkTheme.value ? 'rgba(102, 102, 102, 0.8)' : 'rgba(102, 102, 102, 0.8)';
      }
      const label = `${value}${unit}`;
      const labelPosition = getTimelineLabelPosition(ctx, [label, xToTimeValue(time)], x, canvasWidth, lastLabelRight);
      if (!labelPosition) {
        continue;
      }

      ctx.fillText(label, labelPosition.x, 15);
      lastLabelRight = labelPosition.right;
    }
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
  return formatTimelineTimestamp(time, viewState.minTime);
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
      const { value, unit } = formatTimelineUnit(timelineTimeRange, time - timelineState.startTime, gridInterval);
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
  window.addEventListener('keydown', handleWindowKeyDown);
  window.addEventListener('keyup', handleWindowKeyUp);
  window.addEventListener('mousedown', handleWindowMouseDown, true);
  window.addEventListener('blur', clearModifierKeys);
});

const handleWindowKeyDown = (event) => {
  if (event.key === 'Escape') {
    closeTensorContextMenu();
  }
  if (event.key === 'Alt') {
    isAltDown.value = true;
  }
};

const handleWindowKeyUp = (event) => {
  if (event.key === 'Alt') {
    isAltDown.value = false;
  }
};

const handleWindowMouseDown = (event) => {
  isAltDown.value = Boolean(event.altKey);
  if (!event.target?.closest?.('.tensor-context-menu')) {
    closeTensorContextMenu();
  }
};

const clearModifierKeys = () => {
  isAltDown.value = false;
  isCtrlDown.value = false;
};

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
  tensorAddressGuide.reset();
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

const initChart = (onRendered) => {
  if (!chartRef.value) {
    return;
  }
  disposeMainChart();
  myChart = echarts.init(chartRef.value);
  const chart = myChart;
  let hasReportedRender = false;
  const reportRendered = () => {
    if (hasReportedRender || chart !== myChart) {
      return;
    }
    hasReportedRender = true;
    finishPerformanceStage('echartsRender', renderStartedAt);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        markPerformance('paintedReady');
        onRendered?.();
      });
    });
  };

  myChart.on('finished', reportRendered);
  const chartOption = getChartOption();
  const renderStartedAt = startPerformanceStage();
  chart.setOption(chartOption);

  const chartDom = myChart.getDom();

  attachChartWheelListener(chartDom);
  myChart.on('datazoom', (params) => {
    closeTensorContextMenu();
    scheduleSearchOverlayUpdate();
    tensorAddressGuide.render();

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
    closeTensorContextMenu();
    const offsetX = Number(params.event?.offsetX);
    const offsetY = Number(params.event?.offsetY);
    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
      return;
    }

    if (findHoveredRegionData(offsetX, offsetY)) {
      return;
    }

    const point = myChart.convertFromPixel({ gridIndex: 0 }, [offsetX, offsetY]);
    if (!Array.isArray(point) || point.length < 2) {
      return;
    }

    const nativeEvent = params.event?.event || params.event || {};
    const isAltClick = Boolean(nativeEvent.altKey || isAltDown.value);
    const directTensor = params.seriesId === 'tensors' ? params.data?.at?.(17) : null;

    if (isAltClick && directTensor) {
      if (selectedRegionId.value !== null) {
        handleMeasurementClick(directTensor);
      }
      return;
    }

    if (!isAltClick && (params.seriesId === 'tensors' || params.seriesId === 'overlaps')) {
      clearMeasurement();
    }

    const overlapBounds = params.seriesId === 'overlaps' ? params.data : null;
    dimDetails(point, directTensor, overlapBounds);
  });

  myChart.on('contextmenu', (params) => {
    const nativeEvent = params.event?.event || params.event || {};
    nativeEvent.preventDefault?.();
    if (params.seriesId !== 'tensors') {
      closeTensorContextMenu();
      return;
    }

    const tensor = params.data?.at?.(17);
    const tensorIdentity = getMeasurementTensorIdentity(tensor);
    const anchor = getActiveMemoryBlocks().find((entry) => {
      return entry.rawObj === tensor || (tensorIdentity && getMeasurementTensorIdentity(entry.rawObj) === tensorIdentity);
    });
    const offsetX = Number(params.event?.offsetX);
    const offsetY = Number(params.event?.offsetY);
    if (!anchor || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
      closeTensorContextMenu();
      return;
    }

    const chartWidth = chartRef.value?.clientWidth || myChart.getWidth();
    const chartHeight = chartRef.value?.clientHeight || 0;
    tensorContextMenu.left = Math.max(4, Math.min(offsetX, chartWidth - 188));
    tensorContextMenu.top = Math.max(4, Math.min(offsetY, chartHeight - 46));
    tensorContextMenu.tensor = anchor;
    tensorContextMenu.visible = true;
  });

  myChart.on('mouseover', { seriesId: 'tensors' }, (params) => {
    tensorAddressGuide.show(params.data);
  });

  myChart.on('mouseout', { seriesId: 'tensors' }, (params) => {
    tensorAddressGuide.clearForRow(params.data);
  });

  myChart.getZr().on('mousemove', (event) => {
    const regionData = findHoveredRegionData(event.offsetX, event.offsetY);

    hoveredRegionData = regionData;
  });

  myChart.getZr().on('click', (event) => {
    if (event?.target) {
      return;
    }

    closeTensorContextMenu();
    clearMeasurement();
  });

  myChart.getZr().on('globalout', () => {
    hoveredRegionData = null;
    tensorAddressGuide.clear();
  });

  myChart.getZr().on('dblclick', (event) => {
    const regionData = findHoveredRegionData(event.offsetX, event.offsetY);
    if (regionData) {
      enterRegionDetail(regionData);
    }
  });
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
    tensorAddressGuide.render();
  }
  if (timelineComponent.value) {
    renderTwoTimeline();
    timelineComponent.value.flagRender();
  }
};

const getDetailTensorId = (tensor, sourceIndex) => {
  const identity = [
    tensor?.instanceId,
    tensor?.rawId,
    getTensorMagicId(tensor),
    tensor?.base,
    tensor?.end,
    tensor?.lifeStart,
    tensor?.lifeEnd,
  ]
    .filter((value) => value !== undefined && value !== null && String(value) !== '')
    .join('|');
  return `${identity || 'tensor'}|${sourceIndex}`;
};

const dimDetails = (point, directTensor = null, overlapBounds = null) => {
  const [x, y] = point.map(Number);
  const activeMemoryBlocks = getActiveMemoryBlocks();
  let matches = findMemoryTensorsAtPoint(activeMemoryBlocks, x, y);
  const directEntry = directTensor ? activeMemoryBlocks.find((entry) => entry.rawObj === directTensor) : null;

  if (directEntry && !matches.includes(directEntry)) {
    matches.unshift(directEntry);
  }

  if (matches.length < 2 && Array.isArray(overlapBounds)) {
    const overlapX = (Number(overlapBounds[0]) + Number(overlapBounds[2])) / 2;
    const overlapY = (Number(overlapBounds[1]) + Number(overlapBounds[3])) / 2;
    const overlapMatches = findMemoryTensorsAtPoint(activeMemoryBlocks, overlapX, overlapY);
    if (overlapMatches.length >= 2) {
      matches = overlapMatches;
    }
  }

  if (!matches.length) {
    return;
  }

  const raw = currentMemoryData || server.GmMemoryVisualData?.value || server.GmMemoryVisualData;
  const root = raw?.data || raw;
  selectedNode.value = markRaw({
    meta: root?.meta,
    tensors: matches.map((entry, index) => {
      const tensor = entry.rawObj;
      const magicId = getTensorMagicId(tensor);
      const sourceIndex = memoryBlocksRaw.indexOf(entry);
      return {
        id: getDetailTensorId(tensor, sourceIndex),
        label: magicId ? `RawTensor${magicId}` : `Tensor ${index + 1}`,
        rawTensor: tensor,
        color: tensorColorMap[magicId],
      };
    }),
  });
};

const resetFilters = () => {
  clearMeasurement();
  tensorAddressGuide.clear();
  searchQuery.value = '';
  debouncedSearchQuery.value = '';
  selectedSearchIndex.value = 0;
  viewState.scale = 1;
  viewState.offsetX = 0;
  viewState.offsetY = 0;
  viewState.pixelOffsetX = 0;
  viewState.pixelScale = devicePixelRatio;
  viewState.offsetXChange = 0;
  viewState.scaleChange = 1;
  viewState.minWidth = 1;
  sliderValue.value = 0;
  timelineState.startTime = viewState.minTime;
  timelineState.startTimeDecimal = viewState.minTime;
  timelineState.endTime = viewState.maxTime;
  timelineState.endTimeDecimal = viewState.maxTime;
  if (myChart) {
    const xStart = viewState.minTime;
    const xEnd = viewState.maxTime;
    const { min: yStart, max: yEnd } = getActiveYAxisBounds();
    isProgrammaticZoom = true;
    myChart.clear();
    tensorAddressGuide.reset();
    myChart.setOption(getChartOption());
    myChart.dispatchAction({
      type: 'dataZoom',
      batch: [
        { dataZoomId: 'y-slider', startValue: yStart, endValue: yEnd },
        { dataZoomId: 'x-inside', startValue: xStart, endValue: xEnd },
        { dataZoomId: 'y-inside', startValue: yStart, endValue: yEnd },
      ],
    });
    isProgrammaticZoom = false;
  }
  renderTwoTimeline();
  timelineComponent.value?.flagRender();
};

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart);
  window.removeEventListener('keydown', handleWindowKeyDown);
  window.removeEventListener('keyup', handleWindowKeyUp);
  window.removeEventListener('mousedown', handleWindowMouseDown, true);
  window.removeEventListener('blur', clearModifierKeys);
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  clearMeasurement();
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
const handleNewMemoryData = (newValue) => {
  if (newValue?.performance && !window.__gmMemoryPerformance) {
    window.__gmMemoryPerformance = {
      fingerprint: {},
      longTasks: [],
      marks: {},
      stages: {},
    };
  }
  markPerformance('dataReceived');
  const rawData = newValue?.data ?? newValue;

  if (rawData === undefined || rawData === null) {
    if (hasReceivedMemoryPayload) {
      return;
    }
    regionCount.value = 0;
    loading.value = true;
    error.value = false;
    return;
  }
  hasReceivedMemoryPayload = true;
  selectedRegionId.value = null;
  selectedNode.value = null;
  tensorAddressGuide.clear();
  clearMeasurement();

  let data = rawData;
  if (typeof rawData === 'string') {
    const parseStartedAt = startPerformanceStage();
    try {
      data = JSON.parse(rawData);
    } catch {
      finishPerformanceStage('jsonParse', parseStartedAt);
      currentMemoryData = null;
      regionCount.value = 0;
      loading.value = false;
      error.value = true;
      disposeMainChart();
      return;
    }
    finishPerformanceStage('jsonParse', parseStartedAt);
  }

  const validationStartedAt = startPerformanceStage();
  const isValid = validateMemoryData(data);
  finishPerformanceStage('validation', validationStartedAt);
  if (!isValid) {
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
    const processingStartedAt = startPerformanceStage();
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
    finishPerformanceStage('dataProcessing', processingStartedAt);
    regionCount.value = regionLayout.regions.length;
    const conflictsStartedAt = startPerformanceStage();
    const conflictResult = detectConflicts(memoryBlocksRaw, searchQuery.value);
    finishPerformanceStage('conflictDetection', conflictsStartedAt);
    overlaps.value = conflictResult.overlaps;
    updatePerformanceFingerprint({
      acceptedTensorCount: memoryBlocksRaw.length,
      conflictCount: conflictResult.overlaps.length,
      regionCount: regionLayout.regions.length,
      timelineBounds: { max: viewState.maxTime, min: viewState.minTime },
    });
    loading.value = false;
    error.value = false;
    nextTick(() => {
      if (timelineComponent.value) {
        timelineComponent.value.initCanvases();
        renderTwoTimeline();
      }
      initChart(() => {
        const performanceRun = window.__gmMemoryPerformance;
        server.reportGmMemoryVisualReady?.({
          tensorCount: memoryBlocksRaw.length,
          regionCount: regionLayout.regions.length,
          hasChart: !!myChart,
          ...(performanceRun
            ? {
                performance: {
                  fingerprint: performanceRun.fingerprint,
                  marks: performanceRun.marks,
                  stages: performanceRun.stages,
                },
              }
            : {}),
        });
      });
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
