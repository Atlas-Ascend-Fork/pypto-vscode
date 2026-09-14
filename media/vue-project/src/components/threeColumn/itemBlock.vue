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
<template>
  <div
    ref="rootEl"
    :class="classes"
    :style="{ width, height }"
    @dragover.prevent
    @dragenter="onDragenter"
    @dragleave="onDragleave"
    @dragend="onDragend"
    @drop.prevent="onDrop"
    @click.capture="onMouseenter"
  >
    <slot />
    <div v-if="currentActiveBlock === blockName" class="active-border"></div>
    <div v-if="showDropArea" class="drop-area"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type PropType } from 'vue';
import type { BlockType, IThreeColumnCtx } from './types';
import { ThreeColumnProvideKey } from './types';

const props = defineProps({
  blockName: { type: String as PropType<BlockType>, default: '' },
  width: { type: String, default: '50%' },
  height: { type: String, default: '50%' },
  hasBorderRight: { type: Boolean, default: false },
  hasBorderLeft: { type: Boolean, default: false },
  hasBorderTop: { type: Boolean, default: false },
  hasBorderBottom: { type: Boolean, default: false },
  isFullscreen: { type: Boolean, default: false },
});

const { currentActiveBlock, resizing, BlockToGraphMap, dragStartBlock, emitSizeChange } = inject(ThreeColumnProvideKey) as IThreeColumnCtx;

const classes = computed(() => ({
  'three-column-item': true,
  [`three-column-item-${props.blockName}`]: Boolean(props.blockName),
  active: currentActiveBlock.value === props.blockName,
  'has-border-right': props.hasBorderRight,
  'has-border-left': props.hasBorderLeft,
  'has-border-top': props.hasBorderTop,
  'has-border-bottom': props.hasBorderBottom,
  'is-fullscreen': props.isFullscreen,
}));
const rootEl = ref<HTMLElement>();
const showDropArea = ref(false);

function onDragend() {
  const parentEl = rootEl.value.parentElement;
  showDropArea.value = false;
  dragStartBlock.value = '';
  if (parentEl) {
    const blockEls = parentEl.querySelectorAll('.three-column-block');
    blockEls.forEach((item) => {
      (item as HTMLElement).style.pointerEvents = '';
      const editorEl = item.querySelector('.editor-container');
      if (editorEl) {
        (editorEl as HTMLElement).style.pointerEvents = '';
      }
    });
  }
}

function onDragenter() {
  showDropArea.value = dragStartBlock.value !== props.blockName;
}

function onDragleave() {
  showDropArea.value = false;
}

function onDrop(e: DragEvent) {
  const transferData = e.dataTransfer.getData('threeColumnBlock');
  if (props.blockName === transferData) {
    return;
  }
  currentActiveBlock.value = props.blockName;
  const dropEl = document.querySelector(`.three-column-item-${props.blockName}`);
  const dragEl = document.querySelector(`.three-column-item-${transferData}`);
  if (dropEl && dragEl) {
    const dropChild = dropEl.querySelector('.three-column-block');
    const dragChild = dragEl.querySelector('.three-column-block');
    dropEl.appendChild(dragChild);
    dragEl.appendChild(dropChild);
    const tempDragGraph = BlockToGraphMap[transferData];
    BlockToGraphMap[transferData] = BlockToGraphMap[props.blockName];
    BlockToGraphMap[props.blockName] = tempDragGraph;
    emitSizeChange();
  }
}

function onMouseenter() {
  if (resizing.value) {
    return;
  }
  currentActiveBlock.value = props.blockName;
}
</script>

<style scoped lang="scss">
.three-column-item {
  position: relative;
  box-sizing: border-box;
  z-index: 1;

  &.is-fullscreen {
    position: absolute;
    inset: 0;
    z-index: 2;
    width: unset !important;
    height: unset !important;
  }

  &.active {
    .active-border {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 20;
      width: 100%;
      height: 100%;
      box-shadow: inset 0 0 0 2px rgba(49, 122, 247, 0.5);
      pointer-events: none;
    }
  }
  .drop-area {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 20;
    width: 100%;
    height: 100%;
    background-color: var(--devui-input-hover-bg);
    pointer-events: none;
  }
  &.has-border-left {
    border-left: 1px solid var(--devui-border-line-deep);
  }
  &.has-border-right {
    border-right: 1px solid var(--devui-border-line-deep);
  }
  &.has-border-top {
    border-top: 1px solid var(--devui-border-line-deep);
  }
  &.has-border-bottom {
    border-bottom: 1px solid var(--devui-border-line-deep);
  }
  &.three-column-item-bottom {
    flex-grow: 1;
  }
}
</style>
