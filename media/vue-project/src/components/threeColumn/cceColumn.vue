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
    if (editor) {
      editor.setValue(lastCode);
    }
  },
  { immediate: true },
);

watch(isDarkTheme, () => {
  monaco.editor.setTheme(isDarkTheme.value ? 'vs-dark' : 'vs');
});

onMounted(() => {
  createEditor(lastCode);
});

onBeforeUnmount(() => {
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
