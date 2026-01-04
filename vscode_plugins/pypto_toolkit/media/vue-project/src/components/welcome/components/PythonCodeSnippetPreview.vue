<template>
  <div ref="previewContainer" class="code-preview">
    <div class="step-content__run-python">
      <img :src="pythonIcon" class="icon-json" />
      <div class="step-description">hello_world.py</div>
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
// 优化：明确 monacoEditor 类型，避免 TS 类型提示异常
let monacoEditor: monaco.editor.IStandaloneCodeEditor | null = null;
const previewCode = ref('asdfasdf');
const previewOpacity = ref(0);
const isOpenFile = ref(true);
const themeState = computed(() => {
  return isDarkTheme.value ? 'vs-dark' : 'vs';
});

// 配置 Monaco Worker 环境
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
    // 获取代码片段
    const res = await getPythonFileCode();

    previewCode.value = res;
    // 配置 Worker 环境
    configureMonacoWorker();
    // 创建编辑器实例
    monacoEditor = monaco.editor.create(editorContainer.value, {
      value: previewCode.value,
      language: 'python', // 识别语言
      theme: themeState.value, // 初始化主题
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

// 主题更新方法
const updateEditorTheme = (newTheme: string) => {
  if (!monacoEditor) return;
  monaco.editor.setTheme(newTheme);

  monacoEditor.updateOptions({
    theme: newTheme,
  });
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
  } catch (error) {
    console.log(error);
  }
};

// 动态更新主题
watch(
  themeState, // 监听计算属性 themeState 的变化
  (newTheme, oldTheme) => {
    if (newTheme === oldTheme) return;
    updateEditorTheme(newTheme); // 执行主题更新
  },
  {
    immediate: false,
    deep: false,
  },
);

// 生命周期钩子
onMounted(async () => {
  try {
    // 监听显示状态变化，初始化/销毁编辑器
    await nextTick();
    await initEditor();
  } catch (error) {
    console.log(error);
  }
});

onUnmounted(() => {
  // 销毁编辑器
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
    line-height: 40px;
    gap: 8px;
    padding-left: 15px;

    .icon-json {
      width: 16px;
      height: 16px;
      line-height: 20px;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--devui-yellow-60); // 黄色主题色
    }
  }

  .code-preview-editor {
    flex: 1;
  }
}
</style>
