<template>
  <ThreeColumnHeader />
  <div ref="containerEl" :class="['three-column-content', currentLayoutMode, resizing && 'resizing']">
    <ItemBlock
      v-show="showLeft"
      block-name="left"
      :width="currentWidth"
      :height="currentHeight"
      :has-border-right="showRight"
      :has-border-bottom="showBottom"
    >
      <div class="three-column-block editor-block">
        <div class="sticky-block">
          <i :class="[isEditorFullscreen ? 'icon-zoom-screen' : 'icon-full-screen']" @click="onToggleEditorFullscreen"></i>
          <DragIcon />
        </div>
        <editor />
      </div>
    </ItemBlock>
    <ItemBlock
      v-show="showRight"
      block-name="right"
      :width="`calc(100% - ${currentWidth})`"
      :height="currentHeight"
      :has-border-left="showLeft"
      :has-border-bottom="showBottom"
    >
      <div class="three-column-block">
        <slot name="comGraph" />
      </div>
    </ItemBlock>
    <ItemBlock v-show="showBottom" block-name="bottom" :height="`calc(100% - ${currentHeight})`" :has-border-top="showLeft || showRight">
      <div class="three-column-block swim-block">
        <slot name="swimGraph" />
      </div>
    </ItemBlock>
    <div
      v-show="showHResizeBar"
      class="horizontal-resize-bar"
      :style="{ left: HResizeBarLeft, height: currentHeight }"
      @mousedown="onHResizeMousedown"
    ></div>
    <div v-show="showVResizeBar" class="vertical-resize-bar" :style="{ top: VResizeBarTop }" @mousedown="onVResizeMousedown"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import editor from './editor.vue';
import { ThreeColumnProvideKey } from './types';
import type { ILayoutInfo, BlockType, LayoutMode, IBlockToGraphMap } from './types';
import ItemBlock from './itemBlock.vue';
import ThreeColumnHeader from './threeColumnHeader.vue';
import DragIcon from './drag-icon.vue';

const { isDarkTheme } = inject('root');

const currentLayoutMode = ref<LayoutMode>('triangular');
const HResizeBarLeft = ref('');
const VResizeBarTop = ref('');
const currentWidth = ref('50%');
const currentHeight = ref('50%');
const resizing = ref(false);
const showLeft = ref(true);
const showRight = ref(true);
const showBottom = ref(true);
const containerEl = ref<HTMLElement>();
const isEditorFullscreen = ref(false);
const isComGraphFullscreen = ref(false);
const isSwimFullscreen = ref(false);
const currentActiveBlock = ref<BlockType>('');
const showHResizeBar = computed(() => showLeft.value && showRight.value);
const showVResizeBar = computed(() => (showLeft.value || showLeft.value) && showBottom.value);
const BlockToGraphMap: IBlockToGraphMap = {
  left: 'editor',
  right: 'comGraph',
  bottom: 'swimGraph',
};
let containerWidth = 0;
let containerHeight = 0;
let prevLayoutInfo: ILayoutInfo = {};

provide(ThreeColumnProvideKey, {
  resizing,
  currentLayoutMode,
  currentActiveBlock,
  isComGraphFullscreen,
  isSwimFullscreen,
  BlockToGraphMap,
  onToggleComGraphFullscreen,
  onToggleSwimFullscreen,
  emitSizeChange,
  resetLayout,
});

function zoomInLeft() {
  prevLayoutInfo = {
    showRight: showRight.value,
    showBottom: showBottom.value,
    currentWidth: currentWidth.value,
    currentHeight: currentHeight.value,
  };
  showRight.value = false;
  showBottom.value = false;
  currentWidth.value = '100%';
  currentHeight.value = '100%';
}
function resetLeft() {
  showRight.value = prevLayoutInfo.showRight;
  showBottom.value = prevLayoutInfo.showBottom;
  currentWidth.value = prevLayoutInfo.currentWidth;
  currentHeight.value = prevLayoutInfo.currentHeight;
}
function zoomInRight() {
  prevLayoutInfo = {
    showLeft: showLeft.value,
    showBottom: showBottom.value,
    currentWidth: currentWidth.value,
    currentHeight: currentHeight.value,
  };
  showLeft.value = false;
  showBottom.value = false;
  currentWidth.value = '0%';
  currentHeight.value = '100%';
}
function resetRight() {
  showLeft.value = prevLayoutInfo.showLeft;
  showBottom.value = prevLayoutInfo.showBottom;
  currentWidth.value = prevLayoutInfo.currentWidth;
  currentHeight.value = prevLayoutInfo.currentHeight;
}
function zoomInBottom() {
  prevLayoutInfo = {
    showLeft: showLeft.value,
    showRight: showRight.value,
    currentHeight: currentHeight.value,
  };
  showLeft.value = false;
  showRight.value = false;
  currentHeight.value = '0%';
}
function resetBottom() {
  showLeft.value = prevLayoutInfo.showLeft;
  showRight.value = prevLayoutInfo.showRight;
  currentHeight.value = prevLayoutInfo.currentHeight;
}
const ZoomInMap: Record<Exclude<BlockType, ''>, () => void> = {
  left: zoomInLeft,
  right: zoomInRight,
  bottom: zoomInBottom,
};
const ResetMap: Record<Exclude<BlockType, ''>, () => void> = {
  left: resetLeft,
  right: resetRight,
  bottom: resetBottom,
};
function toggleFullscreen(isFullscreen: boolean) {
  if (isFullscreen) {
    ResetMap[currentActiveBlock.value]();
  } else {
    ZoomInMap[currentActiveBlock.value]();
  }
}

function onToggleEditorFullscreen() {
  toggleFullscreen(isEditorFullscreen.value);
  isEditorFullscreen.value = !isEditorFullscreen.value;
  emitSizeChange();
}

function onToggleComGraphFullscreen() {
  toggleFullscreen(isComGraphFullscreen.value);
  isComGraphFullscreen.value = !isComGraphFullscreen.value;
  emitSizeChange();
}

function onToggleSwimFullscreen() {
  toggleFullscreen(isSwimFullscreen.value);
  isSwimFullscreen.value = !isSwimFullscreen.value;
  emitSizeChange();
}

function emitSizeChange() {
  (window as any).ascEventBus.emit('threeColumnSizeChange', {
    editorVisible: showLeft.value,
    comGraphVisible: showRight.value,
    swimVisible: showBottom.value,
  });
}

function onHMousemove(e: MouseEvent) {
  const percent = (Math.min(Math.max(e.pageX, 0), containerWidth - 2) / containerWidth) * 100;
  HResizeBarLeft.value = percent === 0 ? `calc(0%)` : `calc(${percent}% - 1px)`;
}

function onHMouseup(e: MouseEvent) {
  resizing.value = false;
  const finalWidth = Math.min(Math.max(e.pageX, 0), containerWidth);
  currentWidth.value = `${(finalWidth / containerWidth) * 100}%`;
  showLeft.value = finalWidth !== 0;
  showRight.value = finalWidth !== containerWidth - 1 && finalWidth !== containerWidth;
  document.removeEventListener('mousemove', onHMousemove);
  document.removeEventListener('mouseup', onHMouseup);
  emitSizeChange();
}

function onHResizeMousedown() {
  resizing.value = true;
  document.addEventListener('mousemove', onHMousemove);
  document.addEventListener('mouseup', onHMouseup);
}

function onVMousemove(e: MouseEvent) {
  const percent = (Math.min(Math.max(e.pageY - 40, 0), containerHeight - 2) / containerHeight) * 100;
  VResizeBarTop.value = percent === 0 ? `calc(0%)` : `calc(${percent}% - 1px)`;
}

function onVMouseup(e: MouseEvent) {
  resizing.value = false;
  const finalHeight = Math.min(Math.max(e.pageY - 40, 0), containerHeight);
  currentHeight.value = `${(finalHeight / containerHeight) * 100}%`;
  showLeft.value = finalHeight !== 0;
  showRight.value = finalHeight !== 0;
  showBottom.value = finalHeight !== containerHeight;
  document.removeEventListener('mousemove', onVMousemove);
  document.removeEventListener('mouseup', onVMouseup);
  emitSizeChange();
}

function onVResizeMousedown() {
  resizing.value = true;
  document.addEventListener('mousemove', onVMousemove);
  document.addEventListener('mouseup', onVMouseup);
}

function updateContainerRect() {
  if (containerEl.value) {
    const { width, height } = containerEl.value.getBoundingClientRect();
    containerWidth = width;
    containerHeight = height;
  }
}

function resetLayout() {
  if (isEditorFullscreen.value || isComGraphFullscreen.value || isSwimFullscreen.value) {
    return;
  }
  HResizeBarLeft.value = `calc(50% - 1px)`;
  VResizeBarTop.value = `calc(50% - 1px)`;
  currentWidth.value = '50%';
  currentHeight.value = '50%';
  showLeft.value = true;
  showRight.value = true;
  showBottom.value = true;
  emitSizeChange();
}

onMounted(() => {
  HResizeBarLeft.value = `calc(50% - 1px)`;
  VResizeBarTop.value = `calc(50% - 1px)`;
  updateContainerRect();
  window.addEventListener('resize', updateContainerRect);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateContainerRect);
});

provide('threeColumnState', { isDarkTheme });
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

  .horizontal-resize-bar {
    position: absolute;
    top: 0;
    z-index: 20;
    width: 2px;
    height: calc(50% - 1px);
    background-color: var(--devui-border-line-deep);

    &:hover {
      background-color: var(--devui-active-icon);
      cursor: col-resize;
    }
  }

  .vertical-resize-bar {
    position: absolute;
    left: 0;
    z-index: 20;
    width: 100%;
    height: 2px;
    background-color: var(--devui-border-line-deep);

    &:hover {
      background-color: var(--devui-active-icon);
      cursor: row-resize;
    }
  }

  &.triangular {
    flex-wrap: wrap;

    .three-column-block {
      width: 100%;
      height: 100%;
    }

    .editor-block {
      .sticky-block {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 15;
        display: none;
        align-items: center;
        justify-content: flex-end;
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

    & > .three-column-item {
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
}
</style>

<style lang="scss">
.three-column-design-tips {
  max-width: unset;
}
</style>
