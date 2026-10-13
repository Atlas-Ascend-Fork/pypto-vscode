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
  <div ref="previewContainer" class="code-preview">
    <div class="step-content__run-python">
      <div class="file-info">
        <img :src="pythonIcon" class="icon-json" />
        <div class="step-description">hello_world.py</div>
      </div>
      <div class="copy-code-wrap" @click="copyAllCode">
        <i class="icon icon-copy copy-icon"></i>
        <span class="copy-text" v-show="!copySuccess">{{ t('welcome.copyCode') }}</span>
        <span class="copy-tip" v-show="copySuccess">{{ t('welcome.copiedSuccessfully') }}</span>
      </div>
    </div>
    <!-- Monaco Editor 容器 -->
    <div ref="editorContainer" class="code-preview-editor"></div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import * as monaco from 'monaco-editor';
import { getPythonFileCode } from '@/apis/welcome';

const { isDarkTheme } = inject('root');
const { t } = useI18n();
const pythonIcon = computed(() => `${window.staticPath}/static-assets/python.svg`);

const editorContainer = ref<HTMLDivElement | null>(null);
let monacoEditor: monaco.editor.IStandaloneCodeEditor | null = null;
const previewCode = ref('asdfasdf');
const previewOpacity = ref(0);
const isOpenFile = ref(true);
// 复制状态 - 控制成功提示显示，定时器标识
const copySuccess = ref(false);
let copyTimer: NodeJS.Timeout | null = null;

const themeState = computed(() => {
  return isDarkTheme.value ? 'vs-dark' : 'vs';
});

// 使用Monaco内置API一键复制全部代码
const copyAllCode = () => {
  if (!monacoEditor || !previewCode.value) return;
  try {
    // 1. 全选命令
    monacoEditor.trigger('keyboard', 'editor.action.selectAll');
    // 2. 复制命令
    monacoEditor.trigger('keyboard', 'editor.action.clipboardCopyAction');
    // 3. 显示成功提示
    copySuccess.value = true;
    // 4. 清除原有定时器（避免多次点击叠加）
    if (copyTimer) {
      clearTimeout(copyTimer);
    }
    // 5. 3秒后不再提示
    copyTimer = setTimeout(() => {
      copySuccess.value = false;
    }, 3000);
  } catch (error) {
    copySuccess.value = false;
    console.error('Python代码复制失败:', error);
  }
};

// 配置 Monaco Worker 环境
const configureMonacoWorker = () => {
  (self as any).MonacoEnvironment = {
    getWorkerUrl: () => {
      const blob = new Blob(['self.onmessage = () => {};'], {
        type: 'application/javascript',
      });
      return URL.createObjectURL(blob);
    },
  };
};

// 初始化 Monaco Editor
const initEditor = async () => {
  try {
    if (!editorContainer.value) return;
    const res = await getPythonFileCode();
    previewCode.value = res;
    configureMonacoWorker();
    monacoEditor = monaco.editor.create(editorContainer.value, {
      value: previewCode.value,
      language: 'python',
      theme: themeState.value,
      readOnly: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      overviewRulerLanes: 0,
      folding: true,
      fontSize: 14,
      wordWrap: 'on',
      automaticLayout: true,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      scrollBeyondLastColumn: 0,
      contextmenu: false,
      tabFocusMode: false,
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      hover: { enabled: false },
      parameterHints: { enabled: false },
      formatOnType: false,
      formatOnPaste: false,
      scrollbar: {
        vertical: 'hidden',
        verticalHasArrows: false,
        horizontal: 'hidden',
        horizontalHasArrows: false,
      },
    });
  } catch (error) {
    console.error('Monaco Editor 初始化失败:', error);
  }
};

// 主题更新方法
const updateEditorTheme = (newTheme: string) => {
  if (!monacoEditor) return;
  monaco.editor.setTheme(newTheme);
  monacoEditor.updateOptions({ theme: newTheme });
};

// 销毁编辑器实例
const disposeEditor = () => {
  try {
    isOpenFile.value = true;
    if (monacoEditor) {
      monacoEditor.dispose();
      monacoEditor = null;
      previewCode.value = '';
      previewOpacity.value = 0;
    }
    if (copyTimer) clearTimeout(copyTimer);
    copySuccess.value = false;
  } catch (error) {
    console.log(error);
  }
};

// 动态更新主题
watch(
  themeState,
  (newTheme, oldTheme) => {
    if (newTheme === oldTheme) return;
    updateEditorTheme(newTheme);
  },
  { immediate: false, deep: false },
);

// 生命周期钩子
onMounted(async () => {
  try {
    await nextTick();
    await initEditor();
  } catch (error) {
    console.log(error);
  }
});

onUnmounted(() => {
  disposeEditor();
});
</script>

<style scoped lang="less">
.code-preview {
  display: flex;
  background: var(--control-flow-code-preview);
  flex-direction: column;
  height: 100%;
  width: 100%;

  .step-content__run-python {
    display: flex;
    align-items: center;
    justify-content: space-between;
    line-height: 40px;
    gap: 8px;
    padding: 0 15px;
    cursor: default;

    // 文件信息容器
    .file-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .icon-json {
      width: 16px;
      height: 16px;
      line-height: 20px;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--devui-yellow-60);
    }

    .step-description {
      font-size: 14px;
      color: var(--devui-title-text);
    }

    // 复制按钮整体样式
    .copy-code-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-size: 13px;
      color: var(--devui-tooltip-text);
      position: relative;

      // 复制图标
      .copy-icon {
        font-size: 14px;
      }

      // 复制成功提示
      .copy-tip {
        color: var(--devui-success-color);
        white-space: nowrap;
      }

      // hover效果，适配主题
      &:hover {
        color: var(--devui-primary-color);
      }
    }
  }

  .code-preview-editor {
    flex: 1;
  }
}
</style>
