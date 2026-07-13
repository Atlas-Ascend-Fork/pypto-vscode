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
  <div class="limit-info">
    <img :src="iconPath" alt="" />
    <span class="label">{{ label }}：</span>
    <span class="value">{{ value }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { limitInfoProps } from './types';

const props = defineProps(limitInfoProps);

const iconPath = computed(() => `${(window as any).staticPath}/static-assets/com-graph/${props.type}.svg`);
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.limit-info {
  display: flex;
  align-items: center;
  gap: 4px;

  .label,
  .value {
    font-size: 14px;
    line-height: 22px;
  }

  .label {
    color: var(--devui-placeholder-text);
  }

  .value {
    color: var(--devui-secondary-text);
    margin-left: -4px;
  }
}
</style>
