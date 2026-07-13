<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
<script setup lang="ts">
import { Component } from 'vue';

defineProps<{
  type?: 'primary' | 'text';
  icon?: Component;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <button :class="`pto-button ${type ? `pto-button--${type}` : ''}`" @click="emit('click')">
    <div class="pto-button-inner">
      <icon v-if="icon" class="pto-button-icon"></icon>
      <slot></slot>
    </div>
  </button>
</template>

<style lang="less" scoped>
// 默认，次要按钮
.pto-button {
  color: var(--pto-font-color-title);
  background-color: var(--pto-button-background);
  border: none;
  height: 28px;
  min-width: 74px;
  border-radius: 8px;
  padding: 4px 8px;
  cursor: pointer;

  .pto-button-inner {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;

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

  // 悬浮
  &:hover {
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

  & + .pto-button {
    margin-left: 16px;
  }

  // 主要按钮
  &--primary {
    background-color: var(--pto-button-primary-background);
    border-color: var(--pto-button-primary-background);
    color: var(--pto-button-primary-font-color);

    &:hover {
      background-color: var(--pto-button-primary-background-hover);
      border-color: var(--pto-button-primary-background-hover);
      color: var(--pto-button-primary-font-color);
    }
  }

  // 文本按钮
  &--text {
    background-color: transparent;
    border-color: transparent;
    color: var(--pto-font-color-link);

    &:hover {
      background-color: transparent;
      border-color: transparent;
      color: var(--pto-font-color-link-hover);
    }
  }
}
</style>
