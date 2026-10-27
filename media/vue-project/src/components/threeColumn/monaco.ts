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
/**
 * 通用 Monaco 编辑器装饰器管理层：
 * - 块状高亮：沿代码文本范围的阶梯轮廓 + 对角渐变背景与描边
 * - gutter 颜色条：行区间左侧颜色条装饰
 * 所有状态按 editor 实例隔离（WeakMap），editor dispose 时自动清理
 */
import * as monaco from 'monaco-editor';

export interface BlockHighlightStyle {
  strokeWidth?: number;
}

interface HighlightState {
  ranges: Array<[number, number]>;
  style: Required<BlockHighlightStyle>;
  canvas: HTMLCanvasElement | null;
}

const states = new WeakMap<monaco.editor.ICodeEditor, HighlightState>();

// 对角渐变：左上偏绿 → 右下偏红（与泳道图配色一致）
const GRADIENT_START = '#90b8f9';
const GRADIENT_END = '#ea8ede';

/**
 * 对 editor 中 ranges 指定的行区间添加块状高亮：
 * 沿每行代码文本范围构建阶梯轮廓，绘制对角渐变背景与描边（行号/缩略图区域自动裁剪）
 * @param editor monaco editor 实例
 * @param ranges 行区间二维数组，如 [[1, 1], [3, 5], [44, 59]]
 * @param style 描边样式
 */
export function renderBlockHighlights(
  editor: monaco.editor.ICodeEditor | null,
  ranges: Array<[number, number]>,
  style: BlockHighlightStyle = {},
): void {
  if (!editor) {
    return;
  }
  let state = states.get(editor);
  if (!state) {
    state = {
      ranges: [],
      style: { strokeWidth: 1, ...style },
      canvas: null,
    };
    states.set(editor, state);
    editor.onDidScrollChange(() => redraw(editor));
    editor.onDidLayoutChange(() => redraw(editor));
    editor.onDidChangeModelContent(() => redraw(editor));
  }
  state.ranges = ranges;
  state.style = { ...state.style, ...style };
  redraw(editor);
}

/**
 * 清除块状高亮
 */
export function clearBlockHighlights(editor: monaco.editor.ICodeEditor | null): void {
  const state = editor ? states.get(editor) : null;
  if (!state) {
    return;
  }
  state.ranges = [];
  redraw(editor);
}

/**
 * 更新样式（主题切换等场景）
 */
export function rerenderBlockHighlights(
  editor: monaco.editor.ICodeEditor | null,
  style?: BlockHighlightStyle,
): void {
  const state = editor ? states.get(editor) : null;
  if (!state) {
    return;
  }
  if (style) {
    state.style = { ...state.style, ...style };
  }
  redraw(editor);
}

// ==================== gutter 颜色条 ====================

export interface GutterBar {
  startLine: number;
  endLine: number;
  color: string;
}

interface GutterState {
  collection: monaco.editor.IEditorDecorationsCollection | null;
  styleEl: HTMLStyleElement | null;
  editorId: number;
}

let gutterEditorSeq = 0;
const gutterStates = new WeakMap<monaco.editor.ICodeEditor, GutterState>();

/**
 * 为 editor 添加左侧 gutter 颜色条装饰（重复调用整体替换）
 * @param editor monaco editor 实例
 * @param bars 颜色条列表，每项为行区间 + 颜色
 */
export function renderGutterBars(editor: monaco.editor.ICodeEditor | null, bars: GutterBar[]): void {
  if (!editor) {
    return;
  }
  let state = gutterStates.get(editor);
  if (!state) {
    const editorId = ++gutterEditorSeq;
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);
    state = { collection: editor.createDecorationsCollection([]), styleEl, editorId };
    gutterStates.set(editor, state);
    editor.onDidDispose(() => {
      state?.styleEl?.remove();
      gutterStates.delete(editor);
    });
  }
  const barClass = (index: number) => `pypto-gutter-bar-${state!.editorId}-${index}`;
  const marginClass = (index: number) => `pypto-gutter-margin-${state!.editorId}-${index}`;
  state.styleEl!.textContent = bars.map((bar, index) => `
    .${barClass(index)} {
      width: 4px !important;
      background-color: ${bar.color} !important;
      margin-left: 4px;
    }
    .${marginClass(index)} {
      background-color: ${bar.color} !important;
      opacity: 0.3;
      width: 4px !important;
    }
  `).join('\n');
  state.collection!.set(bars.map((bar, index) => ({
    range: new monaco.Range(bar.startLine, 1, bar.endLine, 1),
    options: {
      isWholeLine: false,
      linesDecorationsClassName: barClass(index),
      marginClassName: marginClass(index),
    },
  })));
}

/**
 * 清除 gutter 颜色条装饰
 */
export function clearGutterBars(editor: monaco.editor.ICodeEditor | null): void {
  const state = editor ? gutterStates.get(editor) : null;
  if (!state) {
    return;
  }
  state.collection?.set([]);
  if (state.styleEl) {
    state.styleEl.textContent = '';
  }
}

// ==================== 整行背景条 ====================

interface LineBandState {
  collection: monaco.editor.IEditorDecorationsCollection | null;
  styleEl: HTMLStyleElement | null;
  editorId: number;
}

let lineBandEditorSeq = 0;
const lineBandStates = new WeakMap<monaco.editor.ICodeEditor, LineBandState>();

/**
 * 为指定行添加整行蓝色背景条（重复调用整体替换）
 * @param editor monaco editor 实例
 * @param lines 行号列表
 * @param isDark 深色主题（浅色 #0A59F7 / 深色 #317AF7）
 */
export function renderLineBands(editor: monaco.editor.ICodeEditor | null, lines: number[], isDark: boolean): void {
  if (!editor) {
    return;
  }
  let state = lineBandStates.get(editor);
  if (!state) {
    const editorId = ++lineBandEditorSeq;
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);
    state = { collection: editor.createDecorationsCollection([]), styleEl, editorId };
    lineBandStates.set(editor, state);
    editor.onDidDispose(() => {
      state?.styleEl?.remove();
      lineBandStates.delete(editor);
    });
  }
  const color = isDark ? '#317AF7' : '#0A59F7';
  const className = `pypto-line-band-${state.editorId}`;
  state.styleEl!.textContent = `
    .${className} {
      background-color: ${color} !important;
    }
  `;
  state.collection!.set(lines.map((line) => ({
    range: new monaco.Range(line, 1, line, 1),
    options: {
      isWholeLine: true,
      className,
    },
  })));
}

/**
 * 清除整行背景条装饰
 */
export function clearLineBands(editor: monaco.editor.ICodeEditor | null): void {
  const state = editor ? lineBandStates.get(editor) : null;
  if (!state) {
    return;
  }
  state.collection?.set([]);
}

function redraw(editor: monaco.editor.ICodeEditor): void {
  const state = states.get(editor);
  if (!state) {
    return;
  }
  const canvas = ensureCanvas(editor, state);
  if (!canvas) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (state.ranges.length === 0) {
    return;
  }
  // 裁剪到代码内容区（行号/缩略图区域不绘制）
  const layout = editor.getLayoutInfo();
  const minimapInfo: any = (layout as any).minimap;
  const contentRight = minimapInfo?.minimapWidth > 0
    ? Math.min(layout.contentLeft + layout.contentWidth, minimapInfo.minimapLeft)
    : layout.contentLeft + layout.contentWidth;
  ctx.save();
  ctx.beginPath();
  ctx.rect(layout.contentLeft, 0, Math.max(0, contentRight - layout.contentLeft), layout.height);
  ctx.clip();
  for (const [startLine, endLine] of state.ranges) {
    drawBlock(editor, ctx, startLine, endLine, state.style);
  }
  ctx.restore();
}

function ensureCanvas(editor: monaco.editor.ICodeEditor, state: HighlightState): HTMLCanvasElement | null {
  if (state.canvas && state.canvas.isConnected) {
    return state.canvas;
  }
  if (state.canvas) {
    state.canvas.remove();
    state.canvas = null;
  }
  const dom = editor.getDomNode();
  if (!dom) {
    return null;
  }
  const host = (dom.querySelector('.overflow-guard') as HTMLElement) || dom;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
  host.appendChild(canvas);
  state.canvas = canvas;
  return canvas;
}

/**
 * 计算单个行区间的阶梯轮廓顶点：每行取首/末非空白字符的像素坐标，沿文本范围逐行进给构成闭环
 */
function computeRangeContour(editor: monaco.editor.ICodeEditor, startLine: number, endLine: number): Array<{ x: number; y: number }> {
  const model = editor.getModel();
  if (!model) {
    return [];
  }
  const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
  const spans: Array<{ left: number; right: number; top: number }> = [];
  for (let line = startLine; line <= endLine; line++) {
    const content = model.getLineContent(line);
    const firstNonWs = content.length - content.trimStart().length;
    const lastNonWs = content.trimEnd().length;
    if (lastNonWs <= firstNonWs) {
      continue;
    }
    const p1 = editor.getScrolledVisiblePosition({ lineNumber: line, column: firstNonWs + 1 });
    const p2 = editor.getScrolledVisiblePosition({ lineNumber: line, column: lastNonWs + 1 });
    if (!p1 || !p2) {
      continue;
    }
    spans.push({ left: p1.left, right: p2.left, top: p1.top });
  }
  if (spans.length === 0) {
    return [];
  }
  const pad = 1;
  const pts: Array<{ x: number; y: number }> = [];
  const first = spans[0];
  const last = spans[spans.length - 1];
  // 顶边（顺时针）
  pts.push({ x: first.left - pad, y: first.top + pad });
  pts.push({ x: first.right + pad, y: first.top + pad });
  // 右侧：逐行下探，行尾不对齐时水平进给
  for (let i = 1; i < spans.length; i++) {
    if (Math.abs(spans[i].right - spans[i - 1].right) > 0.5) {
      pts.push({ x: spans[i - 1].right + pad, y: spans[i].top });
      pts.push({ x: spans[i].right + pad, y: spans[i].top });
    }
  }
  pts.push({ x: last.right + pad, y: last.top + lineHeight - pad });
  // 底边（反向）
  pts.push({ x: last.left - pad, y: last.top + lineHeight - pad });
  // 左侧：逐行上探，行首不对齐时水平进给
  for (let i = spans.length - 2; i >= 0; i--) {
    if (Math.abs(spans[i].left - spans[i + 1].left) > 0.5) {
      pts.push({ x: spans[i + 1].left - pad, y: spans[i].top + lineHeight });
      pts.push({ x: spans[i].left - pad, y: spans[i].top + lineHeight });
    }
  }
  return pts;
}

function drawBlock(
  editor: monaco.editor.ICodeEditor,
  ctx: CanvasRenderingContext2D,
  startLine: number,
  endLine: number,
  style: Required<BlockHighlightStyle>,
): void {
  const pts = computeRangeContour(editor, startLine, endLine);
  if (pts.length < 3) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
  // 水平渐变：块包围盒左 → 右，背景半透明、描边不透明
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) { minX = p.x; }
    if (p.x > maxX) { maxX = p.x; }
    if (p.y < minY) { minY = p.y; }
    if (p.y > maxY) { maxY = p.y; }
  }
  const midY = (minY + maxY) / 2;
  const fillGradient = ctx.createLinearGradient(minX, midY, maxX, midY);
  fillGradient.addColorStop(0, `${GRADIENT_START}33`);
  fillGradient.addColorStop(1, `${GRADIENT_END}33`);
  ctx.fillStyle = fillGradient;
  ctx.fill();
  const strokeGradient = ctx.createLinearGradient(minX, midY, maxX, midY);
  strokeGradient.addColorStop(0, `${GRADIENT_START}99`);
  strokeGradient.addColorStop(1, `${GRADIENT_END}99`);
  ctx.strokeStyle = strokeGradient;
  ctx.lineWidth = style.strokeWidth;
  ctx.stroke();
}
