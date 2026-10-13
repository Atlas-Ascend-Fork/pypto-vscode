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
