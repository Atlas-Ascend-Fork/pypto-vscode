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
        <!-- 锁图标：点击行锁定后显示蓝色闭锁（点击解锁）；悬浮不显示 -->
        <div
          v-if="isLocked && lockPosition"
          class="lock-indicator locked"
          @click="unLockClick"
          :style="{ top: lockPosition.top + 'px', left: lockPosition.left + 'px' }"
        >
          <d-icon name="icon-lock-private" style="color: #ffffff"></d-icon>
        </div>
        <!-- 当前子图无关联 CCE 文件时的遮罩层（盖住编辑区，头部仍可手动切换文件） -->
        <!-- 关闭遮罩 = 本次忽略"暂无关联"提示，直到子图再次切换重新判定 -->
        <noDataMask v-if="noAssociatedObject" :text="$t('noAssociatedObject')" :is-dark="isDarkTheme" @close="noAssociatedObject = false" />
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
import noDataMask from '../util/noDataMask.vue';
import { generateColorList, getColorByString } from '../../utils/color-list';

const { server: threeColumnServer } = useViewServer<ThreeColumnServer>();
const { isDarkTheme } = inject('threeColumnState') as { isDarkTheme: Ref<boolean> };
const { isCceFullscreen, onToggleCceFullscreen, currentActiveBlock, BlockToGraphMap } = inject(ThreeColumnProvideKey) as IThreeColumnCtx;

const props = defineProps({
  filePaths: { type: Object, default: () => ({}) },
});

const containerRef = ref<HTMLElement>();
const fileName = ref('');
const currentPath = ref('');
const cceFileList = ref<FileSelectItem[]>([]);
// 当前子图无关联 CCE 文件时的遮罩（子图切换查询未命中时显示，命中关联文件/加载新文件后隐藏）
const noAssociatedObject = ref(false);
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
// 行锁定：点击可锁定行（opMagic + funcHash）发送 activeLockFromCce，
// 监听到 activeLockFromCom 后锁定（闭锁 + 蓝条 + 同 label 渐变框），锁定期间 hover 不响应
const isLocked = ref(false);
const lockPosition = ref<{ top: number; left: number } | null>(null);
// 锁定行（蓝色闭锁图标跟随的目标行）
let lockLine = 0;
// 跨栏锁定（activeLockFromCom）待显示目标：所需文件就绪后按 opMagic 定位行；
// label 供 op 无精确落点时的兜底定位（文档 2.3：ops 有 cce 行，或当前文件 hash+label 定位到区间）
let pendingLock: { hash?: string; opMagic: number; label?: string } | null = null;
// 当前锁定目标（hash + opMagic）：fileSelect 切文件后在新文件中重新定位，定位不到则解锁
let lockedOp: { hash: string; opMagic: number } | null = null;
// label 通道（activeLock，py/计算图锁图标的 label 层锁定）的锁定 label：
// 切文件后 label 块就绪时按此重定位，与 py 栏 label 区间锁定态保持口径
let lockedLabelName = '';
// 切文件待定位标记：新文件加载后按 lockedOp 定位，失败时解锁
let switchLockPending = false;
// 用户主动切换的目标文件路径（'*' 表示文件选择器场景，路径加载前未知）：
// 加载到该文件时按内容 funcHash 反向绑定计算图子图；锁定/子图绑定等程序化加载路径不同不会消费它
let pendingUserSwitchPath = '';

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
      // label 通道锁定在切文件后重定位：新文件的 label 块就绪后按锁定 label 重新上锁
      if (lockedLabelName && !isLocked.value) {
        applyLabelLock(lockedLabelName);
      }
    })
    .catch(() => {
      cceLabelBlocks = [];
      cceLabelBlocksPath = currentPath.value;
      applyCceLabelBars();
      renderLockDecorations();
    });
};

// 锁定目标行不在视口时滚动居中（op 精确 / label 兜底两条锁定路径共用），避免只显示吸附在边缘的闭锁
const revealLineIfHidden = (line: number) => {
  const visible = editor?.getVisibleRanges()?.[0];
  if (editor && visible && (line < visible.startLineNumber || line > visible.endLineNumber)) {
    editor.revealPositionInCenter({ lineNumber: line, column: 1 });
  }
};

// op 通道定位失败时的 label 兜底：挂起 lockedLabelName（label 就绪后由 refresh 回调重定位），
// 当前文件 label 块可命中则立即上锁
const fallbackToLabelLock = (label: string): boolean => {
  if (!label) {
    return false;
  }
  lockedLabelName = label;
  return applyLabelLock(label);
};

// label 层锁定（activeLock {label}：py/计算图锁图标，按文档 2.3 CCE 栏可定位口径
// "当前文件的 hash+label 定位到区间"）：按当前文件的同名 label 块建立锁定态（闭锁 + 蓝条 + 渐变框）。
// label 块非当前文件（切文件在途、label 数据未就绪）时不锁定，由 refreshCceLabelBlocks 就绪后
// 按 lockedLabelName 重定位；label 未命中当前文件时不锁定（定位不到即未关联成功）
const applyLabelLock = (label: string): boolean => {
  if (!label || cceLabelBlocksPath !== currentPath.value) {
    return false;
  }
  const block = cceLabelBlocks.find((b) => b.label === label);
  if (!block?.lines.length) {
    return false;
  }
  noAssociatedObject.value = false;
  isLocked.value = true;
  lockLine = block.lines[0];
  revealLineIfHidden(lockLine);
  updateLockPosition(lockLine);
  renderLockDecorations();
  return true;
};

// 计算图 op 悬停（source:'com'）→ CCE 行高亮（整行蓝条 + 同 label 渐变框，滚动定位到当前悬浮 op 的首个命中行）；
// 锁定态下不响应（与 py 栏一致）
const applyOpsHighlight = (hash: string, ops: number[]) => {
  if (!editor || isLocked.value) {
    return;
  }
  // hash 不匹配时按激活块定遮罩：CCE 激活（用户正在 CCE 栏操作）撤下不打断，其它激活块置起提示无关联
  if (hash && hash !== currentFuncHash) {
    noAssociatedObject.value = BlockToGraphMap[currentActiveBlock.value] !== 'cce';
  }
  if (!hash || !ops?.length || hash !== currentFuncHash) {
    clearLineBands(editor);
    clearBlockHighlights(editor);
    return;
  }
  const lines = ops.flatMap((opMagic) => opMagicLineIndex.get(opMagic) ?? []);
  if (!lines.length) {
    clearLineBands(editor);
    clearBlockHighlights(editor);
    return;
  }
  // 整行蓝条与 py 栏同源（renderLineBands 主题自适应），与本地悬浮行共用同一渲染态、最近一次交互生效
  renderLineBands(editor, Array.from(new Set(lines)), isDarkTheme.value);
  // 与高亮行同 label 的行渐变背景框：label 块按文件路径校验，未就绪/过期不画；
  // 与本地悬浮、锁定态共用同一渲染通道，最近一次交互生效
  const labels =
    cceLabelBlocksPath === currentPath.value
      ? Array.from(new Set(lines.map((line) => findLabelByLine(line)).filter((label) => label)))
      : [];
  const sameLabelRanges = labels.flatMap((label) =>
    cceLabelBlocks.filter((block) => block.label === label).flatMap((block) => linesToRanges(block.lines)),
  );
  if (sameLabelRanges.length) {
    renderBlockHighlights(editor, sameLabelRanges);
  } else {
    clearBlockHighlights(editor);
  }
  // 直接滚动到当前行（当前悬浮 op 的首个命中行），不排序计算首个高亮行
  editor.revealPositionInCenter({ lineNumber: lines[0], column: 1 });
};

const sendMsg = (command: string, param: unknown) => {
  (window as any).ascEventBus.emit(command, param);
};

// ==================== 锁图标（锁定） ====================

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
  lockedLabelName = '';
  isLocked.value = false;
  lockLine = 0;
  lockPosition.value = null;
  clearLineBands(editor);
  clearBlockHighlights(editor);
};

const deactivateLock = () => {
  if (!isLocked.value && !lockedOp && !lockedLabelName) {
    return;
  }
  // 同步作废切文件待定位，避免解锁后加载响应到达又静默重新上锁
  pendingLock = null;
  switchLockPending = false;
  clearLockState();
  sendMsg('deactivateLock', '');
};

const unLockClick = (e: MouseEvent) => {
  e.stopPropagation();
  deactivateLock();
};

// 应用跨栏锁定：hash 与当前文件 funcHash 一致时按 opMagic 定位行（切文件场景由 CceCode watch 调用）。
// op 定位失败（不产码 / ROOT 层 op 的产码键对不上 / 主尾块 funcHash 不一致）时按 label 在当前文件兜底；
// 切文件在途时兜底被守卫拒绝，挂起 lockedLabelName 由 label 就绪后的 refresh 回调重定位
// 返回是否定位成功（成功则显示闭锁/蓝条/渐变框）
const applyPendingLock = (): boolean => {
  if (!pendingLock) {
    return false;
  }
  const { hash, opMagic, label: pendingLabel } = pendingLock;
  pendingLock = null;
  if (!currentFuncHash || (hash != null && hash !== currentFuncHash)) {
    return fallbackToLabelLock(pendingLabel);
  }
  const lines = opMagicLineIndex.get(opMagic);
  if (!lines?.length) {
    return fallbackToLabelLock(pendingLabel);
  }
  noAssociatedObject.value = false;
  isLocked.value = true;
  lockLine = lines[0];
  // 锁定建立时清除悬浮期残留的 op 高亮（切文件路径 watch 已清，此处覆盖免重载路径）
  clearLineBands(editor);
  revealLineIfHidden(lockLine);
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
  editor.onMouseMove((e) => {
    const line = e.target?.position?.lineNumber;
    if (!line || line === lastHoverLine) {
      return;
    }
    lastHoverLine = line;
    // 锁定态下 hover 不响应：不联动、不渲染悬浮反馈
    if (isLocked.value) {
      return;
    }
    const text = editor!.getModel()?.getLineContent(line) ?? '';
    const opMagic = extractOpMagic(text);
    // label 事件先发（渐变框 + label 首行定位），op 事件后发（蓝条 + op 行定位覆盖）：
    // 跨栏悬停 op 行滚动优先；且 op 行无 label 块时，label 空串的清除先于蓝条渲染，避免误清
    const label = findLabelByLine(line);
    sendMsg('returnSemanticLabelFromCce', { label });
    if (opMagic != null && currentFuncHash) {
      sendMsg('returnOpFromCce', { opmagic: opMagic, hash: currentFuncHash });
    } else {
      sendMsg('returnOpFromCce', { opmagic: 0, hash: '' });
    }
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
  pendingUserSwitchPath = path;
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
  pendingUserSwitchPath = '*';
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
    // 用户主动切换/重选的文件加载完成：按文件 funcHash 反向绑定计算图子图；
    // 路径不匹配说明是程序化加载（锁定/子图绑定），不消费标记、不触发。
    // 置于重推守卫之前：重选当前文件属同内容重推，也须完成图侧绑定
    if (pendingUserSwitchPath && data.filePath && (pendingUserSwitchPath === '*' || pendingUserSwitchPath === data.filePath)) {
      const switchFuncHash = FUNC_HASH_RE.exec(data.code ?? '')?.[1] ?? '';
      if (switchFuncHash) {
        pendingUserSwitchPath = '';
        sendMsg('cceFileSwitched', { hash: switchFuncHash });
      }
    }
    // 同文件同内容重推（子图强绑与锁定先后请求同一文件等场景）：索引/装饰/锁定态全部有效，
    // 跳过重建与锁定复位（复位会把已建立的锁定吃掉），只补应用在途的锁定目标
    if (data.filePath && data.filePath === currentPath.value && data.code === lastCode) {
      fileName.value = data.fileName ?? '';
      const locatedDup = applyPendingLock();
      if (switchLockPending) {
        switchLockPending = false;
        if (!locatedDup) {
          deactivateLock();
        }
      }
      return;
    }
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
    // 新文件已展示：撤下无关联遮罩
    noAssociatedObject.value = false;
    refreshCceLabelBlocks();
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

// 计算图子图切换（hash 变化）→ 按 hash 强绑 CCE 文件：优先尾块（非 _main），无尾块回退主块；
// 当前文件 funcHash 已一致（含用户刚选定主/尾块副本）时不重复加载；无关联文件时遮罩提示
const onSubgraphHashChanged = async (args: { hash?: string }) => {
  const hash = args?.hash;
  if (!hash) {
    return;
  }
  // 当前文件 funcHash 已一致：显示中的文件即该子图的关联对象，撤下遮罩
  if (hash === currentFuncHash) {
    noAssociatedObject.value = false;
    return;
  }
  // 程序化加载：作废文件选择器场景的无路径标记，避免误触发计算图子图切换
  if (pendingUserSwitchPath === '*') {
    pendingUserSwitchPath = '';
  }
  if (lockedOp) {
    if (lockedOp.hash === hash) {
      // 锁定目标属于新子图：保留锁定，新文件加载后重新定位到目标行
      pendingLock = { ...lockedOp };
      switchLockPending = true;
    } else {
      // 锁定目标属于其它子图：与新子图强绑冲突，广播解锁
      (window as any).ascEventBus.emit('deactivateLock');
    }
  }
  const res = await Promise.resolve(threeColumnServer.getCceFileBySubgraph?.({ hash })).catch(() => null);
  const target = res?.fileName;
  if (!target) {
    // 该子图无关联 CCE 文件 → 遮罩提示，下方保留原文件内容
    noAssociatedObject.value = true;
    return;
  }
  noAssociatedObject.value = false;
  if (target === fileName.value) {
    return;
  }
  threeColumnServer.getCceCode({ paramObj: { fileName: target } });
};
(window as any).ascEventBus.on('subgraphHashChanged', onSubgraphHashChanged);

// 手动切换的 CCE 文件 hash 在图中无对应子图（图侧广播）：遮罩提示当前文件与计算图无关联
const onCceFileSwitchUnresolved = () => {
  noAssociatedObject.value = true;
};
(window as any).ascEventBus.on('cceFileSwitchUnresolved', onCceFileSwitchUnresolved);

// 计算图/其它栏锁定 op → CCE 栏切到 op 落点文件（无落点回退 candidate.cce[0]），并在目标行显示锁定锁
const onActiveLockFromCom = (args: {
  hash?: string;
  opMagic?: number;
  label?: string | null;
  cce?: string | null;
  candidate?: { cce?: string[] };
}) => {
  // 程序化加载：作废文件选择器场景的无路径标记，避免误触发计算图子图切换
  if (pendingUserSwitchPath === '*') {
    pendingUserSwitchPath = '';
  }
  // 锁定目标文件取 op 精确落点（尾块优先，与子图强绑同口径）；无落点（不产码 op）回退 candidate
  // 时也优先尾块：主块可能缺该 op 行或 funcHash 不一致，且主块自身无 label 行时
  // getCceLabels 的副本回退会带回尾块行号，在主块文件上按 label 兜底会锁错行
  const candidates = args?.candidate?.cce ?? [];
  const target = args?.cce || candidates.find((file) => !file.endsWith('_main.cpp')) || candidates[0] || '';
  const targetName = target ? target.split(/[\/\\]/).pop() : '';
  // 目标文件已是当前展示文件时免重载：索引/装饰/funcHash 全部有效，直接应用锁定，
  // 省一次文件重读与编辑器重建（setValue 会复位滚动，锁定视觉闪断）
  const sameFile = !!targetName && targetName === fileName.value;
  if (targetName && !sameFile) {
    threeColumnServer.getCceCode({ paramObj: { fileName: targetName } });
  }
  if (args?.opMagic != null) {
    // 记录锁定目标（切文件时按 hash+opMagic 重新定位），新锁定优先于切文件待定位
    switchLockPending = false;
    lockedLabelName = '';
    lockedOp = { hash: args?.hash ?? currentFuncHash, opMagic: Number(args.opMagic) };
    pendingLock = { hash: args?.hash, opMagic: Number(args.opMagic), label: args?.label ?? '' };
    if (!targetName || sameFile) {
      applyPendingLock();
    }
  }
};
(window as any).ascEventBus.on('activeLockFromCom', onActiveLockFromCom);

// label 层锁定（py/计算图锁图标 → activeLock {label}，文档阶段 1 CCE 栏待办）：
// 按 当前文件 hash+label 建立锁定态；label 未命中当前文件时不锁定（与 py 栏处理同口径）。
// 空 label 不锁定（py 栏无 label 单行点锁图标改走 activeLockFromPy 反查，属 py 栏待办）
const onActiveLock = (args: { label?: string }) => {
  const label = args?.label ?? '';
  if (!label) {
    return;
  }
  // 两条锁定通道互斥：label 层锁定作废 op 通道的在途/既有目标
  lockedOp = null;
  pendingLock = null;
  switchLockPending = false;
  lockedLabelName = label;
  applyLabelLock(label);
};
(window as any).ascEventBus.on('activeLock', onActiveLock);

// 计算图 op 悬停(source:'com') / py 行悬停(source:'py') → CCE 行高亮 + 同 label 渐变框；其它来源/空 ops 清除
// 锁定态忽略泳道来源的清除事件（py 栏同规则），保持闭锁/蓝条/渐变框
const onReturnOpsFromCom = (args: { source?: string; hash?: string; ops?: number[] }) => {
  if (args?.source === 'com' || args?.source === 'py') {
    applyOpsHighlight(args.hash ?? '', args.ops ?? []);
  } else if (!isLocked.value) {
    clearLineBands(editor);
    clearBlockHighlights(editor);
  }
};
(window as any).ascEventBus.on('returnOpsFromCom', onReturnOpsFromCom);

// 其它栏解锁广播 → 清除 CCE 栏锁定态（含蓝条/渐变框、锁定目标与切文件待定位）；
// lockedLabelName 挂起态（定位失败等 label 就绪重试）也要一并作废，避免解锁后 label 到达复活锁定
const onDeactivateLockMsg = () => {
  pendingLock = null;
  switchLockPending = false;
  if (!isLocked.value && !lockedOp && !lockedLabelName) {
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
  (window as any).ascEventBus.remove('activeLock', onActiveLock);
  (window as any).ascEventBus.remove('subgraphHashChanged', onSubgraphHashChanged);
  (window as any).ascEventBus.remove('returnOpsFromCom', onReturnOpsFromCom);
  (window as any).ascEventBus.remove('deactivateLock', onDeactivateLockMsg);
  (window as any).ascEventBus.remove('cceFileSwitchUnresolved', onCceFileSwitchUnresolved);
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
  position: relative; /* 锁图标/遮罩层绝对定位锚点 */
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
