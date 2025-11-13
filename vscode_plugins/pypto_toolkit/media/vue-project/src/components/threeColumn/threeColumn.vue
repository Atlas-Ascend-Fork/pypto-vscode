<template>
  <div class="three-column-header">
    <span class="title">{{ t('layout') }}</span>
    <div :class="['triangular', modelValue === 'triangular' && 'active']" @click="() => emits('update:modelValue', 'triangular')">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <d-tooltip :content="t('threeColumnTips')" position="bottom-start" overlay-class="three-column-design-tips">
      <div :class="['three-column', 'disabled', modelValue === 'threeColumn' && 'active']">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </d-tooltip>
    <d-button size="sm" @click="resetLayout">重置</d-button>
  </div>
  <div ref="containerEl" :class="['three-column-content', modelValue, resizing && 'resizing']">
    <div
      v-show="showLeft"
      :class="['editor-block', 'three-column-item', showRight && 'has-right', showBottom && 'has-bottom']"
      :style="{ width: currentWidth, height: currentHeight }"
    >
      <div class="sticky-block">
        <i :class="[isEditorFullscreen ? 'icon-zoom-screen' : 'icon-full-screen']" @click="onToggleEditorFullscreen"></i>
      </div>
      <editor />
    </div>
    <div
      v-show="showRight"
      :class="['three-column-item', showLeft && 'has-left', showBottom && 'has-bottom']"
      :style="{ width: `calc(100% - ${currentWidth})`, height: currentHeight }"
    >
      <slot name="comGraph" />
    </div>
    <div
      v-show="showBottom"
      :class="['three-column-item', (showLeft || showRight) && 'has-top']"
      :style="{ height: `calc(100% - ${currentHeight})` }"
    >
      <slot name="swimGraph" />
    </div>
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
import { inject, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import type { PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import editor from './editor.vue';
import { ThreeColumnProvideKey } from './types';
import type { ILayoutInfo } from './types';

const { isDarkTheme } = inject('root');

defineProps({
  modelValue: {
    type: String as PropType<'triangular' | 'threeColumn'>,
    default: 'triangular',
  },
});
const emits = defineEmits(['update:modelValue']);

const { t } = useI18n();
const HResizeBarLeft = ref('');
const VResizeBarTop = ref('');
const currentWidth = ref('50%');
const currentHeight = ref('50%');
const resizing = ref(false);
const showLeft = ref(true);
const showRight = ref(true);
const showBottom = ref(true);
const showHResizeBar = ref(true);
const showVResizeBar = ref(true);
const containerEl = ref<HTMLElement>();
const isEditorFullscreen = ref(false);
const isComGraphFullscreen = ref(false);
const isSwimFullscreen = ref(false);
let containerWidth = 0;
let containerHeight = 0;
let prevLayoutInfo: ILayoutInfo = {};

provide(ThreeColumnProvideKey, { isComGraphFullscreen, isSwimFullscreen, onToggleComGraphFullscreen, onToggleSwimFullscreen });

function onToggleEditorFullscreen() {
  if (isEditorFullscreen.value) {
    showRight.value = prevLayoutInfo.showRight;
    showBottom.value = prevLayoutInfo.showBottom;
    showHResizeBar.value = prevLayoutInfo.showHResizeBar;
    showVResizeBar.value = prevLayoutInfo.showVResizeBar;
    currentWidth.value = prevLayoutInfo.currentWidth;
    currentHeight.value = prevLayoutInfo.currentHeight;
  } else {
    prevLayoutInfo = {
      showRight: showRight.value,
      showBottom: showBottom.value,
      showHResizeBar: showHResizeBar.value,
      showVResizeBar: showVResizeBar.value,
      currentWidth: currentWidth.value,
      currentHeight: currentHeight.value,
    };
    showRight.value = false;
    showBottom.value = false;
    showHResizeBar.value = false;
    showVResizeBar.value = false;
    currentWidth.value = '100%';
    currentHeight.value = '100%';
  }
  isEditorFullscreen.value = !isEditorFullscreen.value;
  (window as any).ascEventBus.emit('threeColumnHeightChange');
}

function onToggleComGraphFullscreen() {
  if (isComGraphFullscreen.value) {
    showLeft.value = prevLayoutInfo.showLeft;
    showBottom.value = prevLayoutInfo.showBottom;
    showHResizeBar.value = prevLayoutInfo.showHResizeBar;
    showVResizeBar.value = prevLayoutInfo.showVResizeBar;
    currentWidth.value = prevLayoutInfo.currentWidth;
    currentHeight.value = prevLayoutInfo.currentHeight;
  } else {
    prevLayoutInfo = {
      showLeft: showLeft.value,
      showBottom: showBottom.value,
      showHResizeBar: showHResizeBar.value,
      showVResizeBar: showVResizeBar.value,
      currentWidth: currentWidth.value,
      currentHeight: currentHeight.value,
    };
    showLeft.value = false;
    showBottom.value = false;
    showHResizeBar.value = false;
    showVResizeBar.value = false;
    currentWidth.value = '0%';
    currentHeight.value = '100%';
  }
  isComGraphFullscreen.value = !isComGraphFullscreen.value;
  (window as any).ascEventBus.emit('threeColumnHeightChange');
}

function onToggleSwimFullscreen() {
  if (isSwimFullscreen.value) {
    showLeft.value = prevLayoutInfo.showLeft;
    showRight.value = prevLayoutInfo.showRight;
    showHResizeBar.value = prevLayoutInfo.showHResizeBar;
    showVResizeBar.value = prevLayoutInfo.showVResizeBar;
    currentHeight.value = prevLayoutInfo.currentHeight;
  } else {
    prevLayoutInfo = {
      showLeft: showLeft.value,
      showRight: showRight.value,
      showHResizeBar: showHResizeBar.value,
      showVResizeBar: showVResizeBar.value,
      currentHeight: currentHeight.value,
    };
    showLeft.value = false;
    showRight.value = false;
    showHResizeBar.value = false;
    showVResizeBar.value = false;
    currentHeight.value = '0%';
  }
  isSwimFullscreen.value = !isSwimFullscreen.value;
  (window as any).ascEventBus.emit('threeColumnHeightChange');
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
  showHResizeBar.value = showLeft.value && showRight.value;
  document.removeEventListener('mousemove', onHMousemove);
  document.removeEventListener('mouseup', onHMouseup);
}

function onHResizeMousedown(e: MouseEvent) {
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
  showVResizeBar.value = (showLeft.value || showRight.value) && showBottom.value;
  document.removeEventListener('mousemove', onVMousemove);
  document.removeEventListener('mouseup', onVMouseup);
  (window as any).ascEventBus.emit('threeColumnHeightChange');
}

function onVResizeMousedown(e: MouseEvent) {
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
  if (isEditorFullscreen.value || isComGraphFullscreen.value) {
    return;
  }
  HResizeBarLeft.value = `calc(50% - 1px)`;
  VResizeBarTop.value = `calc(50% - 1px)`;
  currentWidth.value = '50%';
  currentHeight.value = '50%';
  showLeft.value = true;
  showRight.value = true;
  showBottom.value = true;
  (window as any).ascEventBus.emit('threeColumnHeightChange');
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
.three-column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 40px;
  padding: 10px;
  border-bottom: 1px solid var(--devui-split-line);
  background-color: var(--devui-page-bg);
  box-sizing: border-box;

  .title {
    font-size: 14px;
    line-height: 20px;
    color: var(--devui-title-text);
  }

  .triangular,
  .three-column {
    display: flex;
    gap: 1px;
    width: 24px;
    height: 18px;
    padding: 2px;
    border-radius: 4px;
    border: 1px solid var(--devui-placeholder-text);
    box-sizing: border-box;
    cursor: pointer;

    span {
      border-radius: 1px;
      background-color: var(--devui-placeholder-text);
    }

    &.active {
      border-color: var(--devui-active-icon);
      span {
        background-color: var(--devui-active-icon);
      }
    }
  }

  .triangular {
    flex-wrap: wrap;

    span {
      width: calc(50% - 0.5px);
    }
    span:nth-of-type(3) {
      flex-grow: 1;
    }
  }

  .three-column {
    &.disabled {
      border-color: var(--devui-disabled-icon);
      cursor: not-allowed;

      span {
        background-color: var(--devui-disabled-icon);
      }
    }

    span {
      flex: 1;
    }
  }
}

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
    z-index: 10;
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
    z-index: 10;
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

    .editor-block {
      &:hover {
        .sticky-block {
          display: flex;
        }
      }

      .sticky-block {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 100;
        display: none;
        align-items: center;
        justify-content: flex-end;
        width: 100%;
        height: 40px;
        padding: 4px 16px;
        border-bottom: 1px solid var(--devui-split-line);
        background-color: var(--devui-card-bg);
        box-sizing: border-box;

        i {
          font-size: 14px;
          cursor: pointer;
        }
      }
    }

    & > .three-column-item {
      position: relative;
      width: 50%;
      height: 50%;
      box-sizing: border-box;

      &.has-left {
        border-left: 1px solid var(--devui-border-line-deep);
      }
      &.has-right {
        border-right: 1px solid var(--devui-border-line-deep);
      }
      &.has-top {
        border-top: 1px solid var(--devui-border-line-deep);
      }
      &.has-bottom {
        border-bottom: 1px solid var(--devui-border-line-deep);
      }
    }
    & > .three-column-item:nth-of-type(3) {
      flex-grow: 1;
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

  & > .three-column-item:nth-of-type(3) {
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
