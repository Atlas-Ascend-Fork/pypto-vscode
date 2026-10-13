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
