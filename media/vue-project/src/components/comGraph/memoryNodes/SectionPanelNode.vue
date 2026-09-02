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
  <div class="section-panel" :style="panelStyle">
    <div class="section-title">{{ data.title }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface PanelData {
  title: string;
  width?: number;
  height?: number;
  radius?: number;
  bg?: string;
  borderColor?: string;
}

const props = defineProps<{ data: PanelData }>();

const panelStyle = computed(() => ({
  width: `${props.data.width || 1040}px`,
  height: `${props.data.height || 180}px`,
  borderRadius: `${props.data.radius || 10}px`,
  background: props.data.bg || 'rgba(7, 7, 7, 0.92)',
  border: `1px solid ${props.data.borderColor || 'rgba(255, 255, 255, 0.08)'}`,
}));
</script>

<style scoped>
.section-panel {
  position: relative;
  box-sizing: border-box;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 12px 30px rgba(0, 0, 0, 0.2);
}

.section-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.section-title {
  position: absolute;
  top: 10px;
  left: 14px;
  color: #f5f5f5;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
</style>