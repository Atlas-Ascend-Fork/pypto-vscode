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
    <div class="cce-header">
      <div class="cce-layout">
        <fileSelect :file-name="fileName" :file-paths="filePaths" />
        <d-select
          v-if="cceFiles.length > 0"
          ref="cceSelectEl"
          v-model="fileName"
          :position="['bottom-start']"
          class="cce-file-select"
          @value-change="onCceFileChange"
        >
          <d-option v-for="item in cceFiles" :key="item" :value="item" :title="item">
            <span class="option-name">{{ item }}</span>
          </d-option>
        </d-select>
      </div>
    </div>
    <div ref="containerRef" class="cce-container"></div>
  </div>
</template>

<script setup lang="ts">
import { inject, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import * as monaco from 'monaco-editor';
import fileSelect from './file-select.vue';
import { useViewServer } from '../../core/use-view-server';
import { ThreeColumnServer } from 'ext:/view/servers/three-column-server';

const { server: threeColumnServer } = useViewServer<ThreeColumnServer>();
const { isDarkTheme } = inject('threeColumnState') as { isDarkTheme: Ref<boolean> };

const props = defineProps({
  filePaths: { type: Object, default: () => ({}) },
});

const containerRef = ref<HTMLElement>();
const cceSelectEl = ref();
const fileName = ref('');
const cceFiles = ref<string[]>([]);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let lastCode = '';

watch(fileName, () => {
  nextTick(() => {
    const inputDom = cceSelectEl.value?.$el?.querySelector('input') as HTMLInputElement | null;
    if (inputDom) {
      inputDom.setAttribute('title', inputDom.value);
    }
  });
});

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

const onCceFileChange = (name: string) => {
  threeColumnServer.getCceCode({ paramObj: { fileName: name } });
};

watch(threeColumnServer.CceFileList, (newValue: any) => {
  cceFiles.value = (newValue?.data?.files ?? []) as string[];
});

watch(
  threeColumnServer.CceCode,
  (newValue: any) => {
    const data = newValue?.data ?? { code: '', fileName: '', filePath: '' };
    lastCode = data.code ?? '';
    fileName.value = data.fileName ?? '';
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
}

.cce-layout {
  display: flex;
  align-items: center;

  :deep(.file-select-wrapper) {
    flex: 0 1 auto;
    min-width: 0;
  }
}

.cce-file-select {
  flex-shrink: 0;
  width: 140px;
  min-width: 100px;
  margin-left: 20px;

  .devui-select__input {
    height: 28px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .option-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
    max-width: 320px;
  }
}

.cce-container {
  flex: 1;
  min-height: 0;
}
</style>
