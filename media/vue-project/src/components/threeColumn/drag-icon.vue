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
  <div ref="dragEl" class="three-column-drag-icon" draggable="true" @dragstart="onDragstart">
    <i class="icon-drag"></i>
    <i class="icon-drag"></i>
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from 'vue';
import type { IThreeColumnCtx, BlockType } from './types';
import { ThreeColumnProvideKey } from './types';

const { dragStartBlock } = inject(ThreeColumnProvideKey) as IThreeColumnCtx;
const dragEl = ref<HTMLElement>();

function getCurrentBlock() {
  let parentEl = dragEl.value;
  while (parentEl) {
    if (parentEl === document.body) {
      return '';
    }
    if (parentEl.classList?.contains('three-column-item')) {
      return Array.from(parentEl.classList)
        .find((item) => item.startsWith('three-column-item-'))
        .split('three-column-item-')[1];
    }
    parentEl = parentEl.parentElement;
  }
}
function onDragstart(e: DragEvent) {
  const blockName = getCurrentBlock() as BlockType;
  e.dataTransfer.setData('threeColumnBlock', blockName);
  dragStartBlock.value = blockName;
  const contentEl = document.querySelector('.three-column-content');
  if (contentEl) {
    const editorEl = contentEl.querySelector(`.three-column-item.three-column-item-${blockName} .editor-container`);
    if (editorEl) {
      (editorEl as HTMLElement).style.pointerEvents = 'none';
    }
    const itemEls = contentEl.querySelectorAll(`.three-column-item:not(.three-column-item-${blockName})`);
    itemEls.forEach((item) => {
      const blockEl = item.querySelector('.three-column-block');
      (blockEl as HTMLElement).style.pointerEvents = 'none';
    });
  }
}
</script>

<style scoped lang="scss">
.three-column-drag-icon {
  display: flex;
  align-items: center;
  width: 28px;
  height: 14px;
  color: var(--devui-overlay-icon);
  cursor: move;

  i {
    font-size: 14px;
    transform: rotate(90deg);
    cursor: move;

    &:nth-of-type(2) {
      margin-left: -1px;
    }
  }
}
</style>
