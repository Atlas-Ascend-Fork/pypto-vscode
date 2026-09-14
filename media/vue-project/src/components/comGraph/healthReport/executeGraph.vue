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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 -->
<template>
  <div class="tile-graph">
    <div class="statistic-info-box">
      <StatisticInfo
        title="Total Subgraph / Unique"
        :count="`${finalJsonData.totalSubgraphCount} / ${finalJsonData.uniqueSubgraphTypes}`"
        type="total"
      />
      <StatisticInfo :title="t('comGraph.isomorphismRate')" :count="finalJsonData.homogeneityRatio" />
    </div>
    <div class="limit-info-box">
      <LimitInfo label="MaxSubgraphDepth" :value="finalJsonData.maxSubgraphDepth" />
      <LimitInfo label="MaxSubgraphWidth" :value="finalJsonData.maxSubgraphWidth" type="max-width" />
    </div>
    <DataList :data="latencyData" :columns="latencyColumns" class="data-list-box" />
    <DataList :data="maxSubgraphData" :columns="maxSubgraphColumns" class="data-list-box" />
    <DataList :data="peakMemoryData" :columns="peakMemoryColumns" class="data-list-box" />
    <DataList :data="opData" :columns="opColumns" class="data-list-box" />
  </div>
</template>

<script setup lang="ts">
import { ref, inject, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ColumnAlign, HealthReportProvideKey } from './types';
import type { HealthReportContext } from './types';
import StatisticInfo from './statisticInfo.vue';
import LimitInfo from './limitInfo.vue';
import DataList from './dataList.vue';
import { formatData } from './utils';

const { t } = useI18n();
const { jsonData } = inject(HealthReportProvideKey) as HealthReportContext;

const latencyColumns = ref([
  { field: 'key', header: 'Latency' },
  { field: 'value', header: 'value', width: 50 },
  { field: 'subgraphId', header: 'subgraphID', width: 80, align: ColumnAlign.Right },
]);
const maxSubgraphColumns = ref([
  { field: 'key', header: '' },
  { field: 'value', header: 'value', width: 50 },
  { field: 'subgraphId', header: 'subgraphID', width: 80, align: ColumnAlign.Right },
]);
const peakMemoryColumns = ref([
  { field: 'key', header: 'PeakMemoryUsage' },
  { field: 'value', header: 'value', width: 80 },
  { field: 'subgraphId', header: 'subgraphID', width: 80, align: ColumnAlign.Right },
]);
const opColumns = ref([
  { field: 'key', header: `OP${t('comGraph.typeDistribution')}` },
  { field: 'value', header: 'value', width: 80, align: ColumnAlign.Right },
]);
const latencyData = ref<Record<string, any>[]>([]);
const maxSubgraphData = ref<Record<string, any>[]>([]);
const peakMemoryData = ref<Record<string, any>[]>([]);
const opData = ref<Record<string, any>[]>([]);
const finalJsonData = ref<Record<string, any>>({});

watch(
  jsonData,
  (val) => {
    finalJsonData.value = val.execution_graph_analysis;
    latencyData.value = [
      {
        key: 'maxSubgraphCycle',
        value: finalJsonData.value.maxSubgraphCycle,
        subgraphId: formatData(finalJsonData.value.maxCycleSubgraphs),
        detail: finalJsonData.value.maxCycleSubgraphs,
        type: 'subgraph',
      },
      {
        key: 'minSubgraphCycle',
        value: finalJsonData.value.minSubgraphCycle,
        subgraphId: formatData(finalJsonData.value.minCycleSubgraphs),
        detail: finalJsonData.value.minCycleSubgraphs,
        type: 'subgraph',
      },
      { key: 'avgSubgraphCycle', value: finalJsonData.value.avgSubgraphCycle },
    ];
    maxSubgraphData.value = [
      {
        key: 'maxSubgraphFanin',
        value: finalJsonData.value.maxSubgraphFanin,
        subgraphId: formatData(finalJsonData.value.maxFaninSubgraphs),
        detail: finalJsonData.value.maxFaninSubgraphs,
        type: 'subgraph',
      },
      {
        key: 'maxSubgraphFanout',
        value: finalJsonData.value.maxSubgraphFanout,
        subgraphId: formatData(finalJsonData.value.maxFanoutSubgraphs),
        detail: finalJsonData.value.maxFanoutSubgraphs,
        type: 'subgraph',
      },
    ];
    peakMemoryData.value = [
      {
        key: 'PeakUsage',
        value: finalJsonData.value.peakMemoryUsage,
        subgraphId: formatData(finalJsonData.value.peakMemoryUsageSubgraphs),
        detail: finalJsonData.value.peakMemoryUsageSubgraphs,
        type: 'subgraph',
      },
    ];
    opData.value = [
      { key: 'AIV', value: finalJsonData.value.aivSubgraphCount },
      { key: 'AIC', value: finalJsonData.value.aicSubgraphCount },
      { key: 'AICPU', value: finalJsonData.value.aicpuSubgraphCount },
      { key: 'mix', value: finalJsonData.value.mixSubgraphCount },
    ];
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.statistic-info-box {
  display: flex;
  gap: 84px;
}
.limit-info-box {
  display: flex;
  gap: 24px;
  margin-top: 8px;
  margin-bottom: 12px;
}
.data-list-box {
  margin-bottom: 16px;
}
</style>
