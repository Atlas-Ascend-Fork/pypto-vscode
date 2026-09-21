<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useViewServer } from '../../core/use-view-server';
import type { IWaveformServer } from 'ext:/view/servers/view-server-interface';

interface VcdSignal {
  id: string;
  name: string;
  width: number;
  type: string;
  scope: string;
}

interface VcdScopeNode {
  name: string;
  type: string;
  children: VcdScopeNode[];
  signals: string[];
}

interface VcdMetadata {
  timescale: string;
  date: string;
  version: string;
  signals: VcdSignal[];
  signalTree: VcdScopeNode[];
  timeRange: { start: number; end: number };
  signalCount: number;
  changeCount: number;
  changes: Record<string, [number, string][]>;
}

const { server } = useViewServer<IWaveformServer>();
const { t } = useI18n();

const metadata = ref<VcdMetadata | null>(null);
const errorMessage = ref('');
const selectedSignals = ref<string[]>([]);
const viewStart = ref(0);
const viewEnd = ref(100);
const cursorTime = ref(-1);
const labelCanvasRef = ref<HTMLCanvasElement | null>(null);
const waveCanvasRef = ref<HTMLCanvasElement | null>(null);
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null);
const labelContainerRef = ref<HTMLDivElement | null>(null);
const waveContainerRef = ref<HTMLDivElement | null>(null);
const treeContainerRef = ref<HTMLDivElement | null>(null);

const changesMap = shallowRef(new Map<string, [number, string][]>());
const labelWidth = ref(150);
const waveWidth = ref(0);
const canvasHeight = ref(0);
const waveScrollY = ref(0);

const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const isDragging = ref(false);

const tooltipText = ref('');
const tooltipX = ref(0);
const tooltipY = ref(0);
const tooltipVisible = ref(false);

const signalPanelWidth = ref(200);
const isResizingPanel = ref(false);
const isResizingLabel = ref(false);

const SIGNAL_ROW_HEIGHT = 40;
const TIME_AXIS_HEIGHT = 30;
const ITEM_HEIGHT = 28;
const VISIBLE_BUFFER = 5;
const PIXEL_THRESHOLD = 3;

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const FONT_SIZE = 12;
const FONT_STYLE = `${FONT_SIZE}px ${FONT_FAMILY}`;

interface ThemeColors {
  bg: string;
  line: string;
  text: string;
  secondaryText: string;
  digitalSignal: string;
  busSignal: string;
  cursor: string;
  fuzzyBand: string;
}

const colors = ref<ThemeColors>({
  bg: '#1e1e1e',
  line: '#333',
  text: '#ccc',
  secondaryText: '#888',
  digitalSignal: '#4fc3f7',
  busSignal: '#81c784',
  cursor: '#ff4444',
  fuzzyBand: 'rgba(79, 195, 247, 0.3)',
});

function cacheThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const get = (prop: string, fallback: string) => style.getPropertyValue(prop).trim() || fallback;
  colors.value = {
    bg: get('--devui-base-bg', '#1e1e1e'),
    line: get('--devui-line', '#333'),
    text: get('--devui-text', '#ccc'),
    secondaryText: get('--devui-secondary-text', '#888'),
    digitalSignal: '#4fc3f7',
    busSignal: '#81c784',
    cursor: '#ff4444',
    fuzzyBand: 'rgba(79, 195, 247, 0.3)',
  };
}

const signalMap = computed(() => {
  const map = new Map<string, VcdSignal>();
  if (metadata.value) {
    for (const sig of metadata.value.signals) {
      map.set(sig.id, sig);
    }
  }
  return map;
});

watch(server.ErrorMessage, (newValue) => {
  if (newValue) {
    errorMessage.value = (newValue as any).data || '未知错误';
  }
});

function toggleSignal(signalId: string) {
  const idx = selectedSignals.value.indexOf(signalId);
  if (idx >= 0) {
    selectedSignals.value.splice(idx, 1);
  } else {
    selectedSignals.value.push(signalId);
  }
  scheduleRender();
}

function isSignalSelected(signalId: string): boolean {
  return selectedSignals.value.includes(signalId);
}

const ZOOM_HINT_INTERVAL = 150;
const ZOOM_HINT_DURATION = 1500;
const zoomHint = ref('');
let zoomHintHideTimer: ReturnType<typeof setTimeout> | null = null;
let lastZoomHintShow = 0;

function showZoomHint(text: string) {
  const now = Date.now();
  if (now - lastZoomHintShow < ZOOM_HINT_INTERVAL) return;
  lastZoomHintShow = now;
  zoomHint.value = text;
  if (zoomHintHideTimer) clearTimeout(zoomHintHideTimer);
  zoomHintHideTimer = setTimeout(() => {
    zoomHint.value = '';
    zoomHintHideTimer = null;
  }, ZOOM_HINT_DURATION);
}

function zoomAt(anchorTime: number, factor: number) {
  if (!metadata.value) return;
  const range = viewEnd.value - viewStart.value;
  const maxRange = metadata.value.timeRange.end - metadata.value.timeRange.start;
  const newRange = Math.max(Math.min(range * factor, maxRange), 1);
  if (newRange === range) {
    showZoomHint(factor < 1 ? t('waveform.zoomMaxIn') : t('waveform.zoomMaxOut'));
    return;
  }
  viewStart.value = anchorTime - (anchorTime - viewStart.value) * (newRange / range);
  viewEnd.value = viewStart.value + newRange;
  if (viewStart.value < metadata.value.timeRange.start) {
    viewStart.value = metadata.value.timeRange.start;
    viewEnd.value = viewStart.value + newRange;
  }
  if (viewEnd.value > metadata.value.timeRange.end) {
    viewEnd.value = metadata.value.timeRange.end;
    viewStart.value = viewEnd.value - newRange;
  }
  if (viewStart.value < metadata.value.timeRange.start) viewStart.value = metadata.value.timeRange.start;
  scheduleRender();
}

function getZoomAnchorTime(): number {
  if (cursorTime.value >= 0) return cursorTime.value;
  return (viewStart.value + viewEnd.value) / 2;
}

function zoomIn() {
  zoomAt(getZoomAnchorTime(), 0.5);
}

function zoomOut() {
  zoomAt(getZoomAnchorTime(), 2);
}

function zoomFit() {
  if (!metadata.value) return;
  viewStart.value = metadata.value.timeRange.start;
  viewEnd.value = metadata.value.timeRange.end;
  scheduleRender();
}

let waveRafId = 0;
function scheduleRender() {
  if (waveRafId) return;
  waveRafId = requestAnimationFrame(() => {
    waveRafId = 0;
    renderLabelLayer();
    renderWaveLayer();
    renderOverlayLayer();
  });
}

let overlayRafId = 0;
function scheduleOverlayRender() {
  if (overlayRafId) return;
  overlayRafId = requestAnimationFrame(() => {
    overlayRafId = 0;
    renderOverlayLayer();
  });
}

function renderLabelLayer() {
  const canvas = labelCanvasRef.value;
  if (!canvas || !metadata.value) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = labelWidth.value;
  const h = canvasHeight.value;
  if (w <= 0 || h <= 0) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const c = colors.value;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, TIME_AXIS_HEIGHT);

  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w - 0.5, 0);
  ctx.lineTo(w - 0.5, h);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, TIME_AXIS_HEIGHT, w, h - TIME_AXIS_HEIGHT);
  ctx.clip();
  ctx.translate(0, -waveScrollY.value);

  const signals = selectedSignals.value
    .map((id) => signalMap.value.get(id))
    .filter((s): s is VcdSignal => s !== undefined);

  ctx.fillStyle = c.text;
  ctx.font = FONT_STYLE;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  signals.forEach((signal, index) => {
    const y = TIME_AXIS_HEIGHT + index * SIGNAL_ROW_HEIGHT;
    
    if (isDragging.value && dragIndex.value === index) {
      ctx.fillStyle = 'rgba(79, 195, 247, 0.2)';
      ctx.fillRect(0, y, w, SIGNAL_ROW_HEIGHT);
    }
    
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y + SIGNAL_ROW_HEIGHT);
    ctx.lineTo(w, y + SIGNAL_ROW_HEIGHT);
    ctx.stroke();
    
    if (isDragging.value && dragOverIndex.value === index && dragIndex.value !== index) {
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    
    const label = signal.width === 1 ? signal.name : `${signal.name} [${signal.width}]`;
    ctx.fillStyle = (isDragging.value && dragIndex.value === index) ? c.secondaryText : c.text;
    
    const maxWidth = w - 16;
    const textWidth = ctx.measureText(label).width;
    if (textWidth <= maxWidth) {
      ctx.fillText(label, 8, y + SIGNAL_ROW_HEIGHT / 2);
    } else {
      let truncated = label;
      let truncatedWidth = textWidth;
      while (truncated.length > 0 && truncatedWidth > maxWidth - 12) {
        truncated = truncated.slice(0, -1);
        truncatedWidth = ctx.measureText(truncated + '...').width;
      }
      ctx.fillText(truncated + '...', 8, y + SIGNAL_ROW_HEIGHT / 2);
    }
  });
  
  if (isDragging.value && dragOverIndex.value === signals.length - 1 && dragIndex.value !== signals.length - 1) {
    const lastY = TIME_AXIS_HEIGHT + signals.length * SIGNAL_ROW_HEIGHT;
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, lastY);
    ctx.lineTo(w, lastY);
    ctx.stroke();
  }

  ctx.restore();
}

function renderWaveLayer() {
  const canvas = waveCanvasRef.value;
  if (!canvas || !metadata.value) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = waveWidth.value;
  const h = canvasHeight.value;
  if (w <= 0 || h <= 0) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  let timeRange = viewEnd.value - viewStart.value;
  if (timeRange <= 0) timeRange = 1;
  const pixelsPerUnit = w / timeRange;

  drawTimeAxis(ctx, w, pixelsPerUnit);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, TIME_AXIS_HEIGHT, w, h - TIME_AXIS_HEIGHT);
  ctx.clip();
  ctx.translate(0, -waveScrollY.value);

  const signals = selectedSignals.value
    .map((id) => signalMap.value.get(id))
    .filter((s): s is VcdSignal => s !== undefined);

  signals.forEach((signal, index) => {
    const y = TIME_AXIS_HEIGHT + index * SIGNAL_ROW_HEIGHT;
    drawSignalRow(ctx, signal, y, w, pixelsPerUnit);
  });

  ctx.restore();
}

function renderOverlayLayer() {
  const canvas = overlayCanvasRef.value;
  if (!canvas || !metadata.value) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = waveWidth.value;
  const h = canvasHeight.value;
  if (w <= 0 || h <= 0) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (cursorTime.value >= viewStart.value && cursorTime.value <= viewEnd.value) {
    let timeRange = viewEnd.value - viewStart.value;
    if (timeRange <= 0) timeRange = 1;
    const pixelsPerUnit = w / timeRange;
    const x = (cursorTime.value - viewStart.value) * pixelsPerUnit;
    ctx.strokeStyle = colors.value.cursor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, TIME_AXIS_HEIGHT);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = colors.value.text;
    ctx.font = FONT_STYLE;
    const label = formatCursorTime(cursorTime.value);
    const labelWidth = ctx.measureText(label).width;
    const nearRightEdge = x + 4 + labelWidth > w;
    ctx.textAlign = nearRightEdge ? 'right' : 'left';
    ctx.fillText(label, nearRightEdge ? x - 4 : x + 4, TIME_AXIS_HEIGHT + 14);
  }
}

function drawTimeAxis(ctx: CanvasRenderingContext2D, width: number, pixelsPerUnit: number) {
  const c = colors.value;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, width, TIME_AXIS_HEIGHT);

  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TIME_AXIS_HEIGHT);
  ctx.lineTo(width, TIME_AXIS_HEIGHT);
  ctx.stroke();

  let timeRange = viewEnd.value - viewStart.value;
  if (timeRange <= 0) timeRange = 1;
  const targetTickCount = Math.max(5, Math.floor(width / 100));
  const rawInterval = timeRange / targetTickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
  const normalized = rawInterval / magnitude;
  let interval: number;
  if (normalized <= 1) interval = magnitude;
  else if (normalized <= 2) interval = 2 * magnitude;
  else if (normalized <= 5) interval = 5 * magnitude;
  else interval = 10 * magnitude;

  const firstTick = Math.ceil(viewStart.value / interval) * interval;

  ctx.fillStyle = c.text;
  ctx.font = FONT_STYLE;

  for (let t = firstTick; t <= viewEnd.value; t += interval) {
    const x = (t - viewStart.value) * pixelsPerUnit;
    ctx.beginPath();
    ctx.moveTo(x, TIME_AXIS_HEIGHT - 5);
    ctx.lineTo(x, TIME_AXIS_HEIGHT);
    ctx.stroke();
    const label = formatTime(t, interval);
    const labelWidth = ctx.measureText(label).width;
    if (x - labelWidth / 2 < 0) {
      ctx.textAlign = 'left';
      ctx.fillText(label, 0, TIME_AXIS_HEIGHT - 8);
    } else if (x + labelWidth / 2 > width) {
      ctx.textAlign = 'right';
      ctx.fillText(label, width, TIME_AXIS_HEIGHT - 8);
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(label, x, TIME_AXIS_HEIGHT - 8);
    }
  }
}

function formatTime(t: number, interval?: number): string {
  const stripZeros = (s: string) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);
  if (interval !== undefined && interval > 0) {
    const digits = Math.max(0, Math.ceil(-Math.log10(interval)));
    if (t >= 1e9) return `${stripZeros((t / 1e9).toFixed(Math.max(0, digits + 9)))}G`;
    if (t >= 1e6) return `${stripZeros((t / 1e6).toFixed(Math.max(0, digits + 6)))}M`;
    if (t >= 1e3) return `${stripZeros((t / 1e3).toFixed(Math.max(0, digits + 3)))}k`;
    return stripZeros(t.toFixed(digits));
  }
  if (t >= 1e9) return `${(t / 1e9).toFixed(1)}G`;
  if (t >= 1e6) return `${(t / 1e6).toFixed(1)}M`;
  if (t >= 1e3) return `${(t / 1e3).toFixed(1)}k`;
  return t.toString();
}

function formatCursorTime(t: number): string {
  const unit = metadata.value?.timescale.match(/[a-z]+/i)?.[0] ?? '';
  const value = Math.round(t * 1000) / 1000;
  return unit ? `${value} ${unit}` : `${value}`;
}

function drawSignalRow(ctx: CanvasRenderingContext2D, signal: VcdSignal, y: number, width: number, pixelsPerUnit: number) {
  const c = colors.value;
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, y + SIGNAL_ROW_HEIGHT);
  ctx.lineTo(width, y + SIGNAL_ROW_HEIGHT);
  ctx.stroke();

  const changes = changesMap.value.get(signal.id);
  if (!changes || changes.length === 0) return;

  const midY = y + SIGNAL_ROW_HEIGHT / 2;
  const highY = y + 8;
  const lowY = y + SIGNAL_ROW_HEIGHT - 8;

  const startIdx = Math.max(0, lowerBound(changes, viewStart.value) - 1);
  const endIdx = upperBound(changes, viewEnd.value);

  if (signal.width === 1) {
    drawDigitalSignal(ctx, changes, startIdx, endIdx, midY, highY, lowY, width, pixelsPerUnit);
  } else {
    drawBusSignal(ctx, signal, changes, startIdx, endIdx, midY, highY, lowY, width, pixelsPerUnit);
  }
}

function lowerBound(arr: [number, string][], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid][0] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(arr: [number, string][], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid][0] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function getValueAtTime(changes: [number, string][], time: number): string {
  let lo = 0;
  let hi = changes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (changes[mid][0] <= time) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) return changes[lo - 1][1];
  if (changes.length > 0) return changes[0][1];
  return '';
}

function drawDigitalSignal(
  ctx: CanvasRenderingContext2D,
  changes: [number, string][],
  startIdx: number,
  endIdx: number,
  midY: number,
  highY: number,
  lowY: number,
  width: number,
  pixelsPerUnit: number,
) {
  const c = colors.value;
  const count = endIdx - startIdx;
  const changesPerPixel = count / (width || 1);

  if (changesPerPixel > PIXEL_THRESHOLD) {
    ctx.fillStyle = c.fuzzyBand;
    ctx.fillRect(0, highY, width, lowY - highY);
    return;
  }

  ctx.strokeStyle = c.digitalSignal;
  ctx.lineWidth = 1.5;

  let curValue = getValueAtTime(changes, viewStart.value);
  if (curValue === '') return;

  let curX = 0;

  for (let i = startIdx; i < endIdx; i++) {
    const [time, newValue] = changes[i];
    if (time <= viewStart.value) {
      curValue = newValue;
      continue;
    }
    if (time > viewEnd.value) break;

    const x = (time - viewStart.value) * pixelsPerUnit;

    if (curValue !== 'x' && curValue !== 'z' && curValue !== 'X' && curValue !== 'Z') {
      const y = curValue === '1' ? highY : lowY;
      ctx.beginPath();
      ctx.moveTo(curX, y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    if (newValue === 'x' || newValue === 'z' || newValue === 'X' || newValue === 'Z') {
      ctx.strokeStyle = '#ff9800';
      ctx.beginPath();
      ctx.moveTo(x, midY - 4);
      ctx.lineTo(x, midY + 4);
      ctx.stroke();
      ctx.strokeStyle = c.digitalSignal;
    } else if (curValue !== 'x' && curValue !== 'z' && curValue !== 'X' && curValue !== 'Z') {
      const fromY = curValue === '1' ? highY : lowY;
      const toY = newValue === '1' ? highY : lowY;
      ctx.beginPath();
      ctx.moveTo(x, fromY);
      ctx.lineTo(x, toY);
      ctx.stroke();
    }

    curValue = newValue;
    curX = x;
  }

  if (curValue !== '' && curValue !== 'x' && curValue !== 'z' && curValue !== 'X' && curValue !== 'Z') {
    const y = curValue === '1' ? highY : lowY;
    ctx.beginPath();
    ctx.moveTo(curX, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawBusSignal(
  ctx: CanvasRenderingContext2D,
  signal: VcdSignal,
  changes: [number, string][],
  startIdx: number,
  endIdx: number,
  midY: number,
  highY: number,
  lowY: number,
  width: number,
  pixelsPerUnit: number,
) {
  const c = colors.value;
  const count = endIdx - startIdx;
  const changesPerPixel = count / (width || 1);

  if (changesPerPixel > PIXEL_THRESHOLD) {
    ctx.fillStyle = 'rgba(129, 199, 132, 0.3)';
    ctx.fillRect(0, highY, width, lowY - highY);
    return;
  }

  ctx.strokeStyle = c.busSignal;
  ctx.lineWidth = 1.5;

  let curValue = getValueAtTime(changes, viewStart.value);
  if (curValue === '') return;

  const nextTime = endIdx < changes.length ? changes[endIdx][0] : null;
  let prevTime: number | null = null;
  let curX: number | null = null;

  for (let i = startIdx; i < endIdx; i++) {
    const [time, newValue] = changes[i];
    if (time <= viewStart.value) {
      curValue = newValue;
      prevTime = time;
      continue;
    }

    const x = (time - viewStart.value) * pixelsPerUnit;
    const x1 = curX ?? (prevTime !== null ? (prevTime - viewStart.value) * pixelsPerUnit : 0);
    drawBusSegment(ctx, c, x1, x, midY, highY, lowY, curValue, signal.width, width);

    curValue = newValue;
    curX = x;
  }

  const endTime = nextTime ?? metadata.value?.timeRange.end ?? viewEnd.value;
  const x2 = (endTime - viewStart.value) * pixelsPerUnit;
  const x1 = curX ?? (prevTime !== null ? (prevTime - viewStart.value) * pixelsPerUnit : 0);
  drawBusSegment(ctx, c, x1, x2, midY, highY, lowY, curValue, signal.width, width);
}

function drawBusSegment(
  ctx: CanvasRenderingContext2D,
  c: ThemeColors,
  x1: number,
  x2: number,
  midY: number,
  highY: number,
  lowY: number,
  value: string,
  sigWidth: number,
  width: number,
) {
  if (x2 <= x1) return;
  const tw = Math.min(4, (x2 - x1) * 0.1);
  ctx.beginPath();
  ctx.moveTo(x1, midY);
  ctx.lineTo(x1 + tw, highY);
  ctx.lineTo(x2 - tw, highY);
  ctx.lineTo(x2, midY);
  ctx.lineTo(x2 - tw, lowY);
  ctx.lineTo(x1 + tw, lowY);
  ctx.closePath();
  ctx.stroke();
  const visibleStart = Math.max(x1, 0);
  const visibleEnd = Math.min(x2, width);
  const textW = visibleEnd - visibleStart - tw * 2;
  if (textW > 20) {
    ctx.font = FONT_STYLE;
    let displayText = formatBusValue(value, sigWidth);
    if (ctx.measureText(displayText).width > textW) {
      let truncated = displayText;
      while (truncated.length > 1 && ctx.measureText(`${truncated}...`).width > textW) {
        truncated = truncated.slice(0, -1);
      }
      displayText = truncated.length > 1 ? `${truncated}...` : '';
    }
    if (displayText) {
      ctx.fillStyle = c.text;
      ctx.textAlign = 'center';
      ctx.fillText(displayText, (visibleStart + visibleEnd) / 2, midY + 4);
    }
  }
}

function formatBusValue(value: string, width: number): string {
  if (value.includes('x') || value.includes('X')) return 'X';
  if (value.includes('z') || value.includes('Z')) return 'Z';
  const num = parseInt(value, 2);
  if (isNaN(num)) return value;
  if (width <= 4) return `0x${num.toString(16).toUpperCase()}`;
  if (width <= 8) return `0x${num.toString(16).toUpperCase().padStart(2, '0')}`;
  if (width <= 16) return `0x${num.toString(16).toUpperCase().padStart(4, '0')}`;
  return `0x${num.toString(16).toUpperCase().padStart(8, '0')}`;
}

function onCanvasMouseMove(event: MouseEvent) {
  const canvas = overlayCanvasRef.value;
  if (!canvas || !metadata.value) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  let timeRange = viewEnd.value - viewStart.value;
  if (timeRange <= 0) timeRange = 1;
  const pixelsPerUnit = waveWidth.value / timeRange;
  cursorTime.value = viewStart.value + x / pixelsPerUnit;
  scheduleOverlayRender();
}

function onWaveAreaMouseLeave() {
  cursorTime.value = -1;
}

function onCanvasWheel(event: WheelEvent) {
  event.preventDefault();
  if (!metadata.value) return;

  if (event.ctrlKey || event.metaKey) {
    const container = waveContainerRef.value;
    if (!container || waveWidth.value <= 0) return;
    let timeRange = viewEnd.value - viewStart.value;
    if (timeRange <= 0) timeRange = 1;
    const x = Math.max(0, Math.min(waveWidth.value, event.clientX - container.getBoundingClientRect().left));
    const anchorTime = viewStart.value + (x / waveWidth.value) * timeRange;
    zoomAt(anchorTime, Math.exp(event.deltaY * 0.002));
    return;
  }

  const scrollAmount = event.deltaY * 0.5;
  const maxScroll = Math.max(0, selectedSignals.value.length * SIGNAL_ROW_HEIGHT - canvasHeight.value + TIME_AXIS_HEIGHT);
  waveScrollY.value = Math.max(0, Math.min(maxScroll, waveScrollY.value + scrollAmount));
  scheduleRender();
}

function onLabelMouseDown(event: MouseEvent) {
  const canvas = labelCanvasRef.value;
  if (!canvas || !metadata.value) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseY = event.clientY - rect.top + waveScrollY.value;
  const rowIndex = Math.floor((mouseY - TIME_AXIS_HEIGHT) / SIGNAL_ROW_HEIGHT);
  
  if (rowIndex >= 0 && rowIndex < selectedSignals.value.length) {
    dragIndex.value = rowIndex;
    isDragging.value = true;
    dragOverIndex.value = rowIndex;
  }
}

function onLabelMouseMove(event: MouseEvent) {
  const canvas = labelCanvasRef.value;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseY = event.clientY - rect.top + waveScrollY.value;
  const rowIndex = Math.floor((mouseY - TIME_AXIS_HEIGHT) / SIGNAL_ROW_HEIGHT);
  
  if (isDragging.value && dragIndex.value !== null) {
    if (rowIndex >= 0 && rowIndex < selectedSignals.value.length) {
      dragOverIndex.value = rowIndex;
      scheduleRender();
    }
    tooltipVisible.value = false;
    return;
  }
  
  if (rowIndex >= 0 && rowIndex < selectedSignals.value.length) {
    const signalId = selectedSignals.value[rowIndex];
    const signal = signalMap.value.get(signalId);
    if (signal) {
      const label = signal.width === 1 ? signal.name : `${signal.name} [${signal.width}]`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
  ctx.font = FONT_STYLE;
        const textWidth = ctx.measureText(label).width;
        const maxWidth = labelWidth.value - 16;
        
        if (textWidth > maxWidth) {
          tooltipText.value = label;
          tooltipX.value = event.clientX + 12;
          tooltipY.value = event.clientY + 12;
          tooltipVisible.value = true;
        } else {
          tooltipVisible.value = false;
        }
      }
    }
  } else {
    tooltipVisible.value = false;
  }
}

function onLabelMouseUp() {
  if (!isDragging.value || dragIndex.value === null || dragOverIndex.value === null) {
    resetDragState();
    return;
  }
  
  if (dragIndex.value !== dragOverIndex.value) {
    reorderSignals(dragIndex.value, dragOverIndex.value);
  }
  
  resetDragState();
  scheduleRender();
}

function onLabelMouseLeave() {
  resetDragState();
  tooltipVisible.value = false;
  scheduleRender();
}

function resetDragState() {
  dragIndex.value = null;
  dragOverIndex.value = null;
  isDragging.value = false;
}

function reorderSignals(fromIndex: number, toIndex: number) {
  const arr = [...selectedSignals.value];
  const [item] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, item);
  selectedSignals.value = arr;
}

let panelResizeStartX = 0;
let panelResizeStartWidth = 0;

function onPanelResizeStart(event: MouseEvent) {
  event.preventDefault();
  isResizingPanel.value = true;
  panelResizeStartX = event.clientX;
  panelResizeStartWidth = signalPanelWidth.value;
  document.addEventListener('mousemove', onPanelResizeMove);
  document.addEventListener('mouseup', onPanelResizeEnd);
}

function onPanelResizeMove(event: MouseEvent) {
  if (!isResizingPanel.value) return;
  const deltaX = event.clientX - panelResizeStartX;
  const newWidth = Math.max(100, Math.min(500, panelResizeStartWidth + deltaX));
  signalPanelWidth.value = newWidth;
}

function onPanelResizeEnd() {
  isResizingPanel.value = false;
  document.removeEventListener('mousemove', onPanelResizeMove);
  document.removeEventListener('mouseup', onPanelResizeEnd);
}

let labelResizeStartX = 0;
let labelResizeStartWidth = 0;

function onLabelResizeStart(event: MouseEvent) {
  event.preventDefault();
  isResizingLabel.value = true;
  labelResizeStartX = event.clientX;
  labelResizeStartWidth = labelWidth.value;
  document.addEventListener('mousemove', onLabelResizeMove);
  document.addEventListener('mouseup', onLabelResizeEnd);
}

function onLabelResizeMove(event: MouseEvent) {
  if (!isResizingLabel.value) return;
  const deltaX = event.clientX - labelResizeStartX;
  labelWidth.value = Math.max(80, Math.min(400, labelResizeStartWidth + deltaX));
}

function onLabelResizeEnd() {
  isResizingLabel.value = false;
  document.removeEventListener('mousemove', onLabelResizeMove);
  document.removeEventListener('mouseup', onLabelResizeEnd);
}

let keyInterval: ReturnType<typeof setInterval> | null = null;
const pressedKeys = new Set<string>();

function onKeyDown(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if (!['w', 'a', 's', 'd'].includes(key)) return;
  if (pressedKeys.has(key)) return;
  pressedKeys.add(key);

  if (pressedKeys.size === 1) {
    keyInterval = setInterval(() => {
      if (pressedKeys.has('w')) zoomIn();
      if (pressedKeys.has('s')) zoomOut();
      if (pressedKeys.has('a')) panLeft();
      if (pressedKeys.has('d')) panRight();
    }, 50);
  }
}

function onKeyUp(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  pressedKeys.delete(key);
  if (pressedKeys.size === 0 && keyInterval) {
    clearInterval(keyInterval);
    keyInterval = null;
  }
}

function panLeft() {
  if (!metadata.value) return;
  const range = viewEnd.value - viewStart.value;
  const shift = range * 0.1;
  const newStart = Math.max(metadata.value.timeRange.start, viewStart.value - shift);
  const newEnd = newStart + range;
  if (newEnd <= metadata.value.timeRange.end) {
    viewStart.value = newStart;
    viewEnd.value = newEnd;
  }
  scheduleRender();
}

function panRight() {
  if (!metadata.value) return;
  const range = viewEnd.value - viewStart.value;
  const shift = range * 0.1;
  const newEnd = Math.min(metadata.value.timeRange.end, viewEnd.value + shift);
  const newStart = newEnd - range;
  if (newStart >= metadata.value.timeRange.start) {
    viewStart.value = newStart;
    viewEnd.value = newEnd;
  }
  scheduleRender();
}

const collapsedScopes = shallowRef(new Set<VcdScopeNode>());

function isScopeCollapsed(node: VcdScopeNode): boolean {
  return collapsedScopes.value.has(node);
}

function toggleScope(node: VcdScopeNode) {
  const next = new Set(collapsedScopes.value);
  if (next.has(node)) {
    next.delete(node);
  } else {
    next.add(node);
  }
  collapsedScopes.value = next;
}

function renderScopeNode(node: VcdScopeNode, depth: number = 0): any[] {
  const items: any[] = [];
  items.push({ type: 'scope', node, depth });

  if (collapsedScopes.value.has(node)) {
    return items;
  }

  for (const signalId of node.signals) {
    const signal = signalMap.value.get(signalId);
    if (signal) {
      items.push({ type: 'signal', signal, depth: depth + 1 });
    }
  }

  for (const child of node.children) {
    items.push(...renderScopeNode(child, depth + 1));
  }

  return items;
}

const flatTree = computed(() => {
  if (!metadata.value) return [];
  const items: any[] = [];
  const roots = metadata.value.signalTree;
  for (let i = 0; i < roots.length; i++) {
    items.push(...renderScopeNode(roots[i], 0));
  }
  return items;
});

const treeScrollTop = ref(0);
const treeContainerHeight = ref(0);

const visibleRange = computed(() => {
  const total = flatTree.value.length;
  const start = Math.max(0, Math.floor(treeScrollTop.value / ITEM_HEIGHT) - VISIBLE_BUFFER);
  const end = Math.min(total, Math.ceil((treeScrollTop.value + treeContainerHeight.value) / ITEM_HEIGHT) + VISIBLE_BUFFER);
  return { start, end };
});

const visibleItems = computed(() =>
  flatTree.value.slice(visibleRange.value.start, visibleRange.value.end),
);

const totalTreeHeight = computed(() => flatTree.value.length * ITEM_HEIGHT);
const treeOffsetY = computed(() => visibleRange.value.start * ITEM_HEIGHT);

function onTreeScroll(event: Event) {
  const el = event.target as HTMLElement;
  treeScrollTop.value = el.scrollTop;
}

function setupCanvasSize(labelW: number, waveW: number, h: number) {
  labelWidth.value = labelW;
  waveWidth.value = waveW;
  canvasHeight.value = h;
  const dpr = window.devicePixelRatio || 1;
  
  const labelCanvas = labelCanvasRef.value;
  if (labelCanvas) {
    labelCanvas.width = labelW * dpr;
    labelCanvas.height = h * dpr;
    labelCanvas.style.width = `${labelW}px`;
    labelCanvas.style.height = `${h}px`;
  }
  
  for (const canvas of [waveCanvasRef.value, overlayCanvasRef.value]) {
    if (!canvas) continue;
    canvas.width = waveW * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${waveW}px`;
    canvas.style.height = `${h}px`;
  }
}

let labelResizeObserver: ResizeObserver | null = null;
let waveResizeObserver: ResizeObserver | null = null;
let treeResizeObserver: ResizeObserver | null = null;

onMounted(() => {
  cacheThemeColors();
  window.addEventListener('message', onMessage);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const labelContainer = labelContainerRef.value;
  if (labelContainer) {
    labelResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const waveContainer = waveContainerRef.value;
          const waveW = waveContainer ? waveContainer.clientWidth : 0;
          setupCanvasSize(width, waveW, height);
          scheduleRender();
        }
      }
    });
    labelResizeObserver.observe(labelContainer);
  }

  const waveContainer = waveContainerRef.value;
  if (waveContainer) {
    waveResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const labelContainer = labelContainerRef.value;
          const labelW = labelContainer ? labelContainer.clientWidth : 150;
          setupCanvasSize(labelW, width, height);
          scheduleRender();
        }
      }
    });
    waveResizeObserver.observe(waveContainer);
  }
});

watch(server.WaveformData, (newValue) => {
  if (!newValue) return;
  const data = newValue as VcdMetadata;
  metadata.value = data;
  collapsedScopes.value = new Set();
  viewStart.value = data.timeRange.start;
  viewEnd.value = data.timeRange.end;
  if (data.signals.length > 0) {
    selectedSignals.value = data.signals.slice(0, 10).map((s: VcdSignal) => s.id);
  }

  const map = new Map<string, [number, string][]>();
  if (data.changes) {
    for (const key of Object.keys(data.changes)) {
      map.set(key, data.changes[key]);
    }
  }
  changesMap.value = map;

  nextTick(() => {
    const labelContainer = labelContainerRef.value;
    const waveContainer = waveContainerRef.value;
    if (labelContainer && waveContainer && (labelWidth.value === 0 || waveWidth.value === 0 || canvasHeight.value === 0)) {
      const labelRect = labelContainer.getBoundingClientRect();
      const waveRect = waveContainer.getBoundingClientRect();
      if (labelRect.width > 0 && waveRect.width > 0 && labelRect.height > 0) {
        setupCanvasSize(labelRect.width, waveRect.width, labelRect.height);
      }
    }

    if (!labelResizeObserver && labelContainer) {
      labelResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            const waveContainer = waveContainerRef.value;
            const waveW = waveContainer ? waveContainer.clientWidth : 0;
            setupCanvasSize(width, waveW, height);
            scheduleRender();
          }
        }
      });
      labelResizeObserver.observe(labelContainer);
    }

    if (!waveResizeObserver && waveContainer) {
      waveResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            const labelContainer = labelContainerRef.value;
            const labelW = labelContainer ? labelContainer.clientWidth : 150;
            setupCanvasSize(labelW, width, height);
            scheduleRender();
          }
        }
      });
      waveResizeObserver.observe(waveContainer);
    }

    const treeEl = treeContainerRef.value;
    if (treeEl) {
      treeContainerHeight.value = treeEl.clientHeight;
      if (!treeResizeObserver) {
        treeResizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            treeContainerHeight.value = entry.contentRect.height;
          }
        });
        treeResizeObserver.observe(treeEl);
      }
    }

    scheduleRender();
  });
});

function onMessage(event: MessageEvent) {
  if (event.data.command === 'returnTheme') {
    cacheThemeColors();
    scheduleRender();
  }
}

onUnmounted(() => {
  labelResizeObserver?.disconnect();
  waveResizeObserver?.disconnect();
  treeResizeObserver?.disconnect();
  window.removeEventListener('message', onMessage);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  document.removeEventListener('mousemove', onPanelResizeMove);
  document.removeEventListener('mouseup', onPanelResizeEnd);
  document.removeEventListener('mousemove', onLabelResizeMove);
  document.removeEventListener('mouseup', onLabelResizeEnd);
  if (keyInterval) {
    clearInterval(keyInterval);
    keyInterval = null;
  }
  pressedKeys.clear();
  if (waveRafId) cancelAnimationFrame(waveRafId);
  if (overlayRafId) cancelAnimationFrame(overlayRafId);
});
</script>

<template>
  <div class="waveform-container">
    <div v-if="errorMessage" class="error-view">
      <div class="error-icon">!</div>
      <div class="error-text">{{ errorMessage }}</div>
    </div>
    <template v-else-if="metadata">
      <div class="waveform-toolbar">
        <button class="toolbar-btn" @mousedown.prevent @click="zoomIn" :title="$t('zoomIn')">+</button>
        <button class="toolbar-btn" @mousedown.prevent @click="zoomOut" :title="$t('zoomOut')">-</button>
        <button class="toolbar-btn" @mousedown.prevent @click="zoomFit" :title="$t('resizeWindow')">Fit</button>
        <span class="toolbar-info">
          {{ metadata.timescale }} |
          {{ viewStart.toFixed(0) }} ~ {{ viewEnd.toFixed(0) }} |
          {{ metadata.signalCount }} signals |
          {{ metadata.changeCount }} changes
        </span>
      </div>
      <div class="waveform-main">
        <div class="signal-panel" :style="{ width: signalPanelWidth + 'px' }">
          <div class="signal-panel-header">Signals</div>
          <div class="signal-tree" ref="treeContainerRef" @scroll="onTreeScroll">
            <div class="signal-tree-spacer" :style="{ height: totalTreeHeight + 'px' }">
              <div class="signal-tree-viewport" :style="{ transform: `translateY(${treeOffsetY}px)` }">
                <template v-for="(item, idx) in visibleItems" :key="visibleRange.start + idx">
                  <div
                    v-if="item.type === 'scope'"
                    class="tree-scope"
                    :style="{ paddingLeft: item.depth * 16 + 8 + 'px' }"
                    :title="item.node.name"
                    @click="toggleScope(item.node)"
                  >
                    <span class="tree-caret" :class="{ collapsed: isScopeCollapsed(item.node) }">▼</span>
                    {{ item.node.name }}
                  </div>
                  <div
                    v-else
                    class="tree-signal"
                    :class="{ selected: isSignalSelected(item.signal.id) }"
                    :style="{ paddingLeft: item.depth * 16 + 8 + 'px' }"
                    :title="item.signal.name"
                    @click="toggleSignal(item.signal.id)"
                  >
                    <span class="signal-name">{{ item.signal.name }}</span>
                    <span class="signal-width">[{{ item.signal.width }}]</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
        <div class="resize-handle" @mousedown="onPanelResizeStart"></div>
        <div class="canvas-container">
          <div class="label-area" ref="labelContainerRef" @wheel="onCanvasWheel" :style="{ width: labelWidth + 'px' }">
            <canvas
              ref="labelCanvasRef"
              class="label-layer"
              @mousedown="onLabelMouseDown"
              @mousemove="onLabelMouseMove"
              @mouseup="onLabelMouseUp"
              @mouseleave="onLabelMouseLeave"
            ></canvas>
          </div>
          <div class="resize-handle" @mousedown="onLabelResizeStart"></div>
          <div class="wave-area" ref="waveContainerRef" @wheel="onCanvasWheel" @mouseleave="onWaveAreaMouseLeave">
            <canvas ref="waveCanvasRef" class="wave-layer"></canvas>
            <canvas
              ref="overlayCanvasRef"
              class="overlay-layer"
              @mousemove="onCanvasMouseMove"
            ></canvas>
            <div v-if="zoomHint" class="zoom-hint">{{ zoomHint }}</div>
          </div>
        </div>
      </div>
      <div
        v-if="tooltipVisible"
        class="label-tooltip"
        :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
      >
        {{ tooltipText }}
      </div>
    </template>
    <div v-else class="loading-view">
      <div class="loading-spinner"></div>
      <span>Loading waveform...</span>
    </div>
  </div>
</template>

<style scoped>
.waveform-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--devui-base-bg, #1e1e1e);
  color: var(--devui-text, #ccc);
  overflow: hidden;
}

.error-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.error-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--devui-danger-line, #e74c3c);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
}

.error-text {
  font-size: 14px;
  color: var(--devui-danger-line, #e74c3c);
}

.loading-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--devui-line, #333);
  border-top-color: var(--devui-primary, #4fc3f7);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.waveform-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--devui-global-bg, #252526);
  border-bottom: 1px solid var(--devui-line, #333);
  flex-shrink: 0;
  height: 32px;
}

.toolbar-btn {
  padding: 2px 10px;
  border: 1px solid var(--devui-line, #333);
  background: var(--devui-input-bg, #3c3c3c);
  color: var(--devui-text, #ccc);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.toolbar-btn:hover {
  background: var(--devui-input-hover-bg, #505050);
}

.toolbar-info {
  font-size: 11px;
  color: var(--devui-secondary-text, #888);
  margin-left: auto;
}

.waveform-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.signal-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.signal-panel-header {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: bold;
  border-bottom: 1px solid var(--devui-line, #333);
  background: var(--devui-global-bg, #252526);
  flex-shrink: 0;
}

.signal-tree {
  flex: 1;
  overflow-y: auto;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  position: relative;
}

.signal-tree-spacer {
  position: relative;
  width: 100%;
}

.signal-tree-viewport {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

.tree-scope {
  padding: 4px 8px;
  height: 28px;
  line-height: 20px;
  box-sizing: border-box;
  color: var(--devui-secondary-text, #888);
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
  cursor: pointer;
}

.tree-scope:hover {
  background: var(--devui-list-item-hover-bg, #3a3a3a);
}

.tree-caret {
  display: inline-block;
  width: 14px;
  margin-right: 2px;
  font-size: 10px;
  color: var(--devui-secondary-text, #888);
  vertical-align: middle;
  transition: transform 0.15s;
}

.tree-caret.collapsed {
  transform: rotate(-90deg);
}

.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: var(--devui-line, #333);
  flex-shrink: 0;
  position: relative;
  z-index: 2;
  transition: background 0.15s;
}

.resize-handle:hover {
  background: var(--devui-primary, #4fc3f7);
}

.tree-signal {
  padding: 3px 8px;
  height: 28px;
  line-height: 22px;
  box-sizing: border-box;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
}

.tree-signal:hover {
  background: var(--devui-list-item-hover-bg, #3a3a3a);
}

.tree-signal.selected {
  background: var(--devui-list-item-active-bg, #094771);
  color: var(--devui-list-item-active-text, #fff);
}

.signal-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.signal-width {
  color: var(--devui-secondary-text, #888);
  font-size: 10px;
  flex-shrink: 0;
}

.canvas-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
}

.label-area {
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.wave-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.zoom-hint {
  position: absolute;
  top: 36px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  background: var(--devui-tooltip-bg, rgba(0, 0, 0, 0.7));
  color: var(--devui-tooltip-text, #ccc);
  border: 1px solid var(--devui-line, #333);
  border-radius: 4px;
  font-size: 12px;
  z-index: 10;
  pointer-events: none;
}

.label-layer,
.wave-layer,
.overlay-layer {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
}

.label-layer {
  cursor: grab;
}

.label-layer:active {
  cursor: grabbing;
}

.overlay-layer {
  z-index: 1;
}

.label-tooltip {
  position: fixed;
  background: var(--devui-tooltip-bg, #2d2d2d);
  color: var(--devui-text, #ccc);
  border: 1px solid var(--devui-line, #333);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
