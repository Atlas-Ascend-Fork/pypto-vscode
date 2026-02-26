<template>
  <ThreeColumnHeader />
  <div ref="containerEl" :class="['three-column-content', currentLayoutMode, resizing && 'resizing']" :style="{width: sharedSwimData.performanceVisible ? `calc(100% - ${sharedSwimData.performanceWidth}px)` : '100%' }">
    <ItemBlock
      block-name="left"
      :width="currentWidth"
      :height="currentHeight"
      :has-border-right="showRight"
      :has-border-bottom="showBottom"
      :is-fullscreen="currentFullscreenBlock === 'left'"
    >
      <div class="three-column-block editor-block">
        <div class="sticky-block">
          <fileSelect  :file-name="editorFileName" />
          <DragIcon />
          <i :class="[isEditorFullscreen ? 'icon-zoom-screen' : 'icon-full-screen']" @click="onToggleEditorFullscreen"></i>
        </div>
        <editor  ref="editorRef"/>
      </div>
    </ItemBlock>
    <ItemBlock
      block-name="right"
      :width="`calc(100% - ${currentWidth})`"
      :height="currentHeight"
      :has-border-left="showLeft"
      :has-border-bottom="showBottom"
      :is-fullscreen="currentFullscreenBlock === 'right'"
    >
      <div class="three-column-block">
        <slot name="comGraph" />
      </div>
    </ItemBlock>
    <ItemBlock
      block-name="bottom"
      :height="`calc(100% - ${currentHeight})`"
      :has-border-top="showLeft || showRight"
      :is-fullscreen="currentFullscreenBlock === 'bottom'"
    >
      <div class="three-column-block swim-block">
        <slot name="swimGraph" />
      </div>
    </ItemBlock>
    <div
      v-show="showHResizeBar"
      class="horizontal-resize-bar"
      :style="{ left: HResizeBarLeft, height: currentHeight, '--offset': HResizeBarOffset }"
      @mousedown="onHResizeMousedown"
      @mouseover="() => (HResizeBarOffset = '2px')"
      @mouseleave="() => (HResizeBarOffset = '1px')"
    ></div>
    <div
      v-show="showVResizeBar"
      class="vertical-resize-bar"
      :style="{ top: VResizeBarTop, '--offset': VResizeBarOffset }"
      @mousedown="onVResizeMousedown"
      @mouseover="() => (VResizeBarOffset = '2px')"
      @mouseleave="() => (VResizeBarOffset = '1px')"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, provide, ref, toRef } from 'vue';
import type { Ref } from 'vue';
import editor from './editor.vue';
import { ThreeColumnProvideKey } from './types';
import type { ILayoutInfo, BlockType, LayoutMode, IBlockToGraphMap, IShowBlockMap } from './types';
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
const HResizeBarLeft = ref('');
const VResizeBarTop = ref('');
const editorFileName = ref('');
const editorRef = ref();
const HResizeBarOffset = ref('1px');
const VResizeBarOffset = ref('1px');
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
const currentFullscreenBlock = ref<BlockType>('');
const dragStartBlock = ref<BlockType>('');
const showHResizeBar = computed(() => showLeft.value && showRight.value);
const showVResizeBar = computed(() => (showLeft.value || showLeft.value) && showBottom.value);
const props = defineProps({
  sharedSwimData: {
    type: Object,
  }
});
const sharedSwimData = toRef(props, 'sharedSwimData');
const BlockToGraphMap: IBlockToGraphMap = {
  left: 'editor',
  right: 'comGraph',
  bottom: 'swimGraph',
};
const ShowBlockMap: IShowBlockMap = {
  left: showLeft,
  right: showRight,
  bottom: showBottom,
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
  dragStartBlock,
  onToggleComGraphFullscreen,
  onToggleSwimFullscreen,
  emitSizeChange,
  resetLayout,
});

function zoomInLeft() {
  prevLayoutInfo = {
    showRight: showRight.value,
    showBottom: showBottom.value,
  };
  showRight.value = false;
  showBottom.value = false;
}
function resetLeft() {
  showRight.value = prevLayoutInfo.showRight;
  showBottom.value = prevLayoutInfo.showBottom;
}
function zoomInRight() {
  prevLayoutInfo = {
    showLeft: showLeft.value,
    showBottom: showBottom.value,
  };
  showLeft.value = false;
  showBottom.value = false;
}
function resetRight() {
  showLeft.value = prevLayoutInfo.showLeft;
  showBottom.value = prevLayoutInfo.showBottom;
}
function zoomInBottom() {
  prevLayoutInfo = {
    showLeft: showLeft.value,
    showRight: showRight.value,
  };
  showLeft.value = false;
  showRight.value = false;
}
function resetBottom() {
  showLeft.value = prevLayoutInfo.showLeft;
  showRight.value = prevLayoutInfo.showRight;
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
    currentFullscreenBlock.value = '';
  } else {
    ZoomInMap[currentActiveBlock.value]();
    currentFullscreenBlock.value = currentActiveBlock.value;
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
    editorVisible: ShowBlockMap[findKeyByValue(BlockToGraphMap, 'editor')].value,
    comGraphVisible: ShowBlockMap[findKeyByValue(BlockToGraphMap, 'comGraph')].value,
    swimVisible: ShowBlockMap[findKeyByValue(BlockToGraphMap, 'swimGraph')].value,
  });
}

function onHMousemove(e: MouseEvent) {
  const percent = (Math.min(Math.max(e.pageX, 0), containerWidth - 2) / containerWidth) * 100;
  HResizeBarLeft.value = percent === 0 ? `calc(0%)` : `calc(${percent}% - var(--offset))`;
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
  VResizeBarTop.value = percent === 0 ? `calc(0%)` : `calc(${percent}% - var(--offset))`;
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
  HResizeBarLeft.value = `calc(50% - var(--offset))`;
  VResizeBarTop.value = `calc(50% - var(--offset))`;
  currentWidth.value = '50%';
  currentHeight.value = '50%';
  showLeft.value = true;
  showRight.value = true;
  showBottom.value = true;
  emitSizeChange();
}
onMounted(() => {
  HResizeBarLeft.value = `calc(50% - var(--offset))`;
  VResizeBarTop.value = `calc(50% - var(--offset))`;
  updateContainerRect();
  window.addEventListener('resize', updateContainerRect);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateContainerRect);
});

provide('threeColumnState', { isDarkTheme, editorFileName });
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
      width: 4px;
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
      height: 4px;
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
