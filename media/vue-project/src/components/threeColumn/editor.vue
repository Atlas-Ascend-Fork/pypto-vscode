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
<div class="container editor-container">
  <Loading v-if="loading" :loadingText="loadingText" warningText="" />
  <div v-show="!loading" ref="containerRef" class="editor-container" @mouseleave="handleMouseLeave" @mouseenter="handleMouseEnter">
    <!-- 锁图标悬浮框（遮罩层显示时不出现） -->
    <div v-if="!isLocked && lockPosition && !noAssociatedObject"
         class="lock-indicator"
         @mouseenter="lockMouseEnter"
         @mouseleave="lockMouseLeave"
         @click="lockClick"
         :style="{
           top: lockPosition.top + 'px',
           left: lockPosition.left + 'px',
           'background-color': 'var(--devui-tooltip-bg)',
           'border-radius': '6px',
           padding: '4px 6px',
           cursor: 'pointer',
         }">
      <d-icon name="lock-open"></d-icon>
    </div>
    <div v-if="isLocked && lockPosition && !noAssociatedObject"
         class="lock-indicator"
         id="guideEditorLock"
         @click="unLockClick"
         :style="{
           top: lockPosition.top + 'px',
           left: lockPosition.left + 'px',
           'background-color': 'rgba(49,122,247,1)',
           'border-radius': '6px',
           padding: '4px 6px',
           cursor: 'pointer',
         }">
      <d-icon name="icon-lock-private" style="color: #ffffff;"></d-icon>
    </div>
  </div>
  <!-- 跨栏悬停无关联对象（ops 未命中）遮罩；关闭 = 忽略本次提示，直到悬停状态变化重新判定 -->
  <noDataMask v-if="noAssociatedObject" :text="$t('noAssociatedObject')" :is-dark="isDarkTheme" @close="noAssociatedObject = false" />
</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, inject, Ref } from 'vue';
import * as monaco from 'monaco-editor';
import { generateColorList, getColorByString } from '../../utils/color-list';
import { mkSemanticLabel, parseSemanticLabels, labels } from './parser';
import { renderBlockHighlights, clearBlockHighlights, rerenderBlockHighlights, renderGutterBars, renderLineBands, clearLineBands } from './monaco';
import { useI18n } from 'vue-i18n';
import Loading from '../comGraph/loading.vue';
import noDataMask from '../util/noDataMask.vue';
import { throttle } from 'lodash-es';
import { useViewServer } from '../../core/use-view-server';
import { ThreeColumnServer } from 'ext:/view/servers/three-column-server';
const { server:threeColumnServer } = useViewServer<ThreeColumnServer>();

const { t: $t } = useI18n();
const { isDarkTheme } = inject('threeColumnState') as {isDarkTheme:Ref<boolean>};
const { editorFileName, pyFileList } = inject('threeColumnState') as { editorFileName: Ref<string>; pyFileList: Ref<Array<{ path: string; name: string; exists: boolean }>> };

const darkThemeColors = generateColorList(360);
const lithtThemeColors = generateColorList(360, false);
const darkThemeBaseColors = darkThemeColors.baseColorList;
const darkThemeLightColors = darkThemeColors.lightColorList;
const lightThemeBaseColors = lithtThemeColors.baseColorList;
const lightThemeLightColors = lithtThemeColors.lightColorList;

const containerRef = ref(null);
const loadingText = ref($t('loadCode'));
const loading = ref(true);
const guideEditor = ref(false);
let editor = null;
let lastSentLabel = '';
let lastSentLine = 0;
let lastMoveLabel = null;
let lockedLabel = null;
let isMouseLeaved = false;
let labelInfoDecorations = []; // 存储标签信息装饰
let initCodePath = '';
let initTotalLine = 0;
const isLocked = ref(false);
const lockPosition = ref(null);
// 泳道起点悬停"暂无关联对象"遮罩（有 label、ops 未命中时显示）
const noAssociatedObject = ref(false);

// 配置 Monaco Editor
const configureMonaco = () => {
  if (typeof window === 'undefined') {
    return;
  }
  // main.ts 已注入基于 Vite worker 的 getWorker（js/css/html/ts/editor），必须保留。
  // 仅在缺失时才提供 getWorkerUrl 回退：这里写死的是相对路径，
  // 在 vscode-webview:// 下会解析成不存在的 monaco-editor-workers/*.worker.js
  // （MIME 为空 → worker 加载失败），并会清掉 main.ts 的 getWorker。
  const monacoEnvironment = (self as any).MonacoEnvironment;
  if (monacoEnvironment?.getWorker) {
    return;
  }
  (self as any).MonacoEnvironment = {
    getWorkerUrl: (moduleId, label) => {
      if (label === 'json') {
        return './monaco-editor-workers/json.worker.js';
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return './monaco-editor-workers/css.worker.js';
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return './monaco-editor-workers/html.worker.js';
      }
      if (label === 'typescript' || label === 'javascript') {
        return './monaco-editor-workers/ts.worker.js';
      }
      return './monaco-editor-workers/editor.worker.js';
    },
  };
};

// 应用语义标签装饰
const applySemanticDecorations = () => {
  if (!editor) {
    return;
  }
  const baseColorList = isDarkTheme.value ? darkThemeBaseColors : lightThemeBaseColors;
  const lightColorList = isDarkTheme.value ? darkThemeLightColors : lightThemeLightColors;
  renderGutterBars(editor, labels.map((label) => ({
    startLine: label.startLine,
    endLine: label.endLine,
    color: getColorByString(label.name, baseColorList, lightColorList).baseColor,
  })));
};

// 查找光标所在的语义标签区域
const findSemanticLabelAtPosition = (position) => {
  if (!position) {
    return null;
  }
  return labels.find(label =>
    position.lineNumber >= label.startLine &&
    position.lineNumber <= label.endLine
  );
};

// 在行尾显示语义标签信息
const showLabelInfo = (position, currentLabel) => {
  const lineContent = editor.getModel().getLineContent(position.lineNumber);
  const lineLength = lineContent.length;

  // 创建标签信息装饰器
  const labelInfoDecoration = {
    range: new monaco.Range(position.lineNumber, 0, position.lineNumber, lineLength + 1),
    options: {
      after: {
        content: `      semantic label: ${currentLabel.name}`,
        inlineClassName: 'semantic-label-info',
      },
    }
  };

  const decorations = editor.deltaDecorations([], [labelInfoDecoration]);
  labelInfoDecorations = decorations;
};

// 清除标签信息显示
const clearLabelInfo = () => {
  if (labelInfoDecorations && labelInfoDecorations.length > 0) {
    editor.deltaDecorations(labelInfoDecorations, []);
    labelInfoDecorations = [];
  }
};

// 获取视口中指定行号的DOM元素
const getLineDomElement = (lineNumber) => {
  if (!editor) {
    return null;
  }

  const editorDom = editor.getDomNode();
  if (!editorDom) {
    return null;
  }

  // 获取视口可见范围
  const visibleRanges = editor.getVisibleRanges();
  if (visibleRanges.length === 0) {
    return null;
  }

  const topVisibleLine = visibleRanges[0].startLineNumber;
  const bottomVisibleLine = visibleRanges[0].endLineNumber;
  // 如果目标行不在视口内，返回视口内的第一行
  const line = (lineNumber < topVisibleLine || lineNumber > bottomVisibleLine) ? topVisibleLine : lineNumber;
  const viewLineIndex = line - topVisibleLine;
  const viewLines = editorDom.querySelector('.view-lines');
  if (!viewLines) {
    return null;
  }
  const viewLineElements = viewLines.querySelectorAll('.view-line');
  if (viewLineElements.length === 0) {
    return null;
  }

  const sortedElements = Array.from(viewLineElements).sort((a:HTMLElement, b:HTMLElement) => {
    const topA = parseInt(a.style.top) || 0;
    const topB = parseInt(b.style.top) || 0;
    return topA - topB;
  });

  return sortedElements[viewLineIndex] || sortedElements[0];
};

// 更新锁图标位置（锁定态下标签滚出视口时，锁吸附在编辑器上/下边缘保持可见）
const updateLockPosition = (label) => {
  if (!editor || !label) {
    return;
  }
  const visibleRanges = editor.getVisibleRanges();
  if (!visibleRanges || !visibleRanges[0]) {
    return;
  }
  const [{ startLineNumber, endLineNumber }] = visibleRanges;
  const domNode = editor.getDomNode();
  const locked = isLocked.value;
  const snapTop = { top: 4, left: 63 };
  const snapBottom = { top: domNode ? domNode.clientHeight - 32 : 0, left: 63 };

  // 标签起始行在视口上方 → 锁定态吸附顶部，未锁定隐藏
  if (label.startLine < startLineNumber) {
    lockPosition.value = locked ? snapTop : null;
    return;
  }
  // 标签起始行在视口下方 → 锁定态吸附底部，未锁定隐藏
  if (label.startLine > endLineNumber) {
    lockPosition.value = locked ? snapBottom : null;
    return;
  }

  // 起始行在视口内：跟随起始行位置
  const domElement = getLineDomElement(label.startLine) as HTMLElement;
  if (!domElement) {
    lockPosition.value = locked ? snapTop : null;
    return;
  }
  const rect = domElement.getBoundingClientRect();

  // 与 sticky-block 重叠 → 锁定态吸附顶部，未锁定隐藏
  const stickyBlocks = document.querySelectorAll('.sticky-block');
  for (const block of stickyBlocks) {
    const blockRect = block.getBoundingClientRect();
    if (rect.bottom > blockRect.top && rect.top < blockRect.bottom) {
      lockPosition.value = locked ? snapTop : null;
      return;
    }
  }

  const editorRect = domNode.getBoundingClientRect();
  lockPosition.value = {
    top: rect.top - editorRect.top + 20,
    left: 63,
  };
};

// 支持锁定
const enableLock = (label) => {
  updateLockPosition(label);
};

// 退出锁定状态：清空渐变、蓝条、锁图标，并向其他栏广播；未锁定时直接退出
const deactivateLock = () => {
  if (!isLocked.value) {
    return;
  }

  updateBkDecoration(lockedLabel, false);
  isLocked.value = false;
  lockedLabel = null;
  lastMoveLabel = null;
  clearBlockHighlights(editor);
  clearLineBands(editor);
  lockPosition.value = null;
  sendMsg('deactivateLock', '');
};

const getBlockStyle = (isLock: boolean) => {
  return {
    strokeWidth: isLock ? 1.5 : 1,
  };
};

const updateBkDecoration = (lockedLabel: any, isLock: boolean) => {
  if (!lockedLabel || !editor) {
    clearBlockHighlights(editor);
    return;
  }
  // 无 label 的合成锁定目标（name 为空）不显示渐变背景
  if (!lockedLabel.name) {
    clearBlockHighlights(editor);
    return;
  }
  renderBlockHighlights(editor, [[lockedLabel.startLine, lockedLabel.endLine]], getBlockStyle(isLock));
};

const lockClick = (e) => {
  e.stopPropagation();
  lockedLabel = lastMoveLabel;
  isLocked.value = true;
  updateBkDecoration(lockedLabel, true);
  sendMsg('activeLock', { label: lastMoveLabel.name });
};

const unLockClick = (e) => {
  e.stopPropagation();
  deactivateLock();
};

// 更新悬停装饰：label 块同步渲染；蓝条等查询结果后整体替换（render 自带替换语义，等待期保留旧装饰防闪烁）
const updateHoverDecoration = async (position, emit = true) => {
  // 如果处于锁定状态，不更新悬停装饰
  if (isLocked.value) {
    return;
  }

  if (!position) {
    clearBlockHighlights(editor);
    clearLineBands(editor);
    lockPosition.value = null;
    if (lastSentLabel && emit) {
      sendMsg('returnSemanticLabelFromCode', { label: '' });
      sendMsg('returnFileLineFromCode', { file: '', line: 0 });
      lastSentLabel = null;
      lastSentLine = 0;
    }
    return;
  }

  // label 不依赖查询，先同步渲染/清除，避免清空-等待-重画的闪烁
  const currentLabel = findSemanticLabelAtPosition(position);
  if (currentLabel) {
    renderBlockHighlights(editor, [[currentLabel.startLine, currentLabel.endLine]], getBlockStyle(false));
  } else {
    clearBlockHighlights(editor);
  }

  // 蓝条：悬停行指示，非空代码行即显示
  const lineContent = editor?.getModel()?.getLineContent(position.lineNumber) ?? '';
  if (lineContent.trim()) {
    renderLineBands(editor, [position.lineNumber], isDarkTheme.value);
  } else {
    clearLineBands(editor);
  }

  // 该行是否有 op 落点（无 label 的裸 op 行也需向外栏发送 file+line）
  const hasOpmagic = await hasOpsOnLine(position.lineNumber);
  if (isLocked.value) {
    return;
  }

  if (currentLabel || hasOpmagic) {
    // label 事件按标签名去重：同一 label 块内换行不重复发送
    const nextLabel = currentLabel ? currentLabel.name : '';
    if (emit && lastSentLabel !== nextLabel && !isMouseLeaved) {
      lastSentLabel = nextLabel;
      lastSentLine = 0; // 同批补发一次行事件，保持两个事件成对出现
      sendMsg('returnSemanticLabelFromCode', { label: nextLabel });
    }
    // file+line 事件按行号去重：计算图列据此逐行反查 op 落点，
    // 因此同一 label 块内换行同样要发（只按标签去重会吞掉块内的行变化）
    if (emit && lastSentLine !== position.lineNumber && !isMouseLeaved) {
      lastSentLine = position.lineNumber;
      sendMsg('returnFileLineFromCode', { file: initCodePath, line: position.lineNumber });
    }
  } else if (emit && !isMouseLeaved && lastSentLabel !== null) {
    // 无标签也无 opmagic：清空之前发送的状态
    sendMsg('returnSemanticLabelFromCode', { label: '' });
    sendMsg('returnFileLineFromCode', { file: '', line: 0 });
    lastSentLabel = null;
    lastSentLine = 0;
  }
};

// 悬停行是否有对应 ops
const hasOpsOnLine = async (lineNumber: number): Promise<boolean> => {
  return pyOpmagicLineSet.has(lineNumber);
};

// ops 命中后锁锚定修正：op 首行不在当前 label 范围内（或 label 未命中）时，锁跟随 op 首行
const adjustLockToOpLine = (firstLine: number) => {
  if (isLocked.value) {
    return;
  }
  if (lastMoveLabel && firstLine >= lastMoveLabel.startLine && firstLine <= lastMoveLabel.endLine) {
    // op 首行在 label 范围内，锁保持 label 左上角锚定
    return;
  }
  const syntheticLabel = { name: '', startLine: firstLine, endLine: firstLine };
  lastMoveLabel = syntheticLabel;
  enableLock(syntheticLabel);
};

// 计算图精确过滤后的 opmagic 渲染：本地逆索引查 py 落点，只渲染当前文件命中的行
// 返回是否命中（泳道起点用于"暂无关联对象"遮罩判定）
const highlightOpmagicLines = (hash: string | null, ops: number[]): boolean => {
  if (!editor || isLocked.value) {
    return false;
  }
  if (!hash || !ops?.length) {
    clearBlockHighlights(editor);
    return false;
  }
  // 落点 pyFile 可能是编译机路径，与本地路径不一致时按 basename 兜底匹配
  const editorBase = initCodePath.split(/[\/\\]/).pop();
  const lines = ops
    .map((opmagic) => opLocationIndex.get(`${hash}_${opmagic}`))
    .filter((location): location is { pyFile: string; pyLine: number } => !!location && location.pyFile.split(/[\/\\]/).pop() === editorBase)
    .map((location) => location.pyLine);
  if (!lines.length) {
    // 落点全不在当前文件：清除旧渐变，避免上一个 task 的渐变残留
    clearBlockHighlights(editor);
    return false;
  }
  const sorted = Array.from(new Set(lines)).sort((a, b) => a - b);
  const opmagicRanges: Array<[number, number]> = [];
  for (const line of sorted) {
    const last = opmagicRanges[opmagicRanges.length - 1];
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      opmagicRanges.push([line, line]);
    }
  }
  renderBlockHighlights(editor, opmagicRanges, getBlockStyle(false));
  editor.revealPositionInCenter({ lineNumber: sorted[0], column: 1 });
  adjustLockToOpLine(sorted[0]);
  return true;
};

// 计算图悬停的 ops 蓝条：本地逆索引定位落点行，当前文件命中的行画整行蓝条
// （label 渐变框由 returnSemanticLabelFromCom 渲染；跨栏悬停滚动优先定位 op 行，覆盖 label 首行定位）
// 返回是否命中（跨栏悬停"暂无关联对象"遮罩判定）
// reveal=false：py 自身回声用，用户已停在该行，居中滚动会与其手动滚动互相抢占
// expectLine：丢弃陈旧回声，落点行与当前悬停行不符时整段跳过，不动已有蓝条
const highlightOpmagicBands = (hash: string | null, ops: number[], reveal = true, expectLine?: number): boolean => {
  if (!editor || isLocked.value) {
    return false;
  }
  if (!hash || !ops?.length) {
    clearLineBands(editor);
    return false;
  }
  // 落点 pyFile 可能是编译机路径，与本地路径不一致时按 basename 兜底匹配
  const editorBase = initCodePath.split(/[\/\\]/).pop();
  const lines = Array.from(
    new Set(
      ops
        .map((opmagic) => opLocationIndex.get(`${hash}_${opmagic}`))
        .filter((location): location is { pyFile: string; pyLine: number } => !!location && location.pyFile.split(/[\/\\]/).pop() === editorBase)
        .map((location) => location.pyLine),
    ),
  );
  if (!lines.length) {
    clearLineBands(editor);
    return false;
  }
  if (expectLine != null && !lines.includes(expectLine)) {
    return;
  }
  renderLineBands(editor, lines, isDarkTheme.value);
  if (!reveal) {
    return;
  }
  // 既有 label 又有 op 的跨栏悬停：滚动优先定位到 op 行（覆盖 label 首行的 reveal）
  const sorted = Array.from(lines).sort((a, b) => a - b);
  editor.revealPositionInCenter({ lineNumber: sorted[0], column: 1 });
  adjustLockToOpLine(sorted[0]);
  return true;
};

// 通过泳道图/计算图发送的语义标签，更新悬停装饰
// renderGradient=true 按 label 范围渲染渐变块（计算图悬停）；false 只滚动定位（泳道图悬停，渐变由 returnOpsFromCom 渲染）
const updateHoverDecorationBySemanticLabel = (label, renderGradient = true) => {
  if (isLocked.value) {
    return;
  }
  const targetLabel = labels.find(l => l.name === label);

  if (!targetLabel) {
    clearBlockHighlights(editor);
    clearLineBands(editor);
    lockPosition.value = null;
    lastMoveLabel = null;
    return;
  }

  lastMoveLabel = targetLabel;
  if (renderGradient) {
    renderBlockHighlights(editor, [[targetLabel.startLine, targetLabel.endLine]], getBlockStyle(false));
  } else {
    clearBlockHighlights(editor);
  }
  const startPosition = { lineNumber: targetLabel.startLine, column: 1 };
  editor.revealPositionInCenter(startPosition);
  editor.setPosition(startPosition);
  if (!isLocked.value) {
    enableLock(targetLabel);
  }
};

// ESC键处理
const handleKeyDown = (e) => {
  if (e.keyCode === 9 /* Escape */ && isLocked.value) {
    deactivateLock();
    e.preventDefault();
    e.stopPropagation();
  }
};

// 滚动事件处理，更新锁位置
const handleScroll = () => {
  const label = lastMoveLabel || lockedLabel;
  if (label) {
    updateLockPosition(label);
  }
};

const handleMouseMove = throttle((e) => {
  if (isMouseLeaved) {
    return;
  }
  const { position } = e.target;
  simulateMouseMove(position);
}, 100);

const simulateMouseMove = async (position) => {
  const currentLabel = findSemanticLabelAtPosition(position);
  const hasOpmagic = await hasOpsOnLine(position.lineNumber);

  if (currentLabel) {
    // 有 label：label 优先，同 label 内不重复触发
    if (!lastMoveLabel || currentLabel.name !== lastMoveLabel.name) {
      enableLock(isLocked.value ? lockedLabel : currentLabel);
      if (!isLocked.value) {
        lastMoveLabel = currentLabel;
      }
    }
  } else if (hasOpmagic && !isLocked.value) {
    // 无 label 有 opmagic：以单行为锁定目标
    const syntheticLabel = { name: '', startLine: position.lineNumber, endLine: position.lineNumber };
    enableLock(syntheticLabel);
    lastMoveLabel = syntheticLabel;
  } else if (!isLocked.value) {
    // 既无 label 也无 opmagic：清除锁
    lastMoveLabel = null;
    lockPosition.value = null;
  }
  await updateHoverDecoration(position);
};
// 添加鼠标悬停事件监听
const setupHoverListeners = () => {
  if (!editor) {
    return;
  }

  // 鼠标移动事件
  editor.onMouseMove((e) => {
    handleMouseMove(e);
  });

  // 鼠标点击事件
  editor.onMouseDown(async (e) => {
    const { position } = e.target;
    if (position) {
      // 清除之前的标签信息装饰
      clearLabelInfo();
      const currentLabel = findSemanticLabelAtPosition(position);
      const hasOpmagic = await hasOpsOnLine(position.lineNumber);
      if (!currentLabel && !hasOpmagic) {
        return;
      }
      const lockTarget = currentLabel || { name: '', startLine: position.lineNumber, endLine: position.lineNumber };
      if (currentLabel) {
        showLabelInfo(position, currentLabel);
        sendMsg('returnSemanticLabelFromCodeClick', { label: currentLabel.name });
      }
      // 锁定或切换锁定目标（已锁定时点击另一行切换到新行）
      lockedLabel = lockTarget;
      lastMoveLabel = lockTarget;
      isLocked.value = true;
      updateBkDecoration(lockedLabel, true);
      clearLineBands(editor);
      if (hasOpmagic) {
        renderLineBands(editor, [position.lineNumber], isDarkTheme.value);
      }
      updateLockPosition(lockedLabel);
      sendMsg('activeLockFromPy', {
        label: lockTarget.name,
        file: initCodePath,
        line: position.lineNumber,
      });
    }
  });

  // 内容变化事件
  editor.onDidChangeModelContent(() => {
    const cursorPosition = editor.getPosition();
    if (!isLocked.value) {
      updateHoverDecoration(cursorPosition);
    }
    clearLabelInfo();
  });

  // 滚动事件监听
  editor.onDidScrollChange(() => {
    handleScroll();
  });
};

const handleMouseLeave = () => {
  updateHoverDecoration(null);
  lastMoveLabel = null;
  lastSentLabel = 'Mouse Leave';
  lastSentLine = 0;
  isMouseLeaved = true;
};

const handleMouseEnter = () => {
  isMouseLeaved = false;
};

// 添加悬停效果的 CSS
const setupHoverStyles = () => {
  const style = document.createElement('style');

  style.textContent = `
    .lock-indicator {
      position: absolute;
      z-index: 100;
      font-size: 16px;
      cursor: pointer;
      filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.5));
    }
  `;
  document.head.appendChild(style);
};

const initEditor = (code) => {
  if (!containerRef.value) {
    nextTick(() => initEditor(code));
    return;
  }

  if (editor) {
    editor.dispose();
    editor = null;
  }

  if (isLocked.value) {
    isLocked.value = false;
    sendMsg('deactivateLock','');
  }

  const container = containerRef.value;
  const language = initCodePath.endsWith('py') ? 'python' : 'cpp';

  editor = monaco.editor.create(container, {
    value: code,
    language,
    automaticLayout: true,
    readOnly: true,
    theme: isDarkTheme.value ? 'vs-dark' : 'vs',
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    roundedSelection: false,
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
      useShadows: false
    },
    stickyScroll: {
      enabled: false,
    },
  });

  // 设置悬停样式
  setupHoverStyles();

  setupHoverListeners();

  // CompleteData 早于 PyCode 到达时补算语义标签
  if (pendingLabelRefresh) {
    pendingLabelRefresh = !refreshSemanticLabels();
  }

  // 添加键盘事件监听
  editor.addCommand(monaco.KeyCode.Escape, () => {
    deactivateLock();
  });

  // 监听内容变化，实时更新语义标签
  editor.onDidChangeModelContent(() => {
    applySemanticDecorations();
  });
};

const updateTheme = () => {
  if (editor) {
    const theme = isDarkTheme.value ? 'vs-dark' : 'vs';
    monaco.editor.setTheme(theme);
    setupHoverStyles();
    applySemanticDecorations();
    rerenderBlockHighlights(editor, getBlockStyle(isLocked.value));
  }
};

// 悬停来源：由 returnOpsFromCom.source 指定
(window as any).ascEventBus.on('returnSemanticLabelFromCom', (args) => {
  updateHoverDecorationBySemanticLabel(args.label, true);
});
(window as any).ascEventBus.on('returnSemanticLabelFromSwim', (args) => {
  updateHoverDecorationBySemanticLabel(args.label, false);
});
// 计算图精确过滤后的 opmagic 列表
// source='swim'（泳道图悬停）→ 按 opmagic 行渲染渐变块；source='com'/'cce' → 渲染单行蓝条
// 跨栏悬停 ops 未命中（hash 非空但解析为空/落点不在当前文件）→ "暂无关联对象"遮罩，不区分起点
// source='py'   → py 自身悬停的回声，仅按图侧解析结果校正蓝条
// 其它来源      → 按 opmagic 行渲染单行蓝条
// 计算图最近一次给出的 ops（returnOpsFromCom），泳道发起锁定（activeLockFromCom source='swim'）时用作渐变
let lastComOps: { hash: string | null; ops: number[] } | null = null;

(window as any).ascEventBus.on('returnOpsFromCom', (args) => {
  if (args.source === 'swim') {
    lastComOps = { hash: args.hash, ops: args.ops };
    highlightOpmagicLines(args.hash, args.ops);
  } else if (args.source === 'py') {
    // 回声 ops 为空（悬停在空白行）：本地悬停已清除蓝条，此处直接跳过，
    // 避免在途的陈旧回声抹掉用户已移动到的新行蓝条。
    // 不写 lastComOps：它是泳道锁定的渐变来源，不应被 py 自回声覆盖
    // if (!args?.hash || !args?.ops?.length) {
    //   return;
    // }
    // highlightOpmagicBands(args.hash, args.ops, false, lastSentLine);
    return;
  } else {
    lastComOps = { hash: args.hash, ops: args.ops };
    highlightOpmagicBands(args.hash, args.ops);
  }
  lastComOps = { hash: args.hash, ops: args.ops };
  const hit = args.source === 'swim' ? highlightOpmagicLines(args.hash, args.ops) : highlightOpmagicBands(args.hash, args.ops);
  noAssociatedObject.value = !!args.hash && !hit && !isLocked.value;
});
// CCE 行悬停 → py 栏按 label 设置渐变背景色（空串清除）
(window as any).ascEventBus.on('returnSemanticLabelFromCce', (args) => {
  const label = args?.label ?? '';
  if (label) {
    // 其他栏交互接管，隐藏无关联遮罩
    noAssociatedObject.value = false;
  }
  updateHoverDecorationBySemanticLabel(label, true);
});
// CCE op 悬停 → py 栏按 (hash, opmagic) 设置该语句行蓝条（本地逆索引；无落点/非当前文件则清除）
(window as any).ascEventBus.on('returnOpFromCce', (args) => {
  if (!editor || isLocked.value) {
    return;
  }
  // cce 清除信号为 {opmagic: 0, hash: ''}，空值同样视为清除（悬停离开/非 op 行）
  if (!args?.hash || !args?.opmagic) {
    clearLineBands(editor);
    noAssociatedObject.value = false;
    return;
  }
  const loc = opLocationIndex.get(`${args.hash}_${args.opmagic}`);
  const editorBase = initCodePath.split(/[\/\\]/).pop();
  if (loc && loc.pyFile.split(/[\/\\]/).pop() === editorBase) {
    noAssociatedObject.value = false;
    renderLineBands(editor, [loc.pyLine], isDarkTheme.value);
    editor.revealPositionInCenter({ lineNumber: loc.pyLine, column: 1 });
    adjustLockToOpLine(loc.pyLine);
  } else {
    // CCE 起点 ops 未命中 → 暂无关联对象遮罩
    clearLineBands(editor);
    noAssociatedObject.value = true;
  }
});
(window as any).ascEventBus.on('activeLock', ({ label }) => {
  const targetLabel = labels.find(l => l.name === label);
  if (!targetLabel) {
    // label 未命中当前文件：不可定位，不锁定（遮罩如有则保持）
    return;
  }
  if (lastMoveLabel !== label) {
    updateHoverDecorationBySemanticLabel(label);
  }
  noAssociatedObject.value = false;
  isLocked.value = true;
  lockedLabel = targetLabel;
  updateBkDecoration(lockedLabel, true);
});
// 泳道图发出的锁定广播（携带 opmagic/leafHash，editor 侧暂不使用）
(window as any).ascEventBus.on('activeLockFromSwim', ({ label }) => {
  const targetLabel = labels.find(l => l.name === label);
  if (!targetLabel) {
    return;
  }
  if (lastMoveLabel !== label) {
    updateHoverDecorationBySemanticLabel(label);
  }
  noAssociatedObject.value = false;
  isLocked.value = true;
  lockedLabel = targetLabel;
  updateBkDecoration(lockedLabel, true);
});
// 计算图锁定 op 广播 → py 栏（source 标记发起栏）。py 自身发起的直接忽略（自回声）；
// 渐变背景按来源：cce/其它 → label 区间，swim → 计算图最近一次给出的 ops 行区间；
// 之后按 hash+op 锁定代码行
const applyActiveLock = (args) => {
  const hash = args.hash ?? args.leafHash;
  const line = hash && args.opMagic != null ? opLocationIndex.get(`${hash}_${args.opMagic}`)?.pyLine : undefined;
  const targetLabel = args.label ? labels.find((l) => l.name === args.label) : undefined;

  // 精确层锁定目标是 op：无 py 落点即无关联，不锁定（不退化为 label 锁定），
  // "暂无关联对象"遮罩保持——与悬停遮罩口径一致（ops 未命中即显示，不看 label）
  if (line == null) {
    return;
  }
  // 有落点 → 解除遮罩，进入锁定态
  noAssociatedObject.value = false;

  // 渐变背景：渲染函数带 isLocked 守卫，须在置锁前渲染；置锁后 updateBkDecoration 会用锁定
  // 目标重画并覆盖渐变，故锁定流程不再调用它
  if (args.source === 'swim') {
    if (lastComOps) {
      highlightOpmagicLines(lastComOps.hash, lastComOps.ops);
    }
  } else if (targetLabel) {
    renderBlockHighlights(editor, [[targetLabel.startLine, targetLabel.endLine]], getBlockStyle(true));
  }

  // 按 hash+op 锁定代码行
  isLocked.value = true;
  lockedLabel = { name: '', startLine: line, endLine: line };
  lastMoveLabel = lockedLabel;
  updateLockPosition(lockedLabel);
  if (editor) {
    editor.revealPositionInCenter({ lineNumber: line, column: 1 });
  }
};

// 跨文件锁定挂起：candidate 最多一个 py 文件，非当前文件先切换，编辑器重建后继续执行
let pendingActiveLock: any = null;

(window as any).ascEventBus.on('activeLockFromCom', (args) => {
  if (!args || args.source === 'py') {
    return;
  }
  const candidatePy: string | undefined = args.candidate?.py?.[0];
  if (candidatePy && candidatePy.split(/[\/\\]/).pop() !== initCodePath.split(/[\/\\]/).pop()) {
    pendingActiveLock = args;
    threeColumnServer.switchPyFile({ paramObj: { path: candidatePy } });
    return;
  }
  applyActiveLock(args);
});
(window as any).ascEventBus.on('deactivateLock', () => {
  deactivateLock();
});

// 监听引导模式的消息
const listenExtensionMessage = () => {
  window.ascEventBus.on('boot-step-tips', (event) => {
    const message = event.data;
    if (event.type === 'welcomeSkipAll') {
      threeColumnServer.closeWebview();
    }
    if (event.type == 'callWebviewMethod') {
      switch (message.methodName) {
        case 'viewThreeColumnGraph':
          if (guideEditor.value) {
            guideEditor.value = !guideEditor.value;
            updateBkDecoration(lockedLabel, false);
            deactivateLock();
            clearLabelInfo();
            let positionGuide = {
              "lineNumber": 1,
              "column": 1
            };
            simulateMouseMove(positionGuide);
            (window as any).ascEventBus.emit('resetComGraphToFirst', message.params);
          }
          editor.revealLineInCenter(1);
          break;
        default:
          break;
      }
    }
  });
};

const sendMsg = (command, param) => {
  Promise.resolve().then(() => {
    (window as any).ascEventBus.emit(command, param);
  });
};

// 语义标签解析（CompleteData 与 PyCode 到达顺序不确定，前置未齐时返回 false 挂起）
const refreshSemanticLabels = (): boolean => {
  const complete: any = threeColumnServer.CompleteData?.value;
  if (!complete?.semanticObj || !initCodePath || !initTotalLine || !editor) {
    return false;
  }
  mkSemanticLabel(complete.semanticObj, initCodePath);
  parseSemanticLabels(initTotalLine);
  applySemanticDecorations();
  return true;
};

// CompleteData 早于 PyCode/编辑器就绪到达时置位，待 initEditor 补算（setup 时已有值的情况同样置位）
let pendingLabelRefresh = !!threeColumnServer.CompleteData?.value;

watch(threeColumnServer.CompleteData, () => {
  pendingLabelRefresh = !refreshSemanticLabels();
});

// 联动 py 文件列表：整表 key 本地派生；存在性走 checkFileExistence（webview 无文件系统）
const refreshPyFileList = () => {
  const paths = Object.keys(pyOpmagicMap);
  pyFileList.value = paths.map((filePath) => ({
    path: filePath,
    name: filePath.split(/[\/\\]/).pop() ?? filePath,
    exists: true,
  }));
  if (paths.length) {
    threeColumnServer.checkFileExistence({ paramObj: { paths } });
  }
};

watch(threeColumnServer.FileExistenceResult, (newValue: any) => {
  const result: Record<string, boolean> = newValue?.data ?? {};
  for (const item of pyFileList.value) {
    if (item.path in result) {
      item.exists = result[item.path];
    }
  }
});

// 计算图加载后推送的整表（pyFile → hash → opmagic → lineno）：悬停行集合、ops 逆落点索引、
// 文件列表全部由它本地派生（零往返延迟）
let pyOpmagicMap: Record<string, Record<string, Record<string, number>>> = {};
let pyOpmagicLineSet: Set<number> = new Set();
// `${hash}_${opmagic}` → 落点（同一 program 内 (hash, opmagic) 唯一）
const opLocationIndex = new Map<string, { pyFile: string; pyLine: number }>();

const rebuildLocalIndexes = () => {
  pyOpmagicLineSet = new Set();
  opLocationIndex.clear();
  if (!pyOpmagicMap) {
    return;
  }
  for (const [filePath, fileMap] of Object.entries(pyOpmagicMap)) {
    for (const [hashKey, hashOps] of Object.entries(fileMap)) {
      for (const [magicKey, pyLine] of Object.entries(hashOps)) {
        opLocationIndex.set(`${hashKey}_${magicKey}`, { pyFile: filePath, pyLine });
      }
    }
  }
  if (!initCodePath) {
    return;
  }
  let fileMap = pyOpmagicMap[initCodePath];
  if (!fileMap) {
    // 整表主键可能是编译机路径，与本地不一致时按 basename 兜底
    const base = initCodePath.split(/[\/\\]/).pop();
    fileMap = Object.entries(pyOpmagicMap).find(([p]) => p.split(/[\/\\]/).pop() === base)?.[1];
  }
  if (!fileMap) {
    return;
  }
  for (const hashKey of Object.keys(fileMap)) {
    for (const magicKey of Object.keys(fileMap[hashKey])) {
      pyOpmagicLineSet.add(fileMap[hashKey][magicKey]);
    }
  }
};

watch(
  threeColumnServer.PyOpmagicMap,
  (newValue: any) => {
    pyOpmagicMap = newValue?.pyOpmagicMap ?? {};
    rebuildLocalIndexes();
    refreshPyFileList();
  },
  { immediate: true },
);

watch(threeColumnServer.PyCode, (newValue) => {
  const { codePath, code } = newValue.data;
  initCodePath = codePath;
  // 文件切换后重算本地索引（行集合依赖当前文件，顺带重建逆索引，整表量级重建耗时可忽略）
  rebuildLocalIndexes();
  editorFileName.value = initCodePath.split(/[\/\\]/).pop();
  initTotalLine = code.split('\n').length;
  loading.value = false;
  nextTick(() => {
    initEditor(code);
    // 跨文件锁定的延续：编辑器重建后执行挂起的锁定
    if (pendingActiveLock) {
      const pending = pendingActiveLock;
      pendingActiveLock = null;
      applyActiveLock(pending);
    }
  });
});

// 在组件挂载前配置 Monaco
configureMonaco();

onMounted(() => {
  nextTick(() => {
  threeColumnServer.getPyCode();
  });
  listenExtensionMessage();
});

onUnmounted(() => {
  if (editor) {
    editor.dispose();
  }
  // 清理所有语义标签装饰
  labelInfoDecorations = [];
  // 新增：移除全局事件监听
  document.removeEventListener('keydown', handleKeyDown);
});

watch(isDarkTheme, () => {
  updateTheme();
});
</script>

<style>
.container, .editor-container {
  height: 100%;
  position: relative;
}
.semantic-label-info {
  color: grey !important;
}
</style>