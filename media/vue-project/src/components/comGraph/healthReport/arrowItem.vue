<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
