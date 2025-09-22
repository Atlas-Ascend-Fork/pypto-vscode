<template>
  <div class="tile-graph">
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
      { key: 'maxProducerCount', value: val.maxProduerCount },
      { key: 'maxConsumerCount', value: val.maxConsumerCount },
      { key: 'maxProducerTensors', value: formatData(val.maxProduerTensors), detail: val.maxProduerTensors, type: 'tensor' },
      { key: 'maxConsumerTensors', value: formatData(val.maxConsumerTensors), detail: val.maxConsumerTensors, type: 'tensor' },
      { key: 'Copy Data Count', value: val.copyDataCount },
      { key: 'Redundant Copy Count', value: val.redundantCopyCount },
      { key: 'Peak Memory Usage', value: val.peakMemory.peakMemoryUsage },
      {
        key: 'Peak Memory Usage Op',
        value: formatData(val.peakMemory.peakMemoryUsageOps),
        detail: val.peakMemory.peakMemoryUsageOps,
        type: 'op',
      },
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
