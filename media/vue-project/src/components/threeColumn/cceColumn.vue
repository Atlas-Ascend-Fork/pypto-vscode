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
      <div ref="containerRef" class="cce-container"></div>
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
// 当前文件的 label 块（getCceLabels 反查结果），hover 时按行区间命中
let cceLabelBlocks: Array<{ label: string; lines: number[] }> = [];
let lastHoverLine = 0;
let opHighlightDecorations: monaco.editor.IEditorDecorationsCollection | null = null;

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

const findLabelByLine = (line: number): string =>
  cceLabelBlocks.find((block) => block.lines.includes(line))?.label ?? '';

const refreshCceLabelBlocks = () => {
  if (!currentPath.value) {
    cceLabelBlocks = [];
    return;
  }
  Promise.resolve(threeColumnServer.getCceLabels?.({ fileName: currentPath.value }))
    .then((res) => {
      cceLabelBlocks = res?.labels ?? [];
    })
    .catch(() => {
      cceLabelBlocks = [];
    });
};

// 计算图 op 悬停（source:'com'）→ CCE 行高亮（不切文件、不动视图）
const applyOpsHighlight = (hash: string, ops: number[]) => {
  if (!editor) {
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
    const text = editor!.getModel()?.getLineContent(line) ?? '';
    const opMagic = extractOpMagic(text);
    if (opMagic != null && currentFuncHash) {
      sendMsg('returnOpFromCce', { opmagic: opMagic, hash: currentFuncHash });
    } else {
      sendMsg('returnOpFromCce', { opmagic: 0, hash: '' });
    }
    // label 反查：按行区间命中真实 label（R11 通道），空串表示离开 label 块
    const label = findLabelByLine(line);
    sendMsg('returnSemanticLabelFromCce', { label });
  });
  editor.onMouseLeave(() => {
    lastHoverLine = 0;
    sendMsg('returnOpFromCce', { opmagic: 0, hash: '' });
    sendMsg('returnSemanticLabelFromCce', { label: '' });
  });
  editor.onMouseDown((e) => {
    const line = e.target?.position?.lineNumber;
    if (!line) {
      return;
    }
    const text = editor!.getModel()?.getLineContent(line) ?? '';
    const opMagic = extractOpMagic(text);
    if (opMagic != null && currentFuncHash) {
      sendMsg('activeLockFromCce', { label: findLabelByLine(line), opmagic: opMagic, hash: currentFuncHash });
    }
  });
};

const onCceFileSwitch = (path: string) => {
  (window as any).ascEventBus.emit('deactivateLock');
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
    refreshCceLabelBlocks();
    opHighlightDecorations?.clear();
    if (editor) {
      editor.setValue(lastCode);
    }
  },
  { immediate: true },
);

// 计算图/其它栏锁定 → CCE 栏切到 candidate.cce
(window as any).ascEventBus.on('activeLockFromCom', (args) => {
  const ccePaths: string[] = args?.candidate?.cce ?? [];
  if (!ccePaths.length) {
    return;
  }
  const name = ccePaths[0].split(/[\/\\]/).pop();
  if (name) {
    threeColumnServer.getCceCode({ paramObj: { fileName: name } });
  }
});

// 计算图 op 悬停(source:'com') / py 行悬停(source:'py') → CCE 行高亮；其它来源/空 ops 清除
(window as any).ascEventBus.on('returnOpsFromCom', (args) => {
  if (args?.source === 'com' || args?.source === 'py') {
    applyOpsHighlight(args.hash, args.ops ?? []);
  } else {
    opHighlightDecorations?.clear();
  }
});

watch(isDarkTheme, () => {
  monaco.editor.setTheme(isDarkTheme.value ? 'vs-dark' : 'vs');
});

onMounted(() => {
  createEditor(lastCode);
});

onBeforeUnmount(() => {
  (window as any).ascEventBus.remove('activeLockFromCom');
  (window as any).ascEventBus.remove('returnOpsFromCom');
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
  flex: 1;
  min-height: 0;
}
</style>

<style lang="scss">
.cce-op-hover-highlight {
  background-color: rgba(56, 132, 255, 0.25);
}
</style>
