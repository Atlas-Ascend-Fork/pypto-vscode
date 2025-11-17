<template>
  <div ref="dragEl" class="three-column-drag-icon" draggable="true" @dragstart="onDragstart">
    <i class="icon-drag"></i>
    <i class="icon-drag"></i>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

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
  e.dataTransfer.setData('threeColumnBlock', getCurrentBlock());
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
