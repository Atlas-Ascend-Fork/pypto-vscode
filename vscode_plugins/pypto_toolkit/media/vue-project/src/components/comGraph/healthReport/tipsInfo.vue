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
  <div class="tips-info">
    <div class="title">{{ title }}</div>
    <div v-if="count !== undefined" class="count">{{ count }}</div>
  </div>
</template>

<script setup lang="ts">
import { tipsInfoProps } from './types';

defineProps(tipsInfoProps);
</script>

<style scoped lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.tips-info {
  .title {
    display: inline-block;
    color: var(--devui-secondary-text);
    font-size: 12px;
    font-weight: 500;
    line-height: 18px;
    margin-right: 4px;
  }


  .count {
    color: var(--devui-primary-text);
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
  }
}
</style>
