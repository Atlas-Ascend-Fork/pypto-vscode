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
  <ThreeColumnHeader />
  <div ref="containerEl" :class="['three-column-content', currentLayoutMode, resizing && 'resizing']" :style="[gridStyle, { width: sharedSwimData.performanceVisible ? `calc(100% - ${sharedSwimData.performanceWidth}px)` : '100%' }]">
    <ItemBlock
      class="grid-py"
      block-name="left"
      width="100%"
      height="100%"
      :has-border-right="showRight"
      :is-fullscreen="currentFullscreenBlock === 'left'"
    >
      <div class="three-column-block editor-block">
        <div class="sticky-block">
          <fileSelect
            :file-name="editorFileName"
            :show-dropdown="true"
            :file-list="pyFileList"
            :current-path="editorFilePath"
            @file-select="onPyFileSwitch"
          />
          <DragIcon />
          <i :class="[isEditorFullscreen ? 'icon-zoom-screen' : 'icon-full-screen']" @click="onToggleEditorFullscreen"></i>
        </div>
        <editor ref="editorRef" />
      </div>
    </ItemBlock>
    <ItemBlock
      v-if="isFourColumn"
      class="grid-cce"
      block-name="bottomLeft"
      width="100%"
      height="100%"
      :has-border-right="showRight"
      :has-border-top="showLeft"
      :is-fullscreen="currentFullscreenBlock === 'bottomLeft'"
    >
      <div class="block-drag-handle">
        <DragIcon />
      </div>
      <div class="three-column-block extra-block">
        <slot name="extra">
          <div class="extra-placeholder">Under Development</div>
        </slot>
      </div>
    </ItemBlock>
    <ItemBlock
      class="grid-graph"
      block-name="right"
      width="100%"
      height="100%"
      :has-border-left="showLeft"
      :is-fullscreen="currentFullscreenBlock === 'right'"
    >
      <div class="three-column-block">
        <slot name="comGraph" />
      </div>
    </ItemBlock>
    <ItemBlock
      class="grid-swim"
      block-name="bottomRight"
      width="100%"
      height="100%"
      :has-border-left="showLeft && isFourColumn"
      :has-border-top="showRight"
      :is-fullscreen="currentFullscreenBlock === 'bottomRight'"
    >
      <div class="three-column-block swim-block">
        <slot name="swimGraph" />
      </div>
    </ItemBlock>
    <div
      v-show="showColumnResizeBar"
      class="column-resize-bar"
      :style="{ left: columnBarLeft, height: isFourColumn ? '100%' : currentHeight, '--offset': columnBarOffset }"
      @mousedown="onColumnResizeMousedown"
      @mouseover="() => (columnBarOffset = '2px')"
      @mouseleave="() => (columnBarOffset = '1px')"
    ></div>
    <div
      v-show="showLeftRowResizeBar && isFourColumn"
      class="row-resize-bar"
      :style="{ top: leftRowBarTop, width: currentWidth, '--offset': leftRowBarOffset }"
      @mousedown="onLeftRowResizeMousedown"
      @mouseover="() => (leftRowBarOffset = '2px')"
      @mouseleave="() => (leftRowBarOffset = '1px')"
    ></div>
    <div
      v-show="showRightRowResizeBar && isFourColumn"
      class="row-resize-bar"
      :style="{ top: rightRowBarTop, left: currentWidth, width: `calc(100% - ${currentWidth})`, '--offset': rightRowBarOffset }"
      @mousedown="onRightRowResizeMousedown"
      @mouseover="() => (rightRowBarOffset = '2px')"
      @mouseleave="() => (rightRowBarOffset = '1px')"
    ></div>
    <div
      v-show="!isFourColumn"
      class="row-resize-bar"
      :style="{ top: leftRowBarTop, '--offset': leftRowBarOffset }"
      @mousedown="onFullRowResizeMousedown"
      @mouseover="() => (leftRowBarOffset = '2px')"
      @mouseleave="() => (leftRowBarOffset = '1px')"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, provide, ref, toRef, watch } from 'vue';
import type { Ref } from 'vue';
import editor from './editor.vue';
import { ThreeColumnProvideKey } from './types';
import type { ILayoutInfo, BlockType, GraphType, LayoutMode, IBlockToGraphMap, IShowBlockMap } from './types';
import ItemBlock from './itemBlock.vue';
import ThreeColumnHeader from './threeColumnHeader.vue';
import DragIcon from './drag-icon.vue';
import fileSelect from '../threeColumn/file-select.vue';
import { findKeyByValue } from './utils';
import { useViewServer } from '../../core/use-view-server';
import { ThreeColumnServer } from 'ext:/view/servers/three-column-server';
const { server:threeColumnServer } = useViewServer<ThreeColumnServer>();

const { isDarkTheme } = inject('root') as { isDarkTheme: Ref<boolean> };

const currentLayoutMode = ref<LayoutMode>('triangular');
const columnMode = ref<3 | 4>(3);
const isFourColumn = computed(() => columnMode.value === 4);
watch(threeColumnServer.ColumnMode, (newValue: any) => {
  columnMode.value = newValue?.columnMode === 4 ? 4 : 3;
  nextTick(() => emitSizeChange());
}, { immediate: true });
const columnBarLeft = ref('');
const leftRowBarTop = ref('');
const rightRowBarTop = ref('');
const editorFileName = ref('');
const editorFilePath = ref('');
const pyFileList = ref<Array<{ path: string; name: string; exists: boolean }>>([]);

watch(threeColumnServer.PyCode, (newValue: any) => {
  const codePath = newValue?.data?.codePath;
  if (codePath) {
    editorFilePath.value = codePath;
  }
});

const onPyFileSwitch = (path: string) => {
  editorFilePath.value = path;
  editorFileName.value = path.split(/[\/\\]/).pop() ?? path;
  (window as any).ascEventBus.emit('deactivateLock');
  threeColumnServer.switchPyFile({ paramObj: { path } });
};
const editorRef = ref();
const columnBarOffset = ref('1px');
const leftRowBarOffset = ref('1px');
const rightRowBarOffset = ref('1px');
const currentWidth = ref('50%');
const currentHeight = ref('50%');
const currentHeightRight = ref('50%');
const resizing = ref(false);
const showLeft = ref(true);
const showRight = ref(true);
const showBottomLeft = ref(true);
const showBottomRight = ref(true);
const containerEl = ref<HTMLElement>();
const isEditorFullscreen = ref(false);
const isComGraphFullscreen = ref(false);
const isSwimFullscreen = ref(false);
const currentActiveBlock = ref<BlockType>('');
const currentFullscreenBlock = ref<BlockType>('');
const dragStartBlock = ref<BlockType>('');
const showColumnResizeBar = computed(() => showLeft.value && showRight.value);
const showLeftRowResizeBar = computed(() => showLeft.value && showBottomLeft.value);
const showRightRowResizeBar = computed(() => showRight.value && showBottomRight.value);
const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `${currentWidth.value} calc(100% - ${currentWidth.value})`,
  gridTemplateRows: `${currentHeight.value} calc(100% - ${currentHeight.value})`,
  gridTemplateAreas: isFourColumn.value ? '"py graph" "cce swim"' : '"py graph" "swim swim"',
}));
const props = defineProps({
  sharedSwimData: {
    type: Object,
  }
});
const sharedSwimData = toRef(props, 'sharedSwimData');
const BlockToGraphMap: IBlockToGraphMap = {
  left: 'editor',
  right: 'comGraph',
  bottomLeft: 'cce',
  bottomRight: 'swimGraph',
};
const ShowBlockMap: IShowBlockMap = {
  left: showLeft,
  right: showRight,
  bottomLeft: showBottomLeft,
  bottomRight: showBottomRight,
};
let containerWidth = 0;
let containerHeight = 0;
let containerLeft = 0;
let containerTop = 0;
let prevLayoutInfo: ILayoutInfo = {};
provide(ThreeColumnProvideKey, {
  resizing,
  currentLayoutMode,
  currentActiveBlock,
  isComGraphFullscreen,
  isSwimFullscreen,
  BlockToGraphMap,
  dragStartBlock,
  onToggleComGraphFullscreen,
  onToggleSwimFullscreen,
  emitSizeChange,
  resetLayout,
});

const BLOCKS: Exclude<BlockType, ''>[] = ['left', 'right', 'bottomLeft', 'bottomRight'];

function zoomInBlock(block: Exclude<BlockType, ''>) {
  prevLayoutInfo = {
    showLeft: showLeft.value,
    showRight: showRight.value,
    showBottomLeft: showBottomLeft.value,
    showBottomRight: showBottomRight.value,
    currentWidth: currentWidth.value,
    currentHeight: currentHeight.value,
    currentHeightRight: currentHeightRight.value,
  };
  BLOCKS.forEach((key) => {
    ShowBlockMap[key].value = key === block;
  });
}

function restoreBlocks() {
  showLeft.value = prevLayoutInfo.showLeft ?? true;
  showRight.value = prevLayoutInfo.showRight ?? true;
  showBottomLeft.value = prevLayoutInfo.showBottomLeft ?? true;
  showBottomRight.value = prevLayoutInfo.showBottomRight ?? true;
  currentWidth.value = prevLayoutInfo.currentWidth ?? currentWidth.value;
  currentHeight.value = prevLayoutInfo.currentHeight ?? currentHeight.value;
  currentHeightRight.value = prevLayoutInfo.currentHeightRight ?? currentHeightRight.value;
}

function toggleFullscreen(isFullscreen: boolean) {
  const block = currentActiveBlock.value;
  if (block === '') {
    return;
  }
  if (isFullscreen) {
    restoreBlocks();
    currentFullscreenBlock.value = '';
  } else {
    zoomInBlock(block);
    currentFullscreenBlock.value = block;
  }
}

function toggleBlockFullscreen(flag: Ref<boolean>, graphType: GraphType) {
  const block = findKeyByValue(BlockToGraphMap, graphType);
  if (!block) {
    return;
  }
  currentActiveBlock.value = block as BlockType;
  toggleFullscreen(flag.value);
  flag.value = !flag.value;
  emitSizeChange();
}

function onToggleEditorFullscreen() {
  toggleBlockFullscreen(isEditorFullscreen, 'editor');
}

function onToggleComGraphFullscreen() {
  toggleBlockFullscreen(isComGraphFullscreen, 'comGraph');
}

function onToggleSwimFullscreen() {
  toggleBlockFullscreen(isSwimFullscreen, 'swimGraph');
}

function emitSizeChange() {
  (window as any).ascEventBus.emit('threeColumnSizeChange', {
    editorVisible: ShowBlockMap[findKeyByValue(BlockToGraphMap, 'editor')].value,
    comGraphVisible: ShowBlockMap[findKeyByValue(BlockToGraphMap, 'comGraph')].value,
    swimVisible: ShowBlockMap[findKeyByValue(BlockToGraphMap, 'swimGraph')].value,
    extraVisible: isFourColumn.value && ShowBlockMap[findKeyByValue(BlockToGraphMap, 'cce')].value,
  });
}

function onColumnResizeMousemove(e: MouseEvent) {
  const offsetX = Math.min(Math.max(e.clientX - containerLeft, 0), containerWidth - 2);
  columnBarLeft.value = `calc(${(offsetX / containerWidth) * 100}% - var(--offset))`;
}

function onColumnResizeMouseup(e: MouseEvent) {
  resizing.value = false;
  const offsetX = Math.min(Math.max(e.clientX - containerLeft, 0), containerWidth);
  currentWidth.value = `${(offsetX / containerWidth) * 100}%`;
  const leftVisible = offsetX !== 0;
  const rightVisible = offsetX !== containerWidth - 1 && offsetX !== containerWidth;
  showLeft.value = leftVisible;
  showBottomLeft.value = leftVisible;
  showRight.value = rightVisible;
  showBottomRight.value = rightVisible;
  document.removeEventListener('mousemove', onColumnResizeMousemove);
  document.removeEventListener('mouseup', onColumnResizeMouseup);
  emitSizeChange();
}

function onColumnResizeMousedown() {
  resizing.value = true;
  updateContainerRect();
  document.addEventListener('mousemove', onColumnResizeMousemove);
  document.addEventListener('mouseup', onColumnResizeMouseup);
}

function createRowResize(barTop: Ref<string>, height: Ref<string>, showTop: Ref<boolean>, showBottom: Ref<boolean>) {
  function onMove(e: MouseEvent) {
    const offsetY = Math.min(Math.max(e.clientY - containerTop, 0), containerHeight - 2);
    barTop.value = `calc(${(offsetY / containerHeight) * 100}% - var(--offset))`;
  }

  function onUp(e: MouseEvent) {
    resizing.value = false;
    const offsetY = Math.min(Math.max(e.clientY - containerTop, 0), containerHeight);
    height.value = `${(offsetY / containerHeight) * 100}%`;
    showTop.value = offsetY !== 0;
    showBottom.value = offsetY !== containerHeight - 1 && offsetY !== containerHeight;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    emitSizeChange();
  }

  return function onDown() {
    resizing.value = true;
    updateContainerRect();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
}

const onLeftRowResizeMousedown = createRowResize(leftRowBarTop, currentHeight, showLeft, showBottomLeft);
const onRightRowResizeMousedown = createRowResize(rightRowBarTop, currentHeightRight, showRight, showBottomRight);

function onFullRowResizeMousemove(e: MouseEvent) {
  const offsetY = Math.min(Math.max(e.clientY - containerTop, 0), containerHeight - 2);
  const top = `calc(${(offsetY / containerHeight) * 100}% - var(--offset))`;
  leftRowBarTop.value = top;
  rightRowBarTop.value = top;
}

function onFullRowResizeMouseup(e: MouseEvent) {
  resizing.value = false;
  const offsetY = Math.min(Math.max(e.clientY - containerTop, 0), containerHeight);
  const pct = `${(offsetY / containerHeight) * 100}%`;
  currentHeight.value = pct;
  currentHeightRight.value = pct;
  const topVisible = offsetY !== 0;
  const bottomVisible = offsetY !== containerHeight - 1 && offsetY !== containerHeight;
  showLeft.value = topVisible;
  showBottomLeft.value = bottomVisible;
  showRight.value = topVisible;
  showBottomRight.value = bottomVisible;
  document.removeEventListener('mousemove', onFullRowResizeMousemove);
  document.removeEventListener('mouseup', onFullRowResizeMouseup);
  emitSizeChange();
}

function onFullRowResizeMousedown() {
  resizing.value = true;
  updateContainerRect();
  document.addEventListener('mousemove', onFullRowResizeMousemove);
  document.addEventListener('mouseup', onFullRowResizeMouseup);
}

function updateContainerRect() {
  if (containerEl.value) {
    const { width, height, left, top } = containerEl.value.getBoundingClientRect();
    containerWidth = width;
    containerHeight = height;
    containerLeft = left;
    containerTop = top;
  }
}

function resetLayout() {
  if (isEditorFullscreen.value || isComGraphFullscreen.value || isSwimFullscreen.value) {
    return;
  }
  columnBarLeft.value = `calc(50% - var(--offset))`;
  leftRowBarTop.value = `calc(50% - var(--offset))`;
  rightRowBarTop.value = `calc(50% - var(--offset))`;
  currentWidth.value = '50%';
  currentHeight.value = '50%';
  currentHeightRight.value = '50%';
  showLeft.value = true;
  showRight.value = true;
  showBottomLeft.value = true;
  showBottomRight.value = true;
  emitSizeChange();
}
onMounted(() => {
  columnBarLeft.value = `calc(50% - var(--offset))`;
  leftRowBarTop.value = `calc(50% - var(--offset))`;
  rightRowBarTop.value = `calc(50% - var(--offset))`;
  updateContainerRect();
  window.addEventListener('resize', updateContainerRect);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateContainerRect);
});

provide('threeColumnState', { isDarkTheme, editorFileName, pyFileList });
</script>

<style scoped lang="scss">
.three-column-content {
  position: relative;
  display: flex;
  width: 100%;
  height: calc(100vh - 40px);

  &.resizing {
    user-select: none;
  }

  .grid-py {
    grid-area: py;
  }

  .grid-cce {
    grid-area: cce;
  }

  .grid-graph {
    grid-area: graph;
  }

  .grid-swim {
    grid-area: swim;
  }

  .block-drag-handle {
    position: absolute;
    top: 0;
    left: 50%;
    z-index: 16;
    display: flex;
    align-items: center;
    height: 40px;
    transform: translateX(-50%);
  }

  .column-resize-bar {
    position: absolute;
    top: 0;
    z-index: 20;
    width: 2px;
    height: 100%;
    background-color: var(--devui-border-line-deep);

    &:hover {
      width: 4px;
      background-color: var(--devui-active-icon);
      cursor: col-resize;
    }
  }

  .row-resize-bar {
    position: absolute;
    left: 0;
    z-index: 20;
    width: 100%;
    height: 2px;
    background-color: var(--devui-border-line-deep);

    &:hover {
      height: 4px;
      background-color: var(--devui-active-icon);
      cursor: row-resize;
    }
  }

  .three-column-column {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;

    &:has(> .three-column-item.is-fullscreen) {
      position: static;
    }
  }

  &.triangular {
    .three-column-block {
      width: 100%;
      height: 100%;
    }

    .extra-block {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;

      .extra-placeholder {
        flex: 1;
        min-height: 0;
      }
    }

    .extra-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: var(--devui-aide-text);
      background-color: var(--devui-global-bg);
    }

    .editor-block {
      padding-top: 40px;
      box-sizing: border-box;

      .sticky-block {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 15;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        height: 40px;
        padding: 4px 16px;
        border-bottom: 1px solid var(--devui-split-line);
        background-color: var(--devui-card-bg);
        box-sizing: border-box;

        :deep() {
          .three-column-drag-icon {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }
        }

        i {
          font-size: 14px;
          cursor: pointer;
        }
      }
    }

    .three-column-item {
      &.active {
        .sticky-block {
          display: flex;
        }
      }
    }
  }

  &.threeColumn {
    & > .three-column-item {
      flex: 1;
    }
    & > .three-column-item:nth-of-type(1) {
      border-right: 1px solid var(--devui-border-line-deep);
    }
    & > .three-column-item:nth-of-type(2) {
      border-left: 1px solid var(--devui-border-line-deep);
      border-right: 1px solid var(--devui-border-line-deep);
    }
    & > .three-column-item:nth-of-type(3) {
      border-left: 1px solid var(--devui-border-line-deep);
    }
  }

  .swim-block {
    :deep() {
      .container {
        position: relative;
      }
    }
  }
  .simple-containner {
    display: flex;
    cursor: pointer;
  }
  .icon-line-height {
    line-height: 30px;
    margin-left: 6px;
  }
}
</style>

<style lang="scss">
.three-column-design-tips {
  max-width: unset;
}
</style>
