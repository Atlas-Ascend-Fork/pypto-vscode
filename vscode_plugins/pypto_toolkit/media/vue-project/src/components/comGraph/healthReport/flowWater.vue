<template>
  <div :class="['flow-water', type]">
    <ArrowItem :type="arrowType" class="arrow" />
    <div class="title">{{ title }}</div>
    <div class="count">{{ count }}</div>
  </div>
</template>

<script setup lang="ts">
import { flowWaterProps } from './types';
import ArrowItem from './arrowItem.vue';

defineProps(flowWaterProps);
</script>

<style scoped lang="scss">
.flow-water {
  width: 88px;
  height: 63px;
  border-radius: 8px;
  padding: 6px 8px 4px;
  background-color: var(--devui-flow-water-bg);
  box-sizing: border-box;

  .arrow {
    :deep() {
      .arrow-line {
        background-color: var(--devui-status-warning);
      }
      .right-arrow {
        border-left-color: var(--devui-status-warning);
      }
      .left-arrow {
        border-right-color: var(--devui-status-warning);
      }
    }
  }

  .title {
    font-size: 12px;
    font-weight: 500;
    line-height: 14px;
    margin-top: 8px;
    margin-bottom: 2px;
  }
  .count {
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &.no-data {
    
    .title {
      color: var(--devui-status-warning);
      opacity: 0.3;
    }
    .count {
      color: var(--devui-status-warning);
      opacity: 0.3;
    }
    .arrow {
      opacity: 0.3;
    }
  }

  &.has-data,
  &.warning {
    .title,
    .count {
      color: var(--devui-status-warning);
    }
  }

  &.warning {
    position: relative;
    width: 88px;
    height: 63px;
    border: 2px solid var(--devui-pipe-warning-line);
    &::after {
      content: '';
      position: absolute;
      top: -4px;
      left: -4px;
      width: 88px;
      height: 63px;
      border-radius: 10px;
      border: 2px solid var(--devui-pipe-warning-line-weak);
    }
  }
}
</style>
