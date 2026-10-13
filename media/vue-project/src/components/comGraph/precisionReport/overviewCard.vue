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
  <div :class="['overview-card-wrap', variant]">
    <div v-for="item in data" :key="item.label" class="overview-card-item-data">
      <div>
        <span class="label-text">{{ item.label }}</span>
        <d-tooltip v-if="item.desc" overlay-class="com-graph-report-standard-tips" :position="['top', 'top-start', 'top-end']">
          <i class="icon icon-helping"></i>
          <template #content>
            <span>{{ item.desc }}</span>
          </template>
        </d-tooltip>
      </div>
      <d-tooltip
        :content="item.tooltip"
        :disabled="!item.tooltip"
        overlay-class="com-graph-report-standard-tips"
        :position="['top', 'top-start', 'top-end']"
      >
        <span class="value-text">{{ item.value }}</span>
      </d-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import type { OverviewCardData } from './precisionReport.types';

defineProps({
  data: { type: Array as PropType<OverviewCardData[]>, default: () => [] },
  variant: { type: String as PropType<'default' | 'footer'>, default: 'default' },
});
</script>

<style scoped lang="scss">
.overview-card-wrap {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  background-color: var(--devui-secondary-button-disabled-bg);
  box-sizing: border-box;
  margin-bottom: 16px;

  &.footer {
    background-color: var(--benchmark-footer-bg);
  }

  .overview-card-item-data {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    .label-text {
      font-size: 14px;
      line-height: 22px;
      margin-right: 4px;
      color: var(--devui-title-text);
      opacity: 0.8;
    }
    .value-text {
      font-size: 18px;
      font-weight: bold;
      line-height: 26px;
      color: var(--devui-title-text);
    }
  }
}
</style>
