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
