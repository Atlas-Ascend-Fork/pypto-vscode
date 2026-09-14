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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 -->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, toRef, useSlots } from 'vue';
import { useResizeObserver } from './use-resize-observer';
import { useDragging } from './use-dragging';
import { useViewSnapshot } from './use-view-snapshot';

export interface SplitView {
  /** 插槽名称 */
  slotName: string;

  /** 顶部距离 */
  top: number;

  /** 高度 */
  height: number;

  /** 高度是否锁定 */
  locked: boolean;
  unlockHeight?: number;
}

interface Props {
  minHeight?: number;
}

const props = withDefaults(defineProps<Props>(), {
  minHeight: 200,
});

const outerBox = ref<HTMLDivElement>();

const renderViews = ref<SplitView[]>([]);
const outerBoxMinHeight = computed(() =>
  renderViews.value.reduce((total, view) => {
    const viewMinHeight = view.locked ? view.height : props.minHeight;
    return total + viewMinHeight;
  }, 0),
);

useResizeObserver(outerBox, renderViews, toRef(props, 'minHeight'));

onMounted(() => {
  const slots = useSlots();
  const viewSlots = Object.keys(slots).filter((key) => /^view\d+$/.test(key));

  // 初始化，均分容器高度
  const averageHeight = outerBox.value.offsetHeight / viewSlots.length;
  let stackHeight = 0;
  renderViews.value = viewSlots.map((slotName) => {
    const top = stackHeight;
    stackHeight += averageHeight;
    return { slotName, top, height: averageHeight, locked: false };
  });
});

const { snapshot, getViewSnapshot } = useViewSnapshot(renderViews);

/**
 * 锁定容器高度
 * @param index
 * @param lockedHeight
 */
function lockViewHeight(index: number, lockedHeight: number) {
  renderViews.value[index].locked = true;
  renderViews.value[index].unlockHeight = renderViews.value[index].height;
  snapshot();
  withAnimation(() => {
    renderViews.value[index].height = lockedHeight;
    const offsetY = getViewSnapshot(index).height - lockedHeight;
    if (isBelowAllLocked(index) && !isAboveAllLocked(index)) {
      // 仅上方可延展，向下折叠
      renderViews.value[index].top = getViewSnapshot(index).top + offsetY;
      moveAboveViews(index, -offsetY);
    } else {
      // 默认，向上折叠
      moveBelowViews(index + 1, -offsetY);
    }
  });
}

/**
 * 解锁容器高度
 * @param index
 */
function unlockViewHeight(index: number) {
  renderViews.value[index].locked = false;
  snapshot();
  withAnimation(() => {
    if (isBelowAllLocked(index + 1) && isAboveAllLocked(index)) {
      // 上下不可延展，展开时撑满高度
      const lastView = renderViews.value.at(-1);
      const offsetY = outerBox.value.offsetHeight - (lastView.top + lastView.height);
      moveViews(index + 1, offsetY);
    } else {
      const offsetY = getViewSnapshot(index).unlockHeight - getViewSnapshot(index).height;
      if (isBelowAllLocked(index + 1)) {
        // 下方不可延展，向上展开
        moveViews(index, -offsetY);
      } else {
        // 默认，向下展开
        moveViews(index + 1, offsetY);
      }
    }
  });
}

const animation = ref(false);
function withAnimation(callback: () => void) {
  animation.value = true;
  nextTick(() => {
    callback();
    setTimeout(() => {
      animation.value = false;
    }, 200);
  });
}

function isAboveAllLocked(index: number): boolean {
  return renderViews.value.slice(0, index).every(({ locked }) => locked);
}

function isBelowAllLocked(index: number): boolean {
  return renderViews.value.slice(index).every(({ locked }) => locked);
}

const draggingIndex = ref<number | null>(null);
const { startDragging } = useDragging((isEnd, offsetY) => {
  moveViews(draggingIndex.value, offsetY);
  if (isEnd) {
    draggingIndex.value = null;
  }
});

/**
 * 开始拖拽
 */
function handleMousedownDragger(event: MouseEvent, index: number): void {
  draggingIndex.value = index;
  snapshot();
  startDragging(event);
}

/**
 * 移动容器
 */
function moveViews(index: number, offsetY: number): void {
  if (offsetY < 0) {
    const minOffset = moveAboveViews(index, -offsetY);
    moveBelowViews(index, minOffset);
  } else {
    const maxOffset = moveBelowViews(index, offsetY);
    moveAboveViews(index, -maxOffset);
  }
}

/**
 * 移动上方容器
 * @param index 目标索引
 * @param upper 向上移动距离
 * @returns 实际移动的距离
 */
function moveAboveViews(index: number, upper: number): number {
  let aboveOffset = upper;
  const lockedViewIndexes: number[] = [];
  for (let i = index - 1; i >= 0; i--) {
    const view = getViewSnapshot(i);
    const renderView = renderViews.value[i];
    if (view.locked) {
      lockedViewIndexes.push(i);
      continue;
    }

    if (view.height - aboveOffset < props.minHeight) {
      renderView.height = props.minHeight;
      const maxChangingHeight = view.height - props.minHeight;
      aboveOffset -= maxChangingHeight;
      moveLockedViews(lockedViewIndexes, -maxChangingHeight);
    } else {
      renderView.height = view.height - aboveOffset;
      moveLockedViews(lockedViewIndexes, -aboveOffset);
      return -upper;
    }
  }
  return aboveOffset - upper;
}

/**
 * 移动下方容器
 * @param index 目标索引
 * @param lowerOffset 向下移动距离
 * @returns 实际移动的距离
 */
function moveBelowViews(index: number, lowerOffset: number): number {
  let belowOffset = lowerOffset;
  const lockedViewIndexes: number[] = [];
  if (index >= renderViews.value.length) {
    return lowerOffset;
  }
  for (let i = index; i < renderViews.value.length; i++) {
    const view = getViewSnapshot(i);
    const renderView = renderViews.value[i];
    if (view.locked) {
      lockedViewIndexes.push(i);
      continue;
    }
    if (view.height - belowOffset < props.minHeight) {
      renderView.height = props.minHeight;
      const maxChangingHeight = view.height - props.minHeight;
      renderView.top = view.top + maxChangingHeight;
      belowOffset -= maxChangingHeight;
      moveLockedViews(lockedViewIndexes, maxChangingHeight);
    } else {
      renderView.height = view.height - belowOffset;
      renderView.top = view.top + belowOffset;
      moveLockedViews(lockedViewIndexes, belowOffset);
      return lowerOffset;
    }
  }
  if (lockedViewIndexes.length > 0) {
    moveLockedViews(lockedViewIndexes, belowOffset);
    return belowOffset;
  }
  return lowerOffset - belowOffset;
}

function moveLockedViews(lockedViewIndexes: number[], offsetY: number): void {
  let viewIndex = lockedViewIndexes.pop();
  let snapshotView = getViewSnapshot(viewIndex);
  let renderView = renderViews.value[viewIndex];
  while (renderView) {
    renderView.top = snapshotView.top + offsetY;
    viewIndex = lockedViewIndexes.pop();
    snapshotView = getViewSnapshot(viewIndex);
    renderView = renderViews.value[viewIndex];
  }
}

function addHoverClass(event: MouseEvent): void {
  (event.target as HTMLDivElement).className += ' hover';
}

function removeHoverClass(event: MouseEvent): void {
  (event.target as HTMLDivElement).className = (event.target as HTMLDivElement).className.replace(' hover', '');
}
</script>

<template>
  <div ref="outerBox" class="split-view-container" :class="{ animation }" :style="{ 'min-height': `${outerBoxMinHeight}px` }">
    <div class="draggable-container" :class="{ dragging: draggingIndex !== null }">
      <template v-for="(view, index) in renderViews" :key="view.slotName">
        <div
          v-if="index >= 1"
          class="draggable-divider"
          :class="{ disabled: isAboveAllLocked(index) || isBelowAllLocked(index), dragging: draggingIndex === index }"
          :style="{ top: `${view.top - 4}px` }"
          ondragstart="return false;"
          @mouseenter.prevent="addHoverClass"
          @mouseleave.prevent="removeHoverClass"
          @mousedown.prevent="handleMousedownDragger($event, index)"
        ></div>
      </template>
    </div>
    <div class="split-container" :class="{ dragging: draggingIndex !== null }">
      <template v-for="(view, index) in renderViews" :key="view.slotName">
        <div class="split-view" :class="{ locked: view.locked }" :style="{ top: `${view.top}px`, height: `${view.height}px` }">
          <slot
            :name="view.slotName"
            :locked="view.locked"
            :lock="(height: number) => lockViewHeight(index, height)"
            :unlock="() => unlockViewHeight(index)"
          ></slot>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="less" scoped>
.split-view-container {
  position: relative;
  width: 100%;
  height: 100%;

  &.animation {
    .draggable-divider,
    .split-view {
      transition: height 0.2s ease-out, top 0.2s ease-out;
    }
  }
}

.draggable-container {
  position: absolute;
  width: 100%;
  height: 100%;

  &.dragging {
    cursor: ns-resize;
  }
}

.draggable-divider {
  position: absolute;
  width: 100%;
  height: 4px;
  border-bottom: 1px solid var(--pto-border-deep);
  cursor: ns-resize;
  z-index: 1;
  pointer-events: all;

  &.disabled {
    pointer-events: none;
  }

  &::before {
    content: '';
    display: block;
    width: 100%;
    height: 4px;
    transition: background-color 0.3s ease-out;
    background-color: transparent;
    pointer-events: none;
  }

  &.dragging,
  &.hover {
    &::before {
      background-color: var(--vscode-sash-hoverBorder);
    }
  }
}

.split-container {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;

  &.dragging {
    pointer-events: none;
  }
}

.split-view {
  position: absolute;
  width: 100%;
}
</style>
