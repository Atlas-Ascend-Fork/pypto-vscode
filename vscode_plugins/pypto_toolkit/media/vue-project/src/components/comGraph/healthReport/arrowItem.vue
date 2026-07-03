<template>
  <div :class="['arrow-item', direction]">
    <div v-if="type === 'left' || type === 'both'" class="left-arrow"></div>
    <div class="arrow-line"></div>
    <div v-if="type === 'right' || type === 'both'" class="right-arrow"></div>
  </div>
</template>

<script setup lang="ts">
import { arrowItemProps } from './types';

defineProps(arrowItemProps);
</script>

<style scoped lang="scss">
.arrow-item {
  display: flex;
  align-items: center;
  width: 16px;
  .left-arrow {
    width: 0;
    height: 0;
    border-right: 5px solid var(--devui-icon);
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
  }
  .arrow-line {
    flex: 1;
    height: 2px;
    background-color: var(--devui-icon);
  }
  .right-arrow {
    width: 0;
    height: 0;
    border-left: 5px solid var(--devui-icon);
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
  }

  &.vertical {
    transform: rotate(90deg);
  }
}
</style>
