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
    <!-- 锁图标悬浮框 -->
    <div v-if="!isLocked && lockPosition" 
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
    <div v-if="isLocked && lockPosition" 
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
</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, inject, Ref } from 'vue';
import * as monaco from 'monaco-editor';
import { generateColorList, getColorByString } from '../../utils/color-list';
import { mkSemanticLabel, parseSemanticLabels, labels } from './parser';
import { renderBlockHighlights, clearBlockHighlights, rerenderBlockHighlights, renderGutterBars } from './monaco';
import { useI18n } from 'vue-i18n';
import Loading from '../comGraph/loading.vue';
import { throttle } from 'lodash-es';
import { useViewServer } from '../../core/use-view-server';
import { ThreeColumnServer } from 'ext:/view/servers/three-column-server';
const { server:threeColumnServer } = useViewServer<ThreeColumnServer>();

const { t: $t } = useI18n();
const { isDarkTheme } = inject('threeColumnState') as {isDarkTheme:Ref<boolean>};
const { editorFileName } = inject('threeColumnState');

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
let lastMoveLabel = null;
let lockedLabel = null;
let isMouseLeaved = false;
let labelInfoDecorations = []; // 存储标签信息装饰
let initCodePath = '';
let initTotalLine = 0;
const isLocked = ref(false);
const lockPosition = ref(null);

// 配置 Monaco Editor
const configureMonaco = () => {
  if (typeof window !== 'undefined') {
    self.MonacoEnvironment = {
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
      }
    };
  }
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

// 更新锁图标位置
const updateLockPosition = (label) => {
  if (!editor || !label) {
    return;
  }
  
  // 获取要显示锁的行号（标签首行或视口首行）
  const visibleRanges = editor.getVisibleRanges();
  if (!visibleRanges || !visibleRanges[0]) {
    return;
  }
  const [{ startLineNumber, endLineNumber }] = visibleRanges;
  if (label.startLine < startLineNumber || label.startLine > endLineNumber) {
    lockPosition.value = null;
    return;
  }
  const displayLine = label.startLine;
  
  // 获取对应的DOM元素
  const domElement = getLineDomElement(displayLine) as HTMLElement;
  if (domElement) {
    const rect = domElement.getBoundingClientRect();
    const stickyBlocks = document.querySelectorAll('.sticky-block');
    let hasOverlap = false;

    for (const block of stickyBlocks) {
      const blockRect = block.getBoundingClientRect();
      // 判断垂直方向是否重叠
      const isOverlapping = rect.bottom > blockRect.top && rect.top < blockRect.bottom;
      if (isOverlapping) {
        hasOverlap = true;
        break;
      }
    }
    if (hasOverlap) {
      lockPosition.value = null;
      return;
    }
    const editorRect = editor.getDomNode().getBoundingClientRect();
    
    lockPosition.value = {
      top: rect.top - editorRect.top + 20,
      left: 63,
    };
  }
};

// 支持锁定
const enableLock = (label) => {
  updateLockPosition(label);
};

// 退出锁定状态
const deactivateLock = () => {
  if (!isLocked.value) {
    return;
  }
  
  updateBkDecoration(lockedLabel, false);
  isLocked.value = false;
  lockedLabel = null;
  sendMsg('deactivateLock','');
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
  updateBkDecoration(lockedLabel, false);
  e.stopPropagation();
  deactivateLock();
};

// 更新悬停装饰
const updateHoverDecoration = (position, emit = true) => {
  // 如果处于锁定状态，不更新悬停装饰
  if (isLocked.value) {
    return;
  }

  // 清除之前的悬停块
  clearBlockHighlights(editor);

  if (!position) {
    lockPosition.value = null;
    if (lastSentLabel && emit) {
      sendMsg('returnSemanticLabelFromCode', { label: '' });
      lastSentLabel = null;
    }
    return;
  }

  const currentLabel = findSemanticLabelAtPosition(position);

  // 如果当前在语义标签区域内，渲染块状悬停效果
  if (currentLabel) {
    renderBlockHighlights(editor, [[currentLabel.startLine, currentLabel.endLine]], getBlockStyle(false));
    if (emit && lastSentLabel !== currentLabel.name && !isMouseLeaved) {
      lastSentLabel = currentLabel.name;
      sendMsg('returnSemanticLabelFromCode', { label: currentLabel.name });
    }
  }
};

// 通过泳道图/计算图发送的语义标签，更新悬停装饰
const updateHoverDecorationBySemanticLabel = (label) => {
  if (isLocked.value) {
    return;
  }
  const targetLabel = labels.find(l => l.name === label);
  
  if (!targetLabel) {
    updateHoverDecoration(null, false);
    lockPosition.value = null;
    lastMoveLabel = null;
    return;
  }

  const position = {
    lineNumber: targetLabel.startLine,
    column: 1
  };
  
  updateHoverDecoration(position, false);
  
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

const simulateMouseMove = (position) => {
  const currentLabel = findSemanticLabelAtPosition(position);
  if (currentLabel && (!lastMoveLabel || currentLabel.name !== lastMoveLabel.name)) {
    updateHoverDecoration(position);
    if (isLocked.value) {
      enableLock(lockedLabel);
    } else {
      enableLock(currentLabel);
      lastMoveLabel = currentLabel;
    }
  } else if (!currentLabel && !isLocked.value) {
    if (lastSentLabel) {
      lastSentLabel = null;
      sendMsg('returnSemanticLabelFromCode', { label: '' });
    }
    lastMoveLabel = null;
    lockPosition.value = null;
    updateHoverDecoration(null);
    return;
  }
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
  editor.onMouseDown((e) => {
    const { position } = e.target;
    if (position) {
      // 清除之前的标签信息装饰
      clearLabelInfo();
      const currentLabel = findSemanticLabelAtPosition(position);
      if (!currentLabel) {
        return;
      }
      showLabelInfo(position, currentLabel);
      sendMsg('returnSemanticLabelFromCodeClick', { label: currentLabel.name });
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

// 保存代码到文件
const saveCodeToFile = () => {
  if (!editor) {
    return;
  }
  
  const currentCode = editor.getValue();
  threeColumnServer.savePyCode(currentCode);
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
    // 触发保存
    debouncedSave();
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

(window as any).ascEventBus.on('returnSemanticLabelFromCom', (args) => {
  updateHoverDecorationBySemanticLabel(args.label);
});
(window as any).ascEventBus.on('returnSemanticLabelFromSwim', (args) => {
  updateHoverDecorationBySemanticLabel(args.label);
});
(window as any).ascEventBus.on('activeLock', ({ label }) => {
  if (lastMoveLabel !== label) {
    updateHoverDecorationBySemanticLabel(label);
  }
  isLocked.value = true;
  const targetLabel = labels.find(l => l.name === label);
  lockedLabel = targetLabel;
  updateBkDecoration(lockedLabel, true);
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
watch(threeColumnServer.PyCode, (newValue) => {
  const { codePath, code } = newValue.data;
  initCodePath = codePath;
  editorFileName.value = initCodePath.split(/[\/\\]/).pop();
  initTotalLine = code.split('\n').length;
  loading.value = false;
  nextTick(() => initEditor(code));
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
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
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