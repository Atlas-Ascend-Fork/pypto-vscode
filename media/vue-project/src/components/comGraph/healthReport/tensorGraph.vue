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
  <div class="tensor-graph">
    <StatisticInfo title="Operation" :count="jsonData.totalOpCount" type="op" />
    <div class="limit-info-box">
      <LimitInfo label="MaxDepth" :value="jsonData.maxDepth" />
      <LimitInfo label="MaxWidth" :value="jsonData.maxWidth" type="max-width" />
    </div>
    <DataList :data="opData" :columns="columns" />
    <StatisticInfo title="Tensor" :count="jsonData.totalTensorCount" type="tensor" style="margin: 12px 0" />
    <DataList :data="tensorData" :columns="columns" />
  </div>
</template>

<script setup lang="ts">
import { ref, inject, watch } from 'vue';
import { ColumnAlign, HealthReportProvideKey } from './types';
import type { HealthReportContext } from './types';
import StatisticInfo from './statisticInfo.vue';
import LimitInfo from './limitInfo.vue';
import DataList from './dataList.vue';
import { formatData } from './utils';

const { jsonData } = inject(HealthReportProvideKey) as HealthReportContext;

const columns = ref([
  { field: 'key', header: '' },
  { field: 'value', header: 'value', width: 50, align: ColumnAlign.Right },
]);
const opData = ref<Record<string, any>[]>([]);
const tensorData = ref<Record<string, any>[]>([]);

watch(
  jsonData,
  (val) => {
    opData.value = [
      { key: 'max Fanin', value: val.maxFanin },
      { key: 'max FaninOps', value: formatData(val.maxFaninOps), detail: val.maxFaninOps, type: 'op' },
      { key: 'max Fanout', value: val.maxFanout },
      { key: 'max FanoutOps', value: formatData(val.maxFanoutOps), detail: val.maxFanoutOps, type: 'op' },
    ];
    tensorData.value = [
      { key: 'maxProducerCount', value: val.maxProducerCount },
      { key: 'maxConsumerCount', value: val.maxConsumerCount },
      { key: 'maxProducerTensors', value: formatData(val.maxProducerTensors), detail: val.maxProducerTensors, type: 'tensor' },
      { key: 'maxConsumerTensors', value: formatData(val.maxConsumerTensors), detail: val.maxConsumerTensors, type: 'tensor' },
    ];
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.limit-info-box {
  display: flex;
  gap: 24px;
  margin-top: 8px;
  margin-bottom: 12px;
}
</style>
