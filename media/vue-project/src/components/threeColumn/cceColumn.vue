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
  <div class="cce-column">
    <template v-if="fileName">
      <div class="cce-header">
        <fileSelect
          :file-name="fileName"
          :show-dropdown="true"
          :show-file-explorer="false"
          :file-list="cceFileList"
          :current-path="currentPath"
          :file-paths="filePaths"
          @file-select="onCceFileSwitch"
        />
        <i :class="[isCceFullscreen ? 'icon-zoom-screen' : 'icon-full-screen']" @click="onToggleCceFullscreen"></i>
      </div>
      <div ref="containerRef" class="cce-container" @mouseleave="handleMouseLeave">
        <!-- 锁图标：悬浮可锁定行显示开锁（点击锁定），锁定后显示闭锁（点击解锁） -->
        <div
          v-if="!isLocked && lockPosition"
          class="lock-indicator"
          @click="lockClick"
          :style="{ top: lockPosition.top + 'px', left: lockPosition.left + 'px' }"
        >
          <d-icon name="lock-open"></d-icon>
        </div>
        <div
          v-if="isLocked && lockPosition"
          class="lock-indicator locked"
          @click="unLockClick"
          :style="{ top: lockPosition.top + 'px', left: lockPosition.left + 'px' }"
        >
          <d-icon name="icon-lock-private" style="color: #ffffff"></d-icon>
        </div>
      </div>
    </template>
    <div v-else class="no-file-container">
      <div><img :src="iconPath" alt="" class="no-file-icon" /></div>
      <div class="no-file-title">{{ $t('noCceFile') }}</div>
      <d-button variant="solid" class="mt10 no-file-back" @click="onPickCceFile">{{ $t('openFile') }}</d-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import * as monaco from 'monaco-editor';
import fileSelect from './file-select.vue';
import type { FileSelectItem } from './file-select.vue';
import { ThreeColumnProvideKey } from './types';
import type { IThreeColumnCtx } from './types';
import { useViewServer } from '../../core/use-view-server';
import { ThreeColumnServer } from 'ext:/view/servers/three-column-server';
import { renderBlockHighlights, clearBlockHighlights, renderLineBands, clearLineBands, renderGutterBars, clearGutterBars } from './monaco';
import { generateColorList, getColorByString } from '../../utils/color-list';

const { server: threeColumnServer } = useViewServer<ThreeColumnServer>();
const { isDarkTheme } = inject('threeColumnState') as { isDarkTheme: Ref<boolean> };
const { isCceFullscreen, onToggleCceFullscreen } = inject(ThreeColumnProvideKey) as IThreeColumnCtx;

const props = defineProps({
  filePaths: { type: Object, default: () => ({}) },
});

const containerRef = ref<HTMLElement>();
const fileName = ref('');
const currentPath = ref('');
const cceFileList = ref<FileSelectItem[]>([]);
const iconPath = computed(() => `${(window as any).staticPath}/static-assets/noFile${isDarkTheme.value ? 'Dark' : ''}.png`);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let lastCode = '';

const FUNC_HASH_RE = /\/\/\s*funcHash:\s*(\d+)/;
const OP_MAGIC_RE = /\[opMagic:\s*(\d+)\]/;
let currentFuncHash = '';
// 当前文件 opMagic → 行号列表索引（文件加载时一次性建立）
let opMagicLineIndex = new Map<number, number[]>();
// 不需要蓝条的行号（纯空白/注释行），文件加载时一次性建立
let ignoreLines = new Set<number>();
// 当前文件的 label 块（getCceLabels 反查结果），hover 时按行区间命中
let cceLabelBlocks: Array<{ label: string; lines: number[] }> = [];
// label 块所属文件路径：切文件后旧 label 行号无效，锁定渐变框需按此过滤
let cceLabelBlocksPath = '';
let lastHoverLine = 0;
let opHighlightDecorations: monaco.editor.IEditorDecorationsCollection | null = null;
// 悬浮锁：可锁定行（opMagic + funcHash）悬浮时行左侧显示锁；点击发送 activeLockFromCce，
// 监听到 activeLockFromCom 后锁定（闭锁 + 蓝条 + 同 label 渐变框），锁定期间 hover 不响应
const isLocked = ref(false);
const lockPosition = ref<{ top: number; left: number } | null>(null);
// 锁图标当前关联行：未锁定时为悬浮目标行，锁定后为锁定行
let lockLine = 0;
// 跨栏锁定（activeLockFromCom）待显示目标：所需文件就绪后按 opMagic 定位行
let pendingLock: { hash?: string; opMagic: number } | null = null;
// 当前锁定目标（hash + opMagic）：fileSelect 切文件后在新文件中重新定位，定位不到则解锁
let lockedOp: { hash: string; opMagic: number } | null = null;
// 切文件待定位标记：新文件加载后按 lockedOp 定位，失败时解锁
let switchLockPending = false;

const extractOpMagic = (lineContent: string): number | undefined => {
  const m = lineContent.match(OP_MAGIC_RE);
  return m ? Number(m[1]) : undefined;
};

const buildOpMagicLineIndex = (code: string) => {
  opMagicLineIndex = new Map();
  code.split('\n').forEach((lineText, idx) => {
    const opMagic = extractOpMagic(lineText);
    if (opMagic != null) {
      const lines = opMagicLineIndex.get(opMagic);
      if (lines) {
        lines.push(idx + 1);
      } else {
        opMagicLineIndex.set(opMagic, [idx + 1]);
      }
    }
  });
};

const rebuildIgnoreLines = (code: string) => {
  ignoreLines = new Set();
  let inBlock = false;
  let inString: string | null = null;
  let inLineComment = false; // 上一行 // 注释以 \ 续行时，后续行仍属注释
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const continued = line.trimEnd().endsWith('\\');
    if (inLineComment) {
      ignoreLines.add(i + 1);
      inLineComment = continued;
      continue;
    }
    // 起始即处于续行字符串中：内容为字符串字面量片段，属于代码行
    let hasCode = inString !== null;
    let pos = 0;
    while (pos < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', pos);
        if (end === -1) {
          pos = line.length;
        } else {
          inBlock = false;
          pos = end + 2;
        }
        continue;
      }
      if (inString) {
        if (line[pos] === '\\') {
          pos += 2;
          continue;
        }
        if (line[pos] === inString) {
          inString = null;
        }
        pos++;
        continue;
      }
      if (line.startsWith('//', pos)) {
        // 反斜杠-换行拼接先于注释识别，续行的下一行仍是注释
        inLineComment = continued;
        break;
      }
      if (line.startsWith('/*', pos)) {
        inBlock = true;
        pos += 2;
        continue;
      }
      const ch = line[pos];
      if (ch === '"' || ch === "'") {
        inString = ch;
        hasCode = true; // 字符串/字符字面量是代码，不能当作空白行
      } else if (!/\s/.test(ch)) {
        hasCode = true;
      }
      pos++;
    }
    // 字符串默认不跨行，仅 \ 续行时延续到下一行
    if (!continued) {
      inString = null;
    }
    if (!hasCode) {
      ignoreLines.add(i + 1);
    }
  }
};

const findLabelByLine = (line: number): string =>
  cceLabelBlocks.find((block) => block.lines.includes(line))?.label ?? '';

// 行号列表 → 连续行区间（渐变背景框输入），如 [3,4,5,9] → [[3,5],[9,9]]
const linesToRanges = (lines: number[]): Array<[number, number]> => {
  const sorted = Array.from(new Set(lines)).sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  for (const line of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      ranges.push([line, line]);
    }
  }
  return ranges;
};

// label 侧边彩条配色（与 py 栏同源：同名 label 跨栏同色）
const darkThemeColors = generateColorList(360);
const lightThemeColors = generateColorList(360, false);

// 按当前文件全部 label 画左侧 gutter 彩条（参考 py 栏 applySemanticDecorations）
const applyCceLabelBars = () => {
  if (!editor) {
    return;
  }
  const { baseColorList, lightColorList } = isDarkTheme.value ? darkThemeColors : lightThemeColors;
  renderGutterBars(
    editor,
    cceLabelBlocks.flatMap((block) =>
      linesToRanges(block.lines).map(([startLine, endLine]) => ({
        startLine,
        endLine,
        color: getColorByString(block.label, baseColorList, lightColorList).baseColor,
      })),
    ),
  );
};

const refreshCceLabelBlocks = () => {
  if (!currentPath.value) {
    cceLabelBlocks = [];
    cceLabelBlocksPath = '';
    applyCceLabelBars();
    return;
  }
  Promise.resolve(threeColumnServer.getCceLabels?.({ fileName: currentPath.value }))
    .then((res) => {
      cceLabelBlocks = res?.labels ?? [];
      cceLabelBlocksPath = currentPath.value;
      applyCceLabelBars();
      // 锁定态下 label 就绪后重画同 label 渐变框（切文件后旧 label 行号无效）
      renderLockDecorations();
    })
    .catch(() => {
      cceLabelBlocks = [];
      cceLabelBlocksPath = currentPath.value;
      applyCceLabelBars();
      renderLockDecorations();
    });
};

// 计算图 op 悬停（source:'com'）→ CCE 行高亮（不切文件、不动视图）；锁定态下不响应（与 py 栏一致）
const applyOpsHighlight = (hash: string, ops: number[]) => {
  if (!editor || isLocked.value) {
    return;
  }
  if (!hash || !ops?.length || hash !== currentFuncHash) {
    opHighlightDecorations?.clear();
    return;
  }
  const lines = ops.flatMap((opMagic) => opMagicLineIndex.get(opMagic) ?? []);
  if (!lines.length) {
    opHighlightDecorations?.clear();
    return;
  }
  opHighlightDecorations?.set(
    Array.from(new Set(lines)).map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: 'cce-op-hover-highlight',
      },
    })),
  );
};

const sendMsg = (command: string, param: unknown) => {
  (window as any).ascEventBus.emit(command, param);
};

// ==================== 锁图标（悬浮/锁定） ====================

// 锁图标定位：与目标行垂直居中；锁定态下目标行滚出视口时吸附编辑器上/下边缘保持可见
const updateLockPosition = (line: number) => {
  if (!editor || !line) {
    lockPosition.value = null;
    return;
  }
  const domNode = editor.getDomNode();
  const visibleRanges = editor.getVisibleRanges();
  if (!domNode || !visibleRanges?.length) {
    lockPosition.value = null;
    return;
  }
  const layout = editor.getLayoutInfo();
  const left = Math.max(4, layout.contentLeft - 15);
  const locked = isLocked.value;
  const [{ startLineNumber, endLineNumber }] = visibleRanges;
  if (line < startLineNumber) {
    lockPosition.value = locked ? { top: 4, left } : null;
    return;
  }
  if (line > endLineNumber) {
    lockPosition.value = locked ? { top: domNode.clientHeight - 32, left } : null;
    return;
  }
  const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
  const top = editor.getTopForLineNumber(line) - editor.getScrollTop();
  // 锁图标高约 24px（16px 图标 + 上下 4px 内边距），与目标行垂直居中
  lockPosition.value = { top: Math.max(0, top + (lineHeight - 24) / 2), left };
};

// 点击锁定：仅发送 activeLockFromCce，锁定显示（闭锁/蓝条/渐变框）由 activeLockFromCom 回声统一建立
const requestLockAtLine = (line: number) => {
  if (!editor) {
    return;
  }
  const text = editor.getModel()?.getLineContent(line) ?? '';
  const opMagic = extractOpMagic(text);
  if (opMagic == null || !currentFuncHash) {
    return;
  }
  sendMsg('activeLockFromCce', { label: findLabelByLine(line), opmagic: opMagic, hash: currentFuncHash });
};

// 锁定态视觉：锁定行整行蓝条 + 同 label 渐变框（描边加粗；label 未就绪/非当前文件时只画蓝条）
const renderLockDecorations = () => {
  if (!isLocked.value || !lockLine || !editor) {
    return;
  }
  renderLineBands(editor, [lockLine], isDarkTheme.value);
  const label = cceLabelBlocksPath === currentPath.value ? findLabelByLine(lockLine) : '';
  const sameLabelRanges = label
    ? cceLabelBlocks.filter((block) => block.label === label).flatMap((block) => linesToRanges(block.lines))
    : [];
  if (sameLabelRanges.length) {
    renderBlockHighlights(editor, sameLabelRanges, { strokeWidth: 1.5 });
  } else {
    clearBlockHighlights(editor);
  }
};

// 清除本地锁定态（显示 + 锁定目标），不广播
const clearLockState = () => {
  lockedOp = null;
  isLocked.value = false;
  lockLine = 0;
  lockPosition.value = null;
  clearLineBands(editor);
  clearBlockHighlights(editor);
};

const deactivateLock = () => {
  if (!isLocked.value && !lockedOp) {
    return;
  }
  // 同步作废切文件待定位，避免解锁后加载响应到达又静默重新上锁
  pendingLock = null;
  switchLockPending = false;
  clearLockState();
  sendMsg('deactivateLock', '');
};

const lockClick = (e: MouseEvent) => {
  e.stopPropagation();
  if (lockLine) {
    requestLockAtLine(lockLine);
  }
};

const unLockClick = (e: MouseEvent) => {
  e.stopPropagation();
  deactivateLock();
};

// 应用跨栏锁定：hash 与当前文件 funcHash 一致时按 opMagic 定位行（切文件场景由 CceCode watch 调用）
// 返回是否定位成功（成功则显示闭锁/蓝条/渐变框）
const applyPendingLock = (): boolean => {
  if (!pendingLock) {
    return false;
  }
  const { hash, opMagic } = pendingLock;
  pendingLock = null;
  if (!currentFuncHash || (hash != null && hash !== currentFuncHash)) {
    return false;
  }
  const lines = opMagicLineIndex.get(opMagic);
  if (!lines?.length) {
    return false;
  }
  isLocked.value = true;
  lockLine = lines[0];
  // 锁定建立时清除悬浮期残留的 op 高亮（切文件路径 watch 已清，此处覆盖免重载路径）
  opHighlightDecorations?.clear();
  // 目标行不在视口时滚动定位（跨栏锁定/切文件场景），避免只显示吸附在边缘的闭锁
  const visible = editor?.getVisibleRanges()?.[0];
  if (editor && visible && (lockLine < visible.startLineNumber || lockLine > visible.endLineNumber)) {
    editor.revealPositionInCenter({ lineNumber: lockLine, column: 1 });
  }
  updateLockPosition(lockLine);
  renderLockDecorations();
  return true;
};

// 指针离开编辑区（容器级 mouseleave，锁图标在容器内不会误触发）：
// 清空联动消息与本地悬浮装饰；锁定态保持闭锁/蓝条/渐变框且不发清除消息
const handleMouseLeave = () => {
  lastHoverLine = 0;
  if (isLocked.value) {
    return;
  }
  sendMsg('returnOpFromCce', { opmagic: 0, hash: '' });
  sendMsg('returnSemanticLabelFromCce', { label: '' });
  clearLineBands(editor);
  clearBlockHighlights(editor);
  lockLine = 0;
  lockPosition.value = null;
};

const createEditor = (code: string) => {
  if (!containerRef.value || editor) {
    return;
  }
  editor = monaco.editor.create(containerRef.value, {
    value: code,
    language: 'cpp',
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
      useShadows: false,
    },
    stickyScroll: {
      enabled: false,
    },
  });
  setupCceInteraction();
  // editor 晚于 label 数据创建时补画彩条（label 先到时 refreshCceLabelBars 已渲染过会整体替换）
  applyCceLabelBars();
  // 锁定态先于 editor 建立时补画闭锁图标与蓝条/渐变框
  if (isLocked.value && lockLine) {
    updateLockPosition(lockLine);
    renderLockDecorations();
  }
};

const setupCceInteraction = () => {
  if (!editor) {
    return;
  }
  opHighlightDecorations = editor.createDecorationsCollection();
  editor.onMouseMove((e) => {
    const line = e.target?.position?.lineNumber;
    if (!line || line === lastHoverLine) {
      return;
    }
    lastHoverLine = line;
    // 锁定态下 hover 不响应：不联动、不渲染悬浮反馈、悬浮锁不跟随
    if (isLocked.value) {
      return;
    }
    const text = editor!.getModel()?.getLineContent(line) ?? '';
    const opMagic = extractOpMagic(text);
    // 悬浮锁：可锁定行左侧显示锁图标
    if (opMagic != null && currentFuncHash) {
      lockLine = line;
      updateLockPosition(line);
    } else {
      lockLine = 0;
      lockPosition.value = null;
    }
    if (opMagic != null && currentFuncHash) {
      sendMsg('returnOpFromCce', { opmagic: opMagic, hash: currentFuncHash });
    } else {
      sendMsg('returnOpFromCce', { opmagic: 0, hash: '' });
    }
    // label 反查：按行区间命中真实 label（R11 通道），空串表示离开 label 块
    const label = findLabelByLine(line);
    sendMsg('returnSemanticLabelFromCce', { label });
    // 本地悬浮反馈：被悬浮行整行蓝条（纯空白/注释行不显示）；与当前行同 label 的行渐变背景框
    if (ignoreLines.has(line)) {
      clearLineBands(editor);
    } else {
      renderLineBands(editor, [line], isDarkTheme.value);
    }
    const sameLabelRanges = label
      ? cceLabelBlocks.filter((block) => block.label === label).flatMap((block) => linesToRanges(block.lines))
      : [];
    if (sameLabelRanges.length) {
      renderBlockHighlights(editor, sameLabelRanges);
    } else {
      clearBlockHighlights(editor);
    }
  });
  editor.onMouseDown((e) => {
    const line = e.target?.position?.lineNumber;
    if (!line) {
      return;
    }
    const text = editor!.getModel()?.getLineContent(line) ?? '';
    const opMagic = extractOpMagic(text);
    if (opMagic != null && currentFuncHash) {
      // 点击锁定（已锁定时点击其它 opMagic 行切换目标）：发送请求，锁定显示由 activeLockFromCom 回声建立
      requestLockAtLine(line);
    }
  });
  // 滚动时锁图标跟随目标行；锁定态下目标行滚出视口时吸附上/下边缘
  editor.onDidScrollChange(() => {
    if (lockLine) {
      updateLockPosition(lockLine);
    }
  });
  editor.addCommand(monaco.KeyCode.Escape, () => {
    deactivateLock();
  });
};

const onCceFileSwitch = (path: string) => {
  if (lockedOp) {
    // 锁定中切文件：保留 hash+opMagic 目标，新文件加载后定位到对应代码行蓝条锁定；定位不到则解锁
    pendingLock = { ...lockedOp };
    switchLockPending = true;
  } else {
    (window as any).ascEventBus.emit('deactivateLock');
  }
  threeColumnServer.getCceCode({ paramObj: { fileName: path } });
};

const onPickCceFile = () => {
  threeColumnServer.pickCceFile();
};

watch(fileName, (val) => {
  if (val) {
    nextTick(() => createEditor(lastCode));
  } else if (editor) {
    editor.dispose();
    editor = null;
  }
});

watch(threeColumnServer.CceFileList, (newValue: any) => {
  cceFileList.value = (newValue?.data?.files ?? []) as FileSelectItem[];
});

watch(
  threeColumnServer.CceCode,
  (newValue: any) => {
    const data = newValue?.data ?? { code: '', fileName: '', filePath: '' };
    lastCode = data.code ?? '';
    fileName.value = data.fileName ?? '';
    currentPath.value = data.filePath ?? '';
    currentFuncHash = FUNC_HASH_RE.exec(lastCode)?.[1] ?? '';
    buildOpMagicLineIndex(lastCode);
    rebuildIgnoreLines(lastCode);
    // 文件切换后复位锁定态（activeLockFromCom 触发的切换在下方装饰清除后再应用锁定目标）
    isLocked.value = false;
    lockLine = 0;
    lockPosition.value = null;
    refreshCceLabelBlocks();
    opHighlightDecorations?.clear();
    // 文件切换时清除本地悬浮装饰与旧 label 彩条，避免行号错位残留
    clearLineBands(editor);
    clearBlockHighlights(editor);
    clearGutterBars(editor);
    if (editor) {
      editor.setValue(lastCode);
    }
    // 装饰清除后应用跨栏锁定目标：闭锁图标 + 锁定行蓝条 + 同 label 渐变框
    const located = applyPendingLock();
    if (switchLockPending) {
      switchLockPending = false;
      if (!located) {
        // 切换的文件没有对应 hash+opMagic → 解锁（广播，联动各栏）
        deactivateLock();
      }
    }
  },
  { immediate: true },
);

// 计算图/其它栏锁定 op → CCE 栏切到 candidate.cce，并在目标行显示锁定锁
const onActiveLockFromCom = (args: { hash?: string; opMagic?: number; candidate?: { cce?: string[] } }) => {
  const ccePaths: string[] = args?.candidate?.cce ?? [];
  if (ccePaths.length) {
    const name = ccePaths[0].split(/[\/\\]/).pop();
    if (name) {
      threeColumnServer.getCceCode({ paramObj: { fileName: name } });
    }
  }
  if (args?.opMagic != null) {
    // 记录锁定目标（切文件时按 hash+opMagic 重新定位），新锁定优先于切文件待定位
    switchLockPending = false;
    lockedOp = { hash: args?.hash ?? currentFuncHash, opMagic: Number(args.opMagic) };
    pendingLock = { hash: args?.hash, opMagic: Number(args.opMagic) };
    if (!ccePaths.length) {
      applyPendingLock();
    }
  }
};
(window as any).ascEventBus.on('activeLockFromCom', onActiveLockFromCom);

// 计算图 op 悬停(source:'com') / py 行悬停(source:'py') → CCE 行高亮；其它来源/空 ops 清除
const onReturnOpsFromCom = (args: { source?: string; hash?: string; ops?: number[] }) => {
  if (args?.source === 'com' || args?.source === 'py') {
    applyOpsHighlight(args.hash ?? '', args.ops ?? []);
  } else {
    opHighlightDecorations?.clear();
  }
};
(window as any).ascEventBus.on('returnOpsFromCom', onReturnOpsFromCom);

// 其它栏解锁广播 → 清除 CCE 栏锁定态（含蓝条/渐变框、锁定目标与切文件待定位）
const onDeactivateLockMsg = () => {
  pendingLock = null;
  switchLockPending = false;
  if (!isLocked.value && !lockedOp) {
    return;
  }
  clearLockState();
};
(window as any).ascEventBus.on('deactivateLock', onDeactivateLockMsg);

watch(isDarkTheme, () => {
  monaco.editor.setTheme(isDarkTheme.value ? 'vs-dark' : 'vs');
  applyCceLabelBars();
  // 锁定蓝条颜色随主题变化，需重画
  renderLockDecorations();
});

onMounted(() => {
  createEditor(lastCode);
});

onBeforeUnmount(() => {
  (window as any).ascEventBus.remove('activeLockFromCom', onActiveLockFromCom);
  (window as any).ascEventBus.remove('returnOpsFromCom', onReturnOpsFromCom);
  (window as any).ascEventBus.remove('deactivateLock', onDeactivateLockMsg);
  editor?.dispose();
  editor = null;
});
</script>

<style scoped lang="scss">
.cce-column {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.cce-header {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 4px 16px;
  border-bottom: 1px solid var(--devui-split-line);
  background-color: var(--devui-card-bg);
  box-sizing: border-box;

  i {
    margin-left: 8px;
    font-size: 14px;
    cursor: pointer;
  }
}

.cce-container {
  position: relative; /* 锁图标绝对定位锚点 */
  flex: 1;
  min-height: 0;
}

.lock-indicator {
  position: absolute;
  z-index: 100;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  background-color: var(--devui-tooltip-bg);
  filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.5));

  &.locked {
    background-color: rgba(49, 122, 247, 1);
  }
}
</style>

<style lang="scss">
.cce-op-hover-highlight {
  background-color: rgba(56, 132, 255, 0.25);
}
</style>
