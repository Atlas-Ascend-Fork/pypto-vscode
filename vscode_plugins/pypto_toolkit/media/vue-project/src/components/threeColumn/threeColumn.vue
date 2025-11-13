<template>
  <div class="three-column-header">
    <div class="three-column-header-left">
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
    </div>
    <div>
      <d-tooltip :content="t('reset')" position="bottom-end">
        <i class="icon-reset" @click="resetLayout"></i>
      </d-tooltip>
    </div>
  </div>
  <div ref="containerEl" :class="['three-column-content', modelValue, resizing && 'resizing']">
    <div
      v-show="showEditor"
      :class="[
        'editor-block',
        'three-column-item',
        currentActive === 'editor' && 'active',
        showComGraph && 'has-right',
        showSwim && 'has-bottom',
      ]"
      :style="{ width: currentWidth, height: currentHeight }"
      @mouseenter="() => (currentActive = 'editor')"
    >
      <div class="sticky-block">
        <i :class="[isEditorFullscreen ? 'icon-zoom-screen' : 'icon-full-screen']" @click="onToggleEditorFullscreen"></i>
      </div>
      <editor />
      <div v-if="currentActive === 'editor'" class="active-border"></div>
    </div>
    <div
      v-show="showComGraph"
      :class="['three-column-item', currentActive === 'comGraph' && 'active', showEditor && 'has-left', showSwim && 'has-bottom']"
      :style="{ width: `calc(100% - ${currentWidth})`, height: currentHeight }"
      @mouseenter="() => (currentActive = 'comGraph')"
    >
      <slot name="comGraph" />
      <div v-if="currentActive === 'comGraph'" class="active-border"></div>
    </div>
    <div
      v-show="showSwim"
      :class="['three-column-item', currentActive === 'swim' && 'active', (showEditor || showComGraph) && 'has-top']"
      :style="{ height: `calc(100% - ${currentHeight})` }"
      @mouseenter="() => (currentActive = 'swim')"
    >
      <slot name="swimGraph" />
      <div v-if="currentActive === 'swim'" class="active-border"></div>
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
import type { ILayoutInfo, ActiveType } from './types';

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
const showEditor = ref(true);
const showComGraph = ref(true);
const showSwim = ref(true);
const showHResizeBar = ref(true);
const showVResizeBar = ref(true);
const containerEl = ref<HTMLElement>();
const isEditorFullscreen = ref(false);
const isComGraphFullscreen = ref(false);
const isSwimFullscreen = ref(false);
const currentActive = ref<ActiveType>('');
let containerWidth = 0;
let containerHeight = 0;
let prevLayoutInfo: ILayoutInfo = {};

provide(ThreeColumnProvideKey, {
  currentActive,
  isComGraphFullscreen,
  isSwimFullscreen,
  onToggleComGraphFullscreen,
  onToggleSwimFullscreen,
});

function onToggleEditorFullscreen() {
  if (isEditorFullscreen.value) {
    showComGraph.value = prevLayoutInfo.showComGraph;
    showSwim.value = prevLayoutInfo.showSwim;
    showHResizeBar.value = prevLayoutInfo.showHResizeBar;
    showVResizeBar.value = prevLayoutInfo.showVResizeBar;
    currentWidth.value = prevLayoutInfo.currentWidth;
    currentHeight.value = prevLayoutInfo.currentHeight;
  } else {
    prevLayoutInfo = {
      showComGraph: showComGraph.value,
      showSwim: showSwim.value,
      showHResizeBar: showHResizeBar.value,
      showVResizeBar: showVResizeBar.value,
      currentWidth: currentWidth.value,
      currentHeight: currentHeight.value,
    };
    showComGraph.value = false;
    showSwim.value = false;
    showHResizeBar.value = false;
    showVResizeBar.value = false;
    currentWidth.value = '100%';
    currentHeight.value = '100%';
  }
  isEditorFullscreen.value = !isEditorFullscreen.value;
  (window as any).ascEventBus.emit('threeColumnSizeChange', {
    editorVisible: showEditor.value,
    comGraphVisible: showComGraph.value,
    swimVisible: showSwim.value,
  });
}

function onToggleComGraphFullscreen() {
  if (isComGraphFullscreen.value) {
    showEditor.value = prevLayoutInfo.showEditor;
    showSwim.value = prevLayoutInfo.showSwim;
    showHResizeBar.value = prevLayoutInfo.showHResizeBar;
    showVResizeBar.value = prevLayoutInfo.showVResizeBar;
    currentWidth.value = prevLayoutInfo.currentWidth;
    currentHeight.value = prevLayoutInfo.currentHeight;
  } else {
    prevLayoutInfo = {
      showEditor: showEditor.value,
      showSwim: showSwim.value,
      showHResizeBar: showHResizeBar.value,
      showVResizeBar: showVResizeBar.value,
      currentWidth: currentWidth.value,
      currentHeight: currentHeight.value,
    };
    showEditor.value = false;
    showSwim.value = false;
    showHResizeBar.value = false;
    showVResizeBar.value = false;
    currentWidth.value = '0%';
    currentHeight.value = '100%';
  }
  isComGraphFullscreen.value = !isComGraphFullscreen.value;
  (window as any).ascEventBus.emit('threeColumnSizeChange', {
    editorVisible: showEditor.value,
    comGraphVisible: showComGraph.value,
    swimVisible: showSwim.value,
  });
}

function onToggleSwimFullscreen() {
  if (isSwimFullscreen.value) {
    showEditor.value = prevLayoutInfo.showEditor;
    showComGraph.value = prevLayoutInfo.showComGraph;
    showHResizeBar.value = prevLayoutInfo.showHResizeBar;
    showVResizeBar.value = prevLayoutInfo.showVResizeBar;
    currentHeight.value = prevLayoutInfo.currentHeight;
  } else {
    prevLayoutInfo = {
      showEditor: showEditor.value,
      showComGraph: showComGraph.value,
      showHResizeBar: showHResizeBar.value,
      showVResizeBar: showVResizeBar.value,
      currentHeight: currentHeight.value,
    };
    showEditor.value = false;
    showComGraph.value = false;
    showHResizeBar.value = false;
    showVResizeBar.value = false;
    currentHeight.value = '0%';
  }
  isSwimFullscreen.value = !isSwimFullscreen.value;
  (window as any).ascEventBus.emit('threeColumnSizeChange', {
    editorVisible: showEditor.value,
    comGraphVisible: showComGraph.value,
    swimVisible: showSwim.value,
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
  showEditor.value = finalWidth !== 0;
  showComGraph.value = finalWidth !== containerWidth - 1 && finalWidth !== containerWidth;
  showHResizeBar.value = showEditor.value && showComGraph.value;
  document.removeEventListener('mousemove', onHMousemove);
  document.removeEventListener('mouseup', onHMouseup);
  (window as any).ascEventBus.emit('threeColumnSizeChange', {
    editorVisible: showEditor.value,
    comGraphVisible: showComGraph.value,
    swimVisible: showSwim.value,
  });
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
  showEditor.value = finalHeight !== 0;
  showComGraph.value = finalHeight !== 0;
  showSwim.value = finalHeight !== containerHeight;
  showVResizeBar.value = (showEditor.value || showComGraph.value) && showSwim.value;
  document.removeEventListener('mousemove', onVMousemove);
  document.removeEventListener('mouseup', onVMouseup);
  (window as any).ascEventBus.emit('threeColumnSizeChange', {
    editorVisible: showEditor.value,
    comGraphVisible: showComGraph.value,
    swimVisible: showSwim.value,
  });
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
  showEditor.value = true;
  showComGraph.value = true;
  showSwim.value = true;
  (window as any).ascEventBus.emit('threeColumnSizeChange', {
    editorVisible: showEditor.value,
    comGraphVisible: showComGraph.value,
    swimVisible: showSwim.value,
  });
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
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 40px;
  padding: 10px;
  border-bottom: 1px solid var(--devui-split-line);
  background-color: var(--devui-page-bg);
  box-sizing: border-box;

  .three-column-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon-reset {
    font-size: 14px;
    cursor: pointer;
  }

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

      &.active {
        .sticky-block {
          display: flex;
        }
        .active-border {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 20;
          width: 100%;
          height: 100%;
          box-shadow: inset 0 0 0 2px var(--devui-active-icon);
          pointer-events: none;
        }
      }

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
