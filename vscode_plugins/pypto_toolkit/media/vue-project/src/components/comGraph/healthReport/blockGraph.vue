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
  <div class="tile-graph">
    <div class="tips-info-box">
      <TipsInfo title="Total Cycles" :count="jsonData.totalCycles" />
      <TipsInfo title="Theoretical Minimum Cycles" :count="jsonData.theoreticalMinimumCycles" />
    </div>
    <d-alert type="danger" :closeable="false" class="health-report-alert">
      {{ maxPipeUsageRate }}{{ t('comGraph.highestUsageRate') }}
    </d-alert>
    <FlowChart :memory="memoryUsage" :pipe="pipeUsageRate" :max-pipe="maxPipeUsageRate" />
    <TipsInfo title="Spill Count" :count="jsonData.spillCount" style="margin-bottom: 12px" />
    <div class="spill-data-list">
      <div class="head">
        <div class="head-item">magic</div>
        <div class="head-item">Type</div>
        <div class="head-item">
          <span>Buffer Usage / Rate</span>
          <span>/ AllocSize</span>
        </div>
        <div class="head-item">
          <span>Spill Tensor / Trigger Tensor</span>
          <span>/ Spill CopyOut Tensor</span>
        </div>
      </div>
      <div class="body">
        <div v-for="(row, index) in spillData" :key="index" class="body-tr">
          <div class="body-td">
            <d-tooltip :content="t('comGraph.locateComGraph')" position="top-end">
              <span>{{ row.spillTensorMagic }}</span>
            </d-tooltip>
          </div>
          <div class="body-td">{{ row.spillBufferType }}</div>
          <div class="body-td">
            <span>{{ row.bufferCurrentUsage }} / {{ row.bufferCurrentUsageRate }}</span>
            <span>/ {{ row.bufferOccupiedByAllocSize }}</span>
          </div>
          <div class="body-td">
            <span>{{ row.spillTensorSize }} / {{ row.triggerTensorSize }}</span>
            <span>/ {{ row.spillCopyoutSize }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="tips-info-box" style="margin-top: 24px; margin-bottom: 12px">
      <TipsInfo title="Workspace offset" :count="jsonData.workspaceOffset" />
      <TipsInfo title="OP" :count="jsonData.totalOpCount" />
    </div>
    <DataList :data="opData" :columns="columns" :column-count="6" />
  </div>
</template>

<script setup lang="ts">
import { ref, inject, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ColumnAlign, HealthReportProvideKey } from './types';
import type { HealthReportContext } from './types';
import TipsInfo from './tipsInfo.vue';
import DataList from './dataList.vue';
import FlowChart from './flowChart.vue';
import { formatData } from './utils';

const { t } = useI18n();
const { jsonData } = inject(HealthReportProvideKey) as HealthReportContext;

const maxPipeUsageRate = ref('');
const memoryUsage = ref();
const pipeUsageRate = ref();
const columns = ref([
  { field: 'key', header: '' },
  { field: 'value', header: 'value', width: 50, align: ColumnAlign.Right },
]);
const opData = ref<Record<string, any>[]>([]);
const spillData = ref<Record<string, any>[]>([]);

const getMaxPipeUsageRate = (pipeUsageRate) => {
  let max = -1;
  let maxKey = '';
  if (pipeUsageRate) {
    Object.keys(pipeUsageRate).forEach((key) => {
      if (pipeUsageRate[key] > max) {
        max = pipeUsageRate[key];
        maxKey = key.split('_Usage_Rate')[0];
      }
    });
  }
  maxPipeUsageRate.value = maxKey;
};

watch(
  jsonData,
  (val) => {
    getMaxPipeUsageRate(val.pipeUsageRate);
    memoryUsage.value = val.memoryUsage;
    pipeUsageRate.value = val.pipeUsageRate;
    opData.value = [
      { key: 'max Producers', value: formatData(val.maxProducersTensors), detail: val.maxProducersTensors, type: 'tensor' },
      { key: 'max Consumers', value: formatData(val.maxConsumersTensors), detail: val.maxConsumersTensors, type: 'tensor' },
      { key: 'max Inputs', value: formatData(val.maxInputsOps), detail: val.maxInputsOps, type: 'op' },
      { key: 'max Outputs', value: formatData(val.maxOutputsOps), detail: val.maxOutputsOps, type: 'op' },
    ];
    spillData.value = val.spillDetails;
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.tips-info-box {
  display: flex;
  gap: 24px;
}
.devui-alert.health-report-alert {
  background-color: var(--devui-alert-bg);
  :deep() {
    .devui-alert__content {
      color: var(--devui-primary-text);
    }
  }
}
.spill-data-list {
  .head {
    display: flex;
    padding: 4px 12px;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    background-color: var(--devui-nest-bg);
    box-sizing: border-box;

    .head-item {
      color: var(--devui-secondary-text);
      font-size: 12px;
      font-weight: 500;
      line-height: 36px;

      &:nth-of-type(1) {
        width: 50px;
      }

      &:nth-of-type(2) {
        width: 80px;
      }

      &:nth-of-type(3) {
        width: 120px;
        display: flex;
        flex-flow: column;
        line-height: 18px;
      }

      &:nth-of-type(4) {
        flex: 1;
        width: 0;
        display: flex;
        flex-flow: column;
        line-height: 18px;
      }
    }
  }

  .body {
    .body-tr {
      display: flex;
      padding: 6px 12px;
      border-bottom: 1px solid var(--devui-input-bg);
      box-sizing: border-box;

      &:hover {
        background-color: var(--devui-input-hover-bg);
      }

      .body-td {
        width: 60px;
        color: var(--devui-primary-text);
        font-weight: 500;
        font-size: 14px;
        line-height: 40px;

        &:nth-of-type(1) {
          width: 50px;
        }

        &:nth-of-type(2) {
          width: 80px;
        }

        &:nth-of-type(3) {
          width: 120px;
          display: flex;
          flex-flow: column;
          line-height: 20px;
        }

        &:nth-of-type(4) {
          flex: 1;
          width: 0;
          display: flex;
          flex-flow: column;
          line-height: 20px;
        }
      }
    }
  }
}
</style>
