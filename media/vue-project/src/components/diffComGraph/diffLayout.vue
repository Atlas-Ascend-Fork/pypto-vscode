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
  <div class="diff-layout-container">
    <span class="title">{{ t('layout') }}</span>
    <div :class="['diff-layout-horizontal-icon', layout === 'horizontal' && 'active']" @click="() => emits('layout-change', 'horizontal')">
      <span></span>
      <span></span>
    </div>
    <div :class="['diff-layout-vertical-icon', layout === 'vertical' && 'active']" @click="() => emits('layout-change', 'vertical')">
      <span></span>
      <span></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TDiffLayout } from './type';

defineProps({
  layout: {
    type: String as PropType<TDiffLayout>,
    default: 'horizontal',
  },
});
const emits = defineEmits(['layout-change']);

const { t } = useI18n();
</script>

<style scoped lang="scss">
.diff-layout-container {
  display: flex;
  align-items: center;
  gap: 8px;

  .title {
    font-size: 13px;
    line-height: 16px;
    color: var(--devui-text);
  }

  .diff-layout-horizontal-icon,
  .diff-layout-vertical-icon {
    display: flex;
    gap: 1px;
    width: 24px;
    height: 18px;
    padding: 2px;
    border-radius: 4px;
    border: 1px solid var(--devui-placeholder-text);
    box-sizing: border-box;
    cursor: pointer;

    span {
      flex: 1;
      border-radius: 1px;
      background-color: var(--devui-placeholder-text);
    }

    &.active {
      border-color: var(--devui-active-icon);
      span {
        background-color: var(--devui-active-icon);
      }
    }
  }

  .diff-layout-horizontal-icon {
    flex-direction: row;
  }

  .diff-layout-vertical-icon {
    flex-direction: column;
  }
}
</style>
