<template>
  <div :class="['calc-unit', type]" :style="{ '--calc-unit-width': width + 'px', '--calc-unit-height': height + 'px' }">
    <div class="content">
      <div class="title">{{ title }}</div>
      <div class="count">{{ count }}</div>
    </div>
    <div class="badge">{{ badgeText }}</div>
  </div>
</template>

<script setup lang="ts">
import { calcUnitProps } from './types';

defineProps(calcUnitProps);
</script>

<style scoped lang="scss">
.calc-unit {
  position: relative;
  width: var(--calc-unit-width);
  height: var(--calc-unit-height);
  border: 2px solid var(--devui-split-line-deep);
  border-radius: 8px;
  background-color: var(--devui-card-bg);
  box-sizing: border-box;

  .content {
    width: 100%;
    padding-top: 22px;
    padding-left: 8px;
    box-sizing: border-box;

    .title {
      margin-bottom: 2px;
      font-size: 12px;
      line-height: 14px;
    }

    .count {
      font-size: 16px;
      font-weight: 600;
      line-height: 20px;
    }
  }

  .badge {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 2;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
    line-height: 15px;
    padding: 4px 10px;
    border-top-left-radius: 6px;
    border-bottom-right-radius: 8px;
  }

  &.no-data {
    .title {
      color: var(--devui-secondary-text-weak);
    }
    .count {
      color: var(--devui-primary-text-weak);
    }

    .badge {
      color: var(--devui-status-success);
      background-color: var(--devui-status-success-bg-weak);
      opacity: 0.3;
    }
  }

  &.has-data,
  &.warning {
    .title,
    .count {
      color: var(--devui-status-success);
    }

    .badge {
      color: var(--devui-status-success);
      background-color: var(--devui-status-success-bg-weak);
    }
  }

  &.warning {
    position: relative;
    width: var(--calc-unit-width);
    height: var(--calc-unit-height);
    border: 2px solid var(--devui-pipe-warning-line);
    &::after {
      content: '';
      position: absolute;
      top: -4px;
      left: -4px;
      width: var(--calc-unit-width);
      height: var(--calc-unit-height);
      border-radius: 10px;
      border: 2px solid var(--devui-pipe-warning-line-weak);
    }
  }
}
</style>
