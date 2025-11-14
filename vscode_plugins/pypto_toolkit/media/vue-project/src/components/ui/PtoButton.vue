<script setup lang="ts">
import { Component } from 'vue';

defineProps<{
  type?: 'primary';
  icon?: Component;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <button :class="`pto-button ${type ? `pto-button--primary` : ''}`" @click="emit('click')">
    <div class="pto-button-inner">
      <icon class="pto-button-icon"></icon>
      <slot></slot>
    </div>
  </button>
</template>

<style lang="less" scoped>
// 默认，次要按钮
.pto-button {
  color: var(--pto-font-color-main);
  background-color: var(--pto-button-background);
  border-color: var(--pto-button-border-color);
  border-style: solid;
  border-width: 1px;
  height: 28px;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;

  .pto-button-inner {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;

    .pto-button-icon {
      width: 16px;
      height: 16px;
      margin-right: 4px;
      :deep(path) {
        fill: var(--pto-font-color-main);
        stroke: var(--pto-font-color-main);
      }
    }
  }

  & + .pto-button {
    margin-left: 20px;
  }
}

// 次要按钮悬浮
.pto-button:hover {
  color: var(--pto-font-color-title);
  background-color: var(--pto-button-background-hover);
  border-color: var(--pto-button-border-hover);
  .pto-button-inner {
    .pto-button-icon {
      :deep(path) {
        fill: var(--pto-font-color-title);
        stroke: var(--pto-font-color-title);
      }
    }
  }
}

// 主要按钮
.pto-button--primary {
  background-color: var(--pto-button-primary-background);

  &:hover {
    background-color: var(--pto-button-background-hover);
  }
}
</style>
