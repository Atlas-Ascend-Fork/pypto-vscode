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
  <transition name="sidebar-slide">
    <div
      v-if="selectedNode"
      class="right-sidebar"
      :class="{ resizing: isResizing, 'theme-dark': isDarkTheme.value, 'theme-light': !isDarkTheme.value }"
      :style="{
        width: sidebarWidth + 'px',
        backgroundColor: sidebarBgColor,
        color: sidebarTextColor,
        borderLeftColor: sidebarBorderColor,
        boxShadow: sidebarBoxShadow,
      }"
    >
      <div class="resize-handle" @mousedown="startResize">
        <div class="resize-grip" :style="{ backgroundColor: resizeGripBgColor, boxShadow: resizeGripBoxShadow }">
          <span :style="{ backgroundColor: resizeGripDotColor }" />
          <span :style="{ backgroundColor: resizeGripDotColor }" />
          <span :style="{ backgroundColor: resizeGripDotColor }" />
        </div>
      </div>

      <div ref="sidebarHeaderRef" class="sidebar-header">
        <button
          class="tab-nav-btn"
          type="button"
          title="Previous tensor"
          aria-label="Previous tensor"
          :disabled="!canSelectPreviousTensor"
          @click="selectRelativeTensor(-1)"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M10 3 5 8l5 5" />
          </svg>
        </button>
        <div ref="tabsViewportRef" class="tensor-tabs" role="tablist" aria-label="Tensors">
          <button
            v-for="entry in tensorEntries"
            :key="entry.id"
            class="tensor-tab"
            :class="{ active: entry.id === activeTensorId }"
            role="tab"
            :aria-selected="entry.id === activeTensorId"
            :title="entry.label"
            @click="selectTensor(entry.id, $event.currentTarget)"
            @mouseenter="showTensorPreview(entry, $event.currentTarget)"
            @mouseleave="hideTensorPreview"
            @focus="showTensorPreview(entry, $event.currentTarget)"
            @blur="hideTensorPreview"
          >
            <svg class="tensor-icon" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2">
              <path d="m8 1.5 5.5 3.2v6.6L8 14.5l-5.5-3.2V4.7L8 1.5Z" />
              <path d="m2.7 4.8 5.3 3 5.3-3M8 7.8v6.4" />
            </svg>
            <span class="tensor-tab-label">{{ entry.label }}</span>
          </button>
        </div>
        <button
          class="tab-nav-btn"
          type="button"
          title="Next tensor"
          aria-label="Next tensor"
          :disabled="!canSelectNextTensor"
          @click="selectRelativeTensor(1)"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
        <label class="filter-switch" :style="{ color: metaTagColor }">
          <d-switch v-model="writesOnly" aria-label="Show writes only" />
          <span>{{ $t('writesOnly') }}</span>
        </label>
        <button
          class="close-btn"
          type="button"
          aria-label="Close panel"
          :style="{ color: closeBtnColor }"
          @click="$emit('close')"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            stroke="currentColor"
            stroke-width="2.5"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div v-if="previewTensorEntry" class="tensor-preview" :style="{ left: previewLeft + 'px' }" role="tooltip">
          <div class="tensor-preview-title">{{ previewTensorEntry.label }}</div>
          <div class="tensor-preview-row">
            <span>MagicID:</span>
            <strong>{{ getTensorMagicId(previewTensorEntry.rawTensor) || '-' }}</strong>
          </div>
          <div class="tensor-preview-row">
            <span>Shape:</span>
            <strong>[{{ (previewTensorEntry.rawTensor?.rawShape || []).join(',') }}]</strong>
          </div>
        </div>
      </div>

      <div class="memory-zoom-controls" :style="{ backgroundColor: chartBgColor }">
        <div
          ref="controlChartRef"
          class="echarts-dom memory-control-chart"
          :style="{ height: CONTROL_HEIGHT + 'px', backgroundColor: chartBgColor }"
        />
      </div>
      <div class="sidebar-body-wrapper">
        <div
          ref="chartRef"
          class="echarts-dom memory-lane-chart"
          :data-zoom-end="zoomRange.end"
          :data-zoom-start="zoomRange.start"
          :style="{ height: domHeight + 'px', backgroundColor: chartBgColor }"
          @mousedown.capture="startLanePan"
        />
      </div>
    </div>
  </transition>
</template>

<script>
const MAX_EXACT_OVERLAP_INPUT_ROWS = 2500;
const MAX_OVERLAP_RECTS_PER_DIM = 8000;
const MAX_INLINE_LABEL_ROWS_PER_DIM = 80;
const OVERLAP_EPSILON = 1e-9;

function isValidRange(start, end) {
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

function isValidAccessRow(xStart, xEnd, yStart, yEnd) {
  return isValidRange(xStart, xEnd) && isValidRange(yStart, yEnd);
}

function normalizeOptionalTime(value, normalizeTime) {
  return value != null ? normalizeTime(value) : null;
}

function hasNonEmptyValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function toFiniteNumber(value) {
  if (!hasNonEmptyValue(value)) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getTensorMagicId(tensor) {
  const magicId = tensor?.rawmagic ?? tensor?.actual_rawmagic;
  return hasNonEmptyValue(magicId) ? String(magicId) : '';
}

function hasValidRawShape(rawShape) {
  return Array.isArray(rawShape) && rawShape.length > 0 && rawShape.every((dim) => toFiniteNumber(dim) !== null);
}

function isValidSidebarTensor(tensor) {
  const lifeStart = toFiniteNumber(tensor?.lifeStart);
  const lifeEnd = toFiniteNumber(tensor?.lifeEnd);

  return lifeStart !== null && lifeEnd !== null && lifeStart < lifeEnd && hasValidRawShape(tensor?.rawShape) && !!getTensorMagicId(tensor);
}

function isValidSidebarAccess(access) {
  return (
    hasNonEmptyValue(access?.rawmagic ?? access?.actual_rawmagic) &&
    hasNonEmptyValue(access?.execStart) &&
    hasNonEmptyValue(access?.execEnd) &&
    typeof access?.isWrite === 'boolean'
  );
}

function buildOverlappedXRanges(activeIndexes, rows) {
  if (activeIndexes.size < 2) {
    return [];
  }

  const xEvents = [];
  activeIndexes.forEach((idx) => {
    const [, xStart, xEnd] = rows[idx];
    xEvents.push([xStart, 1]);
    xEvents.push([xEnd, -1]);
  });
  xEvents.sort((a, b) => a[0] - b[0]);

  const ranges = [];
  let count = 0;
  let prevX = null;
  let i = 0;

  while (i < xEvents.length) {
    const [x] = xEvents[i];

    if (prevX !== null && x > prevX && count >= 2) {
      ranges.push([prevX, x]);
    }

    let delta = 0;
    while (i < xEvents.length) {
      const [eventX, eventDelta] = xEvents[i];
      if (eventX !== x) {
        break;
      }
      delta += eventDelta;
      i++;
    }

    count += delta;
    prevX = x;
  }

  return ranges;
}

function nearlyEqual(a, b) {
  return Math.abs(a - b) <= OVERLAP_EPSILON;
}

function isFullAccessRowOverlap(activeIndexes, rows, coordinates) {
  for (const idx of activeIndexes) {
    const [, rowXStart, rowXEnd, rowYStart, rowYEnd] = rows[idx];
    const isEqualX = nearlyEqual(rowXStart, coordinates.xStart) && nearlyEqual(rowXEnd, coordinates.xEnd);
    const isEqualY = nearlyEqual(rowYStart, coordinates.yStart) && nearlyEqual(rowYEnd, coordinates.yEnd);
    if (isEqualX && isEqualY) {
      return true;
    }
  }

  return false;
}

function appendOverlapRow(overlapRows, mergeByRange, dim, range) {
  const { xStart, xEnd, yStart, yEnd } = range;
  const key = `${xStart}|${xEnd}`;
  const previous = mergeByRange.get(key);

  if (previous && nearlyEqual(previous[4], yStart) && previous[5] === range.hasBorder) {
    previous[4] = yEnd;
    return false;
  }

  const overlap = [dim, xStart, xEnd, yStart, yEnd, range.hasBorder ? 1 : 0];
  overlapRows.push(overlap);
  mergeByRange.set(key, overlap);
  return overlapRows.length >= MAX_OVERLAP_RECTS_PER_DIM;
}

function buildDimOverlapRows(rows) {
  if (rows.length < 2 || rows.length > MAX_EXACT_OVERLAP_INPUT_ROWS) {
    return [];
  }

  const events = [];
  rows.forEach((row, idx) => {
    const [, , , yStart, yEnd] = row;
    events.push([yStart, 1, idx]);
    events.push([yEnd, -1, idx]);
  });
  events.sort((a, b) => a[0] - b[0]);

  const activeIndexes = new Set();
  const overlapRows = [];
  const mergeByRange = new Map();
  let prevY = null;
  let i = 0;

  while (i < events.length) {
    const [y] = events[i];

    if (prevY !== null && y > prevY && activeIndexes.size >= 2) {
      const xRanges = buildOverlappedXRanges(activeIndexes, rows);
      const [[dim]] = rows;

      for (const [xStart, xEnd] of xRanges) {
        const hasBorder = !isFullAccessRowOverlap(activeIndexes, rows, { xStart, xEnd, yStart: prevY, yEnd: y });
        if (appendOverlapRow(overlapRows, mergeByRange, dim, { xStart, xEnd, yStart: prevY, yEnd: y, hasBorder })) {
          return overlapRows;
        }
      }
    }

    while (i < events.length) {
      const [eventY] = events[i];
      if (eventY !== y) {
        break;
      }
      const [, type, idx] = events[i];
      if (type > 0) {
        activeIndexes.add(idx);
      } else {
        activeIndexes.delete(idx);
      }
      i++;
    }

    prevY = y;
  }

  return overlapRows;
}

function buildOverlapRows(rows, ndim, checkHasOverlap = ENABLE_HAS_OVERLAP_CHECK) {
  const rowsByDim = Array.from({ length: ndim }, () => []);
  rows.forEach((row) => {
    const [dim, , , , , , , , , , hasOverlap] = row;
    if (rowsByDim[dim] && (!checkHasOverlap || hasOverlap)) {
      rowsByDim[dim].push(row);
    }
  });

  return rowsByDim.map((dimRows) => buildDimOverlapRows(dimRows));
}

function buildAccessRow(tShape, access, dim, accessContext) {
  if (!isValidSidebarAccess(access)) {
    return null;
  }

  const { dimRanges, size, normalizeTime } = accessContext;
  const cells = tShape[dim];
  if (!cells) {
    return null;
  }

  const off = access?.offset || [];
  const ash = access?.shape || [];
  const accessStart = normalizeOptionalTime(access?.execStart, normalizeTime);
  const accessEnd = normalizeOptionalTime(access?.execEnd, normalizeTime);
  const perCell = size / cells;
  const o = off[dim] ?? 0;
  const s = ash[dim] ?? 0;
  const xStart = o * perCell;
  const xEnd = (o + s) * perCell;
  const yStart = Number.isFinite(accessStart) ? Math.max(dimRanges[dim].yMin, accessStart) : dimRanges[dim].yMin;
  const yEnd = Number.isFinite(accessEnd) ? Math.min(dimRanges[dim].yMax, accessEnd) : dimRanges[dim].yMax;

  if (!isValidAccessRow(xStart, xEnd, yStart, yEnd)) {
    return null;
  }
  return [dim, xStart, xEnd, yStart, yEnd, access?.seqNo ?? '', access?.funcId ?? '', access?.opIdx ?? '', access?.isWrite, 1, access?.hasOverlap];
}

function buildChartModel(input, writesOnly) {
  let src = input;
  if (input && !Array.isArray(input.rawTensors) && Array.isArray(input.accesses)) {
    src = { meta: { t0: input.t0 ?? 0 }, rawTensors: [input]};
  }

  const t0 = src?.meta?.t0 ?? 0;
  const timeUnit = isNaN(Number(src?.meta?.timeUnit)) ? 1 : Number(src?.meta?.timeUnit);
  const normalizeTime = (value) => (Number(value) - t0) / timeUnit;
  const tensors = (src?.rawTensors || []).filter(isValidSidebarTensor);
  const first = tensors[0] || {};

  const shapeOf = (t) => t?.rawShape ?? [];
  const firstShape = shapeOf(first);
  const ndim = first?.ndim ?? firstShape.length;
  const size = first?.size ?? 0;

  let lifeMin = Infinity;
  let lifeMax = -Infinity;
  tensors.forEach((t) => {
    if (t?.lifeStart != null) {
      lifeMin = Math.min(lifeMin, normalizeTime(t.lifeStart));
    }
    if (t?.lifeEnd != null) {
      lifeMax = Math.max(lifeMax, normalizeTime(t.lifeEnd));
    }
  });
  if (!Number.isFinite(lifeMin) || !Number.isFinite(lifeMax) || lifeMin >= lifeMax) {
    lifeMin = 0;
    lifeMax = 1;
  }

  const dimRanges = [];
  for (let i = 0; i < ndim; i++) {
    dimRanges.push({ yMin: lifeMin, yMax: lifeMax });
  }

  const dimXMax = [];
  for (let i = 0; i < ndim; i++) {
    dimXMax.push(size);
  }

  const rows = [];
  const rowCountsByDim = Array.from({ length: ndim }, () => 0);
  tensors.forEach((t) => {
    const tShape = shapeOf(t);
    (t?.accesses || []).forEach((a) => {
      if (writesOnly && !a.isWrite) {
        return;
      }

      for (let i = 0; i < ndim; i++) {
        const row = buildAccessRow(tShape, a, i, { dimRanges, size, normalizeTime });
        if (!row) {
          continue;
        }

        rowCountsByDim[i]++;
        rows.push(row);
      }
    });
  });

  rows.forEach((row) => {
    const [dim] = row;
    row[9] = rowCountsByDim[dim] <= MAX_INLINE_LABEL_ROWS_PER_DIM ? 1 : 0;
  });

  return {
    magicId: getTensorMagicId(first),
    ndim,
    shape: firstShape,
    dimRanges,
    dimXMax,
    rows,
    overlapRows: buildOverlapRows(rows, ndim),
    sizeBytes: size,
    sizeKB: size / 1024,
  };
}
</script>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick, inject } from 'vue';
import * as echarts from 'echarts';
import { ENABLE_HAS_OVERLAP_CHECK } from './memoryFeatureFlags';

const props = defineProps({
  selectedNode: { type: Object, default: null },
});

defineEmits(['close']);

const { isDarkTheme } = inject('root', ref(true));

const ADDR_MIN = 850000;
const ADDR_MAX = 1250000;
const X_MAX_FALLBACK = 20;

const sidebarBgColor = computed(() => (isDarkTheme.value ? '#1a1a1a' : '#ffffff'));
const sidebarTextColor = computed(() => (isDarkTheme.value ? '#e0e0e0' : '#191919'));
const sidebarBorderColor = computed(() => (isDarkTheme.value ? '#2d2d2d' : '#dfdfdf'));
const sidebarBoxShadow = computed(() => (isDarkTheme.value ? '-10px 0 30px rgba(0, 0, 0, 0.65)' : '-10px 0 30px rgba(0, 0, 0, 0.15)'));
const resizeGripBgColor = computed(() => (isDarkTheme.value ? '#2a2a2a' : '#e0e0e0'));
const resizeGripBoxShadow = computed(() => (isDarkTheme.value ? '0 1px 4px rgba(0, 0, 0, 0.5)' : '0 1px 4px rgba(0, 0, 0, 0.2)'));
const resizeGripDotColor = computed(() => (isDarkTheme.value ? '#9a9a9a' : '#666666'));
const closeBtnColor = computed(() => (isDarkTheme.value ? '#888888' : '#666666'));
const metaTagColor = computed(() => (isDarkTheme.value ? '#888888' : '#666666'));
const chartBgColor = computed(() => (isDarkTheme.value ? '#1a1a1a' : '#ffffff'));

const tensorEntries = computed(() => {
  if (Array.isArray(props.selectedNode?.tensors)) {
    return props.selectedNode.tensors;
  }

  return (props.selectedNode?.rawTensors || []).map((rawTensor, index) => ({
    id: `${getTensorMagicId(rawTensor) || 'tensor'}|${index}`,
    label: rawTensor?.rawId || getTensorMagicId(rawTensor) || `Tensor ${index + 1}`,
    rawTensor,
    color: props.selectedNode?.color,
  }));
});
const activeTensorId = ref('');
const activeTensorEntry = computed(() => tensorEntries.value.find((entry) => entry.id === activeTensorId.value) || tensorEntries.value[0]);
const activeTensorIndex = computed(() => tensorEntries.value.findIndex((entry) => entry.id === activeTensorEntry.value?.id));
const canSelectPreviousTensor = computed(() => activeTensorIndex.value > 0);
const canSelectNextTensor = computed(() => activeTensorIndex.value >= 0 && activeTensorIndex.value < tensorEntries.value.length - 1);
const activeNode = computed(() => ({
  meta: props.selectedNode?.meta,
  rawTensors: activeTensorEntry.value ? [activeTensorEntry.value.rawTensor] : [],
}));
const writesOnly = ref(true);
const model = computed(() => buildChartModel(activeNode.value, writesOnly.value));
const sidebarHeaderRef = ref(null);
const tabsViewportRef = ref(null);
const previewTensorEntry = ref(null);
const previewLeft = ref(0);

const CONTROL_HEIGHT = 140;
const CONTROL_GRID_TOP = 102;
const TOP = 40;
const LANE_H = 165;
const LANE_GAP = 70;
const BOTTOM = 30;
const GRID_LEFT = 110;
const GRID_RIGHT = 30;
const CARD_LINE = 56 / 3;
const CARD_FONT = 12;
const CARD_PAD_L = 10;
const CARD_PAD_T = 11;
const CARD_PAD_R = 27;
const CARD_PAD_B = 8;
const CARD_LABEL_LINE_COUNT = 3;
const CARD_LABEL_MIN_WIDTH = 50;
const CARD_LABEL_MIN_HEIGHT = CARD_PAD_T + CARD_LINE * (CARD_LABEL_LINE_COUNT - 1) + CARD_FONT + CARD_PAD_B;
const STRIPE_OPACITY = 0.35;
const CONFLICT_BORDER_COLOR = '#ff1f2d';

const MIN_WIDTH = 480;
const sidebarWidth = ref(initWidth());
const isResizing = ref(false);
let dragStartX = 0;
let dragStartWidth = 0;

function initWidth() {
  if (typeof window === 'undefined') {
    return 640;
  }
  const half = Math.round(window.innerWidth * 0.5);
  return Math.max(MIN_WIDTH, Math.min(880, half));
}

function maxWidth() {
  if (typeof window === 'undefined') {
    return 1400;
  }
  return Math.min(window.innerWidth - 60, 1600);
}

function startResize(e) {
  isResizing.value = true;
  dragStartX = e.clientX;
  dragStartWidth = sidebarWidth.value;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'ew-resize';
  window.addEventListener('mousemove', onResize);
  window.addEventListener('mouseup', stopResize);
}

function onResize(e) {
  const delta = dragStartX - e.clientX;
  let w = dragStartWidth + delta;
  w = Math.max(MIN_WIDTH, Math.min(maxWidth(), w));
  sidebarWidth.value = w;
}

function stopResize() {
  isResizing.value = false;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  window.removeEventListener('mousemove', onResize);
  window.removeEventListener('mouseup', stopResize);
  rebuildCharts();
}

const controlChartRef = ref(null);
const chartRef = ref(null);
let controlChart = null;
let myChart = null;
let chartWheelDom = null;
let chartWheelHandler = null;
const zoomRange = ref({ start: 0, end: 0 });
const dimLabels = () => Array.from({ length: model.value.ndim }, (_, i) => `Dim_${i}`);
const gridTop = (i) => TOP + i * (LANE_H + LANE_GAP);
const domHeight = ref(computeHeight());
function computeHeight() {
  const n = model.value.ndim;
  return TOP + n * LANE_H + (n - 1) * LANE_GAP + BOTTOM;
}

function dimRange(i) {
  return model.value.dimRanges[i] || { yMin: ADDR_MIN, yMax: ADDR_MAX };
}
function dimX(i) {
  const arr = model.value.dimXMax;
  return arr[i] != null ? arr[i] : X_MAX_FALLBACK;
}

function resetZoomRange() {
  zoomRange.value = { start: 0, end: Math.max(0, Number(model.value.sizeBytes) || 0) };
}

function scrollTensorIntoView(element) {
  element?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function selectTensor(id, element) {
  if (id === activeTensorId.value) {
    scrollTensorIntoView(element);
    return;
  }
  activeTensorId.value = id;
  domHeight.value = computeHeight();
  resetZoomRange();
  nextTick(() => {
    scrollTensorIntoView(element);
    rebuildCharts(true);
  });
}

function selectRelativeTensor(direction) {
  const nextIndex = activeTensorIndex.value + direction;
  const entry = tensorEntries.value[nextIndex];
  if (!entry) {
    return;
  }

  selectTensor(entry.id, tabsViewportRef.value?.children?.[nextIndex]);
}

function showTensorPreview(entry, element) {
  previewTensorEntry.value = entry;
  const headerRect = sidebarHeaderRef.value?.getBoundingClientRect();
  const tabRect = element?.getBoundingClientRect();
  if (!headerRect || !tabRect) {
    previewLeft.value = 40;
    return;
  }

  const previewWidth = 260;
  const centered = tabRect.left - headerRect.left + tabRect.width / 2 - previewWidth / 2;
  previewLeft.value = Math.max(8, Math.min(headerRect.width - previewWidth - 8, centered));
}

function hideTensorPreview() {
  previewTensorEntry.value = null;
}

let stripePattern = null;

function formatAddr(v) {
  return String(Math.round(v))
    .padStart(9, '0')
    .replace(/\d{3}(?=\d)/g, '$& ')
    .trim();
}

const RULER_UNITS = [
  { label: 'B', divisor: 1 },
  { label: 'KB', divisor: 1024 },
  { label: 'MB', divisor: 1024 * 1024 },
  { label: 'GB', divisor: 1024 * 1024 * 1024 },
];

function getRulerUnit(visibleStart, visibleEnd) {
  const largestVisibleValue = Math.max(Math.abs(Number(visibleStart) || 0), Math.abs(Number(visibleEnd) || 0));
  let [unit] = RULER_UNITS;
  RULER_UNITS.forEach((candidate) => {
    if (largestVisibleValue >= candidate.divisor) {
      unit = candidate;
    }
  });
  return unit;
}

function getRulerPrecision(step) {
  const normalizedStep = Math.abs(Number(step));
  if (!Number.isFinite(normalizedStep) || normalizedStep <= 0) {
    return 0;
  }
  if (normalizedStep >= 100) {
    return 0;
  }
  if (normalizedStep >= 10) {
    return 1;
  }
  if (normalizedStep >= 1) {
    return 2;
  }
  return Math.max(1, Math.ceil(-Math.log10(normalizedStep)) + 1);
}

function formatScaledRulerValue(value, precision) {
  const fixedValue = value.toFixed(precision);
  return precision > 0 ? fixedValue.replace(/\.?0+$/, '') : fixedValue;
}

function getRulerPrecisionForRange(visibleStart, visibleEnd, unit, segmentCount = 16) {
  const span = Math.abs(Number(visibleEnd) - Number(visibleStart));
  const segment = span / segmentCount / unit.divisor;
  let precision = getRulerPrecision(segment);

  while (precision < 12) {
    const labels = new Set();
    for (let i = 1; i <= segmentCount; i++) {
      const value = (visibleStart + (span / segmentCount) * i) / unit.divisor;
      labels.add(formatScaledRulerValue(value, precision));
    }
    if (labels.size === segmentCount) {
      break;
    }
    precision++;
  }

  return precision;
}

function formatRulerValue(value, visibleStart, visibleEnd, segmentCount = 16) {
  const unit = getRulerUnit(visibleStart, visibleEnd);
  const precision = getRulerPrecisionForRange(visibleStart, visibleEnd, unit, segmentCount);
  const scaledValue = (Number(value) || 0) / unit.divisor;
  const formatted = formatScaledRulerValue(scaledValue, precision);
  return `${formatted || '0'}${unit.label}`;
}

function groupByDim() {
  const groups = Array.from({ length: model.value.ndim }, () => []);
  model.value.rows.forEach((row) => {
    const d = row.at(0);
    if (groups[d]) {
      groups[d].push(row);
    }
  });
  return groups;
}

function isIntersectingVisibleXRange(api) {
  const x1 = Number(api.value(1));
  const x2 = Number(api.value(2));
  const visibleStart = Number(zoomRange.value.start) || 0;
  const visibleEnd = Number(zoomRange.value.end) || Number(model.value.sizeBytes) || 0;
  const rangeStart = Math.min(x1, x2);
  const rangeEnd = Math.max(x1, x2);
  return Number.isFinite(x1) && Number.isFinite(x2) && rangeEnd > visibleStart && rangeStart < visibleEnd;
}

function renderItem(params, api) {
  if (!isIntersectingVisibleXRange(api)) {
    return null;
  }

  const p1 = api.coord([api.value(1), api.value(3)]);
  const p2 = api.coord([api.value(2), api.value(4)]);

  const left = Math.min(p1[0], p2[0]);
  const top = Math.min(p1[1], p2[1]);
  const width = Math.abs(p2[0] - p1[0]);
  const height = Math.abs(p2[1] - p1[1]);

  const rect = echarts.graphic.clipRectByRect({ x: left, y: top, width, height }, params.coordSys);
  if (!rect) {
    return null;
  }

  const isWrite = api.value(8) === 1 || api.value(8) === true;
  const opOpacity = isWrite ? 1 : 0.6;
  const baseFill = activeTensorEntry.value?.color?.base || '#574096';
  const shape = { ...rect, r: 4 };

  const children = [];
  if (stripePattern) {
    children.push({ type: 'rect', shape, style: { fill: stripePattern, opacity: STRIPE_OPACITY }});
  }
  children.push({ type: 'rect', shape, style: { fill: baseFill, opacity: opOpacity, lineWidth: 2 }});

  if (api.value(9) && rect.width > CARD_LABEL_MIN_WIDTH && rect.height >= CARD_LABEL_MIN_HEIGHT) {
    const lines = [`SeqNo: ${api.value(5)}`, `FunctionID: ${api.value(6)}`, `OpID: ${api.value(7)}`];
    lines.forEach((t, i) => {
      children.push({
        type: 'text',
        style: {
          x: rect.x + CARD_PAD_L,
          y: rect.y + CARD_PAD_T + i * CARD_LINE,
          text: t,
          fill: isDarkTheme.value ? '#ffffff' : '#191919',
          fontSize: CARD_FONT,
          fontFamily: 'HarmonyOS Sans SC, "HarmonyOS Sans", sans-serif',
          fontWeight: 'normal',
          textVerticalAlign: 'top',
          textAlign: 'left',
          width: Math.max(0, rect.width - CARD_PAD_L - CARD_PAD_R),
          overflow: 'truncate',
        },
      });
    });
  }

  return { type: 'group', children };
}

const renderOverlapItem = (params, api) => {
  if (!isIntersectingVisibleXRange(api)) {
    return null;
  }

  const p1 = api.coord([api.value(1), api.value(3)]);
  const p2 = api.coord([api.value(2), api.value(4)]);

  const rect = echarts.graphic.clipRectByRect(
    {
      x: Math.min(p1[0], p2[0]),
      y: Math.min(p1[1], p2[1]),
      width: Math.abs(p2[0] - p1[0]),
      height: Math.abs(p2[1] - p1[1]),
    },
    params.coordSys,
  );

  if (!rect) {
    return null;
  }

  const children = [];
  if (stripePattern) {
    children.push({ type: 'rect', shape: rect, style: { fill: stripePattern, opacity: STRIPE_OPACITY }});
  }
  children.push({
    type: 'rect',
    shape: { ...rect, r: 4 },
    style: {
      fill: 'rgba(255,31,45,0.38)',
      stroke: api.value(5) ? CONFLICT_BORDER_COLOR : 'transparent',
      lineWidth: api.value(5) ? 1 : 0,
    },
  });

  return { type: 'group', silent: true, children };
};

function getChartOption() {
  const dims = dimLabels();
  const dataByDim = groupByDim();
  const overlapByDim = model.value.overlapRows || [];
  const xAxisIndexes = dims.map((_, index) => index);

  const grids = dims.map((_, i) => ({
    left: GRID_LEFT,
    right: GRID_RIGHT,
    top: gridTop(i),
    height: LANE_H,
    show: true,
    backgroundColor: isDarkTheme.value ? '#101013' : '#f5f5f5',
    borderWidth: 0,
  }));

  const xAxes = dims.map((_, i) => {
    const xm = dimX(i);
    return {
      type: 'value',
      gridIndex: i,
      position: 'top',
      min: 0,
      max: xm,
      interval: xm / 16,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { show: false },
    };
  });

  const Y_TICKS = 9;
  const yAxes = dims.map((_, i) => {
    const r = dimRange(i);
    return {
      type: 'value',
      gridIndex: i,
      inverse: true,
      min: r.yMin,
      max: r.yMax,
      interval: (r.yMax - r.yMin) / Y_TICKS,
      axisLabel: {
        color: isDarkTheme.value ? '#d8d8d8' : '#666666',
        fontSize: 10,
        margin: 78,
        align: 'left',
        showMinLabel: true,
        showMaxLabel: true,
        formatter: (v) => {
          const eps = (r.yMax - r.yMin) / (Y_TICKS * 2);
          return v <= r.yMin + eps || v >= r.yMax - eps ? formatAddr(v) : '';
        },
      },
      axisTick: { show: true, inside: false, length: 8, lineStyle: { color: isDarkTheme.value ? '#6a6a6a' : '#cccccc' }},
      axisLine: { show: true, lineStyle: { color: isDarkTheme.value ? '#555' : '#cccccc' }},
      splitLine: { show: false },
    };
  });

  const series = dims.map((_, i) => ({
    type: 'custom',
    xAxisIndex: i,
    yAxisIndex: i,
    renderItem,
    encode: { x: [1, 2], y: [3, 4]},
    data: dataByDim[i],
    z: 2,
    animation: false,
  }));

  overlapByDim.forEach((rows, i) => {
    if (!rows?.length) {
      return;
    }

    series.push({
      type: 'custom',
      xAxisIndex: i,
      yAxisIndex: i,
      renderItem: renderOverlapItem,
      encode: { x: [1, 2], y: [3, 4]},
      data: rows,
      silent: true,
      z: 5,
      animation: false,
    });
  });

  const dimTexts = dims.map((label, i) => ({
    type: 'text',
    left: GRID_LEFT - 78,
    top: gridTop(i) - 34,
    style: {
      text: label,
      fill: isDarkTheme.value ? '#e0e0e0' : '#191919',
      fontSize: 14,
      fontWeight: 700,
      align: 'left',
      verticalAlign: 'bottom',
    },
  }));

  return {
    backgroundColor: isDarkTheme.value ? '#1a1a1a' : '#ffffff',
    tooltip: {
      trigger: 'item',
      backgroundColor: isDarkTheme.value ? '#222' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDarkTheme.value ? '#444' : 'rgba(0, 0, 0, 0.1)',
      textStyle: { color: isDarkTheme.value ? '#eee' : '#191919', fontSize: 11 },
      formatter: (p) => {
        const v = p.value;
        if (!v) {
          return '';
        }
        return `Dim_${v[0]}<br/>SeqNo: ${v[5]}<br/>FunctionID: ${v[6]}<br/>OpID: ${v[7]}`;
      },
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    dataZoom: [
      {
        id: 'detail-x-inside',
        type: 'inside',
        xAxisIndex: xAxisIndexes,
        filterMode: 'none',
        startValue: zoomRange.value.start,
        endValue: zoomRange.value.end || model.value.sizeBytes,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: false,
        moveOnMouseMove: false,
      },
    ],
    graphic: dimTexts,
    series,
  };
}

function getControlChartOption() {
  const size = Math.max(1, Number(model.value.sizeBytes) || 0);
  const rulerSeries = {
    type: 'custom',
    xAxisIndex: 0,
    yAxisIndex: 0,
    silent: true,
    clip: false,
    z: 2,
    data: [0],
    renderItem: (params) => {
      const cs = params.coordSys;
      const visibleStart = zoomRange.value.start;
      const visibleEnd = zoomRange.value.end || Number(model.value.sizeBytes) || size;
      const children = [];
      const rulerWidth = Math.max(0, (controlChartRef.value?.clientWidth || cs.x + cs.width + GRID_RIGHT) - cs.x - GRID_RIGHT);
      const squareSize = 8;
      const gap = 3;
      const pitch = squareSize + gap;
      const squareY = cs.y - 16;
      const count = Math.ceil(rulerWidth / pitch);
      for (let i = 0; i < count; i++) {
        const x = cs.x + i * pitch;
        if (x > cs.x + rulerWidth) {
          break;
        }
        children.push({
          type: 'rect',
          shape: { x, y: squareY, width: squareSize, height: squareSize, r: 1 },
          style: { fill: isDarkTheme.value ? 'rgba(51,51,51,1)' : 'rgba(200,200,200,1)' },
        });
      }

      const labelCount = 16;
      const segment = (visibleEnd - visibleStart) / labelCount;
      const labelY = cs.y - 70;
      for (let i = 1; i <= labelCount; i++) {
        const value = visibleStart + segment * i;
        const x = cs.x + (i / labelCount) * rulerWidth;
        children.push({
          type: 'text',
          rotation: -Math.PI / 2,
          originX: x,
          originY: labelY,
          style: {
            x,
            y: labelY,
            text: formatRulerValue(value, visibleStart, visibleEnd, labelCount),
            fill: isDarkTheme.value ? '#666666' : '#999999',
            fontSize: 12,
            fontFamily: 'HarmonyOS Sans SC, "HarmonyOS Sans", sans-serif',
            align: 'left',
            verticalAlign: 'middle',
          },
        });
      }

      return { type: 'group', $mergeChildren: false, children };
    },
  };

  return {
    backgroundColor: isDarkTheme.value ? '#1a1a1a' : '#ffffff',
    animation: false,
    grid: { left: GRID_LEFT, right: GRID_RIGHT, top: CONTROL_GRID_TOP, height: 1, show: false },
    xAxis: {
      type: 'value',
      min: 0,
      max: size,
      interval: size / 16,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { show: false },
    },
    yAxis: { type: 'value', min: 0, max: 1, show: false },
    dataZoom: [{
      id: 'detail-x-slider',
      type: 'slider',
      show: true,
      xAxisIndex: 0,
      filterMode: 'none',
      startValue: zoomRange.value.start,
      endValue: zoomRange.value.end || Number(model.value.sizeBytes),
      left: GRID_LEFT,
      right: GRID_RIGHT,
      top: 8,
      height: 20,
      showDataShadow: false,
      showDetail: false,
      brushSelect: false,
      borderColor: isDarkTheme.value ? '#3d3d3d' : '#c8c8c8',
      backgroundColor: isDarkTheme.value ? '#242424' : '#eeeeee',
      fillerColor: isDarkTheme.value ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      handleSize: '60%',
      handleStyle: {
        color: isDarkTheme.value ? '#ffffff' : '#191919',
        borderColor: isDarkTheme.value ? '#ffffff' : '#191919',
        borderWidth: 1,
        shadowBlur: 5,
        shadowColor: isDarkTheme.value ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.3)',
      },
      moveHandleIcon: 'none',
    }],
    series: [rulerSeries],
  };
}

function detachChartWheelListener() {
  if (chartWheelDom && chartWheelHandler) {
    chartWheelDom.removeEventListener('wheel', chartWheelHandler, true);
  }
  chartWheelDom = null;
  chartWheelHandler = null;
}

let controlPanDom = null;
let controlPanStartX = 0;
let controlPanStartRange = null;
let lanePanDom = null;
let lanePanStartX = 0;
let lanePanStartRange = null;

function stopControlPan() {
  controlPanStartRange = null;
  if (controlPanDom) {
    controlPanDom.style.cursor = 'grab';
  }
  document.removeEventListener('mousemove', moveControlPan);
  document.removeEventListener('mouseup', stopControlPan);
}

function moveControlPan(event) {
  if (!controlPanStartRange || !controlPanDom) {
    return;
  }
  const size = Number(model.value.sizeBytes) || 0;
  const plotWidth = controlPanDom.clientWidth - GRID_LEFT - GRID_RIGHT;
  const rangeWidth = controlPanStartRange.end - controlPanStartRange.start;
  if (size <= 0 || plotWidth <= 0 || rangeWidth >= size) {
    return;
  }

  const delta = ((controlPanStartX - event.clientX) / plotWidth) * size;
  const start = Math.max(0, Math.min(size - rangeWidth, controlPanStartRange.start + delta));
  updateZoomRange(start, start + rangeWidth, 'control');
}

function attachControlPanListener(chartDom) {
  controlPanDom = chartDom;
  chartDom.style.cursor = 'grab';
  chartDom.addEventListener('mousedown', startControlPan, true);
}

function detachControlPanListener() {
  stopControlPan();
  controlPanDom?.removeEventListener('mousedown', startControlPan, true);
  controlPanDom = null;
}

function startControlPan(event) {
  if (!controlPanDom || event.button !== 0) {
    return;
  }
  const localY = event.clientY - controlPanDom.getBoundingClientRect().top;
  if (localY < 30) {
    return;
  }

  const size = Number(model.value.sizeBytes) || 0;
  const end = zoomRange.value.end || size;
  if (size <= 0 || end - zoomRange.value.start >= size) {
    return;
  }

  event.preventDefault();
  controlPanStartX = event.clientX;
  controlPanStartRange = { start: zoomRange.value.start, end };
  controlPanDom.style.cursor = 'grabbing';
  document.addEventListener('mousemove', moveControlPan);
  document.addEventListener('mouseup', stopControlPan);
}

function stopLanePan() {
  lanePanStartRange = null;
  if (lanePanDom) {
    lanePanDom.style.cursor = '';
  }
  document.removeEventListener('mousemove', moveLanePan, true);
  document.removeEventListener('mouseup', stopLanePan, true);
}

function moveLanePan(event) {
  if (!lanePanStartRange || !lanePanDom) {
    return;
  }
  const size = Number(model.value.sizeBytes) || 0;
  const plotWidth = lanePanDom.clientWidth - GRID_LEFT - GRID_RIGHT;
  const rangeWidth = lanePanStartRange.end - lanePanStartRange.start;
  if (size <= 0 || plotWidth <= 0 || rangeWidth >= size) {
    return;
  }

  event.preventDefault();
  const delta = ((lanePanStartX - event.clientX) / plotWidth) * size;
  const start = Math.max(0, Math.min(size - rangeWidth, lanePanStartRange.start + delta));
  updateZoomRange(start, start + rangeWidth, 'lane-pan');
}

function startLanePan(event) {
  if (!lanePanDom || event.button !== 0) {
    return;
  }
  const plotX = event.clientX - lanePanDom.getBoundingClientRect().left - GRID_LEFT;
  const plotWidth = lanePanDom.clientWidth - GRID_LEFT - GRID_RIGHT;
  const size = Number(model.value.sizeBytes) || 0;
  const end = zoomRange.value.end || size;
  if (plotX < 0 || plotX > plotWidth) {
    return;
  }
  if (size <= 0 || end - zoomRange.value.start >= size) {
    return;
  }

  lanePanStartX = event.clientX;
  lanePanStartRange = { start: zoomRange.value.start, end };
  lanePanDom.style.cursor = 'grabbing';
  document.addEventListener('mousemove', moveLanePan, true);
  document.addEventListener('mouseup', stopLanePan, true);
}

function attachLanePanListener(chartDom) {
  lanePanDom = chartDom;
}

function detachLanePanListener() {
  stopLanePan();
  lanePanDom = null;
}

function attachChartWheelListener(chartDom) {
  chartWheelHandler = (event) => {
    if (!event.ctrlKey) {
      return;
    }

    const size = Number(model.value.sizeBytes) || 0;
    const plotWidth = chartDom.clientWidth - GRID_LEFT - GRID_RIGHT;
    const pointerX = event.clientX - chartDom.getBoundingClientRect().left - GRID_LEFT;
    if (size <= 0 || plotWidth <= 0) {
      return;
    }
    if (pointerX < 0 || pointerX > plotWidth) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const currentStart = zoomRange.value.start;
    const currentEnd = zoomRange.value.end || size;
    const currentWidth = currentEnd - currentStart;
    const minWidth = Math.min(size, Math.max(1, size / 1000));
    const nextWidth = Math.max(minWidth, Math.min(size, currentWidth * (event.deltaY < 0 ? 0.8 : 1.25)));
    const anchorRatio = pointerX / plotWidth;
    const anchor = currentStart + currentWidth * anchorRatio;
    let start = anchor - nextWidth * anchorRatio;
    start = Math.max(0, Math.min(size - nextWidth, start));
    const end = start + nextWidth;

    updateZoomRange(start, end, 'lane');
  };
  chartWheelDom = chartDom;
  chartDom.addEventListener('wheel', chartWheelHandler, { passive: false, capture: true });
}

let resizeObserver = null;
let zoomRefreshRaf = null;
let syncingZoom = false;

function clampZoomRange(start, end) {
  const size = Number(model.value.sizeBytes) || 0;
  const hasInvalidBounds = !Number.isFinite(start) || !Number.isFinite(end) || start >= end;
  if (size <= 0 || hasInvalidBounds) {
    return null;
  }

  const nextStart = Math.max(0, Math.min(size, start));
  const nextEnd = Math.max(0, Math.min(size, end));
  if (nextStart >= nextEnd) {
    return null;
  }

  return { start: nextStart, end: nextEnd };
}

function isSameZoomRange(nextRange) {
  return nextRange && nextRange.start === zoomRange.value.start && nextRange.end === zoomRange.value.end;
}

function dispatchZoomToChart(chart, dataZoomId, start, end) {
  chart?.dispatchAction({
    type: 'dataZoom',
    batch: [{ dataZoomId, startValue: start, endValue: end }],
  });
}

function updateZoomRange(start, end, source = null) {
  const nextRange = clampZoomRange(Number(start), Number(end));
  if (!nextRange || isSameZoomRange(nextRange)) {
    return;
  }

  zoomRange.value = nextRange;
  syncingZoom = true;
  try {
    if (source !== 'control') {
      dispatchZoomToChart(controlChart, 'detail-x-slider', nextRange.start, nextRange.end);
    }
    if (source !== 'lane') {
      dispatchZoomToChart(myChart, 'detail-x-inside', nextRange.start, nextRange.end);
    }
  } finally {
    syncingZoom = false;
  }

  if (!zoomRefreshRaf) {
    zoomRefreshRaf = requestAnimationFrame(() => {
      zoomRefreshRaf = null;
      rebuildCharts();
    });
  }
}

function handleDataZoom(event, source) {
  if (syncingZoom) {
    return;
  }

  const expectedId = source === 'control' ? 'detail-x-slider' : 'detail-x-inside';
  const payload = event?.batch?.find((entry) => entry.dataZoomId === expectedId) || event?.batch?.[0] || event || {};
  const size = Number(model.value.sizeBytes) || 0;
  const start = Number.isFinite(Number(payload.startValue)) ? Number(payload.startValue) : (Number(payload.start) / 100) * size;
  const end = Number.isFinite(Number(payload.endValue)) ? Number(payload.endValue) : (Number(payload.end) / 100) * size;

  if (size <= 0 || !Number.isFinite(start) || !Number.isFinite(end)) {
    return;
  }

  updateZoomRange(start, end, source);
}

function initCharts() {
  if (!controlChartRef.value || !chartRef.value) {
    return;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  detachChartWheelListener();
  detachControlPanListener();
  detachLanePanListener();
  if (controlChart) {
    controlChart.dispose();
    controlChart = null;
  }
  if (myChart) {
    myChart.dispose();
    myChart = null;
  }
  controlChart = echarts.init(controlChartRef.value);
  controlChart.setOption(getControlChartOption());
  controlChart.on('datazoom', (event) => handleDataZoom(event, 'control'));
  attachControlPanListener(controlChart.getDom());

  myChart = echarts.init(chartRef.value);
  myChart.setOption(getChartOption());
  myChart.on('datazoom', (event) => handleDataZoom(event, 'lane'));
  attachChartWheelListener(myChart.getDom());
  attachLanePanListener(myChart.getDom());

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => liveResize());
    resizeObserver.observe(controlChartRef.value);
    resizeObserver.observe(chartRef.value);
  }
}

function disposeChart() {
  detachChartWheelListener();
  detachControlPanListener();
  detachLanePanListener();
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (zoomRefreshRaf) {
    cancelAnimationFrame(zoomRefreshRaf);
    zoomRefreshRaf = null;
  }
  if (refreshRaf) {
    cancelAnimationFrame(refreshRaf);
    refreshRaf = null;
  }
  if (myChart) {
    myChart.dispose();
    myChart = null;
  }
  if (controlChart) {
    controlChart.dispose();
    controlChart = null;
  }
}

let refreshRaf = null;
function liveResize() {
  if ((!myChart && !controlChart) || refreshRaf) {
    return;
  }
  refreshRaf = requestAnimationFrame(() => {
    refreshRaf = null;
    if (myChart) {
      myChart.resize();
    }
    if (controlChart) {
      controlChart.resize();
    }
  });
}

function rebuildCharts(clear = false) {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = null;
  }
  if (controlChartRef.value && chartRef.value) {
    if (!controlChart || !myChart) {
      initCharts();
      return;
    }
    if (clear) {
      controlChart.clear();
    }
    if (myChart) {
      if (clear) {
        myChart.clear();
      }
    }
    controlChart.setOption(getControlChartOption(), { notMerge: true });
    myChart.setOption(getChartOption(), { notMerge: true });
  }
}

let rebuildTimer = null;
function scheduleRebuild() {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
  }
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    if (controlChartRef.value && chartRef.value) {
      rebuildCharts();
    }
  }, 120);
}

watch(sidebarWidth, () => {
  liveResize();
  scheduleRebuild();
});

watch(writesOnly, () => {
  rebuildCharts(true);
});

watch(isDarkTheme, () => {
  if (controlChart && myChart) {
    controlChart.setOption(getControlChartOption());
    myChart.setOption(getChartOption());
  }
});

watch(
  () => props.selectedNode,
  (node) => {
    if (node) {
      activeTensorId.value = tensorEntries.value[0]?.id || '';
      sidebarWidth.value = initWidth();
      domHeight.value = computeHeight();
      resetZoomRange();
      nextTick(() => rebuildCharts(true));
    } else {
      disposeChart();
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  window.removeEventListener('mousemove', onResize);
  window.removeEventListener('mouseup', stopResize);
  if (refreshRaf) {
    cancelAnimationFrame(refreshRaf);
    refreshRaf = null;
  }
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = null;
  }
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  disposeChart();
});
</script>

<style scoped lang="scss">
.right-sidebar {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  flex-shrink: 0;
  z-index: 150;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.right-sidebar.resizing {
  user-select: none;
}

.resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 14px;
  height: 100%;
  cursor: ew-resize;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.resize-handle::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: transparent;
  transition: background-color 0.15s ease;
}

.resize-handle:hover::before,
.right-sidebar.resizing .resize-handle::before {
  background-color: #b14fe0;
}

.resize-grip {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 7px 4px;
  border-radius: 0 6px 6px 0;
  opacity: 0.55;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

.theme-dark .resize-handle:hover .resize-grip,
.theme-dark.right-sidebar.resizing .resize-grip {
  opacity: 1;
  background-color: #333333;
}

.theme-light .resize-handle:hover .resize-grip,
.theme-light.right-sidebar.resizing .resize-grip {
  opacity: 1;
  background-color: #cccccc;
}

.resize-grip span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
}

.theme-dark .resize-handle:hover .resize-grip span,
.theme-dark.right-sidebar.resizing .resize-grip span {
  background-color: #cfcfcf;
}

.theme-light .resize-handle:hover .resize-grip span,
.theme-light.right-sidebar.resizing .resize-grip span {
  background-color: #333333;
}

.sidebar-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 52px;
  padding: 6px 8px 6px 14px;
  flex-shrink: 0;
  border-bottom: 1px solid v-bind(sidebarBorderColor);
}

.tensor-tabs {
  display: flex;
  flex: 1 1 auto;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.tensor-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: 0 0 auto;
  max-width: 180px;
  height: 36px;
  padding: 0 11px;
  overflow: hidden;
  color: v-bind(metaTagColor);
  font: inherit;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: rgba(127, 127, 127, 0.08);
  border: 1px solid transparent;
  border-radius: 6px;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: v-bind(sidebarTextColor);
    background: rgba(127, 127, 127, 0.14);
  }
}

.tensor-tab.active {
  color: v-bind(sidebarTextColor);
  background: rgba(127, 127, 127, 0.2);
  border-color: rgba(127, 127, 127, 0.22);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}

.tensor-icon {
  flex: 0 0 auto;
  opacity: 0.72;
}

.tensor-tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 24px;
  width: 24px;
  height: 32px;
  padding: 0;
  color: v-bind(metaTagColor);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 4px;

  &:hover:not(:disabled) {
    color: v-bind(sidebarTextColor);
    background: rgba(127, 127, 127, 0.12);
  }

  &:disabled {
    cursor: default;
    opacity: 0.3;
  }
}

.close-btn {
  flex: 0 0 auto;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    color: #ff4d4f;
    background-color: rgba(255, 77, 79, 0.12);
    transform: scale(1.08);
  }

  &:active {
    transform: scale(0.95);
  }
}

.filter-switch {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 5px;
  padding: 0 4px;
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
}

.filter-switch :deep(.devui-switch) {
  flex-shrink: 0;
  vertical-align: middle;
}

.tensor-preview {
  position: absolute;
  top: calc(100% - 2px);
  z-index: 10;
  width: 260px;
  padding: 10px 12px 12px;
  color: v-bind(sidebarTextColor);
  pointer-events: none;
  background: v-bind(sidebarBgColor);
  border: 1px solid v-bind(sidebarBorderColor);
  border-radius: 0 0 8px 8px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.36);
  box-sizing: border-box;
}

.tensor-preview-title {
  padding-bottom: 8px;
  margin-bottom: 8px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-bottom: 1px solid v-bind(sidebarBorderColor);
}

.tensor-preview-row {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  gap: 6px;
  margin-top: 5px;
  color: v-bind(metaTagColor);
  font-size: 12px;

  strong {
    overflow-wrap: anywhere;
    color: v-bind(sidebarTextColor);
    font-weight: 500;
  }
}

.sidebar-body-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.echarts-dom {
  width: 100%;
}

.memory-zoom-controls {
  flex: 0 0 auto;
  border-bottom: 1px solid v-bind(sidebarBorderColor);
}

.memory-control-chart {
  cursor: grab;
}

.memory-lane-chart {
  cursor: grab;
}

.memory-lane-chart:active {
  cursor: grabbing;
}

.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(100%);
  opacity: 0.8;
}
</style>
