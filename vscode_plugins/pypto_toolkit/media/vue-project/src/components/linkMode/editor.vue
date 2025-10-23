<template>
  <div ref="containerRef" class="editor-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, inject } from 'vue';
import * as monaco from 'monaco-editor';
import { generateColorList, getColorByString } from '../../utils/color-list';

const { isDarkTheme } = inject('threeColumnState');

const darkThemeColors = generateColorList(360);
const lithtThemeColors = generateColorList(360, false);
const darkThemeBaseColors = darkThemeColors.baseColorList;
const darkThemeLightColors = darkThemeColors.lightColorList;
const lightThemeBaseColors = lithtThemeColors.baseColorList;
const lightThemeLightColors = lithtThemeColors.lightColorList;

const containerRef = ref(null);
let editor = null;
let semanticDecorations = [];
let currentHoverDecoration = null;
let currentLabels = [];

// 配置 Monaco Editor
const configureMonaco = () => {
  if (typeof window !== 'undefined') {
    self.MonacoEnvironment = {
      getWorkerUrl: function (moduleId, label) {
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
      }
    };
  }
};

// 解析语义标签
const parseSemanticLabels = (code) => {
  const lines = code.split('\n');
  const labels = [];
  let currentLabel = { name: 'default', startLine: 1, endLine: lines.length };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^#\s*set\s+semantic_label\s+(\w+)/);
    if (match) {
      // 如果已经有标签，先设置结束行
      if (currentLabel.name !== 'default') {
        currentLabel.endLine = i;
        labels.push({ ...currentLabel });
      }
      
      // 开始新的标签
      currentLabel = {
        name: match[1],
        startLine: i + 2, // 下一行开始
        endLine: lines.length
      };
    }
  }

  // 添加最后一个标签
  if (currentLabel.name !== 'default') {
    labels.push(currentLabel);
  }

  return labels;
};

// 应用语义标签装饰
const applySemanticDecorations = (labels) => {
  if (!editor) return;

  // 清除之前的装饰
  semanticDecorations.forEach(decoration => {
    editor.removeDecorations(decoration);
  });
  semanticDecorations = [];

  // 为每个语义标签区域添加装饰
  labels.forEach((label, index) => {
    const baseColorList = isDarkTheme.value ? darkThemeBaseColors : lightThemeBaseColors;
    const lightColorList = isDarkTheme.value ? darkThemeLightColors : lightThemeLightColors;
    const { baseColor } = getColorByString(label.name, baseColorList, lightColorList);
    
    // 左侧 gutter 颜色条装饰
    const gutterDecoration = {
      range: new monaco.Range(label.startLine, 1, label.endLine, 1),
      options: {
        isWholeLine: false,
        linesDecorationsClassName: `semantic-gutter-${index}`,
        marginClassName: `semantic-margin-${index}`
      }
    };
    
    // 添加 CSS 样式
    const style = document.createElement('style');
    style.textContent = `
      .semantic-gutter-${index} {
        width: 4px !important;
        background-color: ${baseColor} !important;
        margin-left: 4px;
      }
      .semantic-margin-${index} {
        background-color: ${baseColor} !important;
        opacity: 0.3;
        width: 4px !important;
      }
    `;
    document.head.appendChild(style);
    
    const decorations = editor.deltaDecorations([], [gutterDecoration]);
    semanticDecorations.push(decorations);
  });
};

// 查找光标所在的语义标签区域
const findSemanticLabelAtPosition = (position, labels) => {
  return labels.find(label => 
    position.lineNumber >= label.startLine && 
    position.lineNumber <= label.endLine
  );
};

// 更新悬停装饰
const updateHoverDecoration = (position) => {
  // 清除之前的悬停装饰
  if (currentHoverDecoration) {
    editor.deltaDecorations(currentHoverDecoration, []);
    currentHoverDecoration = null;
  }
  
  if (!position) return;
  
  const currentLabel = findSemanticLabelAtPosition(position, currentLabels);
  
  // 如果当前在语义标签区域内，添加悬停效果
  if (currentLabel) {
    const hoverDecoration = {
      range: new monaco.Range(currentLabel.startLine, 1, currentLabel.endLine, 1),
      options: {
        isWholeLine: true,
        className: 'semantic-hover-highlight'
      }
    };
    
    currentHoverDecoration = editor.deltaDecorations([], [hoverDecoration]);
  }
};

// 添加鼠标悬停事件监听
const setupHoverListeners = (labels) => {
  if (!editor) return;

  // 鼠标移动事件
  editor.onMouseMove((e) => {
    const position = e.target.position;
    updateHoverDecoration(position);
  });

  // 鼠标移出编辑器事件
  editor.onDidBlurEditorWidget(() => {
    if (currentHoverDecoration) {
      editor.deltaDecorations(currentHoverDecoration, []);
      currentHoverDecoration = null;
    }
  });

  // 内容变化时更新悬停
  editor.onDidChangeModelContent(() => {
    const cursorPosition = editor.getPosition();
    updateHoverDecoration(cursorPosition);
  });
};

// 添加悬停效果的 CSS
const setupHoverStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    .semantic-hover-highlight {
      background-color: rgba(128, 128, 128, 0.1) !important;
    }
  `;
  document.head.appendChild(style);
};

// 保存代码到文件
const saveCodeToFile = () => {
  if (!editor) return;
  
  const currentCode = editor.getValue();
  postMessage({ 
    command: 'savePyCode', 
    paramObj: currentCode 
  });
};

// 防抖保存
let saveTimeout = null;
const debouncedSave = () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveCodeToFile();
  }, 1000); // 1秒后保存
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

  const container = containerRef.value;

  try {
    editor = monaco.editor.create(container, {
      value: code,
      language: 'python',
      automaticLayout: true,
      theme: isDarkTheme.value ? 'vs-dark' : 'vs',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      roundedSelection: false,
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        useShadows: false
      }
    });
    
    // 设置悬停样式
    setupHoverStyles();
    
    // 解析并应用语义标签
    currentLabels = parseSemanticLabels(code);
    applySemanticDecorations(currentLabels);
    setupHoverListeners();
    
    // 监听内容变化，实时更新语义标签
    editor.onDidChangeModelContent(() => {
      const newCode = editor.getValue();
      currentLabels = parseSemanticLabels(newCode);
      applySemanticDecorations(currentLabels);
      // 触发保存
      debouncedSave();
    });
    
    console.log('Monaco Editor initialized with semantic labels');
  } catch (error) {
    console.error('Failed to initialize Monaco Editor:', error);
  }
};

const updateTheme = () => {
  const data = editor.getValue();
  initEditor(data);
};

const postMessage = (message) => {
  if (window.vscode) {
    window.vscode.postMessage(message);
  }
};

const initEventListeners = () => {
  window.addEventListener('message', handleMessage);
};

const handleMessage = (event) => {
  const message = event.data;
  switch (message.command) {
    case 'returnPyCode':
      nextTick(() => initEditor(message.data));
      break;
    case 'saveSuccess':
      console.log('Code saved successfully');
      break;
    case 'saveError':
      console.error('Failed to save code:', message.data);
      break;
  }
};

// 在组件挂载前配置 Monaco
configureMonaco();

onMounted(() => {
  initEventListeners();
  nextTick(() => {
    postMessage({ command: 'getPyCode' });
  });
});

onUnmounted(() => {
  if (editor) {
    editor.dispose();
  }
  // 清理所有语义标签装饰
  semanticDecorations = [];
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
});

watch(isDarkTheme, () => {
  updateTheme();
});
</script>

<style>
.editor-container {
  height: 100%;
}
.semantic-hover-highlight {
  background-color: rgba(128, 128, 128, 0.1);
}
</style>