<template>
  <SideBarTreeView class="full-screen-layout" :isExpandable="topCollapsed" @tree-expand="toggleTopCollapse"></SideBarTreeView>
  <!-- 隐藏侧边栏两栏布局入口 -->
  <div class="full-screen-layout" v-if="false">
    <!-- 上方面板 -->
    <div class="panel is-output-panel" :class="{ 'panel--dragging': isDragging }" :style="{ 'height': topHeight + 'px' }">
      <SideBarTreeView :isExpandable="topCollapsed" @tree-expand="toggleTopCollapse"></SideBarTreeView>
    </div>

    <!-- 拖拽分隔条 -->
    <div
      class="resizer"
      :class="{ 'resizer--disabled': topCollapsed || bottomCollapsed }"
      @mousedown="startDrag"
      @selectstart.prevent="false"
      @touchstart.prevent="startDragTouch"
    ></div>

    <!-- 下方面板 -->
    <div class="panel is-config-panel" :class="{ 'panel--dragging': isDragging }" :style="{ 'height': bottomHeight + 'px' }">
      <SideBarRunConfigView :isExpandable="topCollapsed" @tree-expand="toggleBottomCollapse"></SideBarRunConfigView>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import SideBarTreeView from './components/SideBarTreeView.vue';
import SideBarRunConfigView from './components/SideBarRunConfigView.vue';

// 初始配置
const MIN_COLLAPSE_HEIGHT = 44; // 收起最小高度
const MIN_EXPAND_HEIGHT = 200; // 展开最小高度
const RESIZER_HEIGHT = 2; // 拖拽条基础高度
const INIT_TOP_HEIGHT = 600; // 初始高度
const DRAG_THROTTLE = 8; // 拖拽节流时间

// 状态管理
const topCollapsed = ref(false);
const bottomCollapsed = ref(false);
const topHeight = ref(INIT_TOP_HEIGHT);
const bottomHeight = ref(0);
const isDragging = ref(false);
const originTopHeight = ref(INIT_TOP_HEIGHT);
const originBottomHeight = ref(0);
let lastDragTime = 0; // 节流时间戳
let dragRequestId = null; 

// 计算当前面板最小高度
const currentMinTopHeight = computed(() => (topCollapsed.value ? MIN_COLLAPSE_HEIGHT : MIN_EXPAND_HEIGHT));
const currentMinBottomHeight = computed(() => (bottomCollapsed.value ? MIN_COLLAPSE_HEIGHT : MIN_EXPAND_HEIGHT));

// 初始化
onMounted(() => {
  setTimeout(updatePanelHeights, 0);
  window.addEventListener('resize', updatePanelHeights);
});

// 清理资源：避免内存泄漏
onUnmounted(() => {
  window.removeEventListener('resize', updatePanelHeights);
  window.removeEventListener('mousemove', handleDrag);
  window.removeEventListener('mouseup', stopDrag);
  window.removeEventListener('touchend', stopDrag);
  if (dragRequestId) {
    cancelAnimationFrame(dragRequestId);
  }
});

// 统一更新高度
const updatePanelHeights = () => {
  const windowHeight = window.innerHeight;
  if (!windowHeight) {
    return;
  }

  let newTopHeight = topHeight.value;
  let newBottomHeight = 0;

  if (topCollapsed.value && bottomCollapsed.value) {
    newTopHeight = MIN_COLLAPSE_HEIGHT;
    newBottomHeight = windowHeight - MIN_COLLAPSE_HEIGHT - RESIZER_HEIGHT;
  } else if (topCollapsed.value) {
    newTopHeight = MIN_COLLAPSE_HEIGHT;
    newBottomHeight = Math.max(windowHeight - MIN_COLLAPSE_HEIGHT - RESIZER_HEIGHT, currentMinBottomHeight.value);
  } else if (bottomCollapsed.value) {
    newBottomHeight = MIN_COLLAPSE_HEIGHT;
    newTopHeight = Math.max(windowHeight - MIN_COLLAPSE_HEIGHT - RESIZER_HEIGHT, currentMinTopHeight.value);
  } else {
    newBottomHeight = windowHeight - newTopHeight - RESIZER_HEIGHT;
    // 高度校正：确保两个面板都不小于最小高度
    if (newBottomHeight < currentMinBottomHeight.value) {
      newBottomHeight = currentMinBottomHeight.value;
      newTopHeight = windowHeight - newBottomHeight - RESIZER_HEIGHT;
    }
  }

  // 仅在高度变化时更新（减少DOM操作）
  if (newTopHeight !== topHeight.value) {
    topHeight.value = newTopHeight;
  }
  if (newBottomHeight !== bottomHeight.value) {
    bottomHeight.value = newBottomHeight;
  }

  originTopHeight.value = newTopHeight;
  originBottomHeight.value = newBottomHeight;
};

// 开始拖拽先判断是否有面板收起
const startDrag = (e) => {
  // 如果任意面板收起，直接返回，禁用拖拽
  if (topCollapsed.value || bottomCollapsed.value) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  isDragging.value = true;
  lastDragTime = 0;

  // 禁止文本选择 + 鼠标样式
  document.documentElement.style.userSelect = 'none';
  document.documentElement.style.cursor = 'row-resize';

  // 绑定全局事件
  window.addEventListener('mousemove', handleDrag);
  window.addEventListener('mouseup', stopDrag);
};

// 开始拖拽
const startDragTouch = (e) => {
  if (topCollapsed.value || bottomCollapsed.value) {
    return;
  }
  if (e.touches.length !== 1) {
    return;
  }

  isDragging.value = true;
  lastDragTime = 0;

  document.documentElement.style.userSelect = 'none';
  window.addEventListener('touchend', stopDrag);
};

// 拖拽中
const handleDrag = (e) => {
  const now = Date.now();
  // 节流：避免触发过于频繁
  if (now - lastDragTime < DRAG_THROTTLE) {
    return;
  }
  lastDragTime = now;

  // 用requestAnimationFrame重绘
  if (dragRequestId) {
    cancelAnimationFrame(dragRequestId);
  }
  dragRequestId = requestAnimationFrame(() => {
    const windowHeight = window.innerHeight;
    if (!windowHeight) {
      return;
    }

    // 计算新高度（直接用鼠标Y坐标）
    let newTopHeight = e.clientY;
    const maxTopHeight = windowHeight - currentMinBottomHeight.value - RESIZER_HEIGHT;

    // 高度避免超出范围
    newTopHeight = Math.max(currentMinTopHeight.value, Math.min(newTopHeight, maxTopHeight));

    // 仅在高度变化时更新
    if (newTopHeight !== topHeight.value) {
      topHeight.value = newTopHeight;
      bottomHeight.value = windowHeight - newTopHeight - RESIZER_HEIGHT;
    }
  });
};

// 结束拖拽
const stopDrag = () => {
  isDragging.value = false;
  // 恢复文本选择和鼠标样式
  document.documentElement.style.userSelect = '';
  document.documentElement.style.cursor = '';

  // 移除全局事件
  window.removeEventListener('mousemove', handleDrag);
  window.removeEventListener('mouseup', stopDrag);
  window.removeEventListener('touchend', stopDrag);

  // 取消未执行的动画帧
  if (dragRequestId) {
    cancelAnimationFrame(dragRequestId);
    dragRequestId = null;
  }

  // 同步原始高度（拖拽后保存新高度）
  originTopHeight.value = topHeight.value;
  originBottomHeight.value = bottomHeight.value;
};

// 上方收起/展开
const toggleTopCollapse = async (value) => {
  topCollapsed.value = value;

  if (topCollapsed.value) {
    originTopHeight.value = topHeight.value;
    topHeight.value = MIN_COLLAPSE_HEIGHT;
  } else {
    topHeight.value = Math.max(originTopHeight.value, MIN_EXPAND_HEIGHT);
  }

  await nextTick();
  updatePanelHeights();
};

// 下方收起/展开
const toggleBottomCollapse = async (value) => {
  bottomCollapsed.value = value;

  if (bottomCollapsed.value) {
    originBottomHeight.value = bottomHeight.value;
    bottomHeight.value = MIN_COLLAPSE_HEIGHT;
  } else {
    bottomHeight.value = Math.max(originBottomHeight.value, MIN_EXPAND_HEIGHT);
  }

  await nextTick();
  updatePanelHeights();
};
</script>

<style scoped lang="less">
@import url('@devui-design/icons/icomoon/devui-icon.css');

/* 父容器：无默认边距，高度100% */
.full-screen-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

/* 面板样式*/
.panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: height 0.2s ease-out;
}

/* 拖拽时禁用过渡：避免动画延迟导致卡顿 */
.panel--dragging {
  transition: none !important;
}

/* 上方面板 */
.is-output-panel {
  border-bottom: none;
}

/* 下方面板 */
.is-config-panel {
  border-top: 1px solid var(--vscode-sideBar-border);
}

/* 拖拽条：正常状态 */
.resizer {
  height: 1px;
  /* 增加拖拽热区，提升手感 */
  background-color: var(--devui-split-line);
  cursor: row-resize;
  transition: all 0.1s ease;
  position: relative;
  transform: translateZ(0);
}

/* 拖拽条hover效果：正常状态 */
.resizer:not(.resizer--disabled):hover {
  background-color: var(--devui-split-line);
  height: 6px;
  /* hover时扩大热区 */
}

.resizer:hover::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2.5rem;
  height: 1px;
  background-color: #9ca3af;
  border-radius: 0.5px;
  transition: all 0.1s ease;
}

.resizer:not(.resizer--disabled):hover::after {
  width: 3.5rem;
  background-color: #6b7280;
}

/* 拖拽条禁用状态：收起时 */
.resizer--disabled {
  background-color: var(--devui-split-line);
  cursor: not-allowed;
  /* 禁用鼠标样式 */
  height: 1px;
}

.resizer--disabled::after {
  background-color: var(--devui-split-line);
  width: 2rem;
}

.resizer--disabled:hover {
  background-color: var(--devui-split-line);
  height: 3px;
  /* 禁用hover扩大 */
}

.resizer--disabled:hover::after {
  background-color: var(--devui-split-line);
  width: 2rem;
  /* 禁用hover扩大 */
}

/* 禁止选中文字（仅拖拽时生效） */
body.drag-active {
  user-select: none;
  -webkit-user-select: none;
}
</style>
