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
