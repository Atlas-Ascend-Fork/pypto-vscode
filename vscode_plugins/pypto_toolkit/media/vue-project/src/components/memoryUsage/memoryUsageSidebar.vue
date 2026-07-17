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
          <span :style="{ backgroundColor: resizeGripDotColor }"></span>
          <span :style="{ backgroundColor: resizeGripDotColor }"></span>
          <span :style="{ backgroundColor: resizeGripDotColor }"></span>
        </div>
      </div>

      <div class="sidebar-header">
        <div class="header-title-row">
          <button class="close-btn" @click="$emit('close')" title="Close Panel" :style="{ color: closeBtnColor }">
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="header-meta-row">
          <span class="meta-tag magic-id-tag" :style="{ color: metaTagColor }">magicID:{{ magicId }}</span>
          <span class="meta-tag shape-tag" :style="{ color: metaTagColor }">rawShape:[{{ shape.join(',') }}]</span>
        </div>
      </div>

      <div class="sidebar-body-wrapper">
        <div ref="chartRef" class="echarts-dom" :style="{ height: domHeight + 'px', backgroundColor: chartBgColor }"></div>
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
    hasNonEmptyValue(access?.execEnd)
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

function buildOverlapRows(rows, ndim) {
  const rowsByDim = Array.from({ length: ndim }, () => []);
  rows.forEach((row) => {
    const [dim] = row;
    if (rowsByDim[dim]) {
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

  return [dim, xStart, xEnd, yStart, yEnd, access?.seqNo ?? '', access?.funcId ?? '', access?.opIdx ?? '', access?.isWrite, 1];
}

function buildChartModel(input) {
  let src = input;
  if (input && !Array.isArray(input.rawTensors) && Array.isArray(input.accesses)) {
    src = { meta: { t0: input.t0 ?? 0 }, rawTensors: [input] };
  }

  const t0 = src?.meta?.t0 ?? 0;
  const timeDenominator = src?.meta?.timeDenominator || 1;
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
      if (a.isWrite) {
        for (let i = 0; i < ndim; i++) {
          const row = buildAccessRow(tShape, a, i, { dimRanges, size, normalizeTime });
          if (!row) {
            continue;
          }

          rowCountsByDim[i]++;
          rows.push(row);
        }
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick, inject } from 'vue';
import * as echarts from 'echarts';

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

const model = computed(() => buildChartModel(props.selectedNode));
const magicId = computed(() => model.value.magicId);
const shape = computed(() => model.value.shape);

const TOP = 65;
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
  rebuildChart();
}

const chartRef = ref(null);
let myChart = null;
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

let stripePattern = null;
let stripeImg = null;

function formatAddr(v) {
  return String(Math.round(v))
    .padStart(9, '0')
    .replace(/\d{3}(?=\d)/g, '$& ')
    .trim();
}

function formatKB(v) {
  if (v === 0) {
    return '0';
  }
  const kb = Math.round((v / 1024) * 100) / 100;
  return String(kb).replace('.', ',') + 'KB';
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

function renderItem(params, api) {
  const p1 = api.coord([api.value(1), api.value(3)]);
  const p2 = api.coord([api.value(2), api.value(4)]);

  const left = Math.min(p1[0], p2[0]);
  const top = Math.min(p1[1], p2[1]);
  const width = Math.abs(p2[0] - p1[0]);
  const height = Math.abs(p2[1] - p1[1]);

  const rect = echarts.graphic.clipRectByRect({ x: left, y: top, width, height }, params.coordSys);
  if (!rect) {
    return {};
  }

  const { selectedNode } = props;
  const isWrite = api.value(8);
  let baseFill;
  if (selectedNode?.color?.base) {
    baseFill = selectedNode.color.base;
  } else {
    if (isWrite) {
      baseFill = isDarkTheme.value ? 'rgba(63,100,174,0.8)' : 'rgba(30,64,175,0.8)';
    } else {
      baseFill = isDarkTheme.value ? 'rgba(217,125,27,0.85)' : 'rgba(217,119,6,0.85)';
    }
  }
  const shape = { ...rect, r: 4 };

  const children = [];
  if (stripePattern) {
    children.push({ type: 'rect', shape, style: { fill: stripePattern, opacity: STRIPE_OPACITY } });
  }
  children.push({ type: 'rect', shape, style: { fill: baseFill, lineWidth: 2 } });

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
    return { type: 'group', silent: true, children: [] };
  }

  const children = [];
  if (stripePattern) {
    children.push({ type: 'rect', shape: rect, style: { fill: stripePattern, opacity: STRIPE_OPACITY } });
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
      axisTick: { show: true, inside: false, length: 8, lineStyle: { color: isDarkTheme.value ? '#6a6a6a' : '#cccccc' } },
      axisLine: { show: true, lineStyle: { color: isDarkTheme.value ? '#555' : '#cccccc' } },
      splitLine: { show: false },
    };
  });

  const series = dims.map((_, i) => ({
    type: 'custom',
    xAxisIndex: i,
    yAxisIndex: i,
    renderItem,
    encode: { x: [1, 2], y: [3, 4] },
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
      encode: { x: [1, 2], y: [3, 4] },
      data: rows,
      silent: true,
      z: 5,
      animation: false,
    });
  });

  const rulerWidth = chartRef.value ? chartRef.value.clientWidth : 0;
  series.push({
    type: 'custom',
    xAxisIndex: 0,
    yAxisIndex: 0,
    silent: true,
    clip: false,
    z: 6,
    data: [rulerWidth],
    renderItem: (params) => {
      const cs = params.coordSys;
      const children = [];
      const SQ = 8;
      const GAP = 3;
      const pitch = SQ + GAP;
      const sqY = cs.y - 16;
      const count = Math.ceil(cs.width / pitch);
      for (let i = 0; i < count; i++) {
        const x = cs.x + i * pitch;
        if (x > cs.x + cs.width) {
          break;
        }
        children.push({
          type: 'rect',
          shape: { x, y: sqY, width: SQ, height: SQ, r: 1 },
          style: { fill: isDarkTheme.value ? 'rgba(51,51,51,1)' : 'rgba(200,200,200,1)' },
        });
      }

      const xm = dimX(0);
      const seg = xm / 16;
      const labelY = cs.y - 24;
      for (let i = 1; i <= 16; i++) {
        const v = seg * i;
        const xPix = cs.x + (v / xm) * cs.width;
        children.push({
          type: 'text',
          rotation: Math.PI / 2,
          originX: xPix,
          originY: labelY,
          style: {
            x: xPix,
            y: labelY,
            text: formatKB(v),
            fill: isDarkTheme.value ? '#666666' : '#999999',
            fontSize: 12,
            fontFamily: 'HarmonyOS Sans SC, "HarmonyOS Sans", sans-serif',
            align: 'left',
            verticalAlign: 'middle',
          },
        });
      }

      return { type: 'group', children };
    },
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
    graphic: dimTexts,
    series,
  };
}

let resizeObserver = null;
function initChart() {
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
  myChart.setOption(getChartOption());
}

function disposeChart() {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
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

function rebuildChart() {
  if (rebuildTimer) {
    clearTimeout(rebuildTimer);
    rebuildTimer = null;
  }
  if (chartRef.value) {
    initChart();
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
      initChart();
    }
  }, 120);
}

function onContainerResize() {
  liveResize();
  scheduleRebuild();
}

const handleResize = () => onContainerResize();

watch(sidebarWidth, () => {
  liveResize();
  scheduleRebuild();
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
      sidebarWidth.value = initWidth();
      domHeight.value = computeHeight();
      nextTick(() => initChart());
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
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  flex-shrink: 0;
}

.header-title-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.close-btn {
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

.header-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-tag {
  font-size: 14px;
  line-height: 22px;
  padding: 0 6px;
  position: relative;
  bottom: 35px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.sidebar-body-wrapper {
  flex: 1;
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
