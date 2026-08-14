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
  <div class="view-mode-switch" role="group" aria-label="Detail view">
    <d-tooltip :content="$t('chartView')" position="bottom">
      <button
        class="view-mode-btn"
        :class="{ active: modelValue === 'chart' }"
        type="button"
        aria-label="Chart view"
        :aria-pressed="modelValue === 'chart'"
        @click="$emit('update:modelValue', 'chart')"
      >
        <svg class="view-mode-icon chart-view-icon" viewBox="0 0 20 20" aria-hidden="true">
          <rect
            x="2"
            y="2"
            width="6"
            height="6"
            rx="1"
          />
          <rect
            x="12"
            y="2"
            width="6"
            height="6"
            rx="1"
          />
          <rect
            x="2"
            y="12"
            width="6"
            height="6"
            rx="1"
          />
          <rect
            x="12"
            y="12"
            width="6"
            height="6"
            rx="1"
          />
        </svg>
      </button>
    </d-tooltip>
    <d-tooltip :content="$t('listView')" position="bottom">
      <button
        class="view-mode-btn"
        :class="{ active: modelValue === 'table' }"
        type="button"
        aria-label="Table view"
        :aria-pressed="modelValue === 'table'"
        @click="$emit('update:modelValue', 'table')"
      >
        <svg class="view-mode-icon list-view-icon" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M7.5 4.5h10M7.5 10h10M7.5 15.5h10" />
          <path d="M2.5 4.5h.01M2.5 10h.01M2.5 15.5h.01" />
        </svg>
      </button>
    </d-tooltip>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true },
});

defineEmits(['update:modelValue']);
</script>

<style scoped src="./memoryDetailViewToggle.scss" lang="scss"></style>
