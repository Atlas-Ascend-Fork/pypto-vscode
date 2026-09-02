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
  <div class="statistic-info">
    <div v-if="props.type" class="icon-wrap">
      <img :src="iconPath" alt="" />
    </div>
    <div class="info-wrap">
      <span class="title">{{ title }}</span>
      <span class="count">{{ count }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { statisticInfoProps } from './types';

const props = defineProps(statisticInfoProps);
const { isDarkTheme } = inject('root');

const IconMap = {
  op: 'health-op',
  tensor: 'health-tensor',
  total: 'health-total',
};
const iconPath = computed(() =>
  props.type ? `${(window as any).staticPath}/static-assets/com-graph/${IconMap[props.type]}${isDarkTheme.value ? '' : '-light'}.svg` : '',
);
</script>

<style scoped lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.statistic-info {
  display: flex;
  align-items: center;

  .icon-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 32px;
    height: 32px;
    margin-right: 8px;
    border: 1px solid var(--devui-input-hover-bg);
    border-radius: 8px;
    background-color: var(--devui-input-hover-bg);
    box-sizing: border-box;
  }

  .info-wrap {
    display: flex;
    flex-direction: column;

    .title {
      font-size: 12px;
      line-height: 18px;
      color: var(--devui-secondary-text);
    }
    .count {
      font-size: 16px;
      font-weight: bold;
      line-height: 24px;
      color: var(--devui-primary-text);
    }
  }
}
</style>
