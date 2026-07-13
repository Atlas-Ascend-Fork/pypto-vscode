<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
<template>
  <!-- 预览窗口容器，基于传入坐标定位 -->
  <div
    ref="previewContainer"
    class="code-preview"
    v-if="props.config.isVisible"
    :style="{
      left: `${props.config.x + 10}px`, // 右侧偏移10px,鼠标右侧
      top: `${props.config.y}px`,
    }"
  >
    <div class="code-preview__header">
      <span v-if="isOpenFile" class="header__title">{{ t('controlFlows.codeSnippet') }}</span>
      <div v-else class="header__error__group">
        <i class="icon icon-warning-triangle error__icon"></i>
        <span class="header__title">{{ errTitle }}</span>
      </div>
      <div v-if="isOpenFile" class="header__open-source" @click="openFile">
        <img :src="svgPath" />
        <span class="open-source__text">{{ t('controlFlows.splitScreenView') }}</span>
      </div>
    </div>
    <div v-if="isOpenFile" class="code-preview__container" @mousedown.stop>
      <!-- Monaco Editor 容器 -->
      <div ref="editorContainer" class="code-preview-editor"></div>
    </div>
    <div v-else class="code-preview-err">{{ errContent }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import * as monaco from 'monaco-editor';
import { getSnippetCodeText, openControlFlowTargetFile } from '@/apis/control-flow';
import { CodePreviewProps } from '../type/node-detail-types';
import { GetSnippetDocumentTag } from 'ext:/types/control-flow/source-code';

const { isDarkTheme } = inject('root');
const svgPath = computed(
  () => `${(window as any).staticPath}/static-assets/control_flow_code_snippet${isDarkTheme.value ? '' : '-light'}.svg`,
);
const { t } = useI18n();

// 组件 Props 定义
const props = defineProps<CodePreviewProps>();

// 组件 Emits 定义
const emit = defineEmits<{
  /** 关闭预览窗口时触发 */
  (e: 'close'): void;
}>();

const previewContainer = ref<HTMLDivElement | null>(null);
const editorContainer = ref<HTMLDivElement | null>(null);
let monacoEditor = null;
const previewCode = ref('');
const previewOpacity = ref(0);
const isOpenFile = ref(true);
const errTitle = ref('')
const errContent=ref('')

/** 打开代码片段源代码文件 */
function openFile() {
  const { fileDir, codeStartLine, codeEndLine, line } = props.config;
  openControlFlowTargetFile({ filePath: fileDir, startLine: codeStartLine, endLine: codeEndLine, line: line });
}

//配置 Monaco Worker 环境
const configureMonacoWorker = () => {
  // 覆盖 Monaco 的 Worker 加载规则
  (self as any).MonacoEnvironment = {
    getWorkerUrl: () => {
      // 创建空的内联 Worker（只读预览无需 Worker 处理逻辑）
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
    // 监听全局点击事件
    document.addEventListener('mousedown', handleClickOutside);
    // 监听键盘事件
    document.addEventListener('keydown', handleKeyDown);
    // 监听窗口大小变化，重新处理边界
    window.addEventListener('resize', handleBoundaryCheck);
    const { config } = props;
    //获取代码片段
    const res = await getSnippetCodeText({
      filePath: config.fileDir,
      startLine: config.codeStartLine,
      endLine: config.codeEndLine,
      line: config.line,
    });

    previewCode.value = res.document;

    if (res.isSuccessful === GetSnippetDocumentTag.IS_SUCCESSFUL) {
      isOpenFile.value=true
    } else {
      isOpenFile.value = false
      errTitle.value=res.isSuccessful===GetSnippetDocumentTag.IS_NO_LINE?t('controlFlows.snippetErrNoLineTitle'):t('controlFlows.snippetErrNoFileTitle')
      errContent.value=res.isSuccessful===GetSnippetDocumentTag.IS_NO_LINE?t('controlFlows.snippetErrNoLineContent'):props.config.fileDir
      return;      
    }
    // 配置 Worker 环境
    configureMonacoWorker();
    // 创建编辑器实例
    monacoEditor = monaco.editor.create(editorContainer.value, {
      value: previewCode.value,
      language: config.language || 'plaintext', // 识别语言
      theme: props.theme, // 主题
      readOnly: true, // 只读模式（预览用）
      minimap: { enabled: false }, // 隐藏迷你地图
      scrollBeyondLastLine: false, // 禁止滚动超出最后一行
      overviewRulerLanes: 0, // 隐藏滚动条轨道
      folding: true, // 支持代码折叠
      fontSize: 14,
      wordWrap: 'on', // 自动换行
      automaticLayout: true, // 自动适应容器大小
      // 隐藏状态栏和工具栏
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      scrollBeyondLastColumn: 0,
      contextmenu: false, // 禁用右键菜单
      tabFocusMode: false, // 禁用Tab键聚焦
      lineNumbers: (lineNumber: number) => {
        lineNumber += config.codeStartLine - 1;
        return `${lineNumber}`;
      },
      // 禁用所有依赖 Worker 的功能
      quickSuggestions: false, // 禁用快速补全
      suggestOnTriggerCharacters: false, // 禁用触发字符补全
      hover: { enabled: false }, // 禁用鼠标 hover 提示（避免触发 Worker）
      parameterHints: { enabled: false }, // 禁用参数提示
      formatOnType: false, // 禁用输入格式化
      formatOnPaste: false, // 禁用粘贴格式化
      // 隐藏 Monaco 内置滚动条
      scrollbar: {
        vertical: 'hidden', // 隐藏垂直滚动条
        verticalHasArrows: false, // 隐藏垂直滚动条箭头
        horizontal: 'hidden', // 隐藏水平滚动条（可选，根据需求）
        horizontalHasArrows: false, // 隐藏水平滚动条箭头
      },
    });
  } catch (error) {
    console.error('Monaco Editor 初始化失败:', error);
  }
};

// 销毁编辑器实例
const disposeEditor = () => {
  try {
      isOpenFile.value = true;
    if (monacoEditor) {
      monacoEditor.dispose();
      monacoEditor = null;
      previewCode.value = '';
      // 移除事件监听
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleBoundaryCheck);
      previewOpacity.value = 0;
    }
  } catch (error) {
    console.log(error);
  }
};

// 处理窗口边界检查，避免超出视口
const handleBoundaryCheck = () => {
  try {
    if (!previewContainer.value) return;

    const container = previewContainer.value;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const containerRect = container.getBoundingClientRect();

    let newLeft = props.config.x + 10;
    let newTop = props.config.y;

    // 右侧超出视口时，调整到左侧显示
    if (newLeft + containerRect.width > viewportWidth) {
      newLeft = props.config.x - containerRect.width - 10;
      // 左侧也超出时，居中显示
      if (newLeft < 0) newLeft = (viewportWidth - containerRect.width) / 2;
    }

    // 底部超出视口时，向上调整
    if (newTop + containerRect.height > viewportHeight) {
      newTop = props.config.y - containerRect.height;
      // 顶部超出时，置顶显示
      if (newTop < 0) newTop = 0;
    }

    // 应用调整后的位置
    if (container.style.left !== `${newLeft}px` || container.style.top !== `${newTop}px`) {
      container.style.left = `${newLeft}px`;
      container.style.top = `${newTop}px`;
    }
    previewOpacity.value = 1;
  } catch (error) {
    console.log(error);
  }
};

// 关闭预览窗口
const handleClose = () => {
  disposeEditor();
  emit('close');
};

// 点击外部区域关闭（编辑器内部）
const handleClickOutside = (e: MouseEvent) => {
  if (previewContainer.value && !previewContainer.value.contains(e.target as Node)) {
    handleClose();
  }
};

// 监听键盘键关闭
const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.key === 'Escape' || e.key === 'Tab') && props.config.isVisible) {
    handleClose();
  }
};

// 生命周期钩子
onMounted(() => {
  try {
    // 监听显示状态变化，初始化/销毁编辑器
    watch(
      () => props.config.isVisible,
      async (newVal) => {
        await nextTick();
        if (newVal) {
          await initEditor();
        }
        // 处理边界，避免窗口超出视口
        handleBoundaryCheck();
      },
      { immediate: true },
    );
  } catch (error) {
    console.log(error);
  }
});

onUnmounted(() => {
  // 销毁编辑器
  disposeEditor();
});
</script>

<style scoped>
.code-preview {
  position: fixed;
  background: var(--control-flow-code-preview);
  box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 20px;
  transition: opacity 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 15px;
  z-index: 100;

  .code-preview__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 24px;
    font-size: 13px;
    line-height: 20px;

    .header__error__group {
      display: flex;
      align-items: center;
      gap: 8px;

      .error__icon {
        font-size: 13px;
        color: rgb(240, 166, 7);
      }
    }

    .header__title {
      font-weight: 700;
      text-align: left;
      letter-spacing: 0px;
      color: var(--devui-title-text);
    }

    .header__open-source {
      display: flex;
      gap: 4px;
      cursor: pointer;

      .open-source__text {
        font-weight: 400;
        color: var(--devui-tooltip-text);
      }
    }
  }
}

.code-preview__container {
  width: 600px;
  max-width: 600px;
  max-height: 400px;
  border-radius: 4px;
  overflow: hidden;
}

.code-preview-err {
  width: 600px;
  box-sizing: border-box;
  height: auto;
  white-space: normal;
  word-wrap: break-word;
  word-break: break-all;
  overflow-wrap: break-word;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.5;
}

.code-preview-editor {
  width: 100%;
  height: 100%;
  min-height: 200px;
  padding-top: 4px;
}
</style>
