<!--
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
        <MemoryDetailViewToggle v-model="viewMode" />
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

      <div v-show="viewMode === 'chart'" ref="sidebarBodyRef" class="sidebar-body-wrapper">
        <div
          ref="chartRef"
          class="echarts-dom memory-lane-chart"
          :style="{ height: domHeight + 'px', backgroundColor: chartBgColor }"
        />
      </div>
      <MemoryAccessTable
        v-if="viewMode === 'table'"
        :accesses="activeAccesses"
        :selected-key="selectedAccessKey"
        :tensor-id="activeTensorId"
        :writes-only="writesOnly"
        @select="selectedAccessKey = $event"
      />
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

  const { dimRanges, normalizeTime } = accessContext;
  const cells = tShape[dim];
  if (!cells) {
    return null;
  }

  const off = access?.offset || [];
  const ash = access?.shape || [];
  const accessStart = normalizeOptionalTime(access?.execStart, normalizeTime);
  const accessEnd = normalizeOptionalTime(access?.execEnd, normalizeTime);
  const o = off[dim] ?? 0;
  const s = ash[dim] ?? 0;
  const xStart = o;
  const xEnd = o + s;
  const yStart = Number.isFinite(accessStart) ? Math.max(dimRanges[dim].yMin, accessStart) : dimRanges[dim].yMin;
  const yEnd = Number.isFinite(accessEnd) ? Math.min(dimRanges[dim].yMax, accessEnd) : dimRanges[dim].yMax;

  if (!isValidAccessRow(xStart, xEnd, yStart, yEnd)) {
    return null;
  }
  return [
    dim,
    xStart,
    xEnd,
    yStart,
    yEnd,
    access?.seqNo ?? '',
    access?.funcId ?? '',
    access?.opIdx ?? '',
    access?.isWrite,
    1,
    access?.hasOverlap,
    access?.taskId,
  ];
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
    dimXMax.push(Number(firstShape[i]) || 0);
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
        const row = buildAccessRow(tShape, a, i, { dimRanges, normalizeTime });
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
  };
}
</script>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick, inject } from 'vue';
import * as echarts from 'echarts';
import { ENABLE_HAS_OVERLAP_CHECK } from './memoryFeatureFlags';
import { generateColorListExcludingReds } from './utils';
import MemoryAccessTable from './detail/MemoryAccessTable.vue';
import MemoryDetailViewToggle from './detail/MemoryDetailViewToggle.vue';

const props = defineProps({
  selectedNode: { type: Object, default: null },
});

defineEmits(['close']);

const { isDarkTheme } = inject('root', ref(true));

const ADDR_MIN = 850000;
const ADDR_MAX = 1250000;
const X_MAX_FALLBACK = 20;
const ZOOM_MAX = 100;

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
const taskColorMap = computed(() => {
  const taskIds = Array.from(
    new Set(
      tensorEntries.value.flatMap((entry) =>
        (entry.rawTensor?.accesses || []).map((access) => access?.taskId).filter(hasNonEmptyValue).map(String),
      ),
    ),
  );
  const colors = generateColorListExcludingReds(taskIds.length, isDarkTheme.value);

  return Object.fromEntries(taskIds.map((taskId, index) => [taskId, colors.baseColorList[index]]));
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
const viewMode = ref('table');
const selectedAccessKey = ref('');
const activeAccesses = computed(() => activeTensorEntry.value?.rawTensor?.accesses || []);
const selectedAccess = computed(() => {
  return activeAccesses.value.find((_, index) => selectedAccessKey.value === `${activeTensorId.value}|${index}`);
});
const sidebarHeaderRef = ref(null);
const sidebarBodyRef = ref(null);
const tabsViewportRef = ref(null);
const previewTensorEntry = ref(null);
const previewLeft = ref(0);

const TOP = 88;
const LANE_H = 165;
const LANE_GAP = 108;
const BOTTOM = 30;
const GRID_LEFT = 110;
const GRID_RIGHT = 30;
const SLIDER_TOP_OFFSET = 78;
const SLIDER_HEIGHT = 20;
const DATA_ZOOM_THROTTLE_MS = 16;
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

const chartRef = ref(null);
let myChart = null;
const zoomRanges = ref([]);
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
  zoomRanges.value = Array.from({ length: model.value.ndim }, () => ({ start: 0, end: ZOOM_MAX }));
}

function dimZoomRange(i) {
  return zoomRanges.value[i] || { start: 0, end: ZOOM_MAX };
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
  selectedAccessKey.value = '';
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
  const dim = Number(api.value(0));
  const axisMax = dimX(dim);
  const x1 = Number(api.value(1));
  const x2 = Number(api.value(2));
  const range = dimZoomRange(dim);
  const visibleStart = ((Number(range.start) || 0) / ZOOM_MAX) * axisMax;
  const visibleEnd = ((Number(range.end) || ZOOM_MAX) / ZOOM_MAX) * axisMax;
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

  const activeSelection = selectedAccess.value;
  let isSelected = false;
  if (activeSelection) {
    const hasSameSequence = api.value(5) === activeSelection.seqNo;
    const hasSameOperation = api.value(6) === activeSelection.funcId && api.value(7) === activeSelection.opIdx;
    isSelected = hasSameSequence && hasSameOperation;
  }
  const taskId = api.value(11);
  const baseFill = taskColorMap.value[hasNonEmptyValue(taskId) ? String(taskId) : ''] || '#574096';
  const shape = { ...rect, r: 4 };

  const children = [];
  if (stripePattern) {
    children.push({ type: 'rect', shape, style: { fill: stripePattern, opacity: STRIPE_OPACITY }});
  }
  children.push({
    type: 'rect',
    shape,
    style: { fill: baseFill, stroke: isSelected ? '#ffffff' : 'transparent', lineWidth: isSelected ? 3 : 0 },
  });

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

  dims.forEach((_, i) => {
    series.push({
      id: `dimension-ruler-${i}`,
      type: 'custom',
      xAxisIndex: i,
      yAxisIndex: i,
      silent: true,
      clip: false,
      z: 10,
      data: [[i, 0, dimRange(i).yMin]],
      renderItem: (params) => {
        const cs = params.coordSys;
        const range = dimZoomRange(i);
        const axisMax = dimX(i);
        const visibleStart = (range.start / ZOOM_MAX) * axisMax;
        const visibleEnd = (range.end / ZOOM_MAX) * axisMax;
        const children = [];
        const squareSize = 8;
        const gap = 3;
        const pitch = squareSize + gap;
        const squareY = cs.y - 10;
        const count = Math.ceil(cs.width / pitch);

        for (let j = 0; j < count; j++) {
          const x = cs.x + j * pitch;
          if (x > cs.x + cs.width) {
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
        const labelY = cs.y - 38;
        for (let j = 1; j <= labelCount; j++) {
          const value = visibleStart + segment * j;
          const x = cs.x + (j / labelCount) * cs.width;
          children.push({
            type: 'text',
            rotation: -Math.PI / 4,
            originX: x,
            originY: labelY,
            style: {
              x,
              y: labelY,
              text: formatScaledRulerValue(value, getRulerPrecision(segment)),
              fill: isDarkTheme.value ? '#666666' : '#999999',
              fontSize: 12,
              fontFamily: 'HarmonyOS Sans SC, \'HarmonyOS Sans\', sans-serif',
              align: 'center',
              verticalAlign: 'middle',
            },
          });
        }

        return { type: 'group', $mergeChildren: false, children };
      },
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
    dataZoom: dims.flatMap((_, i) => {
      const range = dimZoomRange(i);
      return [
        {
          id: `detail-x-slider-${i}`,
          type: 'slider',
          show: true,
          xAxisIndex: i,
          filterMode: 'none',
          start: range.start,
          end: range.end,
          throttle: DATA_ZOOM_THROTTLE_MS,
          left: GRID_LEFT,
          right: GRID_RIGHT,
          top: gridTop(i) - SLIDER_TOP_OFFSET,
          height: SLIDER_HEIGHT,
          showDataShadow: false,
          showDetail: false,
          brushSelect: false,
          borderColor: isDarkTheme.value ? '#3d3d3d' : '#c8c8c8',
          backgroundColor: isDarkTheme.value ? '#242424' : '#eeeeee',
          fillerColor: isDarkTheme.value ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
          handleSize: '80%',
          handleStyle: {
            color: isDarkTheme.value ? '#ffffff' : '#191919',
            borderColor: isDarkTheme.value ? '#ffffff' : '#191919',
            borderWidth: 1,
            shadowBlur: 5,
            shadowColor: isDarkTheme.value ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.3)',
          },
          moveHandleIcon: 'none',
        },
        {
          id: `detail-x-inside-${i}`,
          type: 'inside',
          xAxisIndex: i,
          filterMode: 'none',
          start: range.start,
          end: range.end,
          throttle: DATA_ZOOM_THROTTLE_MS,
          zoomOnMouseWheel: 'ctrl',
          moveOnMouseWheel: false,
          moveOnMouseMove: true,
          preventDefaultMouseMove: true,
        },
      ];
    }),
    graphic: dimTexts,
    series,
  };
}

let resizeObserver = null;
let zoomRefreshRaf = null;
let chartWheelDom = null;
let chartWheelHandler = null;
let chartMouseDownHandler = null;
let windowMouseUpHandler = null;
let isChartPointerDown = false;
let hasPendingZoomRefresh = false;

function detachChartWheelListener() {
  if (chartWheelDom && chartWheelHandler) {
    chartWheelDom.removeEventListener('wheel', chartWheelHandler, true);
  }
  if (chartWheelDom && chartMouseDownHandler) {
    chartWheelDom.removeEventListener('mousedown', chartMouseDownHandler, true);
  }
  if (windowMouseUpHandler) {
    window.removeEventListener('mouseup', windowMouseUpHandler, true);
    window.removeEventListener('blur', windowMouseUpHandler);
  }
  chartWheelDom = null;
  chartWheelHandler = null;
  chartMouseDownHandler = null;
  windowMouseUpHandler = null;
  isChartPointerDown = false;
  hasPendingZoomRefresh = false;
}

function attachChartWheelListener(chartDom) {
  detachChartWheelListener();
  chartWheelHandler = (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
      return;
    }

    const scrollContainer = sidebarBodyRef.value;
    if (!scrollContainer || !event.deltaY) {
      return;
    }

    let scrollDelta = event.deltaY;
    if (event.deltaMode === 1) {
      scrollDelta *= 16;
    } else if (event.deltaMode === 2) {
      scrollDelta *= scrollContainer.clientHeight;
    }
    scrollContainer.scrollTop += scrollDelta;
    event.preventDefault();
    event.stopPropagation();
  };
  chartMouseDownHandler = () => {
    isChartPointerDown = true;
  };
  windowMouseUpHandler = () => {
    if (!isChartPointerDown) {
      return;
    }
    isChartPointerDown = false;
    if (hasPendingZoomRefresh) {
      hasPendingZoomRefresh = false;
      scheduleZoomRefresh();
    }
  };
  chartWheelDom = chartDom;
  chartDom.addEventListener('wheel', chartWheelHandler, { passive: false, capture: true });
  chartDom.addEventListener('mousedown', chartMouseDownHandler, true);
  window.addEventListener('mouseup', windowMouseUpHandler, true);
  window.addEventListener('blur', windowMouseUpHandler);
}

function clampZoomRange(start, end) {
  const size = ZOOM_MAX;
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

function scheduleZoomRefresh() {
  if (zoomRefreshRaf) {
    return;
  }
  zoomRefreshRaf = requestAnimationFrame(() => {
    zoomRefreshRaf = null;
    rebuildCharts();
  });
}

function updateZoomRange(dimension, start, end) {
  const nextRange = clampZoomRange(Number(start), Number(end));
  const currentRange = dimZoomRange(dimension);
  if (!nextRange || (nextRange.start === currentRange.start && nextRange.end === currentRange.end)) {
    return;
  }

  zoomRanges.value[dimension] = nextRange;
  if (isChartPointerDown) {
    hasPendingZoomRefresh = true;
  } else {
    scheduleZoomRefresh();
  }
}

function handleDataZoom(event) {
  const payload =
    event?.batch?.find((entry) => /^detail-x-(?:slider|inside)-\d+$/.test(entry.dataZoomId)) || event?.batch?.[0] || event || {};
  const dimension = Number(String(payload.dataZoomId || '').match(/\d+$/)?.[0]);
  const size = ZOOM_MAX;
  const start = Number.isFinite(Number(payload.start)) ? Number(payload.start) : Number(payload.startValue);
  const end = Number.isFinite(Number(payload.end)) ? Number(payload.end) : Number(payload.endValue);

  const hasInvalidRange = !Number.isFinite(start) || !Number.isFinite(end);
  if (size <= 0 || !Number.isInteger(dimension) || hasInvalidRange) {
    return;
  }

  updateZoomRange(dimension, start, end);
}

function initCharts() {
  if (!chartRef.value) {
    return;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (myChart) {
    myChart.dispose();
    myChart = null;
  }
  myChart = echarts.init(chartRef.value);
  attachChartWheelListener(chartRef.value);
  myChart.setOption(getChartOption());
  myChart.on('datazoom', handleDataZoom);

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => liveResize());
    resizeObserver.observe(chartRef.value);
  }
}

function disposeChart() {
  detachChartWheelListener();
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
}

let refreshRaf = null;
function liveResize() {
  if (!myChart || refreshRaf) {
    return;
  }
  refreshRaf = requestAnimationFrame(() => {
    refreshRaf = null;
    if (myChart) {
      myChart.resize();
    }
  });
}

function rebuildCharts(clear = false) {
  if (viewMode.value !== 'chart') {
    return;
  }

  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = null;
  }
  if (chartRef.value) {
    if (!myChart) {
      initCharts();
      return;
    }
    if (myChart) {
      if (clear) {
        myChart.clear();
      }
    }
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
    if (chartRef.value) {
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

watch(viewMode, (mode) => {
  if (mode === 'chart') {
    nextTick(() => rebuildCharts());
  }
});

watch(isDarkTheme, () => {
  if (myChart) {
    myChart.setOption(getChartOption());
  }
});

watch(
  () => props.selectedNode,
  (node) => {
    if (node) {
      activeTensorId.value = tensorEntries.value[0]?.id || '';
      viewMode.value = 'table';
      selectedAccessKey.value = '';
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
